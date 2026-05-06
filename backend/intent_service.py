import re
from typing import Dict


def detect_question_intent(message: str, domain: str = "auto") -> Dict:
    text = (message or "").lower()

    has_astm = bool(
        re.search(r"\b(astm|iso|epa|en)\s*[a-z]?\s*\d{2,6}\b", text, flags=re.IGNORECASE)
        or re.search(r"\bD\s*\d{3,5}\b", message or "", flags=re.IGNORECASE)
    )

    has_latin_model = bool(
        re.search(r"[A-Za-z][A-Za-z0-9\-]{2,}(?:\s+[A-Za-z0-9\-]{1,})?", message or "")
    )

    price_keywords = [
        "قیمت",
        "خرید",
        "موجودی",
        "پیش فاکتور",
        "پیش‌فاکتور",
        "سفارش",
        "زمان تحویل",
        "استعلام",
        "price",
        "buy",
        "quotation",
        "availability",
        "order",
    ]

    troubleshooting_keywords = [
        "خطا",
        "ارور",
        "مشکل",
        "عیب",
        "عیب‌یابی",
        "عیب یابی",
        "کار نمی",
        "روشن نمی",
        "نشتی",
        "نوسان",
        "لرزش",
        "افت",
        "افزایش ناگهانی",
        "baseline",
        "noise",
        "drift",
        "tailing",
        "fronting",
        "پهن شدن پیک",
        "دم کشیدن پیک",
        "error",
        "fault",
        "troubleshoot",
        "problem",
        "leak",
        "leakage",
        "contamination",
        "instability",
    ]

    analysis_keywords = [
        "تحلیل",
        "آنالیز",
        "تفسیر",
        "گزارش",
        "نتیجه",
        "خروجی",
        "پرینت",
        "نمودار",
        "کروماتوگرام",
        "عدد",
        "مقدار",
        "غلظت",
        "میانگین",
        "تکرار",
        "peak",
        "پیک",
        "baseline",
        "rsd",
        "recovery",
        "lod",
        "loq",
        "qc",
        "calibration",
        "replicate",
        "repeat",
        "result",
        "report",
        "printout",
        "concentration",
    ]

    equipment_keywords = [
        "دستگاه",
        "تجهیز",
        "تجهیزات",
        "آنالایزر",
        "مدل",
        "کاتالوگ",
        "دیتاشیت",
        "مشخصات",
        "device",
        "equipment",
        "instrument",
        "analyzer",
        "model",
        "datasheet",
        "manual",
    ]

    chemical_keywords = [
        "مواد شیمیایی",
        "ماده شیمیایی",
        "کاتالیست",
        "جاذب",
        "رزین",
        "حلال",
        "افزودنی",
        "آمین",
        "مولکولارسیو",
        "کربن فعال",
        "catalyst",
        "adsorbent",
        "resin",
        "solvent",
        "additive",
        "amine",
        "molecular sieve",
        "activated carbon",
    ]

    suggestion_keywords = [
        "چه دستگاهی",
        "چه تجهیزی",
        "پیشنهاد",
        "مناسب",
        "انتخاب",
        "اندازه گیری",
        "اندازه‌گیری",
        "سنجش",
        "تعیین",
        "روش مناسب",
        "دستگاه مناسب",
        "تجهیز مناسب",
        "measurement",
        "determination",
        "برای اندازه گیری",
        "برای اندازه‌گیری",
        "recommend",
        "suggest",
        "which device",
        "suitable",
    ]

    has_price_intent = any(keyword in text for keyword in price_keywords)
    has_suggestion_intent = any(keyword in text for keyword in suggestion_keywords)

    if has_price_intent and not has_suggestion_intent:
        intent = "commercial_request"
        label = "قیمت، موجودی یا سفارش"

    elif has_astm:
        intent = "standard_explanation"
        label = "استاندارد یا روش آزمون"

    elif any(keyword in text for keyword in troubleshooting_keywords):
        intent = "troubleshooting"
        label = "عیب‌یابی تجهیزات"

    elif any(keyword in text for keyword in analysis_keywords):
        intent = "lab_analysis"
        label = "تحلیل تست یا داده آزمایشگاهی"

    elif any(keyword in text for keyword in suggestion_keywords):
        intent = "equipment_recommendation"
        label = "پیشنهاد دستگاه یا روش"

    elif any(keyword in text for keyword in chemical_keywords):
        intent = "chemical_or_catalyst"
        label = "مواد شیمیایی، کاتالیست یا جاذب"

    elif has_latin_model or any(keyword in text for keyword in equipment_keywords):
        intent = "product_or_device"
        label = "محصول، دستگاه یا مدل مشخص"

    else:
        intent = "technical_general"
        label = "سؤال عمومی فنی"

    if domain and domain != "auto":
        label = f"{label} / حوزه انتخابی: {domain}"

    return {
        "intent": intent,
        "label": label,
        "instruction": get_intent_instruction(intent),
    }


def get_intent_instruction(intent: str) -> str:
    instructions = {
        "commercial_request": """
        نوع درخواست: قیمت، موجودی، خرید یا سفارش.
        پاسخ باید کوتاه، حرفه‌ای و بدون حدس قیمت یا موجودی باشد.
        مشخصات لازم برای استعلام را از کاربر بخواه: نام محصول، برند، مدل، تعداد، کاربرد، نوع نمونه، محدوده اندازه‌گیری و اطلاعات تماس.
        ایمیل رسمی info@artinazma.net را برای ارسال درخواست ذکر کن.
        """,

        "standard_explanation": """
        نوع درخواست: استاندارد یا روش آزمون.
        پاسخ باید شامل این بخش‌ها باشد:
        1. این استاندارد درباره چیست؟
        2. برای چه نمونه‌هایی کاربرد دارد؟
        3. اصل روش یا تکنیک اندازه‌گیری چیست؟
        4. تجهیزات و کنترل کیفیت موردنیاز چیست؟
        5. محدودیت‌ها و نکات عملی چیست؟
        متن استاندارد را کپی نکن.
        اگر نسخه کامل لازم است، بگو باید از مرجع رسمی تهیه شود.
        در توضیح استاندارد، ویژگی خاص یک دستگاه مشخص را به خود استاندارد نسبت نده. مثلاً نیاز یا عدم نیاز به هلیم، فیلم محافظ، طراحی دتکتور یا LOD مشخص، مربوط به دستگاه است نه خود استاندارد؛ مگر منبع دقیق داشته باشی.
        """,

        "troubleshooting": """
        نوع درخواست: عیب‌یابی تجهیزات.
        پاسخ باید مرحله‌ای باشد:
        1. محتمل‌ترین علت‌ها
        2. چک‌لیست بررسی سریع
        3. بررسی نمونه، مصرفی، کالیبراسیون و روش
        4. بررسی سخت‌افزار، نرم‌افزار و شرایط محیطی
        5. اقدامات ایمن و مواردی که نیاز به کارشناس سرویس دارد
        از ساده‌ترین احتمال شروع کن.
        """,

        "lab_analysis": """
        نوع درخواست: تحلیل تست، گزارش، تصویر، نمودار یا داده آزمایشگاهی.
        پاسخ باید تفسیری باشد:
        1. داده چه چیزی را نشان می‌دهد؟
        2. مقادیر یا روندهای مهم
        3. نقاط غیرعادی یا خطاهای احتمالی
        4. کنترل کیفیت پیشنهادی مثل Blank، Standard، Duplicate، Spike Recovery، CRM، RSD، LOD، LOQ
        5. پیشنهاد اقدام بعدی
        اگر داده کافی نیست، دقیق بگو چه داده‌ای لازم است.
        """,

        "equipment_recommendation": """
        نوع درخواست: پیشنهاد دستگاه یا روش.
        پاسخ باید بر اساس نیاز کاربر دستگاه یا روش مناسب را پیشنهاد دهد.
        حتماً این موارد را بررسی کن:
        نوع نمونه، ماتریس، آنالیت، محدوده غلظت، حد تشخیص، دقت، تعداد نمونه، استاندارد موردنیاز، آماده‌سازی نمونه، مصرفی‌ها و نگهداری.
        اگر اطلاعات کافی نیست، سؤال‌های تکمیلی بپرس.
        اگر موضوع LPG، گاز مایع، گاز طبیعی یا نمونه فرار است:
      - درباره ایمنی نمونه‌برداری، ظرف/کاپ مناسب، تبخیر، فشار، representativeness و آماده‌سازی نمونه هشدار بده.
      - فقط نام دستگاه نگو؛ روش مناسب را با توجه به محدوده گوگرد، استاندارد موردنیاز و نوع ترکیبات گوگردی پیشنهاد بده.
      - تفاوت Total Sulfur، H2S، Mercaptan، COS و CS2 را در صورت مرتبط بودن توضیح بده.
        """,

        "chemical_or_catalyst": """
        نوع درخواست: مواد شیمیایی، کاتالیست، جاذب یا افزودنی.
        پاسخ باید شامل کاربرد، سازوکار احتمالی، معیار انتخاب، محدودیت‌ها، نکات ایمنی، شرایط عملیاتی و اطلاعات لازم برای پیشنهاد دقیق باشد.
        از ادعای قطعی درباره عملکرد یا سازگاری بدون داده پرهیز کن.
        """,

        "product_or_device": """
        نوع درخواست: محصول، دستگاه یا مدل مشخص.
        اگر صفحه مرتبط در سایت آرتین آزما یا منبع معتبر وجود دارد، پاسخ فنی و کامل بده.
        اگر مشخصات عددی قطعی نداری، عدد نساز.
        توضیح بده دستگاه در چه دسته‌ای است، روش اندازه‌گیری چیست، کاربردها، مزایا، محدودیت‌ها، استانداردهای مرتبط و اطلاعات لازم برای انتخاب یا خرید چیست.
        لینک خام را در متن تکرار نکن اگر سیستم کارت لینک را جداگانه نمایش می‌دهد.
        """,

        "technical_general": """
        نوع درخواست: سؤال عمومی فنی.
        پاسخ باید شامل جمع‌بندی کوتاه، تحلیل فنی، نکات عملی، محدودیت‌ها و اطلاعات تکمیلی موردنیاز باشد.
        اگر چند احتمال وجود دارد، آن‌ها را با اولویت و دلیل فنی توضیح بده.
        """,
    }

    return instructions.get(intent, instructions["technical_general"])