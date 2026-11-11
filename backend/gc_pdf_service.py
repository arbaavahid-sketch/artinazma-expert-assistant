"""GC-FID PDF: rebuild the OLS fit and uncertainty budget from raw inputs."""
import json
import math
from datetime import datetime
from typing import Literal
from pydantic import Field
from fpdf import FPDF
from physical_pdf_service import StrictModel, Text, NumberText, Identity, RawUncertainty, Quantity, ReportPDF, numeric, component
from uncertainty_service import BudgetRequest, BudgetComponent, calculate_budget
from measurement_models import model_at_nominal

SAMPLE_KEYS = ['area', 'extract', 'dilution', 'mass', 'recovery']
MODEL_KEYS = ['area', 'slope', 'intercept', 'extract', 'dilution', 'mass', 'recovery']
UNITS = ['area', 'area/(mg/L)', 'area', 'mL', '1', 'g', 'percentage points']


class SampleValues(StrictModel):
    area: NumberText
    extract: NumberText
    dilution: NumberText
    mass: NumberText
    recovery: NumberText


class SampleUncertainties(StrictModel):
    area: RawUncertainty
    extract: RawUncertainty
    dilution: RawUncertainty
    mass: RawUncertainty
    recovery: RawUncertainty


class StockInputs(StrictModel):
    mass: Quantity
    purity: Quantity
    volume: Quantity
    aliquot: Quantity
    finalVolume: Quantity


class StockPreparation(StrictModel):
    dilution: bool = Field(strict=True)
    independent: bool = Field(strict=True)
    inputs: StockInputs


class Additional(RawUncertainty):
    id: str = Field(min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    preset: Literal['standardScale', 'methodPrecision', 'custom']
    name: str = Field(max_length=200)
    target: Literal['result', 'area', 'extract', 'dilution', 'mass', 'recovery']
    basis: Literal['absolute', 'relative']
    overlapNote: Text
    independent: bool = Field(strict=True)
    preparation: StockPreparation | None = None


class GCData(StrictModel):
    values: SampleValues
    uncertainties: SampleUncertainties
    coverage: NumberText
    coverageSource: Text
    additional: list[Additional] = Field(default_factory=list, max_length=20)


class GCExecution(StrictModel):
    inputKey: str = Field(max_length=600000)
    calculatedAt: str = Field(max_length=50)
    measured: float = Field(allow_inf_nan=False)
    standard: float = Field(ge=0, allow_inf_nan=False)
    expanded: float = Field(ge=0, allow_inf_nan=False)
    coverage: float = Field(gt=0, allow_inf_nan=False)
    engine: str = Field(min_length=1, max_length=100)
    engineVersion: str = Field(min_length=1, max_length=100)


class GCReport(StrictModel):
    locale: Literal['fa', 'en']
    identity: Identity
    rows: list[list[NumberText]] = Field(min_length=3, max_length=20)
    data: GCData
    run: GCExecution


def standard(raw):
    item = BudgetComponent(**component('raw', raw))
    divisor = {'standard': 1, 'rectangular': math.sqrt(3), 'triangular': math.sqrt(6),
               'resolution': math.sqrt(12), 'certificate': item.certificate_k,
               'repeatability': math.sqrt(item.repetitions)}[item.kind]
    return item.value / divisor


def stock_result(prep):
    if not prep.independent:
        raise ValueError('Stock independence must be assessed')
    keys = ['mass', 'purity', 'volume'] + (['aliquot', 'finalVolume'] if prep.dilution else [])
    values, relative = {}, []
    for key in keys:
        q = getattr(prep.inputs, key)
        value = numeric(q.nominal)
        if value <= 0 or (key == 'purity' and value > 100):
            raise ValueError('Invalid stock nominal')
        values[key] = value
        relative.append(standard(q.uncertainty) / value)
    if prep.dilution and values['aliquot'] > values['finalVolume']:
        raise ValueError('Invalid common dilution')
    concentration = 10 * values['mass'] * values['purity'] / values['volume']
    if prep.dilution:
        concentration *= values['aliquot'] / values['finalVolume']
    relative_percent = 100 * math.hypot(*relative)
    if not math.isfinite(concentration) or concentration <= 0 or not math.isfinite(relative_percent):
        raise ValueError('Stock preparation exceeds the supported numeric range')
    return concentration, relative_percent, keys


def recompute_gc(payload):
    d, run = payload.data, payload.run
    when = datetime.fromisoformat(run.calculatedAt.replace('Z', '+00:00'))
    if when.tzinfo is None or json.loads(run.inputKey) != {'rows': payload.rows, 'data': d.model_dump(exclude_unset=True)}:
        raise ValueError('Stale GC run')
    points = []
    for row in payload.rows:
        if len(row) != 2:
            raise ValueError('Two calibration columns required')
        if any(value.strip() for value in row):
            x, y = map(numeric, row)
            if x < 0:
                raise ValueError('Negative standard concentration')
            points.append((x, y))
    n = len(points)
    if n < 3:
        raise ValueError('At least three complete standards required')
    mx, my = sum(x/n for x, _ in points), sum(y/n for _, y in points)
    xx = sum((x-mx)**2 for x, _ in points)
    if xx <= 0:
        raise ValueError('Distinct concentrations required')
    slope = sum((x-mx)*(y-my) for x, y in points)/xx
    intercept = my-slope*mx
    if slope <= 0:
        raise ValueError('Positive slope required')
    residual = sum((y-slope*x-intercept)**2 for x, y in points)
    se = math.sqrt(residual/(n-2))
    us, ub = se/math.sqrt(xx), se*math.sqrt(1/n+mx*mx/xx)
    correlation = -mx/math.sqrt(xx/n+mx*mx)
    v = {key: numeric(getattr(d.values, key)) for key in SAMPLE_KEYS}
    if v['area'] < 0 or v['extract'] <= 0 or v['mass'] <= 0 or v['recovery'] <= 0 or v['dilution'] < 1:
        raise ValueError('Invalid sample inputs')
    extract_concentration = (v['area']-intercept)/slope
    if extract_concentration < 0 or not min(x for x, _ in points) <= extract_concentration <= max(x for x, _ in points):
        raise ValueError('Sample outside calibration range')
    nominals = [v['area'], slope, intercept, v['extract'], v['dilution'], v['mass'], v['recovery']]
    measured, _ = model_at_nominal('gcExtraction', nominals)
    components = []
    for key in MODEL_KEYS:
        if key in ['slope', 'intercept']:
            components.append(dict(name=key, value=us if key == 'slope' else ub, sensitivity=1))
        else:
            components.append(component(key, getattr(d.uncertainties, key)))
    if len({item.id for item in d.additional}) != len(d.additional) or not d.coverageSource.strip():
        raise ValueError('Invalid budget metadata')
    targets = []
    for item in d.additional:
        if not item.independent or not item.overlapNote.strip() or (item.preset == 'custom' and not item.name.strip()):
            raise ValueError('Additional effect needs a source and overlap review')
        if item.preset != 'custom' and item.target != 'result' or item.preset == 'standardScale' and item.basis != 'relative':
            raise ValueError('Invalid additional target or basis')
        nominal = measured if item.target == 'result' else v[item.target]
        if item.basis == 'relative' and nominal == 0:
            raise ValueError('Relative effect at zero nominal')
        if item.preparation:
            if item.preset != 'standardScale':
                raise ValueError('Preparation requires a shared standard effect')
            _, relative, active = stock_result(item.preparation)
            raw = RawUncertainty(value=str(relative),kind='standard',divisor='',
                  source='; '.join(getattr(item.preparation.inputs, key).uncertainty.source for key in active)[:2000])
        else:
            raw = item
        c = component(item.name if item.preset == 'custom' else item.preset, raw)
        c['value'] *= abs(nominal)/100 if item.basis == 'relative' else 1
        components.append(c)
        targets.append(-1 if item.target == 'result' else MODEL_KEYS.index(item.target))
    result = calculate_budget(BudgetRequest(measured=measured,coverage=numeric(d.coverage),
        components=components,measurement_model=dict(kind='gcExtraction',nominals=nominals,additional_targets=targets),
        correlations=[dict(first=1,second=2,coefficient=correlation)]))
    for saved, current in [('measured','measured'),('standard','standard_uncertainty'),('expanded','expanded_uncertainty'),('coverage','coverage')]:
        if not math.isclose(getattr(run,saved),result[current],rel_tol=1e-9,abs_tol=1e-100):
            raise ValueError('GC result does not match recomputation')
    if run.engine != result['engine'] or run.engineVersion != result['engine_version']:
        raise ValueError('Engine changed; recalculate')
    return result, dict(points=points,slope=slope,intercept=intercept,se=se,us=us,ub=ub,correlation=correlation)


def calibration_chart(pdf, fit):
    x0, y0, width, height = 28, pdf.get_y()+8, 150, 65
    points = fit['points']
    xmin, xmax = min(x for x, _ in points), max(x for x, _ in points)
    ys = [y for _, y in points] + [fit['slope']*x+fit['intercept'] for x in [xmin,xmax]]
    ymin, ymax = min(ys), max(ys)
    pad = max((ymax-ymin)*.08, 1)
    ymin, ymax = ymin-pad, ymax+pad
    def xy(x, y):
        return (x0+(x-xmin)/(xmax-xmin)*width, y0+height-(y-ymin)/(ymax-ymin)*height)
    pdf.set_draw_color(100,110,125)
    FPDF.line(pdf,x0,y0,x0,y0+height)
    FPDF.line(pdf,x0,y0+height,x0+width,y0+height)
    pdf.set_draw_color(35,95,180)
    FPDF.line(pdf,*xy(xmin,fit['slope']*xmin+fit['intercept']),*xy(xmax,fit['slope']*xmax+fit['intercept']))
    pdf.set_fill_color(35,95,180)
    for x,y in points:
        px,py=xy(x,y)
        pdf.ellipse(px-1,py-1,2,2,style='F')
    pdf.set_y(y0+height+4)
    pdf.line(f'x: {xmin:g} .. {xmax:g} mg/L | y: {ymin:.5g} .. {ymax:.5g} area',size=9,ltr=True)


def build_gc_pdf(payload):
    result, fit = recompute_gc(payload)
    en = payload.locale == 'en'
    def t(fa, english):
        return english if en else fa
    pdf = ReportPDF(en)
    pdf.add_page()
    pdf.line(t('گزارش آزمون GC-FID','GC-FID test report'),True,18)
    pdf.line('ARTIN LAB | GC extraction model v1',ltr=True)
    for key,fa,english in [('title','عنوان','Title'),('sample','نمونه','Sample'),('sop','روش اجرایی','SOP'),('edition','ویرایش روش','Method edition'),('matrix','ماتریس','Matrix')]:
        pdf.line(t(fa,english),True,9)
        pdf.line(getattr(payload.identity,key) or '-')
    pdf.line(f'{payload.run.calculatedAt} | {payload.run.engine} | v{payload.run.engineVersion}',size=9,ltr=True)
    pdf.line(f'{result["measured"]:.7g} +/- {result["expanded_uncertainty"]:.4g} mg/kg',True,17,True)
    pdf.line(f'u = {result["standard_uncertainty"]:.7g} mg/kg; k = {result["coverage"]:g}',ltr=True)
    pdf.line(t('مبنای انتخاب ضریب پوشش','Coverage basis'),True)
    pdf.line(payload.data.coverageSource)
    pdf.line('C = (A-b)/a * V*D / (m*R/100)',ltr=True)
    pdf.line(t('مدل: کالیبراسیون خارجی، استخراج و تصحیح بازیابی. حجم نهایی محلول در mL، جرم نمونه در g، بازیابی در واحد درصد و نتیجه در mg/kg است. این مدل برای تحلیل مستقیم بدون استخراج نیست.','Model: external calibration, extraction and recovery correction. Final solution volume in mL, sample mass in g, recovery in percentage points, result in mg/kg. This is not a direct-analysis model without extraction.'))
    pdf.add_page()
    pdf.line(t('کالیبراسیون و برازش','Calibration and fit'),True,15)
    pdf.line(f'a = {fit["slope"]:.8g}; b = {fit["intercept"]:.8g}; residual s = {fit["se"]:.8g}',ltr=True)
    pdf.line(f'u(a) = {fit["us"]:.8g}; u(b) = {fit["ub"]:.8g}; corr(a,b) = {fit["correlation"]:.8g}',ltr=True,size=9)
    calibration_chart(pdf,fit)
    pdf.line(t('غلظت استاندارد (mg/L) | مساحت پیک','Standard concentration (mg/L) | peak area'),True)
    pdf.data_table([t('غلظت استاندارد (mg/L)','Standard concentration (mg/L)'),t('مساحت پیک','Peak area')], [row for row in payload.rows if any(v.strip() for v in row)], [1,1], (0,1))
    pdf.line(t('OLS ساده؛ عدم‌قطعیت مستقل غلظت هر نقطه در برازش لحاظ نمی‌شود. اثر مشترک استاندارد فقط در صورت ورود به بودجه لحاظ می‌شود.','Simple OLS; independent concentration errors of calibration points are not included in the fit. A common standard effect is included only if entered in the budget.'))
    covariance=2*result['components'][1]['contribution']*result['components'][2]['contribution']*fit['correlation']
    pdf.line(t('ترم کوواریانس شیب و عرض از مبدأ؛ واحد مربع نتیجه','Slope-intercept covariance term; squared result units'),True)
    pdf.line(f'2*c(a)*c(b)*u(a)*u(b)*r = {covariance:.8g} (mg/kg)^2',ltr=True)
    labels={'area':t('مساحت پیک','Peak area'),'extract':t('حجم نهایی محلول','Final solution volume'),'dilution':t('ضریب رقیق‌سازی','Dilution factor'),'mass':t('جرم نمونه','Sample mass'),'recovery':t('بازیابی','Recovery'),'slope':t('شیب','Slope'),'intercept':t('عرض از مبدأ','Intercept')}
    kinds={'standard':t('عدم‌قطعیت استاندارد','Standard uncertainty'),'certificate':t('گواهی U و k','Certificate U and k'),'rectangular':t('حد مستطیلی','Rectangular bound'),'triangular':t('حد مثلثی','Triangular bound'),'resolution':t('گام تفکیک','Resolution step'),'repeatability':t('انحراف معیار','Standard deviation')}
    long_sources=[]
    def source_cell(source):
        if len(source)<=180:
            return source
        if source not in long_sources:
            long_sources.append(source)
        ref=long_sources.index(source)+1
        return source[:130]+' ... '+t('متن کامل منبع ','Full source ')+str(ref)
    pdf.add_page(orientation='L')
    pdf.line(t('داده‌های خام نمونه','Raw sample data'),True,15)
    raw_rows=[]
    for key in SAMPLE_KEYS:
        raw=getattr(payload.data.uncertainties,key)
        raw_rows.append([labels[key],getattr(payload.data.values,key),UNITS[MODEL_KEYS.index(key)],kinds[raw.kind],raw.value,raw.divisor or '-',source_cell(raw.source)])
    pdf.data_table([t('کمیت','Quantity'),t('مقدار','Nominal'),t('واحد','Unit'),t('نوع داده','Input type'),t('عدد خام','Raw uncertainty'),'k / n',t('منبع','Source')],raw_rows,[40,20,25,35,25,17,70],(1,2,4,5))
    pdf.add_page(orientation='L')
    pdf.line(t('بودجه عدم‌قطعیت','Uncertainty budget'),True,15)
    budget_rows=[]
    for index,item in enumerate(result['components']):
        if index<7:
            key=MODEL_KEYS[index]
            name=labels[key]
            unit=UNITS[index]
            source=t('از برازش OLS همین داده‌ها','From this OLS fit') if key in ['slope','intercept'] else getattr(payload.data.uncertainties,key).source
        else:
            extra=payload.data.additional[index-7]
            name=extra.name if extra.preset=='custom' else {'standardScale':t('اثر مشترک استانداردها','Shared standard scale'),'methodPrecision':t('دقت روش','Method precision')}[extra.preset]
            unit='mg/kg' if extra.target=='result' else UNITS[MODEL_KEYS.index(extra.target)]
            source=extra.source or t('از تهیه استاندارد مشترک','From shared preparation')
        budget_rows.append([name,unit,f'{item["standard_uncertainty"]:.8g}',f'{item["sensitivity"]:.8g}',f'{abs(item["contribution"]):.8g}',source_cell(source)])
    pdf.data_table([t('مؤلفه','Component'),t('واحد u','Unit of u'),'u','c','|c*u| (mg/kg)',t('منبع','Source')],budget_rows,[45,28,28,28,32,71],(1,2,3,4))
    pdf.line(t('اندازه اثرها مثبت نمایش داده شده‌اند؛ علامت حساسیت c حفظ شده و ترم کوواریانس شیب و عرض از مبدأ جداگانه در بخش کالیبراسیون آمده است.','Effect magnitudes are positive; signed sensitivities are retained. The slope-intercept covariance term is separately recorded in Calibration.'),size=9)
    for index,extra in enumerate(payload.data.additional):
        pdf.add_page(orientation='L' if extra.preparation else 'P')
        pdf.line(t('اثر تکمیلی و منابع','Additional effect and evidence'),True,15)
        pdf.line(extra.name if extra.preset=='custom' else {'standardScale':t('اثر مشترک استانداردها','Shared standard scale'),'methodPrecision':t('دقت روش','Method precision')}[extra.preset],True)
        pdf.line(t('هدف','Target')+': '+(t('نتیجه (mg/kg)','Result (mg/kg)') if extra.target=='result' else labels[extra.target]))
        pdf.line(t('مبنای اثر','Effect basis')+': '+(t('نسبی (%)','Relative (%)') if extra.basis=='relative' else t('مطلق در واحد هدف','Absolute in target units')))
        if not extra.preparation:
            pdf.line(kinds[extra.kind])
            pdf.line(f'{extra.value} | k/n = {extra.divisor or "-"}',ltr=True)
        item=result['components'][7+index]
        pdf.line(f'u = {item["standard_uncertainty"]:.8g}; c = {item["sensitivity"]:.8g}; effect = {item["contribution"]:.8g} mg/kg',ltr=True,size=9)
        pdf.line(t('منبع ثبت‌شده','Recorded source'),True)
        pdf.line(extra.source or t('از داده‌های تهیه استاندارد','From preparation data'))
        pdf.line(t('بررسی هم‌پوشانی','Overlap assessment'),True)
        pdf.line(extra.overlapNote)
        if extra.preparation:
            concentration,relative,active=stock_result(extra.preparation)
            pdf.line(t('تهیه استاندارد مشترک','Shared standard preparation'),True,13)
            pdf.line(f'C = {concentration:.8g} mg/L; relative u = {relative:.8g} %',ltr=True)
            pdf.line('C = 10*m*P/V * (Va/Vf if diluted); relative u = 100*sqrt(sum((u/x)^2))',ltr=True,size=9)
            names={'mass':t('جرم (mg)','Mass (mg)'),'purity':t('خلوص (%)','Purity (%)'),'volume':t('حجم مادر (mL)','Stock volume (mL)'),'aliquot':t('حجم برداشتی (mL)','Aliquot (mL)'),'finalVolume':t('حجم نهایی (mL)','Final volume (mL)')}
            prep_rows=[]
            for key in active:
                q=getattr(extra.preparation.inputs,key)
                raw=q.uncertainty
                prep_rows.append([names[key],q.nominal,kinds[raw.kind],raw.value,raw.divisor or '-',f'{standard(raw):.8g}',source_cell(raw.source)])
            pdf.data_table([t('کمیت و واحد','Quantity and unit'),t('مقدار خام','Raw nominal'),t('نوع داده','Input type'),t('عدم‌قطعیت خام','Raw uncertainty'),'k / n','u',t('منبع','Source')],prep_rows,[44,22,35,25,17,25,64],(1,3,4,5))
            pdf.line(t('این مدل فقط تهیه مشترک مستقل است؛ واکنش، تبدیل نمک به عنصر و رقیق‌سازی مستقل نقاط را پوشش نمی‌دهد.','Only common independent preparation is modeled; reactions, salt-to-element conversion and independent point dilutions are excluded.'))
    if long_sources:
        pdf.add_page(orientation='P')
        pdf.line(t('متن کامل منابع بلند','Full source references'),True,15)
        for i,source in enumerate(long_sources,1):
            pdf.line(t('منبع ','Source ')+str(i),True)
            pdf.line(source)
    with pdf.unbreakable() as section:
        section.line(t('فرض‌ها و محدودیت‌ها','Assumptions and limitations'),True,13)
        section.line(t('انتشار مرتبه اول با هم‌بستگی شیب و عرض از مبدأ است. اثرهای تکمیلی مستقل و بدون دوباره‌شماری توسط واردکننده داده ارزیابی شده‌اند. k=2 تضمین پوشش دقیق ۹۵٪ نیست. این گزارش تأیید انطباق یا صحه‌گذاری کامل روش نیست.','First-order propagation includes slope-intercept correlation. Additional effects were assessed as independent and not double counted by the data provider. k=2 does not guarantee exact 95% coverage. This report is not a conformity decision or complete method validation.'))
        section.line('JCGM 100:2008, section 5 | Eurachem QUAM 2012, section 6 and Appendix D',size=8,ltr=True)
    return bytes(pdf.output())
