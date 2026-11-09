import io, math
import pytest
from pypdf import PdfReader
from solution_pdf_service import SolutionReport,build_solution_pdf,recompute_solution

def example(locale='fa'):
    raw=lambda v:dict(kind='standard',value=v,divisor='',source='مثال فرضی - Hypothetical source')
    inputs={k:dict(nominal=n,uncertainty=raw(u)) for k,n,u in [('mass','100','.1'),('purity','99','.2'),('volume','100','.05'),('aliquot','',''),('finalVolume','','')]}
    return dict(locale=locale,material=dict(name='متانول - Methanol',formula='CH3OH',cid=887,retrievedOn='2026-11-05'),preparation=dict(dilution=False,independent=True,inputs=inputs),expected=dict(concentration=990,relativePercent=100*math.sqrt(.001**2+(.2/99)**2+.0005**2)),nominalReagentReference='مثال فرضی - DEMO-01')

@pytest.mark.parametrize('locale',['fa','en'])
def test_report(locale):
    p=SolutionReport.model_validate(example(locale));c,u,keys=recompute_solution(p)
    assert c==pytest.approx(990)
    pdf=build_solution_pdf(p)
    reader=PdfReader(io.BytesIO(pdf))
    assert len(reader.pages)>=2
    assert '990' in ''.join(page.extract_text() for page in reader.pages)

@pytest.mark.parametrize('kind',['mismatch','missing','independent','dilution'])
def test_invalid(kind):
    d=example()
    if kind=='mismatch':d['expected']['concentration']=991
    if kind=='missing':d['preparation']['inputs']['mass']['uncertainty']['source']=''
    if kind=='independent':d['preparation']['independent']=False
    if kind=='dilution':d['preparation']['dilution']=True
    with pytest.raises(ValueError):build_solution_pdf(SolutionReport.model_validate(d))

def test_endpoint_headers_and_invalid_result():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routes.uncertainty import router
    from utils.deps import limiter
    app=FastAPI();app.state.limiter=limiter;app.include_router(router)
    with TestClient(app) as client:
        r=client.post('/uncertainty/solution-report.pdf',json=example('en'))
        assert r.status_code==200
        assert r.headers['content-type']=='application/pdf'
        assert r.headers['cache-control']=='no-store'
        assert r.content.startswith(b'%PDF-')
        d=example();d['expected']['concentration']=1
        assert client.post('/uncertainty/solution-report.pdf',json=d).status_code==422
        d=example();d['html']='<html>not accepted</html>'
        assert client.post('/uncertainty/solution-report.pdf',json=d).status_code==422
