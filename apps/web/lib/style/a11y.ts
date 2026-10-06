import { buildTokens, contrast, fixForeground, hexToHsl } from "./engine";
import type { Mode, Role, StyleSpec, StyleTokens } from "./types";

export type Status = "pass" | "warn" | "fail";

export interface A11yItem {
  id: string;
  group: "Contrast" | "Readability" | "Interaction" | "Color use";
  label: string;
  status: Status;
  detail: string;
  ratio?: number;
  required?: number;
  fg?: string;
  bg?: string;
  /** Accepting this suggestion stores an accessible alternative for `role`. */
  fix?: { mode: Mode; role: Role; from: string; to: string };
  /** Or patches the spec directly. */
  patch?: Partial<StyleSpec>;
}

const PAIRS: { fg: Role; bg: Role; min: number; label: string; fixRole?: Role; soft?: boolean }[] = [
  { fg: "onBackground", bg: "background", min: 4.5, label: "Body text on background" },
  { fg: "muted", bg: "background", min: 4.5, label: "Muted text on background" },
  { fg: "muted", bg: "surface", min: 4.5, label: "Muted text on cards" },
  { fg: "onPrimary", bg: "primary", min: 4.5, label: "Button label on primary" },
  { fg: "onSecondary", bg: "secondary", min: 4.5, label: "Label on secondary" },
  { fg: "onAccent", bg: "accent", min: 4.5, label: "Label on accent" },
  { fg: "accent", bg: "background", min: 4.5, label: "Accent used as link text" },
  { fg: "primary", bg: "background", min: 3, label: "Primary as UI component (button edge, icon)" },
  { fg: "error", bg: "surface", min: 4.5, label: "Error text on cards" },
  { fg: "outline", bg: "background", min: 3, label: "Input / divider boundary (non-text)", soft: true },
];

export function checkA11y(spec: StyleSpec, tokens: StyleTokens): A11yItem[] {
  const items: A11yItem[] = [];
  for (const mode of ["light", "dark"] as Mode[]) {
    const pal = tokens.colors[mode];
    for (const pr of PAIRS) {
      const fg = pal[pr.fg], bg = pal[pr.bg];
      const ratio = contrast(fg, bg);
      const ok = ratio >= pr.min;
      const item: A11yItem = {
        id: `${mode}-${pr.fg}-${pr.bg}`,
        group: "Contrast",
        label: `${pr.label} · ${mode}`,
        status: ok ? "pass" : pr.soft ? "warn" : "fail",
        detail: ok ? `${ratio.toFixed(2)}:1 meets ${pr.min}:1` : `${ratio.toFixed(2)}:1 — needs ${pr.min}:1`,
        ratio, required: pr.min, fg, bg,
      };
      if (!ok) {
        const to = fixForeground(fg, bg, pr.min + 0.1);
        item.fix = { mode, role: pr.fg, from: fg, to };
      }
      items.push(item);
    }
  }

  const s = tokens.typography.sizes;
  items.push({ id: "size", group: "Readability", label: "Body text size", status: s.base >= 16 ? "pass" : s.base >= 15 ? "warn" : "fail", detail: `${s.base}px base (16px+ recommended)`, patch: s.base < 16 ? { baseSize: 16 } : undefined });
  items.push({ id: "lh", group: "Readability", label: "Body line height", status: spec.lineHeight >= 1.5 ? "pass" : spec.lineHeight >= 1.4 ? "warn" : "fail", detail: `${spec.lineHeight} (1.5+ recommended)`, patch: spec.lineHeight < 1.5 ? { lineHeight: 1.6 } : undefined });
  items.push({ id: "track", group: "Readability", label: "Heading letter-spacing", status: spec.tracking >= -0.05 ? "pass" : "warn", detail: `${spec.tracking}em — tighter than -0.05em hurts legibility`, patch: spec.tracking < -0.05 ? { tracking: -0.03 } : undefined });
  items.push({ id: "upper", group: "Readability", label: "Uppercase headings", status: spec.upper && spec.tracking < 0.01 ? "warn" : "pass", detail: spec.upper ? "Uppercase needs positive tracking" : "Sentence case", patch: spec.upper && spec.tracking < 0.01 ? { tracking: 0.03 } : undefined });
  items.push({ id: "measure", group: "Readability", label: "Line length", status: spec.container <= 1280 ? "pass" : "warn", detail: `Container ${spec.container}px; body copy is capped near 70ch`, patch: spec.container > 1280 ? { container: 1200 } : undefined });

  const [h, sat, l] = hexToHsl(tokens.colors[spec.mode].primary);
  const focusRatio = contrast(tokens.colors[spec.mode].primary, tokens.colors[spec.mode].background);
  items.push({ id: "focus", group: "Interaction", label: "Visible focus ring", status: focusRatio >= 3 || contrast(tokens.colors[spec.mode].accent, tokens.colors[spec.mode].background) >= 3 ? "pass" : "fail", detail: "Double ring (background gap + brand color); falls back to accent when primary is too faint" });
  items.push({ id: "btn", group: "Interaction", label: "Button visibility", status: spec.button === "outline" && contrast(tokens.colors[spec.mode].outline, tokens.colors[spec.mode].background) < 3 ? "warn" : "pass", detail: spec.button === "outline" ? "Outlined buttons use the primary color for their edge" : "Filled buttons stand out from the surface" });
  items.push({ id: "motion", group: "Interaction", label: "Reduced motion", status: "pass", detail: spec.motion === "kinetic" ? "Kinetic motion is disabled under prefers-reduced-motion" : "All transitions honour prefers-reduced-motion" });
  items.push({ id: "colorOnly", group: "Color use", label: "Meaning not conveyed by color alone", status: "pass", detail: "Status colors are always paired with an icon or label" });
  items.push({ id: "sat", group: "Color use", label: "Saturation on large areas", status: sat > 92 && l > 35 && l < 65 && !spec.neutral ? "warn" : "pass", detail: `Primary S${Math.round(sat)} / L${Math.round(l)} (hue ${Math.round(h)}°)`, patch: sat > 92 ? { sat: 84 } : undefined });
  return items;
}

export function a11ySummary(items: A11yItem[]) {
  const total = items.length;
  const fail = items.filter((i) => i.status === "fail").length;
  const warn = items.filter((i) => i.status === "warn").length;
  const score = Math.round(((total - fail - warn * 0.4) / total) * 100);
  return { total, fail, warn, pass: total - fail - warn, score };
}

export function applyA11yFix(spec: StyleSpec, item: A11yItem): StyleSpec {
  if (item.fix) {
    return { ...spec, fix: { ...spec.fix, [item.fix.mode]: { ...spec.fix[item.fix.mode], [item.fix.role]: item.fix.to } } };
  }
  if (item.patch) return { ...spec, ...item.patch };
  return spec;
}

export function applyAllA11y(spec: StyleSpec, _tokens?: StyleTokens): StyleSpec {
  // Iterate: fixing one role can change how another pair measures up.
  let s = spec;
  for (let pass = 0; pass < 4; pass++) {
    const bad = checkA11y(s, buildTokens(s)).filter((i) => i.status !== "pass" && (i.fix || i.patch));
    if (!bad.length) break;
    for (const it of bad) s = applyA11yFix(s, it);
  }
  return s;
}

/* ───────────────────────── AI Improve ───────────────────────── */
export interface Suggestion {
  id: string;
  category: "Hierarchy" | "Accessibility" | "Consistency" | "Visual quality";
  title: string;
  reason: string;
  apply: (s: StyleSpec) => StyleSpec;
}

export function analyse(spec: StyleSpec, tokens: StyleTokens): Suggestion[] {
  const out: Suggestion[] = [];
  const a11y = checkA11y(spec, tokens).filter((i) => i.status === "fail");
  if (a11y.length) {
    out.push({
      id: "a11y", category: "Accessibility", title: `Fix ${a11y.length} contrast / readability failure${a11y.length > 1 ? "s" : ""}`,
      reason: a11y.slice(0, 3).map((i) => i.label).join("; ") + (a11y.length > 3 ? "…" : ""),
      apply: (s) => applyAllA11y(s, buildTokens(s)),
    });
  }
  if (spec.scaleRatio < 1.18) out.push({ id: "ratio", category: "Hierarchy", title: "Strengthen the type scale", reason: `A ${spec.scaleRatio} ratio makes headings barely larger than body. 1.25 gives a clearer hierarchy.`, apply: (s) => ({ ...s, scaleRatio: 1.25 }) });
  if (spec.headingWeight < 600 && spec.heading === spec.body && !spec.upper) out.push({ id: "weight", category: "Hierarchy", title: "Differentiate headings from body", reason: "Same family at light weight flattens hierarchy — raise heading weight to 700.", apply: (s) => ({ ...s, headingWeight: 700 }) });
  if (spec.card === "brutal" && spec.radius > 0) out.push({ id: "brutal-r", category: "Consistency", title: "Align geometry with the brutalist card", reason: "Hard-edged cards clash with a rounded base radius.", apply: (s) => ({ ...s, radius: 0 }) });
  if (spec.button === "brutal" && spec.shadow !== "hard") out.push({ id: "brutal-s", category: "Consistency", title: "Use hard offset shadows", reason: "Brutal buttons expect hard shadows; soft shadows dilute the effect.", apply: (s) => ({ ...s, shadow: "hard" }) });
  if (spec.button === "pill" && spec.radius < 6) out.push({ id: "pill-r", category: "Consistency", title: "Reconcile pill buttons with sharp surfaces", reason: "Fully-round buttons on square cards create mixed geometry — raise radius or use solid buttons.", apply: (s) => ({ ...s, button: "solid" }) });
  if ((spec.glass || spec.card === "glass") && !spec.gradient) out.push({ id: "glass-bg", category: "Visual quality", title: "Add a gradient backdrop for glass", reason: "Frosted surfaces need color behind them to read as glass.", apply: (s) => ({ ...s, gradient: true }) });
  if (spec.shadow === "none" && spec.card === "elevated") out.push({ id: "elev", category: "Consistency", title: "Elevated cards need a shadow", reason: "Shadows are disabled but cards are set to elevated — switch to outlined.", apply: (s) => ({ ...s, card: "outlined" }) });
  if (spec.motion === "kinetic" && spec.density > 65) out.push({ id: "calm", category: "Visual quality", title: "Calm the motion in a dense layout", reason: "Strong hover displacement is distracting in compact interfaces.", apply: (s) => ({ ...s, motion: "lively" }) });
  if (spec.lineHeight < 1.5) out.push({ id: "lh", category: "Accessibility", title: "Loosen body line height", reason: `${spec.lineHeight} is tight for paragraphs; 1.6 improves readability.`, apply: (s) => ({ ...s, lineHeight: 1.6 }) });
  if (spec.sat > 92 && !spec.neutral) out.push({ id: "sat", category: "Visual quality", title: "Reduce oversaturation", reason: "Very high chroma across large areas causes eye strain; 84 keeps energy without vibration.", apply: (s) => ({ ...s, sat: 84 }) });
  return out;
}
