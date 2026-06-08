"""Add follow-up fields to customer requests

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op


revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT ''")
    op.execute("ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS follow_up_at TEXT DEFAULT ''")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_follow_up ON customer_requests(follow_up_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_requests_follow_up")
    op.execute("ALTER TABLE customer_requests DROP COLUMN IF EXISTS follow_up_at")
    op.execute("ALTER TABLE customer_requests DROP COLUMN IF EXISTS assigned_to")
