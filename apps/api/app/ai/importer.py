"""Rebuild the layout of a website (from its URL) or of a screenshot as an editable VIBE page.

URL import reads the page's real structure (title, navigation, headline, sections, images, footer) and maps it onto
VIBE components. It is a structural rebuild, not a pixel copy: the result uses your theme, and text is taken as-is,
so only import pages you have the right to reuse.

Screenshot import needs a vision-capable model, which means an Anthropic API key. Without one it says so.
"""

import base64
import ipaddress
import json
import re
import socket
import uuid
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.core.config import get_settings

settings = get_settings()
MAX_BYTES = 2_000_000


def _node(type_: str, variant: str, props: dict, name: str | None = None) -> dict:
    return {"id": uuid.uuid4().hex[:8], "type": type_, "variant": variant, "name": name or type_.capitalize(), "props": props, "style": {}, "responsive": {}, "children": [], "locked": False, "hidden": False}


def check_url(url: str) -> str:
    """Only public http(s) addresses. Blocks localhost and private networks so this can't be aimed at internal services."""
    parsed = urlparse(url if "://" in url else "https://" + url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Please give a full website address starting with http:// or https://")
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as exc:
        raise ValueError("I couldn't find that website. Check the address.") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError("That address is on a private network, so I can't open it.")
    return parsed.geturl()


async def fetch(url: str) -> str:
    safe = check_url(url)
    async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (compatible; VIBE-importer/1.0)"}) as client:
        res = await client.get(safe)
        res.raise_for_status()
        final = check_url(str(res.url))  # a redirect must not lead somewhere private either
        _ = final
        if len(res.content) > MAX_BYTES:
            raise ValueError("That page is too large to import.")
        return res.text


def _text(el) -> str:
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)) if el else ""


def _clean(items: list[dict], keys: tuple[str, ...]) -> list[dict]:
    return [i for i in items if any(i.get(k) for k in keys)]


def html_to_tree(html: str, base_url: str) -> tuple[str, list[dict]]:
    """(page title, VIBE component tree)."""
    soup = BeautifulSoup(html, "lxml")
    for bad in soup(["script", "style", "noscript", "svg", "iframe"]):
        bad.decompose()
    title = _text(soup.title).split("|")[0].split("–")[0].split(" - ")[0].strip() or urlparse(base_url).hostname or "Imported site"
    tree: list[dict] = []

    nav = soup.find("nav") or soup.find("header")
    links = []
    brand = title
    if nav:
        logo = nav.find(class_=re.compile("logo|brand", re.I)) or nav.find("img", alt=True)
        if logo is not None:
            brand = (logo.get("alt") if logo.name == "img" else _text(logo)) or brand
        for a in nav.find_all("a"):
            t = _text(a)
            if 1 < len(t) <= 22 and t.lower() not in [x.lower() for x in links] and t != brand:
                links.append(t)
    tree.append(_node("navbar", "default", {"brand": brand[:40], "links": links[:6], "ctaLabel": "Get Started"}))

    h1 = soup.find("h1")
    if h1:
        sub = ""
        nxt = h1.find_next(["p", "h2"])
        if nxt:
            sub = _text(nxt)[:200]
        cta = ""
        for a in (h1.find_all_next(["a", "button"], limit=6) or []):
            t = _text(a)
            if 2 < len(t) <= 24:
                cta = t
                break
        img = None
        hero_root = h1.find_parent(["section", "div", "header"]) or soup
        pic = hero_root.find("img", src=True)
        if pic:
            img = urljoin(base_url, pic["src"])
        tree.append(_node("hero", "split" if img else "centered", {"headline": _text(h1)[:90], "subheadline": sub, "primaryCta": cta or "Learn more", "secondaryCta": "", "visualImage": img or ""}))

    seen = set()
    for section in soup.find_all(["section", "main"], limit=40) or []:
        heading = section.find(["h2", "h3"])
        if not heading or _text(heading) in seen:
            continue
        seen.add(_text(heading))
        title_text = _text(heading)[:80]
        kids = [c for c in section.find_all(["article", "li", "div"], recursive=True, limit=80) if c.find(["h3", "h4", "strong"]) and 12 < len(_text(c)) < 300]
        items = []
        for c in kids[:6]:
            h = c.find(["h3", "h4", "strong"])
            head = _text(h)[:60]
            body = _text(c).replace(head, "", 1).strip()[:160]
            if head and head not in [i["title"] for i in items]:
                items.append({"title": head, "text": body})
        low = (title_text + " " + " ".join(i["title"] for i in items)).lower()
        if re.search(r"faq|question", low) and items:
            tree.append(_node("faq", "twocol", {"heading": title_text, "items": [{"q": i["title"], "a": i["text"] or "Answer coming soon."} for i in items]}))
        elif re.search(r"testimonial|review|customers say|what people", low) and items:
            tree.append(_node("testimonials", "wall", {"heading": title_text, "items": [{"quote": i["text"] or i["title"], "name": i["title"][:30], "role": ""} for i in items]}))
        elif re.search(r"pricing|plans", low):
            tree.append(_node("pricing", "toggle", {"heading": title_text, "tiers": [{"name": i["title"], "price": "", "unit": "", "features": [i["text"]] if i["text"] else [], "button": "Choose"} for i in items[:3]]}))
        elif re.search(r"team|people|about us", low) and items:
            tree.append(_node("team", "photo", {"heading": title_text, "items": [{"name": i["title"], "role": i["text"][:40]} for i in items[:4]]}))
        elif re.search(r"contact|get in touch|subscribe|newsletter", low):
            tree.append(_node("forms", "split", {"heading": title_text, "subheading": _text(section.find("p"))[:140]}))
        elif items:
            tree.append(_node("features", "bento", {"heading": title_text, "subheading": "", "items": items[:6]}))
        if len(tree) >= 9:
            break

    footer = soup.find("footer")
    tree.append(_node("footer", "default", {"brand": brand[:40], "left": f"© {brand[:40]}", "links": []}))
    if footer:
        tree[-1]["props"]["left"] = _text(footer)[:80] or tree[-1]["props"]["left"]
    return title, tree


async def import_url(url: str) -> tuple[str, list[dict]]:
    html = await fetch(url)
    return html_to_tree(html, url)


# ───────────────────────── screenshot (vision) ─────────────────────────
VISION_SYSTEM = """You look at a screenshot of a web page and describe its layout as JSON for a website builder.
Reply with ONLY JSON: {"title": "...", "sections": [{"type": "navbar|hero|features|pricing|testimonials|faq|team|cta|forms|footer|catalog",
"heading": "...", "subheading": "...", "items": [{"title": "...", "text": "..."}], "links": ["..."], "cta": "..."}]}.
Use the real text you can read. Keep sections in top-to-bottom order. At most 9 sections."""


async def import_screenshot(image_bytes: bytes, media_type: str) -> tuple[str, list[dict]]:
    if not settings.anthropic_api_key:
        raise ValueError("Importing from a screenshot needs a vision-capable AI model. Add an ANTHROPIC_API_KEY to the server settings to turn it on. Importing from a website address works without one.")
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=60)
    res = await client.messages.create(
        model="claude-sonnet-5",
        max_tokens=2500,
        system=VISION_SYSTEM,
        messages=[{"role": "user", "content": [{"type": "image", "source": {"type": "base64", "media_type": media_type, "data": base64.b64encode(image_bytes).decode()}}, {"type": "text", "text": "Describe this page."}]}],
    )
    text = "".join(b.text for b in res.content if getattr(b, "type", "") == "text")
    m = re.search(r"\{.*\}", text, re.S)
    data = json.loads(m.group(0)) if m else {}
    tree: list[dict] = []
    for s in data.get("sections", [])[:9]:
        t = s.get("type")
        items = s.get("items") or []
        if t == "navbar":
            tree.append(_node("navbar", "default", {"brand": s.get("heading", "My Site"), "links": (s.get("links") or [])[:6]}))
        elif t == "hero":
            tree.append(_node("hero", "centered", {"headline": s.get("heading", ""), "subheadline": s.get("subheading", ""), "primaryCta": s.get("cta") or "Get started", "secondaryCta": ""}))
        elif t == "pricing":
            tree.append(_node("pricing", "toggle", {"heading": s.get("heading", "Pricing"), "tiers": [{"name": i.get("title", ""), "price": "", "unit": "", "features": [i.get("text", "")], "button": "Choose"} for i in items[:3]]}))
        elif t == "testimonials":
            tree.append(_node("testimonials", "wall", {"heading": s.get("heading", ""), "items": [{"quote": i.get("text", ""), "name": i.get("title", ""), "role": ""} for i in items]}))
        elif t == "faq":
            tree.append(_node("faq", "twocol", {"heading": s.get("heading", "FAQ"), "items": [{"q": i.get("title", ""), "a": i.get("text", "")} for i in items]}))
        elif t == "team":
            tree.append(_node("team", "photo", {"heading": s.get("heading", "Team"), "items": [{"name": i.get("title", ""), "role": i.get("text", "")} for i in items]}))
        elif t == "cta":
            tree.append(_node("cta", "line", {"heading": s.get("heading", ""), "subheading": s.get("subheading", ""), "button": s.get("cta") or "Get started"}))
        elif t == "forms":
            tree.append(_node("forms", "split", {"heading": s.get("heading", "Contact"), "subheading": s.get("subheading", "")}))
        elif t == "footer":
            tree.append(_node("footer", "default", {"brand": s.get("heading", ""), "left": s.get("subheading", "")}))
        elif t in ("features", "catalog"):
            tree.append(_node("features", "bento", {"heading": s.get("heading", ""), "subheading": s.get("subheading", ""), "items": [{"title": i.get("title", ""), "text": i.get("text", "")} for i in items]}))
    if not tree:
        raise ValueError("I couldn't read a layout from that image. Try a clearer, larger screenshot.")
    return str(data.get("title") or "Imported page"), tree
