"""Long-term memory for the build agents, one file per user: storage/agent-memory/<user id>.json.

It keeps two things between builds:
- lessons: problems that happened in a build and how they were fixed (from the fixing agent's notes and the Integration
  agent's findings), so the next build's agents avoid them. Repeated lessons rise to the top; at most MAX_LESSONS are kept.
- design preferences: the styles and custom designs the user chose in the Design step, so the UI agent knows their taste.

The orchestrator loads it into BuildContext.memory before a build and calls learn() afterwards. Within a build, the agents
share a notes board (BuildContext.notes, see base.py), saved with the build as NOTES.md.
"""

import json
import pathlib
import re
import time
from collections import Counter

from app.agents.base import BuildContext
from app.core.config import get_settings

settings = get_settings()

MAX_LESSONS = 25


def _path(owner_id: str) -> pathlib.Path | None:
    if not re.fullmatch(r"[\w-]{1,80}", owner_id or ""):
        return None
    return pathlib.Path(settings.storage_dir) / "agent-memory" / f"{owner_id}.json"


def load(owner_id: str) -> dict:
    path = _path(owner_id)
    if not path or not path.is_file():
        return {"lessons": [], "design_preferences": "", "builds": 0}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        return {"lessons": [], "design_preferences": "", "builds": 0}


def save(owner_id: str, memory: dict) -> None:
    path = _path(owner_id)
    if not path:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(memory, indent=1, ensure_ascii=False), encoding="utf-8")


def _key(text: str) -> str:
    """Near-duplicate lessons share a key (numbers, quotes and paths don't matter)."""
    return re.sub(r"[\d\"'`/\\._-]+", " ", text.lower()).split("because")[0].strip()[:80]


def design_preferences(project: dict) -> str:
    """The styles this user picked, as one line the UI agent can read."""
    styles: Counter = Counter()
    custom: list[str] = []
    for page in project.get("pages", []):
        for node in page.get("tree", []):
            c = (node.get("props") or {}).get("custom") or {}
            if c.get("description"):
                custom.append(f"{node.get('type')}: {' '.join(str(c['description']).split())[:160]}")
            elif node.get("type") not in ("chatbot",):
                styles[f"{node.get('type')} = {node.get('variant')}"] += 1
    theme = project.get("theme") or {}
    parts = []
    if styles:
        parts.append("picked styles " + ", ".join(s for s, _ in styles.most_common(10)))
    if theme.get("heading_font") or theme.get("mode"):
        parts.append(f"fonts {theme.get('heading_font', '?')} / {theme.get('body_font', '?')}, {theme.get('mode', 'light')} mode")
    if custom:
        parts.append("custom designs they described: " + " | ".join(custom[:4]))
    return "; ".join(parts)


def learn(owner_id: str, ctx: BuildContext) -> dict:
    """Adds this build's fixes and findings to the owner's lessons, and refreshes their design taste."""
    memory = load(owner_id)
    lessons: dict[str, dict] = {_key(l["text"]): l for l in memory.get("lessons", [])}
    now = time.time()
    for n in ctx.notes:
        if n.get("kind") not in ("fix", "finding"):
            continue
        k = _key(n["text"])
        if not k:
            continue
        if k in lessons:
            lessons[k]["count"] = lessons[k].get("count", 1) + 1
            lessons[k]["last"] = now
        else:
            lessons[k] = {"agent": n.get("agent", ""), "text": n["text"], "count": 1, "last": now}
    ranked = sorted(lessons.values(), key=lambda l: (l.get("count", 1), l.get("last", 0)), reverse=True)
    memory["lessons"] = ranked[:MAX_LESSONS]
    prefs = design_preferences(ctx.project)
    if prefs:
        memory["design_preferences"] = prefs
    memory["builds"] = memory.get("builds", 0) + 1
    save(owner_id, memory)
    return memory


def notes_markdown(ctx: BuildContext) -> str:
    lines = ["# Team notes\n", "What each agent decided or found during this build.\n"]
    for n in ctx.notes:
        lines.append(f"- **{n['agent']}** ({n['kind']}): {n['text']}")
    return "\n".join(lines) + "\n"
