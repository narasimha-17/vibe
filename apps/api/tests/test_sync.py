from httpx import AsyncClient

from app.schemas.schemas import DesignTokens


async def test_sync_updates_existing_page_tree(auth_client: AsyncClient):
    res = await auth_client.post("/projects", json={"name": "Sync Co"})
    project = res.json()
    page_id = project["pages"][0]["id"]

    payload = {
        "name": "Sync Co Renamed",
        "theme": DesignTokens().model_dump(),
        "pages": [
            {
                "id": page_id,
                "name": "Home",
                "path": "/",
                "is_home": True,
                "order": 0,
                "tree": [
                    {
                        "id": "n1",
                        "type": "hero",
                        "variant": "split",
                        "name": "Hero",
                        "props": {"headline": "Hello"},
                        "style": {},
                        "responsive": {},
                        "children": [],
                        "locked": False,
                        "hidden": False,
                    }
                ],
            }
        ],
    }
    res = await auth_client.put(f"/projects/{project['id']}/sync", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Sync Co Renamed"
    assert len(body["pages"]) == 1
    assert body["pages"][0]["tree"][0]["props"]["headline"] == "Hello"


async def test_sync_creates_new_page_with_client_id(auth_client: AsyncClient):
    res = await auth_client.post("/projects", json={"name": "Multi Page"})
    project = res.json()
    home = project["pages"][0]

    payload = {
        "name": project["name"],
        "theme": DesignTokens().model_dump(),
        "pages": [
            {"id": home["id"], "name": home["name"], "path": home["path"], "is_home": True, "order": 0, "tree": []},
            {"id": "client-generated-id", "name": "About", "path": "/about", "is_home": False, "order": 1, "tree": []},
        ],
    }
    res = await auth_client.put(f"/projects/{project['id']}/sync", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert len(body["pages"]) == 2
    assert any(p["id"] == "client-generated-id" for p in body["pages"])


async def test_sync_removes_deleted_pages(auth_client: AsyncClient):
    res = await auth_client.post("/projects", json={"name": "Del Page"})
    project = res.json()
    home = project["pages"][0]

    payload = {
        "name": project["name"],
        "theme": DesignTokens().model_dump(),
        "pages": [{"id": home["id"], "name": home["name"], "path": home["path"], "is_home": True, "order": 0, "tree": []}],
    }
    res = await auth_client.put(f"/projects/{project['id']}/sync", json=payload)
    assert len(res.json()["pages"]) == 1
