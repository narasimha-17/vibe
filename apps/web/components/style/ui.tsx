"use client";

import { Lock, Unlock } from "lucide-react";
import type { LockKey, StyleSpec } from "@/lib/style/types";

export function Seg<T extends string | number>({
  value, options, onChange, label,
}: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition ${
            value === o.v ? "bg-gradient-to-r from-[#ff5b7f] to-[#b79be6] text-white shadow-[0_0_14px_rgba(255,91,127,0.35)]" : "text-[#b9adda] hover:bg-white/10 hover:text-white"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Range({
  label, value, min, max, step = 1, onChange, suffix = "", track,
}: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string; track?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[#b9adda]">
        {label}
        <span className="font-mono text-[11px] text-white/80">{Number.isInteger(value) ? value : value.toFixed(2)}{suffix}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="studio-range w-full"
        style={track ? ({ background: track } as React.CSSProperties) : undefined}
        aria-label={label}
      />
    </label>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[12px] font-semibold text-[#d9d0f2] transition hover:bg-white/[0.07]">
      {label}
      <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-[#ff5b7f]" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold text-[#b9adda]">{label}</div>
      {children}
    </div>
  );
}

export function LockButton({ spec, k, onToggle }: { spec: StyleSpec; k: LockKey; onToggle: (k: LockKey) => void }) {
  const on = !!spec.locks[k];
  return (
    <button
      onClick={() => onToggle(k)}
      aria-pressed={on}
      title={on ? "Locked — remix, randomize, AI and presets won't change this" : "Lock this property group"}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
        on ? "border-[#ff5b7f]/60 bg-[#ff5b7f]/15 text-[#ff8fb1]" : "border-white/10 text-[#8b83b5] hover:text-white"
      }`}
    >
      {on ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
      {on ? "Locked" : "Lock"}
    </button>
  );
}

export function PanelTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff8fb1]">{children}</h3>
      {right}
    </div>
  );
}
