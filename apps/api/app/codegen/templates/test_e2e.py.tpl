"""End-to-end API tests generated with your project.

Run from the backend folder:  pytest -q
They start the real app against a temporary database and walk through what a visitor does:
browse, filter, review, order, pay (Razorpay mock mode), get confirmation and track the order.
"""

import os
import tempfile

_DB = os.path.join(tempfile.mkdtemp(), "e2e.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"
os.environ["ADMIN_API_KEY"] = "test-admin-key"
os.environ["JWT_SECRET"] = "test-jwt-secret"
os.environ["AUTH_DEV_EXPOSE_CODES"] = "1"
os.environ.pop("RAZORPAY_KEY_ID", None)
os.environ.pop("RAZORPAY_KEY_SECRET", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

ADMIN = {"X-Admin-Key": "test-admin-key"}
CUSTOMER = {"name": "Asha Nair", "email": "Asha@Example.com", "phone": "9876543210"}
ADDRESS = {"line1": "12 MG Road", "city": "Kochi", "state": "Kerala", "pincode": "682001"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
__SHOP_TESTS__
__EXTRA_TESTS__
