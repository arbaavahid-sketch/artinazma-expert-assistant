from auth_service import get_current_customer
import copy
import math
import numpy as np
import pytest
from pydantic import ValidationError
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mc_study_service import MCStudyRequest, calculate_mc_study, numerical_tolerance, stability_errors
from routes.uncertainty import router
from utils.deps import limiter


def payload():
    return {'budget': {'measured': 10, 'coverage': 2,
            'measurement_model': {'kind': 'gcExtraction', 'nominals': [21, 2, 1, 1, 1, 1, 100]},
            'components': [{'name': key, 'value': .2 if i == 0 else 0, 'kind': 'standard', 'sensitivity': 0}
                           for i, key in enumerate(['area', 'slope', 'intercept', 'volume', 'dilution', 'mass', 'recovery'])]},
            'settings': {'seed': 42, 'max_batches': 5, 'significant_digits': 1, 'probability': .95},
            'calibration_range': [0, 20]}


def test_adaptive_normal_reference_and_exact_reproduction(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE', 'builtin')
    d = MCStudyRequest.model_validate(payload())
    first, second = calculate_mc_study(d), calculate_mc_study(d)
    assert first == second
    assert first['mean'] == pytest.approx(10, abs=.002)
    assert first['standard_uncertainty'] == pytest.approx(.1, rel=.02)
    assert first['lower'] == pytest.approx(10-1.9599639845*.1, abs=.003)
    assert first['upper'] == pytest.approx(10+1.9599639845*.1, abs=.003)
    assert first['samples'] == 50000 and first['batches'] == 5
    assert first['converged'] and first['stop_reason'] == 'tolerance_met'
    assert sum(b['count'] for b in first['histogram']) == first['samples']
    assert len(first['model_sha256']) == 64 and first['rng'] == 'PCG64-SeedSequence-spawn-v1'


def test_stability_formula_and_rounding_tolerance():
    values=np.array([[1,2,3,4],[3,4,5,6],[2,3,4,5],[4,5,6,7],[5,6,7,8]], dtype=float)
    errors=stability_errors(values, 2)
    assert errors == pytest.approx(2*np.std(values, axis=0, ddof=1)/math.sqrt(5)*2)
    assert numerical_tolerance(.00035, 2) == pytest.approx(.000005)
    assert numerical_tolerance(.00035, 1) == pytest.approx(.00005)
    assert numerical_tolerance(9.96, 1) == pytest.approx(5)
    with pytest.raises(ValueError): numerical_tolerance(0, 2)


def test_cap_is_not_reported_as_convergence_and_child_streams_differ(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE', 'builtin')
    d=payload();d['budget']['components'][0]['value']=1.6;d['settings']['significant_digits']=2;d['settings']['probability']=.99
    a=calculate_mc_study(MCStudyRequest.model_validate(d))
    assert not a['converged'] and a['stop_reason']=='batch_limit'
    assert a['samples']==50000
    d['settings']['seed']=43;b=calculate_mc_study(MCStudyRequest.model_validate(d))
    assert a['mean']!=b['mean']
    # Deterministic stream prefix when the budget allows additional batches.
    d['settings']['seed']=42;d['settings']['max_batches']=6;c=calculate_mc_study(MCStudyRequest.model_validate(d))
    assert c['checkpoints'][0]==a['checkpoints'][0]
    assert c['samples']>=a['samples']


def test_extrapolated_draws_are_counted_without_deletion(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    d=payload();d['calibration_range']=[10,20]
    a=calculate_mc_study(MCStudyRequest.model_validate(d))
    assert .47<a['calibration_exceedances']/a['samples']<.53
    assert sum(b['count'] for b in a['histogram'])==a['samples']


def test_invalid_draws_and_unsupported_correlated_pdfs_fail(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    d=payload();d['budget']['components'][1]['value']=100
    with pytest.raises(ValueError): calculate_mc_study(MCStudyRequest.model_validate(d))
    d=payload();d['budget']['components'][0]['kind']='rectangular';d['budget']['correlations']=[{'first':0,'second':1,'coefficient':.5}]
    with pytest.raises(ValueError,match='only between normal'): calculate_mc_study(MCStudyRequest.model_validate(d))


@pytest.mark.parametrize('patch', [{'seed':True},{'max_batches':4},{'max_batches':21},{'significant_digits':True},{'probability':.8}])
def test_strict_bounded_options(patch):
    d=payload();d['settings'].update(patch)
    with pytest.raises(ValidationError): MCStudyRequest.model_validate(d)


def test_endpoint_rejects_wrong_model_and_does_not_change_caller_input(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    app=FastAPI(); app.dependency_overrides[get_current_customer]=lambda: {"customer_id":7,"email":"unit@example.invalid"};app.state.limiter=limiter;app.include_router(router);client=TestClient(app)
    d=payload();before=copy.deepcopy(d);r=client.post('/uncertainty/mc-study',json=d)
    assert r.status_code==200 and d==before
    d['calibration_range']=[11,20]
    assert client.post('/uncertainty/mc-study',json=d).status_code==422
    d=payload();d['budget']['simulation']={'samples':5000}
    assert client.post('/uncertainty/mc-study',json=d).status_code==422
