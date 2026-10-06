import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import agent, memory, skills
from app.ai.providers import RuleBasedProvider, get_ai_provider
from app.auth.deps import get_current_user
from app.core.db import get_db
from app.models.models import Project, User
from app.schemas.schemas import AICommandRequest, AICommandResponse

router = APIRouter(prefix="/ai", tags=["ai"])


async def _fast_paths(payload: AICommandRequest) -> AICommandResponse | None:
    """The built-in skills: instant and exact for requests they know, and the fallback when no capable model is available."""
    from app.ai import tasks

    big = await tasks.handle(payload)
    if big is not None:
        return big
    done = skills.plan(payload.prompt, payload.tree_summary, payload.pages)
    if done is not None:
        message, ops = done
        return AICommandResponse(message=message, ops=ops, provider="assistant")
    return None


async def _legacy(payload: AICommandRequest) -> AICommandResponse:
    """Older keyword rules, then the plain model, for anything else."""
    ruled = await RuleBasedProvider().generate(payload)
    if ruled.ops and len(payload.prompt.split()) <= 2 and not re.search(r"\b(add|remove|delete|create|make|change|show|hide|insert|translate|rewrite|undo)\b", payload.prompt.lower()):
        return AICommandResponse(message=f"I'm not sure what to do with “{payload.prompt.strip()}”. Tell me the change you want, for example “add a {payload.prompt.strip()} banner” or “add a {payload.prompt.strip()} button to the navbar”.", ops=[], provider="assistant")
    if ruled.ops:
        small = re.search(r"\b(button|icon|link|item|text|label|heading|title|image|logo)\b", payload.prompt.lower())
        if small and any(op.op == "delete_component" for op in ruled.ops):
            return AICommandResponse(message="That sounds like a change inside a section, not removing the whole section, so I haven't deleted anything. Tell me which button or item, and what to do with it. For example: “remove the cart button from the shop section”.", ops=[], provider="assistant")
        return ruled
    return await get_ai_provider().generate(payload)


@router.post("/command", response_model=AICommandResponse)
async def ai_command(payload: AICommandRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    project = None
    if payload.project_id:
        project = (await db.execute(select(Project).where(Project.id == payload.project_id, Project.owner_id == user.id))).scalar_one_or_none()
    mem = await memory.load(db, project, user)
    # the assistant's memory: the saved conversation (if the browser sent none) and lasting notes
    if not payload.history:
        payload.history = list(mem["history"])
    payload.memory = memory.render(mem["notes"], mem["user_notes"])
    if not payload.last_ai:
        payload.last_ai = next((h["text"] for h in reversed(payload.history) if h.get("role") == "ai"), "")

    # a short reply to a question the assistant just asked is the answer to it, not a new request
    words = payload.prompt.strip().split()
    if payload.last_ai.startswith("Which button should I add to the navbar") and 0 < len(words) <= 3:
        payload.prompt = f"add {payload.prompt.strip()} button to the navbar"

    sink: dict = {}
    response: AICommandResponse | None = None
    if agent.strong_model():
        # A capable hosted model: the agent reasons with tools, with the fast skills as the fallback.
        response = await agent.run(payload, sink=sink)
        if response is None:
            response = await _fast_paths(payload)
    else:
        # Only a small local model: the exact built-in skills come first because they are reliable; the agent takes the rest.
        response = await _fast_paths(payload)
        if response is None and payload.registry:
            response = await agent.run(payload, sink=sink)
    if response is None:
        response = await _legacy(payload)

    # remember: the conversation, plus lasting facts (stated plainly, or saved by the agent)
    turn = list(payload.history) + [{"role": "user", "text": payload.prompt}, {"role": "ai", "text": response.message}]
    await memory.save(db, project, user, history=turn, notes=memory_notes(payload.prompt) + sink.get("notes", []), user_notes=sink.get("user_notes", []))
    return response


def memory_notes(prompt: str) -> list[str]:
    return memory.auto_notes(prompt)


class NoteOut(BaseModel):
    text: str
    source: str = ""
    at: str = ""


@router.get("/memory/{project_id}")
async def get_memory(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id))).scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")
    return await memory.load(db, project, user)


@router.delete("/memory/{project_id}", status_code=204)
async def clear_memory(project_id: str, notes: bool = False, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Clears the saved conversation, and the notes too with ?notes=true."""
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id))).scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")
    settings_ = dict(project.settings or {})
    settings_["agent_history"] = []
    if notes:
        settings_["agent_notes"] = []
    project.settings = settings_
    await db.commit()


@router.delete("/memory/{project_id}/notes/{index}", status_code=204)
async def forget_note(project_id: str, index: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id))).scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")
    settings_ = dict(project.settings or {})
    notes_ = list(settings_.get("agent_notes") or [])
    if 0 <= index < len(notes_):
        notes_.pop(index)
    settings_["agent_notes"] = notes_
    project.settings = settings_
    await db.commit()


class ImportImageIn(BaseModel):
    image_base64: str
    media_type: str = "image/png"


@router.post("/import-image")
async def import_image(payload: ImportImageIn, user: User = Depends(get_current_user)):
    """Rebuild the layout of a screenshot as a page. Needs a vision model (an Anthropic API key)."""
    import base64
    import re as _re

    from app.ai import importer
    from app.schemas.schemas import AIOp

    if payload.media_type not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
        return AICommandResponse(message="Please send a PNG, JPG, WebP or GIF image.", ops=[], provider="assistant")
    try:
        data = base64.b64decode(payload.image_base64, validate=False)
        if len(data) > 5_000_000:
            return AICommandResponse(message="That image is larger than 5 MB. Please use a smaller screenshot.", ops=[], provider="assistant")
        title, tree = await importer.import_screenshot(data, payload.media_type)
    except ValueError as exc:
        return AICommandResponse(message=str(exc), ops=[], provider="assistant")
    except Exception:  # noqa: BLE001
        return AICommandResponse(message="I couldn't read that screenshot. Try a clearer, larger one.", ops=[], provider="assistant")
    name = _re.sub(r"[^A-Za-z0-9 &'-]", "", title).strip()[:28] or "Imported"
    op = AIOp(op="create_page", description=f"Create the page “{name}” from your screenshot", payload={"name": name, "path": "/" + _re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), "tree": tree})
    return AICommandResponse(message=f"I rebuilt the layout of your screenshot as “{name}”: {', '.join(n['type'] for n in tree)}. Apply to add it as a new page.", ops=[op], provider="assistant", preview=True)
