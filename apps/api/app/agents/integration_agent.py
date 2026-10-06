"""Integration agent: makes sure the frontend, the backend and the contract agree, then writes the run instructions.

The check itself needs no model: it lists every /api path the frontend calls, every route the backend defines and every
endpoint in the contract, and compares them. Only when something doesn't line up is the model asked to fix the files on
either side. It also writes the project README and INTEGRATION_REPORT.md.
"""

import re

from app.agents.api_agent import contract_text
from app.agents.base import FILE_FORMAT, BuildContext, ask, parse_files, prompt, show_files, take_notes, team_context

NAME = "Integration agent"
FIX = prompt("integration_agent")  # prompts/integration_agent.md
NO_CHANGES = "NO CHANGES REQUIRED"  # what the prompt tells the model to answer when everything already lines up

CALL = re.compile(r"""(?:[`'"]|\$\{[\w.]+\})(/api/[^`'"\s?#]*)""")  # "/api/x", `/api/x/${id}` and `${BASE}/api/x`
ROUTE = re.compile(r"""@(?:router|app)\.(get|post|put|patch|delete)\(\s*["']([^"']*)["']""")
PREFIX = re.compile(r"""APIRouter\([^)]*prefix\s*=\s*["']([^"']+)["']""")



def norm(path: str) -> str:
    """/api/orders/${id}/ and /api/orders/{order_id} both become /api/orders/{}."""
    path = re.sub(r"\$\{[^}]*\}", "{}", path)
    path = re.sub(r"\{[^}]*\}", "{}", path)
    path = re.sub(r"/(\d+)(?=/|$)", "/{}", path)
    return path.rstrip("/") or "/"


def frontend_calls(files: dict[str, str]) -> set[str]:
    out: set[str] = set()
    for path, text in files.items():
        if path.startswith("frontend/") and path.endswith((".ts", ".tsx")):
            out |= {norm(m) for m in CALL.findall(text)}
    return out


def backend_routes(files: dict[str, str]) -> set[str]:
    out: set[str] = set()
    for path, text in files.items():
        if path.startswith("backend/") and path.endswith(".py") and "/tests/" not in path:
            m = PREFIX.search(text)
            prefix = m.group(1) if m else ""
            for _method, route in ROUTE.findall(text):
                out.add(norm(prefix + route))
    return out


def problems(ctx: BuildContext) -> list[str]:
    calls, routes = frontend_calls(ctx.files), backend_routes(ctx.files)
    contract = {norm(e["path"]) for e in (ctx.contract or {}).get("endpoints", [])}
    found: list[str] = []
    found += [f"The frontend calls {c} but the backend has no such route." for c in sorted(calls - routes) if c != "/api"]
    found += [f"The contract has {c} but the backend doesn't implement it." for c in sorted(contract - routes)]
    return found


def readme(ctx: BuildContext) -> str:
    name = ctx.project.get("name", "My Website")
    backend = ctx.needs_backend and any(p.startswith("backend/") for p in ctx.files)
    parts = [f"# {name}\n", "Built by VIBE's agents: API, UI, Backend, Integration and Testing.\n", "## Frontend (Next.js)\n",
             "```bash\ncd frontend\nnpm install\ncp .env.example .env.local\nnpm run dev\n```\n", "Open http://localhost:3000\n"]
    if backend:
        parts += ["## Backend (FastAPI)\n", "```bash\ncd backend\npython -m venv .venv\n# Windows: .venv\\Scripts\\activate   macOS/Linux: source .venv/bin/activate\n"
                  "pip install -r requirements.txt\nuvicorn app.main:app --reload --port 8000\n```\n",
                  "API docs: http://localhost:8000/docs\n\nRun the tests: `cd backend && pytest -q`\n", "## API\n", contract_text(ctx).replace("\n", "\n\n") + "\n"]
    return "\n".join(parts)


async def run(ctx: BuildContext) -> str:
    notes: list[str] = []
    found = problems(ctx) if ctx.needs_backend else []
    if found:
        # The whole source (not only the API client), so the audit the prompt asks for can trace UI -> API -> database.
        source = {p: c for p, c in ctx.files.items() if p.startswith(("frontend/app/", "frontend/components/", "frontend/lib/", "backend/app/"))}
        brief = "Mismatches:\n" + "\n".join(f"- {p}" for p in found) + f"\n\n{contract_text(ctx)}\n\nFiles:\n{show_files(source, 160000)}"
        for p in found:
            ctx.note(NAME, p, "finding")
        extra = team_context(ctx, NAME)
        reply = await ask(ctx, FIX + "\n\n" + FILE_FORMAT, brief + (f"\n\n{extra}" if extra else ""), max_tokens=24000, timeout=300)
        take_notes(ctx, reply, NAME, "fix")
        changed = [] if NO_CHANGES in reply and "<<<FILE" not in reply else ctx.write(parse_files(reply, ""))
        left = problems(ctx)
        notes.append(f"fixed {len(found) - len(left)} of {len(found)} mismatches in {len(changed)} files")
        found = left
    report = ["# Integration report\n", f"Frontend calls: {', '.join(sorted(frontend_calls(ctx.files))) or 'none'}\n",
              f"Backend routes: {', '.join(sorted(backend_routes(ctx.files))) or 'none'}\n",
              "## Open issues\n" + ("\n".join(f"- {p}" for p in found) if found else "None: every frontend call has a backend route and the contract is fully implemented.") + "\n"]
    ctx.write({"README.md": readme(ctx), "INTEGRATION_REPORT.md": "\n".join(report)})
    if not ctx.needs_backend:
        return "static site: nothing to connect; README written"
    summary = "; ".join(notes) or "frontend, backend and contract agree"
    return summary + (f"; {len(found)} issues left (see INTEGRATION_REPORT.md)" if found else "")
