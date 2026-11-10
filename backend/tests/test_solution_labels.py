from auth_service import get_current_customer
import io
import pytest
from pypdf import PdfReader
from .test_nominal_solution_pdf import example as nominal
from .test_commercial_pdf import example as commercial
from solution_label_pdf_service import SolutionLabelReport,build_solution_label_pdf


def example(kind='nominal',locale='en'):
    return dict(kind=kind,report=(nominal if kind=='nominal' else commercial)(locale),label=dict(solutionId='DEMO-LABEL',preparedBy='Hypothetical operator',preparedOn='2026-11-06 Gregorian',expires='',storage='',notes='Hypothetical label - not actual preparation'))


@pytest.mark.parametrize('kind',['nominal','commercial'])
@pytest.mark.parametrize('locale',['fa','en'])
def test_label(kind,locale):
    reader=PdfReader(io.BytesIO(build_solution_label_pdf(SolutionLabelReport.model_validate(example(kind,locale)))))
    assert len(reader.pages)==1
    text=reader.pages[0].extract_text()
    assert 'DEMO-LABEL' in text and 'mol/L' in text and '100 mL' in text


@pytest.mark.parametrize('change',['empty','result','kind','oversize'])
def test_invalid(change):
    d=example()
    if change=='empty':d['label']['solutionId']=''
    if change=='result':d['report']['expectedMass']=1
    if change=='kind':d['kind']='commercial'
    if change=='oversize':d['label']['notes']='x'*301
    with pytest.raises(ValueError):build_solution_label_pdf(SolutionLabelReport.model_validate(d))


def test_endpoint():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routes.uncertainty import router
    from utils.deps import limiter
    app=FastAPI(); app.dependency_overrides[get_current_customer]=lambda: {"customer_id":7,"email":"unit@example.invalid"};app.state.limiter=limiter;app.include_router(router)
    with TestClient(app) as client:
        r=client.post('/uncertainty/solution-label.pdf',json=example())
        assert r.status_code==200 and r.content.startswith(b'%PDF-')
        assert r.headers['cache-control']=='no-store'
        d=example();d['html']='not accepted'
        assert client.post('/uncertainty/solution-label.pdf',json=d).status_code==422
