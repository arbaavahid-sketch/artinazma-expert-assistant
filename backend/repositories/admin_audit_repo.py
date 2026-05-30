"""
Admin audit log — records every privileged action taken via the admin panel.

Table: admin_audit_log
  id          INTEGER PK
  action      TEXT  — short action name e.g. "block_customer", "review_question"
  target_type TEXT  — entity type: "customer", "question", "knowledge", "settings", ...
  target_id   TEXT  — entity identifier (customer_id, question_id, file_name, ...)
  detail      TEXT  — human-readable summary of what changed
  ip          TEXT  — client IP address
  performed_by TEXT — always "admin" (single-admin system)
  created_at  TEXT  — ISO-8601 UTC timestamp

The table is created lazily on first write so no migration is required.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from repositories.base import get_connection

_TABLE_CREATED = False


def _ensure_table() -> None:
    global _TABLE_CREATED
    if _TABLE_CREATED:
        return
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                action       TEXT    NOT NULL,
                target_type  TEXT    NOT NULL DEFAULT '',
                target_id    TEXT    NOT NULL DEFAULT '',
                detail       TEXT    NOT NULL DEFAULT '',
                ip           TEXT    NOT NULL DEFAULT '',
                performed_by TEXT    NOT NULL DEFAULT 'admin',
                created_at   TEXT    NOT NULL
            )
            """
        )
    _TABLE_CREATED = True


def log_admin_action(
    action: str,
    *,
    target_type: str = "",
    target_id: str = "",
    detail: str = "",
    ip: str = "",
    performed_by: str = "admin",
) -> None:
    """Record an admin action. Safe to call fire-and-forget — exceptions are swallowed."""
    try:
        _ensure_table()
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO admin_audit_log
                    (action, target_type, target_id, detail, ip, performed_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    action,
                    target_type,
                    str(target_id),
                    detail,
                    ip,
                    performed_by,
                    datetime.utcnow().isoformat(),
                ),
            )
    except Exception as exc:
        import logging
        logging.getLogger("artin.audit").warning("audit log write failed: %s", exc)


def get_admin_audit_log(
    limit: int = 100,
    action_filter: str = "",
    target_type_filter: str = "",
) -> List[Dict[str, Any]]:
    """Return recent admin audit log entries, newest first."""
    _ensure_table()
    params: List[Any] = []
    where_clauses: List[str] = []

    if action_filter:
        where_clauses.append("action LIKE ?")
        params.append(f"%{action_filter}%")
    if target_type_filter:
        where_clauses.append("target_type = ?")
        params.append(target_type_filter)

    where = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT id, action, target_type, target_id, detail, ip, performed_by, created_at
            FROM admin_audit_log
            {where}
            ORDER BY id DESC
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()

    return [dict(r) for r in rows]


def clear_admin_audit_log(older_than_days: int = 90) -> int:
    """Delete log entries older than N days. Returns number deleted."""
    _ensure_table()
    cutoff = datetime.utcnow().replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    from datetime import timedelta
    cutoff_str = (cutoff - timedelta(days=older_than_days)).isoformat()

    with get_connection() as conn:
        cur = conn.execute(
            "DELETE FROM admin_audit_log WHERE created_at < ?",
            (cutoff_str,),
        )
        return cur.rowcount or 0
