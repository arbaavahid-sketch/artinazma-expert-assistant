"""Separate nominal preparation labels; results are recomputed before export."""
from typing import Literal
from physical_pdf_service import StrictModel, ReportPDF
from dilution_pdf_service import Label
from nominal_solution_pdf_service import NominalSolutionReport, recompute_nominal
from commercial_pdf_service import CommercialReport, recompute_commercial


class SolutionLabelReport(StrictModel):
    kind: Literal['nominal', 'commercial']
    label: Label
    report: NominalSolutionReport | CommercialReport


def build_solution_label_pdf(payload):
    l, r = payload.label, payload.report
    if not l.solutionId.strip():
        raise ValueError('Solution ID required')
    if payload.kind == 'nominal' and isinstance(r, NominalSolutionReport):
        recompute_nominal(r)
        concentration, volume, reference = r.inputs.concentration, f'{r.inputs.volume} mL', r.inputs.puritySource
    elif payload.kind == 'commercial' and isinstance(r, CommercialReport):
        _, _, _, v = recompute_commercial(r)
        concentration, volume, reference = r.commercial.target, f'{v:.8g} mL', r.commercial.productReference
    else:
        raise ValueError('Label and preparation kind mismatch')
    en = r.locale == 'en'
    t = lambda fa, english: english if en else fa
    pdf = ReportPDF(en)
    pdf.add_page()
    pdf.line('ARTIN LAB | ' + l.solutionId, True, 13, True)
    pdf.line(t('تهیه با توزین ماده' if payload.kind == 'nominal' else 'تهیه از محصول تجاری', 'Prepared by weighing' if payload.kind == 'nominal' else 'Prepared from commercial product'), size=9)
    pdf.line(r.material.name, True, 17)
    pdf.line(r.material.formula, ltr=True)
    pdf.line(f'{concentration} mol/L', True, 21, True)
    pdf.line(volume, True, 13, True)
    for fa, english, value in [
        ('تهیه‌کننده', 'Prepared by', l.preparedBy),
        ('تاریخ تهیه و تقویم', 'Preparation date and calendar', l.preparedOn),
        ('انقضا و تقویم', 'Expiry and calendar', l.expires),
        ('نگهداری', 'Storage', l.storage)]:
        pdf.line(t(fa, english), True, 9)
        pdf.line(value or t('ثبت نشده', 'Not recorded'))
    pdf.line(t('مرجع محصول مصرفی', 'Source-product reference'), True, 9)
    pdf.line(reference, size=9)
    if l.notes:
        pdf.line(l.notes, size=9)
    pdf.line(t('غلظت اسمیِ برنامه؛ این برچسب تهیهٔ واقعی یا انقضا را تأیید نمی‌کند. ایمنی طبق SDS و SOP. قالب آزاد A4، بدون اندازهٔ ثابت برچسب چسب‌دار.', 'Planned nominal concentration; this label does not verify actual preparation or expiry. Safety per SDS and SOP. Flexible A4 layout without fixed adhesive-label dimensions.'), size=9)
    return bytes(pdf.output())
