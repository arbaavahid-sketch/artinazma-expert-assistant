import os
import time
import logging
import smtplib

from fastapi import APIRouter, Request
from datetime import datetime, timezone

from ai_service import ask_expert_assistant
from knowledge_service import get_knowledge_stats
from db_service import get_connection, get_response_time_stats, get_setting
from push_service import is_push_configured
from security_middleware import generate_csrf_token
from utils.deps import require_admin
from fastapi import Depends
from email_service import get_email_settings

logger = logging.getLogger("artin_scheduler")

router = APIRouter()


@router.get("/")
def home():
    return {"message": "ArtinAzma Expert Assistant API is running"}


@router.get("/health", tags=["Settings"], summary="Health check")
def health_check():
    """بررسی سلامت سرویس: دیتابیس + OpenAI."""
    start = time.monotonic()
    status = {"ok": True, "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(), "checks": {}}

    # DB check
    conn = None
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        status["checks"]["database"] = {"ok": True}
    except Exception as e:
        status["checks"]["database"] = {"ok": False, "error": str(e)}
        status["ok"] = False
    finally:
        if conn is not None:
            conn.close()

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


def _service_check(ok: bool, status: str, **extra):
    return {"ok": ok, "status": status, **extra}


def _check_google_drive_config():
    folder_id = os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    service_account_json = os.getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON", "").strip()
    service_account_file = os.getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE", "").strip()
    configured = bool(folder_id and (service_account_json or service_account_file))

    details = {
        "configured": configured,
        "folder_configured": bool(folder_id),
        "credential_source": "json" if service_account_json else ("file" if service_account_file else "none"),
    }

    if service_account_file:
      details["service_account_file_exists"] = os.path.exists(service_account_file)

    if not configured:
        return _service_check(False, "not_configured", **details)

    return _service_check(True, "configured", **details)


def _check_email_config(check_external: bool):
    settings = get_email_settings(get_setting)
    smtp_host = (settings.get("smtp_host") or "").strip()
    smtp_port = int(settings.get("smtp_port") or 587)
    smtp_user = (settings.get("smtp_user") or "").strip()
    smtp_pass = (settings.get("smtp_pass") or "").strip()
    from_addr = (settings.get("from_addr") or smtp_user).strip()
    to_addr = (settings.get("to_addr") or "").strip()
    configured = bool(smtp_host and from_addr and to_addr)

    details = {
        "configured": configured,
        "smtp_host_configured": bool(smtp_host),
        "smtp_port": smtp_port if smtp_host else None,
        "smtp_user_configured": bool(smtp_user),
        "smtp_password_configured": bool(smtp_pass),
        "from_addr_configured": bool(from_addr),
        "to_addr_configured": bool(to_addr),
    }

    if not configured:
        return _service_check(False, "not_configured", **details)

    if not check_external:
        return _service_check(True, "configured", **details)

    try:
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.ehlo()
            server.starttls()

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.quit()
        return _service_check(True, "connected", **details)
    except Exception as exc:
        return _service_check(False, "failed", error=str(exc), **details)


@router.get("/admin/deep-health", tags=["Admin"], summary="Deep dependency health check")
def admin_deep_health(check_external: bool = False, _=Depends(require_admin)):
    """Admin-only deep health check without exposing secrets."""
    started = time.monotonic()
    checks = {}

    conn = None
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        checks["database"] = _service_check(True, "connected")
    except Exception as exc:
        checks["database"] = _service_check(False, "failed", error=str(exc))
    finally:
        if conn is not None:
            conn.close()

    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    openai_configured = bool(openai_key and not openai_key.startswith("x-") and openai_key != "test_offline_mode")
    if not openai_configured:
        checks["openai"] = _service_check(False, "not_configured", configured=False)
    elif not check_external:
        checks["openai"] = _service_check(True, "configured", configured=True)
    else:
        try:
            answer = ask_expert_assistant(
                message="Return only OK.",
                context="",
                history=[],
                domain="health-check",
            )
            checks["openai"] = _service_check(bool(answer), "connected" if answer else "empty_response", configured=True)
        except Exception as exc:
            checks["openai"] = _service_check(False, "failed", configured=True, error=str(exc))

    import qdrant_service as _qs
    if _qs.is_enabled():
        try:
            qdrant_stats = _qs.collection_stats()
            qdrant_backend_status = qdrant_stats.pop("status", "")
            checks["qdrant"] = _service_check(
                True,
                "connected",
                enabled=True,
                qdrant_status=qdrant_backend_status,
                **qdrant_stats,
            )
        except Exception as exc:
            checks["qdrant"] = _service_check(False, "failed", enabled=True, error=str(exc))
    else:
        checks["qdrant"] = _service_check(True, "disabled", enabled=False, backend="json")

    checks["google_drive"] = _check_google_drive_config()
    checks["email"] = _check_email_config(check_external=check_external)

    ok = all(item.get("ok") for item in checks.values())
    return {
        "ok": ok,
        "check_external": check_external,
        "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
        "response_ms": round((time.monotonic() - started) * 1000, 2),
        "checks": checks,
    }


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
