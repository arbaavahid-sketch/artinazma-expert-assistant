import json
from datetime import datetime
from typing import Any, Dict, List

from repositories.base import get_connection


def create_chat_session(customer_id: int, title: str) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    now = datetime.now().isoformat(timespec="seconds")

    cursor.execute(
        """
        INSERT INTO chat_sessions
        (customer_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        """,
        (customer_id, title, now, now),
    )

    session_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return session_id


def save_chat_message(
    session_id: int, role: str, content: str, metadata: Dict[str, Any] | None = None
) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO chat_messages
        (session_id, role, content, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            session_id,
            role,
            content,
            json.dumps(metadata or {}, ensure_ascii=False),
            datetime.now().isoformat(timespec="seconds"),
        ),
    )

    message_id = cursor.lastrowid

    cursor.execute(
        """
        UPDATE chat_sessions
        SET updated_at = ?
        WHERE id = ?
        """,
        (datetime.now().isoformat(timespec="seconds"), session_id),
    )

    conn.commit()
    conn.close()

    return message_id


def get_customer_chat_sessions(
    customer_id: int, limit: int = 50
) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            s.id,
            s.title,
            s.created_at,
            s.updated_at,
            COUNT(m.id) AS message_count,
            (
                SELECT m2.content
                FROM chat_messages m2
                WHERE m2.session_id = s.id
                ORDER BY m2.id DESC
                LIMIT 1
            ) AS last_message
        FROM chat_sessions s
        LEFT JOIN chat_messages m ON m.session_id = s.id
        WHERE s.customer_id = ?
        GROUP BY s.id
        ORDER BY COALESCE(s.updated_at, s.created_at) DESC
        LIMIT ?
        """,
        (customer_id, limit),
    )

    rows = cursor.fetchall()
    conn.close()

    result = []
    for row in rows:
        last_msg = row["last_message"] or ""
        # Truncate to 120 chars for preview
        preview = last_msg[:120] + ("…" if len(last_msg) > 120 else "")
        result.append(
            {
                "id": row["id"],
                "title": row["title"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "message_count": row["message_count"],
                "last_message_preview": preview,
            }
        )
    return result


def get_chat_messages(session_id: int, customer_id: int) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT s.id
        FROM chat_sessions s
        WHERE s.id = ? AND s.customer_id = ?
        """,
        (session_id, customer_id),
    )

    session = cursor.fetchone()

    if not session:
        conn.close()
        return []

    cursor.execute(
        """
        SELECT id, role, content, metadata_json, created_at
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY id ASC
        """,
        (session_id,),
    )

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "role": row["role"],
            "content": row["content"],
            "metadata": json.loads(row["metadata_json"] or "{}"),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def update_chat_session_title(session_id: int, customer_id: int, title: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE chat_sessions
        SET title = ?, updated_at = ?
        WHERE id = ? AND customer_id = ?
        """,
        (
            title.strip() or "گفتگوی جدید",
            datetime.now().isoformat(timespec="seconds"),
            session_id,
            customer_id,
        ),
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return updated


def delete_chat_session(session_id: int, customer_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id
        FROM chat_sessions
        WHERE id = ? AND customer_id = ?
        """,
        (session_id, customer_id),
    )

    session = cursor.fetchone()

    if not session:
        conn.close()
        return False

    cursor.execute(
        """
        DELETE FROM chat_messages
        WHERE session_id = ?
        """,
        (session_id,),
    )

    cursor.execute(
        """
        DELETE FROM chat_sessions
        WHERE id = ? AND customer_id = ?
        """,
        (session_id, customer_id),
    )

    deleted = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return deleted


def delete_all_customer_chat_sessions(customer_id: int) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        DELETE FROM chat_messages
        WHERE session_id IN (
            SELECT id FROM chat_sessions
            WHERE customer_id = ?
        )
        """,
        (customer_id,),
    )

    cursor.execute(
        "DELETE FROM chat_sessions WHERE customer_id = ?",
        (customer_id,),
    )

    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted_count


def get_customer_cross_session_context(customer_id: int) -> str:
    """
    Build a Persian context string summarising what Artin knows about this
    customer so it can be injected into the system prompt.

    Includes:
    - Name, company, phone from the customers table
    - Top domains they have asked about (from user_memories)
    - Their three most recent questions (for continuity)
    """
    conn = get_connection()
    try:
        # 1. Customer profile
        row = conn.execute(
            "SELECT full_name, company, phone FROM customers WHERE id = ?",
            (customer_id,),
        ).fetchone()

        if not row:
            return ""

        name = row["full_name"] or ""
        company = row["company"] or ""
        phone = row["phone"] or ""

        # 2. Top domains from past conversations
        user_id_str = f"customer_{customer_id}"
        domain_rows = conn.execute(
            """
            SELECT detected_domain, COUNT(*) AS cnt
            FROM user_memories
            WHERE user_id = ? AND detected_domain IS NOT NULL AND detected_domain != ''
            GROUP BY detected_domain
            ORDER BY cnt DESC
            LIMIT 5
            """,
            (user_id_str,),
        ).fetchall()
        top_domains = [r["detected_domain"] for r in domain_rows]

        # 3. Last 3 questions
        recent_rows = conn.execute(
            """
            SELECT question FROM user_memories
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 3
            """,
            (user_id_str,),
        ).fetchall()
        recent_questions = [r["question"] for r in recent_rows]

    finally:
        conn.close()

    # Build context block
    lines = ["--- اطلاعات کاربر فعلی ---"]
    lines.append(f"نام: {name}")
    if company:
        lines.append(f"شرکت: {company}")
    if phone:
        lines.append(f"تلفن: {phone}")
    if top_domains:
        lines.append(f"حوزه‌های مورد علاقه: {', '.join(top_domains)}")
    if recent_questions:
        lines.append("آخرین سوالات:")
        for q in recent_questions:
            lines.append(f"  - {q[:120]}")
    lines.append(
        "توجه: این کاربر ثبت‌نام کرده است. پاسخ‌ها را با نام او آغاز نکن، "
        "اما اطلاعات شرکت و حوزه کاری‌اش را در پاسخ‌های فنی مد نظر داشته باش."
    )
    lines.append("--- پایان اطلاعات کاربر ---")

    return "\n".join(lines)
