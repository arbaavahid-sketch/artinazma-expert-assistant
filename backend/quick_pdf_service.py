"""Record sheet for one quick calculation.

Unlike the recomputed laboratory reports, the numbers here were calculated in
the app and are printed as sent. The sheet says so; it is a record of what the
user saw, not a verified result.
"""
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import Field

from physical_pdf_service import ReportPDF, StrictModel

Line = Annotated[str, Field(strict=True, min_length=1, max_length=2000)]

# The report font has no Greek letters or sub/superscripts, so formulas are
# written with plain-text equivalents instead of printing empty boxes.
_PLAIN = {
    'ρ': 'rho', 'μ': 'mu', 'ν': 'nu', 'η': 'eta', 'π': 'pi', 'Σ': 'sum ', 'Δ': 'delta ', '→': '->',
    '²': '^2', '³': '^3', 'ṁ': 'm_dot', 'x̄': 'x_mean', '̄': '', 'ᵢ': '_i', 'ᵣ': '_r',
    'ₙ': '_n', 'ₚ': '_p', 'ₛ': '_s', 'ₑ': '_e',
    **{chr(0x2080 + digit): f'_{digit}' for digit in range(10)},
}


def plain(text):
    for symbol, replacement in _PLAIN.items():
        text = text.replace(symbol, replacement)
    return text


class QuickRow(StrictModel):
    label: Line
    value: Line


class QuickReport(StrictModel):
    locale: Literal['fa', 'en']
    tool: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+){0,7}$', max_length=48)
    title: Annotated[str, Field(strict=True, min_length=1, max_length=200)]
    category: Annotated[str, Field(strict=True, max_length=120)] = ''
    formula: Annotated[str, Field(strict=True, max_length=1500)] = ''
    inputs: list[QuickRow] = Field(max_length=40)
    results: list[Line] = Field(min_length=1, max_length=60)
    note: Annotated[str, Field(strict=True, max_length=1000)] = ''


def build_quick_pdf(payload: QuickReport):
    en = payload.locale == 'en'

    def t(fa, english):
        return english if en else fa

    pdf = ReportPDF(en)
    pdf.add_page()
    pdf.line(payload.title, True, 17)
    if payload.category.strip():
        pdf.line(payload.category, size=10)
    pdf.line(f'ARTIN LAB | quick calculation v1 | {payload.tool}', size=9, ltr=True)
    pdf.line(datetime.now(timezone.utc).isoformat(timespec='seconds'), size=9, ltr=True)

    pdf.line(t('نتیجه', 'Result'), True, 13)
    pdf.line(plain(payload.results[0]), True, 18, True)
    for line in payload.results[1:]:
        pdf.line(plain(line), ltr=True)

    if payload.inputs:
        pdf.line(t('داده‌های ورودی', 'Input values'), True, 13)
        for row in payload.inputs:
            pdf.line(plain(row.label), True, 9)
            pdf.line(plain(row.value), ltr=True)

    if payload.formula.strip():
        pdf.line(t('فرمول محاسبه', 'Formula'), True, 13)
        for line in payload.formula.splitlines():
            if line.strip():
                pdf.line(plain(line), ltr=True, size=9)

    if payload.note.strip():
        pdf.line(plain(payload.note))

    pdf.line(t(
        'این برگه سابقهٔ یک محاسبهٔ سریع است. اعداد در برنامه محاسبه شده‌اند و سرور آن‌ها را دوباره محاسبه یا تأیید نکرده است. '
        'عدم‌قطعیت ارزیابی نشده و تعداد رقم‌های نمایش‌داده‌شده دقت اندازه‌گیری را نشان نمی‌دهد. '
        'پیش از استفاده در گزارش رسمی، ورودی‌ها و واحدها را با سوابق آزمایشگاه تطبیق دهید.',
        'This sheet records one quick calculation. The numbers were calculated in the app; the server did not recompute or verify them. '
        'Uncertainty was not evaluated and the number of displayed digits does not indicate measurement accuracy. '
        'Check inputs and units against laboratory records before using the values in a formal report.'), size=9)
    return bytes(pdf.output())
