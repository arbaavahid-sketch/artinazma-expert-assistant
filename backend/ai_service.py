from prompts import SYSTEM_PROMPT, IMAGE_ANALYSIS_PROMPT
from comparison_table_service import ensure_comparison_table
import logging
import os
import re
import io
import base64
import json as _json
import urllib.request
import urllib.error
import ssl
import socket as _socket
import http.client
import time
import threading
from typing import Optional, List, Dict, Tuple, Generator

import requests as _requests
from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, ImageOps

logger = logging.getLogger("ai_service")

load_dotenv()


# ─────────────────────────────────────────────
#  DNS over HTTPS — دور زدن DNS blocking ایران
#  بدون نیاز به VPN یا تنظیمات شبکه
# ─────────────────────────────────────────────

_DOH_CACHE: dict[str, str] = {}
_DOH_LOCK = threading.Lock()
_ORIGINAL_GETADDRINFO = _socket.getaddrinfo

# DoH providers با IP hardcode شده (بدون نیاز به DNS lookup خود سرور)
_DOH_PROVIDERS = [
    # Cloudflare
    ("1.1.1.1",   "cloudflare-dns.com", "/dns-query"),
    ("1.0.0.1",   "cloudflare-dns.com", "/dns-query"),
    # Google
    ("8.8.8.8",   "dns.google",         "/resolve"),
    ("8.8.4.4",   "dns.google",         "/resolve"),
]


class _DoHHTTPSConnection(http.client.HTTPSConnection):
    """
    به IP مستقیم وصل می‌شود (دور زدن DNS ایران) اما TLS را برای
    hostname واقعی verify می‌کند — بدون CERT_NONE.
    """
    def __init__(self, ip_addr: str, real_hostname: str, timeout: int = 5):
        super().__init__(ip_addr, timeout=timeout)
        self._real_hostname = real_hostname
        self._ssl_ctx = ssl.create_default_context()  # verify_mode=CERT_REQUIRED

    def connect(self):
        raw = _socket.create_connection(
            (self.host, self.port or 443),
            timeout=self.timeout,
        )
        self.sock = self._ssl_ctx.wrap_socket(
            raw,
            server_hostname=self._real_hostname,  # SNI + cert verification
        )


def _resolve_via_doh(hostname: str) -> str | None:
    """
    DNS hostname را از طریق DoH resolve می‌کند.
    به جای OS DNS از سرور DoH با IP ثابت استفاده می‌کند
    تا ISP نتواند بلاک کند. TLS کاملاً verify می‌شود.
    """
    with _DOH_LOCK:
        if hostname in _DOH_CACHE:
            return _DOH_CACHE[hostname]

    for server_ip, host_header, path in _DOH_PROVIDERS:
        try:
            conn = _DoHHTTPSConnection(server_ip, real_hostname=host_header, timeout=5)
            conn.request(
                "GET",
                f"{path}?name={hostname}&type=A",
                headers={
                    "Host": host_header,
                    "Accept": "application/dns-json",
                    "User-Agent": "Mozilla/5.0",
                },
            )
            resp = conn.getresponse()
            data = _json.loads(resp.read())
            conn.close()
            for answer in data.get("Answer", []):
                if answer.get("type") == 1:  # A record
                    ip = answer["data"]
                    with _DOH_LOCK:
                        _DOH_CACHE[hostname] = ip
                    logger.info(f"[DoH] ✓ {hostname} → {ip} (via {server_ip})")
                    return ip
        except Exception as e:
            logger.warning(f"[DoH] ✗ {server_ip} failed: {type(e).__name__}")
            continue

    return None


def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    """
    socket.getaddrinfo را برای دامنه‌های OpenAI override می‌کند
    تا از DoH به جای OS DNS استفاده شود.
    """
    if isinstance(host, str) and host.endswith("openai.com"):
        resolved = _resolve_via_doh(host)
        if resolved:
            return _ORIGINAL_GETADDRINFO(resolved, port, family, type, proto, flags)
    return _ORIGINAL_GETADDRINFO(host, port, family, type, proto, flags)


# اعمال patch هنگام load شدن module
_socket.getaddrinfo = _patched_getaddrinfo
logger.info("[DoH] DNS patch applied — OpenAI domains will resolve via DoH")


def _pick_proxy() -> str | None:
    """
    پروکسی مناسب برای اتصال به OpenAI رو انتخاب می‌کنه.
    اولویت: OPENAI_PROXY env > SOCKS5 سیستمی > HTTPS سیستمی
    SOCKS5 برای اتصال‌های رمزنگاری‌شده بهتر از HTTP proxy عمل می‌کنه.
    """
    # اجازه override دستی
    explicit = os.getenv("OPENAI_PROXY")
    if explicit:
        return explicit

    sys_proxies = urllib.request.getproxies()
    # ترجیح: all (SOCKS5) > socks5 > socks > https > http
    for key in ("all", "socks5", "socks", "https", "http"):
        val = sys_proxies.get(key)
        if val:
            return val
    return None


def _get_session() -> _requests.Session:
    """Session با پروکسی بهینه برای اتصال به OpenAI."""
    session = _requests.Session()
    proxy = _pick_proxy()
    if proxy:
        logger.info(f"[PROXY] using proxy: {proxy.split('@')[-1]}")  # بدون password
        session.proxies.update({"http": proxy, "https": proxy})
    return session


_session = _get_session()


def _make_client():
    import httpx
    base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_API_BASE")
    proxy = _pick_proxy()

    http_client = None
    if proxy:
        try:
            http_client = httpx.Client(proxy=proxy)
        except Exception as e:
            logger.warning(f"[PROXY] httpx client failed: {e}")

    kwargs = dict(
        api_key=os.getenv("OPENAI_API_KEY"),
        timeout=float(os.getenv("OPENAI_TIMEOUT", "120")),
        max_retries=2,
    )
    if base_url:
        kwargs["base_url"] = base_url
    if http_client:
        kwargs["http_client"] = http_client

    return OpenAI(**kwargs)


client = _make_client()

OPENAI_API_URL = (
    os.getenv("OPENAI_BASE_URL")
    or os.getenv("OPENAI_API_BASE")
    or "https://api.openai.com/v1"
).rstrip("/")


def _chat_via_requests(messages: list, model: str, temperature: float) -> str:
    key = os.getenv("OPENAI_API_KEY", "")
    body = {"model": model, "messages": messages, "temperature": temperature}
    _size = len(_json.dumps(body, ensure_ascii=False).encode("utf-8"))
    logger.info(f"[OPENAI] request body size: {_size} bytes ({_size//1024} KB)")

    url = f"{OPENAI_API_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    timeout = float(os.getenv("OPENAI_TIMEOUT", "120"))

    last_err = None
    for attempt in range(3):
        try:
            resp = _session.post(url, headers=headers, json=body, timeout=timeout)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"] or ""
        except (_requests.exceptions.ConnectionError,
                _requests.exceptions.ChunkedEncodingError) as e:
            last_err = e
            logger.warning(f"[OPENAI] attempt {attempt+1} failed: {e} — retrying…")
            time.sleep(1.5 * (attempt + 1))
        except Exception:
            raise

    raise last_err


MODEL = os.getenv("OPENAI_MODEL", "gpt-5.1")
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.2"))

# ─────────────────────────────────────────────
#  Cache پاسخ‌های تکراری (in-memory, TTL 24h)
# ─────────────────────────────────────────────
import hashlib as _hashlib

_RESPONSE_CACHE: dict[str, tuple[str, float]] = {}  # key → (answer, timestamp)
_CACHE_TTL_SECONDS = 60 * 60 * 24  # 24 ساعت
_CACHE_MAX_SIZE = 500               # حداکثر تعداد entry
_CACHE_LOCK = threading.Lock()


def _cache_key(message: str, context: str = "", domain: str = "") -> str:
    """کلید یکتا از ترکیب پیام + context مختصر + domain"""
    raw = f"{message.strip().lower()}|{domain}|{context[:200]}"
    return _hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> str | None:
    with _CACHE_LOCK:
        entry = _RESPONSE_CACHE.get(key)
        if entry:
            answer, ts = entry
            if time.time() - ts < _CACHE_TTL_SECONDS:
                return answer
            del _RESPONSE_CACHE[key]
    return None


def _cache_set(key: str, answer: str) -> None:
    with _CACHE_LOCK:
        # حذف قدیمی‌ترین entry اگر پر شد
        if len(_RESPONSE_CACHE) >= _CACHE_MAX_SIZE:
            oldest = min(_RESPONSE_CACHE, key=lambda k: _RESPONSE_CACHE[k][1])
            del _RESPONSE_CACHE[oldest]
        _RESPONSE_CACHE[key] = (answer, time.time())


def get_response_cache_stats() -> dict:
    """آمار cache پاسخ‌های آرتین (برای endpoint ادمین)."""
    with _CACHE_LOCK:
        now = time.time()
        entries = list(_RESPONSE_CACHE.values())
        valid = [e for e in entries if now - e[1] < _CACHE_TTL_SECONDS]
        oldest_ts = min((e[1] for e in valid), default=None)
        newest_ts = max((e[1] for e in valid), default=None)
    return {
        "size": len(valid),
        "max_size": _CACHE_MAX_SIZE,
        "ttl_hours": int(_CACHE_TTL_SECONDS / 3600),
        "fill_pct": round(len(valid) / _CACHE_MAX_SIZE * 100, 1),
        "oldest_entry_ago_min": round((now - oldest_ts) / 60, 1) if oldest_ts else None,
        "newest_entry_ago_min": round((now - newest_ts) / 60, 1) if newest_ts else None,
    }




def detect_user_language(text: str) -> str:
    """
    تشخیص سبک زبان:
    اگر متن شامل حروف فارسی/عربی باشد، فارسی در نظر گرفته می‌شود.
    """
    if not text:
        return "en"

    if re.search(r"[\u0600-\u06FF]", text):
        return "fa"

    return "en"


def normalize_text_for_classification(text: str) -> str:
    if not text:
        return ""

    normalized = text.lower()
    normalized = normalized.replace("ي", "ی").replace("ك", "ک")
    normalized = normalized.replace("‌", " ")
    normalized = re.sub(r"\s+", " ", normalized)

    return normalized.strip()


def classify_query_type(message: str) -> str:
    text = normalize_text_for_classification(message)

    comparison_keywords = [
        "تفاوت",
        "فرق",
        "مقایسه",
        "مقايسه",
        "بهتره",
        "بهتر است",
        "کدام بهتر",
        "کدوم بهتر",
        "انتخاب بین",
        "انتخاب ميان",
        "انتخاب میان",
        "xrf و icp",
        "xrf یا icp",
        "xrf يا icp",
        "gc و hplc",
        "gc یا hplc",
        "icp و aas",
        "icp یا aas",
        "icp-ms و icp-oes",
        "icp oes و icp ms",
    ]

    sales_keywords = [
        "قیمت",
        "موجودی",
        "خرید",
        "سفارش",
        "پیش فاکتور",
        "پیش‌فاکتور",
        "پيش فاکتور",
        "استعلام",
        "زمان تحویل",
        "زمان تحويل",
    ]

    troubleshooting_keywords = [
        "خطا",
        "ارور",
        "error",
        "نشتی",
        "روشن نمی",
        "روشن نمي",
        "خراب",
        "عیب",
        "عيب",
        "مشکل",
        "کالیبره نمی",
        "کالیبراسیون انجام نمی",
        "کار نمی کند",
        "کار نمیکند",
        "کار نمی‌کند",
        "noise",
        "drift",
        "baseline",
        "leak",
        "alarm",
    ]

    standard_keywords = [
        "astm",
        "iso",
        "epa",
        "استاندارد",
        "روش آزمون",
        "method",
        "روش تست",
        "test method",
    ]

    instrument_keywords = [
        "gc",
        "gc-ms",
        "hplc",
        "xrf",
        "xrd",
        "icp",
        "icp-oes",
        "icp-ms",
        "aas",
        "ftir",
        "uv-vis",
        "uv vis",
        "دستگاه",
        "مدل",
        "آنالایزر",
        "آنالیزر",
        "اسپکترو",
        "کروماتوگراف",
    ]

    data_analysis_keywords = [
        "نتیجه",
        "گزارش",
        "آنالیز",
        "تحلیل",
        "کروماتوگرام",
        "نمودار",
        "عدد",
        "ppm",
        "ppb",
        "mg/kg",
        "rsd",
        "recovery",
        "blank",
        "calibration curve",
    ]

    chemical_process_keywords = [
        "کاتالیست",
        "جاذب",
        "رزین",
        "افزودنی",
        "اکتان",
        "مولکولارسیو",
        "مولکولار سیو",
        "کربن فعال",
        "آمین",
        "گوگردزدایی",
        "مرکاپتان",
        "هیدروتریتینگ",
        "ریفورمینگ",
        "ایزومریزاسیون",
    ]

    if any(keyword in text for keyword in comparison_keywords):
        return "comparison"

    if any(keyword in text for keyword in sales_keywords):
        return "sales"

    if any(keyword in text for keyword in troubleshooting_keywords):
        return "troubleshooting"

    if any(keyword in text for keyword in standard_keywords):
        return "standard"

    if any(keyword in text for keyword in data_analysis_keywords):
        return "data_analysis"

    if any(keyword in text for keyword in chemical_process_keywords):
        return "chemical_process"

    if any(keyword in text for keyword in instrument_keywords):
        return "instrument"

    return "general"


def get_specialized_protocol(query_type: str) -> str:
    protocols = {
        "comparison": """
پروتکل مقایسه فنی بسیار حرفه‌ای:
- پاسخ باید شبیه گزارش کوتاه یک کارشناس ارشد آزمایشگاه یا مشاور فنی باشد، نه توضیح عمومی.
- ابتدا یک جمع‌بندی تصمیم‌ساز بده: کدام روش برای چه هدفی بهتر است.
- سپس تفاوت بنیادی روش‌ها را توضیح بده.
- اگر یک اصطلاح چند شاخه دارد، حتماً تفکیک کن؛ مثلاً ICP را به ICP-OES و ICP-MS تفکیک کن.
- مقایسه را فقط در حد مزایا/معایب ننویس؛ از دید عملیاتی مقایسه کن:
  اصل اندازه‌گیری، آماده‌سازی نمونه، نوع ماتریس، حد تشخیص نسبی، دقت، صحت، تداخل‌ها، QC، کالیبراسیون، سرعت، هزینه، مهارت اپراتور، مصرفی‌ها، نگهداری و مناسب بودن برای گزارش رسمی.
- برای نمونه نفتی حتماً این موارد را لحاظ کن:
  ویسکوزیته، همگن‌سازی، وجود آب، نمک، رسوب، آسفالتن، ذرات فلزی، رقیق‌سازی با حلال آلی، هضم اسیدی/مایکروویو، استانداردهای organometallic، اثر ماتریس و ریسک آلودگی.
- از عبارت‌های کلی مثل «XRF مناسب ماتریس پیچیده است» بدون توضیح پرهیز کن؛ دقیق بگو اثر ماتریس در هر روش چه مشکلی ایجاد می‌کند.
- اگر درباره نمونه نفتی است، عناصر مهم مثل Ni، V، Fe، Na، Ca، Mg، Zn، Pb، Cu و Cr را در صورت ارتباط توضیح بده.
- در پایان سناریوی انتخاب بده:
  چه زمانی XRF بهتر است؟
  چه زمانی ICP-OES بهتر است؟
  چه زمانی ICP-MS بهتر است؟
- اگر استاندارد یا عدد دقیق نداری، عدد و نام استاندارد نساز.
- خروجی باید تمیز، بخش‌بندی‌شده، کم‌فاصله و مناسب نمایش در UI راست‌چین باشد.
""",
        "sales": """
پروتکل فروش فنی:
- قیمت، موجودی و زمان تحویل نساز.
- ابتدا مشخص کن برای استعلام دقیق چه اطلاعاتی لازم است.
- پاسخ باید محترمانه، کوتاه، کاربردی و قابل ارسال به مشتری باشد.
- اگر منبع یا کانتکست معتبر تماس همراه درخواست وجود دارد، می‌توانی ایمیل رسمی را ذکر کنی؛ در غیر این صورت کاربر را به فرم درخواست یا اطلاعات تماس رسمی سایت هدایت کن.
- اطلاعات لازم را بخواه: نام محصول، برند، مدل، تعداد، کاربرد، نوع نمونه، محدوده اندازه‌گیری و اطلاعات تماس.
""",
        "troubleshooting": """
پروتکل عیب‌یابی:
- علت‌ها را از ساده‌ترین و محتمل‌ترین به پیچیده‌ترین مرتب کن.
- چک‌لیست مرحله‌ای بده.
- علت‌ها را تفکیک کن: اپراتوری، نمونه، آماده‌سازی، مصرفی، کالیبراسیون، روش، نرم‌افزار، سخت‌افزار، دتکتور، ستون، نشتی، آلودگی و شرایط محیطی.
- اگر خطر ایمنی یا آسیب دستگاه وجود دارد، هشدار بده.
- برای باز کردن قطعات حساس، تعمیرات برق، فشار بالا، گاز خطرناک، جیوه، منبع اشعه یا قطعات داغ توصیه کن کار توسط کارشناس مجاز انجام شود.
""",
        "standard": """
پروتکل استاندارد:
- پاسخ باید کامل، آموزشی و ساختارمند باشد.
- متن استاندارد را کپی نکن، اما مفهوم، دامنه کاربرد و روش را واضح توضیح بده.
- اگر استاندارد را می‌شناسی (از دانش آموزشی یا نتیجه جست‌وجوی وب)، آن را کامل و فنی توضیح بده — نیازی نیست از کاربر بخواهی عنوان را تأیید کند.
- فقط اگر واقعاً بعد از جست‌وجو هیچ اطلاعاتی پیدا نکردی، صادقانه بگو که متن رسمی در دسترس نیست و پیشنهاد بده از سایت ASTM تهیه شود.
- هرگز برای استانداردهای شناخته‌شده مانند ASTM D5453، D4294، D5454، D86 و مشابه، وانمود نکن که نمی‌دانی — این رفتار اعتماد کاربر را از بین می‌برد.
- در استانداردها حتماً این بخش‌ها را پوشش بده:
  1. استاندارد چیست؟
  2. کاربرد اصلی
  3. نمونه‌ها یا ماتریس‌های مناسب
  4. اصل روش یا منطق محاسبه
  5. تجهیزات یا داده‌های ورودی
  6. خروجی‌ها یا پارامترهای گزارش‌شونده
  7. کنترل کیفیت و کالیبراسیون
  8. محدودیت‌ها و خطاهای رایج
  9. ارتباط با استانداردهای دیگر
  10. کاربرد صنعتی
  11. نکته رسمی درباره نسخه استاندارد
  12. خلاصه نهایی
- اگر اجرای رسمی یا ممیزی مطرح است، حتماً بگو نسخه کامل و به‌روز استاندارد باید از مرجع رسمی تهیه و بررسی شود.""",
        "instrument": """
پروتکل دستگاه:
- دسته دستگاه، کاربرد، اصل اندازه‌گیری، نوع نمونه، مزیت، محدودیت و نکات انتخاب را توضیح بده.
- مشخصات عددی و شرایط آزمون مثل زمان، دما، دبی، فشار، حد پذیرش، LOD/LOQ یا rating فقط با منبع معتبر یا داده ارائه‌شده گفته شود؛ اگر منبع نداری، عدد نساز و بگو آخرین نسخه استاندارد/دیتاشیت باید بررسی شود.
- اگر مدل کامل نیست، برای قطعیت مدل کامل و دیتاشیت را درخواست کن.
- اگر دستگاه با مواد خطرناک، منبع اشعه، گاز، فشار یا دمای بالا مرتبط است، هشدار ایمنی بده.
""",
        "data_analysis": """
پروتکل تحلیل داده:
- مشخص کن داده چه چیزی را نشان می‌دهد.
- مقادیر مهم، واحدها، روندها و نقاط غیرعادی را جدا کن.
- اگر امکان محاسبه هست، محاسبه ساده و شفاف انجام بده.
- QC، تکرارپذیری، خطای احتمالی، drift، blank، standard، duplicate، spike recovery، CRM و calibration را بررسی کن.
- اگر کروماتوگرام است، baseline، noise، peak shape، retention time، resolution، peak area، tailing/fronting و co-elution را بررسی کن.
""",
        "chemical_process": """
پروتکل مواد و فرایند:
- کاربرد ماده، مکانیزم عملکرد، شرایط عملیاتی، محدودیت، سازگاری، ریسک ایمنی و معیار انتخاب را بررسی کن.
- برای کاتالیست، جاذب، رزین یا افزودنی، ادعای عملکرد عددی بدون دیتاشیت نساز.
- اگر موضوع صنعتی است، اثر روی فرایند، خوراک، محصول، خوردگی، کاتالیست، آلودگی و ایمنی را در نظر بگیر.
""",
        "general": """
پروتکل عمومی:
- پاسخ را فنی، دقیق، ساختارمند و قابل اجرا بنویس.
- اگر داده ناقص است، برداشت فنی بده و اطلاعات لازم برای قطعیت را مشخص کن.
""",
    }

    return protocols.get(query_type, protocols["general"])


def clean_ai_answer(text: str) -> str:
    if not text:
        return ""

    cleaned = text

    replacements = {
        "هوش مصنوعی سایت": "آرتین",
        "چت‌بات": "دستیار تخصصی",
        "ربات": "دستیار تخصصی",
        "AI assistant of Artin Azma Mehr": "technical assistant and consultant of Artin Azma Mehr",
        "artificial intelligence assistant": "technical assistant",
        "As an AI": "",
        "as an AI": "",
        "به عنوان یک هوش مصنوعی": "",
        "من یک هوش مصنوعی هستم": "",
    }

    for old, new in replacements.items():
        cleaned = cleaned.replace(old, new)

    # نرمال‌سازی خط‌ها
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")

    # حذف تیترهای Markdown سنگین

    # حذف جداکننده Markdown
    cleaned = re.sub(r"\n\s*---+\s*\n", "\n", cleaned)

    # حذف بولد Markdown

    # یکدست‌سازی بولت‌ها
    cleaned = re.sub(r"^\s*[-*]\s+", "• ", cleaned, flags=re.MULTILINE)

    # حذف فاصله‌های زیاد قبل و بعد از تیترها
    cleaned = re.sub(r"\n{2,}([^\n:]{2,45}:)\n{2,}", r"\n\n\1\n", cleaned)

    # حذف چند خط خالی پشت سر هم
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    # حذف فاصله اول/آخر خطوط
    cleaned = "\n".join(line.strip() for line in cleaned.split("\n"))

    # حذف فاصله‌های تکراری داخل خط
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)

    # حذف tracking از URLها
    tracking_params = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
    ]

    for param in tracking_params:
        cleaned = re.sub(rf"([?&]){param}=[^)\s&]+&?", r"\1", cleaned)

    cleaned = cleaned.replace("?&", "?")
    cleaned = re.sub(r"\?(\)|\s|$)", r"\1", cleaned)
    cleaned = re.sub(r"&(\)|\s|$)", r"\1", cleaned)

    return cleaned.strip()


def build_history_text(history: Optional[List[Dict[str, str]]]) -> str:
    if not history:
        return "گفت‌وگوی قبلی وجود ندارد."

    history_parts = []

    for item in history[-8:]:
        role = item.get("role", "")
        content = item.get("content", "")

        if role and content:
            label = "کاربر" if role == "user" else "دستیار"
            history_parts.append(f"{label}: {content}")

    if not history_parts:
        return "گفت‌وگوی قبلی وجود ندارد."

    return "\n".join(history_parts)


_MAX_CONTEXT_CHARS = 6_000   # hard cap on knowledge-base context injected into prompt
_MAX_HISTORY_CHARS = 400     # max chars per history turn (user/assistant) in the message list


def build_user_content(
    message: str,
    context: str = "",
    history: Optional[List[Dict[str, str]]] = None,
    domain: str = "auto",
    allow_web_search: bool = False,
) -> str:
    target_language = detect_user_language(message)
    query_type = classify_query_type(message)
    specialized_protocol = get_specialized_protocol(query_type)
    # History is passed as actual message objects by callers — no need to embed
    # it again as text here, which would cause double-sending of every turn.
    history_text = "گفت‌وگوی قبلی توسط سیستم مدیریت می‌شود."

    if target_language == "fa":
        language_instruction = """
زبان پیام جدید کاربر فارسی است.
پاسخ نهایی باید فقط فارسی، فنی، کاربردی، روان و قابل استفاده برای کارشناس باشد.
متن انگلیسی منابع را ترجمه، خلاصه و تفسیر کن.
فقط نام برند، مدل، استاندارد، روش آزمون، فرمول و اصطلاحات ضروری می‌توانند انگلیسی بمانند.
"""
    else:
        language_instruction = """
The user's latest message is in English.
Final answer must be in English, technical, practical, precise, and decision-oriented.
"""

    content = f"""
دستور زبان:
{language_instruction}

حوزه انتخاب‌شده یا تشخیص‌داده‌شده:
{domain}

نوع سؤال تشخیص‌داده‌شده:
{query_type}

پروتکل تخصصی این سؤال:
{specialized_protocol}

گفت‌وگوی قبلی:
{history_text}

سؤال جدید کاربر:
{message}

پروتکل عمومی پاسخ:
- نیت واقعی کاربر را تشخیص بده؛ فقط به ظاهر سؤال اکتفا نکن.
- پاسخ را تصمیم‌ساز، فنی و قابل اجرا بنویس.
- اگر سؤال مقایسه‌ای است، پاسخ باید فراتر از مزایا و معایب ساده باشد.
- اگر داده ناقص است، ابتدا برداشت فنی معتبر بده، سپس اطلاعات لازم برای قطعیت را مشخص کن.
- عدد، مشخصه فنی، قیمت، موجودی، استاندارد یا قابلیت نساز.
- اگر چند احتمال وجود دارد، آن‌ها را با اولویت و دلیل فنی بنویس.
- اگر موضوع ایمنی دارد، هشدار ایمنی لازم را اضافه کن.
- پاسخ را نه خیلی کوتاه و مبهم بنویس، نه طولانی و پراکنده.
- از تیترهای Markdown سنگین مثل ### استفاده نکن، اما استفاده از تیترهای ساده، بولت و بخش‌بندی منظم مجاز است.

قانون ظاهر و فرمت پاسخ:
- پاسخ را برای نمایش در چت وب‌سایت بنویس، نه برای مقاله طولانی.
- از فاصله‌های زیاد بین بخش‌ها استفاده نکن.
- هر تیتر باید کوتاه، واضح و حرفه‌ای باشد.
- از جدول Markdown فقط وقتی استفاده کن که واقعاً مقایسه را خواناتر می‌کند.
- برای مقایسه‌ها از این ساختار استفاده کن:
  1. جمع‌بندی کاربردی
  2. تفاوت بنیادی
  3. مقایسه فنی و عملیاتی
  4. محدودیت‌ها و خطاهای رایج
  5. سناریوی انتخاب
  6. اطلاعات لازم برای تصمیم قطعی
- بولت‌ها کوتاه، فنی و قابل خواندن باشند.
- هر پاراگراف بیشتر از ۳ تا ۴ خط نباشد.
- خروجی باید تمیز، کم‌فاصله، حرفه‌ای و مناسب نمایش RTL باشد.
"""

    if context:
        # Truncate to prevent oversized requests
        if len(context) > _MAX_CONTEXT_CHARS:
            context = context[:_MAX_CONTEXT_CHARS] + "\n... [ادامه متن کوتاه شد]"
        content += f"""

اطلاعات مرتبط قابل استفاده:
{context}

دستور استفاده از اطلاعات:
- اگر اطلاعات بالا مرتبط است، آن را مبنای پاسخ قرار بده.
- نام منبع داخلی، فایل، بانک دانش، امتیاز بازیابی، وضعیت اتصال یا روش جست‌وجو را به کاربر نگو.
- اگر متن منبع انگلیسی است و کاربر فارسی نوشته، آن را فارسی، خلاصه و کاربردی توضیح بده.
- اگر اطلاعات بالا شامل نتیجه سایت رسمی آرتین آزما است، آن را مرتبط فرض کن و پاسخ را کامل‌تر بده.
- اگر لینک آرتین آزما در متن وجود دارد، لینک خام را تکرار نکن.
- اگر اطلاعات دقیق کافی نیست، پاسخ فنی بده اما قطعیت را بیش از حد نشان نده.
"""
    else:
        content += """

اطلاعات داخلی مرتبطی ارائه نشده است.
دستور بسیار مهم:
- نبود اطلاعات داخلی به معنی ناتوانی در پاسخ نیست.
- اگر سؤال فنی عمومی، مقایسه‌ای، آموزشی، عیب‌یابی یا انتخاب روش است، حتماً با دانش تخصصی عمومی پاسخ کامل و تصمیم‌ساز بده.
- هرگز به کاربر نگو برای پاسخ تحلیلی کامل باید منبع داخلی پردازش شود، مگر اینکه سؤال درباره یک فایل، کاتالوگ، مدل اختصاصی یا داده‌ای باشد که واقعاً در اختیار نداری.
- برای سؤال‌هایی مثل تفاوت XRF و ICP، GC و HPLC، ICP-OES و ICP-MS، XRD و XRF، پاسخ باید کامل، فنی و کاربردی باشد حتی بدون context.
- اگر مدل، دیتاشیت، استاندارد یا عدد دقیق لازم است، فقط همان بخش را مشروط کن؛ کل پاسخ را متوقف نکن.
- برای قطعیت بیشتر، اطلاعات لازم مثل نوع نمونه، عناصر هدف، محدوده غلظت، حد تشخیص، استاندارد موردنیاز و تعداد نمونه در روز را در پایان بگو.
"""

    if allow_web_search:
        content += """

دستور جست‌وجوی وب:
- فقط برای راستی‌آزمایی فنی یا تکمیل اطلاعات ناقص استفاده کن.
- اولویت اول با سایت آرتین آزما است.
- اگر صفحه مرتبط آرتین آزما وجود داشت، لینک خارجی غیرضروری نده.
- اگر منبع خارجی لازم شد، فقط از سایت رسمی سازنده، manual، دیتاشیت، ASTM، ISO، EPA، منابع دانشگاهی، دولتی یا مقاله علمی معتبر استفاده کن.
- صفحات فروشگاهی، marketplace و وبلاگ تبلیغاتی را به‌عنوان منبع قطعی معرفی نکن.
- مشخصات فنی، قیمت، موجودی، تصویر یا قابلیت را بدون منبع معتبر نساز.
- لینک‌های trackingدار مثل utm_source را حذف کن.
- در پاسخ نهایی نگو که از وب‌سرچ یا بانک دانش استفاده شده است.
"""

    return content.strip()


def ask_expert_assistant(
    message: str,
    context: str = "",
    history: Optional[List[Dict[str, str]]] = None,
    domain: str = "auto",
    allow_web_search: bool = False,
    customer_context: str = "",
) -> str:
    history = history or []

    # ── Cache check (فقط برای سوالات بدون history و بدون web_search) ──
    _use_cache = not history and not allow_web_search and not customer_context
    _ck = _cache_key(message, context, domain) if _use_cache else ""
    if _use_cache:
        _cached = _cache_get(_ck)
        if _cached:
            logger.info(f"[Cache] HIT for: {message[:60]}")
            return _cached

    # Use the full build_user_content pipeline (language detection,
    # query classification, specialised protocol, formatting rules).
    user_content = build_user_content(
        message=message,
        context=context,
        history=history,
        domain=domain,
        allow_web_search=allow_web_search,
    )

    system_content = SYSTEM_PROMPT
    if customer_context:
        system_content = SYSTEM_PROMPT + "\n\n" + customer_context

    input_messages = [
        {
            "role": "system",
            "content": system_content,
        }
    ]

    for item in history[-6:]:
        role = item.get("role")
        content = item.get("content", "") or ""

        if role in ["user", "assistant"] and content:
            # Truncate long turns (especially assistant answers) to save tokens
            if len(content) > _MAX_HISTORY_CHARS:
                content = content[:_MAX_HISTORY_CHARS] + "…"
            input_messages.append({"role": role, "content": content})

    input_messages.append({"role": "user", "content": user_content})

    kwargs = {
        "model": MODEL,
        "messages": input_messages,
        "temperature": OPENAI_TEMPERATURE,
    }

    _answer = _chat_via_requests(
        messages=kwargs["messages"],
        model=kwargs["model"],
        temperature=kwargs["temperature"],
    ).strip()

    # شبکه‌ی ایمنی: اگر سؤال مقایسه‌ای بود و مدل جدول نساخت، یک جدول قطعی درج کن.
    _answer = ensure_comparison_table(message, _answer)

    if _use_cache and _answer:
        _cache_set(_ck, _answer)

    return _answer


def ask_expert_assistant_stream(
    message: str,
    context: str = "",
    history: Optional[List[Dict[str, str]]] = None,
    domain: str = "auto",
    allow_web_search: bool = False,
    customer_context: str = "",
) -> Generator[str, None, None]:
    history = history or []

    user_content = build_user_content(
        message=message,
        context=context,
        history=history,
        domain=domain,
        allow_web_search=allow_web_search,
    )

    system_content = SYSTEM_PROMPT
    if customer_context:
        system_content = SYSTEM_PROMPT + "\n\n" + customer_context

    input_messages = [{"role": "system", "content": system_content}]

    for item in history[-6:]:
        role = item.get("role")
        item_content = item.get("content", "") or ""
        if role in ["user", "assistant"] and item_content:
            if len(item_content) > _MAX_HISTORY_CHARS:
                item_content = item_content[:_MAX_HISTORY_CHARS] + "…"
            input_messages.append({"role": role, "content": item_content})

    input_messages.append({"role": "user", "content": user_content})

    kwargs: Dict = {
        "model": MODEL,
        "messages": input_messages,
        "temperature": OPENAI_TEMPERATURE,
        "stream": True,
    }

    text = _chat_via_requests(
        messages=kwargs["messages"],
        model=kwargs["model"],
        temperature=kwargs["temperature"],
    )
    # شبکه‌ی ایمنی: اگر سؤال مقایسه‌ای بود و مدل جدول نساخت، یک جدول قطعی درج کن.
    text = ensure_comparison_table(message, text)
    chunk_size = 40
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]


def prepare_image_for_ai(file_path: str) -> Tuple[str, str]:
    """
    تصویر را کوچک و فشرده می‌کند تا درخواست Vision سنگین نشود.
    خروجی: base64 و mime_type
    """
    with Image.open(file_path) as image:
        image = ImageOps.exif_transpose(image)

        if image.mode not in ["RGB", "L"]:
            image = image.convert("RGB")

        image.thumbnail((400, 400))

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=30, optimize=True)

        encoded_image = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return encoded_image, "image/jpeg"




_ocr_reader = None
_ocr_reader_lock = __import__("threading").Lock()


def _get_ocr_reader():
    """OCR reader رو یه بار لود می‌کنه و cache می‌کنه (thread-safe)."""
    global _ocr_reader
    if _ocr_reader is not None:
        return _ocr_reader
    with _ocr_reader_lock:
        if _ocr_reader is None:  # double-check after lock
            import easyocr
            logger.info("[OCR] loading easyocr reader for the first time…")
            _ocr_reader = easyocr.Reader(["en", "fa"], gpu=False, verbose=False)
            logger.info("[OCR] reader ready and cached.")
    return _ocr_reader


def _ocr_extract_text(file_path: str) -> str:
    """Extract text from image using easyocr (cached reader, no network needed)."""
    try:
        reader = _get_ocr_reader()
        logger.info("[OCR] running readtext...")
        results = reader.readtext(file_path, detail=0, paragraph=True)
        text = "\n".join(results).strip()
        logger.info(f"[OCR] extracted {len(text)} chars")
        return text
    except Exception as e:
        logger.warning(f"[OCR] failed: {e}")
        return ""


def analyze_image_with_ai(
    file_path: str, user_note: str = "", web_context: str = ""
) -> str:
    import base64 as _b64
    import mimetypes as _mime

    # Step 1: encode image as base64 for vision API
    mime_type = _mime.guess_type(file_path)[0] or "image/jpeg"
    try:
        with open(file_path, "rb") as f:
            image_b64 = _b64.b64encode(f.read()).decode("utf-8")
        image_data_url = f"data:{mime_type};base64,{image_b64}"
        has_image = True
    except Exception as e:
        logger.warning(f"[VISION] failed to read image file: {e}")
        has_image = False

    # Step 2: optionally run OCR as supplementary context
    ocr_text = _ocr_extract_text(file_path)

    prompt_text = IMAGE_ANALYSIS_PROMPT.format(
        user_note=user_note if user_note else "توضیحی ارائه نشده است."
    )

    if ocr_text:
        prompt_text += f"""

متن استخراج‌شده از تصویر (OCR — برای اطمینان):
---
{ocr_text}
---
"""

    if web_context:
        prompt_text += f"""

زمینه تکمیلی قابل استفاده:
{web_context}

دستور:
- اگر زمینه تکمیلی مرتبط است، از آن برای تفسیر دقیق‌تر استفاده کن.
- به کاربر نگو این زمینه از کجا آمده است.
"""

    # Step 3: send image + text to OpenAI vision
    if has_image:
        user_content = [
            {"type": "text", "text": prompt_text},
            {
                "type": "image_url",
                "image_url": {"url": image_data_url, "detail": "high"},
            },
        ]
    else:
        # fallback: text-only if image couldn't be read
        user_content = prompt_text

    return _chat_via_requests(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        model=MODEL,
        temperature=OPENAI_TEMPERATURE,
    )
