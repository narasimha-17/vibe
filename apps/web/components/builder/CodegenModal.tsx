"use client";

import { useMemo, useState } from "react";
import { Check, Database, FileCode2, GitBranch, Package, Server, ShieldCheck, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useProjectStore } from "@/lib/store/project-store";
import type { BackendOptions, CodegenOptions, CodeFile, Framework, PageData } from "@/lib/types";
import { toast } from "@/lib/toast";
import { AgentBuildPanel } from "./AgentBuildPanel";

function readExportDefaults(): Partial<CodegenOptions> {
  try {
    const raw = window.localStorage.getItem("vibe.prefs");
    return raw ? (JSON.parse(raw).exportDefaults ?? {}) : {};
  } catch {
    return {};
  }
}

/** Mirrors the server's feature detection so users see what the backend will contain before generating. */
function detectFeatures(pages: PageData[]): { label: string; endpoint: string }[] {
  const found = new Map<string, { label: string; endpoint: string }>();
  for (const page of pages) {
    for (const n of page.tree) {
      const p = n.props || {};
      if (n.type === "forms") {
        if (n.variant === "booking") found.set("bookings", { label: "Booking form", endpoint: "/api/bookings" });
        else if (n.variant === "subscription") found.set("subscribers", { label: "Newsletter form", endpoint: "/api/subscribers" });
        else found.set("contact", { label: "Contact form", endpoint: "/api/contact" });
      }
      if (n.type === "notifications" && n.variant === "newsletter") found.set("subscribers", { label: "Newsletter banner", endpoint: "/api/subscribers" });
      if (n.type === "catalog") found.set("products", { label: "Product catalog", endpoint: "/api/products (full CRUD)" });
      if (n.type === "pricing") found.set("plans", { label: "Pricing plans", endpoint: "/api/plans" });
      if (n.type === "testimonials") found.set("testimonials", { label: "Testimonials", endpoint: "/api/testimonials" });
      if (n.type === "team") found.set("team", { label: "Team section", endpoint: "/api/team" });
      if (n.type === "faq") found.set("faqs", { label: "FAQ", endpoint: "/api/faqs" });
      if (n.type === "chatbot") found.set("chat", { label: "Chatbot", endpoint: "/api/chat" });
      if (n.type === "shop") found.set("shop", { label: "Shop, cart and Razorpay checkout", endpoint: "/api/products, /api/orders" });
      if (n.type === "tracking") found.set("tracking", { label: "Order tracking", endpoint: "/api/orders/{number}" });
      if (n.type === "navbar") {
        const labels = `${p.loginLabel || ""} ${p.ctaLabel || ""} ${p.cta || ""}`.toLowerCase();
        if (p.loginLabel || labels.includes("sign") || labels.includes("log")) found.set("auth", { label: "Login / sign-up button", endpoint: "/api/auth/*" });
      }
    }
  }
  return [...found.values()];
}

interface VerifyStep { name: string; status: "pass" | "fail" | "warn" | "skip" | "info"; detail: string }
interface VerifyPhase { id: string; name: string; status: "pass" | "fail"; steps: VerifyStep[] }
interface VerifyResult { ok: boolean; phases: VerifyPhase[]; counts: Record<string, number>; seconds: number }

const STATUS_STYLE: Record<VerifyStep["status"], string> = {
  pass: "bg-emerald-100 text-emerald-700",
  fail: "bg-rose-100 text-rose-700",
  warn: "bg-amber-100 text-amber-700",
  skip: "bg-slate-100 text-slate-500",
  info: "bg-sky-100 text-sky-700",
};

const FRONTENDS: { id: Framework; name: string; note: string }[] = [
  { id: "nextjs", name: "Next.js", note: "React framework with SEO and routing built in" },
  { id: "react", name: "React (Vite)", note: "Fast single-page app" },
  { id: "html", name: "HTML / CSS / JS", note: "No build step, works anywhere" },
];

/** VIBE builds single-page / portfolio sites that need no accounts, so the generated backend (with its
 * login, shop and order endpoints) is hidden. Flip this to bring the Backend section back. */
const SHOW_BACKEND = true;

const BACKENDS: { id: BackendOptions["framework"]; name: string; note: string }[] = [
  { id: "fastapi", name: "FastAPI", note: "Fast, modern, automatic API docs" },
  { id: "flask", name: "Flask", note: "Small, simple and flexible" },
  { id: "django", name: "Django", note: "Batteries included, with an admin panel" },
];

const DATABASES: { id: BackendOptions["database"]; name: string }[] = [
  { id: "sqlite", name: "SQLite" },
  { id: "postgres", name: "PostgreSQL" },
  { id: "mysql", name: "MySQL" },
];

function Choice({ on, onClick, title, note }: { on: boolean; onClick: () => void; title: string; note: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`relative rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${on ? "border-[#6b4d9a] bg-[#f6f2fd] ring-4 ring-[#6b4d9a]/10" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      {on && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[#6b4d9a] text-white"><Check className="h-3 w-3" /></span>}
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-0.5 text-xs leading-snug text-slate-500">{note}</div>
    </button>
  );
}

function Pills<T extends string>({ value, options, onChange, label, disabled }: { value: T; options: { id: T; name: string }[]; onChange: (v: T) => void; label: string; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 ${disabled ? "opacity-50" : ""}`}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} disabled={disabled} onClick={() => onChange(o.id)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${value === o.id ? "bg-[#6b4d9a] text-white shadow" : "text-slate-500 hover:text-slate-800"}`}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

function Check2({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${on ? "border-[#6b4d9a] bg-[#f6f2fd] text-[#5a3f86]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className={`grid h-4 w-4 place-items-center rounded ${on ? "bg-[#6b4d9a] text-white" : "border border-slate-300 bg-white"}`}>{on && <Check className="h-3 w-3" />}</span>
      {children}
    </label>
  );
}

function Section({ icon: Icon, title, hint, right, children }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f0e6fb] text-[#6b4d9a]"><Icon className="h-5 w-5" /></span>
        <div className="flex-1">
          <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function CodegenModal({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const [options, setOptions] = useState<CodegenOptions>(() => ({
    framework: "nextjs",
    language: "typescript",
    styling: "tailwind",
    ...readExportDefaults(),
    seo: true,
    accessibility: true,
    dark_mode: true,
    backend: { enabled: false, framework: "fastapi", database: "sqlite", auth: false, docker: true, cors_origin: "http://localhost:3000" },
  }));
  const [files, setFiles] = useState<CodeFile[] | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "frontend" | "backend">("all");
  const [loading, setLoading] = useState(false);
  const [repoName, setRepoName] = useState(project?.name.toLowerCase().replace(/\s+/g, "-") || "my-site");
  const [pushing, setPushing] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const features = useMemo(() => detectFeatures(project?.pages || []), [project]);

  if (!project) return null;
  const currentProject = project;
  const be = options.backend!;
  const setBe = (patch: Partial<BackendOptions>) => setOptions({ ...options, backend: { ...be, ...patch } });

  async function loadPreview() {
    setLoading(true);
    try {
      const res = await api.post<{ files: CodeFile[] }>("codegen/preview", { project: currentProject, options });
      setFiles(res.files);
      setActiveFile(res.files[0]?.path || null);
      setTab("all");
    } catch {
      toast("Couldn't generate a preview. Check the API is running.");
    } finally {
      setLoading(false);
    }
  }

  async function runVerify() {
    setRunning(true);
    setResult(null);
    try {
      setResult(await api.post<VerifyResult>("codegen/verify", { project: currentProject, options }));
    } catch {
      toast("Couldn't run the checks. Check the API is running.");
    } finally {
      setRunning(false);
    }
  }

  async function downloadZip() {
    try {
      await api.downloadZip("codegen/zip", { project: currentProject, options }, `${currentProject.name.toLowerCase().replace(/\s+/g, "-")}.zip`);
      toast("Download started.");
    } catch {
      toast("Couldn't build the ZIP. Check the API is running.");
    }
  }

  async function pushToGithub() {
    setPushing(true);
    try {
      const res = await api.post<{ repo_url: string }>(`github/projects/${currentProject.id}/push`, { project: currentProject, options, repo_name: repoName, private: true });
      toast(`Pushed to ${res.repo_url}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 501) toast("Connect your GitHub account in Settings first.");
      else {
        toast("GitHub push failed. See the console for details.");
        console.error(e);
      }
    } finally {
      setPushing(false);
    }
  }

  const shown = (files || []).filter((f) => tab === "all" || (tab === "backend" ? f.path.startsWith("backend/") : !f.path.startsWith("backend/")));
  const activeContent = files?.find((f) => f.path === activeFile)?.content || "";
  const summary = `${FRONTENDS.find((f) => f.id === options.framework)?.name}${options.framework !== "html" ? ` · ${options.language === "typescript" ? "TypeScript" : "JavaScript"}` : ""} · ${options.styling === "tailwind" ? "Tailwind" : "Plain CSS"}${be.enabled ? ` + ${BACKENDS.find((b) => b.id === be.framework)?.name} · ${DATABASES.find((d) => d.id === be.database)?.name}` : ""}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1b1330]/60 p-4 backdrop-blur-md" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Export your project" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-slate-50 shadow-[0_40px_100px_rgba(27,19,48,0.5)]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start gap-4 border-b border-slate-200 bg-white px-7 py-5">
          <div className="flex-1">
            <h2 className="text-xl font-extrabold text-slate-900">Export your project</h2>
            <p className="text-sm text-slate-500">Pick a frontend, add a Python backend if you need one, then download or push to GitHub. The code is generated by rules, not an AI, so it is the same every time.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <AgentBuildPanel projectId={currentProject.id} />

          <div className="flex items-center gap-3 px-1 pt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> Or export instantly with the rule-based generator <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Section icon={Package} title="Frontend" hint="What visitors see.">
            <div className="grid gap-3 sm:grid-cols-3">
              {FRONTENDS.map((f) => <Choice key={f.id} on={options.framework === f.id} onClick={() => setOptions({ ...options, framework: f.id })} title={f.name} note={f.note} />)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Pills label="Language" value={options.language} disabled={options.framework === "html"} onChange={(v) => setOptions({ ...options, language: v })} options={[{ id: "typescript", name: "TypeScript" }, { id: "javascript", name: "JavaScript" }]} />
              <Pills label="Styling" value={options.styling} onChange={(v) => setOptions({ ...options, styling: v })} options={[{ id: "tailwind", name: "Tailwind CSS" }, { id: "css", name: "Plain CSS" }]} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Check2 on={options.seo} onChange={(v) => setOptions({ ...options, seo: v })}>SEO metadata</Check2>
              <Check2 on={options.accessibility} onChange={(v) => setOptions({ ...options, accessibility: v })}>Accessibility</Check2>
              <Check2 on={options.dark_mode} onChange={(v) => setOptions({ ...options, dark_mode: v })}>Dark mode</Check2>
            </div>
          </Section>

          {SHOW_BACKEND && <Section
            icon={Server}
            title="Backend (optional)"
            hint="A Python API built from what is on your pages: forms, products, pricing, accounts and more."
            right={
              <button role="switch" aria-checked={be.enabled} aria-label="Include a backend" onClick={() => setBe({ enabled: !be.enabled })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${be.enabled ? "bg-[#6b4d9a]" : "bg-slate-300"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${be.enabled ? "left-6" : "left-1"}`} />
              </button>
            }
          >
            {!be.enabled ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Off. Turn it on to also get a ready-to-run backend in a <b>backend/</b> folder next to your frontend.</p>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {BACKENDS.map((b) => <Choice key={b.id} on={be.framework === b.id} onClick={() => setBe({ framework: b.id })} title={b.name} note={b.note} />)}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400"><Database className="h-3.5 w-3.5" /> Database</span>
                  <Pills label="Database" value={be.database} onChange={(v) => setBe({ database: v })} options={DATABASES} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Check2 on={be.auth || features.some((f) => f.endpoint.startsWith("/api/auth"))} onChange={(v) => setBe({ auth: v })}>User accounts (login and sign-up)</Check2>
                  <Check2 on={be.docker} onChange={(v) => setBe({ docker: v })}>Docker files</Check2>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Frontend address allowed to call the API (CORS)</span>
                  <input value={be.cors_origin} onChange={(e) => setBe({ cors_origin: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#6b4d9a] focus:ring-4 focus:ring-[#6b4d9a]/10" />
                </label>
                <div className="rounded-2xl border border-[#6b4d9a]/15 bg-[#f6f2fd] p-4">
                  <div className="mb-2 text-sm font-bold text-slate-900">Found on your site</div>
                  {features.length === 0 ? (
                    <p className="text-sm text-slate-500">No forms, catalog or other dynamic parts yet. You will still get a working API with a health check, ready to extend.</p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {features.map((f) => (
                        <li key={f.label} className="flex items-center gap-2 text-[13px]">
                          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span className="font-semibold text-slate-800">{f.label}</span>
                          <span className="ml-auto truncate font-mono text-[11px] text-slate-500">{f.endpoint}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </Section>}

          <Section
            icon={ShieldCheck}
            title="Test"
            hint="Generates the project and checks it builds."
            right={<button className="btn btn-primary h-9" onClick={runVerify} disabled={running}>{running ? "Running… (up to a minute)" : result ? "Run again" : "Run tests"}</button>}
          >
            {!result && !running && (
              <ol className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                <li className="rounded-2xl bg-slate-50 p-4"><b className="block text-slate-900">1. Generate</b>Builds your site's files.</li>
                <li className="rounded-2xl bg-slate-50 p-4"><b className="block text-slate-900">2. Check</b>Checks links and settings, and writes the README.</li>
                <li className="rounded-2xl bg-slate-50 p-4"><b className="block text-slate-900">3. Test</b>Type-checks the code.</li>
              </ol>
            )}
            {running && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Generating and checking your site…</p>}
            {result && (
              <div className="space-y-4">
                <div className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${result.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-white ${result.ok ? "bg-emerald-600" : "bg-rose-600"}`}>{result.ok ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}</span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">{result.ok ? "Everything that could be tested here passed" : "Some checks failed"}</div>
                    <div className="text-xs text-slate-600">{result.counts.pass} passed · {result.counts.fail} failed · {result.counts.warn} warnings · {result.counts.skip} skipped · {result.seconds}s</div>
                  </div>
                </div>
                {result.phases.map((ph) => (
                  <div key={ph.id} className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900">{ph.name}<span className={`rounded-full px-2.5 py-0.5 text-[11px] ${ph.status === "pass" ? STATUS_STYLE.pass : STATUS_STYLE.fail}`}>{ph.status}</span></div>
                    <ul className="divide-y divide-slate-100">
                      {ph.steps.map((st, i) => (
                        <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                          <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[st.status]}`}>{st.status}</span>
                          <div className="min-w-0"><div className="font-semibold text-slate-800">{st.name}</div>{st.detail && <div className="whitespace-pre-wrap break-words text-xs text-slate-500">{st.detail}</div>}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-xs text-slate-500">The zip also contains <b>INTEGRATION_REPORT.md</b> and a <b>README.md</b>.</p>
              </div>
            )}
          </Section>

          <Section
            icon={FileCode2}
            title="Preview your files"
            hint="Look through everything that will be generated."
            right={<button className="btn h-9" onClick={loadPreview} disabled={loading}>{loading ? "Generating…" : files ? "Refresh" : "Generate preview"}</button>}
          >
            {!files ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Nothing generated yet. Press <b>Generate preview</b> to see the files.</p>
            ) : (
              <>
                {be.enabled && (
                  <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1" role="tablist">
                    {(["all", "frontend", "backend"] as const).map((t) => (
                      <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1 text-xs font-semibold capitalize transition ${tab === t ? "bg-[#6b4d9a] text-white" : "text-slate-500 hover:text-slate-800"}`}>{t}</button>
                    ))}
                  </div>
                )}
                <div className="grid overflow-hidden rounded-2xl border border-slate-200 md:grid-cols-[230px_1fr]">
                  <div className="max-h-72 overflow-y-auto border-slate-200 bg-slate-50 p-2 md:border-r">
                    {shown.map((f) => (
                      <button key={f.path} onClick={() => setActiveFile(f.path)} title={f.path} className={`block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition ${f.path === activeFile ? "bg-white font-semibold text-[#5a3f86] shadow-sm" : "text-slate-600 hover:bg-white"}`}>
                        {f.path.startsWith("backend/") && <span className="mr-1.5 rounded bg-[#6b4d9a]/10 px-1 text-[9px] font-bold text-[#6b4d9a]">API</span>}
                        {f.path.replace("backend/", "")}
                      </button>
                    ))}
                  </div>
                  <pre className="max-h-72 overflow-auto bg-[#1e1a2e] p-4 font-mono text-[12px] leading-relaxed text-[#e9e2fb]">{activeContent}</pre>
                </div>
              </>
            )}
          </Section>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <div className="hidden min-w-0 flex-1 text-xs text-slate-500 lg:block"><span className="font-bold text-slate-700">Your export:</span> {summary}</div>
          <div className="flex items-center gap-2">
            <input value={repoName} onChange={(e) => setRepoName(e.target.value)} aria-label="GitHub repository name" placeholder="repository-name" className="h-10 w-44 rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-[#6b4d9a] focus:ring-4 focus:ring-[#6b4d9a]/10" />
            <button className="btn h-10 rounded-full" onClick={pushToGithub} disabled={pushing}><GitBranch className="h-4 w-4" /> {pushing ? "Pushing…" : "Push to GitHub"}</button>
          </div>
          <button className="inline-flex h-10 items-center gap-2 rounded-full bg-[#6b4d9a] px-6 text-sm font-bold text-white shadow-[0_6px_18px_rgba(107,77,154,0.35)] transition hover:bg-[#5a3f86]" onClick={downloadZip}>Download .zip</button>
        </footer>
      </div>
    </div>
  );
}
