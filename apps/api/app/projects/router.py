import copy

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.deps import get_current_user
from app.core.db import get_db
from app.models.models import Page, Project, Snapshot, User
from app.projects.templates import TEMPLATES, get_template_pages
from app.schemas.schemas import (
    DesignTokens,
    ProjectCreate,
    ProjectDetailOut,
    ProjectOut,
    ProjectSyncRequest,
    ProjectUpdate,
    SnapshotOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])


class NavbarPagesIn(BaseModel):
    pages: list[dict]


class PresetPageIn(BaseModel):
    label: str
    pages: list[dict]
    domain: str = ""
    business: str = ""
    brand: str = ""


@router.post("/pages/preset")
async def preset_page(payload: PresetPageIn, user: User = Depends(get_current_user)):
    """A ready-made page (Shop, Track order, Login, Contact ...) that matches the site's navbar, footer and brand."""
    from app.projects.page_factory import build_page

    home = next((p for p in payload.pages if p.get("is_home")), payload.pages[0] if payload.pages else None)
    tree = (home or {}).get("tree", [])
    navbar = next((n for n in tree if n.get("type") == "navbar"), None)
    footer = next((n for n in tree if n.get("type") == "footer"), None)
    brand = payload.brand or (navbar or {}).get("props", {}).get("brand", "Your Brand")
    page = build_page(payload.label, navbar, footer, brand, payload.domain)
    if payload.business:
        # fill the page with content that suits this business instead of generic placeholder text
        from app.intake.content import tailor

        tailor([page], {"business": payload.business}, brand)
    return {"name": page["name"], "path": page["path"], "tree": page["tree"]}


@router.post("/pages/from-navbar")
async def pages_from_navbar_endpoint(payload: NavbarPagesIn, user: User = Depends(get_current_user)):
    """Ready-made pages for navbar links that have no page yet. Nothing is saved here; the builder adds them."""
    from app.projects.page_factory import pages_from_navbar

    return [{"name": p["name"], "path": p["path"], "tree": p["tree"]} for p in pages_from_navbar(payload.pages)]


async def _get_owned_project(db: AsyncSession, project_id: str, user: User, with_pages: bool = False) -> Project:
    stmt = select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    if with_pages:
        stmt = stmt.options(selectinload(Project.pages))
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Project).where(Project.owner_id == user.id).order_by(Project.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/templates")
async def list_templates(full: bool = False):
    """Marketplace listing. With ?full=true each template also includes its pages so the UI can render real previews."""
    out = []
    for key, t in TEMPLATES.items():
        item = {"key": key, "label": t["label"], "description": t["description"]}
        if full:
            item["pages"] = t["pages"]
        out.append(item)
    return out


@router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    project = Project(
        owner_id=user.id,
        name=payload.name,
        theme=(payload.theme or DesignTokens()).model_dump(),
        settings={
            "seo": {"title": payload.name, "description": ""},
            "projectBrief": {
                "brief": payload.brief,
                "audience": payload.audience,
                "visualStyle": payload.visual_style,
                "requiredFeatures": payload.required_features,
            },
        },
        template_key=payload.template_key,
    )
    db.add(project)
    await db.flush()

    for i, page_data in enumerate(get_template_pages(payload.template_key)):
        db.add(
            Page(
                project_id=project.id,
                name=page_data["name"],
                path=page_data["path"],
                is_home=page_data["is_home"],
                order=i,
                tree=page_data["tree"],
            )
        )
    await db.commit()

    result = await db.execute(
        select(Project).where(Project.id == project.id).options(selectinload(Project.pages))
    )
    return result.scalar_one()


@router.get("/{project_id}", response_model=ProjectDetailOut)
async def get_project(
    project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    return await _get_owned_project(db, project_id, user, with_pages=True)


@router.patch("/{project_id}", response_model=ProjectDetailOut)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _get_owned_project(db, project_id, user, with_pages=True)
    if payload.name is not None:
        project.name = payload.name
    if payload.theme is not None:
        project.theme = payload.theme.model_dump()
    if payload.settings is not None:
        project.settings = {**project.settings, **payload.settings}
    await db.commit()
    await db.refresh(project)
    return project


@router.put("/{project_id}/sync", response_model=ProjectDetailOut)
async def sync_project(
    project_id: str,
    payload: ProjectSyncRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Autosave endpoint: upserts name/theme/pages in one call using the
    client-generated page ids as primary keys directly (new pages simply
    don't exist in the DB yet; existing ones get updated in place). This
    sidesteps having to reconcile client vs. server ids on every keystroke.
    """
    project = await _get_owned_project(db, project_id, user, with_pages=True)
    project.name = payload.name
    project.theme = payload.theme.model_dump()

    existing_by_id = {p.id: p for p in project.pages}
    incoming_ids = {p.id for p in payload.pages}

    for page_data in payload.pages:
        tree_dump = [n.model_dump() for n in page_data.tree]
        if page_data.id in existing_by_id:
            page = existing_by_id[page_data.id]
            page.name = page_data.name
            page.path = page_data.path
            page.is_home = page_data.is_home
            page.order = page_data.order
            page.tree = tree_dump
        else:
            db.add(
                Page(
                    id=page_data.id,
                    project_id=project.id,
                    name=page_data.name,
                    path=page_data.path,
                    is_home=page_data.is_home,
                    order=page_data.order,
                    tree=tree_dump,
                )
            )

    for page in project.pages:
        if page.id not in incoming_ids:
            await db.delete(page)

    await db.commit()
    result = await db.execute(
        select(Project)
        .where(Project.id == project.id)
        .options(selectinload(Project.pages))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    project = await _get_owned_project(db, project_id, user)
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/duplicate", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
async def duplicate_project(
    project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    original = await _get_owned_project(db, project_id, user, with_pages=True)
    clone = Project(
        owner_id=user.id,
        name=f"{original.name} (Copy)",
        theme=copy.deepcopy(original.theme),
        settings=copy.deepcopy(original.settings),
        template_key=original.template_key,
    )
    db.add(clone)
    await db.flush()
    for page in original.pages:
        db.add(
            Page(
                project_id=clone.id,
                name=page.name,
                path=page.path,
                is_home=page.is_home,
                order=page.order,
                tree=copy.deepcopy(page.tree),
            )
        )
    await db.commit()
    result = await db.execute(select(Project).where(Project.id == clone.id).options(selectinload(Project.pages)))
    return result.scalar_one()


# ── Version history ──────────────────────────────────────────────
@router.post("/{project_id}/snapshots", response_model=SnapshotOut, status_code=status.HTTP_201_CREATED)
async def create_snapshot(
    project_id: str,
    label: str = "Manual save",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _get_owned_project(db, project_id, user, with_pages=True)
    data = {
        "name": project.name,
        "theme": project.theme,
        "pages": [
            {"name": p.name, "path": p.path, "is_home": p.is_home, "order": p.order, "tree": p.tree}
            for p in project.pages
        ],
    }
    snapshot = Snapshot(project_id=project.id, label=label, data=data)
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)
    return snapshot


@router.get("/{project_id}/snapshots", response_model=list[SnapshotOut])
async def list_snapshots(
    project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_project(db, project_id, user)
    result = await db.execute(select(Snapshot).where(Snapshot.project_id == project_id))
    return result.scalars().all()


@router.post("/{project_id}/restore/{snapshot_id}", response_model=ProjectDetailOut)
async def restore_snapshot(
    project_id: str,
    snapshot_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _get_owned_project(db, project_id, user, with_pages=True)
    result = await db.execute(select(Snapshot).where(Snapshot.id == snapshot_id, Snapshot.project_id == project_id))
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")

    project.name = snapshot.data["name"]
    project.theme = snapshot.data["theme"]
    for page in list(project.pages):
        await db.delete(page)
    await db.flush()
    for page_data in snapshot.data["pages"]:
        db.add(
            Page(
                project_id=project.id,
                name=page_data["name"],
                path=page_data["path"],
                is_home=page_data["is_home"],
                order=page_data["order"],
                tree=page_data["tree"],
            )
        )
    await db.commit()
    result = await db.execute(select(Project).where(Project.id == project.id).options(selectinload(Project.pages)))
    return result.scalar_one()


class ChecklistTick(BaseModel):
    done: bool


def _as_dict(project: Project) -> dict:
    pages = sorted(project.pages, key=lambda p: p.order)
    return {"name": project.name, "theme": project.theme or {}, "settings": project.settings or {}, "pages": [{"id": p.id, "name": p.name, "path": p.path, "is_home": p.is_home, "tree": p.tree} for p in pages]}


@router.get("/{project_id}/checklist")
async def get_checklist(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """The acceptance checklist from the OORA conversation, with items ticked automatically when the site meets them."""
    from app.projects.checklist import build

    project = await _get_owned_project(db, project_id, user, with_pages=True)
    return build(_as_dict(project))


@router.post("/{project_id}/checklist/auto-fix")
async def auto_fix_checklist(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Fixes what the checklist can verify mechanically: every existing page gets linked from the navbar. Free, instant,
    no model involved. Pages that are linked but still nearly empty are reported back, since only content can fix those."""
    from app.projects.checklist import build
    from app.projects.linkage import fix_navbar_links, thin_pages

    project = await _get_owned_project(db, project_id, user, with_pages=True)
    pages = sorted(project.pages, key=lambda p: p.order)
    # A fresh dict per page (deepcopy), so the mutation below doesn't just rewrite the ORM's own JSON in place
    # (which SQLAlchemy wouldn't see as a change) and so the ORM object is assigned a genuinely new value.
    page_dicts = copy.deepcopy([{"name": p.name, "tree": p.tree} for p in pages])
    linked = fix_navbar_links(page_dicts)
    for page, page_dict in zip(pages, page_dicts):
        page.tree = page_dict["tree"]
    await db.commit()
    await db.refresh(project, attribute_names=["pages"])
    return {**build(_as_dict(project)), "linked": linked, "still_thin": thin_pages(page_dicts)}


@router.patch("/{project_id}/checklist/{item_id}")
async def tick_checklist(project_id: str, item_id: str, payload: ChecklistTick, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.projects.checklist import build

    project = await _get_owned_project(db, project_id, user, with_pages=True)
    settings_ = copy.deepcopy(project.settings or {})
    items = settings_.get("acceptance") or []
    hit = next((i for i in items if i.get("id") == item_id), None)
    if not hit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checklist item not found")
    hit["done"] = payload.done
    project.settings = settings_  # a new object, so the JSON column change is saved
    await db.commit()
    return build(_as_dict(project))
