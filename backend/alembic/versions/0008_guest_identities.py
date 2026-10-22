"""Store guest contact details against the server visitor identity."""
from alembic import op
revision = "0008_guest_identities"
down_revision = "0007_guest_allowances"
branch_labels = None
depends_on = None

def upgrade():
    op.execute("CREATE TABLE IF NOT EXISTS guest_identities (visitor_key TEXT PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT NOT NULL)")

def downgrade():
    op.execute("DROP TABLE IF EXISTS guest_identities")
