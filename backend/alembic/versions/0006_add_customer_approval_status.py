"""Add customer approval status."""

from alembic import op


revision = "0006_customer_approval_status"
down_revision = "0005_customer_request_updates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'")
    op.execute("UPDATE customers SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = ''")


def downgrade() -> None:
    op.execute("ALTER TABLE customers DROP COLUMN IF EXISTS approval_status")
