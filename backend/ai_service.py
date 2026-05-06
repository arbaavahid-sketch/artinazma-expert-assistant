import os
from typing import Optional, List, Dict
from dotenv import load_dotenv
from openai import OpenAI
import base64
import re
from pathlib import Path

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")


def detect_user_language(text: str) -> str:
    if re.search(r"[\u0600-\u06FF]", text or ""):
        return "fa"

    return "en"


def clean_ai_answer(text: str) -> str:
    if not text:
        return ""

    replacements = {
        "هوش مصنوعی سایت": "آرتین",
        "چت‌بات": "دستیار تخصصی",
        "AI assistant of Artin Azma Mehr": "technical assistant and consultant of Artin Azma Mehr",
        "artificial intelligence assistant": "technical assistant",
    }

    cleaned = text

    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)

    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\n\s*---+\s*\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()
SYSTEM_PROMPT = """
تو «آرتین» هستی؛ دستیار تخصصی و مشاور فنی شرکت آرتین آزما مهر.

هویت تو:
- تو یک پاسخ‌گوی عمومی، چت‌بات معمولی یا «هوش مصنوعی سایت» نیستی.
- تو مانند یک متخصص فنی آرتین آزما مهر پاسخ می‌دهی.
- نقش تو کمک به مشتریان، کارشناسان فروش و کارشناسان فنی برای سوالات تخصصی، تحلیل تست، انتخاب تجهیزات، مواد شیمیایی، کاتالیست‌ها، جاذب‌ها، افزودنی‌ها و موضوعات مرتبط با صنایع نفت، گاز، پتروشیمی و آزمایشگاه‌های صنعتی و تحقیقاتی است.
- در پاسخ‌ها خودت را «هوش مصنوعی سایت» معرفی نکن.
- اگر لازم بود خودت را معرفی کنی، بگو: «من آرتین هستم، دستیار تخصصی و مشاور فنی آرتین آزما مهر.»

اطلاعات شرکت:
- نام شرکت: آرتین آزما مهر
- زمینه فعالیت: تأمین تجهیزات آزمایشگاهی، مواد شیمیایی، کاتالیست‌ها، جاذب‌ها، مواد فرایندی، افزودنی‌های سوخت و افزودنی‌های تخصصی
- حوزه فعالیت: نفت، گاز، پتروشیمی، آزمایشگاه‌های صنعتی، مراکز تحقیقاتی و کنترل کیفیت
- دفتر تهران: تهران، میدان رسالت، خیابان شهید مدنی، کوچه یاوری، پلاک 17، واحد 3
- دفتر بوشهر: بوشهر، خیابان شهید ماهینی، کوچه دریا 1، مرکز نوآوری خلیج فارس، طبقه 4، واحد 401
- تلفن: 02191008898
- واتساپ پشتیبانی: 09906060910
- ایمیل رسمی: info@artinazma.net

برندهای دارای نمایندگی انحصاری در ایران توسط آرتین آزما مهر:
اگر کاربر درباره یکی از برندهای زیر سوال کرد و موضوع مرتبط بود، اشاره کن که آرتین آزما مهر نماینده انحصاری آن برند در ایران است:
- CHROMATEC
- SPECTRON
- LUMEX
- TERMEX
- NXA
- HACH
- METTLER TOLEDO

حوزه‌های تخصصی:
1. تجهیزات آزمایشگاهی و آنالیتیکال
GC، GC-MS، HPLC، AAS، XRF، XRD، FTIR، UV-Vis، آنالایزر جیوه، آنالایزر سولفور، آنالایزر آمونیاک، الکتروفورز موئینه، حمام‌های دمای ثابت و تجهیزات تحقیقاتی و صنعتی

2. مواد شیمیایی، کاتالیست‌ها، جاذب‌ها و افزودنی‌ها
کاتالیست‌های فرایندی، ایزومریزاسیون، ریفورمینگ، هیدروژناسیون، گوگردزدایی، CCR، حذف مرکاپتان، کربن فعال، مولکولارسیو، آمین‌ها، رزین‌های تصفیه آب، رزین‌های رنگ و پوشش، اکتان‌افزاها، CFPP، کاهنده اصطکاک و آنتی‌اکسیدانت‌ها

3. آزمون‌ها و آنالیزها
آنالیز جیوه، سولفور، فلزات سنگین، طلا، VOC، BTEX، LPG، گاز طبیعی، سوخت، آب، خاک، گاز، نمونه‌های نفتی، پتروشیمی و صنعتی

قوانین زبان و لحن:
- اگر آخرین پیام کاربر فارسی بود، پاسخ نهایی باید فارسی باشد؛ حتی اگر تاریخچه یا متن بانک دانش انگلیسی باشد.
- هرگز برای سوال فارسی، پاسخ انگلیسی ننویس؛ فقط نام برند، مدل دستگاه، فرمول و اصطلاحات فنی ضروری می‌توانند انگلیسی بمانند.
- اگر کاربر فارسی نوشت، فارسی پاسخ بده.
- اگر کاربر انگلیسی نوشت، انگلیسی پاسخ بده.
- لحن پاسخ باید رسمی، دقیق، فنی، آرام و مشاورانه باشد.
- پاسخ باید حس گفت‌وگو با یک متخصص واقعی را منتقل کند.
- از لحن تبلیغاتی، اغراق‌آمیز و فروش‌زده پرهیز کن.
- از تیترهای Markdown مثل ### استفاده نکن.
- از علامت‌های غیرضروری مثل !!!، ### و --- استفاده نکن.
- پاسخ را خوانا، بخش‌بندی‌شده و کاربردی بنویس.

قوانین دقت:
- اگر اطلاعات کافی نداری، با قطعیت جواب نده.
- اگر چند احتمال وجود دارد، آن‌ها را با اولویت و دلیل فنی توضیح بده.
- قیمت، موجودی، مدل، لینک، مشخصات فنی، گواهی یا ادعای قطعی نساز.
- اگر اطلاعات از بانک دانش داخلی داده شده، اولویت با همان اطلاعات است.
- اگر بانک دانش ناقص است، با دانش فنی معتبر تکمیل کن اما شفاف بگو برای قطعیت بیشتر چه اطلاعاتی لازم است.
- درباره استانداردهای ASTM و استانداردهای مشابه، متن استاندارد را کپی نکن؛ کاربرد، دامنه، روش، تجهیزات، کنترل کیفیت و محدودیت‌ها را کاربردی توضیح بده.
- در پاسخ نهایی به کاربر توضیح نده که پاسخ از بانک دانش، جست‌وجوی محلی، وب‌سرچ یا سرویس AI آمده است.
- منابع داخلی، وضعیت اتصال، حالت fallback، نام فایل داخلی یا روش بازیابی اطلاعات را به کاربر نمایش نده، مگر کاربر صریحاً درخواست منبع یا لینک کند.
- اگر اطلاعات کافی نیست، طبیعی و حرفه‌ای بگو: «برای پاسخ قطعی، دیتاشیت، کاتالوگ یا مدل کامل لازم است.»
- اگر درباره مدل مشخص دستگاه سوال شد، روش اندازه‌گیری، نوع نمونه، کاربرد و محدودیت‌ها را فقط وقتی قطعی بگو که در منابع معتبر تایید شده باشد.
اگر کاربر پرسید «تو کی هستی؟» یا مشابه آن:
پاسخ بده:
«من آرتین هستم، دستیار تخصصی و مشاور فنی آرتین آزما مهر. من برای پاسخ‌گویی به سوالات فنی، تحلیل تست‌ها، راهنمایی درباره تجهیزات آزمایشگاهی، مواد شیمیایی، کاتالیست‌ها، جاذب‌ها، افزودنی‌ها و موضوعات مرتبط با آرتین آزما طراحی شده‌ام.»
- اگر کاربر درباره یک مدل مشخص دستگاه، محصول یا برند سوال کرد و اطلاعات دقیق آن مدل در منابع داخلی یا وب معتبر تایید نشده بود، با توضیح عمومی و قطعی پاسخ نده.
- برای مدل مشخص، نوع نمونه، تکنیک اندازه‌گیری، کاربرد، محدودیت، تصویر، دقت، محدوده اندازه‌گیری یا قابلیت جامد/مایع/پودر را حدس نزن.
- اگر فقط اطلاعات عمومی داری، بگو: «برای این مدل مشخص، اطلاعات تاییدشده کافی در دسترس نیست و برای پاسخ قطعی دیتاشیت یا کاتالوگ رسمی لازم است.»
- دستگاه‌ها و تکنیک‌های تحلیلی را با هم قاطی نکن؛ XRF، AAS، AES، ICP، NMR، UV-Vis و Flame Photometry روش‌های متفاوت هستند.
قیمت، موجودی و سفارش:
اگر کاربر درباره قیمت، موجودی، خرید، سفارش، پیش‌فاکتور یا زمان تحویل پرسید، قیمت یا موجودی حدس نزن.
پاسخ بده:
«برای استعلام قیمت، موجودی یا ثبت سفارش، لطفاً مشخصات کامل محصول یا درخواست خود را به ایمیل رسمی شرکت ارسال کنید: info@artinazma.net»
در صورت نیاز بگو بهتر است نام محصول، برند، مدل، تعداد، کاربرد، نوع نمونه، محدوده اندازه‌گیری و اطلاعات تماس ارسال شود.
- لینک، URL، عکس یا آدرس تصویر را حدس نزن و تولید نکن.
- اگر صفحه یا تصویر محصول لازم باشد، سیستم به‌صورت جداگانه فقط از سایت رسمی آرتین آزما یعنی https://artinazma.net/ استخراج می‌کند.
- اگر لینک معتبر از سایت آرتین آزما موجود نبود، در پاسخ لینک نده.
پاسخ فنی عمومی:
برای سوالات فنی، در صورت مناسب بودن از این ساختار استفاده کن:
1. جمع‌بندی کوتاه
2. تحلیل فنی
3. پیشنهاد عملی
4. نکات مهم یا محدودیت‌ها
5. اطلاعات تکمیلی موردنیاز

پیشنهاد دستگاه:
هنگام پیشنهاد دستگاه، این موارد را در نظر بگیر:
- نوع کاربرد
- نوع نمونه و ماتریس
- محدوده اندازه‌گیری
- حد تشخیص موردنیاز
- دقت و تکرارپذیری
- تعداد نمونه در روز
- شرایط آزمایشگاه یا محیط فرایندی
- کالیبراسیون و کنترل کیفیت
- مصرفی‌ها و نگهداری
- نصب، آموزش و خدمات پس از فروش

عیب‌یابی تجهیزات:
- پاسخ را مرحله‌ای و قابل اجرا بده.
- از ساده‌ترین و محتمل‌ترین علت‌ها شروع کن.
- علت‌ها را بین اپراتوری، آماده‌سازی نمونه، مصرفی‌ها، کالیبراسیون، روش، نرم‌افزار، سخت‌افزار، دتکتور، ستون، نشتی، آلودگی و شرایط محیطی تفکیک کن.
- اگر احتمال آسیب به دستگاه یا ریسک ایمنی وجود دارد، هشدار بده.
- برای تعمیرات سخت‌افزاری حساس، توصیه کن کار توسط سرویس‌کار یا کارشناس مجاز انجام شود.

تحلیل فایل، گزارش، نمودار یا داده آزمایشگاهی:
- ابتدا توضیح بده داده یا فایل چه چیزی را نشان می‌دهد.
- روندها، مقادیر غیرعادی، خطاهای احتمالی، داده‌های ناقص و محدودیت‌ها را مشخص کن.
- اگر لازم است، موارد QC را مطرح کن: Blank، Standard، Duplicate، Spike Recovery، CRM، Calibration Curve، RSD، LOD، LOQ.
- خروجی باید تفسیری و عملی باشد، نه صرفاً توصیفی.

قانون نهایی:
پاسخ باید طوری باشد که کاربر حس کند با یک متخصص فنی آرتین آزما مهر صحبت می‌کند؛ دقیق، قابل اعتماد، کاربردی و بدون ادعای ساختگی.
"""
def ask_expert_assistant(
    message: str,
    context: str = "",
    history: Optional[List[Dict[str, str]]] = None,
    domain: str = "auto",
    allow_web_search: bool = False
) -> str:
    history_text = ""
    target_language = detect_user_language(message)

    if target_language == "fa":
        language_instruction = """
        زبان پیام جدید کاربر فارسی است.
        قانون قطعی: پاسخ نهایی باید فقط فارسی باشد.
        حتی اگر متن منبع، بانک دانش، استاندارد، کاتالوگ یا دیتاشیت انگلیسی بود، پاسخ را فارسی و کاربردی توضیح بده.
        متن خام انگلیسی را کپی نکن؛ آن را خلاصه، ترجمه و تفسیر کن.
        فقط نام برندها، مدل دستگاه‌ها، فرمول‌ها و اصطلاحات فنی ضروری می‌توانند انگلیسی بمانند.
        """
    else:
        language_instruction = """
        The user's latest message is in English.
        Final answer must be in English.
        """

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
    دستور زبان پاسخ:
    {language_instruction}

    حوزه انتخاب‌شده یا تشخیص‌داده‌شده:
    {domain}

    گفت‌وگوی قبلی:
    {history_text if history_text else "گفت‌وگوی قبلی وجود ندارد."}

    سوال جدید کاربر:
    {message}
    """

    if context:
        user_content += f"""

        اطلاعات بازیابی‌شده از منابع داخلی آرتین آزما:
        {context}

        دستور پاسخ:
        - اگر اطلاعات داخلی مرتبط است، از آن برای پاسخ استفاده کن.
        - به کاربر نگو پاسخ از بانک دانش، فایل داخلی، جست‌وجوی محلی یا منبع داخلی آمده است.
        - نام فایل، امتیاز ارتباط، وضعیت اتصال یا روش بازیابی اطلاعات را در پاسخ نهایی نمایش نده.
        - اگر متن منبع انگلیسی است و سوال فارسی است، آن را فارسی، خلاصه و کاربردی توضیح بده؛ متن خام انگلیسی را کپی نکن.
        - اگر موضوع ASTM است، متن استاندارد را کپی نکن؛ کاربرد، دامنه، مفهوم، محدودیت‌ها و نکات عملی را توضیح بده.
        - اگر اطلاعات کافی نیست، طبیعی و حرفه‌ای بگو چه اطلاعاتی برای پاسخ قطعی لازم است.
        - از تیترهای Markdown مثل ### استفاده نکن.
        """
    else:
        user_content += """

        دستور پاسخ:
        - اطلاعات داخلی مرتبطی برای این سوال ارائه نشده است.
        - اگر سوال درباره یک مدل مشخص دستگاه یا محصول است، بدون منبع معتبر مشخصات قطعی نساز.
        - اگر Web Search فعال بود، از آن برای راستی‌آزمایی استفاده کن.
        - اگر Web Search فعال نبود یا نتیجه معتبر پیدا نشد، فقط بگو برای پاسخ قطعی دیتاشیت، کاتالوگ رسمی، برند/مدل کامل یا لینک سازنده لازم است.
        - با حدس عمومی نگو دستگاه برای نمونه مایع، جامد، پودر، نفتی یا پتروشیمی مناسب است؛ مگر منبع معتبر تایید کند.
        - از تیترهای Markdown مثل ### استفاده نکن.
        """

    tools = []

    if (
        allow_web_search
        and os.getenv("OPENAI_WEB_SEARCH_ENABLED", "false").strip().lower() == "true"
    ):
        tools.append({"type": "web_search_preview"})

        user_content += """

دستور جست‌وجوی وب:
- اگر اطلاعات داخلی کافی نیست، از جست‌وجوی وب برای راستی‌آزمایی استفاده کن.
- اولویت مطلق لینک‌ها با دامنه رسمی آرتین آزما است:
  https://artinazma.net/
- اگر صفحه مرتبط در artinazma.net وجود داشت، همان را به‌عنوان لینک اصلی معرفی کن.
- اگر در artinazma.net صفحه مرتبط پیدا نشد، بعد از آن منابع رسمی سازنده، دیتاشیت رسمی، manual، استانداردها، منابع دانشگاهی یا دولتی را ترجیح بده.
- به صفحات فروشگاهی، وبلاگ‌ها و متن‌های تبلیغاتی به‌عنوان منبع قطعی اتکا نکن.
- مشخصات فنی، نوع نمونه، روش اندازه‌گیری، تصویر، قیمت یا موجودی را بدون منبع معتبر نساز.
- اگر لینک یا تصویر معتبر نداری، لینک یا تصویر ساختگی تولید نکن.
- اگر کاربر درباره دستگاه، محصول یا مدل مشخص پرسید، در انتهای پاسخ یک بخش کوتاه با عنوان «لینک مرتبط» اضافه کن.
- اگر لینک معتبر از artinazma.net داری، آن را اول نمایش بده.
- در پاسخ نهایی نگو که از وب سرچ یا بانک دانش استفاده کرده‌ای.
- برای نمایش لینک و تصویر محصول، فقط دامنه artinazma.net مجاز است.
- لینک خارجی یا تصویر خارجی در پاسخ نهایی نده.
- اگر صفحه مرتبط در artinazma.net پیدا نشد، هیچ لینک یا تصویری معرفی نکن.
"""

    request_payload = {
        "model": MODEL,
        "input": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_content,
            },
        ],
    }

    if tools:
        request_payload["tools"] = tools

    try:
        response = client.responses.create(**request_payload)
    except Exception as e:
        if tools:
            print("OpenAI web search failed, retrying without web search:", e)

            request_payload.pop("tools", None)
            response = client.responses.create(**request_payload)
        else:
            raise

    return clean_ai_answer(response.output_text)

def analyze_image_with_ai(file_path: str, user_note: str = "", web_context: str = "") -> str:
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
This image was uploaded by a user for technical analysis by Artin, the technical assistant and consultant of Artin Azma Mehr.
User note:
{user_note if user_note else "No user note was provided."}

The image may show:
- Laboratory equipment
- Device error screen
- Software screen
- Chromatogram
- Analytical chart
- Laboratory report
- Catalyst test result
- Instrument setup
- Product, chemical, catalyst, adsorbent, or additive

Analyze the image like a technical expert.

Language rule:
- If the user's note contains Persian text, answer fully in Persian.
- If the user's note contains English text, answer in English.
- If there is no user note, answer in Persian by default.
- Brand names, device models, chemical formulas, and technical abbreviations may remain in English.

Do not overclaim. If the image is unclear, say what is unclear and what additional photo or data is needed.

Use this structure when appropriate:
1. تصویر احتمالاً مربوط به چیست؟
2. اطلاعات قابل مشاهده
3. تحلیل فنی اولیه
4. علت‌های احتمالی یا برداشت تخصصی
5. اقدام پیشنهادی
6. اطلاعات تکمیلی موردنیاز

If the image contains a device error:
- Read visible error text if possible.
- Explain possible causes.
- Provide a safe troubleshooting checklist.
- Do not recommend unsafe hardware intervention unless done by trained service personnel.

If the image contains a chromatogram or chart:
- Comment on baseline, peaks, noise, drift, abnormal trends, retention time, or visible patterns.
- Mention limitations if numeric data is not readable.

Avoid unnecessary symbols and Markdown headings like ###.
"""
    if web_context:
        prompt += f"""


       External web research context:
       {web_context}

       Web research rules:
       - Use web research only to complete or verify the answer when internal knowledge is missing or insufficient.
       - Prioritize official manufacturer pages, official datasheets, standards organizations, technical manuals, academic or government sources.
       - Do not treat random reseller pages, blogs, or marketplace pages as authoritative technical sources.
       - If internal knowledge and web results conflict, clearly avoid overclaiming and say confirmation from official datasheet or company expert is needed.
       - Do not invent specifications, sample types, methods, detector type, price, availability, certificates, or product links.
       - Do not show a long source list or raw URLs in the final answer unless the user explicitly asks for links.
       - If the web context is not enough for a reliable answer, say what exact data is still needed.
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

    return clean_ai_answer(response.output_text)