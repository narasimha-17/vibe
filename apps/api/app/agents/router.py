"""Endpoints for the build agents: start a build, follow it live, read a file, download the zip."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents import custom_section as custom_section_agent
from app.agents import orchestrator
from app.agents.base import AgentError
from app.ai import llm
from app.auth.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.models.models import Project, User

router = APIRouter(prefix="/agents", tags=["agents"])
settings = get_settings()


class BuildIn(BaseModel):
    reference: dict[str, Any] | None = None  # the pages as the builder renders them: {"root", "css", "pages": {name: html}}
    auto: bool = False  # sent by the builder right after OORA; honoured only when AGENTS_AUTO_BUILD is on


def clean_reference(ref: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(ref, dict) or not isinstance(ref.get("pages"), dict):
        return None
    pages = {str(k)[:80]: str(v)[:40000] for k, v in list(ref["pages"].items())[:40]}
    return {"root": str(ref.get("root", ""))[:6000], "css": str(ref.get("css", ""))[:60000], "pages": pages}


def snapshot(project: Project, reference: dict[str, Any] | None = None) -> dict:
    """The project as the agents read it."""
    pages = sorted(project.pages, key=lambda p: p.order)
    return {
        "reference": reference,
        "name": project.name,
        "theme": project.theme or {},
        "settings": project.settings or {},
        "pages": [{"name": p.name, "path": p.path, "is_home": p.is_home, "tree": p.tree or []} for p in pages],
    }


def start_build(project: Project, owner_id: str, reference: dict[str, Any] | None = None) -> orchestrator.Job | None:
    """Starts a build when a language model is configured; None otherwise."""
    if not llm.has_model():
        return None
    return orchestrator.start(snapshot(project, reference), project.id, owner_id)


def _owned_job(job_id: str, user: User) -> orchestrator.Job:
    job = orchestrator.load(job_id)
    if not job or job.data.get("owner_id") != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Build not found")
    return job


@router.post("/projects/{project_id}/build", status_code=status.HTTP_202_ACCEPTED)
async def build(project_id: str, payload: BuildIn | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    payload = payload or BuildIn()
    result = await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id).options(selectinload(Project.pages)))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    previous = orchestrator.latest_for(project_id, user.id)
    if payload.auto and (not settings.agents_auto_build or previous or not llm.has_model()):
        return orchestrator.view(previous) if previous else None  # auto-build is off, or this project was already built
    if previous and previous.data["status"] == "running":
        return orchestrator.view(previous)
    job = start_build(project, user.id, clean_reference(payload.reference))
    if not job:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No language model is configured, so the agents can't run. Set OPENROUTER_API_KEY in apps/api/.env.")
    return orchestrator.view(job)


@router.get("/projects/{project_id}/latest")
async def latest(project_id: str, user: User = Depends(get_current_user)):
    job = orchestrator.latest_for(project_id, user.id)
    return orchestrator.view(job) if job else None


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: User = Depends(get_current_user)):
    return orchestrator.view(_owned_job(job_id, user))


@router.get("/jobs/{job_id}/file")
async def get_file(job_id: str, path: str, user: User = Depends(get_current_user)):
    content = orchestrator.read_file(_owned_job(job_id, user), path)
    if content is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    return {"path": path, "content": content}


@router.get("/jobs/{job_id}/zip")
async def get_zip(job_id: str, user: User = Depends(get_current_user)):
    job = _owned_job(job_id, user)
    name = "".join(c if c.isalnum() else "-" for c in job.data.get("project_name", "site").lower()).strip("-") or "site"
    return Response(orchestrator.zip_bytes(job), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{name}.zip"'})


class CustomSectionIn(BaseModel):
    section_type: str
    content: dict[str, Any] = {}
    description: str
    previous: dict[str, Any] | None = None  # {"html", "css", "scope"} of the version being refined
    instruction: str = ""


@router.post("/projects/{project_id}/custom-section")
async def custom_section(project_id: str, payload: CustomSectionIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """The UI agent designs one section from the user's description (Design step, "Custom" choice)."""
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if not llm.has_model():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No language model is configured, so custom sections can't be designed.")
    if not payload.description.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Describe the section you want.")
    previous = payload.previous if payload.previous and payload.previous.get("html") else None
    try:
        return await custom_section_agent.design(
            project.theme or {}, payload.section_type, payload.content, payload.description[:2000], previous, payload.instruction[:1000],
            scope=(previous or {}).get("scope"),
        )
    except AgentError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
