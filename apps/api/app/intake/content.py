"""Turns a template into the user's own site: real names, offers, copy and FAQs instead of the template's placeholders.

Two layers:
  1. Industry packs (bakery, restaurant, clinic, academy, travel, logistics, blog, retail, services) give sensible,
     relevant content for every component type. This is deterministic, fast and always available.
  2. The AI model (if it answers in time) writes the hero headline, sub-headline and short pitch from the user's own
     words. If it is slow or unavailable, the pack's copy is used.
"""

import asyncio
import json
import re
from typing import Any

from app.core.config import get_settings

settings = get_settings()

BAD_NAME = re.compile(r"\b(no name|don'?t have|do not have|not sure|none|yet|suggest|any name|whatever|decide)\b", re.I)


def _blob(memory: dict) -> str:
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


def _p(name: str, price: str, cat: str, desc: str) -> dict:
    return {"name": name, "price": price, "category": cat, "stock": 20, "description": desc, "image": ""}


PACKS: dict[str, dict[str, Any]] = {
    "bakery": {
        "words": ("bakery", "cake", "bake", "pastry", "cupcake", "bread"),
        "noun": "Bakery",
        "names": ["Golden Crumb", "Sugar & Spice", "The Oven Door", "Butter & Bloom"],
        "headline": "Fresh cakes, baked for your celebrations.",
        "sub": "Custom cakes, pastries and fresh bread, baked to order and delivered to your door.",
        "cta": ("Order a cake", "See the menu"),
        "products": [
            _p("Chocolate Truffle Cake", "899", "Cakes", "Rich dark chocolate layers with a silky ganache. 1 kg."),
            _p("Red Velvet Cake", "999", "Cakes", "Soft red velvet with cream cheese frosting. 1 kg."),
            _p("Butter Croissants (6)", "349", "Pastries", "Flaky, buttery and baked every morning."),
            _p("Sourdough Loaf", "249", "Bread", "Slow-fermented with a crisp golden crust."),
            _p("Cupcake Box (12)", "599", "Cupcakes", "Twelve assorted cupcakes, perfect for gifting."),
            _p("Custom Photo Cake", "1499", "Cakes", "Send us a photo or design and we'll bake it."),
        ],
        "features": [("Baked fresh daily", "Nothing sits on a shelf. Everything is baked the day it reaches you."), ("Custom orders", "Names, messages, photos and themes on any cake."), ("Delivered on time", "Same-day delivery in the city, packed to arrive perfect."), ("Real ingredients", "Butter, fresh cream and real chocolate. No shortcuts.")],
        "testimonials": [("The birthday cake was gorgeous and tasted even better.", "Meera S.", "Customer"), ("Ordered at night, delivered fresh in the morning.", "Rahul K.", "Customer"), ("Our office loves the cupcake boxes.", "Anita J.", "Corporate client")],
        "faq": [("How far ahead should I order?", "Standard cakes need 24 hours. Custom designs need 48 hours."), ("Do you deliver?", "Yes, we deliver across the city and can ship boxed items nearby."), ("Can I make it eggless?", "Yes. Most cakes are available eggless at no extra cost."), ("How do I pay?", "UPI, cards and netbanking at checkout.")],
        "stats": [("500+", "Cakes delivered"), ("4.9/5", "Customer rating"), ("24h", "Order to doorstep"), ("100%", "Fresh ingredients")],
        "cta_block": ("Planning a celebration?", "Tell us the date and we'll bake something special.", "Order now"),
        "kb": [("delivery time shipping", "We deliver within the city the same day for orders before 2 pm."), ("eggless custom order", "Yes, eggless and custom cakes are available. Order 48 hours ahead for custom designs."), ("payment upi card", "You can pay by UPI, card or netbanking at checkout.")],
    },
    "restaurant": {
        "words": ("restaurant", "cafe", "café", "coffee", "tea house", "food", "dining", "kitchen", "menu", "catering", "bistro"),
        "noun": "Kitchen",
        "names": ["Saffron Table", "The Spice Room", "Copper Kettle", "Olive & Ember"],
        "headline": "Good food, made with care.",
        "sub": "Fresh, seasonal dishes cooked to order. Dine in, take away or get it delivered.",
        "cta": ("Order online", "View the menu"),
        "products": [_p("Chef's Special Thali", "349", "Mains", "A full plate of the day's best."), _p("Wood-fired Pizza", "449", "Mains", "Hand-stretched with fresh mozzarella."), _p("Seasonal Salad", "249", "Starters", "Crisp greens with house dressing."), _p("Masala Chai", "79", "Drinks", "Brewed slowly with fresh ginger."), _p("Chocolate Brownie", "199", "Desserts", "Warm, gooey and served with ice cream.")],
        "features": [("Made to order", "Every dish is cooked fresh when you order it."), ("Local ingredients", "Seasonal produce from nearby farms."), ("Dine in or deliver", "Book a table or order to your door."), ("Private events", "Space for birthdays and small gatherings.")],
        "testimonials": [("The best meal we've had in months.", "Priya N.", "Guest"), ("Quick delivery and still hot.", "Arjun V.", "Customer")],
        "faq": [("Do you take reservations?", "Yes, book online or call us."), ("Do you deliver?", "Yes, within 8 km of the restaurant."), ("Are there vegetarian options?", "Yes, more than half our menu is vegetarian.")],
        "stats": [("50+", "Dishes"), ("4.8/5", "Guest rating"), ("30 min", "Average delivery"), ("7 days", "Open every week")],
        "cta_block": ("Hungry?", "Order online or reserve a table.", "Order now"),
        "kb": [("timings opening hours", "We are open every day from 11 am to 11 pm."), ("reservation book table", "You can book a table on the Contact page or by phone.")],
    },
    "clinic": {
        "words": ("clinic", "doctor", "hospital", "dental", "dentist", "health", "patient", "therapy", "physio", "medical", "wellness"),
        "noun": "Clinic",
        "names": ["CareFirst", "Healwell", "Evergreen Health", "PulsePoint"],
        "headline": "Caring for you, every step of the way.",
        "sub": "Experienced doctors, gentle care and appointments that fit your day.",
        "cta": ("Book an appointment", "Our services"),
        "products": [],
        "features": [("Easy appointments", "Book online in under a minute. No waiting on the phone."), ("Experienced doctors", "Qualified specialists who take time to listen."), ("Clear pricing", "You know the cost before you visit."), ("Follow-up care", "Reminders and check-ins after every visit.")],
        "testimonials": [("Booking was effortless and the doctor was so kind.", "Sunita R.", "Patient"), ("No long waits and clear explanations.", "Vikram P.", "Patient")],
        "faq": [("How do I book?", "Use the booking form or call the front desk."), ("Do you accept insurance?", "Yes, most major insurers are accepted."), ("What should I bring?", "Any previous reports and a photo ID.")],
        "stats": [("15+", "Years of care"), ("20K+", "Patients treated"), ("12", "Specialists"), ("4.9/5", "Patient rating")],
        "cta_block": ("Ready to see a doctor?", "Book a time that suits you.", "Book now"),
        "catalog": [("General Consultation", "₹500", "A full check-up with one of our doctors."), ("Dental Care", "₹800", "Cleaning, fillings and check-ups."), ("Health Screening", "₹2,499", "A complete panel of tests with a doctor's review.")],
        "kb": [("timings opening hours", "We are open Monday to Saturday, 9 am to 7 pm."), ("appointment book", "You can book an appointment from the Contact page.")],
    },
    "academy": {
        "words": ("course", "academy", "school", "tutor", "learn", "student", "training", "bootcamp", "class", "coaching", "education"),
        "noun": "Academy",
        "names": ["BrightPath", "Skillhouse", "Learnly", "NorthStar Academy"],
        "headline": "Learn skills that move your career forward.",
        "sub": "Practical courses taught by working experts, at a pace that suits you.",
        "cta": ("Explore courses", "Talk to an advisor"),
        "products": [],
        "features": [("Expert mentors", "Learn from people who do this work every day."), ("Hands-on projects", "Build a portfolio while you learn."), ("Flexible schedule", "Weekday, weekend and self-paced options."), ("Career support", "Resume reviews and interview practice.")],
        "testimonials": [("I landed my first job two months after finishing.", "Divya M.", "Graduate"), ("The mentors genuinely care.", "Sameer T.", "Student")],
        "faq": [("Do I need prior experience?", "No. Beginner tracks start from the basics."), ("How long are the courses?", "Most run 8 to 12 weeks."), ("Is there a certificate?", "Yes, on completion of every course.")],
        "stats": [("5,000+", "Students taught"), ("92%", "Completion rate"), ("40+", "Expert mentors"), ("4.8/5", "Average rating")],
        "cta_block": ("Ready to start learning?", "Enrol today and begin this month.", "Enrol now"),
        "catalog": [("Web Development", "₹24,999", "12 weeks. HTML, CSS, JavaScript and React."), ("Data Analytics", "₹19,999", "10 weeks. Excel, SQL and dashboards."), ("UI/UX Design", "₹17,999", "8 weeks. Research, wireframes and prototypes.")],
        "kb": [("fees price cost", "Course fees are listed on the Courses page, with instalment options."), ("start date batch", "New batches start every month.")],
    },
    "travel": {
        "words": ("travel", "tour", "trip", "holiday", "destination", "vacation", "hotel", "resort"),
        "noun": "Travels",
        "names": ["Wanderly", "Wayfarer", "Compass & Co", "Trailblaze Tours"],
        "headline": "Trips planned around you.",
        "sub": "Handpicked destinations, honest prices and someone to call if plans change.",
        "cta": ("Plan my trip", "View destinations"),
        "products": [],
        "features": [("Handpicked stays", "Places we have visited and would book ourselves."), ("Local guides", "Experiences you won't find in guidebooks."), ("One price", "Flights, stays and transfers with no surprises."), ("24/7 support", "A real person on the phone during your trip.")],
        "testimonials": [("Our Kerala trip was perfectly organised.", "Neha & Kabir", "Honeymooners"), ("They handled everything, even when our flight changed.", "The Menon family", "Family trip")],
        "faq": [("Can you customise a trip?", "Yes. Every itinerary is tailored to your dates and budget."), ("What is your cancellation policy?", "Free changes up to 14 days before departure."), ("Do you arrange visas?", "We guide you through the process.")],
        "stats": [("2,000+", "Trips planned"), ("60", "Destinations"), ("4.9/5", "Traveller rating"), ("24/7", "Trip support")],
        "cta_block": ("Where to next?", "Tell us your dream trip and we'll plan it.", "Plan my trip"),
        "catalog": [("Kerala Backwaters", "₹18,999", "5 days of houseboats, tea hills and beaches."), ("Rajasthan Royal Circuit", "₹24,999", "7 days across palaces and desert camps."), ("Bali Escape", "₹49,999", "6 days of beaches, temples and rice terraces.")],
        "kb": [("book payment", "Pay a small deposit to confirm and the rest before departure."), ("cancel refund", "Free changes up to 14 days before departure.")],
    },
    "logistics": {
        "words": ("logistic", "courier", "freight", "shipping", "delivery", "cargo", "transport", "warehouse", "parcel"),
        "noun": "Logistics",
        "names": ["SwiftHaul", "Parcelly", "Northline Freight", "RouteWise"],
        "headline": "Deliveries that arrive on time, every time.",
        "sub": "Reliable pickup, live tracking and delivery across the country.",
        "cta": ("Get a quote", "Track a shipment"),
        "products": [],
        "features": [("Live tracking", "Know exactly where every parcel is."), ("Pan-India network", "Reach 19,000+ pin codes."), ("Secure handling", "Insured and scanned at every step."), ("Business accounts", "Bulk rates and API access.")],
        "testimonials": [("Deliveries are faster and we can finally track everything.", "Ritu A.", "Ops manager"), ("Our returns dropped after we switched.", "Kunal D.", "Store owner")],
        "faq": [("How do I track a parcel?", "Enter your tracking number on the Track page."), ("What can't be shipped?", "Hazardous and prohibited goods."), ("How fast is delivery?", "1 to 2 days in metros, 3 to 5 elsewhere.")],
        "stats": [("1M+", "Parcels delivered"), ("19K+", "Pin codes"), ("98%", "On-time rate"), ("24/7", "Support")],
        "cta_block": ("Ship with confidence", "Get a quote in under a minute.", "Get a quote"),
        "catalog": [("Express", "From ₹99", "Next-day delivery between metros."), ("Standard", "From ₹49", "2 to 5 day delivery nationwide."), ("Freight", "On quote", "Bulk and heavy shipments.")],
        "kb": [("track parcel", "Enter your tracking number on the Track page."), ("rate price quote", "Use the quote form and we'll reply within an hour.")],
    },
    "blog": {
        "words": ("blog", "journal", "writing", "newsletter", "magazine", "essays"),
        "noun": "Journal",
        "names": ["Slow Ideas", "The Margin Notes", "Fieldnotes", "Paper & Pen"],
        "headline": "Thoughts worth slowing down for.",
        "sub": "Essays and notes on the things I'm learning, published regularly.",
        "cta": ("Read the latest", "Subscribe"),
        "products": [],
        "features": [("Long-form essays", "Thoughtful pieces you can sit with."), ("Weekly notes", "Short updates from the week."), ("No noise", "No ads, no popups, just writing."), ("Your inbox", "Get every post by email.")],
        "testimonials": [("The only newsletter I read start to finish.", "A reader", "Subscriber")],
        "faq": [("How often do you publish?", "A new post every week."), ("Can I republish?", "Please ask first."), ("How do I subscribe?", "Use the form at the bottom of any page.")],
        "stats": [("120+", "Essays"), ("5K", "Readers"), ("Weekly", "New posts"), ("4 yrs", "Writing")],
        "cta_block": ("Never miss a post", "One email when something is published.", "Subscribe"),
        "kb": [("subscribe newsletter", "Use the subscribe form and you'll get each new post by email.")],
    },
    "retail": {
        "words": ("shop", "store", "boutique", "ecommerce", "e-commerce", "sell", "product", "fashion", "clothing", "jewel", "gift"),
        "noun": "Store",
        "names": ["Fable & Co", "The Corner Shop", "Kindred Goods", "Nook & Ivy"],
        "headline": "Things you'll love, delivered to your door.",
        "sub": "Carefully chosen products, fair prices and quick delivery.",
        "cta": ("Shop now", "Our story"),
        "products": [_p("Signature Item", "1499", "Featured", "Our best-loved product."), _p("Everyday Essential", "799", "Essentials", "Simple, useful and well made."), _p("Gift Set", "2499", "Gifts", "A thoughtful set, beautifully packed."), _p("Limited Edition", "1999", "New", "Available for a short time only.")],
        "features": [("Quality first", "Every product is checked before it ships."), ("Fast delivery", "Dispatched within 24 hours."), ("Easy returns", "7-day no-questions returns."), ("Secure checkout", "Pay by UPI, card or netbanking.")],
        "testimonials": [("Beautiful quality, arrived in two days.", "Asha K.", "Customer"), ("Will definitely order again.", "Rohan M.", "Customer")],
        "faq": [("How long does delivery take?", "2 to 5 days across India."), ("Can I return an item?", "Yes, within 7 days if unused."), ("Which payments do you accept?", "UPI, cards and netbanking.")],
        "stats": [("10K+", "Happy customers"), ("4.8/5", "Rating"), ("24h", "Dispatch"), ("7 days", "Easy returns")],
        "cta_block": ("Free shipping over ₹999", "Easy returns on every order.", "Start shopping"),
        "kb": [("shipping delivery", "We ship within 24 hours and deliver in 2 to 5 days."), ("return refund", "Unused items can be returned within 7 days.")],
    },
    "realestate": {
        "words": ("real estate", "realestate", "realtor", "property", "properties", "land", "plot", "apartment", "flat", "villa", "builder", "developer", "housing", "rental"),
        "noun": "Real estate",
        "names": ["Keystone Realty", "Landmark Homes", "Open Door Estates", "Cornerstone Properties"],
        "headline": "Find the right property, without the runaround.",
        "sub": "Verified listings, honest advice and site visits arranged around your schedule.",
        "cta": ("Book a site visit", "View properties"),
        "products": [],
        "features": [("Verified listings", "Every property is checked, with clear titles and documents."), ("Site visits", "Pick a slot and we'll show you around."), ("Local knowledge", "Advice on areas, prices and what's coming up nearby."), ("Paperwork help", "We guide you through registration and loans.")],
        "testimonials": [("They found us the right plot in two weeks.", "Anil & Priya", "Land buyers"), ("Clear answers, no pressure, and the documents were all in order.", "Rahul M.", "Home buyer")],
        "faq": [("Can I visit before deciding?", "Yes. Book a site visit and we'll take you there."), ("Are the documents verified?", "Every listing's title and approvals are checked first."), ("Do you help with home loans?", "We can connect you with partner banks.")],
        "stats": [("300+", "Properties sold"), ("15 yrs", "In the market"), ("40+", "Locations"), ("4.8/5", "Buyer rating")],
        "cta_block": ("Looking for a property?", "Tell us what you need and we'll shortlist the right ones.", "Book a site visit"),
        "catalog": [("2 BHK Apartment", "₹48 L", "Near the city centre, ready to move in."), ("Residential Plot, 10 cents", "₹22 L", "Clear title, road access, in a growing area."), ("3 BHK Villa", "₹1.2 Cr", "Gated community with a garden and parking.")],
        "kb": [("visit site", "Book a site visit from the Contact section and pick a time that suits you."), ("documents title loan", "Every listing's documents are verified, and we can connect you with partner banks for loans.")],
    },
    "services": {
        "words": (),
        "noun": "Studio",
        "names": ["Northwind", "Brightside", "Harbor & Co", "Clearpath"],
        "headline": "Work that moves your business forward.",
        "sub": "A small, focused team that listens first and delivers on time.",
        "cta": ("Get in touch", "See our work"),
        "products": [],
        "features": [("Listen first", "We start by understanding your goals."), ("Clear process", "You always know what happens next."), ("On-time delivery", "Realistic timelines we keep."), ("Ongoing support", "We stay with you after launch.")],
        "testimonials": [("They understood the brief from day one.", "Meera S.", "Client"), ("Professional, quick and easy to work with.", "Arun D.", "Client")],
        "faq": [("How do we start?", "Send us a message and we'll set up a call."), ("How long does a project take?", "Most projects take 2 to 6 weeks."), ("Do you offer support after launch?", "Yes, on every plan.")],
        "stats": [("120+", "Projects"), ("98%", "Clients return"), ("5 yrs", "In business"), ("24h", "Reply time")],
        "cta_block": ("Have a project in mind?", "Tell us about it and we'll reply within a day.", "Get in touch"),
        "kb": [("contact call", "Use the Contact page and we'll reply within one working day.")],
    },
}
ORDER = ["bakery", "restaurant", "clinic", "academy", "realestate", "travel", "logistics", "blog", "retail", "services"]


def _mentions(text: str, words) -> bool:
    """A word starts in `text` ("tour" matches "tours" but not "detour"; "land" does not match "island")."""
    return any(re.search(r"\b" + re.escape(w), text) for w in words)


def detect_pack(memory: dict) -> str:
    """The business itself decides the pack; the features and objectives only break ties."""
    biz = " ".join([str(memory.get("business", "")), str(memory.get("name", ""))]).lower()
    for key in ORDER[:-1]:
        if _mentions(biz, PACKS[key]["words"]):
            return key
    rest = _blob(memory)
    for key in ORDER[:-1]:
        if _mentions(rest, PACKS[key]["words"]):
            return key
    return "services"


def _extract_brand(text: str) -> str:
    """The name inside an answer: quoted, or after "called / named / it's", or the whole answer if it is short."""
    text = text.strip().strip(".")
    m = re.search(r"[\"\u201c\u2018']([^\"\u201d\u2019']{2,40})[\"\u201d\u2019']", text)
    if m:
        return m.group(1).strip()
    m = re.search(r"(?:called|named|name is|name it|it's|it is|go with|choose|pick|take)\s+([A-Z0-9][\w&' .-]{1,40})", text)
    if m:
        return m.group(1).strip(" .,")
    if len(text.split()) <= 4 and not re.search(r"\b(make|suggest|website|site|build|create|need|want|help)\b", text, re.I):
        return text
    return ""


def brand_name(memory: dict) -> str:
    """The name the user gave, or a suggestion if they don't have one yet."""
    given = _extract_brand(str(memory.get("name", "")))
    if given and not BAD_NAME.search(given):
        return given[:60]
    pack = PACKS[detect_pack(memory)]
    return f"{pack['names'][0]} {pack['noun']}" if pack["noun"].lower() not in pack["names"][0].lower() else pack["names"][0]


def _pages_of(memory: dict) -> list[str]:
    pages = memory.get("pages")
    return list(pages.get("names", [])) if isinstance(pages, dict) else []


def _rebrand(value: Any, old: str, new: str) -> Any:
    if isinstance(value, str):
        return value.replace(old, new)
    if isinstance(value, list):
        return [_rebrand(v, old, new) for v in value]
    if isinstance(value, dict):
        return {k: _rebrand(v, old, new) for k, v in value.items()}
    return value


def tailor(pages: list[dict], memory: dict, name: str, copy: dict | None = None, old_brand: str = "") -> str:
    """Rewrites placeholder content in the pages, in place. Returns the pack that was used."""
    key = detect_pack(memory)
    pack = PACKS[key]
    copy = copy or {}
    headline = copy.get("headline") or pack["headline"]
    sub = copy.get("subheadline") or pack["sub"]
    used = {"features": 0}

    for page in pages:
        for node in page["tree"]:
            if old_brand and old_brand != name:
                node["props"] = _rebrand(node.get("props", {}), old_brand, name)
            t, props = node.get("type"), node.setdefault("props", {})
            if t == "hero" and node.get("variant") != "page-header" and page.get("is_home"):
                props.update({"headline": headline, "subheadline": sub, "primaryCta": pack["cta"][0], "secondaryCta": pack["cta"][1]})
            elif t == "hero" and node.get("variant") == "page-header":
                props["subheadline"] = props.get("subheadline", "").replace("Your Brand", name)
            elif t == "shop" and pack["products"]:
                props["products"] = [dict(p) for p in pack["products"]]
                props["heading"] = props.get("heading") or "Shop"
            elif t in ("features", "cards") and pack["features"] and (page.get("is_home") or t == "features" and props.get("heading") in ("Services", "Solutions", "Features")):
                items = pack["features"]
                props["items"] = [{"title": a, "text": b} for a, b in items]
                if t == "features" and used["features"] == 0 and page.get("is_home"):
                    props["heading"] = f"Why {name}"
                used["features"] += 1
            elif t == "catalog" and "post" not in str(props.get("heading", "")).lower():
                if pack["products"]:
                    props["items"] = [{"name": p["name"], "price": f"₹{p['price']}", "description": p["description"], "image": ""} for p in pack["products"][:6]]
                elif pack.get("catalog"):
                    props["items"] = [{"name": a, "price": b, "description": c, "image": ""} for a, b, c in pack["catalog"]]
            elif t == "testimonials":
                props["items"] = [{"quote": q, "name": n, "role": r} for q, n, r in pack["testimonials"]]
            elif t == "faq":
                props["items"] = [{"q": q, "a": a} for q, a in pack["faq"]]
            elif t == "stats":
                props["items"] = [{"value": v, "label": l} for v, l in pack["stats"]]
            elif t == "cta":
                h, s, b = pack["cta_block"]
                props.update({"heading": h, "subheading": s, "button": b})
            elif t == "chatbot":
                props["brand"] = name
                props["greeting"] = f"Hi! I'm {props.get('botName', 'Aria')} from {name}. How can I help?"
                props["knowledge"] = [{"q": q, "a": a} for q, a in pack["kb"]]
            elif t in ("navbar", "footer"):
                props["brand"] = name
    return key


# ───────────────────────── model-written copy ─────────────────────────
COPY_SYSTEM = """You write website copy. Given a business brief, reply with ONLY JSON:
{"headline": "...", "subheadline": "..."}
The headline is at most 8 words, specific to this business, with no clichés. The subheadline is one sentence of at most 22 words
that says what they offer and who it is for. Never invent prices, awards or numbers."""


async def write_copy(name: str, memory: dict) -> dict:
    if not settings.intake_use_agent:
        return {}
    from app.intake.agent import build_model

    if build_model() is None:
        return {}
    brief = f"Brand: {name}\nBusiness: {memory.get('business', '')}\nAudience: {memory.get('audience', '')}\nGoals: {memory.get('objectives', '')}\nTone: {memory.get('style', '')}"

    from app.ai import llm

    data = llm.parse_json(await llm.complete(COPY_SYSTEM, brief, json_mode=True, timeout=min(settings.intake_agent_timeout, 25), max_tokens=300))
    if not isinstance(data, dict):
        return {}  # the pack copy is always a good fallback
    head, sub = str(data.get("headline", "")).strip().strip('"'), str(data.get("subheadline", "")).strip().strip('"')
    out = {}
    if 3 <= len(head) <= 70:
        out["headline"] = head
    if 15 <= len(sub) <= 170:
        out["subheadline"] = sub
    return out


PREFIXES = ["Bright", "Golden", "Urban", "Blue", "Maple", "Coastal", "Nova", "True", "Little", "Wild", "Prime", "Olive"]


def suggest_names(memory: dict, round_: int = 0) -> list[str]:
    """Name ideas that fit the business. Each round gives a fresh set."""
    pack = PACKS[detect_pack(memory)]
    noun = pack["noun"]
    base = list(pack["names"])
    extra = [f"{PREFIXES[(round_ * 4 + i) % len(PREFIXES)]} {noun}" for i in range(4)]
    pool = base + extra if round_ == 0 else extra + base
    seen, out = set(), []
    for n in pool[round_ * 0:]:
        if n.lower() not in seen:
            seen.add(n.lower())
            out.append(n)
    start = 0 if round_ == 0 else 0
    return out[start:start + 4] if round_ == 0 else out[:4]
