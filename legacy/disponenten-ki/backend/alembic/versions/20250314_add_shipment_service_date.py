"""add shipment.service_date

Revision ID: 002
Revises: 001
Create Date: 2025-03-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("shipment", sa.Column("service_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("shipment", "service_date")
