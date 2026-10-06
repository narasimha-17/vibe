/** Google Fonts used by the Style Studio, grouped by voice. */
export const FONT_GROUPS: Record<string, string[]> = {
  "Sans · neutral": ["Inter", "DM Sans", "Public Sans", "Work Sans", "IBM Plex Sans", "Source Sans 3", "Roboto", "Manrope"],
  "Sans · geometric": ["Outfit", "Sora", "Plus Jakarta Sans", "Nunito", "Space Grotesk", "Zen Kaku Gothic New"],
  "Display & expressive": ["Bricolage Grotesque", "Archivo Black", "Bebas Neue", "Orbitron", "Chakra Petch"],
  "Serif": ["Playfair Display", "DM Serif Display", "Cormorant Garamond", "Fraunces", "Lora", "Libre Baskerville", "Source Serif 4"],
  "Mono": ["JetBrains Mono", "IBM Plex Mono", "Space Mono"],
};

export const ALL_FONTS = Array.from(new Set(Object.values(FONT_GROUPS).flat()));

const SINGLE_WEIGHT = new Set(["Archivo Black", "Bebas Neue", "DM Serif Display"]);

function familyParam(name: string) {
  const f = name.trim().replace(/ /g, "+");
  return SINGLE_WEIGHT.has(name) ? `family=${f}` : `family=${f}:wght@400;700`;
}

export function fontsUrl(families: string[]) {
  const uniq = Array.from(new Set(families.filter(Boolean)));
  return `https://fonts.googleapis.com/css2?${uniq.map(familyParam).join("&")}&display=swap`;
}

/** Idempotently injects a Google Fonts stylesheet for the given families. */
export function ensureFonts(families: string[]) {
  if (typeof document === "undefined") return;
  const url = fontsUrl(families);
  const id = "vibe-fonts-" + Array.from(new Set(families)).sort().join("|");
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

export function fontStack(name: string, kind: "sans" | "serif" | "mono" = "sans") {
  const fallback = kind === "mono" ? "ui-monospace, monospace" : kind === "serif" ? "Georgia, serif" : "system-ui, sans-serif";
  return `'${name}', ${fallback}`;
}

export function fontKind(name: string): "sans" | "serif" | "mono" {
  if (FONT_GROUPS["Mono"].includes(name)) return "mono";
  if (FONT_GROUPS["Serif"].includes(name)) return "serif";
  return "sans";
}
