import os
import time
import logging

from fastapi import APIRouter, Request
from datetime import datetime

from ai_service import ask_expert_assistant
from knowledge_service import get_knowledge_stats
from db_service import get_connection, get_response_time_stats
from push_service import is_push_configured
from security_middleware import generate_csrf_token
from utils.deps import require_admin
from fastapi import Depends

logger = logging.getLogger("artin_scheduler")

router = APIRouter()


@router.get("/")
def home():
    return {"message": "ArtinAzma Expert Assistant API is running"}


@router.get("/health", tags=["Settings"], summary="Health check")
def health_check():
    """بررسی سلامت سرویس: دیتابیس + OpenAI."""
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


@router.get("/system/status")
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


@router.get("/csrf-token", tags=["Security"], summary="Get CSRF token")
def get_csrf_token(request: Request):
    """دریافت توکن CSRF برای فرم‌های فرانت‌اند."""
    token = request.cookies.get("artin_csrf", "")
    if not token:
        token = generate_csrf_token()
    return {"csrf_token": token}


@router.get("/push/status", tags=["Notifications"], summary="Check push notification configuration")
def push_status():
    """بررسی وضعیت پیکربندی Push Notification."""
    return {"configured": is_push_configured()}


@router.get("/admin/response-time-stats", tags=["Admin"], summary="Response time statistics")
def admin_response_time_stats(days: int = 30, _=Depends(require_admin)):
    """آمار زمان پاسخ‌دهی AI — میانگین، حداقل و حداکثر."""
    return get_response_time_stats(days)
