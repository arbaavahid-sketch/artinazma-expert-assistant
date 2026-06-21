"""Add follow-up and management fields to customer requests."""

from alembic import op


revision = "0004_request_followup"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE customer_requests "
        "ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'"
    )
    op.execute(
        "ALTER TABLE customer_requests "
        "ADD COLUMN IF NOT EXISTS internal_note TEXT DEFAULT ''"
    )
    op.execute(
        "ALTER TABLE customer_requests "
        "ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT ''"
    )
    op.execute(
        "ALTER TABLE customer_requests "
        "ADD COLUMN IF NOT EXISTS follow_up_at TEXT DEFAULT ''"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE customer_requests "
        "DROP COLUMN IF EXISTS follow_up_at"
    )
    op.execute(
        "ALTER TABLE customer_requests "
        "DROP COLUMN IF EXISTS assigned_to"
    )
    op.execute(
        "ALTER TABLE customer_requests "
        "DROP COLUMN IF EXISTS internal_note"
    )
    op.execute(
        "ALTER TABLE customer_requests "
        "DROP COLUMN IF EXISTS priority"
    )
