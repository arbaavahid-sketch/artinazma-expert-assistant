from datetime import datetime
from typing import Any, Dict, List

from repositories.base import get_connection

VALID_REQUEST_STATUSES = {"new", "in_progress", "done", "closed"}


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
               subject, message, status, created_at, updated_at
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
            "status": row["status"] or "new",
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def update_customer_request_status(request_id: int, status: str) -> bool:
    if status not in VALID_REQUEST_STATUSES:
        status = "new"

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

    return {
        "total_requests": total,
        "statuses": [
            {"status": row["status"] or "new", "count": row["count"]}
            for row in status_rows
        ],
        "types": [
            {
                "request_type": row["request_type"] or "consultation",
                "count": row["count"],
            }
            for row in type_rows
        ],
    }
