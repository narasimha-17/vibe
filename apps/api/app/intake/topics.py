"""What the interviewer needs to learn, how it asks, and how raw answers become structured facts."""

import re
from typing import Any

# key, label, question, example answers shown as chips, required
TOPICS: list[dict[str, Any]] = [
    {"key": "business", "label": "Business & idea", "required": True,
     "question": "What are you building, and what is your business or idea about?",
     "chips": ["A bakery that sells cakes online", "A clinic that takes appointments", "A course academy", "A travel agency"]},
    {"key": "name", "label": "Brand name", "required": True,
     "question": "What is the business or brand called? If you don't have a name yet, just say so and I'll suggest one.",
     "chips": ["I don't have a name yet"]},
    {"key": "objectives", "label": "Objectives", "required": True,
     "question": "What do you want this website to achieve? Think of the top one to three goals.",
     "chips": ["Get more customers", "Sell products online", "Collect enquiries and bookings", "Build trust and credibility"]},
    {"key": "audience", "label": "Audience", "required": True,
     "question": "Who will use it? Tell me about your visitors or customers.",
     "chips": ["Young families in Kerala", "Small business owners", "Students and parents", "Corporate travellers"]},
    {"key": "pain_points", "label": "Pain points", "required": True,
     "question": "What problems should it solve? What is painful or slow today?",
     "chips": ["Customers can't find our prices", "Too many phone calls for simple questions", "No way to take orders online", "Our current site looks outdated"]},
    {"key": "pages", "label": "Pages", "required": True,
     "question": "How many pages do you expect, and which ones? For example Home, Services, About, Contact.",
     "chips": ["5 pages: Home, Services, About, Pricing, Contact", "Home, Shop, Track order, Contact", "Home, Courses, Team, FAQ, Contact"]},
    {"key": "features", "label": "Features", "required": True,
     "question": "Which features must it have? Think of things visitors should be able to do.",
     "chips": ["Online payments and checkout", "Booking form", "Login and sign up", "Blog", "Order tracking", "Chatbot", "Reviews and ratings"]},
    {"key": "integrations", "label": "Integrations", "required": True,
     "question": "Do you need third-party apps connected, such as Razorpay, WhatsApp, Google Analytics, Instagram or an email tool?",
     "chips": ["Razorpay", "WhatsApp", "Google Analytics", "Instagram", "Mailchimp", "None for now"]},
    {"key": "scope", "label": "Scope & timeline", "required": True,
     "question": "What is in scope for the first version, and what can wait? Any deadline or budget I should know about?",
     "chips": ["Just the essentials for launch in 2 weeks", "Full site with payments in a month", "Start small, add later"]},
    {"key": "outcome", "label": "Success outcome", "required": True,
     "question": "How will you know it worked? What result do you want to see?",
     "chips": ["50 online orders a month", "100 enquiries a month", "Halve support calls", "Look professional to new customers"]},
    {"key": "style", "label": "Look & feel", "required": False,
     "question": "How should it look and feel? Any brands or sites you like?",
     "chips": ["Clean and minimal", "Premium and elegant", "Playful and colourful", "Bold and modern"]},
    {"key": "media", "label": "Logo & media", "required": False,
     "question": "Do you have a logo, or photos or videos you'd like on the site? You'll be able to upload them in the next step; for now, just tell me what you have and roughly where it should go (for example, the logo in the navbar, photos in the hero and gallery).",
     "chips": ["Yes, I have a logo", "I have product/business photos", "I have a video for the hero", "No media yet, use placeholders"]},
]

TOPIC_KEYS = [t["key"] for t in TOPICS]
BY_KEY = {t["key"]: t for t in TOPICS}
LIST_TOPICS = {"objectives", "pain_points", "features", "integrations"}

INTEGRATIONS: dict[str, tuple[str, ...]] = {
    "Razorpay": ("razorpay",),
    "Stripe": ("stripe",),
    "PayPal": ("paypal",),
    "WhatsApp": ("whatsapp", "whats app"),
    "Instagram": ("instagram", "insta"),
    "Facebook": ("facebook",),
    "YouTube": ("youtube",),
    "LinkedIn": ("linkedin",),
    "Google Analytics": ("google analytics", "analytics", "ga4"),
    "Google Maps": ("google maps", "maps", "map"),
    "Mailchimp": ("mailchimp",),
    "Zapier": ("zapier",),
    "Slack": ("slack",),
    "Calendly": ("calendly",),
    "Twilio SMS": ("twilio", "sms"),
    "Shiprocket": ("shiprocket", "delhivery", "courier partner"),
    "Google Sheets": ("google sheets", "sheets"),
    "Email provider": ("sendgrid", "email service", "smtp", "mailgun", "ses"),
}

NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "twelve": 12}
NONE_WORDS = ("none", "nothing", "no integrations", "not needed", "skip", "n/a", "no need")


def split_items(text: str) -> list[str]:
    parts = re.split(r"[\n;,]|\band\b|\b&\b|•|- ", text)
    out, seen = [], set()
    for part in parts:
        item = part.strip(" .:-*•\t")
        if len(item) >= 2 and item.lower() not in seen:
            seen.add(item.lower())
            out.append(item[:160])
    return out[:20]


def clean_page_name(item: str) -> str:
    """"Home – Clinic introduction" -> "Home", "Appointment CTA" -> "Appointment", "The Pricing page" -> "Pricing",
    "1. **Home**" -> "Home" (a numbered, markdown-bold outline line, as a model-written plan sometimes comes in)."""
    item = re.sub(r"^\s*(?:\d+[.)]|[-*•])\s*", "", item.strip())  # a leading "1. " or "- " list marker
    item = re.sub(r"\*\*(.+?)\*\*", r"\1", item).replace("**", "").replace("__", "")  # markdown bold
    name = re.split(r"\s+[–—-]\s+|\s*[(:]", item.strip(), maxsplit=1)[0]
    # "Website will include Home" / "It should have a Blog" / "and Contact": keep only the page's own name
    name = re.sub(r"^(?:the\s+)?(?:website|site|app|it|we)\s+(?:will\s+|should\s+|must\s+|would\s+)?(?:also\s+)?"
                  r"(?:include|includes|have|has|contain|contains|need|needs|feature|features)\s+", "", name, flags=re.I)
    name = re.sub(r"^(?:and|also|plus)\s+", "", name, flags=re.I)
    name = re.sub(r"^(?:a|an|the|our|my)\s+", "", name, flags=re.I)
    name = re.sub(r"\s+(?:pages?|sections?|cta|blocks?|screens?)$", "", name, flags=re.I).strip(" .,-")
    if name.lower().startswith("home"):
        return "Home"
    return name[:1].upper() + name[1:] if name else ""


# A line that starts a numbered ("1.", "1)") or bulleted ("-", "*", "•") outline item.
OUTLINE_LINE = re.compile(r"^\s*(?:\d+[.)]|[-*•])\s+\S")


def _outline_pages(text: str) -> list[str] | None:
    """When the answer is a multi-line outline (a model-written site plan, one page per numbered line, each followed
    by that page's own sections or features), the page names are the line starts, not every word in the whole
    answer — the words after a dash/colon on each line describe that ONE page, not separate pages of their own.
    Returns the page names in order, or None when the text isn't structured like this."""
    lines = [l for l in text.splitlines() if l.strip()]
    outline = [l for l in lines if OUTLINE_LINE.match(l)]
    if len(outline) < 2:
        return None
    names = []
    for line in outline:
        cleaned = clean_page_name(line)
        if cleaned and len(cleaned.split()) <= 5 and cleaned not in names:
            names.append(cleaned)
    return names or None


def parse_pages(text: str) -> dict:
    low = text.lower()
    count = None
    m = re.search(r"(\d+)\s*(?:\+)?\s*(?:pages?|screens?)", low) or re.search(r"\b(" + "|".join(NUMBER_WORDS) + r")\s+pages?", low)
    if m:
        g = m.group(1)
        count = int(g) if g.isdigit() else NUMBER_WORDS[g]
    outline = _outline_pages(text)
    if outline is not None:
        return {"count": count or len(outline), "names": outline[:15]}
    body = text.split(":", 1)[1] if ":" in text else text
    # "... and an admin panel to manage Packages, Reviews, Payments": what an admin manages are features, not pages.
    managed = re.search(r"\b(?:admin|owner|staff)?\s*(?:panel|dashboard|area|backend)?\s*(?:to|that can|where (?:we|i) can|for)\s+manag(?:e|ing)\b", body, re.I)
    if managed:
        before = re.sub(r"[,\s]*(?:\b(?:and|with|plus)\b\s*)?(?:\b(?:an?|the)\b\s*)?$", "", body[:managed.start()], flags=re.I)
        body = before + (", Admin" if re.search(r"\badmin\b", body[max(0, managed.start() - 40):managed.end()], re.I) else "")
    names = []
    for item in split_items(body):
        if re.fullmatch(r"\d+|pages?|about \d+ pages?|\d+ pages?.*", item.lower()):
            continue
        cleaned = clean_page_name(item)
        if cleaned and len(cleaned.split()) <= 4 and cleaned not in names:
            names.append(cleaned)
    return {"count": count or (len(names) or None), "names": names[:15]}


def parse_integrations(text: str) -> list[str]:
    low = text.lower()
    if any(w in low for w in NONE_WORDS) and len(low) < 60:
        return []
    found = [name for name, keys in INTEGRATIONS.items() if any(re.search(r"\b" + re.escape(k) + r"\b", low) for k in keys)]
    extras = [i for i in split_items(text) if not any(i.lower() in (k for keys in INTEGRATIONS.values() for k in keys) or n.lower() in i.lower() for n in INTEGRATIONS) and len(i.split()) <= 4]
    return found + [e for e in extras if e not in found][:5]


def parse(topic: str, text: str) -> Any:
    """Turns a free-text answer into the shape stored in memory for this topic."""
    text = text.strip()
    if topic == "pages":
        return parse_pages(text)
    if topic == "integrations":
        return parse_integrations(text)
    if topic in LIST_TOPICS:
        return split_items(text) or [text[:160]]
    return text[:600]


def is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, dict):
        return bool(value.get("names") or value.get("count"))
    if isinstance(value, list):
        return True  # an empty list is a valid answer for integrations ("none")
    return bool(str(value).strip())
