import os
import threading
import logging
import logging.handlers
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime as _dt

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from db_service import init_db, get_setting, set_setting
from ws_chat import router as ws_router
from security_middleware import CSRFMiddleware, SmartRateLimitMiddleware
from google_drive_service import sync_google_drive_folder

from utils.deps import limiter
from routes.chat import router as chat_router, _response_cache
from routes.knowledge import router as knowledge_router
from routes.analysis import router as analysis_router
from routes.health import router as health_router
from routes.questions import router as questions_router
from routes.customers import router as customers_router
from routes.admin import router as admin_router, set_response_cache, set_schedule_gdrive

import time as _time

# ── Prometheus metrics ────────────────────────────────────────────────────────
from prometheus_fastapi_instrumentator import Instrumentator as _PFI
from metrics_service import refresh_knowledge_gauge as _refresh_knowledge_gauge

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
    maxBytes=5 * 1024 * 1024,
    backupCount=3,
    encoding="utf-8",
)
_file_handler.setLevel(logging.WARNING)
_file_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
)
logging.getLogger().addHandler(_file_handler)
logging.getLogger().setLevel(logging.INFO)
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
    _refresh_knowledge_gauge()   # seed the knowledge-chunks gauge on startup
    yield
    # shutdown
    with _gdrive_lock:
        if _gdrive_timer is not None:
            _gdrive_timer.cancel()


app = FastAPI(
    title="ArtinAzma Expert Assistant API",
    description=(
        "سامانه دستیار هوشمند آرتین آزما مهر — API برای چت تخصصی، "
        "مدیریت بانک دانش، تحلیل فایل، مدیریت مشتریان و پنل ادمین.\n\n"
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

# ── Share runtime objects with admin router ───────────────────────────────────
set_response_cache(_response_cache)
set_schedule_gdrive(_schedule_gdrive)

# ── Static files & DB init ────────────────────────────────────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
init_db()

# ── Load Telegram settings from DB into env ───────────────────────────────────
_tg_token = get_setting("telegram_bot_token") or ""
_tg_chat = get_setting("telegram_chat_id") or ""
if _tg_token and not os.getenv("TELEGRAM_BOT_TOKEN"):
    os.environ["TELEGRAM_BOT_TOKEN"] = _tg_token
if _tg_chat and not os.getenv("TELEGRAM_CHAT_ID"):
    os.environ["TELEGRAM_CHAT_ID"] = _tg_chat

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
frontend_origins = os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
)
allowed_origins = [
    origin.strip() for origin in frontend_origins.split(",") if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Key", "X-Requested-With", "X-CSRF-Token"],
)

# ── WebSocket Router ──────────────────────────────────────────────────────────

app.include_router(ws_router)

# ── Security Middleware ───────────────────────────────────────────────────────
app.add_middleware(CSRFMiddleware)
app.add_middleware(SmartRateLimitMiddleware)

# ── Request Logging Middleware ────────────────────────────────────────────────
_request_logger = logging.getLogger("artin.requests")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = _time.monotonic()
    response = await call_next(request)
    duration_ms = round((_time.monotonic() - start) * 1000)
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

# ── Prometheus instrumentation (/metrics endpoint) ──────────────────────────
# /metrics is NOT routed through nginx — Prometheus scrapes it directly
# via the internal Docker network (backend:8000/metrics).
_PFI().instrument(app).expose(app, include_in_schema=False, tags=["Monitoring"])

# ── Route Includes ────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(knowledge_router)
app.include_router(analysis_router)
app.include_router(questions_router)
app.include_router(customers_router)
app.include_router(admin_router)
