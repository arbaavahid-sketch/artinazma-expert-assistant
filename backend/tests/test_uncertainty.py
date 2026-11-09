import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from uncertainty_service import BudgetComponent, BudgetRequest, calculate_budget
from routes.uncertainty import router
from utils.deps import limiter


def payload():
    return {"measured": 10, "coverage": 2, "components": [
        {"name": "certificate", "value": .1, "sensitivity": 1, "kind": "certificate", "certificate_k": 2}
    ]}


def test_budget_route():
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(router)
    with TestClient(app) as client:
        response = client.post("/uncertainty/budget", json=payload())
        assert response.status_code == 200
        assert response.json()["expanded_uncertainty"] == pytest.approx(.1)
        bad = payload()
        bad["components"][0]["certificate_k"] = 0
        assert client.post("/uncertainty/budget", json=bad).status_code == 422


def test_signed_sensitivities_and_variance_shares():
    data = payload()
    data["components"] = [
        {"name": "a", "value": .03, "sensitivity": -1},
        {"name": "b", "value": .04, "sensitivity": 1},
    ]
    result = calculate_budget(BudgetRequest(**data))
    assert result["standard_uncertainty"] == pytest.approx(.05)
    assert result["components"][0]["variance_percent"] == pytest.approx(36)


@pytest.mark.parametrize("value", [float("inf"), float("nan"), -1])
def test_rejects_invalid_standard_uncertainty(value):
    data = payload()
    data["components"][0]["value"] = value
    with pytest.raises(ValidationError):
        BudgetRequest(**data)

def test_public_calculation_with_production_csrf_middleware(monkeypatch):
    from security_middleware import CSRFMiddleware
    monkeypatch.setenv("TESTING", "0")
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(router)
    app.add_middleware(CSRFMiddleware)
    with TestClient(app) as client:
        response = client.post("/uncertainty/budget", json=payload())
        assert response.status_code == 200
        assert response.json()["standard_uncertainty"] == pytest.approx(.05)

def test_invalid_engine_does_not_silently_fallback(monkeypatch):
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "unknown")
    with pytest.raises(RuntimeError):
        calculate_budget(BudgetRequest(**payload()))


def test_suncal_matches_builtin_when_installed(monkeypatch):
    pytest.importorskip("suncal")
    data = payload()
    data["components"].append({"name": "repeatability", "value": .03, "sensitivity": -2})
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    reference = calculate_budget(BudgetRequest(**data))
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "suncal")
    actual = calculate_budget(BudgetRequest(**data))
    assert actual["engine"] == "suncal"
    assert actual["engine_version"]
    assert actual["expanded_uncertainty"] == pytest.approx(reference["expanded_uncertainty"], rel=1e-12)
    zero = payload()
    zero["components"][0]["value"] = 0
    assert calculate_budget(BudgetRequest(**zero))["standard_uncertainty"] == 0

@pytest.mark.parametrize("r, expected", [(1, .07), (-1, .01), (.5, (.0037) ** .5)])
def test_correlated_budgets(monkeypatch, r, expected):
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    data = payload()
    data["components"] = [
        {"name": "a", "value": .03, "sensitivity": 1},
        {"name": "b", "value": .04, "sensitivity": 1},
    ]
    data["correlations"] = [{"first": 0, "second": 1, "coefficient": r}]
    result = calculate_budget(BudgetRequest(**data))
    assert result["standard_uncertainty"] == pytest.approx(expected, abs=1e-12)
    assert sum(item["variance_percent"] for item in result["components"]) == pytest.approx(100)


def test_rejects_inconsistent_correlation_matrix():
    data = payload()
    data["components"] *= 3
    data["correlations"] = [
        {"first": 0, "second": 1, "coefficient": .9},
        {"first": 0, "second": 2, "coefficient": .9},
        {"first": 1, "second": 2, "coefficient": -.9},
    ]
    with pytest.raises(ValueError, match="positive semidefinite"):
        calculate_budget(BudgetRequest(**data))


def test_suncal_correlations_respect_negative_sensitivity(monkeypatch):
    pytest.importorskip("suncal")
    data = payload()
    data["components"] = [
        {"name": "a", "value": .03, "sensitivity": -1},
        {"name": "b", "value": .04, "sensitivity": 1},
    ]
    data["correlations"] = [{"first": 0, "second": 1, "coefficient": .5}]
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "suncal")
    result = calculate_budget(BudgetRequest(**data))
    assert result["standard_uncertainty"] == pytest.approx((.0013) ** .5, rel=1e-12)

def test_repeatability_divides_by_actual_average_count():
    data = payload()
    data["components"] = [{"name": "repeatability", "value": .2, "sensitivity": 1,
                           "kind": "repeatability", "repetitions": 4}]
    assert calculate_budget(BudgetRequest(**data))["standard_uncertainty"] == pytest.approx(.1)
    data["components"][0]["repetitions"] = 1.5
    with pytest.raises(ValidationError):
        BudgetRequest(**data)

def test_eurachem_a1_matches_supplied_workbench_example(monkeypatch):
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    mass, purity_percent, volume = 100.28, 99.99, 100
    concentration = 10 * mass * purity_percent / volume
    data = {
        "measured": concentration, "coverage": 2,
        "components": [
            {"name": "mass", "value": .05, "sensitivity": 10 * purity_percent / volume},
            {"name": "purity", "value": .01, "sensitivity": 10 * mass / volume, "kind": "rectangular"},
            {"name": "flask", "value": .1, "sensitivity": -concentration / volume, "kind": "triangular"},
            {"name": "temperature", "value": 4, "sensitivity": -concentration * .00021, "kind": "rectangular"},
            {"name": "filling", "value": .02, "sensitivity": -concentration / volume},
        ],
    }
    result = calculate_budget(BudgetRequest(**data))
    assert result["measured"] == pytest.approx(1002.69972, rel=1e-12)
    # Analytic propagation and the Workbench stored result differ by ~1.02e-7.
    assert result["standard_uncertainty"] == pytest.approx(.8351992267684394, rel=1e-12)
    assert result["standard_uncertainty"] == pytest.approx(.835199328725876, rel=2e-7)

def test_eurachem_a2_reference(monkeypatch):
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    mass, purity, molar, volume = .3888, 100, 204.2212, 18.64
    c = 10 * mass * purity / (molar * volume)
    result = calculate_budget(BudgetRequest(
        measured=c, coverage=2,
        components=[
            BudgetComponent(name="mass", value=.00012247448713916, sensitivity=c/mass),
            BudgetComponent(name="purity", value=.05, sensitivity=c/purity, kind="rectangular"),
            BudgetComponent(name="molar mass", value=.00376530211271287, sensitivity=-c/molar),
            BudgetComponent(name="burette", value=.15, sensitivity=-c/100, kind="triangular"),
            BudgetComponent(name="temperature", value=.03, sensitivity=-c/100),
            BudgetComponent(name="repeatability", value=.05, sensitivity=c/100),
        ],
    ))
    assert c == pytest.approx(.102136159706791, rel=1e-12)
    assert result["standard_uncertainty"] == pytest.approx(9.67818987998781e-5, rel=1e-6)

def test_monte_carlo_is_reproducible_and_matches_normal_budget(monkeypatch):
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    data = payload()
    data["simulation"] = {"samples": 20000, "seed": 42, "probability": .95}
    first = calculate_budget(BudgetRequest(**data))
    second = calculate_budget(BudgetRequest(**data))
    assert first["simulation"] == second["simulation"]
    simulation = first["simulation"]
    assert simulation["standard_uncertainty"] == pytest.approx(.05, rel=.03)
    assert simulation["lower"] == pytest.approx(10 - 1.9599639845 * .05, abs=.005)
    assert simulation["upper"] == pytest.approx(10 + 1.9599639845 * .05, abs=.005)
    assert sum(bin["count"] for bin in simulation["histogram"]) == 20000


@pytest.mark.parametrize("kind, half95", [("rectangular", .95), ("triangular", 1 - .05 ** .5)])
def test_monte_carlo_keeps_non_normal_distributions(monkeypatch, kind, half95):
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    data = payload()
    data["components"] = [{"name": "bound", "value": 1, "sensitivity": 1, "kind": kind}]
    data["simulation"] = {"samples": 30000, "seed": 42}
    result = calculate_budget(BudgetRequest(**data))
    assert result["simulation"]["lower"] == pytest.approx(10 - half95, abs=.02)
    assert result["simulation"]["upper"] == pytest.approx(10 + half95, abs=.02)
    assert result["simulation"]["standard_uncertainty"] == pytest.approx(result["standard_uncertainty"], rel=.03)


def test_monte_carlo_correlated_normal_inputs(monkeypatch):
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    data = payload()
    data["components"] = [{"name": "a", "value": .03, "sensitivity": -1},
                          {"name": "b", "value": .04, "sensitivity": 1}]
    data["correlations"] = [{"first": 0, "second": 1, "coefficient": .5}]
    data["simulation"] = {"samples": 20000, "seed": 42}
    result = calculate_budget(BudgetRequest(**data))
    assert result["simulation"]["standard_uncertainty"] == pytest.approx(result["standard_uncertainty"], rel=.03)
    data["components"][0]["kind"] = "rectangular"
    with pytest.raises(ValueError, match="only between normal"):
        calculate_budget(BudgetRequest(**data))


def test_monte_carlo_zero_budget_and_sample_limit(monkeypatch):
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    data = payload()
    data["components"][0]["value"] = 0
    data["simulation"] = {"samples": 5000}
    simulation = calculate_budget(BudgetRequest(**data))["simulation"]
    assert simulation["lower"] == simulation["upper"] == 10
    assert simulation["standard_uncertainty"] == 0
    data["simulation"]["samples"] = 50001
    with pytest.raises(ValidationError):
        BudgetRequest(**data)

def test_full_density_model_captures_nonlinear_mean_and_interval(monkeypatch):
    import math
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    data = {
        "measured": 1, "coverage": 2, "measurement_model": {"kind": "density", "nominals": [1, 1]},
        "components": [{"name": "mass", "value": 0, "sensitivity": 999},
                       {"name": "volume", "value": .4, "sensitivity": 999, "kind": "rectangular"}],
        "simulation": {"samples": 30000, "seed": 42},
    }
    result = calculate_budget(BudgetRequest(**data))
    assert result["components"][1]["sensitivity"] == -1
    assert result["standard_uncertainty"] == pytest.approx(.4 / math.sqrt(3))
    simulation = result["simulation"]
    expected_mean = math.log(1.4 / .6) / .8
    assert simulation["engine"] == "numpy-model-mc"
    assert simulation["model"] == "density"
    assert simulation["mean"] == pytest.approx(expected_mean, abs=.01)
    assert simulation["lower"] == pytest.approx(1 / 1.38, abs=.01)
    assert simulation["upper"] == pytest.approx(1 / .62, abs=.01)


def test_full_gc_model_matches_reciprocal_mass_distribution(monkeypatch):
    import math
    monkeypatch.setenv("UNCERTAINTY_ENGINE", "builtin")
    data = {
        "measured": 125, "coverage": 2,
        "measurement_model": {"kind": "gcExtraction", "nominals": [110, 10, 10, 50, 2, 10, 80]},
        "components": [{"name": str(index), "value": 2 if index == 5 else 0,
                        "kind": "rectangular", "sensitivity": 0} for index in range(7)],
        "simulation": {"samples": 30000, "seed": 42},
    }
    result = calculate_budget(BudgetRequest(**data))
    assert result["components"][5]["sensitivity"] == -12.5
    simulation = result["simulation"]
    assert simulation["model"] == "gcExtraction"
    assert simulation["mean"] == pytest.approx(1250 * math.log(12 / 8) / 4, abs=.5)
    assert simulation["lower"] == pytest.approx(1250 / 11.9, abs=.5)
    assert simulation["upper"] == pytest.approx(1250 / 8.1, abs=.5)


def test_full_model_rejects_invalid_samples_and_mismatched_nominal():
    data = {
        "measured": 1, "coverage": 2, "measurement_model": {"kind": "density", "nominals": [1, 1]},
        "components": [{"name": "mass", "value": 0, "sensitivity": 1},
                       {"name": "volume", "value": 10, "sensitivity": -1}],
        "simulation": {"samples": 5000, "seed": 42},
    }
    with pytest.raises(ValueError, match="registered model domain"):
        calculate_budget(BudgetRequest(**data))
    data["measured"] = 2
    with pytest.raises(ValueError, match="does not match"):
        calculate_budget(BudgetRequest(**data))
