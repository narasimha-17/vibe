"""Serves published sites: by path (/sites/<slug>/...), by subdomain (<slug>.<platform domain>) and by verified custom domain."""

import mimetypes
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import get_db
from app.models.models import PublishedSite
from app.publish.router import site_dir

settings = get_settings()
router = APIRouter(tags=["sites"])

NOT_FOUND = "<!doctype html><meta charset=utf-8><title>Not found</title><body style='font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0'><div style='text-align:center'><h1>404</h1><p>This page doesn't exist.</p></div></body>"


@asynccontextmanager
async def _session(app):
    dep = app.dependency_overrides.get(get_db, get_db)
    gen = dep()
    session = await gen.__anext__()
    try:
        yield session
    finally:
        await gen.aclose()


def resolve_file(slug: str, path: str) -> Path | None:
    """The file for a request path inside a site, or None. Never leaves the site's folder."""
    root = site_dir(slug).resolve()
    rel = path.strip("/")
    candidates = [rel or "index.html", f"{rel}/index.html", f"{rel}.html"] if rel else ["index.html"]
    for c in candidates:
        f = (root / c).resolve()
        if root in f.parents and f.is_file():
            return f
    return None


def _file_response(f: Path) -> FileResponse:
    ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
    return FileResponse(f, media_type=ctype, headers={"Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff"})


@router.get("/sites/{slug}")
@router.get("/sites/{slug}/{path:path}")
async def serve_by_path(slug: str, path: str = ""):
    f = resolve_file(slug, path)
    if not f:
        raise HTTPException(404, "Not found")
    return _file_response(f)


async def hosting_middleware(request: Request, call_next):
    """If the request is for a published site's own address, answer with that site instead of the API."""
    host = (request.headers.get("host") or "").split(":")[0].lower()
    domain = settings.platform_domain.lower()
    slug = None
    if host.endswith("." + domain) and host != domain:
        slug = host[: -(len(domain) + 1)]
    elif host and host not in ("localhost", "127.0.0.1", "testserver", domain) and not host.endswith("localhost") and "." in host:
        async with _session(request.app) as db:
            row = (await db.execute(select(PublishedSite).where(PublishedSite.domain == host, PublishedSite.domain_verified.is_(True)))).scalar_one_or_none()
            slug = row.slug if row else None
    if not slug or request.method not in ("GET", "HEAD"):
        return await call_next(request)
    f = resolve_file(slug, request.url.path)
    if not f:
        return HTMLResponse(NOT_FOUND, status_code=404)
    return _file_response(f)
