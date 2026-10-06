"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { applyAllA11y } from "@/lib/style/a11y";
import { buildTokens, fontsOf, hexToHsl, hsl, themePatch } from "@/lib/style/engine";
import { ensureFonts } from "@/lib/style/fonts";
import { PRESETS } from "@/lib/style/presets";
import { contrastRows, harmonyHues, psychology, SCHEMES, specFor, usage, wheelColor } from "@/lib/style/colortheory";
import type { SchemeId } from "@/lib/style/colortheory";
import type { Mode, StyleSpec } from "@/lib/style/types";
import { useProjectStore } from "@/lib/store/project-store";
import { toast } from "@/lib/toast";
import { MiniSite, PreviewSite, ScaledFrame } from "./PreviewSite";

interface Advice {
  name: string;
  hue: number;
  sat: number;
  scheme: SchemeId;
  mode: Mode;
  justification: string;
  psychology: string;
  audience_fit: string;
  caution: string;
}
interface AdviceResponse { provider: string; summary: string; options: Advice[] }

const MOODS = ["Trustworthy", "Playful", "Luxurious", "Calm", "Bold", "Friendly", "Modern", "Elegant"];
const QUICK = [
  { name: "Red", h: 355 }, { name: "Orange", h: 24 }, { name: "Yellow", h: 48 }, { name: "Green", h: 140 }, { name: "Teal", h: 175 },
  { name: "Blue", h: 220 }, { name: "Indigo", h: 250 }, { name: "Purple", h: 280 }, { name: "Pink", h: 330 },
];

const SIZE = 240;
const R = 96;

/** Picks the harmony that best suits the current style's personality. */
function recommend(spec: StyleSpec): SchemeId {
  const a = spec.axes;
  if (a.expressive < 30) return "mono";
  if (a.creative > 65) return "triadic";
  if (a.expressive > 65) return "complementary";
  if (a.animated > 60) return "split";
  return "analogous";
}

/* ───────── small light-theme controls ───────── */
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${value === o.v ? "bg-[#6b4d9a] text-white shadow" : "text-slate-500 hover:text-slate-800"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_20px_rgba(107,77,154,0.06)] sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#6b4d9a] text-sm font-bold text-white">{n}</span>
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#6b4d9a] focus:ring-4 focus:ring-[#6b4d9a]/10";

function Wheel({ hue, scheme, onHue }: { hue: number; scheme: SchemeId; onHue: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const hues = harmonyHues(hue, scheme);
  const pt = (h: number) => {
    const a = (h * Math.PI) / 180;
    return { x: SIZE / 2 + R * Math.sin(a), y: SIZE / 2 - R * Math.cos(a) };
  };
  const points = hues.map(pt);

  function pick(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    onHue(Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360));
  }

  return (
    <div
      ref={ref} role="slider" tabIndex={0} aria-label="Base hue" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(hue)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onHue((hue + 5) % 360);
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") onHue((hue + 355) % 360);
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && pick(e)}
      className="relative mx-auto cursor-crosshair touch-none select-none rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.12)] outline-none focus-visible:ring-4 focus-visible:ring-[#6b4d9a]/30"
      style={{ width: SIZE, height: SIZE, background: "conic-gradient(from 0deg, hsl(0,85%,55%), hsl(60,85%,55%), hsl(120,85%,55%), hsl(180,85%,55%), hsl(240,85%,55%), hsl(300,85%,55%), hsl(360,85%,55%))" }}
    >
      <div className="absolute rounded-full bg-white" style={{ inset: 44 }} />
      <svg width={SIZE} height={SIZE} className="pointer-events-none absolute inset-0 overflow-visible">
        {points.length > 2 && <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(107,77,154,0.08)" stroke="#6b4d9a" strokeWidth={1.5} strokeDasharray="4 4" />}
        {points.length === 2 && <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#6b4d9a" strokeWidth={1.5} strokeDasharray="4 4" />}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 14 : 10} fill={wheelColor(hues[i])} stroke="#fff" strokeWidth={i === 0 ? 4 : 3} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" }} />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-mono text-2xl font-extrabold text-slate-900">{Math.round(hue)}°</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">base hue</div>
        </div>
      </div>
    </div>
  );
}

export function ColorTheoryPanel({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const updateTheme = useProjectStore((s) => s.updateTheme);
  const existing = (project?.theme as any)?.design?.spec as StyleSpec | undefined;
  const base = existing ?? PRESETS[0];

  const [hue, setHue] = useState(Math.round(base.hue));
  const [sat, setSat] = useState(Math.round(base.sat));
  const [scheme, setScheme] = useState<SchemeId>((base.scheme as SchemeId) || recommend(base));
  const [mode, setMode] = useState<Mode>(base.mode);
  const [fix, setFix] = useState<StyleSpec["fix"] | null>(null);
  const [page, setPage] = useState<"landing" | "components">("landing");

  const brief = (project?.settings as any)?.projectBrief || {};
  const [ask, setAsk] = useState({ brief: String(brief.brief || ""), industry: "", audience: String(brief.audience || ""), mood: "", avoid: "" });
  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [thinking, setThinking] = useState(false);

  async function getAdvice() {
    if (!ask.brief.trim() && !ask.industry.trim() && !ask.mood) {
      toast("Tell us a little about your site first, or pick a mood.");
      return;
    }
    setThinking(true);
    try {
      setAdvice(await api.post<AdviceResponse>("ai/color-advice", ask));
    } catch {
      toast("Couldn't reach the advisor.");
    } finally {
      setThinking(false);
    }
  }

  function useAdvice(o: Advice) {
    setHue(o.hue);
    setSat(o.sat);
    setScheme(o.scheme);
    setMode(o.mode);
    toast(`Loaded “${o.name}”. Scroll down to fine-tune it.`);
  }

  useEffect(() => setFix(null), [hue, sat, scheme, mode]);
  useEffect(() => ensureFonts(fontsOf(base)), [base]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw = useMemo(() => specFor(base, hue, sat, scheme, mode), [base, hue, sat, scheme, mode]);
  const spec = useMemo(() => (fix ? { ...raw, fix } : raw), [raw, fix]);
  const tokens = useMemo(() => buildTokens(spec), [spec]);
  const u = useMemo(() => usage(spec), [spec]);
  const rows = useMemo(() => contrastRows(u.pal), [u]);
  const failing = rows.filter((r) => !r.ok).length;
  const psy = psychology(hue);
  const suggested = recommend(base);
  const baseHex = hsl(hue, sat, 45);
  const schemeInfo = SCHEMES.find((s) => s.id === scheme)!;

  function apply() {
    if (!project) return;
    updateTheme(themePatch(spec, tokens));
    toast(`${schemeInfo.label} palette applied to ${project.name}.`);
    onClose();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Color theory" className="fixed inset-0 z-[120] flex flex-col bg-white text-slate-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 sm:px-8">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#6b4d9a] text-white"><Sparkles className="h-5 w-5" /></span>
        <div className="leading-tight">
          <div className="text-base font-extrabold">Color Theory</div>
          <div className="text-xs text-slate-500">Find colors that suit your site, and see why</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Seg label="Mode" value={mode} onChange={setMode} options={[{ v: "light", l: "Light" }, { v: "dark", l: "Dark" }]} />
          <button onClick={apply} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#6b4d9a] px-5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(107,77,154,0.35)] transition hover:bg-[#5a3f86]">
            <Check className="h-4 w-4" /> Apply to project
          </button>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"><X className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto bg-slate-50/70 lg:grid-cols-[320px_minmax(0,1fr)] lg:overflow-hidden">
        {/* ───── sticky summary ───── */}
        <aside className="border-slate-200 bg-white p-5 lg:overflow-y-auto lg:border-r">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Your palette</div>
          <div className="mb-4 text-sm text-slate-500">Updates live as you choose.</div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            {u.swatches.map((s) => (
              <div key={s.role} className="flex items-center gap-3 px-4 py-3 transition-colors duration-300" style={{ background: s.hex, color: s.text }}>
                <span className="text-sm font-bold">{s.label}</span>
                <span className="ml-auto font-mono text-[11px] opacity-80">{s.hex.toUpperCase()}</span>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-[11px] font-semibold text-slate-500"><span>60% neutrals</span><span>30% primary</span><span>10% accent</span></div>
            <div className="flex h-3 overflow-hidden rounded-full">
              {u.bars.map((b) => <div key={b.label} style={{ width: `${b.pct}%`, background: b.hex }} className="border border-slate-200" />)}
            </div>
          </div>

          <div className={`mt-5 rounded-2xl border p-4 text-sm ${failing ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <div className="font-bold">{failing ? `${failing} readability ${failing > 1 ? "issues" : "issue"}` : "Readable and accessible"}</div>
            <p className="mt-0.5 text-[13px] text-slate-600">{failing ? "Some text or buttons are hard to read on these colors." : "All text and buttons pass WCAG contrast."}</p>
            {failing > 0 && <button onClick={() => setFix(applyAllA11y(raw).fix)} className="mt-2 rounded-full bg-[#6b4d9a] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#5a3f86]">Fix automatically</button>}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-600">
            <div className="mb-1 font-bold text-slate-900">Current choice</div>
            {schemeInfo.label} harmony on {psy.name.toLowerCase()} ({Math.round(hue)}°). {schemeInfo.feel}
          </div>
        </aside>

        {/* ───── steps ───── */}
        <main className="min-w-0 space-y-6 p-5 sm:p-8 lg:overflow-y-auto">
          <Step n={1} title="Tell us about your site" hint="Optional. Our advisor suggests colors and explains each one.">
            <div className="grid gap-3 md:grid-cols-2">
              <textarea
                value={ask.brief} onChange={(e) => setAsk({ ...ask, brief: e.target.value })} rows={3}
                placeholder="e.g. Family-run bakery in Kochi selling custom cakes to young families"
                aria-label="Describe your business" className={`${inputCls} md:col-span-2`}
              />
              <input value={ask.industry} onChange={(e) => setAsk({ ...ask, industry: e.target.value })} placeholder="Industry (optional)" aria-label="Industry" className={inputCls} />
              <input value={ask.audience} onChange={(e) => setAsk({ ...ask, audience: e.target.value })} placeholder="Who is it for? (optional)" aria-label="Target audience" className={inputCls} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-slate-500">Feeling:</span>
              {MOODS.map((m) => (
                <button key={m} onClick={() => setAsk({ ...ask, mood: ask.mood === m ? "" : m })} aria-pressed={ask.mood === m} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${ask.mood === m ? "border-[#6b4d9a] bg-[#6b4d9a] text-white" : "border-slate-200 text-slate-600 hover:border-[#6b4d9a] hover:text-[#6b4d9a]"}`}>{m}</button>
              ))}
              <button onClick={getAdvice} disabled={thinking} className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-[#ff5b7f] px-6 text-sm font-bold text-white shadow-[0_6px_18px_rgba(255,91,127,0.35)] transition hover:brightness-105 disabled:opacity-60">
                <Sparkles className="h-4 w-4" /> {thinking ? "Thinking…" : "Suggest colors"}
              </button>
            </div>

            {advice && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <p className="mb-4 text-sm text-slate-600">
                  <span className="mr-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">{advice.provider.startsWith("rule") ? "Color-theory rules" : `AI · ${advice.provider}`}</span>
                  {advice.summary}
                </p>
                <div className="grid gap-4 xl:grid-cols-3">
                  {advice.options.map((o, i) => {
                    const pal = usage(specFor(base, o.hue, o.sat, o.scheme, o.mode));
                    const active = o.hue === hue && o.scheme === scheme && o.sat === sat && o.mode === mode;
                    return (
                      <article key={i} className={`flex flex-col overflow-hidden rounded-2xl border bg-white ${active ? "border-[#6b4d9a] ring-4 ring-[#6b4d9a]/10" : "border-slate-200"}`}>
                        <div className="flex h-14">{pal.swatches.map((s) => <div key={s.role} className="flex-1" style={{ background: s.hex }} title={`${s.label} ${s.hex}`} />)}</div>
                        <div className="flex flex-1 flex-col gap-2.5 p-4 text-[13px] leading-relaxed text-slate-600">
                          <b className="text-[15px] text-slate-900">{i === 0 ? "Best match: " : ""}{o.name}</b>
                          <p className="text-slate-700">{o.justification}</p>
                          <dl className="space-y-1.5 text-[12px]">
                            <div><dt className="inline font-bold text-slate-900">Feels like: </dt><dd className="inline">{o.psychology}</dd></div>
                            <div><dt className="inline font-bold text-slate-900">Your audience: </dt><dd className="inline">{o.audience_fit}</dd></div>
                            <div><dt className="inline font-bold text-amber-700">Keep in mind: </dt><dd className="inline">{o.caution}</dd></div>
                          </dl>
                          <button onClick={() => useAdvice(o)} className={`mt-auto rounded-full py-2 text-sm font-bold transition ${active ? "bg-emerald-50 text-emerald-700" : "bg-[#6b4d9a] text-white hover:bg-[#5a3f86]"}`}>{active ? "In use" : "Use this palette"}</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </Step>

          <Step n={2} title="Pick your main color" hint="Drag on the wheel, choose a quick color, or enter your own.">
            <div className="grid items-center gap-8 md:grid-cols-[260px_1fr]">
              <Wheel hue={hue} scheme={scheme} onHue={setHue} />
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Quick colors</div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK.map((q) => (
                      <button key={q.name} onClick={() => setHue(q.h)} aria-label={q.name} title={q.name} className={`h-9 w-9 rounded-full border-4 transition hover:scale-110 ${Math.abs(hue - q.h) < 8 ? "border-slate-900" : "border-white shadow-md"}`} style={{ background: hsl(q.h, 80, 50) }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color" value={baseHex} aria-label="Pick a custom color"
                    onChange={(e) => { const [h, s] = hexToHsl(e.target.value); setHue(Math.round(h)); setSat(Math.round(Math.max(20, s))); }}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                  />
                  <div className="text-sm"><div className="font-mono font-bold">{baseHex.toUpperCase()}</div><div className="text-xs text-slate-500">Your custom color</div></div>
                </div>
                <label className="block">
                  <span className="mb-1.5 flex justify-between text-xs font-semibold text-slate-600">How vivid?<span className="font-mono">{sat}</span></span>
                  <input type="range" min={15} max={100} value={sat} onChange={(e) => setSat(Number(e.target.value))} className="w-full accent-[#6b4d9a]" aria-label="Saturation" />
                  <span className="mt-0.5 flex justify-between text-[11px] text-slate-400"><span>Soft</span><span>Vivid</span></span>
                </label>
                <div className="rounded-2xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-600">
                  <b className="text-slate-900">{psy.name}:</b> {psy.meaning}
                </div>
              </div>
            </div>
          </Step>

          <Step n={3} title="Choose how colors work together" hint="Each option shows a live preview. The tagged one suits your style best.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {SCHEMES.map((s) => {
                const sp = specFor(base, hue, sat, s.id, mode);
                const hs = harmonyHues(hue, s.id);
                const on = scheme === s.id;
                return (
                  <button
                    key={s.id} onClick={() => setScheme(s.id)} aria-pressed={on}
                    className={`overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-1 hover:shadow-lg ${on ? "border-[#6b4d9a] ring-4 ring-[#6b4d9a]/15" : "border-slate-200"}`}
                  >
                    <div className="relative h-32 overflow-hidden border-b border-slate-100">
                      <MiniSite spec={sp} />
                      {on && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#6b4d9a] text-white"><Check className="h-3.5 w-3.5" /></span>}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-sm text-slate-900">{s.label}</b>
                        {s.id === suggested && <span className="rounded-full bg-[#ff5b7f]/10 px-2 py-0.5 text-[10px] font-bold text-[#e0405f]">Best for your style</span>}
                      </div>
                      <div className="my-2.5 flex gap-1">{hs.map((h, i) => <span key={i} className="h-4 flex-1 rounded" style={{ background: wheelColor(h) }} />)}</div>
                      <p className="text-[12px] leading-snug text-slate-600">{s.feel}</p>
                      <p className="mt-1 text-[11.5px] text-slate-400">Good for: {s.bestFor}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={4} title="Check and preview" hint="Make sure text is readable, then see it on a real page.">
            <div className="mb-6 grid gap-2 md:grid-cols-2">
              {rows.map((r) => (
                <div key={r.label} className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] ${r.ok ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"}`}>
                  <span className="rounded-md px-2.5 py-1 text-xs font-extrabold" style={{ background: r.bg, color: r.fg, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }}>Aa</span>
                  <span className="flex-1 text-slate-700">{r.label}</span>
                  <span className="font-mono text-xs text-slate-500">{r.ratio.toFixed(1)}:1</span>
                  <span className={`text-[11px] font-bold ${r.ok ? "text-emerald-600" : "text-amber-700"}`}>{r.ok ? "Good" : `Needs ${r.min}`}</span>
                </div>
              ))}
            </div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live preview</span>
              <Seg label="Preview page" value={page} onChange={setPage} options={[{ v: "landing", l: "Landing page" }, { v: "components", l: "Components" }]} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
              <ScaledFrame width={1100} maxHeight={560}>
                <PreviewSite spec={spec} mode={mode} page={page} />
              </ScaledFrame>
            </div>
          </Step>

          <div className="flex justify-end pb-6">
            <button onClick={apply} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#6b4d9a] px-8 text-sm font-bold text-white shadow-[0_8px_24px_rgba(107,77,154,0.4)] transition hover:bg-[#5a3f86]">
              <Check className="h-4 w-4" /> Apply this palette to my project
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
