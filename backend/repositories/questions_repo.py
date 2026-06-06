import json
import re
from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List

from repositories.base import get_connection

VALID_EXPERT_STATUSES = {"pending", "approved", "needs_edit", "rejected"}


def save_expert_question(
    question: str, answer: str, sources: List[Dict[str, Any]], detected_domain: str,
    response_time_ms: int = None,
) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO expert_questions
        (question, answer, detected_domain, sources_json, expert_status, expert_note, reviewed_answer, created_at, updated_at, response_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            question,
            answer,
            detected_domain,
            json.dumps(sources, ensure_ascii=False),
            "pending",
            "",
            "",
            datetime.now().isoformat(timespec="seconds"),
            None,
            response_time_ms,
        ),
    )

    question_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return question_id


def get_recent_questions(limit: int = 20) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, question, answer, detected_domain, sources_json,
               expert_status, expert_note, reviewed_answer, created_at, updated_at
        FROM expert_questions
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    )

    rows = cursor.fetchall()
    conn.close()

    results = []

    for row in rows:
        results.append(
            {
                "id": row["id"],
                "question": row["question"],
                "answer": row["answer"],
                "detected_domain": row["detected_domain"],
                "sources": json.loads(row["sources_json"] or "[]"),
                "expert_status": row["expert_status"] or "pending",
                "expert_note": row["expert_note"] or "",
                "reviewed_answer": row["reviewed_answer"] or "",
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )

    return results


def get_question_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) AS total FROM expert_questions")
    total_questions = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT detected_domain, COUNT(*) AS count
        FROM expert_questions
        GROUP BY detected_domain
        ORDER BY count DESC
        """)

    domain_rows = cursor.fetchall()

    cursor.execute("""
        SELECT id, question, detected_domain, created_at
        FROM expert_questions
        ORDER BY id DESC
        LIMIT 5
        """)

    recent_rows = cursor.fetchall()

    conn.close()

    return {
        "total_questions": total_questions,
        "domains": [
            {"domain": row["detected_domain"] or "general", "count": row["count"]}
            for row in domain_rows
        ],
        "recent_questions": [
            {
                "id": row["id"],
                "question": row["question"],
                "detected_domain": row["detected_domain"],
                "created_at": row["created_at"],
            }
            for row in recent_rows
        ],
    }


def get_question_analytics(days: int = 7) -> Dict[str, Any]:
    """Return daily counts, top keywords, feedback and hourly activity for the admin dashboard."""
    conn = get_connection()
    cursor = conn.cursor()

    # Daily counts for the last N days
    cursor.execute(
        """
        SELECT DATE(created_at) AS day, COUNT(*) AS count
        FROM expert_questions
        WHERE created_at >= DATE('now', ?)
        GROUP BY day
        ORDER BY day ASC
        """,
        (f"-{days} days",),
    )
    daily_rows = cursor.fetchall()

    # Keyword frequency from recent questions
    cursor.execute(
        """
        SELECT question FROM expert_questions
        WHERE created_at >= DATE('now', ?)
        ORDER BY id DESC
        LIMIT 200
        """,
        (f"-{days} days",),
    )
    question_rows = cursor.fetchall()

    stopwords = {
        "و", "در", "به", "از", "که", "این", "را", "با", "است", "یا",
        "برای", "می", "هم", "آیا", "چه", "چطور", "چگونه", "کدام",
        "the", "a", "an", "of", "in", "is", "for", "how", "what",
    }
    word_freq: Dict[str, int] = {}
    for row in question_rows:
        words = re.findall(r"[؀-ۿ]{3,}|[a-zA-Z]{4,}", row["question"] or "")
        for w in words:
            w_lower = w.lower()
            if w_lower not in stopwords:
                word_freq[w_lower] = word_freq.get(w_lower, 0) + 1
    top_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:12]

    # Feedback stats
    cursor.execute(
        """
        SELECT expert_status, COUNT(*) AS count
        FROM expert_questions
        WHERE expert_status IS NOT NULL
        GROUP BY expert_status
        """
    )
    feedback_rows = cursor.fetchall()

    # Hourly activity heatmap
    cursor.execute(
        """
        SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS count
        FROM expert_questions
        GROUP BY hour
        ORDER BY hour
        """
    )
    hour_rows = cursor.fetchall()

    conn.close()

    # Fill missing days with 0
    day_map: Dict[str, int] = {row["day"]: row["count"] for row in daily_rows}
    filled_days = []
    for i in range(days - 1, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        filled_days.append({"day": d, "count": day_map.get(d, 0)})

    return {
        "daily": filled_days,
        "top_keywords": [{"word": w, "count": c} for w, c in top_keywords],
        "feedback": [
            {"status": row["expert_status"], "count": row["count"]}
            for row in feedback_rows
        ],
        "hourly": [
            {"hour": row["hour"], "count": row["count"]}
            for row in hour_rows
        ],
    }


def get_question_by_id(question_id: int) -> Dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, question, answer, detected_domain, sources_json,
               expert_status, expert_note, reviewed_answer, created_at, updated_at
        FROM expert_questions
        WHERE id = ?
        """,
        (question_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "question": row["question"],
        "answer": row["answer"],
        "detected_domain": row["detected_domain"],
        "sources": json.loads(row["sources_json"] or "[]"),
        "expert_status": row["expert_status"] or "pending",
        "expert_note": row["expert_note"] or "",
        "reviewed_answer": row["reviewed_answer"] or "",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def update_question_review(
    question_id: int, expert_status: str, expert_note: str, reviewed_answer: str
) -> bool:
    if expert_status not in VALID_EXPERT_STATUSES:
        expert_status = "pending"

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE expert_questions
        SET expert_status = ?,
            expert_note = ?,
            reviewed_answer = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            expert_status,
            expert_note,
            reviewed_answer,
            datetime.now().isoformat(timespec="seconds"),
            question_id,
        ),
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return updated


def get_all_questions(
    limit: int = 200,
    domain: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    rating: str | None = None,
) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    conditions: List[str] = []
    params: List[Any] = []

    if domain:
        conditions.append("detected_domain = ?")
        params.append(domain)

    if date_from:
        conditions.append("date(created_at) >= date(?)")
        params.append(date_from)

    if date_to:
        conditions.append("date(created_at) <= date(?)")
        params.append(date_to)

    if rating == "up":
        conditions.append("user_rating = 'up'")
    elif rating == "down":
        conditions.append("user_rating = 'down'")
    elif rating == "unrated":
        conditions.append("(user_rating IS NULL OR user_rating = '')")

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    cursor.execute(
        f"""
        SELECT id, question, detected_domain, expert_status, user_rating, created_at, updated_at
        FROM expert_questions
        {where_clause}
        ORDER BY id DESC
        LIMIT ?
        """,
        params,
    )

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "question": row["question"],
            "detected_domain": row["detected_domain"],
            "expert_status": row["expert_status"] or "pending",
            "user_rating": row["user_rating"] or "",
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def save_question_feedback(question_id: int, rating: str, comment: str = "") -> bool:
    """Save user rating ('up' or 'down') for a question. Returns True if saved."""
    if rating not in ("up", "down"):
        return False
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE expert_questions
            SET user_rating = ?, user_rating_comment = ?, updated_at = ?
            WHERE id = ?
            """,
            (rating, comment, datetime.now(timezone.utc).replace(tzinfo=None).isoformat(), question_id),
        )
        conn.commit()
        return conn.execute("SELECT changes()").fetchone()[0] > 0
    finally:
        conn.close()


def get_feedback_stats() -> Dict[str, Any]:
    """Return aggregate feedback stats for the admin dashboard."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN user_rating = 'up' THEN 1 ELSE 0 END) AS up_count,
                SUM(CASE WHEN user_rating = 'down' THEN 1 ELSE 0 END) AS down_count,
                SUM(CASE WHEN user_rating IS NULL THEN 1 ELSE 0 END) AS unrated
            FROM expert_questions
            """
        ).fetchone()
        total = rows["total"] or 0
        up = rows["up_count"] or 0
        down = rows["down_count"] or 0
        rated = up + down
        return {
            "total_questions": total,
            "rated": rated,
            "up": up,
            "down": down,
            "unrated": rows["unrated"] or 0,
            "satisfaction_pct": round(up / rated * 100, 1) if rated > 0 else None,
        }
    finally:
        conn.close()


def get_response_time_stats(days: int = 30) -> dict:
    """آمار زمان پاسخ‌دهی AI."""
    conn = get_connection()
    try:
        cutoff = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)).strftime("%Y-%m-%d")
        row = conn.execute(
            """SELECT
                AVG(response_time_ms) as avg_ms,
                MIN(response_time_ms) as min_ms,
                MAX(response_time_ms) as max_ms,
                COUNT(*) as total
            FROM expert_questions
            WHERE response_time_ms IS NOT NULL AND created_at >= ?""",
            (cutoff,)
        ).fetchone()
        return {
            "avg_ms": round(row["avg_ms"]) if row["avg_ms"] else 0,
            "min_ms": row["min_ms"] or 0,
            "max_ms": row["max_ms"] or 0,
            "total_answered": row["total"] or 0,
        }
    finally:
        conn.close()
