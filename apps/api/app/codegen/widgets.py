"""Connected frontend widgets for exported projects.

Shop, order tracking, chatbot and form nodes are exported as real, interactive React components (copied from
`templates/`) that call the generated backend through `NEXT_PUBLIC_API_URL` / `VITE_API_URL`.
"""

import json
import pathlib
import re

TEMPLATES = pathlib.Path(__file__).parent / "templates"

# Set by the engine before generating: framework in use and whether a backend is being generated.
CTX: dict = {"framework": "nextjs", "connected": False}

FLOATING_CHAT = {"widget", "whatsapp", "bubble"}
WIDGET_TYPES = {"shop", "tracking", "chatbot", "auth"}
IMPORTS = {
    "ShopWidget": 'import ShopWidget from "./widgets/ShopWidget";',
    "TrackingWidget": 'import TrackingWidget from "./widgets/TrackingWidget";',
    "FormWidget": 'import FormWidget from "./widgets/FormWidget";',
    "AuthWidget": 'import AuthWidget from "./widgets/AuthWidget";',
    "ChatbotWidget": 'import { ChatbotWidget } from "./widgets/ChatbotWidget";',
}
FILES = {"ShopWidget": "ShopWidget.tsx", "TrackingWidget": "TrackingWidget.tsx", "FormWidget": "FormWidget.tsx", "AuthWidget": "AuthWidget.tsx", "ChatbotWidget": "ChatbotWidget.tsx"}


def api_expr() -> str:
    return "process.env.NEXT_PUBLIC_API_URL" if CTX["framework"] == "nextjs" else "import.meta.env.VITE_API_URL"


def env_name() -> str:
    return "NEXT_PUBLIC_API_URL" if CTX["framework"] == "nextjs" else "VITE_API_URL"


def _js(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def _num(value) -> float:
    digits = re.sub(r"[^\d.]", "", str(value or ""))
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


def has_widgets(pages: list[dict], connected: bool) -> bool:
    for page in pages:
        for node in page.get("tree", []):
            if node.get("type") in WIDGET_TYPES or (connected and node.get("type") == "forms"):
                return True
    return False


def floating_chat_node(pages: list[dict]) -> dict | None:
    for page in pages:
        for node in page.get("tree", []):
            if node.get("type") == "chatbot" and node.get("variant") in FLOATING_CHAT and not node.get("hidden"):
                return node
    return None


def chat_props(p: dict) -> dict:
    keys = ("botName", "brand", "greeting", "placeholder", "fallback", "quickReplies", "knowledge")
    return {k: p[k] for k in keys if k in p}


def dock_markup() -> str | None:
    return None  # filled in by the engine via chat_dock()


def chat_dock(node: dict) -> str:
    return f'<ChatbotWidget dock variant={{{_js(node.get("variant"))}}} p={{{_js(chat_props(node.get("props", {})))}}} apiUrl={{{api_expr()}}} />'


def render_widget_node(node: dict) -> str | None:
    """Markup for widget-backed nodes, or None to let the normal generators handle the node."""
    t, v, p = node.get("type"), node.get("variant"), node.get("props", {}) or {}
    if CTX["framework"] == "html":
        if t in WIDGET_TYPES:
            return f"<!-- {t} needs Next.js or React. Export as Next.js to get the interactive version. -->"
        return None
    api = api_expr()
    if t == "shop":
        products = [
            {
                "id": i + 1,
                "name": str(x.get("name", f"Product {i + 1}")),
                "price": _num(x.get("price")),
                "description": str(x.get("description", "")),
                "image": str(x.get("image", "")),
                "category": str(x.get("category", "")),
                "stock": int(_num(x.get("stock", 50))),
            }
            for i, x in enumerate(p.get("products", []))
        ]
        layout = "top" if v == "top" else "sidebar"
        return f"<ShopWidget heading={{{_js(p.get('heading', 'Shop'))}}} products={{{_js(products)}}} layout=\"{layout}\" apiUrl={{{api}}} />"
    if t == "auth":
        kind, _, layout = str(v or "login").partition("-")
        kind = kind if kind in ("login", "register", "forgot", "reset", "otp", "profile") else "login"
        layout = layout if layout in ("split", "minimal") else "card"
        return f"<AuthWidget kind=\"{kind}\" layout=\"{layout}\" brand={{{_js(p.get('brand', 'Your Brand'))}}} heading={{{_js(p.get('heading', ''))}}} subheading={{{_js(p.get('subheading', ''))}}} apiUrl={{{api}}} />"
    if t == "tracking":
        return f"<TrackingWidget heading={{{_js(p.get('heading', 'Track your order'))}}} apiUrl={{{api}}} />"
    if t == "chatbot":
        if v in FLOATING_CHAT:
            return "<></>"  # rendered once, site-wide, by the layout
        return f"<ChatbotWidget variant={{{_js(v)}}} p={{{_js(chat_props(p))}}} apiUrl={{{api}}} />"
    if t == "forms" and CTX["connected"]:
        kind = v if v in ("contact", "booking", "subscription") else "contact"
        return f"<FormWidget kind=\"{kind}\" heading={{{_js(p.get('heading', ''))}}} subheading={{{_js(p.get('subheading', ''))}}} apiUrl={{{api}}} />"
    return None


def imports_for(markup: str) -> list[str]:
    return [IMPORTS[name] for name in IMPORTS if f"<{name}" in markup]


def widget_files(names: set[str]) -> list[tuple[str, str]]:
    return [(f"widgets/{FILES[n]}", (TEMPLATES / FILES[n]).read_text(encoding="utf-8")) for n in sorted(names) if n in FILES]


def used_widgets(markups: list[str]) -> set[str]:
    return {name for name in IMPORTS if any(f"<{name}" in m for m in markups)}


def widget_css(theme: dict, names: set[str]) -> str:
    colors = theme.get("colors", {}) or {}

    def c(key: str, fallback: str) -> str:
        return colors.get(key, fallback)

    css = f"""
/* ── widget theme bridge: maps your design tokens to the variables the widgets use ── */
:root {{
  --vp: {c("primary", "#6b4d9a")};
  --vpc: #ffffff;
  --va: {c("accent", "#ff5b7f")};
  --vb: {c("background", "#ffffff")};
  --vs: {c("surface", "#f7f4fd")};
  --vs2: {c("surface", "#efe9fa")};
  --vt: {c("text", "#1f1637")};
  --vm: {c("muted", "#6b6483")};
  --vo: {c("border", "#e2daf2")};
  --vbtn: 999px;
  --vh: var(--font-heading, inherit);
  --vdark: #1b1330;
}}
"""
    css += (TEMPLATES / "shop.css").read_text(encoding="utf-8")
    if "ChatbotWidget" in names:
        css += (TEMPLATES / "chatbot.css").read_text(encoding="utf-8")
        css += """
/* site-wide chat dock: fixed to the viewport on every page */
.cb-dock { position: fixed !important; right: 24px; bottom: 24px; z-index: 900; }
"""
    return css
