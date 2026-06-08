from datetime import datetime, timedelta
from typing import Any, Dict, List

from repositories.base import get_connection

REQUEST_STATUS_FLOW = ("new", "reviewing", "pricing", "sent", "closed")
VALID_REQUEST_STATUSES = set(REQUEST_STATUS_FLOW)
REQUEST_PRIORITIES = ("low", "normal", "high", "urgent")
VALID_REQUEST_PRIORITIES = set(REQUEST_PRIORITIES)
PRIORITY_WEIGHT = {
    "low": 1,
    "normal": 2,
    "high": 3,
    "urgent": 4,
}
LEGACY_REQUEST_STATUS_ALIASES = {
    "in_progress": "reviewing",
    "done": "sent",
}


def normalize_request_status(status: str | None) -> str:
    normalized = (status or "new").strip()
    normalized = LEGACY_REQUEST_STATUS_ALIASES.get(normalized, normalized)
    return normalized if normalized in VALID_REQUEST_STATUSES else "new"


def normalize_request_priority(priority: str | None) -> str:
    normalized = (priority or "normal").strip().lower()
    return normalized if normalized in VALID_REQUEST_PRIORITIES else "normal"


def _parse_date(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10]).date()
    except ValueError:
        return None


def _parse_datetime(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00").split("+")[0])
    except ValueError:
        return None


def save_customer_request(
    full_name: str,
    company: str,
    phone: str,
    email: str,
    request_type: str,
    subject: str,
    message: str,
) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO customer_requests
        (full_name, company, phone, email, request_type, subject, message, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            full_name,
            company,
            phone,
            email,
            request_type,
            subject,
            message,
            "new",
            datetime.now().isoformat(timespec="seconds"),
            None,
        ),
    )

    request_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return request_id


def get_customer_requests(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, company, phone, email, request_type,
               subject, message, status, priority, internal_note,
               assigned_to, follow_up_at, created_at, updated_at
        FROM customer_requests
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    )

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "full_name": row["full_name"],
            "company": row["company"] or "",
            "phone": row["phone"],
            "email": row["email"] or "",
            "request_type": row["request_type"] or "consultation",
            "subject": row["subject"] or "",
            "message": row["message"],
            "status": normalize_request_status(row["status"]),
            "priority": normalize_request_priority(row["priority"]),
            "internal_note": row["internal_note"] or "",
            "assigned_to": row["assigned_to"] or "",
            "follow_up_at": row["follow_up_at"] or "",
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def get_customer_requests_for_contact(
    email: str = "",
    phone: str = "",
    limit: int = 20,
) -> List[Dict[str, Any]]:
    email = (email or "").strip().lower()
    phone = (phone or "").strip()
    if not email and not phone:
        return []

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, company, phone, email, request_type,
               subject, message, status, priority, assigned_to,
               follow_up_at, created_at, updated_at
        FROM customer_requests
        WHERE (lower(email) = ? AND ? <> '')
           OR (phone = ? AND ? <> '')
        ORDER BY id DESC
        LIMIT ?
        """,
        (email, email, phone, phone, limit),
    )

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "full_name": row["full_name"],
            "company": row["company"] or "",
            "phone": row["phone"],
            "email": row["email"] or "",
            "request_type": row["request_type"] or "consultation",
            "subject": row["subject"] or "",
            "message": row["message"],
            "status": normalize_request_status(row["status"]),
            "priority": normalize_request_priority(row["priority"]),
            "assigned_to": row["assigned_to"] or "",
            "follow_up_at": row["follow_up_at"] or "",
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def get_customer_request_for_contact_by_id(
    request_id: int,
    email: str = "",
    phone: str = "",
) -> Dict[str, Any] | None:
    email = (email or "").strip().lower()
    phone = (phone or "").strip()
    if not email and not phone:
        return None

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, company, phone, email, request_type,
               subject, message, status, priority, assigned_to,
               follow_up_at, created_at, updated_at
        FROM customer_requests
        WHERE id = ?
          AND (
            (lower(email) = ? AND ? <> '')
            OR (phone = ? AND ? <> '')
          )
        """,
        (request_id, email, email, phone, phone),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "company": row["company"] or "",
        "phone": row["phone"],
        "email": row["email"] or "",
        "request_type": row["request_type"] or "consultation",
        "subject": row["subject"] or "",
        "message": row["message"],
        "status": normalize_request_status(row["status"]),
        "priority": normalize_request_priority(row["priority"]),
        "assigned_to": row["assigned_to"] or "",
        "follow_up_at": row["follow_up_at"] or "",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_customer_request_by_id(request_id: int) -> Dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, company, phone, email, request_type,
               subject, message, status, priority, internal_note,
               assigned_to, follow_up_at, created_at, updated_at
        FROM customer_requests
        WHERE id = ?
        """,
        (request_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "company": row["company"] or "",
        "phone": row["phone"],
        "email": row["email"] or "",
        "request_type": row["request_type"] or "consultation",
        "subject": row["subject"] or "",
        "message": row["message"],
        "status": normalize_request_status(row["status"]),
        "priority": normalize_request_priority(row["priority"]),
        "internal_note": row["internal_note"] or "",
        "assigned_to": row["assigned_to"] or "",
        "follow_up_at": row["follow_up_at"] or "",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def update_customer_request_status(request_id: int, status: str) -> bool:
    status = normalize_request_status(status)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE customer_requests
        SET status = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (status, datetime.now().isoformat(timespec="seconds"), request_id),
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return updated


def update_customer_request_crm_fields(
    request_id: int,
    priority: str | None = None,
    internal_note: str | None = None,
    assigned_to: str | None = None,
    follow_up_at: str | None = None,
) -> bool:
    priority = normalize_request_priority(priority)
    internal_note = (internal_note or "").strip()[:2000]
    assigned_to = (assigned_to or "").strip()[:120]
    follow_up_at = (follow_up_at or "").strip()[:40]

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE customer_requests
        SET priority = ?,
            internal_note = ?,
            assigned_to = ?,
            follow_up_at = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            priority,
            internal_note,
            assigned_to,
            follow_up_at,
            datetime.now().isoformat(timespec="seconds"),
            request_id,
        ),
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return updated


def get_customer_request_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) AS total FROM customer_requests")
    total = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT status, COUNT(*) AS count
        FROM customer_requests
        GROUP BY status
        ORDER BY count DESC
        """)

    status_rows = cursor.fetchall()

    cursor.execute("""
        SELECT request_type, COUNT(*) AS count
        FROM customer_requests
        GROUP BY request_type
        ORDER BY count DESC
        """)

    type_rows = cursor.fetchall()

    cursor.execute("""
        SELECT id, full_name, company, phone, email, request_type, subject,
               status, priority, assigned_to, follow_up_at, created_at, updated_at
        FROM customer_requests
        ORDER BY created_at DESC
        """)
    reminder_rows = cursor.fetchall()

    conn.close()

    status_counts = {status: 0 for status in REQUEST_STATUS_FLOW}
    for row in status_rows:
        normalized_status = normalize_request_status(row["status"])
        status_counts[normalized_status] += row["count"]

    today = datetime.now().date()
    stale_before = datetime.now() - timedelta(days=3)
    reminder_summary = {
        "overdue_follow_ups": 0,
        "due_today": 0,
        "stale_open": 0,
        "unassigned_open": 0,
        "total_attention": 0,
    }
    reminders = []

    for row in reminder_rows:
        status = normalize_request_status(row["status"])
        if status == "closed":
            continue

        priority = normalize_request_priority(row["priority"])
        follow_up_date = _parse_date(row["follow_up_at"])
        touched_at = _parse_datetime(row["updated_at"] or row["created_at"])
        assigned_to = (row["assigned_to"] or "").strip()

        if not assigned_to:
            reminder_summary["unassigned_open"] += 1

        reason = ""
        if follow_up_date and follow_up_date < today:
            reason = "overdue_follow_up"
            reminder_summary["overdue_follow_ups"] += 1
        elif follow_up_date and follow_up_date == today:
            reason = "due_today"
            reminder_summary["due_today"] += 1
        elif not follow_up_date and touched_at and touched_at <= stale_before:
            reason = "stale_open"
            reminder_summary["stale_open"] += 1

        if not reason:
            continue

        reminders.append({
            "id": row["id"],
            "full_name": row["full_name"],
            "company": row["company"] or "",
            "phone": row["phone"] or "",
            "email": row["email"] or "",
            "request_type": row["request_type"] or "consultation",
            "subject": row["subject"] or "",
            "status": status,
            "priority": priority,
            "assigned_to": assigned_to,
            "follow_up_at": row["follow_up_at"] or "",
            "created_at": row["created_at"],
            "updated_at": row["updated_at"] or "",
            "reason": reason,
        })

    reason_weight = {
        "overdue_follow_up": 0,
        "due_today": 1,
        "stale_open": 2,
    }
    reminders.sort(
        key=lambda item: (
            reason_weight.get(item["reason"], 9),
            _parse_date(item["follow_up_at"]) or today,
            -PRIORITY_WEIGHT.get(item["priority"], 2),
            item["created_at"],
        )
    )
    reminder_summary["total_attention"] = len(reminders)

    return {
        "total_requests": total,
        "statuses": [
            {"status": status, "count": count}
            for status, count in status_counts.items()
        ],
        "types": [
            {
                "request_type": row["request_type"] or "consultation",
                "count": row["count"],
            }
            for row in type_rows
        ],
        "reminder_summary": reminder_summary,
        "reminders": reminders[:10],
    }
