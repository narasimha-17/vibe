from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assets.storage import storage
from app.auth.deps import get_current_user
from app.core.db import get_db
from app.models.models import Asset, Project, User
from app.schemas.schemas import AssetOut

router = APIRouter(prefix="/projects/{project_id}/assets", tags=["assets"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15MB for images
MAX_VIDEO_BYTES = 60 * 1024 * 1024  # 60MB for mp4 / webm


async def _assert_owns_project(db: AsyncSession, project_id: str, user: User) -> None:
    result = await db.execute(select(Project.id).where(Project.id == project_id, Project.owner_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.get("", response_model=list[AssetOut])
async def list_assets(
    project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _assert_owns_project(db, project_id, user)
    result = await db.execute(select(Asset).where(Asset.project_id == project_id))
    return result.scalars().all()


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    project_id: str,
    file: UploadFile,
    folder: str = "/",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_owns_project(db, project_id, user)
    content = await file.read()
    is_video = (file.content_type or "").startswith("video/")
    limit = MAX_VIDEO_BYTES if is_video else MAX_UPLOAD_BYTES
    if len(content) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {limit // (1024 * 1024)}MB)",
        )

    url = await storage.save(project_id, file.filename or "upload", content)
    asset = Asset(
        project_id=project_id,
        filename=file.filename or "upload",
        url=url,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        folder=folder,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    project_id: str,
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _assert_owns_project(db, project_id, user)
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.project_id == project_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    await storage.delete(asset.url)
    await db.delete(asset)
    await db.commit()
