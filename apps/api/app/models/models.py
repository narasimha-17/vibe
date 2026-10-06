import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, default="")
    hashed_password: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    google_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    github_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    plan: Mapped[str] = mapped_column(String, default="free")
    otp_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    otp_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    otp_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    otp_attempts: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    projects: Mapped[list["Project"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    github_connection: Mapped["GithubConnection | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String, default="Untitled Project")
    theme: Mapped[dict] = mapped_column(JSON, default=dict)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    github_repo: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    template_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="projects")
    pages: Mapped[list["Page"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    assets: Mapped[list["Asset"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    snapshots: Mapped[list["Snapshot"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Snapshot.created_at.desc()"
    )


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String, default="Page")
    path: Mapped[str] = mapped_column(String, default="/")
    is_home: Mapped[bool] = mapped_column(default=False)
    order: Mapped[int] = mapped_column(default=0)
    tree: Mapped[list] = mapped_column(JSON, default=list)

    project: Mapped["Project"] = relationship(back_populates="pages")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    filename: Mapped[str] = mapped_column(String)
    url: Mapped[str] = mapped_column(String)
    content_type: Mapped[str] = mapped_column(String, default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(default=0)
    folder: Mapped[str] = mapped_column(String, default="/")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="assets")


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    label: Mapped[str] = mapped_column(String, default="Autosave")
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="snapshots")


class GithubConnection(Base):
    __tablename__ = "github_connections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    github_username: Mapped[str] = mapped_column(String)
    access_token: Mapped[str] = mapped_column(String)  # TODO: encrypt at rest before real prod use
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="github_connection")


class IntakeSession(Base):
    """One requirements interview. `memory` holds what the agent has captured per topic."""

    __tablename__ = "intake_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="interviewing")  # interviewing | reviewing | provisioned
    memory: Mapped[dict] = mapped_column(JSON, default=dict)
    transcript: Mapped[list] = mapped_column(JSON, default=list)
    pending_topic: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    project_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserMemory(Base):
    """Long-term memory: preferences the agent remembers across interviews for one user."""

    __tablename__ = "user_memory"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PublishedSite(Base):
    """A project that is live on the web: at slug.<platform domain>, and optionally on the owner's own domain."""

    __tablename__ = "published_sites"

    slug: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    domain: Mapped[str | None] = mapped_column(String, nullable=True, unique=True, index=True)
    domain_token: Mapped[str | None] = mapped_column(String, nullable=True)
    domain_verified: Mapped[bool] = mapped_column(default=False)
    files: Mapped[int] = mapped_column(default=0)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
