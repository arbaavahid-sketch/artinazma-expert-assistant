import io
import pytest
from pypdf import PdfReader
from commercial_pdf_service import CommercialReport, build_commercial_pdf, recompute_commercial


def example(locale='en'):
    r=dict(name='Hypothetical product',manufacturer='Example maker',catalogue='CAT1',lot='LOT1',certificate='Hypothetical CoA',purity='۵۰ ٪',purityBasis='w/w')
    return dict(locale=locale,material=dict(name='متانول - Methanol',formula='CH3OH',cid=887,retrievedOn='2026-11-05'),molarMass='32.042',commercial=dict(massPercent='50',percentSource=r['certificate'],density='1',densityConditions='20 C - hypothetical',densitySource='Hypothetical density',productReference=' · '.join(r[k] for k in ['name','manufacturer','catalogue','lot','certificate']),target='1',volume='100',volumeUnit='mL',sameSpecies=True,reagent=r),expectedAliquot=6.4084)


@pytest.mark.parametrize('locale',['en','fa'])
def test_report(locale):
    p=CommercialReport.model_validate(example(locale))
    stock,aliquot,mass,volume=recompute_commercial(p)
    assert aliquot==pytest.approx(6.4084)
    assert stock==pytest.approx(500/32.042)
    reader=PdfReader(io.BytesIO(build_commercial_pdf(p)))
    assert len(reader.pages)>=2
    text=''.join(page.extract_text() for page in reader.pages)
    for value in ['6.4084','LOT1','CAT1','Hypothetical density','20 C']:
        assert value in text


@pytest.mark.parametrize('change',[{'massPercent':'101'},{'density':'0'},{'sameSpecies':False},{'target':'20'},{'densitySource':''},{'massPercent':'49'},{'percentSource':'other'}])
def test_invalid(change):
    d=example();d['commercial'].update(change)
    with pytest.raises(ValueError):build_commercial_pdf(CommercialReport.model_validate(d))


def test_mismatch_units_and_unlinked():
    d=example();d['expectedAliquot']=1
    with pytest.raises(ValueError):build_commercial_pdf(CommercialReport.model_validate(d))
    d=example();d['commercial'].update(volume='.1',volumeUnit='L',reagent=None)
    assert recompute_commercial(CommercialReport.model_validate(d))[1]==pytest.approx(6.4084)


def test_endpoint():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routes.uncertainty import router
    from utils.deps import limiter
    app=FastAPI();app.state.limiter=limiter;app.include_router(router)
    with TestClient(app) as client:
        r=client.post('/uncertainty/commercial-report.pdf',json=example())
        assert r.status_code==200 and r.content.startswith(b'%PDF-')
        assert r.headers['cache-control']=='no-store'
        assert r.headers['x-content-type-options']=='nosniff'
        d=example();d['html']='not accepted'
        assert client.post('/uncertainty/commercial-report.pdf',json=d).status_code==422
        d=example();d['expectedAliquot']=1
        assert client.post('/uncertainty/commercial-report.pdf',json=d).status_code==422


def test_long_sources_and_invalid_snapshot():
    d=example();d['commercial']['densitySource']='Long source - ' * 120
    assert build_commercial_pdf(CommercialReport.model_validate(d)).startswith(b'%PDF-')
    for key,value in [('lot',''),('purityBasis','v/v'),('certificate','Other CoA')]:
        d=example();d['commercial']['reagent'][key]=value
        with pytest.raises(ValueError):build_commercial_pdf(CommercialReport.model_validate(d))
