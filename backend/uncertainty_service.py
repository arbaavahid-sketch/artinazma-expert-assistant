"""Validated linear GUM budget with an optional independent Suncal check."""
import math
import os
from importlib.metadata import version
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
import numpy as np
from measurement_models import model_at_nominal, evaluate_model_samples, MODEL_REGISTRY


class BudgetComponent(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    value: float = Field(ge=0, le=1e100)
    sensitivity: float = Field(ge=-1e100, le=1e100)
    kind: Literal["standard", "certificate", "rectangular", "triangular", "resolution", "repeatability"] = "standard"
    certificate_k: float = Field(default=2, gt=0, le=1e6)
    repetitions: int = Field(default=1, ge=1, le=1000000, strict=True)
    degrees_of_freedom: float | None = Field(default=None, ge=1, le=1e9)
    infinite_degrees: bool = False
    study_count: int | None = Field(default=None, ge=2, le=1000000, strict=True)


class Correlation(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    first: int = Field(ge=0)
    second: int = Field(ge=0)
    coefficient: float = Field(ge=-1, le=1)


class SimulationOptions(BaseModel):
    samples: int = Field(default=20000, ge=5000, le=50000, strict=True)
    seed: int = Field(default=12345, ge=0, le=4294967295, strict=True)
    probability: Literal[0.9, 0.95, 0.99] = 0.95


class MeasurementModel(BaseModel):
    kind: str = Field(max_length=80)
    nominals: list[Annotated[float, Field(allow_inf_nan=False, ge=-1e100, le=1e100)]] = Field(min_length=1, max_length=20)
    additional_targets: list[Annotated[int, Field(ge=-1, strict=True)]] = Field(default_factory=list, max_length=99)

    @field_validator("kind")
    @classmethod
    def registered_kind(cls,value):
        if value not in MODEL_REGISTRY:raise ValueError("Unknown registered measurement model")
        return value


class BudgetRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    measured: float = Field(ge=-1e100, le=1e100)
    coverage: float = Field(gt=0, le=1e6)
    coverage_mode: Literal['manual', 'automatic'] = 'manual'
    coverage_probability: Literal[0.9, 0.95, 0.99] = 0.95
    components: list[BudgetComponent] = Field(min_length=1, max_length=100)
    correlations: list[Correlation] = Field(default_factory=list, max_length=4950)
    simulation: SimulationOptions | None = None
    measurement_model: MeasurementModel | None = None


def automatic_coverage(request, contributions, combined):
    """NIST TN1297 Appendix B: independent inputs and a t-approximation.

    Study count estimates s; repetitions is the different count actually averaged.
    Infinite Type B degrees require an explicit source/reliability judgment.
    """
    if any(pair.coefficient for pair in request.correlations):
        raise ValueError('Automatic coverage requires independent components')
    if not combined:
        raise ValueError('Automatic coverage requires nonzero combined uncertainty')
    denominator = 0.0
    degrees = []
    for item, contribution in zip(request.components, contributions):
        specified = sum([item.infinite_degrees, item.degrees_of_freedom is not None, item.study_count is not None])
        if specified > 1:
            raise ValueError('Specify only one degrees-of-freedom source per component')
        if item.study_count is not None and item.kind != 'repeatability':
            raise ValueError('Study count requires a repeatability component')
        df = item.study_count - 1 if item.study_count is not None else item.degrees_of_freedom
        if contribution and not item.infinite_degrees and df is None:
            raise ValueError('Specify degrees of freedom for each nonzero component')
        degrees.append(df)
        if contribution and df is not None:
            denominator += (contribution / combined) ** 4 / df
    effective = 1 / denominator if denominator else math.inf
    # Truncation to a lower integer is the conservative table procedure in B.3.
    table_df = max(1, math.floor(effective)) if math.isfinite(effective) else math.inf
    from scipy.stats import norm, t
    tail = (1 - request.coverage_probability) / 2
    factor = float(t.isf(tail, table_df) if math.isfinite(table_df) else norm.isf(tail))
    return factor, effective, table_df, degrees


def correlation_matrix(request: BudgetRequest):
    size = len(request.components)
    matrix = np.eye(size)
    seen = set()
    for pair in request.correlations:
        if pair.first >= size or pair.second >= size or pair.first == pair.second:
            raise ValueError("Correlation must link two different existing components")
        key = tuple(sorted((pair.first, pair.second)))
        if key in seen:
            raise ValueError("Duplicate correlation pair")
        seen.add(key)
        matrix[pair.first, pair.second] = matrix[pair.second, pair.first] = pair.coefficient
    eigenvalues, eigenvectors = np.linalg.eigh(matrix)
    if eigenvalues[0] < -1e-10:
        raise ValueError("Correlation matrix is not positive semidefinite")
    return matrix, np.maximum(eigenvalues, 0), eigenvectors


def calculate_budget(request: BudgetRequest):
    sensitivities = [item.sensitivity for item in request.components]
    if request.measurement_model:
        try:
            value, sensitivities = model_at_nominal(request.measurement_model.kind, request.measurement_model.nominals)
        except (ZeroDivisionError, OverflowError) as error:
            raise ValueError("Model exceeds the supported numeric range") from error
        base = list(sensitivities)
        definition = MODEL_REGISTRY[request.measurement_model.kind]
        physical_count = len(definition.get("uncertain_indices", list(range(definition["input_count"]))))
        for target in request.measurement_model.additional_targets:
            if target >= physical_count:
                raise ValueError("Additional component target must be a physical model input or the result")
            sensitivities.append(1.0 if target == -1 else base[target])
        if len(sensitivities) != len(request.components):
            raise ValueError("Component count does not match measurement model")
        if not math.isclose(value, request.measured, rel_tol=1e-10, abs_tol=1e-12):
            raise ValueError("Measured value does not match model inputs")
    divisors = {"standard": 1, "rectangular": math.sqrt(3),
                "triangular": math.sqrt(6), "resolution": math.sqrt(12)}
    standard = [item.value / (item.certificate_k if item.kind == "certificate"
                             else math.sqrt(item.repetitions) if item.kind == "repeatability"
                             else divisors[item.kind]) for item in request.components]
    contributions = [u * sensitivity for u, sensitivity in zip(standard, sensitivities)]
    if not all(math.isfinite(value) for value in [*standard, *contributions]):
        raise ValueError("Calculation exceeds the supported numeric range")
    matrix, eigenvalues, eigenvectors = correlation_matrix(request)
    combined = math.hypot(*contributions)
    scale = max(abs(value) for value in contributions)
    if request.correlations and scale:
        scaled = np.array(contributions) / scale
        combined = float(np.linalg.norm(np.sqrt(eigenvalues) * (eigenvectors.T @ scaled))) * scale
    expanded = combined * request.coverage
    if not all(math.isfinite(value) for value in [*standard, *contributions, combined, expanded]):
        raise ValueError("Calculation exceeds the supported numeric range")
    engine = os.getenv("UNCERTAINTY_ENGINE", "builtin").strip().lower()
    engine_version = "1"
    if engine == "suncal":
        combined, engine_version = suncal_budget(contributions, matrix)
        expanded = combined * request.coverage
        if not math.isfinite(expanded):
            raise ValueError("Calculation exceeds the supported numeric range")
    elif engine != "builtin":
        raise RuntimeError("Unsupported uncertainty engine configuration")
    factor = request.coverage
    coverage_metadata = {'coverage_method':'manual'}
    if request.coverage_mode == 'automatic':
        factor, effective, table_df, degrees = automatic_coverage(request, contributions, combined)
        expanded = factor * combined
        if not math.isfinite(expanded):raise ValueError('Calculation exceeds the supported numeric range')
        coverage_metadata = {'coverage_method':'welch-satterthwaite',
            'coverage_probability':request.coverage_probability,
            'effective_degrees_of_freedom':effective if math.isfinite(effective) else None,
            'coverage_t_degrees':table_df if math.isfinite(table_df) else None,
            'component_degrees_of_freedom':degrees,
            'coverage_reference':'https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-b-coverage-factors'}
    result = {
        **coverage_metadata,
        "measured": request.measured,
        "standard_uncertainty": combined,
        "expanded_uncertainty": expanded,
        "coverage": factor,
        "components": [
            {"name": item.name, "standard_uncertainty": u, "contribution": q, "sensitivity": sensitivities[index],
             "variance_percent": (
                 float(100 * (q / combined) * np.dot(matrix[index], np.array(contributions) / combined))
                 if combined else None)}
            for index, (item, u, q) in enumerate(zip(request.components, standard, contributions))
        ],
        "engine": "suncal" if engine == "suncal" else "artin-linear-gum",
        "engine_version": engine_version,
        "correlations": [pair.model_dump() for pair in request.correlations],
        "assumption": ("first-order propagation with registered model sensitivities and input correlations"
                       if request.measurement_model else
                       "linear propagation with supplied sensitivity coefficients and input correlations"),
    }
    if request.simulation:
        result["simulation"] = simulate_budget(request, contributions, standard, eigenvalues, eigenvectors)
    if request.measurement_model:
        result["measurement_model"] = request.measurement_model.model_dump()
    return result


def simulate_budget(request, contributions, standard_values, eigenvalues, eigenvectors, *, _rng=None, _raw=False, _gc_calibration_range=None):
    """Propagate the supplied linear error model with bounded chunked sampling."""
    options = request.simulation
    non_normal = {"rectangular", "triangular", "resolution"}
    for pair in request.correlations:
        if pair.coefficient and any(request.components[index].kind in non_normal
                                    for index in [pair.first, pair.second]):
            raise ValueError("Monte Carlo supports correlations only between normal inputs")
    rng = _rng if _rng is not None else np.random.default_rng(options.seed)
    scale = max(abs(value) for value in contributions)
    if request.measurement_model and scale == 0:
        scale = 1.0
    weights = np.array(contributions) / scale if scale else np.zeros(len(contributions))
    transform = eigenvectors * np.sqrt(eigenvalues)
    draws = np.empty(options.samples)
    applicability_exceedances=0
    calibration_exceedances = 0
    for start in range(0, options.samples, 4096):
        count = min(4096, options.samples - start)
        inputs = rng.standard_normal((count, len(contributions))) @ transform.T
        for index, item in enumerate(request.components):
            if item.kind in {"rectangular", "resolution"}:
                inputs[:, index] = rng.uniform(-math.sqrt(3), math.sqrt(3), count)
            elif item.kind == "triangular":
                inputs[:, index] = rng.triangular(-math.sqrt(6), 0, math.sqrt(6), count)
        if request.measurement_model:
            try:
                with np.errstate(over="raise", invalid="raise", divide="raise"):
                    deviations = inputs * np.array(standard_values)
                    definition = MODEL_REGISTRY[request.measurement_model.kind]
                    base_count = len(definition.get("uncertain_indices", list(range(definition["input_count"])))) + definition["extra_count"]
                    model_deviations = deviations[:, :base_count].copy()
                    output_effect = np.zeros(count)
                    for offset, target in enumerate(request.measurement_model.additional_targets):
                        if target == -1:
                            output_effect += deviations[:, base_count + offset]
                        else:
                            model_deviations[:, target] += deviations[:, base_count + offset]
                    evaluated,exceedances = evaluate_model_samples(request.measurement_model.kind, model_deviations,request.measurement_model.nominals,with_diagnostics=True)
                    if _gc_calibration_range is not None:
                        nominals = request.measurement_model.nominals
                        concentration = (nominals[0]+model_deviations[:, 0]-nominals[2]-model_deviations[:, 2])/(nominals[1]+model_deviations[:, 1])
                        calibration_exceedances += int(np.count_nonzero((concentration < _gc_calibration_range[0]) | (concentration > _gc_calibration_range[1])))
                    evaluated = evaluated + output_effect
                    applicability_exceedances+=exceedances
                    draws[start:start + count] = (evaluated - request.measured) / scale
            except FloatingPointError as error:
                raise ValueError("Simulation exceeds the supported numeric range") from error
        else:
            draws[start:start + count] = inputs @ weights
    if _raw:
        return draws, scale, applicability_exceedances, calibration_exceedances
    tail = (1 - options.probability) / 2
    low, high = np.quantile(draws, [tail, 1 - tail])
    standard = float(np.std(draws, ddof=1)) * scale
    mean_shift = float(np.mean(draws)) * scale
    lower = request.measured + float(low) * scale
    upper = request.measured + float(high) * scale
    mean = request.measured + mean_shift
    if not all(math.isfinite(value) for value in [standard, mean_shift, lower, upper, mean]):
        raise ValueError("Simulation exceeds the supported numeric range")
    counts, edges = np.histogram(draws, bins=30)
    histogram = ([{"offset": float(draws[0]) * scale, "count": options.samples}]
                 if np.all(draws == draws[0]) else [
                     {"offset": float((edges[index] + edges[index + 1]) / 2) * scale, "count": int(value)}
                     for index, value in enumerate(counts)])
    return {
        "engine": "numpy-model-mc" if request.measurement_model else "numpy-linear-mc",
        "engine_version": np.__version__,
        "samples": options.samples, "seed": options.seed,
        "probability": options.probability,
        "mean": mean, "mean_shift": mean_shift, "standard_uncertainty": standard,
        "lower": lower, "upper": upper,
        "interval": "equal-tail",
        "model": request.measurement_model.kind if request.measurement_model else "linearized",
        "normal_assumption": "standard, certificate and repeatability contributions treated as normal",
        "applicability_exceedances":applicability_exceedances,
        "applicability_exceedance_fraction":applicability_exceedances/options.samples,
        "histogram": histogram,
    }


def suncal_budget(contributions: list[float], matrix) -> tuple[float, str]:
    """Evaluate a generated additive error model; no user expression is executed."""
    try:
        from suncal import Model
    except ImportError as error:
        raise RuntimeError("Suncal is not installed in the server environment") from error
    # Scaled independent errors avoid symbolic coefficients and numeric overflow.
    scale = max(abs(value) for value in contributions)
    if scale == 0:
        return 0.0, version("suncal")
    indices = [index for index, value in enumerate(contributions) if value != 0]
    nonzero = [contributions[index] / scale for index in indices]
    model = Model("+".join(f"e{index}" for index in range(len(nonzero))))
    for index, value in enumerate(nonzero):
        model.var(f"e{index}").measure(0).typeb(std=abs(value))
    for first in range(len(indices)):
        for second in range(first + 1, len(indices)):
            # Error terms include signed sensitivities, so their correlations
            # change sign when exactly one sensitivity is negative.
            sign = 1 if nonzero[first] * nonzero[second] >= 0 else -1
            coefficient = float(matrix[indices[first], indices[second]]) * sign
            if coefficient:
                model.variables.correlate(f"e{first}", f"e{second}", coefficient)
    calculation = model.calculate_gum()
    combined = float(next(iter(calculation.uncertainty.values()))) * scale
    if not math.isfinite(combined):
        raise ValueError("Calculation exceeds the supported numeric range")
    return combined, version("suncal")
