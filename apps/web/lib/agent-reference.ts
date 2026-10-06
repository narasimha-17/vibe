import { createElement, Fragment, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { getVariant } from "@/lib/registry";
import { buildTokens, cssVarsFor, siteAttrs } from "@/lib/style/engine";
import type { StyleSpec } from "@/lib/style/types";
import type { ProjectDetail } from "@/lib/types";

/**
 * The design reference for the build agents: every page rendered exactly as the builder shows it, plus only the CSS rules
 * that markup uses. The UI agent reproduces this look as a real Next.js site, so the result matches what the user designed.
 */
export interface DesignReference {
  root: string; // the opening tag of the site wrapper, with the theme attributes and CSS variables
  css: string;
  pages: Record<string, string>;
}

const MAX_PAGE_HTML = 40_000;
const MAX_CSS = 60_000;

function renderHtml(content: ReactNode): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    flushSync(() => root.render(content));
    return host.innerHTML;
  } finally {
    root.unmount();
  }
}

function classesIn(html: string): Set<string> {
  const out = new Set<string>(["site-preview"]);
  for (const m of html.matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c) out.add(c);
  return out;
}

/** Keeps a selector when every class it names is used in the markup (so ".hero .hero__title" stays, ".shop__cart" goes). */
function selectorUsed(selector: string, used: Set<string>): boolean {
  if (/^(:root|html|body|\*)/.test(selector.trim())) return true;
  const names = [...selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  return names.length > 0 && names.every((n) => used.has(n) || n.startsWith("theme-") || n === "is-preview");
}

function collectCss(used: Set<string>): string {
  const out: string[] = [];
  const walk = (rules: CSSRuleList, wrap?: string) => {
    const inner: string[] = [];
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const keep = rule.selectorText.split(",").filter((s) => selectorUsed(s, used));
        if (keep.length) inner.push(`${keep.join(",")} { ${rule.style.cssText} }`);
      } else if (rule instanceof CSSMediaRule) {
        walk(rule.cssRules, `@media ${rule.conditionText}`);
      } else if (rule instanceof CSSKeyframesRule || rule instanceof CSSFontFaceRule) {
        inner.push(rule.cssText);
      }
    }
    if (inner.length) out.push(wrap ? `${wrap} {\n${inner.join("\n")}\n}` : inner.join("\n"));
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      /* cross-origin sheets (fonts) can't be read; they aren't needed */
    }
  }
  return out.join("\n").slice(0, MAX_CSS);
}

export function buildReference(project: ProjectDetail): DesignReference {
  const pages: Record<string, string> = {};
  const customCss: string[] = [];
  for (const page of [...project.pages].sort((a, b) => a.order - b.order)) {
    const parts = page.tree
      .filter((n) => !n.hidden)
      .map((n) => {
        if (n.props?.custom?.html) {
          customCss.push(String(n.props.custom.css || ""));
          const about = String(n.props.custom.description || "").replace(/--/g, "-").slice(0, 300);
          return `<!-- section: ${n.type} (custom design, described by the user: ${about}) -->\n${n.props.custom.html}`;
        }
        const variant = getVariant(n.type, n.variant);
        if (!variant) return `<!-- ${n.type} (${n.variant}): no preview -->`;
        try {
          return `<!-- section: ${n.type} (${n.variant}) -->\n` + renderHtml(createElement(Fragment, null, variant.render(n.props)));
        } catch {
          return `<!-- ${n.type} (${n.variant}): could not be rendered -->`;
        }
      });
    pages[page.name] = parts.join("\n").slice(0, MAX_PAGE_HTML);
  }

  const mode = project.theme?.mode || "light";
  const spec = (project.theme as any)?.design?.spec as StyleSpec | undefined;
  let root = `<div class="site-preview theme-${mode}">`;
  if (spec) {
    const full = { ...spec, mode } as StyleSpec;
    const attrs = Object.entries(siteAttrs(full)).map(([k, v]) => `${k}="${v}"`).join(" ");
    const vars = Object.entries(cssVarsFor(full, buildTokens(full), mode)).map(([k, v]) => `${k}: ${v}`).join("; ");
    root = `<div class="site-preview" ${attrs} style="${vars}">`;
  }
  const used = new Set<string>();
  for (const html of Object.values(pages)) for (const c of classesIn(html)) used.add(c);
  return { root, css: [...customCss, collectCss(used)].join("\n").slice(0, MAX_CSS), pages };
}
