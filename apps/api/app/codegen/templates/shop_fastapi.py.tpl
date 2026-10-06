"""E-commerce API: products with filters, reviews, orders, Razorpay payments and order tracking.

Prices are always computed on the server from the database. The client only sends product ids and quantities.
Razorpay runs in "mock" mode when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set, so the whole flow can be
tested locally. Set both keys to switch to live payments.
"""

import hashlib
import hmac
import json
import os
import secrets
import string

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Session, relationship

from app.database import Base, SessionLocal, get_db
from app.routes import require_admin

router = APIRouter(prefix="/api", tags=["shop"])

SEED_PRODUCTS = __SEED_PRODUCTS__

FLOW = ["pending_payment", "paid", "packed", "shipped", "delivered"]


# ───────────────────────── models ─────────────────────────
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    price = Column(Float, nullable=False)
    description = Column(Text, default="")
    image = Column(String(500), default="")
    category = Column(String(120), default="", index=True)
    stock = Column(Integer, default=100)
    created_at = Column(DateTime, server_default=func.now())


class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    author = Column(String(120), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    number = Column(String(20), unique=True, index=True, nullable=False)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=False, index=True)
    customer_phone = Column(String(40), default="")
    address_line = Column(String(500), default="")
    city = Column(String(120), default="")
    state = Column(String(120), default="")
    pincode = Column(String(12), default="")
    subtotal = Column(Float, nullable=False)
    shipping = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    status = Column(String(30), default="pending_payment", index=True)
    razorpay_order_id = Column(String(80), index=True)
    razorpay_payment_id = Column(String(80))
    created_at = Column(DateTime, server_default=func.now())
    items = relationship("OrderItem", cascade="all, delete-orphan")
    events = relationship("OrderEvent", cascade="all, delete-orphan", order_by="OrderEvent.id")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(Float, nullable=False)
    qty = Column(Integer, nullable=False)


class OrderEvent(Base):
    __tablename__ = "order_events"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    status = Column(String(30), nullable=False)
    note = Column(String(500), default="")
    created_at = Column(DateTime, server_default=func.now())


# ───────────────────────── schemas ─────────────────────────
class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    price: float = Field(gt=0)
    description: str = ""
    image: str = ""
    category: str = ""
    stock: int = Field(default=100, ge=0)


class ProductOut(ProductIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    rating: float = 0.0
    reviews_count: int = 0


class ReviewIn(BaseModel):
    author: str = Field(min_length=1, max_length=120)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class ReviewOut(ReviewIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class Customer(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str = ""


class Address(BaseModel):
    line1: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    pincode: str = Field(pattern=r"^[0-9]{6}$")


class LineIn(BaseModel):
    product_id: int
    qty: int = Field(ge=1, le=20)


class OrderIn(BaseModel):
    customer: Customer
    address: Address
    items: list[LineIn] = Field(min_length=1, max_length=50)


class VerifyIn(BaseModel):
    order_number: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class StatusIn(BaseModel):
    status: str
    note: str = ""


# ───────────────────────── helpers ─────────────────────────
def _rating_map(db: Session, ids: list[int]) -> dict[int, tuple[float, int]]:
    if not ids:
        return {}
    rows = db.query(Review.product_id, func.avg(Review.rating), func.count(Review.id)).filter(Review.product_id.in_(ids)).group_by(Review.product_id).all()
    return {pid: (round(float(avg), 1), int(cnt)) for pid, avg, cnt in rows}


def _product_out(p: Product, ratings: dict[int, tuple[float, int]]) -> ProductOut:
    avg, count = ratings.get(p.id, (0.0, 0))
    return ProductOut(id=p.id, name=p.name, price=p.price, description=p.description or "", image=p.image or "", category=p.category or "", stock=p.stock or 0, rating=avg, reviews_count=count)


def _razorpay_mode() -> str:
    return "live" if os.getenv("RAZORPAY_KEY_ID") and os.getenv("RAZORPAY_KEY_SECRET") else "mock"


def _razorpay_secret() -> str:
    return os.getenv("RAZORPAY_KEY_SECRET") or "mock_secret"


def _signature(razorpay_order_id: str, payment_id: str) -> str:
    return hmac.new(_razorpay_secret().encode(), f"{razorpay_order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def _create_razorpay_order(amount_paise: int, receipt: str) -> str:
    if _razorpay_mode() == "mock":
        return f"order_mock_{secrets.token_hex(6)}"
    try:
        res = httpx.post(
            "https://api.razorpay.com/v1/orders",
            auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]),
            json={"amount": amount_paise, "currency": "INR", "receipt": receipt},
            timeout=15,
        )
        res.raise_for_status()
        return res.json()["id"]
    except (httpx.HTTPError, KeyError):
        raise HTTPException(502, "Payment provider is unavailable. Please try again.")


def _new_number(db: Session) -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        number = "ORD-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not db.query(Order.id).filter(Order.number == number).first():
            return number


def _event(order: Order, status: str, note: str = "") -> None:
    order.status = status
    order.events.append(OrderEvent(status=status, note=note))


def _mark_paid(db: Session, order: Order, payment_id: str) -> None:
    """Idempotent: safe to call from both the browser verify call and the webhook."""
    if order.status != "pending_payment":
        return
    order.razorpay_payment_id = payment_id
    for item in order.items:
        product = db.get(Product, item.product_id)
        if product:
            product.stock = max(0, (product.stock or 0) - item.qty)
    _event(order, "paid", "Payment confirmed")


def _order_view(order: Order) -> dict:
    return {
        "number": order.number,
        "status": order.status,
        "total": order.total,
        "subtotal": order.subtotal,
        "shipping": order.shipping,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": [{"name": i.name, "qty": i.qty, "price": i.price} for i in order.items],
        "events": [{"status": "placed" if e.status == "pending_payment" else e.status, "note": e.note, "created_at": e.created_at.isoformat() if e.created_at else None} for e in order.events],
    }


def seed_shop() -> None:
    db = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            db.add_all(Product(**row) for row in SEED_PRODUCTS)
            db.commit()
    finally:
        db.close()


# ───────────────────────── products ─────────────────────────
@router.get("/products/categories", response_model=list[str])
def categories(db: Session = Depends(get_db)):
    rows = db.query(Product.category).filter(Product.category != "").distinct().order_by(Product.category).all()
    return [r[0] for r in rows]


@router.get("/products", response_model=list[ProductOut])
def list_products(
    q: str = "",
    category: str = "",
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    in_stock: bool = False,
    sort: str = "newest",
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(func.lower(Product.name).like(like) | func.lower(Product.description).like(like))
    if category:
        query = query.filter(Product.category == category)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    if in_stock:
        query = query.filter(Product.stock > 0)
    rows = query.order_by(Product.id.desc()).all()
    ratings = _rating_map(db, [p.id for p in rows])
    out = [_product_out(p, ratings) for p in rows]
    if sort == "price_asc":
        out.sort(key=lambda p: p.price)
    elif sort == "price_desc":
        out.sort(key=lambda p: -p.price)
    elif sort == "rating":
        out.sort(key=lambda p: (-p.rating, -p.reviews_count))
    return out


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return _product_out(p, _rating_map(db, [p.id]))


@router.post("/products", response_model=ProductOut, status_code=201, dependencies=[Depends(require_admin)])
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    p = Product(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _product_out(p, {})


@router.put("/products/{product_id}", response_model=ProductOut, dependencies=[Depends(require_admin)])
def update_product(product_id: int, data: ProductIn, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    for key, value in data.model_dump().items():
        setattr(p, key, value)
    db.commit()
    return _product_out(p, _rating_map(db, [p.id]))


@router.delete("/products/{product_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    db.delete(p)
    db.commit()


# ───────────────────────── reviews ─────────────────────────
@router.get("/products/{product_id}/reviews", response_model=list[ReviewOut])
def list_reviews(product_id: int, db: Session = Depends(get_db)):
    return db.query(Review).filter(Review.product_id == product_id).order_by(Review.id.desc()).all()


@router.post("/products/{product_id}/reviews", response_model=ReviewOut, status_code=201)
def add_review(product_id: int, data: ReviewIn, db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    review = Review(product_id=product_id, **data.model_dump())
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


# ───────────────────────── orders & payments ─────────────────────────
@router.post("/orders", status_code=201)
def create_order(data: OrderIn, db: Session = Depends(get_db)):
    lines, subtotal = [], 0.0
    wanted: dict[int, int] = {}
    for line in data.items:
        wanted[line.product_id] = wanted.get(line.product_id, 0) + line.qty
    for product_id, qty in wanted.items():
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(422, f"Product {product_id} does not exist")
        if (product.stock or 0) < qty:
            raise HTTPException(409, f"Only {product.stock or 0} of “{product.name}” left in stock")
        lines.append((product, qty))
        subtotal += product.price * qty
    free_over = float(os.getenv("FREE_SHIPPING_OVER", "999"))
    shipping = 0.0 if subtotal >= free_over else float(os.getenv("SHIPPING_FLAT", "49"))
    total = round(subtotal + shipping, 2)

    order = Order(
        number=_new_number(db),
        customer_name=data.customer.name,
        customer_email=data.customer.email.lower(),
        customer_phone=data.customer.phone,
        address_line=data.address.line1,
        city=data.address.city,
        state=data.address.state,
        pincode=data.address.pincode,
        subtotal=round(subtotal, 2),
        shipping=shipping,
        total=total,
    )
    order.items = [OrderItem(product_id=p.id, name=p.name, price=p.price, qty=qty) for p, qty in lines]
    _event(order, "pending_payment", "Order placed, waiting for payment")
    order.razorpay_order_id = _create_razorpay_order(int(round(total * 100)), order.number)
    db.add(order)
    db.commit()
    return {
        "order_number": order.number,
        "subtotal": order.subtotal,
        "shipping": shipping,
        "total": total,
        "razorpay": {"order_id": order.razorpay_order_id, "amount": int(round(total * 100)), "currency": "INR", "key_id": os.getenv("RAZORPAY_KEY_ID", "mock_key"), "mode": _razorpay_mode()},
    }


@router.get("/payments/razorpay/mock-sign")
def mock_sign(order_id: str):
    """Only exists in mock mode. Lets local tests complete a payment without Razorpay."""
    if _razorpay_mode() != "mock":
        raise HTTPException(404, "Not found")
    payment_id = f"pay_mock_{secrets.token_hex(6)}"
    return {"payment_id": payment_id, "signature": _signature(order_id, payment_id)}


@router.post("/payments/razorpay/verify")
def verify_payment(data: VerifyIn, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.number == data.order_number).first()
    if not order or order.razorpay_order_id != data.razorpay_order_id:
        raise HTTPException(404, "Order not found")
    if not hmac.compare_digest(_signature(data.razorpay_order_id, data.razorpay_payment_id), data.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")
    _mark_paid(db, order, data.razorpay_payment_id)
    db.commit()
    return {"status": order.status, "order_number": order.number}


@router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(default=""), db: Session = Depends(get_db)):
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(503, "Webhook secret not configured")
    body = await request.body()
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_razorpay_signature):
        raise HTTPException(400, "Invalid signature")
    event = json.loads(body or b"{}")
    entity = event.get("payload", {}).get("payment", {}).get("entity", {})
    if event.get("event") in ("payment.captured", "order.paid") and entity.get("order_id"):
        order = db.query(Order).filter(Order.razorpay_order_id == entity["order_id"]).first()
        if order:
            _mark_paid(db, order, entity.get("id", ""))
            db.commit()
    return {"received": True}


@router.get("/orders/{number}")
def track_order(number: str, email: str = "", db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.number == number.upper()).first()
    if not order or order.customer_email != email.strip().lower():
        raise HTTPException(404, "Order not found")
    return _order_view(order)


@router.get("/orders", dependencies=[Depends(require_admin)])
def list_orders(db: Session = Depends(get_db)):
    return [_order_view(o) | {"customer_email": o.customer_email} for o in db.query(Order).order_by(Order.id.desc()).all()]


@router.patch("/orders/{number}/status", dependencies=[Depends(require_admin)])
def update_status(number: str, data: StatusIn, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.number == number.upper()).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if data.status == "cancelled":
        if order.status in ("shipped", "delivered", "cancelled"):
            raise HTTPException(409, "This order can no longer be cancelled")
        if order.status != "pending_payment":  # was paid: put stock back
            for item in order.items:
                product = db.get(Product, item.product_id)
                if product:
                    product.stock = (product.stock or 0) + item.qty
    elif data.status in FLOW:
        current = FLOW.index(order.status) if order.status in FLOW else -1
        if FLOW.index(data.status) != current + 1:
            raise HTTPException(409, f"Cannot move from {order.status} to {data.status}")
    else:
        raise HTTPException(422, "Unknown status")
    _event(order, data.status, data.note)
    db.commit()
    return _order_view(order)
