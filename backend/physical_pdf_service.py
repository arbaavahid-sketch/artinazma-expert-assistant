"""Structured, recomputed physical reports. No uploaded HTML or external resources."""
import json
import math
import re
from datetime import datetime
from pathlib import Path
from typing import Literal, Annotated

from fpdf import FPDF
from fpdf.enums import XPos, YPos
from fpdf.fonts import FontFace
from pydantic import BaseModel, ConfigDict, Field
from uncertainty_service import BudgetRequest, calculate_budget

Text = Annotated[str, Field(strict=True, max_length=2000)]
NumberText = Annotated[str, Field(strict=True, max_length=200)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Identity(StrictModel):
    title: Text
    sample: Text
    sop: Text
    edition: Text
    matrix: Text


class RawUncertainty(StrictModel):
    value: NumberText
    kind: Literal['standard', 'certificate', 'rectangular', 'triangular', 'resolution', 'repeatability']
    divisor: NumberText
    source: Text


class Quantity(StrictModel):
    nominal: NumberText
    uncertainty: RawUncertainty


class DensityInputs(StrictModel):
    mass: Quantity
    volume: Quantity


class DensityData(StrictModel):
    modelVersion: Literal[1]
    inputs: DensityInputs
    conditions: Text
    coverage: NumberText
    coverageSource: Text
    independent: bool = Field(strict=True)


class WeighingComponents(StrictModel):
    calibration: RawUncertainty
    resolution: RawUncertainty
    repeatability: RawUncertainty


class WeighingData(StrictModel):
    mass: NumberText
    components: WeighingComponents
    coverage: NumberText
    coverageSource: Text
    independent: bool = Field(strict=True)


class SavedRun(StrictModel):
    kind: Literal['weighing', 'density']
    modelVersion: Literal[1]
    inputKey: str = Field(max_length=600000)
    calculatedAt: str = Field(max_length=50)
    measured: float = Field(allow_inf_nan=False)
    standard: float = Field(ge=0, allow_inf_nan=False)
    expanded: float = Field(ge=0, allow_inf_nan=False)
    coverage: float = Field(gt=0, allow_inf_nan=False)
    engine: str = Field(min_length=1, max_length=100)
    engineVersion: str = Field(min_length=1, max_length=100)


class PhysicalReport(StrictModel):
    kind: Literal['weighing', 'density']
    locale: Literal['fa', 'en']
    identity: Identity
    data: DensityData | WeighingData
    run: SavedRun


def numeric(value):
    value = value.strip().translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٫−', '01234567890123456789.-'))
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?', value):
        raise ValueError('Invalid numeric input')
    result = float(value)
    if not math.isfinite(result):
        raise ValueError('Invalid numeric input')
    return result


def component(name, raw):
    if not raw.source.strip():
        raise ValueError('An uncertainty source is required')
    item = dict(name=name, value=numeric(raw.value), kind=raw.kind, sensitivity=1)
    if raw.kind == 'certificate':
        item['certificate_k'] = numeric(raw.divisor)
    if raw.kind == 'repeatability':
        count = numeric(raw.divisor)
        if not count.is_integer():
            raise ValueError('Integer repetition count required')
        item['repetitions'] = int(count)
    return item


def recompute_report(payload):
    d, run = payload.data, payload.run
    if not d.independent or not d.coverageSource.strip() or run.kind != payload.kind:
        raise ValueError('Independent sourced current run required')
    when = datetime.fromisoformat(run.calculatedAt.replace('Z', '+00:00'))
    if when.tzinfo is None:
        raise ValueError('Calculation timestamp needs a timezone')
    snapshot = json.loads(run.inputKey)
    if snapshot != {'data': d.model_dump(), 'identity': payload.identity.model_dump()}:
        raise ValueError('Stale run snapshot')
    if payload.kind == 'density' and isinstance(d, DensityData):
        mass, volume = numeric(d.inputs.mass.nominal), numeric(d.inputs.volume.nominal)
        if mass <= 0 or volume <= 0 or not d.conditions.strip():
            raise ValueError('Positive mass and volume and conditions required')
        keys = ['mass', 'volume']
        raws = [d.inputs.mass.uncertainty, d.inputs.volume.uncertainty]
        measured = mass / volume
        model = {'kind': 'density', 'nominals': [mass, volume]}
    elif payload.kind == 'weighing' and isinstance(d, WeighingData):
        measured = numeric(d.mass)
        if measured <= 0:
            raise ValueError('Positive mass required')
        keys = ['calibration', 'resolution', 'repeatability']
        raws = [getattr(d.components, key) for key in keys]
        if [r.kind for r in raws] != ['certificate', 'resolution', 'repeatability']:
            raise ValueError('Unexpected weighing uncertainty kind')
        model = None
    else:
        raise ValueError('Workflow data mismatch')
    result = calculate_budget(BudgetRequest(measured=measured, coverage=numeric(d.coverage),
        measurement_model=model, components=[component(k, u) for k, u in zip(keys, raws)]))
    for saved, current in [('measured', 'measured'), ('standard', 'standard_uncertainty'),
                           ('expanded', 'expanded_uncertainty'), ('coverage', 'coverage')]:
        if not math.isclose(getattr(run, saved), result[current], rel_tol=1e-10, abs_tol=1e-100):
            raise ValueError('Saved result does not match recomputation')
    if run.engine != result['engine'] or run.engineVersion != result['engine_version']:
        raise ValueError('Engine changed; recalculate before exporting')
    return result, keys, raws


class ReportPDF(FPDF):
    def __init__(self, en):
        super().__init__(format='A4')
        self.en = en
        fonts = Path(__file__).parent / 'fonts'
        for style, name in [('', 'Regular'), ('B', 'Bold')]:
            self.add_font('Report', style, str(fonts / f'Vazir-{name}.ttf'))
        self.set_text_shaping(True)
        self.set_margins(18, 18, 18)
        self.set_auto_page_break(True, 20)

    def footer(self):
        self.set_y(-14)
        self.set_font('Report', '', 8)
        self.set_text_color(100, 110, 125)
        self.cell(0, 7, f'Page {self.page_no()}', align='C')

    def line(self, text, bold=False, size=10, ltr=False):
        self.set_font('Report', 'B' if bold else '', size)
        self.set_text_color(25, 40, 60)
        self.set_fill_color(255, 255, 255)
        # Normalize line breaks for bounded, readable paragraphs; the raw snapshot remains unchanged.
        text = " ".join(text.split())
        self.multi_cell(0, 6, text, align='L' if self.en or ltr else 'R',
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT, wrapmode='WORD')
        self.ln(2)

    def data_table(self, headers, rows, widths, numeric_columns=()):
        order = list(range(len(headers))) if self.en else list(reversed(range(len(headers))))
        self.set_font('Report', '', 8)
        self.set_draw_color(185, 198, 215)
        self.set_text_color(25, 40, 60)
        alignment = tuple('C' if i in numeric_columns else ('L' if self.en else 'R') for i in order)
        with self.table(col_widths=[widths[i] for i in order], line_height=4.8, padding=1.8,
                        text_align=alignment, repeat_headings=1,
                        cell_fill_color=(255,255,255), cell_fill_mode='ALL',
                        headings_style=FontFace(emphasis='B', fill_color=(237,243,250)),
                        width=self.epw) as table:
            for values in [headers, *rows]:
                row=table.row()
                for i in order:
                    row.cell(' '.join(str(values[i]).split()))
        self.ln(5)


def build_physical_pdf(payload: PhysicalReport):
    result, keys, raws = recompute_report(payload)
    d, run = payload.data, payload.run
    en = payload.locale == 'en'
    t = lambda fa, english: english if en else fa
    pdf = ReportPDF(en)
    pdf.add_page()
    pdf.line(t('گزارش چگالی' if payload.kind == 'density' else 'گزارش توزین مستقیم',
               'Density report' if payload.kind == 'density' else 'Direct weighing report'), True, 18)
    pdf.line('ARTIN LAB | model v1', ltr=True)
    for key, fa, english in [('title', 'عنوان', 'Title'), ('sample', 'شناسه نمونه', 'Sample ID'),
                            ('sop', 'روش اجرایی', 'SOP'), ('edition', 'ویرایش روش', 'Method edition'), ('matrix', 'ماتریس', 'Matrix')]:
        pdf.line(t(fa, english), True, 9)
        value = getattr(payload.identity, key) or '-'
        pdf.line(value, ltr=not bool(re.search(r'[\u0600-\u06ff]', value)))
    pdf.line(f'{run.calculatedAt} | {run.engine} | v{run.engineVersion}', size=9, ltr=True)
    unit = 'g/mL' if payload.kind == 'density' else 'g'
    pdf.line(f'{result["measured"]:.7g} +/- {result["expanded_uncertainty"]:.4g} {unit}', True, 17, True)
    pdf.line(f'u = {result["standard_uncertainty"]:.7g} {unit}; k = {result["coverage"]:g}', ltr=True)
    pdf.line(t('مبنای ضریب پوشش', 'Coverage basis'), True)
    pdf.line(d.coverageSource)
    if isinstance(d, DensityData):
        pdf.line(t('شرایط اندازه‌گیری', 'Measurement conditions'), True)
        pdf.line(d.conditions, ltr=not bool(re.search(r'[\u0600-\u06ff]', d.conditions)))
        pdf.line('rho = m/V; c(m) = 1/V; c(V) = -m/V^2; u(rho) = sqrt(sum((c*u)^2))', ltr=True, size=9)
    else:
        pdf.line(t('جرم خام (g)', 'Raw mass (g)'), True)
        pdf.line(d.mass, ltr=True)
        pdf.line('m = I; u(m) = sqrt(sum(u_i^2)); U = k*u(m)', ltr=True, size=9)
    names = {'mass': t('جرم (g)', 'Mass (g)'), 'volume': t('حجم (mL)', 'Volume (mL)'),
             'calibration': t('کالیبراسیون (g)', 'Calibration (g)'),
             'resolution': t('تفکیک (g)', 'Resolution (g)'), 'repeatability': t('تکرارپذیری (g)', 'Repeatability (g)')}
    kinds = {'standard': 'u', 'certificate': 'U/k', 'resolution': 'd/sqrt(12)',
             'repeatability': 's/sqrt(n)', 'rectangular': 'a/sqrt(3)', 'triangular': 'a/sqrt(6)'}
    pdf.add_page(orientation='L')
    pdf.line(t('داده‌های خام و بودجه عدم‌قطعیت','Raw data and uncertainty budget'),True,15)
    kinds={'standard':t('استاندارد u','Standard u'),'certificate':'U/k','resolution':'d/sqrt(12)','repeatability':'s/sqrt(n)','rectangular':'a/sqrt(3)','triangular':'a/sqrt(6)'}
    rows=[];long_sources=[]
    for key,raw,item in zip(keys,raws,result['components']):
        source=raw.source
        if len(source)>180:
            long_sources.append(source);source=source[:130]+' ... '+t('منبع کامل ','Full source ')+str(len(long_sources))
        nominal=getattr(d.inputs,key).nominal if isinstance(d,DensityData) else '-'
        rows.append([names[key],nominal,kinds[raw.kind],raw.value,raw.divisor or '-',f'{item["standard_uncertainty"]:.8g}',f'{item["sensitivity"]:.8g}',f'{abs(item["contribution"]):.8g}',source])
    pdf.data_table([t('کمیت و واحد','Quantity/unit'),t('مقدار','Nominal'),t('نوع','Type'),t('عدد خام','Raw value'),'k / n','u','c',f'|c*u| ({unit})',t('منبع','Source')],rows,[34,18,24,22,15,25,25,28,51],(1,3,4,5,6,7))
    if long_sources:
        pdf.add_page(orientation='P');pdf.line(t('متن کامل منابع','Full sources'),True,13)
        for i,source in enumerate(long_sources,1):pdf.line(t('منبع ','Source ')+str(i),True);pdf.line(source)
    with pdf.unbreakable() as section:
        section.line(t('فرض‌ها و محدوده', 'Assumptions and scope'), True, 13)
        section.line(t('استقلال منابع و نبود دوباره‌شماری توسط واردکننده داده تأیید شده است. k=2 تضمین پوشش دقیق ۹۵٪ نیست. این گزارش تصمیم انطباق یا تأیید روش نیست.',
                   'Source independence and absence of double counting were confirmed by the data provider. k=2 does not guarantee exact 95% coverage. This report is not a conformity decision or method approval.'))
        section.line(t('جرم باید پس از تصحیحات لازم وارد شود. تصحیح شناوری و توزین تفاضلی محاسبه نمی‌شوند. چگالی برای حجم همان نمونه در شرایط ثبت‌شده است؛ تصحیح دما، روش پیکنومتر و هم‌بستگی جرم و حجم در این مسیر نیستند. انتشار مرتبه اول برای عدم‌قطعیت‌های کوچک نسبت به ورودی‌هاست.',
                   'Enter mass after applying required corrections. Buoyancy and difference weighing are not calculated. Density uses the same sample volume at recorded conditions; temperature correction, pycnometer models and mass-volume correlation are excluded. First-order propagation applies to uncertainties small relative to inputs.'))
        section.line('JCGM 100:2008, section 5 | https://www.bipm.org/en/committees/jc/jcgm/publications', size=8, ltr=True)
    return bytes(pdf.output())
