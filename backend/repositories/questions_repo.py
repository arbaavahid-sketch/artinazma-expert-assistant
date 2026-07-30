import json
import re
from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from repositories.base import get_connection

VALID_EXPERT_STATUSES = {"pending", "approved", "needs_edit", "rejected"}

# زمان‌ها به وقتِ تهران ذخیره می‌شوند (کانتینر روی UTC است و ساعتِ خام در پنلِ
# ادمین ۳.۵ ساعت عقب نمایش داده می‌شد). naive نگه می‌داریم تا فرمتِ قبلی حفظ شود.
_TEHRAN = ZoneInfo("Asia/Tehran")


def _now_local_iso() -> str:
    return datetime.now(_TEHRAN).replace(tzinfo=None).isoformat(timespec="seconds")


def save_expert_question(
    question: str, answer: str, sources: List[Dict[str, Any]], detected_domain: str,
    response_time_ms: int = None,
    metadata: Dict[str, Any] | None = None,
) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO expert_questions
        (question, answer, detected_domain, sources_json, metadata_json, expert_status, expert_note, reviewed_answer, created_at, updated_at, response_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            question,
            answer,
            detected_domain,
            json.dumps(sources, ensure_ascii=False),
            json.dumps(metadata or {}, ensure_ascii=False),
            "pending",
            "",
            "",
            _now_local_iso(),
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
        SELECT id, question, answer, detected_domain, sources_json, metadata_json,
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
                "metadata": json.loads(row["metadata_json"] or "{}"),
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
    """Return backend-agnostic analytics for the admin dashboard."""

    days = max(1, min(int(days), 3650))
    cutoff = (
        datetime.now(_TEHRAN).replace(tzinfo=None)
        - timedelta(days=days)
    ).isoformat(timespec="seconds")

    conn = get_connection()
    try:
        recent_rows = conn.execute(
            """
            SELECT question, created_at
            FROM expert_questions
            WHERE created_at >= ?
            ORDER BY id DESC
            """,
            (cutoff,),
        ).fetchall()

        # Only the most recent 200 questions are needed for keyword analysis.
        question_rows = recent_rows[:200]

        feedback_rows = conn.execute(
            """
            SELECT expert_status, COUNT(*) AS count
            FROM expert_questions
            WHERE expert_status IS NOT NULL
            GROUP BY expert_status
            """
        ).fetchall()

        created_rows = conn.execute(
            """
            SELECT created_at
            FROM expert_questions
            WHERE created_at IS NOT NULL
            """
        ).fetchall()
    finally:
        conn.close()

    stopwords = {
        "و", "در", "به", "از", "که", "این", "را", "با", "است", "یا",
        "برای", "می", "هم", "آیا", "چه", "چطور", "چگونه", "کدام",
        "the", "a", "an", "of", "in", "is", "for", "how", "what",
    }

    word_freq: Dict[str, int] = {}
    for row in question_rows:
        words = re.findall(
            r"[؀-ۿ]{3,}|[a-zA-Z]{4,}",
            row["question"] or "",
        )
        for word in words:
            word_lower = word.lower()
            if word_lower not in stopwords:
                word_freq[word_lower] = word_freq.get(word_lower, 0) + 1

    top_keywords = sorted(
        word_freq.items(),
        key=lambda item: item[1],
        reverse=True,
    )[:12]

    day_map: Dict[str, int] = {}

    for row in recent_rows:
        value = row["created_at"]

        try:
            if isinstance(value, datetime):
                created_at = value
            else:
                created_at = datetime.fromisoformat(
                    str(value).replace("Z", "+00:00")
                )

            day_key = created_at.date().isoformat()
            day_map[day_key] = day_map.get(day_key, 0) + 1
        except (TypeError, ValueError):
            continue

    filled_days = []
    for offset in range(days - 1, -1, -1):
        day_key = (date.today() - timedelta(days=offset)).isoformat()
        filled_days.append({
            "day": day_key,
            "count": day_map.get(day_key, 0),
        })

    hourly_counts = {hour: 0 for hour in range(24)}

    for row in created_rows:
        value = row["created_at"]

        try:
            if isinstance(value, datetime):
                hour = value.hour
            else:
                hour = datetime.fromisoformat(
                    str(value).replace("Z", "+00:00")
                ).hour

            hourly_counts[hour] += 1
        except (TypeError, ValueError):
            continue

    return {
        "daily": filled_days,
        "top_keywords": [
            {"word": word, "count": count}
            for word, count in top_keywords
        ],
        "feedback": [
            {
                "status": row["expert_status"],
                "count": row["count"],
            }
            for row in feedback_rows
        ],
        "hourly": [
            {"hour": hour, "count": hourly_counts[hour]}
            for hour in range(24)
        ],
    }


def get_question_by_id(question_id: int) -> Dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, question, answer, detected_domain, sources_json, metadata_json,
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
        "metadata": json.loads(row["metadata_json"] or "{}"),
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
            _now_local_iso(),
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
        SELECT id, question, detected_domain, metadata_json, expert_status, user_rating, created_at, updated_at
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
            "metadata": json.loads(row["metadata_json"] or "{}"),
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
            (rating, comment, _now_local_iso(), question_id),
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


# Persian + English stopwords reused for gap-topic keyword extraction.
_GAP_STOPWORDS = {
    "و", "در", "به", "از", "که", "این", "را", "با", "است", "یا",
    "برای", "می", "هم", "آیا", "چه", "چطور", "چگونه", "کدام", "های",
    "شود", "شده", "دارد", "کنم", "کنید", "بین", "روی", "یک", "هر",
    "the", "a", "an", "of", "in", "is", "for", "how", "what", "and",
    "to", "do", "does", "with", "on", "or", "be", "are", "can",
}


def _extract_gap_keywords(texts: List[str], top_n: int = 15) -> List[Dict[str, Any]]:
    """Frequency-rank meaningful Persian/English terms across gap questions."""
    freq: Dict[str, int] = {}
    for text in texts:
        for w in re.findall(r"[؀-ۿ]{3,}|[a-zA-Z]{4,}", text or ""):
            wl = w.lower()
            if wl not in _GAP_STOPWORDS:
                freq[wl] = freq.get(wl, 0) + 1
    ranked = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return [{"term": w, "count": c} for w, c in ranked]


def get_knowledge_gap_report(
    days: int = 30,
    score_threshold: float = 14.0,
    limit: int = 50,
) -> Dict[str, Any]:
    """Surface questions the assistant likely answered from a knowledge gap.

    A question is flagged as a knowledge gap when any of these hold:
      * the user gave a thumbs-down (explicit dissatisfaction),
      * retrieval was weak: best internal score below ``score_threshold``,
      * no grounding at all: zero internal sources AND no web search.

    Returns aggregate counts, gap breakdowns by domain/intent, the top keywords
    across gap questions (topics where knowledge is missing), and a capped list
    of example gap questions for review. Drives the "questions we answered
    badly" loop so the team knows which knowledge files to add.
    """
    days = max(1, min(int(days), 365))
    limit = max(1, min(int(limit), 500))
    cutoff = (
        datetime.now(_TEHRAN).replace(tzinfo=None) - timedelta(days=days)
    ).strftime("%Y-%m-%d")

    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, question, detected_domain, metadata_json,
                   user_rating, user_rating_comment, created_at
            FROM expert_questions
            WHERE created_at >= ?
            ORDER BY id DESC
            LIMIT 2000
            """,
            (cutoff,),
        ).fetchall()
    finally:
        conn.close()

    total = len(rows)
    gaps: List[Dict[str, Any]] = []
    neg_feedback = weak_retrieval = no_source = 0

    for row in rows:
        try:
            meta = json.loads(row["metadata_json"] or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}

        rating = (row["user_rating"] or "").strip().lower()
        best_score = meta.get("best_score")
        source_count = meta.get("source_count")
        web_used = bool(meta.get("web_search_used"))

        reasons: List[str] = []
        if rating == "down":
            reasons.append("negative_feedback")
        if isinstance(best_score, (int, float)) and best_score < score_threshold:
            reasons.append("weak_retrieval")
        if (source_count == 0 or source_count is None) and not web_used:
            reasons.append("no_grounding")

        if not reasons:
            continue

        if "negative_feedback" in reasons:
            neg_feedback += 1
        if "weak_retrieval" in reasons:
            weak_retrieval += 1
        if "no_grounding" in reasons:
            no_source += 1

        gaps.append({
            "id": row["id"],
            "question": (row["question"] or "")[:300],
            "domain": row["detected_domain"] or "unknown",
            "intent": meta.get("question_intent") or "unknown",
            "user_rating": rating or None,
            "comment": (row["user_rating_comment"] or "") or None,
            "best_score": best_score,
            "source_count": source_count,
            "web_search_used": web_used,
            "reasons": reasons,
            "created_at": row["created_at"],
        })

    by_domain: Dict[str, int] = {}
    by_intent: Dict[str, int] = {}
    for g in gaps:
        by_domain[g["domain"]] = by_domain.get(g["domain"], 0) + 1
        by_intent[g["intent"]] = by_intent.get(g["intent"], 0) + 1

    return {
        "window_days": days,
        "score_threshold": score_threshold,
        "questions_in_window": total,
        "gap_count": len(gaps),
        "gap_rate_pct": round(len(gaps) / total * 100, 1) if total else None,
        "breakdown": {
            "negative_feedback": neg_feedback,
            "weak_retrieval": weak_retrieval,
            "no_grounding": no_source,
        },
        "by_domain": sorted(
            [{"domain": k, "count": v} for k, v in by_domain.items()],
            key=lambda x: x["count"], reverse=True,
        ),
        "by_intent": sorted(
            [{"intent": k, "count": v} for k, v in by_intent.items()],
            key=lambda x: x["count"], reverse=True,
        ),
        "top_gap_keywords": _extract_gap_keywords([g["question"] for g in gaps]),
        "examples": gaps[:limit],
    }


def get_response_time_stats(days: int = 30) -> dict:
    """آمار زمان پاسخ‌دهی AI."""
    conn = get_connection()
    try:
        cutoff = (datetime.now(_TEHRAN).replace(tzinfo=None) - timedelta(days=days)).strftime("%Y-%m-%d")
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
