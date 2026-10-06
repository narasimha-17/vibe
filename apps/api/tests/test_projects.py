from httpx import AsyncClient


async def test_create_list_project(auth_client: AsyncClient):
    res = await auth_client.post("/projects", json={"name": "My Site"})
    assert res.status_code == 201
    project = res.json()
    assert project["name"] == "My Site"
    assert len(project["pages"]) == 1
    assert project["pages"][0]["is_home"] is True

    res = await auth_client.get("/projects")
    assert res.status_code == 200
    assert len(res.json()) == 1


async def test_create_from_template(auth_client: AsyncClient):
    res = await auth_client.post("/projects", json={"name": "SaaS Co", "template_key": "saas"})
    project = res.json()
    tree_types = [n["type"] for n in project["pages"][0]["tree"]]
    assert "pricing" in tree_types


async def test_update_and_duplicate_project(auth_client: AsyncClient):
    res = await auth_client.post("/projects", json={"name": "Original"})
    project_id = res.json()["id"]

    res = await auth_client.patch(f"/projects/{project_id}", json={"name": "Renamed"})
    assert res.json()["name"] == "Renamed"

    res = await auth_client.post(f"/projects/{project_id}/duplicate")
    assert res.status_code == 201
    assert res.json()["name"] == "Renamed (Copy)"

    res = await auth_client.get("/projects")
    assert len(res.json()) == 2


async def test_delete_project(auth_client: AsyncClient):
    res = await auth_client.post("/projects", json={"name": "ToDelete"})
    project_id = res.json()["id"]
    res = await auth_client.delete(f"/projects/{project_id}")
    assert res.status_code == 204
    res = await auth_client.get(f"/projects/{project_id}")
    assert res.status_code == 404


async def test_cannot_access_other_users_project(client: AsyncClient):
    await client.post("/auth/register", json={"email": "owner@example.com", "password": "password123"})
    login = await client.post("/auth/login", json={"email": "owner@example.com", "password": "password123"})
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    res = await client.post("/projects", json={"name": "Private"})
    project_id = res.json()["id"]

    await client.post("/auth/register", json={"email": "intruder@example.com", "password": "password123"})
    login2 = await client.post("/auth/login", json={"email": "intruder@example.com", "password": "password123"})
    client.headers["Authorization"] = f"Bearer {login2.json()['access_token']}"
    res = await client.get(f"/projects/{project_id}")
    assert res.status_code == 404


async def test_auto_fix_checklist_links_every_page_in_the_navbar(auth_client: AsyncClient):
    res = await auth_client.post("/projects", json={"name": "Rosewood Bakehouse"})
    project = res.json()
    project_id = project["id"]
    home = project["pages"][0]
    navbar = next(n for n in home["tree"] if n["type"] == "navbar")
    home_navbar = dict(navbar)
    home_navbar["props"] = dict(navbar["props"])
    home_navbar["props"]["links"] = ["Offers"]
    home_tree = [home_navbar if n["type"] == "navbar" else n for n in home["tree"]]

    pages = [
        {"id": home["id"], "name": "Home", "path": "/", "is_home": True, "tree": home_tree},
        {"id": "p2", "name": "Menu", "path": "/menu", "is_home": False, "tree": [dict(navbar, id="n2"), {"id": "c", "type": "catalog", "variant": "grid", "props": {}}, {"id": "f2", "type": "footer", "variant": "columns", "props": {}}]},
        {"id": "p3", "name": "Offers", "path": "/offers", "is_home": False, "tree": [dict(navbar, id="n3"), {"id": "c2", "type": "cta", "variant": "banner", "props": {}}, {"id": "c3", "type": "faq", "variant": "twocol", "props": {}}]},
    ]
    sync_res = await auth_client.put(f"/projects/{project_id}/sync", json={"name": project["name"], "theme": project["theme"], "pages": pages})
    assert sync_res.status_code == 200, sync_res.text

    res = await auth_client.post(f"/projects/{project_id}/checklist/auto-fix")
    assert res.status_code == 200
    body = res.json()
    assert body["linked"] == ["Menu"]  # "Offers" was already linked, so only "Menu" needed fixing

    updated = (await auth_client.get(f"/projects/{project_id}")).json()
    for page in updated["pages"]:
        nav = next(n for n in page["tree"] if n["type"] == "navbar")
        assert "Menu" in nav["props"]["links"] and "Offers" in nav["props"]["links"]
