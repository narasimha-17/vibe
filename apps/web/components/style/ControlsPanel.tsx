"use client";

import { useState } from "react";
import { FONT_GROUPS } from "@/lib/style/fonts";
import { LOCK_KEYS } from "@/lib/style/types";
import type { LockKey, StyleSpec, StyleTokens } from "@/lib/style/types";
import { Field, LockButton, PanelTitle, Range, Seg, Toggle } from "./ui";

const GROUPS: { k: LockKey; l: string }[] = [
  { k: "color", l: "Color" },
  { k: "typography", l: "Type" },
  { k: "layout", l: "Layout" },
  { k: "shape", l: "Shape" },
  { k: "shadow", l: "Shadows" },
  { k: "motion", l: "Motion" },
  { k: "components", l: "Components" },
  { k: "imagery", l: "Imagery" },
];

function FontSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#241a3a] px-3 py-2 text-[12px] text-white outline-none focus:border-[#ff5b7f]" style={{ fontFamily: `'${value}', sans-serif` }}>
        {Object.entries(FONT_GROUPS).map(([g, fonts]) => (
          <optgroup key={g} label={g}>
            {fonts.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}

export function ControlsPanel({
  spec, tokens, update, toggleLock,
}: { spec: StyleSpec; tokens: StyleTokens; update: (p: Partial<StyleSpec>) => void; toggleLock: (k: LockKey) => void }) {
  const [g, setG] = useState<LockKey>("color");
  const pal = tokens.colors[spec.mode];
  const hueTrack = "linear-gradient(90deg,#f43,#fa3,#ee3,#4d4,#3dd,#48f,#94f,#f4c,#f43)";

  return (
    <div>
      <div role="tablist" aria-label="Control groups" className="mb-5 grid grid-cols-4 gap-1">
        {GROUPS.map((x) => (
          <button
            key={x.k} role="tab" aria-selected={g === x.k} onClick={() => setG(x.k)}
            className={`relative rounded-lg px-1 py-2 text-[11px] font-bold transition ${g === x.k ? "bg-white/12 text-white" : "text-[#8b83b5] hover:text-white"}`}
          >
            {x.l}
            {spec.locks[x.k] && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#ff5b7f]" />}
          </button>
        ))}
      </div>

      <PanelTitle right={<LockButton spec={spec} k={g} onToggle={toggleLock} />}>{LOCK_KEYS.find((l) => l.key === g)?.label}</PanelTitle>

      <div className="space-y-4">
        {g === "color" && (
          <>
            <Seg label="Mode" value={spec.mode} onChange={(v) => update({ mode: v })} options={[{ v: "light", l: "Light" }, { v: "dark", l: "Dark" }]} />
            <Range label="Primary hue" value={Math.round(spec.hue)} min={0} max={360} onChange={(v) => update({ hue: v, neutral: false })} suffix="°" track={hueTrack} />
            <Range label="Saturation" value={Math.round(spec.sat)} min={0} max={100} onChange={(v) => update({ sat: v })} />
            <Range label="Accent hue" value={Math.round(spec.accentHue)} min={0} max={360} onChange={(v) => update({ accentHue: v })} suffix="°" track={hueTrack} />
            <Range label="Background tint hue" value={Math.round(spec.bgHue)} min={0} max={360} onChange={(v) => update({ bgHue: v })} suffix="°" track={hueTrack} />
            <Range label="Background tint amount" value={Math.round(spec.bgSat)} min={0} max={100} onChange={(v) => update({ bgSat: v })} />
            <Toggle label="Neutral “ink” primary" on={spec.neutral} onChange={(v) => update({ neutral: v })} />
            <Toggle label="Gradient accents" on={spec.gradient} onChange={(v) => update({ gradient: v })} />
            <div>
              <div className="mb-2 text-[11px] font-semibold text-[#b9adda]">Semantic roles · {spec.mode}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["primary", "onPrimary", "primaryContainer", "secondary", "accent", "background", "surface", "surfaceVariant", "onBackground", "muted", "outline", "success", "warning", "error"] as const).map((r) => (
                  <div key={r} className="overflow-hidden rounded-lg border border-white/10" title={`${r} ${pal[r]}`}>
                    <div className="h-7" style={{ background: pal[r] }} />
                    <div className="truncate bg-black/25 px-1.5 py-1 text-[9px] text-[#b9adda]">{r}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {g === "typography" && (
          <>
            <FontSelect label="Heading font" value={spec.heading} onChange={(v) => update({ heading: v })} />
            <FontSelect label="Body font" value={spec.body} onChange={(v) => update({ body: v })} />
            <FontSelect label="Mono font" value={spec.mono} onChange={(v) => update({ mono: v })} />
            <Field label="Heading weight">
              <Seg value={spec.headingWeight} onChange={(v) => update({ headingWeight: v })} options={[400, 500, 600, 700, 800].map((w) => ({ v: w, l: String(w) }))} />
            </Field>
            <Range label="Type scale ratio" value={spec.scaleRatio} min={1.125} max={1.414} step={0.011} onChange={(v) => update({ scaleRatio: +v.toFixed(3) })} />
            <Range label="Base size" value={spec.baseSize} min={14} max={20} onChange={(v) => update({ baseSize: v })} suffix="px" />
            <Range label="Body line height" value={spec.lineHeight} min={1.3} max={1.9} step={0.05} onChange={(v) => update({ lineHeight: +v.toFixed(2) })} />
            <Range label="Heading letter-spacing" value={spec.tracking} min={-0.07} max={0.1} step={0.005} onChange={(v) => update({ tracking: +v.toFixed(3) })} suffix="em" />
            <Toggle label="Uppercase headings" on={spec.upper} onChange={(v) => update({ upper: v })} />
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              {(["4xl", "3xl", "xl", "base", "sm"] as const).map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1 last:border-0">
                  <span className="truncate text-white" style={{ fontFamily: k === "base" || k === "sm" ? tokens.typography.body : tokens.typography.heading, fontSize: Math.min(tokens.typography.sizes[k], 34), fontWeight: k === "base" || k === "sm" ? 400 : spec.headingWeight }}>
                    {k === "base" ? "Body text sample" : k === "sm" ? "Small caption" : "Heading"}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-[#8b83b5]">{k} · {tokens.typography.sizes[k]}px</span>
                </div>
              ))}
            </div>
          </>
        )}

        {g === "layout" && (
          <>
            <Range label="Density (airy → compact)" value={spec.density} min={0} max={100} onChange={(v) => update({ density: v })} />
            <Field label="Container width">
              <Seg value={spec.container} onChange={(v) => update({ container: v })} options={[{ v: 960, l: "960" }, { v: 1120, l: "1120" }, { v: 1200, l: "1200" }, { v: 1280, l: "1280" }]} />
            </Field>
            <Field label="Hero layout">
              <Seg value={spec.hero} onChange={(v) => update({ hero: v })} options={(["split", "centered", "editorial", "stack"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <Field label="Navigation">
              <Seg value={spec.nav} onChange={(v) => update({ nav: v })} options={(["bar", "floating", "glass", "minimal", "brutal"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <Field label="Grid personality">
              <Seg value={spec.grid} onChange={(v) => update({ grid: v })} options={(["even", "bento", "ruled"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-[#b9adda]">
              Spacing scale (px): <span className="font-mono text-white">{tokens.spacing.join(" · ")}</span>
              <br />Section spacing: <span className="font-mono text-white">{tokens.sectionY}px</span>
            </div>
          </>
        )}

        {g === "shape" && (
          <>
            <Range label="Base corner radius" value={spec.radius} min={0} max={32} onChange={(v) => update({ radius: v })} suffix="px" />
            <Field label="Borders">
              <Seg value={spec.border} onChange={(v) => update({ border: v })} options={(["none", "thin", "thick"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
              {(["sm", "md", "lg", "xl"] as const).map((k) => (
                <div key={k} className="flex-1 text-center">
                  <div className="mx-auto h-12 w-full border border-[#b79be6] bg-[#b79be6]/20" style={{ borderRadius: tokens.radius[k] }} />
                  <div className="mt-1 font-mono text-[9px] text-[#8b83b5]">{k} {tokens.radius[k]}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {g === "shadow" && (
          <>
            <Field label="Shadow style">
              <Seg value={spec.shadow} onChange={(v) => update({ shadow: v })} options={(["none", "soft", "crisp", "layered", "hard", "glow"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <Toggle label="Glass / frosted surfaces" on={spec.glass} onChange={(v) => update({ glass: v })} />
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#e9e4f5] p-4">
              {tokens.shadows.map((s, i) => (
                <div key={i} className="grid h-14 place-items-center rounded-lg bg-white text-[10px] font-bold text-[#3b2d5a]" style={{ boxShadow: s }}>L{i + 1}</div>
              ))}
            </div>
          </>
        )}

        {g === "motion" && (
          <>
            <Field label="Animation intensity">
              <Seg value={spec.motion} onChange={(v) => update({ motion: v })} options={(["none", "subtle", "lively", "kinetic"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-[#b9adda]">
              {tokens.motion.description}
              <div className="mt-2 font-mono text-[10px] text-white">{tokens.motion.duration}ms · {tokens.motion.easing}</div>
              <div className="font-mono text-[10px] text-[#ff8fb1]">hover: {tokens.hover}</div>
              <div className="font-mono text-[10px] text-[#8b83b5]">focus: 2px gap + 2px ring</div>
            </div>
            <button
              className="w-full rounded-xl border border-white/10 py-6 text-[12px] font-bold text-white"
              style={{ transition: `transform ${tokens.motion.duration}ms ${tokens.motion.easing}`, background: "linear-gradient(135deg,#6b4d9a55,#ff5b7f33)" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = `translateY(${tokens.motion.hoverLift}px) scale(${tokens.motion.hoverScale})`)}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
            >
              Hover to feel this motion
            </button>
          </>
        )}

        {g === "components" && (
          <>
            <Field label="Button style">
              <Seg value={spec.button} onChange={(v) => update({ button: v })} options={(["solid", "pill", "outline", "gradient", "tonal", "brutal"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <Field label="Card style">
              <Seg value={spec.card} onChange={(v) => update({ card: v })} options={(["flat", "elevated", "outlined", "soft", "glass", "brutal"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-[10.5px] text-[#b9adda]">
              <div><span className="text-[#ff8fb1]">button</span> {tokens.components.button}</div>
              <div><span className="text-[#ff8fb1]">card</span> {tokens.components.card}</div>
              <div><span className="text-[#ff8fb1]">input</span> {tokens.components.input}</div>
              <div><span className="text-[#ff8fb1]">nav</span> {tokens.components.nav}</div>
              <div><span className="text-[#ff8fb1]">hero</span> {tokens.components.hero}</div>
            </div>
          </>
        )}

        {g === "imagery" && (
          <>
            <Field label="Image treatment">
              <Seg value={spec.imagery} onChange={(v) => update({ imagery: v })} options={(["photo", "duotone", "illustration", "grain", "geometric"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <Field label="Icon treatment">
              <Seg value={spec.icon} onChange={(v) => update({ icon: v })} options={(["line", "solid", "duotone"] as const).map((v) => ({ v, l: v }))} />
            </Field>
            <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-snug text-[#b9adda]">
              <div><b className="text-white">Images:</b> {tokens.imagery.treatment}</div>
              <div><b className="text-white">Illustration:</b> {tokens.imagery.illustration}</div>
              <div><b className="text-white">Icons:</b> {tokens.imagery.icon}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
