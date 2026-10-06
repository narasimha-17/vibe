"""Shared pieces for the build agents: the build context, the site spec every agent reads, and the file format.

Every agent asks the language model (app/ai/llm.py) to write complete files in one plain-text format:

    <<<FILE frontend/app/page.tsx>>>
    ...contents...
    <<<END>>>

which survives any code the model writes (JSON would need every quote escaped). Paths are cleaned so a reply can
never write outside the build folder.
"""

import json
import pathlib
import re
from dataclasses import dataclass, field

from app.ai import llm

PROMPTS = pathlib.Path(__file__).parent / "prompts"


def prompt(name: str, **values: str) -> str:
    """A prompt from prompts/<name>.md, with {{placeholders}} filled in. Prompts live in markdown so they are easy to read and edit."""
    text = (PROMPTS / f"{name}.md").read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    left = re.findall(r"\{\{(\w+)\}\}", text)
    if left:
        raise ValueError(f"prompts/{name}.md needs values for: {', '.join(sorted(set(left)))}")
    return text.strip()


def prompt_parts(name: str, **values: str) -> dict[str, str]:
    """The "=== PART: X ===" sections of prompts/<name>.md (for agents with several tasks), by part name."""
    text = prompt(name, **values)
    pieces = re.split(r"^=== PART: (\w+) ===\s*$", text, flags=re.M)
    return {key.upper(): body.strip() for key, body in zip(pieces[1::2], pieces[2::2])}


FILE_FORMAT = prompt("output_format")

FILE_BLOCK = re.compile(r"<<<FILE\s+([^\n>]+?)\s*>>>[ \t]*\n(.*?)\n?[ \t]*<<<END>>>", re.S)
NOTES_BLOCK = re.compile(r"<<<NOTES>>>[ \t]*\n(.*?)\n?[ \t]*<<<END>>>", re.S)
FENCE = re.compile(r"^\s*```[\w.+-]*\n(.*?)\n```\s*$", re.S)

# Everything the generated backend may import. The tests run with these exact packages.
BACKEND_REQUIREMENTS = """fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
pydantic==2.9.2
email-validator==2.2.0
python-jose[cryptography]==3.3.0
passlib==1.7.4
bcrypt==4.0.1
python-multipart==0.0.9
httpx==0.27.2
pytest==8.3.3
"""

# Section types that need a server: forms to store, products and orders, accounts, the chatbot.
BACKEND_TYPES = {"shop", "tracking", "auth", "forms", "chatbot"}
BACKEND_PAGES = {"checkout", "my orders", "orders", "track order", "login", "sign up", "register", "dashboard"}


class AgentError(Exception):
    """An agent could not do its job; the message is shown to the user."""


@dataclass
class BuildContext:
    project: dict  # {"name", "theme", "settings", "pages": [{"name", "path", "is_home", "tree"}]}
    spec: str = ""
    needs_backend: bool = False
    contract: dict | None = None
    files: dict[str, str] = field(default_factory=dict)
    llm_calls: int = 0
    # Memory. notes = this build's shared notes board ({"agent", "kind", "text"}); memory = what the owner's earlier builds
    # taught (lessons, design preferences), loaded by the orchestrator from app/agents/memory.py.
    notes: list[dict] = field(default_factory=list)
    memory: dict = field(default_factory=dict)

    def note(self, agent: str, text: str, kind: str = "decision") -> None:
        text = " ".join(str(text).split())[:300]
        if text and not any(n["text"] == text for n in self.notes):
            self.notes.append({"agent": agent, "kind": kind, "text": text})

    def write(self, files: dict[str, str]) -> list[str]:
        self.files.update(files)
        return sorted(files)

    def under(self, prefix: str) -> dict[str, str]:
        return {p: c for p, c in self.files.items() if p.startswith(prefix)}


def clean_path(path: str, prefix: str) -> str | None:
    """A safe relative path under `prefix` ("frontend/" or "backend/"), or None if the model asked for something odd."""
    p = path.strip().strip("`'\"").replace("\\", "/")
    while p.startswith(("./", "/")):
        p = p[2:] if p.startswith("./") else p[1:]
    if not p or ".." in p.split("/") or ":" in p:
        return None
    return p if p.startswith(prefix) else prefix + p


def parse_files(text: str, prefix: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw_path, body in FILE_BLOCK.findall(text or ""):
        path = clean_path(raw_path, prefix)
        if not path:
            continue
        fenced = FENCE.match(body)
        out[path] = (fenced.group(1) if fenced else body).rstrip() + "\n"
    return out


async def ask(ctx: BuildContext, system: str, user: str, *, max_tokens: int = 8000, timeout: float = 240.0, model: str | None = None) -> str:
    for _attempt in range(2):  # one retry: an empty reply is usually a busy model or a reply cut off by its thinking
        llm.last_problem = ""
        ctx.llm_calls += 1
        reply = await llm.chat(system, [{"role": "user", "content": user}], timeout=timeout, max_tokens=max_tokens, temperature=0.2,
                               model=model or None, local_fallback=False)
        if reply:
            return reply
        if llm.last_problem:  # retrying can't help (for example, no credits): stop with the reason
            raise AgentError(llm.last_problem)
    raise AgentError("The language model gave no usable answer twice (it may be busy or rate-limited). Try the build again.")


def take_notes(ctx: BuildContext, reply: str, agent: str, kind: str = "decision") -> None:
    """Moves the reply's notes block (if any) onto the build's notes board."""
    for block in NOTES_BLOCK.findall(reply or ""):
        for line in block.splitlines()[:6]:
            ctx.note(agent, line.strip().lstrip("-*• ").strip(), kind)


async def ask_files(ctx: BuildContext, system: str, user: str, prefix: str, *, agent: str = "", note_kind: str = "decision", **kw) -> dict[str, str]:
    user = f"{user}\n\n{team_context(ctx, agent)}" if team_context(ctx, agent) else user
    reply = await ask(ctx, system + "\n\n" + FILE_FORMAT, user, **kw)
    files = parse_files(reply, prefix)
    if not files:
        # Usually the reply was cut off before a file's closing marker: ask once more for a complete, tighter answer.
        again = (f"{user}\n\nYour previous answer did not contain a single complete file block (every file must end with <<<END>>>). "
                 "Write the files again, complete, keeping them focused so the answer fits.")
        reply = await ask(ctx, system + "\n\n" + FILE_FORMAT, again, **kw)
        files = parse_files(reply, prefix)
    if not files:
        raise AgentError("The language model answered twice without a complete file (its replies were cut off or in the wrong format).")
    take_notes(ctx, reply, agent or "agent", note_kind)
    return files


def team_context(ctx: BuildContext, agent: str) -> str:
    """What this agent should know from the team's notes so far and from the owner's earlier builds."""
    parts = []
    if ctx.notes:
        parts.append("TEAM NOTES (decisions and findings from the other agents in this build; follow them):\n"
                     + "\n".join(f"- [{n['agent']}] {n['text']}" for n in ctx.notes[-30:]))
    lessons = [l for l in ctx.memory.get("lessons", []) if not agent or l.get("agent") in ("", agent)]
    if lessons:
        parts.append("LESSONS FROM EARLIER BUILDS (mistakes that happened before and how they were fixed; don't repeat them):\n"
                     + "\n".join(f"- {l['text']}" for l in lessons[:12]))
    prefs = ctx.memory.get("design_preferences")
    if prefs and agent == "UI agent":
        parts.append(f"THIS USER'S DESIGN TASTE (from their earlier choices): {prefs}")
    return "\n\n".join(parts)


def show_files(files: dict[str, str], limit: int = 60000) -> str:
    """Files as the model writes them, for passing code from one agent to another."""
    out, used = [], 0
    for path in sorted(files):
        block = f"<<<FILE {path}>>>\n{files[path].rstrip()}\n<<<END>>>"
        if used + len(block) > limit:
            out.append(f"(… {len(files) - len(out)} more files not shown)")
            break
        out.append(block)
        used += len(block)
    return "\n".join(out)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")


def _trim(value, depth: int = 0):
    """Props without images or long blobs, so the spec stays small."""
    if isinstance(value, str):
        return "" if value.startswith("data:") else value[:300]
    if isinstance(value, list):
        return [_trim(v, depth + 1) for v in value[:12]]
    if isinstance(value, dict):
        return {k: _trim(v, depth + 1) for k, v in value.items() if k not in ("image", "images", "visualImage", "bgVideo", "logo")}
    return value


def needs_backend(project: dict) -> bool:
    for page in project.get("pages", []):
        if str(page.get("name", "")).lower() in BACKEND_PAGES:
            return True
        if any(n.get("type") in BACKEND_TYPES for n in page.get("tree", []) if not n.get("hidden")):
            return True
    return False


# What a site must support, detected from its pages, sections and the owner's requirements (not guessed by the model).
# (key, what the API must provide, words that show the site needs it, words that show a contract covers it)
FEATURES = [
    ("bookings", "bookings or reservations visitors can make (and see in their account when there are accounts)",
     ("book", "booking", "reserv", "appointment", "schedule a visit", "site visit"), ("book", "reserv", "appointment", "visit")),
    ("payments", "online payment for orders or bookings (a placeholder that marks them paid)",
     ("payment", "pay online", "checkout", "deposit", "pay "), ("pay",)),
    ("reviews", "reviews and ratings visitors can post and read",
     ("review", "rating"), ("review", "rating")),
    ("accounts", "customer accounts: register, log in, current user, a profile settings page (update name and phone, change password), and the user's own orders or bookings",
     ("login", "log in", "sign in", "sign up", "register", "account", "my orders", "my bookings"), ("login", "register", "auth", "/me")),
    ("shop", "a shop: products, categories, cart checkout, orders and order tracking",
     ("shop", "cart", "checkout", "buy online", "sell online", "order online", "track order"), ("order", "product")),
    ("admin", "an admin area for the owner (staff login and the management actions the site mentions)",
     ("admin", "dashboard", "manage "), ("admin", "staff")),
    ("contact", "contact / enquiry messages", ("contact", "enquiry", "inquiry", "get in touch", "quote"), ("contact", "message", "enquir", "inquir", "quote")),
    ("newsletter", "newsletter sign-up", ("newsletter", "subscribe", "subscription"), ("subscri", "newsletter")),
    ("chat", "the chatbot's messages", ("chatbot", "chat with us", "live chat"), ("chat",)),
]
SECTION_FEATURES = {"auth": "accounts", "shop": "shop", "tracking": "shop", "chatbot": "chat"}


def required_features(project: dict) -> list[tuple[str, str]]:
    """[(key, description)] of what this site must support, from its pages, sections and the owner's requirements."""
    settings = project.get("settings") or {}
    req = {k: v for k, v in (settings.get("requirements") or {}).items() if not str(k).startswith("_")}
    words = " ".join([json.dumps(req, ensure_ascii=False)] + [str(p.get("name", "")) for p in project.get("pages", [])]).lower()
    found: dict[str, str] = {}
    for page in project.get("pages", []):
        for node in page.get("tree", []):
            if node.get("hidden"):
                continue
            key = SECTION_FEATURES.get(node.get("type", ""))
            if node.get("type") == "forms":
                key = {"booking": "bookings", "subscription": "newsletter"}.get(node.get("variant", ""), "contact")
            if key:
                found[key] = ""
    for key, _desc, needs, _covers in FEATURES:
        if any(w in words for w in needs):
            found[key] = ""
    return [(key, desc) for key, desc, _n, _c in FEATURES if key in found]


def missing_features(contract: dict, required: list[tuple[str, str]]) -> list[str]:
    """The required features a contract doesn't seem to cover (by its paths, purposes and entity names)."""
    text = json.dumps(contract, ensure_ascii=False).lower()
    covers = {key: words for key, _d, _n, words in FEATURES}
    return [desc for key, desc in required if not any(w in text for w in covers[key])]


def site_spec(project: dict) -> str:
    """Everything the agents need to know about the site, as compact text."""
    settings = project.get("settings") or {}
    brief = settings.get("projectBrief") or {}
    requirements = {k: v for k, v in (settings.get("requirements") or {}).items() if not str(k).startswith("_") and v}
    # Precise technical decisions from OORA's clarifying questions ("should the catalogue need login?", "guest
    # checkout or accounts?", "OTP or password?", "cash on delivery?", "deposit to confirm a booking?", ...). These
    # are exactly what the API and Backend agents need verbatim, so they get their own section instead of being
    # buried in the general requirements dump.
    decisions = requirements.pop("details", None) or []
    theme = project.get("theme") or {}
    must = required_features(project)
    lines = [
        f"# Site: {project.get('name', 'My Website')}",
        "",
        "# MUST SUPPORT (detected from the pages, sections and the owner's requirements; every item is required)",
        *([f"- {desc}" for _key, desc in must] or ["- nothing dynamic: a static site"]),
        "",
        f"Business: {brief.get('brief') or requirements.get('business', '')}",
        f"Audience: {brief.get('audience') or requirements.get('audience', '')}",
        f"Requirements: {json.dumps(requirements, ensure_ascii=False)[:1500]}",
        f"Theme: colors {json.dumps(theme.get('colors', {}))}, heading font {theme.get('heading_font', 'Inter')}, body font {theme.get('body_font', 'Inter')}, mode {theme.get('mode', 'light')}",
        "",
    ]
    if decisions:
        lines += [
            "# TECHNICAL DECISIONS FROM THE INTERVIEW (the owner answered these directly; follow them exactly, they override any default or example in this prompt)",
            *[f"- {d}" for d in decisions],
            "",
        ]
    lines.append("# Pages (sections in order, with their content)")
    for page in project.get("pages", []):
        lines.append(f"## {page['name']} (path {page.get('path', '/')}{', home page' if page.get('is_home') else ''})")
        for node in page.get("tree", []):
            if node.get("hidden"):
                continue
            props = json.dumps(_trim(node.get("props") or {}), ensure_ascii=False)
            lines.append(f"- {node.get('type')} ({node.get('variant')}): {props[:1400]}")
    return "\n".join(lines)
