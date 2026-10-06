"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, CopyPlus, FileCode2, FileJson, Layers, Monitor, Share2, Smartphone, Sparkles, Tablet, WandSparkles, X } from "lucide-react";
import { analyse } from "@/lib/style/a11y";
import type { Suggestion } from "@/lib/style/a11y";
import {
  applyLocks, buildTokens, deriveAxes, fontsOf, generateFromPrompt, randomize, setAxis, themePatch, variants,
} from "@/lib/style/engine";
import { download, parseShared, shareLink, toCss, toJson } from "@/lib/style/export";
import { ALL_FONTS, ensureFonts } from "@/lib/style/fonts";
import { PRESETS } from "@/lib/style/presets";
import type { Axes, LockKey, Mode, StyleSpec } from "@/lib/style/types";
import { useProjectStore } from "@/lib/store/project-store";
import { toast } from "@/lib/toast";
import { ControlsPanel } from "./ControlsPanel";
import { DnaPanel, GeneratedCoverage } from "./DnaPanel";
import { A11yPanel, CodePanel, RefsPanel } from "./Panels";
import { MiniSite, PreviewSite, ScaledFrame } from "./PreviewSite";
import { Seg } from "./ui";

const SAVED_KEY = "vibe.savedStyles";
const EXAMPLES = ["premium AI startup landing page with a dark futuristic interface", "calm japanese tea shop, minimal and warm", "playful fintech app with soft rounded shapes", "loud neo-brutalist portfolio for a photographer"];
const COVERAGE = ["Navbar", "Hero", "Buttons", "Cards", "Forms & inputs", "Tables", "Dashboards", "Modals", "Badges", "Tabs", "Footer", "Pricing", "Testimonials", "CTA & banners"];

function loadSaved(): StyleSpec[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}
const uid = () => "u-" + Math.random().toString(36).slice(2, 8);

type View = "explore" | "preview" | "compare";
type RightTab = "design" | "controls" | "check" | "code" | "sources";

function StyleCard({ p, tag, active, onPick }: { p: StyleSpec; tag?: string; active: boolean; onPick: (p: StyleSpec) => void }) {
  const t = useMemo(() => buildTokens(p), [p]);
  const pal = t.colors[p.mode];
  const on = active;
  return (
    <button
      onClick={() => onPick(p)}
      aria-pressed={on}
      className={`group overflow-hidden rounded-3xl border text-left transition duration-300 hover:-translate-y-1.5 ${on ? "border-[#ff5b7f] shadow-[0_0_0_2px_rgba(255,91,127,0.5),0_24px_50px_rgba(255,91,127,0.2)]" : "border-white/10 hover:border-[#b79be6]/60 hover:shadow-[0_24px_50px_rgba(0,0,0,0.4)]"} bg-[#1b1530]`}
    >
      <div className="h-48 overflow-hidden border-b border-white/10">
        <MiniSite spec={p} />
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <div className="text-[15px] font-extrabold text-white">{p.name}</div>
            <div className="text-[11px] font-semibold text-[#ff8fb1]">{p.mood}</div>
          </div>
          {tag && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#d9d0f2]">{tag}</span>}
        </div>
        <p className="mb-3 line-clamp-2 text-[11px] leading-snug text-[#b9adda]">{p.blurb}</p>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-1">
            {[pal.primary, pal.secondary, pal.accent, pal.background, pal.surface].map((c, i) => <span key={i} className="h-5 w-5 rounded-full border border-white/20" style={{ background: c }} />)}
          </div>
          <span className="text-lg leading-none text-white" style={{ fontFamily: `'${p.heading}', serif` }}>Aa</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            `${p.heading}`, `r ${p.radius}px`, `${p.shadow} shadow`, p.density < 25 ? "airy" : p.density < 50 ? "balanced" : "compact",
            `${p.button} btn`, `${p.card} card`, `${p.nav} nav`, `${p.motion} motion`,
          ].map((c) => <span key={c} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#b9adda]">{c}</span>)}
        </div>
      </div>
    </button>
  );
}

export function StyleStudio({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const updateTheme = useProjectStore((s) => s.updateTheme);
  const existing = (project?.theme as any)?.design?.spec as StyleSpec | undefined;

  const [spec, setSpec] = useState<StyleSpec>(() => existing ?? (typeof location !== "undefined" ? parseShared(location.hash) : null) ?? PRESETS[0]);
  const [view, setView] = useState<View>(existing ? "preview" : "explore");
  const [tab, setTab] = useState<RightTab>("design");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [page, setPage] = useState<"landing" | "components">("landing");
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);
  const [saved, setSaved] = useState<StyleSpec[]>([]);
  const [prompt, setPrompt] = useState("");
  const [trace, setTrace] = useState<string[] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [vars, setVars] = useState<StyleSpec[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [coverage, setCoverage] = useState<"idle" | "running" | "done">("idle");
  const [compare, setCompare] = useState<StyleSpec[]>(() => [PRESETS[0], PRESETS[8], PRESETS[5]]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const tokens = useMemo(() => buildTokens(spec), [spec]);

  useEffect(() => setSaved(loadSaved()), []);
  useEffect(() => ensureFonts(ALL_FONTS), []);
  useEffect(() => ensureFonts(fontsOf(spec)), [spec.heading, spec.body, spec.mono]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => setModeOverride(null), [spec.mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "Escape" && !/INPUT|TEXTAREA|SELECT/.test(el.tagName)) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ── state transitions ── */
  const pickPreset = useCallback((p: StyleSpec) => {
    setSpec((s) => applyLocks(s, deriveAxes({ ...p, locks: s.locks, fix: { light: {}, dark: {} } })));
    setView("preview");
    setVars(null);
    setSuggestions(null);
    setCoverage("idle");
  }, []);

  const update = (patch: Partial<StyleSpec>) => setSpec((s) => deriveAxes({ ...s, ...patch }));
  const onAxis = (k: keyof Axes, v: number) => setSpec((s) => setAxis(s, k, v));
  const toggleLock = (k: LockKey) => setSpec((s) => ({ ...s, locks: { ...s.locks, [k]: !s.locks[k] } }));

  function runGenerate(text: string) {
    if (thinking) return;
    timers.current.forEach(clearTimeout);
    setThinking(true);
    setView("preview");
    setTrace([]);
    const result = generateFromPrompt(text, spec);
    result.trace.forEach((line, i) => timers.current.push(setTimeout(() => setTrace((t) => [...(t || []), line]), 350 + i * 420)));
    timers.current.push(
      setTimeout(() => {
        setSpec(result.spec);
        setThinking(false);
        setVars(null);
        setSuggestions(null);
        setCoverage("idle");
      }, 350 + result.trace.length * 420)
    );
  }

  function applyToProject() {
    if (!project) return;
    updateTheme(themePatch(spec, tokens));
    toast(`“${spec.name}” applied to ${project.name}.`);
    setCoverage("running");
    timers.current.push(setTimeout(() => setCoverage("done"), COVERAGE.length * 60 + 400));
  }

  function save(s: StyleSpec = spec, silent = false) {
    const list = [s, ...loadSaved().filter((x) => x.id !== s.id)].slice(0, 30);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {
      toast("Couldn't save — browser storage is unavailable.");
      return;
    }
    setSaved(list);
    if (!silent) toast(`Saved “${s.name}”.`);
  }

  function duplicate() {
    const copy: StyleSpec = { ...spec, id: uid(), name: `${spec.name} copy` };
    save(copy, true);
    setSpec(copy);
    toast("Duplicated and saved.");
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(shareLink(spec));
      toast("Share link copied — anyone with it can load this style in Style Studio.");
    } catch {
      toast("Couldn't copy the link.");
    }
  }

  const slug = spec.name.toLowerCase().replace(/\W+/g, "-");
  const previewMode = modeOverride ?? spec.mode;

  /* ── pieces ── */
  const topBtn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12px] font-semibold text-[#d9d0f2] transition hover:border-[#ff5b7f]/50 hover:bg-[#ff5b7f]/10 hover:text-white";

  const deviceCfg = { desktop: { w: 1100, box: "100%" }, tablet: { w: 768, box: "68%" }, mobile: { w: 390, box: "min(360px, 100%)" } }[device];

  return (
    <div role="dialog" aria-modal="true" aria-label="Style Studio" className="fixed inset-0 z-[120] grid grid-rows-[60px_minmax(0,1fr)] bg-[#120d20] text-white">
      {/* ── top bar ── */}
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#180f2b]/90 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#ff5b7f] to-[#6b4d9a] shadow-[0_0_20px_rgba(255,91,127,0.5)]"><WandSparkles className="h-4 w-4" /></span>
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold">Style Studio</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8fb1]">AI Design Director</div>
          </div>
        </div>
        <div className="ml-4 hidden min-w-0 items-center gap-2 lg:flex">
          <span className="truncate rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[12px] font-bold">{spec.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className={topBtn} onClick={() => save()}><Bookmark className="h-3.5 w-3.5" /><span className="hidden xl:inline">Save Style</span></button>
          <button className={topBtn} onClick={duplicate}><CopyPlus className="h-3.5 w-3.5" /><span className="hidden xl:inline">Duplicate</span></button>
          <button className={topBtn} onClick={share}><Share2 className="h-3.5 w-3.5" /><span className="hidden xl:inline">Share</span></button>
          <button className={topBtn} onClick={() => download(`${slug}.json`, toJson(spec, tokens), "application/json")}><FileJson className="h-3.5 w-3.5" /><span className="hidden xl:inline">Export JSON</span></button>
          <button className={topBtn} onClick={() => download(`${slug}.css`, toCss(spec, tokens), "text/css")}><FileCode2 className="h-3.5 w-3.5" /><span className="hidden xl:inline">Export CSS</span></button>
          <button onClick={applyToProject} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ff5b7f] to-[#8b5fc7] px-4 text-[12px] font-bold text-white shadow-[0_0_24px_rgba(255,91,127,0.4)] transition hover:brightness-110">
            <Layers className="h-3.5 w-3.5" /> Apply to Project
          </button>
          <button onClick={onClose} aria-label="Close Style Studio" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#b9adda] transition hover:rotate-90 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_390px]">
        {/* ── centre ── */}
        <section className="flex min-h-0 min-w-0 flex-col" style={{ background: "radial-gradient(60% 40% at 30% 0%, rgba(107,77,154,0.28), transparent), #120d20" }}>
          {/* prompt */}
          <div className="border-b border-white/10 px-5 py-3">
            <form onSubmit={(e) => { e.preventDefault(); runGenerate(prompt || EXAMPLES[0]); }} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-1.5 pl-4 shadow-[0_0_30px_rgba(139,95,199,0.15)] focus-within:border-[#ff5b7f]/60">
              <Sparkles className="h-4 w-4 shrink-0 text-[#ff5b7f]" />
              <input
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="Generate with AI — “premium AI startup landing page with a dark futuristic interface”"
                aria-label="Describe your website"
                className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-white outline-none placeholder:text-[#7d74a6]"
              />
              <button disabled={thinking} className="shrink-0 rounded-xl bg-gradient-to-r from-[#ff5b7f] to-[#8b5fc7] px-4 py-2 text-[12px] font-bold text-white transition hover:brightness-110 disabled:opacity-60">
                {thinking ? "Designing…" : "Generate with AI"}
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => { setPrompt(ex); runGenerate(ex); }} className="rounded-full border border-white/10 px-2.5 py-1 text-[10.5px] text-[#b9adda] transition hover:border-[#b79be6]/60 hover:text-white">{ex}</button>
              ))}
            </div>
          </div>

          {/* view toolbar */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-3">
            <Seg label="View" value={view} onChange={setView} options={[{ v: "explore", l: "Explore styles" }, { v: "preview", l: "Live preview" }, { v: "compare", l: "Compare" }]} />
            {view === "preview" && (
              <>
                <Seg label="Page" value={page} onChange={setPage} options={[{ v: "landing", l: "Landing page" }, { v: "components", l: "Components" }]} />
                <Seg label="Mode" value={previewMode} onChange={(v) => setModeOverride(v)} options={[{ v: "light", l: "Light" }, { v: "dark", l: "Dark" }]} />
                <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1" role="radiogroup" aria-label="Device">
                  {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
                    <button key={d} role="radio" aria-checked={device === d} aria-label={d} onClick={() => setDevice(d)} className={`grid h-7 w-8 place-items-center rounded-lg transition ${device === d ? "bg-white/15 text-white" : "text-[#8b83b5] hover:text-white"}`}><Icon className="h-3.5 w-3.5" /></button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10">
            {/* design director log */}
            {trace && (
              <div className="mb-4 rounded-2xl border border-[#b79be6]/30 bg-[#1b1530] p-4 shadow-[0_0_40px_rgba(139,95,199,0.2)]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff8fb1]">
                    <span className={`h-2 w-2 rounded-full ${thinking ? "animate-pulse bg-[#ff5b7f]" : "bg-emerald-400"}`} /> AI Design Director {thinking ? "· researching principles…" : "· done"}
                  </span>
                  {!thinking && <button onClick={() => setTrace(null)} className="text-[11px] text-[#8b83b5] hover:text-white">Dismiss</button>}
                </div>
                <ul className="space-y-1 font-mono text-[11px] leading-relaxed text-[#d9d0f2]">
                  {trace.map((l, i) => <li key={i} style={{ animation: "fade-in .35s ease-out" }}><span className="text-[#b79be6]">›</span> {l}</li>)}
                </ul>
              </div>
            )}

            {/* remix variants */}
            {vars && view === "preview" && (
              <div className="mb-4 rounded-2xl border border-white/10 bg-[#1b1530] p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-[#b9adda]">
                  <span>Remix variations — pick one</span>
                  <button onClick={() => setVars(variants(spec, 4))} className="text-[#ff8fb1] hover:text-white">↻ New batch</button>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {vars.map((v) => (
                    <button key={v.id} onClick={() => { setSpec(v); setVars(null); }} className="overflow-hidden rounded-xl border border-white/10 text-left transition hover:-translate-y-1 hover:border-[#ff5b7f]">
                      <div className="h-28 overflow-hidden"><MiniSite spec={v} /></div>
                      <div className="truncate bg-black/30 px-2 py-1 text-[10.5px] font-bold text-white">{v.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {view === "explore" && (
              <div>
                {saved.length > 0 && (
                  <>
                    <h2 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff8fb1]">Your styles</h2>
                    <div className="mb-8 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {saved.map((s) => <StyleCard key={s.id} p={s} tag="Saved" active={s.id === spec.id} onPick={pickPreset} />)}
                    </div>
                  </>
                )}
                <h2 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff8fb1]">Style library · {PRESETS.length} original directions</h2>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {PRESETS.map((p) => <StyleCard key={p.id} p={p} active={p.id === spec.id} onPick={pickPreset} />)}
                </div>
              </div>
            )}

            {view === "preview" && (
              <div className="flex justify-center rounded-2xl border border-white/10 bg-[#0e0a1a] p-4" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
                <div className="overflow-hidden rounded-xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] transition-[width] duration-500" style={{ width: deviceCfg.box }}>
                  <ScaledFrame width={deviceCfg.w}>
                    <PreviewSite spec={spec} mode={previewMode} page={page} />
                  </ScaledFrame>
                </div>
              </div>
            )}

            {view === "compare" && (
              <div>
                <p className="mb-3 text-[12px] text-[#b9adda]">Same sample landing page, three styles. Pick any style per column.</p>
                <div className="grid gap-4 xl:grid-cols-3">
                  {compare.map((c, i) => (
                    <div key={i} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#1b1530]">
                      <div className="border-b border-white/10 p-3">
                        <select
                          value={c.id}
                          onChange={(e) => {
                            const pool = [spec, ...saved, ...PRESETS];
                            const next = pool.find((x) => x.id === e.target.value);
                            if (next) setCompare((cur) => cur.map((x, j) => (j === i ? next : x)));
                          }}
                          aria-label={`Compare slot ${i + 1}`}
                          className="w-full rounded-lg border border-white/10 bg-[#241a3a] px-2 py-1.5 text-[12px] font-semibold text-white"
                        >
                          <option value={spec.id}>● Current · {spec.name}</option>
                          {saved.map((s) => <option key={s.id} value={s.id}>★ {s.name}</option>)}
                          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-[#b9adda]">
                          {[c.heading, `r ${c.radius}px`, c.shadow, c.motion, c.mode].map((x) => <span key={x} className="rounded bg-white/[0.06] px-1.5 py-0.5">{x}</span>)}
                        </div>
                      </div>
                      <div className="max-h-[70vh] overflow-y-auto">
                        <ScaledFrame width={1100}>
                          <PreviewSite spec={c.id === spec.id ? spec : c} />
                        </ScaledFrame>
                      </div>
                      <div className="p-2.5">
                        <button onClick={() => pickPreset(c)} className="w-full rounded-lg border border-white/15 py-1.5 text-[11px] font-bold text-white hover:bg-white/10">Use this style</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── right rail ── */}
        <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#180f2b]">
          <div role="tablist" aria-label="Studio panels" className="grid grid-cols-5 border-b border-white/10 text-[11px] font-bold">
            {([["design", "Design"], ["controls", "Controls"], ["check", "A11y"], ["code", "Code"], ["sources", "Sources"]] as [RightTab, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`relative py-3 transition ${tab === k ? "text-white" : "text-[#8b83b5] hover:text-white"}`}>
                {l}
                {tab === k && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-[#ff5b7f] to-[#b79be6]" />}
              </button>
            ))}
          </div>
          <div className={`min-h-0 flex-1 p-5 ${tab === "code" ? "" : "overflow-y-auto"}`}>
            {tab === "design" && (
              <DnaPanel
                spec={spec} tokens={tokens} onAxis={onAxis}
                onRemix={() => { setVars(variants(spec, 4)); setView("preview"); }}
                onRandomize={() => { setSpec(randomize(spec)); setView("preview"); setSuggestions(null); }}
                onImprove={() => setSuggestions(analyse(spec, tokens))}
                suggestions={suggestions}
                onApplySuggestion={(s) => { setSpec((cur) => applyLocks(cur, deriveAxes(s.apply(cur)))); setSuggestions((l) => (l || []).filter((x) => x.id !== s.id)); }}
                onApplyAll={() => { setSpec((cur) => (suggestions || []).reduce((acc, s) => applyLocks(acc, deriveAxes(s.apply(acc))), cur)); setSuggestions([]); }}
              />
            )}
            {tab === "controls" && <ControlsPanel spec={spec} tokens={tokens} update={update} toggleLock={toggleLock} />}
            {tab === "check" && <A11yPanel spec={spec} tokens={tokens} onChange={setSpec} />}
            {tab === "code" && <CodePanel spec={spec} tokens={tokens} />}
            {tab === "sources" && <RefsPanel spec={spec} />}
          </div>
          <div className="space-y-3 border-t border-white/10 bg-[#140c26] p-4">
            {coverage !== "idle" && <GeneratedCoverage items={COVERAGE} done={coverage === "done"} />}
            <button onClick={applyToProject} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff5b7f] to-[#8b5fc7] py-3 text-[13px] font-extrabold text-white shadow-[0_0_30px_rgba(255,91,127,0.35)] transition hover:brightness-110">
              <WandSparkles className="h-4 w-4" /> Generate Design System
            </button>
            <p className="text-center text-[10.5px] leading-snug text-[#8b83b5]">Converts this style into VIBE tokens and applies it to every component in <b className="text-[#b9adda]">{project?.name || "your project"}</b>.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
