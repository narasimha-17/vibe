"""Design critique: checks the page and theme for real, measurable problems and proposes fixes.

Everything here is a rule with a number behind it (contrast ratio, count, length), not an opinion, so findings are
explainable. Fixable problems come with an edit the user can approve.
"""

import re
from typing import Any

from app.schemas.schemas import AIOp


def _lum(hex_: str) -> float | None:
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", (hex_ or "").strip())
    if not m:
        return None
    v = m.group(1)
    chans = [int(v[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in chans]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a: str, b: str) -> float | None:
    la, lb = _lum(a), _lum(b)
    if la is None or lb is None:
        return None
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _darken(hex_: str) -> str:
    v = hex_.lstrip("#")
    return "#" + "".join(f"{max(0, int(v[i:i + 2], 16) - 70):02x}" for i in (0, 2, 4))


def review(tree: list[dict], theme: dict | None) -> tuple[list[dict], list[AIOp]]:
    """Returns (findings, fixes). Each finding: {severity, title, detail}."""
    findings: list[dict] = []
    fixes: list[AIOp] = []

    def add(sev: str, title: str, detail: str) -> None:
        findings.append({"severity": sev, "title": title, "detail": detail})

    colors = (theme or {}).get("colors") or {}
    for fg, bg, label, need in (("text", "background", "Body text on the page background", 4.5), ("muted", "background", "Muted text on the page background", 4.5), ("primary", "background", "Brand colour (buttons and links) on the page background", 3.0)):
        ratio = contrast(colors.get(fg, ""), colors.get(bg, ""))
        if ratio is not None and ratio < need:
            add("high", f"Low contrast: {label}", f"The ratio is {ratio:.1f}:1 and should be at least {need}:1 so it is readable.")
            if fg in ("text", "muted") and (_lum(colors.get(bg, "")) or 0) > 0.5:
                fixes.append(AIOp(op="update_theme", description=f"Darken the {fg} colour so it passes contrast", payload={"colors": {fg: _darken(colors[fg])}}))

    types = [n.get("type") for n in tree]
    nodes_by_type = {n.get("type"): n for n in tree}
    if "navbar" not in types:
        add("high", "No navigation bar", "Visitors on other pages have no way to move around. Add a navbar.")
    if "footer" not in types:
        add("medium", "No footer", "A footer gives contact details, legal links and a place for visitors who reach the bottom.")
    hero = nodes_by_type.get("hero")
    if not hero and len(tree) > 1:
        add("medium", "No hero or page header", "The top of the page has no headline telling visitors what they are looking at.")
    if hero:
        p = hero.get("props") or {}
        if len(str(p.get("headline", ""))) > 70:
            add("medium", "The headline is too long", f"It has {len(str(p['headline']))} characters. Aim for under 60 so it reads at a glance, especially on mobile.")
            fixes.append(AIOp(op="update_component", description="Shorten the hero headline", target_id=hero.get("id"), payload={"props": {"headline": str(p["headline"])[:57].rsplit(" ", 1)[0] + "."}}))
        if not (p.get("primaryCta") or p.get("secondaryCta")) and hero.get("variant") != "page-header":
            add("medium", "The hero has no call to action", "Give visitors a next step, such as “Get started” or “Shop now”.")
    nav = nodes_by_type.get("navbar")
    if nav:
        links = (nav.get("props") or {}).get("links") or []
        if len(links) > 6:
            add("medium", f"The navbar has {len(links)} links", "More than six links crowd the bar and collapse badly on mobile. Group extras under fewer links.")
            fixes.append(AIOp(op="update_component", description="Keep the six most important navbar links", target_id=nav.get("id"), payload={"props": {"links": links[:6]}}))
        if any(len(str(l)) > 18 for l in links):
            add("low", "Some navbar labels are long", "Short labels (one or two words) fit on small screens.")
    ctas = sum(1 for n in tree if n.get("type") == "cta")
    if ctas > 2:
        add("low", f"{ctas} call-to-action banners on one page", "Repeated banners feel pushy. Keep one or two.")
    if len(tree) <= 3:
        add("low", "The page is very short", "Pages with only a few sections feel unfinished. Add supporting content such as features, testimonials or an FAQ.")
    empty = [n.get("name") or n.get("type") for n in tree if n.get("type") in ("features", "cards", "faq", "testimonials", "team", "stats") and not (n.get("props") or {}).get("items")]
    if empty:
        add("medium", "Sections with no content", f"{', '.join(empty)} have no items yet, so they will show empty.")
    for n in tree:
        p = n.get("props") or {}
        for key in ("visualImage",):
            if key in p and not p.get(key) and n.get("type") == "hero" and n.get("variant") == "split":
                add("low", "The hero image is empty", "A split hero looks best with an image. I can generate one for you.")
                break
    headings = [str((n.get("props") or {}).get("heading", "")).strip().lower() for n in tree if (n.get("props") or {}).get("heading")]
    dup = {h for h in headings if h and headings.count(h) > 1}
    if dup:
        add("low", "Repeated section headings", f"“{sorted(dup)[0]}” appears more than once. Give each section its own heading.")
    if not findings:
        add("info", "No problems found", "Contrast, structure and content checks all passed. Check the page on a phone before publishing.")
    return findings, fixes


def format_report(findings: list[dict]) -> str:
    icon = {"high": "🔴", "medium": "🟠", "low": "🟡", "info": "🟢"}
    return "\n".join(f"{icon.get(f['severity'], '•')} {f['title']}: {f['detail']}" for f in findings)
