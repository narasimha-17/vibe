"""Turns interview memory into: what was understood, recommendations, an acceptance checklist and project docs.

Everything here is rule-based on purpose (predictable, testable, no model needed). The Strands analyst agent may add
a few extra suggestions on top (see agent.analyst_suggestions).
"""

import re
from typing import Any

from app.intake.topics import INTEGRATIONS, TOPICS, is_filled

# ─────────────── feature and integration knowledge ───────────────
# (keywords, label, VIBE components, supported, note)
FEATURES: list[tuple[tuple[str, ...], str, list[str], bool, str]] = [
    (("payment", "checkout", "cart", "buy online", "sell online", "online order", "e-commerce", "ecommerce", "online store", "sell products", "sell cakes"), "Online shop with cart and Razorpay checkout", ["shop"], True, "Built in. Generates a FastAPI backend with orders, stock and Razorpay."),
    (("track", "order status", "shipment", "delivery status"), "Order tracking", ["tracking"], True, "Built in. Customers look up an order by number and email."),
    (("review", "rating", "feedback"), "Reviews and ratings", ["shop", "testimonials"], True, "Product reviews are built into the shop; testimonials work on any site."),
    (("login", "log in", "sign in", "sign up", "register", "account", "profile", "user account", "password"), "Accounts: sign in, register, password reset, profile", ["auth"], True, "Built in with a FastAPI backend."),
    (("booking", "appointment", "reservation", "schedule"), "Booking form", ["forms"], True, "Built in. Submissions are stored by the backend."),
    (("contact form", "enquiry", "inquiry", "lead", "contact us"), "Contact / enquiry form", ["forms"], True, "Built in."),
    (("newsletter", "subscribe", "mailing list", "email list"), "Newsletter signup", ["forms"], True, "Built in. Emails are stored; sending campaigns needs an email tool."),
    (("chatbot", "chat bot", "live chat", "assistant"), "Chatbot", ["chatbot"], True, "Built in. Answers from a list you edit, site-wide."),
    (("blog", "article", "news", "journal", "content"), "Blog / articles", ["catalog", "forms"], True, "Post listings are supported. Full article pages are written by hand."),
    (("faq", "questions"), "FAQ", ["faq"], True, "Built in."),
    (("team", "doctor", "staff", "mentor"), "Team / people", ["team"], True, "Built in."),
    (("gallery", "portfolio", "case stud", "work"), "Gallery / portfolio", ["cards", "testimonials"], True, "Built in."),
    (("pricing", "plans", "membership", "subscription plan"), "Pricing plans", ["pricing"], True, "Built in. Recurring billing is not."),
    (("search", "filter", "sort"), "Search and filters", ["shop"], True, "Built into the shop."),
    (("video", "reel"), "Video hero", ["hero"], True, "Upload an MP4 or WebM to the hero."),
    (("map", "location", "directions", "store locator"), "Map / location", [], False, "Not built yet. Add a Google Maps embed by hand."),
    (("admin", "dashboard", "cms", "manage products", "manage content"), "Admin dashboard", [], False, "Admin API endpoints are generated, but there is no admin screen yet."),
    (("multi-language", "multilingual", "translation", "hindi", "malayalam", "language switch"), "Multiple languages", [], False, "Not built yet."),
    (("email notification", "confirmation email", "order email", "send email"), "Automatic emails", [], False, "Not built in. You would connect an email provider."),
    (("recurring", "subscription billing", "auto-renew"), "Recurring billing", [], False, "Razorpay supports it, but VIBE does not generate it yet."),
    (("inventory", "warehouse", "stock management"), "Inventory management screens", [], False, "Stock is tracked by the API. There is no management screen yet."),
    (("coupon", "discount code", "promo"), "Discount codes", [], False, "Not built yet."),
]

# name -> (supported, how it is handled)
INTEGRATION_NOTES: dict[str, tuple[bool, str]] = {
    "Razorpay": (True, "Built in: order creation, signature check, webhook. Runs in mock mode until you add your keys."),
    "WhatsApp": (True, "Contact links and a WhatsApp-style chat are built in. The WhatsApp Business API is not."),
    "Instagram": (True, "Social links and a follow banner are built in."),
    "Facebook": (True, "Social links are built in."),
    "YouTube": (True, "Social links are built in."),
    "LinkedIn": (True, "Social links are built in."),
    "Stripe": (False, "VIBE generates Razorpay, not Stripe. Use Razorpay for India or add Stripe by hand."),
    "PayPal": (False, "Not built in. Add by hand."),
    "Google Analytics": (False, "Not built in. Paste the Google tag into the exported layout."),
    "Google Maps": (False, "Not built in. Add an embed on the Contact page."),
    "Mailchimp": (False, "Not built in. Newsletter emails are stored in the database so you can import them."),
    "Zapier": (False, "Not built in. Use the API endpoints from Zapier webhooks."),
    "Slack": (False, "Not built in. Add a webhook call in the backend."),
    "Calendly": (False, "Not built in. Use the booking form, or embed Calendly on the page."),
    "Twilio SMS": (False, "Not built in. Add in the backend when orders change status."),
    "Shiprocket": (False, "Not built in. Order status is updated by an admin through the API."),
    "Google Sheets": (False, "Not built in."),
    "Email provider": (False, "Not built in. Plug your provider into the backend's email hook."),
}

# (keywords, template key, style preset)
TEMPLATE_RULES: list[tuple[tuple[str, ...], str, str]] = [
    (("marketplace", "electronics", "gadget"), "ecom-market", "bento-modern"),
    (("ecommerce", "e-commerce", "online store", "sell online", "shop", "store", "products", "boutique", "sell cakes"), "ecom-atelier", "ecommerce-premium"),
    (("wellness", "yoga", "spa", "meditation", "fitness"), "health-wellness", "organic-nature"),
    (("clinic", "hospital", "doctor", "health", "dental", "medical", "patient"), "health-clinic", "fintech"),
    (("bootcamp", "coding", "developer training"), "edu-bootcamp", "neo-brutalist"),
    (("course", "school", "academy", "education", "coaching", "student", "tutor", "learn"), "edu-academy", "material-you"),
    (("courier", "same-day", "parcel", "last mile"), "logi-courier", "soft-ui"),
    (("logistics", "freight", "cargo", "supply chain", "transport", "shipping company", "warehouse"), "logi-freight", "futuristic-enterprise"),
    (("travel", "tour", "trip", "holiday", "hotel", "destination"), "travel-wanderly", "creative-portfolio"),
    (("agency", "consult", "studio", "creative"), "travel-agency", "startup-saas"),
    (("blog", "magazine", "journal", "writer", "newsletter", "publication"), "blog-journal", "editorial-magazine"),
    (("restaurant", "cafe", "café", "bakery", "food", "menu", "catering"), "restaurant", "luxury-premium"),
    (("portfolio", "designer", "photographer", "freelance", "artist"), "portfolio", "minimal-modern"),
    (("saas", "software", "app", "platform", "startup", "tool", "dashboard"), "saas", "startup-saas"),
]
STYLE_WORDS: list[tuple[tuple[str, ...], str]] = [
    (("minimal", "clean", "simple"), "minimal-modern"), (("luxury", "premium", "elegant"), "luxury-premium"),
    (("playful", "colourful", "colorful", "fun"), "soft-ui"), (("bold", "loud", "brutal"), "neo-brutalist"),
    (("dark", "futuristic", "tech"), "dark-ai"), (("editorial", "magazine"), "editorial-magazine"),
    (("natural", "organic", "earthy"), "organic-nature"), (("corporate", "professional", "formal"), "corporate-professional"),
]


def _text(memory: dict) -> str:
    parts: list[str] = []
    for k, v in memory.items():
        if k.startswith("_"):
            continue
        if isinstance(v, dict):
            parts += [str(x) for x in v.get("names", [])]
        elif isinstance(v, list):
            parts += [str(x) for x in v]
        else:
            parts.append(str(v))
    return " ".join(parts).lower()


def _has(low: str, words: tuple[str, ...]) -> bool:
    return any(w in low for w in words)


def _list(memory: dict, key: str) -> list[str]:
    v = memory.get(key)
    return [str(x) for x in v] if isinstance(v, list) else ([str(v)] if v else [])


def recommend_template(memory: dict) -> dict:
    low = _text(memory)
    business = str(memory.get("business", "")).lower() + " " + " ".join(_list(memory, "features")).lower()
    template, style = "saas", "startup-saas"
    for words, key, st in TEMPLATE_RULES:
        if _has(business, words) or _has(low, words):
            template, style = key, st
            break
    for words, st in STYLE_WORDS:
        if _has(str(memory.get("style", "")).lower(), words):
            style = st
            break
    return {"template": template, "style": style}


def map_features(memory: dict) -> list[dict]:
    low = " ".join(_list(memory, "features")).lower() + " " + " ".join(_list(memory, "objectives")).lower() + " " + str(memory.get("business", "")).lower()
    seen, out = set(), []
    for words, label, components, supported, note in FEATURES:
        if _has(low, words) and label not in seen:
            seen.add(label)
            out.append({"feature": label, "components": components, "supported": supported, "note": note})
    return out


def map_integrations(memory: dict) -> list[dict]:
    out = []
    for name in _list(memory, "integrations"):
        supported, note = INTEGRATION_NOTES.get(name, (False, "Not built in. It would need custom work."))
        out.append({"name": name, "supported": supported, "note": note})
    return out


def planned_pages(memory: dict, features: list[dict]) -> dict:
    pages = memory.get("pages") if isinstance(memory.get("pages"), dict) else {"count": None, "names": []}
    names = list(pages.get("names", []))
    have = {n.lower() for n in names}
    implied = []
    comps = {c for f in features for c in f["components"]}

    def need(name: str, why: str) -> None:
        if name.lower() not in have and name.lower() not in {i["name"].lower() for i in implied}:
            implied.append({"name": name, "why": why})

    if "shop" in comps:
        need("Shop", "Your features include online selling.")
    if "tracking" in comps:
        need("Track order", "You want customers to follow their orders.")
    if "auth" in comps:
        need("Login", "You want accounts.")
    if any(f["feature"].startswith("Booking") for f in features):
        need("Book", "You want bookings.")
    if any("Blog" in f["feature"] for f in features):
        need("Blog", "You want a blog.")
    if "faq" in comps:
        need("FAQ", "You want an FAQ.")
    # Reason about how this kind of website works and add the pages it needs.
    from app.intake.blueprint import blueprint, covered

    plan = blueprint(memory)

    def existing() -> list[str]:
        return names + [i["name"] for i in implied]

    for name, why in plan["core"]:
        if not covered(name, existing()):
            implied.append({"name": name, "why": why})
    for name, why in plan["admin"]:
        if name.lower() not in {x.lower() for x in existing()}:  # admin pages are always separate from customer pages
            implied.append({"name": name, "why": why})
    if plan["domain"] == "restaurant":
        for i in implied:
            if i["name"] == "Shop":
                i["name"], i["why"] = "Order online", "Diners order for delivery or pickup."
    suggested = [{"name": n, "why": w} for n, w in plan["suggested"] if not covered(n, existing())]
    if names and not any(n in have for n in ("home", "homepage")):
        names = ["Home"] + names
    return {"requested_count": pages.get("count"), "names": names, "implied": implied, "suggested": suggested, "domain": plan["domain"], "cuisines": plan["cuisines"]}


def recommendations(memory: dict, features: list[dict], integrations: list[dict], pages: dict) -> list[dict]:
    low = _text(memory)
    recs: list[dict] = []

    def add(title: str, why: str, priority: str = "medium", page: str | None = None) -> None:
        recs.append({"title": title, "why": why, "priority": priority, "source": "rules", **({"page": page} if page else {})})

    for imp in pages["implied"]:
        add(f"Add a “{imp['name']}” page", imp["why"], "high", imp["name"])
    for sug in pages.get("suggested", []):
        add(f"Consider a “{sug['name']}” page", sug["why"], "medium", sug["name"])
    count, names = pages["requested_count"], pages["names"]
    if count and len(names) < count:
        add(f"You mentioned {count} pages but listed {len(names)}", "Name the remaining pages or I'll suggest some based on your goals.", "medium")
    for f in features:
        if not f["supported"]:
            add(f"“{f['feature']}” needs custom work", f["note"], "high")
    for i in integrations:
        if not i["supported"]:
            add(f"{i['name']} is not built in", i["note"], "medium")
    if _has(low, ("support", "calls", "questions", "phone")):
        add("Add a chatbot and an FAQ", "You mentioned repetitive questions. A site-wide chatbot and an FAQ page answer them without a phone call.", "high", "FAQ")
    if _has(low, ("trust", "credib", "professional", "outdated")):
        add("Add testimonials and a team section", "Real faces and words build credibility quickly.", "medium")
    if _has(low, ("lead", "enquir", "customers", "bookings", "appointments")) and not any("form" in f["feature"].lower() for f in features):
        add("Add a contact or booking form", "Your goal is to capture leads. A short form on every key page helps.", "high")
    if _has(low, ("online", "sell", "order")) and not any(f["feature"].startswith("Online shop") for f in features):
        add("Consider the online shop", "You want to sell or take orders. The shop includes filters, cart and Razorpay.", "medium")
    add("Check it on a phone first", "Most visitors will arrive on mobile. Review every page at 390px width.", "medium")
    add("Plan how you'll measure the outcome", "Add analytics so you can tell whether your success goal is met.", "low")
    if not recs:
        add("Your requirements look complete", "No gaps found. Review the acceptance checklist before you build.", "low")
    return recs


def acceptance(memory: dict, features: list[dict], integrations: list[dict], pages: dict) -> list[dict]:
    items: list[dict] = []

    def add(category: str, text: str) -> None:
        items.append({"id": f"c{len(items) + 1}", "category": category, "text": text, "done": False})

    all_pages = pages["names"] + [p["name"] for p in pages["implied"]]
    for n in all_pages:
        if n.lower() not in ("home", "homepage"):
            add("Pages", f"The “{n}” page exists, is linked from the navigation and has real content, not placeholder text.")
    if all_pages:
        add("Pages", f"The site has {len(set(x.lower() for x in all_pages))} pages" + (f" (you asked for {pages['requested_count']})." if pages["requested_count"] else "."))
    behaviour = {
        "Online shop with cart and Razorpay checkout": "A visitor can browse, filter, add to cart, pay in Razorpay test mode and receive an order number.",
        "Order tracking": "A customer can enter an order number and email and see the current status. A wrong email shows nothing.",
        "Reviews and ratings": "A visitor can leave a star rating and comment, and the average updates.",
        "Accounts: sign in, register, password reset, profile": "A visitor can register, sign in, reset a forgotten password and update their profile.",
        "Booking form": "A visitor can submit a booking and it is saved for you to see.",
        "Contact / enquiry form": "A visitor can send an enquiry, invalid emails are rejected and the message is saved.",
        "Newsletter signup": "A visitor can subscribe with their email and see a confirmation.",
        "Chatbot": "The chat button is on every page and answers the questions you listed.",
        "Search and filters": "Filters change the results instantly and can be cleared.",
    }
    for f in features:
        if f["supported"]:
            add("Features", behaviour.get(f["feature"], f"{f['feature']} works as described."))
        else:
            add("Features", f"{f['feature']}: agreed approach is documented and owned by someone ({f['note']}).")
    for i in integrations:
        add("Integrations", f"{i['name']}: " + ("works in test mode with your credentials." if i["supported"] else "the manual approach is agreed and the work is scheduled."))
    for p in _list(memory, "pain_points"):
        add("Pain points", f"Solved: “{p}”. You can show how the new site removes it.")
    if memory.get("outcome"):
        add("Outcome", f"You can measure your success goal: {memory['outcome']}.")
    for text in (
        "Every page looks right at 390px, 768px and 1100px wide.",
        "Every link and button goes somewhere or does something.",
        "Text has enough contrast (the accessibility check passes).",
        "The backend tests pass and the integration report shows no failures.",
        "Sensitive values (admin key, JWT secret, Razorpay keys) are set and not left as defaults.",
        "You have reviewed the site on your own phone and approved it.",
    ):
        add("Quality", text)
    return items


def understanding(memory: dict, features: list[dict], integrations: list[dict], pages: dict, rec: dict) -> list[dict]:
    def fmt(v: Any) -> str:
        if isinstance(v, dict):
            return f"{v.get('count') or len(v.get('names', []))} pages: " + ", ".join(v.get("names", []))
        if isinstance(v, list):
            return ", ".join(map(str, v)) or "None"
        return str(v)

    out = []
    for t in TOPICS:
        v = memory.get(t["key"])
        if is_filled(v):
            out.append({"key": t["key"], "label": t["label"], "value": fmt(v)})
    details = memory.get("details")
    if isinstance(details, list) and details:
        out.append({"key": "details", "label": "Details you gave", "value": "; ".join(map(str, details))})
    out.append({"key": "plan", "label": "What I'll build", "value": f"{rec['template']} template in the {rec['style']} style, {len(pages['names']) + len(pages['implied'])} pages."})
    return out


def analyse(memory: dict) -> dict:
    features = map_features(memory)
    integrations = map_integrations(memory)
    pages = planned_pages(memory, features)
    rec = recommend_template(memory)
    return {
        "understanding": understanding(memory, features, integrations, pages, rec),
        "features": features,
        "integrations": integrations,
        "pages": pages,
        "recommended": rec,
        "recommendations": recommendations(memory, features, integrations, pages),
        "acceptance": acceptance(memory, features, integrations, pages),
    }


# ───────────────────────── documentation ─────────────────────────
def requirements_md(name: str, memory: dict, analysis: dict) -> str:
    lines = [f"# {name}: requirements", "", "Captured by the VIBE project guide.", ""]
    for u in analysis["understanding"]:
        lines += [f"## {u['label']}", "", u["value"], ""]
    lines += ["## Features and how they are covered", ""]
    lines += [f"- **{f['feature']}** — {'built in' if f['supported'] else 'needs custom work'}. {f['note']}" for f in analysis["features"]] or ["- None specified"]
    lines += ["", "## Integrations", ""]
    lines += [f"- **{i['name']}** — {'built in' if i['supported'] else 'manual'}. {i['note']}" for i in analysis["integrations"]] or ["- None"]
    return "\n".join(lines) + "\n"


def acceptance_md(name: str, checklist: list[dict]) -> str:
    lines = [f"# {name}: acceptance criteria", "", "Tick each item when you have verified it.", ""]
    category = ""
    for c in checklist:
        if c["category"] != category:
            category = c["category"]
            lines += ["", f"## {category}", ""]
        lines.append(f"- [{'x' if c.get('done') else ' '}] {c['text']}")
    return "\n".join(lines) + "\n"


def readme_md(name: str, analysis: dict, checklist: list[dict], has_shop_or_backend: bool) -> str:
    pages = analysis["pages"]["names"] + [p["name"] for p in analysis["pages"]["implied"]]
    understood = "\n".join(f"- **{u['label']}:** {u['value']}" for u in analysis["understanding"])
    backend = has_shop_or_backend
    return f"""# {name}

> Built with VIBE from a requirements conversation. This file is the project documentation: what the site is for,
> how it is built, how to run it and how to know it is done.

## 1. What this project is

{understood}

## 2. Pages

{chr(10).join('- ' + p for p in pages) or '- Home'}

## 3. Features and integrations

{chr(10).join('- **' + f['feature'] + '**: ' + ('built in' if f['supported'] else 'needs custom work') + '. ' + f['note'] for f in analysis['features']) or '- None specified'}

{chr(10).join('- **' + i['name'] + '**: ' + i['note'] for i in analysis['integrations'])}

## 4. How to start the project

### Frontend
```bash
npm install
cp .env.example .env.local      # sets the API address
npm run dev                     # http://localhost:3000
```

### Backend
{'```bash' + chr(10) + 'cd backend' + chr(10) + 'python -m venv .venv && source .venv/bin/activate   # Windows: .venv\\\\Scripts\\\\activate' + chr(10) + 'pip install -r requirements.txt' + chr(10) + 'cp .env.example .env' + chr(10) + 'uvicorn app.main:app --reload      # http://localhost:8000  (API docs at /docs)' + chr(10) + '```' if backend else 'This project has no backend yet. Turn on "Backend" in the export dialog when you need forms, orders or accounts.'}

### The whole project together
1. Start the backend first, then the frontend.
2. Open the site, and try the main flow once by hand.
3. Run the automated checks: `cd backend && pytest -q`.
4. With Docker: `cd backend && docker compose up --build` for the API, then run the frontend as above.

## 5. Recommendations from the project guide

{chr(10).join('- **' + r['title'] + '**: ' + r['why'] for r in analysis['recommendations'])}

## 6. Acceptance checklist

See `docs/ACCEPTANCE.md`. The site is done when every item is ticked.

## 7. Documentation index

- `README.md` (this file)
- `docs/REQUIREMENTS.md` what was asked for
- `docs/ACCEPTANCE.md` how to know it is done
- `INTEGRATION_REPORT.md` how frontend and backend were connected and tested
"""
