import math
import pytest
from uncertainty_service import BudgetRequest, calculate_budget


def budget(components, **options):
    return BudgetRequest(measured=10, coverage=2, components=components,
                         coverage_mode='automatic', **options)


def test_small_sample_coverage_uses_study_size_not_number_averaged(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    result=calculate_budget(budget([dict(name='Repeatability',value=.3,sensitivity=1,
        kind='repeatability',repetitions=1,study_count=9)]))
    # NIST TN1297 Appendix B: ν=8 gives t_95≈2.306, rather than 2.
    assert result['effective_degrees_of_freedom']==pytest.approx(8)
    assert result['coverage']==pytest.approx(2.306004135,rel=1e-8)
    assert result['standard_uncertainty']==pytest.approx(.3)
    assert result['expanded_uncertainty']==pytest.approx(.6918012405,rel=1e-8)
    assert result['component_degrees_of_freedom']==[8]


def test_finite_and_infinite_contributions_use_welch_satterthwaite(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    result=calculate_budget(budget([dict(name='A',value=2,sensitivity=-1,degrees_of_freedom=4),
                                    dict(name='B',value=1,sensitivity=1,infinite_degrees=True)]))
    assert result['effective_degrees_of_freedom']==pytest.approx(6.25)
    assert result['coverage_t_degrees']==6
    assert result['coverage']==pytest.approx(2.446911851,rel=1e-8)
    assert result['expanded_uncertainty']==pytest.approx(math.sqrt(5)*result['coverage'])


@pytest.mark.parametrize('probability,k',[(.9,1.644853626951),(.95,1.95996398454),(.99,2.575829303549)])
def test_explicit_infinite_degrees_use_normal_quantiles(probability,k,monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    result=calculate_budget(budget([dict(name='B',value=.1,sensitivity=1,infinite_degrees=True)],coverage_probability=probability))
    assert result['effective_degrees_of_freedom'] is None
    assert result['coverage_t_degrees'] is None
    assert result['coverage']==pytest.approx(k,rel=1e-10)


def test_unknown_degrees_correlations_and_contradictory_evidence_are_rejected(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    base=dict(name='A',value=.1,sensitivity=1)
    for component in [base,{**base,'study_count':10},{**base,'degrees_of_freedom':5,'infinite_degrees':True}]:
        with pytest.raises(ValueError):calculate_budget(budget([component]))
    with pytest.raises(ValueError,match='independent'):
        calculate_budget(budget([{**base,'infinite_degrees':True}]*2,
            correlations=[dict(first=0,second=1,coefficient=.5)]))
    with pytest.raises(ValueError,match='nonzero'):
        calculate_budget(budget([{**base,'value':0}]))
    # Zero-contribution components do not need invented degrees of freedom.
    result=calculate_budget(budget([{**base,'infinite_degrees':True},{**base,'value':0}]))
    assert result['coverage']==pytest.approx(1.95996398454)


def test_manual_coverage_remains_unchanged_with_unknown_degrees(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    result=calculate_budget(BudgetRequest(measured=1,coverage=3,
        components=[dict(name='A',value=.1,sensitivity=-1)]))
    assert result['coverage']==3
    assert result['expanded_uncertainty']==pytest.approx(.3)
    assert result['coverage_method']=='manual'


def test_automatic_coverage_and_full_monte_carlo_can_be_reported_separately(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    result=calculate_budget(BudgetRequest(measured=5,coverage=2,coverage_mode='automatic',
        measurement_model=dict(kind='density',nominals=[10,2]),
        components=[dict(name='mass',value=.1,sensitivity=999,degrees_of_freedom=8),
                    dict(name='volume',value=0,sensitivity=999)],
        simulation=dict(samples=5000,seed=42)))
    assert result['coverage']==pytest.approx(2.306004135,rel=1e-8)
    assert result['simulation']['model']=='density'
    assert result['simulation']['standard_uncertainty']==pytest.approx(.05,rel=.05)
