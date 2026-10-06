"""Deterministic project generator: (project JSON tree + options) -> files.

This is intentionally *not* an LLM call — the same project + options
always produce the same output, which is what makes "download ZIP" and
"push to GitHub" trustworthy. `app/ai/*` is the only place an LLM is
involved, and only to produce structured ops that get applied to the
tree *before* this engine ever runs.
"""

import copy
from dataclasses import dataclass

from app.codegen import widgets
from app.codegen.anchors import page_anchors
from app.codegen.registry import REGISTRY, component_name_for, render_node
from app.codegen.styles import base_stylesheet


@dataclass
class GenFile:
    path: str
    content: str


_DOCK: dict = {"markup": None, "names": set()}


def _page_slug(path: str) -> str:
    cleaned = path.strip("/")
    return cleaned  # "" for home, "about", "blog/post", etc.


def _pascal(name: str) -> str:
    return "".join(w.capitalize() for w in name.replace("-", " ").replace("_", " ").split()) or "Page"


def _assign_component_names(pages: list[dict]) -> dict[str, str]:
    """node id -> component name, deduped per type (Hero, Hero2, Hero3, ...)."""
    counts: dict[str, int] = {}
    names: dict[str, str] = {}
    for page in pages:
        for node in page.get("tree", []):
            base = component_name_for(node["type"])
            counts[base] = counts.get(base, 0) + 1
            names[node["id"]] = base if counts[base] == 1 else f"{base}{counts[base]}"
    return names


def _package_json(project_name: str, options, dependencies: dict[str, str], dev_dependencies: dict[str, str]) -> str:
    import json

    pkg = {
        "name": project_name.lower().replace(" ", "-") or "vibe-project",
        "version": "0.1.0",
        "private": True,
        "scripts": {
            "dev": "next dev" if options.framework == "nextjs" else "vite",
            "build": "next build" if options.framework == "nextjs" else "vite build",
            "start": "next start" if options.framework == "nextjs" else "vite preview",
        },
        "dependencies": dependencies,
        "devDependencies": dev_dependencies,
    }
    return json.dumps(pkg, indent=2) + "\n"


def _tailwind_config(is_ts: bool) -> str:
    ext = "ts" if is_ts else "js"
    content = """/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx,js,jsx}", "./components/**/*.{ts,tsx,js,jsx}", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
"""
    return content if ext == "js" else content.replace("module.exports = ", "export default ")


def generate_project_with_report(project: dict, options):
    """Frontend + optional backend, then the integration pass. Returns (files, report)."""
    from app.codegen.integrate import integrate

    pages = project.get("pages", [])
    backend = getattr(options, "backend", None)
    connected = bool(backend is not None and backend.enabled)
    if widgets.has_widgets(pages, connected) and options.framework != "html" and options.language != "typescript":
        options = options.model_copy(update={"language": "typescript"})  # widgets are TypeScript
    widgets.CTX.update({"framework": options.framework, "connected": connected})
    files = _generate_frontend(project, options)
    if connected:
        from app.codegen.backend import generate_backend

        files = files + generate_backend(project, backend)
    return integrate(files, project, options)


def generate_project(project: dict, options) -> list[GenFile]:
    files, _ = generate_project_with_report(project, options)
    return files


def _link_sections(pages: list[dict]) -> list[dict]:
    """Copies of the pages where navbar links carry `#anchor` hrefs and the sections they point at carry the ids."""
    pages = copy.deepcopy(pages)
    for page in pages:
        tree = page.get("tree", [])
        ids, hrefs = page_anchors(tree)
        for node in tree:
            if node["id"] in ids:
                node["_anchor"] = ids[node["id"]]
            if node.get("type") == "navbar" and hrefs:
                node["props"] = {**(node.get("props") or {}), "_hrefs": hrefs}
    return pages


def _generate_frontend(project: dict, options) -> list[GenFile]:
    files: list[GenFile] = []
    pages: list[dict] = _link_sections(project.get("pages", []))
    theme: dict = project.get("theme", {})
    seo: dict = (project.get("settings") or {}).get("seo", {})
    project_name = project.get("name", "My Website")
    is_ts = options.language == "typescript"
    ext = "tsx" if is_ts else "jsx"
    attr = "className" if options.framework in ("nextjs", "react") else "class"
    component_names = _assign_component_names(pages)

    stylesheet = base_stylesheet(theme)
    if options.styling == "tailwind":
        stylesheet = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n' + stylesheet

    if options.framework == "html":
        return _generate_html(files, pages, theme, seo, stylesheet, project_name, options)

    # ── Shared component files (Next.js + React) ─────────────────
    comp_dir = "components" if options.framework == "nextjs" else "src/components"
    markups: list[str] = []
    seen_component_files: set[str] = set()
    for page in pages:
        for node in page.get("tree", []):
            comp_name = component_names[node["id"]]
            if comp_name in seen_component_files:
                continue
            seen_component_files.add(comp_name)
            markup = render_node(node, theme, attr)
            markups.append(markup)
            body = "\n    ".join(markup.splitlines())
            imports = "\n".join(widgets.imports_for(markup))
            files.append(
                GenFile(
                    path=f"{comp_dir}/{comp_name}.{ext}",
                    content=(imports + "\n\n" if imports else "") + f"export default function {comp_name}() {{\n  return (\n    {body}\n  );\n}}\n",
                )
            )

    # ── Connected widgets, site-wide chat dock, theme bridge and env ──
    dock_node = widgets.floating_chat_node(pages) if options.framework != "html" else None
    names = widgets.used_widgets(markups) | ({"ChatbotWidget"} if dock_node else set())
    for rel, content in widgets.widget_files(names):
        files.append(GenFile(f"{comp_dir}/{rel}", content))
    _DOCK["markup"] = widgets.chat_dock(dock_node) if dock_node else None
    _DOCK["names"] = names
    if names:
        stylesheet += widgets.widget_css(theme, names)
        files.append(GenFile(".env.example", f"# Address of the backend API\n{widgets.env_name()}=http://localhost:8000\n"))
        if options.framework == "react":
            files.append(GenFile("src/vite-env.d.ts", '/// <reference types="vite/client" />\n'))

    if options.framework == "nextjs":
        _generate_nextjs(files, pages, component_names, ext, project_name, seo, options, stylesheet)
    else:
        _generate_react(files, pages, component_names, ext, project_name, options, stylesheet)

    files.append(GenFile(path="README.md", content=_readme(project_name, options)))
    files.append(GenFile(path=".gitignore", content="node_modules/\n.next/\ndist/\n.env\n"))
    files.append(GenFile(path="public/assets/.gitkeep", content=""))

    if options.styling == "tailwind":
        files.append(GenFile(path="tailwind.config." + ("ts" if is_ts else "js"), content=_tailwind_config(is_ts)))
        files.append(
            GenFile(
                path="postcss.config.js",
                content="module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };\n",
            )
        )

    return files


def _generate_nextjs(files, pages, component_names, ext, project_name, seo, options, stylesheet):
    is_ts = ext == "tsx"
    dependencies = {"next": "^14.2.0", "react": "^18.3.0", "react-dom": "^18.3.0"}
    dev_dependencies = {}
    if is_ts:
        dev_dependencies.update({"typescript": "^5.5.0", "@types/react": "^18.3.0", "@types/node": "^20.14.0"})
    if options.styling == "tailwind":
        dev_dependencies.update({"tailwindcss": "^3.4.0", "postcss": "^8.4.0", "autoprefixer": "^10.4.0"})

    files.append(GenFile("package.json", _package_json(project_name, options, dependencies, dev_dependencies)))
    if is_ts:
        files.append(
            GenFile(
                "tsconfig.json",
                '{\n  "compilerOptions": {\n    "target": "ES2017",\n    "lib": ["dom", "dom.iterable", "esnext"],\n'
                '    "jsx": "preserve",\n    "module": "esnext",\n    "moduleResolution": "bundler",\n'
                '    "strict": true,\n    "skipLibCheck": true,\n    "esModuleInterop": true,\n'
                '    "incremental": true,\n    "paths": { "@/*": ["./*"] }\n  },\n'
                '  "include": ["**/*.ts", "**/*.tsx"],\n  "exclude": ["node_modules"]\n}\n',
            )
        )
    files.append(GenFile("next.config.js", "/** @type {import('next').NextConfig} */\nmodule.exports = {};\n"))

    files.append(GenFile("app/globals.css", stylesheet))
    files.append(
        GenFile(
            f"app/layout.{ext}",
            _layout_component(project_name, seo, options),
        )
    )

    for page in pages:
        slug = _page_slug(page["path"])
        used = []
        for node in page.get("tree", []):
            name = component_names[node["id"]]
            if name not in used:
                used.append(name)
        imports = "\n".join(f'import {name} from "@/components/{name}";' for name in used)
        body = "\n      ".join(f"<{name} />" for name in used)
        content = (
            f'{imports}\n\n'
            f"export default function Page() {{\n  return (\n    <main>\n      {body}\n    </main>\n  );\n}}\n"
        )
        page_path = f"app/{slug}/page.{ext}" if slug else f"app/page.{ext}"
        files.append(GenFile(page_path, content))


def _generate_react(files, pages, component_names, ext, project_name, options, stylesheet):
    is_ts = ext == "tsx"
    dependencies = {"react": "^18.3.0", "react-dom": "^18.3.0", "react-router-dom": "^6.26.0"}
    dev_dependencies = {"vite": "^5.4.0", "@vitejs/plugin-react": "^4.3.0"}
    if is_ts:
        dev_dependencies.update({"typescript": "^5.5.0", "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0"})
    if options.styling == "tailwind":
        dev_dependencies.update({"tailwindcss": "^3.4.0", "postcss": "^8.4.0", "autoprefixer": "^10.4.0"})

    files.append(GenFile("package.json", _package_json(project_name, options, dependencies, dev_dependencies)))
    files.append(
        GenFile(
            "index.html",
            f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n'
            f"<title>{project_name}</title>\n</head>\n<body>\n<div id=\"root\"></div>\n"
            f'<script type="module" src="/src/main.{ext}"></script>\n</body>\n</html>\n',
        )
    )
    files.append(GenFile("src/index.css", stylesheet))
    files.append(
        GenFile(
            f"src/main.{ext}",
            f'import React from "react";\nimport ReactDOM from "react-dom/client";\n'
            f'import App from "./App";\nimport "./index.css";\n\n'
            f'ReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n'
            f"    <App />\n  </React.StrictMode>\n);\n",
        )
    )

    routes = []
    page_imports = []
    for page in pages:
        page_component = _pascal(page["name"]) + "Page"
        page_imports.append(f'import {page_component} from "./pages/{page_component}";')
        route_path = "/" if page.get("is_home") else "/" + _page_slug(page["path"])
        routes.append(f'<Route path="{route_path}" element={{<{page_component} />}} />')

        used = []
        for node in page.get("tree", []):
            name = component_names[node["id"]]
            if name not in used:
                used.append(name)
        imports = "\n".join(f'import {name} from "../components/{name}";' for name in used)
        body = "\n      ".join(f"<{name} />" for name in used)
        files.append(
            GenFile(
                f"src/pages/{page_component}.{ext}",
                f'{imports}\n\nexport default function {page_component}() {{\n  return (\n    <main>\n      {body}\n    </main>\n  );\n}}\n',
            )
        )

    files.append(
        GenFile(
            f"src/App.{ext}",
            'import { BrowserRouter, Routes, Route } from "react-router-dom";\n'
            + ('import { ChatbotWidget } from "./components/widgets/ChatbotWidget";\n' if _DOCK["markup"] else "")
            + "\n".join(page_imports)
            + "\n\nexport default function App() {\n  return (\n    <BrowserRouter>\n      <Routes>\n        "
            + "\n        ".join(routes)
            + "\n      </Routes>\n" + (f"      {_DOCK['markup']}\n" if _DOCK["markup"] else "") + "    </BrowserRouter>\n  );\n}\n",
        )
    )


def _generate_html(files, pages, theme, seo, stylesheet, project_name, options):
    files.append(GenFile("assets/styles.css", stylesheet))
    for page in pages:
        slug = _page_slug(page["path"])
        body_sections = "\n  ".join(render_node(node, theme, "class") for node in page.get("tree", []))
        title = seo.get("title") or project_name
        description = seo.get("description", "")
        seo_tags = f'<meta name="description" content="{description}" />\n' if options.seo and description else ""
        html = (
            f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n'
            f'<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
            f"<title>{title}</title>\n{seo_tags}"
            f'<link rel="stylesheet" href="assets/styles.css" />\n</head>\n<body>\n  {body_sections}\n</body>\n</html>\n'
        )
        filename = "index.html" if not slug else f"{slug}.html"
        files.append(GenFile(filename, html))
    files.append(GenFile("README.md", _readme(project_name, options)))
    return files


def _layout_component(project_name: str, seo: dict, options) -> str:
    title = seo.get("title") or project_name
    description = seo.get("description", "")
    lang = "en"
    metadata = ""
    if options.seo:
        metadata = (
            f'export const metadata = {{\n  title: "{title}",\n  description: "{description}",\n}};\n\n'
        )
    dark = ' data-theme="dark"' if options.dark_mode else ""
    dock_import = 'import { ChatbotWidget } from "@/components/widgets/ChatbotWidget";\n' if _DOCK["markup"] else ""
    dock = f"\n        {_DOCK['markup']}" if _DOCK["markup"] else ""
    return (
        f'import "./globals.css";\n{dock_import}\n{metadata}'
        f"export default function RootLayout({{ children }}: {{ children: React.ReactNode }}) {{\n"
        f'  return (\n    <html lang="{lang}"{dark}>\n      <body>{{children}}{dock}</body>\n    </html>\n  );\n}}\n'
    )


def _readme(project_name: str, options) -> str:
    return f"""# {project_name}

Generated by **VIBE** (Visual Interface Building Engine).

- Framework: {options.framework}
- Language: {options.language}
- Styling: {options.styling}

## Getting started

```bash
npm install
npm run dev
```

This project is yours to keep developing — there is no VIBE runtime
dependency. Re-generating from VIBE will overwrite files under
`components/` and `app/` (or `src/`), so keep custom edits in new files
where possible if you plan to re-export later.
"""
