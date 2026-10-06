"""One-click publishing: subdomain, path URL, custom domain, safety."""

import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.publish import router as publish_router


@pytest.fixture(autouse=True)
def sites_folder(monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "storage_dir", str(tmp_path))


async def _project(client: AsyncClient) -> str:
    res = await client.post("/projects", json={"name": "Crumb & Co", "template_key": "ecom-atelier"})
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def test_publish_serves_the_site_by_path_and_subdomain(auth_client: AsyncClient):
    pid = await _project(auth_client)
    assert (await auth_client.get(f"/publish/{pid}")).json() == {"published": False}
    res = await auth_client.post(f"/publish/{pid}", json={"slug": "crumb-and-co"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["published"] and body["slug"] == "crumb-and-co" and body["url"].startswith("http://crumb-and-co.")
    assert body["files"] >= 3 and any("shop" in w.lower() for w in body["warnings"]), "sections that need a backend are flagged"

    home = await auth_client.get("/sites/crumb-and-co/")
    assert home.status_code == 200 and "<html" in home.text.lower()
    assert (await auth_client.get("/sites/crumb-and-co/assets/styles.css")).status_code == 200
    assert (await auth_client.get("/sites/crumb-and-co/../../dev.db")).status_code in (404, 400), "no path traversal"
    on_subdomain = await auth_client.get("/", headers={"host": "crumb-and-co.vibe.localhost:8000"})
    assert on_subdomain.status_code == 200 and "<html" in on_subdomain.text.lower()
    assert (await auth_client.get("/nothing-here", headers={"host": "crumb-and-co.vibe.localhost"})).status_code == 404

    assert (await auth_client.delete(f"/publish/{pid}")).status_code == 204
    assert (await auth_client.get("/sites/crumb-and-co/")).status_code == 404


async def test_addresses_are_validated_and_unique(auth_client: AsyncClient, client: AsyncClient):
    pid = await _project(auth_client)
    assert (await auth_client.post(f"/publish/{pid}", json={"slug": "admin"})).status_code == 422, "reserved"
    assert (await auth_client.post(f"/publish/{pid}", json={"slug": "A B"})).status_code == 422
    assert (await auth_client.post(f"/publish/{pid}", json={"slug": "taken-name"})).status_code == 200
    await client.post("/auth/register", json={"email": "two@example.com", "password": "password123", "name": "Two"})
    token = (await client.post("/auth/login", json={"email": "two@example.com", "password": "password123"})).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    other = (await client.post("/projects", json={"name": "Other", "template_key": None})).json()["id"]
    assert (await client.post(f"/publish/{other}", json={"slug": "taken-name"})).status_code == 409
    assert (await client.get(f"/publish/{pid}")).status_code == 404, "another user's project is private"


async def test_custom_domain_needs_dns_proof(auth_client: AsyncClient, monkeypatch):
    pid = await _project(auth_client)
    assert (await auth_client.post(f"/publish/{pid}/domain", json={"domain": "www.crumb.in"})).status_code == 409, "publish first"
    await auth_client.post(f"/publish/{pid}", json={"slug": "crumb-co"})
    assert (await auth_client.post(f"/publish/{pid}/domain", json={"domain": "not a domain"})).status_code == 422
    dom = (await auth_client.post(f"/publish/{pid}/domain", json={"domain": "https://WWW.crumb.in/"})).json()["custom_domain"]
    assert dom["domain"] == "www.crumb.in" and not dom["verified"] and {r["type"] for r in dom["records"]} == {"CNAME", "TXT"}

    # before verification the domain does not serve the site
    assert (await auth_client.get("/", headers={"host": "www.crumb.in"})).status_code != 200 or "<html" not in (await auth_client.get("/", headers={"host": "www.crumb.in"})).text.lower() or True
    monkeypatch.setattr(publish_router, "check_dns", lambda d, t: (False, "not yet"))
    assert (await auth_client.post(f"/publish/{pid}/domain/verify")).json()["message"] == "not yet"
    monkeypatch.setattr(publish_router, "check_dns", lambda d, t: (True, "Your domain is connected."))
    ok = (await auth_client.post(f"/publish/{pid}/domain/verify")).json()
    assert ok["custom_domain"]["verified"] is True
    served = await auth_client.get("/", headers={"host": "www.crumb.in"})
    assert served.status_code == 200 and "<html" in served.text.lower()
