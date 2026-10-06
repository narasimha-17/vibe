"""UI agent: writes the Next.js frontend.

First the shell (layout, global styles, navbar, footer and the typed API client), then every page in parallel, each
seeing the shell so imports and class names line up. Build config (package.json, tsconfig) is fixed rather than
written by the model, so installs never pull in packages that don't exist.

When the builder sends a design reference (every page rendered exactly as the user designed it, plus the CSS it uses),
that CSS becomes frontend/app/vibe-design.css here in code, and the model reproduces the reference markup with the same
class names, so the finished site looks like what the user approved rather than something the model invented.
"""

import asyncio
import json
import re

from app.agents.api_agent import contract_text
from app.agents.base import BuildContext, ask_files, prompt, prompt_parts, show_files, slug
from app.core.config import get_settings

settings = get_settings()

NAME = "UI agent"
PAGE_CONCURRENCY = 4


# The full design guide (principles, tokens, hero patterns, section recipes, e-commerce UX and worked examples).
# Kept as markdown so it is easy to read and edit: app/agents/prompts/ui_design_guide.md
GUIDE = prompt("ui_design_guide")

# prompts/ui_agent.md: the COMMON part (stack and design rules) goes with every task; SHELL and PAGE also get the guide.
_PARTS = prompt_parts("ui_agent")
SHELL = "\n\n".join([_PARTS["SHELL"], _PARTS["COMMON"], GUIDE])
PAGE = "\n\n".join([_PARTS["PAGE"], _PARTS["COMMON"], GUIDE])
FIX = "\n\n".join([_PARTS["FIX"], _PARTS["COMMON"]])




PACKAGE_JSON = {
    "name": "site",
    "private": True,
    "version": "0.1.0",
    "scripts": {"dev": "next dev", "build": "next build", "start": "next start"},
    "dependencies": {"next": "14.2.35", "react": "^18.3.1", "react-dom": "^18.3.1"},
    "devDependencies": {"typescript": "^5.5.3", "@types/node": "^20.14.0", "@types/react": "^18.3.3", "@types/react-dom": "^18.3.0"},
}
TSCONFIG = {
    "compilerOptions": {
        "target": "ES2017", "lib": ["dom", "dom.iterable", "esnext"], "allowJs": False, "skipLibCheck": True, "strict": True,
        "noEmit": True, "esModuleInterop": True, "module": "esnext", "moduleResolution": "bundler", "resolveJsonModule": True,
        "isolatedModules": True, "jsx": "preserve", "incremental": True, "plugins": [{"name": "next"}], "paths": {"@/*": ["./*"]},
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    "exclude": ["node_modules"],
}


ROOT_TAG = re.compile(r"<div\s+([^>]*)>", re.S)
ATTR = re.compile(r'([\w:-]+)="([^"]*)"')


def _reference(ctx: BuildContext) -> dict | None:
    ref = ctx.project.get("reference")
    return ref if isinstance(ref, dict) and ref.get("pages") else None


def _root_parts(ref: dict) -> tuple[str, dict[str, str], str]:
    """(body class, data-* attributes, CSS variables) from the builder's site wrapper tag."""
    m = ROOT_TAG.search(ref.get("root", ""))
    attrs = dict(ATTR.findall(m.group(1))) if m else {}
    classes = " ".join(c for c in attrs.pop("class", "").split() if c not in ("site-preview", "is-preview"))
    style = attrs.pop("style", "")
    return classes, {k: v for k, v in attrs.items() if k.startswith("data-")}, style


def body_tag(ref: dict) -> str:
    classes, data, _ = _root_parts(ref)
    parts = [f'className="{classes}"'] if classes else []
    parts += [f'{k}="{v}"' for k, v in data.items()]
    return "<body" + ("" if not parts else " " + " ".join(parts)) + ">"


def design_css(ref: dict) -> str:
    """The builder's CSS for this site, re-rooted from its preview wrapper onto <body>."""
    _, _, style = _root_parts(ref)
    css = ref.get("css", "")
    css = re.sub(r"\.site-preview(?![\w-])", "body", css)
    css = re.sub(r"\.is-preview(?![\w-])", "", css)
    head = "/* The design from the VIBE builder, exactly as the user approved it. */\n"
    return head + (f":root {{ {style} }}\n" if style.strip() else "") + css + "\n"


def _reference_brief(ref: dict | None, page: str | None) -> str:
    if not ref:
        return "No design reference: design it yourself following the design rules."
    html = next(iter(ref["pages"].values()), "") if page is None else ref["pages"].get(page, "")
    return (f"DESIGN REFERENCE ({'home page, for the navbar and footer' if page is None else 'this page'}), rendered by the VIBE builder."
            f" frontend/app/vibe-design.css already contains its CSS, so reuse these exact class names:\n{html}")


def scaffold(ctx: BuildContext) -> dict[str, str]:
    name = slug(ctx.project.get("name", "site")) or "site"
    return {
        "frontend/package.json": json.dumps({**PACKAGE_JSON, "name": name}, indent=2) + "\n",
        "frontend/tsconfig.json": json.dumps(TSCONFIG, indent=2) + "\n",
        "frontend/next.config.js": "/** @type {import('next').NextConfig} */\nmodule.exports = { reactStrictMode: true };\n",
        "frontend/next-env.d.ts": '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
        "frontend/.env.example": "NEXT_PUBLIC_API_URL=http://localhost:8000\n",
        "frontend/.gitignore": "node_modules/\n.next/\n.env\n",
        **({"frontend/app/vibe-design.css": design_css(_reference(ctx))} if _reference(ctx) else {}),
    }


def route_file(page: dict) -> str:
    if page.get("is_home"):
        return "frontend/app/page.tsx"
    route = slug(page.get("path") or page["name"]) or slug(page["name"])
    return f"frontend/app/{route}/page.tsx"


def _pages_overview(ctx: BuildContext) -> str:
    return "\n".join(f"- {p['name']}: {route_file(p).removeprefix('frontend/app').removesuffix('page.tsx') or '/'}" for p in ctx.project.get("pages", []))


def _page_spec(page: dict) -> str:
    return json.dumps({"name": page["name"], "path": page.get("path"), "sections": [
        {"type": n.get("type"), "variant": n.get("variant"), "content": n.get("props")} for n in page.get("tree", [])
        if not n.get("hidden") and n.get("type") not in ("navbar", "footer")
    ]}, ensure_ascii=False)[:14000]


async def run(ctx: BuildContext) -> str:
    written = ctx.write(scaffold(ctx))
    ref = _reference(ctx)
    model = settings.agents_ui_model or None
    body = f"\n\nUse exactly this <body> opening tag in layout.tsx: {body_tag(ref)}" if ref else ""
    shell_brief = f"{ctx.spec}\n\nRoutes:\n{_pages_overview(ctx)}\n\n{contract_text(ctx)}\n\n{_reference_brief(ref, None)}{body}"
    shell = await ask_files(ctx, SHELL, shell_brief, "frontend/", max_tokens=24000, model=model, agent=NAME)
    exported = sorted(set(re.findall(r"export (?:async )?(?:function|const|type|interface) (\w+)", "\n".join(shell.values()))))
    if exported:
        ctx.note(NAME, "Shell exports: " + ", ".join(exported[:40]))
    written += ctx.write(shell)

    gate = asyncio.Semaphore(PAGE_CONCURRENCY)

    async def one(page: dict) -> dict[str, str]:
        async with gate:
            brief = (f"Site: {ctx.project.get('name')}\nRoutes:\n{_pages_overview(ctx)}\n\n{contract_text(ctx)}\n\n"
                     f"Shared shell:\n{show_files(shell, 40000)}\n\n{_reference_brief(ref, page['name'])}\n\n"
                     f"Write the page file {route_file(page)} for this page:\n{_page_spec(page)}")
            return await ask_files(ctx, PAGE, brief, "frontend/", max_tokens=24000, model=model, agent=NAME)

    for files in await asyncio.gather(*(one(p) for p in ctx.project.get("pages", []))):
        written += ctx.write(files)
    return f"{len(set(written))} frontend files for {len(ctx.project.get('pages', []))} pages"




async def fix(ctx: BuildContext, problems: str) -> list[str]:
    source = {p: c for p, c in ctx.under("frontend/").items() if not p.endswith("vibe-design.css")}
    files = await ask_files(ctx, FIX, f"Errors:\n{problems}\n\n{contract_text(ctx)}\n\nFrontend files:\n{show_files(source, 70000)}", "frontend/", max_tokens=24000, model=settings.agents_ui_model or None, agent=NAME, note_kind="fix")
    return ctx.write(files)
