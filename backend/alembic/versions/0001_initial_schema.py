"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-05-28

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS expert_questions (
            id SERIAL PRIMARY KEY,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            detected_domain TEXT,
            sources_json TEXT,
            metadata_json TEXT DEFAULT '{}',
            expert_status TEXT DEFAULT 'pending',
            expert_note TEXT DEFAULT '',
            reviewed_answer TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT,
            response_time_ms INTEGER DEFAULT NULL,
            user_rating TEXT DEFAULT NULL,
            user_rating_comment TEXT DEFAULT ''
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS user_memories (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            memory_type TEXT DEFAULT 'chat',
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            detected_domain TEXT,
            metadata_json TEXT,
            created_at TEXT NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id SERIAL PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            company TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            is_blocked INTEGER DEFAULT 0
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES chat_sessions(id),
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata_json TEXT DEFAULT '{}',
            created_at TEXT NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS customer_requests (
            id SERIAL PRIMARY KEY,
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

    op.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_audit_log (
            id SERIAL PRIMARY KEY,
            action TEXT NOT NULL,
            file_name TEXT,
            title TEXT,
            category TEXT,
            detail TEXT,
            performed_by TEXT DEFAULT 'admin',
            created_at TEXT NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS customer_notifications (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            message TEXT NOT NULL,
            sender TEXT DEFAULT 'admin',
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (NOW()::TEXT)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            endpoint TEXT NOT NULL UNIQUE,
            keys_json TEXT NOT NULL,
            created_at TEXT DEFAULT (NOW()::TEXT)
        )
    """)

    # ── Indexes ──────────────────────────────────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS idx_questions_created   ON expert_questions(created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_questions_domain    ON expert_questions(detected_domain)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_questions_rating    ON expert_questions(user_rating)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_customers_email     ON customers(email)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sessions_customer   ON chat_sessions(customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sessions_updated    ON chat_sessions(updated_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_session    ON chat_messages(session_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_email      ON customer_requests(email)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_status     ON customer_requests(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_notifications_cust  ON customer_notifications(customer_id, is_read)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_reset_tokens_token  ON password_reset_tokens(token)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_memories_user       ON user_memories(user_id)")


def downgrade() -> None:
    tables = [
        "push_subscriptions", "password_reset_tokens", "customer_notifications",
        "knowledge_audit_log", "app_settings", "customer_requests",
        "chat_messages", "chat_sessions", "customers", "user_memories",
        "expert_questions",
    ]
    for t in tables:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
