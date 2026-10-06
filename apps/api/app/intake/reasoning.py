"""The interviewer's reasoning: it reads what the user says, works out what it still needs to know, and asks about that.

Instead of walking a fixed list of questions, the agent keeps an agenda. Each thing the user mentions (a payment
integration, bookings, login, a shop, a chatbot ...) is a *concept*. A concept brings its own clarifying questions:
"payments" leads to "which provider?", "what are customers paying for?", "which payment methods?". Answers become
details in memory, and can change what the site needs (choosing Razorpay adds it to the integrations, for example).

Everything here is rules and lookups, so it is instant, works offline and does not depend on a model.
"""

import re
from typing import Any

from app.intake.topics import INTEGRATIONS, parse_integrations

GATEWAYS = ("Razorpay", "Stripe", "PayPal")
MAX_AGENDA = 9  # never turn the conversation into an interrogation


def _q(qid: str, concept: str, label: str, question: str, chips: list[str]) -> dict:
    return {"id": qid, "concept": concept, "label": label, "question": question, "chips": chips}


QUESTIONS: dict[str, dict] = {q["id"]: q for q in [
    _q("pay_provider", "payments", "Payment provider", "Which payment provider should handle the money? Razorpay is built in and covers UPI, cards and netbanking in India. Stripe and PayPal suit international customers.", ["Razorpay", "Stripe", "PayPal", "Not sure, recommend one"]),
    _q("pay_what", "payments", "Customers pay for", "What will customers be paying for?", ["One-time purchases", "Subscriptions or memberships", "Booking deposits", "Donations"]),
    _q("pay_methods", "payments", "Payment methods", "Which payment methods should they see at checkout?", ["UPI", "Debit and credit cards", "Netbanking", "Wallets", "Cash on delivery"]),
    _q("book_what", "booking", "Bookings are for", "What are people booking on your site?", ["Appointments", "Table reservations", "Rooms or stays", "Classes or sessions", "Consultations"]),
    _q("book_flow", "booking", "Booking flow", "Should visitors pick a date and time slot themselves, or send a request that you confirm?", ["They pick a slot", "They send a request", "Both"]),
    _q("book_notify", "booking", "Booking notifications", "How should you and your customer be notified about a booking?", ["Email", "WhatsApp", "SMS", "Just show it in a dashboard"]),
    _q("book_deposit", "booking", "Payment to confirm", "Does confirming a booking need any payment, or is it free to book?", ["No payment needed to book", "A deposit is required", "Full payment upfront"]),
    _q("shop_catalog_access", "shop", "Browsing the catalogue", "Should anyone be able to browse and see prices, or do visitors need to log in first to view the catalogue?", ["Anyone can browse and see prices", "Login required to browse", "Anyone can browse, login only to see prices"]),
    _q("shop_checkout_login", "shop", "Checkout", "To place an order, should customers create an account, or can they check out as a guest?", ["Guest checkout, no account needed", "Account required to order", "Guest checkout, account offered afterwards"]),
    _q("shop_size", "shop", "Catalogue size", "Roughly how many products will you list at launch?", ["Under 10", "10 to 50", "50 to 500", "500 or more"]),
    _q("shop_ship", "shop", "Fulfilment", "How will customers receive their orders?", ["Home delivery", "Store pickup", "Both", "Digital downloads"]),
    _q("shop_cod", "shop", "Payment on delivery", "Should Cash on Delivery be an option, or is payment online only?", ["Cash on delivery allowed", "Online payment only", "Offer both"]),
    _q("shop_extras", "shop", "Shop extras", "Do you want any of these in the shop?", ["Discount codes", "Product reviews", "Wishlist", "Order tracking", "Low-stock alerts"]),
    _q("auth_who", "accounts", "Who signs in", "Who will log in to the site?", ["Customers", "Staff or admins", "Students", "Members"]),
    _q("auth_how", "accounts", "Sign-in method", "How should they sign in?", ["Email and password", "Phone number with OTP", "Google sign-in"]),
    _q("auth_otp_use", "accounts", "Where OTP applies", "You mentioned OTP sign-in with a phone number \u2014 should that be the only way in, or should there also be an email/password option for people who prefer it?", ["Phone OTP only", "Phone OTP and email/password", "OTP just to verify orders, not full accounts"]),
    _q("chat_job", "chatbot", "Chatbot's job", "What should the chatbot take care of?", ["Answer common questions", "Take orders", "Book appointments", "Collect leads", "Hand over to a person"]),
    _q("blog_plan", "blog", "Blog plan", "Who will write the posts, and how often?", ["Just me, weekly", "A small team, weekly", "Occasionally, monthly"]),
    _q("track_what", "tracking", "Tracking shows", "What should customers see when they track an order?", ["Order status", "Live location", "Delivery time estimate", "Courier link"]),
    _q("track_login", "tracking", "Looking up an order", "To track an order, is the order number enough, or should it also need the customer to be logged in?", ["Order number is enough", "Requires login", "Order number plus email or phone"]),
    _q("lang_which", "languages", "Languages", "Which languages should the site support?", ["English only", "English and Hindi", "English and Malayalam", "English and Tamil"]),
    _q("admin_what", "admin", "Manage yourself", "What do you want to manage yourself after launch?", ["Products and stock", "Orders", "Bookings", "Blog posts", "Customers"]),
    _q("plans_bill", "plans", "Plans and billing", "What plans will you offer and how are they billed?", ["Monthly", "Yearly", "One-time payment", "Free plus paid tiers"]),
    _q("social_which", "social", "Social accounts", "Which social accounts should the site link to or connect?", ["WhatsApp", "Instagram", "Facebook", "YouTube", "LinkedIn"]),
    _q("lead_where", "leads", "Enquiries go to", "Where should enquiries and contact-form messages go?", ["My email", "WhatsApp", "A CRM", "Just store them in the dashboard"]),
    _q("gallery_what", "gallery", "Gallery content", "What will the gallery or portfolio show?", ["Product photos", "Past projects", "Before and after", "Videos"]),
]}

# concept id, trigger pattern, acknowledgement, the questions it brings (in order)
CONCEPTS: list[tuple[str, str, str, list[str]]] = [
    ("payments", r"\b(pay(ment)?s?|checkout|razorpay|stripe|paypal|upi|mastercard|visa|credit card|debit card|net ?banking|transaction|billing|invoice)\b", "Payments need a few decisions, so let me get those right.", ["pay_provider", "pay_what", "pay_methods"]),
    ("booking", r"\b(book(ing|ings)?|appointments?|reserv\w*|schedul\w*|time ?slots?)\b", "Bookings are a key part of this, so a few details.", ["book_what", "book_flow", "book_notify", "book_deposit"]),
    ("shop", r"\b(shop|store|e-?commerce|sell(ing)?|products?|catalog(ue)?|inventory|cart|orders?)\b", "An online shop has a few moving parts \u2014 and a couple of things worth deciding now rather than after launch.", ["shop_catalog_access", "shop_checkout_login", "shop_size", "shop_ship", "shop_cod", "shop_extras"]),
    ("accounts", r"\b(log ?in|sign ?in|sign ?up|register|accounts?|members?|profiles?|passwords?)\b", "Accounts come with some choices.", ["auth_who", "auth_how"]),
    ("chatbot", r"\b(chat ?bot|live chat|assistant|support bot|chat widget)\b", "A chatbot is a nice touch.", ["chat_job"]),
    ("tracking", r"\b(track(ing)?|shipment|order status|delivery status|parcel)\b", "Tracking is useful, so let me check what to show.", ["track_what", "track_login"]),
    ("blog", r"\b(blog|articles?|news|newsletter|posts?)\b", "A blog needs a plan behind it.", ["blog_plan"]),
    ("languages", r"\b(multi-?lingual|languages?|hindi|malayalam|tamil|telugu|kannada|translat\w*)\b", "Language support changes the design a bit.", ["lang_which"]),
    ("admin", r"\b(admin|dashboard|manage|cms|backend)\b", "Managing the site yourself matters.", ["admin_what"]),
    ("plans", r"\b(subscriptions?|memberships?|pricing plans?|plans)\b", "Plans are worth pinning down.", ["plans_bill"]),
    ("social", r"\b(whatsapp|instagram|facebook|youtube|linkedin|social)\b", "Social links help people trust you.", ["social_which"]),
    ("leads", r"\b(leads?|enquir\w*|inquir\w*|contact form)\b", "Enquiries should never get lost.", ["lead_where"]),
    ("gallery", r"\b(gallery|portfolio|showcase|photos?)\b", "A gallery works best when it's planned.", ["gallery_what"]),
]
CONCEPT_BY_ID = {c[0]: c for c in CONCEPTS}


def _details(mem: Any) -> list[str]:
    return mem.data.setdefault("details", [])


def _agenda(mem: Any) -> list[str]:
    return mem.data.setdefault("_agenda", [])


def _asked(mem: Any) -> list[str]:
    return mem.data.setdefault("_asked", [])


def _skip(qid: str, mem: Any, text: str) -> bool:
    low = text.lower()
    integrations = mem.data.get("integrations") or []
    if qid == "pay_provider" and (any(g in integrations for g in GATEWAYS) or any(g.lower() in low for g in GATEWAYS)):
        return True
    if qid == "auth_how" and re.search(r"\b(otp|google sign|email and password)\b", low):
        return True
    if qid == "auth_otp_use" and "otp" not in " ".join(_details(mem)).lower() and "otp" not in low:
        return True  # only relevant once OTP sign-in has actually come up
    return False


def detect(text: str, mem: Any) -> list[str]:
    """Finds concepts in what the user just said and queues their questions. Returns the concepts that were new."""
    new: list[str] = []
    agenda, asked = _agenda(mem), _asked(mem)
    added = 0
    for cid, pattern, _ack, qids in CONCEPTS:
        if cid in asked or not re.search(pattern, text, re.I):
            continue
        asked.append(cid)
        new.append(cid)
        for qid in qids:
            if not _skip(qid, mem, text) and qid not in agenda and len(agenda) < MAX_AGENDA and added < MAX_AGENDA:
                agenda.append(qid)
                added += 1
    mem.data["_new_concepts"] = new
    return new


def provider_question(mem: Any, text_seen: str = "") -> str:
    """Payment provider question, phrased around what the user actually said (for example Mastercard)."""
    low = (text_seen + " " + " ".join(_details(mem))).lower()
    if re.search(r"mastercard|visa|credit card|debit card|\bcards?\b", low):
        return "Card payments such as Mastercard and Visa are processed through a payment gateway. Which one do you want? Razorpay is built in and works well in India; Stripe suits international customers."
    return QUESTIONS["pay_provider"]["question"]


def next_question(mem: Any, last_text: str = "") -> tuple[str, str, str] | None:
    """The next queued clarification as (question id, acknowledgement, question), or None."""
    agenda = _agenda(mem)
    if not agenda:
        return None
    qid = agenda.pop(0)
    q = QUESTIONS[qid]
    question = provider_question(mem, last_text) if qid == "pay_provider" else q["question"]
    concepts = mem.data.get("_new_concepts") or []
    ack = CONCEPT_BY_ID[q["concept"]][2] if q["concept"] in concepts else ""
    return qid, ack, question


def apply_answer(qid: str, answer: str, mem: Any) -> None:
    """Stores an answer to a clarifying question, and lets it change the requirements where it should."""
    q = QUESTIONS.get(qid)
    if not q:
        return
    _details(mem).append(f"{q['label']}: {answer.strip()[:200]}")
    if qid == "pay_provider":
        picked = [g for g in parse_integrations(answer) if g in INTEGRATIONS]
        if picked:
            mem.remember("integrations", ", ".join(picked))
    if qid == "social_which":
        picked = [g for g in parse_integrations(answer) if g in INTEGRATIONS]
        if picked:
            mem.remember("integrations", ", ".join(picked))
    if qid == "lead_where" and re.search(r"whats\s?app", answer, re.I):
        mem.remember("integrations", "WhatsApp")
    if qid == "auth_how" and re.search(r"\botp\b", answer, re.I):
        agenda = _agenda(mem)
        if "auth_otp_use" not in agenda and "auth_otp_use" not in _asked(mem) and len(agenda) < MAX_AGENDA:
            agenda.insert(0, "auth_otp_use")  # ask it right away, while OTP is still the topic


def chips_for(qid: str) -> list[str]:
    q = QUESTIONS.get(qid)
    return list(q["chips"]) if q else []


# ───────────────────────── contextual feature question ─────────────────────────
FEATURE_IDEAS: dict[str, list[str]] = {
    "bakery": ["Online ordering and checkout", "Custom cake requests", "Delivery slot picker", "Order tracking", "Reviews and photos", "WhatsApp chat"],
    "restaurant": ["Online ordering", "Table reservations", "Menu with photos", "Delivery tracking", "Reviews", "Event enquiries"],
    "clinic": ["Appointment booking", "Doctor profiles", "Patient login", "Reminders by SMS or WhatsApp", "Service and price list", "Health blog"],
    "academy": ["Course catalogue", "Enrolment and payment", "Student login", "Free demo class booking", "Mentor profiles", "Certificates"],
    "realestate": ["Property listings with photos", "Site visit booking", "Enquiry form", "Location map", "Price and area details", "WhatsApp chat"],
    "travel": ["Trip enquiry form", "Destination pages", "Booking with deposit", "Itinerary downloads", "Reviews", "WhatsApp chat"],
    "logistics": ["Shipment tracking", "Instant quote form", "Business account login", "Pickup scheduling", "Service areas", "Support chat"],
    "blog": ["Newsletter signup", "Categories and search", "Comments", "Author pages", "Share buttons", "Reading time"],
    "retail": ["Online shop with checkout", "Search and filters", "Reviews and ratings", "Wishlist", "Order tracking", "Discount codes"],
    "services": ["Contact and quote form", "Booking", "Case studies", "Testimonials", "Blog", "Live chat"],
}


def feature_question(mem: Any) -> tuple[str, list[str]]:
    from app.intake.content import PACKS, detect_pack

    key = detect_pack(mem.data)
    ideas = FEATURE_IDEAS.get(key, FEATURE_IDEAS["services"])
    noun = PACKS[key]["noun"].lower()
    return (f"Which features should your {noun} website include? For this kind of site, people often want: {', '.join(ideas[:4])}. Pick any that fit, or describe your own.", ideas)
