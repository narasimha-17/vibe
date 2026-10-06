"""Navbar links that scroll to sections, one-page style.

Mirrors apps/web/lib/section-links.ts (the builder uses the same rules); keep the two in step.
"""

import re

ALIASES: dict[str, list[str]] = {
    "team": ["team", "our team", "people", "about", "about us"],
    "faq": ["faq", "faqs", "questions", "help"],
    "forms": ["contact", "contact us", "get in touch", "book", "booking", "subscribe", "newsletter"],
    "pricing": ["pricing", "plans", "prices", "price"],
    "testimonials": ["testimonials", "reviews", "clients", "feedback"],
    "features": ["features", "services", "what we do"],
    "cards": ["services", "courses", "projects", "portfolio", "work"],
    "catalog": ["products", "courses", "menu", "catalog", "collection", "portfolio", "work"],
    "timeline": ["experience", "journey", "history", "timeline", "process"],
    "stats": ["stats", "numbers", "results", "achievements"],
    "socials": ["socials", "social", "follow"],
    "cta": ["get started", "start"],
    "footer": ["contact", "contact us"],
}


def _norm(value) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def anchor_slug(label: str) -> str:
    return _norm(label).replace(" ", "-") or "section"


def section_for_link(label: str, tree: list[dict]) -> dict | None:
    """The section on this page that a navbar link means, or None. "Home" means the first section."""
    want = _norm(label)
    if not want:
        return None
    sections = [n for n in tree if n.get("type") != "navbar" and not n.get("hidden")]
    if want in ("home", "top"):
        return sections[0] if sections else None

    def titles(n: dict) -> list[str]:
        p = n.get("props") or {}
        return [t for t in (_norm(p.get("heading")), _norm(p.get("title")), _norm(p.get("headline")), _norm(p.get("eyebrow")), _norm(n.get("name"))) if t]

    for n in sections:
        if any(t == want or f" {want} " in f" {t} " for t in titles(n)):
            return n
    for type_, words in ALIASES.items():
        if want in words:
            hit = next((n for n in sections if n.get("type") == type_), None)
            if hit:
                return hit
    return next((n for n in sections if _norm(n.get("type")) == want), None)


def page_anchors(tree: list[dict]) -> tuple[dict[str, str], dict[str, str]]:
    """For one page: (node id -> anchor id for the sections its navbar points at, link label -> "#anchor")."""
    ids: dict[str, str] = {}
    hrefs: dict[str, str] = {}
    for nav in (n for n in tree if n.get("type") == "navbar"):
        for label in (nav.get("props") or {}).get("links", []) or []:
            section = section_for_link(str(label), tree)
            if not section:
                continue
            anchor = ids.setdefault(section["id"], anchor_slug(str(label)))
            hrefs[str(label)] = f"#{anchor}"
    return ids, hrefs


def with_id(markup: str, anchor: str) -> str:
    """Put id="anchor" on the section's outer element (a wrapper div when it is a component such as <ContactForm />)."""
    m = re.match(r"\s*<([a-z][\w-]*)", markup)
    if m:
        return markup[: m.end()] + f' id="{anchor}"' + markup[m.end():]
    return f'<div id="{anchor}">\n{markup}\n</div>'
