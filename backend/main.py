import os
import re
import threading
import logging
import logging.handlers
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import shutil
from datetime import datetime as _dt
from datetime import datetime
from artinazma_index_service import rebuild_artinazma_index, load_index
from intent_service import detect_question_intent
from site_resource_service import find_artinazma_resources
from local_search_service import local_search_knowledge_base, build_local_answer
from fastapi import FastAPI, Request, UploadFile, File, Form, Depends, HTTPException, Security
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pydantic import BaseModel, field_validator
import hashlib
import time as _time
from collections import OrderedDict
from google_drive_service import sync_google_drive_folder
from knowledge_service import (
    add_file_to_knowledge_base,
    search_knowledge_base,
    get_knowledge_stats,
    delete_knowledge_file,
    knowledge_file_exists,
    add_text_to_knowledge_base,
)
from ai_service import ask_expert_assistant, ask_expert_assistant_stream, analyze_image_with_ai
from ai_service import client as ai_client
from ai_service import get_response_cache_stats as _get_ai_cache_stats
from file_analyzer import analyze_excel_or_csv, read_pdf_text
from db_service import (
    init_db,
    detect_domain,
    save_expert_question,
    get_recent_questions,
    get_question_stats,
    get_question_analytics,
    get_question_by_id,
    update_question_review,
    save_user_memory,
    search_user_memories,
    get_user_memory_stats,
    save_customer_request,
    delete_all_customer_chat_sessions,
    get_customer_requests,
    update_customer_request_status,
    get_customer_request_stats,
    create_customer,
    authenticate_customer,
    get_customer_by_id,
    update_customer_profile,
    change_customer_password,
    create_chat_session,
    save_chat_message,
    get_customer_chat_sessions,
    get_chat_messages,
    update_chat_session_title,
    delete_chat_session,
    get_all_questions,
    get_all_customers,
    get_customer_sessions,
    get_connection,
    get_setting,
    set_setting,
    set_customer_blocked,
    log_knowledge_action,
    get_knowledge_audit_log,
    clear_knowledge_audit_log,
    get_customer_cross_session_context,
    save_question_feedback,
    get_feedback_stats,
    save_customer_notification,
    get_customer_notifications,
    mark_notifications_read,
    get_unread_notification_count,
    get_response_time_stats,
    save_push_subscription,
    remove_push_subscription,
    get_push_subscriptions,
)
from telegram_service import notify_new_customer, notify_new_request
from ws_chat import router as ws_router
from auth_service import (
    create_access_token,
    get_current_customer,
    get_optional_customer,
    require_customer_match,
)
from push_service import send_push_to_customer, is_push_configured
from security_middleware import CSRFMiddleware, SmartRateLimitMiddleware, login_tracker, generate_csrf_token


# ── Sentry Error Tracking ─────────────────────────────────────────────────────
_SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if _SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        integrations=[FastApiIntegration(), StarletteIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment=os.getenv("ENVIRONMENT", "production"),
    )
    print("[sentry] ✅ Sentry error tracking enabled")
else:
    print("[sentry] ℹ️  SENTRY_DSN not set — error tracking disabled")

_gdrive_timer: threading.Timer | None = None
_gdrive_lock = threading.Lock()

logger = logging.getLogger("artin_scheduler")

# ── File-based error logging ──────────────────────────────────────────────────
_LOG_DIR = os.path.join(os.path.dirname(__file__), "storage")
os.makedirs(_LOG_DIR, exist_ok=True)
_file_handler = logging.handlers.RotatingFileHandler(
    os.path.join(_LOG_DIR, "app.log"),
    maxBytes=5 * 1024 * 1024,  # 5 MB
    backupCount=3,
    encoding="utf-8",
)
_file_handler.setLevel(logging.WARNING)
_file_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
)
# Attach to root logger so all warnings/errors across all modules are captured
logging.getLogger().addHandler(_file_handler)
logging.getLogger().setLevel(logging.INFO)
# Also log to console at INFO level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    force=False,
)


def _run_gdrive_sync():
    """اجرای همزمان‌سازی Google Drive در پس‌زمینه."""
    folder_id = os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not folder_id:
        logger.info("GOOGLE_DRIVE_ROOT_FOLDER_ID not set — skipping scheduled sync")
        return
    try:
        logger.info("Starting scheduled Google Drive sync...")
        result = sync_google_drive_folder(root_folder_id=folder_id, max_files=200, force_resync=False)
        set_setting("gdrive_last_sync", _dt.utcnow().isoformat())
        set_setting("gdrive_last_sync_result", str(result.get("synced_files", 0)) + " فایل")
        logger.info("Scheduled Google Drive sync complete: %s", result)
    except Exception as exc:
        logger.error("Scheduled Google Drive sync failed: %s", exc)
        set_setting("gdrive_last_sync_result", f"خطا: {exc}")


def _schedule_gdrive(interval_hours: float):
    """برنامه‌ریزی sync بعدی؛ اگر interval_hours=0 باشد، تایمر لغو می‌شود."""
    global _gdrive_timer
    with _gdrive_lock:
        if _gdrive_timer is not None:
            _gdrive_timer.cancel()
            _gdrive_timer = None
        if interval_hours <= 0:
            return
        def _fire():
            _run_gdrive_sync()
            _schedule_gdrive(float(get_setting("gdrive_sync_interval_hours", "0")))
        _gdrive_timer = threading.Timer(interval_hours * 3600, _fire)
        _gdrive_timer.daemon = True
        _gdrive_timer.start()


@asynccontextmanager
async def _lifespan(app_instance):
    # startup
    interval = float(get_setting("gdrive_sync_interval_hours", "0"))
    if interval > 0:
        _schedule_gdrive(interval)
        logger.info("Google Drive auto-sync scheduled every %.1f hours", interval)
    yield
    # shutdown
    with _gdrive_lock:
        if _gdrive_timer is not None:
            _gdrive_timer.cancel()


app = FastAPI(
    title="ArtinAzma Expert Assistant API",
    description=(
        "\u0633\u0627\u0645\u0627\u0646\u0647 \u062f\u0633\u062a\u06cc\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062f \u0622\u0631\u062a\u06cc\u0646 \u0622\u0632\u0645\u0627 \u0645\u0647\u0631 \u2014 API \u0628\u0631\u0627\u06cc \u0686\u062a \u062a\u062e\u0635\u0635\u06cc\u060c "
        "\u0645\u062f\u06cc\u0631\u06cc\u062a \u0628\u0627\u0646\u06a9 \u062f\u0627\u0646\u0634\u060c \u062a\u062d\u0644\u06cc\u0644 \u0641\u0627\u06cc\u0644\u060c \u0645\u062f\u06cc\u0631\u06cc\u062a \u0645\u0634\u062a\u0631\u06cc\u0627\u0646 \u0648 \u067e\u0646\u0644 \u0627\u062f\u0645\u06cc\u0646.\n\n"
        "## Authentication\n"
        "- **Customers**: JWT Bearer token in `Authorization` header\n"
        "- **Admin**: API key in `X-Admin-Key` header\n\n"
        "## Rate Limits\n"
        "- `/chat`: 20 requests/minute\n"
        "- `/knowledge/upload`: 10 requests/minute"
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "Chat", "description": "AI chat and streaming endpoints"},
        {"name": "Knowledge", "description": "Knowledge base management"},
        {"name": "Customers", "description": "Customer registration, login, and profile"},
        {"name": "Chat Sessions", "description": "Customer chat session management"},
        {"name": "Analysis", "description": "File and image analysis"},
        {"name": "Admin", "description": "Admin panel endpoints (requires X-Admin-Key)"},
        {"name": "Settings", "description": "System settings and health check"},
        {"name": "WebSocket", "description": "Real-time WebSocket chat"},
    ],
    lifespan=_lifespan,
)
_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

def require_admin(api_key: str = Security(_admin_key_header)):
    expected = os.getenv("ADMIN_API_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY تنظیم نشده است.")
    if api_key != expected:
        raise HTTPException(status_code=401, detail="دسترسی غیرمجاز.")
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
init_db()

# Load Telegram settings from DB into env so telegram_service picks them up
_tg_token = get_setting("telegram_bot_token") or ""
_tg_chat = get_setting("telegram_chat_id") or ""
if _tg_token and not os.getenv("TELEGRAM_BOT_TOKEN"):
    os.environ["TELEGRAM_BOT_TOKEN"] = _tg_token
if _tg_chat and not os.getenv("TELEGRAM_CHAT_ID"):
    os.environ["TELEGRAM_CHAT_ID"] = _tg_chat

frontend_origins = os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
allowed_origins = [
    origin.strip() for origin in frontend_origins.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Key", "X-Requested-With"],
)

# ── WebSocket Router ─────────────────────────────────────────────────────────
app.include_router(ws_router)

# ── Security Middleware ────────────────────────────────────────────────
app.add_middleware(CSRFMiddleware)
app.add_middleware(SmartRateLimitMiddleware)


# ── Request Logging Middleware ─────────────────────────────────────────────────
import time as _time
_request_logger = logging.getLogger("artin.requests")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = _time.monotonic()
    response = await call_next(request)
    duration_ms = round((_time.monotonic() - start) * 1000)
    # Only log slow requests (>500ms) or errors to avoid noise
    if duration_ms > 500 or response.status_code >= 400:
        _request_logger.info(
            "%s %s → %s (%dms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={
                "method": request.method,
                "endpoint": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
    return response


def make_safe_filename(filename: str) -> str:
    base_name = os.path.basename(filename or "uploaded_file")
    safe_name = base_name.replace(" ", "_")
    safe_name = re.sub(r"[^A-Za-z0-9_\-.\u0600-\u06FF]", "_", safe_name)

    if not safe_name or safe_name in [".", ".."]:
        safe_name = "uploaded_file"

    return safe_name


def is_specific_product_or_model_question(message: str) -> bool:
    text = (message or "").lower()

    latin_tokens = re.findall(r"\b[A-Za-z][A-Za-z0-9\-]{1,}\b", message or "")

    if not latin_tokens:
        return False

    # این‌ها تکنیک، روش، استاندارد یا اصطلاح عمومی هستند؛ مدل محصول حساب نشوند
    known_technical_terms = {
        "xrf",
        "edxrf",
        "wdxrf",
        "xrd",
        "icp",
        "icp-oes",
        "icp-ms",
        "aas",
        "gc",
        "gc-ms",
        "gcms",
        "hplc",
        "lc",
        "ftir",
        "uv",
        "uv-vis",
        "uvvis",
        "nmr",
        "ms",
        "fid",
        "tcd",
        "ecd",
        "fpd",
        "scd",
        "bet",
        "tpr",
        "tpd",
        "sem",
        "tem",
        "astm",
        "iso",
        "epa",
        "en",
        "api",
        "nace",
        "btex",
        "voc",
        "h2s",
        "cos",
        "cs2",
        "lod",
        "loq",
        "rsd",
        "qc",
        "crm",
        "tan",
        "tbn",
        "cfpp",
    }

    normalized_tokens = {
        token.strip().lower() for token in latin_tokens if token.strip()
    }

    # اگر همه کلمات لاتین از جنس تکنیک/استاندارد/پارامتر هستند، مدل دستگاه نیست
    if normalized_tokens and all(
        token in known_technical_terms for token in normalized_tokens
    ):
        return False

    model_keywords = [
        "مدل",
        "دستگاه",
        "آنالایزر",
        "مشخصات",
        "دیتاشیت",
        "کاتالوگ",
        "manual",
        "datasheet",
        "catalog",
        "model",
        "device",
        "instrument",
        "analyzer",
        "part number",
        "serial",
    ]

    # کلمه «چیست» را از این لیست حذف کردیم، چون سوال‌های عمومی مثل XRF چیست را خراب می‌کرد.
    if not any(keyword in text for keyword in model_keywords):
        return False

    # اگر حداقل یک token لاتین شبیه مدل واقعی باشد
    # مثال: SpectroScan SE، GC-5000، DMA-4500، M4000
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
        "آرتین آزما",
        "ارتین ازما",
        "آرتین‌آزما",
        "artinazma",
        "artin azma",
        "سایت شما",
        "سایتتون",
        "وبسایت شما",
        "شرکت شما",
        "نمایندگی شما",
        "محصولات شما",
        "تو سایت شما",
        "در سایت شما",
        "آیا شما",
        "شما دارید",
        "شما تامین",
        "از شما بخرم",
        "خرید از شما",
        "استعلام قیمت",
        "قیمت",
        "موجودی",
        "پیش فاکتور",
        "پیش‌فاکتور",
        "سفارش",
        "تماس",
        "شماره تماس",
        "ایمیل",
        "واتساپ",
        "آدرس",
        "دفتر تهران",
        "دفتر بوشهر",
    ]

    return any(keyword in text for keyword in keywords)

def is_followup_transform_request(message: str) -> bool:
    text = (message or "").strip().lower()
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = text.replace("‌", " ")

    transform_keywords = [
        "خلاصه تر کن",
        "خلاصه‌تر کن",
        "کوتاه تر کن",
        "کوتاه‌تر کن",
        "فنی تر توضیح بده",
        "فنی‌تر توضیح بده",
        "تبدیل به جدول",
        "به جدول تبدیل کن",
        "جدول کن",
        "به صورت جدول",
        "جدولی کن",
        "مرتب تر کن",
        "مرتب‌تر کن",
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


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


# ─── Score thresholds (single place to change) ──────────────────────────────
_LOCAL_SCORE_THRESHOLD = 10      # local search score >= this → use local
_MODEL_LOCAL_SCORE_THRESHOLD = 8 # model question: exact local match threshold
_WEAK_CONTEXT_THRESHOLD = 14     # below this → discard internal context for tech intents

# ─── دیکشنری استانداردهای ASTM/ISO شناخته‌شده ───────────────────────────────
# اگر کاربر یک کد استاندارد بپرسد، عنوان صحیح مستقیم به context inject می‌شود
# تا مدل نتواند کد را با کد دیگری قاطی کند یا وانمود کند نمی‌داند.
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


def _build_chat_pipeline(body: "ChatRequest") -> dict:
    """
    Shared pre-processing pipeline for /chat and /chat/stream.
    Returns a dict with all computed fields needed by both endpoints.
    """
    has_astm_code = bool(
        re.search(r"\bD\s*\d{3,5}\b", body.message, flags=re.IGNORECASE)
    )
    specific_model_question = is_specific_product_or_model_question(body.message)
    allow_company_reference = is_artinazma_related_question(body.message)
    is_transform_followup = is_followup_transform_request(body.message)
    intent_data = detect_question_intent(message=body.message, domain=body.domain or "auto")

    question_intent: str = intent_data["intent"]
    question_intent_label: str = intent_data["label"]
    local_docs = local_search_knowledge_base(body.message, top_k=12)

    best_score = 0.0
    related_docs: list = []
    search_mode = "unknown"

    # ── استخراج عنوان استاندارد ASTM از دیکشنری داخلی ──
    _astm_inject: str = ""
    if has_astm_code:
        _astm_matches = re.findall(r"\bD\s*(\d{3,5})\b", body.message, flags=re.IGNORECASE)
        _injected_titles = [
            _ASTM_KNOWN_STANDARDS[f"D{n}"]
            for n in _astm_matches
            if f"D{n}" in _ASTM_KNOWN_STANDARDS
        ]
        if _injected_titles:
            _astm_inject = (
                "اطلاعات دقیق استاندارد (از پایگاه دانش داخلی):\n"
                + "\n".join(f"• {t}" for t in _injected_titles)
                + "\n⚠️ قانون مطلق: دقیقاً همین استاندارد(ها) را توضیح بده. هرگز کد را با کد دیگری جایگزین نکن."
            )

    if has_astm_code:
        related_docs = []
        search_mode = "gpt_astm_direct"
    elif specific_model_question:
        exact_local_match = context_has_exact_model_match(body.message, local_docs)
        if (
            exact_local_match
            and local_docs
            and float(local_docs[0].get("score", 0) or 0) >= _MODEL_LOCAL_SCORE_THRESHOLD
        ):
            related_docs = local_docs[:8]
            search_mode = "local_exact_model"
        else:
            related_docs = []
            search_mode = "no_exact_model_context"
    else:
        if local_docs and float(local_docs[0].get("score", 0) or 0) >= _LOCAL_SCORE_THRESHOLD:
            related_docs = local_docs[:8]
            search_mode = "local_fast"
        else:
            try:
                related_docs = search_knowledge_base(body.message, top_k=5)
                search_mode = "ai_vector"
            except Exception as e:
                logger.warning("AI vector search failed, using local: %s", e)
                related_docs = local_docs[:8]
                search_mode = "local_fallback"

    if related_docs:
        try:
            best_score = float(related_docs[0].get("score", 0) or 0)
        except Exception:
            best_score = 0.0

    if question_intent in _TECHNICAL_INTENTS and best_score < _WEAK_CONTEXT_THRESHOLD:
        related_docs = []
        best_score = 0.0
        search_mode = f"{search_mode}+ignored_weak_internal_context"

    # ── Site resource lookup ──
    resource_links: list = []
    resource_images: list = []
    artinazma_context = _astm_inject  # inject عنوان صحیح استاندارد اگر وجود داشت

    if allow_company_reference:
        try:
            artinazma_resources = find_artinazma_resources(message=body.message, max_results=2)
            resource_links = artinazma_resources.get("links", [])
            resource_images = artinazma_resources.get("images", [])
            if resource_links:
                artinazma_context = (
                    "نتیجه جست‌وجوی سایت رسمی آرتین آزما:\n"
                    "این مورد در سایت رسمی آرتین آزما پیدا شده است.\n"
                    "هنگام پاسخ، کامل و فنی توضیح بده.\n"
                    "در متن پاسخ، لینک خام ننویس؛ لینک جداگانه توسط سیستم نمایش داده می‌شود.\n"
                )
                for link in resource_links:
                    artinazma_context += f"\nعنوان صفحه: {link.get('title', '')}"
                    artinazma_context += f"\nلینک صفحه: {link.get('url', '')}\n"
                search_mode = f"{search_mode}+artinazma_site"
        except Exception as e:
            logger.warning("ArtinAzma resource search failed: %s", e)

    # ── Web search flag ──
    allow_web_search = True
    if body.response_mode == "brief":
        allow_web_search = False
    if question_intent in _TECHNICAL_INTENTS:
        allow_web_search = True
    if specific_model_question or has_astm_code or not related_docs:
        allow_web_search = True
    if is_transform_followup:
        allow_web_search = False
        related_docs = []
        search_mode = "followup_transform"

    if allow_web_search:
        search_mode = f"{search_mode}+openai_web"

    # ── Build context string ──
    context_parts = []
    for doc in related_docs:
        context_parts.append(
            f"منبع داخلی:\nعنوان: {doc.get('title', '')}\n"
            f"فایل: {doc.get('file_name', '')}\n"
            f"دسته‌بندی: {doc.get('category', '')}\n"
            f"امتیاز ارتباط: {doc.get('score', '')}\n"
            f"متن:\n{doc.get('content', '')}"
        )
    context = "\n\n".join(context_parts)

    if artinazma_context:
        context = f"{context}\n\n{artinazma_context}".strip()

    if body.context:
        context = f"اطلاعات خارجی ارائه‌شده توسط کاربر:\n{body.context}\n\n---\n\n{context}".strip()

    # ── Domain detection ──
    auto_domain = detect_domain(body.message)
    selected_domain = body.domain or "auto"
    detected_domain = auto_domain if selected_domain == "auto" else selected_domain

    # ── History (last 6 turns) ──
    history = [
        {"role": item.role, "content": item.content}
        for item in (body.history or [])[-6:]
        if item.role in ["user", "assistant"] and item.content
    ]

    # ── Style instructions ──
    style_instructions = (
        "سبک پاسخ:\n"
        "پاسخ باید شبیه ChatGPT Plus باشد: کامل، دقیق، آموزشی، تیتردار، مرتب، با جدول، مثال و جمع‌بندی.\n"
        "قانون پاسخ تأییدشده: برای سؤال‌های تخصصی و فنی، از منبع معتبر استفاده کن.\n"
        "پاسخ فارسی باشد."
    )
    if is_transform_followup:
        style_instructions = (
            "قانون بسیار مهم برای درخواست‌های بازنویسی:\n"
            "پیام فعلی کاربر یک درخواست بازنویسی است. از history استفاده کن.\n"
            "web search انجام نده. اطلاعات جدید اضافه نکن.\n"
            "اگر کاربر خواست «تبدیل به جدول»: فقط Markdown table معتبر تولید کن.\n"
            "از tab یا <br> داخل جدول استفاده نکن. هر ردیف تعداد ستون برابر داشته باشد."
        )

    context = f"{context}\n\n---\n\n{style_instructions}".strip() if context else style_instructions

    # ── Sources list ──
    sources = [
        {
            "title": doc.get("title", ""),
            "file_name": doc.get("file_name", ""),
            "category": doc.get("category", ""),
            "score": float(doc.get("score", 0) or 0),
        }
        for doc in related_docs
    ]

    # ── Customer cross-session context ──
    customer_context = ""
    if body.customer_id:
        try:
            customer_context = get_customer_cross_session_context(body.customer_id)
            if not body.user_id or body.user_id == "anonymous":
                body.user_id = f"customer_{body.customer_id}"
        except Exception as _e:
            logger.warning("customer_context load failed: %s", _e)

    return {
        "has_astm_code": has_astm_code,
        "specific_model_question": specific_model_question,
        "allow_company_reference": allow_company_reference,
        "is_transform_followup": is_transform_followup,
        "question_intent": question_intent,
        "question_intent_label": question_intent_label,
        "related_docs": related_docs,
        "search_mode": search_mode,
        "allow_web_search": allow_web_search,
        "context": context,
        "detected_domain": detected_domain,
        "history": history,
        "sources": sources,
        "resource_links": resource_links,
        "resource_images": resource_images,
        "customer_context": customer_context,
        "response_mode": body.response_mode or "auto",
    }


class GoogleDriveSyncRequest(BaseModel):
    root_folder_id: str = ""
    max_files: int = 200
    force_resync: bool = False


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatHistoryMessage]] = None
    domain: Optional[str] = "auto"
    response_mode: Optional[str] = "auto"
    user_id: Optional[str] = "anonymous"
    customer_id: Optional[int] = None
    context: Optional[str] = None  # External context (e.g. from analyze page)


class MemorySearchRequest(BaseModel):
    user_id: str
    query: str = ""
    limit: int = 50


class QuestionReviewRequest(BaseModel):
    expert_status: str
    expert_note: str = ""
    reviewed_answer: str = ""


class CustomerRequestCreate(BaseModel):
    full_name: str
    company: str = ""
    phone: str
    email: str = ""
    request_type: str = "consultation"
    subject: str = ""
    message: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد.")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        import re as _re
        if not _re.match(r"^[0-9+\-() ]{7,20}$", v):
            raise ValueError("شماره تماس معتبر نیست.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if v:
            import re as _re
            if not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
                raise ValueError("آدرس ایمیل معتبر نیست.")
        return v

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("متن پیام باید حداقل ۱۰ کاراکتر باشد.")
        return v


class CustomerRequestStatusUpdate(BaseModel):
    status: str


class CustomerRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    company: str = ""
    phone: str = ""

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        import re as _re
        if not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("آدرس ایمیل معتبر نیست.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("رمز عبور باید حداقل ۶ کاراکتر باشد.")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if v:
            import re as _re
            if not _re.match(r"^[0-9+\-() ]{7,20}$", v):
                raise ValueError("شماره تماس معتبر نیست.")
        return v


class CustomerLoginRequest(BaseModel):
    email: str
    password: str


class CustomerProfileUpdateRequest(BaseModel):
    full_name: str
    company: str = ""
    phone: str = ""


class CustomerChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.")
        return v


class CustomerSessionCreateRequest(BaseModel):
    customer_id: int
    title: str = "گفتگوی جدید"


class CustomerSessionUpdateRequest(BaseModel):
    customer_id: int
    title: str


class CustomerChatMessageCreateRequest(BaseModel):
    customer_id: int
    session_id: int
    role: str
    content: str
    metadata: dict = {}


# ─── Simple in-memory LRU response cache ────────────────────────────────────
class _ResponseCache:
    """Thread-safe LRU cache for identical non-personalised questions."""
    def __init__(self, maxsize: int = 200, ttl: int = 3600):
        self._cache: OrderedDict = OrderedDict()
        self._maxsize = maxsize
        self._ttl = ttl  # seconds
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
            # LRU: move to end
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


_response_cache = _ResponseCache(maxsize=200, ttl=3600)


@app.get("/")
def home():
    return {"message": "ArtinAzma Expert Assistant API is running"}


@app.get("/health", tags=["Settings"], summary="Health check")
def health_check():
    """بررسی سلامت سرویس: دیتابیس + OpenAI."""
    import time
    start = time.monotonic()
    status = {"ok": True, "timestamp": datetime.utcnow().isoformat(), "checks": {}}

    # DB check
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        status["checks"]["database"] = {"ok": True}
    except Exception as e:
        status["checks"]["database"] = {"ok": False, "error": str(e)}
        status["ok"] = False

    # OpenAI key check
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_ok = bool(openai_key and not openai_key.startswith("x-") and openai_key != "test_offline_mode")
    status["checks"]["openai"] = {"ok": openai_ok, "configured": openai_ok}
    if not openai_ok:
        status["ok"] = False

    # Qdrant check
    import qdrant_service as _qs
    if _qs.is_enabled():
        try:
            qdrant_stats = _qs.collection_stats()
            status["checks"]["qdrant"] = {"ok": True, **qdrant_stats}
        except Exception as e:
            status["checks"]["qdrant"] = {"ok": False, "error": str(e)}
    else:
        status["checks"]["qdrant"] = {"ok": True, "enabled": False, "backend": "json"}

    status["response_ms"] = round((time.monotonic() - start) * 1000, 2)
    return status


@app.get("/admin/qdrant-status")
def qdrant_status(_=Depends(require_admin)):
    """وضعیت اتصال به Qdrant و آمار collection."""
    import qdrant_service as _qs
    if not _qs.is_enabled():
        return {
            "enabled": False,
            "message": "Qdrant فعال نیست. متغیر محیطی QDRANT_URL را تنظیم کنید.",
            "backend": "json",
        }
    try:
        stats = _qs.collection_stats()
        return {"enabled": True, "backend": "qdrant", **stats}
    except Exception as e:
        return {"enabled": True, "backend": "qdrant", "error": str(e), "ok": False}


def save_question_review(question_id: int, request: QuestionReviewRequest):
    updated = update_question_review(
        question_id=question_id,
        expert_status=request.expert_status,
        expert_note=request.expert_note,
        reviewed_answer=request.reviewed_answer,
    )

    if not updated:
        raise HTTPException(status_code=404, detail="سوال موردنظر پیدا نشد.")

    return {
        "success": True,
        "question_id": question_id,
        "expert_status": request.expert_status,
    }


@app.put("/questions/{question_id}/review")
def review_question_put(question_id: int, request: QuestionReviewRequest, _=Depends(require_admin)):
    return save_question_review(question_id, request)


@app.patch("/questions/{question_id}/review")
def review_question_patch(question_id: int, request: QuestionReviewRequest, _=Depends(require_admin)):
    return save_question_review(question_id, request)


class FeedbackRequest(BaseModel):
    rating: str  # "up" or "down"
    comment: str = ""


@app.post("/questions/{question_id}/feedback")
def question_feedback(question_id: int, body: FeedbackRequest):
    """ذخیره امتیاز کاربر (👍👎) برای یک پاسخ آرتین."""
    ok = save_question_feedback(question_id, body.rating, body.comment)
    if not ok:
        raise HTTPException(status_code=404, detail="سوال پیدا نشد یا امتیاز نامعتبر است.")
    return {"success": True, "rating": body.rating}


@app.get("/admin/feedback-stats")
def feedback_stats(_=Depends(require_admin)):
    """آمار کلی امتیازات کاربران برای داشبورد ادمین."""
    return get_feedback_stats()


@app.post("/chat", tags=["Chat"], summary="Send message and get AI response")
@limiter.limit("20/minute")
def chat(body: ChatRequest, request: Request):
    p = _build_chat_pipeline(body)

    _t0 = _time.monotonic()
    try:
        answer = ask_expert_assistant(
            message=body.message,
            context=p["context"],
            history=p["history"],
            domain=p["detected_domain"],
            allow_web_search=p["allow_web_search"],
            customer_context=p["customer_context"],
        )
        answer_mode = "ai"
    except Exception as e:
        import traceback; traceback.print_exc()
        logger.warning("AI answer failed, using local answer: %s %s", type(e).__name__, e)
        answer = build_local_answer(body.message, p["related_docs"])
        answer_mode = "local"
    _response_time_ms = int((_time.monotonic() - _t0) * 1000)

    question_id = save_expert_question(
        question=body.message,
        answer=answer,
        sources=p["sources"],
        detected_domain=p["detected_domain"],
        response_time_ms=_response_time_ms,
    )

    memory_id = None
    if body.user_id and body.user_id != "anonymous":
        memory_id = save_user_memory(
            user_id=body.user_id,
            question=body.message,
            answer=answer,
            detected_domain=p["detected_domain"],
            memory_type="chat",
            metadata={
                "question_id": question_id,
                "sources": p["sources"],
                "search_mode": p["search_mode"],
                "web_search_used": p["allow_web_search"],
                "answer_mode": answer_mode,
                "resource_links": p["resource_links"],
                "resource_images": p["resource_images"],
                "question_intent": p["question_intent"],
                "question_intent_label": p["question_intent_label"],
            },
        )

    return {
        "question_id": question_id,
        "memory_id": memory_id,
        "detected_domain": p["detected_domain"],
        "answer": answer,
        "sources": p["sources"],
        "resource_links": p["resource_links"] if p["allow_company_reference"] else [],
        "resource_images": p["resource_images"] if p["allow_company_reference"] else [],
        "search_mode": p["search_mode"],
        "web_search_used": p["allow_web_search"],
        "question_intent": p["question_intent"],
        "question_intent_label": p["question_intent_label"],
        "response_mode": p["response_mode"],
        "answer_mode": answer_mode,
    }


@app.post("/chat/stream", tags=["Chat"], summary="Streaming chat (SSE)")
@limiter.limit("20/minute")
def chat_stream(body: ChatRequest, request: Request):
    """همان pipeline چت اما با پاسخ streaming (SSE)."""
    import json as _json_local

    # ── shared pre-processing pipeline ───────────────────────────────
    p = _build_chat_pipeline(body)
    detected_domain = p["detected_domain"]
    allow_company_reference = p["allow_company_reference"]
    is_transform_followup = p["is_transform_followup"]
    search_mode = p["search_mode"]
    resource_links = p["resource_links"]
    resource_images = p["resource_images"]
    allow_web_search = p["allow_web_search"]
    context = p["context"]
    history = p["history"]
    sources = p["sources"]
    question_intent = p["question_intent"]
    question_intent_label = p["question_intent_label"]
    _cust_ctx_stream = p["customer_context"]

    # ── Cache check: only for anonymous users with no history/context ──────────
    _use_cache = (
        not body.history
        and not body.context
        and not body.customer_id
        and not is_transform_followup
    )
    if _use_cache:
        _cached = _response_cache.get(body.message, detected_domain)
        if _cached:
            # Replay cached response as fast-stream (no OpenAI call)
            def _cached_generator():
                yield f"data: {_json_local.dumps(_cached['meta'], ensure_ascii=False)}\n\n"
                # Send answer in small chunks for natural feel
                text = _cached["answer"]
                chunk_size = 80
                for i in range(0, len(text), chunk_size):
                    chunk = text[i:i+chunk_size]
                    yield f"data: {_json_local.dumps({'type': 'chunk', 'text': chunk}, ensure_ascii=False)}\n\n"
                done = {"type": "done", "question_id": _cached.get("question_id"), "memory_id": None, "from_cache": True}
                yield f"data: {_json_local.dumps(done, ensure_ascii=False)}\n\n"
            return StreamingResponse(
                _cached_generator(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

    def event_generator():
        # ابتدا metadata ارسال می‌شود
        meta = {
            "type": "meta",
            "detected_domain": detected_domain,
            "sources": sources,
            "resource_links": resource_links if allow_company_reference else [],
            "resource_images": resource_images if allow_company_reference else [],
            "search_mode": search_mode,
            "web_search_used": allow_web_search,
            "question_intent": question_intent,
            "question_intent_label": question_intent_label,
        }
        yield f"data: {_json_local.dumps(meta, ensure_ascii=False)}\n\n"

        # سپس متن پاسخ chunk به chunk
        full_answer = ""
        try:
            for chunk in ask_expert_assistant_stream(
                message=body.message,
                context=context,
                history=history,
                domain=detected_domain,
                allow_web_search=allow_web_search,
                customer_context=_cust_ctx_stream,
            ):
                full_answer += chunk
                payload = {"type": "chunk", "text": chunk}
                yield f"data: {_json_local.dumps(payload, ensure_ascii=False)}\n\n"
        except Exception as exc:
            _exc_str = str(exc).lower()
            if "nameresolution" in _exc_str or "getaddrinfo" in _exc_str or "name or service not known" in _exc_str:
                _err_msg = "⚠️ خطای اتصال: سرور نمی‌تواند به OpenAI متصل شود (مشکل DNS). لطفاً VPN یا پروکسی را فعال کنید و دوباره امتحان کنید."
            elif "remotedisconnected" in _exc_str or "connection aborted" in _exc_str or "connectionreset" in _exc_str:
                _err_msg = "⚠️ خطای شبکه: اتصال به OpenAI قطع شد. ممکن است IP سرور توسط OpenAI مسدود باشد. لطفاً VPN یا پروکسی را فعال کنید."
            elif "timeout" in _exc_str:
                _err_msg = "⚠️ خطای timeout: پاسخ از OpenAI خیلی دیر رسید. لطفاً دوباره امتحان کنید."
            elif "401" in _exc_str or "authentication" in _exc_str or "invalid api key" in _exc_str:
                _err_msg = "⚠️ خطای احراز هویت: کلید API معتبر نیست. لطفاً OPENAI_API_KEY را در فایل .env بررسی کنید."
            elif "429" in _exc_str or "rate limit" in _exc_str:
                _err_msg = "⚠️ محدودیت درخواست: تعداد درخواست‌ها از حد مجاز بیشتر شده. لطفاً چند دقیقه صبر کنید."
            elif "insufficient_quota" in _exc_str or "quota" in _exc_str:
                _err_msg = "⚠️ اعتبار API تمام شده. لطفاً حساب OpenAI را شارژ کنید."
            else:
                _err_msg = f"⚠️ خطای غیرمنتظره در دریافت پاسخ. لطفاً دوباره امتحان کنید."
            err = {"type": "error", "message": _err_msg}
            yield f"data: {_json_local.dumps(err, ensure_ascii=False)}\n\n"
            full_answer = _err_msg

        # ذخیره در DB و ارسال event پایانی
        question_id = None
        try:
            question_id = save_expert_question(
                question=body.message,
                answer=full_answer,
                sources=sources,
                detected_domain=detected_domain,
            )
            memory_id = None
            if body.user_id and body.user_id != "anonymous":
                memory_id = save_user_memory(
                    user_id=body.user_id,
                    question=body.message,
                    answer=full_answer,
                    detected_domain=detected_domain,
                    memory_type="chat",
                    metadata={"question_id": question_id, "sources": sources,
                               "search_mode": search_mode, "web_search_used": allow_web_search},
                )
            done = {"type": "done", "question_id": question_id, "memory_id": memory_id}
        except Exception:
            done = {"type": "done", "question_id": None, "memory_id": None}

        # ── Store in cache if eligible ──────────────────────────────────────
        if _use_cache and full_answer and "خطا" not in full_answer:
            _response_cache.set(body.message, detected_domain, {
                "meta": meta,
                "answer": full_answer,
                "question_id": question_id,
            })

        yield f"data: {_json_local.dumps(done, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/analyze-file", tags=["Analysis"], summary="Analyze Excel/CSV/PDF file")
@limiter.limit("10/minute")
def analyze_file(
    request: Request,
    file: UploadFile = File(...),
    test_type: str = Form("general"),
    user_note: str = Form(""),
):
    # ── File validation ──────────────────────────────────────────────
    safe_filename = make_safe_filename(file.filename or "upload")
    ext = safe_filename.lower().rsplit(".", 1)[-1]
    if ext not in _ALLOWED_FILE_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"فرمت .{ext} پشتیبانی نمی‌شود. فرمت‌های مجاز: {', '.join(sorted(_ALLOWED_FILE_EXTS))}",
        )

    content = file.file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="حجم فایل بیش از ۲۰ مگابایت است.")

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, safe_filename)
    file_url = f"/uploads/{safe_filename}"

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    test_type_labels = {
        "general": "گزارش عمومی آزمایشگاهی",
        "catalyst": "تست کاتالیست",
        "chromatography": "کروماتوگرافی GC/HPLC",
        "mercury": "آنالیز جیوه",
        "sulfur": "آنالیز سولفور",
        "metals": "آنالیز عنصری / فلزات",
    }

    selected_test_type = test_type_labels.get(test_type, "گزارش عمومی آزمایشگاهی")

    analysis_guides = {
        "general": """
        تحلیل را به شکل عمومی آزمایشگاهی انجام بده:
        - خلاصه گزارش
        - نتایج مهم
        - شاخص‌های غیرعادی
        - تفسیر فنی
        - پیشنهاد اقدام بعدی
        - سوالات تکمیلی از مشتری
        """,
        "catalyst": """
        تحلیل را مخصوص تست کاتالیست انجام بده:
        - Conversion
        - Selectivity
        - Yield
        - روند افت فعالیت یا Deactivation
        - پایداری عملکرد
        - اثر دما، فشار، زمان و خوراک
        - علت‌های احتمالی افت عملکرد
        - تست‌های تکمیلی پیشنهادی مثل BET, XRD, TPR, TPD, SEM, ICP
        """,
        "chromatography": """
        تحلیل را مخصوص GC/HPLC انجام بده:
        - رفتار پیک‌ها
        - Retention Time
        - Baseline
        - Resolution
        - Peak Area
        - احتمال co-elution
        - وضعیت کالیبراسیون
        - مشکلات احتمالی ستون، دتکتور، تزریق یا گاز حامل
        - چک‌لیست عیب‌یابی
        """,
        "mercury": """
        تحلیل را مخصوص آنالیز جیوه انجام بده:
        - نوع نمونه و ماتریس احتمالی
        - سطح جیوه و معنی فنی آن
        - احتمال آلودگی، memory effect یا خطای آماده‌سازی
        - نیاز به blank, duplicate, spike recovery
        - پیشنهاد روش یا دستگاه مناسب
        """,
        "sulfur": """
        تحلیل را مخصوص آنالیز سولفور انجام بده:
        - نوع ترکیبات گوگردی احتمالی
        - Total Sulfur / H2S / Mercaptan / COS / CS2 در صورت وجود
        - بررسی دقت و محدوده اندازه‌گیری
        - تفسیر برای LPG, گاز طبیعی، سوخت یا نمونه صنعتی
        - پیشنهاد روش و دتکتور مناسب
        """,
        "metals": """
        تحلیل را مخصوص آنالیز عنصری و فلزات انجام بده:
        - عناصر مهم
        - غلظت‌های غیرعادی
        - اثر ماتریس نمونه
        - نیاز به digestion یا آماده‌سازی بهتر
        - کنترل کیفیت شامل blank, standard, CRM, spike
        - پیشنهاد روش‌های AAS, ICP, XRF یا روش مناسب دیگر
        """,
    }

    guide = analysis_guides.get(test_type, analysis_guides["general"])

    if ext in ["xlsx", "xls", "csv"]:
        analysis = analyze_excel_or_csv(file_path)

        prompt = f"""
        این فایل تست برای شرکت آرتین آزما تحلیل شود.

        نوع تست انتخاب‌شده:
        {selected_test_type}

        توضیح کاربر:
        {user_note if user_note else "توضیحی ارائه نشده است."}

        اطلاعات استخراج‌شده از فایل:
        {analysis}

        راهنمای تحلیل تخصصی:
        {guide}

        خروجی را فارسی، تخصصی و کاربردی بده و دقیقاً با این ساختار بنویس:
        1. خلاصه مدیریتی
        2. نوع داده و برداشت اولیه
        3. شاخص‌های مهم
        4. روندها و نقاط غیرعادی
        5. تفسیر تخصصی بر اساس نوع تست
        6. علت‌های احتمالی
        7. پیشنهاد اقدام بعدی
        8. سوالات تکمیلی که باید از مشتری پرسیده شود

        اگر داده کافی نیست، صریح بگو چه داده‌هایی لازم است.
        """

        ai_answer = ask_expert_assistant(prompt)

        return {
            "file_type": ext,
            "test_type": test_type,
            "test_type_label": selected_test_type,
            "raw_analysis": analysis,
            "file_url": file_url,
            "file_name": safe_filename,
            "ai_analysis": ai_answer,
        }

    if ext == "pdf":
        text = read_pdf_text(file_path)

        prompt = f"""
        این PDF تست یا گزارش آزمایشگاهی برای شرکت آرتین آزما تحلیل شود.

        نوع تست انتخاب‌شده:
        {selected_test_type}

        توضیح کاربر:
        {user_note if user_note else "توضیحی ارائه نشده است."}

        متن استخراج‌شده از PDF:
        {text}

        راهنمای تحلیل تخصصی:
        {guide}

        خروجی را فارسی، تخصصی و کاربردی بده و دقیقاً با این ساختار بنویس:
        1. خلاصه مدیریتی
        2. موضوع گزارش
        3. نتایج مهم
        4. ابهام‌ها یا داده‌های ناقص
        5. تفسیر تخصصی بر اساس نوع تست
        6. علت‌های احتمالی
        7. پیشنهاد اقدام بعدی
        8. سوالات تکمیلی از مشتری
        """

        ai_answer = ask_expert_assistant(prompt)

        return {
            "file_type": ext,
            "test_type": test_type,
            "test_type_label": selected_test_type,
            "extracted_text": text[:2000],
            "file_url": file_url,
            "file_name": safe_filename,
            "ai_analysis": ai_answer,
        }

    return {"error": "فعلاً فقط فایل‌های Excel, CSV و PDF پشتیبانی می‌شوند."}


@app.post("/knowledge/upload", tags=["Knowledge"], summary="Upload knowledge file")
@limiter.limit("10/minute")
async def upload_knowledge_file(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form("general"),
    replace_existing: bool = Form(False),
    _=Depends(require_admin)
):
    upload_dir = "knowledge_files"
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = make_safe_filename(file.filename)
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = add_file_to_knowledge_base(
        file_path=file_path,
        title=title or safe_filename,
        category=category or "general",
        replace_existing=replace_existing,
    )

    if result.get("success"):
        log_knowledge_action(
            action="upload",
            file_name=result.get("file_name", safe_filename),
            title=title or safe_filename,
            category=category or "general",
            detail=f"{result.get('chunks_added', 0)} chunk اضافه شد" + (" (جایگزین)" if replace_existing else ""),
        )

    return result


@app.post("/knowledge/sync-google-drive", tags=["Knowledge"], summary="Sync from Google Drive")
def knowledge_sync_google_drive(request: GoogleDriveSyncRequest, _=Depends(require_admin)):
    folder_id = (
        request.root_folder_id.strip()
        or os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    )

    if not folder_id:
        return {
            "success": False,
            "message": "GOOGLE_DRIVE_ROOT_FOLDER_ID تنظیم نشده است.",
        }

    try:
        result = sync_google_drive_folder(
            root_folder_id=folder_id,
            max_files=request.max_files,
            force_resync=request.force_resync,
        )
        if result.get("success"):
            log_knowledge_action(
                action="drive_sync",
                detail=(
                    f"پردازش‌شده: {result.get('processed_files', 0)}, "
                    f"اضافه‌شده: {result.get('added_files', 0)}, "
                    f"chunk: {result.get('chunks_added', 0)}"
                    + (" (force resync)" if request.force_resync else "")
                ),
            )
        return result
    except Exception as e:
        return {
            "success": False,
            "message": f"خطا در همگام‌سازی Google Drive: {str(e)}",
        }


@app.get("/knowledge/stats", tags=["Knowledge"], summary="Knowledge base statistics")
def knowledge_stats():
    return get_knowledge_stats()


# ─── Database Backup ────────────────────────────────────────────────────────

BACKUP_DIR = Path("storage/backups")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/admin/backup/create")
def create_backup(_=Depends(require_admin)):
    """یک نسخه پشتیبان از دیتابیس SQLite ایجاد می‌کند."""
    import sqlite3 as _sqlite3
    from db_service import DB_PATH

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_name = f"app_backup_{timestamp}.db"
    backup_path = BACKUP_DIR / backup_name

    try:
        src = _sqlite3.connect(DB_PATH)
        dst = _sqlite3.connect(backup_path)
        src.backup(dst)
        src.close()
        dst.close()
        size_kb = round(backup_path.stat().st_size / 1024, 1)
        return {"success": True, "file_name": backup_name, "size_kb": size_kb}
    except Exception as e:
        logger.error("Backup failed: %s", e)
        return {"success": False, "message": str(e)}


@app.get("/admin/backup/list")
def list_backups(_=Depends(require_admin)):
    """فهرست فایل‌های پشتیبان موجود را برمی‌گرداند."""
    backups = []
    for f in sorted(BACKUP_DIR.glob("*.db"), reverse=True):
        backups.append({
            "file_name": f.name,
            "size_kb": round(f.stat().st_size / 1024, 1),
            "created_at": datetime.utcfromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        })
    return {"backups": backups}


@app.get("/admin/backup/download/{file_name}")
def download_backup(file_name: str, _=Depends(require_admin)):
    """دانلود یک فایل پشتیبان مشخص."""
    from fastapi.responses import FileResponse
    # security: only allow simple filenames (no path traversal)
    safe_name = Path(file_name).name
    backup_path = BACKUP_DIR / safe_name
    if not backup_path.exists() or not backup_path.suffix == ".db":
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="فایل پیدا نشد.")
    return FileResponse(
        path=backup_path,
        filename=safe_name,
        media_type="application/octet-stream",
    )


@app.delete("/admin/backup/{file_name}")
def delete_backup(file_name: str, _=Depends(require_admin)):
    """حذف یک فایل پشتیبان."""
    safe_name = Path(file_name).name
    backup_path = BACKUP_DIR / safe_name
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="فایل پیدا نشد.")
    backup_path.unlink()
    return {"success": True}


@app.get("/admin/knowledge/export-csv")
def export_knowledge_csv(_=Depends(require_admin)):
    """خروجی CSV از فایل‌های بانک دانش برای دانلود Excel."""
    import csv, io
    stats = get_knowledge_stats()
    file_details = stats.get("file_details") or []
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["نام فایل", "عنوان", "دسته‌بندی", "تعداد Chunk"])
    for item in file_details:
        writer.writerow([
            item.get("file_name", ""),
            item.get("title", ""),
            item.get("category", ""),
            item.get("chunks", 0),
        ])
    csv_bytes = output.getvalue().encode("utf-8-sig")
    from fastapi.responses import Response
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=knowledge_base.csv"},
    )


@app.get("/knowledge/files/{file_name}/chunks")
def knowledge_file_chunks(file_name: str, _=Depends(require_admin)):
    """پیش‌نمایش بخش‌های (chunks) یک فایل دانش."""
    from knowledge_service import load_vector_store
    store = load_vector_store()
    chunks = [
        {
            "index": i,
            "title": item.get("title", ""),
            "category": item.get("category", ""),
            "content": item.get("content", "")[:600],  # limit preview length
        }
        for i, item in enumerate(store)
        if item.get("file_name") == file_name
    ]
    return {"file_name": file_name, "total": len(chunks), "chunks": chunks}


class ChunkUpdateRequest(BaseModel):
    chunk_index: int  # global index in store
    content: str
    title: str | None = None


@app.patch("/knowledge/files/{file_name}/chunks")
def update_knowledge_chunk(file_name: str, body: ChunkUpdateRequest, _=Depends(require_admin)):
    """ویرایش محتوای یک chunk از بانک دانش."""
    from knowledge_service import load_vector_store, save_vector_store, _vs_cache
    store = load_vector_store()

    # Find the nth chunk belonging to this file (body.chunk_index is the global store index)
    idx = body.chunk_index
    if idx < 0 or idx >= len(store):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="chunk not found")
    if store[idx].get("file_name") != file_name:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="chunk does not belong to this file")

    store[idx]["content"] = body.content
    if body.title is not None:
        store[idx]["title"] = body.title

    save_vector_store(store)
    # Bust the in-memory cache by touching the file mtime (save_vector_store already does atomic replace)
    import knowledge_service as _ks
    _ks._vector_cache = None
    _ks._vector_cache_mtime = 0.0

    log_knowledge_action(
        action="chunk_edit",
        file_name=file_name,
        title=store[idx].get("title", ""),
        category=store[idx].get("category", ""),
        detail=f"chunk #{idx} ویرایش شد",
    )

    return {"success": True, "index": idx}


@app.delete("/knowledge/files/{file_name}")
def knowledge_file_delete(file_name: str, _=Depends(require_admin)):
    result = delete_knowledge_file(file_name)
    if result.get("success"):
        log_knowledge_action(
            action="delete",
            file_name=file_name,
            detail=f"{result.get('removed_chunks', 0)} chunk حذف شد",
        )
    return result


@app.get("/knowledge/audit-log")
def knowledge_audit_log(limit: int = 100, action: str = "", _=Depends(require_admin)):
    entries = get_knowledge_audit_log(limit=limit, action_filter=action)
    return {"total": len(entries), "entries": entries}


@app.delete("/knowledge/audit-log")
def knowledge_audit_log_clear(_=Depends(require_admin)):
    deleted = clear_knowledge_audit_log()
    return {"success": True, "deleted": deleted}


@app.delete("/customers/{customer_id}/chat-sessions")
def customer_chat_sessions_delete_all(customer_id: int, _=Depends(require_admin)):
    customer = get_customer_by_id(customer_id)

    if not customer:
        raise HTTPException(status_code=404, detail="مشتری پیدا نشد.")

    deleted_sessions = delete_all_customer_chat_sessions(customer_id)

    return {
        "success": True,
        "message": "همه گفتگوهای مشتری حذف شدند.",
        "deleted_sessions": deleted_sessions,
    }


class KnowledgeSearchRequest(BaseModel):
    message: str
    domain: Optional[str] = "auto"
    history: Optional[List[ChatHistoryMessage]] = None
    category: Optional[str] = None   # filter by category (None = all)
    top_k: Optional[int] = 10        # number of results


@app.post("/knowledge/search", tags=["Knowledge"], summary="Search knowledge base")
def knowledge_search(request: KnowledgeSearchRequest):
    query = request.message
    top_k = max(1, min(request.top_k or 10, 30))

    has_astm_code = bool(re.search(r"\bD\s*\d{3,5}\b", query, flags=re.IGNORECASE))

    if has_astm_code:
        local_results = local_search_knowledge_base(query, top_k=top_k)
        if local_results:
            results = local_results
        else:
            results = search_knowledge_base(query, top_k=top_k)
    else:
        try:
            results = search_knowledge_base(query, top_k=top_k)
        except Exception:
            results = local_search_knowledge_base(query, top_k=top_k)

    # Filter by category if specified
    if request.category and request.category != "all":
        results = [
            item for item in results
            if item.get("category") == request.category
        ]

    return {
        "query": query,
        "total": len(results),
        "results": [
            {
                "title": item["title"],
                "file_name": item["file_name"],
                "category": item["category"],
                "score": float(item.get("score", 0)),
                "content": item["content"][:900],
            }
            for item in results
        ],
    }


@app.get("/questions/recent", tags=["Admin"], summary="Recent questions")
def questions_recent(limit: int = 20, _=Depends(require_admin)):
    return {"questions": get_recent_questions(limit=limit)}


@app.get("/questions/stats", tags=["Admin"], summary="Question statistics")
def questions_stats(_=Depends(require_admin)):
    return get_question_stats()


@app.get("/questions/analytics", tags=["Admin"], summary="Question analytics")
def questions_analytics(days: int = 7):
    return get_question_analytics(days=days)


@app.get("/questions/stats-public")
def questions_stats_public():
    """آمار عمومی بدون نیاز به احراز هویت — برای صفحه Home."""
    stats = get_question_stats()
    feedback = get_feedback_stats()
    return {
        "total_questions": stats.get("total_questions", 0),
        "satisfaction_pct": feedback.get("satisfaction_pct"),
    }


@app.get("/questions")
def questions_all(
    limit: int = 200,
    domain: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    rating: Optional[str] = None,
    _=Depends(require_admin),
):
    return {
        "questions": get_all_questions(
            limit=limit,
            domain=domain,
            date_from=date_from,
            date_to=date_to,
            rating=rating,
        )
    }


@app.get("/questions/{question_id}")
def question_detail(question_id: int, _=Depends(require_admin)):
    question = get_question_by_id(question_id)

    if not question:
        return {"error": "سوال موردنظر پیدا نشد."}

    return question


@app.post("/questions/{question_id}/add-to-knowledge")
def question_add_to_knowledge(question_id: int, _=Depends(require_admin)):
    question = get_question_by_id(question_id)

    if not question:
        raise HTTPException(status_code=404, detail="سوال موردنظر پیدا نشد.")

    if question["expert_status"] != "approved":
        raise HTTPException(
            status_code=422,
            detail="فقط سوالات تاییدشده توسط کارشناس می‌توانند به بانک دانش اضافه شوند.",
        )

    final_answer = question["reviewed_answer"] or question["answer"]

    content = f"""
    پرسش تاییدشده توسط کارشناس آرتین آزما

    حوزه:
    {question["detected_domain"]}

    سوال مشتری:
    {question["question"]}

    پاسخ تاییدشده:
    {final_answer}

    یادداشت داخلی کارشناس:
    {question["expert_note"]}
    """

    result = add_text_to_knowledge_base(
        title=f"FAQ تاییدشده #{question_id} - {question['detected_domain']}",
        content=content,
        category="expert-faq",
        file_name=f"expert_faq_question_{question_id}.txt",
    )

    return result


@app.post("/transcribe", tags=["Analysis"], summary="Transcribe audio to text")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio using OpenAI Whisper - works in Iran unlike Web Speech API."""
    try:
        audio_bytes = await file.read()
        # Use the original filename/extension so Whisper knows the format
        filename = file.filename or "audio.webm"
        import io as _io
        audio_file = _io.BytesIO(audio_bytes)
        audio_file.name = filename
        transcript = ai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_bytes, file.content_type or "audio/webm"),
            language="fa",
        )
        return {"transcript": transcript.text}
    except Exception as e:
        logger.error("Transcription error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-image", tags=["Analysis"], summary="Analyze image with AI")
@limiter.limit("10/minute")
def analyze_image(
    request: Request,
    file: UploadFile = File(...),
    image_type: str = Form("general"),
    user_note: str = Form(""),
):
    # ── File validation ──────────────────────────────────────────────
    safe_filename = make_safe_filename(file.filename or "upload")
    ext = safe_filename.lower().rsplit(".", 1)[-1]
    if ext not in _ALLOWED_IMAGE_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"فرمت .{ext} پشتیبانی نمی‌شود. فرمت‌های مجاز: JPG، PNG، WEBP",
        )

    content = file.file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="حجم فایل بیش از ۲۰ مگابایت است.")

    try:
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)

        file_path = os.path.join(upload_dir, safe_filename)
        file_url = f"/uploads/{safe_filename}"
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        image_type_labels = {
            "general": "تصویر عمومی",
            "device-error": "خطای دستگاه",
            "chromatogram": "کروماتوگرام",
            "chart": "نمودار تست",
            "software-screen": "صفحه نرم‌افزار دستگاه",
            "lab-report": "گزارش تصویری آزمایشگاهی",
        }

        selected_image_type = image_type_labels.get(image_type, "تصویر عمومی")

        combined_note = f"""
        نوع تصویر انتخاب‌شده:
        {selected_image_type}

        توضیح کاربر:
        {user_note if user_note else "توضیحی ارائه نشده است."}

        بر اساس نوع تصویر، تحلیل را دقیق‌تر انجام بده.
        اگر تصویر خطای دستگاه است، علت‌های احتمالی و چک‌لیست عیب‌یابی بده.
        اگر کروماتوگرام است، پیک‌ها، baseline، retention time و مشکلات احتمالی را بررسی کن.
        اگر نمودار تست است، روند، نقاط غیرعادی و تفسیر فنی بده.
        اگر صفحه نرم‌افزار است، پیام‌ها، وضعیت دستگاه و اقدام بعدی را توضیح بده.
        """

        ai_answer = analyze_image_with_ai(file_path, user_note=combined_note)

        return {
            "file_type": ext,
            "file_name": safe_filename,
            "file_url": file_url,
            "image_type": image_type,
            "image_type_label": selected_image_type,
            "ai_analysis": ai_answer,
        }

    except Exception as e:
        return {"error": f"خطا در تحلیل تصویر: {str(e)}"}


@app.post("/memory/search")
def memory_search(request: MemorySearchRequest):
    return {
        "memories": search_user_memories(
            user_id=request.user_id, query=request.query, limit=request.limit
        )
    }


@app.get("/memory/stats/{user_id}")
def memory_stats(user_id: str):
    return get_user_memory_stats(user_id)


@app.post("/customer-requests", tags=["Customers"], summary="Submit inquiry/request")
def create_customer_request(request: CustomerRequestCreate):
    request_id = save_customer_request(
        full_name=request.full_name,
        company=request.company,
        phone=request.phone,
        email=request.email,
        request_type=request.request_type,
        subject=request.subject,
        message=request.message,
    )

    # Telegram notification (fire-and-forget)
    notify_new_request(
        full_name=request.full_name,
        company=request.company or "",
        phone=request.phone or "",
        subject=request.subject or "",
        request_type=request.request_type or "",
    )

    return {
        "success": True,
        "request_id": request_id,
        "message": "درخواست شما با موفقیت ثبت شد. کارشناسان آرتین آزما با شما تماس خواهند گرفت.",
    }


@app.get("/customer-requests", tags=["Admin"], summary="List customer requests")
def customer_requests(limit: int = 100, _=Depends(require_admin)):
    return {"requests": get_customer_requests(limit=limit)}


@app.patch("/customer-requests/{request_id}/status")
def customer_request_status(request_id: int, request: CustomerRequestStatusUpdate, _=Depends(require_admin)):
    updated = update_customer_request_status(
        request_id=request_id, status=request.status
    )

    if not updated:
        return {"success": False, "message": "درخواست موردنظر پیدا نشد."}

    return {"success": True, "message": "وضعیت درخواست بروزرسانی شد."}


@app.get("/customer-requests/stats")
def customer_requests_stats(_=Depends(require_admin)):
    return get_customer_request_stats()


@app.get("/customers/stats")
def customers_stats():
    """آمار مشتریان — بدون نیاز به احراز هویت ادمین."""
    with get_connection() as conn:
        cursor = conn.cursor()
        total_customers = cursor.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
        total_sessions = cursor.execute("SELECT COUNT(*) FROM chat_sessions").fetchone()[0]
        total_messages = cursor.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
        new_requests = cursor.execute(
            "SELECT COUNT(*) FROM customer_requests WHERE status='new'"
        ).fetchone()[0]
    return {
        "total_customers": total_customers,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "new_requests": new_requests,
    }


@app.get("/admin/dashboard-stats")
def admin_dashboard_stats(_=Depends(require_admin)):
    """آمار جامع برای داشبورد ادمین."""
    q_stats = get_question_stats()
    r_stats = get_customer_request_stats()
    q_analytics = get_question_analytics(days=7)
    knowledge_stats_data = get_knowledge_stats()

    # تعداد مشتریان
    with get_connection() as conn:
        cursor = conn.cursor()
        total_customers = cursor.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
        total_sessions = cursor.execute("SELECT COUNT(*) FROM chat_sessions").fetchone()[0]
        total_messages = cursor.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
        new_requests = cursor.execute(
            "SELECT COUNT(*) FROM customer_requests WHERE status='pending'"
        ).fetchone()[0]

    return {
        "questions": {
            "total": q_stats.get("total_questions", 0),
            "today": q_analytics.get("questions_per_day", [{}])[-1].get("count", 0) if q_analytics.get("questions_per_day") else 0,
            "by_intent": q_stats.get("by_intent", []),
            "per_day": q_analytics.get("questions_per_day", []),
            "top_keywords": q_analytics.get("top_keywords", []),
        },
        "customers": {
            "total": total_customers,
            "total_sessions": total_sessions,
            "total_messages": total_messages,
        },
        "requests": {
            "total": r_stats.get("total_requests", 0),
            "pending": new_requests,
            "by_type": r_stats.get("by_type", []),
        },
        "knowledge": {
            "total_chunks": knowledge_stats_data.get("total_chunks", 0),
            "total_files": knowledge_stats_data.get("total_files", 0),
        },
    }


class GDriveSyncScheduleRequest(BaseModel):
    interval_hours: float  # 0 = disabled


@app.get("/admin/gdrive-schedule")
def get_gdrive_schedule(_=Depends(require_admin)):
    """وضعیت تنظیمات زمان‌بندی همزمان‌سازی Google Drive."""
    interval = float(get_setting("gdrive_sync_interval_hours", "0"))
    last_sync = get_setting("gdrive_last_sync", "")
    last_result = get_setting("gdrive_last_sync_result", "")
    return {
        "interval_hours": interval,
        "enabled": interval > 0,
        "last_sync": last_sync,
        "last_sync_result": last_result,
        "folder_id_configured": bool(os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()),
    }


@app.post("/admin/gdrive-schedule")
def set_gdrive_schedule(body: GDriveSyncScheduleRequest, _=Depends(require_admin)):
    """تنظیم زمان‌بندی همزمان‌سازی Google Drive."""
    hours = max(0.0, body.interval_hours)
    set_setting("gdrive_sync_interval_hours", str(hours))
    _schedule_gdrive(hours)
    if hours == 0:
        return {"success": True, "message": "زمان‌بندی همزمان‌سازی غیرفعال شد."}
    return {"success": True, "message": f"همزمان‌سازی هر {hours:.0f} ساعت یک‌بار برنامه‌ریزی شد."}


@app.post("/admin/gdrive-sync-now")
def run_gdrive_sync_now(_=Depends(require_admin)):
    """اجرای فوری همزمان‌سازی Google Drive."""
    folder_id = os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not folder_id:
        raise HTTPException(status_code=400, detail="GOOGLE_DRIVE_ROOT_FOLDER_ID تنظیم نشده است.")
    try:
        result = sync_google_drive_folder(root_folder_id=folder_id, max_files=200, force_resync=False)
        set_setting("gdrive_last_sync", _dt.utcnow().isoformat())
        set_setting("gdrive_last_sync_result", str(result.get("synced_files", 0)) + " فایل")
        return {"success": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class EmailSettingsRequest(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    from_addr: str = ""
    to_addr: str = ""
    weekly_enabled: bool = False


@app.get("/admin/email-settings")
def get_email_settings_endpoint(_=Depends(require_admin)):
    from email_service import get_email_settings
    settings = get_email_settings(get_setting)
    # Never expose smtp_pass in plain text — mask it
    safe = {k: v for k, v in settings.items()}
    if safe.get("smtp_pass"):
        safe["smtp_pass"] = "••••••••"
    return safe


@app.post("/admin/email-settings")
def save_email_settings_endpoint(body: EmailSettingsRequest, _=Depends(require_admin)):
    from email_service import get_email_settings, save_email_settings
    existing = get_email_settings(get_setting)
    new_settings = {
        "smtp_host": body.smtp_host,
        "smtp_port": body.smtp_port,
        "smtp_user": body.smtp_user,
        "from_addr": body.from_addr,
        "to_addr": body.to_addr,
        "weekly_enabled": body.weekly_enabled,
        # Keep existing password if new one is masked placeholder or empty
        "smtp_pass": body.smtp_pass if body.smtp_pass and body.smtp_pass != "••••••••" else existing.get("smtp_pass", ""),
    }
    save_email_settings(set_setting, new_settings)
    return {"success": True, "message": "تنظیمات ایمیل ذخیره شد."}


class TelegramSettingsRequest(BaseModel):
    bot_token: str = ""
    chat_id: str = ""


@app.get("/admin/telegram-settings")
def get_telegram_settings(_=Depends(require_admin)):
    token = get_setting("telegram_bot_token") or ""
    chat_id = get_setting("telegram_chat_id") or ""
    return {
        "bot_token": "••••••••" if token else "",
        "chat_id": chat_id,
        "enabled": bool(token and chat_id),
    }


@app.post("/admin/telegram-settings")
def save_telegram_settings(body: TelegramSettingsRequest, _=Depends(require_admin)):
    existing_token = get_setting("telegram_bot_token") or ""
    new_token = body.bot_token if body.bot_token and body.bot_token != "••••••••" else existing_token
    set_setting("telegram_bot_token", new_token)
    set_setting("telegram_chat_id", body.chat_id)
    # Update in-process env so telegram_service picks it up immediately
    import os as _os
    _os.environ["TELEGRAM_BOT_TOKEN"] = new_token
    _os.environ["TELEGRAM_CHAT_ID"] = body.chat_id
    return {"success": True, "message": "تنظیمات تلگرام ذخیره شد."}


@app.post("/admin/telegram-test")
def test_telegram(_=Depends(require_admin)):
    from telegram_service import send_message, is_enabled
    # Also try loading from DB in case env not set
    token = get_setting("telegram_bot_token") or ""
    chat_id = get_setting("telegram_chat_id") or ""
    if token:
        import os as _os
        _os.environ["TELEGRAM_BOT_TOKEN"] = token
        _os.environ["TELEGRAM_CHAT_ID"] = chat_id or ""
    if not is_enabled():
        return {"success": False, "message": "تلگرام فعال نیست. ابتدا توکن و Chat ID را وارد کنید."}
    send_message("✅ <b>تست اتصال تلگرام آرتین آزما</b>\nاتصال برقرار است!")
    return {"success": True, "message": "پیام آزمایشی ارسال شد."}


@app.post("/admin/send-weekly-report")
def send_weekly_report_now(_=Depends(require_admin)):
    from email_service import get_email_settings, send_weekly_report
    settings = get_email_settings(get_setting)

    # Gather stats
    q_stats = get_question_stats()
    r_stats = get_customer_request_stats()
    k_stats = get_knowledge_stats()

    stats = {
        "total_questions": q_stats.get("total_questions", 0),
        "top_domains": q_stats.get("domains", [])[:5],
        "new_requests": next((s["count"] for s in r_stats.get("statuses", []) if s["status"] == "new"), 0),
        "total_requests": r_stats.get("total_requests", 0),
        "total_files": k_stats.get("total_files", 0),
        "total_chunks": k_stats.get("total_chunks", 0),
    }

    success, message = send_weekly_report(settings, stats)
    if success:
        set_setting("email_last_sent", _dt.utcnow().isoformat())
    return {"success": success, "message": message}


@app.get("/admin/questions/export-csv")
def export_questions_csv(_=Depends(require_admin)):
    """خروجی CSV از همه سوالات برای دانلود Excel."""
    import csv, io
    questions = get_all_questions(limit=5000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["شناسه", "سوال", "حوزه", "وضعیت بررسی", "تاریخ ثبت"])
    for q in questions:
        writer.writerow([
            q.get("id", ""),
            q.get("question", ""),
            q.get("detected_domain", ""),
            q.get("expert_status", "pending"),
            q.get("created_at", ""),
        ])
    csv_bytes = output.getvalue().encode("utf-8-sig")  # utf-8-sig for Excel BOM
    from fastapi.responses import Response
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=questions.csv"},
    )


@app.get("/admin/report/export")
def admin_export_report(period: str = "week", _=Depends(require_admin)):
    """گزارش خلاصه هفتگی/ماهانه: سوالات، مشتریان، درخواست‌ها — خروجی CSV."""
    import csv, io
    from datetime import timedelta

    now = datetime.utcnow()
    if period == "month":
        cutoff = now - timedelta(days=30)
        label = "ماهانه (۳۰ روز)"
    else:
        cutoff = now - timedelta(days=7)
        label = "هفتگی (۷ روز)"

    cutoff_str = cutoff.strftime("%Y-%m-%d")

    conn = get_connection()
    c = conn.cursor()

    # Questions by domain
    c.execute("""
        SELECT detected_domain, COUNT(*) as cnt
        FROM expert_questions
        WHERE created_at >= ?
        GROUP BY detected_domain
        ORDER BY cnt DESC
    """, (cutoff_str,))
    domain_rows = c.fetchall()

    # Total questions
    total_q = c.execute("SELECT COUNT(*) FROM expert_questions WHERE created_at >= ?", (cutoff_str,)).fetchone()[0]

    # New customers
    total_cust = c.execute("SELECT COUNT(*) FROM customers WHERE created_at >= ?", (cutoff_str,)).fetchone()[0]

    # Requests
    total_req = c.execute("SELECT COUNT(*) FROM customer_requests WHERE created_at >= ?", (cutoff_str,)).fetchone()[0]
    pending_req = c.execute("SELECT COUNT(*) FROM customer_requests WHERE created_at >= ? AND status='new'", (cutoff_str,)).fetchone()[0]

    # Chat messages
    total_msg = c.execute("SELECT COUNT(*) FROM chat_messages WHERE created_at >= ?", (cutoff_str,)).fetchone()[0]

    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["گزارش آرتین آزما", label])
    writer.writerow([])
    writer.writerow(["خلاصه کلی", ""])
    writer.writerow(["تعداد سوالات جدید", total_q])
    writer.writerow(["تعداد مشتریان جدید", total_cust])
    writer.writerow(["تعداد درخواست‌های جدید", total_req])
    writer.writerow(["درخواست‌های در انتظار", pending_req])
    writer.writerow(["تعداد پیام‌های چت", total_msg])
    writer.writerow([])
    writer.writerow(["سوالات بر اساس حوزه", "تعداد"])
    for row in domain_rows:
        writer.writerow([row["detected_domain"] or "نامشخص", row["cnt"]])

    csv_bytes = output.getvalue().encode("utf-8-sig")
    from fastapi.responses import Response
    filename = f"artin-report-{period}-{now.strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/admin/customers")
def admin_list_customers(
    limit: int = 200,
    offset: int = 0,
    _=Depends(require_admin),
):
    """لیست همه مشتریان برای ادمین."""
    return get_all_customers(limit=limit, offset=offset)


@app.get("/admin/customers/{customer_id}/sessions")
def admin_customer_sessions(customer_id: int, _=Depends(require_admin)):
    """لیست جلسات چت یک مشتری."""
    sessions = get_customer_sessions(customer_id)
    return {"sessions": sessions, "total": len(sessions)}


@app.get("/admin/search")
def admin_global_search(q: str = "", limit: int = 5, _=Depends(require_admin)):
    """جستجوی سراسری ادمین در سوالات، مشتریان و درخواست‌ها."""
    q = q.strip().lower()
    if not q or len(q) < 2:
        return {"questions": [], "customers": [], "requests": []}

    # Search questions
    all_questions = get_all_questions(limit=500)
    matched_questions = [
        {"id": item["id"], "question": item["question"], "detected_domain": item.get("detected_domain", ""), "created_at": item.get("created_at", "")}
        for item in all_questions
        if q in (item.get("question") or "").lower() or q in str(item.get("id", ""))
    ][:limit]

    # Search customers
    all_customers = get_all_customers(limit=500)
    matched_customers = [
        {"id": item["id"], "full_name": item["full_name"], "email": item.get("email", ""), "company": item.get("company", "")}
        for item in all_customers
        if q in (item.get("full_name") or "").lower()
        or q in (item.get("email") or "").lower()
        or q in (item.get("company") or "").lower()
        or q in str(item.get("id", ""))
    ][:limit]

    # Search customer requests
    all_requests = get_customer_requests(limit=500)
    matched_requests = [
        {"id": item["id"], "full_name": item["full_name"], "subject": item.get("subject", ""), "status": item.get("status", ""), "created_at": item.get("created_at", "")}
        for item in all_requests
        if q in (item.get("full_name") or "").lower()
        or q in (item.get("subject") or "").lower()
        or q in (item.get("message") or "").lower()
        or q in str(item.get("id", ""))
    ][:limit]

    return {"questions": matched_questions, "customers": matched_customers, "requests": matched_requests}


@app.post("/admin/customers/{customer_id}/block")
def admin_block_customer(customer_id: int, _=Depends(require_admin)):
    """بلاک کردن حساب مشتری."""
    ok = set_customer_blocked(customer_id, True)
    return {"success": ok}


@app.post("/admin/customers/{customer_id}/unblock")
def admin_unblock_customer(customer_id: int, _=Depends(require_admin)):
    """فعال‌سازی مجدد حساب مشتری."""
    ok = set_customer_blocked(customer_id, False)
    return {"success": ok}


class CustomerNotifyRequest(BaseModel):
    message: str


@app.post("/admin/customers/{customer_id}/notify")
def admin_notify_customer(customer_id: int, body: CustomerNotifyRequest, _=Depends(require_admin)):
    """ارسال اعلان داخل اپ برای یک مشتری."""
    if not body.message.strip():
        return {"success": False, "message": "متن پیام نمی‌تواند خالی باشد."}
    nid = save_customer_notification(customer_id, body.message.strip())
    # Also send push notification if configured
    push_sent = 0
    if is_push_configured():
        push_sent = send_push_to_customer(
            customer_id,
            title="آرتین آزما",
            body=body.message.strip()[:200],
        )
    return {"success": True, "notification_id": nid, "push_sent": push_sent}


@app.get("/customers/{customer_id}/notifications")
def customer_notifications(customer_id: int, unread_only: bool = False, current_user: dict = Depends(get_current_customer)):
    """فهرست اعلان‌های یک مشتری — نیاز به توکن JWT دارد."""
    require_customer_match(current_user["customer_id"], customer_id)
    notifs = get_customer_notifications(customer_id, unread_only=unread_only)
    unread_count = get_unread_notification_count(customer_id)
    return {"notifications": notifs, "unread_count": unread_count}


@app.post("/customers/{customer_id}/notifications/read")
def mark_customer_notifications_read(customer_id: int, current_user: dict = Depends(get_current_customer)):
    """علامت‌گذاری همه اعلان‌های یک مشتری به عنوان خوانده‌شده."""
    require_customer_match(current_user["customer_id"], customer_id)
    mark_notifications_read(customer_id)
    return {"success": True}


# ── Push Notification Endpoints ──────────────────────────────────────────────

class PushSubscribeRequest(BaseModel):
    customer_id: int
    subscription: dict


@app.post("/customers/push-subscribe", tags=["Notifications"], summary="Subscribe to push notifications")
def push_subscribe(body: PushSubscribeRequest, current_user: dict = Depends(get_current_customer)):
    """ثبت اشتراک Push Notification برای مشتری — نیاز به توکن JWT."""
    require_customer_match(current_user["customer_id"], body.customer_id)
    sub_id = save_push_subscription(body.customer_id, body.subscription)
    return {"success": True, "subscription_id": sub_id}


class PushUnsubscribeRequest(BaseModel):
    customer_id: int


@app.post("/customers/push-unsubscribe", tags=["Notifications"], summary="Unsubscribe from push notifications")
def push_unsubscribe(body: PushUnsubscribeRequest, current_user: dict = Depends(get_current_customer)):
    """لغو اشتراک Push Notification مشتری — نیاز به توکن JWT."""
    require_customer_match(current_user["customer_id"], body.customer_id)
    remove_push_subscription(body.customer_id)
    return {"success": True}


@app.get("/push/status", tags=["Notifications"], summary="Check push notification configuration")
def push_status():
    """بررسی وضعیت پیکربندی Push Notification."""
    return {"configured": is_push_configured()}




@app.get("/csrf-token", tags=["Security"], summary="Get CSRF token")
def get_csrf_token(request: Request):
    """دریافت توکن CSRF برای فرم‌های فرانت‌اند."""
    token = request.cookies.get("artin_csrf", "")
    if not token:
        token = generate_csrf_token()
    return {"csrf_token": token}

@app.get("/admin/response-time-stats", tags=["Admin"], summary="Response time statistics")
def admin_response_time_stats(days: int = 30, _=Depends(require_admin)):
    """آمار زمان پاسخ‌دهی AI — میانگین، حداقل و حداکثر."""
    return get_response_time_stats(days)


@app.get("/system/status")
def system_status(check_ai: bool = False):
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    knowledge_stats_data = get_knowledge_stats()

    openai_configured = bool(
        openai_key
        and openai_key != "test_offline_mode"
        and not openai_key.startswith("x-")
    )

    ai_status = "not_checked"
    ai_error = ""

    if check_ai:
        if not openai_configured:
            ai_status = "not_configured"
            ai_error = (
                "OPENAI_API_KEY تنظیم نشده یا عمداً برای حالت آفلاین غیرفعال شده است."
            )
        else:
            try:
                test_answer = ask_expert_assistant(
                    message="فقط کلمه OK را برگردان.",
                    context="",
                    history=[],
                    domain="health-check",
                )

                if test_answer:
                    ai_status = "connected"
                else:
                    ai_status = "unknown"
                    ai_error = "پاسخ خالی از سرویس AI دریافت شد."

            except Exception as e:
                ai_status = "failed"
                ai_error = str(e)

    return {
        "backend_status": "running",
        "openai_configured": openai_configured,
        "openai_status": ai_status,
        "openai_error": ai_error,
        "local_fallback_enabled": True,
        "knowledge_stats": knowledge_stats_data,
    }


@app.post("/customers/register", tags=["Customers"], summary="Register new customer")
@limiter.limit("5/minute")
def customer_register(body: CustomerRegisterRequest, request: Request):
    if not body.full_name.strip():
        return {"success": False, "message": "نام و نام خانوادگی الزامی است."}

    if not body.email.strip():
        return {"success": False, "message": "ایمیل الزامی است."}

    if len(body.password) < 6:
        return {"success": False, "message": "رمز عبور باید حداقل ۶ کاراکتر باشد."}

    result = create_customer(
        full_name=body.full_name,
        email=body.email,
        password=body.password,
        company=body.company,
        phone=body.phone,
    )

    if not result.get("success"):
        return result

    customer = get_customer_by_id(result["customer_id"])

    # Telegram notification (fire-and-forget)
    notify_new_customer(
        full_name=body.full_name,
        email=body.email,
        company=body.company or "",
    )

    token = create_access_token(customer_id=result["customer_id"], email=body.email)

    return {
        "success": True,
        "message": "ثبت‌نام با موفقیت انجام شد.",
        "customer": customer,
        "access_token": token,
        "token_type": "bearer",
    }


@app.post("/customers/login", tags=["Customers"], summary="Customer login")
@limiter.limit("10/minute")
def customer_login(body: CustomerLoginRequest, request: Request):
    ip = request.client.host if request.client else "unknown"

    # Brute force protection
    if login_tracker.is_locked(ip):
        remaining = login_tracker.get_remaining_lockout(ip)
        return {
            "success": False,
            "message": f"تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً {remaining // 60} دقیقه صبر کنید.",
            "locked": True,
            "retry_after": remaining,
        }

    customer = authenticate_customer(email=body.email, password=body.password)

    if not customer:
        login_tracker.record_failure(ip)
        return {"success": False, "message": "ایمیل یا رمز عبور اشتباه است."}

    if customer.get("blocked"):
        return {"success": False, "message": "حساب شما مسدود شده است. لطفاً با پشتیبانی تماس بگیرید."}

    login_tracker.record_success(ip)
    token = create_access_token(customer_id=customer["id"], email=customer["email"])

    return {
        "success": True,
        "message": "ورود با موفقیت انجام شد.",
        "customer": customer,
        "access_token": token,
        "token_type": "bearer",
    }


@app.get("/customers/{customer_id}", tags=["Customers"], summary="Get customer profile")
def customer_profile(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    customer = get_customer_by_id(customer_id)

    if not customer:
        return {"success": False, "message": "مشتری پیدا نشد."}

    return {"success": True, "customer": customer}


@app.patch("/customers/{customer_id}", tags=["Customers"], summary="Update customer profile")
def customer_profile_update(customer_id: int, request: CustomerProfileUpdateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    updated_customer = update_customer_profile(
        customer_id=customer_id,
        full_name=request.full_name,
        company=request.company,
        phone=request.phone,
    )

    if not updated_customer:
        return {"success": False, "message": "مشتری پیدا نشد یا نام وارد نشده است."}

    return {
        "success": True,
        "message": "اطلاعات حساب با موفقیت بروزرسانی شد.",
        "customer": updated_customer,
    }


@app.post("/customers/{customer_id}/change-password", tags=["Customers"], summary="Change password")
def customer_change_password(customer_id: int, request: CustomerChangePasswordRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    result = change_customer_password(
        customer_id=customer_id,
        current_password=request.current_password,
        new_password=request.new_password,
    )
    return result


@app.get("/customers/{customer_id}/chat-sessions", tags=["Chat Sessions"], summary="List chat sessions")
def customer_chat_sessions(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    return {"success": True, "sessions": get_customer_chat_sessions(customer_id)}


@app.post("/customers/chat-sessions", tags=["Chat Sessions"], summary="Create chat session")
def customer_chat_session_create(request: CustomerSessionCreateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], request.customer_id)

    session_id = create_chat_session(
        customer_id=request.customer_id, title=request.title.strip() or "گفتگوی جدید"
    )

    return {"success": True, "session_id": session_id}




@app.get("/customers/{customer_id}/analytics")
def customer_analytics(customer_id: int, current_user: dict = Depends(get_current_customer)):
    """آمار کلی حساب مشتری: تعداد گفتگوها، پیام‌ها، آخرین فعالیت."""
    require_customer_match(current_user["customer_id"], customer_id)
    conn = get_connection()
    try:
        sessions = conn.execute(
            "SELECT COUNT(*) as cnt FROM chat_sessions WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()
        messages = conn.execute(
            "SELECT COUNT(*) as cnt FROM chat_messages cm JOIN chat_sessions cs ON cm.session_id = cs.id WHERE cs.customer_id = ?",
            (customer_id,),
        ).fetchone()
        last_activity = conn.execute(
            "SELECT MAX(updated_at) as last FROM chat_sessions WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()
        return {
            "success": True,
            "total_sessions": sessions["cnt"] if sessions else 0,
            "total_messages": messages["cnt"] if messages else 0,
            "last_activity": last_activity["last"] if last_activity else None,
        }
    finally:
        conn.close()

@app.get("/customers/{customer_id}/chat-sessions/{session_id}/messages")
def customer_chat_session_messages(customer_id: int, session_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)

    return {
        "success": True,
        "messages": get_chat_messages(session_id=session_id, customer_id=customer_id),
    }


@app.post("/customers/chat-messages")
def customer_chat_message_create(request: CustomerChatMessageCreateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], request.customer_id)

    message_id = save_chat_message(
        session_id=request.session_id,
        role=request.role,
        content=request.content,
        metadata=request.metadata,
    )

    return {"success": True, "message_id": message_id}


@app.patch("/customers/chat-sessions/{session_id}")
def customer_chat_session_update(
    session_id: int, request: CustomerSessionUpdateRequest, current_user: dict = Depends(get_current_customer)
):
    require_customer_match(current_user["customer_id"], request.customer_id)

    updated = update_chat_session_title(
        session_id=session_id, customer_id=request.customer_id, title=request.title
    )

    if not updated:
        return {"success": False, "message": "گفتگوی موردنظر پیدا نشد."}

    return {"success": True, "message": "نام گفتگو تغییر کرد."}


@app.delete("/customers/{customer_id}/chat-sessions/{session_id}")
def customer_chat_session_delete(customer_id: int, session_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)

    deleted = delete_chat_session(session_id=session_id, customer_id=customer_id)

    if not deleted:
        return {"success": False, "message": "گفتگوی موردنظر پیدا نشد."}

    return {"success": True, "message": "گفتگو حذف شد."}


class SuggestQuestionsRequest(BaseModel):
    question: str
    answer: str
    domain: str = "auto"


@app.post("/chat/suggest-questions")
def suggest_questions(body: SuggestQuestionsRequest):
    """سه سوال پیشنهادی مرتبط بر اساس سوال و پاسخ قبلی."""
    prompt = f"""بر اساس سوال و پاسخ زیر، دقیقاً ۳ سوال کوتاه و مرتبط فنی/تخصصی در حوزه آزمایشگاه، صنعت نفت، پتروشیمی، کاتالیست یا تجهیزات پیشنهاد بده.

سوال کاربر: {body.question}

پاسخ آرتین (خلاصه): {body.answer[:500]}

خروجی فقط یک JSON آرایه با ۳ رشته باشد، بدون توضیح اضافه:
["سوال اول؟", "سوال دوم؟", "سوال سوم؟"]
"""
    try:
        raw = ask_expert_assistant(
            message=prompt,
            context="",
            history=[],
            domain=body.domain,
            allow_web_search=False,
        )
        # استخراج JSON از پاسخ
        import re as _re
        match = _re.search(r'\[.*?\]', raw, _re.DOTALL)
        if match:
            import json as _j
            questions = _j.loads(match.group())
            return {"questions": questions[:3]}
        return {"questions": []}
    except Exception:
        return {"questions": []}


@app.post("/knowledge/index-artinazma-site")
def index_artinazma_site(force: bool = False):
    return rebuild_artinazma_index(force=force)


@app.get("/knowledge/artinazma-site-index")
def artinazma_site_index_status():
    index_data = load_index()

    return {
        "count": len(index_data.get("items", [])),
        "created_at": index_data.get("created_at", 0),
        "base_url": index_data.get("base_url", ""),
    }


@app.get("/admin/cache/stats")
def cache_stats(_=Depends(require_admin)):
    """آمار cache پاسخ‌های آرتین (هر دو لایه)."""
    stream_stats = _response_cache.stats()          # stream/pipeline cache (main.py)
    ai_stats     = _get_ai_cache_stats()            # ai_service response cache
    return {
        "stream_cache":  stream_stats,
        "response_cache": ai_stats,
        # aggregate for quick display
        "total_entries":  ai_stats["size"],
        "max_entries":    ai_stats["max_size"],
        "fill_pct":       ai_stats["fill_pct"],
        "ttl_hours":      ai_stats["ttl_hours"],
    }


@app.post("/admin/cache/clear")
def cache_clear(_=Depends(require_admin)):
    """پاک کردن cache پاسخ‌های آرتین."""
    _response_cache.invalidate()
    return {"success": True, "message": "Cache پاک شد."}
