import os
import logging
import json
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from datetime import datetime as _dt
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from repositories.admin_audit_repo import get_admin_audit_log, clear_admin_audit_log
from fastapi.responses import Response

from schemas.models import (
    GDriveSyncScheduleRequest,
    EmailSettingsRequest,
    TelegramSettingsRequest,
    CustomerNotifyRequest,
)
from utils.deps import require_admin
from repositories.requests_repo import normalize_request_status

from db_service import (
    get_connection,
    get_setting,
    set_setting,
    get_question_stats,
    get_question_analytics,
    get_knowledge_gap_report,
    get_customer_request_stats,
    get_customer_requests,
    get_all_questions,
    get_all_customers,
    get_customer_sessions,
    set_customer_blocked,
    set_customer_approval_status,
    save_customer_notification,
    get_customer_by_id,
)
from knowledge_service import get_knowledge_stats
from google_drive_service import sync_google_drive_folder
from push_service import send_push_to_customer, is_push_configured
from ai_service import get_response_cache_stats as _get_ai_cache_stats

logger = logging.getLogger("artin_scheduler")

router = APIRouter()

# Reference to _response_cache and _schedule_gdrive will be injected at import time
# via a setter called from main.py after both are created.
_response_cache = None
_schedule_gdrive_fn = None


def set_response_cache(cache):
    global _response_cache
    _response_cache = cache


def set_schedule_gdrive(fn):
    global _schedule_gdrive_fn
    _schedule_gdrive_fn = fn


def _parse_log_line(line: str) -> dict:
    try:
        data = json.loads(line)
        return {
            "ts": data.get("ts", ""),
            "level": data.get("level", ""),
            "logger": data.get("logger", ""),
            "msg": data.get("msg", ""),
            "endpoint": data.get("endpoint", ""),
            "status_code": data.get("status_code"),
            "duration_ms": data.get("duration_ms"),
            "exc": data.get("exc", ""),
            "raw": "",
        }
    except json.JSONDecodeError:
        return {
            "ts": "",
            "level": "",
            "logger": "",
            "msg": line.strip(),
            "endpoint": "",
            "status_code": None,
            "duration_ms": None,
            "exc": "",
            "raw": line.strip(),
        }


def _read_recent_error_logs(limit: int = 100, level: str = "") -> dict:
    log_path = Path(os.getenv("LOG_FILE", "storage/app.log"))
    requested_limit = max(1, min(limit, 500))
    selected_level = level.strip().upper()
    allowed_levels = {"", "WARNING", "ERROR", "CRITICAL"}
    if selected_level not in allowed_levels:
        selected_level = ""

    if not log_path.exists():
        return {
            "entries": [],
            "count": 0,
            "summary": {"WARNING": 0, "ERROR": 0, "CRITICAL": 0},
            "log_file": str(log_path),
            "log_file_exists": False,
            "sentry_enabled": bool(os.getenv("SENTRY_DSN", "").strip()),
        }

    try:
        lines = log_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not read log file: {exc}") from exc

    entries = [_parse_log_line(line) for line in lines[-2000:] if line.strip()]
    summary = {"WARNING": 0, "ERROR": 0, "CRITICAL": 0}
    filtered = []

    for entry in reversed(entries):
        entry_level = str(entry.get("level") or "").upper()
        if entry_level in summary:
            summary[entry_level] += 1
        if selected_level and entry_level != selected_level:
            continue
        filtered.append(entry)
        if len(filtered) >= requested_limit:
            break

    return {
        "entries": filtered,
        "count": len(filtered),
        "summary": summary,
        "log_file": str(log_path),
        "log_file_exists": True,
        "sentry_enabled": bool(os.getenv("SENTRY_DSN", "").strip()),
    }


@router.get("/admin/dashboard-stats")
def admin_dashboard_stats(_=Depends(require_admin)):
    """آمار جامع برای داشبورد ادمین."""
    q_stats = get_question_stats()
    r_stats = get_customer_request_stats()
    q_analytics = get_question_analytics(days=7)
    knowledge_stats_data = get_knowledge_stats()

    with get_connection() as conn:
        cursor = conn.cursor()
        total_customers = cursor.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
        total_sessions = cursor.execute("SELECT COUNT(*) FROM chat_sessions").fetchone()[0]
        total_messages = cursor.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
        new_requests = cursor.execute(
            "SELECT COUNT(*) FROM customer_requests WHERE status='new'"
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


@router.get("/admin/gdrive-schedule")
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


@router.post("/admin/gdrive-schedule")
def set_gdrive_schedule(body: GDriveSyncScheduleRequest, _=Depends(require_admin)):
    """تنظیم زمان‌بندی همزمان‌سازی Google Drive."""
    hours = max(0.0, body.interval_hours)
    set_setting("gdrive_sync_interval_hours", str(hours))
    if _schedule_gdrive_fn:
        _schedule_gdrive_fn(hours)
    if hours == 0:
        return {"success": True, "message": "زمان‌بندی همزمان‌سازی غیرفعال شد."}
    return {"success": True, "message": f"همزمان‌سازی هر {hours:.0f} ساعت یک‌بار برنامه‌ریزی شد."}


@router.post("/admin/gdrive-sync-now")
def run_gdrive_sync_now(_=Depends(require_admin)):
    """اجرای فوری همزمان‌سازی Google Drive."""
    folder_id = os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    if not folder_id:
        raise HTTPException(status_code=400, detail="GOOGLE_DRIVE_ROOT_FOLDER_ID تنظیم نشده است.")
    try:
        result = sync_google_drive_folder(root_folder_id=folder_id, max_files=200, force_resync=False)
        set_setting("gdrive_last_sync", _dt.now(timezone.utc).replace(tzinfo=None).isoformat())
        set_setting("gdrive_last_sync_result", str(result.get("synced_files", 0)) + " فایل")
        return {"success": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/admin/email-settings")
def get_email_settings_endpoint(_=Depends(require_admin)):
    from email_service import get_email_settings
    settings = get_email_settings(get_setting)
    safe = {k: v for k, v in settings.items()}
    if safe.get("smtp_pass"):
        safe["smtp_pass"] = "••••••••"
    return safe


@router.post("/admin/email-settings")
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
        "request_alerts_enabled": body.request_alerts_enabled,
        "smtp_pass": body.smtp_pass if body.smtp_pass and body.smtp_pass != "••••••••" else existing.get("smtp_pass", ""),
    }
    save_email_settings(set_setting, new_settings)
    return {"success": True, "message": "تنظیمات ایمیل ذخیره شد."}


@router.get("/admin/telegram-settings")
def get_telegram_settings(_=Depends(require_admin)):
    token = get_setting("telegram_bot_token") or ""
    chat_id = get_setting("telegram_chat_id") or ""
    return {
        "bot_token": "••••••••" if token else "",
        "chat_id": chat_id,
        "enabled": bool(token and chat_id),
    }


@router.post("/admin/telegram-settings")
def save_telegram_settings(body: TelegramSettingsRequest, _=Depends(require_admin)):
    existing_token = get_setting("telegram_bot_token") or ""
    new_token = body.bot_token if body.bot_token and body.bot_token != "••••••••" else existing_token
    set_setting("telegram_bot_token", new_token)
    set_setting("telegram_chat_id", body.chat_id)
    os.environ["TELEGRAM_BOT_TOKEN"] = new_token
    os.environ["TELEGRAM_CHAT_ID"] = body.chat_id
    return {"success": True, "message": "تنظیمات تلگرام ذخیره شد."}


@router.post("/admin/telegram-test")
def test_telegram(_=Depends(require_admin)):
    from telegram_service import send_message, is_enabled
    token = get_setting("telegram_bot_token") or ""
    chat_id = get_setting("telegram_chat_id") or ""
    if token:
        os.environ["TELEGRAM_BOT_TOKEN"] = token
        os.environ["TELEGRAM_CHAT_ID"] = chat_id or ""
    if not is_enabled():
        return {"success": False, "message": "تلگرام فعال نیست. ابتدا توکن و Chat ID را وارد کنید."}
    send_message("✅ <b>تست اتصال تلگرام آرتین آزما</b>\nاتصال برقرار است!")
    return {"success": True, "message": "پیام آزمایشی ارسال شد."}


@router.post("/admin/send-weekly-report")
def send_weekly_report_now(_=Depends(require_admin)):
    from email_service import get_email_settings, send_weekly_report
    settings = get_email_settings(get_setting)
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
        set_setting("email_last_sent", _dt.now(timezone.utc).replace(tzinfo=None).isoformat())
    return {"success": success, "message": message}


def _safe_pct(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round((numerator / denominator) * 100, 1)


def _report_window(period: str, month: str | None = None) -> tuple[datetime, datetime, str, str]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if period == "month":
        if month:
            try:
                start = datetime.strptime(month, "%Y-%m")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="month must be in YYYY-MM format") from exc
        else:
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)
        return start, end, f"Monthly management report {start:%Y-%m}", f"{start:%Y%m}"

    start = now - timedelta(days=7)
    end = now
    return start, end, "Weekly management report", f"{now:%Y%m%d}"


def _fetch_count(cursor, query: str, params: tuple) -> int:
    row = cursor.execute(query, params).fetchone()
    return int(row[0] if row else 0)


def _management_report_data(period: str = "month", month: str | None = None) -> dict:
    period = "month" if period == "month" else "week"
    start, end, label, file_suffix = _report_window(period, month)
    start_s = start.isoformat(timespec="seconds")
    end_s = end.isoformat(timespec="seconds")

    conn = get_connection()
    c = conn.cursor()
    question_rows = c.execute(
        """
        SELECT id, question, detected_domain, expert_status, user_rating,
               user_rating_comment, response_time_ms, created_at
        FROM expert_questions
        WHERE created_at >= ? AND created_at < ?
        ORDER BY id DESC
        LIMIT 2000
        """,
        (start_s, end_s),
    ).fetchall()
    request_rows = c.execute(
        """
        SELECT id, full_name, company, email, request_type, subject, status, created_at, updated_at
        FROM customer_requests
        WHERE created_at >= ? AND created_at < ?
        ORDER BY id DESC
        LIMIT 2000
        """,
        (start_s, end_s),
    ).fetchall()
    new_customers = _fetch_count(
        c,
        "SELECT COUNT(*) FROM customers WHERE created_at >= ? AND created_at < ?",
        (start_s, end_s),
    )
    chat_messages = _fetch_count(
        c,
        "SELECT COUNT(*) FROM chat_messages WHERE created_at >= ? AND created_at < ?",
        (start_s, end_s),
    )
    conn.close()

    ratings = Counter((row["user_rating"] or "unrated") for row in question_rows)
    up = ratings.get("up", 0)
    down = ratings.get("down", 0)
    rated = up + down
    response_times = [int(row["response_time_ms"]) for row in question_rows if row["response_time_ms"]]
    avg_response_ms = round(sum(response_times) / len(response_times)) if response_times else 0

    request_statuses: Counter[str] = Counter()
    for row in request_rows:
        request_statuses[normalize_request_status(row["status"])] += 1

    domains = Counter(row["detected_domain"] or "auto" for row in question_rows)
    expert_statuses = Counter(row["expert_status"] or "pending" for row in question_rows)
    request_types = Counter(row["request_type"] or "consultation" for row in request_rows)
    product_texts = [row["question"] for row in question_rows] + [
        f"{row['subject']} {row['request_type']}" for row in request_rows
    ]

    negative_feedback = [
        {
            "id": row["id"],
            "domain": row["detected_domain"] or "",
            "question": row["question"],
            "comment": row["user_rating_comment"] or "",
            "created_at": row["created_at"],
        }
        for row in question_rows
        if row["user_rating"] == "down"
    ][:10]
    open_requests = [
        {
            "id": row["id"],
            "customer": row["full_name"],
            "company": row["company"] or "",
            "subject": row["subject"] or "",
            "type": row["request_type"] or "consultation",
            "status": normalize_request_status(row["status"]),
            "created_at": row["created_at"],
        }
        for row in request_rows
        if normalize_request_status(row["status"]) in {"new", "reviewing", "pricing"}
    ][:15]

    recommendations: list[str] = []
    if request_statuses.get("new", 0) or request_statuses.get("reviewing", 0):
        recommendations.append("Follow up open customer requests before month close.")
    if down:
        recommendations.append("Review negative-feedback answers and add corrected knowledge snippets.")
    if avg_response_ms > 8000:
        recommendations.append("Investigate slow AI responses and cache frequent questions.")
    if not recommendations:
        recommendations.append("Keep monitoring response quality and request follow-up weekly.")

    return {
        "period": period,
        "label": label,
        "file_suffix": file_suffix,
        "start": start_s,
        "end": end_s,
        "summary": {
            "total_questions": len(question_rows),
            "total_requests": len(request_rows),
            "new_customers": new_customers,
            "chat_messages": chat_messages,
            "rated_answers": rated,
            "positive_feedback": up,
            "negative_feedback": down,
            "satisfaction_pct": _safe_pct(up, rated),
            "avg_response_ms": avg_response_ms,
        },
        "question_domains": [{"domain": key, "count": count} for key, count in domains.most_common(12)],
        "expert_statuses": [{"status": key, "count": count} for key, count in expert_statuses.most_common()],
        "request_statuses": [{"status": key, "count": count} for key, count in request_statuses.most_common()],
        "request_types": [{"request_type": key, "count": count} for key, count in request_types.most_common(12)],
        "top_products": _top_product_mentions(product_texts, limit=12),
        "negative_feedback": negative_feedback,
        "open_requests": open_requests,
        "recommendations": recommendations,
    }


@router.get("/admin/management-report")
def admin_management_report(period: str = "month", month: str | None = None, _=Depends(require_admin)):
    """Monthly/weekly management report preview for requests and answer quality."""
    return _management_report_data(period=period, month=month)


@router.get("/admin/report/export")
def admin_export_report(period: str = "week", month: str | None = None, _=Depends(require_admin)):
    """CSV management report: requests, answer quality, feedback and follow-up items."""
    import csv
    import io

    report = _management_report_data(period=period, month=month)
    summary = report["summary"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ArtinAzma management report", report["label"]])
    writer.writerow(["Start", report["start"]])
    writer.writerow(["End", report["end"]])
    writer.writerow([])
    writer.writerow(["Summary", "Value"])
    writer.writerow(["Questions", summary["total_questions"]])
    writer.writerow(["Customer requests", summary["total_requests"]])
    writer.writerow(["New customers", summary["new_customers"]])
    writer.writerow(["Chat messages", summary["chat_messages"]])
    writer.writerow(["Rated answers", summary["rated_answers"]])
    writer.writerow(["Positive feedback", summary["positive_feedback"]])
    writer.writerow(["Negative feedback", summary["negative_feedback"]])
    writer.writerow(["Satisfaction percent", summary["satisfaction_pct"] if summary["satisfaction_pct"] is not None else ""])
    writer.writerow(["Average response time ms", summary["avg_response_ms"]])

    sections = [
        ("Question domains", ["Domain", "Count"], report["question_domains"], ("domain", "count")),
        ("Expert review statuses", ["Status", "Count"], report["expert_statuses"], ("status", "count")),
        ("Request statuses", ["Status", "Count"], report["request_statuses"], ("status", "count")),
        ("Request types", ["Type", "Count"], report["request_types"], ("request_type", "count")),
        ("Top products/topics", ["Product or topic", "Count"], report["top_products"], ("label", "count")),
    ]
    for title, headers, rows, keys in sections:
        writer.writerow([])
        writer.writerow([title])
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row.get(keys[0], ""), row.get(keys[1], "")])

    writer.writerow([])
    writer.writerow(["Open requests"])
    writer.writerow(["ID", "Customer", "Company", "Subject", "Type", "Status", "Created at"])
    for row in report["open_requests"]:
        writer.writerow([row["id"], row["customer"], row["company"], row["subject"], row["type"], row["status"], row["created_at"]])

    writer.writerow([])
    writer.writerow(["Negative feedback"])
    writer.writerow(["Question ID", "Domain", "Question", "Comment", "Created at"])
    for row in report["negative_feedback"]:
        writer.writerow([row["id"], row["domain"], row["question"], row["comment"], row["created_at"]])

    writer.writerow([])
    writer.writerow(["Recommended management actions"])
    for item in report["recommendations"]:
        writer.writerow([item])

    csv_bytes = output.getvalue().encode("utf-8-sig")
    filename = f"artin-management-report-{report['period']}-{report['file_suffix']}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


_PRODUCT_KEYWORDS = [
    ("GC", ["gc", "گاز کروماتوگراف", "کروماتوگراف گازی", "gc-fid", "gc-tcd"]),
    ("HPLC", ["hplc", "کروماتوگراف مایع"]),
    ("GC-MS", ["gc-ms", "gcms"]),
    ("XRF", ["xrf"]),
    ("Sulfur analyzer", ["sulfur", "گوگرد", "سولفور"]),
    ("Mercury analyzer", ["mercury", "جیوه"]),
    ("Catalyst", ["catalyst", "کاتالیست", "جاذب"]),
    ("BET", ["bet", "سطح ویژه"]),
    ("ICP", ["icp", "icp-oes", "icp-ms"]),
    ("Karl Fischer", ["karl fischer", "کارل فیشر"]),
    ("ASTM", ["astm"]),
    ("Column", ["column", "ستون"]),
    ("Detector", ["detector", "دتکتور", "fid", "tcd"]),
]


def _normalize_question_text(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^\w\s\u0600-\u06FF-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:180]


def _top_product_mentions(texts: list[str], limit: int = 8) -> list[dict]:
    counts: Counter[str] = Counter()
    for raw in texts:
        text = (raw or "").lower()
        for label, terms in _PRODUCT_KEYWORDS:
            if any(term in text for term in terms):
                counts[label] += 1
    return [{"label": label, "count": count} for label, count in counts.most_common(limit)]


@router.get("/admin/business-analytics")
def business_analytics(days: int = 30, _=Depends(require_admin)):
    """Business analytics: frequent questions, product/topic demand, active customers."""
    days = max(1, min(days, 365))
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    cutoff_str = cutoff.strftime("%Y-%m-%d")

    conn = get_connection()
    c = conn.cursor()

    question_rows = c.execute(
        """
        SELECT id, question, detected_domain, created_at
        FROM expert_questions
        WHERE created_at >= ?
        ORDER BY id DESC
        LIMIT 1000
        """,
        (cutoff_str,),
    ).fetchall()

    request_rows = c.execute(
        """
        SELECT id, request_type, subject, message, status, created_at
        FROM customer_requests
        WHERE created_at >= ?
        ORDER BY id DESC
        LIMIT 1000
        """,
        (cutoff_str,),
    ).fetchall()

    active_rows = c.execute(
        """
        SELECT
            c.id,
            c.full_name,
            c.email,
            c.company,
            COUNT(DISTINCT cs.id) AS session_count,
            COUNT(cm.id) AS message_count,
            COUNT(DISTINCT cr.id) AS request_count,
            MAX(COALESCE(cm.created_at, cr.created_at, cs.updated_at, cs.created_at, c.created_at)) AS last_active
        FROM customers c
        LEFT JOIN chat_sessions cs ON cs.customer_id = c.id
        LEFT JOIN chat_messages cm ON cm.session_id = cs.id AND cm.created_at >= ?
        LEFT JOIN customer_requests cr ON lower(cr.email) = lower(c.email) AND cr.created_at >= ?
        GROUP BY c.id
        HAVING message_count > 0 OR request_count > 0 OR session_count > 0
        ORDER BY (message_count + request_count * 4 + session_count * 2) DESC, last_active DESC
        LIMIT 8
        """,
        (cutoff_str, cutoff_str),
    ).fetchall()
    conn.close()

    grouped_questions: dict[str, dict] = {}
    for row in question_rows:
        key = _normalize_question_text(row["question"])
        if not key:
            continue
        item = grouped_questions.setdefault(
            key,
            {
                "question": row["question"],
                "count": 0,
                "domain": row["detected_domain"] or "",
                "latest_question_id": row["id"],
                "latest_at": row["created_at"],
            },
        )
        item["count"] += 1
        if row["id"] > item["latest_question_id"]:
            item["question"] = row["question"]
            item["latest_question_id"] = row["id"]
            item["latest_at"] = row["created_at"]

    frequent_questions = sorted(
        grouped_questions.values(),
        key=lambda item: (item["count"], item["latest_question_id"]),
        reverse=True,
    )[:8]

    product_texts = [row["question"] for row in question_rows] + [
        f"{row['subject']} {row['message']} {row['request_type']}" for row in request_rows
    ]
    request_type_counts = Counter(row["request_type"] or "consultation" for row in request_rows)
    status_counts = Counter(row["status"] or "new" for row in request_rows)

    active_customers = [
        {
            "id": row["id"],
            "full_name": row["full_name"],
            "email": row["email"],
            "company": row["company"] or "",
            "session_count": row["session_count"] or 0,
            "message_count": row["message_count"] or 0,
            "request_count": row["request_count"] or 0,
            "last_active": row["last_active"],
            "score": (row["message_count"] or 0) + (row["request_count"] or 0) * 4 + (row["session_count"] or 0) * 2,
        }
        for row in active_rows
    ]

    return {
        "days": days,
        "frequent_questions": frequent_questions,
        "top_products": _top_product_mentions(product_texts),
        "request_types": [{"request_type": key, "count": count} for key, count in request_type_counts.most_common(8)],
        "request_statuses": [{"status": key, "count": count} for key, count in status_counts.most_common(8)],
        "active_customers": active_customers,
    }


@router.get("/admin/knowledge-gaps")
def admin_knowledge_gaps(
    days: int = 30,
    score_threshold: float = 14.0,
    limit: int = 50,
    _=Depends(require_admin),
):
    """Questions we likely answered badly (negative feedback / weak retrieval /
    no grounding) plus the topics behind them, so the team knows what knowledge
    to add. Closes the user-feedback -> knowledge-gap loop."""
    return get_knowledge_gap_report(days=days, score_threshold=score_threshold, limit=limit)


@router.get("/admin/customers")
def admin_list_customers(limit: int = 200, offset: int = 0, _=Depends(require_admin)):
    """لیست همه مشتریان برای ادمین."""
    return get_all_customers(limit=limit, offset=offset)


@router.get("/admin/customers/{customer_id}/sessions")
def admin_customer_sessions(customer_id: int, _=Depends(require_admin)):
    """لیست جلسات چت یک مشتری."""
    sessions = get_customer_sessions(customer_id)
    return {"sessions": sessions, "total": len(sessions)}


@router.get("/admin/customers/{customer_id}/summary")
def admin_customer_summary(customer_id: int, _=Depends(require_admin)):
    """Rule-based customer summary and recommended next action for admin CRM."""
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    email = (customer.get("email") or "").strip().lower()
    phone = (customer.get("phone") or "").strip()

    with get_connection() as conn:
        cursor = conn.cursor()
        session_stats = cursor.execute(
            """
            SELECT
                COUNT(DISTINCT cs.id) AS session_count,
                COUNT(cm.id) AS message_count,
                MAX(cm.created_at) AS last_active
            FROM chat_sessions cs
            LEFT JOIN chat_messages cm ON cm.session_id = cs.id
            WHERE cs.customer_id = ?
            """,
            (customer_id,),
        ).fetchone()

        request_rows = cursor.execute(
            """
            SELECT id, subject, request_type, status, priority, assigned_to,
                   follow_up_at, created_at, updated_at
            FROM customer_requests
            WHERE (lower(email) = ? AND ? <> '')
               OR (phone = ? AND ? <> '')
            ORDER BY created_at DESC
            LIMIT 20
            """,
            (email, email, phone, phone),
        ).fetchall()

    open_requests = [
        row for row in request_rows
        if normalize_request_status(row["status"]) != "closed"
    ]
    urgent_requests = [
        row for row in open_requests
        if (row["priority"] or "normal").strip().lower() in {"urgent", "high"}
    ]

    today = datetime.now().date()
    overdue_requests = []
    due_today_requests = []
    for row in open_requests:
        follow_up_at = (row["follow_up_at"] or "").strip()
        if not follow_up_at:
            continue
        try:
            follow_up_date = datetime.fromisoformat(follow_up_at[:10]).date()
        except ValueError:
            continue
        if follow_up_date < today:
            overdue_requests.append(row)
        elif follow_up_date == today:
            due_today_requests.append(row)

    unassigned_open = [
        row for row in open_requests
        if not (row["assigned_to"] or "").strip()
    ]

    next_action = "مرور سابقه مشتری و ثبت اقدام بعدی."
    next_action_reason = "اطلاعات کافی برای تصمیم‌گیری قطعی وجود ندارد."
    action_tone = "neutral"

    if overdue_requests:
        next_action = "همین امروز با مشتری تماس بگیرید و نتیجه پیگیری را ثبت کنید."
        next_action_reason = "حداقل یک درخواست باز موعد پیگیری گذشته دارد."
        action_tone = "urgent"
    elif due_today_requests:
        next_action = "پیگیری امروز را انجام دهید و وضعیت درخواست را به‌روزرسانی کنید."
        next_action_reason = "برای این مشتری موعد پیگیری امروز ثبت شده است."
        action_tone = "warning"
    elif urgent_requests:
        next_action = "درخواست‌های اولویت‌دار را بررسی و مسئول پیگیری مشخص کنید."
        next_action_reason = "درخواست باز با اولویت بالا یا فوری وجود دارد."
        action_tone = "warning"
    elif unassigned_open:
        next_action = "برای درخواست‌های باز، مسئول پیگیری تعیین کنید."
        next_action_reason = "درخواست باز بدون مسئول پیگیری دیده شد."
        action_tone = "warning"
    elif open_requests:
        next_action = "آخرین درخواست باز را بررسی کنید و مرحله بعدی را ثبت کنید."
        next_action_reason = "پرونده مشتری هنوز بسته نشده است."
        action_tone = "neutral"
    elif request_rows:
        next_action = "پرونده بسته است؛ در صورت نیاز پیام پیگیری رضایت ارسال کنید."
        next_action_reason = "همه درخواست‌های مرتبط بسته شده‌اند."
        action_tone = "success"
    elif (session_stats["message_count"] or 0) > 0:
        next_action = "از مکالمات اخیر، نیاز مشتری را استخراج و در صورت لزوم درخواست فروش ثبت کنید."
        next_action_reason = "مشتری گفتگو داشته اما درخواست رسمی مرتبط ثبت نشده است."
        action_tone = "neutral"

    latest_request = request_rows[0] if request_rows else None
    latest_request_summary = None
    if latest_request:
        latest_request_summary = {
            "id": latest_request["id"],
            "subject": latest_request["subject"] or "",
            "request_type": latest_request["request_type"] or "consultation",
            "status": normalize_request_status(latest_request["status"]),
            "priority": (latest_request["priority"] or "normal").strip().lower(),
            "assigned_to": latest_request["assigned_to"] or "",
            "follow_up_at": latest_request["follow_up_at"] or "",
            "created_at": latest_request["created_at"],
        }

    return {
        "customer": {
            "id": customer["id"],
            "full_name": customer["full_name"],
            "email": customer["email"],
            "company": customer.get("company", "") or "",
            "phone": customer.get("phone", "") or "",
            "created_at": customer["created_at"],
        },
        "summary": {
            "session_count": session_stats["session_count"] or 0,
            "message_count": session_stats["message_count"] or 0,
            "last_active": session_stats["last_active"],
            "total_requests": len(request_rows),
            "open_requests": len(open_requests),
            "urgent_requests": len(urgent_requests),
            "overdue_follow_ups": len(overdue_requests),
            "due_today": len(due_today_requests),
            "unassigned_open": len(unassigned_open),
            "latest_request": latest_request_summary,
        },
        "next_action": {
            "title": next_action,
            "reason": next_action_reason,
            "tone": action_tone,
        },
    }


@router.get("/admin/search")
def admin_global_search(q: str = "", limit: int = 5, _=Depends(require_admin)):
    """جستجوی سراسری ادمین در سوالات، مشتریان و درخواست‌ها."""
    q = q.strip().lower()
    if not q or len(q) < 2:
        return {"questions": [], "customers": [], "requests": []}

    all_questions = get_all_questions(limit=500)
    matched_questions = [
        {"id": item["id"], "question": item["question"], "detected_domain": item.get("detected_domain", ""), "created_at": item.get("created_at", "")}
        for item in all_questions
        if q in (item.get("question") or "").lower() or q in str(item.get("id", ""))
    ][:limit]

    all_customers = get_all_customers(limit=500)
    matched_customers = [
        {"id": item["id"], "full_name": item["full_name"], "email": item.get("email", ""), "company": item.get("company", "")}
        for item in all_customers
        if q in (item.get("full_name") or "").lower()
        or q in (item.get("email") or "").lower()
        or q in (item.get("company") or "").lower()
        or q in str(item.get("id", ""))
    ][:limit]

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


@router.post("/admin/customers/{customer_id}/block")
def admin_block_customer(customer_id: int, request: Request, _=Depends(require_admin)):
    """بلاک کردن حساب مشتری."""
    ok = set_customer_blocked(customer_id, True)
    return {"success": ok}


@router.post("/admin/customers/{customer_id}/unblock")
def admin_unblock_customer(customer_id: int, request: Request, _=Depends(require_admin)):
    """فعال‌سازی مجدد حساب مشتری."""
    ok = set_customer_blocked(customer_id, False)
    return {"success": ok}


@router.post("/admin/customers/{customer_id}/approve")
def admin_approve_customer(customer_id: int, request: Request, _=Depends(require_admin)):
    """تأیید حساب مشتری و ارسال ایمیل اطلاع‌رسانی."""

    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    previous_status = customer.get("approval_status", "approved")
    ok = set_customer_approval_status(customer_id, "approved")

    email_sent = False
    email_message = ""

    # از ارسال تکراری ایمیل برای حسابی که قبلاً تأیید شده جلوگیری می‌شود.
    if ok and previous_status != "approved":
        from email_service import (
            get_email_settings,
            send_customer_approval_email,
        )

        settings = get_email_settings(get_setting)
        email_sent, email_message = send_customer_approval_email(
            settings=settings,
            to_addr=customer.get("email", ""),
            full_name=customer.get("full_name", ""),
        )

        if not email_sent:
            logger.warning(
                "Customer %s approved but approval email failed: %s",
                customer_id,
                email_message,
            )

    return {
        "success": ok,
        "email_sent": email_sent,
        "email_message": email_message,
        "already_approved": previous_status == "approved",
    }


@router.post("/admin/customers/{customer_id}/reject")
def admin_reject_customer(customer_id: int, request: Request, _=Depends(require_admin)):
    """رد کردن حساب مشتری و جلوگیری از ورود."""
    ok = set_customer_approval_status(customer_id, "rejected")
    return {"success": ok}


@router.post("/admin/customers/{customer_id}/notify")
def admin_notify_customer(customer_id: int, body: CustomerNotifyRequest, _=Depends(require_admin)):
    """ارسال اعلان داخل اپ برای یک مشتری."""
    if not body.message.strip():
        return {"success": False, "message": "متن پیام نمی‌تواند خالی باشد."}
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    nid = save_customer_notification(customer_id, body.message.strip())
    from telegram_service import notify_important_customer_message
    notify_important_customer_message(
        full_name=customer.get("full_name", ""),
        email=customer.get("email", ""),
        message=body.message.strip(),
    )
    push_sent = 0
    if is_push_configured():
        push_sent = send_push_to_customer(
            customer_id,
            title="آرتین آزما",
            body=body.message.strip()[:200],
        )
    return {"success": True, "notification_id": nid, "push_sent": push_sent}


@router.get("/admin/cache/stats")
def cache_stats(_=Depends(require_admin)):
    """آمار cache پاسخ‌های آرتین (هر دو لایه)."""
    stream_stats = _response_cache.stats() if _response_cache else {}
    ai_stats = _get_ai_cache_stats()
    return {
        "stream_cache": stream_stats,
        "response_cache": ai_stats,
        "total_entries": ai_stats["size"],
        "max_entries": ai_stats["max_size"],
        "fill_pct": ai_stats["fill_pct"],
        "ttl_hours": ai_stats["ttl_hours"],
    }


@router.post("/admin/cache/clear")
def cache_clear(_=Depends(require_admin)):
    """پاک کردن cache پاسخ‌های آرتین."""
    if _response_cache:
        _response_cache.invalidate()
    return {"success": True, "message": "Cache پاک شد."}

# ── Admin Audit Log ────────────────────────────────────────────────────────────

@router.get("/admin/audit-log")
def admin_audit_log(
    limit: int = 100,
    action: str = "",
    target_type: str = "",
    _=Depends(require_admin),
):
    """Return recent admin audit log entries."""
    entries = get_admin_audit_log(limit=limit, action_filter=action, target_type_filter=target_type)
    return {"entries": entries, "count": len(entries)}


@router.delete("/admin/audit-log")
def admin_audit_log_clear(days: int = 90, _=Depends(require_admin)):
    """Delete audit log entries older than N days."""
    deleted = clear_admin_audit_log(older_than_days=days)
    return {"deleted": deleted, "older_than_days": days}


@router.get("/admin/error-log")
def admin_error_log(limit: int = 100, level: str = "", _=Depends(require_admin)):
    """Return recent warning/error log entries from the backend rotating log file."""
    return _read_recent_error_logs(limit=limit, level=level)
