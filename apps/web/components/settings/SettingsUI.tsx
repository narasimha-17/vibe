"use client";

import { useCallback, useEffect, useState } from "react";

export function Card({
  title,
  description,
  danger = false,
  action,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`card-surface mb-6 p-6 sm:p-7 ${danger ? "!border-red-300" : ""}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-lg font-semibold ${danger ? "text-red-600" : "text-main"}`}>{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const TONES = {
  green: "bg-emerald-100 text-emerald-700",
  gray: "bg-border text-muted",
  purple: "bg-primary/15 text-primary",
  pink: "bg-accent/15 text-accent",
  amber: "bg-amber-100 text-amber-700",
} as const;

export function Pill({ tone = "gray", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONES[tone]}`}>{children}</span>;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div>
        <div className="text-sm font-medium text-main">{label}</div>
        {description && <div className="text-xs text-muted">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border-light"}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-field">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Avatar({ name, url, size = 56 }: { name: string; url?: string | null; size?: number }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size }} className="rounded-full object-cover" />;
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff5b7f] via-[#a45bb8] to-[#5f4d88] font-bold text-white"
    >
      {initials}
    </span>
  );
}

/** Preference stored in this browser (no backend yet). */
export function useLocalPref<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue({ ...(fallback as object), ...JSON.parse(raw) } as T);
    } catch {
      /* ignore corrupt values */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setValue((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage may be unavailable */
        }
        return next;
      });
    },
    [key]
  );

  return [value, update] as const;
}
