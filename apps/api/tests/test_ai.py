import pytest

from app.ai.providers import OllamaProvider, RuleBasedProvider
from app.schemas.schemas import AICommandRequest


@pytest.mark.asyncio
async def test_dark_mode_prompt_produces_theme_op():
    provider = RuleBasedProvider()
    response = await provider.generate(AICommandRequest(prompt="make it dark mode"))
    assert response.provider == "rule_based"
    assert len(response.ops) == 1
    assert response.ops[0].op == "update_theme"
    assert response.ops[0].payload["colors"]["background"] == "#06080a"


@pytest.mark.asyncio
async def test_add_pricing_section():
    provider = RuleBasedProvider()
    response = await provider.generate(AICommandRequest(prompt="add a pricing section please"))
    assert response.ops[0].op == "add_component"
    assert response.ops[0].payload["type"] == "pricing"


@pytest.mark.asyncio
async def test_remove_existing_section():
    provider = RuleBasedProvider()
    tree_summary = [{"id": "abc123", "type": "testimonials", "name": "Testimonials"}]
    response = await provider.generate(
        AICommandRequest(prompt="remove the testimonials section", tree_summary=tree_summary)
    )
    assert response.ops[0].op == "delete_component"
    assert response.ops[0].target_id == "abc123"


@pytest.mark.asyncio
async def test_unrecognized_prompt_returns_no_ops_with_guidance():
    provider = RuleBasedProvider()
    response = await provider.generate(AICommandRequest(prompt="xyzzy plugh"))
    assert response.ops == []
    assert "add" in response.message.lower()


@pytest.mark.asyncio
async def test_rename_navbar_brand_produces_component_update():
    provider = RuleBasedProvider()
    response = await provider.generate(
        AICommandRequest(
            prompt="change the NOVA in navbar as Vona",
            tree_summary=[{"id": "nav-1", "type": "navbar", "name": "Navbar"}],
        )
    )
    assert response.ops[0].op == "update_component"
    assert response.ops[0].target_id == "nav-1"
    assert response.ops[0].payload["props"]["brand"] == "Vona"


@pytest.mark.asyncio
async def test_enable_theme_modes_produces_mode_update():
    response = await RuleBasedProvider().generate(AICommandRequest(prompt="enable dark and light mode for this site"))
    assert any(op.op == "update_theme" and op.payload.get("mode") == "light" for op in response.ops)


@pytest.mark.asyncio
async def test_add_contact_section_produces_contact_form_component():
    response = await RuleBasedProvider().generate(AICommandRequest(prompt="add contact section in navbar"))
    assert response.ops[0].op == "add_component"
    assert response.ops[0].payload["type"] == "forms"
    assert response.ops[0].payload["variant"] == "contact"


@pytest.mark.asyncio
async def test_add_contact_link_after_docs_updates_navbar_links():
    response = await RuleBasedProvider().generate(
        AICommandRequest(
            prompt="add contact in navbar beside docs",
            tree_summary=[
                {
                    "id": "nav-1",
                    "type": "navbar",
                    "name": "Navbar",
                    "props": {"brand": "Vona", "links": ["Product", "Pricing", "Docs"]},
                }
            ],
        )
    )
    assert response.ops[0].op == "update_component"
    assert response.ops[0].payload["props"]["links"] == ["Product", "Pricing", "Docs", "Contact"]
    assert len(response.ops) == 1


def test_ollama_parser_accepts_fenced_json():
    data = OllamaProvider._parse_json('```json\n{"message":"Done","ops":[]}\n```')
    assert data == {"message": "Done", "ops": []}


def test_ollama_supported_operations_exclude_unpreviewable_ops():
    assert "move_component" not in OllamaProvider._supported_ops
    assert "update_theme" in OllamaProvider._supported_ops
