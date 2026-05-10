import re


def format_answer_for_ui(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # حذف markdown اضافی
    text = re.sub(r"^\s*---+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)

    # فاصله‌های خیلی زیاد را اول کنترل کن
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)

    # اصلاح شکست‌های بد با «و» حتی اگر بینشان خط خالی باشد
    text = re.sub(
        r"(?m)^([^\n]{2,60})\n+\s*و\s*\n+([^\n]{2,60})$",
        r"\1 و \2",
        text,
    )

    # اصلاح موردهای پرتکرار
    fixes = {
        "QC و محدودیت‌ها": "کنترل کیفیت و محدودیت‌ها",
        "QC و محدودیت ها": "کنترل کیفیت و محدودیت‌ها",
        "نکات نمونه‌برداری و آماده‌سازی": "نکات نمونه‌برداری و آماده‌سازی",
        "روش‌ها یا دستگاه‌های مناسب": "روش‌ها یا دستگاه‌های مناسب",
        "اطلاعات لازم برای پیشنهاد قطعی": "اطلاعات لازم برای پیشنهاد قطعی",
    }

    for old, new in fixes.items():
        text = text.replace(old, new)

    # اگر هنوز QC تنها مانده، آن را تیتر درست کن
    text = re.sub(
        r"(?m)^\s*QC\s*$",
        "کنترل کیفیت و محدودیت‌ها",
        text,
    )

    # تیترهای استاندارد خروجی
    section_titles = [
        "جمع‌بندی",
        "جمع‌بندی کاربردی",
        "روش‌ها یا دستگاه‌های مناسب",
        "روش‌های مناسب",
        "معیار انتخاب",
        "نکات نمونه‌برداری و آماده‌سازی",
        "کنترل کیفیت و محدودیت‌ها",
        "محدودیت‌ها",
        "هشدار ایمنی",
        "اطلاعات لازم برای پیشنهاد قطعی",
        "اطلاعات لازم برای تصمیم قطعی",
        "اقدام پیشنهادی",
    ]

    for title in section_titles:
        text = re.sub(
            rf"(?m)^\s*{re.escape(title)}\s*$",
            f"\n\n## {title}\n",
            text,
        )

    # تبدیل خطوط استانداردها و روش‌ها به بولت خوانا
    text = re.sub(
        r"(?m)^(ASTM\s+D\d{3,5}|ISO\s+\d+|EPA\s+\d+|XRF|ICP|ICP-OES|ICP-MS|GC-MS|GC|HPLC|AAS|FTIR|UV-Vis)\s*:",
        r"- **\1**:",
        text,
    )

    # تبدیل بولت فارسی/خام
    text = re.sub(r"(?m)^\s*•\s*", "- ", text)

    # اگر چند بولت در یک خط چسبیده باشند
    text = re.sub(r"\s+-\s+\*\*", "\n- **", text)

    # حذف خطوط خالی اضافه
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
