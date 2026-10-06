"""Runs the build agents in order and keeps a live record of each step.

    API agent ──► UI agent ─┐
              └► Backend agent ─┴─► Integration agent ──► Testing agent ──(failures)──► fix by UI / Backend agent ──► re-test

UI and Backend work at the same time (both build against the API contract). Test failures go back to the agent that owns
the failing code, up to MAX_FIX_ROUNDS times. Each build lives in storage/agent-builds/<job id>/ (job.json + the files), so
progress survives a page reload and the zip can be downloaded later.
"""

import asyncio
import io
import json
import pathlib
import time
import uuid
import zipfile

from app.agents import api_agent, backend_agent, integration_agent, memory, testing_agent, ui_agent
from app.agents.base import AgentError, BuildContext, needs_backend, site_spec
from app.core.config import get_settings

settings = get_settings()

MAX_FIX_ROUNDS = 2
STEPS = [("api", api_agent.NAME), ("ui", ui_agent.NAME), ("backend", backend_agent.NAME), ("integration", integration_agent.NAME), ("testing", testing_agent.NAME)]
_tasks: dict[str, asyncio.Task] = {}  # keeps running builds from being garbage-collected


def _root() -> pathlib.Path:
    return pathlib.Path(settings.storage_dir) / "agent-builds"


def _dir(job_id: str) -> pathlib.Path:
    return _root() / job_id


class Job:
    def __init__(self, data: dict):
        self.data = data

    @property
    def id(self) -> str:
        return self.data["id"]

    def step(self, key: str) -> dict:
        return next(s for s in self.data["steps"] if s["key"] == key)

    def update(self, key: str, **fields) -> None:
        step = self.step(key)
        if fields.get("status") == "running":
            step["started"] = time.time()
        if fields.get("status") in ("done", "failed", "skipped") and step.get("started"):
            step["seconds"] = round(time.time() - step["started"], 1)
        step.update(fields)
        self.save()

    def save(self) -> None:
        folder = _dir(self.id)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "job.json").write_text(json.dumps(self.data, indent=1), encoding="utf-8")

    def save_files(self, files: dict[str, str]) -> None:
        folder = _dir(self.id) / "files"
        for path, content in files.items():
            target = folder / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        self.data["files"] = sorted(files)
        self.save()


def load(job_id: str) -> Job | None:
    path = _dir(job_id) / "job.json"
    if not path.is_file() or "/" in job_id or "\\" in job_id or ".." in job_id:
        return None
    return Job(json.loads(path.read_text(encoding="utf-8")))


def latest_for(project_id: str, owner_id: str) -> Job | None:
    root = _root()
    if not root.is_dir():
        return None
    jobs = []
    for f in root.glob("*/job.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if data.get("project_id") == project_id and data.get("owner_id") == owner_id:
            jobs.append(data)
    return Job(max(jobs, key=lambda d: d["created"])) if jobs else None


def read_file(job: Job, path: str) -> str | None:
    if path not in job.data.get("files", []):
        return None
    return (_dir(job.id) / "files" / path).read_text(encoding="utf-8")


def zip_bytes(job: Job) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for path in job.data.get("files", []):
            z.write(_dir(job.id) / "files" / path, path)
    return buf.getvalue()


def view(job: Job) -> dict:
    return {k: v for k, v in job.data.items() if k != "owner_id"}


def estimate_seconds(pages: int, backend: bool) -> list[int]:
    """A rough [low, high] build time, from typical model speeds: shown to the user as "usually takes about ..."."""
    batches = max(1, -(-pages // ui_agent.PAGE_CONCURRENCY))  # pages are written 4 at a time
    low = 60 + batches * 60 + (30 if not backend else 0)       # UI shell + pages (+ a type-check for static sites)
    high = 120 + batches * 120 + (60 if not backend else 0)
    if backend:
        low += 60 + 0 + 60     # API contract, integration (usually nothing to fix), tests written and run
        high += 150 + 90 + 240  # ... with a slow contract, an integration fix and up to two fix rounds
    return [low, high]


def start(project: dict, project_id: str, owner_id: str) -> Job:
    """Creates the job and starts the build in the background; returns at once."""
    job = Job({
        "id": uuid.uuid4().hex, "project_id": project_id, "owner_id": owner_id, "project_name": project.get("name", ""),
        "status": "running", "created": time.time(), "finished": None, "error": None, "llm_calls": 0, "fix_rounds": 0,
        "needs_backend": needs_backend(project), "files": [],
        "pages": len(project.get("pages", [])), "estimate": estimate_seconds(len(project.get("pages", [])), needs_backend(project)),
        "steps": [{"key": k, "name": n, "status": "pending", "detail": "", "files": []} for k, n in STEPS],
    })
    job.save()
    _tasks[job.id] = asyncio.create_task(_run(job, project))
    _tasks[job.id].add_done_callback(lambda _t, jid=job.id: _tasks.pop(jid, None))
    return job


async def _agent(job: Job, ctx: BuildContext, key: str, work) -> None:
    job.update(key, status="running", detail="Working…")
    before = dict(ctx.files)
    detail = await work(ctx)
    changed = sorted(p for p in ctx.files if before.get(p) != ctx.files[p])
    job.update(key, status="skipped" if str(detail).startswith("skipped") else "done", detail=detail, files=changed)
    job.data["llm_calls"] = ctx.llm_calls
    job.save_files(ctx.files)


async def _test_and_fix(job: Job, ctx: BuildContext) -> str:
    job.update("testing", status="running", detail="Writing tests…")
    await testing_agent.write_tests(ctx)
    job.save_files(ctx.files)
    for round_ in range(MAX_FIX_ROUNDS + 1):
        job.update("testing", detail="Running tests…" if round_ == 0 else f"Re-testing after fix round {round_}…")
        result = await asyncio.to_thread(testing_agent.check, ctx)
        if testing_agent.passed(result) or round_ == MAX_FIX_ROUNDS:
            break
        job.data["fix_rounds"] = round_ + 1
        if result["backend"] is not None and not result["backend"][0]:
            ctx.note(testing_agent.NAME, "Backend check failed: " + testing_agent.first_error(result["backend"][1]), "finding")
            job.update("testing", detail=f"Backend tests failed: the Backend agent is fixing them (round {round_ + 1})…")
            await backend_agent.fix(ctx, result["backend"][1])
        if result["frontend"][0] is False:
            ctx.note(testing_agent.NAME, "Frontend check failed: " + testing_agent.first_error(result["frontend"][1]), "finding")
            job.update("testing", detail=f"Type errors in the frontend: the UI agent is fixing them (round {round_ + 1})…")
            await ui_agent.fix(ctx, result["frontend"][1])
        job.data["llm_calls"] = ctx.llm_calls
        job.save_files(ctx.files)
    ctx.write({"TEST_REPORT.md": testing_agent.report(result, job.data["fix_rounds"])})
    job.save_files(ctx.files)
    ok = testing_agent.passed(result)
    job.update("testing", status="done" if ok else "failed", detail=testing_agent.summary(result) + ("" if ok else " (see TEST_REPORT.md)"),
               files=["TEST_REPORT.md"] + [p for p in ctx.files if "/tests/" in p])
    return "passed" if ok else "failed"


async def _run(job: Job, project: dict) -> None:
    ctx = BuildContext(project=project, spec=site_spec(project), needs_backend=job.data["needs_backend"],
                       memory=memory.load(job.data["owner_id"]))
    current = "api"
    try:
        await _agent(job, ctx, "api", api_agent.run)
        current = "ui"
        results = await asyncio.gather(_agent(job, ctx, "ui", ui_agent.run), _agent(job, ctx, "backend", backend_agent.run), return_exceptions=True)
        for key, res in zip(("ui", "backend"), results):
            if isinstance(res, BaseException):
                current = key
                raise res
        current = "integration"
        await _agent(job, ctx, "integration", integration_agent.run)
        current = "testing"
        outcome = await _test_and_fix(job, ctx)
        job.data["status"] = "done" if outcome == "passed" else "failed"
    except Exception as exc:  # noqa: BLE001 - any failure is reported on the step that was running
        message = str(exc) if isinstance(exc, AgentError) else f"{type(exc).__name__}: {exc}"[:500]
        job.update(current, status="failed", detail=message)
        job.data.update(status="failed", error=message)
    finally:
        job.data["finished"] = time.time()
        job.data["llm_calls"] = ctx.llm_calls
        job.data["notes"] = ctx.notes
        if ctx.notes:
            ctx.write({"NOTES.md": memory.notes_markdown(ctx)})
        try:
            memory.learn(job.data["owner_id"], ctx)  # lessons and design taste for this user's next builds
        except OSError:
            pass
        job.save_files(ctx.files)
