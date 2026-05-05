import json
import hashlib
import secrets
import sqlite3
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
    cursor.execute(
        """
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
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            company TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata_json TEXT DEFAULT '{}',
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES chat_sessions(id)
        )
        """
    )
    cursor.execute(
        """
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
        """
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
def save_user_memory(
    user_id: str,
    question: str,
    answer: str,
    detected_domain: str = "general",
    memory_type: str = "chat",
    metadata: Dict[str, Any] | None = None
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
            datetime.now().isoformat(timespec="seconds")
        )
    )

    memory_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return memory_id


def search_user_memories(
    user_id: str,
    query: str = "",
    limit: int = 50
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
            (user_id, search_text, search_text, search_text, limit)
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
            (user_id, limit)
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
        (user_id,)
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
        (user_id,)
    )

    domain_rows = cursor.fetchall()

    conn.close()

    return {
        "total_memories": total,
        "domains": [
            {
                "domain": row["detected_domain"] or "general",
                "count": row["count"]
            }
            for row in domain_rows
        ]
    }
def save_customer_request(
    full_name: str,
    company: str,
    phone: str,
    email: str,
    request_type: str,
    subject: str,
    message: str
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
            None
        )
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
        (limit,)
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
        (
            status,
            datetime.now().isoformat(timespec="seconds"),
            request_id
        )
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

    cursor.execute(
        """
        SELECT status, COUNT(*) AS count
        FROM customer_requests
        GROUP BY status
        ORDER BY count DESC
        """
    )

    status_rows = cursor.fetchall()

    cursor.execute(
        """
        SELECT request_type, COUNT(*) AS count
        FROM customer_requests
        GROUP BY request_type
        ORDER BY count DESC
        """
    )

    type_rows = cursor.fetchall()

    conn.close()

    return {
        "total_requests": total,
        "statuses": [
            {
                "status": row["status"] or "new",
                "count": row["count"]
            }
            for row in status_rows
        ],
        "types": [
            {
                "request_type": row["request_type"] or "consultation",
                "count": row["count"]
            }
            for row in type_rows
        ]
    }



def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return f"{salt}:{password_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, password_hash = stored_hash.split(":", 1)
        check_hash = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
        return secrets.compare_digest(check_hash, password_hash)
    except Exception:
        return False


def create_customer(
    full_name: str,
    email: str,
    password: str,
    company: str = "",
    phone: str = ""
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
                datetime.now().isoformat(timespec="seconds")
            )
        )

        customer_id = cursor.lastrowid
        conn.commit()

        return {
            "success": True,
            "customer_id": customer_id
        }

    except sqlite3.IntegrityError:
        return {
            "success": False,
            "message": "این ایمیل قبلاً ثبت شده است."
        }

    finally:
        conn.close()


def authenticate_customer(email: str, password: str) -> Dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, email, password_hash, company, phone, created_at
        FROM customers
        WHERE email = ?
        """,
        (email.lower().strip(),)
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    if not verify_password(password, row["password_hash"]):
        return None

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
        (customer_id,)
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
        (customer_id, title, now, now)
    )

    session_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return session_id


def save_chat_message(
    session_id: int,
    role: str,
    content: str,
    metadata: Dict[str, Any] | None = None
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
            datetime.now().isoformat(timespec="seconds")
        )
    )

    message_id = cursor.lastrowid

    cursor.execute(
        """
        UPDATE chat_sessions
        SET updated_at = ?
        WHERE id = ?
        """,
        (datetime.now().isoformat(timespec="seconds"), session_id)
    )

    conn.commit()
    conn.close()

    return message_id


def get_customer_chat_sessions(customer_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, title, created_at, updated_at
        FROM chat_sessions
        WHERE customer_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT ?
        """,
        (customer_id, limit)
    )

    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def get_chat_messages(session_id: int, customer_id: int) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT s.id
        FROM chat_sessions s
        WHERE s.id = ? AND s.customer_id = ?
        """,
        (session_id, customer_id)
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
        (session_id,)
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
def update_chat_session_title(
    session_id: int,
    customer_id: int,
    title: str
) -> bool:
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
            customer_id
        )
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return updated


def delete_chat_session(
    session_id: int,
    customer_id: int
) -> bool:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id
        FROM chat_sessions
        WHERE id = ? AND customer_id = ?
        """,
        (session_id, customer_id)
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
        (session_id,)
    )

    cursor.execute(
        """
        DELETE FROM chat_sessions
        WHERE id = ? AND customer_id = ?
        """,
        (session_id, customer_id)
    )

    deleted = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return deleted