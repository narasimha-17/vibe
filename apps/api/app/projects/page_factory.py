"""Creates ready-made pages from names like "Services" or "Doctors".

Used in two places: templates ship with a page for every navbar link, and the builder / requirements agent can
add the missing pages of an existing site. Every page starts with the site's own navbar and footer and is filled
with components that suit the page (features, team, pricing, catalog, tracking, forms, FAQ and so on).
"""

import copy
import re
import uuid



def _node(type_: str, variant: str, props: dict | None = None, name: str | None = None) -> dict:
    return {
        "id": uuid.uuid4().hex[:8],
        "type": type_,
        "variant": variant,
        "name": name or type_.capitalize(),
        "props": props or {},
        "style": {},
        "responsive": {},
        "children": [],
        "locked": False,
        "hidden": False,
    }

SAMPLE_PRODUCTS = [
    {"name": "Everyday Tote", "price": "1999", "category": "Bags", "stock": 20, "description": "A durable carryall made for daily movement.", "image": ""},
    {"name": "Studio Mug", "price": "899", "category": "Home", "stock": 15, "description": "Hand-finished ceramic with a soft matte glaze.", "image": ""},
    {"name": "Field Notes", "price": "499", "category": "Stationery", "stock": 40, "description": "A pocket notebook for ideas worth keeping.", "image": ""},
    {"name": "Linen Throw", "price": "2499", "category": "Home", "stock": 8, "description": "Stonewashed linen, soft from day one.", "image": ""},
]

# Cuisine names a restaurant might serve. Each one gets its own page of dishes.
CUISINES: tuple[str, ...] = ("indian", "south indian", "north indian", "chinese", "italian", "mexican", "thai", "continental", "arabian", "japanese", "mediterranean", "korean", "kerala", "punjabi", "seafood", "vegan", "desserts", "fast food", "street food", "biryani", "pizza", "burger")

# (keywords, page kind). First match wins, so order matters.
RULES: list[tuple[tuple[str, ...], str]] = [
    (("admin",), "admin"),
    (("dashboard",), "dashboard"),
    (("engagement", "analytics"), "engagement"),
    (("order online", "order food", "online order", "order now"), "shop"),
    (("checkout", "cart", "basket"), "checkout"),
    (("my orders", "order history", "previous order", "past order", "order again", "reorder", "purchases"), "orders"),
    (("offers", "discount", "coupon", "promo", "sale"), "offers"),
    (("cuisine",) + CUISINES, "cuisine"),
    (("quality", "accredit", "methodolog", "standards", "why choose", "why us", "our approach", "teaching"), "quality"),
    (("admission", "enrol", "enroll", "apply"), "admissions"),
    (("results", "placement", "alumni", "success stor", "outcomes"), "results"),
    (("returns", "refund", "shipping", "delivery policy", "policy", "terms", "privacy"), "policy"),
    (("feedback",), "reviews"),
    (("track", "order status", "shipment", "parcel"), "tracking"),
    (("profile", "my account", "account settings", "settings"), "profile"),
    (("forgot password", "reset password"), "forgot"),
    (("login", "log in", "sign in", "signin", "account", "portal", "patients", "students", "members"), "login"),
    (("register", "sign up", "signup", "join"), "register"),
    (("shop", "store", "products", "deals", "new arrivals", "catalog", "collection"), "shop"),
    (("contact", "reach", "enquiry", "inquiry", "get in touch", "book", "reserv", "appointment", "quote"), "contact"),
    (("pricing", "plans", "fees", "packages", "membership", "rates", "cost"), "pricing"),
    (("faq", "questions", "help", "support"), "faq"),
    (("team", "doctors", "mentors", "planners", "writers", "authors", "people", "staff", "experts", "leadership", "faculty", "teachers", "instructors", "tutors"), "team"),
    (("about", "story", "company", "who we are", "mission", "why"), "about"),
    (("blog", "journal", "stories", "essays", "news", "writing", "articles", "archive", "insights", "resources", "interviews"), "blog"),
    (("destinations", "courses", "classes", "programs", "curriculum", "menu", "rooms", "listings", "treatments", "tours", "trips"), "listing"),
    (("work", "portfolio", "projects", "case", "gallery", "clients", "results"), "work"),
    (("testimonials", "reviews", "reviews", "praise"), "reviews"),
    (("services", "solutions", "features", "product", "what we do", "network", "coverage", "capabilities", "offerings"), "services"),
]


def slugify(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or "page"


def kind_for(label: str) -> str:
    low = label.lower()
    for words, kind in RULES:
        if any(re.search(chr(92) + "b" + re.escape(w), low) for w in words):  # word starts: "work" must not match "network"
            return kind
    return "generic"


def clone(node: dict) -> dict:
    """Deep copy with fresh ids so a navbar or footer can be reused on another page."""
    out = copy.deepcopy(node)

    def fresh(n: dict) -> None:
        n["id"] = uuid.uuid4().hex[:8]
        for child in n.get("children", []):
            fresh(child)

    fresh(out)
    return out


def _header(title: str, sub: str, cta: str = "") -> dict:
    return _node("hero", "page-header", {"headline": title, "subheadline": sub, "primaryCta": cta, "secondaryCta": ""}, name="Page header")


def _sections(kind: str, label: str, brand: str, domain: str = "") -> list[dict]:
    t = label.strip().title() if label.islower() else label.strip()
    more = _more(kind, t, brand, domain)
    if more is not None:
        return more
    if kind == "tracking":
        return [_header(t, "See where your order is right now."), _node("tracking", "default", {"heading": "Track your order"})]
    if kind == "login":
        return [_node("auth", "login-split", {"brand": brand, "heading": "", "subheading": ""})]
    if kind == "register":
        return [_node("auth", "register-split", {"brand": brand, "heading": "", "subheading": ""})]
    if kind == "profile":
        return [_node("auth", "profile", {"brand": brand, "heading": "", "subheading": ""})]
    if kind == "forgot":
        return [_node("auth", "forgot-card", {"brand": brand, "heading": "", "subheading": ""})]
    if kind == "shop":
        return [_node("notifications", "default", {"text": "Free shipping over ₹999 · Easy returns on every order", "cta": ""}), _header(t, f"Browse everything from {brand}."), _node("shop", "sidebar", {"heading": t, "products": copy.deepcopy(SAMPLE_PRODUCTS)})]
    if kind == "contact":
        return [
            _header(t, "We usually reply within one working day."),
            _node("forms", "split", {"heading": "Talk to us", "subheading": "Tell us what you need and we'll get back to you."}),
            _node("socials", "cards", {"heading": "Other ways to reach us", "subheading": "Pick the channel you prefer.", "items": [{"platform": "whatsapp", "value": "+91 98765 43210", "label": ""}, {"platform": "email", "value": "hello@yourbrand.com", "label": ""}, {"platform": "instagram", "value": "yourbrand", "label": ""}]}),
        ]
    if kind == "pricing":
        return [
            _header(t, "Simple, transparent pricing."),
            _node("pricing", "toggle", {"heading": "Choose a plan", "tiers": [
                {"name": "Starter", "price": "₹499", "unit": "per month", "features": ["Core features", "Email support"], "button": "Get started"},
                {"name": "Growth", "price": "₹999", "unit": "per month", "featured": True, "features": ["Everything in Starter", "Priority support", "Analytics"], "button": "Choose Growth"},
                {"name": "Scale", "price": "₹2,499", "unit": "per month", "features": ["Everything in Growth", "Team seats", "Dedicated manager"], "button": "Talk to us"}]}),
            _node("faq", "twocol", {"heading": "Pricing questions", "items": [{"q": "Can I change plans later?", "a": "Yes, you can upgrade or downgrade any time."}, {"q": "Is there a free trial?", "a": "Yes, every plan starts with a 14-day trial."}]}),
        ]
    if kind == "faq":
        return [_header(t, "Quick answers to common questions."), _node("faq", "sidebar", {"heading": "Frequently asked", "items": [{"q": "How do I get started?", "a": "Contact us or sign up and we'll guide you through it."}, {"q": "How long does it take?", "a": "Most customers are up and running within a few days."}, {"q": "Do you offer support?", "a": "Yes, by email and chat, every working day."}]}), _node("forms", "contact", {"heading": "Still have questions?", "subheading": "Send us a message."})]
    if kind == "team":
        return [
            _header(t, f"The people behind {brand}."),
            _node("team", "photo", {"heading": t, "items": [{"name": "Nisha Menon", "role": "Founder"}, {"name": "Karan Shah", "role": "Head of Operations"}, {"name": "Divya Rao", "role": "Design Lead"}, {"name": "Imran Ali", "role": "Customer Success"}]}),
            _node("cta", "card", {"note": "", "heading": "Want to work with us?", "subheading": "We'd love to hear from you.", "button": "Get in touch"}),
        ]
    if kind == "about":
        return [
            _header(t, f"Why {brand} exists."),
            _node("features", "checks", {"heading": "What we believe", "subheading": "", "items": [{"title": "Customers first", "text": "Every decision starts with the people we serve."}, {"title": "Craft over shortcuts", "text": "We take the time to do things properly."}, {"title": "Honest and open", "text": "Clear prices, clear communication."}]}),
            _node("timeline", "alternating", {"heading": "Our story", "items": [{"date": "2022", "title": "The idea", "text": "It started with a simple problem."}, {"date": "2024", "title": "First customers", "text": "Word of mouth did the rest."}, {"date": "Today", "title": "Growing steadily", "text": "Building carefully, one step at a time."}]}),
            _node("stats", "big", {"items": [{"value": "10K+", "label": "Customers"}, {"value": "4.9/5", "label": "Rating"}, {"value": "24/7", "label": "Support"}, {"value": "5", "label": "Years"}]}),
        ]
    if kind == "blog":
        return [
            _header(t, "New writing, published regularly."),
            _node("catalog", "menu", {"heading": "Latest posts", "subheading": "Read, learn and share.", "items": [{"name": "Getting started: a simple guide", "price": "6 min read", "description": "Everything you need for your first week.", "image": ""}, {"name": "What we learned this year", "price": "9 min read", "description": "Honest notes from the team.", "image": ""}, {"name": "Five mistakes to avoid", "price": "5 min read", "description": "Common pitfalls and how to sidestep them.", "image": ""}]}),
            _node("forms", "subscription", {"heading": "Get new posts by email", "subheading": "One message when something is published."}),
        ]
    if kind == "listing":
        return [
            _header(t, f"Explore what {brand} offers."),
            _node("catalog", "showcase", {"heading": t, "subheading": "Choose what suits you.", "items": [{"name": "Signature option", "price": "₹9,999", "description": "Our most popular choice.", "image": ""}, {"name": "Essential option", "price": "₹4,999", "description": "Everything you need to start.", "image": ""}, {"name": "Premium option", "price": "₹14,999", "description": "The full experience.", "image": ""}]}),
            _node("testimonials", "wall", {"heading": "What people say", "items": [{"quote": "Exactly what we were looking for.", "name": "Asha K.", "role": "Customer"}, {"quote": "Great value and friendly people.", "name": "Rohan M.", "role": "Customer"}]}),
            _node("forms", "booking", {"heading": "Book or enquire", "subheading": "Pick a date and we'll confirm."}),
        ]
    if kind == "work":
        return [
            _header(t, "Selected projects and the results they delivered.", "Start a project"),
            _node("catalog", "showcase", {"heading": "Featured projects", "subheading": "A few things we're proud of.", "items": [
                {"name": "Brand refresh", "price": "Branding", "description": "A new identity and website that doubled enquiries.", "image": ""},
                {"name": "Online store launch", "price": "E-commerce", "description": "From idea to first sale in six weeks.", "image": ""},
                {"name": "Mobile booking flow", "price": "Product", "description": "Cut booking time from ten minutes to two.", "image": ""},
                {"name": "Campaign microsite", "price": "Marketing", "description": "40,000 visitors in the first week.", "image": ""}]}),
            _node("stats", "big", {"items": [{"value": "120+", "label": "Projects delivered"}, {"value": "98%", "label": "Clients who return"}, {"value": "2.4x", "label": "Average uplift"}, {"value": "12", "label": "Industries"}]}),
            _node("timeline", "alternating", {"heading": "How we work", "items": [{"date": "01", "title": "Discover", "text": "We learn your goals, users and constraints."}, {"date": "02", "title": "Design", "text": "Concepts you can react to, fast."}, {"date": "03", "title": "Build", "text": "Clean, tested and ready to grow."}, {"date": "04", "title": "Launch", "text": "Go live, measure, improve."}]}),
            _node("testimonials", "spotlight", {"heading": "Client words", "items": [{"quote": "They understood the brief from day one.", "name": "Meera S.", "role": "Client"}]}),
            _node("cta", "card", {"note": "", "heading": "Have a project in mind?", "subheading": "Tell us about it and we'll reply within a day.", "button": "Start a project"}),
        ]
    if kind == "reviews":
        return [
            _header(t, "Real feedback from real customers."),
            _node("testimonials", "wall", {"heading": "Loved by customers", "items": [{"quote": "Beautiful quality and quick service.", "name": "Asha K.", "role": "Kochi"}, {"quote": "Would absolutely recommend.", "name": "Rohan M.", "role": "Bengaluru"}, {"quote": "Friendly people and great value.", "name": "Meera S.", "role": "Customer"}]}),
            _node("stats", "big", {"items": [{"value": "4.8/5", "label": "Average rating"}, {"value": "1,200+", "label": "Reviews"}, {"value": "96%", "label": "Would recommend"}, {"value": "24h", "label": "We reply to feedback"}]}),
            _node("forms", "contact", {"heading": "Share your feedback", "subheading": "Tell us what went well and what we can improve. We read every message."}),
        ]
    if kind == "services":
        return [
            _header(t, f"What {brand} can do for you."),
            _node("features", "bento", {"heading": t, "subheading": "Everything you need, in one place.", "items": [{"title": "Core service", "text": "The essential thing we do best."}, {"title": "Support", "text": "Friendly help whenever you need it."}, {"title": "Custom work", "text": "Tailored to your situation."}, {"title": "Ongoing care", "text": "We stay with you after launch."}]}),
            _node("cta", "card", {"note": "", "heading": "Ready to get started?", "subheading": "Tell us what you need.", "button": "Talk to us"}),
        ]
    return [_header(t, f"More about {t.lower()} at {brand}."), _node("features", "checks", {"heading": t, "subheading": "", "items": [{"title": "Point one", "text": "Describe the first important thing here."}, {"title": "Point two", "text": "Describe the second important thing here."}, {"title": "Point three", "text": "Describe the third important thing here."}]}), _node("cta", "line", {"heading": "Let's talk", "subheading": "", "button": "Contact us"})]


def build_page(label: str, navbar: dict | None, footer: dict | None, brand: str = "Your Brand", domain: str = "") -> dict:
    kind = kind_for(label)
    tree = []
    if navbar:
        tree.append(clone(navbar))
    tree += dedupe_headings(_sections(kind, label, brand, domain), label)
    if footer:
        tree.append(clone(footer))
    return {"name": label.strip().title() if label.islower() else label.strip(), "path": "/" + slugify(label), "is_home": False, "tree": tree, "kind": kind}


def _links(navbar: dict | None) -> list[str]:
    links = (navbar or {}).get("props", {}).get("links", []) or []
    return [str(x).strip() for x in links if str(x).strip()]


def pages_from_navbar(pages: list[dict]) -> list[dict]:
    """New pages for every navbar link that has no page yet (Home is never created)."""
    home = next((p for p in pages if p.get("is_home")), pages[0] if pages else None)
    if not home:
        return []
    navbar = next((n for n in home.get("tree", []) if n.get("type") == "navbar"), None)
    footer = next((n for n in home.get("tree", []) if n.get("type") == "footer"), None)
    brand = (navbar or {}).get("props", {}).get("brand", "Your Brand")
    have = {p.get("name", "").lower() for p in pages} | {p.get("path", "").strip("/").lower() for p in pages}
    made, seen = [], set()
    from app.intake.topics import clean_page_name

    for raw in _links(navbar):
        label = clean_page_name(raw)
        key = label.lower()
        if not label or key in ("home", "homepage") or key in have or slugify(label) in have or key in seen:
            continue
        seen.add(key)
        made.append(build_page(label, navbar, footer, brand))
    return made


def split_shop_page(pages: list[dict]) -> list[dict]:
    """The shop is a page of its own, not a section of the home page.

    The home page keeps a short "featured products" strip that leads to the Shop page, which holds the full shop
    (search, filters, cart and checkout). Pages that are already separate are left alone.
    """
    home = next((p for p in pages if p.get("is_home")), None)
    if not home or any(p.get("name", "").lower() == "shop" for p in pages):
        return pages
    shop = next((n for n in home["tree"] if n.get("type") == "shop"), None)
    if not shop:
        return pages
    navbar = next((n for n in home["tree"] if n.get("type") == "navbar"), None)
    footer = next((n for n in home["tree"] if n.get("type") == "footer"), None)
    brand = (navbar or {}).get("props", {}).get("brand", "Your Brand")
    products = shop["props"].get("products", [])

    shop_page = {
        "name": "Shop",
        "path": "/shop",
        "is_home": False,
        "tree": ([clone(navbar)] if navbar else []) + [_header("Shop", f"Browse everything from {brand}."), dedupe_headings([shop], "Shop")[0]] + ([clone(footer)] if footer else []),
    }
    has_catalog = any(n.get("type") == "catalog" for n in home["tree"])
    featured = [] if has_catalog else [
        _node("catalog", "showcase", {
            "heading": "Featured products",
            "subheading": "A few favourites. See the full range in the shop.",
            "items": [{"name": p["name"], "price": f"₹{p['price']}", "description": p.get("description", ""), "image": p.get("image", "")} for p in products[:3]],
        }),
        _node("cta", "line", {"heading": "See everything in the shop", "subheading": "Search, filter and check out in a few taps.", "button": "Browse the shop"}),
    ]
    tree: list[dict] = []
    for n in home["tree"]:
        if n is shop:
            tree += featured
        else:
            tree.append(n)
    home["tree"] = tree
    return pages + [shop_page]


DISHES: dict[str, list[tuple[str, str, str]]] = {
    "indian": [("Butter Chicken", "₹320", "Creamy tomato gravy with tandoori chicken."), ("Paneer Tikka Masala", "₹280", "Char-grilled paneer in a rich masala."), ("Dal Makhani", "₹220", "Slow-cooked black lentils with butter."), ("Garlic Naan", "₹60", "Fresh from the tandoor.")],
    "south indian": [("Masala Dosa", "₹140", "Crisp dosa with spiced potato."), ("Idli Sambar", "₹90", "Soft idlis with sambar and chutneys."), ("Kerala Meals", "₹220", "A full sadya-style plate."), ("Filter Coffee", "₹50", "Strong, frothy and sweet.")],
    "north indian": [("Rajma Chawal", "₹180", "Kidney beans with steamed rice."), ("Chole Bhature", "₹170", "Spicy chickpeas with fluffy bhature."), ("Tandoori Roti", "₹30", "Whole wheat, baked in the tandoor."), ("Lassi", "₹80", "Thick and chilled.")],
    "chinese": [("Veg Hakka Noodles", "₹190", "Wok-tossed with crunchy vegetables."), ("Chilli Chicken", "₹260", "Crisp chicken in a spicy sauce."), ("Manchow Soup", "₹120", "Hot, sour and crunchy."), ("Fried Rice", "₹180", "Egg, veg or chicken.")],
    "italian": [("Margherita Pizza", "₹320", "Tomato, mozzarella and fresh basil."), ("Penne Arrabbiata", "₹290", "Spicy tomato sauce and garlic."), ("Lasagna", "₹360", "Layers of pasta, ragu and cheese."), ("Tiramisu", "₹180", "Coffee-soaked classic dessert.")],
    "mexican": [("Veg Burrito", "₹240", "Beans, rice and salsa in a warm tortilla."), ("Nachos Supreme", "₹220", "Loaded with cheese and jalapeños."), ("Chicken Tacos", "₹280", "Three soft tacos with slaw."), ("Churros", "₹150", "Cinnamon sugar with chocolate dip.")],
    "thai": [("Green Curry", "₹300", "Coconut curry with Thai basil."), ("Pad Thai", "₹280", "Rice noodles, peanuts and lime."), ("Tom Yum Soup", "₹190", "Hot and sour with lemongrass."), ("Mango Sticky Rice", "₹190", "Sweet, warm and creamy.")],
    "continental": [("Grilled Chicken Steak", "₹420", "Herb butter with sautéed vegetables."), ("Creamy Mushroom Soup", "₹160", "Served with garlic bread."), ("Caesar Salad", "₹240", "Crisp romaine, parmesan and croutons."), ("Cheesecake", "₹200", "Baked New York style.")],
    "arabian": [("Chicken Shawarma", "₹180", "Wrapped with garlic sauce and pickles."), ("Mixed Grill Platter", "₹520", "Kebabs, tikka and hummus."), ("Hummus & Pita", "₹160", "Smooth chickpea dip."), ("Baklava", "₹150", "Honey, nuts and filo.")],
    "japanese": [("Veg Sushi Roll", "₹340", "Avocado, cucumber and pickled radish."), ("Chicken Ramen", "₹380", "Rich broth with noodles and egg."), ("Miso Soup", "₹140", "Warm and comforting."), ("Matcha Ice Cream", "₹180", "Smooth green tea flavour.")],
}
DEFAULT_DISHES = [("Chef's Special", "₹320", "Our signature dish of the day."), ("House Favourite", "₹260", "The one regulars keep ordering."), ("Seasonal Plate", "₹280", "Fresh, local and light."), ("Sweet Finish", "₹160", "A little something for dessert.")]


def _more(kind: str, t: str, brand: str, domain: str = "") -> list[dict] | None:
    """Sections for the page kinds that matter to specific businesses (checkout, order history, offers, cuisines ...)."""

    if kind in ("admin", "dashboard", "engagement"):
        from app.intake.blueprint import ADMIN_METRICS

        metrics = ADMIN_METRICS.get(domain, ADMIN_METRICS["services"])
        stats = _node("stats", "big", {"items": [{"value": v, "label": l} for v, l in metrics], "keep": True})
        if kind == "admin":
            return [_node("auth", "login-minimal", {"brand": brand + " admin", "heading": "Admin sign in", "subheading": "For the site owner and team only."})]
        if kind == "dashboard":
            return [
                _header(t, f"Everything happening on {brand}, at a glance."),
                stats,
                _node("catalog", "menu", {"heading": "Needs your attention", "subheading": "Latest activity from your site.", "items": [{"name": "New enquiries", "price": "5 new", "description": "Messages from the contact and booking forms.", "image": ""}, {"name": "Orders and bookings", "price": "12 today", "description": "Review, confirm or update their status.", "image": ""}, {"name": "Reviews and feedback", "price": "3 new", "description": "Read and reply to what customers say.", "image": ""}, {"name": "Site content", "price": "Manage", "description": "Edit pages, posts and offers.", "image": ""}], "keep": True}),
                _node("features", "checks", {"heading": "Manage your site", "subheading": "", "items": [{"title": "Postings and content", "text": "Review, edit or remove what is published on the site."}, {"title": "Customer messages", "text": "Every form submission is stored for you to follow up."}, {"title": "Team access", "text": "Only signed-in admins can see this area."}], "keep": True}),
            ]
        return [
            _header(t, "How visitors use your site, and what they think of it."),
            stats,
            _node("catalog", "menu", {"heading": "Most visited pages", "subheading": "Where your visitors spend their time.", "items": [{"name": "Home", "price": "48%", "description": "Share of visits.", "image": ""}, {"name": "Main offering", "price": "27%", "description": "Share of visits.", "image": ""}, {"name": "Contact", "price": "11%", "description": "Share of visits.", "image": ""}], "keep": True}),
            _node("testimonials", "wall", {"heading": "Latest feedback", "items": [{"quote": "Easy to use and quick to answer.", "name": "A visitor", "role": "This week"}], "keep": True}),
        ]
    if kind == "checkout":
        return [
            _header(t, "Review your order, add delivery details and pay securely."),
            _node("forms", "split", {"heading": "Delivery details", "subheading": "Where should we send your order? Payment happens securely with Razorpay."}),
            _node("features", "checks", {"heading": "Shop with confidence", "subheading": "", "items": [{"title": "Secure payment", "text": "UPI, cards and netbanking through Razorpay. We never see your card details."}, {"title": "Easy returns", "text": "Change your mind within 7 days and we'll refund you."}, {"title": "Order updates", "text": "You'll get a tracking number as soon as your order ships."}], "keep": True}),
            _node("faq", "twocol", {"heading": "Checkout questions", "items": [{"q": "Can I use a discount code?", "a": "Yes. Enter it in the cart before you pay."}, {"q": "Which payment methods can I use?", "a": "UPI, debit and credit cards and netbanking."}], "keep": True}),
        ]
    if kind == "orders":
        return [
            _header(t, "Everything you've ordered before, in one place."),
            _node("tracking", "default", {"heading": "Find your orders", "subheading": "Enter your email and order number to see an order and follow its progress."}),
            _node("catalog", "showcase", {"heading": "Order again", "subheading": "Your favourites are one tap away.", "items": [{"name": "Previous favourite", "price": "₹0", "description": "Items from your past orders appear here once you sign in.", "image": ""}], "keep": True}),
            _node("cta", "line", {"heading": "New here?", "subheading": "Create an account to keep your order history and reorder in seconds.", "button": "Create account", "keep": True}),
        ]
    if kind == "offers":
        return [
            _header(t, "Discounts and coupon codes you can use today."),
            _node("catalog", "tiles", {"heading": "Today's offers", "subheading": "Copy a code and apply it in the cart.", "items": [{"name": "WELCOME10", "price": "10% off", "description": "On your first order.", "image": ""}, {"name": "FREESHIP", "price": "Free delivery", "description": "On orders above ₹999.", "image": ""}, {"name": "COMBO15", "price": "15% off", "description": "When you order 3 or more items.", "image": ""}], "keep": True}),
            _node("cta", "banner", {"heading": "Never miss an offer", "subheading": "Subscribers hear about new discounts first.", "button": "Subscribe", "keep": True}),
            _node("faq", "twocol", {"heading": "About offers", "items": [{"q": "Can I combine codes?", "a": "One code per order."}, {"q": "Do offers expire?", "a": "Each offer shows its end date."}], "keep": True}),
        ]
    if kind == "cuisine":
        name = t.lower()
        if name in ("cuisine", "cuisines"):
            return [
                _header(t, f"Explore every cuisine at {brand}."),
                _node("catalog", "showcase", {"heading": "Choose a cuisine", "subheading": "Each one has its own menu.", "items": [{"name": c.title(), "price": "", "description": f"See the {c.title()} menu.", "image": ""} for c in ("north indian", "south indian", "chinese", "italian")], "keep": True}),
                _node("cta", "line", {"heading": "Can't decide?", "subheading": "Try the chef's tasting platter.", "button": "Order now", "keep": True}),
            ]
        dishes = DISHES.get(name, DEFAULT_DISHES)
        return [
            _header(t, f"{t} dishes, cooked fresh at {brand}."),
            _node("catalog", "menu", {"heading": f"{t} menu", "subheading": "Ordered by our guests most.", "items": [{"name": n, "price": p, "description": d, "image": ""} for n, p, d in dishes], "keep": True}),
            _node("testimonials", "wall", {"heading": "What guests say", "items": [{"quote": f"The {t} dishes are the reason we keep coming back.", "name": "Priya N.", "role": "Guest"}], "keep": True}),
            _node("cta", "line", {"heading": f"Craving {t}?", "subheading": "Order online or book a table.", "button": "Order online", "keep": True}),
        ]
    if kind == "quality":
        return [
            _header(t, "How we make sure every learner gets a real education."),
            _node("features", "checks", {"heading": "Our standards", "subheading": "", "items": [{"title": "Experienced faculty", "text": "Teachers with real industry and classroom experience."}, {"title": "Small batches", "text": "Enough attention for every student to ask questions."}, {"title": "Practical learning", "text": "Projects, labs and assessments, not only lectures."}, {"title": "Recognised certification", "text": "Certificates that employers and colleges accept."}, {"title": "Progress tracking", "text": "Regular tests and feedback shared with parents and students."}], "keep": True}),
            _node("stats", "big", {"items": [{"value": "95%", "label": "Pass rate"}, {"value": "15:1", "label": "Student to teacher ratio"}, {"value": "40+", "label": "Qualified faculty"}, {"value": "10 yrs", "label": "Of teaching"}], "keep": True}),
            _node("testimonials", "spotlight", {"heading": "In their words", "items": [{"quote": "The teaching quality made all the difference for my son.", "name": "A parent", "role": "Parent"}], "keep": True}),
        ]
    if kind == "admissions":
        return [
            _header(t, "Applying takes a few minutes. Here is how it works."),
            _node("timeline", "alternating", {"heading": "How to apply", "items": [{"date": "1", "title": "Enquire", "text": "Tell us which course you are interested in."}, {"date": "2", "title": "Talk to an advisor", "text": "We answer your questions and help you choose."}, {"date": "3", "title": "Apply", "text": "Fill in the short application form."}, {"date": "4", "title": "Start learning", "text": "Pay the fee and join your first class."}], "keep": True}),
            _node("forms", "booking", {"heading": "Apply or book a demo class", "subheading": "Pick a date and we'll confirm."}),
            _node("faq", "twocol", {"heading": "Admission questions", "items": [{"q": "What are the eligibility requirements?", "a": "Each course lists its own requirements."}, {"q": "Are scholarships available?", "a": "Yes, for eligible students. Ask an advisor."}], "keep": True}),
        ]
    if kind == "results":
        return [
            _header(t, "The outcomes our learners achieve."),
            _node("stats", "big", {"items": [{"value": "92%", "label": "Placed or promoted"}, {"value": "₹6.5L", "label": "Average starting package"}, {"value": "300+", "label": "Hiring partners"}, {"value": "4.8/5", "label": "Student rating"}], "keep": True}),
            _node("testimonials", "wall", {"heading": "Success stories", "items": [{"quote": "I got my first job offer within two months of finishing.", "name": "Divya M.", "role": "Graduate"}, {"quote": "The projects gave me the confidence I needed.", "name": "Sameer T.", "role": "Graduate"}], "keep": True}),
            _node("cta", "card", {"note": "", "heading": "Write your own success story", "subheading": "Join the next batch.", "button": "Enrol now", "keep": True}),
        ]
    if kind == "policy":
        return [
            _header(t, "The details, in plain language."),
            _node("faq", "sidebar", {"heading": t, "items": [{"q": "How does it work?", "a": "Everything you need to know is listed here. Contact us if something is unclear."}, {"q": "How long does it take?", "a": "Most requests are handled within a few working days."}, {"q": "Who do I contact?", "a": "Reach us from the Contact page and we'll help."}], "keep": True}),
        ]
    return None


SECTION_HEADINGS = {"shop": "All products", "catalog": "Explore", "faq": "Frequently asked questions", "team": "Meet the team", "testimonials": "What people say",
                    "features": "Highlights", "forms": "Get in touch", "pricing": "Plans", "timeline": "How it works", "stats": "", "tracking": "Find your order"}


def dedupe_headings(tree: list[dict], title: str) -> list[dict]:
    """The page header already shows the page title, so a section must not repeat it right underneath."""
    key = title.strip().lower()
    for node in tree:
        props = node.get("props", {})
        if node.get("type") in ("hero", "navbar", "footer", "auth", "chatbot"):
            continue
        heading = str(props.get("heading", "")).strip().lower()
        if heading and heading in (key, key + "s", key.rstrip("s")):
            props["heading"] = SECTION_HEADINGS.get(node.get("type", ""), "")
    return tree
