"""Actual solution preparation PDF, rebuilt from structured inputs only."""
import math
from datetime import datetime, timezone
from typing import Literal
from pydantic import Field
from physical_pdf_service import StrictModel, Text, ReportPDF, numeric
from gc_pdf_service import StockPreparation, stock_result, standard

class MaterialReference(StrictModel):
    name: Text
    formula: Text
    cid: int = Field(strict=True, gt=0, le=9999999999)
    retrievedOn: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')

class ExpectedSolution(StrictModel):
    concentration: float = Field(gt=0, allow_inf_nan=False)
    relativePercent: float = Field(ge=0, allow_inf_nan=False)

class SolutionReport(StrictModel):
    locale: Literal['fa', 'en']
    material: MaterialReference
    preparation: StockPreparation
    expected: ExpectedSolution
    nominalReagentReference: Text = ''

def recompute_solution(payload):
    c, ur, keys = stock_result(payload.preparation)
    if not math.isclose(c, payload.expected.concentration, rel_tol=1e-10, abs_tol=1e-12) or not math.isclose(ur, payload.expected.relativePercent, rel_tol=1e-10, abs_tol=1e-12):
        raise ValueError('Solution result does not match current inputs')
    return c, ur, keys

def build_solution_pdf(payload):
    c, ur, keys = recompute_solution(payload)
    en=payload.locale=='en'
    t=lambda fa, english: english if en else fa
    pdf=ReportPDF(en)
    pdf.add_page()
    pdf.line(t('گزارش محلول تهیه‌شده و عدم‌قطعیت استاندارد','Prepared solution and standard uncertainty report'),True,17)
    pdf.line('ARTIN LAB | solution preparation v1 | local first-order propagation',size=9,ltr=True)
    pdf.line(datetime.now(timezone.utc).isoformat(),size=9,ltr=True)
    pdf.line(t('مادهٔ مرجع ثبت‌شده توسط واردکننده','Reference compound recorded by the data provider'),True)
    pdf.line(payload.material.name)
    pdf.line(f'{payload.material.formula} | CID {payload.material.cid}',ltr=True)
    pdf.line(f'https://pubchem.ncbi.nlm.nih.gov/compound/{payload.material.cid}',ltr=True,size=9)
    pdf.line(t('تاریخ نسخهٔ ثبت‌شدهٔ ماده','Material snapshot date'),size=9)
    pdf.line(payload.material.retrievedOn,size=9,ltr=True)
    pdf.line(t('این گزارش داده‌های تهیهٔ واقعی را ارزیابی می‌کند؛ جرم هدف و غلظت مولار برنامهٔ اسمی موضوع این گزارش نیستند.','This report evaluates actual preparation data; target mass and planned molar concentration are outside this report.'))
    pdf.line(f'C = {c:.8g} mg/L',True,17,True)
    pdf.line(f'u(C) = {c*ur/100:.7g} mg/L | relative standard uncertainty = {ur:.7g} %',ltr=True)
    pdf.line('C (mg/L) = 10 * m (mg) * P (%) / V (mL)'+(' * Va / Vf' if payload.preparation.dilution else ''),ltr=True,size=9)
    pdf.line('u_r = sqrt(sum((u(x)/x)^2))',ltr=True,size=9)
    if payload.nominalReagentReference:
        pdf.line(t('بطری برنامهٔ اسمی؛ مستقل از منابع بودجهٔ واقعی','Nominal-plan reagent; separate from actual budget sources'),True)
        pdf.line(payload.nominalReagentReference)
    pdf.line(t('ورودی‌ها مستقل و بدون دوباره‌شماری توسط واردکننده ارزیابی شده‌اند. عدم‌قطعیت‌های ورودی باید اثرهای مربوطِ کالیبراسیون، دما و تکرارپذیری را پوشش دهند. خروجی عدم‌قطعیت استاندارد است؛ U، ضریب پوشش و احتمال پوشش محاسبه نشده‌اند.','Inputs were assessed as independent and not double counted by the data provider. Input uncertainties must include relevant calibration, temperature and repeatability effects. Output is standard uncertainty; expanded uncertainty, coverage factor and coverage probability are not calculated.'))
    pdf.line(t('مدل شامل هم‌بستگی، واکنش، تبدیل نمک به عنصر یا عدم‌قطعیت mol/L نیست؛ این گزارش تأیید گواهی یا صحه‌گذاری روش نیست.','The model excludes correlations, reactions, salt-to-element conversion and mol/L uncertainty; this report does not verify certificates or validate methods.'))
    pdf.line('JCGM 100:2008, section 5.1 | https://doi.org/10.59161/JCGM100-2008E',ltr=True,size=8)
    pdf.add_page(orientation='L')
    pdf.line(t('داده‌های خام و بودجهٔ عدم‌قطعیت','Raw data and uncertainty budget'),True,15)
    names={'mass':t('جرم (mg)','Mass (mg)'), 'purity':t('خلوص جرمی (%)','Mass purity (%)'), 'volume':t('حجم مادر (mL)','Stock volume (mL)'), 'aliquot':t('برداشت (mL)','Aliquot (mL)'), 'finalVolume':t('حجم رقیق‌شده (mL)','Diluted volume (mL)')}
    kinds={'standard':'u','certificate':'U/k','rectangular':'a/sqrt(3)','triangular':'a/sqrt(6)','resolution':'d/sqrt(12)','repeatability':'s/sqrt(n)'}
    rows=[]
    sources=[]
    for i,key in enumerate(keys,1):
        q=getattr(payload.preparation.inputs,key)
        u=standard(q.uncertainty)
        rows.append([names[key],q.nominal,kinds[q.uncertainty.kind],q.uncertainty.value,q.uncertainty.divisor or '-',f'{u:.7g}',f'{c*u/numeric(q.nominal):.7g}',str(i)])
        sources.append(q.uncertainty.source)
    pdf.data_table([t('کمیت','Input'),t('مقدار','Value'),t('تبدیل','Conversion'),t('عدم‌قطعیت خام','Raw uncertainty'),'k / n','u(x)',t('اندازه اثر mg/L','Effect mg/L'),t('منبع','Source')],rows,[34,26,26,30,16,28,32,15],numeric_columns=(1,3,4,5,6,7))
    for i,source in enumerate(sources,1):
        pdf.line(t('منبع ','Source ')+str(i),True)
        pdf.line(source)
    return bytes(pdf.output())
