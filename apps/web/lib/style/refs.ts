export interface Reference {
  id: string;
  title: string;
  url: string;
  publisher: string;
  /** The transferable principle VIBE studies — never a copied asset. */
  principle: string;
}

/** Public design resources. VIBE learns from their *principles*, it does not reproduce their visuals. */
export const REFERENCES: Reference[] = [
  { id: "m3", title: "Material Design 3 — color roles", url: "https://m3.material.io/styles/color/roles", publisher: "Google", principle: "Colors are assigned semantic roles (primary, on-primary, containers, surface, outline) instead of arbitrary hex values." },
  { id: "m3-type", title: "Material Design 3 — typography scale", url: "https://m3.material.io/styles/typography/overview", publisher: "Google", principle: "A named, ratio-based type scale keeps hierarchy consistent across screens." },
  { id: "gfonts", title: "Google Fonts", url: "https://fonts.google.com/", publisher: "Google", principle: "Open-licensed families with clear voices (neutral, geometric, serif, mono) that can be paired by contrast." },
  { id: "codex", title: "Codex design system", url: "https://doc.wikimedia.org/codex/latest/", publisher: "Wikimedia Foundation", principle: "Tokenised, accessible, content-first components with strong focus and state definitions." },
  { id: "wm-style", title: "Wikimedia Design Style Guide", url: "https://design.wikimedia.org/style-guide/", publisher: "Wikimedia Foundation", principle: "Readable measure, restrained color and hierarchy built from typography rather than decoration." },
  { id: "wp-mos", title: "Wikipedia Manual of Style", url: "https://en.wikipedia.org/wiki/Wikipedia:Manual_of_Style", publisher: "Wikipedia", principle: "Consistent, neutral presentation: plain headings, ruled sections, links as the only strong color." },
  { id: "swiss", title: "International Typographic Style", url: "https://en.wikipedia.org/wiki/International_Typographic_Style", publisher: "Wikipedia", principle: "Grids, asymmetry, flush-left type and objective imagery." },
  { id: "hig", title: "Apple Human Interface Guidelines", url: "https://developer.apple.com/design/human-interface-guidelines/", publisher: "Apple", principle: "Clarity, deference and depth: generous whitespace, translucency used sparingly." },
  { id: "carbon", title: "IBM Carbon Design System", url: "https://carbondesignsystem.com/", publisher: "IBM", principle: "Enterprise density, ruled layouts and a strict 8px spacing rhythm." },
  { id: "wcag", title: "WCAG 2.2 — contrast (minimum)", url: "https://www.w3.org/TR/WCAG22/#contrast-minimum", publisher: "W3C", principle: "4.5:1 for body text, 3:1 for large text and UI components." },
  { id: "brutalist", title: "Brutalist Websites (public gallery)", url: "https://brutalistwebsites.com/", publisher: "Community", principle: "Raw structure, hard shadows, thick borders and unpolished honesty as an aesthetic." },
  { id: "awwwards", title: "Awwwards — public gallery", url: "https://www.awwwards.com/websites/", publisher: "Awwwards", principle: "Study of contemporary layout, motion and typographic trends across many sites; no single site is imitated." },
  { id: "refui", title: "Glassmorphism (CSS backdrop-filter)", url: "https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter", publisher: "MDN", principle: "Layered translucency needs enough contrast between blurred surface and content." },
  { id: "japan", title: "Ma (negative space) in Japanese design", url: "https://en.wikipedia.org/wiki/Ma_(negative_space)", publisher: "Wikipedia", principle: "Emptiness is an active design element; restraint and rhythm over ornament." },
  { id: "editorial", title: "Editorial design", url: "https://en.wikipedia.org/wiki/Editorial_design", publisher: "Wikipedia", principle: "Strong typographic contrast, column structure and pacing borrowed from print magazines." },
];

export const REF_BY_ID = Object.fromEntries(REFERENCES.map((r) => [r.id, r]));
