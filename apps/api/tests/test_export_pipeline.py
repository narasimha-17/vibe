"""Guards the connected export: widget copies stay identical, and a shop site passes generate -> integrate -> test."""

import pathlib

import pytest

from app.codegen.verify import verify_project
from app.schemas.schemas import BackendOptions, CodegenOptions

API = pathlib.Path(__file__).resolve().parents[1]
TEMPLATES = API / "app" / "codegen" / "templates"
WEB = API.parent / "web" / "components"


def _node(t, v, props):
    return {"id": t + v, "type": t, "variant": v, "props": props, "name": t}


SHOP_SITE = {
    "name": "Pipeline Store",
    "theme": {},
    "settings": {},
    "pages": [
        {
            "id": "p", "name": "Home", "path": "/", "is_home": True, "order": 0,
            "tree": [
                _node("navbar", "default", {"brand": "Store", "links": ["Home"], "loginLabel": "Login"}),
                _node("shop", "sidebar", {"products": [{"name": "Tote", "price": "1999", "category": "Bags", "stock": 20}, {"name": "Mug", "price": "899", "category": "Home", "stock": 15}]}),
                _node("tracking", "default", {}),
                _node("forms", "contact", {}),
                _node("chatbot", "widget", {"knowledge": [{"q": "shipping", "a": "3-5 days"}]}),
            ],
        }
    ],
}


@pytest.mark.skipif(not WEB.exists(), reason="web app not present")
@pytest.mark.parametrize("name,sub", [("ShopWidget.tsx", "shop"), ("TrackingWidget.tsx", "shop"), ("FormWidget.tsx", "shop"), ("ChatbotWidget.tsx", "chatbot")])
def test_widget_copies_match_the_exporter_templates(name, sub):
    assert (TEMPLATES / name).read_text(encoding="utf-8") == (WEB / sub / name).read_text(encoding="utf-8"), (
        f"{name} differs between the exporter template and the builder copy. Re-run the widget build script."
    )


def test_shop_site_passes_generate_integrate_and_test():
    result = verify_project(SHOP_SITE, CodegenOptions(backend=BackendOptions(enabled=True)))
    failing = [(p["name"], s["name"], s["detail"][:200]) for p in result["phases"] for s in p["steps"] if s["status"] == "fail"]
    assert result["ok"], failing
    assert result["counts"]["pass"] >= 10
