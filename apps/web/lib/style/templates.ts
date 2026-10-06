/**
 * Every marketplace template = a visual style (tokens) + a "recipe" of real registry variants,
 * so the card preview, the generated project and the builder canvas all show the same thing.
 * Recipes were shaped from public style references (UI Style Guide, neo-brutalism / glassmorphism / Swiss
 * editorial guides): each style pairs a distinct navigation pattern with a distinct hero composition.
 */
export type BaseKey = "saas" | "portfolio" | "agency" | "restaurant";
export const BASE_LABEL: Record<BaseKey, string> = { saas: "SaaS", portfolio: "Portfolio", agency: "Agency", restaurant: "Restaurant" };

export interface Recipe {
  base: BaseKey;
  brand: string;
  headline: string;
  sub: string;
  primary: string;
  secondary: string;
  nav: string;
  hero: string;
  features: string;
  cards: string;
  pricing: string;
  testimonials: string;
  cta: string;
  footer: string;
  forms: string;
}

const R = (r: Partial<Recipe> & Pick<Recipe, "base" | "brand" | "headline" | "sub" | "nav" | "hero">): Recipe => ({
  primary: "Get started", secondary: "Learn more", features: "grid", cards: "simple", pricing: "tiered", testimonials: "default", cta: "default", footer: "columns", forms: "contact", ...r,
});

export const RECIPES: Record<string, Recipe> = {
  "minimal-modern": R({ base: "portfolio", brand: "Plain", headline: "Quiet design, clear thinking.", sub: "A calm portfolio with room to breathe.", nav: "minimal", hero: "centered", cards: "icons", footer: "utility", cta: "line", primary: "View work" }),
  "material-you": R({ base: "saas", brand: "Tonal", headline: "Apps that feel personal.", sub: "Adaptive color, friendly shapes, delightful motion.", nav: "tabs", hero: "stats", features: "checks", pricing: "rows", testimonials: "rating", cta: "card", footer: "newsletter" }),
  "swiss-editorial": R({ base: "agency", brand: "GRID/6", headline: "Form follows the grid.", sub: "Objective typography and rhythm for confident brands.", nav: "split", hero: "type", features: "zigzag", cards: "numbered", testimonials: "spotlight", cta: "line", footer: "utility", primary: "See projects" }),
  "luxury-premium": R({ base: "restaurant", brand: "Maison Aurel", headline: "An evening worth remembering.", sub: "Seasonal tasting menus in a candle-lit room.", nav: "dark", hero: "cinema", cards: "horizontal", testimonials: "spotlight", cta: "banner", footer: "wordmark", forms: "booking", primary: "Reserve a table" }),
  glassmorphism: R({ base: "saas", brand: "Prism", headline: "Software with depth.", sub: "Layered interfaces that feel weightless.", nav: "glass", hero: "mesh", features: "bento", pricing: "toggle", testimonials: "wall", cta: "banner", footer: "cta" }),
  "neo-brutalist": R({ base: "portfolio", brand: "LOUD", headline: "Make it impossible to ignore.", sub: "Thick borders. Hard shadows. Zero apologies.", nav: "brutal", hero: "split", features: "bento", cards: "gradient", testimonials: "wall", cta: "card", footer: "utility", primary: "See the work" }),
  "soft-ui": R({ base: "restaurant", brand: "Petal", headline: "Gentle food, gentle room.", sub: "Slow mornings and soft-baked everything.", nav: "floating", hero: "mockup", cards: "icons", testimonials: "rating", cta: "card", footer: "newsletter", forms: "split", primary: "Book a table" }),
  "bento-modern": R({ base: "saas", brand: "Tile", headline: "Everything in one grid.", sub: "Modular blocks that snap together.", nav: "search", hero: "bento", features: "bento", pricing: "compare", testimonials: "wall", cta: "card", footer: "cta" }),
  "dark-ai": R({ base: "saas", brand: "Neural", headline: "Ship with an AI co-pilot.", sub: "Describe it, review it, apply it, in seconds.", nav: "mega", hero: "mockup", features: "spotlight", pricing: "toggle", testimonials: "spotlight", cta: "banner", footer: "cta", primary: "Start free" }),
  cyberpunk: R({ base: "agency", brand: "NEON//LAB", headline: "Build the future, loudly.", sub: "Neon-lit experiences for bold digital brands.", nav: "twotier", hero: "cinema", features: "zigzag", cards: "gradient", testimonials: "wall", cta: "banner", footer: "wordmark", primary: "Jack in" }),
  "futuristic-enterprise": R({ base: "saas", brand: "Vector", headline: "Infrastructure you can trust.", sub: "Observability and control for teams at scale.", nav: "megabar", hero: "stats", features: "checks", pricing: "compare", testimonials: "rating", cta: "card", footer: "columns", primary: "Book a demo" }),
  "japanese-minimal": R({ base: "restaurant", brand: "Ma", headline: "Space, silence, tea.", sub: "A small tea house in the hills.", nav: "minimal", hero: "type", cards: "horizontal", testimonials: "spotlight", cta: "line", footer: "utility", forms: "booking", primary: "Reserve" }),
  "editorial-magazine": R({ base: "agency", brand: "The Ledger", headline: "Stories that stay with you.", sub: "Longform reporting, criticism and essays.", nav: "split", hero: "split", features: "zigzag", cards: "numbered", testimonials: "spotlight", cta: "line", footer: "newsletter", primary: "Read now" }),
  "creative-portfolio": R({ base: "portfolio", brand: "Kaya Studio", headline: "Hello, I make things.", sub: "Designer, illustrator and occasional troublemaker.", nav: "floating", hero: "type", features: "bento", cards: "gradient", testimonials: "wall", cta: "banner", footer: "wordmark", primary: "See projects" }),
  "startup-saas": R({ base: "saas", brand: "Launchpad", headline: "Launch faster than your competitors.", sub: "The all-in-one workspace for product teams.", nav: "default", hero: "mockup", features: "bento", pricing: "toggle", testimonials: "wall", cta: "banner", footer: "cta", primary: "Start free trial" }),
  "corporate-professional": R({ base: "agency", brand: "Halden & Co", headline: "Advisory you can rely on.", sub: "Strategy and delivery for growing businesses.", nav: "tabs", hero: "split", features: "checks", cards: "icons", pricing: "rows", testimonials: "rating", cta: "card", footer: "columns", primary: "Talk to us" }),
  "ecommerce-premium": R({ base: "restaurant", brand: "Atelier Nord", headline: "Objects made to be kept.", sub: "Small-batch homeware, delivered across India.", nav: "twotier", hero: "centered", cards: "gradient", testimonials: "rating", cta: "banner", footer: "newsletter", primary: "Shop the edit" }),
  fintech: R({ base: "saas", brand: "Ledgr", headline: "Money, made simple.", sub: "Payments, cards and insights in one calm app.", nav: "default", hero: "bento", features: "spotlight", pricing: "rows", testimonials: "rating", cta: "card", footer: "cta", primary: "Open account" }),
  "developer-terminal": R({ base: "saas", brand: "$ shipit", headline: "Deploy from your terminal.", sub: "CLI-first tooling for developers who live in the shell.", nav: "search", hero: "centered", features: "checks", pricing: "compare", testimonials: "rating", cta: "line", footer: "utility", primary: "npm i shipit" }),
  "organic-nature": R({ base: "restaurant", brand: "Fernwood", headline: "Grown slowly, served fresh.", sub: "Farm-to-table plates in a garden dining room.", nav: "floating", hero: "centered", cards: "icons", testimonials: "spotlight", cta: "card", footer: "newsletter", forms: "split", primary: "Book a table" }),
  "monochrome-wiki": R({ base: "portfolio", brand: "Codex", headline: "A free encyclopedia of ideas.", sub: "Neutral, readable and built to be edited by anyone.", nav: "tabs", hero: "split", features: "list", cards: "numbered", testimonials: "default", cta: "line", footer: "utility", primary: "Browse articles" }),
};

export const STYLE_BASE: Record<string, BaseKey> = Object.fromEntries(Object.entries(RECIPES).map(([k, r]) => [k, r.base]));

const VARIANT_KEYS: [keyof Recipe, string][] = [
  ["nav", "navbar"], ["hero", "hero"], ["features", "features"], ["cards", "cards"], ["pricing", "pricing"],
  ["testimonials", "testimonials"], ["cta", "cta"], ["footer", "footer"], ["forms", "forms"],
];

/** Rewrites the variants (and key copy) of a generated template page tree to follow a recipe. */
export function applyRecipe<T extends { type: string; variant: string; props: Record<string, any>; children?: T[] }>(tree: T[], r: Recipe): T[] {
  const map = Object.fromEntries(VARIANT_KEYS.map(([k, t]) => [t, r[k] as string]));
  return tree.map((n) => {
    const variant = map[n.type] || n.variant;
    const props = { ...n.props };
    if (n.type === "navbar") props.brand = r.brand;
    if (n.type === "hero") {
      props.headline = r.headline;
      props.subheadline = r.sub;
      props.primaryCta = r.primary;
      props.secondaryCta = r.secondary;
    }
    if (n.type === "footer") props.brand = r.brand;
    return { ...n, variant, props };
  });
}
