"""Persist anonymous browser chat allowances."""
from alembic import op

revision = "0007_guest_allowances"
down_revision = "0006_customer_approval_status"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE TABLE IF NOT EXISTS guest_allowances (visitor_key TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS guest_allowances")
