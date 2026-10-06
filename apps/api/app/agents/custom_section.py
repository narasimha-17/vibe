"""Custom sections: the user describes a section in chat and the model designs it as static HTML + CSS.

Used by the Design step (after OORA) when none of the builder's styles fits. The result is shown as a live preview, refined
by further chat messages, stored on the section (props.custom = {description, html, css}) and later handed to the UI agent
as part of the design reference, like every other section.

The output is made safe here, not trusted: scripts, event handlers and javascript: URLs are removed, and every CSS rule is
scoped to the section's own root class so it can never restyle the rest of the site.
"""

import re
import secrets

from app.agents.base import AgentError, BuildContext, ask_files, prompt
from app.agents.ui_agent import GUIDE
from app.core.config import get_settings

settings = get_settings()
SYSTEM = prompt("custom_section")  # prompts/custom_section.md


BLOCKED_TAGS = re.compile(r"<\s*(script|iframe|object|embed|link|meta|base)\b[^>]*>(?:.*?<\s*/\s*\1\s*>)?", re.I | re.S)
EVENT_ATTR = re.compile(r"\s+on\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", re.I)
JS_URL = re.compile(r"(href|src|action)\s*=\s*([\"'])\s*javascript:[^\"']*\2", re.I)


def clean_html(html: str) -> str:
    html = BLOCKED_TAGS.sub("", html)
    html = EVENT_ATTR.sub("", html)
    return JS_URL.sub(r'\1="#"', html).strip()


def _scope_selectors(selectors: str, scope: str) -> str:
    out = []
    for sel in selectors.split(","):
        sel = sel.strip()
        if not sel:
            continue
        if sel.startswith(scope):
            out.append(sel)
        elif sel in (":root", "html", "body", "*"):
            out.append(scope if sel != "*" else f"{scope} *")
        else:
            out.append(f"{scope} {sel}")
    return ", ".join(out)


def scope_css(css: str, scope: str) -> str:
    """Prefixes every selector with `scope` (inside @media / @supports too); keeps @keyframes as they are."""
    out, i, n = [], 0, len(css)
    while i < n:
        brace = css.find("{", i)
        if brace == -1:
            break
        head = css[i:brace].strip()
        depth, j = 1, brace + 1
        while j < n and depth:
            depth += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
        body = css[brace + 1:j - 1]
        if head.startswith(("@media", "@supports", "@container")):
            out.append(f"{head} {{\n{scope_css(body, scope)}\n}}")
        elif head.startswith("@"):
            out.append(f"{head} {{{body}}}")
        elif head:
            out.append(f"{_scope_selectors(head, scope)} {{{body}}}")
        i = j
    return "\n".join(out)


def _root_class(html: str) -> str | None:
    """The cx-... class on the outermost element, if the model used one."""
    m = re.search(r'^\s*<\w+[^>]*\bclass="([^"]*)"', html)
    return next((c for c in (m.group(1).split() if m else []) if c.startswith("cx-")), None)


async def design(theme: dict, section_type: str, content: dict, description: str, previous: dict | None = None,
                 instruction: str = "", scope: str | None = None) -> dict:
    """{"html", "css", "scope"} for a custom section. Raises AgentError when the model fails."""
    scope = scope or ("cx-" + secrets.token_hex(3))
    colors = theme.get("colors", {})
    brief = [
        f"Root class: {scope}",
        f"Theme colours: {colors}",
        f"Fonts: headings {theme.get('heading_font', 'Inter')}, body {theme.get('body_font', 'Inter')}; mode {theme.get('mode', 'light')}",
        f"Section kind: {section_type}",
        f"Section content: {content}",
        f"What the user wants: {description}",
    ]
    if previous and previous.get("html"):
        brief += [f"Previous version to change:\n<<<FILE section.html>>>\n{previous['html']}\n<<<END>>>\n<<<FILE section.css>>>\n{previous.get('css', '')}\n<<<END>>>",
                  f"Change requested now: {instruction or description}"]
    ctx = BuildContext(project={})
    files = await ask_files(ctx, SYSTEM + "\n\n" + GUIDE, "\n".join(brief), "", max_tokens=6000, timeout=120, model=settings.agents_ui_model or None, agent="UI agent")
    html = clean_html(files.get("section.html", ""))
    if not html:
        raise AgentError("The design came back empty. Try describing it a little differently.")
    root = _root_class(html)
    if not root:  # no scoped root element: wrap it, so the scoped CSS still applies
        html, root = f'<section class="{scope}">\n{html}\n</section>', scope
    return {"html": html, "css": scope_css(files.get("section.css", ""), "." + root), "scope": root}
