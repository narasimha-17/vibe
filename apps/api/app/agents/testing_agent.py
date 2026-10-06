"""Testing agent: writes the backend's API tests, then actually runs the checks.

- Backend: every Python file must compile, and the pytest suite (written here from the contract) must pass against a
  throwaway SQLite database. Runs with this server's Python, which has the exact packages the backend is allowed.
- Frontend: strict TypeScript check of app/, components/ and lib/ using the TypeScript, React and Next.js types already
  installed for VIBE's own web app, so no npm install is needed per build.
The orchestrator sends failures back to the Backend or UI agent to fix, then calls check() again.
"""

import os
import pathlib
import py_compile
import re
import shutil
import subprocess
import sys
import tempfile

from app.agents.api_agent import contract_text
from app.agents.base import BuildContext, ask_files, prompt, show_files

NAME = "Testing agent"
SYSTEM = prompt("testing_agent")  # prompts/testing_agent.md



def _env(extra: dict | None = None) -> dict:
    keep = ("PATH", "SYSTEMROOT", "TEMP", "TMP", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA")
    env = {k: v for k, v in os.environ.items() if k.upper() in keep}
    env["PYTHONIOENCODING"] = "utf-8"
    env.update(extra or {})
    return env


def _dump(files: dict[str, str], root: pathlib.Path, prefix: str) -> pathlib.Path:
    for path, content in files.items():
        if path.startswith(prefix):
            target = root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
    return root / prefix.rstrip("/")


def first_error(output: str) -> str:
    """The most telling line of a failure ("E   assert 200 == 422", "error TS2322: ...", "FAILED tests/...")."""
    lines = [l.strip() for l in output.splitlines() if l.strip()]
    for pattern in (r"^E\s+\S", r"error TS\d+", r"^FAILED ", r"Error:", r"Error\b"):
        hit = next((l for l in lines if re.search(pattern, l)), None)
        if hit:
            return hit[:240]
    return (lines[-1] if lines else "unknown error")[:240]


def _tail(text: str, lines: int = 40) -> str:
    return "\n".join(text.strip().splitlines()[-lines:])


def check_backend(ctx: BuildContext, tmp: pathlib.Path) -> tuple[bool, str]:
    backend = _dump(ctx.under("backend/"), tmp, "backend/")
    broken = []
    for py in backend.rglob("*.py"):
        try:
            py_compile.compile(str(py), doraise=True)
        except py_compile.PyCompileError as exc:
            broken.append(str(exc).strip()[:300])
    if broken:
        return False, "Python syntax errors:\n" + "\n".join(broken[:5])
    try:
        res = subprocess.run([sys.executable, "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider", "--disable-warnings", "tests"],
                             cwd=backend, env=_env({"PYTHONPATH": str(backend)}), capture_output=True, text=True, timeout=240)
    except subprocess.TimeoutExpired:
        return False, "The backend tests timed out after 240 seconds."
    out = (res.stdout or "") + (res.stderr or "")
    return res.returncode == 0, _tail(out)


def _web_root() -> pathlib.Path | None:
    for parent in pathlib.Path(__file__).resolve().parents:
        if (parent / "web" / "node_modules" / "typescript" / "bin" / "tsc").exists():
            return parent / "web"
    return None


def check_frontend(ctx: BuildContext, tmp: pathlib.Path) -> tuple[bool | None, str]:
    """(passed, output); passed is None when there is no TypeScript toolchain on this machine."""
    web, node = _web_root(), shutil.which("node")
    if not web or not node:
        return None, "TypeScript toolchain not found on this machine; frontend not type-checked."
    root = _dump(ctx.under("frontend/"), tmp, "frontend/")
    mods = (web / "node_modules").as_posix()
    (root / "vibe-check.d.ts").write_text('declare module "*.css";\n', encoding="utf-8")
    (root / "tsconfig.check.json").write_text(
        '{"compilerOptions":{"target":"ES2017","lib":["dom","dom.iterable","esnext"],"jsx":"preserve","module":"esnext",'
        '"moduleResolution":"node","strict":true,"skipLibCheck":true,"esModuleInterop":true,"noEmit":true,"baseUrl":".",'
        f'"typeRoots":["{mods}/@types"],"types":["node","react","react-dom"],'
        f'"paths":{{"@/*":["./*"],"react":["{mods}/@types/react"],"react/*":["{mods}/@types/react/*"],"react-dom":["{mods}/@types/react-dom"],'
        f'"react-dom/*":["{mods}/@types/react-dom/*"],"next":["{mods}/next"],"next/*":["{mods}/next/*"]}}}},'
        '"include":["app/**/*.tsx","app/**/*.ts","components/**/*.tsx","components/**/*.ts","lib/**/*.ts","lib/**/*.tsx","vibe-check.d.ts"]}',
        encoding="utf-8",
    )
    try:
        res = subprocess.run([node, str(web / "node_modules" / "typescript" / "bin" / "tsc"), "-p", "tsconfig.check.json"],
                             cwd=root, env=_env(), capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        return False, "The TypeScript check timed out after 180 seconds."
    return res.returncode == 0, _tail((res.stdout or "") + (res.stderr or ""), 30)


async def write_tests(ctx: BuildContext) -> list[str]:
    if not ctx.needs_backend or "backend/app/main.py" not in ctx.files:
        return []
    brief = f"{contract_text(ctx)}\n\nBackend:\n{show_files(ctx.under('backend/app/'), 80000)}"
    return ctx.write(await ask_files(ctx, SYSTEM, brief, "backend/", max_tokens=24000, timeout=300, agent=NAME))


def check(ctx: BuildContext) -> dict:
    """Runs every check. {"backend": (ok, output) | None, "frontend": (ok | None, output)}."""
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="vibe-agents-"))
    try:
        backend = check_backend(ctx, tmp) if ctx.needs_backend and "backend/app/main.py" in ctx.files else None
        frontend = check_frontend(ctx, tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return {"backend": backend, "frontend": frontend}


def passed(result: dict) -> bool:
    return (result["backend"] is None or result["backend"][0]) and result["frontend"][0] is not False


def summary(result: dict) -> str:
    parts = []
    if result["backend"] is not None:
        ok, out = result["backend"]
        count = re.search(r"(\d+) passed", out)
        parts.append(f"backend tests {'passed' if ok else 'failed'}" + (f" ({count.group(1)} passed)" if count else ""))
    ok, _ = result["frontend"]
    parts.append("frontend type-check " + ("skipped" if ok is None else "passed" if ok else "failed"))
    return ", ".join(parts)


def report(result: dict, rounds: int) -> str:
    lines = ["# Test report\n", f"Result: {summary(result)} after {rounds} fix round(s).\n"]
    if result["backend"] is not None:
        lines += ["## Backend (pytest)\n", "```\n" + result["backend"][1] + "\n```\n"]
    lines += ["## Frontend (TypeScript)\n", "```\n" + (result["frontend"][1] or "No errors.") + "\n```\n"]
    return "\n".join(lines)
