"""Fixes the structural part of the acceptance checklist automatically: every page that exists gets linked from the
navbar. (See app/projects/checklist.py: "The page exists but isn't linked in the navbar.")

This needs no model — it's a deterministic, mechanical fix — so it runs instantly and for free. What it can't fix
(a page with almost no content) is left for the person or a future OORA pass, and is reported back so the caller can
say so.
"""


def fix_navbar_links(pages: list[dict]) -> list[str]:
    """Makes every page's navbar show the same links (a real site has one consistent navbar): the union of whatever
    links already exist anywhere (so a hand-added "Instagram" or "#faq" survives) plus every page's name. Mutates the
    pages in place. Returns the page names that were newly added (empty if every navbar already covered them all)."""
    page_names = [p["name"] for p in pages if p.get("name") and p["name"].lower() not in ("home", "homepage")]
    navbars = [node for p in pages for node in p.get("tree", []) if node.get("type") == "navbar"]
    if not navbars:
        return []

    seen_lower: set[str] = set()
    full: list[str] = []
    for navbar in navbars:
        for link in (navbar.get("props") or {}).get("links") or []:
            link = str(link).strip()
            if link and link.lower() not in seen_lower:
                seen_lower.add(link.lower())
                full.append(link)

    added = [name for name in page_names if name.lower() not in seen_lower]
    full += added
    for navbar in navbars:
        navbar.setdefault("props", {})["links"] = list(full)
    return added


def thin_pages(pages: list[dict]) -> list[str]:
    """Pages the linkage fix can't help with: they exist and are (now) linked, but have almost no content, so a
    person (or OORA) needs to add sections to them."""
    thin = []
    for page in pages:
        content = [n for n in page.get("tree", []) if n.get("type") not in ("navbar", "footer", "chatbot")]
        if len(content) < 2:
            thin.append(page["name"])
    return thin
