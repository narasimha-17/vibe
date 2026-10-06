"""Backend agent: writes the FastAPI + SQLite backend that implements the API agent's contract."""

from app.agents.api_agent import contract_text
from app.agents.base import BACKEND_REQUIREMENTS, AgentError, BuildContext, ask_files, prompt_parts, show_files

NAME = "Backend agent"

# prompts/backend_agent.md: the COMMON part (stack, layout and implementation rules) goes with both tasks.
_PARTS = prompt_parts("backend_agent", requirements=BACKEND_REQUIREMENTS)
SYSTEM = "\n\n".join([_PARTS["BUILD"], _PARTS["COMMON"]])
FIX = "\n\n".join([_PARTS["FIX"], _PARTS["COMMON"]])





def scaffold() -> dict[str, str]:
    return {
        "backend/requirements.txt": BACKEND_REQUIREMENTS,
        "backend/.env.example": "DATABASE_URL=sqlite:///./app.db\nCORS_ORIGINS=http://localhost:3000\nJWT_SECRET=change-me\n",
        "backend/.gitignore": "__pycache__/\n*.db\n.env\n.venv/\n",
    }


async def run(ctx: BuildContext) -> str:
    if not ctx.needs_backend or not ctx.contract:
        return "skipped: static site, no backend needed"
    written = ctx.write(scaffold())
    written += ctx.write(await ask_files(ctx, SYSTEM, f"{contract_text(ctx)}\n\nSite (for seed data):\n{ctx.spec[:12000]}", "backend/", max_tokens=24000, timeout=300, agent=NAME))
    if "backend/app/main.py" not in ctx.files:
        raise AgentError("The backend came back without backend/app/main.py.")
    return f"{len(set(written))} backend files"




async def fix(ctx: BuildContext, problems: str) -> list[str]:
    files = await ask_files(ctx, FIX, f"Failures:\n{problems}\n\n{contract_text(ctx)}\n\nBackend files:\n{show_files(ctx.under('backend/'), 80000)}", "backend/", max_tokens=24000, timeout=300, agent=NAME, note_kind="fix")
    return ctx.write(files)
