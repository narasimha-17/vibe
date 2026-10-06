from app.codegen.engine import generate_project
from app.projects.templates import get_template_pages
from app.schemas.schemas import CodegenOptions, DesignTokens


def _project(template_key="saas"):
    return {
        "name": "Test Co",
        "theme": DesignTokens().model_dump(),
        "settings": {"seo": {"title": "Test Co", "description": "A test site"}},
        "pages": get_template_pages(template_key),
    }


def test_nextjs_generation_is_deterministic():
    project = _project()
    options = CodegenOptions(framework="nextjs", language="typescript", styling="tailwind")
    files_a = generate_project(project, options)
    files_b = generate_project(project, options)
    assert [(f.path, f.content) for f in files_a] == [(f.path, f.content) for f in files_b]


def test_nextjs_generation_includes_expected_files():
    project = _project()
    options = CodegenOptions(framework="nextjs", language="typescript", styling="tailwind")
    files = generate_project(project, options)
    paths = {f.path for f in files}
    assert "package.json" in paths
    assert "app/page.tsx" in paths
    assert "app/globals.css" in paths
    assert any(p.startswith("components/Navbar") for p in paths)
    assert any(p.startswith("components/Pricing") for p in paths)


def test_html_generation_produces_index():
    project = _project(template_key=None)
    options = CodegenOptions(framework="html", language="javascript", styling="css")
    files = generate_project(project, options)
    index = next(f for f in files if f.path == "index.html")
    assert "<nav" in index.content
    assert "<html" in index.content


def test_react_generation_has_router():
    project = _project()
    options = CodegenOptions(framework="react", language="typescript", styling="tailwind")
    files = generate_project(project, options)
    app_file = next(f for f in files if f.path == "src/App.tsx")
    assert "BrowserRouter" in app_file.content
