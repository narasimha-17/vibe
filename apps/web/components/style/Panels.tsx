"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { a11ySummary, applyAllA11y, applyA11yFix, checkA11y } from "@/lib/style/a11y";
import type { A11yItem } from "@/lib/style/a11y";
import { originality } from "@/lib/style/engine";
import { toComponentCss, toCss, toFontImport, toJson, toTailwind } from "@/lib/style/export";
import { REF_BY_ID, REFERENCES } from "@/lib/style/refs";
import type { StyleSpec, StyleTokens } from "@/lib/style/types";
import { PanelTitle } from "./ui";
import { toast } from "@/lib/toast";

/* ───────────── Accessibility ───────────── */
const TONE = { pass: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25", warn: "text-amber-200 bg-amber-400/10 border-amber-400/25", fail: "text-rose-200 bg-rose-400/10 border-rose-400/30" };

export function A11yPanel({ spec, tokens, onChange }: { spec: StyleSpec; tokens: StyleTokens; onChange: (s: StyleSpec) => void }) {
  const items = useMemo(() => checkA11y(spec, tokens), [spec, tokens]);
  const sum = a11ySummary(items);
  const [showPass, setShowPass] = useState(false);
  const groups = ["Contrast", "Readability", "Interaction", "Color use"] as const;
  return (
    <div>
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#ff5b7f ${sum.score * 3.6}deg, rgba(255,255,255,.1) 0)` }}>
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#1b1530] text-sm font-extrabold text-white">{sum.score}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">Accessibility score</div>
          <div className="text-[11px] text-[#b9adda]">{sum.fail} failing · {sum.warn} warnings · {sum.pass} passing</div>
          {(sum.fail > 0 || sum.warn > 0) && (
            <button onClick={() => onChange(applyAllA11y(spec, tokens))} className="mt-2 rounded-full bg-gradient-to-r from-[#ff5b7f] to-[#b79be6] px-3 py-1 text-[11px] font-bold text-white">Auto-fix all</button>
          )}
        </div>
      </div>
      <label className="mb-4 flex items-center gap-2 text-[11px] text-[#b9adda]">
        <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} /> Show passing checks
      </label>
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g && (showPass || i.status !== "pass"));
        if (!list.length) return null;
        return (
          <div key={g} className="mb-5">
            <PanelTitle>{g}</PanelTitle>
            <ul className="space-y-2">
              {list.map((i) => <A11yRow key={i.id} item={i} onFix={() => onChange(applyA11yFix(spec, i))} />)}
            </ul>
          </div>
        );
      })}
      {items.every((i) => i.status === "pass") && <p className="text-[12px] text-emerald-300">✓ Every check passes for both light and dark variants.</p>}
    </div>
  );
}

function A11yRow({ item, onFix }: { item: A11yItem; onFix: () => void }) {
  return (
    <li className={`rounded-xl border p-3 ${TONE[item.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-white">{item.label}</div>
          <div className="text-[11px] opacity-80">{item.detail}</div>
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase">{item.status}</span>
      </div>
      {item.fg && item.bg && (
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: item.bg, color: item.fg }}>Aa sample</span>
          {item.fix && (
            <>
              <span className="text-[10px] opacity-70">→</span>
              <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: item.bg, color: item.fix.to }}>Aa accessible</span>
            </>
          )}
        </div>
      )}
      {(item.fix || item.patch) && item.status !== "pass" && (
        <button onClick={onFix} className="mt-2 rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-white/20">Use accessible alternative</button>
      )}
    </li>
  );
}

/* ───────────── Code preview ───────────── */
type CodeTab = "css" | "tailwind" | "fonts" | "components" | "json";

export function CodePanel({ spec, tokens }: { spec: StyleSpec; tokens: StyleTokens }) {
  const [tab, setTab] = useState<CodeTab>("css");
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => ({
    css: toCss(spec, tokens),
    tailwind: toTailwind(spec, tokens),
    fonts: toFontImport(spec),
    components: toComponentCss(spec),
    json: toJson(spec, tokens),
  }), [spec, tokens]);
  const text = code[tab];

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast("Couldn't access the clipboard.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div role="tablist" className="flex flex-wrap gap-1">
          {([["css", "CSS vars"], ["tailwind", "Tailwind"], ["fonts", "Fonts"], ["components", "Components"], ["json", "Theme JSON"]] as [CodeTab, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${tab === k ? "bg-white/12 text-white" : "text-[#8b83b5] hover:text-white"}`}>{l}</button>
          ))}
        </div>
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/10">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-[#0e0a1a] p-3 font-mono text-[10.5px] leading-relaxed text-[#d9d0f2]">{text}</pre>
    </div>
  );
}

/* ───────────── Reference sources ───────────── */
export function RefsPanel({ spec }: { spec: StyleSpec }) {
  const orig = originality(spec);
  const refs = spec.refs.map((id) => REF_BY_ID[id]).filter(Boolean);
  return (
    <div className="space-y-6">
      <div>
        <PanelTitle>Influences on “{spec.name}”</PanelTitle>
        <ul className="space-y-2.5">
          {refs.map((r) => (
            <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-[#ff8fb1] underline-offset-2 hover:underline">{r.title}</a>
              <span className="ml-2 text-[10px] text-[#8b83b5]">{r.publisher}</span>
              <p className="mt-1 text-[11px] leading-snug text-[#b9adda]"><b className="text-white">Principle studied:</b> {r.principle}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-[#b79be6]/30 bg-[#b79be6]/[0.07] p-4 text-[11px] leading-relaxed text-[#d9d0f2]">
        <PanelTitle>Inspiration ≠ copying</PanelTitle>
        <p>VIBE studies <b>principles</b> (type ratios, semantic color roles, spacing rhythms, layout structure) from public design resources. It never reproduces a website, logo, illustration, brand color set or proprietary asset.</p>
        <p className="mt-2">Each style is synthesised as a new combination of hue, type pair, geometry, depth and motion. Nearest bundled style: <b>{orig.closest}</b> at {orig.similarity}% similarity — {orig.original ? "an original blend." : "consider remixing to diverge further."}</p>
        <p className="mt-2 text-[#8b83b5]">Fonts are open-licensed Google Fonts. Always check licences for any imagery you add.</p>
      </div>
      <div>
        <PanelTitle>All public sources</PanelTitle>
        <ul className="space-y-1.5">
          {REFERENCES.map((r) => (
            <li key={r.id} className="text-[11px]">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[#b79be6] hover:text-white hover:underline">{r.title}</a>
              <span className="text-[#6b638f]"> — {r.publisher}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
