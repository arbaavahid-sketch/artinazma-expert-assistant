import io
import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfReader
from physical_pdf_service import PhysicalReport, build_physical_pdf, recompute_report
from routes.uncertainty import router
from utils.deps import limiter


def example(kind='density', locale='fa', long=False):
    raw = lambda value, kind='standard', divisor='': dict(value=value, kind=kind, divisor=divisor, source='مثال فرضی منبع مستقل - Hypothetical source')
    identity = dict(title='مثال فرضی آزمایشگاه - Hypothetical laboratory', sample='S-01', sop='LAB-01', edition='1', matrix='Test')
    if kind == 'density':
        data = dict(modelVersion=1, inputs=dict(mass=dict(nominal='۵۰', uncertainty=raw('.01')),
                    volume=dict(nominal='۲۵', uncertainty=raw('.02'))), conditions='20 C - same sample',
                    coverage='2', coverageSource='مثال فرضی - Hypothetical basis', independent=True)
        measured, standard = 2, (.0004**2+.0016**2)**.5
    else:
        data = dict(mass='50', components=dict(calibration=raw('.004','certificate','2'),
                    resolution=raw('.001','resolution'),repeatability=raw('.003','repeatability','1')),
                    coverage='2', coverageSource='مثال فرضی - Hypothetical basis', independent=True)
        measured, standard = 50, (.002**2+.001**2/12+.003**2)**.5
    if long:
        identity['title'] = ('متن بلند گزارش برای بررسی صفحه‌بندی و خوانایی منابع. ' * 35)[:1900]
        data['coverageSource'] = ('Hypothetical long source - بررسی منبع بلند. ' * 40)[:1900]
    run = dict(kind=kind,modelVersion=1,inputKey=json.dumps(dict(data=data,identity=identity),ensure_ascii=False),
               calculatedAt='2026-11-05T00:00:00Z',measured=measured,standard=standard,expanded=2*standard,coverage=2,
               engine='artin-linear-gum',engineVersion='1')
    return dict(kind=kind,locale=locale,identity=identity,data=data,run=run)


@pytest.mark.parametrize('kind', ['weighing','density'])
@pytest.mark.parametrize('locale', ['fa','en'])
def test_reports_render_with_embedded_fonts_and_page_numbers(monkeypatch, kind, locale):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    content = build_physical_pdf(PhysicalReport.model_validate(example(kind,locale)))
    assert content.startswith(b'%PDF-')
    reader=PdfReader(io.BytesIO(content))
    assert 1 <= len(reader.pages) <= 4
    text='\n'.join(page.extract_text() for page in reader.pages)
    assert 'artin-linear-gum' in text and 'S-01' in text
    assert ('0.003298' if kind=='density' else '0.007234') in text
    assert '/Font' in reader.pages[0]['/Resources']


def test_long_persian_content_wraps_across_pages(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    pdf=build_physical_pdf(PhysicalReport.model_validate(example(long=True)))
    assert len(PdfReader(io.BytesIO(pdf)).pages)>=2


@pytest.mark.parametrize('change', ['measured','snapshot','engine','conditions','source'])
def test_export_rejects_tampered_or_incomplete_run(monkeypatch,change):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    p=example()
    if change=='measured':p['run']['measured']=3
    elif change=='snapshot':p['identity']['title']='edited'
    elif change=='engine':p['run']['engine']='unknown'
    elif change=='conditions':p['data']['conditions']=''
    else:p['data']['inputs']['mass']['uncertainty']['source']=''
    with pytest.raises(ValueError):recompute_report(PhysicalReport.model_validate(p))


def test_pdf_endpoint_headers_and_bad_request(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    app=FastAPI();app.state.limiter=limiter;app.include_router(router)
    client=TestClient(app)
    response=client.post('/uncertainty/physical-report.pdf',json=example())
    assert response.status_code==200 and response.headers['content-type']=='application/pdf'
    assert response.headers['cache-control']=='no-store'
    assert response.content.startswith(b'%PDF-')
    p=example();p['run']['expanded']=999
    assert client.post('/uncertainty/physical-report.pdf',json=p).status_code==422
