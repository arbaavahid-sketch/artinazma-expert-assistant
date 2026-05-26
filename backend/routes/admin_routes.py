"""
روت‌های مدیریتی (admin) — نیاز به X-Admin-Key دارند.
"""

import os
import csv
import io
import logging
from pathlib import Path
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from db_service import (
    get_connection,
    get_question_stats,
    get_question_analytics,
    get_question_by_id,
    update_question_review,
    get_all_questions,
    get_all_customers,
    get_customer_requests,
    get_customer_request_stats,
    get_customer_by_id,
    set_customer_blocked,
    save_customer_notification,
    get_knowledge_audit_log,
    clear_knowledge_audit_log,
    delete_all_customer_chat_sessions,
    get_feedback_stats,
    get_setting,
    set_setting,
    DB_PATH,
)
from knowledge_service import get_knowledge_stats

logger = logging.getLogger("artin_admin")

router = APIRouter(prefix="/admin", tags=["admin"])

# ─── Dependency — injected by main.py at include time ───────────────────────
_require_admin = None

def set_admin_dependency(dep):
    global _require_admin
    _require_admin = dep

def admin_dep():
    return Depends(_require_admin)


# ─── Dashboard Stats ───────────────────────────────────────────────────────

@router.get("/dashboard-stats")
def admin_dashboard_stats(_=Depends(lambda: _require_admin)):
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


# ─── Feedback Stats ────────────────────────────────────────────────────────

@router.get("/feedback-stats")
def feedback_stats(_=Depends(lambda: _require_admin)):
    return get_feedback_stats()


# ─── Customers Management ──────────────────────────────────────────────────

@router.get("/customers")
def admin_list_customers(limit: int = 200, offset: int = 0, _=Depends(lambda: _require_admin)):
    return get_all_customers(limit=limit, offset=offset)


@router.post("/customers/{customer_id}/block")
def admin_block_customer(customer_id: int, _=Depends(lambda: _require_admin)):
    ok = set_customer_blocked(customer_id, True)
    return {"success": ok}


@router.post("/customers/{customer_id}/unblock")
def admin_unblock_customer(customer_id: int, _=Depends(lambda: _require_admin)):
    ok = set_customer_blocked(customer_id, False)
    return {"success": ok}


class CustomerNotifyRequest(BaseModel):
    message: str


@router.post("/customers/{customer_id}/notify")
def admin_notify_customer(customer_id: int, body: CustomerNotifyRequest, _=Depends(lambda: _require_admin)):
    if not body.message.strip():
        return {"success": False, "message": "متن پیام نمی‌تواند خالی باشد."}
    nid = save_customer_notification(customer_id, body.message.strip())
    return {"success": True, "notification_id": nid}


# ─── Search ────────────────────────────────────────────────────────────────

@router.get("/search")
def admin_global_search(q: str = "", limit: int = 5, _=Depends(lambda: _require_admin)):
    q = q.strip().lower()
    if not q or len(q) < 2:
        return {"questions": [], "customers": [], "requests": []}

    all_questions = get_all_questions(limit=500)
    matched_questions = [
        {"id": item["id"], "question": item["question"], "detected_domain": item.get("detected_domain", ""), "created_at": item.get("created_at", "")}
        for item in all_questions
        if q in (item.get("question") or "").lower() or q in str(item.get("id", ""))
    ][:limit]

    all_customers_list = get_all_customers(limit=500)
    matched_customers = [
        {"id": item["id"], "full_name": item["full_name"], "email": item.get("email", ""), "company": item.get("company", "")}
        for item in all_customers_list
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


# ─── Backup ────────────────────────────────────────────────────────────────

BACKUP_DIR = Path("storage/backups")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/backup/create")
def create_backup(_=Depends(lambda: _require_admin)):
    import sqlite3 as _sqlite3
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


@router.get("/backup/list")
def list_backups(_=Depends(lambda: _require_admin)):
    backups = []
    for f in sorted(BACKUP_DIR.glob("*.db"), reverse=True):
        backups.append({
            "file_name": f.name,
            "size_kb": round(f.stat().st_size / 1024, 1),
            "created_at": datetime.utcfromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        })
    return {"backups": backups}


@router.get("/backup/download/{file_name}")
def download_backup(file_name: str, _=Depends(lambda: _require_admin)):
    safe_name = Path(file_name).name
    backup_path = BACKUP_DIR / safe_name
    if not backup_path.exists() or not backup_path.suffix == ".db":
        raise HTTPException(status_code=404, detail="فایل پیدا نشد.")
    return FileResponse(path=backup_path, filename=safe_name, media_type="application/octet-stream")


@router.delete("/backup/{file_name}")
def delete_backup(file_name: str, _=Depends(lambda: _require_admin)):
    safe_name = Path(file_name).name
    backup_path = BACKUP_DIR / safe_name
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="فایل پیدا نشد.")
    backup_path.unlink()
    return {"success": True}


# ─── CSV Exports ───────────────────────────────────────────────────────────

@router.get("/questions/export-csv")
def export_questions_csv(_=Depends(lambda: _require_admin)):
    questions = get_all_questions(limit=5000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["شناسه", "سوال", "حوزه", "وضعیت بررسی", "تاریخ ثبت"])
    for q in questions:
        writer.writerow([q.get("id", ""), q.get("question", ""), q.get("detected_domain", ""), q.get("expert_status", "pending"), q.get("created_at", "")])
    csv_bytes = output.getvalue().encode("utf-8-sig")
    return Response(content=csv_bytes, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=questions.csv"})


@router.get("/report/export")
def admin_export_report(period: str = "week", _=Depends(lambda: _require_admin)):
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
    c.execute("SELECT detected_domain, COUNT(*) as cnt FROM expert_questions WHERE created_at >= ? GROUP BY detected_domain ORDER BY cnt DESC", (cutoff_str,))
    domain_rows = c.fetchall()
    total_q = c.execute("SELECT COUNT(*) FROM expert_questions WHERE created_at >= ?", (cutoff_str,)).fetchone()[0]
    total_cust = c.execute("SELECT COUNT(*) FROM customers WHERE created_at >= ?", (cutoff_str,)).fetchone()[0]
    total_req = c.execute("SELECT COUNT(*) FROM customer_requests WHERE created_at >= ?", (cutoff_str,)).fetchone()[0]
    pending_req = c.execute("SELECT COUNT(*) FROM customer_requests WHERE created_at >= ? AND status='new'", (cutoff_str,)).fetchone()[0]
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
    filename = f"artin-report-{period}-{now.strftime('%Y%m%d')}.csv"
    return Response(content=csv_bytes, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f"attachment; filename={filename}"})


# ─── Qdrant Status ─────────────────────────────────────────────────────────

@router.get("/qdrant-status")
def qdrant_status(_=Depends(lambda: _require_admin)):
    import qdrant_service as _qs
    if not _qs.is_enabled():
        return {"enabled": False, "message": "Qdrant فعال نیست.", "backend": "json"}
    try:
        stats = _qs.collection_stats()
        return {"enabled": True, "backend": "qdrant", **stats}
    except Exception as e:
        return {"enabled": True, "backend": "qdrant", "error": str(e), "ok": False}
