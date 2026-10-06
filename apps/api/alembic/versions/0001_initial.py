"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-14

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("name", sa.String(), server_default="", nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("google_id", sa.String(), nullable=True, unique=True),
        sa.Column("github_id", sa.String(), nullable=True, unique=True),
        sa.Column("plan", sa.String(), server_default="free", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), server_default="Untitled Project", nullable=False),
        sa.Column("theme", sa.JSON(), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("github_repo", sa.JSON(), nullable=True),
        sa.Column("template_key", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])

    op.create_table(
        "pages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(), server_default="Page", nullable=False),
        sa.Column("path", sa.String(), server_default="/", nullable=False),
        sa.Column("is_home", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("tree", sa.JSON(), nullable=False),
    )
    op.create_index("ix_pages_project_id", "pages", ["project_id"])

    op.create_table(
        "assets",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), server_default="application/octet-stream", nullable=False),
        sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("folder", sa.String(), server_default="/", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_assets_project_id", "assets", ["project_id"])

    op.create_table(
        "snapshots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("label", sa.String(), server_default="Autosave", nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_snapshots_project_id", "snapshots", ["project_id"])

    op.create_table(
        "github_connections",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("github_username", sa.String(), nullable=False),
        sa.Column("access_token", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("github_connections")
    op.drop_table("snapshots")
    op.drop_table("assets")
    op.drop_table("pages")
    op.drop_table("projects")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
