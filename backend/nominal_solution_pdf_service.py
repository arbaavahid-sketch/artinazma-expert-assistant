"""Nominal molar preparation from a weighed reagent, not an uncertainty budget."""
import math
import re
from datetime import datetime, timezone
from typing import Literal
from pydantic import Field
from physical_pdf_service import StrictModel, Text, NumberText, ReportPDF, numeric
from solution_pdf_service import MaterialReference
from commercial_pdf_service import ProductSnapshot


class NominalMaterial(MaterialReference):
    molarMass: NumberText
    source: Text
    version: Text
    chemicalForm: Text
    waters: int | None = Field(default=None, strict=True, ge=0, le=10000)


class NominalInputs(StrictModel):
    concentration: NumberText
    volume: NumberText
    purity: NumberText
    puritySource: Text


class NominalSolutionReport(StrictModel):
    locale: Literal['fa', 'en']
    material: NominalMaterial
    inputs: NominalInputs
    reagent: ProductSnapshot | None = None
    expectedMass: float = Field(gt=0, allow_inf_nan=False)


def recompute_nominal(payload):
    d, material = payload.inputs, payload.material
    c, volume, p, molar = map(numeric, [d.concentration, d.volume, d.purity, material.molarMass])
    if not all(n > 0 for n in [c, volume, p, molar]) or p > 100 or not d.puritySource.strip():
        raise ValueError('Positive inputs and mass-purity reference required')
    if not all(s.strip() for s in [material.name, material.formula, material.source, material.version]):
        raise ValueError('Material identity and provenance required')
    if payload.reagent:
        r = payload.reagent
        raw = re.sub(r'[%٪]\s*$', '', r.purity.strip()).strip()
        reference = ' · '.join(v for v in [r.name, r.manufacturer, r.catalogue, r.lot, r.certificate] if v)[:2000]
        if (r.purityBasis.strip().lower() not in ['جرمی', 'جرمی درصد', 'w/w', '% w/w', 'mass', 'mass fraction']
                or not re.fullmatch(r'[۰-۹٠-٩0-9.٫]+', raw) or numeric(raw) != p
                or not r.lot.strip() or not r.certificate.strip() or d.puritySource != reference):
            raise ValueError('Reagent snapshot does not match purity evidence')
    mass = c * (volume / 1000) * molar * 100 / p
    if not math.isfinite(mass) or mass <= 0:
        raise ValueError('Nominal solution exceeds numeric range')
    if not math.isclose(mass, payload.expectedMass, rel_tol=1e-10, abs_tol=1e-100):
        raise ValueError('Mass does not match current inputs')
    return mass


def build_nominal_solution_pdf(payload):
    mass = recompute_nominal(payload)
    d, material = payload.inputs, payload.material
    en = payload.locale == 'en'
    t = lambda fa, english: english if en else fa
    pdf = ReportPDF(en)
    pdf.add_page()
    pdf.line(t('گزارش اسمی جرم لازم برای محلول مولار', 'Nominal mass for molar-solution preparation'), True, 17)
    pdf.line('ARTIN LAB | nominal molar preparation v1', size=9, ltr=True)
    pdf.line(datetime.now(timezone.utc).isoformat(), size=9, ltr=True)
    pdf.line(material.name, True, 14)
    pdf.line(f'{material.formula} | CID {material.cid}', ltr=True)
    pdf.line(t('جرم لازم برای توزین', 'Required reagent mass'), True)
    pdf.line(f'{mass:.8g} g', True, 21, True)
    pdf.line('m (g) = c (mol/L) * [V (mL) / 1000] * M (g/mol) * 100 / P (%)', ltr=True, size=9)
    pdf.line(t('مقادیر هدف و خلوص جرمی', 'Target values and mass purity'), True, 13)
    for fa, english, value, unit in [
        ('غلظت مقصد', 'Target concentration', d.concentration, 'mol/L'),
        ('حجم نهایی محلول', 'Final solution volume', d.volume, 'mL'),
        ('خلوص جرمی ماده', 'Reagent mass purity', d.purity, '% w/w'),
        ('جرم مولی شکل انتخاب‌شده', 'Molar mass of selected form', material.molarMass, 'g/mol')]:
        pdf.line(t(fa, english), True, 9)
        pdf.line(f'{value} {unit}', ltr=True)
    pdf.line(t('مرجع خلوص همین محصول', 'Purity reference for this product'), True, 9)
    pdf.line(d.puritySource)
    pdf.line(t('این عدد جرم هدف برای تهیه است؛ جرم واقعاً توزین‌شده یا غلظت تأییدشده نیست. عدم‌قطعیت ارزیابی نشده است. حجم، حجم نهایی محلول است و حجم حلال افزوده‌شده را تعیین نمی‌کند. رقم‌های نمایش‌داده‌شده دقت ترازو یا روش را تضمین نمی‌کنند.', 'This is a target preparation mass, not the actual weighed mass or a verified concentration. Uncertainty was not evaluated. Volume denotes the final solution volume, not added solvent. Displayed digits do not establish balance or method accuracy.'))
    pdf.add_page()
    pdf.line(t('شکل ماده و منابع ثبت‌شده', 'Chemical form and recorded sources'), True, 16)
    pdf.line(t('شکل شیمیایی ثبت‌شده', 'Recorded chemical form'), True, 9)
    pdf.line(material.chemicalForm or t('ثبت نشده؛ هویت و شکل محصول را بررسی کنید.', 'Not recorded; check product identity and form.'))
    pdf.line(t('تعداد آب تبلور در رکورد مرجع', 'Waters of crystallization in the reference record'), True, 9)
    pdf.line(str(material.waters) if material.waters is not None else t('ثبت نشده', 'Not recorded'), ltr=material.waters is not None)
    pdf.line(t('جرم مولی مربوط به همین ترکیب و شکل انتخاب‌شده است. آب تبلور دوباره به جرم مولی افزوده نمی‌شود. هویت و شکل محصول مصرفی را با رکورد ماده تطبیق دهید؛ مدل شامل تبدیل نمک به عنصر، واکنش یا تهیه از محلول تجاری نیست.', 'Molar mass belongs to the selected compound and form. Crystal water is not added to molar mass again. Match the actual product identity and form to the material record. Salt-to-element conversion, reactions and preparation from commercial solutions are outside this model.'))
    pdf.line(t('منبع جرم مولی محاسباتی ماده', 'Source of computed compound molar mass'), True, 9)
    pdf.line(material.source)
    pdf.line(material.version, size=9, ltr=True)
    pdf.line(f'https://pubchem.ncbi.nlm.nih.gov/compound/{material.cid}', ltr=True, size=9)
    pdf.line(t('تاریخ نسخهٔ ماده', 'Material snapshot date'), True, 9)
    pdf.line(material.retrievedOn, ltr=True, size=9)
    if payload.reagent:
        pdf.line(t('نسخهٔ ثبت‌شدهٔ بطری', 'Recorded reagent snapshot'), True, 13)
        r = payload.reagent
        for fa, english, value in [
            ('نام', 'Name', r.name), ('سازنده', 'Manufacturer', r.manufacturer),
            ('کاتالوگ', 'Catalogue', r.catalogue), ('بچ', 'Lot', r.lot),
            ('مرجع گواهی', 'Certificate reference', r.certificate),
            ('خلوص و مبنا', 'Purity and basis', r.purity + ' | ' + r.purityBasis)]:
            if value:
                pdf.line(t(fa, english) + ': ' + value, size=9)
    pdf.line(t('اطلاعات و منابع توسط واردکننده ثبت شده‌اند؛ این گزارش گواهی محصول را مستقلاً تأیید نمی‌کند. ترتیب اختلاط، سازگاری حلال، کنترل دما، نگهداری و ایمنی از SOP و SDS همان ماده تعیین شوند.', 'Data and sources were recorded by the data provider; this report does not independently verify product certificates. Determine mixing order, solvent compatibility, temperature control, storage and safety from the material SOP and SDS.'))
    return bytes(pdf.output())
