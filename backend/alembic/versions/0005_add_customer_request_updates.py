"""Add customer request updates table."""

from alembic import op


revision = "0005_customer_request_updates"
down_revision = "0004_request_followup"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS customer_request_updates (
            id SERIAL PRIMARY KEY,
            request_id INTEGER NOT NULL REFERENCES customer_requests(id),
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            message TEXT NOT NULL,
            file_name TEXT DEFAULT '',
            file_url TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_request_updates_request ON customer_request_updates(request_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS customer_request_updates")
