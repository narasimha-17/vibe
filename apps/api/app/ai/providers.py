"""AI command providers.

Both providers implement `generate(request) -> AICommandResponse` and
return the *same* structured-op schema (`AIOp`), so the frontend never
needs to know which one produced a response. `RuleBasedProvider` is the
default — it works fully offline by keyword-matching the prompt, in the
same spirit as mock.html's `aiEdit()`/`pocFinish()` but emitting typed,
previewable ops instead of mutating the DOM directly.
"""

import difflib
import json
import re
import uuid
from abc import ABC, abstractmethod

import httpx

from app.core.config import get_settings
from app.schemas.schemas import AICommandRequest, AICommandResponse, AIOp

settings = get_settings()

COLOR_WORDS = {
    "purple": "#7c5cff",
    "violet": "#8b5cf6",
    "blue": "#3b82f6",
    "indigo": "#4f46e5",
    "cyan": "#22d3ee",
    "teal": "#14b8a6",
    "green": "#10b981",
    "emerald": "#059669",
    "orange": "#f97316",
    "red": "#ef4444",
    "pink": "#ec4899",
    "yellow": "#f59e0b",
    "black": "#0f172a",
    "white": "#ffffff",
}

ADDABLE_SECTIONS = {
    "pricing": ("pricing", "tiered"),
    "testimonial": ("testimonials", "default"),
    "faq": ("faq", "default"),
    "cta": ("cta", "default"),
    "stats": ("stats", "default"),
    "team": ("team", "default"),
    "gallery": ("gallery", "default"),
    "catalog": ("catalog", "grid"),
    "newsletter": ("forms", "subscription"),
    "contact form": ("forms", "contact"),
    "footer": ("footer", "simple"),
    "hero": ("hero", "split"),
    "navbar": ("navbar", "default"),
}
REGISTRY_TYPES = {type_: variant for type_, variant in ADDABLE_SECTIONS.values()}


def _near(token: str, options: list[str], cutoff: float = 0.72) -> bool:
    return bool(difflib.get_close_matches(token, options, n=1, cutoff=cutoff))


class AIProvider(ABC):
    @abstractmethod
    async def generate(self, request: AICommandRequest) -> AICommandResponse: ...


class RuleBasedProvider(AIProvider):
    async def generate(self, request: AICommandRequest) -> AICommandResponse:
        raw_prompt = request.prompt.strip()
        prompt = raw_prompt.lower()
        ops: list[AIOp] = []
        messages: list[str] = []

        rename_match = re.search(
            r"(?:change|rename|replace)\s+(?:the\s+)?(?:text\s+)?(?:['\"]?)([^'\"]+?)(?:['\"]?)\s+(?:in|on)\s+(navbar|hero)\s+(?:as|to|with)\s+['\"]?([^'\"]+)['\"]?$",
            raw_prompt,
            flags=re.IGNORECASE,
        )
        if rename_match:
            old_text, component_type, new_text = (part.strip() for part in rename_match.groups())
            target = next((node for node in request.tree_summary if node.get("type") == component_type.lower()), None)
            prop = "brand" if component_type.lower() == "navbar" else "headline"
            if target:
                ops.append(
                    AIOp(
                        op="update_component",
                        description=f"Update {old_text} to {new_text} in the {component_type}",
                        target_id=target.get("id"),
                        payload={"props": {prop: new_text}},
                    )
                )
                messages.append(f"Updated {old_text} in the {component_type} to {new_text}.")

        navbar_link_match = re.search(
            r"(?:add|insert)\s+(?:a\s+)?contact\s+(?:link\s+)?(?:in|to)\s+(?:the\s+)?navbar(?:\s+(?:beside|next to|after)\s+([\w-]+))?",
            raw_prompt,
            flags=re.IGNORECASE,
        )
        if navbar_link_match:
            target = next((node for node in request.tree_summary if node.get("type") == "navbar"), None)
            if target:
                existing_links = target.get("props", {}).get("links", ["Home", "About", "Contact"])
                links = list(existing_links) if isinstance(existing_links, list) else []
                if not any(str(link).lower() == "contact" for link in links):
                    anchor = navbar_link_match.group(1)
                    insert_at = next(
                        (index + 1 for index, link in enumerate(links) if anchor and str(link).lower() == anchor.lower()),
                        len(links),
                    )
                    links.insert(insert_at, "Contact")
                ops.append(
                    AIOp(
                        op="update_component",
                        description="Add a Contact link to the navbar",
                        target_id=target.get("id"),
                        payload={"props": {"links": links}},
                    )
                )
                messages.append("Added a Contact link to the navbar.")

        # "add a login button to the navbar" (tolerates typos such as "navabr" / "gutton")
        tokens = re.findall(r"[a-z]+", prompt)
        wants_add = any(_near(t, ["add", "insert", "include", "put", "create", "show", "need"]) for t in tokens)
        mentions_nav = any(_near(t, ["navbar", "navigation", "header", "menu"]) for t in tokens)
        wants_signup = bool(re.search(r"sign\s*-?\s*up|signup|register", prompt)) or any(len(t) >= 5 and _near(t, ["signup", "register"]) for t in tokens)
        without_signup = re.sub(r"sign\s*-?\s*up|signup", " ", prompt)
        wants_login = bool(re.search(r"log\s*-?\s*in|login|sign\s*-?\s*in|signin", without_signup)) or any(
            len(t) >= 4 and t not in {"sign", "logo"} and _near(t, ["login", "signin"], 0.8) for t in re.findall(r"[a-z]+", without_signup)
        )
        buttons_handled = wants_add and mentions_nav and (wants_login or wants_signup)
        if buttons_handled:
            nav = next((node for node in request.tree_summary if node.get("type") == "navbar"), None)
            if nav:
                props: dict = {}
                parts: list[str] = []
                if wants_login:
                    props["loginLabel"] = "Sign in" if re.search(r"sign\s*-?\s*in|signin", prompt) else "Login"
                    parts.append("a " + props["loginLabel"] + " button")
                if wants_signup:
                    props["ctaLabel"] = "Sign up"
                    props["cta"] = "Sign up"
                    parts.append("a Sign up button")
                ops.append(
                    AIOp(
                        op="update_component",
                        description="Add " + " and ".join(parts) + " to the navbar",
                        target_id=nav.get("id"),
                        payload={"props": props},
                    )
                )
                messages.append("Added " + " and ".join(parts) + " to the navbar.")
            else:
                messages.append("There is no navbar on this page yet — add one first.")

        if any(w in prompt for w in ["dark mode", "dark theme", "make it dark", "go dark"]):
            ops.append(
                AIOp(
                    op="update_theme",
                    description="Switch color tokens to a dark palette",
                    payload={
                        "colors": {
                            "background": "#06080a",
                            "surface": "#151921",
                            "text": "#eef1f7",
                            "muted": "#8a93a6",
                            "border": "#222733",
                        }
                    },
                )
            )
            messages.append("Applied a dark theme.")

        if any(w in prompt for w in ["light mode", "light theme", "make it light"]):
            ops.append(
                AIOp(
                    op="update_theme",
                    description="Switch color tokens to a light palette",
                    payload={
                        "colors": {
                            "background": "#f4f5f8",
                            "surface": "#ffffff",
                            "text": "#14171f",
                            "muted": "#6b7280",
                            "border": "#e1e4ea",
                        }
                    },
                )
            )
            messages.append("Applied a light theme.")

        if any(w in prompt for w in ["enable dark and light mode", "enable light and dark mode", "toggle dark mode", "theme toggle"]):
            ops.append(
                AIOp(
                    op="update_theme",
                    description="Enable the light/dark theme toggle",
                    payload={"mode": "light"},
                )
            )
            messages.append("Enabled light and dark mode. Use the theme toggle in Design System to switch modes.")

        found_colors = [hex_ for word, hex_ in COLOR_WORDS.items() if word in prompt]
        if found_colors and ("palette" in prompt or "color" in prompt or "theme" in prompt):
            payload = {"primary": found_colors[0]}
            if len(found_colors) > 1:
                payload["secondary"] = found_colors[1]
            ops.append(
                AIOp(op="update_theme", description=f"Update accent colors to {', '.join(found_colors[:2])}", payload={"colors": payload})
            )
            messages.append(f"Updated the color palette to {', '.join(found_colors[:2])}.")

        wants_add = any(w in prompt for w in ["add ", "create ", "insert "])
        if wants_add:
            for keyword, (type_, variant) in ADDABLE_SECTIONS.items():
                matches_contact = keyword == "contact form" and "contact" in prompt and "section" in prompt
                is_navbar_link_request = keyword == "navbar" and (navbar_link_match is not None or buttons_handled)
                if (keyword in prompt or matches_contact) and not is_navbar_link_request:
                    ops.append(
                        AIOp(
                            op="add_component",
                            description=f"Add a {keyword} section",
                            payload={"type": type_, "variant": variant, "page_id": request.page_id},
                        )
                    )
                    messages.append(f"Added a {keyword} section to the page.")
                    break

        wants_remove = any(w in prompt for w in ["remove ", "delete "])
        if wants_remove:
            for node in request.tree_summary:
                node_type = str(node.get("type", "")).lower()
                if node_type and node_type in prompt:
                    ops.append(
                        AIOp(
                            op="delete_component",
                            description=f"Remove the {node.get('name') or node_type} section",
                            target_id=node.get("id"),
                        )
                    )
                    messages.append(f"Removed the {node.get('name') or node_type} section.")
                    break

        if "glassmorphism" in prompt or "glass" in prompt:
            navbar = next((n for n in request.tree_summary if n.get("type") == "navbar"), None)
            if navbar:
                ops.append(
                    AIOp(
                        op="update_style",
                        description="Apply a glassmorphism look to the navbar",
                        target_id=navbar["id"],
                        payload={"style": {"background": "rgba(255,255,255,0.08)", "backdropFilter": "blur(16px)"}},
                    )
                )
                messages.append("Applied a glassmorphism style to the navbar.")

        if any(w in prompt for w in ["mobile friendly", "mobile-friendly", "responsive"]):
            ops.append(
                AIOp(
                    op="update_theme",
                    description="Tighten spacing scale for small screens",
                    payload={"spacing": [4, 8, 12, 16, 20, 28, 40, 56, 80]},
                )
            )
            messages.append("Adjusted spacing so the layout works better on mobile.")

        if not ops:
            message = (
                "I can add sections (\"add a pricing section\"), remove them "
                "(\"remove the testimonials section\"), switch themes (\"make it dark\"), "
                "change colors (\"use a blue and purple palette\"), or restyle a component "
                "(\"make the navbar glassmorphism\"). Try one of those, or be more specific."
            )
            return AICommandResponse(message=message, ops=[], provider="rule_based")

        return AICommandResponse(message=" ".join(messages), ops=ops, provider="rule_based")


class AnthropicProvider(AIProvider):
    """Only used when ANTHROPIC_API_KEY is set (see app/ai/router.py)."""

    def __init__(self):
        from anthropic import AsyncAnthropic

        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def generate(self, request: AICommandRequest) -> AICommandResponse:
        system = (
            "You are the AI assistant inside VIBE, a visual website builder. "
            "Given the user's instruction and a summary of the current page's component "
            "tree, respond with ONLY a JSON object of shape "
            '{"message": string, "ops": [{"op": one of '
            "[add_component, delete_component, update_component, move_component, "
            "duplicate_component, update_style, update_theme, create_page, replace_content], "
            '"description": string, "target_id": string|null, "payload": object}]}. '
            "Never include prose outside the JSON. Prefer a small number of precise ops."
        )
        user_content = json.dumps(
            {
                "prompt": request.prompt,
                "page_id": request.page_id,
                "tree_summary": request.tree_summary,
                "theme": request.theme.model_dump() if request.theme else None,
            }
        )
        try:
            response = await self.client.messages.create(
                model="claude-sonnet-5",
                max_tokens=1500,
                system=system,
                messages=[{"role": "user", "content": user_content}],
            )
            text = "".join(block.text for block in response.content if hasattr(block, "text"))
            match = re.search(r"\{.*\}", text, re.DOTALL)
            data = json.loads(match.group(0)) if match else {"message": text, "ops": []}
            ops = [
                AIOp(
                    op=o["op"],
                    description=o.get("description", ""),
                    target_id=o.get("target_id"),
                    payload=o.get("payload") or {},
                )
                for o in data.get("ops", [])
            ]
            return AICommandResponse(message=data.get("message", ""), ops=ops, provider="anthropic")
        except Exception as exc:  # noqa: BLE001 — fall back rather than 500 the editor
            fallback = await RuleBasedProvider().generate(request)
            fallback.message = f"(AI provider error, used offline fallback: {exc}) {fallback.message}"
            return fallback


class OllamaProvider(AIProvider):
    """Local Ollama provider that returns only operations the live builder can preview."""

    _supported_ops = {
        "add_component",
        "delete_component",
        "duplicate_component",
        "update_component",
        "update_style",
        "update_theme",
        "create_page",
    }

    def __init__(self):
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_model

    def _system_prompt(self) -> str:
        return (
            "You are VIBE's local website-builder assistant. Return ONLY valid JSON, never markdown, "
            "with this shape: {\"message\": string, \"ops\": [{\"op\": string, \"description\": string, "
            "\"target_id\": string|null, \"payload\": object}]}. "
            "Only use these operations because they are previewable immediately: "
            "add_component, delete_component, duplicate_component, update_component, update_style, "
            "update_theme, create_page. Keep the operation list small and precise. "
            "If the user asks to add a section, ALWAYS use add_component, never create_page. "
            "Use create_page only when the user explicitly asks for a new page. "
            "For add_component payload use type and optional variant. For update_component use "
            "{props: {...}}. For update_style use {style: {...}}. For update_theme use theme token "
            "keys such as colors or spacing. Use the supplied tree ids for target_id."
        )

    @staticmethod
    def _parse_json(text: str) -> dict:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise ValueError("Ollama returned no JSON object")
        data = json.loads(match.group(0))
        if not isinstance(data, dict):
            raise ValueError("Ollama response must be a JSON object")
        return data

    async def generate(self, request: AICommandRequest) -> AICommandResponse:
        body = {
            "model": self.model,
            "stream": False,
            "format": "json",
            "keep_alive": "30m",
            "options": {"temperature": 0.1, "num_predict": 450, "num_ctx": 3072},
            "messages": [
                {"role": "system", "content": self._system_prompt()},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "prompt": request.prompt,
                            "page_id": request.page_id,
                            "tree_summary": request.tree_summary,
                            "theme": request.theme.model_dump() if request.theme else None,
                        }
                    ),
                },
            ],
        }
        try:
            async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
                response = await client.post(f"{self.base_url}/api/chat", json=body)
                response.raise_for_status()
            result = response.json()
            data = self._parse_json(str(result.get("message", {}).get("content", "")))
            ops = []
            for raw_op in data.get("ops", []):
                if not isinstance(raw_op, dict) or raw_op.get("op") not in self._supported_ops:
                    continue
                ops.append(
                    AIOp(
                        op=raw_op["op"],
                        description=str(raw_op.get("description", "")),
                        target_id=raw_op.get("target_id"),
                        payload=raw_op.get("payload") or {},
                    )
                )
            fallback = await RuleBasedProvider().generate(request)
            if fallback.ops and any(
                phrase in request.prompt.lower()
                for phrase in [
                    "add contact section",
                    "add a contact section",
                    "create contact section",
                    "insert contact section",
                    "add contact in navbar",
                    "add contact to navbar",
                    "add contact in navbar beside",
                ]
            ):
                return AICommandResponse(message=fallback.message, ops=fallback.ops, provider="ollama")
            if fallback.ops and any(
                phrase in request.prompt.lower()
                for phrase in ["enable dark and light mode", "enable light and dark mode", "toggle dark mode", "theme toggle"]
            ):
                return AICommandResponse(message=fallback.message, ops=fallback.ops, provider="ollama")
            if fallback.ops and re.search(
                r"(?:change|rename|replace)\s+(?:the\s+)?(?:text\s+)?[^\s]+\s+(?:in|on)\s+(?:navbar|hero)\s+(?:as|to|with)",
                request.prompt,
                flags=re.IGNORECASE,
            ):
                return AICommandResponse(message=fallback.message, ops=fallback.ops, provider="ollama")
            if not ops and fallback.ops:
                return AICommandResponse(message=fallback.message, ops=fallback.ops, provider="ollama")
            section_words = ("section", "component", "block")
            if any(word in request.prompt.lower() for word in section_words):
                page_ops = [op for op in ops if op.op == "create_page"]
                if page_ops and not any(op.op == "add_component" for op in ops):
                    candidate = page_ops[0]
                    template = str(candidate.payload.get("template", "")).lower()
                    if template in REGISTRY_TYPES:
                        ops = [
                            AIOp(
                                op="add_component",
                                description=f"Add a {template} section",
                                payload={"type": template, "variant": REGISTRY_TYPES[template]},
                            )
                        ]
            before = len(ops)
            ops = clean_ops(ops, request.prompt, request.tree_summary)
            message = str(data.get("message", "")).strip()
            if not ops and (before or not message or " " not in message):
                message = "I wasn't sure what you meant by that, so I haven't changed anything. Try being specific, for example “add a cart button and a My orders link to the navbar”, “add a pricing section” or “create a checkout page”."
            return AICommandResponse(message=message, ops=ops, provider="ollama")
        except Exception as exc:  # noqa: BLE001 — local model failures should not break the editor
            fallback = await RuleBasedProvider().generate(request)
            if fallback.ops:
                return fallback
            if isinstance(exc, httpx.TimeoutException):
                fallback.message = "The AI model is taking longer than usual, probably because it is still starting up. Please try again in a moment, or ask for something specific such as “add a pricing section” or “add a cart button to the navbar”, which I can do instantly."
            else:
                fallback.message = "The AI model isn't reachable right now, so I can only do specific requests such as “add a pricing section”, “add a cart button to the navbar” or “create a checkout page”. Check that Ollama is running for open-ended requests."
            return fallback

STYLE_WORDS = ("color", "colour", "theme", "dark", "light", "background", "style", "font", "palette", "glass", "gradient", "shadow", "radius", "rounded", "spacing", "padding", "bold")


def describe_op(op: "AIOp", tree: list[dict]) -> str:
    """A human-readable line for a suggested change, whatever the model wrote (or forgot to write)."""
    names = {n.get("id"): (n.get("name") or n.get("type") or "section") for n in tree}
    target = names.get(op.target_id) or "the section"
    payload = op.payload or {}
    if op.op == "update_component":
        props = payload.get("props") or {}
        parts = []
        for k, v in props.items():
            if isinstance(v, list):
                parts.append(f"{k}: {', '.join(str(x) if not isinstance(x, dict) else next(iter(x.values()), '') for x in v[:6])}")
            else:
                parts.append(f"{k}: {v}")
        return f"Change {target}: " + "; ".join(parts) if parts else f"Update {target}"
    if op.op == "update_style":
        return f"Restyle {target}: " + ", ".join(f"{k} = {v}" for k, v in (payload.get("style") or {}).items())
    if op.op == "update_theme":
        return "Change the site theme: " + ", ".join(f"{k}" for k in payload.keys())
    if op.op == "add_component":
        return f"Add a {payload.get('type', 'new')} section"
    if op.op == "delete_component":
        return f"Remove {target}"
    if op.op == "duplicate_component":
        return f"Duplicate {target}"
    if op.op == "create_page":
        return f"Create a page{': ' + str(payload.get('name')) if payload.get('name') else ''}"
    return f"{op.op.replace('_', ' ').capitalize()}"


def clean_ops(ops: list["AIOp"], prompt: str, tree: list[dict]) -> list["AIOp"]:
    """Every suggestion gets a description, and style/theme changes the user did not ask for are dropped."""
    wants_style = any(w in prompt.lower() for w in STYLE_WORDS)
    ids = {n.get("id") for n in tree}
    by_key = {"links": "navbar", "brand": "navbar", "loginLabel": "navbar", "showCart": "navbar", "headline": "hero", "subheadline": "hero", "primaryCta": "hero"}
    out = []
    for op in ops:
        if op.op in ("update_component", "update_style", "delete_component", "duplicate_component") and op.target_id not in ids:
            # The model named a section that is not on this page. Work out which one it meant, or drop the edit.
            keys = list((op.payload.get("props") or {}).keys())
            wanted = next((by_key[k] for k in keys if k in by_key), None)
            node = next((n for n in tree if n.get("type") == wanted), None) if wanted else None
            if not node:
                continue
            op.target_id = node["id"]
        if op.op in ("update_style", "update_theme") and not wants_style:
            continue
        if op.op == "update_component":
            node = next((n for n in tree if n.get("id") == op.target_id), None)
            wanted = (op.payload or {}).get("props") or {}
            if node and wanted and all((node.get("props") or {}).get(k) == v for k, v in wanted.items()):
                continue  # the edit would change nothing, so don't present it as a change
        if not op.description.strip():
            op.description = describe_op(op, tree)
        out.append(op)
    return out


def _stable_id() -> str:
    return uuid.uuid4().hex[:8]


def get_ai_provider() -> AIProvider:
    if settings.ai_provider.lower() == "ollama":
        return OllamaProvider()
    if settings.ai_configured:
        try:
            return AnthropicProvider()
        except Exception:  # noqa: BLE001 — package or key misconfigured, fall back
            return RuleBasedProvider()
    return RuleBasedProvider()


async def warm_up_model() -> None:
    """Loads the local model into memory when the API starts, so the first request isn't slow."""
    if settings.ai_provider.lower() != "ollama":
        return
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            await client.post(
                f"{settings.ollama_base_url.rstrip('/')}/api/generate",
                json={"model": settings.ollama_model, "prompt": "hi", "stream": False, "keep_alive": "60m", "options": {"num_predict": 1}},
            )
    except Exception:  # noqa: BLE001 - best effort only
        pass
