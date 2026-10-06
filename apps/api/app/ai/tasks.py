"""Bigger jobs for the builder assistant: build a whole site from a sentence, rewrite or translate copy, generate images,
critique the design, and import a layout from a website.

Each task returns an AICommandResponse. Tasks that change a lot come back with `preview=True`, so the user sees the
plan and approves it before anything is applied.
"""

import re

from app.ai import copywriting, critique, imagegen, importer
from app.intake.blueprint import blueprint, covered
from app.intake.content import brand_name, detect_pack
from app.projects.page_factory import kind_for
from app.schemas.schemas import AICommandRequest, AICommandResponse, AIOp

URL = re.compile(r"(https?://[^\s]+|(?:www\.)[a-z0-9-]+\.[a-z.]{2,}[^\s]*)", re.I)
SITE_WORDS = r"\b(site|website|whole|entire|all pages|every page|all the pages|everything)\b"


def _reply(message: str, ops: list[AIOp] | None = None, preview: bool = False) -> AICommandResponse:
    return AICommandResponse(message=message, ops=ops or [], provider="assistant", preview=preview)


def _slug(name: str) -> str:
    return "/" + (re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "page")


def _tree(req: AICommandRequest) -> list[dict]:
    return req.tree_full or req.tree_summary


# ───────────────────────── multi-step agent ─────────────────────────
async def plan_site(req: AICommandRequest, text: str) -> AICommandResponse:
    """“Build me a full bakery site with a shop, offers and an admin area”: plan the pages, show them, then build them."""
    memory = {"business": text, "pages": {"count": None, "names": []}, "features": [text], "objectives": [text]}
    plan = blueprint(memory)
    have = [p for p in req.pages if p]
    steps: list[tuple[str, str]] = [(n, w) for n, w in plan["core"] + list(plan["admin"]) if not covered(n, have) or n.lower().startswith("admin")]
    steps = [(n, w) for n, w in steps if n.lower() not in [h.lower() for h in have]]
    if not steps:
        return _reply("Your project already has every page I would plan for this kind of site. Tell me what to add or change.")

    tree = _tree(req)
    nav = next((n for n in tree if n.get("type") == "navbar"), None)
    current_brand = str(((nav or {}).get("props") or {}).get("brand", "")).strip()
    brand = current_brand if current_brand and current_brand.lower() not in ("my site", "brand", "your brand") else brand_name({"business": text})
    business = text[:200]

    ops: list[AIOp] = []
    for name, why in steps:
        ops.append(AIOp(op="create_page", description=f"Create “{name}”: {why}", payload={"name": name, "path": _slug(name), "preset": True, "domain": plan["domain"], "business": business, "brand": brand}))
    if nav:
        links = ([p for p in have if p.lower() != "home"] + [n for n, _w in steps if not n.lower().startswith("admin") and n.lower() != "dashboard"])[:6]
        ops.append(AIOp(op="update_component", description="Link the navbar to the new pages: " + ", ".join(links), target_id=nav.get("id"), payload={"props": {"links": links, "brand": brand}}))

    lines = "\n".join(f"{i + 1}. {n}: {w}" for i, (n, w) in enumerate(steps))
    message = f"Here is my plan for a {plan['domain']} site called “{brand}”. I'll build these pages, fill them with content that suits your business, and link them in the navbar:\n\n{lines}\n\nApply the changes to build it, or Reject to change your mind."
    return _reply(message, ops, preview=True)


# ───────────────────────── copywriting and translation ─────────────────────────
async def rewrite(req: AICommandRequest, low: str) -> AICommandResponse:
    tone = copywriting.find_tone(low)
    if not tone:
        return _reply("What tone should I use? For example friendly, formal, premium, playful, professional or shorter.")
    tree = _tree(req)
    only_hero = re.search(r"\b(hero|headline|heading|title)\b", low) and not re.search(SITE_WORDS + r"|\bpage\b", low)
    nodes = [n for n in tree if n.get("type") == "hero"] if only_hero else [n for n in tree if n.get("type") not in ("navbar", "footer")]
    for key, (type_, _v) in {"testimonial": ("testimonials", ""), "faq": ("faq", ""), "features": ("features", ""), "pricing": ("pricing", ""), "team": ("team", ""), "footer": ("footer", "")}.items():
        if re.search(rf"\b{key}", low):
            nodes = [n for n in tree if n.get("type") == type_]
            break
    if not nodes:
        return _reply("I couldn't find that section on the page.")
    instruction = f"Rewrite each text in a {tone} tone. Keep the meaning, keep it about the same length (shorter if the tone is shorter or concise)."
    ops, changed, err = await copywriting.transform(nodes, instruction)
    if err:
        return _reply(err)
    return _reply(f"Rewrote {changed} texts in a {tone} tone. Undo if you prefer the old wording.", ops)


async def translate(req: AICommandRequest, low: str) -> AICommandResponse:
    lang = next((v for k, v in copywriting.LANGUAGES.items() if re.search(rf"\b{k}\b", low)), None)
    if not lang:
        return _reply("Which language should I translate to? For example Hindi, Malayalam, Tamil, Spanish or French.")
    site = re.search(SITE_WORDS, low) and req.all_pages
    groups = [(p.get("id"), p.get("name"), p.get("tree") or []) for p in req.all_pages] if site else [(None, None, _tree(req))]
    ops: list[AIOp] = []
    total = 0
    for page_id, _name, tree in groups:
        page_ops, changed, err = await copywriting.transform(tree, f"Translate every text into {lang}. Keep brand names, numbers and prices unchanged.")
        if err and not page_ops and not site:
            return _reply(err)
        for op in page_ops:
            if page_id:
                op.payload["page_id"] = page_id
        ops += page_ops
        total += changed
    if not ops:
        return _reply(f"I couldn't translate to {lang} right now. The AI model may be busy, or too small for this language. A hosted model gives much better translations.")
    where = f"{len(groups)} pages" if site else "this page"
    return _reply(f"Translated {total} texts on {where} into {lang}. Names and prices are unchanged. Please have a native speaker check the wording, then Undo if it isn't right.", ops)


# ───────────────────────── images ─────────────────────────
async def images(req: AICommandRequest, low: str) -> AICommandResponse:
    tree = _tree(req)
    subject = ""
    m = re.search(r"\b(?:for|of|about|showing|with)\s+(?:a|an|the|my|our)?\s*(.+?)(?:\s+(?:hero|section|page|site|website)\b.*)?$", low)
    if m:
        subject = m.group(1).strip()
    if not subject or subject in ("hero", "all products", "products"):
        nav = next((n for n in tree if n.get("type") == "navbar"), None)
        subject = str(((nav or {}).get("props") or {}).get("brand", "")) or "website"
    ops: list[AIOp] = []
    products = re.search(r"\b(products?|items?|placeholders?|catalog|menu)\b", low)
    if products:
        for node in tree:
            props = node.get("props") or {}
            if node.get("type") == "shop" and props.get("products"):
                items = [dict(p, image=imagegen.generate(f"{p.get('name', '')} {p.get('category', '')} {subject}", 800, 800)) for p in props["products"]]
                ops.append(AIOp(op="update_component", description=f"Generate images for {len(items)} products", target_id=node["id"], payload={"props": {"products": items}}))
            elif node.get("type") == "catalog" and props.get("items"):
                items = [dict(p, image=imagegen.generate(f"{p.get('name', '')} {subject}", 800, 800)) for p in props["items"]]
                ops.append(AIOp(op="update_component", description=f"Generate images for {len(items)} items", target_id=node["id"], payload={"props": {"items": items}}))
    else:
        hero = next((n for n in tree if n.get("type") == "hero"), None)
        if not hero:
            return _reply("There is no hero section on this page to put an image in. Add a hero first, or ask me for product images.")
        payload: dict = {"props": {"visualImage": imagegen.generate(subject)}}
        if hero.get("variant") not in ("split",):
            payload["variant"] = "split"
        ops.append(AIOp(op="update_component", description=f"Generate a hero image for “{subject}”", target_id=hero["id"], payload=payload))
    if not ops:
        return _reply("I didn't find products or catalog items to add images to on this page.")
    return _reply("Generated original artwork that matches your subject. It is a designed placeholder, not a photo. Upload a photo from the Inspector any time to replace it.", ops)


# ───────────────────────── critique ─────────────────────────
async def critique_page(req: AICommandRequest) -> AICommandResponse:
    findings, fixes = critique.review(_tree(req), req.theme.model_dump() if req.theme else None)
    hero = next((n for n in _tree(req) if n.get("type") == "hero"), None)
    if hero and hero.get("variant") == "split" and not ((hero.get("props") or {}).get("visualImage")):
        nav = next((n for n in _tree(req) if n.get("type") == "navbar"), None)
        subject = str(((nav or {}).get("props") or {}).get("brand", "")) or "website"
        fixes.append(AIOp(op="update_component", description="Generate a hero image", target_id=hero["id"], payload={"props": {"visualImage": imagegen.generate(subject)}}))
    report = critique.format_report(findings)
    if fixes:
        return _reply(f"Design review of this page:\n\n{report}\n\nI can fix {len(fixes)} of these. Apply the ones you agree with.", fixes, preview=True)
    return _reply(f"Design review of this page:\n\n{report}")


# ───────────────────────── import ─────────────────────────
async def import_site(req: AICommandRequest, url: str) -> AICommandResponse:
    try:
        title, tree = await importer.import_url(url)
    except ValueError as exc:
        return _reply(str(exc))
    except Exception:  # noqa: BLE001
        return _reply("I couldn't open that website. It may block automated visits or be down. Try a different page, or send a screenshot instead.")
    name = re.sub(r"[^A-Za-z0-9 &'-]", "", title).strip()[:28] or "Imported"
    kinds = ", ".join(n["type"] for n in tree)
    op = AIOp(op="create_page", description=f"Create the page “{name}” from {url}", payload={"name": name, "path": _slug(name), "tree": tree})
    return _reply(f"I rebuilt the structure of that page as “{name}” using your components: {kinds}. Text is copied as found, and images are linked. Only use content you have the right to reuse. Apply to add it as a new page.", [op], preview=True)



# ───────────────────────── keep sections consistent across pages ─────────────────────────
async def match_section(req: AICommandRequest, low: str) -> AICommandResponse | None:
    """“Make the navbar same as the shop page”: copy that page's navbar (or footer) onto this one."""
    kind = "footer" if re.search(r"\bfooter\b", low) else "navbar" if re.search(r"\b(navbar|nav bar|nav|header|menu)\b", low) else None
    if not kind or not re.search(r"\b(same|match|matching|copy|sync|identical|consistent|like)\b", low):
        return None
    mine = next((n for n in _tree(req) if n.get("type") == kind), None)
    if not mine:
        return _reply(f"This page has no {kind} yet, so there is nothing to match. Add one first.")
    others = [p for p in req.all_pages if p.get("name")]
    named = next((p for p in sorted(others, key=lambda p: -len(p["name"])) if re.search(rf"\b{re.escape(p['name'].lower())}\b", low)), None)
    if not named:
        names = ", ".join(p["name"] for p in others if p.get("name")) or ", ".join(req.pages)
        return _reply(f"Which page's {kind} should I copy? Your pages are: {names}.")
    source = next((n for n in (named.get("tree") or []) if n.get("type") == kind), None)
    if not source:
        return _reply(f"The {named['name']} page has no {kind} to copy.")
    same = (source.get("props") or {}) == (mine.get("props") or {}) and source.get("variant") == mine.get("variant")
    if same:
        return _reply(f"This page's {kind} is already identical to the one on {named['name']}.")
    payload = {"props": source.get("props") or {}, "variant": source.get("variant")}
    op = AIOp(op="update_component", description=f"Copy the {kind} from the {named['name']} page (same links, buttons and style)", target_id=mine.get("id"), payload=payload)
    return _reply(f"Made this page's {kind} the same as on the {named['name']} page: same links, buttons and style.", [op])

# ───────────────────────── dispatcher ─────────────────────────
async def handle(req: AICommandRequest) -> AICommandResponse | None:
    text = req.prompt.strip()
    low = text.lower()
    url = URL.search(text)
    same = await match_section(req, low)
    if same is not None:
        return same
    if url and re.search(r"\b(import|copy|clone|rebuild|recreate|replicate|like|based on|inspired|from|reference|same as)\b", low):
        return await import_site(req, url.group(0).rstrip(".,)"))
    if re.search(r"\b(build|create|make|generate|design|set ?up)\b", low) and re.search(r"\b(web ?site|site|online store|store|shop|app)\b", low) and not re.search(r"\b(page|section|navbar|nav|button|icon|image|picture|photo|link|footer|hero|banner)\b", low):
        return await plan_site(req, text)
    if re.search(r"\btranslat\w*\b|\b(in|into|to)\s+(" + "|".join(copywriting.LANGUAGES) + r")\b", low):
        return await translate(req, low)
    tone_word = copywriting.find_tone(low) is not None
    about_copy = re.search(r"\b(copy|text|wording|hero|headline|heading|title|description|content|page|section|site|website|faq|testimonials?|features|pricing|team|footer|sound)\b", low)
    if tone_word and about_copy and re.search(r"\b(rewrite|reword|rephrase|make|change|sound|tone|write|turn)\b", low) and not re.search(r"\b(navbar|nav|button|icon|colou?r|theme|glass|background|font|dark|light mode)\b", low):
        return await rewrite(req, low)
    if re.search(r"\b(generate|create|make|add|design|draw)\b.*\b(image|images|picture|pictures|photo|photos|illustration|artwork)\b", low) or re.search(r"\bplaceholder (image|picture)s?\b", low):
        return await images(req, low)
    if re.search(r"\b(review|critique|audit|check|analy[sz]e|evaluate|improve)\b.*\b(design|page|layout|site|website|spacing|contrast|mobile|accessibility|ux|ui)\b", low):
        return await critique_page(req)
    return None
