from auth_service import get_current_customer
import io
import pytest
from pypdf import PdfReader
from dilution_pdf_service import DilutionReport,build_dilution_pdf,recompute_dilution

def example(locale='fa'):
    return dict(locale=locale,material=dict(name='متانول - Methanol',formula='CH3OH',cid=887),plan=dict(stock='1000',unit='mg/L',source='مثال فرضی - Hypothetical stock',steps=[dict(target='100',unit='mg/L',volume='100',volumeUnit='mL'),dict(target='1',unit='mg/L',volume='100',volumeUnit='mL')],label=dict(solutionId='DEMO',preparedBy='مثال فرضی',preparedOn='2026-11-06 Gregorian',expires='',storage='',notes='فرضی - Hypothetical')),expectedAliquots=[10,1])
@pytest.mark.parametrize('locale',['fa','en'])
def test_pdf(locale):
    p=DilutionReport.model_validate(example(locale))
    assert [r['aliquot'] for r in recompute_dilution(p)]==[10,1]
    pdf=build_dilution_pdf(p)
    reader=PdfReader(io.BytesIO(pdf))
    assert len(reader.pages)>=2
    text=''.join(p.extract_text() for p in reader.pages)
    assert 'DEMO-D1' in text and 'DEMO-D2' in text
@pytest.mark.parametrize('bad',['unit','source','result','volume','id'])
def test_invalid(bad):
    d=example()
    if bad=='unit':
        d['plan']['steps'][0]['unit']='mol/L'
    if bad=='source':
        d['plan']['source']=''
    if bad=='result':
        d['expectedAliquots'][0]=11
    if bad=='volume':
        d['plan']['steps'][1].update(target='50',volume='1000')
    if bad=='id':
        d['plan']['label']['solutionId']=''
    with pytest.raises(ValueError):
        build_dilution_pdf(DilutionReport.model_validate(d))

def test_endpoint_and_long_labels():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routes.uncertainty import router
    from utils.deps import limiter
    app=FastAPI()
    app.dependency_overrides[get_current_customer]=lambda: {"customer_id":7,"email":"unit@example.invalid"}
    app.state.limiter=limiter
    app.include_router(router)
    with TestClient(app) as client:
        r=client.post('/uncertainty/dilution-report.pdf',json=example())
        assert r.status_code==200 and r.content.startswith(b'%PDF-')
        assert r.headers['cache-control']=='no-store'
        bad=example()
        bad['expectedAliquots']=[1,1]
        assert client.post('/uncertainty/dilution-report.pdf',json=bad).status_code==422
    d=example()
    for k in ['preparedBy','preparedOn','expires','storage']:
        d['plan']['label'][k]='Example text '*15
    d['plan']['label']['notes']='Long notes '*25
    assert build_dilution_pdf(DilutionReport.model_validate(d)).startswith(b'%PDF-')
