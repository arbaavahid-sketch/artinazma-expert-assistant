"""Structured nominal dilution instructions and labels; never renders supplied HTML."""
import math
from typing import Literal, Annotated
from pydantic import Field
from physical_pdf_service import StrictModel, Text, NumberText, ReportPDF, numeric
Unit=Literal['mol/L','mmol/L','µmol/L','g/L','mg/L','µg/L']
class Label(StrictModel):
    solutionId:NumberText
    preparedBy:NumberText
    preparedOn:NumberText
    expires:NumberText
    storage:NumberText
    notes:Annotated[str,Field(strict=True,max_length=300)]
class Step(StrictModel):
    target:NumberText
    unit:Unit
    volume:NumberText
    volumeUnit:Literal['mL','L']
class Plan(StrictModel):
    stock:NumberText
    unit:Unit
    source:Text
    steps:list[Step]=Field(min_length=1,max_length=12)
    label:Label
class Material(StrictModel):
    name:NumberText
    formula:NumberText
    cid:int=Field(strict=True,gt=0,le=9999999999)
class DilutionReport(StrictModel):
    locale:Literal['fa','en']
    plan:Plan
    material:Material
    expectedAliquots:list[float]=Field(min_length=1,max_length=12)

def recompute_dilution(payload):
    p=payload.plan
    scales={'mol/L':1,'mmol/L':.001,'µmol/L':.000001,'g/L':1,'mg/L':.001,'µg/L':.000001}
    if not p.source.strip() or not p.label.solutionId.strip():raise ValueError('Source and solution ID required')
    c=numeric(p.stock)*scales[p.unit]
    if c<=0 or not math.isfinite(c):raise ValueError('Invalid stock')
    rows=[];previous=None
    for s in p.steps:
        target=numeric(s.target)*scales[s.unit];v=numeric(s.volume)*(1000 if s.volumeUnit=='L' else 1)
        if ('mol' in p.unit)!=('mol' in s.unit) or not math.isfinite(v) or not math.isfinite(target) or target<=0 or target>=c or v<=0:raise ValueError('Invalid dilution step')
        aliquot=target/c*v;factor=c/target
        if not math.isfinite(aliquot) or aliquot<=0 or not math.isfinite(factor) or previous is not None and aliquot>previous*(1+1e-12):raise ValueError('Unavailable aliquot or numeric range')
        rows.append(dict(aliquot=aliquot,volume=v,factor=factor));previous=v;c=target
    if len(rows)!=len(payload.expectedAliquots) or any(not math.isfinite(a) or not math.isclose(a,r['aliquot'],rel_tol=1e-10,abs_tol=1e-12) for a,r in zip(payload.expectedAliquots,rows)):raise ValueError('Aliquot result mismatch')
    return rows

def build_dilution_pdf(payload):
    rows=recompute_dilution(payload);p=payload.plan;l=p.label;en=payload.locale=='en';t=lambda fa,english:english if en else fa
    pdf=ReportPDF(en);pdf.add_page(orientation='L')
    pdf.line(t('دستور رقیق‌سازی و برچسب‌های اسمی','Dilution instructions and nominal labels'),True,17)
    pdf.line('ARTIN LAB | dilution v1 | C1 * V1 = C2 * V2',size=9,ltr=True)
    pdf.line(payload.material.name,True);pdf.line(f'{payload.material.formula} | CID {payload.material.cid}',ltr=True)
    pdf.line(t('محلول مادر','Stock'),True);pdf.line(f'{p.stock} {p.unit}',ltr=True)
    pdf.line(p.source)
    table=[]
    for i,(s,r) in enumerate(zip(p.steps,rows)):
        table.append([str(i+1),t('محلول مادر','Stock') if i==0 else f'{l.solutionId}-D{i}',f'{r["aliquot"]:.7g}',f'{r["volume"]:.7g}',f'{s.target} {s.unit}',f'{r["factor"]:.7g}'])
    pdf.data_table([t('مرحله','Stage'),t('برداشت از','Take from'),t('برداشت mL','Aliquot mL'),t('حجم نهایی mL','Final volume mL'),t('غلظت مقصد','Target concentration'),'DF'],table,[15,45,35,35,40,25],numeric_columns=(0,2,3,4,5))
    pdf.line(t('دستور اسمی برای همان گونه و بدون واکنش است؛ حجم نهایی برابر حجم حلال افزوده‌شده نیست. حلال، ترتیب اختلاط، دما و وسیله حجمی را مطابق SOP و SDS محصول انتخاب کنید. عدم‌قطعیت این زنجیره محاسبه نشده است.','Nominal plan for the same species without reaction; final volume is not added-solvent volume. Select solvent, mixing order, temperature and volumetric equipment according to the product SOP and SDS. Dilution-chain uncertainty has not been calculated.'))
    pdf.line(t('برچسب‌ها غلظت اسمی دارند و جایگزین برچسب ایمنی کامل نیستند. قالب A4 آزاد است، نه قالب کاغذ برچسب تجاری.','Labels show nominal concentration and do not replace complete safety labels. This is a flexible A4 layout, not a commercial adhesive-label template.'))
    pdf.add_page()
    pdf.line(t('برچسب‌های محلول','Solution labels'),True,16)
    for i,(s,r) in enumerate(zip(p.steps,rows)):
        with pdf.unbreakable() as card:
            card.line(f'ARTIN LAB | {l.solutionId}-D{i+1}',True,12,True)
            card.line(payload.material.name,True,14)
            card.line(payload.material.formula,ltr=True,size=9)
            card.line(f'{s.target} {s.unit}',True,17,True)
            card.line(f'{r["volume"]:.7g} mL',ltr=True)
            metadata=[(t('تهیه‌کننده','Prepared by'),l.preparedBy),(t('تاریخ تهیه و تقویم','Preparation date and calendar'),l.preparedOn),(t('انقضا و تقویم','Expiry and calendar'),l.expires),(t('نگهداری','Storage'),l.storage)]
            card.data_table([t('فیلد','Field'),t('مقدار','Value')],[[k,v or t('ثبت نشده','Not recorded')] for k,v in metadata],[45,110])
            if l.notes:card.line(l.notes,size=9)
            card.line(t('غلظت اسمی - ایمنی طبق SDS و SOP','Nominal concentration - safety per SDS and SOP'),size=8)
            card.ln(5)
    return bytes(pdf.output())
