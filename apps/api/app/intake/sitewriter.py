"""Writes the whole site's text with the language model when OORA creates a project.

Templates only decide the structure and look. Everything a visitor reads (navbar, headings, items, testimonials,
buttons, footer) is written here for the user's business, using the same numbered-list trick as app/ai/copywriting.py:
the model sees only the texts, never the structure, so it cannot break a component. If the model fails for a page, that
page keeps the pack copy that content.tailor already put in.

Login, sign-up, shop and admin pages are written like every other page (their forms get starter headings first).
"""

import asyncio
import json

from app.ai import llm
from app.ai.copywriting import TEXT_KEYS, _collect, _set
from app.codegen.anchors import section_for_link
from app.core.config import get_settings

settings = get_settings()

# Login / sign-up forms come with empty headings; give them a start so the model has something to rewrite.
AUTH_START = {"login": ("Welcome back", "Sign in to continue."), "register": ("Create your account", "It only takes a minute."),
              "forgot": ("Forgot your password?", "We'll email you a reset link."), "otp": ("Sign in with a code", "We'll send a one-time code.")}
SKIP_NODES = {"chatbot"}
KEYS = TEXT_KEYS | {"price", "category", "author", "date", "time", "duration", "tag", "badge", "announcement", "eyebrow", "caption", "location"}
CHUNK = 70
TOPBAR_DEFAULT = ["Open every day", "Call us", "Visit us"]

SYSTEM = """You write all the text for a small business website. You receive what the business told us, then a numbered list of
the texts currently on one page; each line says where the text sits as [section · field]. Replace EVERY text with new text written
for THIS business: its real offer, audience, tone and location. Rules:
- Reply with ONLY JSON {"texts": ["...", ...]} with exactly the same number of items, in the same order.
- Keep each text about the same length and the same kind (a button stays a short button label, a price stays a price in ₹,
  a person's name stays a plausible local name, a number stays a number).
- Use the brand name exactly as given. Do not use the words Lorem, placeholder or TBD.
- Only mention a shop, cart, checkout, delivery or order tracking if this site has those pages (see ALLOWED LINKS);
  otherwise buttons should lead to enquiries, bookings, visits, calls or WhatsApp.
- Navbar links: each must be exactly one of the ALLOWED LINKS given, in the order that suits the business.
- Legal footer links (Privacy, Terms) may stay as they are."""


def _restrict_cta_to_home(pages: list[dict]) -> None:
    """A standalone "cta" band (heading + subheading + one button) belongs on the landing page only; every other page
    already ends with its own natural call to action (a form, a shop, a booking widget). Also guards against a page
    ending up with more than one cta band, keeping the last (closest to the footer)."""
    for page in pages:
        tree = page.get("tree", [])
        cta_indexes = [i for i, n in enumerate(tree) if n.get("type") == "cta"]
        if not cta_indexes:
            continue
        keep = cta_indexes[-1] if page.get("is_home") else None
        page["tree"] = [n for i, n in enumerate(tree) if n.get("type") != "cta" or i == keep]


def prepare(pages: list[dict]) -> list[dict]:
    """Gives the model something to rewrite where templates leave text empty (two-tier navbar strip, login / sign-up forms),
    and applies structural rules templates don't always follow on their own (one cta band, on the landing page only)."""
    _restrict_cta_to_home(pages)
    for page in pages:
        for node in page["tree"]:
            if node.get("type") == "navbar":
                props = node.setdefault("props", {})
                if node.get("variant") == "twotier" and "topbar" not in props:
                    props["topbar"] = list(TOPBAR_DEFAULT)
            elif node.get("type") == "auth":
                props = node.setdefault("props", {})
                heading, sub = AUTH_START.get(str(node.get("variant", "login")).partition("-")[0], AUTH_START["login"])
                props["heading"] = props.get("heading") or heading
                props["subheading"] = props.get("subheading") or sub
    return pages


def _slots(nodes: list[dict]) -> list[tuple[dict, tuple, str]]:
    out: list[tuple[dict, tuple, str]] = []
    for node in nodes:
        if node.get("type") in SKIP_NODES:
            continue
        found: list[tuple[tuple, str]] = []
        _collect(node.get("props") or {}, (), found, KEYS)
        out += [(node, path, text) for path, text in found]
    return out


def _where(node: dict, path: tuple) -> str:
    field = next((str(p) for p in reversed(path) if isinstance(p, str)), "text")
    return f"{node.get('name') or node.get('type')} · {field}"


async def _write_chunk(brief: str, page_name: str, allowed: list[str], chunk: list[tuple[dict, tuple, str]]) -> int:
    numbered = "\n".join(f"{i + 1}. [{_where(n, p)}] {t}" for i, (n, p, t) in enumerate(chunk))
    user = f"{brief}\n\nPage: {page_name}\nALLOWED LINKS for the navbar: {', '.join(allowed) or 'none'}\n\nTexts:\n{numbered}"
    raw = await llm.complete(SYSTEM, user, json_mode=True, timeout=max(settings.intake_agent_timeout, 60), max_tokens=4000)
    data = llm.parse_json(raw)
    texts = data.get("texts") if isinstance(data, dict) else data if isinstance(data, list) else None
    if not isinstance(texts, list) or len(texts) != len(chunk):
        return 0
    changed = 0
    for (node, path, old), new in zip(chunk, texts):
        new = str(new).strip() if isinstance(new, (str, int, float)) else ""
        if new and new != old and len(new) <= max(3 * len(old), 160):
            _set(node["props"], path, new)
            changed += 1
    return changed


async def _write_page(brief: str, page: dict, nodes: list[dict], allowed: list[str]) -> int:
    slots = _slots(nodes)
    chunks = [slots[i:i + CHUNK] for i in range(0, len(slots), CHUNK)]
    done = await asyncio.gather(*(_write_chunk(brief, page["name"], allowed, c) for c in chunks))
    return sum(done)


def _brief(name: str, memory: dict) -> str:
    known = {k: v for k, v in memory.items() if not str(k).startswith("_") and v}
    return f"Brand name: {name}\nWhat we know about the business:\n{json.dumps(known, ensure_ascii=False, indent=1)[:3000]}"


def _fix_links(navbar: dict, home: dict, page_names: list[str], fallback: list[str]) -> None:
    """Keep only navbar links that lead somewhere: another page, or a section on the home page."""
    props = navbar.setdefault("props", {})
    names = {n.lower(): n for n in page_names}
    good: list[str] = []
    for label in props.get("links", []) or []:
        label = str(label).strip()
        if label.lower() in names:
            good.append(names[label.lower()])
        elif section_for_link(label, home["tree"]):
            good.append(label)
    props["links"] = list(dict.fromkeys(good))[:7] or fallback


async def write_site(pages: list[dict], memory: dict, name: str) -> int:
    """Rewrites every page's text for this business, in place. Returns how many texts the model wrote (0 = no model or it failed)."""
    if not settings.intake_use_agent or not llm.has_model():
        return 0
    brief = _brief(name, memory)
    home = next((p for p in pages if p.get("is_home")), pages[0])
    page_names = [p["name"] for p in pages if not p.get("is_home")]
    section_names = [str((n.get("props") or {}).get("heading") or n.get("name") or "") for n in home["tree"] if n.get("type") not in ("navbar", "footer", "hero", "chatbot")]
    allowed = list(dict.fromkeys([*page_names, *[s for s in section_names if s and len(s) <= 24]]))
    shared = [n for n in home["tree"] if n.get("type") in ("navbar", "footer")]
    old_links = list(next((n for n in shared if n.get("type") == "navbar"), {}).get("props", {}).get("links", []) or [])

    # Home page (with the site-wide navbar and footer) and the other pages, all at once.
    jobs = [_write_page(brief, home, home["tree"], allowed)]
    for page in pages:
        if page is not home:
            jobs.append(_write_page(brief, page, [n for n in page["tree"] if n.get("type") not in ("navbar", "footer")], []))
    written = sum(await asyncio.gather(*jobs))

    # The same navbar and footer on every page.
    for node in shared:
        if node.get("type") == "navbar":
            _fix_links(node, home, page_names, old_links)
        for page in pages:
            if page is home:
                continue
            for other in page["tree"]:
                if other.get("type") == node.get("type"):
                    other["props"] = json.loads(json.dumps(node["props"]))
    return written
