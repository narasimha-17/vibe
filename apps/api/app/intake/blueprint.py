"""Site blueprint: from what the business is, work out which pages the website needs and why.

The interviewer's answers say what the user wants. This module reasons about how that kind of website works
(what a shopper needs, what a diner needs, what a parent or student needs) and turns it into a list of pages.

  core       pages the site cannot work without. They are created automatically.
  suggested  useful pages the user can tick on the review screen.

Every site also gets an admin area (sign in, dashboard, engagement) so the owner can watch what happens on it.
"""

import re
from typing import Any

from app.intake.content import PACKS, detect_pack
from app.projects.page_factory import CUISINES, kind_for

Page = tuple[str, str]  # name, reason


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


def domain_of(memory: dict) -> str:
    pack = detect_pack(memory)
    low = _text(memory)
    if pack == "bakery":
        return "ecommerce" if re.search(r"\b(sell|online|order|pay|shop|deliver|cart)\w*", low) else "restaurant"
    return {"retail": "ecommerce"}.get(pack, pack)


def cuisines_in(memory: dict) -> list[str]:
    low = _text(memory)
    found = [c for c in CUISINES[:14] if re.search(r"\b" + re.escape(c) + r"\b", low)]
    # "indian" is implied by "south indian" / "north indian"
    return [c for c in found if not (c == "indian" and ("south indian" in found or "north indian" in found))]


BLUEPRINTS: dict[str, dict[str, list[Page]]] = {
    "ecommerce": {
        "core": [
            ("Shop", "Where visitors browse, search and filter every product."),
            ("Checkout", "Where customers review the cart, enter delivery details and pay."),
            ("Track order", "So customers can see where their order is without calling you."),
            ("My orders", "Order history, so returning customers can see what they bought and reorder."),
        ],
        "suggested": [
            ("Offers", "A home for discounts and coupon codes."),
            ("Login", "Accounts let customers keep their orders and addresses."),
            ("Shipping & returns", "Clear delivery and return rules reduce support questions."),
            ("Reviews", "Reviews and feedback build trust with new shoppers."),
            ("FAQ", "Answers the questions that would otherwise reach you by phone."),
            ("About", "Tell people who is behind the shop."),
            ("Contact", "A way to reach you."),
        ],
    },
    "restaurant": {
        "core": [
            ("Menu", "Everything you serve, with prices."),
            ("Order online", "Diners order for delivery or pickup."),
            ("Checkout", "Where diners confirm the order and pay."),
            ("My orders", "Previous orders, so regulars can order the same meal again in a tap."),
            ("Reviews", "Reviews and feedback from guests."),
        ],
        "suggested": [
            ("Track order", "Diners can follow their delivery."),
            ("Reservations", "Let guests book a table."),
            ("Offers", "Discounts and combo deals."),
            ("Gallery", "Photos make people hungry."),
            ("About", "The story behind the kitchen."),
            ("Contact", "Location, hours and phone."),
        ],
    },
    "academy": {
        "core": [
            ("Courses", "What you teach, for whom and how long each course runs."),
            ("Our quality", "Shows parents and students the quality of teaching, faculty, standards and certification."),
            ("Faculty", "People choose a school by its teachers."),
            ("Results", "Placements, pass rates and success stories are the proof."),
            ("Admissions", "A clear path from enquiry to enrolment."),
        ],
        "suggested": [
            ("Fees", "Transparent fees answer the first question everyone asks."),
            ("Student login", "A portal for students to see classes and progress."),
            ("Reviews", "Feedback from students and parents."),
            ("Blog", "Study tips and news keep the site fresh."),
            ("FAQ", "Answers to common admission questions."),
            ("Contact", "Enquiries and demo classes."),
        ],
    },
    "clinic": {
        "core": [
            ("Services", "The treatments and check-ups you offer."),
            ("Doctors", "Patients want to know who will treat them."),
            ("Book appointment", "The main action on a clinic site."),
            ("Reviews", "Patient feedback builds trust."),
        ],
        "suggested": [
            ("Patient login", "Reports and appointment history."),
            ("Insurance", "Which insurers and payment options you accept."),
            ("FAQ", "What to bring, timings and fees."),
            ("Contact", "Location, hours and emergency contact."),
        ],
    },
    "realestate": {
        "core": [
            ("Properties", "Listings with photos, price, area and location."),
            ("Site visit", "Buyers pick a slot to see a property."),
            ("About", "Who you are and how long you've been in the market."),
            ("Contact", "Enquiries, phone and WhatsApp."),
        ],
        "suggested": [
            ("Locations", "The areas you cover, so buyers can browse by place."),
            ("Testimonials", "Stories from buyers build trust for big purchases."),
            ("FAQ", "Documents, loans and registration questions."),
        ],
    },
    "travel": {
        "core": [
            ("Destinations", "Where you take people."),
            ("Packages", "Ready-made trips with prices."),
            ("Enquiry", "Travellers ask for a customised plan."),
            ("Reviews", "Traveller stories are your best advertising."),
        ],
        "suggested": [
            ("Visa help", "Reassures international travellers."),
            ("Offers", "Seasonal deals and early-bird discounts."),
            ("Blog", "Travel guides bring in search traffic."),
            ("Contact", "A quick way to reach a planner."),
        ],
    },
    "logistics": {
        "core": [
            ("Services", "The delivery and freight options you offer."),
            ("Get a quote", "Businesses want a price fast."),
            ("Track order", "Customers track a shipment with its number."),
            ("Coverage", "Where you deliver."),
        ],
        "suggested": [
            ("Business login", "Business accounts and bulk booking."),
            ("FAQ", "Restricted items, timing and insurance."),
            ("Contact", "Support contact."),
        ],
    },
    "blog": {
        "core": [("Blog", "Where your writing lives."), ("About", "Who is writing."), ("Contact", "How readers reach you.")],
        "suggested": [("Subscribe", "Grow a newsletter."), ("Archive", "Find older posts.")],
    },
    "services": {
        "core": [("Services", "What you do."), ("Work", "Proof of past results."), ("About", "The people behind the work."), ("Contact", "How to start.")],
        "suggested": [("Pricing", "Clear pricing filters out bad fits."), ("Reviews", "Client testimonials."), ("FAQ", "Common questions."), ("Blog", "Show your expertise.")],
    },
}

# What the owner monitors, by kind of business. Used by the admin dashboard and engagement pages.
ADMIN_METRICS: dict[str, list[tuple[str, str]]] = {
    "ecommerce": [("142", "Orders this month"), ("₹2.8L", "Revenue"), ("6", "Low-stock items"), ("3.1%", "Visit to order")],
    "restaurant": [("96", "Orders this week"), ("28", "Table bookings"), ("4.7/5", "Average rating"), ("12", "New reviews")],
    "academy": [("64", "New enquiries"), ("18", "Admissions"), ("9", "Demo classes booked"), ("4.8/5", "Student rating")],
    "clinic": [("52", "Appointments this week"), ("11", "New patients"), ("4", "Cancellations"), ("4.9/5", "Patient rating")],
    "realestate": [("46", "Property enquiries"), ("19", "Site visits booked"), ("5", "Deals closed"), ("3.2K", "Listing views")],
    "travel": [("38", "Trip enquiries"), ("12", "Bookings"), ("₹9.4L", "Booked value"), ("4.9/5", "Traveller rating")],
    "logistics": [("1,204", "Shipments this week"), ("98%", "On-time rate"), ("23", "Quote requests"), ("7", "Open complaints")],
    "blog": [("12.4K", "Reads this month"), ("318", "New subscribers"), ("4", "Posts published"), ("42%", "Returning readers")],
    "services": [("37", "New enquiries"), ("9", "Proposals sent"), ("4", "Projects won"), ("2.4K", "Site visitors")],
}

ADMIN_PAGES: list[Page] = [
    ("Admin login", "The owner signs in here to manage the site. It is separate from customer login."),
    ("Dashboard", "One place for the owner to see orders, enquiries, postings and what needs attention."),
    ("Engagement", "Shows how visitors use the site: visits, popular pages, reviews and feedback."),
]

PROMOTE = {  # a page moves from suggested to core when the user mentioned it
    "Offers": ("discount", "offer", "coupon", "promo", "deal"),
    "Reservations": ("reserv", "table", "book a table"),
    "Track order": ("track",),
    "Login": ("login", "sign in", "account", "register"),
    "Reviews": ("review", "feedback", "rating"),
    "Blog": ("blog", "article"),
    "Fees": ("fee", "price", "cost"),
    "Student login": ("student login", "portal"),
    "Patient login": ("patient login", "portal", "reports"),
    "Gallery": ("gallery", "photo"),
    "Visa help": ("visa",),
}


def blueprint(memory: dict) -> dict[str, Any]:
    """The pages this business needs: {domain, cuisines, core, suggested, admin, metrics}."""
    domain = domain_of(memory)
    plan = BLUEPRINTS.get(domain, BLUEPRINTS["services"])
    low = _text(memory)
    core = list(plan["core"])
    suggested: list[Page] = []
    for name, why in plan["suggested"]:
        if any(w in low for w in PROMOTE.get(name, ())):
            core.append((name, why))
        else:
            suggested.append((name, why))

    if domain == "restaurant":
        cuisines = cuisines_in(memory)
        if cuisines:
            core = [(n, w) for n, w in core if n != "Menu"]
            core.insert(0, ("Cuisines", "An overview of every cuisine you serve, so diners can pick what they feel like."))
            for c in cuisines[:6]:
                core.insert(1, (c.title(), f"A menu page for {c.title()} dishes."))
        elif re.search(r"multi[- ]?cuisine|cuisines", low):
            core = [(n, w) for n, w in core if n != "Menu"]
            core.insert(0, ("Cuisines", "You serve several cuisines, so diners choose one first."))
    else:
        cuisines = []

    return {"domain": domain, "cuisines": cuisines, "core": core, "suggested": suggested, "admin": ADMIN_PAGES, "metrics": ADMIN_METRICS.get(domain, ADMIN_METRICS["services"])}


def covered(name: str, existing: list[str]) -> bool:
    """A page is covered when one with the same name, or the same purpose, already exists."""
    low = name.lower()
    kind = kind_for(name)
    for other in existing:
        if other.lower() == low:
            return True
        if kind not in ("generic", "cuisine", "listing", "services") and kind_for(other) == kind:
            return True
    return False
