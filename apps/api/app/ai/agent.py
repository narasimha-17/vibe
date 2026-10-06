"""The builder assistant as a real agent.

A language model is given the conversation, a set of tools that work on the user's actual project (read a page, add or
edit or move a section, create a page, change the theme, generate an image, ask the user a question) and a loop: it
decides what to do, calls a tool, sees what happened (including errors) and decides again, until the job is done.

Everything happens on an in-memory copy of the project. Each successful tool call is recorded as an edit; the browser
applies those edits. The reply to the user is built from the edits that really happened, never from the model's claims,
so it cannot say something is done when it is not.

Works with Claude (tool use) or a local Ollama model that supports tool calling. A local 3B model is weak at this; a
hosted model is what makes the agent reliable.
"""

import copy
import json
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from app.ai import critique, imagegen
from app.core.config import get_settings
from app.schemas.schemas import AICommandRequest, AICommandResponse, AIOp

settings = get_settings()
MAX_STEPS = 14
BUDGET_LOCAL = 70.0  # seconds. A small local model is slow, so the agent gives up cleanly instead of making you wait minutes
BUDGET_HOSTED = 150.0
KEEP_LAST = ("footer", "chatbot")  # new sections go above these, so they are visible on the page

# props the renderer understands on top of the component's own defaults
EXTRA_PROPS = {"navbar": ["showCart", "showSearch", "showProfile", "showWishlist", "extraButton", "hideCta", "navOrder", "loginLabel", "ctaLabel"], "shop": ["hideCart"], "hero": ["bgVideo", "visualImage", "visualVideo"]}


def _short(value: Any, n: int = 90) -> Any:
    if isinstance(value, str):
        return value if len(value) <= n and not value.startswith("data:") else value[:n] + "…"
    if isinstance(value, list):
        return [_short(v, n) for v in value[:8]] + (["…"] if len(value) > 8 else [])
    if isinstance(value, dict):
        return {k: _short(v, n) for k, v in list(value.items())[:14]}
    return value


# ───────────────────────── the workspace the tools act on ─────────────────────────
@dataclass
class Workspace:
    pages: list[dict]
    active_id: str | None
    theme: dict
    registry: dict
    context: str = ""
    ops: list[AIOp] = field(default_factory=list)
    images: dict[str, str] = field(default_factory=dict)
    question: str | None = None
    choices: list[str] = field(default_factory=list)
    summary: str = ""
    done: bool = False
    new_notes: list[str] = field(default_factory=list)
    new_user_notes: list[str] = field(default_factory=list)
    memory: list[str] = field(default_factory=list)

    # -- lookup ----------------------------------------------------------
    def page(self, ref: str | None) -> dict | None:
        if not ref:
            return next((p for p in self.pages if p["id"] == self.active_id), self.pages[0] if self.pages else None)
        low = str(ref).strip().lower()
        return next((p for p in self.pages if p["id"] == ref or p["name"].lower() == low), None) or next((p for p in self.pages if low in p["name"].lower()), None)

    def section(self, page: dict, ref: str | None) -> dict | None:
        if not ref:
            return None
        low = str(ref).lower()
        return next((n for n in page["tree"] if n["id"] == ref), None) or next((n for n in page["tree"] if n["type"] == low or str(n.get("name", "")).lower() == low), None)

    def _resolve_images(self, props: dict) -> dict:
        def walk(v):
            if isinstance(v, str) and v in self.images:
                return self.images[v]
            if isinstance(v, list):
                return [walk(x) for x in v]
            if isinstance(v, dict):
                return {k: walk(x) for k, x in v.items()}
            return v

        return walk(props)

    def _valid_keys(self, type_: str) -> set[str]:
        entry = self.registry.get(type_) or {}
        return set((entry.get("props") or {}).keys()) | set(EXTRA_PROPS.get(type_, []))

    def _record(self, op: str, description: str, target: str | None, page_id: str | None, **payload: Any) -> None:
        if page_id:
            payload["page_id"] = page_id
        self.ops.append(AIOp(op=op, description=description, target_id=target, payload=payload))

    # -- tools -----------------------------------------------------------
    def list_pages(self) -> str:
        return json.dumps([{"id": p["id"], "name": p["name"], "active": p["id"] == self.active_id, "sections": [f"{n['type']}({n['id']})" for n in p["tree"]]} for p in self.pages])

    def read_page(self, page: str | None = None) -> str:
        p = self.page(page)
        if not p:
            return f"No page called '{page}'. Pages: " + ", ".join(x["name"] for x in self.pages)
        return json.dumps({"page": p["name"], "sections": [{"id": n["id"], "type": n["type"], "variant": n.get("variant"), "props": _short(n.get("props") or {})} for n in p["tree"]]})

    def describe_component(self, type: str) -> str:  # noqa: A002
        entry = self.registry.get(type)
        if not entry:
            return f"Unknown component '{type}'. Available: {', '.join(sorted(self.registry))}"
        props = {k: _short(v, 40) for k, v in (entry.get("props") or {}).items()}
        for extra in EXTRA_PROPS.get(type, []):
            props.setdefault(extra, "(optional)")
        return json.dumps({"type": type, "label": entry.get("label"), "variants": entry.get("variants"), "props": props})

    def add_section(self, type: str, page: str | None = None, variant: str | None = None, props: dict | None = None, before_section_id: str | None = None) -> str:  # noqa: A002
        p = self.page(page)
        if not p:
            return f"No page called '{page}'."
        entry = self.registry.get(type)
        if not entry:
            return f"Unknown component '{type}'. Available: {', '.join(sorted(self.registry))}"
        variants = entry.get("variants") or []
        if variant and variant not in variants:
            return f"Variant '{variant}' doesn't exist for {type}. Valid variants: {', '.join(variants)}"
        given = self._resolve_images(props or {})
        bad = [k for k in given if k not in self._valid_keys(type)]
        if bad:
            return f"{type} has no props {bad}. Valid props: {sorted(self._valid_keys(type))}"
        node = {"id": uuid.uuid4().hex[:8], "type": type, "variant": variant or (variants[0] if variants else "default"), "name": entry.get("label") or type.capitalize(),
                "props": {**copy.deepcopy(entry.get("props") or {}), **given}, "style": {}, "responsive": {}, "children": [], "locked": False, "hidden": False}
        if before_section_id and (target := self.section(p, before_section_id)):
            index = p["tree"].index(target)
        else:  # above the footer and chat widget, where visitors can see it
            index = len(p["tree"])
            while index > 0 and p["tree"][index - 1]["type"] in KEEP_LAST:
                index -= 1
        p["tree"].insert(index, node)
        self._record("add_component", f"Add a {node['name']} section to {p['name']}", None, p["id"], node=node, index=index)
        return json.dumps({"added": node["id"], "type": type, "variant": node["variant"], "position": index})

    def update_section(self, section_id: str, page: str | None = None, props: dict | None = None, variant: str | None = None) -> str:
        p = self.page(page)
        if not p:
            return f"No page called '{page}'."
        node = self.section(p, section_id)
        if not node:
            return f"No section '{section_id}' on {p['name']}. Sections: " + ", ".join(f"{n['type']}({n['id']})" for n in p["tree"])
        entry = self.registry.get(node["type"]) or {}
        if variant and variant not in (entry.get("variants") or []):
            return f"Variant '{variant}' doesn't exist for {node['type']}. Valid: {', '.join(entry.get('variants') or [])}"
        given = self._resolve_images(props or {})
        bad = [k for k in given if k not in self._valid_keys(node["type"])]
        if bad:
            return f"{node['type']} has no props {bad}. Valid props: {sorted(self._valid_keys(node['type']))}"
        node["props"] = {**node["props"], **given}
        payload: dict[str, Any] = {"props": given}
        if variant:
            node["variant"] = variant
            payload["variant"] = variant
        changed = ", ".join(list(given)[:4] + (["style"] if variant else []))
        self._record("update_component", f"Change {node['name']} on {p['name']}: {changed}", node["id"], p["id"], **payload)
        return json.dumps({"updated": node["id"], "props_now": _short(node["props"])})

    def remove_section(self, section_id: str, page: str | None = None) -> str:
        p = self.page(page)
        node = self.section(p, section_id) if p else None
        if not p or not node:
            return f"No section '{section_id}' to remove."
        p["tree"].remove(node)
        self._record("delete_component", f"Remove the {node['name']} section from {p['name']}", node["id"], p["id"])
        return json.dumps({"removed": node["id"]})

    def move_section(self, section_id: str, index: int, page: str | None = None) -> str:
        p = self.page(page)
        node = self.section(p, section_id) if p else None
        if not p or not node:
            return f"No section '{section_id}' to move."
        p["tree"].remove(node)
        index = max(0, min(int(index), len(p["tree"])))
        p["tree"].insert(index, node)
        self._record("move_component", f"Move the {node['name']} section on {p['name']} to position {index + 1}", node["id"], p["id"], index=index)
        return json.dumps({"moved": node["id"], "position": index})

    def create_page(self, name: str, business: str = "") -> str:
        from app.intake.content import tailor
        from app.projects.page_factory import build_page

        if self.page(name) and self.page(name)["name"].lower() == name.strip().lower():
            return f"A page called '{name}' already exists (id {self.page(name)['id']}). Edit it instead."
        home = next((p for p in self.pages if p.get("is_home")), self.pages[0] if self.pages else None)
        tree = (home or {}).get("tree", [])
        navbar = next((n for n in tree if n.get("type") == "navbar"), None)
        footer = next((n for n in tree if n.get("type") == "footer"), None)
        brand = ((navbar or {}).get("props") or {}).get("brand", "Your Brand")
        built = build_page(name, navbar, footer, brand)
        if business or self.context:
            tailor([built], {"business": business or self.context}, brand)
        page = {"id": uuid.uuid4().hex[:8], "name": built["name"], "path": built["path"], "is_home": False, "tree": built["tree"]}
        self.pages.append(page)
        self._record("create_page", f"Create the {page['name']} page", None, None, id=page["id"], name=page["name"], path=page["path"], tree=page["tree"])
        return json.dumps({"created": page["id"], "name": page["name"], "sections": [f"{n['type']}({n['id']})" for n in page["tree"]]})

    def set_theme(self, colors: dict | None = None, heading_font: str | None = None, body_font: str | None = None, mode: str | None = None) -> str:
        change: dict[str, Any] = {}
        if colors:
            change["colors"] = {k: v for k, v in colors.items() if re.fullmatch(r"#[0-9a-fA-F]{6}", str(v))}
            if not change["colors"]:
                return "Colours must be hex values like #6b4d9a."
        if heading_font:
            change["heading_font"] = heading_font
        if body_font:
            change["body_font"] = body_font
        if mode in ("light", "dark"):
            change["mode"] = mode
        if not change:
            return "Nothing to change."
        self.theme = {**self.theme, **{k: ({**(self.theme.get(k) or {}), **v} if k == "colors" else v) for k, v in change.items()}}
        self._record("update_theme", "Change the site theme: " + ", ".join(change), None, None, **change)
        return "Theme updated."

    def generate_image(self, subject: str) -> str:
        handle = f"@image:{len(self.images) + 1}"
        self.images[handle] = imagegen.generate(subject)
        return f"Created an illustration for '{subject}'. Use the value \"{handle}\" wherever an image prop is needed."

    def critique_page(self, page: str | None = None) -> str:
        p = self.page(page)
        if not p:
            return "No such page."
        findings, _fixes = critique.review(p["tree"], self.theme)
        return json.dumps(findings)

    def remember(self, note: str, scope: str = "site") -> str:
        note = re.sub(r"\s+", " ", str(note)).strip()[:200]
        if not note:
            return "Nothing to remember."
        (self.new_user_notes if scope == "user" else self.new_notes).append(note)
        self.memory.append(note)
        return "Remembered."

    def recall(self) -> str:
        return json.dumps(self.memory) if self.memory else "Nothing remembered yet."

    def ask_user(self, question: str, options: list[str] | None = None) -> str:
        self.question, self.choices, self.done = question, list(options or [])[:6], True
        return "Question sent. Stop now and wait for the answer."

    def finish(self, summary: str) -> str:
        self.summary, self.done = summary, True
        return "Done."


# ───────────────────────── tool definitions ─────────────────────────
def _tool(name: str, description: str, properties: dict, required: list[str] | None = None) -> dict:
    return {"name": name, "description": description, "schema": {"type": "object", "properties": properties, "required": required or []}}


TOOLS = [
    _tool("list_pages", "List every page with its sections (ids and types).", {}),
    _tool("read_page", "Read one page: each section's id, type, variant and props. Read before editing.", {"page": {"type": "string", "description": "Page name or id. Omit for the page the user is on."}}),
    _tool("describe_component", "Get a component's valid variants and prop names with defaults. Use before adding or editing it.", {"type": {"type": "string"}}, ["type"]),
    _tool("add_section", "Add a section (component) to a page. Goes above the footer unless before_section_id is given.", {"type": {"type": "string"}, "page": {"type": "string"}, "variant": {"type": "string"}, "props": {"type": "object"}, "before_section_id": {"type": "string"}}, ["type"]),
    _tool("update_section", "Change props and/or the variant of an existing section. Props are merged into the current props.", {"section_id": {"type": "string"}, "page": {"type": "string"}, "props": {"type": "object"}, "variant": {"type": "string"}}, ["section_id"]),
    _tool("remove_section", "Remove a section from a page.", {"section_id": {"type": "string"}, "page": {"type": "string"}}, ["section_id"]),
    _tool("move_section", "Move a section to a zero-based position on its page.", {"section_id": {"type": "string"}, "index": {"type": "integer"}, "page": {"type": "string"}}, ["section_id", "index"]),
    _tool("create_page", "Create a new page filled with ready-made sections that suit its name (Shop, Checkout, Offers, About, Contact, Pricing, FAQ, Login...).", {"name": {"type": "string"}, "business": {"type": "string", "description": "What the business is, so the content fits."}}, ["name"]),
    _tool("set_theme", "Change site colours (hex), fonts or light/dark mode.", {"colors": {"type": "object"}, "heading_font": {"type": "string"}, "body_font": {"type": "string"}, "mode": {"type": "string"}}),
    _tool("generate_image", "Create an illustration for a subject. Returns a handle to put in an image prop such as visualImage.", {"subject": {"type": "string"}}, ["subject"]),
    _tool("critique_page", "Check a page for design problems (contrast, structure, content).", {"page": {"type": "string"}}),
    _tool("remember", "Save a lasting fact worth keeping: the brand name, the tone or style the user wants, a decision they made, a preference. scope is \"site\" (this project) or \"user\" (all their projects).", {"note": {"type": "string"}, "scope": {"type": "string"}}, ["note"]),
    _tool("recall", "Read everything you remember about this site and this user.", {}),
    _tool("ask_user", "Ask the user ONE short question when the request is truly ambiguous. Ends your turn.", {"question": {"type": "string"}, "options": {"type": "array", "items": {"type": "string"}}}, ["question"]),
    _tool("finish", "Finish the job. Summarise in one or two plain sentences what you changed.", {"summary": {"type": "string"}}, ["summary"]),
]

SYSTEM = """You are the assistant inside VIBE, a visual website builder. You edit the user's real project by calling tools.

How to work:
- Read first. Use read_page / list_pages to see what is on the page, and describe_component before adding or editing a component, so prop names and variants are exact.
- Use the conversation. A short message such as "discount" usually answers your own previous question.
- Make the change the user asked for, on the right page. New sections go above the footer. Do not delete things the user did not ask you to delete.
- If a tool returns an error, read it and fix your call. Do not repeat the same failing call.
- Prefer acting. Never ask about details you can decide yourself, such as where a section goes (the default is right), which variant to use, or what wording to write. Ask only when you cannot tell what the user wants at all, with one short question and options if helpful.
- Use what you remember (listed below). Save new lasting facts with remember: the brand name, the tone or look they want, decisions they make, preferences. Do not save trivia.
- When done, call finish with a plain summary of what you actually changed. Never say you did something you did not do.
"""


# ───────────────────────── model drivers ─────────────────────────
@dataclass
class Turn:
    text: str
    calls: list[tuple[str, str, dict]]  # (call id, tool name, arguments)
    raw: Any = None


class Driver(Protocol):
    async def turn(self, messages: list[dict]) -> Turn: ...
    def user(self, text: str) -> dict: ...
    def assistant(self, turn: Turn) -> dict: ...
    def results(self, turn: Turn, outputs: list[str]) -> list[dict]: ...


class AnthropicDriver:
    def __init__(self) -> None:
        from anthropic import AsyncAnthropic

        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=90)
        self.tools = [{"name": t["name"], "description": t["description"], "input_schema": t["schema"]} for t in TOOLS]

    async def turn(self, messages: list[dict]) -> Turn:
        res = await self.client.messages.create(model="claude-sonnet-5", max_tokens=2500, system=SYSTEM, tools=self.tools, messages=messages)
        text = "".join(b.text for b in res.content if b.type == "text")
        calls = [(b.id, b.name, dict(b.input or {})) for b in res.content if b.type == "tool_use"]
        return Turn(text, calls, res.content)

    def user(self, text: str) -> dict:
        return {"role": "user", "content": text}

    def assistant(self, turn: Turn) -> dict:
        return {"role": "assistant", "content": [b.model_dump() if hasattr(b, "model_dump") else b for b in turn.raw]}

    def results(self, turn: Turn, outputs: list[str]) -> list[dict]:
        return [{"role": "user", "content": [{"type": "tool_result", "tool_use_id": cid, "content": out} for (cid, _n, _a), out in zip(turn.calls, outputs)]}]


class OllamaDriver:
    def __init__(self) -> None:
        self.tools = [{"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["schema"]}} for t in TOOLS]

    async def turn(self, messages: list[dict]) -> Turn:
        body = {"model": settings.ollama_agent_model, "stream": False, "keep_alive": "60m", "tools": self.tools, "options": {"temperature": 0.1, "num_ctx": 8192, "num_predict": 700},
                "messages": [{"role": "system", "content": SYSTEM}] + messages}
        async with httpx.AsyncClient(timeout=110) as client:
            res = await client.post(f"{settings.ollama_base_url.rstrip('/')}/api/chat", json=body)
            res.raise_for_status()
        msg = res.json().get("message", {})
        calls = []
        for i, c in enumerate(msg.get("tool_calls") or []):
            fn = c.get("function", {})
            args = fn.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except ValueError:
                    args = {}
            calls.append((f"c{i}", fn.get("name", ""), args))
        return Turn(str(msg.get("content", "")), calls, msg)

    def user(self, text: str) -> dict:
        return {"role": "user", "content": text}

    def assistant(self, turn: Turn) -> dict:
        return {"role": "assistant", "content": turn.text or "", "tool_calls": (turn.raw or {}).get("tool_calls", [])}

    def results(self, turn: Turn, outputs: list[str]) -> list[dict]:
        return [{"role": "tool", "content": out} for out in outputs]


def make_driver() -> Driver | None:
    try:
        if settings.anthropic_api_key:
            return AnthropicDriver()
        if settings.ai_provider.lower() == "ollama":
            return OllamaDriver()
    except Exception:  # noqa: BLE001
        return None
    return None


def strong_model() -> bool:
    """True when a hosted model is configured. Only then is the agent trusted ahead of the fast built-in skills."""
    return bool(settings.anthropic_api_key)


# ───────────────────────── the loop ─────────────────────────
def _registry(raw: dict) -> dict:
    return raw or {}


async def run(req: AICommandRequest, driver: Driver | None = None, sink: dict | None = None) -> AICommandResponse | None:
    """Runs the agent on the request. Returns None if no model is available, so the caller can fall back."""
    driver = driver or make_driver()
    if driver is None:
        return None
    pages = copy.deepcopy(req.all_pages) or [{"id": req.page_id or "page", "name": (req.pages or ["Home"])[0], "tree": copy.deepcopy(req.tree_full or req.tree_summary)}]
    for p in pages:
        p.setdefault("tree", [])
        p.setdefault("path", "/" + re.sub(r"[^a-z0-9]+", "-", str(p.get("name", "")).lower()).strip("-"))
    ws = Workspace(pages=pages, active_id=req.page_id or (pages[0]["id"] if pages else None), theme=(req.theme.model_dump() if req.theme else {}), registry=_registry(req.registry),
                   context=" ".join(m.get("text", "") for m in req.history if m.get("role") == "user")[-300:])
    ws.memory = list(req.memory)
    active = ws.page(None)

    messages: list[dict] = []
    for m in req.history[-8:]:
        role = "assistant" if m.get("role") == "ai" else "user"
        if m.get("text"):
            messages.append({"role": role, "content": str(m["text"])[:600]})
    if messages and messages[-1]["role"] == "user":
        messages.pop()  # the current prompt is added below
    # roles must alternate for the model
    cleaned: list[dict] = []
    for m in messages:
        if cleaned and cleaned[-1]["role"] == m["role"]:
            cleaned[-1]["content"] += "\n" + m["content"]
        else:
            cleaned.append(m)
    if cleaned and cleaned[0]["role"] == "assistant":
        cleaned.pop(0)
    messages = cleaned
    remembered = ("What you remember:\n" + "\n".join(f"- {m}" for m in ws.memory) + "\n\n") if ws.memory else ""
    messages.append(driver.user(f"{remembered}[The user is on the page “{(active or {}).get('name', '')}”.]\n{req.prompt}"))

    tools = {"list_pages": ws.list_pages, "read_page": ws.read_page, "describe_component": ws.describe_component, "add_section": ws.add_section, "update_section": ws.update_section,
             "remove_section": ws.remove_section, "move_section": ws.move_section, "create_page": ws.create_page, "set_theme": ws.set_theme, "generate_image": ws.generate_image,
             "critique_page": ws.critique_page, "remember": ws.remember, "recall": ws.recall, "ask_user": ws.ask_user, "finish": ws.finish}
    steps = 0
    started = time.monotonic()
    budget = BUDGET_HOSTED if strong_model() else BUDGET_LOCAL
    try:
        while steps < MAX_STEPS and not ws.done and time.monotonic() - started < budget:
            steps += 1
            turn = await driver.turn(messages)
            messages.append(driver.assistant(turn))
            if not turn.calls:
                if turn.text.strip() and not ws.ops:
                    ws.summary, ws.done = turn.text.strip(), True  # the model answered in words
                    break
                if turn.text.strip():
                    ws.summary, ws.done = turn.text.strip(), True
                    break
                messages.append(driver.user("Continue: use a tool, or call finish."))
                continue
            outputs = []
            for _cid, name, args in turn.calls:
                fn = tools.get(name)
                if not fn:
                    outputs.append(f"Unknown tool '{name}'. Tools: {', '.join(tools)}")
                    continue
                try:
                    outputs.append(str(fn(**args)))
                except TypeError as exc:
                    outputs.append(f"Bad arguments for {name}: {exc}")
                except Exception as exc:  # noqa: BLE001 - the model gets the error and can correct itself
                    outputs.append(f"{name} failed: {exc}")
            messages += driver.results(turn, outputs)
    except Exception:  # noqa: BLE001 - model unreachable or timed out mid-way
        if not ws.ops and not ws.question:
            return None

    if sink is not None:
        sink["notes"], sink["user_notes"] = ws.new_notes, ws.new_user_notes
    if ws.question:
        return AICommandResponse(message=ws.question, ops=ws.ops, provider="assistant", choices=ws.choices, preview=bool(ws.ops))
    if not ws.ops:
        said = ws.summary.strip()
        return AICommandResponse(message=("I didn't change anything on your page. " + said) if said else "I looked at your page but didn't change anything. Tell me more about what you'd like.", ops=[], provider="assistant")
    creates = sum(1 for o in ws.ops if o.op == "create_page")
    preview = creates >= 3 or len(ws.ops) > 12
    facts = "\n".join(f"• {o.description}" for o in ws.ops)
    message = (ws.summary.strip() + "\n\n" if ws.summary.strip() else "") + ("Here is what I'll do:\n" if preview else "Done:\n") + facts
    return AICommandResponse(message=message, ops=ws.ops, provider="assistant", preview=preview)
