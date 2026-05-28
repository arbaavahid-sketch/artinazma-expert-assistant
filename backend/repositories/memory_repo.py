import json
from datetime import datetime
from typing import Any, Dict, List

from repositories.base import get_connection


def save_user_memory(
    user_id: str,
    question: str,
    answer: str,
    detected_domain: str = "general",
    memory_type: str = "chat",
    metadata: Dict[str, Any] | None = None,
) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO user_memories
        (user_id, memory_type, question, answer, detected_domain, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            memory_type,
            question,
            answer,
            detected_domain,
            json.dumps(metadata or {}, ensure_ascii=False),
            datetime.now().isoformat(timespec="seconds"),
        ),
    )

    memory_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return memory_id


def search_user_memories(
    user_id: str, query: str = "", limit: int = 50
) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    search_text = f"%{query.strip()}%"

    if query.strip():
        cursor.execute(
            """
            SELECT id, user_id, memory_type, question, answer, detected_domain, metadata_json, created_at
            FROM user_memories
            WHERE user_id = ?
              AND (
                question LIKE ?
                OR answer LIKE ?
                OR detected_domain LIKE ?
              )
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, search_text, search_text, search_text, limit),
        )
    else:
        cursor.execute(
            """
            SELECT id, user_id, memory_type, question, answer, detected_domain, metadata_json, created_at
            FROM user_memories
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, limit),
        )

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "user_id": row["user_id"],
            "memory_type": row["memory_type"],
            "question": row["question"],
            "answer": row["answer"],
            "detected_domain": row["detected_domain"],
            "metadata": json.loads(row["metadata_json"] or "{}"),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def get_user_memory_stats(user_id: str) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM user_memories
        WHERE user_id = ?
        """,
        (user_id,),
    )

    total = cursor.fetchone()["total"]

    cursor.execute(
        """
        SELECT detected_domain, COUNT(*) AS count
        FROM user_memories
        WHERE user_id = ?
        GROUP BY detected_domain
        ORDER BY count DESC
        """,
        (user_id,),
    )

    domain_rows = cursor.fetchall()

    conn.close()

    return {
        "total_memories": total,
        "domains": [
            {"domain": row["detected_domain"] or "general", "count": row["count"]}
            for row in domain_rows
        ],
    }
