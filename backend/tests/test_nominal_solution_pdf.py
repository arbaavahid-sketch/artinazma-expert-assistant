from auth_service import get_current_customer
import io
import pytest
from pypdf import PdfReader
from nominal_solution_pdf_service import NominalSolutionReport,build_nominal_solution_pdf,recompute_nominal


def example(locale='en'):
    r=dict(name='Hypothetical sodium chloride',manufacturer='Example maker',catalogue='CAT1',lot='LOT1',certificate='Hypothetical CoA',purity='۹۹ ٪',purityBasis='w/w')
    return dict(locale=locale,material=dict(name='سدیم کلرید - Sodium chloride',formula='NaCl',cid=5234,retrievedOn='2026-11-05',molarMass='58.44',source='PubChem PUG-REST',version='pubchem-test-v1',chemicalForm='Anhydrous - hypothetical',waters=0),inputs=dict(concentration='.1',volume='100',purity='99',puritySource=' · '.join(r[k] for k in ['name','manufacturer','catalogue','lot','certificate'])),reagent=r,expectedMass=.5903030303030303)


@pytest.mark.parametrize('locale',['fa','en'])
def test_report(locale):
    p=NominalSolutionReport.model_validate(example(locale))
    assert recompute_nominal(p)==pytest.approx(.5903030303030303)
    reader=PdfReader(io.BytesIO(build_nominal_solution_pdf(p)))
    assert len(reader.pages)==2
    text=''.join(page.extract_text() for page in reader.pages)
    for value in ['0.59030303','NaCl','LOT1','CAT1','58.44']:
        assert value in text


@pytest.mark.parametrize('change',[{'purity':'101'},{'volume':'0'},{'concentration':'-1'},{'puritySource':''},{'purity':'98'}])
def test_invalid(change):
    d=example();d['inputs'].update(change)
    with pytest.raises(ValueError):build_nominal_solution_pdf(NominalSolutionReport.model_validate(d))


def test_hydrate_not_double_counted_and_manual_source():
    d=example();d['reagent']=None;d['material'].update(molarMass='249.68',waters=5,chemicalForm='Pentahydrate',formula='CuSO4.5H2O',cid=24463)
    d['expectedMass']=.1*.1*249.68/0.99
    assert recompute_nominal(NominalSolutionReport.model_validate(d))==pytest.approx(d['expectedMass'])
    d['expectedMass']+=1
    with pytest.raises(ValueError):recompute_nominal(NominalSolutionReport.model_validate(d))


def test_snapshot_mismatch_and_long_sources():
    for key,value in [('lot',''),('certificate','Other'),('purityBasis','v/v')]:
        d=example();d['reagent'][key]=value
        with pytest.raises(ValueError):recompute_nominal(NominalSolutionReport.model_validate(d))
    d=example();d['reagent']=None;d['inputs']['puritySource']='Hypothetical long source - '*60
    assert build_nominal_solution_pdf(NominalSolutionReport.model_validate(d)).startswith(b'%PDF-')


def test_endpoint():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routes.uncertainty import router
    from utils.deps import limiter
    app=FastAPI(); app.dependency_overrides[get_current_customer]=lambda: {"customer_id":7,"email":"unit@example.invalid"};app.state.limiter=limiter;app.include_router(router)
    with TestClient(app) as client:
        r=client.post('/uncertainty/nominal-solution-report.pdf',json=example())
        assert r.status_code==200 and r.content.startswith(b'%PDF-')
        assert r.headers['cache-control']=='no-store' and r.headers['x-content-type-options']=='nosniff'
        for extra in [{'expectedMass':1},{'html':'not allowed'}]:
            d=example();d.update(extra)
            assert client.post('/uncertainty/nominal-solution-report.pdf',json=d).status_code==422
