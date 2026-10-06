"""Industry templates for the marketplace: e-commerce, travel & agency, healthcare, education, logistics, blogs.

Each industry has two templates that differ in structure and components, not just colour.
"""

from app.projects.templates import _node

FOOTER = lambda brand, right="Privacy · Terms · Contact": _node("footer", "columns", {"brand": brand, "left": f"© 2026 {brand}", "right": right})  # noqa: E731


def _page(name: str, path: str, tree: list[dict], home: bool = False) -> dict:
    return {"name": name, "path": path, "is_home": home, "tree": tree}


def _chat(bot: str, brand: str, knowledge: list[dict], variant: str = "widget", quick: list[str] | None = None) -> dict:
    return _node(
        "chatbot",
        variant,
        {
            "botName": bot,
            "brand": brand,
            "greeting": f"Hi! I'm {bot}. How can I help?",
            "placeholder": "Type your question…",
            "fallback": "I'm not sure yet. Leave your email and our team will reply soon.",
            "quickReplies": quick or ["Timings", "Pricing", "Talk to a person"],
            "knowledge": knowledge,
        },
    )


EXTRA_TEMPLATES: dict[str, dict] = {
    # ───────────── E-commerce ─────────────
    "ecom-atelier": {
        "label": "Atelier Store",
        "description": "Boutique online store: filterable shop, reviews, cart, Razorpay checkout and order tracking.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "twotier", {"brand": "Atelier Nord", "links": ["Shop", "Journal", "About", "Contact"], "loginLabel": "Login"}),
                _node("hero", "centered", {"headline": "Objects made to be kept.", "subheadline": "Small-batch homeware and stationery, delivered across India.", "primaryCta": "Shop the edit", "secondaryCta": "Our story"}),
                _node("shop", "sidebar", {"heading": "Shop", "products": [
                    {"name": "Everyday Tote", "price": "1999", "category": "Bags", "stock": 20, "description": "A durable carryall made for daily movement.", "image": ""},
                    {"name": "Studio Mug", "price": "899", "category": "Home", "stock": 15, "description": "Hand-finished ceramic with a soft matte glaze.", "image": ""},
                    {"name": "Field Notes", "price": "499", "category": "Stationery", "stock": 40, "description": "A pocket notebook for ideas worth keeping.", "image": ""},
                    {"name": "Linen Throw", "price": "2499", "category": "Home", "stock": 8, "description": "Stonewashed linen, soft from day one.", "image": ""},
                ]}),
                _node("testimonials", "rating", {"heading": "Loved by our customers", "items": [
                    {"quote": "Beautiful quality, arrived in two days.", "name": "Asha K.", "role": "Kochi"},
                    {"quote": "The tote is my daily bag now.", "name": "Rohan M.", "role": "Bengaluru"}]}),
                _node("cta", "banner", {"heading": "Free shipping over ₹999", "subheading": "Easy 7-day returns on every order.", "button": "Start shopping"}),
                FOOTER("Atelier Nord"),
                _chat("Aria", "Atelier Nord", [
                    {"q": "shipping delivery time", "a": "We ship within 24 hours and deliver in 2 to 5 days across India."},
                    {"q": "return refund exchange", "a": "You can return any unused item within 7 days for a full refund."},
                    {"q": "payment methods upi card", "a": "We accept UPI, cards and netbanking through Razorpay."}]),
            ], True),
            _page("Track order", "/track", [
                _node("navbar", "twotier", {"brand": "Atelier Nord", "links": ["Shop", "Journal", "About", "Contact"]}),
                _node("tracking", "default", {"heading": "Where is my order?"}),
                FOOTER("Atelier Nord"),
            ]),
        ],
    },
    "ecom-market": {
        "label": "Neon Market",
        "description": "Bold marketplace layout: bento hero, product tiles, top filter bar, FAQ and newsletter.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "search", {"brand": "Neon Market", "links": ["Deals", "New", "Brands"], "loginLabel": "Sign in"}),
                _node("hero", "bento", {"headline": "Everything you want, in one grid.", "subheadline": "Gadgets, gear and gifts with fast delivery.", "primaryCta": "Browse deals", "secondaryCta": "See new arrivals"}),
                _node("catalog", "tiles", {"heading": "Trending now", "subheading": "What everyone is buying this week.", "items": [
                    {"name": "Wireless Earbuds", "price": "₹2,999", "description": "30-hour battery, low latency.", "image": ""},
                    {"name": "Smart Lamp", "price": "₹1,799", "description": "Sunrise alarm and warm dimming.", "image": ""},
                    {"name": "Desk Mat XL", "price": "₹1,299", "description": "Vegan leather, spill-proof.", "image": ""}]}),
                _node("shop", "top", {"heading": "All products", "products": [
                    {"name": "Wireless Earbuds", "price": "2999", "category": "Audio", "stock": 25, "description": "30-hour battery, low latency.", "image": ""},
                    {"name": "Smart Lamp", "price": "1799", "category": "Home", "stock": 18, "description": "Sunrise alarm and warm dimming.", "image": ""},
                    {"name": "Desk Mat XL", "price": "1299", "category": "Desk", "stock": 40, "description": "Vegan leather, spill-proof.", "image": ""},
                    {"name": "Mechanical Keyboard", "price": "5499", "category": "Desk", "stock": 10, "description": "Hot-swap switches, wireless.", "image": ""}]}),
                _node("faq", "twocol", {"heading": "Shopping questions", "items": [
                    {"q": "How fast is delivery?", "a": "Most orders arrive in 2 to 4 days."},
                    {"q": "Can I track my order?", "a": "Yes. Use the order number from your confirmation email."}]}),
                _node("notifications", "newsletter", {"text": "Get early access to deals. No spam."}),
                FOOTER("Neon Market", "Deals · Returns · Support"),
            ], True),
        ],
    },
    # ───────────── Travel & Agency ─────────────
    "travel-wanderly": {
        "label": "Wanderly Travel",
        "description": "Cinematic travel brand: destinations, itinerary timeline, booking form and traveller stories.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "floating", {"brand": "Wanderly", "links": ["Destinations", "Packages", "Stories", "Contact"]}),
                _node("hero", "cinema", {"headline": "Go where the map ends.", "subheadline": "Handcrafted trips to places that stay with you.", "primaryCta": "Plan my trip", "secondaryCta": "See destinations"}),
                _node("catalog", "carousel", {"heading": "Top destinations", "subheading": "Handpicked by our travel team.", "items": [
                    {"name": "Kerala Backwaters", "price": "From ₹18,999", "description": "4 nights on a private houseboat.", "image": ""},
                    {"name": "Ladakh Circuit", "price": "From ₹32,499", "description": "7 days across high passes and monasteries.", "image": ""},
                    {"name": "Andaman Escape", "price": "From ₹27,999", "description": "Island hopping, diving and beaches.", "image": ""}]}),
                _node("timeline", "horizontal", {"heading": "A sample 5-day journey", "items": [
                    {"date": "Day 1", "title": "Arrive & settle in", "text": "Airport pickup and a welcome dinner."},
                    {"date": "Day 2", "title": "Explore the old town", "text": "Guided walk with a local storyteller."},
                    {"date": "Day 3", "title": "Into the wild", "text": "A full-day safari with a naturalist."},
                    {"date": "Day 4", "title": "Slow day", "text": "Spa, beach or a cooking class."}]}),
                _node("forms", "booking", {"heading": "Plan your trip", "subheading": "Tell us when and where. We reply within a day."}),
                _node("testimonials", "wall", {"heading": "Traveller stories", "items": [
                    {"quote": "The best trip of our lives, every detail handled.", "name": "Meera & Arjun", "role": "Ladakh"},
                    {"quote": "Local guides made all the difference.", "name": "Sam L.", "role": "Kerala"}]}),
                FOOTER("Wanderly"),
                _chat("Wanda", "Wanderly", [
                    {"q": "best time to visit season", "a": "October to March is ideal for most of our destinations."},
                    {"q": "visa passport documents", "a": "For domestic trips you only need a valid photo ID."}], "bubble", ["Packages", "Best season", "Talk to an expert"]),
            ], True),
        ],
    },
    "travel-agency": {
        "label": "Voyage & Co Agency",
        "description": "Full-service travel and creative agency: services, team, results and an enquiry form.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "split", {"brand": "Voyage & Co", "links": ["Services", "Work", "Team", "Contact"]}),
                _node("hero", "mesh", {"headline": "We plan the journey. You enjoy it.", "subheadline": "Corporate travel, events and holidays, managed end to end.", "primaryCta": "Get a quote", "secondaryCta": "Our services"}),
                _node("features", "spotlight", {"heading": "What we do", "subheading": "One team for every kind of trip.", "items": [
                    {"title": "Holidays & honeymoons", "text": "Tailor-made itineraries with 24/7 support."},
                    {"title": "Corporate travel", "text": "Bookings, visas and expense reporting in one place."},
                    {"title": "Events & offsites", "text": "Venues, transport and stays for teams of any size."}]}),
                _node("stats", "big", {"items": [{"value": "12K+", "label": "Trips planned"}, {"value": "60+", "label": "Destinations"}, {"value": "4.9/5", "label": "Client rating"}, {"value": "24/7", "label": "Support"}]}),
                _node("team", "photo", {"heading": "Meet the planners", "items": [
                    {"name": "Nisha Menon", "role": "Head of Holidays"}, {"name": "Karan Shah", "role": "Corporate Travel Lead"},
                    {"name": "Divya Rao", "role": "Events Manager"}, {"name": "Imran Ali", "role": "Operations"}]}),
                _node("forms", "contact", {"heading": "Tell us about your trip", "subheading": "We'll send a plan and quote within 24 hours."}),
                _node("faq", "sidebar", {"heading": "Good to know", "items": [
                    {"q": "Do you handle visas?", "a": "Yes, we manage visa applications for most countries."},
                    {"q": "Can you work within a budget?", "a": "Absolutely. Share your budget and we design around it."}]}),
                FOOTER("Voyage & Co"),
            ], True),
        ],
    },
    # ───────────── Healthcare ─────────────
    "health-clinic": {
        "label": "CareFirst Clinic",
        "description": "Trusted clinic site: services, doctors, appointment booking, FAQ and an assistant.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "default", {"brand": "CareFirst", "links": ["Services", "Doctors", "Patients", "Contact"], "loginLabel": "Patient login", "ctaLabel": "Book visit"}),
                _node("hero", "stats", {"headline": "Care that puts you first.", "subheadline": "Same-day appointments with experienced doctors and modern diagnostics.", "primaryCta": "Book an appointment", "secondaryCta": "Our services"}),
                _node("features", "checks", {"heading": "Our services", "subheading": "Everything under one roof.", "items": [
                    {"title": "Family medicine", "text": "Check-ups, vaccines and long-term care."},
                    {"title": "Diagnostics", "text": "In-house lab and imaging with quick reports."},
                    {"title": "Women's health", "text": "Screenings, prenatal and postnatal care."}]}),
                _node("team", "photo", {"heading": "Our doctors", "items": [
                    {"name": "Dr. Anita Thomas", "role": "Family Physician"}, {"name": "Dr. Ravi Kumar", "role": "Cardiologist"},
                    {"name": "Dr. Sana Iqbal", "role": "Gynaecologist"}, {"name": "Dr. Joel Mathew", "role": "Paediatrician"}]}),
                _node("forms", "booking", {"heading": "Book an appointment", "subheading": "Choose a date. We'll confirm by phone."}),
                _node("faq", "numbered", {"heading": "Patient questions", "items": [
                    {"q": "Do I need an appointment?", "a": "Walk-ins are welcome, but appointments skip the wait."},
                    {"q": "Do you accept insurance?", "a": "Yes, we work with all major insurers and offer cashless claims."}]}),
                FOOTER("CareFirst Clinic", "Emergency: 108 · Privacy · Terms"),
                _chat("Care Assistant", "CareFirst", [
                    {"q": "timings hours open", "a": "We are open 8 am to 9 pm, Monday to Saturday."},
                    {"q": "emergency urgent", "a": "For emergencies please call 108 or visit the nearest hospital."}], "widget", ["Timings", "Book a visit", "Insurance"]),
            ], True),
        ],
    },
    "health-wellness": {
        "label": "Serene Wellness",
        "description": "Calm wellness studio: programs, memberships, journey timeline and a newsletter.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "minimal", {"brand": "Serene", "links": ["Programs", "Membership", "Journal", "Contact"]}),
                _node("hero", "centered", {"headline": "Slow down. Feel well.", "subheadline": "Yoga, breathwork and mindful movement in a calm space.", "primaryCta": "Try a free class", "secondaryCta": "View programs"}),
                _node("cards", "icons", {"items": [
                    {"title": "Yoga", "text": "Gentle to advanced classes, every day."},
                    {"title": "Breathwork", "text": "Guided sessions for calm and focus."},
                    {"title": "Nutrition", "text": "Personal plans from certified coaches."}]}),
                _node("pricing", "rows", {"heading": "Memberships", "tiers": [
                    {"name": "Drop-in", "price": "₹500", "unit": "per class", "features": ["Any class", "Mat provided"], "button": "Book a class"},
                    {"name": "Unlimited", "price": "₹3,499", "unit": "per month", "featured": True, "features": ["All classes", "1 workshop", "Guest pass"], "button": "Join now"}]}),
                _node("timeline", "steps", {"heading": "Your first month", "items": [
                    {"date": "Week 1", "title": "Find your rhythm", "text": "Foundations classes and a personal intro."},
                    {"date": "Week 2", "title": "Build the habit", "text": "Three sessions a week with a buddy."},
                    {"date": "Week 3", "title": "Go deeper", "text": "Try breathwork and a workshop."},
                    {"date": "Week 4", "title": "Reflect", "text": "Review progress and set new goals."}]}),
                _node("forms", "subscription", {"heading": "Weekly calm, in your inbox", "subheading": "Short practices and studio news."}),
                FOOTER("Serene Wellness"),
            ], True),
        ],
    },
    # ───────────── Education ─────────────
    "edu-academy": {
        "label": "BrightPath Academy",
        "description": "Online academy: course catalog, learning path timeline, results, student stories and FAQ.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "tabs", {"brand": "BrightPath", "links": ["Courses", "Learning path", "Pricing", "Help"], "loginLabel": "Student login"}),
                _node("hero", "stats", {"headline": "Learn skills that get you hired.", "subheadline": "Live classes, real projects and mentors who care.", "primaryCta": "Explore courses", "secondaryCta": "Free demo class"}),
                _node("catalog", "showcase", {"heading": "Popular courses", "subheading": "Start any time. Learn at your pace.", "items": [
                    {"name": "Full-Stack Web Development", "price": "₹24,999", "description": "6 months, 8 projects, job support.", "image": ""},
                    {"name": "Data Analytics", "price": "₹18,999", "description": "SQL, Python and dashboards.", "image": ""},
                    {"name": "UI/UX Design", "price": "₹15,999", "description": "Research to prototype in 12 weeks.", "image": ""}]}),
                _node("timeline", "alternating", {"heading": "Your learning path", "items": [
                    {"date": "Month 1", "title": "Foundations", "text": "Core concepts with guided practice."},
                    {"date": "Month 3", "title": "Build projects", "text": "Real briefs reviewed by mentors."},
                    {"date": "Month 5", "title": "Career prep", "text": "Portfolio, mock interviews and referrals."}]}),
                _node("testimonials", "spotlight", {"heading": "Student stories", "items": [
                    {"quote": "I went from zero to a developer job in seven months.", "name": "Anjali R.", "role": "Software Engineer"}]}),
                _node("faq", "tabs", {"heading": "Before you enrol", "items": [
                    {"q": "Are classes live?", "a": "Yes, with recordings if you miss one."},
                    {"q": "Is there a refund?", "a": "You can cancel within 7 days for a full refund."}]}),
                _node("cta", "card", {"heading": "Start with a free demo class", "subheading": "See how we teach before you decide.", "button": "Book demo"}),
                FOOTER("BrightPath Academy"),
            ], True),
        ],
    },
    "edu-bootcamp": {
        "label": "CodeCamp Bootcamp",
        "description": "Developer bootcamp: curriculum, plans, mentors and an enquiry form.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "brutal", {"brand": "CodeCamp", "links": ["Curriculum", "Mentors", "Fees"]}),
                _node("hero", "type", {"headline": "Ship real code in 12 weeks.", "subheadline": "An intense, mentor-led bootcamp for career changers.", "primaryCta": "Apply now", "secondaryCta": "Download syllabus"}),
                _node("features", "zigzag", {"heading": "The curriculum", "subheading": "Practical from day one.", "items": [
                    {"title": "Weeks 1-4: Fundamentals", "text": "HTML, CSS, JavaScript and Git."},
                    {"title": "Weeks 5-8: Full-stack", "text": "APIs, databases and deployment."},
                    {"title": "Weeks 9-12: Capstone", "text": "Build and launch a real product with a team."}]}),
                _node("pricing", "compare", {"heading": "Choose your track", "tiers": [
                    {"name": "Weekend", "price": "₹39,999", "unit": "one time", "features": ["Live classes", "Mentor reviews"], "button": "Enrol"},
                    {"name": "Full-time", "price": "₹59,999", "unit": "one time", "featured": True, "features": ["Live classes", "Mentor reviews", "Career support", "Job guarantee"], "button": "Enrol"}]}),
                _node("team", "circles", {"heading": "Your mentors", "items": [
                    {"name": "Priya Nair", "role": "Ex-Google Engineer"}, {"name": "Vikram Rao", "role": "Startup CTO"}, {"name": "Neha Joshi", "role": "Lead Designer"}]}),
                _node("forms", "contact", {"heading": "Have questions?", "subheading": "Talk to an advisor. No pressure."}),
                FOOTER("CodeCamp"),
            ], True),
        ],
    },
    # ───────────── Logistics ─────────────
    "logi-freight": {
        "label": "SwiftFreight",
        "description": "Freight and supply-chain company: services, network stats, shipment tracking and quote request.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "mega", {"brand": "SwiftFreight", "links": ["Services", "Network", "Track", "Contact"]}),
                _node("hero", "split", {"headline": "Freight that moves at business speed.", "subheadline": "Road, rail, air and sea across 40 countries with real-time visibility.", "primaryCta": "Get a quote", "secondaryCta": "Track a shipment"}),
                _node("stats", "band", {"items": [{"value": "40+", "label": "Countries"}, {"value": "98.6%", "label": "On-time delivery"}, {"value": "1.2M", "label": "Shipments a year"}, {"value": "24/7", "label": "Control tower"}]}),
                _node("features", "bento", {"heading": "Our services", "subheading": "One partner, every mode.", "items": [
                    {"title": "Road freight", "text": "FTL and LTL across India."},
                    {"title": "Air & sea", "text": "International cargo with customs handled."},
                    {"title": "Warehousing", "text": "Secure storage and fulfilment."},
                    {"title": "Cold chain", "text": "Temperature-controlled logistics."}]}),
                _node("tracking", "default", {"heading": "Track a shipment"}),
                _node("forms", "contact", {"heading": "Request a quote", "subheading": "Tell us origin, destination and cargo. We respond in hours."}),
                FOOTER("SwiftFreight"),
            ], True),
        ],
    },
    "logi-courier": {
        "label": "RouteWise Courier",
        "description": "Same-day courier: how it works, tracking, coverage, pricing and FAQ.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "tabs", {"brand": "RouteWise", "links": ["Send", "Track", "Pricing", "Help"], "loginLabel": "Login"}),
                _node("hero", "mockup", {"headline": "Send anything, anywhere in the city.", "subheadline": "Same-day pickup and delivery with live tracking.", "primaryCta": "Book a pickup", "secondaryCta": "Track a parcel"}),
                _node("timeline", "steps", {"heading": "How it works", "items": [
                    {"date": "Step 1", "title": "Book", "text": "Enter pickup and drop addresses."},
                    {"date": "Step 2", "title": "Pickup", "text": "A rider arrives within 30 minutes."},
                    {"date": "Step 3", "title": "Deliver", "text": "Track live until it is delivered."}]}),
                _node("tracking", "default", {"heading": "Track your parcel"}),
                _node("pricing", "toggle", {"heading": "Simple rates", "tiers": [
                    {"name": "Documents", "price": "₹49", "unit": "per parcel", "features": ["Up to 1 kg", "Same-day"], "button": "Book"},
                    {"name": "Parcels", "price": "₹99", "unit": "per parcel", "featured": True, "features": ["Up to 10 kg", "Same-day", "Insurance"], "button": "Book"},
                    {"name": "Bulk", "price": "Custom", "unit": "", "features": ["Volume discounts", "Account manager"], "button": "Talk to us"}]}),
                _node("faq", "cards", {"heading": "Common questions", "items": [
                    {"q": "What can I send?", "a": "Documents and parcels up to 10 kg. Restricted items are not accepted."},
                    {"q": "Is my parcel insured?", "a": "Yes, up to ₹5,000 on the Parcels plan."}]}),
                _node("cta", "line", {"heading": "Ready to send?", "subheading": "", "button": "Book a pickup"}),
                FOOTER("RouteWise"),
                _chat("Riley", "RouteWise", [
                    {"q": "pickup time how long", "a": "A rider usually reaches you within 30 minutes."},
                    {"q": "price cost rate", "a": "Documents start at ₹49 and parcels at ₹99."}], "whatsapp", ["Rates", "Pickup time", "Track parcel"]),
            ], True),
        ],
    },
    # ───────────── Blogs ─────────────
    "blog-journal": {
        "label": "The Field Journal",
        "description": "Editorial magazine: featured stories, categories, newsletter and author bios.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "split", {"brand": "The Field Journal", "links": ["Stories", "Essays", "Interviews", "About"]}),
                _node("hero", "type", {"headline": "Stories worth slowing down for.", "subheadline": "Long-form writing on culture, craft and the places we live.", "primaryCta": "Read the latest", "secondaryCta": "Subscribe"}),
                _node("catalog", "menu", {"heading": "Latest stories", "subheading": "New writing every week.", "items": [
                    {"name": "The last hand-loom weavers of Kerala", "price": "12 min read", "description": "Inside a craft that refuses to fade.", "image": ""},
                    {"name": "Why we walk", "price": "8 min read", "description": "An essay on cities, feet and freedom.", "image": ""},
                    {"name": "A conversation with a cartographer", "price": "15 min read", "description": "Maps, memory and getting lost.", "image": ""}]}),
                _node("forms", "subscription", {"heading": "Get the weekly letter", "subheading": "One story, delivered every Sunday."}),
                _node("team", "list", {"heading": "The writers", "items": [
                    {"name": "Maya Krishnan", "role": "Editor in chief"}, {"name": "Tarun Bose", "role": "Features writer"}, {"name": "Leena D'Souza", "role": "Photographer"}]}),
                FOOTER("The Field Journal", "About · Write for us · RSS"),
            ], True),
        ],
    },
    "blog-notes": {
        "label": "Notes & Essays",
        "description": "Minimal personal blog: numbered posts, about the author, reader praise and a signup.",
        "pages": [
            _page("Home", "/", [
                _node("navbar", "minimal", {"brand": "Notes & Essays", "links": ["Writing", "About", "Contact"]}),
                _node("hero", "centered", {"headline": "Thoughts on design, work and life.", "subheadline": "A small corner of the internet for slow ideas.", "primaryCta": "Read the archive", "secondaryCta": "About me"}),
                _node("cards", "numbered", {"items": [
                    {"title": "On doing less, better", "text": "Notes on focus after a year of saying no."},
                    {"title": "Small tools, big leverage", "text": "The boring software I use every day."},
                    {"title": "Writing in public", "text": "What I learned from 100 posts."}]}),
                _node("features", "checks", {"heading": "What you'll find here", "subheading": "", "items": [
                    {"title": "Essays", "text": "Longer thinking, published monthly."},
                    {"title": "Notes", "text": "Short observations and links."},
                    {"title": "Reading lists", "text": "Books and articles worth your time."}]}),
                _node("testimonials", "spotlight", {"heading": "Reader notes", "items": [
                    {"quote": "The only newsletter I read the moment it arrives.", "name": "Kavya S.", "role": "Product designer"}]}),
                _node("forms", "subscription", {"heading": "New posts, no noise", "subheading": "One email when something is published."}),
                FOOTER("Notes & Essays", "RSS · Email · Colophon"),
            ], True),
        ],
    },
}
