"""Add CRM fields to customer requests

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'")
    op.execute("ALTER TABLE customer_requests ADD COLUMN IF NOT EXISTS internal_note TEXT DEFAULT ''")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_priority ON customer_requests(priority)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_requests_priority")
    op.execute("ALTER TABLE customer_requests DROP COLUMN IF EXISTS internal_note")
    op.execute("ALTER TABLE customer_requests DROP COLUMN IF EXISTS priority")
