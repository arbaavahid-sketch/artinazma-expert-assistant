"""
PDF Export Service — گزارش PDF فارسی از سوالات کاربران.

از fpdf2 با text_shaping (uharfbuzz) استفاده می‌کند تا حروف فارسی درست
شکل‌دهی و راست‌به‌چپ چیده شوند. فونت Vazirmatn (لایسنس OFL) در backend/fonts.
"""

import os
import re
from datetime import datetime
from typing import Any, Dict, List

from fpdf import FPDF
from fpdf.enums import XPos, YPos

_FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

_STATUS_LABELS = {
    "pending": "در انتظار بررسی",
    "approved": "تأیید شده",
    "needs_edit": "نیاز به اصلاح",
    "rejected": "رد شده",
}

_RATING_LABELS = {"up": "رضایت", "down": "نارضایتی"}


def _strip_markdown(text: str) -> str:
    """مارک‌داون را برای متن ساده PDF تمیز می‌کند (بدون تغییر محتوا)."""
    text = text or ""
    text = re.sub(r"```[a-zA-Z]*\n?", "", text)
    text = text.replace("`", "")
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"(?m)^#{1,6}\s*", "", text)
    text = re.sub(r"(?m)^\s*[-–—]{3,}\s*$", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # [متن](لینک) → متن

    # جدول‌های Markdown → خطوط خوانا: ردیف جداکننده حذف، سلول‌ها با «—» جدا می‌شوند.
    lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if re.fullmatch(r"\|?[\s:|-]+\|?", stripped) and "-" in stripped:
            continue  # ردیف |---|---|
        if stripped.startswith("|") and stripped.count("|") >= 2:
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            lines.append("  —  ".join(c for c in cells if c))
        else:
            lines.append(line)
    text = "\n".join(lines)

    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class _QuestionsPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.add_font("Vazirmatn", "", os.path.join(_FONT_DIR, "Vazirmatn-Regular.ttf"))
        self.add_font("Vazirmatn", "B", os.path.join(_FONT_DIR, "Vazirmatn-Bold.ttf"))
        self.set_text_shaping(True)
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(left=15, top=15, right=15)

    def footer(self):
        self.set_y(-14)
        self.set_font("Vazirmatn", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"صفحه {self.page_no()}", align="C")
        self.set_text_color(0, 0, 0)

    def rtl_line(self, text: str, size: float = 10.5, style: str = "", h: float = 6.5):
        self.set_font("Vazirmatn", style, size)
        self.multi_cell(0, h, text, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def build_questions_pdf(questions: List[Dict[str, Any]]) -> bytes:
    """از لیست سوالات (خروجی get_questions_for_export) گزارش PDF می‌سازد."""
    pdf = _QuestionsPDF()
    pdf.add_page()

    # ── سربرگ گزارش ──
    pdf.rtl_line("گزارش سوالات کاربران — دستیار هوشمند آرتین‌آزما", size=15, style="B", h=9)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    pdf.set_text_color(90, 90, 90)
    pdf.rtl_line(f"تعداد سوالات: {len(questions)}    |    تاریخ تهیه گزارش: {now}", size=9.5)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    for q in questions:
        # جداکننده بین سوال‌ها
        pdf.set_draw_color(190, 190, 190)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(3)

        header_bits = [f"سوال #{q.get('id', '')}"]
        if q.get("created_at"):
            header_bits.append(str(q["created_at"]).replace("T", " ")[:16])
        if q.get("customer_name"):
            header_bits.append(f"پرسنده: {q['customer_name']}")
        header_bits.append(_STATUS_LABELS.get(q.get("expert_status", "pending"), q.get("expert_status", "")))
        if q.get("user_rating"):
            header_bits.append(_RATING_LABELS.get(q["user_rating"], q["user_rating"]))
        pdf.set_text_color(20, 60, 120)
        pdf.rtl_line("   |   ".join(header_bits), size=9.5, style="B", h=6)
        pdf.set_text_color(0, 0, 0)

        pdf.rtl_line(f"سوال: {_strip_markdown(q.get('question') or '')}", size=11, style="B", h=7)

        answer = _strip_markdown(q.get("answer") or "")
        if answer:
            pdf.rtl_line(answer, size=9.5, h=6)

        if q.get("reviewed_answer"):
            pdf.ln(1)
            pdf.set_text_color(150, 80, 0)
            pdf.rtl_line("پاسخ اصلاح‌شده کارشناس:", size=10, style="B", h=6)
            pdf.set_text_color(0, 0, 0)
            pdf.rtl_line(_strip_markdown(q["reviewed_answer"]), size=9.5, h=6)

        if q.get("expert_note"):
            pdf.set_text_color(120, 120, 120)
            pdf.rtl_line(f"یادداشت کارشناس: {_strip_markdown(q['expert_note'])}", size=8.5, h=5.5)
            pdf.set_text_color(0, 0, 0)

        pdf.ln(4)

    return bytes(pdf.output())
