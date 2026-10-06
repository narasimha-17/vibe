"""Requirements interview: memory, the built-in interviewer, summary, acceptance checklist and provisioning."""

import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.intake.analysis import analyse
from app.intake.memory import LongTermMemory, SessionMemory
from app.intake.topics import parse, parse_pages

ANSWERS = [
    "We run a family bakery in Kochi and want to sell custom cakes online",
    "Crumb & Co",
    "Get more customers and sell cakes online",
    "Young families and office teams in Kerala",
    "Customers phone us for prices and we miss orders after hours",
    "5 pages: Home, Menu, About, Track order, Contact",
    "Online payments, order tracking, reviews, a chatbot and a Google Maps embed",
    "Razorpay, WhatsApp and Google Analytics",
    "Launch in 3 weeks. Payments first, loyalty points can wait",
    "50 online orders a month and half the phone calls",
    "Warm, premium and elegant",
]


@pytest.fixture(autouse=True)
def builtin_interviewer(monkeypatch):
    """Tests use the deterministic interviewer, so they never wait on a model."""
    monkeypatch.setattr(get_settings(), "intake_use_agent", False)


def test_parsers_turn_free_text_into_facts():
    assert parse_pages("5 pages: Home, Services, About, Pricing and Contact") == {"count": 5, "names": ["Home", "Services", "About", "Pricing", "Contact"]}
    assert parse_pages("about six pages")["count"] == 6
    assert parse("integrations", "Razorpay and whatsapp") == ["Razorpay", "WhatsApp"]
    assert parse("integrations", "none for now") == []
    assert parse("features", "payments, booking form and blog") == ["payments", "booking form", "blog"]


def test_memory_short_and_long_term():
    mem = SessionMemory()
    assert mem.remember("features", "booking, blog") == "Remembered features."
    mem.remember("features", "chatbot")
    assert mem.recall("features") == ["booking", "blog", "chatbot"]
    assert "Unknown topic" in mem.remember("colour", "x")
    assert mem.progress()["captured"] == 1 and "business" in mem.missing()
    mem.forget("features")
    assert mem.recall("features") is None
    ltm = LongTermMemory()
    ltm.remember("industry", "bakery")
    assert "Welcome back" in ltm.greeting_hint() or ltm.greeting_hint() == ""
    assert ltm.recall() == {"industry": "bakery"}


async def test_full_interview_summary_and_provisioning(auth_client: AsyncClient):
    start = (await auth_client.post("/intake/sessions")).json()
    sid = start["id"]
    assert start["messages"][0]["role"] == "assistant" and start["progress"]["captured"] == 0

    last = None
    for i, answer in enumerate(ANSWERS):
        res = await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": answer})
        assert res.status_code == 200, res.text
        last = res.json()
        assert last["engine"] == "agent" and last["reply"]
        while last["next_topic"] and last["next_topic"].startswith("clar:"):  # the agent digs into what was mentioned
            last = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": "Not sure yet"})).json()
    assert last["ready"] is True and last["next_topic"] is None
    assert last["memory"]["pages"]["names"] == ["Home", "Menu", "About", "Track order", "Contact"]

    resumed = (await auth_client.get("/intake/sessions/latest")).json()
    assert resumed["id"] == sid and len(resumed["messages"]) >= 1 + 2 * len(ANSWERS), "the conversation can be resumed"

    edited = (await auth_client.patch(f"/intake/sessions/{sid}/memory", json={"topic": "audience", "value": "Young families in Kochi"})).json()
    assert edited["memory"]["audience"] == "Young families in Kochi"

    summary = (await auth_client.post(f"/intake/sessions/{sid}/summary")).json()
    labels = {u["label"] for u in summary["understanding"]}
    assert {"Business & idea", "Objectives", "Pages", "Integrations", "What I'll build"} <= labels
    assert summary["recommended"]["template"] == "ecom-atelier", "a bakery selling online with payments and tracking gets the shop template"
    feats = {f["feature"]: f["supported"] for f in summary["features"]}
    assert feats["Online shop with cart and Razorpay checkout"] is True and feats["Map / location"] is False
    ints = {i["name"]: i["supported"] for i in summary["integrations"]}
    assert ints == {"Razorpay": True, "WhatsApp": True, "Google Analytics": False}
    titles = [r["title"] for r in summary["recommendations"]]
    assert any("Map / location" in t and "custom work" in t for t in titles)
    assert any("Google Analytics" in t for t in titles)
    assert summary["acceptance"] and all(not c["done"] for c in summary["acceptance"])
    cats = {c["category"] for c in summary["acceptance"]}
    assert {"Pages", "Features", "Integrations", "Pain points", "Outcome", "Quality"} <= cats

    checklist = summary["acceptance"] + [{"id": "mine", "category": "Custom", "text": "Owner signs off", "done": True}]
    made = await auth_client.post(f"/intake/sessions/{sid}/provision", json={"name": "Crumb & Co", "acceptance": checklist})
    assert made.status_code == 201, made.text
    body = made.json()
    assert "Track order" in body["pages"] and "Menu" in body["pages"]
    assert summary["brand_name"] == "Crumb & Co"

    project = (await auth_client.get(f"/projects/{body['project_id']}")).json()
    page_names = [p["name"] for p in project["pages"]]
    assert page_names[0] == "Home" and "Contact" in page_names and "About" in page_names
    home_nav = next(n for n in project["pages"][0]["tree"] if n["type"] == "navbar")
    assert home_nav["props"]["brand"] == "Crumb & Co"
    # the content is the user's own, not the template's placeholder copy
    everything = str(project["pages"])
    assert "Chocolate Truffle Cake" in everything and "Atelier" not in everything and "Everyday Tote" not in everything
    assert home_nav["props"]["links"][:3] == ["Menu", "About", "Track order"]
    docs = project["settings"]["docs"]
    assert "How to start the project" in docs["readme"] and "### Frontend" in docs["readme"] and "### Backend" in docs["readme"] and "whole project together" in docs["readme"]
    assert "- [x] Owner signs off" in docs["acceptance"] and "- [ ]" in docs["acceptance"]
    assert project["settings"]["requirements"]["outcome"].startswith("50 online orders")

    again = await auth_client.post(f"/intake/sessions/{sid}/provision", json={"name": "Other"})
    assert again.json()["project_id"] == body["project_id"], "provisioning twice does not create a second project"
    assert (await auth_client.get("/intake/sessions/latest")).json() is None

    # long-term memory is kept, but the next interview starts clean and doesn't recite old projects
    second = (await auth_client.post("/intake/sessions")).json()
    assert "Welcome back" not in second["messages"][0]["text"] and "ecom-" not in second["messages"][0]["text"]
    assert second["remembered"]["business_name"] == "Crumb & Co"


async def test_sessions_are_private(auth_client: AsyncClient, client: AsyncClient):
    sid = (await auth_client.post("/intake/sessions")).json()["id"]
    await client.post("/auth/register", json={"email": "other@example.com", "password": "password123", "name": "Other"})
    token = (await client.post("/auth/login", json={"email": "other@example.com", "password": "password123"})).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.get(f"/intake/sessions/{sid}")).status_code == 404
    assert (await client.post(f"/intake/sessions/{sid}/message", json={"text": "hi"})).status_code == 404


def test_analysis_flags_gaps_and_implied_pages():
    memory = {"business": "online shop selling books", "features": ["online payments", "login"], "pages": {"count": 6, "names": ["Home", "About"]}, "integrations": ["Stripe"], "pain_points": ["customers call for order status"]}
    out = analyse(memory)
    implied = {p["name"] for p in out["pages"]["implied"]}
    assert {"Shop", "Login"} <= implied
    titles = " ".join(r["title"] for r in out["recommendations"])
    assert "6 pages" in titles and "Stripe" in titles
    assert out["recommended"]["template"] == "ecom-atelier"


async def test_agent_reads_several_topics_and_asks_follow_ups(auth_client: AsyncClient):
    sid = (await auth_client.post("/intake/sessions")).json()["id"]
    short = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": "bakery"})).json()
    assert short["reply"].startswith("Could you tell me a little more") and short["progress"]["captured"] == 0
    full = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": "A bakery in Kochi selling custom cakes. We need 5 pages, online payments, reviews and Razorpay"})).json()
    assert full["memory"]["business"] and "integrations" in full["memory"] and "pages" in full["memory"]
    assert full["next_topic"] == "clar:pay_what", "Razorpay was named, so it asks what customers pay for instead of asking for a provider again"


async def test_agent_reasons_about_payments(auth_client: AsyncClient):
    sid = (await auth_client.post("/intake/sessions")).json()["id"]
    r = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": "I run a bakery and I need to do some payment integration, customers should pay with Mastercard"})).json()
    assert r["next_topic"] == "clar:pay_provider" and "Mastercard" in r["reply"] and "Razorpay" in r["suggestions"]
    assert not r["ready"]
    r = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": "Razorpay"})).json()
    assert "Razorpay" in r["memory"]["integrations"] and r["next_topic"] == "clar:pay_what"
    r = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": "One-time purchases"})).json()
    assert r["next_topic"] == "clar:pay_methods"
    r = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": "UPI and cards"})).json()
    assert r["next_topic"] not in (None,) and not r["next_topic"].startswith("clar:pay") and r["memory"]["details"][0].startswith("Payment provider")
    assert any(w in r["reply"] for w in ("features", "Objectives", "achieve", "goals")) or r["next_topic"]


async def test_pages_are_generated_from_navbar_links(auth_client: AsyncClient):
    nav = {"id": "n1", "type": "navbar", "variant": "default", "name": "Navbar", "props": {"brand": "Evergreen", "links": ["Home – Clinic introduction", "Key services", "Doctors", "Appointment CTA"]}, "style": {}, "responsive": {}, "children": []}
    made = (await auth_client.post("/projects/pages/from-navbar", json={"pages": [{"name": "Home", "path": "/", "is_home": True, "tree": [nav]}]})).json()
    assert [p["name"] for p in made] == ["Key services", "Doctors", "Appointment"]
    assert all(any(n["type"] == "navbar" for n in p["tree"]) and len(p["tree"]) >= 3 for p in made), "each page starts with the site navbar and real components"


def test_blueprint_reasons_about_the_kind_of_website():
    shop = analyse({"business": "A small online store", "pages": {"count": None, "names": ["Home"]}, "features": ["discount codes"]})["pages"]
    names = [p["name"] for p in shop["implied"]]
    assert {"Shop", "Checkout", "Track order", "My orders", "Offers", "Admin login", "Dashboard", "Engagement"} <= set(names)
    food = analyse({"business": "A multi cuisine restaurant with Italian and Chinese food", "pages": {"count": None, "names": ["Home"]}, "features": ["reviews"]})["pages"]
    fnames = [p["name"] for p in food["implied"]]
    assert {"Cuisines", "Italian", "Chinese", "My orders", "Reviews", "Order online", "Dashboard"} <= set(fnames)
    edu = analyse({"business": "An education academy for school students", "pages": {"count": None, "names": []}})["pages"]
    assert {"Courses", "Our quality", "Faculty", "Results", "Admissions", "Admin login"} <= {p["name"] for p in edu["implied"]}


async def test_builder_assistant_understands_and_acts(auth_client: AsyncClient):
    tree = [{"id": "n1", "type": "navbar", "name": "Navbar", "props": {"links": ["Home", "About"]}}, {"id": "h1", "type": "hero", "name": "Hero", "props": {}}]
    r = (await auth_client.post("/ai/command", json={"prompt": "add cart button to navbar", "tree_summary": tree, "pages": ["Home", "Shop"]})).json()
    assert r["ops"][0]["op"] == "update_component" and r["ops"][0]["payload"]["props"] == {"showCart": True} and r["ops"][0]["description"]
    r = (await auth_client.post("/ai/command", json={"prompt": "change the navbar according to the shop page", "tree_summary": tree, "pages": ["Home", "Shop", "About"]})).json()
    assert r["ops"][0]["payload"]["props"]["links"] == ["Home", "Shop", "About"]
    r = (await auth_client.post("/ai/command", json={"prompt": "add button to navbar", "tree_summary": tree, "pages": []})).json()
    assert r["ops"] == [] and "Which button" in r["message"], "ambiguous requests get a question, not a guess"
    r = (await auth_client.post("/ai/command", json={"prompt": "create a checkout page", "tree_summary": tree, "pages": ["Home"]})).json()
    assert r["ops"][0]["op"] == "create_page" and r["ops"][0]["payload"]["preset"] is True


async def test_ai_agent_tasks(auth_client: AsyncClient):
    tree = [{"id": "n1", "type": "navbar", "variant": "default", "name": "Navbar", "props": {"brand": "My Site", "links": ["Home"]}},
            {"id": "h1", "type": "hero", "variant": "split", "name": "Hero", "props": {"headline": "A" * 90, "visualImage": ""}},
            {"id": "s1", "type": "shop", "variant": "sidebar", "name": "Shop", "props": {"products": [{"name": "Red Velvet", "category": "Cakes", "price": "999"}]}}]
    body = {"tree_summary": tree, "tree_full": tree, "pages": ["Home"]}
    r = (await auth_client.post("/ai/command", json={**body, "prompt": "build me a full bakery site with a shop, offers and an admin area"})).json()
    names = [o["payload"].get("name") for o in r["ops"] if o["op"] == "create_page"]
    assert r["preview"] is True and {"Shop", "Checkout", "Offers", "Admin login", "Dashboard"} <= set(names)
    assert all(o["payload"]["domain"] for o in r["ops"] if o["op"] == "create_page")
    r = (await auth_client.post("/ai/command", json={**body, "prompt": "generate a hero image for a bakery"})).json()
    hero = r["ops"][0]["payload"]
    assert hero["props"]["visualImage"].startswith("data:image/svg+xml")
    r = (await auth_client.post("/ai/command", json={**body, "prompt": "add images to all products"})).json()
    assert r["ops"][0]["payload"]["props"]["products"][0]["image"].startswith("data:image/svg+xml")
    r = (await auth_client.post("/ai/command", json={**body, "prompt": "review my design"})).json()
    assert r["preview"] is True and "headline is too long" in r["message"] and r["ops"], "the critique finds real problems and offers fixes"
    r = (await auth_client.post("/ai/command", json={**body, "prompt": "import the layout from http://127.0.0.1:8000/health"})).json()
    assert "private network" in r["message"] and r["ops"] == [], "internal addresses are refused"


async def test_checklist_inside_the_builder_ticks_itself(auth_client: AsyncClient):
    sid = (await auth_client.post("/intake/sessions")).json()["id"]
    for answer in ANSWERS:
        r = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": answer})).json()
        while r["next_topic"] and r["next_topic"].startswith("clar:"):
            r = (await auth_client.post(f"/intake/sessions/{sid}/message", json={"text": "Not sure yet"})).json()
    summary = (await auth_client.post(f"/intake/sessions/{sid}/summary")).json()
    made = (await auth_client.post(f"/intake/sessions/{sid}/provision", json={"name": "Crumb & Co", "acceptance": summary["acceptance"]})).json()
    pid = made["project_id"]

    board = (await auth_client.get(f"/projects/{pid}/checklist")).json()
    assert board["has_checklist"] and board["total"] == len(summary["acceptance"])
    auto_met = [i for i in board["items"] if i["auto"] is True]
    assert auto_met, "items the site already satisfies tick themselves"
    manual = next(i for i in board["items"] if i["auto"] is None and not i["done"])
    ticked = (await auth_client.patch(f"/projects/{pid}/checklist/{manual['id']}", json={"done": True})).json()
    assert next(i for i in ticked["items"] if i["id"] == manual["id"])["met"] is True and ticked["met"] == board["met"] + 1
    assert (await auth_client.patch(f"/projects/{pid}/checklist/nope", json={"done": True})).status_code == 404

    empty = (await auth_client.post("/projects", json={"name": "Plain", "template_key": None})).json()["id"]
    assert (await auth_client.get(f"/projects/{empty}/checklist")).json()["has_checklist"] is False


def test_shop_and_otp_technical_questions_are_asked():
    """Mentioning a shop queues the catalogue-access and guest-checkout decisions; choosing OTP queues a follow-up."""
    from app.intake import reasoning

    mem = SessionMemory({})
    reasoning.detect("I want to sell products online with a shop and checkout", mem)
    agenda = mem.data["_agenda"]
    assert "shop_catalog_access" in agenda and "shop_checkout_login" in agenda and "shop_cod" in agenda

    mem2 = SessionMemory({})
    reasoning.detect("customers need to log in with accounts", mem2)
    qid, _ack, _q = reasoning.next_question(mem2)  # auth_who
    reasoning.apply_answer(qid, "Customers", mem2)
    qid2, _ack2, _q2 = reasoning.next_question(mem2)  # auth_how
    assert qid2 == "auth_how"
    reasoning.apply_answer(qid2, "Phone number with OTP", mem2)
    assert mem2.data["_agenda"][0] == "auth_otp_use"
    qid3, _ack3, q3 = reasoning.next_question(mem2)
    assert qid3 == "auth_otp_use" and "OTP" in q3
    assert any("Sign-in method: Phone number with OTP" in d for d in mem2.data["details"])


def test_technical_decisions_reach_the_build_agents():
    """OORA's clarifying answers (guest checkout, OTP, etc.) surface as their own section in the agents' site spec."""
    from app.agents.base import site_spec

    project = {
        "name": "Kindred Goods",
        "settings": {
            "requirements": {
                "business": "An online shop",
                "details": [
                    "Browsing the catalogue: Login required to browse",
                    "Checkout: Guest checkout, no account needed",
                    "Sign-in method: Phone number with OTP",
                ],
            }
        },
        "pages": [{"name": "Home", "path": "/", "is_home": True, "tree": [{"type": "shop", "variant": "sidebar", "props": {}}]}],
    }
    spec = site_spec(project)
    assert "TECHNICAL DECISIONS FROM THE INTERVIEW" in spec
    assert "Login required to browse" in spec and "Guest checkout, no account needed" in spec and "Phone number with OTP" in spec


def test_cta_only_stays_on_the_landing_page():
    """A standalone cta band belongs on the home page only, and at most one per page."""
    from app.intake import sitewriter

    pages = [
        {"name": "Home", "is_home": True, "tree": [
            {"id": "n", "type": "navbar"}, {"id": "h", "type": "hero"},
            {"id": "c1", "type": "cta", "props": {}}, {"id": "t", "type": "testimonials"},
            {"id": "c2", "type": "cta", "props": {}}, {"id": "f", "type": "footer"},
        ]},
        {"name": "Journal", "is_home": False, "tree": [
            {"id": "n2", "type": "navbar"}, {"id": "h2", "type": "hero"},
            {"id": "cat", "type": "catalog"}, {"id": "c3", "type": "cta", "props": {}}, {"id": "f2", "type": "footer"},
        ]},
    ]
    sitewriter.prepare(pages)
    home_types = [n["type"] for n in pages[0]["tree"]]
    assert home_types.count("cta") == 1
    assert [n["id"] for n in pages[0]["tree"] if n["type"] == "cta"] == ["c2"]  # the last one is kept
    journal_types = [n["type"] for n in pages[1]["tree"]]
    assert "cta" not in journal_types


def test_a_numbered_markdown_outline_becomes_clean_page_names():
    """A model-written, numbered site plan ("1. **Home** - hero, offers") gives one page per line, not one per word."""
    outline = (
        "1. **Home** - hero, featured products, offers, quick ordering\n"
        "2. **Menu** - prices, product details, customization details, online ordering\n"
        "3. **Order online** - checkout, my orders\n"
        "4. **About & Gallery** - photos, products, customer experience\n"
        "5. **Contact** - opening hours, login, checkout, my orders, reviews, admin login, dashboard, engagement"
    )
    got = parse_pages(outline)
    assert got == {"count": 5, "names": ["Home", "Menu", "Order online", "About & Gallery", "Contact"]}
    assert not any("*" in n or n[0].isdigit() for n in got["names"])
