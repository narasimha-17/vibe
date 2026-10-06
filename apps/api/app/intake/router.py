"""Requirements interview API: /intake/*"""

import copy
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.core.db import get_db
from app.intake import agent as interviewer
from app.core.config import get_settings
from app.intake import content, sitewriter
from app.intake.analysis import acceptance_md, analyse, readme_md, requirements_md
from app.intake.memory import LongTermMemory, SessionMemory
from app.intake.topics import BY_KEY, TOPICS, clean_page_name
from app.models.models import IntakeSession, Page, Project, User, UserMemory
from app.projects.page_factory import build_page, slugify
from app.projects.templates import get_template_pages
from app.schemas.schemas import DesignTokens

settings = get_settings()

router = APIRouter(prefix="/intake", tags=["intake"])


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class StartIn(BaseModel):
    template_label: str | None = Field(default=None, max_length=120)


class MemoryIn(BaseModel):
    topic: str
    value: str = Field(max_length=2000)


class ProvisionIn(BaseModel):
    name: str = Field(default="My Website", min_length=1, max_length=120)
    template_key: str | None = None
    theme: DesignTokens | None = None
    extra_pages: list[str] = Field(default_factory=list, max_length=12)
    acceptance: list[dict] | None = None


async def _owned(db: AsyncSession, session_id: str, user: User) -> IntakeSession:
    row = await db.get(IntakeSession, session_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Interview not found")
    return row


async def _long_term(db: AsyncSession, user: User) -> tuple[UserMemory, LongTermMemory]:
    row = await db.get(UserMemory, user.id)
    if not row:
        row = UserMemory(user_id=user.id, data={})
        db.add(row)
    return row, LongTermMemory(row.data)


def _view(row: IntakeSession, extra: dict | None = None) -> dict:
    mem = SessionMemory(copy.deepcopy(row.memory))
    nxt = mem.missing()
    asking = bool(row.pending_topic and row.pending_topic.startswith("clar:")) or bool(mem.data.get("_agenda"))
    return {
        "id": row.id,
        "status": row.status,
        "messages": row.transcript,
        "memory": row.memory,
        "progress": mem.progress(),
        "ready": not nxt and not asking,
        "next_topic": row.pending_topic if asking else (nxt[0] if nxt else None),
        "topics": [{"key": t["key"], "label": t["label"], "required": t["required"]} for t in TOPICS],
        "suggestions": interviewer.chips_for(row.pending_topic, mem) if (nxt or asking) else [],
        "project_id": row.project_id,
        **(extra or {}),
    }


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(payload: StartIn | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    _, ltm = await _long_term(db, user)
    first = interviewer.greeting(ltm, payload.template_label if payload else None)
    chips = await interviewer.suggest_chips(first, SessionMemory({}))
    row = IntakeSession(user_id=user.id, memory={"_chips": chips} if chips else {}, transcript=[{"role": "assistant", "text": first}], pending_topic=TOPICS[0]["key"], summary={})
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _view(row, {"remembered": ltm.recall()})


@router.get("/sessions")
async def list_drafts(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Unfinished conversations, newest first, so they can be resumed or discarded."""
    result = await db.execute(select(IntakeSession).where(IntakeSession.user_id == user.id, IntakeSession.status != "provisioned").order_by(IntakeSession.updated_at.desc()).limit(30))
    out = []
    for row in result.scalars():
        if not any(m.get("role") == "user" for m in row.transcript):
            continue  # opened but never answered
        progress = SessionMemory(row.memory).progress()
        title = str(row.memory.get("name") or row.memory.get("business") or "Untitled draft")
        out.append({"id": row.id, "title": title[:80], "captured": progress["captured"], "total": progress["total"], "updated_at": row.updated_at.isoformat() if row.updated_at else None})
    return out


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(session_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await _owned(db, session_id, user)
    await db.delete(row)
    await db.commit()


@router.get("/sessions/latest")
async def latest_session(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(IntakeSession).where(IntakeSession.user_id == user.id, IntakeSession.status != "provisioned").order_by(IntakeSession.updated_at.desc()).limit(1)
    )
    row = result.scalar_one_or_none()
    return _view(row) if row else None


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return _view(await _owned(db, session_id, user))


@router.post("/sessions/{session_id}/message")
async def send_message(session_id: str, payload: MessageIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await _owned(db, session_id, user)
    if row.status == "provisioned":
        raise HTTPException(status.HTTP_409_CONFLICT, "This interview is finished")
    ltm_row, ltm = await _long_term(db, user)
    mem = SessionMemory(copy.deepcopy(row.memory))
    transcript = list(row.transcript)
    text = payload.text.strip()
    result = await interviewer.step(transcript, row.pending_topic, text, mem, ltm)
    if not mem.data.get("_chips") and not result["ready"]:
        # Quick replies written by the model for the question just asked; the fixed ones are the fallback.
        chips = await interviewer.suggest_chips(result["reply"], mem)
        if chips:
            mem.data["_chips"] = chips
    transcript += [{"role": "user", "text": text}, {"role": "assistant", "text": result["reply"]}]
    row.memory = copy.deepcopy(mem.data)  # new object so the JSON column change is detected
    row.transcript = transcript
    row.pending_topic = result["next_topic"]
    row.status = "reviewing" if result["ready"] and not mem.data.get("_agenda") else "interviewing"
    ltm_row.data = ltm.recall()
    await db.commit()
    return _view(row, {"reply": result["reply"], "engine": result["engine"], "note": result["note"], "captured_now": mem.changed})


@router.patch("/sessions/{session_id}/memory")
async def edit_memory(session_id: str, payload: MemoryIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await _owned(db, session_id, user)
    if payload.topic not in BY_KEY:
        raise HTTPException(422, "Unknown topic")
    mem = SessionMemory(copy.deepcopy(row.memory))
    mem.data.pop(payload.topic, None)
    if payload.value.strip():
        mem.remember(payload.topic, payload.value)
    row.memory = copy.deepcopy(mem.data)
    row.status = "reviewing" if not mem.missing() else "interviewing"
    await db.commit()
    return _view(row)


@router.post("/sessions/{session_id}/summary")
async def summary(session_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await _owned(db, session_id, user)
    clean = {k: v for k, v in row.memory.items() if not k.startswith("_")}
    data = analyse(clean)
    extra = await interviewer.analyst_suggestions("\n".join(f"{u['label']}: {u['value']}" for u in data["understanding"]))
    known = {r["title"].lower() for r in data["recommendations"]}
    data["recommendations"] += [s for s in extra if s["title"].lower() not in known]
    data["ai_suggestions"] = len(extra)
    data["brand_name"] = content.brand_name(row.memory)
    row.summary = copy.deepcopy(data)
    row.status = "reviewing"
    await db.commit()
    return data


@router.post("/sessions/{session_id}/provision", status_code=status.HTTP_201_CREATED)
async def provision(session_id: str, payload: ProvisionIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Creates the workspace: pages from the plan, brief, requirements, acceptance checklist and full documentation."""
    row = await _owned(db, session_id, user)
    if row.status == "provisioned" and row.project_id:
        return {"project_id": row.project_id}
    memory = {k: v for k, v in row.memory.items() if not k.startswith("_")}
    data = analyse(memory)
    template_key = payload.template_key or data["recommended"]["template"]
    payload.name = payload.name.strip() if payload.name.strip() and payload.name != "My Website" else content.brand_name(memory)
    pages = copy.deepcopy(get_template_pages(template_key))
    home = next((p for p in pages if p.get("is_home")), pages[0])
    navbar = next((n for n in home["tree"] if n.get("type") == "navbar"), None)
    old_brand = str((navbar or {}).get("props", {}).get("brand", ""))
    footer = next((n for n in home["tree"] if n.get("type") == "footer"), None)

    wanted = [n for n in (clean_page_name(x) for x in data["pages"]["names"]) if n] + [p["name"] for p in data["pages"]["implied"]] + payload.extra_pages
    have = {p["name"].lower() for p in pages} | {p["path"].strip("/").lower() for p in pages}
    added: list[str] = []
    for label in wanted:
        if label.lower() in ("home", "homepage") or label.lower() in have or slugify(label) in have:
            continue
        pages.append({k: v for k, v in build_page(label, navbar, footer, payload.name, data.get("pages", {}).get("domain", "")).items() if k != "kind"})
        have |= {label.lower(), slugify(label)}
        added.append(label)
    pages = sitewriter.prepare(pages)

    # Brand and navigation: every page shows the project name and links to every page.
    labels = [p["name"] for p in pages if not p.get("is_home")]
    asked = [n.lower() for n in data["pages"]["names"]]
    ordered = sorted(labels, key=lambda l: asked.index(l.lower()) if l.lower() in asked else len(asked))
    for page in pages:
        for node in page["tree"]:
            if node.get("type") in ("navbar", "footer"):
                node["props"]["brand"] = payload.name
                if node["type"] == "navbar":
                    node["props"]["links"] = ordered[:6]  # the site's own pages, in the order the user asked for them
                else:
                    node["props"]["left"] = f"© 2026 {payload.name}"

    # Make the content the user's own: their name, offers, FAQs and copy instead of the template's placeholders.
    written = await content.write_copy(payload.name, memory)
    pack = content.tailor(pages, memory, payload.name, written, old_brand)
    # Then the model writes every text on every page for this business; the template only decides structure and look.
    await sitewriter.write_site(pages, memory, payload.name)

    checklist = payload.acceptance if payload.acceptance is not None else data["acceptance"]
    has_backend = any(n.get("type") in ("shop", "tracking", "auth", "forms", "chatbot") for p in pages for n in p["tree"])
    docs = {
        "requirements": requirements_md(payload.name, memory, data),
        "acceptance": acceptance_md(payload.name, checklist),
        "readme": readme_md(payload.name, data, checklist, has_backend),
    }
    brief = str(memory.get("business", ""))
    project = Project(
        owner_id=user.id,
        name=payload.name,
        theme=(payload.theme or DesignTokens()).model_dump(),
        settings={
            "seo": {"title": payload.name, "description": brief[:150]},
            "projectBrief": {
                "brief": brief,
                "audience": str(memory.get("audience", "")),
                "visualStyle": str(memory.get("style", "")),
                "requiredFeatures": [f["feature"] for f in data["features"]],
            },
            "requirements": memory,
            "analysis": data,
            "acceptance": checklist,
            "docs": docs,
        },
        template_key=template_key,
    )
    db.add(project)
    await db.flush()
    for i, p in enumerate(pages):
        db.add(Page(project_id=project.id, name=p["name"], path=p["path"], is_home=p.get("is_home", False), order=i, tree=p["tree"]))

    ltm_row, ltm = await _long_term(db, user)
    ltm.remember("business_name", payload.name)
    ltm.remember("industry", template_key)
    ltm.remember("style", str(memory.get("style", "")) or data["recommended"]["style"])
    ltm.remember("typical_pages", data["pages"]["names"][:8])
    if data["integrations"]:
        ltm.remember("integrations", [i["name"] for i in data["integrations"]])
    ltm_row.data = ltm.recall()
    row.status = "provisioned"
    row.project_id = project.id
    await db.commit()
    # The build agents start from the builder when it opens (it sends the rendered design along), see AgentBuildChip.
    return {"project_id": project.id, "pages": [p["name"] for p in pages], "pages_added": added, "template": template_key}
