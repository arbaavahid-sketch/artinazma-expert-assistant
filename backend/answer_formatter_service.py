import re


def format_answer_for_ui(text: str) -> str:
    if not text:
        return ""

    cleaned = text.strip()

    # حذف Markdown سنگین
    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.replace("---", "")

    # تیترهای رایج که باید خط جدا داشته باشند
    headings = [
        "جمع‌بندی کاربردی",
        "جمع‌بندی کوتاه",
        "تفاوت بنیادی",
        "مقایسه فنی و عملیاتی",
        "مقایسه فنی",
        "محدودیت‌ها و خطاهای رایج",
        "سناریوی انتخاب",
        "پیشنهاد عملی",
        "نکات عملی",
        "کنترل کیفیت",
        "نکات نمونه‌برداری و آماده‌سازی",
        "اطلاعات لازم برای تصمیم قطعی",
        "اطلاعات تکمیلی موردنیاز",
        "اقدام بعدی",
        "نتیجه‌گیری",
    ]

    for heading in headings:
        cleaned = re.sub(
            rf"\s*{re.escape(heading)}\s*",
            f"\n\n{heading}\n",
            cleaned,
        )

    # هر بولت حتماً برود اول خط
    cleaned = re.sub(r"\s*•\s*", "\n• ", cleaned)

    # شماره‌گذاری‌ها هم خط جدا شوند
    cleaned = re.sub(r"\s+([0-9۰-۹]+[\.\)])\s+", r"\n\1 ", cleaned)

    # اگر تیتر با دو نقطه آمده بود، متن بعدی جدا شود
    cleaned = re.sub(
        r"(?m)^([آ-یA-Za-z0-9 /،()‌\-]{3,60}:)\s+",
        r"\1\n",
        cleaned,
    )

    # تمیزکاری خط‌ها
    lines = []
    for line in cleaned.splitlines():
        line = line.strip()
        if line:
            lines.append(line)
        else:
            if lines and lines[-1] != "":
                lines.append("")

    cleaned = "\n".join(lines)

    # حذف فاصله‌های خیلی زیاد
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()