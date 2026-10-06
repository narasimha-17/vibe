import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DEV_EXPOSE_OTP", "true")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.db import Base, get_db
from app.main import app

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def _override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


@pytest_asyncio.fixture(autouse=True)
async def _prepare_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient):
    await client.post("/auth/register", json={"email": "user@example.com", "password": "password123", "name": "Test User"})
    res = await client.post("/auth/login", json={"email": "user@example.com", "password": "password123"})
    token = res.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
