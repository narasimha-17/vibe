import { FONT_GROUPS, fontKind, fontStack } from "./fonts";
import { PRESETS } from "./presets";
import { LOCK_KEYS } from "./types";
import type { Axes, Mode, Palette, StyleSpec, StyleTokens } from "./types";

/* ───────────────────────── colour math ───────────────────────── */
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (h: number) => ((h % 360) + 360) % 360;

export function hsl(h: number, s: number, l: number) {
  h = wrap(h);
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hx = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${hx(f(0))}${hx(f(8))}${hx(f(4))}`;
}

export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 50];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [wrap(h), s * 100, l * 100];
}

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Nudges the lightness of `fg` (keeping hue/saturation) until it reaches `min` contrast against `bg`. */
export function fixForeground(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return fg;
  const [h, s, l] = hexToHsl(fg);
  let best: string | null = null;
  for (let d = 1; d <= 100; d++) {
    for (const dir of contrast("#ffffff", bg) > contrast("#000000", bg) ? [1, -1] : [-1, 1]) {
      const cand = hsl(h, s, clamp(l + dir * d, 0, 100));
      if (contrast(cand, bg) >= min) {
        best = cand;
        break;
      }
    }
    if (best) break;
  }
  return best || (contrast("#ffffff", bg) > contrast("#000000", bg) ? "#ffffff" : "#000000");
}

const onColor = (bg: string, dark: string) => (contrast("#ffffff", bg) >= contrast(dark, bg) ? "#ffffff" : dark);

/* ───────────────────────── palette (semantic roles) ───────────────────────── */
export function buildPalette(spec: StyleSpec, mode: Mode): Palette {
  const L = mode === "light";
  const sat = clamp(spec.sat, 0, 100);
  const bs = clamp(spec.bgSat, 0, 100);
  const bgL = L ? 99 - bs * 0.075 : 7 + bs * 0.05;
  const bgS = L ? bs : bs * 0.6;
  const background = hsl(spec.bgHue, bgS, bgL);
  const surface = hsl(spec.bgHue, bgS * (L ? 0.55 : 0.85), L ? Math.min(100, bgL + (100 - bgL) * 0.75) : bgL + 5);
  const surfaceVariant = hsl(spec.bgHue, bgS * (L ? 0.9 : 0.8), L ? bgL - 5 : bgL + 11);
  const inkDark = hsl(spec.bgHue, 30, 8);
  const onBackground = L ? hsl(spec.bgHue, 28, 10) : hsl(spec.bgHue, 14, 94);
  const muted = L ? hsl(spec.bgHue, 14, 38) : hsl(spec.bgHue, 10, 70);
  const outline = L ? hsl(spec.bgHue, 16, bgL - 14) : hsl(spec.bgHue, 14, bgL + 20);

  const primary = spec.neutral ? (L ? hsl(spec.hue, 14, 13) : hsl(spec.hue, 8, 94)) : hsl(spec.hue, sat, L ? 42 : 70);
  const primaryContainer = spec.neutral ? (L ? hsl(spec.bgHue, 12, 90) : hsl(spec.bgHue, 10, 22)) : hsl(spec.hue, sat * (L ? 0.8 : 0.55), L ? 92 : 24);
  const secondary = spec.neutral ? (L ? hsl(spec.bgHue, 10, 36) : hsl(spec.bgHue, 8, 74)) : hsl(spec.secondaryHue ?? spec.hue + 40, sat * 0.55, L ? 42 : 76);
  const accent = hsl(spec.accentHue, clamp(Math.max(sat, 55), 0, 100), L ? 46 : 64);

  const pal: Palette = {
    primary,
    onPrimary: onColor(primary, inkDark),
    primaryContainer,
    onPrimaryContainer: L ? hsl(spec.hue, 40, 16) : hsl(spec.hue, 40, 90),
    secondary,
    onSecondary: onColor(secondary, inkDark),
    accent,
    onAccent: onColor(accent, inkDark),
    background,
    onBackground,
    surface,
    surfaceVariant,
    onSurface: onBackground,
    muted,
    outline,
    success: hsl(150, 62, L ? 30 : 58),
    warning: hsl(36, 92, L ? 34 : 60),
    error: hsl(2, 72, L ? 44 : 68),
  };
  return { ...pal, ...(spec.fix?.[mode] || {}) } as Palette;
}

/* ───────────────────────── tokens ───────────────────────── */
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function shadowsFor(spec: StyleSpec, pal: Palette, mode: Mode): [string, string, string] {
  const ink = mode === "light" ? "20,16,40" : "0,0,0";
  const a = mode === "light" ? 1 : 2.2;
  switch (spec.shadow) {
    case "none": return ["none", "none", "none"];
    case "crisp": return [`0 1px 2px rgba(${ink},${0.1 * a})`, `0 2px 8px rgba(${ink},${0.12 * a})`, `0 6px 18px rgba(${ink},${0.16 * a})`];
    case "hard": return [`3px 3px 0 ${pal.onBackground}`, `5px 5px 0 ${pal.onBackground}`, `8px 8px 0 ${pal.onBackground}`];
    case "glow": return [`0 0 0 1px ${rgba(pal.primary, 0.3)}, 0 0 14px ${rgba(pal.primary, 0.25)}`, `0 0 0 1px ${rgba(pal.primary, 0.4)}, 0 0 30px ${rgba(pal.primary, 0.35)}`, `0 0 0 1px ${rgba(pal.primary, 0.5)}, 0 0 60px ${rgba(pal.accent, 0.4)}`];
    case "layered": return [`0 1px 1px rgba(${ink},${0.06 * a}), 0 2px 4px rgba(${ink},${0.06 * a})`, `0 2px 4px rgba(${ink},${0.05 * a}), 0 8px 16px rgba(${ink},${0.07 * a}), 0 16px 32px rgba(${ink},${0.07 * a})`, `0 4px 8px rgba(${ink},${0.05 * a}), 0 16px 32px rgba(${ink},${0.08 * a}), 0 40px 80px rgba(${ink},${0.12 * a})`];
    default: return [`0 1px 2px rgba(${ink},${0.06 * a})`, `0 8px 24px rgba(${ink},${0.09 * a})`, `0 24px 60px rgba(${ink},${0.16 * a})`];
  }
}

const MOTION = {
  none: { duration: 0, easing: "linear", hoverLift: 0, hoverScale: 1, description: "Static — no transitions; instant state changes." },
  subtle: { duration: 180, easing: "cubic-bezier(.2,0,0,1)", hoverLift: -1, hoverScale: 1, description: "Subtle — 180ms standard easing, 1px lift on hover." },
  lively: { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)", hoverLift: -3, hoverScale: 1.015, description: "Lively — 260ms emphasized easing, lift and slight scale." },
  kinetic: { duration: 460, easing: "cubic-bezier(.34,1.56,.64,1)", hoverLift: -6, hoverScale: 1.04, description: "Kinetic — springy 460ms overshoot, strong hover displacement." },
} as const;

export function buildTokens(spec: StyleSpec): StyleTokens {
  const light = buildPalette(spec, "light");
  const dark = buildPalette(spec, "dark");
  const pal = spec.mode === "dark" ? dark : light;
  const r = spec.scaleRatio;
  const px = (n: number) => Math.round(n);
  const base = spec.baseSize;
  const f = lerp(1.35, 0.8, spec.density / 100);
  const unit = 4;
  const spacing = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24].map((m) => px(unit * m * f));
  const b = spec.radius;
  const button = spec.button === "pill" ? 999 : spec.button === "brutal" ? 0 : b;
  const card = spec.card === "brutal" ? 0 : spec.card === "soft" ? px(b * 1.6) : px(b * 1.25);
  const bw = spec.border === "none" ? 0 : spec.border === "thick" ? 3 : 1;
  const m = MOTION[spec.motion];
  const focusColor = contrast(pal.primary, pal.background) >= 3 ? pal.primary : pal.accent;
  const glass = spec.card === "glass" || spec.glass;

  return {
    colors: { light, dark },
    gradients: {
      primary: `linear-gradient(135deg, ${pal.primary}, ${spec.gradient ? pal.accent : pal.secondary})`,
      glow: `radial-gradient(60% 60% at 50% 0%, ${rgba(pal.primary, 0.35)}, transparent)`,
      mesh: `radial-gradient(at 15% 10%, ${rgba(pal.primary, 0.32)}, transparent 45%), radial-gradient(at 85% 0%, ${rgba(pal.accent, 0.28)}, transparent 45%), radial-gradient(at 60% 90%, ${rgba(pal.secondary, 0.25)}, transparent 50%)`,
    },
    typography: {
      heading: fontStack(spec.heading, fontKind(spec.heading)),
      body: fontStack(spec.body, fontKind(spec.body)),
      mono: fontStack(spec.mono, "mono"),
      sizes: {
        xs: px(base * 0.75), sm: px(base * 0.875), base, lg: px(base * r), xl: px(base * r ** 2),
        "2xl": px(base * r ** 3), "3xl": px(base * r ** 4), "4xl": px(base * r ** 5),
      },
      weights: { body: 400, medium: 500, heading: spec.headingWeight },
      lineHeights: { body: spec.lineHeight, heading: spec.upper ? 1.05 : 1.12 },
      tracking: { heading: `${spec.tracking}em`, body: spec.mono === spec.body ? "-0.01em" : "0", label: spec.upper ? "0.12em" : "0.04em" },
      transform: spec.upper ? "uppercase" : "none",
    },
    spacing,
    sectionY: px(96 * f),
    radius: { none: 0, sm: px(b * 0.5), md: b, lg: px(b * 1.5), xl: px(b * 2.2), full: 999, button, card, input: spec.button === "pill" ? Math.min(b, 14) : spec.button === "brutal" ? 0 : b },
    shadows: shadowsFor(spec, pal, spec.mode),
    borderWidth: bw,
    container: { sm: 640, md: 860, lg: spec.container, xl: Math.round(spec.container * 1.14) },
    breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
    motion: { level: spec.motion, ...m },
    focus: `0 0 0 2px ${pal.background}, 0 0 0 4px ${focusColor}`,
    components: {
      button: `${spec.button} · radius ${button === 999 ? "full" : button + "px"} · ${spec.button === "gradient" ? "gradient fill" : spec.button === "outline" ? "outlined" : "filled"}`,
      card: `${spec.card} · radius ${card}px · ${glass ? "backdrop-blur 16px" : spec.shadow + " shadow"} · ${bw}px border`,
      input: `${bw || 1}px outline · radius ${spec.button === "pill" ? Math.min(b, 14) : spec.button === "brutal" ? 0 : b}px · 2px focus ring`,
      nav: `${spec.nav} navigation`,
      hero: `${spec.hero} hero · ${spec.grid} grid`,
      grid: spec.grid,
    },
    imagery: {
      treatment: { photo: "Natural photography with soft rounded masks", duotone: "Duotone-tinted photography in brand colors", illustration: "Flat organic illustration with hand-drawn shapes", grain: "High-contrast imagery with film grain", geometric: "Abstract geometric compositions and gradients" }[spec.imagery],
      filter: { photo: "none", duotone: "grayscale(1) contrast(1.05)", illustration: "saturate(1.15)", grain: "contrast(1.15) saturate(0.9)", geometric: "saturate(1.1)" }[spec.imagery],
      illustration: spec.imagery === "illustration" ? "Organic, layered shapes with rounded terminals" : spec.imagery === "geometric" ? "Circles, grids and gradient orbs" : "Minimal spot illustrations, optional",
      icon: { line: "1.5px line icons", solid: "Filled glyph icons", duotone: "Duotone icons with tinted fill" }[spec.icon],
    },
    hover: spec.motion === "none" ? "Colour change only" : `Lift ${m.hoverLift}px${m.hoverScale > 1 ? `, scale ${m.hoverScale}` : ""}, ${m.duration}ms`,
  };
}

/* ───────────────────────── CSS variables for the live site ───────────────────────── */
export function cssVarsFor(spec: StyleSpec, tokens: StyleTokens, mode: Mode = spec.mode): Record<string, string> {
  const p = tokens.colors[mode];
  const sh = shadowsFor(spec, p, mode);
  const t = tokens.typography;
  const glass = spec.card === "glass" || spec.glass;
  const bgL = hexToHsl(p.background)[2];
  return {
    "--s-bg": p.background, "--s-text": p.onBackground, "--s-surface": p.surface, "--s-surface-2": p.surfaceVariant, "--s-muted": p.muted, "--s-outline": p.outline,
    "--s-primary": p.primary, "--s-on-primary": p.onPrimary, "--s-primary-c": p.primaryContainer, "--s-on-primary-c": p.onPrimaryContainer,
    "--s-secondary": p.secondary, "--s-on-secondary": p.onSecondary, "--s-accent": p.accent, "--s-on-accent": p.onAccent,
    "--s-success": p.success, "--s-warning": p.warning, "--s-error": p.error,
    "--s-grad": tokens.gradients.primary, "--s-mesh": tokens.gradients.mesh, "--s-glow": tokens.gradients.glow,
    "--s-font-h": t.heading, "--s-font-b": t.body, "--s-font-m": t.mono,
    "--s-w-h": String(t.weights.heading), "--s-track-h": t.tracking.heading, "--s-track-l": t.tracking.label, "--s-transform": t.transform,
    "--s-base": `${t.sizes.base}px`, "--s-lh": String(t.lineHeights.body), "--s-lh-h": String(t.lineHeights.heading),
    "--s-fs-sm": `${t.sizes.sm}px`, "--s-fs-lg": `${t.sizes.lg}px`, "--s-fs-h3": `${t.sizes.xl}px`, "--s-fs-h2": `${t.sizes["3xl"]}px`, "--s-fs-h1": `${t.sizes["4xl"]}px`,
    "--s-r-sm": `${tokens.radius.sm}px`, "--s-r-md": `${tokens.radius.md}px`, "--s-r-lg": `${tokens.radius.lg}px`, "--s-r-xl": `${tokens.radius.xl}px`,
    "--s-r-btn": `${tokens.radius.button}px`, "--s-r-card": `${tokens.radius.card}px`, "--s-r-input": `${tokens.radius.input}px`,
    "--s-sp-1": `${tokens.spacing[1]}px`, "--s-sp-2": `${tokens.spacing[2]}px`, "--s-sp-3": `${tokens.spacing[3]}px`, "--s-sp-4": `${tokens.spacing[4]}px`, "--s-sp-5": `${tokens.spacing[5]}px`, "--s-sp-6": `${tokens.spacing[6]}px`,
    "--s-section-y": `${tokens.sectionY}px`, "--s-container": `${tokens.container.lg}px`,
    "--s-shadow-1": sh[0], "--s-shadow-2": sh[1], "--s-shadow-3": sh[2],
    "--s-bw": `${tokens.borderWidth}px`,
    "--s-dur": `${tokens.motion.duration}ms`, "--s-ease": tokens.motion.easing, "--s-lift": `${tokens.motion.hoverLift}px`, "--s-scale": String(tokens.motion.hoverScale),
    "--s-focus": tokens.focus.replace(/#[0-9a-f]{6}/gi, (m) => m),
    "--s-glass-bg": mode === "dark" ? rgba(p.surface, 0.55) : rgba("#ffffff", 0.55),
    "--s-glass-blur": glass ? "16px" : "0px",
    "--s-img-filter": tokens.imagery.filter,
    "--s-hero-fill": spec.gradient || glass ? tokens.gradients.mesh : "none",
    "--s-bg-l": String(Math.round(bgL)),
  };
}

export function siteAttrs(spec: StyleSpec): Record<string, string> {
  return {
    "data-styled": "1",
    "data-nav": spec.nav,
    "data-card": spec.card,
    "data-btn": spec.button,
    "data-hero": spec.hero,
    "data-grid": spec.grid,
    "data-motion": spec.motion,
    "data-img": spec.imagery,
    "data-icon": spec.icon,
    "data-border": spec.border,
    "data-glass": spec.glass || spec.card === "glass" ? "1" : "0",
    "data-upper": spec.upper ? "1" : "0",
    "data-mode": spec.mode,
  };
}

export function fontsOf(spec: StyleSpec) {
  return Array.from(new Set([spec.heading, spec.body, spec.mono]));
}

/* ───────────────────────── Style DNA ───────────────────────── */
export interface DnaItem { key: string; label: string; value: string; score: number }

export function styleDna(spec: StyleSpec, tokens: StyleTokens): DnaItem[] {
  const p = tokens.colors[spec.mode];
  const cr = contrast(p.onBackground, p.background);
  const warm = spec.neutral ? null : spec.hue < 70 || spec.hue > 330;
  const kindH = fontKind(spec.heading);
  const personality =
    spec.axes.experimental > 70 && spec.axes.expressive > 70 ? "Rebellious & loud"
    : spec.mode === "dark" && spec.axes.expressive > 55 ? "Electric & confident"
    : spec.radius > 20 && spec.axes.animated > 40 ? "Friendly & playful"
    : spec.density < 25 ? "Serene & considered"
    : spec.radius <= 4 && spec.axes.creative < 40 ? "Precise & disciplined"
    : kindH === "serif" ? "Literary & refined"
    : spec.axes.creative > 60 ? "Expressive & personal" : "Clear & dependable";
  return [
    { key: "mood", label: "Mood", value: personality.split(" & ")[0] + " · " + (spec.mode === "dark" ? "nocturnal" : "daylight"), score: spec.axes.expressive },
    { key: "density", label: "Density", value: spec.density < 25 ? "Airy" : spec.density < 50 ? "Balanced" : spec.density < 72 ? "Compact" : "Dense", score: spec.density },
    { key: "geometry", label: "Geometry", value: spec.radius <= 2 ? "Orthogonal, hard-edged" : spec.radius < 10 ? "Crisp, lightly rounded" : spec.radius < 20 ? "Rounded" : "Pillowy, soft", score: 100 - clamp(spec.radius * 3.3, 0, 100) },
    { key: "type", label: "Typography", value: `${spec.heading} / ${spec.body} · ${kindH === "serif" ? "serif-led" : kindH === "mono" ? "monospaced" : "sans-led"}`, score: kindH === "serif" ? 75 : kindH === "mono" ? 90 : 40 },
    { key: "temp", label: "Color temperature", value: spec.neutral ? "Neutral ink" : `${warm ? "Warm" : spec.hue > 170 && spec.hue < 265 ? "Cool" : "Balanced"} · ${spec.sat > 75 ? "vivid" : spec.sat > 45 ? "saturated" : "muted"}`, score: spec.neutral ? 50 : warm ? 85 : 20 },
    { key: "contrast", label: "Contrast", value: `${cr >= 12 ? "Very high" : cr >= 7 ? "High" : "Moderate"} (${cr.toFixed(1)}:1)`, score: clamp(cr * 5, 0, 100) },
    { key: "motion", label: "Motion", value: { none: "Static", subtle: "Subtle", lively: "Lively", kinetic: "Kinetic" }[spec.motion], score: { none: 0, subtle: 30, lively: 65, kinetic: 95 }[spec.motion] },
    { key: "personality", label: "Visual personality", value: personality, score: (spec.axes.creative + spec.axes.experimental) / 2 },
  ];
}

/* ───────────────────────── axes ───────────────────────── */
const CREATIVE_FONTS = ["Bricolage Grotesque", "Space Grotesk", "Sora", "Outfit", "Fraunces", "Playfair Display"];
const CORPORATE_FONTS = ["Inter", "Public Sans", "IBM Plex Sans", "Source Sans 3", "Work Sans", "Roboto"];

export function applyLocks(prev: StyleSpec, next: StyleSpec): StyleSpec {
  const out: any = { ...next, locks: prev.locks };
  for (const lk of LOCK_KEYS) {
    if (!prev.locks[lk.key]) continue;
    for (const field of lk.fields) out[field] = (prev as any)[field];
  }
  return out;
}

export function setAxis(spec: StyleSpec, key: keyof Axes, v: number): StyleSpec {
  const d = v - spec.axes[key];
  const n: StyleSpec = { ...spec, axes: { ...spec.axes, [key]: v } };
  switch (key) {
    case "expressive":
      n.sat = clamp(spec.sat + d * 0.4, 0, 100);
      n.scaleRatio = clamp(+(spec.scaleRatio + d * 0.0035).toFixed(3), 1.125, 1.414);
      n.headingWeight = v > 70 ? 800 : v < 22 ? 600 : 700;
      if (v > 60) n.gradient = true;
      if (v < 30) n.gradient = false;
      break;
    case "sharp":
      n.radius = Math.round(clamp(spec.radius - d * 0.3, 0, 32));
      if (v < 15 && (spec.button === "solid" || spec.button === "outline")) n.button = "pill";
      if (v > 85 && spec.button === "pill") n.button = "solid";
      if (v > 90 && spec.card === "soft") n.card = "outlined";
      break;
    case "dark":
      n.mode = v >= 50 ? "dark" : "light";
      break;
    case "animated":
      n.motion = v < 12 ? "none" : v < 45 ? "subtle" : v < 78 ? "lively" : "kinetic";
      break;
    case "creative":
      n.accentHue = wrap(spec.accentHue + d * 0.6);
      if (v > 65 && CORPORATE_FONTS.includes(spec.heading)) n.heading = CREATIVE_FONTS[Math.floor(v) % CREATIVE_FONTS.length];
      if (v < 35 && CREATIVE_FONTS.includes(spec.heading)) n.heading = CORPORATE_FONTS[Math.floor(v) % CORPORATE_FONTS.length];
      if (v > 72 && spec.hero === "split") n.hero = "stack";
      if (v < 30 && spec.hero === "stack") n.hero = "split";
      break;
    case "experimental":
      n.tracking = clamp(+(spec.tracking - d * 0.0008).toFixed(3), -0.07, 0.08);
      if (v > 70 && spec.grid === "even") n.grid = "bento";
      if (v < 30 && spec.grid === "bento") n.grid = "even";
      if (v > 78 && spec.nav === "bar") n.nav = "floating";
      if (v < 30 && spec.nav === "floating") n.nav = "bar";
      if (v > 72 && spec.imagery === "photo") n.imagery = "grain";
      break;
  }
  return applyLocks(spec, n);
}

/** Re-derives the slider positions from the concrete parameters (after remix / generate). */
export function deriveAxes(s: StyleSpec): StyleSpec {
  const axes: Axes = {
    expressive: clamp(Math.round(s.sat * 0.45 + (s.scaleRatio - 1.125) * 120 + (s.gradient ? 12 : 0)), 0, 100),
    sharp: clamp(Math.round(100 - s.radius * 3.3), 0, 100),
    dark: s.mode === "dark" ? 90 : 8,
    animated: { none: 0, subtle: 30, lively: 62, kinetic: 92 }[s.motion],
    creative: clamp(Math.round((CREATIVE_FONTS.includes(s.heading) ? 65 : 30) + (s.hero === "stack" ? 15 : 0) + (s.imagery === "grain" ? 10 : 0)), 0, 100),
    experimental: clamp(Math.round(Math.abs(s.tracking) * 500 + (s.grid === "bento" ? 25 : 0) + (s.nav === "floating" ? 12 : 0) + (s.card === "brutal" ? 40 : 0)), 0, 100),
  };
  return { ...s, axes };
}

/* ───────────────────────── names, hashing, randomness ───────────────────────── */
export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
const NAME_A = ["Aurora", "Lumen", "Nova", "Obsidian", "Halcyon", "Vertex", "Solstice", "Ember", "Cobalt", "Meridian", "Zenith", "Onyx", "Prism", "Atlas", "Verdant", "Indigo", "Saffron", "Cinder", "Mistral", "Quartz"];
const NAME_B = ["Noir", "Glow", "Grid", "Field", "Wave", "Studio", "Lab", "Signal", "Bloom", "Pulse", "Canvas", "Drift", "Forge", "Loom", "Atelier"];
export const nameFor = (seed: number) => `${NAME_A[seed % NAME_A.length]} ${NAME_B[Math.floor(seed / 20) % NAME_B.length]}`;
const uid = () => "s-" + Math.random().toString(36).slice(2, 8);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

export function fingerprint(s: StyleSpec) {
  return hash([s.hue, s.sat, s.bgHue, s.heading, s.body, s.radius, s.shadow, s.card, s.button, s.nav, s.hero, s.grid, s.motion, s.mode, s.density].join("|")).toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

/** How close a style is to any bundled preset — used to prove the result is an original blend. */
export function originality(s: StyleSpec) {
  let best = { name: "", sim: 0 };
  for (const p of PRESETS) {
    const keys: (keyof StyleSpec)[] = ["heading", "body", "shadow", "card", "button", "nav", "hero", "grid", "motion", "imagery", "mode", "border", "neutral"];
    let same = keys.filter((k) => (s as any)[k] === (p as any)[k]).length;
    same += Math.abs(wrap(s.hue - p.hue + 180) - 180) < 12 ? 1 : 0;
    same += Math.abs(s.radius - p.radius) < 3 ? 1 : 0;
    same += Math.abs(s.density - p.density) < 12 ? 1 : 0;
    const sim = same / (keys.length + 3);
    if (sim > best.sim) best = { name: p.name, sim };
  }
  const pct = Math.round(best.sim * 100);
  return { closest: best.name, similarity: pct, fingerprint: fingerprint(s), original: pct < 78 };
}

/* ───────────────────────── remix / randomize ───────────────────────── */
function fontFrom(name: string) {
  const group = Object.values(FONT_GROUPS).find((g) => g.includes(name)) || FONT_GROUPS["Sans · neutral"];
  return pick(group.filter((f) => f !== name).length ? group.filter((f) => f !== name) : group);
}

export function remix(spec: StyleSpec, strength = 1): StyleSpec {
  const n: StyleSpec = { ...spec, id: uid(), fix: { light: {}, dark: {} } };
  const dh = rnd(-40, 40) * strength;
  n.hue = wrap(spec.hue + dh);
  n.bgHue = wrap(spec.bgHue + dh * 0.6);
  n.accentHue = wrap(spec.accentHue + rnd(-50, 50) * strength);
  n.sat = clamp(spec.sat + rnd(-14, 14) * strength, 8, 100);
  if (Math.random() < 0.45 * strength) n.heading = fontFrom(spec.heading);
  if (Math.random() < 0.3 * strength) n.body = fontFrom(spec.body);
  if (spec.card !== "brutal") n.radius = clamp(Math.round(spec.radius + rnd(-6, 8) * strength), 0, 32);
  if (Math.random() < 0.3 * strength && spec.shadow !== "hard") n.shadow = pick(["soft", "layered", "crisp"] as const);
  n.density = clamp(Math.round(spec.density + rnd(-12, 12) * strength), 0, 100);
  if (Math.random() < 0.3 * strength) n.motion = pick(["subtle", "lively", "kinetic"] as const);
  if (Math.random() < 0.25 * strength && spec.card !== "brutal") n.card = pick(["elevated", "outlined", "soft", "flat"] as const);
  if (Math.random() < 0.25 * strength && spec.button !== "brutal") n.button = pick(["solid", "pill", "gradient", "tonal", "outline"] as const);
  if (Math.random() < 0.25 * strength) n.hero = pick(["split", "centered", "stack", "editorial"] as const);
  if (Math.random() < 0.2 * strength) n.imagery = pick(["photo", "duotone", "grain", "geometric", "illustration"] as const);
  n.name = nameFor(hash(String(Math.random())));
  n.mood = spec.mood;
  n.blurb = `A remix of ${spec.name}.`;
  return applyLocks(spec, deriveAxes(n));
}

export function variants(spec: StyleSpec, count = 4): StyleSpec[] {
  return Array.from({ length: count }, (_, i) => remix(spec, 0.7 + i * 0.35));
}

export function randomize(current: StyleSpec): StyleSpec {
  const base = pick(PRESETS.filter((p) => p.id !== current.id));
  const n = remix({ ...base, locks: current.locks }, 1.4);
  n.hue = wrap(rnd(0, 360));
  n.bgHue = wrap(n.hue + rnd(-20, 20));
  n.name = nameFor(hash(String(Math.random())));
  n.blurb = "A freshly synthesised, coherent style.";
  return applyLocks(current, deriveAxes(n));
}

/* ───────────────────────── prompt → original design system ───────────────────────── */
const COLOR_WORDS: [RegExp, number][] = [
  [/\b(blue|azure|navy|ocean|sky)\b/, 220], [/\b(purple|violet|indigo|lavender)\b/, 268], [/\b(pink|magenta|rose|blush)\b/, 330],
  [/\b(red|crimson|scarlet)\b/, 355], [/\b(orange|amber|sunset|tangerine)\b/, 24], [/\b(yellow|lemon)\b/, 50], [/\b(gold|golden)\b/, 42],
  [/\b(green|emerald|forest|mint|sage)\b/, 140], [/\b(teal|turquoise|aqua)\b/, 175], [/\b(cyan)\b/, 190],
];

export interface GenerateResult { spec: StyleSpec; trace: string[] }

export function generateFromPrompt(prompt: string, current?: StyleSpec): GenerateResult {
  const text = prompt.toLowerCase();
  const trace: string[] = [];
  const scored = PRESETS.map((p) => ({ p, score: p.keywords.reduce((a, k) => a + (text.includes(k) ? (k.includes(" ") ? 3 : 2) : 0), 0) + (text.includes(p.name.toLowerCase()) ? 4 : 0) }))
    .sort((a, b) => b.score - a.score);
  const seed = hash(text || "vibe");
  const top = scored[0].score > 0 ? scored[0].p : PRESETS[seed % PRESETS.length];
  const second = scored[1].score > 0 ? scored[1].p : PRESETS[(seed >> 3) % PRESETS.length];
  const intents: string[] = [];
  const has = (re: RegExp, label: string) => { if (re.test(text)) { intents.push(label); return true; } return false; };

  const n: StyleSpec = { ...top, id: uid(), fix: { light: {}, dark: {} }, locks: current?.locks || {}, axes: { ...top.axes } };

  trace.push(`Reading brief: “${prompt.trim() || "(empty — using defaults)"}”`);
  // blend a second influence so the outcome is never a single preset
  if (second.id !== top.id) {
    if (seed % 2 === 0) { n.heading = second.heading; n.tracking = (n.tracking + second.tracking) / 2; }
    else { n.card = second.card; n.nav = second.nav; }
    n.grid = seed % 3 === 0 ? second.grid : n.grid;
    n.refs = Array.from(new Set([...top.refs, ...second.refs]));
    trace.push(`Influences: ${top.name} (primary) + ${second.name} (secondary) — blended, not copied.`);
  } else {
    trace.push(`Influence: ${top.name}.`);
  }

  if (has(/\b(dark|night|black|noir|obsidian)\b/, "dark interface")) n.mode = "dark";
  if (has(/\b(light|bright|airy|white|daylight)\b/, "light interface")) n.mode = "light";
  if (has(/\b(premium|luxury|elegant|refined|exclusive)\b/, "premium feel")) { n.sat = n.sat * 0.8; n.radius = Math.min(n.radius, 8); n.density = Math.min(n.density, 28); n.shadow = "layered"; }
  if (has(/\b(playful|fun|friendly|cheerful)\b/, "playful")) { n.radius = Math.max(n.radius, 20); n.motion = "lively"; n.button = "pill"; }
  if (has(/\b(minimal|clean|simple)\b/, "minimal")) { n.density = Math.min(n.density, 25); n.sat = n.sat * 0.85; n.motion = n.motion === "kinetic" ? "subtle" : n.motion; }
  if (has(/\b(vibrant|colorful|colourful|bold|loud|energetic)\b/, "vibrant")) { n.sat = Math.max(n.sat, 88); n.headingWeight = 800; }
  if (has(/\b(futuristic|sci-fi|neon|cyber|holographic)\b/, "futuristic")) { n.gradient = true; n.shadow = "glow"; n.mode = has(/\blight\b/, "") ? n.mode : "dark"; }
  if (has(/\b(soft|rounded|gentle)\b/, "soft geometry")) n.radius = Math.max(n.radius, 24);
  if (has(/\b(sharp|angular|edgy|square)\b/, "sharp geometry")) n.radius = Math.min(n.radius, 3);
  if (has(/\b(animated|dynamic|kinetic|motion|interactive)\b/, "animated")) n.motion = "kinetic";
  if (has(/\b(static|still|calm)\b/, "static")) n.motion = "subtle";
  if (has(/\b(serif|classic|editorial)\b/, "serif voice")) n.heading = pick(FONT_GROUPS["Serif"]);
  if (has(/\b(mono|monospace|terminal|code)\b/, "monospace voice")) { n.heading = "JetBrains Mono"; n.body = "IBM Plex Mono"; }
  if (has(/\b(glass|frosted|translucent)\b/, "glass")) { n.glass = true; n.card = "glass"; n.nav = "glass"; }
  if (has(/\b(gradient|aurora|mesh)\b/, "gradient")) n.gradient = true;
  for (const [re, hue] of COLOR_WORDS) {
    if (re.test(text)) { n.hue = hue; n.bgHue = hue; n.neutral = false; intents.push(`hue ${hue}°`); break; }
  }
  if (has(/\b(monochrome|black and white|grayscale|greyscale)\b/, "monochrome")) { n.neutral = true; n.sat = 10; }
  if (has(/\b(ai|artificial intelligence|llm|agent)\b/, "AI product") && !intents.includes("dark interface") && !/\blight\b/.test(text)) { n.mode = "dark"; n.gradient = true; }

  trace.push(`Intent detected: ${intents.length ? intents.join(", ") : "general-purpose website"}.`);
  n.name = nameFor(seed);
  n.mood = top.mood;
  n.keywords = text.split(/\W+/).filter((w) => w.length > 3).slice(0, 8);
  n.blurb = `Generated from “${prompt.trim().slice(0, 80)}”.`;
  const finalSpec = applyLocks(current || n, deriveAxes(n));
  const o = originality(finalSpec);
  trace.push(`Palette: hue ${Math.round(finalSpec.hue)}° · chroma ${Math.round(finalSpec.sat)} · ${finalSpec.mode} mode, mapped to Material-style semantic roles.`);
  trace.push(`Type: ${finalSpec.heading} for headings, ${finalSpec.body} for text (Google Fonts).`);
  trace.push(`Shape & depth: radius ${finalSpec.radius}px, ${finalSpec.shadow} shadows, ${finalSpec.motion} motion.`);
  trace.push(`Originality check: closest bundled style is “${o.closest}” at ${o.similarity}% similarity → ${o.original ? "original combination ✓" : "too similar — remix recommended"} (fingerprint ${o.fingerprint}).`);
  return { spec: finalSpec, trace };
}

/* ───────────────────────── project theme mapping ───────────────────────── */
export function themePatch(spec: StyleSpec, tokens: StyleTokens) {
  const p = tokens.colors[spec.mode];
  return {
    mode: spec.mode,
    colors: { primary: p.primary, secondary: p.secondary, accent: p.accent, background: p.background, surface: p.surface, text: p.onBackground, muted: p.muted, border: p.outline, success: p.success, warning: p.warning, error: p.error },
    heading_font: spec.heading,
    body_font: spec.body,
    scale: spec.scaleRatio,
    spacing: tokens.spacing.slice(0, 9),
    radius: [0, tokens.radius.sm, tokens.radius.md, tokens.radius.lg, tokens.radius.xl, 999, 999].slice(0, 7),
    shadows: [...tokens.shadows],
    design: { spec },
  };
}
