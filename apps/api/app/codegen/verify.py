"""Generate -> integrate -> test pipeline for an export.

Phases:
1. Generate   builds frontend (+ backend) files.
2. Integrate  the integration agent's contract / environment checks.
3. Test       runs the generated backend's own end-to-end tests for real, syntax-checks other backends and
              type-checks the generated frontend with TypeScript (when the toolchain is available here).

A real-browser run (clicking through the site) needs a browser runner and is reported as skipped.
"""

import os
import pathlib
import py_compile
import re
import shutil
import subprocess
import sys
import tempfile
import time

from app.codegen.engine import generate_project_with_report


def _step(name: str, status: str, detail: str = "") -> dict:
    return {"name": name, "status": status, "detail": detail}


def _write(files, root: pathlib.Path, only_prefix: str | None = None, skip_prefix: str | None = None) -> None:
    for f in files:
        if only_prefix and not f.path.startswith(only_prefix):
            continue
        if skip_prefix and f.path.startswith(skip_prefix):
            continue
        target = root / f.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f.content, encoding="utf-8")


def _clean_env() -> dict:
    keep = ("PATH", "SYSTEMROOT", "TEMP", "TMP", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA")
    env = {k: v for k, v in os.environ.items() if k.upper() in keep}
    env["PYTHONIOENCODING"] = "utf-8"
    return env


def _web_root() -> pathlib.Path | None:
    here = pathlib.Path(__file__).resolve()
    for parent in here.parents:
        cand = parent / "web" / "node_modules" / "typescript" / "bin" / "tsc"
        if cand.exists():
            return parent / "web"
    return None


def _run_backend_tests(files, tmp: pathlib.Path) -> list[dict]:
    steps: list[dict] = []
    backend = tmp / "backend"
    _write(files, tmp, only_prefix="backend/")
    py_errors = []
    for py in backend.rglob("*.py"):
        try:
            py_compile.compile(str(py), doraise=True)
        except py_compile.PyCompileError as exc:
            py_errors.append(str(exc)[:200])
    steps.append(_step("Backend code compiles", "pass" if not py_errors else "fail", f"{len(list(backend.rglob('*.py')))} Python files" if not py_errors else "; ".join(py_errors[:2])))
    if not (backend / "tests" / "test_e2e.py").exists():
        steps.append(_step("Backend end-to-end tests", "skip", "This backend framework has no generated tests. Choose FastAPI to get them."))
        return steps
    try:
        res = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "--disable-warnings"],
            cwd=backend, env=_clean_env(), capture_output=True, text=True, timeout=240,
        )
    except subprocess.TimeoutExpired:
        steps.append(_step("Backend end-to-end tests", "fail", "Timed out after 240 seconds"))
        return steps
    out = (res.stdout or "") + (res.stderr or "")
    passed = re.search(r"(\d+) passed", out)
    failed = re.search(r"(\d+) failed", out)
    errors = re.search(r"(\d+) error", out)
    n_pass = int(passed.group(1)) if passed else 0
    n_fail = int(failed.group(1)) if failed else 0
    if res.returncode == 0:
        steps.append(_step("Backend end-to-end tests", "pass", f"{n_pass} passed: browsing, filters, reviews, checkout, payment, tracking, forms, chat, accounts as applicable"))
    else:
        tail = "\n".join(out.strip().splitlines()[-14:])
        steps.append(_step("Backend end-to-end tests", "fail", f"{n_pass} passed, {n_fail} failed{', ' + errors.group(1) + ' errors' if errors else ''}\n{tail}"))
    return steps


def _typecheck_frontend(files, tmp: pathlib.Path, framework: str) -> dict:
    if framework == "html":
        return _step("Frontend type-check", "skip", "Plain HTML export has no TypeScript to check.")
    web = _web_root()
    node = shutil.which("node")
    if not web or not node:
        return _step("Frontend type-check", "skip", "TypeScript toolchain not found on this machine.")
    root = tmp / "frontend"
    _write(files, root, skip_prefix="backend/")
    rel = "components" if framework == "nextjs" else "src"
    types = (web / "node_modules" / "@types").as_posix()
    (root / "vibe-shim.d.ts").write_text("interface ImportMeta { env: Record<string, string | undefined> }\n", encoding="utf-8")
    (root / "tsconfig.check.json").write_text(
        '{"compilerOptions":{"target":"ES2017","lib":["dom","dom.iterable","esnext"],"jsx":"preserve","module":"esnext","moduleResolution":"node",'
        '"strict":true,"skipLibCheck":true,"esModuleInterop":true,"noEmit":true,"baseUrl":".",'
        f'"typeRoots":["{types}"],"types":["node","react"],'
        f'"paths":{{"react":["{types}/react"],"react/jsx-runtime":["{types}/react/jsx-runtime"],"@/*":["./*"]}}}},'
        f'"include":["{rel}/**/*.tsx","vibe-shim.d.ts"]}}',
        encoding="utf-8",
    )
    try:
        res = subprocess.run([node, str(web / "node_modules" / "typescript" / "bin" / "tsc"), "-p", "tsconfig.check.json"], cwd=root, env=_clean_env(), capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        return _step("Frontend type-check", "fail", "Timed out after 180 seconds")
    if res.returncode == 0:
        count = len(list((root / rel).rglob("*.tsx")))
        return _step("Frontend type-check", "pass", f"{count} components pass strict TypeScript")
    return _step("Frontend type-check", "fail", "\n".join((res.stdout or res.stderr).strip().splitlines()[:10]))


def verify_project(project: dict, options) -> dict:
    started = time.time()
    phases: list[dict] = []
    files, report = generate_project_with_report(project, options)
    backend_files = [f for f in files if f.path.startswith("backend/")]
    frontend_files = [f for f in files if not f.path.startswith("backend/")]

    phases.append({
        "id": "generate", "name": "Generate code", "status": "pass",
        "steps": [_step("Frontend files", "pass", f"{len(frontend_files)} files ({options.framework})"), _step("Backend files", "pass" if backend_files else "skip", f"{len(backend_files)} files" if backend_files else "Backend is switched off")],
    })
    phases.append({
        "id": "integrate", "name": "Integration agent", "status": "pass" if report.ok else "fail",
        "steps": [_step(c.name, {"pass": "pass", "fail": "fail", "warn": "warn", "info": "info"}[c.status], c.detail) for c in report.checks] + [_step("Fix applied", "info", a) for a in report.actions],
    })

    tmp = pathlib.Path(tempfile.mkdtemp(prefix="vibe-verify-"))
    try:
        steps: list[dict] = []
        if backend_files:
            steps += _run_backend_tests(files, tmp)
        steps.append(_typecheck_frontend(files, tmp, options.framework))
        steps.append(_step("Real-browser walkthrough", "skip", "Needs a browser runner. Run the generated frontend and backend together and try the flow once by hand."))
        phases.append({"id": "test", "name": "Test end to end", "status": "fail" if any(s["status"] == "fail" for s in steps) else "pass", "steps": steps})
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    ok = all(p["status"] != "fail" for p in phases)
    counts = {k: sum(1 for p in phases for s in p["steps"] if s["status"] == k) for k in ("pass", "fail", "warn", "skip")}
    return {"ok": ok, "phases": phases, "counts": counts, "seconds": round(time.time() - started, 1)}
