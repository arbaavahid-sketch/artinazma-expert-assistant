import json
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List


STORAGE_DIR = Path("storage")
DB_PATH = STORAGE_DIR / "app.db"

STORAGE_DIR.mkdir(exist_ok=True)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS expert_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            detected_domain TEXT,
            sources_json TEXT,
            expert_status TEXT DEFAULT 'pending',
            expert_note TEXT DEFAULT '',
            reviewed_answer TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT
        )
        """
    )

    existing_columns = [
        row["name"]
        for row in cursor.execute("PRAGMA table_info(expert_questions)").fetchall()
    ]

    if "expert_status" not in existing_columns:
        cursor.execute(
            "ALTER TABLE expert_questions ADD COLUMN expert_status TEXT DEFAULT 'pending'"
        )

    if "expert_note" not in existing_columns:
        cursor.execute(
            "ALTER TABLE expert_questions ADD COLUMN expert_note TEXT DEFAULT ''"
        )

    if "reviewed_answer" not in existing_columns:
        cursor.execute(
            "ALTER TABLE expert_questions ADD COLUMN reviewed_answer TEXT DEFAULT ''"
        )

    if "updated_at" not in existing_columns:
        cursor.execute(
            "ALTER TABLE expert_questions ADD COLUMN updated_at TEXT"
        )

    conn.commit()
    conn.close()


def detect_domain(question: str) -> str:
    q = question.lower()

    if any(word in q for word in [
        "کاتالیست",
        "catalyst",
        "conversion",
        "selectivity",
        "yield",
        "bet",
        "tpr",
        "tpd",
        "xrd",
        "فعالیت کاتالیست",
        "افت فعالیت"
    ]):
        return "catalyst"

    if any(word in q for word in [
        "gc",
        "hplc",
        "کروماتوگرافی",
        "chromatography",
        "fid",
        "tcd",
        "ms",
        "پیک",
        "baseline",
        "retention",
        "column",
        "ستون"
    ]):
        return "chromatography"

    if any(word in q for word in [
        "جیوه",
        "mercury",
        "hg"
    ]):
        return "mercury-analysis"

    if any(word in q for word in [
        "سولفور",
        "گوگرد",
        "sulfur",
        "sulphur",
        "h2s",
        "mercaptan",
        "مرکاپتان"
    ]):
        return "sulfur-analysis"

    if any(word in q for word in [
        "خطا",
        "ارور",
        "عیب",
        "مشکل",
        "troubleshooting",
        "error",
        "noise",
        "drift",
        "نویز",
        "نوسان"
    ]):
        return "troubleshooting"

    if any(word in q for word in [
        "دستگاه",
        "تجهیزات",
        "device",
        "instrument",
        "analyzer",
        "آنالایزر"
    ]):
        return "equipment"

    if any(word in q for word in [
        "تست",
        "آنالیز",
        "analysis",
        "sample",
        "نمونه",
        "گزارش"
    ]):
        return "analysis"

    return "general"


def save_expert_question(
    question: str,
    answer: str,
    sources: List[Dict[str, Any]],
    detected_domain: str
) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO expert_questions 
        (question, answer, detected_domain, sources_json, expert_status, expert_note, reviewed_answer, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            None
        )
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
        (limit,)
    )

    rows = cursor.fetchall()
    conn.close()

    results = []

    for row in rows:
        results.append({
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
        })

    return results


def get_question_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) AS total FROM expert_questions")
    total_questions = cursor.fetchone()["total"]

    cursor.execute(
        """
        SELECT detected_domain, COUNT(*) AS count
        FROM expert_questions
        GROUP BY detected_domain
        ORDER BY count DESC
        """
    )

    domain_rows = cursor.fetchall()

    cursor.execute(
        """
        SELECT id, question, detected_domain, created_at
        FROM expert_questions
        ORDER BY id DESC
        LIMIT 5
        """
    )

    recent_rows = cursor.fetchall()

    conn.close()

    return {
        "total_questions": total_questions,
        "domains": [
            {
                "domain": row["detected_domain"] or "general",
                "count": row["count"]
            }
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
        ]
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
        (question_id,)
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
    question_id: int,
    expert_status: str,
    expert_note: str,
    reviewed_answer: str
) -> bool:
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
            question_id
        )
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return updated


def get_all_questions(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, question, detected_domain, expert_status, created_at, updated_at
        FROM expert_questions
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,)
    )

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "question": row["question"],
            "detected_domain": row["detected_domain"],
            "expert_status": row["expert_status"] or "pending",
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]