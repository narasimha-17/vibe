"""The builder assistant's skills.

A request like "add a cart button to the navbar" is not a job for a language model guessing at JSON. The assistant
reads the request, looks at what is on the page, and picks a skill that knows how to do it. Each skill returns a
plain-English message and the exact edits to make. Requests no skill understands go to the model.

The assistant asks when a request is ambiguous instead of guessing.
"""

import re
from typing import Any

from app.schemas.schemas import AIOp

# words people use -> (component type, default variant)
SECTION_WORDS: dict[str, tuple[str, str]] = {
    "hero": ("hero", "centered"), "banner": ("hero", "centered"), "pricing": ("pricing", "toggle"), "plans": ("pricing", "toggle"),
    "testimonial": ("testimonials", "wall"), "testimonials": ("testimonials", "wall"), "reviews": ("testimonials", "wall"),
    "faq": ("faq", "twocol"), "questions": ("faq", "twocol"), "team": ("team", "photo"), "feature": ("features", "bento"),
    "features": ("features", "bento"), "cards": ("cards", "gradient"), "stats": ("stats", "big"), "numbers": ("stats", "big"),
    "cta": ("cta", "card"), "call to action": ("cta", "card"), "contact": ("forms", "split"), "form": ("forms", "split"),
    "contact form": ("forms", "split"), "booking": ("forms", "booking"), "newsletter": ("forms", "subscription"),
    "catalog": ("catalog", "showcase"), "menu": ("catalog", "menu"), "products": ("catalog", "showcase"), "gallery": ("catalog", "tiles"),
    "timeline": ("timeline", "alternating"), "chatbot": ("chatbot", "widget"), "chat": ("chatbot", "widget"), "socials": ("socials", "cards"),
    "social": ("socials", "cards"), "logos": ("icons", "default"), "footer": ("footer", "default"), "navbar": ("navbar", "default"),
}
LABELS = {"forms": "contact form", "testimonials": "testimonials", "cta": "call to action"}
UNIQUE = ("navbar", "footer")


def _find(tree: list[dict], type_: str) -> dict | None:
    return next((n for n in tree if n.get("type") == type_), None)


def _op(op: str, description: str, target: str | None = None, **payload: Any) -> AIOp:
    return AIOp(op=op, description=description, target_id=target, payload=payload)


def _title(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip(" .,!?\"'")).title()



NAV_PAGES = {"my orders": "My orders", "orders": "My orders", "order history": "My orders", "checkout": "Checkout", "offers": "Offers", "track order": "Track order", "tracking": "Track order", "shop": "Shop", "login": "Login"}


def _navbar_items(low: str, navbar: dict, page_names: list[str]) -> tuple[str, list[AIOp]] | None:
    """"change the navbar accordingly, like adding cart and my orders": one edit that adds every item asked for."""
    m = re.search(r"\b(?:like|such as|including|include|with|adding|add|containing|having|to have)\b(.+)$", low)
    if not m:
        return None
    props: dict[str, Any] = {}
    added: list[str] = []
    links = list((navbar.get("props") or {}).get("links", []) or [])
    new_pages: list[str] = []
    for raw in re.split(r",|&|\band\b|\+", m.group(1)):
        item = re.sub(r"\b(the|a|an|button|buttons|icon|icons|link|links|item|items|adding|add|also|some|option|options|tab|tabs)\b", " ", raw).strip(" .")
        item = re.sub(r"\s+", " ", item)
        if not item:
            continue
        if item == "cart" and not (navbar.get("props") or {}).get("showCart"):
            props["showCart"] = True; added.append("a cart button")
        elif item == "search":
            props["showSearch"] = True; added.append("a search button")
        elif item in ("profile", "account", "user"):
            props["showProfile"] = True; added.append("a profile icon")
        elif item in ("wishlist", "favourites", "favorites"):
            props["showWishlist"] = True; added.append("a wishlist icon")
        elif item in ("login", "sign in", "log in"):
            props["loginLabel"] = "Login"; added.append("a login button")
        elif item in NAV_PAGES or item in [p.lower() for p in page_names]:
            name = NAV_PAGES.get(item) or next(p for p in page_names if p.lower() == item)
            if name.lower() not in [x.lower() for x in links]:
                links.append(name); added.append(f"a “{name}” link")
                if name.lower() not in [p.lower() for p in page_names]:
                    new_pages.append(name)
    if not added:
        return None
    if links != list((navbar.get("props") or {}).get("links", []) or []):
        props["links"] = links
    ops = [_op("update_component", "Update the navbar: add " + ", ".join(added), navbar["id"], props=props)]
    for name in new_pages:
        ops.append(_op("create_page", f"Create the “{name}” page so the new link has somewhere to go", None, name=name, path="/" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), preset=True))
    extra = f" I also created the {', '.join(new_pages)} page{'s' if len(new_pages) > 1 else ''} for the new link{'s' if len(new_pages) > 1 else ''}." if new_pages else ""
    return "Updated the navbar: added " + ", ".join(added) + "." + extra, ops


def plan(prompt: str, tree: list[dict], pages: list[str]) -> tuple[str, list[AIOp]] | None:
    """(message, edits) for a request a skill understands, or None to let the model handle it."""
    text = prompt.strip()
    low = text.lower()
    navbar = _find(tree, "navbar")
    page_names = [p for p in pages if p]

    # ── the shop's own cart button: "remove cart button from the shop section and map it to the cart icon" ──
    if re.search(r"\b(remove|hide|delete|take out|get rid of)\b.*\bcart\b.*\b(from|in|on|of)\b.*\b(shop|products?|store)\b", low):
        shop = _find(tree, "shop")
        if not shop:
            return "There is no shop on this page, so there is no shop cart button to remove.", []
        ops = [_op("update_component", "Remove the cart button from the shop section", shop["id"], props={"hideCart": True})]
        message = "Removed the cart button from the shop section."
        if navbar and not (navbar.get("props") or {}).get("showCart") and re.search(r"\b(map|move|navbar|nav|icon|instead|replace|use)\b", low):
            ops.append(_op("update_component", "Add a cart icon to the navbar. It opens the shop's cart", navbar["id"], props={"showCart": True}))
            message += " The navbar now has a cart icon that opens the same cart."
        return message, ops

    # ── navbar icons and where they go: "add profile icon to the right side of cart icon" ──
    m = re.search(r"\b(?:add|put|show|insert|create|place|move)\s+(?:a\s+|the\s+|an\s+)?(profile|account|user|wishlist|favou?rites?|search|cart)\s*(?:icon|button)\b(.*)$", low)
    if m and navbar and not re.search(r"\b(section|page)\b.*\b(shop|hero|footer)\b", m.group(2)):
        icon = {"account": "profile", "user": "profile", "favourite": "wishlist", "favourites": "wishlist", "favorite": "wishlist", "favorites": "wishlist"}.get(m.group(1), m.group(1))
        prop = {"profile": "showProfile", "wishlist": "showWishlist", "search": "showSearch", "cart": "showCart"}[icon]
        rest = m.group(2)
        order = list((navbar.get("props") or {}).get("navOrder") or ["search", "wishlist", "profile", "cart"])
        for k in ("search", "wishlist", "profile", "cart"):
            if k not in order:
                order.append(k)
        props: dict[str, Any] = {prop: True}
        ref = re.search(r"\b(right|left|after|before|next to|beside|besides|end|start)\b.*?\b(cart|search|profile|account|wishlist|favou?rites?)\b", rest)
        if ref:
            target = {"account": "profile", "favourites": "wishlist", "favorites": "wishlist", "favourite": "wishlist", "favorite": "wishlist"}.get(ref.group(2), ref.group(2))
            if target != icon:
                order.remove(icon)
                at = order.index(target)
                order.insert(at if ref.group(1) in ("left", "before") else at + 1, icon)
                props["navOrder"] = order
        label = {"profile": "profile icon", "wishlist": "wishlist icon", "search": "search button", "cart": "cart button"}[icon]
        if (navbar.get("props") or {}).get(prop) and "navOrder" not in props:
            return f"The navbar already has a {label}.", []
        where = f" {ref.group(1)} {ref.group(0).split()[-1]}" if ref and "navOrder" in props else ""
        return f"Added a {label} to the navbar{where}.", [_op("update_component", f"Add a {label} to the navbar{where}", navbar["id"], props=props)]

    # ── navbar icons and where they go: "add profile icon to the right side of cart icon" ──
    m = re.search(r"\b(?:add|put|show|insert|create|place|move)\s+(?:a\s+|the\s+|an\s+)?(profile|account|user|wishlist|favou?rites?|search|cart)\s*(?:icon|button)\b(.*)$", low)
    if m and navbar and not re.search(r"\b(section|page)\b.*\b(shop|hero|footer)\b", m.group(2)):
        icon = {"account": "profile", "user": "profile", "favourite": "wishlist", "favourites": "wishlist", "favorite": "wishlist", "favorites": "wishlist"}.get(m.group(1), m.group(1))
        prop = {"profile": "showProfile", "wishlist": "showWishlist", "search": "showSearch", "cart": "showCart"}[icon]
        rest = m.group(2)
        order = list((navbar.get("props") or {}).get("navOrder") or ["search", "wishlist", "profile", "cart"])
        for k in ("search", "wishlist", "profile", "cart"):
            if k not in order:
                order.append(k)
        props: dict[str, Any] = {prop: True}
        ref = re.search(r"\b(right|left|after|before|next to|beside|besides|end|start)\b.*?\b(cart|search|profile|account|wishlist|favou?rites?)\b", rest)
        if ref:
            target = {"account": "profile", "favourites": "wishlist", "favorites": "wishlist", "favourite": "wishlist", "favorite": "wishlist"}.get(ref.group(2), ref.group(2))
            if target != icon:
                order.remove(icon)
                at = order.index(target)
                order.insert(at if ref.group(1) in ("left", "before") else at + 1, icon)
                props["navOrder"] = order
        label = {"profile": "profile icon", "wishlist": "wishlist icon", "search": "search button", "cart": "cart button"}[icon]
        if (navbar.get("props") or {}).get(prop) and "navOrder" not in props:
            return f"The navbar already has a {label}.", []
        where = f" {ref.group(1)} {ref.group(0).split()[-1]}" if ref and "navOrder" in props else ""
        return f"Added a {label} to the navbar{where}.", [_op("update_component", f"Add a {label} to the navbar{where}", navbar["id"], props=props)]

    # ── navbar: cart, search ─────────────────────────────────────────────
    nav_word = r"(?:navbar|nav bar|navigation|nav|header|menu bar|top bar)"
    if navbar and re.search(rf"\b{nav_word}\b", low) and re.search(r"\b(change|update|modify|adjust|improve|customi[sz]e|edit|set up|fix|revamp)\b", low):
        multi = _navbar_items(low, navbar, page_names)
        if multi is not None:
            return multi
    for word, prop, label in (
        ("cart", "showCart", "cart button"),
        ("search", "showSearch", "search button"),
        ("(?:profile|account|user)", "showProfile", "profile icon"),
        ("(?:wishlist|favou?rites?)", "showWishlist", "wishlist icon"),
    ):
        if re.search(rf"\b(add|show|include|put|insert|enable|need|want|create|make|give)\b.*\b{word}\b.*\b(to|in|on|into|at)\b.*\b{nav_word}\b", low) or re.search(rf"\b{nav_word}\b.*\b(with|having)\b.*\b{word}\b", low):
            if not navbar:
                return "There is no navbar on this page yet. Say “add a navbar section” first and I'll add the button after.", []
            if (navbar.get("props") or {}).get(prop):
                return f"The navbar already has a {label}.", []
            return f"Added a {label} to the navbar.", [_op("update_component", f"Add a {label} to the navbar", navbar["id"], props={prop: True})]
        link_names = [x.lower() for x in ((navbar or {}).get("props") or {}).get("links", []) or []]
        if re.search(rf"\b(remove|hide|delete|disable|take out)\b.*\b{word}\b.*\b{nav_word}\b", low) and navbar and not any(re.fullmatch(word, x) for x in link_names):
            return f"Removed the {label} from the navbar.", [_op("update_component", f"Remove the {label} from the navbar", navbar["id"], props={prop: False})]

    # ── navbar: links ────────────────────────────────────────────────────
    if navbar and re.search(rf"\b{nav_word}\b", low) and re.search(r"\b(according to|match|sync|link all|all pages|every page|based on)\b", low) and page_names:
        links = [p for p in page_names if p.lower() not in ("home",)]
        links = ["Home"] + links if any(p.lower() == "home" for p in page_names) else links
        return "Updated the navbar so it links to every page.", [_op("update_component", "Set the navbar links to: " + ", ".join(links[:8]), navbar["id"], props={"links": links[:8]})]
    m = re.search(rf"\b(?:add|include|insert)\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+(?:link|item|tab|menu item|page link)\s+(?:to|in|on)\s+(?:the\s+)?{nav_word}\b", low)
    if m and navbar:
        name = _title(m.group(1))
        links = list((navbar.get("props") or {}).get("links", []) or [])
        if name.lower() in [x.lower() for x in links]:
            return f"“{name}” is already in the navbar.", []
        return f"Added “{name}” to the navbar.", [_op("update_component", f"Add “{name}” to the navbar links", navbar["id"], props={"links": links + [name]})]
    if navbar and re.search(rf"\b{nav_word}\b", low) and re.search(r"\b(remove|delete|drop|hide|take out|get rid of)\b", low):
        links = list((navbar.get("props") or {}).get("links", []) or [])
        # whichever links the sentence names, in any word order: "remove Pricing button from navbar", "Pricing remove this button"
        named = [x for x in links if re.search(rf"(?<!\w){re.escape(x.lower())}(?!\w)", low)]
        if named:
            keep = [x for x in links if x not in named]
            label = ", ".join(f"“{x}”" for x in named)
            props: dict[str, Any] = {"links": keep}
            for word, prop in (("cart", "showCart"), ("search", "showSearch")):
                if re.search(rf"\b{word}\b", low) and (navbar.get("props") or {}).get(prop):
                    props[prop] = False  # the same word also names a button; take that off as well
            return f"Removed {label} from the navbar.", [_op("update_component", f"Remove {label} from the navbar", navbar["id"], props=props)]
        return f"I couldn't tell which navbar item you mean. The navbar has: {', '.join(links)}. Which one should I remove?", []

    # ── a custom navbar button: "add discount button to navbar" ──
    m = re.search(r"\b(?:add|put|insert|create|show|make|give)\s+(?:a\s+|an\s+|the\s+|new\s+)?(?:\"|')?([a-z0-9&' -]{2,24}?)(?:\"|')?\s+(?:button|cta|pill)\b.*\b" + nav_word + r"\b", low)
    if m and navbar:
        label = _title(m.group(1))
        known = {"cart", "search", "login", "log in", "sign in", "profile", "account", "user", "wishlist", "get started", "call to action", "main", "custom", "another", "new"}
        if label.lower() not in known:
            offer_like = re.search(r"discount|offer|deal|sale|coupon|promo", label.lower())
            props = {"extraButton": label}
            ops = [_op("update_component", f"Add a “{label}” button to the navbar", navbar["id"], props=props)]
            message = f"Added a “{label}” button to the navbar."
            if offer_like and "offers" not in [p.lower() for p in page_names]:
                ops.append(_op("create_page", "Create the “Offers” page, so the button has somewhere to go", None, name="Offers", path="/offers", preset=True))
                message += " I also created an Offers page for it, with coupon codes you can edit."
            return message, ops

    # ambiguous: a button for the navbar, but which?
    if re.search(rf"\b(add|put|insert)\b.*\bbutton\b.*\b{nav_word}\b", low):
        return "Which button should I add to the navbar: a cart, a search, a login, or a custom call to action (tell me its label)?", []

    # ── replace the navbar's main button: "Get Started replace this button with cart button" ──
    m = re.search(r"\b(?:replace|change|swap|switch|turn|make)\b(.+?)\b(?:with|to|into|as|by)\b\s*(?:a\s+|an\s+|the\s+)?(.+)$", low)
    if m and navbar:
        props = navbar.get("props") or {}
        cta_now = str(props.get("ctaLabel") or props.get("cta") or "Get Started").lower()
        old = re.sub(r"\b(this|the|that|a|button|link)\b", " ", m.group(1)).strip()
        old = re.sub(r"\s+", " ", old)
        new = re.sub(r"\b(a|an|the|button|icon|link)\b", " ", m.group(2)).strip()
        new = re.sub(r"\s+", " ", new)
        if new and (old in ("", "cta", "main", "main button", "action") or old == cta_now or old in ("get started", "start", "sign up")):
            if new == "cart":
                return "Replaced the “" + cta_now.title() + "” button with a cart button.", [_op("update_component", f"Replace the “{cta_now.title()}” button with a cart button", navbar["id"], props={"showCart": True, "hideCta": True})]
            if new == "search":
                return "Replaced the main button with a search button.", [_op("update_component", "Replace the main navbar button with a search button", navbar["id"], props={"showSearch": True, "hideCta": True})]
            if new in ("profile", "account"):
                return "Replaced the main button with a profile icon.", [_op("update_component", "Replace the main navbar button with a profile icon", navbar["id"], props={"showProfile": True, "hideCta": True})]
            label = _title(new)
            return f"Changed the main button to “{label}”.", [_op("update_component", f"Set the navbar button text to “{label}”", navbar["id"], props={"ctaLabel": label, "cta": label, "hideCta": False})]

    # ── rename a navbar link: "change the Features button to Category" ─────
    m = re.search(r"\b(?:change|rename|replace|switch|turn|make)\s+(?:the\s+)?[\"']?(.+?)[\"']?\s*(?:button|link|tab|item|menu item)?\s+(?:to|into|with|as)\s+(?:the\s+)?[\"']?(.+?)[\"']?\s*(?:button|link|tab|item)?\s*(?:in\s+.*)?$", low)
    if m and navbar:
        old, new = m.group(1).strip(), _title(m.group(2))
        links = list((navbar.get("props") or {}).get("links", []) or [])
        hit = next((i for i, x in enumerate(links) if x.lower() == old), None)
        if hit is not None and new:
            renamed = links[:hit] + [new] + links[hit + 1:]
            return f"Renamed the “{links[hit]}” link to “{new}”.", [_op("update_component", f"Rename the navbar link “{links[hit]}” to “{new}”", navbar["id"], props={"links": renamed})]

    # ── edit text ────────────────────────────────────────────────────────
    m = re.search(r"\b(?:change|set|rename|update|make)\s+(?:the\s+)?(brand(?: name)?|logo(?: text)?|site name|headline|heading|title|subheadline|subheading|subtitle|button(?: text| label)?|cta)\s+(?:to|as|into|say|says)\s+(.+)$", text, re.I)
    if m:
        what, value = m.group(1).lower(), m.group(2).strip(" .\"'")
        if re.match(r"brand|logo|site name", what):
            for node in tree:
                if node.get("type") in ("navbar", "footer"):
                    pass
            targets = [n for n in tree if n.get("type") in ("navbar", "footer")]
            if targets:
                return f"Renamed the brand to “{value}”.", [_op("update_component", f"Set the brand to “{value}” in the {n['type']}", n["id"], props={"brand": value}) for n in targets]
        hero = _find(tree, "hero")
        if hero:
            key = "headline" if re.match(r"headline|heading|title", what) else "subheadline" if re.match(r"sub", what) else "primaryCta"
            return f"Changed the {what} to “{value}”.", [_op("update_component", f"Set the hero {what} to “{value}”", hero["id"], props={key: value})]

    # ── create a page ────────────────────────────────────────────────────
    m = re.match(r"^(?:please\s+)?(?:can you\s+)?(?:create|add|make|build|generate)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+|new\s+)*([a-z0-9&' -]+?)\s+page\s*[.!]?$", low)
    if m and not re.search(r"\b(in|on|to|of|for|from|with|navbar|nav|header|footer|icon|button|link|section|component)\b", m.group(1)):
        name = _title(m.group(1))
        if name and len(name.split()) <= 4 and name.lower() not in ("new", "blank"):
            if name.lower() in [p.lower() for p in page_names]:
                return f"There is already a “{name}” page.", []
            return f"Created the “{name}” page with ready-made sections.", [_op("create_page", f"Create the “{name}” page, filled with sections that suit it", None, name=name, path="/" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"), preset=True)]

    # ── add a section ────────────────────────────────────────────────────
    m = re.search(r"\b(?:add|insert|include|put|create|need|want)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(.+?)(?:\s+(?:section|block|component|area))?(?:\s+(?:to|on|in|at)\s+.*)?$", low)
    if m:
        wanted = m.group(1).strip()
        for key in sorted(SECTION_WORDS, key=len, reverse=True):
            if re.fullmatch(rf"(?:\w+\s+)?{re.escape(key)}s?", wanted) or wanted == key:
                type_, variant = SECTION_WORDS[key]
                if type_ in UNIQUE and _find(tree, type_):
                    return f"The page already has a {type_}. Tell me what to change on it, for example “add a cart button to the navbar”.", []
                label = LABELS.get(type_, type_)
                return f"Added a {label} section to the page.", [_op("add_component", f"Add a {label} section", None, type=type_, variant=variant)]

    # ── remove a section ─────────────────────────────────────────────────
    m = re.search(r"\b(?:remove|delete|drop|get rid of|take out)\s+(?:the\s+|this\s+)?(.+?)(?:\s+(?:section|block|component))?(?:\s+(?:from|on)\s+.*)?$", low)
    if m and not re.search(rf"\b{nav_word}\b.*\b(link|item)\b", low):
        wanted = m.group(1).strip()
        for key, (type_, _v) in sorted(SECTION_WORDS.items(), key=lambda kv: -len(kv[0])):
            if wanted == key or wanted == key + "s":
                node = _find(tree, type_)
                if node:
                    return f"Removed the {type_} section.", [_op("delete_component", f"Remove the {node.get('name', type_)} section", node["id"])]
                return f"There is no {type_} section on this page.", []
    return None
