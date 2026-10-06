export type Mode = "light" | "dark";

/** Six continuous "personality" axes, each 0..100 (0 = left word, 100 = right word). */
export interface Axes {
  expressive: number; // Minimal ↔ Expressive
  sharp: number; // Soft ↔ Sharp
  dark: number; // Light ↔ Dark
  animated: number; // Static ↔ Animated
  creative: number; // Corporate ↔ Creative
  experimental: number; // Simple ↔ Experimental
}

export const AXES: { key: keyof Axes; left: string; right: string }[] = [
  { key: "expressive", left: "Minimal", right: "Expressive" },
  { key: "sharp", left: "Soft", right: "Sharp" },
  { key: "dark", left: "Light", right: "Dark" },
  { key: "animated", left: "Static", right: "Animated" },
  { key: "creative", left: "Corporate", right: "Creative" },
  { key: "experimental", left: "Simple", right: "Experimental" },
];

export type ShadowStyle = "none" | "soft" | "crisp" | "hard" | "glow" | "layered";
export type BorderStyle = "none" | "thin" | "thick";
export type ButtonStyle = "solid" | "outline" | "pill" | "gradient" | "brutal" | "tonal";
export type CardStyle = "flat" | "elevated" | "outlined" | "glass" | "brutal" | "soft";
export type NavStyle = "bar" | "floating" | "minimal" | "brutal" | "glass";
export type HeroLayout = "split" | "centered" | "editorial" | "stack";
export type GridStyle = "even" | "bento" | "ruled";
export type MotionLevel = "none" | "subtle" | "lively" | "kinetic";
export type ImageryStyle = "photo" | "duotone" | "illustration" | "grain" | "geometric";
export type IconStyle = "line" | "solid" | "duotone";

export type LockKey = "color" | "typography" | "layout" | "shape" | "shadow" | "motion" | "components" | "imagery";

export interface StyleSpec {
  id: string;
  name: string;
  mood: string;
  blurb: string;
  keywords: string[];
  refs: string[]; // reference ids (see refs.ts)
  axes: Axes;
  mode: Mode;

  // color genome
  hue: number;
  sat: number;
  bgHue: number;
  bgSat: number;
  accentHue: number;
  /** Optional harmony-driven secondary hue (color-theory scheme). Defaults to hue + 40. */
  secondaryHue?: number;
  /** Which color-theory scheme produced the palette (informational). */
  scheme?: string;
  neutral: boolean; // primary is "ink" instead of a hue
  gradient: boolean;

  // typography genome
  heading: string;
  body: string;
  mono: string;
  headingWeight: number;
  tracking: number; // em, heading letter-spacing
  upper: boolean;
  scaleRatio: number;
  baseSize: number;
  lineHeight: number;

  // layout / shape genome
  density: number; // 0 airy .. 100 compact
  container: number;
  radius: number; // px base
  shadow: ShadowStyle;
  border: BorderStyle;
  glass: boolean;

  // component genome
  button: ButtonStyle;
  card: CardStyle;
  nav: NavStyle;
  hero: HeroLayout;
  grid: GridStyle;
  motion: MotionLevel;
  imagery: ImageryStyle;
  icon: IconStyle;

  /** Accessibility fixes accepted by the user, per mode and semantic role. */
  fix: { light: Record<string, string>; dark: Record<string, string> };
  locks: Partial<Record<LockKey, boolean>>;
}

export const LOCK_KEYS: { key: LockKey; label: string; fields: (keyof StyleSpec)[] }[] = [
  { key: "color", label: "Color", fields: ["hue", "sat", "bgHue", "bgSat", "accentHue", "secondaryHue", "scheme", "neutral", "gradient", "mode", "fix"] },
  { key: "typography", label: "Typography", fields: ["heading", "body", "mono", "headingWeight", "tracking", "upper", "scaleRatio", "baseSize", "lineHeight"] },
  { key: "layout", label: "Layout", fields: ["density", "container", "hero", "nav", "grid"] },
  { key: "shape", label: "Shape", fields: ["radius", "border"] },
  { key: "shadow", label: "Shadows", fields: ["shadow", "glass"] },
  { key: "motion", label: "Motion", fields: ["motion"] },
  { key: "components", label: "Components", fields: ["button", "card"] },
  { key: "imagery", label: "Imagery", fields: ["imagery", "icon"] },
];

export type Role =
  | "primary"
  | "onPrimary"
  | "primaryContainer"
  | "onPrimaryContainer"
  | "secondary"
  | "onSecondary"
  | "accent"
  | "onAccent"
  | "background"
  | "onBackground"
  | "surface"
  | "surfaceVariant"
  | "onSurface"
  | "muted"
  | "outline"
  | "success"
  | "warning"
  | "error";

export type Palette = Record<Role, string>;

export interface StyleTokens {
  colors: { light: Palette; dark: Palette };
  gradients: { primary: string; glow: string; mesh: string };
  typography: {
    heading: string;
    body: string;
    mono: string;
    sizes: Record<"xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl", number>;
    weights: { body: number; medium: number; heading: number };
    lineHeights: { body: number; heading: number };
    tracking: { heading: string; body: string; label: string };
    transform: "none" | "uppercase";
  };
  spacing: number[]; // px scale
  sectionY: number;
  radius: { none: number; sm: number; md: number; lg: number; xl: number; full: number; button: number; card: number; input: number };
  shadows: [string, string, string];
  borderWidth: number;
  container: { sm: number; md: number; lg: number; xl: number };
  breakpoints: { sm: number; md: number; lg: number; xl: number };
  motion: { level: MotionLevel; duration: number; easing: string; hoverLift: number; hoverScale: number; description: string };
  focus: string;
  components: { button: string; card: string; input: string; nav: string; hero: string; grid: string };
  imagery: { treatment: string; filter: string; illustration: string; icon: string };
  hover: string;
}
