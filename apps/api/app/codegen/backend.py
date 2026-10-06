"""Backend generator: turns what is on the user's pages into a working API project.

The site is inspected for components that need server support (contact / booking / newsletter forms, product
catalog, pricing plans, testimonials, team, FAQ, login / sign-up buttons). Each detected feature becomes an
entity with generated models, validation, routes and seed data, emitted for FastAPI, Flask or Django.
Output is deterministic (no LLM) so the same site always yields the same backend.
"""

import pathlib
import pprint
import re
from dataclasses import dataclass, field
from typing import Any

from app.codegen.engine import GenFile


@dataclass
class Fld:
    name: str
    type: str = "str"  # str | text | int | float | bool
    required: bool = True
    email: bool = False


@dataclass
class Entity:
    name: str
    slug: str
    fields: list[Fld]
    mode: str  # submit (public POST, admin GET) | read (public GET) | crud (public GET, admin write)
    seed: list[dict] = field(default_factory=list)
    reason: str = ""


def _num(value: Any) -> float:
    digits = re.sub(r"[^\d.]", "", str(value or ""))
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


CHAT: dict = {"on": False, "fallback": ""}
SHOP: dict = {"on": False, "products": []}
AUTHX: dict = {"on": False}
TEMPLATES = pathlib.Path(__file__).parent / "templates"


def detect(project: dict, want_auth: bool) -> tuple[list[Entity], bool]:
    """Returns (entities, needs_auth) inferred from the page trees."""
    entities: dict[str, Entity] = {}
    CHAT["on"] = False
    SHOP["on"] = False
    SHOP["products"] = []
    AUTHX["on"] = False
    needs_auth = want_auth
    for page in project.get("pages", []):
        for node in page.get("tree", []):
            t, v, p = node.get("type"), node.get("variant"), node.get("props", {}) or {}
            if t == "forms":
                if v == "booking":
                    entities.setdefault("Booking", Entity("Booking", "bookings", [Fld("name"), Fld("email", email=True), Fld("date"), Fld("time", required=False), Fld("notes", "text", False)], "submit", reason="Booking form"))
                elif v == "subscription":
                    entities.setdefault("Subscriber", Entity("Subscriber", "subscribers", [Fld("email", email=True)], "submit", reason="Newsletter form"))
                else:
                    entities.setdefault("ContactMessage", Entity("ContactMessage", "contact", [Fld("name"), Fld("email", email=True), Fld("message", "text")], "submit", reason="Contact form"))
            if t == "notifications" and v == "newsletter":
                entities.setdefault("Subscriber", Entity("Subscriber", "subscribers", [Fld("email", email=True)], "submit", reason="Newsletter banner"))
            if t == "catalog":
                seed = [{"name": i.get("name", ""), "price": _num(i.get("price")), "description": i.get("description", ""), "image": i.get("image", "")} for i in p.get("items", [])]
                entities["Product"] = Entity("Product", "products", [Fld("name"), Fld("price", "float"), Fld("description", "text", False), Fld("image", "str", False)], "crud", seed, "Product catalog")
            if t == "pricing":
                seed = [{"name": i.get("name", ""), "price": str(i.get("price", "")), "unit": i.get("unit", ""), "features": "\n".join(i.get("features", [])), "featured": bool(i.get("featured"))} for i in p.get("tiers", [])]
                entities["Plan"] = Entity("Plan", "plans", [Fld("name"), Fld("price"), Fld("unit", required=False), Fld("features", "text", False), Fld("featured", "bool", False)], "read", seed, "Pricing plans")
            if t == "testimonials":
                seed = [{"quote": i.get("quote", ""), "name": i.get("name", ""), "role": i.get("role", "")} for i in p.get("items", [])]
                entities["Testimonial"] = Entity("Testimonial", "testimonials", [Fld("quote", "text"), Fld("name"), Fld("role", required=False)], "read", seed, "Testimonials")
            if t == "team":
                seed = [{"name": i.get("name", ""), "role": i.get("role", "")} for i in p.get("items", [])]
                entities["TeamMember"] = Entity("TeamMember", "team", [Fld("name"), Fld("role", required=False)], "read", seed, "Team section")
            if t == "auth":
                AUTHX["on"] = True
                needs_auth = True
            if t in ("shop", "tracking"):
                SHOP["on"] = True
                if t == "shop":
                    for n, prod in enumerate(p.get("products", [])):
                        SHOP["products"].append(
                            {
                                "name": str(prod.get("name", f"Product {n + 1}")),
                                "price": _num(prod.get("price")) or 1.0,
                                "description": str(prod.get("description", "")),
                                "image": str(prod.get("image", "")),
                                "category": str(prod.get("category", "")),
                                "stock": int(prod.get("stock", 50) or 0),
                            }
                        )
            if t == "chatbot":
                seed = [{"question": i.get("q", ""), "answer": i.get("a", "")} for i in p.get("knowledge", [])]
                entities["ChatKnowledge"] = Entity("ChatKnowledge", "knowledge", [Fld("question"), Fld("answer", "text")], "read", seed, "Chatbot knowledge")
                entities["ChatMessage"] = Entity("ChatMessage", "chat_log", [Fld("message", "text"), Fld("reply", "text", False)], "internal", [], "Chatbot conversations")
                CHAT["fallback"] = str(p.get("fallback") or "I'm not sure about that yet. A teammate will get back to you shortly.")
                CHAT["on"] = True
            if t == "faq":
                seed = [{"question": i.get("q", ""), "answer": i.get("a", "")} for i in p.get("items", [])]
                entities["Faq"] = Entity("Faq", "faqs", [Fld("question"), Fld("answer", "text")], "read", seed, "FAQ")
            if t == "navbar":
                labels = " ".join(str(p.get(k, "")) for k in ("loginLabel", "ctaLabel", "cta")).lower()
                if p.get("loginLabel") or "sign" in labels or "log" in labels:
                    needs_auth = True
    if SHOP["on"]:
        entities.pop("Product", None)  # the shop module owns the products table
    return list(entities.values()), needs_auth


# ───────────────────────── helpers ─────────────────────────
def _lit(obj: Any) -> str:
    return pprint.pformat(obj, width=100, sort_dicts=False)


def _snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _endpoints(entities: list[Entity], auth: bool) -> list[str]:
    lines = ["GET    /api/health"]
    for e in entities:
        if e.mode == "internal":
            lines.append("POST   /api/chat            (public, returns the bot's reply)")
            continue
        if e.mode == "submit":
            lines += [f"POST   /api/{e.slug}            (public, stores a {e.name})", f"GET    /api/{e.slug}            (admin key required)"]
        elif e.mode == "read":
            lines.append(f"GET    /api/{e.slug}            (public)")
        else:
            lines += [f"GET    /api/{e.slug}            (public)", f"GET    /api/{e.slug}/{{id}}", f"POST   /api/{e.slug}            (admin key)", f"PUT    /api/{e.slug}/{{id}}       (admin key)", f"DELETE /api/{e.slug}/{{id}}       (admin key)"]
    if auth:
        lines += ["POST   /api/auth/register", "POST   /api/auth/login", "GET    /api/auth/me           (Bearer token)"]
        if AUTHX["on"]:
            lines += ["PATCH  /api/auth/me           (Bearer token)", "POST   /api/auth/change-password", "POST   /api/auth/forgot", "POST   /api/auth/reset", "POST   /api/auth/otp/send", "POST   /api/auth/otp/verify"]
    if SHOP["on"]:
        lines += [
            "GET    /api/products?q=&category=&min_price=&max_price=&in_stock=&sort=",
            "GET    /api/products/categories",
            "GET    /api/products/{id}",
            "GET    /api/products/{id}/reviews",
            "POST   /api/products/{id}/reviews",
            "POST   /api/orders                 (prices computed on the server)",
            "POST   /api/payments/razorpay/verify",
            "POST   /api/payments/razorpay/webhook",
            "GET    /api/orders/{number}?email=  (order tracking)",
            "GET    /api/orders                 (admin key)",
            "PATCH  /api/orders/{number}/status (admin key)",
            "POST/PUT/DELETE /api/products      (admin key)",
        ]
    return lines


def _readme(name: str, framework: str, db: str, entities: list[Entity], auth: bool, docker: bool) -> str:
    run = {
        "fastapi": "uvicorn app.main:app --reload",
        "flask": "flask --app app run --debug",
        "django": "python manage.py migrate && python manage.py seed && python manage.py runserver",
    }[framework]
    detected = "\n".join(f"- **{e.reason}** → `{e.name}` model, `/api/{e.slug}`" for e in entities) or "- No dynamic components found; only `/api/health` is generated."
    if auth:
        detected += "\n- **Login / sign-up button** → user accounts with JWT (`/api/auth/*`)"
    return f"""# {name} backend ({framework.capitalize()})

Generated by VIBE from the components on your pages.

## Detected from your site
{detected}

## Run it
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
{run}
```
{"Or with Docker: `docker compose up --build`." if docker else ""}

Database: **{db}** (set `DATABASE_URL` in `.env`).

## Endpoints
```
{chr(10).join(_endpoints(entities, auth))}
```

Admin routes need the header `X-Admin-Key: <ADMIN_API_KEY>` from your `.env`. Set a long random value before deploying.
Point your frontend at this API with `NEXT_PUBLIC_API_URL` and allow its origin in `CORS_ORIGINS`.
"""


def _env(db: str, auth: bool, framework: str, cors: str) -> str:
    url = {"sqlite": "sqlite:///./app.db", "postgres": "postgresql+psycopg://app:app@localhost:5432/app", "mysql": "mysql+pymysql://app:app@localhost:3306/app"}[db]
    if framework == "django":
        url = {"sqlite": "sqlite:///db.sqlite3", "postgres": "postgres://app:app@localhost:5432/app", "mysql": "mysql://app:app@localhost:3306/app"}[db]
    lines = [f"DATABASE_URL={url}", f"CORS_ORIGINS={cors}", "ADMIN_API_KEY=change-me-to-a-long-random-string"]
    if auth:
        lines.append("JWT_SECRET=change-me-to-another-long-random-string")
    if framework == "django":
        lines += ["DJANGO_SECRET_KEY=change-me", "DJANGO_DEBUG=1", "ALLOWED_HOSTS=*"]
    if AUTHX["on"]:
        lines += ["# Set to 1 in local development to get one-time codes in the API response. Never in production.", "AUTH_DEV_EXPOSE_CODES=0"]
    if SHOP["on"]:
        lines += [
            "# Razorpay: leave the keys empty to run in mock mode (no real payments).",
            "RAZORPAY_KEY_ID=",
            "RAZORPAY_KEY_SECRET=",
            "RAZORPAY_WEBHOOK_SECRET=",
            "FREE_SHIPPING_OVER=999",
            "SHIPPING_FLAT=49",
        ]
    return "\n".join(lines) + "\n"


def _requirements(framework: str, db: str, auth: bool) -> str:
    base = {
        "fastapi": ["fastapi>=0.110", "uvicorn[standard]>=0.29", "sqlalchemy>=2.0", "pydantic[email]>=2.6", "python-dotenv>=1.0"],
        "flask": ["Flask>=3.0", "Flask-SQLAlchemy>=3.1", "Flask-Cors>=4.0", "python-dotenv>=1.0", "email-validator>=2.1"],
        "django": ["Django>=5.0", "django-cors-headers>=4.3", "dj-database-url>=2.1", "python-dotenv>=1.0"],
    }[framework]
    if auth:
        base += ["PyJWT>=2.8"] if framework != "fastapi" else ["python-jose>=3.3", "passlib>=1.7", "bcrypt==4.0.1"]
    if db == "postgres":
        base.append("psycopg[binary]>=3.1")
    if db == "mysql":
        base.append("pymysql>=1.1")
    return "\n".join(base) + "\n"


def _docker(framework: str, db: str) -> list[GenFile]:
    cmd = {
        "fastapi": '["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]',
        "flask": '["flask", "--app", "app", "run", "--host", "0.0.0.0", "--port", "8000"]',
        "django": '["sh", "-c", "python manage.py migrate && python manage.py seed && python manage.py runserver 0.0.0.0:8000"]',
    }[framework]
    dockerfile = f"""FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD {cmd}
"""
    compose = "services:\n  api:\n    build: .\n    ports:\n      - \"8000:8000\"\n    env_file: .env\n"
    if db == "postgres":
        compose += "    depends_on:\n      - db\n    environment:\n      DATABASE_URL: " + ("postgres://app:app@db:5432/app" if framework == "django" else "postgresql+psycopg://app:app@db:5432/app") + "\n"
        compose += "  db:\n    image: postgres:16\n    environment:\n      POSTGRES_USER: app\n      POSTGRES_PASSWORD: app\n      POSTGRES_DB: app\n    volumes:\n      - dbdata:/var/lib/postgresql/data\nvolumes:\n  dbdata:\n"
    return [GenFile("Dockerfile", dockerfile), GenFile("docker-compose.yml", compose), GenFile(".dockerignore", ".venv\n__pycache__\n*.pyc\n.env\napp.db\ndb.sqlite3\n")]


# ───────────────────────── FastAPI ─────────────────────────
_SA = {"str": "String(255)", "text": "Text", "int": "Integer", "float": "Float", "bool": "Boolean"}
_PY = {"str": "str", "text": "str", "int": "int", "float": "float", "bool": "bool"}
_DEFAULT = {"str": '""', "text": '""', "int": "0", "float": "0.0", "bool": "False"}


def _fastapi(entities: list[Entity], auth: bool, cors: str) -> list[GenFile]:
    out: list[GenFile] = []
    out.append(GenFile("app/__init__.py", ""))
    out.append(GenFile("app/database.py", '''import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
'''))

    models = ["from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, func", "", "from app.database import Base", ""]
    for e in entities:
        models += ["", f"class {e.name}(Base):", f'    __tablename__ = "{_snake(e.name)}s"', "    id = Column(Integer, primary_key=True, index=True)"]
        for f in e.fields:
            null = "" if f.required else ", nullable=True"
            models.append(f"    {f.name} = Column({_SA[f.type]}{null})")
        models.append("    created_at = Column(DateTime, server_default=func.now())")
    if auth:
        models += ["", "", "class User(Base):", '    __tablename__ = "users"', "    id = Column(Integer, primary_key=True, index=True)", "    email = Column(String(255), unique=True, index=True, nullable=False)", "    name = Column(String(255), nullable=True)", "    password_hash = Column(String(255), nullable=False)", "    created_at = Column(DateTime, server_default=func.now())"]
    out.append(GenFile("app/models.py", "\n".join(models) + "\n"))

    sch = ["from pydantic import BaseModel, ConfigDict, EmailStr, Field", ""]
    for e in entities:
        sch += ["", f"class {e.name}In(BaseModel):"]
        for f in e.fields:
            typ = "EmailStr" if f.email else _PY[f.type]
            if f.required and f.type in ("str", "text"):
                sch.append(f"    {f.name}: {typ}" + (" = Field(min_length=1)" if not f.email else ""))
            elif f.required:
                sch.append(f"    {f.name}: {typ}")
            else:
                sch.append(f"    {f.name}: {typ} = {_DEFAULT[f.type]}")
        sch += ["", f"class {e.name}Out({e.name}In):", "    model_config = ConfigDict(from_attributes=True)", "    id: int", ""]
    if auth:
        sch += ["", "class RegisterIn(BaseModel):", "    email: EmailStr", "    password: str = Field(min_length=8)", '    name: str = ""', "", "", "class LoginIn(BaseModel):", "    email: EmailStr", "    password: str", "", "", "class UserOut(BaseModel):", "    model_config = ConfigDict(from_attributes=True)", "    id: int", "    email: EmailStr", "    name: str | None = None", "", "", "class TokenOut(BaseModel):", "    access_token: str", '    token_type: str = "bearer"']
    out.append(GenFile("app/schemas.py", "\n".join(sch) + "\n"))

    routes = ['import os', '', 'from fastapi import APIRouter, Depends, Header, HTTPException, status', 'from sqlalchemy.orm import Session', '', 'from app import models, schemas', 'from app.database import get_db', '', 'router = APIRouter(prefix="/api")', '', '', 'def require_admin(x_admin_key: str = Header(default="")):', '    expected = os.getenv("ADMIN_API_KEY", "")', '    if not expected or x_admin_key != expected:', '        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin key required")', '', '', '@router.get("/health")', 'def health():', '    return {"status": "ok"}']
    for e in entities:
        s = e.slug
        if e.mode == "internal":
            continue
        routes += ["", ""]
        if e.mode == "submit":
            routes += [f'@router.post("/{s}", response_model=schemas.{e.name}Out, status_code=201)', f"def create_{_snake(e.name)}(data: schemas.{e.name}In, db: Session = Depends(get_db)):", f"    row = models.{e.name}(**data.model_dump())", "    db.add(row)", "    db.commit()", "    db.refresh(row)", "    return row", "", "", f'@router.get("/{s}", response_model=list[schemas.{e.name}Out], dependencies=[Depends(require_admin)])', f"def list_{s}(db: Session = Depends(get_db)):", f"    return db.query(models.{e.name}).order_by(models.{e.name}.id.desc()).all()"]
        elif e.mode == "read":
            routes += [f'@router.get("/{s}", response_model=list[schemas.{e.name}Out])', f"def list_{s}(db: Session = Depends(get_db)):", f"    return db.query(models.{e.name}).order_by(models.{e.name}.id).all()"]
        else:
            n = e.name
            routes += [f'@router.get("/{s}", response_model=list[schemas.{n}Out])', f"def list_{s}(db: Session = Depends(get_db)):", f"    return db.query(models.{n}).order_by(models.{n}.id).all()", "", "", f'@router.get("/{s}/{{item_id}}", response_model=schemas.{n}Out)', f"def get_{_snake(n)}(item_id: int, db: Session = Depends(get_db)):", f"    row = db.get(models.{n}, item_id)", "    if not row:", '        raise HTTPException(404, "Not found")', "    return row", "", "", f'@router.post("/{s}", response_model=schemas.{n}Out, status_code=201, dependencies=[Depends(require_admin)])', f"def create_{_snake(n)}(data: schemas.{n}In, db: Session = Depends(get_db)):", f"    row = models.{n}(**data.model_dump())", "    db.add(row)", "    db.commit()", "    db.refresh(row)", "    return row", "", "", f'@router.put("/{s}/{{item_id}}", response_model=schemas.{n}Out, dependencies=[Depends(require_admin)])', f"def update_{_snake(n)}(item_id: int, data: schemas.{n}In, db: Session = Depends(get_db)):", f"    row = db.get(models.{n}, item_id)", "    if not row:", '        raise HTTPException(404, "Not found")', "    for key, value in data.model_dump().items():", "        setattr(row, key, value)", "    db.commit()", "    db.refresh(row)", "    return row", "", "", f'@router.delete("/{s}/{{item_id}}", status_code=204, dependencies=[Depends(require_admin)])', f"def delete_{_snake(n)}(item_id: int, db: Session = Depends(get_db)):", f"    row = db.get(models.{n}, item_id)", "    if not row:", '        raise HTTPException(404, "Not found")', "    db.delete(row)", "    db.commit()"]
    if CHAT["on"]:
        routes += ["", "", "STOP = {'the', 'and', 'for', 'you', 'your', 'with', 'what', 'how', 'can', 'are', 'have', 'this', 'that', 'about', 'does', 'please', 'need'}", "", "", "def _words(text: str) -> set[str]:", "    import re", "", '    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in STOP}', "", "", "class ChatIn(schemas.BaseModel):", "    message: str = schemas.Field(min_length=1, max_length=1000)", "", "", "class ChatOut(schemas.BaseModel):", "    reply: str", "", "", f"CHAT_FALLBACK = {CHAT['fallback']!r}", "", "", '@router.post("/chat", response_model=ChatOut)', "def chat(data: ChatIn, db: Session = Depends(get_db)):", "    words = _words(data.message)", "    best, best_score = CHAT_FALLBACK, 0", "    for row in db.query(models.ChatKnowledge).all():", "        score = len(_words(row.question) & words)", "        if score > best_score:", "            best, best_score = row.answer, score", "    db.add(models.ChatMessage(message=data.message, reply=best))", "    db.commit()", "    return ChatOut(reply=best)"]
    out.append(GenFile("app/routes.py", "\n".join(routes) + "\n"))

    if auth:
        out.append(GenFile("app/auth.py", '''import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"


def _secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if not secret:
        raise RuntimeError("Set JWT_SECRET in your .env")
    return secret


def make_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> models.User:
    if not cred:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        user_id = int(jwt.decode(cred.credentials, _secret(), algorithms=[ALGORITHM])["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


@router.post("/register", response_model=schemas.TokenOut, status_code=201)
def register(data: schemas.RegisterIn, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = models.User(email=data.email, name=data.name, password_hash=pwd.hash(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.TokenOut(access_token=make_token(user.id))


@router.post("/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not pwd.verify(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    return schemas.TokenOut(access_token=make_token(user.id))


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(current_user)):
    return user
'''))

    seed = {e.name: e.seed for e in entities if e.seed}
    out.append(GenFile("app/seed.py", f'''"""Starter rows taken from the content of your site."""

from app import models
from app.database import SessionLocal

SEED = {_lit(seed)}


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        for model_name, rows in SEED.items():
            model = getattr(models, model_name)
            if db.query(model).count() == 0:
                db.add_all(model(**row) for row in rows)
        db.commit()
    finally:
        db.close()
'''))

    out.append(GenFile("app/main.py", f'''import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app import models  # noqa: E402,F401  (registers tables)
from app.database import Base, engine  # noqa: E402
from app.routes import router  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402
{"from app.auth import router as auth_router  # noqa: E402" if auth else ""}
{"from app import shop  # noqa: E402" if SHOP["on"] else ""}
{"from app import auth_extra  # noqa: E402" if AUTHX["on"] else ""}


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_if_empty()
{"    shop.seed_shop()" if SHOP["on"] else ""}
    yield


app = FastAPI(title="Site API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "{cors}").split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
{"app.include_router(auth_router)" if auth else ""}
{"app.include_router(shop.router)" if SHOP["on"] else ""}
{"app.include_router(auth_extra.router)" if AUTHX["on"] else ""}
'''))
    return out


# ───────────────────────── Flask ─────────────────────────
_FL = {"str": "db.String(255)", "text": "db.Text", "int": "db.Integer", "float": "db.Float", "bool": "db.Boolean"}


def _flask(entities: list[Entity], auth: bool, cors: str) -> list[GenFile]:
    out: list[GenFile] = []
    m = ["from datetime import datetime, timezone", "", "from flask_sqlalchemy import SQLAlchemy", "", "db = SQLAlchemy()", "", "", "def _now():", "    return datetime.now(timezone.utc)", ""]
    for e in entities:
        m += ["", f"class {e.name}(db.Model):", f'    __tablename__ = "{_snake(e.name)}s"', "    id = db.Column(db.Integer, primary_key=True)"]
        for f in e.fields:
            m.append(f"    {f.name} = db.Column({_FL[f.type]}, nullable={'False' if f.required else 'True'})")
        m.append("    created_at = db.Column(db.DateTime, default=_now)")
        m += ["", "    def to_dict(self):", "        return {" + ", ".join(f'"{f.name}": self.{f.name}' for f in e.fields) + ', "id": self.id}']
    if auth:
        m += ["", "", "class User(db.Model):", '    __tablename__ = "users"', "    id = db.Column(db.Integer, primary_key=True)", "    email = db.Column(db.String(255), unique=True, nullable=False)", "    name = db.Column(db.String(255))", "    password_hash = db.Column(db.String(255), nullable=False)", "    created_at = db.Column(db.DateTime, default=_now)"]
    out.append(GenFile("models.py", "\n".join(m) + "\n"))

    def validate_fn(e: Entity) -> list[str]:
        return [f"{_snake(e.name)}_FIELDS = [" + ", ".join(f'("{f.name}", "{f.type}", {f.required}, {f.email})' for f in e.fields) + "]"]

    r = ["import os", "from functools import wraps", "", "from flask import Blueprint, jsonify, request", "", "from models import db, " + ", ".join([e.name for e in entities] + (["User"] if auth else [])), "", 'api = Blueprint("api", __name__, url_prefix="/api")', "", "", "def clean(payload, spec):", '    """Validates and coerces a JSON payload against (name, type, required, email) tuples."""', "    data, errors = {}, {}", "    for name, typ, required, email in spec:", "        value = (payload or {}).get(name)", '        if value in (None, ""):', "            if required:", '                errors[name] = "required"', "            data[name] = {'str': '', 'text': '', 'int': 0, 'float': 0.0, 'bool': False}[typ]", "            continue", "        try:", "            value = {'str': str, 'text': str, 'int': int, 'float': float, 'bool': bool}[typ](value)", "        except (TypeError, ValueError):", '            errors[name] = "invalid"', "            continue", '        if email and ("@" not in value or "." not in value.split("@")[-1]):', '            errors[name] = "invalid email"', "        data[name] = value", "    return data, errors", "", "", "def admin_only(fn):", "    @wraps(fn)", "    def wrapper(*args, **kwargs):", '        expected = os.getenv("ADMIN_API_KEY", "")', '        if not expected or request.headers.get("X-Admin-Key", "") != expected:', '            return jsonify(error="Admin key required"), 401', "        return fn(*args, **kwargs)", "", "    return wrapper", "", "", '@api.get("/health")', "def health():", '    return jsonify(status="ok")']
    for e in entities:
        if e.mode == "internal":
            continue
        n, s = e.name, e.slug
        r += ["", "", validate_fn(e)[0]]
        if e.mode == "submit":
            r += ["", "", f'@api.post("/{s}")', f"def create_{_snake(n)}():", f"    data, errors = clean(request.get_json(silent=True), {_snake(n)}_FIELDS)", "    if errors:", "        return jsonify(errors=errors), 422", f"    row = {n}(**data)", "    db.session.add(row)", "    db.session.commit()", "    return jsonify(row.to_dict()), 201", "", "", f'@api.get("/{s}")', "@admin_only", f"def list_{s}():", f"    return jsonify([x.to_dict() for x in {n}.query.order_by({n}.id.desc())])"]
        elif e.mode == "read":
            r += ["", "", f'@api.get("/{s}")', f"def list_{s}():", f"    return jsonify([x.to_dict() for x in {n}.query.order_by({n}.id)])"]
        else:
            r += ["", "", f'@api.get("/{s}")', f"def list_{s}():", f"    return jsonify([x.to_dict() for x in {n}.query.order_by({n}.id)])", "", "", f'@api.get("/{s}/<int:item_id>")', f"def get_{_snake(n)}(item_id):", f"    return jsonify({n}.query.get_or_404(item_id).to_dict())", "", "", f'@api.post("/{s}")', "@admin_only", f"def create_{_snake(n)}():", f"    data, errors = clean(request.get_json(silent=True), {_snake(n)}_FIELDS)", "    if errors:", "        return jsonify(errors=errors), 422", f"    row = {n}(**data)", "    db.session.add(row)", "    db.session.commit()", "    return jsonify(row.to_dict()), 201", "", "", f'@api.put("/{s}/<int:item_id>")', "@admin_only", f"def update_{_snake(n)}(item_id):", f"    row = {n}.query.get_or_404(item_id)", f"    data, errors = clean(request.get_json(silent=True), {_snake(n)}_FIELDS)", "    if errors:", "        return jsonify(errors=errors), 422", "    for key, value in data.items():", "        setattr(row, key, value)", "    db.session.commit()", "    return jsonify(row.to_dict())", "", "", f'@api.delete("/{s}/<int:item_id>")', "@admin_only", f"def delete_{_snake(n)}(item_id):", f"    row = {n}.query.get_or_404(item_id)", "    db.session.delete(row)", "    db.session.commit()", '    return "", 204']
    if CHAT["on"]:
        r += ["", "", "import re as _re", "", "_STOP = {'the', 'and', 'for', 'you', 'your', 'with', 'what', 'how', 'can', 'are', 'have', 'this', 'that', 'about', 'does', 'please', 'need'}", "", "", "def _words(text):", '    return {w for w in _re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in _STOP}', "", "", f"CHAT_FALLBACK = {CHAT['fallback']!r}", "", "", '@api.post("/chat")', "def chat():", "    body = request.get_json(silent=True) or {}", '    message = str(body.get("message", "")).strip()[:1000]', "    if not message:", '        return jsonify(error="message is required"), 422', "    words = _words(message)", "    best, best_score = CHAT_FALLBACK, 0", "    for row in ChatKnowledge.query.all():", "        score = len(_words(row.question) & words)", "        if score > best_score:", "            best, best_score = row.answer, score", "    db.session.add(ChatMessage(message=message, reply=best))", "    db.session.commit()", "    return jsonify(reply=best)"]
    if auth:
        r += ["", "", "# ── auth ──", "import datetime as _dt", "", "import jwt", "from werkzeug.security import check_password_hash, generate_password_hash", "", "", "def _token(user_id):", '    payload = {"sub": str(user_id), "exp": _dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(days=7)}', '    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")', "", "", '@api.post("/auth/register")', "def register():", "    body = request.get_json(silent=True) or {}", '    email, password = str(body.get("email", "")).strip().lower(), str(body.get("password", ""))', '    if "@" not in email or len(password) < 8:', '        return jsonify(error="Valid email and a password of 8+ characters are required"), 422', "    if User.query.filter_by(email=email).first():", '        return jsonify(error="Email already registered"), 409', '    user = User(email=email, name=body.get("name", ""), password_hash=generate_password_hash(password))', "    db.session.add(user)", "    db.session.commit()", '    return jsonify(access_token=_token(user.id), token_type="bearer"), 201', "", "", '@api.post("/auth/login")', "def login():", "    body = request.get_json(silent=True) or {}", '    user = User.query.filter_by(email=str(body.get("email", "")).strip().lower()).first()', '    if not user or not check_password_hash(user.password_hash, str(body.get("password", ""))):', '        return jsonify(error="Wrong email or password"), 401', '    return jsonify(access_token=_token(user.id), token_type="bearer")', "", "", '@api.get("/auth/me")', "def me():", '    header = request.headers.get("Authorization", "")', '    try:', '        user_id = int(jwt.decode(header.removeprefix("Bearer ").strip(), os.environ["JWT_SECRET"], algorithms=["HS256"])["sub"])', "    except Exception:", '        return jsonify(error="Invalid token"), 401', "    user = db.session.get(User, user_id)", '    return jsonify(id=user.id, email=user.email, name=user.name) if user else (jsonify(error="Not found"), 404)']
    out.append(GenFile("routes.py", "\n".join(r) + "\n"))

    seed = {e.name: e.seed for e in entities if e.seed}
    out.append(GenFile("seed.py", f'''"""Starter rows taken from the content of your site."""

from models import db
import models

SEED = {_lit(seed)}


def seed_if_empty():
    for model_name, rows in SEED.items():
        model = getattr(models, model_name)
        if model.query.count() == 0:
            db.session.add_all(model(**row) for row in rows)
    db.session.commit()
'''))
    out.append(GenFile("app.py", f'''import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

load_dotenv()

from models import db  # noqa: E402
from routes import api  # noqa: E402
from seed import seed_if_empty  # noqa: E402


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    CORS(app, origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "{cors}").split(",") if o.strip()])
    db.init_app(app)
    app.register_blueprint(api)
    with app.app_context():
        db.create_all()
        seed_if_empty()
    return app


app = create_app()
'''))
    return out


# ───────────────────────── Django ─────────────────────────
_DJ = {"str": "models.CharField(max_length=255{blank})", "text": "models.TextField({blank})", "int": "models.IntegerField({blank})", "float": "models.FloatField({blank})", "bool": "models.BooleanField(default=False)"}


def _django(entities: list[Entity], auth: bool, cors: str, db: str) -> list[GenFile]:
    out: list[GenFile] = []
    out.append(GenFile("manage.py", '''#!/usr/bin/env python
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
'''))
    out.append(GenFile("config/__init__.py", ""))
    out.append(GenFile("config/wsgi.py", 'import os\n\nfrom django.core.wsgi import get_wsgi_application\n\nos.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")\napplication = get_wsgi_application()\n'))
    out.append(GenFile("config/settings.py", f'''import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "corsheaders",
    "api",
]
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {{"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]}},
}}]
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {{"default": dj_database_url.config(default=os.getenv("DATABASE_URL", "sqlite:///db.sqlite3"))}}
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "{cors}").split(",") if o.strip()]
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
'''))
    out.append(GenFile("config/urls.py", 'from django.contrib import admin\nfrom django.urls import include, path\n\nurlpatterns = [\n    path("admin/", admin.site.urls),\n    path("api/", include("api.urls")),\n]\n'))
    out += [GenFile("api/__init__.py", ""), GenFile("api/apps.py", 'from django.apps import AppConfig\n\n\nclass ApiConfig(AppConfig):\n    name = "api"\n'), GenFile("api/management/__init__.py", ""), GenFile("api/management/commands/__init__.py", "")]

    m = ["from django.db import models", ""]
    for e in entities:
        m += ["", f"class {e.name}(models.Model):"]
        for f in e.fields:
            blank = "" if f.required else ("blank=True, default=''" if f.type in ("str", "text") else "null=True, blank=True")
            if f.type in ("str",) and not f.required:
                line = "models.CharField(max_length=255, blank=True, default='')"
            elif f.type == "str":
                line = "models.EmailField(max_length=255)" if f.email else "models.CharField(max_length=255)"
            else:
                line = _DJ[f.type].format(blank=blank)
            m.append(f"    {f.name} = {line}")
        m += ["    created_at = models.DateTimeField(auto_now_add=True)", "", "    def to_dict(self):", "        return {" + ", ".join(f'"{f.name}": self.{f.name}' for f in e.fields) + ', "id": self.id}']
    out.append(GenFile("api/models.py", "\n".join(m) + "\n"))
    out.append(GenFile("api/admin.py", "from django.contrib import admin\n\nfrom . import models\n\n" + "\n".join(f"admin.site.register(models.{e.name})" for e in entities) + "\n"))

    v = ["import json", "from functools import wraps", "", "from django.conf import settings", "from django.http import HttpResponse, JsonResponse", "from django.views.decorators.csrf import csrf_exempt", "", "from . import models", ""]
    v += ["", "def body(request):", "    try:", "        return json.loads(request.body or b'{}')", "    except ValueError:", "        return {}", "", "", "def clean(payload, spec):", "    data, errors = {}, {}", "    for name, typ, required, email in spec:", "        value = payload.get(name)", '        if value in (None, ""):', "            if required:", '                errors[name] = "required"', "            data[name] = {'str': '', 'text': '', 'int': 0, 'float': 0.0, 'bool': False}[typ]", "            continue", "        try:", "            value = {'str': str, 'text': str, 'int': int, 'float': float, 'bool': bool}[typ](value)", "        except (TypeError, ValueError):", '            errors[name] = "invalid"', "            continue", '        if email and ("@" not in value or "." not in value.split("@")[-1]):', '            errors[name] = "invalid email"', "        data[name] = value", "    return data, errors", "", "", "def admin_only(fn):", "    @wraps(fn)", "    def wrapper(request, *args, **kwargs):", '        key = settings.ADMIN_API_KEY', '        if not key or request.headers.get("X-Admin-Key", "") != key:', '            return JsonResponse({"error": "Admin key required"}, status=401)', "        return fn(request, *args, **kwargs)", "", "    return wrapper", "", "", "def health(request):", '    return JsonResponse({"status": "ok"})']
    urls = ["from django.urls import path", "", "from . import views", "", "urlpatterns = [", '    path("health", views.health),']
    for e in entities:
        if e.mode == "internal":
            continue
        n, s, sn = e.name, e.slug, _snake(e.name)
        v += ["", "", f"{sn}_FIELDS = [" + ", ".join(f'("{f.name}", "{f.type}", {f.required}, {f.email})' for f in e.fields) + "]"]
        if e.mode == "submit":
            v += ["", "", "@csrf_exempt", f"def {s}(request):", '    if request.method == "POST":', f"        data, errors = clean(body(request), {sn}_FIELDS)", "        if errors:", '            return JsonResponse({"errors": errors}, status=422)', f"        return JsonResponse(models.{n}.objects.create(**data).to_dict(), status=201)", '    if request.method == "GET":', f"        return _{s}_admin(request)", '    return HttpResponse(status=405)']
            v += ["", "", "@admin_only", f"def _{s}_admin(request):", f"    return JsonResponse([x.to_dict() for x in models.{n}.objects.order_by('-id')], safe=False)"]
            urls.append(f'    path("{s}", views.{s}),')
        elif e.mode == "read":
            v += ["", "", f"def {s}(request):", f"    return JsonResponse([x.to_dict() for x in models.{n}.objects.order_by('id')], safe=False)"]
            urls.append(f'    path("{s}", views.{s}),')
        else:
            v += ["", "", "@csrf_exempt", f"def {s}(request):", '    if request.method == "GET":', f"        return JsonResponse([x.to_dict() for x in models.{n}.objects.order_by('id')], safe=False)", '    if request.method == "POST":', f"        return _{s}_create(request)", '    return HttpResponse(status=405)', "", "", "@admin_only", f"def _{s}_create(request):", f"    data, errors = clean(body(request), {sn}_FIELDS)", "    if errors:", '        return JsonResponse({"errors": errors}, status=422)', f"    return JsonResponse(models.{n}.objects.create(**data).to_dict(), status=201)", "", "", "@csrf_exempt", f"def {s}_detail(request, pk):", f"    row = models.{n}.objects.filter(pk=pk).first()", "    if not row:", '        return JsonResponse({"error": "Not found"}, status=404)', '    if request.method == "GET":', "        return JsonResponse(row.to_dict())", '    if request.method == "PUT":', f"        return _{s}_update(request, row)", '    if request.method == "DELETE":', f"        return _{s}_delete(request, row)", '    return HttpResponse(status=405)', "", "", "@admin_only", f"def _{s}_update(request, row):", f"    data, errors = clean(body(request), {sn}_FIELDS)", "    if errors:", '        return JsonResponse({"errors": errors}, status=422)', "    for key, value in data.items():", "        setattr(row, key, value)", "    row.save()", "    return JsonResponse(row.to_dict())", "", "", "@admin_only", f"def _{s}_delete(request, row):", "    row.delete()", "    return HttpResponse(status=204)"]
            urls += [f'    path("{s}", views.{s}),', f'    path("{s}/<int:pk>", views.{s}_detail),']
    if CHAT["on"]:
        v += ["", "", "import re as _re", "", "_STOP = {'the', 'and', 'for', 'you', 'your', 'with', 'what', 'how', 'can', 'are', 'have', 'this', 'that', 'about', 'does', 'please', 'need'}", "", "", "def _words(text):", '    return {w for w in _re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in _STOP}', "", "", f"CHAT_FALLBACK = {CHAT['fallback']!r}", "", "", "@csrf_exempt", "def chat(request):", '    if request.method != "POST":', "        return HttpResponse(status=405)", '    message = str(body(request).get("message", "")).strip()[:1000]', "    if not message:", '        return JsonResponse({"error": "message is required"}, status=422)', "    words = _words(message)", "    best, best_score = CHAT_FALLBACK, 0", "    for row in models.ChatKnowledge.objects.all():", "        score = len(_words(row.question) & words)", "        if score > best_score:", "            best, best_score = row.answer, score", "    models.ChatMessage.objects.create(message=message, reply=best)", '    return JsonResponse({"reply": best})']
        urls.append('    path("chat", views.chat),')
    if auth:
        v += ["", "", "# ── auth ──", "import datetime as _dt", "", "import jwt", "from django.contrib.auth import get_user_model", "", "User = get_user_model()", "", "", "def _token(user_id):", '    payload = {"sub": str(user_id), "exp": _dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(days=7)}', '    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")', "", "", "@csrf_exempt", "def register(request):", '    if request.method != "POST":', "        return HttpResponse(status=405)", "    data = body(request)", '    email, password = str(data.get("email", "")).strip().lower(), str(data.get("password", ""))', '    if "@" not in email or len(password) < 8:', '        return JsonResponse({"error": "Valid email and a password of 8+ characters are required"}, status=422)', "    if User.objects.filter(username=email).exists():", '        return JsonResponse({"error": "Email already registered"}, status=409)', '    user = User.objects.create_user(username=email, email=email, password=password, first_name=data.get("name", ""))', '    return JsonResponse({"access_token": _token(user.id), "token_type": "bearer"}, status=201)', "", "", "@csrf_exempt", "def login(request):", '    if request.method != "POST":', "        return HttpResponse(status=405)", "    data = body(request)", "    from django.contrib.auth import authenticate", "", '    user = authenticate(username=str(data.get("email", "")).strip().lower(), password=str(data.get("password", "")))', "    if not user:", '        return JsonResponse({"error": "Wrong email or password"}, status=401)', '    return JsonResponse({"access_token": _token(user.id), "token_type": "bearer"})', "", "", "def me(request):", '    header = request.headers.get("Authorization", "")', "    try:", '        uid = int(jwt.decode(header.removeprefix("Bearer ").strip(), settings.JWT_SECRET, algorithms=["HS256"])["sub"])', "        user = User.objects.get(pk=uid)", "    except Exception:", '        return JsonResponse({"error": "Invalid token"}, status=401)', '    return JsonResponse({"id": user.id, "email": user.email, "name": user.first_name})']
        urls += ['    path("auth/register", views.register),', '    path("auth/login", views.login),', '    path("auth/me", views.me),']
    urls.append("]")
    out.append(GenFile("api/views.py", "\n".join(v) + "\n"))
    out.append(GenFile("api/urls.py", "\n".join(urls) + "\n"))
    seed = {e.name: e.seed for e in entities if e.seed}
    out.append(GenFile("api/management/commands/seed.py", f'''"""python manage.py seed: adds starter rows taken from the content of your site."""

from django.core.management.base import BaseCommand

from api import models

SEED = {_lit(seed)}


class Command(BaseCommand):
    help = "Insert starter content if tables are empty"

    def handle(self, *args, **options):
        for model_name, rows in SEED.items():
            model = getattr(models, model_name)
            if not model.objects.exists():
                model.objects.bulk_create(model(**row) for row in rows)
        self.stdout.write("Seeded.")
'''))
    return out


from app.codegen.e2e_tests import build_e2e_tests


def _e2e_tests(entities, auth):
    template = (TEMPLATES / "test_e2e.py.tpl").read_text(encoding="utf-8")
    return build_e2e_tests(template, {e.name for e in entities}, auth, SHOP["on"], AUTHX["on"])


def generate_backend(project: dict, opts) -> list[GenFile]:
    """Returns the backend project files (paths relative to the repo root, under `backend/`)."""
    framework = opts.framework
    entities, auth = detect(project, opts.auth)
    cors = opts.cors_origin or "http://localhost:3000"
    notes: list[str] = []
    if (SHOP["on"] or AUTHX["on"]) and framework != "fastapi":
        notes.append(f"E-commerce and full account features (password reset, one-time codes, profile) are generated for FastAPI, so {framework.capitalize()} was switched to FastAPI.")
        framework = "fastapi"
    if framework == "flask":
        files = _flask(entities, auth, cors)
    elif framework == "django":
        files = _django(entities, auth, cors, opts.database)
    else:
        files = _fastapi(entities, auth, cors)
    if SHOP["on"]:
        seed = SHOP["products"] or [{"name": "Sample product", "price": 499.0, "description": "Edit me", "image": "", "category": "General", "stock": 50}]
        files.append(GenFile("app/shop.py", (TEMPLATES / "shop_fastapi.py.tpl").read_text(encoding="utf-8").replace("__SEED_PRODUCTS__", _lit(seed))))
    if AUTHX["on"]:
        files.append(GenFile("app/auth_extra.py", (TEMPLATES / "auth_extra_fastapi.py.tpl").read_text(encoding="utf-8")))
    if framework == "fastapi":
        files.append(GenFile("tests/__init__.py", ""))
        files.append(GenFile("tests/test_e2e.py", _e2e_tests(entities, auth)))
        files.append(GenFile("pytest.ini", "[pytest]\npythonpath = .\ntestpaths = tests\n"))
    name = project.get("name", "My Website")
    files += [
        GenFile("requirements.txt", _requirements(framework, opts.database, auth) + (("httpx>=0.27\npytest>=8.0\n") if framework == "fastapi" else "")),
        GenFile(".env.example", _env(opts.database, auth, framework, cors)),
        GenFile(".gitignore", ".venv/\n__pycache__/\n*.pyc\n.env\napp.db\ndb.sqlite3\ninstance/\n"),
        GenFile("README.md", _readme(name, framework, opts.database, entities, auth, opts.docker) + ("\n## Notes\n" + "\n".join(f"- {n}" for n in notes) + "\n" if notes else "")),
    ]
    if opts.docker:
        files += _docker(framework, opts.database)
    return [GenFile(path=f"backend/{f.path}", content=f.content) for f in files]
