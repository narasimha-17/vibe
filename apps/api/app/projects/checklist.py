"""The project's acceptance checklist, checked against what is actually in the project.

The checklist is written during the OORA conversation. Items that can be verified from the project itself (a page
exists and is linked, a feature's component is on the site, contrast passes) tick themselves. Everything that needs a
person (tested on a phone, a business goal met) stays manual. A person can also tick any item by hand.
"""

import re
from typing import Any

from app.ai.critique import contrast


def _types(pages: list[dict]) -> set[str]:
    return {n.get("type") for p in pages for n in (p.get("tree") or [])}


def _navbar_links(pages: list[dict]) -> list[str]:
    home = next((p for p in pages if p.get("is_home")), pages[0] if pages else None)
    nav = next((n for n in (home or {}).get("tree", []) if n.get("type") == "navbar"), None)
    return [str(x).strip() for x in ((nav or {}).get("props") or {}).get("links", []) or []]


def _has_social(pages: list[dict], platform: str) -> bool:
    for p in pages:
        for n in p.get("tree") or []:
            if n.get("type") == "socials" and any(str(i.get("platform", "")).lower() == platform for i in (n.get("props") or {}).get("items", [])):
                return True
    return False


# phrase in the item -> component types that must be on the site for it to be true
BEHAVIOUR = [
    ("browse, filter, add to cart", {"shop"}),
    ("filters change the results", {"shop"}),
    ("enter an order number", {"tracking"}),
    ("star rating", {"shop", "testimonials"}),
    ("register, sign in", {"auth"}),
    ("submit a booking", {"forms"}),
    ("send an enquiry", {"forms"}),
    ("subscribe with their email", {"forms", "notifications"}),
    ("chat button", {"chatbot"}),
]


def evaluate(item: dict, project: dict) -> tuple[bool | None, str]:
    """(met, note). met is None when only a person can judge it."""
    text, category = item.get("text", ""), item.get("category", "")
    pages = project.get("pages") or []
    types = _types(pages)
    theme = project.get("theme") or {}

    m = re.match(r"The “(.+?)” page exists", text)
    if m:
        name = m.group(1).lower()
        page = next((p for p in pages if p.get("name", "").lower() == name), None)
        if not page:
            return False, "The page doesn't exist yet."
        if name not in [x.lower() for x in _navbar_links(pages)]:
            return False, "The page exists but isn't linked in the navbar."
        content = [n for n in page.get("tree") or [] if n.get("type") not in ("navbar", "footer", "chatbot")]
        if len(content) < 2:
            return False, "The page has almost no content yet."
        return True, "Exists, linked and filled."

    m = re.match(r"The site has (\d+) pages", text)
    if m:
        need = int(m.group(1))
        return len(pages) >= need, f"{len(pages)} of {need} pages."

    for phrase, needed in BEHAVIOUR:
        if phrase in text:
            ok = bool(needed & types)
            return ok, "The component is on the site." if ok else f"Add a {' or '.join(sorted(needed))} section."

    m = re.match(r"(Razorpay|WhatsApp|Instagram|Google Analytics|Stripe|PayPal|Mailchimp)\b", text)
    if category == "Integrations" and m:
        name = m.group(1)
        if name in ("Razorpay", "Stripe", "PayPal"):
            return ("shop" in types), "Payments run through the shop."
        if name in ("WhatsApp", "Instagram"):
            return _has_social(pages, name.lower()), "Added as a contact or social item." if _has_social(pages, name.lower()) else f"Add {name} with the Integrations section."
        return None, ""

    if "Every link and button goes somewhere" in text:
        names = {p.get("name", "").lower() for p in pages}
        broken = [l for p in pages for l in [x for n in (p.get("tree") or []) if n.get("type") == "navbar" for x in ((n.get("props") or {}).get("links") or [])] if str(l).lower() not in names]
        return (not broken), ("All navbar links open a page." if not broken else f"These links have no page: {', '.join(sorted(set(map(str, broken)))[:4])}.")

    if "enough contrast" in text:
        colors = theme.get("colors") or {}
        ratio = contrast(colors.get("text", ""), colors.get("background", ""))
        if ratio is None:
            return None, ""
        return ratio >= 4.5, f"Text contrast is {ratio:.1f}:1 (needs 4.5:1)."
    return None, ""


def build(project: dict) -> dict[str, Any]:
    items = (project.get("settings") or {}).get("acceptance") or []
    out = []
    for item in items:
        auto, note = evaluate(item, project)
        done = bool(item.get("done"))
        out.append({"id": item.get("id"), "category": item.get("category", ""), "text": item.get("text", ""), "done": done, "auto": auto, "note": note, "met": done or bool(auto)})
    met = sum(1 for i in out if i["met"])
    return {"has_checklist": bool(out), "items": out, "met": met, "total": len(out)}
