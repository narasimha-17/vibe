"""published sites: one-click deploy to a subdomain or a custom domain

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-21

"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "published_sites",
        sa.Column("slug", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False, unique=True, index=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("domain", sa.String(), nullable=True, unique=True, index=True),
        sa.Column("domain_token", sa.String(), nullable=True),
        sa.Column("domain_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("files", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("published_sites")
