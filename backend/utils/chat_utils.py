import logging
import os
import re
import threading
import hashlib
import time as _time
from collections import OrderedDict

# ─── Score thresholds (single place to change) ──────────────────────────────
logger = logging.getLogger("utils.chat_utils")

_LOCAL_SCORE_THRESHOLD = 10      # local search score >= this → use local
_MODEL_LOCAL_SCORE_THRESHOLD = 8 # model question: exact local match threshold
_WEAK_CONTEXT_THRESHOLD = 14     # below this → discard internal context for tech intents

# ─── Upload limits ───────────────────────────────────────────────────────────
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB
_ALLOWED_FILE_EXTS = {"xlsx", "xls", "csv", "pdf", "txt"}
_ALLOWED_IMAGE_EXTS = {"jpg", "jpeg", "png", "webp"}

_TECHNICAL_INTENTS = {
    "technical_general",
    "equipment_recommendation",
    "troubleshooting",
    "lab_analysis",
}

# ─── دیکشنری استانداردهای ASTM/ISO شناخته‌شده ───────────────────────────────
_ASTM_KNOWN_STANDARDS: dict[str, str] = {
    # ── گوگرد ──
    "D4294":  "ASTM D4294 — Standard Test Method for Sulfur in Petroleum and Petroleum Products by Energy-Dispersive X-ray Fluorescence Spectrometry",
    "D2622":  "ASTM D2622 — Standard Test Method for Sulfur in Petroleum Products by Wavelength-Dispersive X-ray Fluorescence Spectrometry",
    "D5453":  "ASTM D5453 — Standard Test Method for Determination of Total Sulfur in Light Hydrocarbons, Spark Ignition Engine Fuel, Diesel Engine Fuel, and Engine Oil by Ultraviolet Fluorescence",
    "D7039":  "ASTM D7039 — Standard Test Method for Sulfur in Gasoline, Diesel Fuel, Jet Fuel, Kerosine, Biodiesel, Biodiesel Blends, and Related Products by Monochromatic Wavelength Dispersive X-ray Fluorescence Spectrometry",
    "D1266":  "ASTM D1266 — Standard Test Method for Sulfur in Petroleum Products (Lamp Method)",
    "D1552":  "ASTM D1552 — Standard Test Method for Sulfur in Petroleum Products by High-Temperature Combustion and Infrared (IR) Detection or Thermal Conductivity Detection (TCD)",
    # ── رطوبت و آب ──
    "D5454":  "ASTM D5454 — Standard Test Method for Water Vapor Content of Gaseous Fuels Using Electronic Moisture Analyzers (اندازه‌گیری بخار آب در سوخت‌های گازی با آنالایزر الکترونیکی رطوبت)",
    "D95":    "ASTM D95 — Standard Test Method for Water in Petroleum Products and Bituminous Materials by Distillation",
    "D6304":  "ASTM D6304 — Standard Test Method for Determination of Water in Petroleum Products, Lubricating Oils, and Additives by Coulometric Karl Fischer Titration",
    "D1744":  "ASTM D1744 — Standard Test Method for Determination of Water in Liquid Petroleum Products by Karl Fischer Reagent",
    # ── تقطیر و خواص فیزیکی ──
    "D86":    "ASTM D86 — Standard Test Method for Distillation of Petroleum Products and Liquid Fuels at Atmospheric Pressure",
    "D1160":  "ASTM D1160 — Standard Test Method for Distillation of Petroleum Products at Reduced Pressure",
    "D7169":  "ASTM D7169 — Standard Test Method for Boiling Point Distribution of Samples with Residues Such as Crude Oils and Atmospheric and Vacuum Residues by High Temperature Gas Chromatography",
    "D445":   "ASTM D445 — Standard Test Method for Kinematic Viscosity of Transparent and Opaque Liquids",
    "D7042":  "ASTM D7042 — Standard Test Method for Dynamic Viscosity and Density of Liquids by Stabinger Viscometer",
    "D1298":  "ASTM D1298 — Standard Test Method for Density, Relative Density, or API Gravity of Crude Petroleum and Liquid Petroleum Products by Hydrometer Method",
    "D4052":  "ASTM D4052 — Standard Test Method for Density, Relative Density, and API Gravity of Liquids by Digital Density Meter",
    "D97":    "ASTM D97 — Standard Test Method for Pour Point of Petroleum Products",
    "D2500":  "ASTM D2500 — Standard Test Method for Cloud Point of Petroleum Products and Liquid Fuels",
    "D93":    "ASTM D93 — Standard Test Methods for Flash Point by Pensky-Martens Closed Cup Tester",
    "D56":    "ASTM D56 — Standard Test Method for Flash Point by Tag Closed Cup Tester",
    # ── اکتان و سوخت ──
    "D2699":  "ASTM D2699 — Standard Test Method for Research Octane Number of Spark-Ignition Engine Fuel",
    "D2700":  "ASTM D2700 — Standard Test Method for Motor Octane Number of Spark-Ignition Engine Fuel",
    "D4737":  "ASTM D4737 — Standard Test Method for Calculated Cetane Index by Four Variable Equation",
    "D613":   "ASTM D613 — Standard Test Method for Cetane Number of Diesel Fuel Oil",
    # ── جیوه ──
    "D5765":  "ASTM D5765 — Standard Test Method for Total Mercury in Crude Petroleum and Residual Fuel Oil",
    "D6350":  "ASTM D6350 — Standard Test Method for Mercury Sampling and Analysis in Natural Gas by Atomic Fluorescence Spectroscopy",
    # ── فلزات ──
    "D5185":  "ASTM D5185 — Standard Test Method for Multielement Determination of Used and Unused Lubricating Oils and Base Oils by Inductively Coupled Plasma Atomic Emission Spectrometry (ICP-AES)",
    "D7111":  "ASTM D7111 — Standard Test Method for Determination of Trace Elements in Middle Distillate Fuels by Inductively Coupled Plasma Atomic Emission Spectrometry (ICP-AES)",
    # ── کربن و باقیمانده ──
    "D4530":  "ASTM D4530 — Standard Test Method for Determination of Carbon Residue (Micro Method)",
    "D524":   "ASTM D524 — Standard Test Method for Ramsbottom Carbon Residue of Petroleum Products",
    # ── خوردگی ──
    "D130":   "ASTM D130 — Standard Test Method for Corrosiveness to Copper from Petroleum Products by Copper Strip Test",
    # ── گاز طبیعی ──
    "D1945":  "ASTM D1945 — Standard Test Method for Analysis of Natural Gas by Gas Chromatography",
    "D1946":  "ASTM D1946 — Standard Practice for Analysis of Reformed Gas by Gas Chromatography",
}


def make_safe_filename(filename: str) -> str:
    base_name = os.path.basename(filename or "uploaded_file")
    safe_name = base_name.replace(" ", "_")
    safe_name = re.sub(r"[^A-Za-z0-9_\-.؀-ۿ]", "_", safe_name)
    if not safe_name or safe_name in [".", ".."]:
        safe_name = "uploaded_file"
    return safe_name


def is_specific_product_or_model_question(message: str) -> bool:
    text = (message or "").lower()
    latin_tokens = re.findall(r"\b[A-Za-z][A-Za-z0-9\-]{1,}\b", message or "")
    if not latin_tokens:
        return False

    known_technical_terms = {
        "xrf", "edxrf", "wdxrf", "xrd", "icp", "icp-oes", "icp-ms", "aas",
        "gc", "gc-ms", "gcms", "hplc", "lc", "ftir", "uv", "uv-vis", "uvvis",
        "nmr", "ms", "fid", "tcd", "ecd", "fpd", "scd", "bet", "tpr", "tpd",
        "sem", "tem", "astm", "iso", "epa", "en", "api", "nace", "btex", "voc",
        "h2s", "cos", "cs2", "lod", "loq", "rsd", "qc", "crm", "tan", "tbn",
        "cfpp",
    }

    normalized_tokens = {token.strip().lower() for token in latin_tokens if token.strip()}

    if normalized_tokens and all(token in known_technical_terms for token in normalized_tokens):
        return False

    model_keywords = [
        "مدل", "دستگاه", "آنالایزر", "مشخصات", "دیتاشیت", "کاتالوگ",
        "manual", "datasheet", "catalog", "model", "device", "instrument",
        "analyzer", "part number", "serial",
    ]

    if not any(keyword in text for keyword in model_keywords):
        return False

    has_model_like_token = any(
        (re.search(r"\d", token) or "-" in token or len(token) >= 6)
        and token.lower() not in known_technical_terms
        for token in normalized_tokens
    )

    return has_model_like_token


def context_has_exact_model_match(message: str, docs: list) -> bool:
    model_tokens = re.findall(
        r"[A-Za-z][A-Za-z0-9\-]{2,}(?:\s+[A-Za-z0-9\-]{2,})?", message or ""
    )
    if not model_tokens:
        return False

    searchable_context = " ".join(
        f"{doc.get('title', '')} {doc.get('file_name', '')} {doc.get('content', '')}"
        for doc in docs
    ).lower()

    for token in model_tokens:
        clean_token = token.strip().lower()
        if clean_token and clean_token in searchable_context:
            return True

    return False


def is_artinazma_related_question(message: str) -> bool:
    text = (message or "").lower()
    keywords = [
        "آرتین آزما", "ارتین ازما", "آرتین‌آزما", "artinazma", "artin azma",
        "سایت شما", "سایتتون", "وبسایت شما", "شرکت شما", "نمایندگی شما",
        "محصولات شما", "تو سایت شما", "در سایت شما", "آیا شما", "شما دارید",
        "شما تامین", "از شما بخرم", "خرید از شما", "استعلام قیمت", "قیمت",
        "موجودی", "پیش فاکتور", "پیش‌فاکتور", "سفارش", "تماس", "شماره تماس",
        "ایمیل", "واتساپ", "آدرس", "دفتر تهران", "دفتر بوشهر",
    ]
    return any(keyword in text for keyword in keywords)


def is_followup_transform_request(message: str) -> bool:
    text = (message or "").strip().lower()
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = text.replace("‌", " ")
    transform_keywords = [
        "خلاصه تر کن", "خلاصه‌تر کن", "کوتاه تر کن", "کوتاه‌تر کن",
        "فنی تر توضیح بده", "فنی‌تر توضیح بده", "تبدیل به جدول",
        "به جدول تبدیل کن", "جدول کن", "به صورت جدول", "جدولی کن",
        "مرتب تر کن", "مرتب‌تر کن",
    ]
    return any(keyword in text for keyword in transform_keywords)


def remove_company_mentions_if_not_allowed(answer: str) -> str:
    if not answer:
        return ""
    blocked_patterns = [
        r".*آرتین آزما مهر.*\n?",
        r".*آرتین آزما.*\n?",
        r".*ارتین ازما.*\n?",
        r".*artinazma\.net.*\n?",
        r".*info@artinazma\.net.*\n?",
        r".*09906060910.*\n?",
        r".*02191008898.*\n?",
        r".*صفحه مرتبط در سایت.*\n?",
        r".*سایت رسمی.*\n?",
        r".*برای اطلاعات بیشتر.*کارشناسان.*\n?",
        r".*برای راهنمایی بیشتر.*ایمیل.*\n?",
        r".*برای دریافت پیش.?فاکتور.*\n?",
    ]
    cleaned = answer
    for pattern in blocked_patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


# ─── Response cache (in-memory LRU or Redis) ─────────────────────────────────

class _ResponseCache:
    """Thread-safe LRU cache for identical non-personalised questions."""
    def __init__(self, maxsize: int = 200, ttl: int = 3600):
        self._cache: OrderedDict = OrderedDict()
        self._maxsize = maxsize
        self._ttl = ttl
        self._lock = threading.Lock()

    def _make_key(self, message: str, domain: str) -> str:
        norm = message.strip().lower()
        return hashlib.sha256(f"{domain}||{norm}".encode()).hexdigest()

    def get(self, message: str, domain: str):
        key = self._make_key(message, domain)
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            if _time.time() - entry["ts"] > self._ttl:
                del self._cache[key]
                return None
            self._cache.move_to_end(key)
            return entry["data"]

    def set(self, message: str, domain: str, data: dict):
        key = self._make_key(message, domain)
        with self._lock:
            self._cache[key] = {"data": data, "ts": _time.time()}
            self._cache.move_to_end(key)
            if len(self._cache) > self._maxsize:
                self._cache.popitem(last=False)

    def invalidate(self):
        with self._lock:
            self._cache.clear()

    def stats(self) -> dict:
        with self._lock:
            return {"size": len(self._cache), "maxsize": self._maxsize, "ttl": self._ttl}


class _RedisCache:
    """
    Drop-in replacement for _ResponseCache backed by Redis.
    Activated when REDIS_URL env var is set.
    Falls back silently to None on any Redis error (cache miss).
    """
    def __init__(self, ttl: int = 3600, prefix: str = "artin:chat:"):
        import redis as _redis  # type: ignore[import]
        self._redis = _redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            decode_responses=False,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        self._ttl = ttl
        self._prefix = prefix

    def _make_key(self, message: str, domain: str) -> str:
        norm = message.strip().lower()
        digest = hashlib.sha256(f"{domain}||{norm}".encode()).hexdigest()
        return f"{self._prefix}{digest}"

    def get(self, message: str, domain: str):
        import json as _json
        try:
            raw = self._redis.get(self._make_key(message, domain))
            if raw is None:
                return None
            return _json.loads(raw)
        except Exception:
            return None

    def set(self, message: str, domain: str, data: dict):
        import json as _json
        try:
            self._redis.setex(
                self._make_key(message, domain),
                self._ttl,
                _json.dumps(data, ensure_ascii=False),
            )
        except Exception:
            pass

    def invalidate(self):
        try:
            keys = self._redis.keys(f"{self._prefix}*")
            if keys:
                self._redis.delete(*keys)
        except Exception:
            pass

    def stats(self) -> dict:
        try:
            size = len(self._redis.keys(f"{self._prefix}*"))
            info = self._redis.info("memory")
            return {
                "backend": "redis",
                "size": size,
                "ttl": self._ttl,
                "used_memory_human": info.get("used_memory_human", "?"),
            }
        except Exception:
            return {"backend": "redis", "size": -1, "ttl": self._ttl, "error": "unavailable"}


def make_response_cache(maxsize: int = 200, ttl: int = 3600):
    """Returns Redis cache if REDIS_URL is set, else in-memory LRU."""
    redis_url = os.getenv("REDIS_URL", "").strip()
    if redis_url:
        try:
            cache = _RedisCache(ttl=ttl)
            cache._redis.ping()
            logger.info(f"[cache] Redis cache enabled ({redis_url})")
            return cache
        except Exception as exc:
            logger.warning(f"[cache] Redis connection failed ({exc}) -- falling back to in-memory cache")
    return _ResponseCache(maxsize=maxsize, ttl=ttl)
