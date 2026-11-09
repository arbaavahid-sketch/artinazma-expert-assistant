import json
import math
from pathlib import Path
import numpy as np
import pytest
from measurement_models import MODEL_REGISTRY,model_at_nominal,evaluate_model_samples,evaluate_tree
from uncertainty_service import BudgetRequest,calculate_budget

def test_additional_input_and_output_effects_enter_the_full_nonlinear_equation(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    data=BudgetRequest(measured=5,coverage=2,
        measurement_model={'kind':'density','nominals':[10,2],'additional_targets':[1,-1]},
        components=[{'name':'mass','value':0,'sensitivity':999},
                    {'name':'volume','value':0,'sensitivity':999},
                    {'name':'additional volume','value':.5,'sensitivity':999,'kind':'rectangular'},
                    {'name':'output effect','value':.1,'sensitivity':999}],
        simulation={'samples':50000,'seed':42})
    answer=calculate_budget(data)
    expected_mean=10*math.log(2.5/1.5)
    expected_variance=100/3.75-expected_mean**2+.1**2
    assert [row['sensitivity'] for row in answer['components']]==pytest.approx([.5,-2.5,-2.5,1])
    assert answer['simulation']['mean']==pytest.approx(expected_mean,abs=.012)
    assert answer['simulation']['standard_uncertainty']==pytest.approx(math.sqrt(expected_variance),rel=.025)
    assert answer['simulation']['mean']>5.08

def test_additional_component_correlations_and_invalid_targets(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    data=dict(measured=5,coverage=2,measurement_model={'kind':'density','nominals':[10,2],'additional_targets':[0]},
        components=[{'name':'mass','value':.1,'sensitivity':999},
                    {'name':'volume','value':0,'sensitivity':999},
                    {'name':'mass calibration','value':.2,'sensitivity':999}],
        correlations=[{'first':0,'second':2,'coefficient':1}],simulation={'samples':5000,'seed':42})
    answer=calculate_budget(BudgetRequest(**data))
    assert answer['standard_uncertainty']==pytest.approx(.15)
    assert answer['simulation']['standard_uncertainty']==pytest.approx(.15,rel=.05)
    for targets in [[2],[],[0,0]]:
        data['measurement_model']['additional_targets']=targets
        with pytest.raises(ValueError):calculate_budget(BudgetRequest(**data))

@pytest.mark.parametrize('kind',list(MODEL_REGISTRY))
def test_every_registered_model_accepts_additional_components(kind,monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    definition=MODEL_REGISTRY[kind];nominal=definition['example']
    value,base=model_at_nominal(kind,nominal)
    indices=definition.get('uncertain_indices',list(range(len(nominal))))
    targets=([0] if indices else [])+[-1]
    expected=base+([base[0]] if indices else [])+[1]
    request=BudgetRequest(measured=value,coverage=2,
        measurement_model={'kind':kind,'nominals':nominal,'additional_targets':targets},
        components=[{'name':str(i),'value':1e-8,'sensitivity':999} for i in range(len(expected))],
        simulation={'samples':5000,'seed':42})
    result=calculate_budget(request)
    assert [row['sensitivity'] for row in result['components']]==pytest.approx(expected)
    assert result['simulation']['standard_uncertainty']==pytest.approx(result['standard_uncertainty'],rel=.08)

@pytest.mark.parametrize("kind",list(MODEL_REGISTRY))
def test_registered_equation_gradient_against_finite_difference(kind):
    definition=MODEL_REGISTRY[kind];nominal=definition['example']
    result,gradient=model_at_nominal(kind,nominal)
    assert math.isfinite(result)
    indices=definition.get('uncertain_indices',list(range(len(nominal))))
    for position,index in enumerate(indices):
        h=max(abs(nominal[index]),.01)*1e-4
        plus=list(nominal);minus=list(nominal);plus[index]+=h;minus[index]-=h
        high=evaluate_tree(definition['expression'],plus)
        low=evaluate_tree(definition['expression'],minus)
        independent=(high-low)/(2*h)
        assert gradient[position]==pytest.approx(independent,rel=2e-5,abs=2e-6)

@pytest.mark.parametrize("kind",list(MODEL_REGISTRY))
def test_every_registered_model_runs_full_equation_monte_carlo(kind,monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    definition=MODEL_REGISTRY[kind];nominal=definition['example']
    measured,sensitivities=model_at_nominal(kind,nominal)
    indices=definition.get('uncertain_indices',list(range(len(nominal))))
    uncertainties=[max(abs(nominal[i]),1)*1e-7 for i in indices]+[1e-7]*definition['extra_count']
    data=BudgetRequest(measured=measured,coverage=2,measurement_model={'kind':kind,'nominals':nominal},
       components=[{'name':str(i),'value':u,'sensitivity':-999} for i,u in enumerate(uncertainties)],simulation={'samples':5000,'seed':42})
    answer=calculate_budget(data)
    assert answer['simulation']['engine']=='numpy-model-mc'
    assert answer['simulation']['model']==kind
    assert answer['simulation']['standard_uncertainty']==pytest.approx(answer['standard_uncertainty'],rel=.08)
    assert sum(row['count'] for row in answer['simulation']['histogram'])==5000
    assert [row['sensitivity'] for row in answer['components']]==pytest.approx(sensitivities)

def test_external_reference_examples_and_units():
    assert model_at_nominal('hthsTbs',[596,.0045,-.1819,0,0])[0]==pytest.approx(2.5001)
    assert round(model_at_nominal('viscosityIndex',[73.3,8.86])[0])==92
    assert model_at_nominal('cetaneA',[.8537,212,261.4,311.4])[0]==pytest.approx(43.8,abs=.1)
    assert model_at_nominal('mercaptanSulfur',[.5,.02,.01,20])[0]==pytest.approx(7.6944)
    assert model_at_nominal('coolantWater',[2,.02,5,1])[0]==pytest.approx(.99)
    assert model_at_nominal('freeAcid',[10,.1,.1,5,60.052,1])[0]==pytest.approx(1.1890296)
    # EPA AP-42 worked example: gasoline RVP12, slope3, 68.9°F ~7.50 psia.
    assert model_at_nominal('trueVaporRefined',[12,3,68.9])[0]/6.894757293168==pytest.approx(7.50,abs=.02)
    rho=850.;water=.001;ash=.0001;sulfur=.01
    assert model_at_nominal('heatGross',[rho,.1,.01,1])[0]==pytest.approx((51.916-8.792e-6*rho*rho)*(1-water-ash-sulfur)+9.420*sulfur)

def test_vi_and_ndm_reselect_piecewise_relations_for_every_draw():
    matrix=np.array([[60.,8.8,0.,0.],[100.,9.,0.,0.],[10000.,80.,0.,0.]])
    answers=evaluate_model_samples('viscosityIndex',matrix)
    for index,row in enumerate(matrix):assert answers[index]==pytest.approx(model_at_nominal('viscosityIndex',row[:2].tolist())[0])
    inputs=np.array([[1.475,.851,300.,0.,0.,0.],[1.4749,.851,300.,0.,0.,0.],[1.4751,.851,300.,0.,0.,0.]])
    ca=evaluate_model_samples('ndmCA',inputs)
    expected=[12.2,12.2+670*2.51*(-.0001),12.2+430*2.51*.0001]
    assert ca==pytest.approx(expected)

def test_static_assets_are_identical_and_unknown_models_are_rejected():
    root=Path(__file__).resolve().parents[2]
    for backend,front in [('measurement_model_registry.json','measurement-registry.json'),('viscosity_index_reference.json','viscosity-index-reference.json')]:
        assert json.loads((root/'backend'/backend).read_text(encoding='utf-8'))==json.loads((root/'frontend/src/app/calculators'/front).read_text(encoding='utf-8'))
    with pytest.raises(ValueError):model_at_nominal('__import__',[1])
    with pytest.raises(ValueError):model_at_nominal('viscosityIndex',[40,1.9])
    with pytest.raises(ValueError):model_at_nominal('heatGross',[1200,0,0,0])

def test_nonlinear_combustion_mean_and_applicability_warning(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    nominal=[850.,0.,0.,0.];measured,coefficients=model_at_nominal('heatGross',nominal)
    result=calculate_budget(BudgetRequest(measured=measured,coverage=2,measurement_model={'kind':'heatGross','nominals':nominal},
       components=[{'name':str(i),'value':80 if i==0 else 0,'sensitivity':c} for i,c in enumerate(coefficients)],simulation={'samples':50000,'seed':42}))
    expected=measured-8.792e-6*80**2
    assert result['simulation']['mean']==pytest.approx(expected,abs=.012)
    assert result['simulation']['applicability_exceedances']>0
    assert sum(b['count'] for b in result['simulation']['histogram'])==50000
