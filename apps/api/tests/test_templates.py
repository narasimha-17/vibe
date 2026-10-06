from httpx import AsyncClient


async def test_list_templates_route_not_shadowed_by_project_id(auth_client: AsyncClient):
    res = await auth_client.get("/projects/templates")
    assert res.status_code == 200
    keys = {t["key"] for t in res.json()}
    assert "saas" in keys
    assert "portfolio" in keys
