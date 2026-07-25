"""
لینک رسمی استانداردهای ASTM (سری D).

لینک صفحه‌ی هر استاندارد ASTM سری D به‌صورت قطعی از روی کد ساخته می‌شود:
    https://store.astm.org/standards/d<شماره>
(حروف کوچک، بدون صفرِ ابتدایی).

چرا این ماژول لازم است: مدل زبانی حتی با وب‌سرچ روشن هم URL را با الگوی غلط
بازتولید می‌کند (مثلاً www.astm.org/d0086 به‌جای store.astm.org/standards/d86).
پس لینک را به‌جای مدل، خودمان می‌سازیم. برای کدهایی که در دیکشنری داخلی نیستند،
با یک درخواست سبک بررسی می‌کنیم کد واقعی است یا نه تا لینکِ مرده به کاربر داده نشود.

نتیجه‌ی هر کد کش می‌شود؛ پس تأخیرِ بررسی فقط بار اولِ یک کدِ نو رخ می‌دهد. اگر
بررسی به هر دلیلی شکست بخورد (خطای شبکه، بلاک، تایم‌اوت)، None برمی‌گردد و
فراخوان باید لینک را با یک احتیاط نرم بدهد — نه اینکه پاسخ را بلاک کند.
"""

import os
import re
import logging
import threading

import requests

logger = logging.getLogger("artin_scheduler")

_STORE_URL = "https://store.astm.org/standards/{code}"
_TIMEOUT = float(os.getenv("ASTM_CHECK_TIMEOUT", "6"))
_UA = "Mozilla/5.0 (compatible; ArtinBot/1.0; +https://artinazma.net)"

# code(مثل "d445") -> bool  (True=موجود، False=ناموجود). موارد نامشخص کش نمی‌شوند.
_CACHE: dict[str, bool] = {}
_LOCK = threading.Lock()


# کدهای ASTM با پیشوندِ «ASTM» — هر سری (A/B/C/D/E/F/G…). چون کدِ لختِ غیر-D
# ریسک false-positive بالایی دارد (A4، B12، C4…)، سری‌های غیر-D فقط با پیشوند ASTM
# پذیرفته می‌شوند. کدِ لختِ D (مثل «D445») برای سازگاری با رفتار قبلی حفظ می‌شود.
_PREFIXED_RE = re.compile(r"ASTM\s*[-:]?\s*([A-Za-z])\s*0*(\d{1,5})", re.IGNORECASE)
_BARE_D_RE = re.compile(r"\bD\s*0*(\d{2,5})\b", re.IGNORECASE)


def _normalize(code: str) -> str:
    """'D 445'/'d0445' → 'd445'، 'A106'/'a 106' → 'a106' (سری حفظ می‌شود)."""
    m = re.match(r"\s*([A-Za-z])\s*0*(\d+)", code)
    if not m:
        return re.sub(r"\s+", "", code).lower()
    return f"{m.group(1).lower()}{int(m.group(2))}"


def extract_astm_codes(text: str) -> list[str]:
    """
    کدهای ASTM را از متن استخراج می‌کند و به شکل «A106»/«D445» برمی‌گرداند
    (حرف بزرگ + عدد بدون صفرِ ابتدایی)، بدون تکرار و به ترتیب ظهور.
    """
    text = text or ""
    codes: list[str] = []
    seen: set[str] = set()
    for series, num in _PREFIXED_RE.findall(text):
        code = f"{series.upper()}{int(num)}"
        if code not in seen:
            seen.add(code)
            codes.append(code)
    for num in _BARE_D_RE.findall(text):
        code = f"D{int(num)}"
        if code not in seen:
            seen.add(code)
            codes.append(code)
    return codes


def official_astm_url(code: str) -> str:
    """لینک رسمی صفحه‌ی استاندارد را از روی کد می‌سازد (بدون بررسی وجود)."""
    return _STORE_URL.format(code=_normalize(code))


def seed_valid(codes) -> None:
    """کدهایی که مطمئنیم واقعی‌اند (مثل دیکشنری داخلی) را از پیش معتبر علامت بزن."""
    with _LOCK:
        for c in codes:
            _CACHE[_normalize(c)] = True


def verify_astm_code(code: str):
    """
    آیا این کد یک استاندارد واقعی ASTM است؟
      True  → صفحه‌ی رسمی موجود است (HTTP 200)
      False → یافت نشد (HTTP 404)
      None  → نامشخص (خطای شبکه/بلاک/تایم‌اوت یا هر وضعیت دیگر) → لینک را با احتیاط بده
    نتیجه‌ی قطعی (True/False) کش می‌شود؛ نامشخص کش نمی‌شود تا بعداً دوباره تلاش شود.
    """
    key = _normalize(code)
    with _LOCK:
        if key in _CACHE:
            return _CACHE[key]

    result = None
    try:
        resp = requests.head(
            official_astm_url(code),
            headers={"User-Agent": _UA},
            timeout=_TIMEOUT,
            allow_redirects=True,
        )
        if resp.status_code == 200:
            result = True
        elif resp.status_code == 404:
            result = False
        else:
            logger.info("[ASTM] verify %s → HTTP %s (نامشخص)", key, resp.status_code)
    except Exception as e:  # noqa: BLE001
        logger.info("[ASTM] verify %s failed: %s (نامشخص)", key, e)

    if result is not None:
        with _LOCK:
            _CACHE[key] = result
    return result


_SOURCE_REQUEST_RE = re.compile(
    r"لینک|link|url|آدرس|دانلود|download|خرید|بخرم|تهیه|بگیرم|کجا",
    re.IGNORECASE,
)


def astm_link_tail(message: str, answer: str) -> str:
    """
    بلوکِ لینکِ رسمیِ ASTM را می‌سازد تا در انتهای پاسخ الحاق شود — فقط وقتی کاربر
    لینک/منبع/خرید یک استاندارد را خواسته و مدل خودش لینک را نداده باشد.

    چرا: URLِ رسمی ۱۰۰٪ از روی کد قطعی است (store.astm.org/standards/d<کد>)، ولی
    مدل گاهی دستورِ «این لینک را بده» را نادیده می‌گیرد و به امتناعِ کپی‌رایت
    برمی‌گردد. پس به‌جای تکیه به مدل، لینک را قطعی الحاق می‌کنیم.

    اگر پاسخ خالی باشد یا لینک قبلاً در آن آمده باشد، چیزی اضافه نمی‌شود.
    """
    if not _SOURCE_REQUEST_RE.search(message or ""):
        return ""

    codes = extract_astm_codes(message)
    if not codes:
        return ""

    answer_text = answer or ""
    lines: list[str] = []
    for code in codes:
        # کدِ قطعاً نامعتبر (۴۰۴) را الحاق نکن؛ خطای شبکه/نامشخص را لینک بده.
        if verify_astm_code(code) is False:
            continue
        url = official_astm_url(code)
        if url in answer_text:
            continue
        lines.append(f"- {code}: {url}")

    if not lines:
        return ""

    return (
        "\n\nلینک رسمی استاندارد (صفحهٔ خرید/مشاهدهٔ نسخهٔ به‌روز در ASTM):\n"
        + "\n".join(lines)
    )


def build_official_links(codes: list[str], known_codes: set[str]) -> str:
    """
    یک بلوک متن برای تزریق به context می‌سازد که لینک رسمی هر کد را می‌دهد و به
    مدل دستور می‌دهد فقط همین‌ها را بدهد. کدهای دیکشنری بدون بررسی معتبرند؛ بقیه
    با verify بررسی می‌شوند.
    """
    lines: list[str] = []
    for code in codes:
        url = official_astm_url(code)
        if code in known_codes:
            lines.append(f"• {code}: {url}")
            continue
        status = verify_astm_code(code)
        if status is True:
            lines.append(f"• {code}: {url}")
        elif status is False:
            lines.append(
                f"• {code}: این کد استاندارد معتبر ASTM یافت نشد؛ لینک نده و به کاربر بگو کد را بررسی کند."
            )
        else:
            lines.append(
                f"• {code}: {url} (اگر باز نشد، کد را در store.astm.org جستجو کنید)"
            )
    if not lines:
        return ""
    return (
        "لینک رسمی استاندارد(ها) — هنگام پاسخ مستقیم، کوتاه و با اطمینان فقط همین لینک(ها) را بده و "
        "هرگز URL دیگری از خودت نساز یا حدس نزن. هرگز ننویس که استاندارد «حق نشر/کپی‌رایت» دارد یا "
        "«نمی‌توانی لینک بدهی»، و هرگز کاربر را به «جست‌وجو در astm.org»، «site:astm.org» یا «به سایت "
        "ASTM برو و سرچ کن» ارجاع نده — لینک را داری، فقط همان را بده:\n" + "\n".join(lines)
    )
