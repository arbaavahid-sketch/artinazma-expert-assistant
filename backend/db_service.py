import json
import hashlib
import secrets
import sqlite3
import bcrypt
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List

STORAGE_DIR = Path("storage")
DB_PATH = STORAGE_DIR / "app.db"
VALID_EXPERT_STATUSES = {"pending", "approved", "needs_edit", "rejected"}
VALID_REQUEST_STATUSES = {"new", "in_progress", "done", "closed"}
STORAGE_DIR.mkdir(exist_ok=True)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
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
        """)

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
        cursor.execute("ALTER TABLE expert_questions ADD COLUMN updated_at TEXT")

    if "user_rating" not in existing_columns:
        cursor.execute("ALTER TABLE expert_questions ADD COLUMN user_rating TEXT DEFAULT NULL")

    if "user_rating_comment" not in existing_columns:
        cursor.execute("ALTER TABLE expert_questions ADD COLUMN user_rating_comment TEXT DEFAULT ''")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            memory_type TEXT DEFAULT 'chat',
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            detected_domain TEXT,
            metadata_json TEXT,
            created_at TEXT NOT NULL
        )
        """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            company TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            is_blocked INTEGER DEFAULT 0
        )
        """)

    # Migrate: add is_blocked if missing
    cust_cols = [r["name"] for r in cursor.execute("PRAGMA table_info(customers)").fetchall()]
    if "is_blocked" not in cust_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN is_blocked INTEGER DEFAULT 0")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        )
        """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata_json TEXT DEFAULT '{}',
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES chat_sessions(id)
        )
        """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customer_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            company TEXT DEFAULT '',
            phone TEXT NOT NULL,
            email TEXT DEFAULT '',
            request_type TEXT DEFAULT 'consultation',
            subject TEXT DEFAULT '',
            message TEXT NOT NULL,
            status TEXT DEFAULT 'new',
            created_at TEXT NOT NULL,
            updated_at TEXT
        )
        """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            file_name TEXT,
            title TEXT,
            category TEXT,
            detail TEXT,
            performed_by TEXT DEFAULT 'admin',
            created_at TEXT NOT NULL
        )
        """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customer_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            sender TEXT DEFAULT 'admin',
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
        """)

    conn.commit()
    conn.close()


# ─── Customer Notifications ────────────────────────────────────────────────

def save_customer_notification(customer_id: int, message: str, sender: str = "admin") -> int:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO customer_notifications (customer_id, message, sender, is_read, created_at) VALUES (?, ?, ?, 0, ?)",
            (customer_id, message, sender, datetime.utcnow().isoformat()),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_customer_notifications(customer_id: int, unread_only: bool = False) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        query = "SELECT * FROM customer_notifications WHERE customer_id = ?"
        params: List[Any] = [customer_id]
        if unread_only:
            query += " AND is_read = 0"
        query += " ORDER BY id DESC LIMIT 50"
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def mark_notifications_read(customer_id: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE customer_notifications SET is_read = 1 WHERE customer_id = ?",
            (customer_id,),
        )
        conn.commit()
    finally:
        conn.close()


def get_unread_notification_count(customer_id: int) -> int:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM customer_notifications WHERE customer_id = ? AND is_read = 0",
            (customer_id,),
        ).fetchone()
        return row["cnt"] if row else 0
    finally:
        conn.close()


def get_setting(key: str, default: str = "") -> str:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM app_settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default
    finally:
        conn.close()


def set_setting(key: str, value: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            """,
            (key, value, datetime.utcnow().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()


def detect_domain(question: str) -> str:
    q = question.lower()

    if any(
        word in q
        for word in [
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
            "افت فعالیت",
        ]
    ):
        return "catalyst"

    if any(
        word in q
        for word in [
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
            "ستون",
        ]
    ):
        return "chromatography"

    if any(word in q for word in ["جیوه", "mercury", "hg"]):
        return "mercury-analysis"

    if any(
        word in q
        for word in [
            "سولفور",
            "گوگرد",
            "sulfur",
            "sulphur",
            "h2s",
            "mercaptan",
            "مرکاپتان",
        ]
    ):
        return "sulfur-analysis"

    if any(
        word in q
        for word in [
            "خطا",
            "ارور",
            "عیب",
            "مشکل",
            "troubleshooting",
            "error",
            "noise",
            "drift",
            "نویز",
            "نوسان",
        ]
    ):
        return "troubleshooting"

    if any(
        word in q
        for word in [
            "دستگاه",
            "تجهیزات",
            "device",
            "instrument",
            "analyzer",
            "آنالایزر",
        ]
    ):
        return "equipment"

    if any(
        word in q for word in ["تست", "آنالیز", "analysis", "sample", "نمونه", "گزارش"]
    ):
        return "analysis"

    return "general"


def save_expert_question(
    question: str, answer: str, sources: List[Dict[str, Any]], detected_domain: str
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
            None,
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
    import re
    from datetime import date, timedelta

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


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False


def change_customer_password(customer_id: int, current_password: str, new_password: str) -> dict:
    """تغییر رمز عبور مشتری پس از تایید رمز فعلی"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT password_hash FROM customers WHERE id=?", (customer_id,))
        row = cursor.fetchone()
        if not row:
            return {"success": False, "message": "مشتری پیدا نشد."}
        if not verify_password(current_password, row[0]):
            return {"success": False, "message": "رمز عبور فعلی اشتباه است."}
        new_hash = hash_password(new_password)
        cursor.execute("UPDATE customers SET password_hash=? WHERE id=?", (new_hash, customer_id))
        conn.commit()
        return {"success": True, "message": "رمز عبور با موفقیت تغییر یافت."}
    finally:
        conn.close()


def create_customer(
    full_name: str, email: str, password: str, company: str = "", phone: str = ""
) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO customers
            (full_name, email, password_hash, company, phone, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                full_name,
                email.lower().strip(),
                hash_password(password),
                company,
                phone,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )

        customer_id = cursor.lastrowid
        conn.commit()

        return {"success": True, "customer_id": customer_id}

    except sqlite3.IntegrityError:
        return {"success": False, "message": "این ایمیل قبلاً ثبت شده است."}

    finally:
        conn.close()


def authenticate_customer(email: str, password: str) -> Dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, email, password_hash, company, phone, created_at, is_blocked
        FROM customers
        WHERE email = ?
        """,
        (email.lower().strip(),),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    if not verify_password(password, row["password_hash"]):
        return None

    if row["is_blocked"]:
        return {"blocked": True}

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "company": row["company"] or "",
        "phone": row["phone"] or "",
        "created_at": row["created_at"],
    }


def get_customer_by_id(customer_id: int) -> Dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, email, company, phone, created_at
        FROM customers
        WHERE id = ?
        """,
        (customer_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "company": row["company"] or "",
        "phone": row["phone"] or "",
        "created_at": row["created_at"],
    }


def get_all_customers(limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
    """لیست همه مشتریان به همراه آمار جلسات و پیام‌ها."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            c.id,
            c.full_name,
            c.email,
            c.company,
            c.phone,
            c.created_at,
            c.is_blocked,
            COUNT(DISTINCT cs.id) AS session_count,
            COUNT(cm.id) AS message_count,
            MAX(cm.created_at) AS last_active
        FROM customers c
        LEFT JOIN chat_sessions cs ON cs.customer_id = c.id
        LEFT JOIN chat_messages cm ON cm.session_id = cs.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    )
    rows = cursor.fetchall()
    total = cursor.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    conn.close()
    return {
        "total": total,
        "customers": [
            {
                "id": r["id"],
                "full_name": r["full_name"],
                "email": r["email"],
                "company": r["company"] or "",
                "phone": r["phone"] or "",
                "created_at": r["created_at"],
                "session_count": r["session_count"],
                "message_count": r["message_count"],
                "last_active": r["last_active"] or None,
                "is_blocked": bool(r["is_blocked"]) if "is_blocked" in r.keys() else False,
            }
            for r in rows
        ],
    }


def set_customer_blocked(customer_id: int, blocked: bool) -> bool:
    """بلاک یا فعال‌سازی حساب مشتری."""
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE customers SET is_blocked = ? WHERE id = ?",
            (1 if blocked else 0, customer_id),
        )
        conn.commit()
        return conn.execute("SELECT changes()").fetchone()[0] > 0
    finally:
        conn.close()


def update_customer_profile(
    customer_id: int, full_name: str, company: str = "", phone: str = ""
) -> Dict[str, Any] | None:
    if not full_name.strip():
        return None

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE customers
        SET full_name = ?,
            company = ?,
            phone = ?
        WHERE id = ?
        """,
        (full_name.strip(), company.strip(), phone.strip(), customer_id),
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    if not updated:
        return None

    return get_customer_by_id(customer_id)


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


# ─── Knowledge Audit Log ───────────────────────────────────────────────────────

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
                datetime.utcnow().isoformat(),
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
        conn.execute("DELETE FROM knowledge_audit_log")
        conn.commit()
        return conn.execute("SELECT changes()").fetchone()[0]
    finally:
        conn.close()


# ─── Customer Cross-Session Memory ────────────────────────────────────────────

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


# ─── Question Feedback (👍👎) ──────────────────────────────────────────────────

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
            (rating, comment, datetime.utcnow().isoformat(), question_id),
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
