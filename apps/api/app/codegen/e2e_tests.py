"""Builds the generated backend's end-to-end test file (backend/tests/test_e2e.py)."""

SHOP_TESTS = '''

def _products(client):
    return client.get("/api/products").json()


def test_products_are_seeded_and_filterable(client):
    items = _products(client)
    assert items, "the shop should start with your demo products"
    first = items[0]
    hit = client.get("/api/products", params={"q": first["name"].split()[0]}).json()
    assert any(p["id"] == first["id"] for p in hit)
    categories = client.get("/api/products/categories").json()
    if categories:
        only = client.get("/api/products", params={"category": categories[0]}).json()
        assert only and all(p["category"] == categories[0] for p in only)
    ascending = [p["price"] for p in client.get("/api/products", params={"sort": "price_asc"}).json()]
    assert ascending == sorted(ascending)
    descending = [p["price"] for p in client.get("/api/products", params={"sort": "price_desc"}).json()]
    assert descending == sorted(descending, reverse=True)
    lowest = min(p["price"] for p in items)
    cheap = client.get("/api/products", params={"max_price": lowest}).json()
    assert cheap and all(p["price"] <= lowest for p in cheap)
    assert client.get("/api/products", params={"q": "zzzz-no-such-thing"}).json() == []


def test_reviews_update_the_rating(client):
    product = _products(client)[0]
    assert client.post(f"/api/products/{product['id']}/reviews", json={"author": "Meera", "rating": 5, "comment": "Great"}).status_code == 201
    assert client.post(f"/api/products/{product['id']}/reviews", json={"author": "Ravi", "rating": 3, "comment": "OK"}).status_code == 201
    assert client.post(f"/api/products/{product['id']}/reviews", json={"author": "X", "rating": 9, "comment": ""}).status_code == 422
    updated = client.get(f"/api/products/{product['id']}").json()
    assert updated["reviews_count"] == 2 and updated["rating"] == 4.0
    assert len(client.get(f"/api/products/{product['id']}/reviews").json()) == 2


def test_checkout_payment_and_tracking(client):
    product = next(p for p in _products(client) if p["stock"] >= 3)
    stock_before = product["stock"]
    body = {"customer": CUSTOMER, "address": ADDRESS, "items": [{"product_id": product["id"], "qty": 2}], "price": 1, "total": 1}
    res = client.post("/api/orders", json=body)
    assert res.status_code == 201, res.text
    order = res.json()
    subtotal = product["price"] * 2
    expected = round(subtotal + (0 if subtotal >= 999 else 49), 2)
    assert order["total"] == expected, "the server must price the order, never the browser"
    assert order["razorpay"]["mode"] == "mock" and order["razorpay"]["amount"] == int(round(expected * 100))

    rz = order["razorpay"]
    bad = client.post("/api/payments/razorpay/verify", json={"order_number": order["order_number"], "razorpay_order_id": rz["order_id"], "razorpay_payment_id": "pay_x", "razorpay_signature": "bad"})
    assert bad.status_code == 400
    assert client.get(f"/api/products/{product['id']}").json()["stock"] == stock_before, "no stock is taken before payment"

    sig = client.get("/api/payments/razorpay/mock-sign", params={"order_id": rz["order_id"]}).json()
    paid_body = {"order_number": order["order_number"], "razorpay_order_id": rz["order_id"], "razorpay_payment_id": sig["payment_id"], "razorpay_signature": sig["signature"]}
    ok = client.post("/api/payments/razorpay/verify", json=paid_body)
    assert ok.status_code == 200 and ok.json()["status"] == "paid"
    assert client.get(f"/api/products/{product['id']}").json()["stock"] == stock_before - 2
    assert client.post("/api/payments/razorpay/verify", json=paid_body).status_code == 200
    assert client.get(f"/api/products/{product['id']}").json()["stock"] == stock_before - 2, "verifying twice must not take stock twice"

    number = order["order_number"]
    tracked = client.get(f"/api/orders/{number}", params={"email": "asha@example.com"})
    assert tracked.status_code == 200 and tracked.json()["status"] == "paid"
    assert [e["status"] for e in tracked.json()["events"]] == ["placed", "paid"]
    assert client.get(f"/api/orders/{number}", params={"email": "someone@else.com"}).status_code == 404

    assert client.patch(f"/api/orders/{number}/status", json={"status": "packed"}).status_code == 401
    assert client.patch(f"/api/orders/{number}/status", json={"status": "delivered"}, headers=ADMIN).status_code == 409
    for step in ("packed", "shipped", "delivered"):
        assert client.patch(f"/api/orders/{number}/status", json={"status": step, "note": step}, headers=ADMIN).json()["status"] == step
    final = client.get(f"/api/orders/{number}", params={"email": CUSTOMER["email"]}).json()
    assert [e["status"] for e in final["events"]] == ["placed", "paid", "packed", "shipped", "delivered"]
    assert any(o["number"] == number for o in client.get("/api/orders", headers=ADMIN).json())


def test_order_validation_and_stock_limits(client):
    assert client.post("/api/orders", json={"customer": CUSTOMER, "address": ADDRESS, "items": []}).status_code == 422
    assert client.post("/api/orders", json={"customer": CUSTOMER, "address": {**ADDRESS, "pincode": "12"}, "items": [{"product_id": 1, "qty": 1}]}).status_code == 422
    assert client.post("/api/orders", json={"customer": CUSTOMER, "address": ADDRESS, "items": [{"product_id": 999999, "qty": 1}]}).status_code == 422
    scarce = client.post("/api/products", json={"name": "Last one", "price": 100, "stock": 1, "category": "Test"}, headers=ADMIN).json()
    assert client.post("/api/orders", json={"customer": CUSTOMER, "address": ADDRESS, "items": [{"product_id": scarce["id"], "qty": 2}]}).status_code == 409


def test_cancelled_paid_order_restocks(client):
    item = client.post("/api/products", json={"name": "Restock me", "price": 1500, "stock": 5}, headers=ADMIN).json()
    order = client.post("/api/orders", json={"customer": CUSTOMER, "address": ADDRESS, "items": [{"product_id": item["id"], "qty": 2}]}).json()
    rz = order["razorpay"]
    sig = client.get("/api/payments/razorpay/mock-sign", params={"order_id": rz["order_id"]}).json()
    client.post("/api/payments/razorpay/verify", json={"order_number": order["order_number"], "razorpay_order_id": rz["order_id"], "razorpay_payment_id": sig["payment_id"], "razorpay_signature": sig["signature"]})
    assert client.get(f"/api/products/{item['id']}").json()["stock"] == 3
    assert client.patch(f"/api/orders/{order['order_number']}/status", json={"status": "cancelled"}, headers=ADMIN).status_code == 200
    assert client.get(f"/api/products/{item['id']}").json()["stock"] == 5


def test_admin_product_management(client):
    payload = {"name": "Admin item", "price": 250, "stock": 4, "category": "Admin"}
    assert client.post("/api/products", json=payload).status_code == 401
    created = client.post("/api/products", json=payload, headers=ADMIN).json()
    assert client.put(f"/api/products/{created['id']}", json={**payload, "price": 300}, headers=ADMIN).json()["price"] == 300
    assert client.delete(f"/api/products/{created['id']}", headers=ADMIN).status_code == 204
    assert client.get(f"/api/products/{created['id']}").status_code == 404


def test_razorpay_webhook_marks_orders_paid(client, monkeypatch):
    import hashlib
    import hmac
    import json

    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "whsec")
    item = client.post("/api/products", json={"name": "Webhook item", "price": 2000, "stock": 3}, headers=ADMIN).json()
    order = client.post("/api/orders", json={"customer": CUSTOMER, "address": ADDRESS, "items": [{"product_id": item["id"], "qty": 1}]}).json()
    payload = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_web1", "order_id": order["razorpay"]["order_id"]}}}}).encode()
    good = hmac.new(b"whsec", payload, hashlib.sha256).hexdigest()
    assert client.post("/api/payments/razorpay/webhook", content=payload, headers={"X-Razorpay-Signature": "nope"}).status_code == 400
    assert client.post("/api/payments/razorpay/webhook", content=payload, headers={"X-Razorpay-Signature": good}).status_code == 200
    assert client.get(f"/api/orders/{order['order_number']}", params={"email": CUSTOMER["email"]}).json()["status"] == "paid"
'''

FORM_TESTS = {
    "ContactMessage": '''

def test_contact_form_is_stored(client):
    assert client.post("/api/contact", json={"name": "Asha", "email": "a@b.co", "message": "Hello"}).status_code == 201
    assert client.post("/api/contact", json={"name": "Asha", "email": "nope", "message": "Hello"}).status_code == 422
    assert client.get("/api/contact").status_code == 401
    assert any(m["message"] == "Hello" for m in client.get("/api/contact", headers=ADMIN).json())
''',
    "Booking": '''

def test_booking_form_is_stored(client):
    assert client.post("/api/bookings", json={"name": "Asha", "email": "a@b.co", "date": "2030-01-01"}).status_code == 201
    assert client.get("/api/bookings", headers=ADMIN).json()
''',
    "Subscriber": '''

def test_newsletter_signup_is_stored(client):
    assert client.post("/api/subscribers", json={"email": "n@b.co"}).status_code == 201
    assert client.get("/api/subscribers", headers=ADMIN).json()
''',
}

CHAT_TESTS = '''

def test_chatbot_answers_from_knowledge(client):
    knowledge = client.get("/api/knowledge").json()
    assert knowledge
    question = knowledge[0]["question"]
    assert client.post("/api/chat", json={"message": question}).json()["reply"] == knowledge[0]["answer"]
    assert client.post("/api/chat", json={"message": ""}).status_code == 422
'''

AUTH_TESTS = '''

def test_accounts_register_login_and_me(client):
    assert client.post("/api/auth/register", json={"email": "u@x.co", "password": "password123"}).status_code == 201
    assert client.post("/api/auth/register", json={"email": "u@x.co", "password": "password123"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "u@x.co", "password": "wrong-pass"}).status_code == 401
    token = client.post("/api/auth/login", json={"email": "u@x.co", "password": "password123"}).json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["email"] == "u@x.co"
    assert client.get("/api/auth/me").status_code == 401
'''


AUTHX_TESTS = '''

def test_forgot_and_reset_password_flow(client):
    client.post("/api/auth/register", json={"email": "reset@x.co", "password": "oldpassword1"})
    assert client.post("/api/auth/forgot", json={"email": "nobody@x.co"}).json() == {"sent": True}, "unknown emails get the same answer"
    sent = client.post("/api/auth/forgot", json={"email": "reset@x.co"}).json()
    assert sent["sent"] and len(sent["dev_code"]) == 6
    assert client.post("/api/auth/forgot", json={"email": "reset@x.co"}).status_code == 429, "sends are rate limited"
    assert client.post("/api/auth/reset", json={"email": "reset@x.co", "code": "000000", "password": "newpassword1"}).status_code == 400
    assert client.post("/api/auth/reset", json={"email": "reset@x.co", "code": sent["dev_code"], "password": "short"}).status_code == 422
    assert client.post("/api/auth/reset", json={"email": "reset@x.co", "code": sent["dev_code"], "password": "newpassword1"}).status_code == 200
    assert client.post("/api/auth/reset", json={"email": "reset@x.co", "code": sent["dev_code"], "password": "another-pass1"}).status_code == 400, "a code works only once"
    assert client.post("/api/auth/login", json={"email": "reset@x.co", "password": "oldpassword1"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "reset@x.co", "password": "newpassword1"}).status_code == 200


def test_one_time_code_sign_in_creates_and_signs_in(client):
    sent = client.post("/api/auth/otp/send", json={"email": "otp@x.co"}).json()
    assert client.post("/api/auth/otp/verify", json={"email": "otp@x.co", "code": "999999" if sent["dev_code"] != "999999" else "111111"}).status_code == 400
    ok = client.post("/api/auth/otp/verify", json={"email": "otp@x.co", "code": sent["dev_code"]})
    assert ok.status_code == 200
    token = ok.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["email"] == "otp@x.co"


def test_profile_update_and_change_password(client):
    token = client.post("/api/auth/register", json={"email": "prof@x.co", "password": "password123", "name": "Old"}).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    assert client.patch("/api/auth/me", json={"name": "New Name"}, headers=auth).json()["name"] == "New Name"
    assert client.patch("/api/auth/me", json={"name": "x"}).status_code == 401
    assert client.post("/api/auth/change-password", json={"current_password": "wrong-one", "new_password": "brandnewpass1"}, headers=auth).status_code == 400
    assert client.post("/api/auth/change-password", json={"current_password": "password123", "new_password": "brandnewpass1"}, headers=auth).status_code == 200
    assert client.post("/api/auth/login", json={"email": "prof@x.co", "password": "brandnewpass1"}).status_code == 200
'''


def build_e2e_tests(template: str, entity_names: set[str], auth: bool, shop: bool, authx: bool = False) -> str:
    parts = []
    if shop:
        parts.append(SHOP_TESTS)
    parts += [text for key, text in FORM_TESTS.items() if key in entity_names]
    if "ChatKnowledge" in entity_names:
        parts.append(CHAT_TESTS)
    if auth:
        parts.append(AUTH_TESTS)
    if authx:
        parts.append(AUTHX_TESTS)
    return template.replace("__SHOP_TESTS__", "").replace("__EXTRA_TESTS__", "".join(parts))
