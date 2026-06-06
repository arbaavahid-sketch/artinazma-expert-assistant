from datetime import datetime, timezone
from typing import Any, Dict, List

from repositories.base import get_connection


def log_knowledge_action(
    action: str,
    file_name: str = "",
    title: str = "",
    category: str = "",
    detail: str = "",
    performed_by: str = "admin",
) -> None:
    """Log a knowledge base operation to the audit log."""
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO knowledge_audit_log
                (action, file_name, title, category, detail, performed_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                action,
                file_name,
                title,
                category,
                detail,
                performed_by,
                datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_knowledge_audit_log(limit: int = 100, action_filter: str = "") -> List[Dict[str, Any]]:
    """Return recent knowledge audit log entries."""
    conn = get_connection()
    try:
        if action_filter:
            rows = conn.execute(
                """
                SELECT id, action, file_name, title, category, detail, performed_by, created_at
                FROM knowledge_audit_log
                WHERE action = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (action_filter, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, action, file_name, title, category, detail, performed_by, created_at
                FROM knowledge_audit_log
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def clear_knowledge_audit_log() -> int:
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM knowledge_audit_log")
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()
