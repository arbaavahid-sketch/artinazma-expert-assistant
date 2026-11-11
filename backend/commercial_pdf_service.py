"""Nominal commercial-solution reports from bounded structured inputs."""
import math
import re
from datetime import datetime, timezone
from typing import Literal
from pydantic import Field
from physical_pdf_service import StrictModel, Text, NumberText, ReportPDF, numeric
from solution_pdf_service import MaterialReference


class ProductSnapshot(StrictModel):
    name: Text
    manufacturer: Text
    catalogue: Text
    lot: Text
    certificate: Text
    purity: Text
    purityBasis: Text


class CommercialData(StrictModel):
    massPercent: NumberText
    percentSource: Text
    density: NumberText
    densityConditions: Text
    densitySource: Text
    productReference: Text
    target: NumberText
    volume: NumberText
    volumeUnit: Literal['mL', 'L']
    sameSpecies: bool = Field(strict=True)
    reagent: ProductSnapshot | None = None


class CommercialReport(StrictModel):
    locale: Literal['fa', 'en']
    material: MaterialReference
    molarMass: NumberText
    commercial: CommercialData
    expectedAliquot: float = Field(gt=0, allow_inf_nan=False)


def recompute_commercial(payload):
    d = payload.commercial
    p, rho, mass, target, volume = map(numeric, [d.massPercent, d.density, payload.molarMass, d.target, d.volume])
    volume *= 1000 if d.volumeUnit == 'L' else 1
    if not d.sameSpecies or not all(math.isfinite(n) and n > 0 for n in [p, rho, mass, target, volume]) or p > 100:
        raise ValueError('Positive inputs and species confirmation required')
    if not all(getattr(d, k).strip() for k in ['percentSource', 'densityConditions', 'densitySource', 'productReference']):
        raise ValueError('Sources and density conditions required')
    if d.reagent:
        r = d.reagent
        raw = re.sub(r'[%٪]\s*$', '', r.purity.strip()).strip()
        reference = ' · '.join(v for v in [r.name, r.manufacturer, r.catalogue, r.lot, r.certificate] if v)[:2000]
        if (r.purityBasis.strip().lower() not in ['جرمی', 'جرمی درصد', 'w/w', '% w/w', 'mass', 'mass fraction']
                or not re.fullmatch(r'[۰-۹٠-٩0-9.٫]+', raw) or numeric(raw) != p
                or not r.lot.strip() or not r.certificate.strip()
                or d.percentSource != r.certificate or d.productReference != reference):
            raise ValueError('Product snapshot does not match mass-content evidence')
    stock = 10 * rho * p / mass
    if not math.isfinite(stock) or stock <= target:
        raise ValueError('Target must be below stock concentration')
    aliquot = volume * target / stock
    product_mass = aliquot * rho
    if not all(math.isfinite(n) and n > 0 for n in [aliquot, product_mass]) or aliquot >= volume:
        raise ValueError('Commercial calculation exceeds numeric range')
    if not math.isclose(aliquot, payload.expectedAliquot, rel_tol=1e-10, abs_tol=1e-100):
        raise ValueError('Result does not match current inputs')
    return stock, aliquot, product_mass, volume


def build_commercial_pdf(payload):
    stock, aliquot, product_mass, volume = recompute_commercial(payload)
    en = payload.locale == 'en'
    def t(fa, english):
        return english if en else fa
    d = payload.commercial
    pdf = ReportPDF(en)
    pdf.add_page()
    pdf.line(t('گزارش اسمی تهیه از محلول تجاری', 'Nominal commercial-solution preparation report'), True, 17)
    pdf.line('ARTIN LAB | commercial solution v1', size=9, ltr=True)
    pdf.line(datetime.now(timezone.utc).isoformat(), size=9, ltr=True)
    pdf.line(payload.material.name, True, 14)
    pdf.line(f'{payload.material.formula} | CID {payload.material.cid} | M = {payload.molarMass} g/mol', ltr=True)
    pdf.line(f'https://pubchem.ncbi.nlm.nih.gov/compound/{payload.material.cid}', size=9, ltr=True)
    pdf.line(t('تاریخ نسخهٔ ماده', 'Material snapshot date'), size=9)
    pdf.line(payload.material.retrievedOn, size=9, ltr=True)
    pdf.line(t('نتیجهٔ بازحساب‌شده از داده‌های جاری', 'Result recalculated from current inputs'), True)
    for fa, english, value, unit in [
        ('غلظت اسمی محصول', 'Nominal stock concentration', stock, 'mol/L'),
        ('برداشت از محصول', 'Product aliquot', aliquot, 'mL'),
        ('جرم معادل محصول', 'Equivalent product mass', product_mass, 'g'),
        ('حجم نهایی مقصد', 'Target final volume', volume, 'mL')]:
        pdf.line(t(fa, english), True)
        pdf.line(f'{value:.8g} {unit}', True, 14, True)
    pdf.line('C1 (mol/L) = 10 * rho (g/mL) * P (%) / M (g/mol)', ltr=True, size=9)
    pdf.line('V1 (mL) = C2 * V2 (mL) / C1', ltr=True, size=9)
    pdf.line(t('نتیجه اسمی است؛ عدم‌قطعیت ارزیابی نشده است. حجم حلال از تفاضل سادهٔ حجم نهایی و برداشت به دست نمی‌آید. ترتیب اختلاط، کنترل دما و ایمنی باید مطابق SOP و SDS همان محصول تعیین شوند.', 'The result is nominal; uncertainty was not evaluated. Added-solvent volume is not obtained by subtracting aliquot from final volume. Mixing order, temperature control and safety must follow the product SOP and SDS.'))
    pdf.add_page()
    pdf.line(t('ورودی‌ها و منابع ثبت‌شده', 'Recorded inputs and sources'), True, 16)
    for key, fa, english in [
        ('productReference', 'محصول و بچ / گواهی', 'Product and lot / certificate'),
        ('massPercent', 'مقدار جزء (% w/w)', 'Mass content (% w/w)'),
        ('percentSource', 'منبع درصد جرمی', 'Mass-content source'),
        ('density', 'چگالی کل محصول (g/mL)', 'Whole-product density (g/mL)'),
        ('densityConditions', 'دما و شرایط چگالی', 'Density temperature and conditions'),
        ('densitySource', 'منبع چگالی', 'Density source'),
        ('target', 'غلظت مقصد (mol/L)', 'Target concentration (mol/L)'),
        ('volume', 'حجم نهایی ورودی', 'Entered final volume')]:
        pdf.line(t(fa, english), True, 9)
        pdf.line(getattr(d, key) + (' ' + d.volumeUnit if key == 'volume' else ''))
    if d.reagent:
        pdf.line(t('نسخهٔ ثبت‌شدهٔ محصول', 'Recorded product snapshot'), True, 13)
        for fa, english, value in [
            ('نام', 'Name', d.reagent.name), ('سازنده', 'Manufacturer', d.reagent.manufacturer),
            ('کاتالوگ', 'Catalogue', d.reagent.catalogue), ('بچ', 'Lot', d.reagent.lot),
            ('مرجع گواهی', 'Certificate reference', d.reagent.certificate),
            ('خلوص و مبنا', 'Purity and basis', d.reagent.purity + ' | ' + d.reagent.purityBasis)]:
            if value:
                pdf.line(t(fa, english) + ': ' + value, size=9)
    pdf.line(t('تطابق جزء و شکل شیمیایی توسط واردکننده تأیید شده است. چگالی باید مربوط به کل محصول با درصد و شرایط ثبت‌شده باشد. این گزارش گواهی را مستقلاً تأیید نمی‌کند. درصد حجمی، نرمالیته، واکنش و تبدیل نمک به عنصر در این مدل نیستند.', 'The data provider confirmed species and chemical-form identity. Density must describe the whole product at the recorded content and conditions. This report does not independently verify certificates. Volume percent, normality, reactions and salt-to-element conversion are outside this model.'))
    pdf.line('Model reference: Sigma-Aldrich molarity calculator', size=9, ltr=True)
    pdf.line('https://www.sigmaaldrich.com/US/en/support/calculators-and-apps/molarity-calculator', size=8, ltr=True)
    return bytes(pdf.output())
