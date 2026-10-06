"""Fixture project templates.

Each template is a list of page dicts (`name`, `path`, `is_home`, `tree`)
using the same Node shape (`id`, `type`, `variant`, `props`, `style`,
`children`) the frontend's component registry renders. Keeping these as
plain data (not code) means the template marketplace, "start blank", and
AI-generated pages all flow through the same `Page.tree` representation.
"""

import uuid


def _id() -> str:
    return uuid.uuid4().hex[:8]


def _node(type_: str, variant: str, props: dict | None = None, name: str | None = None) -> dict:
    return {
        "id": _id(),
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


def blank_homepage() -> list[dict]:
    return [
        _node("navbar", "default", {"brand": "My Site", "links": ["Home", "Features", "Pricing", "About"]}),
        _node(
            "hero",
            "split",
            {
                "headline": "Build something remarkable.",
                "subheadline": "A visual website builder for people who want the speed of "
                "no-code and the freedom of production-ready code.",
                "primaryCta": "Start Building",
                "secondaryCta": "Explore Features",
            },
        ),
        _node(
            "features",
            "grid",
            {
                "heading": "Everything you need.",
                "subheading": "Design faster without compromising on code quality.",
                "items": [
                    {"title": "Visual Design", "text": "Drag components onto the canvas and customize every detail."},
                    {"title": "AI Powered", "text": "Describe changes in plain language and let AI edit your design."},
                    {"title": "Own Your Code", "text": "Export a clean, production-ready project anytime."},
                ],
            },
        ),
        _node("footer", "simple", {"left": "© 2026 My Site", "right": "Privacy · Terms · Contact"}),
    ]


TEMPLATES: dict[str, dict] = {
    "saas": {
        "label": "SaaS Product",
        "description": "Navbar, split hero, feature grid, tiered pricing, footer.",
        "pages": [
            {
                "name": "Home",
                "path": "/",
                "is_home": True,
                "tree": [
                    _node("navbar", "default", {"brand": "NOVA", "links": ["Product", "Pricing", "Docs"]}),
                    _node(
                        "hero",
                        "split",
                        {
                            "headline": "Ship your SaaS in days, not months.",
                            "subheadline": "NOVA gives your team a production-ready foundation with "
                            "auth, billing, and a polished UI out of the box.",
                            "primaryCta": "Start Free Trial",
                            "secondaryCta": "View Demo",
                        },
                    ),
                    _node(
                        "features",
                        "grid",
                        {
                            "heading": "Powerful features.",
                            "subheading": "Everything your visitors need to know.",
                            "items": [
                                {"title": "Fast", "text": "Optimized experiences by default."},
                                {"title": "Flexible", "text": "Customize every detail visually."},
                                {"title": "Reliable", "text": "Built for production from day one."},
                            ],
                        },
                    ),
                    _node(
                        "pricing",
                        "tiered",
                        {
                            "heading": "Plans for every team.",
                            "tiers": [
                                {"name": "Starter", "price": "₹499", "features": ["Core features", "Email support"]},
                                {
                                    "name": "Pro",
                                    "price": "₹999",
                                    "featured": True,
                                    "features": ["All features", "Priority support"],
                                },
                                {"name": "Business", "price": "₹2,499", "features": ["Teams", "Advanced analytics"]},
                            ],
                        },
                    ),
                    _node("footer", "columns", {"brand": "NOVA"}),
                ],
            }
        ],
    },
    "portfolio": {
        "label": "Personal Portfolio",
        "description": "Minimal navbar, centered hero, icon grid, contact form.",
        "pages": [
            {
                "name": "Home",
                "path": "/",
                "is_home": True,
                "tree": [
                    _node("navbar", "minimal", {"brand": "Alex Kim", "links": ["Work", "About", "Contact"]}),
                    _node(
                        "hero",
                        "centered",
                        {
                            "headline": "Product designer & frontend developer.",
                            "subheadline": "I design and build clean, fast, accessible interfaces.",
                            "primaryCta": "View Work",
                            "secondaryCta": "Get In Touch",
                        },
                    ),
                    _node(
                        "cards",
                        "simple",
                        {
                            "items": [
                                {"title": "Project One", "text": "A short description of this case study."},
                                {"title": "Project Two", "text": "A short description of this case study."},
                                {"title": "Project Three", "text": "A short description of this case study."},
                            ]
                        },
                    ),
                    _node(
                        "forms",
                        "contact",
                        {"heading": "Get in touch.", "subheading": "I'd love to hear from you."},
                    ),
                    _node("footer", "simple", {"left": "© 2026 Alex Kim", "right": "Twitter · GitHub · LinkedIn"}),
                ],
            }
        ],
    },
    "agency": {
        "label": "Creative Agency",
        "description": "Dark navbar, bold hero, testimonials, CTA, footer.",
        "pages": [
            {
                "name": "Home",
                "path": "/",
                "is_home": True,
                "tree": [
                    _node("navbar", "dark", {"brand": "STUDIO", "links": ["Work", "Services", "About", "Contact"]}),
                    _node(
                        "hero",
                        "split",
                        {
                            "headline": "We build brands people remember.",
                            "subheadline": "A full-service creative agency for ambitious startups and enterprises.",
                            "primaryCta": "Start a Project",
                            "secondaryCta": "See Our Work",
                        },
                    ),
                    _node(
                        "testimonials",
                        "default",
                        {
                            "heading": "Loved by teams everywhere.",
                            "items": [
                                {"quote": "This team cut our build time in half.", "name": "Jane Doe", "role": "CTO, Acme"},
                                {"quote": "Finally an agency that gets out of the way.", "name": "Sam Lee", "role": "Founder, Globex"},
                            ],
                        },
                    ),
                    _node("cta", "default", {"heading": "Ready to get started?", "subheading": "Let's build something great together.", "button": "Get Started Free"}),
                    _node("footer", "columns", {"brand": "STUDIO"}),
                ],
            }
        ],
    },
    "restaurant": {
        "label": "Restaurant",
        "description": "Navbar, hero, feature cards, contact/booking form, footer.",
        "pages": [
            {
                "name": "Home",
                "path": "/",
                "is_home": True,
                "tree": [
                    _node("navbar", "default", {"brand": "Osteria", "links": ["Menu", "Reservations", "About"]}),
                    _node(
                        "hero",
                        "centered",
                        {
                            "headline": "Modern Italian, downtown.",
                            "subheadline": "Fresh, seasonal dishes in a warm, welcoming space.",
                            "primaryCta": "Book a Table",
                            "secondaryCta": "View Menu",
                        },
                    ),
                    _node(
                        "cards",
                        "numbered",
                        {
                            "items": [
                                {"title": "Fresh Ingredients", "text": "Sourced daily from local farms."},
                                {"title": "Seasonal Menu", "text": "Changes with what's freshest."},
                                {"title": "Private Events", "text": "Book our space for your celebration."},
                            ]
                        },
                    ),
                    _node("forms", "booking", {"heading": "Book an appointment.", "subheading": "Pick a date and time that works for you."}),
                    _node("footer", "simple", {"left": "© 2026 Osteria", "right": "123 Main St · (555) 010-2020"}),
                ],
            }
        ],
    },
}


def _load_extra() -> None:
    from app.projects.page_factory import pages_from_navbar, split_shop_page
    from app.projects.templates_extra import EXTRA_TEMPLATES

    TEMPLATES.update(EXTRA_TEMPLATES)
    # Every navbar link gets a ready-made page, so a template opens as a complete multi-page site.
    for template in TEMPLATES.values():
        template["pages"] = split_shop_page(template["pages"])
        template["pages"] = template["pages"] + [{k: v for k, v in p.items() if k != "kind"} for p in pages_from_navbar(template["pages"])]


_load_extra()


def get_template_pages(key: str | None) -> list[dict]:
    if key and key in TEMPLATES:
        return TEMPLATES[key]["pages"]
    return [{"name": "Home", "path": "/", "is_home": True, "tree": blank_homepage()}]
