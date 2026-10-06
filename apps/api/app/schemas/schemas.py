from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None = None
    plan: str
    has_password: bool = False
    google_linked: bool = False
    github_linked: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    avatar_url: str | None = Field(default=None, max_length=500)


class PasswordOtpConfirm(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8)


class PasswordOtpSent(BaseModel):
    email: str
    expires_in: int
    resend_in: int
    delivery: Literal["email", "console"]
    dev_code: str | None = None


# ── Design tokens ─────────────────────────────────────────────────
class DesignTokens(BaseModel):
    mode: Literal["light", "dark"] = "light"
    colors: dict[str, str] = Field(
        default_factory=lambda: {
            "primary": "#7c5cff",
            "secondary": "#22d3ee",
            "accent": "#f97316",
            "background": "#06080a",
            "surface": "#151921",
            "text": "#eef1f7",
            "muted": "#8a93a6",
            "border": "#222733",
            "success": "#10b981",
            "warning": "#f59e0b",
            "error": "#ef4444",
        }
    )
    heading_font: str = "Inter"
    body_font: str = "Inter"
    scale: float = 1.0
    spacing: list[int] = Field(default_factory=lambda: [4, 8, 12, 16, 24, 32, 48, 64, 96])
    radius: list[int] = Field(default_factory=lambda: [0, 4, 8, 12, 16, 24, 999])
    shadows: list[str] = Field(
        default_factory=lambda: ["none", "0 2px 8px rgba(0,0,0,.15)", "0 20px 45px rgba(0,0,0,.35)"]
    )
    breakpoints: dict[str, int] = Field(default_factory=lambda: {"mobile": 480, "tablet": 768, "desktop": 1280})
    design: dict[str, Any] | None = None


# ── Component tree ────────────────────────────────────────────────
class Node(BaseModel):
    id: str
    type: str
    variant: str
    name: str = ""
    props: dict[str, Any] = Field(default_factory=dict)
    style: dict[str, Any] = Field(default_factory=dict)
    responsive: dict[str, Any] = Field(default_factory=dict)
    children: list["Node"] = Field(default_factory=list)
    locked: bool = False
    hidden: bool = False


Node.model_rebuild()


class PageOut(BaseModel):
    id: str
    name: str
    path: str
    is_home: bool
    order: int
    tree: list[Node]

    model_config = {"from_attributes": True}


class PageCreate(BaseModel):
    name: str = "New Page"
    path: str = "/new-page"
    is_home: bool = False


class PageSync(BaseModel):
    id: str
    name: str
    path: str
    is_home: bool = False
    order: int = 0
    tree: list[Node] = Field(default_factory=list)


class ProjectSyncRequest(BaseModel):
    name: str
    theme: DesignTokens
    pages: list[PageSync]


class PageUpdate(BaseModel):
    name: str | None = None
    path: str | None = None
    is_home: bool | None = None
    order: int | None = None
    tree: list[Node] | None = None


# ── Projects ──────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str = "Untitled Project"
    template_key: str | None = None
    brief: str = ""
    audience: str = ""
    visual_style: str = ""
    required_features: list[str] = Field(default_factory=list)
    theme: DesignTokens | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    theme: DesignTokens | None = None
    settings: dict[str, Any] | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    theme: dict[str, Any]
    settings: dict[str, Any]
    github_repo: dict[str, Any] | None = None
    template_key: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectDetailOut(ProjectOut):
    pages: list[PageOut] = Field(default_factory=list)


# ── Assets ────────────────────────────────────────────────────────
class AssetOut(BaseModel):
    id: str
    filename: str
    url: str
    content_type: str
    size_bytes: int
    folder: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Snapshots ─────────────────────────────────────────────────────
class SnapshotOut(BaseModel):
    id: str
    label: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── AI ────────────────────────────────────────────────────────────
OpType = Literal[
    "add_component",
    "delete_component",
    "update_component",
    "move_component",
    "duplicate_component",
    "update_style",
    "update_theme",
    "create_page",
    "replace_content",
]


class AIOp(BaseModel):
    op: OpType
    description: str
    target_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class AICommandRequest(BaseModel):
    prompt: str
    page_id: str | None = None
    tree_summary: list[dict[str, Any]] = Field(default_factory=list)
    pages: list[str] = Field(default_factory=list)  # names of the pages in the project
    project_id: str | None = None
    history: list[dict[str, Any]] = Field(default_factory=list)  # earlier messages [{role: user|ai, text}]
    registry: dict[str, Any] = Field(default_factory=dict)  # component types with their variants and props, from the builder
    memory: list[str] = Field(default_factory=list)  # what the assistant remembers about this project and this user
    last_ai: str = ""  # the assistant's previous message, so a short reply like “discount” is understood as an answer
    tree_full: list[dict[str, Any]] = Field(default_factory=list)  # the active page with all its text, for rewriting and translating
    all_pages: list[dict[str, Any]] = Field(default_factory=list)  # every page {id, name, tree}, sent for site-wide requests
    theme: DesignTokens | None = None


class AICommandResponse(BaseModel):
    message: str
    ops: list[AIOp]
    provider: Literal["rule_based", "anthropic", "ollama", "assistant"]
    preview: bool = False  # true: show the changes for approval instead of applying them
    choices: list[str] = Field(default_factory=list)  # quick answers when the assistant asks a question


# ── Codegen ───────────────────────────────────────────────────────
class BackendOptions(BaseModel):
    enabled: bool = False
    framework: Literal["fastapi", "flask", "django"] = "fastapi"
    database: Literal["sqlite", "postgres", "mysql"] = "sqlite"
    auth: bool = False  # force user accounts even without a login button
    docker: bool = True
    cors_origin: str = "http://localhost:3000"


class CodegenOptions(BaseModel):
    framework: Literal["nextjs", "react", "html"] = "nextjs"
    language: Literal["typescript", "javascript"] = "typescript"
    styling: Literal["tailwind", "css"] = "tailwind"
    seo: bool = True
    accessibility: bool = True
    dark_mode: bool = True
    backend: BackendOptions = BackendOptions()


class CodegenRequest(BaseModel):
    project: ProjectDetailOut
    options: CodegenOptions


class CodeFile(BaseModel):
    path: str
    content: str


class CodegenPreviewResponse(BaseModel):
    files: list[CodeFile]


# ── GitHub ────────────────────────────────────────────────────────
class GithubPushRequest(BaseModel):
    project: ProjectDetailOut
    options: CodegenOptions
    repo_name: str
    private: bool = True


class GithubPushResponse(BaseModel):
    repo_url: str
    branch: str
    commit_sha: str


class GithubStatusOut(BaseModel):
    connected: bool
    github_username: str | None = None
