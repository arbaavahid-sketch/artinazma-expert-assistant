import re


def format_answer_for_ui(text: str) -> str:
    if not text:
        return ""

    cleaned = str(text).strip()

    # یکسان‌سازی newline
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")

    # حذف markdown سنگین
    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\n\s*---+\s*\n", "\n\n", cleaned)

    # اگر مدل بولت‌ها را پشت سر هم نوشته، هر بولت را خط جدید کن
    cleaned = re.sub(r"\s*•\s*", "\n• ", cleaned)

    # اگر مدل از - به عنوان بولت استفاده کرد
    cleaned = re.sub(r"(?<!\n)\s+-\s+", "\n- ", cleaned)

    # تیترهای رایج را از متن جدا کن
    section_titles = [
        "جمع‌بندی کاربردی",
        "جمع بندی کاربردی",
        "جمع‌بندی",
        "جمع بندی",
        "تفاوت بنیادی",
        "مقایسه فنی",
        "مقایسه فنی و عملیاتی",
        "روش‌ها یا دستگاه‌های مناسب",
        "روش ها یا دستگاه های مناسب",
        "معیار انتخاب",
        "نکات نمونه‌برداری",
        "نکات نمونه برداری",
        "آماده‌سازی نمونه",
        "آماده سازی نمونه",
        "کنترل کیفیت",
        "QC",
        "محدودیت‌ها",
        "محدودیت ها",
        "خطاهای رایج",
        "سناریوی انتخاب",
        "پیشنهاد عملی",
        "اقدام بعدی",
        "اطلاعات لازم برای تصمیم قطعی",
        "اطلاعات تکمیلی موردنیاز",
        "اطلاعات تکمیلی مورد نیاز",
    ]

    for title in section_titles:
        cleaned = re.sub(
            rf"\s*({re.escape(title)})(\s*:)?\s*",
            rf"\n\n\1\n",
            cleaned,
            flags=re.IGNORECASE,
        )

    # اگر چند بولت پشت سر هم بعد از تیتر آمده، مرتب شود
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    # فاصله اضافه اول خط‌ها
    cleaned = "\n".join(line.strip() for line in cleaned.split("\n"))

    # دوباره فاصله‌های خیلی زیاد را کم کن
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()