"""The builder assistant's memory.

  * Conversation: the last messages of the chat for this project. Saved on the server, so the chat is still there
    after a refresh and the assistant knows what was said (so “discount” can answer its own question).
  * Project notes: lasting facts about this site (brand name, tone, decisions) that the assistant saves with its
    `remember` tool or picks up from what the user says.
  * User notes: preferences that apply to every project of this user.

Notes are shown to the user, who can delete any of them.
"""

import re
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Project, User, UserMemory

MAX_HISTORY = 40
MAX_NOTES = 30


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean_note(text: str) -> str:
    return re.sub(r"\s+", " ", str(text)).strip()[:200]


def _add(notes: list[dict], text: str, source: str = "assistant") -> list[dict]:
    text = clean_note(text)
    if not text or any(n["text"].lower() == text.lower() for n in notes):
        return notes
    return (notes + [{"text": text, "source": source, "at": _now()}])[-MAX_NOTES:]


def auto_notes(prompt: str) -> list[str]:
    """Facts worth keeping that are stated plainly, with no model needed."""
    out = []
    m = re.search(r"\b(?:my (?:brand|business|company|site|shop|store) (?:is|name is)|call (?:it|the site|my site)|we are called|our (?:brand|name) is)\s+[\"“']?([A-Z0-9][\w&' .-]{1,40})", prompt)
    if m:
        out.append(f"The brand is called {m.group(1).strip(' .,')}.")
    m = re.search(r"\b(?:i|we) (?:prefer|like|want|love)\s+(?:a\s+|an\s+)?((?:minimal|clean|premium|elegant|playful|bold|modern|warm|dark|light|colou?rful|simple)[\w ,-]{0,40})", prompt, re.I)
    if m:
        out.append(f"Prefers a {m.group(1).strip(' .,').lower()} look.")
    m = re.search(r"\b(?:always|never|don'?t ever)\s+([a-z][\w ,'-]{4,60})", prompt, re.I)
    if m and len(prompt.split()) < 25:
        out.append(prompt.strip().rstrip(".") + ".")
    return out


async def load(db: AsyncSession, project: Project | None, user: User) -> dict:
    row = await db.get(UserMemory, user.id)
    settings = (project.settings or {}) if project else {}
    return {
        "history": list(settings.get("agent_history") or []),
        "notes": list(settings.get("agent_notes") or []),
        "user_notes": list(((row.data if row else {}) or {}).get("builder_notes") or []),
    }


async def save(db: AsyncSession, project: Project | None, user: User, *, history: list[dict] | None = None, notes: list[str] | None = None, user_notes: list[str] | None = None) -> None:
    if project is not None and (history is not None or notes):
        settings = dict(project.settings or {})
        if history is not None:
            settings["agent_history"] = [{"role": h["role"], "text": str(h["text"])[:800]} for h in history][-MAX_HISTORY:]
        if notes:
            current = list(settings.get("agent_notes") or [])
            for n in notes:
                current = _add(current, n)
            settings["agent_notes"] = current
        project.settings = settings  # a new object, so the JSON column change is saved
    if user_notes:
        row = await db.get(UserMemory, user.id)
        if not row:
            row = UserMemory(user_id=user.id, data={})
            db.add(row)
        data = dict(row.data or {})
        current = list(data.get("builder_notes") or [])
        for n in user_notes:
            current = _add(current, n)
        data["builder_notes"] = current
        row.data = data
    await db.commit()


def render(notes: list[dict], user_notes: list[dict]) -> list[str]:
    """The memory as plain lines for the model."""
    return [f"About this site: {n['text']}" for n in notes] + [f"About this user: {n['text']}" for n in user_notes]
