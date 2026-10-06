import type { Node } from "./types";

/**
 * Which section a navbar link points at, so "Team" scrolls to the team section like a one-page site.
 * Mirrors apps/api/app/codegen/anchors.py; keep the two in step.
 */
const ALIASES: Record<string, string[]> = {
  team: ["team", "our team", "people", "about", "about us"],
  faq: ["faq", "faqs", "questions", "help"],
  forms: ["contact", "contact us", "get in touch", "book", "booking", "subscribe", "newsletter"],
  pricing: ["pricing", "plans", "prices", "price"],
  testimonials: ["testimonials", "reviews", "clients", "feedback"],
  features: ["features", "services", "what we do"],
  cards: ["services", "courses", "projects", "portfolio", "work"],
  catalog: ["products", "courses", "menu", "catalog", "collection", "portfolio", "work"],
  timeline: ["experience", "journey", "history", "timeline", "process"],
  stats: ["stats", "numbers", "results", "achievements"],
  socials: ["socials", "social", "follow"],
  cta: ["get started", "start"],
  footer: ["contact", "contact us"],
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function anchorSlug(label: string): string {
  return norm(label).replace(/ /g, "-") || "section";
}

/** The section on this page that a navbar link means, or null. "Home" means the top of the page (the first section). */
export function sectionForLink(label: string, tree: Node[]): Node | null {
  const want = norm(label);
  if (!want) return null;
  const sections = tree.filter((n) => n.type !== "navbar" && !n.hidden);
  if (want === "home" || want === "top") return sections[0] || null;
  const titles = (n: Node) => [n.props?.heading, n.props?.title, n.props?.headline, n.props?.eyebrow, n.name].map(norm).filter(Boolean);
  // 1. a section whose own heading or name says it ("Our courses" for "Courses")
  const byTitle = sections.find((n) => titles(n).some((t) => t === want || ` ${t} `.includes(` ${want} `)));
  if (byTitle) return byTitle;
  // 2. a section whose kind matches ("Contact" -> the contact form); earlier types in ALIASES win
  for (const [type, words] of Object.entries(ALIASES)) {
    if (!words.includes(want)) continue;
    const hit = sections.find((n) => n.type === type);
    if (hit) return hit;
  }
  return sections.find((n) => norm(n.type) === want) || null;
}
