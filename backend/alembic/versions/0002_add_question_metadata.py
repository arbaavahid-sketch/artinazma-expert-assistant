"""Add metadata_json to expert questions

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-06

"""
from typing import Sequence, Union

from alembic import op


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE expert_questions ADD COLUMN IF NOT EXISTS metadata_json TEXT DEFAULT '{}'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE expert_questions DROP COLUMN IF EXISTS metadata_json")

