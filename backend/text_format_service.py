import re


def format_answer_for_ui(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # حذف markdown سنگین
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*---+\s*$", "", text, flags=re.MULTILINE)

    # درست کردن شکست‌های بدِ «و»
    text = re.sub(
        r"(?m)^([^\n]{2,50})\nو\n([^\n]{2,50})$",
        r"\1 و \2",
        text,
    )

    text = re.sub(
        r"(?m)^([^\n]{2,50})\nو\s+([^\n]{2,50})$",
        r"\1 و \2",
        text,
    )

    # درست کردن تیترهایی که وسطشان شکسته شده
    bad_heading_fixes = {
        "نکات نمونه‌برداری\nو آماده‌سازی": "نکات نمونه‌برداری و آماده‌سازی",
        "QC\nو\nمحدودیت‌ها": "QC و محدودیت‌ها",
        "QC\nو محدودیت‌ها": "QC و محدودیت‌ها",
        "کنترل کیفیت\nو محدودیت‌ها": "کنترل کیفیت و محدودیت‌ها",
        "روش‌ها یا دستگاه‌های\nمناسب": "روش‌ها یا دستگاه‌های مناسب",
    }

    for old, new in bad_heading_fixes.items():
        text = text.replace(old, new)

    # تیترهای اصلی را Markdown واقعی کن تا ReactMarkdown درست نمایش دهد
    section_titles = [
        "جمع‌بندی",
        "جمع‌بندی کاربردی",
        "روش‌ها یا دستگاه‌های مناسب",
        "روش‌های مناسب",
        "معیار انتخاب",
        "نکات نمونه‌برداری و آماده‌سازی",
        "کنترل کیفیت و محدودیت‌ها",
        "QC و محدودیت‌ها",
        "محدودیت‌ها",
        "خطاهای رایج",
        "سناریوی انتخاب",
        "اطلاعات لازم برای پیشنهاد قطعی",
        "اطلاعات لازم برای تصمیم قطعی",
        "هشدار ایمنی",
        "اقدام پیشنهادی",
    ]

    for title in section_titles:
        pattern = rf"(?m)^\s*{re.escape(title)}\s*$"
        text = re.sub(pattern, f"\n\n## {title}\n", text)

    # تبدیل خطوط کلیدی به بولت، فقط وقتی بولت ندارند
    text = re.sub(
        r"(?m)^(ASTM\s+D\d{3,5}|ISO\s+\d+|EPA\s+\d+|XRF|ICP|ICP-OES|ICP-MS|GC-MS|GC|HPLC|AAS|FTIR|UV-Vis)(\s*:)",
        r"- **\1**:",
        text,
    )

    # اگر چند بولت پشت سر هم در یک خط آمده باشند، جداشان کن
    text = re.sub(r"\s+•\s+", "\n- ", text)
    text = re.sub(r"(?m)^\s*•\s+", "- ", text)

    # جدا کردن بخش‌هایی که با «عنوان:» شروع شده‌اند و پشت سر متن قبلی چسبیده‌اند
    text = re.sub(
        r"(?<!\n)\s+(ماتریس نمونه|محدوده غلظت و LOD/LOQ|استاندارد موردنیاز|دقت|صحت|نمونه‌برداری|کالیبراسیون)\s*:",
        r"\n- **\1**:",
        text,
    )

    # حذف فاصله‌های زیاد
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
