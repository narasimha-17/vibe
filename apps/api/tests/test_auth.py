from httpx import AsyncClient


async def test_register_and_login(client: AsyncClient):
    res = await client.post(
        "/auth/register", json={"email": "a@example.com", "password": "password123", "name": "A"}
    )
    assert res.status_code == 200
    assert "access_token" in res.json()

    res = await client.post("/auth/login", json={"email": "a@example.com", "password": "password123"})
    assert res.status_code == 200
    token = res.json()["access_token"]

    client.headers["Authorization"] = f"Bearer {token}"
    res = await client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == "a@example.com"


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/auth/register", json={"email": "b@example.com", "password": "password123"})
    res = await client.post("/auth/login", json={"email": "b@example.com", "password": "wrong"})
    assert res.status_code == 401


async def test_duplicate_email_rejected(client: AsyncClient):
    await client.post("/auth/register", json={"email": "c@example.com", "password": "password123"})
    res = await client.post("/auth/register", json={"email": "c@example.com", "password": "password123"})
    assert res.status_code == 409
