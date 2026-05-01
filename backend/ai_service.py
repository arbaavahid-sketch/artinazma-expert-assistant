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