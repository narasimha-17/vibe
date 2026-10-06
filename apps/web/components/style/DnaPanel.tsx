"use client";

import { Dices, Shuffle, Sparkles, Wand2 } from "lucide-react";
import { originality, styleDna } from "@/lib/style/engine";
import type { Suggestion } from "@/lib/style/a11y";
import { AXES } from "@/lib/style/types";
import type { Axes, StyleSpec, StyleTokens } from "@/lib/style/types";
import { PanelTitle } from "./ui";

export function DnaPanel({
  spec, tokens, onAxis, onRemix, onRandomize, onImprove, suggestions, onApplySuggestion, onApplyAll,
}: {
  spec: StyleSpec;
  tokens: StyleTokens;
  onAxis: (k: keyof Axes, v: number) => void;
  onRemix: () => void;
  onRandomize: () => void;
  onImprove: () => void;
  suggestions: Suggestion[] | null;
  onApplySuggestion: (s: Suggestion) => void;
  onApplyAll: () => void;
}) {
  const dna = styleDna(spec, tokens);
  const orig = originality(spec);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Remix", i: Shuffle, on: onRemix },
          { l: "Randomize", i: Dices, on: onRandomize },
          { l: "AI Improve", i: Wand2, on: onImprove },
        ].map(({ l, i: Icon, on }) => (
          <button key={l} onClick={on} className="group flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 text-[11px] font-bold text-[#d9d0f2] transition hover:-translate-y-0.5 hover:border-[#ff5b7f]/60 hover:bg-[#ff5b7f]/10 hover:text-white">
            <Icon className="h-4 w-4 text-[#ff8fb1] transition group-hover:rotate-12" />
            {l}
          </button>
        ))}
      </div>

      {suggestions && (
        <div className="rounded-2xl border border-[#b79be6]/30 bg-[#b79be6]/[0.07] p-4">
          <PanelTitle
            right={
              suggestions.length > 0 && (
                <button onClick={onApplyAll} className="rounded-full bg-[#ff5b7f] px-3 py-1 text-[10px] font-bold text-white hover:brightness-110">Apply all</button>
              )
            }
          >
            AI Improve
          </PanelTitle>
          {suggestions.length === 0 ? (
            <p className="text-[12px] text-[#d9d0f2]">✓ Hierarchy, accessibility and consistency look healthy. No changes suggested.</p>
          ) : (
            <ul className="space-y-2.5">
              {suggestions.map((s) => (
                <li key={s.id} className="rounded-xl bg-black/20 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff8fb1]">{s.category}</span>
                    <button onClick={() => onApplySuggestion(s)} className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-white/10">Apply</button>
                  </div>
                  <div className="text-[12px] font-semibold text-white">{s.title}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[#b9adda]">{s.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <PanelTitle>Style DNA</PanelTitle>
        <div className="space-y-2.5">
          {dna.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[11px]">
                <span className="font-semibold text-[#8b83b5]">{d.label}</span>
                <span className="truncate text-right text-[#e9e2fb]" title={d.value}>{d.value}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#b79be6] to-[#ff5b7f] transition-all duration-500" style={{ width: `${Math.max(6, d.score)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className={`mt-4 rounded-xl border px-3 py-2.5 text-[11px] leading-snug ${orig.original ? "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200" : "border-amber-400/30 bg-amber-400/[0.07] text-amber-200"}`}>
          <b>{orig.original ? "Original combination ✓" : "Close to an existing style"}</b> — nearest bundled style is {orig.closest} ({orig.similarity}% similar). Fingerprint <span className="font-mono">{orig.fingerprint}</span>.
        </div>
      </div>

      <div>
        <PanelTitle>Personality sliders</PanelTitle>
        <div className="space-y-4">
          {AXES.map((a) => (
            <div key={a.key}>
              <div className="mb-1 flex justify-between text-[11px] font-semibold text-[#b9adda]">
                <span className={spec.axes[a.key] < 40 ? "text-white" : ""}>{a.left}</span>
                <span className={spec.axes[a.key] > 60 ? "text-white" : ""}>{a.right}</span>
              </div>
              <input
                type="range" min={0} max={100} value={Math.round(spec.axes[a.key])}
                onChange={(e) => onAxis(a.key, Number(e.target.value))}
                className="studio-range w-full" aria-label={`${a.left} to ${a.right}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GeneratedCoverage({ items, done }: { items: string[]; done: boolean }) {
  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
      <PanelTitle>{done ? "Design system applied" : "Generating…"}</PanelTitle>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {items.map((c, i) => (
          <li key={c} className="flex items-center gap-1.5 text-[11px] text-[#d9f7e8]" style={{ animation: `fade-in .4s ease-out ${i * 60}ms both` }}>
            <Sparkles className="h-3 w-3 text-emerald-300" /> {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
