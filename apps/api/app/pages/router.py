from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.core.db import get_db
from app.models.models import Page, Project, User
from app.schemas.schemas import PageCreate, PageOut, PageUpdate

router = APIRouter(prefix="/projects/{project_id}/pages", tags=["pages"])


async def _assert_owns_project(db: AsyncSession, project_id: str, user: User) -> None:
    result = await db.execute(select(Project.id).where(Project.id == project_id, Project.owner_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


async def _get_page(db: AsyncSession, project_id: str, page_id: str) -> Page:
    result = await db.execute(select(Page).where(Page.id == page_id, Page.project_id == project_id))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return page


@router.get("", response_model=list[PageOut])
async def list_pages(
    project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _assert_owns_project(db, project_id, user)
    result = await db.execute(select(Page).where(Page.project_id == project_id).order_by(Page.order))
    return result.scalars().all()


@router.post("", response_model=PageOut, status_code=status.HTTP_201_CREATED)
async def create_page(
    project_id: str,
    payload: PageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_owns_project(db, project_id, user)
    count_result = await db.execute(select(Page).where(Page.project_id == project_id))
    order = len(count_result.scalars().all())
    page = Page(
        project_id=project_id,
        name=payload.name,
        path=payload.path,
        is_home=payload.is_home,
        order=order,
        tree=[],
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return page


@router.patch("/{page_id}", response_model=PageOut)
async def update_page(
    project_id: str,
    page_id: str,
    payload: PageUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_owns_project(db, project_id, user)
    page = await _get_page(db, project_id, page_id)
    if payload.name is not None:
        page.name = payload.name
    if payload.path is not None:
        page.path = payload.path
    if payload.is_home is not None:
        page.is_home = payload.is_home
    if payload.order is not None:
        page.order = payload.order
    if payload.tree is not None:
        page.tree = [n.model_dump() for n in payload.tree]
    await db.commit()
    await db.refresh(page)
    return page


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(
    project_id: str,
    page_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_owns_project(db, project_id, user)
    page = await _get_page(db, project_id, page_id)
    await db.delete(page)
    await db.commit()
