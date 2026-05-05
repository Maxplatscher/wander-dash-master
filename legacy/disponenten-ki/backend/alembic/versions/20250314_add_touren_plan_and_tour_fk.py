"""add touren_plan table and tour.plan_version_id (idempotent)

Revision ID: 003
Revises: 002
Create Date: 2025-03-14

"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Tabelle touren_plan nur anlegen, falls nicht vorhanden (z. B. bei create_all bereits erzeugt)
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS touren_plan (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES company(id),
            date DATE NOT NULL,
            version INTEGER NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT FALSE,
            plan_run_id UUID REFERENCES plan_run(id),
            total_cost INTEGER,
            description VARCHAR(200),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """))
    # Spalte plan_version_id in tour nur hinzufügen, falls nicht vorhanden
    conn.execute(text("""
        ALTER TABLE tour ADD COLUMN IF NOT EXISTS plan_version_id UUID REFERENCES touren_plan(id)
    """))


def downgrade() -> None:
    op.drop_column("tour", "plan_version_id")
    op.drop_table("touren_plan")
