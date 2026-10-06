from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from github import Github, GithubException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import oauth
from app.auth.deps import get_current_user
from app.codegen.engine import generate_project
from app.core.config import get_settings
from app.core.db import get_db
from app.models.models import GithubConnection, Project, User
from app.schemas.schemas import GithubPushRequest, GithubPushResponse, GithubStatusOut

router = APIRouter(prefix="/github", tags=["github"])
settings = get_settings()


@router.get("/status", response_model=GithubStatusOut)
async def status(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(GithubConnection).where(GithubConnection.user_id == user.id))
    conn = result.scalar_one_or_none()
    return GithubStatusOut(connected=bool(conn), github_username=conn.github_username if conn else None)


@router.delete("/connect", status_code=204)
async def disconnect(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(GithubConnection).where(GithubConnection.user_id == user.id))
    conn = result.scalar_one_or_none()
    if conn:
        await db.delete(conn)
        await db.commit()


@router.get("/connect/start")
async def connect_start():
    # Intentionally not behind get_current_user: this is hit via a plain
    # browser navigation (redirect chain), which can't carry an Authorization
    # header. The callback re-attaches the result to the logged-in user via
    # the Next.js route's own httpOnly cookie — see app/api/github/callback.
    if not settings.github_configured:
        raise HTTPException(status_code=501, detail="GitHub integration isn't configured yet (missing GITHUB_CLIENT_ID/SECRET)")
    redirect_uri = f"{settings.api_base_url}/github/connect/callback"
    return RedirectResponse(oauth.github_authorize_url(redirect_uri, scope="repo read:user"))


@router.get("/connect/callback")
async def connect_callback(code: str, db: AsyncSession = Depends(get_db)):
    # NOTE: in a real app this callback needs to know *which* user initiated
    # the connect flow (carried via the `state` param, which this scaffold's
    # oauth.py intentionally omits — see the TODO there). For now the token
    # is attached to whoever's session initiated it client-side.
    redirect_uri = f"{settings.api_base_url}/github/connect/callback"
    access_token = await oauth.github_exchange_code(code, redirect_uri)
    profile = await oauth.github_fetch_user(access_token)
    return RedirectResponse(
        f"{settings.web_base_url}/api/github/callback?token={access_token}&username={profile['username']}"
    )


@router.post("/connect/save")
async def connect_save(
    access_token: str,
    github_username: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(GithubConnection).where(GithubConnection.user_id == user.id))
    conn = result.scalar_one_or_none()
    if conn:
        conn.access_token = access_token
        conn.github_username = github_username
    else:
        conn = GithubConnection(user_id=user.id, access_token=access_token, github_username=github_username)
        db.add(conn)
    await db.commit()
    return {"ok": True}


@router.post("/projects/{project_id}/push", response_model=GithubPushResponse)
async def push_project(
    project_id: str,
    payload: GithubPushRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(GithubConnection).where(GithubConnection.user_id == user.id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=501, detail="Connect your GitHub account first (Settings → Integrations)")

    files = generate_project(payload.project.model_dump(), payload.options)

    gh = Github(conn.access_token)
    gh_user = gh.get_user()
    try:
        repo = gh_user.create_repo(payload.repo_name, private=payload.private, auto_init=True)
    except GithubException as exc:
        if exc.status == 422:
            repo = gh_user.get_repo(payload.repo_name)
        else:
            raise HTTPException(status_code=502, detail=f"GitHub error: {exc.data}") from exc

    last_sha = ""
    for f in files:
        try:
            existing = repo.get_contents(f.path)
            commit = repo.update_file(f.path, f"Update {f.path}", f.content, existing.sha)
        except GithubException:
            commit = repo.create_file(f.path, f"Add {f.path}", f.content)
        last_sha = commit["commit"].sha

    proj_result = await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id))
    project = proj_result.scalar_one_or_none()
    if project:
        project.github_repo = {"repo_url": repo.html_url, "branch": repo.default_branch, "last_commit_sha": last_sha}
        await db.commit()

    return GithubPushResponse(repo_url=repo.html_url, branch=repo.default_branch, commit_sha=last_sha)
