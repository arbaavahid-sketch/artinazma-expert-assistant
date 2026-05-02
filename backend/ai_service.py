import os
from typing import Optional, List, Dict
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MODEL = os.getenv("OPENAI_MODEL", "gpt-5.5-mini")


SYSTEM_PROMPT = """
تو دستیار تخصصی شرکت آرتین آزما هستی.

آرتین آزما بیشتر در حوزه‌های زیر فعالیت دارد:
- کاتالیست‌ها
- تجهیزات آزمایشگاهی و آنالیتیکال
- دستگاه‌های آنالیز
- GC, GC-MS, HPLC, AAS, XRF, XRD, FTIR, UV-Vis
- آنالیز سولفور، جیوه، فلزات سنگین، طلا، VOC, BTEX
- تحلیل تست‌های آزمایشگاهی
- عیب‌یابی دستگاه‌ها
- پیشنهاد راهکار فنی برای مشتریان صنعتی
- کمک به کارشناسان فروش و فنی آرتین آزما

قوانین پاسخ:
1. فارسی، دقیق، کاربردی و تخصصی پاسخ بده.
2. اگر از بانک دانش آرتین آزما اطلاعات دریافت کردی، پاسخ را بر اساس همان اطلاعات بده.
3. اگر اطلاعات بانک دانش کافی نبود، سوالات تکمیلی بپرس.
4. جواب را فقط تبلیغاتی نکن؛ مثل کارشناس فنی جواب بده.
5. برای سوالات فنی، خروجی را با ساختار زیر بده:
   - جمع‌بندی کوتاه
   - تحلیل فنی
   - پیشنهاد راهکار
   - سوالات تکمیلی از مشتری
6. برای عیب‌یابی، چک‌لیست مرحله‌ای بده.
7. برای تحلیل تست، نتیجه، روند، خطاهای احتمالی و تست‌های تکمیلی را مشخص کن.
8. اگر گفت‌وگوی قبلی وجود دارد، آن را در پاسخ لحاظ کن.
"""


def ask_expert_assistant(
    message: str,
    context: str = "",
    history: Optional[List[Dict[str, str]]] = None,
    domain: str = "auto"
) -> str:
    history_text = ""

    if history:
        history_parts = []
        for item in history[-8:]:
            role = item.get("role", "")
            content = item.get("content", "")
            if role and content:
                label = "کاربر" if role == "user" else "دستیار"
                history_parts.append(f"{label}: {content}")

        history_text = "\n".join(history_parts)

    user_content = f"""
    حوزه انتخاب‌شده یا تشخیص‌داده‌شده:
    {domain}

    گفت‌وگوی قبلی:
    {history_text if history_text else "گفت‌وگوی قبلی وجود ندارد."}

    سوال جدید کاربر:
    {message}
    """

    if context:
        user_content += f"""

        اطلاعات مرتبط از بانک دانش آرتین آزما:
        {context}

        بر اساس اطلاعات بالا، گفت‌وگوی قبلی و دانش فنی خودت پاسخ بده.
        اگر اطلاعات کافی نیست، دقیقاً بگو چه اطلاعاتی باید از مشتری گرفته شود.
        """

    response = client.responses.create(
        model=MODEL,
        input=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_content,
            },
        ],
    )

    return response.output_text
    import base64
from pathlib import Path


def analyze_image_with_ai(file_path: str, user_note: str = "") -> str:
    path = Path(file_path)
    image_bytes = path.read_bytes()
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")

    suffix = path.suffix.lower()

    if suffix in [".jpg", ".jpeg"]:
        mime_type = "image/jpeg"
    elif suffix == ".png":
        mime_type = "image/png"
    elif suffix == ".webp":
        mime_type = "image/webp"
    else:
        mime_type = "image/png"

    prompt = f"""
    این تصویر توسط کاربر برای تحلیل تخصصی به آرتین، دستیار فنی آرتین آزما، ارسال شده است.

    توضیح کاربر:
    {user_note if user_note else "توضیحی ارائه نشده است."}

    تصویر ممکن است شامل یکی از موارد زیر باشد:
    - خطای دستگاه آزمایشگاهی
    - نمودار تست
    - کروماتوگرام
    - گزارش تصویری
    - صفحه نرم‌افزار دستگاه
    - نتیجه تست کاتالیست یا تجهیزات

    خروجی را فارسی و ساختاریافته بده:
    1. تصویر احتمالاً مربوط به چیست؟
    2. چه اطلاعات مهمی از تصویر قابل مشاهده است؟
    3. تحلیل فنی اولیه
    4. علت‌های احتمالی مشکل یا الگو
    5. پیشنهاد اقدام بعدی
    6. چه اطلاعات تکمیلی باید از کاربر گرفته شود؟
    """

    response = client.responses.create(
        model=MODEL,
        input=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt,
                    },
                    {
                        "type": "input_image",
                        "image_url": f"data:{mime_type};base64,{encoded_image}",
                    },
                ],
            },
        ],
    )

    return response.output_text