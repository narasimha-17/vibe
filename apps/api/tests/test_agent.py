"""The tool-using agent: its tools, error recovery, questions, honest replies, and memory."""

import pytest
from httpx import AsyncClient

from app.ai import agent
from app.core.config import get_settings
from app.schemas.schemas import AICommandRequest

@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """No real model in tests: anything the skills do not handle falls back to the built-in rules."""
    monkeypatch.setattr(get_settings(), "ai_provider", "rule_based")


REGISTRY = {
    "navbar": {"label": "Navbar", "variants": ["default", "dark"], "props": {"brand": "Brand", "links": ["Home"]}},
    "hero": {"label": "Hero", "variants": ["split", "centered"], "props": {"headline": "Hi", "subheadline": "", "primaryCta": "Go", "visualImage": ""}},
    "faq": {"label": "FAQ", "variants": ["twocol"], "props": {"heading": "FAQ", "items": []}},
    "footer": {"label": "Footer", "variants": ["default"], "props": {"brand": "", "left": ""}},
}
TREE = [
    {"id": "nav1", "type": "navbar", "variant": "default", "name": "Navbar", "props": {"brand": "Crumb", "links": ["Home"]}},
    {"id": "hero1", "type": "hero", "variant": "centered", "name": "Hero", "props": {"headline": "Cakes"}},
    {"id": "foot1", "type": "footer", "variant": "default", "name": "Footer", "props": {}},
]


class ScriptedDriver:
    """Stands in for the model: replays a fixed list of turns, and records what the agent showed it."""

    def __init__(self, turns):
        self.turns, self.i, self.seen = list(turns), 0, []

    async def turn(self, messages):
        self.seen.append(messages)
        t = self.turns[min(self.i, len(self.turns) - 1)]
        self.i += 1
        return agent.Turn(t.get("text", ""), [(f"c{k}", n, a) for k, (n, a) in enumerate(t.get("calls", []))])

    def user(self, text):
        return {"role": "user", "content": text}

    def assistant(self, turn):
        return {"role": "assistant", "content": turn.text}

    def results(self, turn, outputs):
        return [{"role": "user", "content": "\n".join(outputs)}]


def request(prompt, **kw):
    return AICommandRequest(prompt=prompt, tree_summary=TREE, tree_full=TREE, pages=["Home"], page_id="p1", registry=REGISTRY, all_pages=[{"id": "p1", "name": "Home", "tree": TREE}], **kw)


async def test_agent_reads_then_edits_and_replies_from_what_it_really_did():
    driver = ScriptedDriver([
        {"calls": [("read_page", {}), ("describe_component", {"type": "navbar"})]},
        {"calls": [("update_section", {"section_id": "nav1", "props": {"brand": "Crumb & Co"}})]},
        {"calls": [("finish", {"summary": "Renamed the brand."})]},
    ])
    res = await agent.run(request("rename the brand to Crumb & Co"), driver)
    assert [o.op for o in res.ops] == ["update_component"] and res.ops[0].payload["props"] == {"brand": "Crumb & Co"} and res.ops[0].payload["page_id"] == "p1"
    assert "Renamed the brand." in res.message and "Change Navbar on Home: brand" in res.message


async def test_agent_recovers_from_a_tool_error():
    driver = ScriptedDriver([
        {"calls": [("update_section", {"section_id": "hero1", "props": {"colour": "red"}})]},  # not a real prop
        {"calls": [("update_section", {"section_id": "hero1", "props": {"headline": "Fresh cakes"}})]},
        {"calls": [("finish", {"summary": "Changed the headline."})]},
    ])
    res = await agent.run(request("change the headline"), driver)
    assert len(res.ops) == 1 and res.ops[0].payload["props"] == {"headline": "Fresh cakes"}
    assert "has no props" in str(driver.seen[1]), "the model was shown the error so it could correct itself"


async def test_new_sections_go_above_the_footer_and_bad_variants_are_refused():
    driver = ScriptedDriver([
        {"calls": [("add_section", {"type": "faq", "variant": "nope"})]},
        {"calls": [("add_section", {"type": "faq", "variant": "twocol", "props": {"heading": "Questions"}})]},
        {"calls": [("finish", {"summary": "Added an FAQ."})]},
    ])
    res = await agent.run(request("add an faq"), driver)
    add = res.ops[0]
    assert add.op == "add_component" and add.payload["index"] == 2, "inserted before the footer, where it is visible"
    assert add.payload["node"]["props"]["heading"] == "Questions"


async def test_agent_asks_when_ambiguous_and_never_claims_unmade_changes():
    asked = await agent.run(request("make it better"), ScriptedDriver([{"calls": [("ask_user", {"question": "Better how?", "options": ["Bolder", "Simpler"]})]}]))
    assert asked.message == "Better how?" and asked.choices == ["Bolder", "Simpler"] and asked.ops == []
    claim = await agent.run(request("do something"), ScriptedDriver([{"calls": [("finish", {"summary": "I added five sections."})]}]))
    assert claim.ops == [] and claim.message.startswith("I didn't change anything"), "no edits means the reply says so"


async def test_agent_uses_memory_and_can_save_notes():
    driver = ScriptedDriver([{"calls": [("remember", {"note": "Wants a warm, premium tone"})]}, {"calls": [("finish", {"summary": "Noted."})]}])
    sink: dict = {}
    await agent.run(request("we like a warm premium tone", memory=["About this site: The brand is called Crumb & Co."]), driver, sink)
    assert "The brand is called Crumb & Co." in str(driver.seen[0]), "what it remembers is put in front of the model"
    assert sink["notes"] == ["Wants a warm, premium tone"]


async def test_conversation_and_notes_survive_a_reload(auth_client: AsyncClient):
    pid = (await auth_client.post("/projects", json={"name": "Crumb", "template_key": None})).json()["id"]
    body = {"project_id": pid, "tree_summary": TREE, "tree_full": TREE, "pages": ["Home"]}
    r = (await auth_client.post("/ai/command", json={**body, "prompt": "add cart button to navbar"})).json()
    assert r["ops"]
    await auth_client.post("/ai/command", json={**body, "prompt": "my brand is Crumb & Co and I prefer a warm premium look"})
    mem = (await auth_client.get(f"/ai/memory/{pid}")).json()
    assert [h["role"] for h in mem["history"]] == ["user", "ai", "user", "ai"]
    texts = " ".join(n["text"] for n in mem["notes"])
    assert "Crumb & Co" in texts and "warm premium" in texts

    assert (await auth_client.delete(f"/ai/memory/{pid}/notes/0")).status_code == 204
    assert len((await auth_client.get(f"/ai/memory/{pid}")).json()["notes"]) == len(mem["notes"]) - 1
    assert (await auth_client.delete(f"/ai/memory/{pid}")).status_code == 204
    cleared = (await auth_client.get(f"/ai/memory/{pid}")).json()
    assert cleared["history"] == [] and cleared["notes"], "clearing the chat keeps the lasting notes"
    assert (await auth_client.delete(f"/ai/memory/{pid}?notes=true")).status_code == 204
    assert (await auth_client.get(f"/ai/memory/{pid}")).json()["notes"] == []
