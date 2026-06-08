from datetime import datetime
from typing import Any, Dict, List

from repositories.base import get_connection

REQUEST_STATUS_FLOW = ("new", "reviewing", "pricing", "sent", "closed")
VALID_REQUEST_STATUSES = set(REQUEST_STATUS_FLOW)
REQUEST_PRIORITIES = ("low", "normal", "high", "urgent")
VALID_REQUEST_PRIORITIES = set(REQUEST_PRIORITIES)
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

    conn.close()

    status_counts = {status: 0 for status in REQUEST_STATUS_FLOW}
    for row in status_rows:
        normalized_status = normalize_request_status(row["status"])
        status_counts[normalized_status] += row["count"]

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
    }
