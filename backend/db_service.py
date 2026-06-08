import logging
from pathlib import Path
from datetime import datetime

# Storage paths (used by init_db and historically by callers)
STORAGE_DIR = Path("storage")
logger = logging.getLogger("db_service")

DB_PATH = STORAGE_DIR / "app.db"
VALID_EXPERT_STATUSES = {"pending", "approved", "needs_edit", "rejected"}
VALID_REQUEST_STATUSES = {"new", "reviewing", "pricing", "sent", "closed"}
STORAGE_DIR.mkdir(exist_ok=True)

# Re-exports from repository modules
from repositories.base import get_connection, _BACKEND

from repositories.settings_repo import (
    get_setting,
    set_setting,
)

from repositories.questions_repo import (
    save_expert_question,
    get_recent_questions,
    get_question_stats,
    get_question_analytics,
    get_question_by_id,
    update_question_review,
    get_all_questions,
    save_question_feedback,
    get_feedback_stats,
    get_response_time_stats,
)

from repositories.memory_repo import (
    save_user_memory,
    search_user_memories,
    get_user_memory_stats,
)

from repositories.customer_repo import (
    hash_password,
    verify_password,
    create_customer,
    authenticate_customer,
    get_customer_by_id,
    get_all_customers,
    get_customer_sessions,
    set_customer_blocked,
    update_customer_profile,
    change_customer_password,
    create_password_reset_token,
    verify_reset_token,
    reset_password_with_token,
)

from repositories.chat_repo import (
    create_chat_session,
    save_chat_message,
    get_customer_chat_sessions,
    get_chat_messages,
    search_customer_chat_history,
    update_chat_session_title,
    delete_chat_session,
    delete_all_customer_chat_sessions,
    get_customer_cross_session_context,
)

from repositories.knowledge_repo import (
    log_knowledge_action,
    get_knowledge_audit_log,
    clear_knowledge_audit_log,
)

from repositories.notifications_repo import (
    save_customer_notification,
    get_customer_notifications,
    mark_notifications_read,
    get_unread_notification_count,
    save_push_subscription,
    remove_push_subscription,
    get_push_subscriptions,
)

from repositories.requests_repo import (
    save_customer_request,
    get_customer_requests,
    get_customer_request_by_id,
    update_customer_request_status,
    update_customer_request_crm_fields,
    get_customer_request_stats,
)


def _pg_column_exists(conn, table: str, column: str) -> bool:
    """PostgreSQL-safe check for a column's existence."""
    row = conn.execute(
        "SELECT COUNT(*) FROM information_schema.columns WHERE table_name=? AND column_name=?",
        (table, column),
    ).fetchone()
    return (row[0] if row else 0) > 0


def init_db():
    if _BACKEND == "postgres":
        # For PostgreSQL, schema is managed by Alembic migrations.
        # init_db() is a no-op to avoid AUTOINCREMENT / PRAGMA syntax errors.
        logger.warning("[db] PostgreSQL backend — skipping init_db() (use Alembic migrations)")
        return

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expert_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            detected_domain TEXT,
            sources_json TEXT,
            metadata_json TEXT DEFAULT '{}',
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

    if "response_time_ms" not in existing_columns:
        cursor.execute(
            "ALTER TABLE expert_questions ADD COLUMN response_time_ms INTEGER DEFAULT NULL"
        )

    if "metadata_json" not in existing_columns:
        cursor.execute(
            "ALTER TABLE expert_questions ADD COLUMN metadata_json TEXT DEFAULT '{}'"
        )

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
            priority TEXT DEFAULT 'normal',
            internal_note TEXT DEFAULT '',
            assigned_to TEXT DEFAULT '',
            follow_up_at TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT
        )
        """)

    request_cols = [r["name"] for r in cursor.execute("PRAGMA table_info(customer_requests)").fetchall()]
    if "priority" not in request_cols:
        cursor.execute("ALTER TABLE customer_requests ADD COLUMN priority TEXT DEFAULT 'normal'")
    if "internal_note" not in request_cols:
        cursor.execute("ALTER TABLE customer_requests ADD COLUMN internal_note TEXT DEFAULT ''")
    if "assigned_to" not in request_cols:
        cursor.execute("ALTER TABLE customer_requests ADD COLUMN assigned_to TEXT DEFAULT ''")
    if "follow_up_at" not in request_cols:
        cursor.execute("ALTER TABLE customer_requests ADD COLUMN follow_up_at TEXT DEFAULT ''")

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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
        """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            endpoint TEXT NOT NULL UNIQUE,
            keys_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
        """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_created ON expert_questions(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_domain ON expert_questions(detected_domain)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_rating ON expert_questions(user_rating)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_customer ON chat_sessions(customer_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_email ON customer_requests(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_status ON customer_requests(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_priority ON customer_requests(priority)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_follow_up ON customer_requests(follow_up_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_customer ON customer_notifications(customer_id, is_read)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id)")

    conn.commit()
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


# ── Re-exports from repositories (keeps existing imports working) ────────────
from repositories.settings_repo import get_setting, set_setting
from repositories.questions_repo import (
    save_expert_question,
    get_recent_questions,
    get_question_stats,
    get_question_analytics,
    get_question_by_id,
    update_question_review,
    get_all_questions,
    save_question_feedback,
    get_feedback_stats,
    get_response_time_stats,
)
from repositories.memory_repo import (
    save_user_memory,
    search_user_memories,
    get_user_memory_stats,
)
from repositories.customer_repo import (
    hash_password,
    verify_password,
    create_customer,
    authenticate_customer,
    get_customer_by_id,
    get_all_customers,
    get_customer_sessions,
    set_customer_blocked,
    update_customer_profile,
    change_customer_password,
    create_password_reset_token,
    verify_reset_token,
    reset_password_with_token,
)
from repositories.chat_repo import (
    create_chat_session,
    save_chat_message,
    get_customer_chat_sessions,
    get_chat_messages,
    search_customer_chat_history,
    update_chat_session_title,
    delete_chat_session,
    delete_all_customer_chat_sessions,
    get_customer_cross_session_context,
)
from repositories.knowledge_repo import (
    log_knowledge_action,
    get_knowledge_audit_log,
    clear_knowledge_audit_log,
)
from repositories.notifications_repo import (
    save_customer_notification,
    get_customer_notifications,
    mark_notifications_read,
    get_unread_notification_count,
    save_push_subscription,
    remove_push_subscription,
    get_push_subscriptions,
)
from repositories.requests_repo import (
    save_customer_request,
    get_customer_requests,
    update_customer_request_status,
    get_customer_request_stats,
)
