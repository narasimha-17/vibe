"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, Download, FileCode2, Loader2, Minus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { buildReference } from "@/lib/agent-reference";
import { useProjectStore } from "@/lib/store/project-store";

type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";
interface AgentStep { key: string; name: string; status: StepStatus; detail: string; files: string[]; seconds?: number; started?: number }
export interface AgentJob {
  id: string;
  status: "running" | "done" | "failed";
  steps: AgentStep[];
  files: string[];
  llm_calls: number;
  fix_rounds: number;
  needs_backend: boolean;
  error: string | null;
  created: number;
  finished: number | null;
  pages?: number;
  estimate?: [number, number]; // usual build time in seconds, [low, high]
}

/** The latest agent build for a project, polled while it runs. */
export function useAgentJob(projectId: string | undefined) {
  const [job, setJob] = useState<AgentJob | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const poll = useCallback(async (id: string) => {
    try {
      const next = await api.get<AgentJob>(`agents/jobs/${id}`);
      setJob(next);
      if (next.status === "running") timer.current = setTimeout(() => void poll(id), 2000);
    } catch {
      timer.current = setTimeout(() => void poll(id), 5000);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    api.get<AgentJob | null>(`agents/projects/${projectId}/latest`).then((j) => {
      if (!alive || !j) return;
      setJob(j);
      if (j.status === "running") void poll(j.id);
    }).catch(() => undefined);
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [projectId, poll]);

  /** Starts a build with the design reference (the pages as the builder renders them). `auto` = only if auto-build is on. */
  const start = useCallback(async (auto = false) => {
    if (!projectId) return;
    try {
      const project = useProjectStore.getState().project;
      let reference;
      try {
        reference = project ? buildReference(project) : undefined;
      } catch {
        reference = undefined; // the agents still build from the content alone
      }
      const j = await api.post<AgentJob | null>(`agents/projects/${projectId}/build`, { reference, auto });
      if (!j) return;
      setJob(j);
      clearTimeout(timer.current);
      void poll(j.id);
    } catch (e) {
      const detail = e instanceof ApiError && typeof (e.detail as any)?.detail === "string" ? (e.detail as any).detail : "Couldn't start the agents. Check the API is running.";
      toast(detail);
    }
  }, [projectId, poll]);

  return { job, start };
}

const STATUS_STYLE: Record<StepStatus, string> = {
  pending: "bg-slate-100 text-slate-400",
  running: "bg-[#f0e6fb] text-[#6b4d9a]",
  done: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  skipped: "bg-slate-100 text-slate-500",
};

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin" />;
  if (status === "done") return <Check className="h-4 w-4" />;
  if (status === "failed") return <X className="h-4 w-4" />;
  if (status === "skipped") return <Minus className="h-4 w-4" />;
  return <span className="h-2 w-2 rounded-full bg-current" />;
}

/** Live view of the five build agents, with the finished files and a zip download. */
/** "45s", "2:05" (m:ss) or "1:02:05". */
function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** The current time in seconds, ticking every second while `active`. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now() / 1000);
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function AgentBuildPanel({ projectId }: { projectId: string }) {
  const { job, start } = useAgentJob(projectId);
  const [open, setOpen] = useState<{ path: string; content: string } | null>(null);
  const running = job?.status === "running";
  const now = useNow(running);
  const elapsed = job ? (job.finished ?? now) - job.created : 0;
  const minutes = (sec: number) => Math.max(1, Math.round(sec / 60));

  async function show(path: string) {
    if (!job) return;
    try {
      setOpen(await api.get<{ path: string; content: string }>(`agents/jobs/${job.id}/file?path=${encodeURIComponent(path)}`));
    } catch {
      toast("Couldn't open that file.");
    }
  }

  return (
    <section className="rounded-3xl border border-[#6b4d9a]/25 bg-white p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#6b4d9a] text-white"><Bot className="h-5 w-5" /></span>
        <div className="flex-1">
          <h3 className="text-base font-extrabold text-slate-900">Build with agents</h3>
          <p className="text-sm text-slate-500">
            Five AI agents write the whole project from your site: API design, Next.js frontend, FastAPI backend, integration checks and tests that actually run.
          </p>
        </div>
        <button className="btn btn-primary h-9 shrink-0" onClick={() => void start(false)} disabled={running}>
          {running ? "Building…" : job ? "Build again" : "Start build"}
        </button>
      </div>

      {!job ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No build yet. Press <b>Start build</b>. It usually takes one to three minutes.</p>
      ) : (
        <>
          <div
            className={`mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 text-sm ${
              running ? "bg-[#f6f2fd] text-[#5a3f86]" : job.status === "done" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
            }`}
            aria-live="polite"
          >
            <span className="font-bold">
              {running ? "Building for" : job.status === "done" ? "Finished in" : "Stopped after"} <span className="font-mono">{clock(elapsed)}</span>
            </span>
            {running && job.estimate && (
              <span className="text-[13px] opacity-80">
                usually takes about {minutes(job.estimate[0])}–{minutes(job.estimate[1])} min{job.pages ? ` for ${job.pages} pages` : ""}
                {elapsed > job.estimate[1] ? " · taking longer than usual (the model may be busy)" : ""}
              </span>
            )}
            {!running && job.status === "failed" && job.error && <span className="text-[13px]">{job.error}</span>}
          </div>
          <ol className="space-y-2">
            {job.steps.map((s, i) => (
              <li key={s.key} className={`flex items-start gap-3 rounded-2xl border p-3 ${s.status === "running" ? "border-[#6b4d9a]/40 bg-[#faf7fe]" : "border-slate-100"}`}>
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${STATUS_STYLE[s.status]}`}><StepIcon status={s.status} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span className="text-slate-400">{i + 1}.</span> {s.name}
                    {s.status === "running" && s.started ? (
                      <span className="rounded-full bg-[#6b4d9a]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#6b4d9a]">{clock(now - s.started)}</span>
                    ) : s.seconds !== undefined ? (
                      <span className="font-mono text-[11px] font-medium text-slate-400">{clock(s.seconds)}</span>
                    ) : null}
                    {s.files.length > 0 && <span className="text-[11px] font-medium text-slate-400">· {s.files.length} files</span>}
                  </div>
                  {s.detail && <div className="whitespace-pre-wrap break-words text-xs text-slate-500">{s.detail}</div>}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{job.llm_calls} model calls</span>
            {job.fix_rounds > 0 && <span>· {job.fix_rounds} fix round{job.fix_rounds > 1 ? "s" : ""}</span>}
            <span>· {job.needs_backend ? "frontend + backend" : "frontend only (static site)"}</span>
            {!running && job.files.length > 0 && (
              <a href={`/api/proxy/agents/jobs/${job.id}/zip`} className="ml-auto inline-flex h-9 items-center gap-2 rounded-full bg-[#6b4d9a] px-5 text-sm font-bold text-white hover:bg-[#5a3f86]">
                <Download className="h-4 w-4" /> Download agent build (.zip)
              </a>
            )}
          </div>

          {!running && job.files.length > 0 && (
            <div className="mt-4 grid overflow-hidden rounded-2xl border border-slate-200 md:grid-cols-[230px_1fr]">
              <div className="max-h-72 overflow-y-auto border-slate-200 bg-slate-50 p-2 md:border-r">
                {job.files.map((f) => (
                  <button key={f} onClick={() => void show(f)} title={f} className={`flex w-full items-center gap-1.5 truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition ${open?.path === f ? "bg-white font-semibold text-[#5a3f86] shadow-sm" : "text-slate-600 hover:bg-white"}`}>
                    <FileCode2 className="h-3 w-3 shrink-0 opacity-50" /> <span className="truncate">{f}</span>
                  </button>
                ))}
              </div>
              <pre className="max-h-72 overflow-auto bg-[#1e1a2e] p-4 font-mono text-[12px] leading-relaxed text-[#e9e2fb]">{open ? open.content : "Pick a file to read it."}</pre>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Small live status in the builder while the agents work; opens the Export dialog. */
export function AgentBuildChip({ projectId, onOpen, autoStart, onAutoStarted }: { projectId: string; onOpen: () => void; autoStart?: boolean; onAutoStarted?: () => void }) {
  const { job, start } = useAgentJob(projectId);
  const project = useProjectStore((s) => s.project);
  const started = useRef(false);
  // Arriving from OORA: start the agents once the project (and so the design reference) is loaded.
  useEffect(() => {
    if (!autoStart || started.current || !project || project.id !== projectId) return;
    started.current = true;
    onAutoStarted?.();
    void start(true);
  }, [autoStart, project, projectId, start, onAutoStarted]);
  if (!job || (job.status !== "running" && (!job.finished || Date.now() / 1000 - job.finished > 600))) return null;
  const done = job.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const current = job.steps.find((s) => s.status === "running");
  return (
    <button
      onClick={onOpen}
      className={`fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(27,19,48,0.35)] ${job.status === "failed" ? "bg-rose-600" : job.status === "done" ? "bg-emerald-600" : "bg-[#6b4d9a]"}`}
    >
      {job.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : job.status === "done" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {job.status === "running" ? `Agents building your code · ${done}/5 · ${current?.name ?? ""}` : job.status === "done" ? "Agents finished your code · view" : "Agent build needs attention · view"}
    </button>
  );
}
