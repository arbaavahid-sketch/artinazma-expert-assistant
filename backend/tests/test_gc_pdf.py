from auth_service import get_current_customer
import io
import json
import math
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfReader
from gc_pdf_service import GCReport, build_gc_pdf, recompute_gc
from uncertainty_service import BudgetRequest, calculate_budget
from routes.uncertainty import router
from utils.deps import limiter


def example(locale='fa', extras=False):
    raw=lambda value:dict(value=value,kind='standard',divisor='',source='مثال فرضی - Hypothetical source')
    rows=[['0','10'],['5','61'],['10','109'],['15','161']]
    values=dict(area='110',extract='50',dilution='2',mass='10',recovery='80')
    uncertainties={k:raw(v) for k,v in zip(values,['1','.05','.01','.005','1'])}
    data=dict(values=values,uncertainties=uncertainties,coverage='2',coverageSource='مثال فرضی - Hypothetical k basis')
    y=(110-10.1)/10.02*50*2/(10*.8)
    rho=-7.5/math.sqrt(125/4+7.5**2)
    comps=[dict(name=k,value=v,sensitivity=1) for k,v in zip(['area','slope','intercept','extract','dilution','mass','recovery'],[1,math.sqrt(1.35/125),math.sqrt(1.35*(.25+7.5**2/125)),.05,.01,.005,1])]
    targets=[]
    if extras:
        prep=dict(dilution=True,independent=True,inputs={k:dict(nominal=v,uncertainty=raw(u)) for k,v,u in [('mass','100','.1'),('purity','99.5','.2'),('volume','100','.1'),('aliquot','10','.05'),('finalVolume','100','.05')]})
        stock=dict(id='stock',preset='standardScale',name='',target='result',basis='relative',value='',kind='standard',divisor='',source='',overlapNote='Shared scale excluded from fit scatter',independent=True,preparation=prep)
        precision=dict(id='precision',preset='methodPrecision',name='',target='result',basis='relative',value='2',kind='repeatability',divisor='1',source='Independent whole-method study',overlapNote='Does not repeat input effects',independent=True)
        drift=dict(id='drift',preset='custom',name='انحراف جرم - Mass drift',target='mass',basis='absolute',value='.02',kind='rectangular',divisor='',source='Balance drift study',overlapNote='Excluded from mass certificate',independent=True)
        data['additional']=[stock,precision,drift]
        relative=math.hypot(.1/100,.2/99.5,.1/100,.05/10,.05/100)
        comps += [dict(name='standardScale',value=relative*y,sensitivity=1),dict(name='methodPrecision',value=.02*y,kind='repeatability',repetitions=1,sensitivity=1),dict(name='Mass drift',value=.02,kind='rectangular',sensitivity=1)]
        targets=[-1,-1,5]
    result=calculate_budget(BudgetRequest(measured=y,coverage=2,measurement_model=dict(kind='gcExtraction',nominals=[110,10.02,10.1,50,2,10,80],additional_targets=targets),components=comps,correlations=[dict(first=1,second=2,coefficient=rho)]))
    run=dict(inputKey=json.dumps(dict(rows=rows,data=data),ensure_ascii=False),calculatedAt='2026-11-05T00:00:00Z',measured=result['measured'],standard=result['standard_uncertainty'],expanded=result['expanded_uncertainty'],coverage=2,engine=result['engine'],engineVersion=result['engine_version'])
    return dict(locale=locale,identity=dict(title='مثال فرضی GC-FID',sample='S-01',sop='LAB-GC-01',edition='1',matrix='Soil'),rows=rows,data=data,run=run)


@pytest.mark.parametrize('extras',[False,True])
def test_gc_recomputation_matches_reference_with_covariance_and_preparation(monkeypatch,extras):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    payload=GCReport.model_validate(example(extras=extras))
    result,fit=recompute_gc(payload)
    assert result['measured']==pytest.approx(124.6257485)
    assert fit['slope']==pytest.approx(10.02)
    assert fit['intercept']==pytest.approx(10.1)
    if not extras:assert result['expanded_uncertainty']==pytest.approx(4.480433,abs=1e-6)
    assert len(result['components'])==(10 if extras else 7)
    assert fit['correlation']<0


@pytest.mark.parametrize('locale',['fa','en'])
def test_complete_pdf_includes_fit_sources_preparation_and_budget(monkeypatch,locale):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    content=build_gc_pdf(GCReport.model_validate(example(locale,extras=True)))
    reader=PdfReader(io.BytesIO(content));text='\n'.join(p.extract_text() for p in reader.pages)
    assert content.startswith(b'%PDF-') and 4<=len(reader.pages)<=12
    assert 'حجم عصاره' not in text
    assert ('Raw sample data' if locale=='en' else 'داده‌های خام نمونه') in text
    for token in ['124.6257','corr(a,b)','LAB-GC-01','artin-linear-gum','relative u','99.5','mg/L']:
        assert token in text


@pytest.mark.parametrize('field',['rows','result','source','independence','purity','range'])
def test_invalid_or_changed_input_cannot_be_exported(monkeypatch,field):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    p=example(extras=True)
    if field=='rows':p['rows'][1][1]='999'
    elif field=='result':p['run']['standard']=999
    elif field=='source':p['data']['uncertainties']['mass']['source']=''
    elif field=='independence':p['data']['additional'][0]['independent']=False
    elif field=='purity':p['data']['additional'][0]['preparation']['inputs']['purity']['nominal']='101'
    else:p['data']['values']['area']='999999'
    # Rebind the snapshot to ensure semantic checks are tested, not only stale-key detection.
    p['run']['inputKey']=json.dumps(dict(rows=p['rows'],data=p['data']))
    with pytest.raises(ValueError):recompute_gc(GCReport.model_validate(p))


def test_gc_pdf_route_rejects_bad_result_and_returns_pdf(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    app=FastAPI(); app.dependency_overrides[get_current_customer]=lambda: {"customer_id":7,"email":"unit@example.invalid"};app.state.limiter=limiter;app.include_router(router);client=TestClient(app)
    p=example();response=client.post('/uncertainty/gc-report.pdf',json=p)
    assert response.status_code==200 and response.content.startswith(b'%PDF-')
    assert response.headers['cache-control']=='no-store'
    p['run']['expanded']=99
    assert client.post('/uncertainty/gc-report.pdf',json=p).status_code==422


def test_long_table_source_is_preserved_in_the_reference_appendix(monkeypatch):
    monkeypatch.setenv('UNCERTAINTY_ENGINE','builtin')
    p=example()
    p['data']['uncertainties']['mass']['source']='Reference '+('long independent source ' * 70)+'END-REFERENCE'
    p['run']['inputKey']=json.dumps(dict(rows=p['rows'],data=p['data']))
    pdf=build_gc_pdf(GCReport.model_validate(p))
    text='\n'.join(page.extract_text() for page in PdfReader(io.BytesIO(pdf)).pages)
    assert 'END-REFERENCE' in text
