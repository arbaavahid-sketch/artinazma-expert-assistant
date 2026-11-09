"""Independent numerical references for the guided mass and density budgets."""
import math
import pytest
from uncertainty_service import BudgetRequest, calculate_budget


def test_guided_density_uses_registered_sensitivities(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE', 'builtin')
    request = BudgetRequest(measured=2, coverage=2,
        measurement_model={'kind': 'density', 'nominals': [50, 25]},
        components=[{'name': 'mass', 'value': .01, 'sensitivity': 999},
                    {'name': 'volume', 'value': .02, 'sensitivity': 999}])
    result = calculate_budget(request)
    assert result['standard_uncertainty'] == pytest.approx(math.hypot(.01/25, 50*.02/25**2))
    assert [c['sensitivity'] for c in result['components']] == pytest.approx([.04, -.08])


def test_guided_weighing_three_sourced_components(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE', 'builtin')
    result = calculate_budget(BudgetRequest(measured=50, coverage=2, components=[
        {'name': 'calibration', 'value': .004, 'kind': 'certificate', 'certificate_k': 2, 'sensitivity': 1},
        {'name': 'resolution', 'value': .001, 'kind': 'resolution', 'sensitivity': 1},
        {'name': 'repeatability', 'value': .003, 'kind': 'repeatability', 'repetitions': 1, 'sensitivity': 1}]))
    assert result['measured'] == 50
    assert result['expanded_uncertainty'] == pytest.approx(2*math.sqrt(.002**2+.001**2/12+.003**2))
