import { buildPalette, contrast, hsl } from "./engine";
import type { Mode, Palette, StyleSpec } from "./types";

export type SchemeId = "complementary" | "analogous" | "triadic" | "split" | "tetradic" | "mono";

export interface Scheme {
  id: SchemeId;
  label: string;
  /** Hue offsets from the base color, in degrees on the HSL wheel. */
  offsets: number[];
  rule: string;
  feel: string;
  bestFor: string;
}

export const SCHEMES: Scheme[] = [
  { id: "complementary", label: "Complementary", offsets: [180], rule: "Base + the hue directly opposite (180°).", feel: "High energy, maximum contrast.", bestFor: "Bold CTAs, sports, launches, sales." },
  { id: "analogous", label: "Analogous", offsets: [-30, 30], rule: "Base + its two neighbours (±30°).", feel: "Calm, harmonious, cohesive.", bestFor: "Wellness, blogs, portfolios, nature." },
  { id: "triadic", label: "Triadic", offsets: [120, 240], rule: "Three hues evenly spaced (120°).", feel: "Vibrant yet balanced, playful.", bestFor: "Creative tools, kids, education, apps." },
  { id: "split", label: "Split-complementary", offsets: [150, 210], rule: "Base + the two hues beside its complement (150° / 210°).", feel: "Contrast without the tension of pure complements.", bestFor: "SaaS, marketing sites, dashboards." },
  { id: "tetradic", label: "Tetradic (square)", offsets: [90, 180, 270], rule: "Four hues evenly spaced (90°).", feel: "Rich and varied; needs one dominant color.", bestFor: "Editorial, brands with many product lines." },
  { id: "mono", label: "Monochromatic", offsets: [0], rule: "One hue in different tints, tones and shades.", feel: "Elegant, minimal, unmistakably one brand.", bestFor: "Luxury, fintech, docs, enterprise." },
];

export const SCHEME_BY_ID = Object.fromEntries(SCHEMES.map((s) => [s.id, s])) as Record<SchemeId, Scheme>;

const wrap = (h: number) => ((h % 360) + 360) % 360;

/** Hues that make up a scheme, base first. */
export function harmonyHues(hue: number, scheme: SchemeId): number[] {
  const s = SCHEME_BY_ID[scheme];
  return [wrap(hue), ...s.offsets.map((o) => wrap(hue + o))];
}

/** Picks which harmony hues become the secondary and accent roles. */
export function roleHues(hue: number, scheme: SchemeId): { secondary: number; accent: number } {
  const h = harmonyHues(hue, scheme);
  switch (scheme) {
    case "complementary": return { secondary: wrap(hue + 20), accent: h[1] };
    case "analogous": return { secondary: h[1], accent: h[2] };
    case "triadic": return { secondary: h[1], accent: h[2] };
    case "split": return { secondary: wrap(hue + 30), accent: h[1] };
    case "tetradic": return { secondary: h[1], accent: h[2] };
    case "mono": return { secondary: wrap(hue), accent: wrap(hue) };
  }
}

export interface Psychology { name: string; meaning: string }
export function psychology(hue: number): Psychology {
  const h = wrap(hue);
  if (h < 15 || h >= 345) return { name: "Red", meaning: "Energy, urgency, passion. Use sparingly for calls to action." };
  if (h < 45) return { name: "Orange", meaning: "Friendly, enthusiastic, approachable." };
  if (h < 70) return { name: "Yellow", meaning: "Optimism, attention, warmth. Needs dark text for legibility." };
  if (h < 160) return { name: "Green", meaning: "Growth, health, calm, money and sustainability." };
  if (h < 200) return { name: "Teal / cyan", meaning: "Clarity, trust with a fresh, modern edge." };
  if (h < 255) return { name: "Blue", meaning: "Trust, stability, professionalism. The safest brand hue." };
  if (h < 300) return { name: "Purple", meaning: "Creativity, imagination, premium and wisdom." };
  return { name: "Pink / magenta", meaning: "Playful, expressive, modern and caring." };
}

/** Builds a StyleSpec whose palette follows the chosen color-theory scheme. */
export function specFor(base: StyleSpec, hue: number, sat: number, scheme: SchemeId, mode: Mode): StyleSpec {
  const r = roleHues(hue, scheme);
  return {
    ...base,
    hue: wrap(hue),
    sat,
    neutral: false,
    bgHue: wrap(hue), // tint neutrals with the base hue so the 60% area feels related
    bgSat: scheme === "mono" ? 16 : 10,
    secondaryHue: r.secondary,
    accentHue: r.accent,
    scheme,
    gradient: true, // shows the primary-to-accent relationship on hero art and CTAs
    mode,
    fix: { light: {}, dark: {} },
  };
}

export interface Swatch { role: string; label: string; share: string; hex: string; text: string }

/** 60-30-10 usage: neutrals dominate, the primary carries the brand, the accent is used sparingly. */
export function usage(spec: StyleSpec): { pal: Palette; swatches: Swatch[]; bars: { label: string; pct: number; hex: string }[] } {
  const pal = buildPalette(spec, spec.mode);
  const sw = (role: string, label: string, share: string, hex: string, on: string): Swatch => ({ role, label, share, hex, text: on });
  return {
    pal,
    swatches: [
      sw("background", "Background", "60%", pal.background, pal.onBackground),
      sw("surface", "Surface / cards", "60%", pal.surface, pal.onSurface),
      sw("primary", "Primary", "30%", pal.primary, pal.onPrimary),
      sw("secondary", "Secondary", "30%", pal.secondary, pal.onSecondary),
      sw("accent", "Accent", "10%", pal.accent, pal.onAccent),
    ],
    bars: [
      { label: "Neutrals · 60%", pct: 60, hex: pal.background },
      { label: "Primary · 30%", pct: 30, hex: pal.primary },
      { label: "Accent · 10%", pct: 10, hex: pal.accent },
    ],
  };
}

export interface ContrastRow { label: string; ratio: number; min: number; ok: boolean; fg: string; bg: string }
export function contrastRows(pal: Palette): ContrastRow[] {
  const rows: [string, string, string, number][] = [
    ["Body text on background", pal.onBackground, pal.background, 4.5],
    ["Muted text on background", pal.muted, pal.background, 4.5],
    ["Button label on primary", pal.onPrimary, pal.primary, 4.5],
    ["Label on accent", pal.onAccent, pal.accent, 4.5],
    ["Accent as link text", pal.accent, pal.background, 4.5],
    ["Primary vs background (UI)", pal.primary, pal.background, 3],
  ];
  return rows.map(([label, fg, bg, min]) => {
    const ratio = contrast(fg, bg);
    return { label, ratio, min, ok: ratio >= min, fg, bg };
  });
}

/** Colors for the wheel dots (fully saturated, mid-lightness). */
export const wheelColor = (h: number) => hsl(h, 85, 55);
