"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import { buildTokens, cssVarsFor, fontsOf, siteAttrs } from "@/lib/style/engine";
import { ensureFonts } from "@/lib/style/fonts";
import type { StyleSpec } from "@/lib/style/types";

/** How a site preview is themed (the same thing the builder canvas does): attributes + CSS variables, or the plain light/dark class. */
export interface SiteFrame {
  className: string;
  attrs: Record<string, string>;
  style: CSSProperties;
}

export function useSiteFrame(theme: Record<string, any> | undefined): SiteFrame {
  const mode = (theme?.mode as "light" | "dark") || "light";
  const spec = theme?.design?.spec as StyleSpec | undefined;
  const styled = useMemo(() => {
    if (!spec) return null;
    const full = { ...spec, mode } as StyleSpec;
    return { attrs: siteAttrs(full), vars: cssVarsFor(full, buildTokens(full), mode) as CSSProperties, fonts: fontsOf(full) };
  }, [spec, mode]);
  useEffect(() => {
    if (styled) ensureFonts(styled.fonts);
  }, [styled]);
  return styled ? { className: "site-preview", attrs: styled.attrs, style: styled.vars } : { className: `site-preview theme-${mode}`, attrs: {}, style: {} };
}
