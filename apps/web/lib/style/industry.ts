/** Marketplace tags and the visual style each industry template ships with. */
export type TagId = "ecommerce" | "travel" | "healthcare" | "education" | "logistics" | "blog" | "saas" | "portfolio" | "restaurant";

export const TAGS: { id: TagId; label: string }[] = [
  { id: "ecommerce", label: "E-commerce" },
  { id: "travel", label: "Travel & Agency" },
  { id: "healthcare", label: "Healthcare" },
  { id: "education", label: "Education" },
  { id: "logistics", label: "Logistics" },
  { id: "blog", label: "Blogs" },
  { id: "saas", label: "SaaS" },
  { id: "portfolio", label: "Portfolio" },
  { id: "restaurant", label: "Restaurant" },
];

/** Industry templates (served by the API) and the design style each one uses. */
export const INDUSTRY: Record<string, { tag: TagId; style: string }> = {
  "ecom-atelier": { tag: "ecommerce", style: "ecommerce-premium" },
  "ecom-market": { tag: "ecommerce", style: "bento-modern" },
  "travel-wanderly": { tag: "travel", style: "creative-portfolio" },
  "travel-agency": { tag: "travel", style: "startup-saas" },
  "health-clinic": { tag: "healthcare", style: "fintech" },
  "health-wellness": { tag: "healthcare", style: "organic-nature" },
  "edu-academy": { tag: "education", style: "material-you" },
  "edu-bootcamp": { tag: "education", style: "neo-brutalist" },
  "logi-freight": { tag: "logistics", style: "futuristic-enterprise" },
  "logi-courier": { tag: "logistics", style: "soft-ui" },
  "blog-journal": { tag: "blog", style: "editorial-magazine" },
  "blog-notes": { tag: "blog", style: "monochrome-wiki" },
};

/** Style-only templates (no industry tree) fall under a tag by their base layout. */
export const BASE_TAG: Record<string, TagId> = { saas: "saas", portfolio: "portfolio", agency: "travel", restaurant: "restaurant" };
