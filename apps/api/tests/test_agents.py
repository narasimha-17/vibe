"""The build agents end to end with a scripted language model (no network, no credits).

The fake model writes a tiny but real Next.js frontend and FastAPI backend, with one planted mismatch (the backend
forgets the contact route) that the Integration agent must catch and fix. The Testing agent's pytest run and the
TypeScript check are real.
"""

import json

import pytest

from app.agents import base, orchestrator
from app.ai import llm
from app.core.config import get_settings

PROJECT = {
    "name": "Crumb & Co",
    "theme": {"colors": {"primary": "#6b4d9a"}},
    "settings": {"projectBrief": {"brief": "A bakery in Kochi that sells cakes online"}},
    "pages": [
        {"name": "Home", "path": "/", "is_home": True, "tree": [
            {"id": "n", "type": "navbar", "variant": "default", "props": {"brand": "Crumb & Co", "links": ["Shop", "Contact"]}},
            {"id": "h", "type": "hero", "variant": "centered", "props": {"headline": "Cakes baked this morning"}},
            {"id": "f", "type": "forms", "variant": "contact", "props": {"heading": "Say hello"}},
        ]},
        {"name": "Shop", "path": "/shop", "is_home": False, "tree": [
            {"id": "s", "type": "shop", "variant": "sidebar", "props": {"products": [{"name": "Red Velvet", "price": "999"}]}},
        ]},
    ],
}

CONTRACT = {"entities": [{"name": "Product", "fields": {"id": "int", "name": "str", "price": "float"}}],
            "endpoints": [{"method": "GET", "path": "/api/products", "purpose": "List products"},
                          {"method": "POST", "path": "/api/contact", "purpose": "Send a message"}],
            "seed": "Red Velvet at 999"}


def block(path: str, body: str) -> str:
    return f"<<<FILE {path}>>>\n{body.strip()}\n<<<END>>>\n"


SHELL = (
    block("frontend/app/layout.tsx", '''
import "./globals.css";
import Navbar from "@/components/Navbar";
export const metadata = { title: "Crumb & Co" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><Navbar />{children}</body></html>);
}''')
    + block("frontend/app/globals.css", ":root { --primary: #6b4d9a; }")
    + block("frontend/components/Navbar.tsx", '''
import Link from "next/link";
export default function Navbar() {
  return (<nav><Link href="/">Crumb &amp; Co</Link> <Link href="/shop">Shop</Link></nav>);
}''')
    + block("frontend/lib/api.ts", '''
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export type Product = { id: number; name: string; price: number };
export async function listProducts(): Promise<Product[]> {
  const res = await fetch(`${BASE}/api/products`);
  if (!res.ok) throw new Error("Could not load products");
  return res.json();
}
export async function sendContact(body: { name: string; message: string }): Promise<void> {
  const res = await fetch(`${BASE}/api/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Could not send");
}''')
)

HOME = block("frontend/app/page.tsx", '''
"use client";
import { useState } from "react";
import { sendContact } from "@/lib/api";
export default function Home() {
  const [done, setDone] = useState(false);
  return (<main><h1>Cakes baked this morning</h1>
    <section id="contact"><button onClick={() => sendContact({ name: "A", message: "Hi" }).then(() => setDone(true))}>Send</button>{done && <p>Thanks!</p>}</section>
  </main>);
}''')

SHOP = block("frontend/app/shop/page.tsx", '''
"use client";
import { useEffect, useState } from "react";
import { listProducts, type Product } from "@/lib/api";
export default function Shop() {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => { listProducts().then(setItems).catch(() => setItems([])); }, []);
  return (<main>{items.map((p) => <p key={p.id}>{p.name} ₹{p.price}</p>)}</main>);
}''')

BACKEND_COMMON = (
    block("backend/app/__init__.py", "")
    + block("backend/app/database.py", '''
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
engine = create_engine(os.environ.get("DATABASE_URL", "sqlite:///./app.db"), connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
class Base(DeclarativeBase):
    pass''')
    + block("backend/app/models.py", '''
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    price: Mapped[float]''')
)

MAIN_WITHOUT_CONTACT = block("backend/app/main.py", '''
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import Base, SessionLocal, engine
from app.models import Product

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not db.query(Product).count():
            db.add(Product(name="Red Velvet", price=999.0)); db.commit()
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/api/products")
def products():
    with SessionLocal() as db:
        return [{"id": p.id, "name": p.name, "price": p.price} for p in db.query(Product).all()]''')

MAIN_FIXED = MAIN_WITHOUT_CONTACT.replace("<<<END>>>", "").rstrip() + '''

@app.post("/api/contact")
def contact(body: dict):
    if not body.get("message"):
        from fastapi import HTTPException
        raise HTTPException(422, "message is required")
    return {"ok": True}
<<<END>>>
'''

TESTS = (
    block("backend/tests/conftest.py", '''
import os, tempfile
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "t.db")
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c''')
    + block("backend/tests/test_api.py", '''
def test_products(client):
    items = client.get("/api/products").json()
    assert items and items[0]["name"]

def test_contact(client):
    assert client.post("/api/contact", json={"name": "A", "message": "Hi"}).status_code == 200
    assert client.post("/api/contact", json={"name": "A"}).status_code == 422''')
)


def fake_model(calls: list[str]):
    async def chat(system, messages, **_kw):
        user = messages[-1]["content"]
        if "You are the API Agent" in system:
            calls.append("api"); return json.dumps(CONTRACT)
        if "shared frontend shell" in system:
            calls.append("ui-shell"); return SHELL
        if "Write ONE page" in system:
            calls.append("ui-page"); return SHOP if "frontend/app/shop/page.tsx" in user else HOME
        if "You are the Backend Agent in a team" in system:
            calls.append("backend"); return BACKEND_COMMON + MAIN_WITHOUT_CONTACT
        if "You are the Integration Agent" in system:
            calls.append("integration-fix"); assert "/api/contact" in user; return MAIN_FIXED
        if "You are the Testing Agent" in system:
            calls.append("tests"); return TESTS
        raise AssertionError(f"unexpected prompt: {system[:80]}")
    return chat


@pytest.mark.asyncio
async def test_agents_build_a_shop_end_to_end(monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "storage_dir", str(tmp_path))
    calls: list[str] = []
    monkeypatch.setattr(llm, "chat", fake_model(calls))

    job = orchestrator.Job({"id": "t1", "project_id": "p", "owner_id": "u", "project_name": "Crumb & Co", "status": "running", "created": 0,
                            "finished": None, "error": None, "llm_calls": 0, "fix_rounds": 0, "needs_backend": base.needs_backend(PROJECT), "files": [],
                            "steps": [{"key": k, "name": n, "status": "pending", "detail": "", "files": []} for k, n in orchestrator.STEPS]})
    await orchestrator._run(job, PROJECT)

    steps = {s["key"]: s for s in job.data["steps"]}
    assert job.data["status"] == "done", json.dumps(job.data["steps"], indent=1)
    assert all(s["status"] == "done" for s in steps.values())
    assert "fixed 2 of 2 mismatches" in steps["integration"]["detail"]  # the frontend calls it + the contract has it
    assert "backend tests passed (2 passed), frontend type-check passed" in steps["testing"]["detail"], steps["testing"]["detail"]
    assert calls.count("ui-page") == 2 and "integration-fix" in calls
    files = set(job.data["files"])
    assert {"frontend/app/page.tsx", "frontend/app/shop/page.tsx", "frontend/package.json", "backend/app/main.py",
            "backend/requirements.txt", "backend/tests/test_api.py", "api-contract.json", "README.md", "INTEGRATION_REPORT.md", "TEST_REPORT.md"} <= files
    # saved to disk: survives a reload and zips
    again = orchestrator.load("t1")
    assert again and again.data["status"] == "done" and orchestrator.read_file(again, "backend/app/main.py")
    assert len(orchestrator.zip_bytes(again)) > 1000


def test_file_paths_from_the_model_stay_inside_the_build():
    text = block("../../etc/passwd", "x") + block("/abs/app/page.tsx", "ok") + block("frontend\\lib\\a.ts", "```ts\nlet a = 1;\n```")
    files = base.parse_files(text, "frontend/")
    assert files == {"frontend/abs/app/page.tsx": "ok\n", "frontend/lib/a.ts": "let a = 1;\n"}


@pytest.mark.asyncio
async def test_failing_tests_go_back_to_the_backend_agent(monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "storage_dir", str(tmp_path))
    calls: list[str] = []
    scripted = fake_model(calls)
    lax = MAIN_FIXED.replace('    if not body.get("message"):\n        from fastapi import HTTPException\n        raise HTTPException(422, "message is required")\n', "")

    async def chat(system, messages, **kw):
        if "You are the Backend Agent in a team" in system:
            calls.append("backend"); return BACKEND_COMMON + lax  # has every route, but accepts an empty message
        if "Tests or checks of the backend you wrote failed" in system:
            calls.append("backend-fix"); assert "422" in messages[-1]["content"]; return MAIN_FIXED
        return await scripted(system, messages, **kw)

    monkeypatch.setattr(llm, "chat", chat)
    job = orchestrator.Job({"id": "t2", "project_id": "p", "owner_id": "u", "project_name": "x", "status": "running", "created": 0, "finished": None,
                            "error": None, "llm_calls": 0, "fix_rounds": 0, "needs_backend": True, "files": [],
                            "steps": [{"key": k, "name": n, "status": "pending", "detail": "", "files": []} for k, n in orchestrator.STEPS]})
    await orchestrator._run(job, PROJECT)
    assert job.data["status"] == "done" and job.data["fix_rounds"] == 1
    assert "integration-fix" not in calls and calls.count("backend-fix") == 1


@pytest.mark.asyncio
async def test_ui_agent_builds_from_the_builder_design(monkeypatch, tmp_path):
    """With a design reference, the builder's CSS ships as vibe-design.css and every UI prompt carries the rendered markup."""
    monkeypatch.setattr(get_settings(), "storage_dir", str(tmp_path))
    seen: list[str] = []
    scripted = fake_model([])

    async def chat(system, messages, **kw):
        if "shared frontend shell" in system or "Write ONE page" in system:
            seen.append(messages[-1]["content"])
        return await scripted(system, messages, **kw)

    monkeypatch.setattr(llm, "chat", chat)
    reference = {"root": '<div class="site-preview theme-light" data-styled="true" style="--s-primary: #6b4d9a">',
                 "css": ".site-preview[data-styled] .hero { padding: 96px; }", "pages": {"Home": '<section class="hero">Cakes</section>', "Shop": '<div class="shop">x</div>'}}
    project = {**PROJECT, "reference": reference}
    job = orchestrator.Job({"id": "t3", "project_id": "p", "owner_id": "u", "project_name": "x", "status": "running", "created": 0, "finished": None,
                            "error": None, "llm_calls": 0, "fix_rounds": 0, "needs_backend": True, "files": [],
                            "steps": [{"key": k, "name": n, "status": "pending", "detail": "", "files": []} for k, n in orchestrator.STEPS]})
    await orchestrator._run(job, project)
    css = orchestrator.read_file(job, "frontend/app/vibe-design.css")
    assert css and ":root { --s-primary: #6b4d9a }" in css and "body[data-styled] .hero { padding: 96px; }" in css
    shell_prompt, *page_prompts = seen[:3]
    assert '<body className="theme-light" data-styled="true">' in shell_prompt and 'class="hero"' in shell_prompt
    assert any('class="shop"' in p for p in page_prompts) and any('class="hero"' in p for p in page_prompts)


def test_custom_sections_are_made_safe_and_scoped():
    from app.agents.custom_section import clean_html, scope_css

    html = clean_html('<section class="cx-a1" onclick="steal()"><script>alert(1)</script><a href="javascript:x()">Hi</a><iframe src="//e"></iframe></section>')
    assert html == '<section class="cx-a1"><a href="#">Hi</a></section>'
    css = scope_css(".cx-a1 .t{color:red} h2, .x:hover{margin:0} @media (max-width:760px){.grid{display:block}} @keyframes k{from{opacity:0}}", ".cx-a1")
    assert ".cx-a1 h2, .cx-a1 .x:hover" in css and ".cx-a1 .grid" in css and "@keyframes k {from{opacity:0}}" in css


def test_the_instant_export_keeps_custom_sections():
    from app.codegen.registry import render_node

    node = {"id": "c", "type": "hero", "variant": "split", "props": {"custom": {"html": '<section class="cx-a1">Hi</section>', "css": ".cx-a1{color:red}"}}}
    assert render_node(node, {}, "class").endswith('<section class="cx-a1">Hi</section>')
    assert render_node(node, {}, "className").startswith("<div dangerouslySetInnerHTML={{ __html: ")


@pytest.mark.asyncio
async def test_agents_remember_lessons_between_builds(monkeypatch, tmp_path):
    """A fix explained in one build's notes reaches the next build's prompts; the notes board is saved as NOTES.md."""
    from app.agents import memory

    monkeypatch.setattr(get_settings(), "storage_dir", str(tmp_path))
    scripted = fake_model([])
    lax = MAIN_FIXED.replace('    if not body.get("message"):\n        from fastapi import HTTPException\n        raise HTTPException(422, "message is required")\n', "")
    prompts: list[str] = []

    async def chat(system, messages, **kw):
        prompts.append(messages[-1]["content"])
        if "You are the Backend Agent in a team" in system:
            return BACKEND_COMMON + lax
        if "Tests or checks of the backend you wrote failed" in system:
            return MAIN_FIXED + "<<<NOTES>>>\n- POST /api/contact accepted an empty message because nothing validated it; now answers 422\n<<<END>>>\n"
        return await scripted(system, messages, **kw)

    monkeypatch.setattr(llm, "chat", chat)

    def new_job(jid):
        return orchestrator.Job({"id": jid, "project_id": "p", "owner_id": "user-1", "project_name": "x", "status": "running", "created": 0, "finished": None,
                                 "error": None, "llm_calls": 0, "fix_rounds": 0, "needs_backend": True, "files": [],
                                 "steps": [{"key": k, "name": n, "status": "pending", "detail": "", "files": []} for k, n in orchestrator.STEPS]})

    first = new_job("m1")
    await orchestrator._run(first, PROJECT)
    assert first.data["status"] == "done"
    assert any(n["kind"] == "fix" and "empty message" in n["text"] for n in first.data["notes"])
    assert "empty message" in orchestrator.read_file(first, "NOTES.md")
    saved = memory.load("user-1")
    assert saved["builds"] == 1 and any("empty message" in l["text"] for l in saved["lessons"])

    prompts.clear()
    await orchestrator._run(new_job("m2"), PROJECT)
    assert any("LESSONS FROM EARLIER BUILDS" in p and "empty message" in p for p in prompts)
    assert any("TEAM NOTES" in p and "Contract endpoints: GET /api/products" in p for p in prompts)


def test_the_api_contract_must_cover_what_the_site_needs():
    """Bookings, payments, reviews and accounts named in the pages or requirements are required, not optional."""
    project = {"settings": {"requirements": {"features": ["review", "booking"], "objectives": ["grow online bookings"]}},
               "pages": [{"name": "Home", "tree": [{"type": "forms", "variant": "contact"}]},
                         {"name": "Customer Account", "tree": [{"type": "auth", "variant": "login-split"}]},
                         {"name": "Payments", "tree": []}]}
    keys = [k for k, _ in base.required_features(project)]
    assert {"bookings", "payments", "reviews", "accounts", "contact"} <= set(keys)
    enquiries_only = {"entities": [{"name": "TripEnquiry"}], "endpoints": [{"method": "POST", "path": "/api/enquiries", "purpose": "send an enquiry"}]}
    assert len(base.missing_features(enquiries_only, base.required_features(project))) == 4
    full = {"entities": [{"name": "Booking"}, {"name": "Review"}],
            "endpoints": [{"path": "/api/bookings"}, {"path": "/api/bookings/{id}/pay"}, {"path": "/api/reviews"}, {"path": "/api/auth/login"}, {"path": "/api/contact"}]}
    assert base.missing_features(full, base.required_features(project)) == []


def test_page_names_from_a_sentence():
    from app.intake.topics import parse_pages

    got = parse_pages("Website will include Home, Destinations, Booking & Reviews, Customer Account, and an admin panel to manage Packages, Customers, Payments, Website content")
    assert got["names"] == ["Home", "Destinations", "Booking & Reviews", "Customer Account", "Admin"]
