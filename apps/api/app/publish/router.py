"""One-click publishing: put a project on the web at <slug>.<platform domain>, and optionally on the owner's own domain.

Publishing generates the project's static HTML site (the same code generator as Export), stores it under
storage/sites/<slug>/ and serves it. Sections that need a backend (shop, accounts, order tracking, chat) are
listed as warnings, because a static site cannot run them. For those, export the code with a backend and deploy that.
"""

import re
import secrets
import shutil
import socket
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import get_current_user
from app.codegen.engine import generate_project
from app.core.config import get_settings
from app.core.db import get_db
from app.models.models import Project, PublishedSite, User
from app.schemas.schemas import CodegenOptions

router = APIRouter(prefix="/publish", tags=["publish"])
settings = get_settings()

RESERVED = {"www", "api", "app", "admin", "mail", "static", "sites", "vibe", "dashboard", "builder", "login", "signup", "docs", "help"}
BACKEND_SECTIONS = {"shop": "the shop and checkout", "tracking": "order tracking", "auth": "sign in and registration", "chatbot": "the chatbot", "forms": "form submissions"}


def sites_root() -> Path:
    root = Path(settings.storage_dir) / "sites"
    root.mkdir(parents=True, exist_ok=True)
    return root


def site_dir(slug: str) -> Path:
    return sites_root() / slug


def site_url(slug: str) -> str:
    port = f":{settings.platform_port}" if settings.platform_port else ""
    return f"{settings.platform_scheme}://{slug}.{settings.platform_domain}{port}"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "my-site"


class PublishIn(BaseModel):
    slug: str | None = Field(default=None, max_length=40)


class DomainIn(BaseModel):
    domain: str = Field(min_length=4, max_length=253)


def _valid_slug(slug: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]", slug)) and slug not in RESERVED


def _dns(row: PublishedSite) -> dict | None:
    if not row.domain:
        return None
    return {
        "domain": row.domain,
        "verified": row.domain_verified,
        "records": [
            {"type": "CNAME", "name": row.domain, "value": settings.platform_cname, "note": "Points your domain at VIBE. For a root domain (no www), use an ALIAS/ANAME record if your DNS provider supports it."},
            {"type": "TXT", "name": f"_vibe-verify.{row.domain}", "value": f"vibe-verify={row.domain_token}", "note": "Proves that you own the domain."},
        ],
        "https": "HTTPS for your own domain needs a proxy that issues certificates, such as Caddy or Cloudflare, in front of the platform.",
    }


def _view(row: PublishedSite | None) -> dict:
    if not row:
        return {"published": False}
    return {
        "published": True,
        "slug": row.slug,
        "url": site_url(row.slug),
        "path_url": f"/sites/{row.slug}/",
        "published_at": row.published_at.isoformat() if row.published_at else None,
        "files": row.files,
        "warnings": row.warnings or [],
        "custom_domain": _dns(row),
    }


async def _owned_project(db: AsyncSession, project_id: str, user: User) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id).options(selectinload(Project.pages)))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


async def _site_of(db: AsyncSession, project_id: str) -> PublishedSite | None:
    return (await db.execute(select(PublishedSite).where(PublishedSite.project_id == project_id))).scalar_one_or_none()


@router.get("/{project_id}")
async def get_status(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _owned_project(db, project_id, user)
    return _view(await _site_of(db, project_id))


@router.post("/{project_id}")
async def publish(project_id: str, payload: PublishIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    project = await _owned_project(db, project_id, user)
    row = await _site_of(db, project_id)
    slug = (payload.slug or (row.slug if row else slugify(project.name))).strip().lower()
    if not _valid_slug(slug):
        raise HTTPException(422, "Use 3 to 40 letters, numbers or hyphens for the site address. Some names are reserved.")
    taken = (await db.execute(select(PublishedSite).where(PublishedSite.slug == slug))).scalar_one_or_none()
    if taken and taken.project_id != project_id:
        raise HTTPException(409, "That address is already taken. Try another.")

    pages = sorted(project.pages, key=lambda p: p.order)
    data = {
        "name": project.name,
        "theme": project.theme,
        "settings": project.settings or {},
        "pages": [{"id": p.id, "name": p.name, "path": p.path, "is_home": p.is_home, "order": p.order, "tree": p.tree} for p in pages],
    }
    files = generate_project(data, CodegenOptions(framework="html"))
    web_files = [f for f in files if not f.path.endswith(".md")]

    target = site_dir(slug)
    if target.exists():
        shutil.rmtree(target)
    for f in web_files:
        out = (target / f.path).resolve()
        if target.resolve() not in out.parents:
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(f.content, encoding="utf-8")

    used = {n.get("type") for p in pages for n in (p.tree or [])}
    warnings = [f"Not live in the published version: {label}. A static site has no backend. Export the code with a backend to run it." for key, label in BACKEND_SECTIONS.items() if key in used and key != "forms"]

    if row and row.slug != slug:
        shutil.rmtree(site_dir(row.slug), ignore_errors=True)
        await db.delete(row)
        await db.flush()
        row = None
    if not row:
        row = PublishedSite(slug=slug, project_id=project_id, user_id=user.id, warnings=[])
        db.add(row)
    row.files = len(web_files)
    row.warnings = warnings
    row.published_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    return _view(row)


@router.delete("/{project_id}", status_code=204)
async def unpublish(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _owned_project(db, project_id, user)
    row = await _site_of(db, project_id)
    if row:
        shutil.rmtree(site_dir(row.slug), ignore_errors=True)
        await db.delete(row)
        await db.commit()


@router.post("/{project_id}/domain")
async def set_domain(project_id: str, payload: DomainIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _owned_project(db, project_id, user)
    row = await _site_of(db, project_id)
    if not row:
        raise HTTPException(409, "Publish the site first, then connect your domain.")
    domain = payload.domain.strip().lower().removeprefix("http://").removeprefix("https://").strip("/")
    if not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}", domain) or domain.endswith(settings.platform_domain):
        raise HTTPException(422, "Enter a domain such as www.example.com")
    clash = (await db.execute(select(PublishedSite).where(PublishedSite.domain == domain))).scalar_one_or_none()
    if clash and clash.project_id != project_id:
        raise HTTPException(409, "That domain is already connected to another site.")
    row.domain = domain
    row.domain_token = secrets.token_hex(8)
    row.domain_verified = False
    await db.commit()
    await db.refresh(row)
    return _view(row)


def check_dns(domain: str, token: str) -> tuple[bool, str]:
    """(ok, explanation). A matching TXT record proves ownership; the CNAME/A record proves it points here."""
    import dns.exception
    import dns.resolver

    resolver = dns.resolver.Resolver()
    resolver.lifetime = 5
    owned = False
    try:
        for rec in resolver.resolve(f"_vibe-verify.{domain}", "TXT"):
            if f"vibe-verify={token}" in "".join(s.decode() if isinstance(s, bytes) else s for s in rec.strings):
                owned = True
    except (dns.exception.DNSException, OSError):
        pass
    if not owned:
        return False, f"I couldn't find the TXT record _vibe-verify.{domain} with your code yet. DNS changes can take a few minutes to an hour."
    pointing = False
    try:
        for rec in resolver.resolve(domain, "CNAME"):
            if str(rec.target).rstrip(".").lower() == settings.platform_cname.lower():
                pointing = True
    except (dns.exception.DNSException, OSError):
        try:
            mine = {a[4][0] for a in socket.getaddrinfo(settings.platform_cname, None)}
            theirs = {a[4][0] for a in socket.getaddrinfo(domain, None)}
            pointing = bool(mine & theirs)
        except OSError:
            pointing = False
    if not pointing:
        return False, f"Ownership is confirmed, but {domain} doesn't point at {settings.platform_cname} yet. Add the CNAME record."
    return True, "Your domain is connected."


@router.post("/{project_id}/domain/verify")
async def verify_domain(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _owned_project(db, project_id, user)
    row = await _site_of(db, project_id)
    if not row or not row.domain:
        raise HTTPException(409, "Add a domain first.")
    ok, message = check_dns(row.domain, row.domain_token or "")
    row.domain_verified = ok
    await db.commit()
    await db.refresh(row)
    return {**_view(row), "message": message}


@router.delete("/{project_id}/domain", status_code=204)
async def remove_domain(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _owned_project(db, project_id, user)
    row = await _site_of(db, project_id)
    if row:
        row.domain, row.domain_token, row.domain_verified = None, None, False
        await db.commit()
