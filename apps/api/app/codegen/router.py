import asyncio

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.auth.deps import get_current_user
from app.codegen.engine import generate_project
from app.codegen.verify import verify_project
from app.codegen.zip import build_zip
from app.models.models import User
from app.schemas.schemas import CodeFile, CodegenPreviewResponse, CodegenRequest

router = APIRouter(prefix="/codegen", tags=["codegen"])


@router.post("/preview", response_model=CodegenPreviewResponse)
async def preview(payload: CodegenRequest, user: User = Depends(get_current_user)):
    files = generate_project(payload.project.model_dump(), payload.options)
    return CodegenPreviewResponse(files=[CodeFile(path=f.path, content=f.content) for f in files])


@router.post("/zip")
async def download_zip(payload: CodegenRequest, user: User = Depends(get_current_user)):
    files = generate_project(payload.project.model_dump(), payload.options)
    data = build_zip(files)
    filename = f"{payload.project.name.lower().replace(' ', '-') or 'vibe-project'}.zip"
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/verify")
async def verify(payload: CodegenRequest, user: User = Depends(get_current_user)):
    """Generate, integrate and test the export (runs the generated backend's tests). Can take up to a minute."""
    return await asyncio.to_thread(verify_project, payload.project.model_dump(), payload.options)
