"""requirements interview sessions and long-term user memory

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-20

"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intake_sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("status", sa.String(), nullable=False, server_default="interviewing"),
        sa.Column("memory", sa.JSON(), nullable=False),
        sa.Column("transcript", sa.JSON(), nullable=False),
        sa.Column("pending_topic", sa.String(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "user_memory",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("user_memory")
    op.drop_table("intake_sessions")
