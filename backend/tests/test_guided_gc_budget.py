"""Independent reference check for the guided GC budget's optional effects."""
import math
import pytest
from uncertainty_service import BudgetRequest, calculate_budget


def test_gc_extraction_with_shared_scale_rsd_and_physical_input_effect(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE', 'builtin')
    y = (110 - 10.1) / 10.02 * 50 * 2 / (10 * .8)
    request = BudgetRequest(
        measured=y, coverage=2,
        measurement_model={'kind': 'gcExtraction', 'nominals': [110, 10.02, 10.1, 50, 2, 10, 80], 'additional_targets': [-1, -1, 5]},
        components=[
            {'name': name, 'value': value, 'sensitivity': 999}
            for name, value in zip(['area', 'slope', 'intercept', 'volume', 'dilution', 'mass', 'recovery'],
                                   [1, math.sqrt(1.35)/math.sqrt(125), math.sqrt(1.35)*math.sqrt(.25+7.5**2/125), .05, .01, .005, 1])
        ] + [
            {'name': 'shared scale', 'value': .02*y, 'sensitivity': 999},
            {'name': 'method RSD of mean', 'value': .03*y, 'sensitivity': 999, 'kind': 'repeatability', 'repetitions': 4},
            {'name': 'mass drift', 'value': .02, 'sensitivity': 999, 'kind': 'rectangular'},
        ], correlations=[{'first': 1, 'second': 2, 'coefficient': -7.5/math.sqrt(125/4+7.5**2)}])
    result = calculate_budget(request)
    # Baseline is independently established for the four calibration standards.
    expected = math.sqrt((4.480433/2)**2 + (.02*y)**2 + (.015*y)**2 + (y/10*.02/math.sqrt(3))**2)
    assert result['measured'] == pytest.approx(124.6257485)
    assert result['standard_uncertainty'] == pytest.approx(expected, abs=1e-6)
    assert result['expanded_uncertainty'] == pytest.approx(2*expected, abs=2e-6)
    assert [c['sensitivity'] for c in result['components'][-3:]] == pytest.approx([1, 1, -y/10])
