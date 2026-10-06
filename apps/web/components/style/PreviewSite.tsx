"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getVariant, REGISTRY } from "@/lib/registry";
import { buildTokens, cssVarsFor, fontsOf, siteAttrs } from "@/lib/style/engine";
import { ensureFonts } from "@/lib/style/fonts";
import type { Mode, StyleSpec } from "@/lib/style/types";

function block(type: string, variant: string, props: Record<string, unknown> = {}) {
  const def = REGISTRY[type];
  if (!def) return null;
  const v = getVariant(type, variant) || def.variants[0];
  return v.render({ ...def.defaultProps, ...props });
}

/** Renders children at a fixed design width and scales to the container, tracking the true content height. */
export function ScaledFrame({ width, children, maxHeight }: { width: number; children: React.ReactNode; maxHeight?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [h, setH] = useState(600);

  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const update = () => {
      setScale(o.clientWidth / width);
      setH(i.offsetHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width]);

  const height = Math.min(h * scale, maxHeight ?? Infinity);
  return (
    <div ref={outer} className="relative w-full overflow-hidden" style={{ height: scale ? height : 400 }}>
      <div ref={inner} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left", visibility: scale ? "visible" : "hidden" }}>
        {children}
      </div>
    </div>
  );
}

export function useStyleVars(spec: StyleSpec, mode?: Mode) {
  return useMemo(() => {
    const tokens = buildTokens(spec);
    return { tokens, vars: cssVarsFor(spec, tokens, mode ?? spec.mode) as React.CSSProperties, attrs: siteAttrs(spec) };
  }, [spec, mode]);
}

const LOGOS = ["Northwind", "Acme", "Globex", "Initech", "Umbra"];

export function LandingSample({ spec }: { spec: StyleSpec }) {
  const brand = spec.name.split(" ")[0];
  return (
    <>
      {block("navbar", spec.nav === "brutal" ? "dark" : spec.nav === "minimal" ? "minimal" : "default", { brand, links: ["Product", "Pricing", "Docs"] })}
      {block("hero", spec.hero === "centered" ? "centered" : "split", {
        headline: "Design that feels like you.",
        subheadline: `A ${spec.mood.toLowerCase()} interface, generated from ${spec.name}. Every value stays editable.`,
        primaryCta: "Get started",
        secondaryCta: "Learn more",
      })}
      {block("features", "grid", {
        heading: "Everything, in one language.",
        subheading: "Type, color, shape and motion move together.",
        items: [
          { title: "Semantic tokens", text: "Roles, not raw hex values." },
          { title: "Consistent motion", text: "One easing curve everywhere." },
          { title: "Accessible by default", text: "Contrast-checked pairs." },
        ],
      })}
      {block("stats", "cards")}
      {block("pricing", "tiered")}
      {block("testimonials", "default")}
      {block("forms", "contact", { heading: "Say hello.", subheading: "We reply within a day." })}
      {block("cta", "default")}
      {block("footer", "columns", { brand })}
    </>
  );
}

export function ComponentsSample({ spec }: { spec: StyleSpec }) {
  return (
    <div className="sp-wrap">
      <div>
        <h3 className="sp-h">Buttons &amp; badges</h3>
        <div className="sp-row">
          <button className="sp-btn--primary">Primary</button>
          <button>Secondary</button>
          <button disabled style={{ opacity: 0.5 }}>Disabled</button>
          <span className="sp-badge">New</span>
          <span className="sp-badge sp-badge--ok">✓ Live</span>
          <span className="sp-badge sp-badge--warn">! Review</span>
          <span className="sp-badge sp-badge--err">✕ Failed</span>
        </div>
      </div>
      <div>
        <h3 className="sp-h">Tabs</h3>
        <div className="sp-tabs">
          <span className="sp-tab sp-tab--on">Overview</span>
          <span className="sp-tab">Activity</span>
          <span className="sp-tab">Settings</span>
        </div>
      </div>
      <div>
        <h3 className="sp-h">Dashboard</h3>
        <div className="sp-dash">
          {[["₹4.2L", "Revenue"], ["1,284", "Active users"], ["98.2%", "Uptime"]].map(([v, l], i) => (
            <div key={l} className="sp-card sp-kpi" style={{ padding: "var(--s-sp-5)" }}>
              <span>{l}</span>
              <strong>{v}</strong>
              <div className="sp-bars" aria-hidden="true">
                {[40, 65, 50, 80, 60, 92, 70].map((b, j) => (
                  <i key={j} style={{ height: `${b - i * 6}%`, opacity: 0.45 + j * 0.08 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="sp-h">Table</h3>
        <table className="sp-table">
          <thead><tr><th>Project</th><th>Owner</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            {[["Website redesign", "Asha", "ok", "Live"], ["Mobile app", "Rohan", "warn", "In review"], ["Docs portal", "Meera", "err", "Blocked"]].map(([a, b, t, s]) => (
              <tr key={a}><td>{a}</td><td>{b}</td><td><span className={`sp-badge sp-badge--${t}`}>{s}</span></td><td>2h ago</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sp-row" style={{ alignItems: "flex-start", gap: "var(--s-sp-6)" }}>
        <div className="sp-modal">
          <h3 className="sp-h" style={{ marginBottom: 6 }}>Invite teammate</h3>
          <p style={{ margin: "0 0 var(--s-sp-4)" }}>They&apos;ll get an email with access to this workspace.</p>
          <input placeholder="name@company.com" className="form-input" style={{ width: "100%", padding: "10px 14px", marginBottom: "var(--s-sp-4)" }} />
          <div className="sp-row" style={{ justifyContent: "flex-end" }}>
            <button>Cancel</button>
            <button className="sp-btn--primary">Send invite</button>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 className="sp-h">Inputs</h3>
          <div style={{ display: "grid", gap: "var(--s-sp-3)" }}>
            <input placeholder="Text input" style={{ padding: "10px 14px" }} />
            <select style={{ padding: "10px 14px" }}><option>Select an option</option></select>
            <textarea placeholder="Message" rows={3} style={{ padding: "10px 14px" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Live site preview in the chosen style. `page` picks the landing page or the component gallery. */
export function PreviewSite({ spec, mode, page = "landing", width = 1100 }: { spec: StyleSpec; mode?: Mode; page?: "landing" | "components"; width?: number }) {
  const { vars, attrs } = useStyleVars(spec, mode);
  useEffect(() => ensureFonts(fontsOf(spec)), [spec.heading, spec.body, spec.mono]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="site-preview" {...attrs} data-mode={mode ?? spec.mode} style={vars}>
      {page === "landing" ? <LandingSample spec={spec} /> : <ComponentsSample spec={spec} />}
    </div>
  );
}

/** Tiny live mini-website used on gallery cards. */
export function MiniSite({ spec }: { spec: StyleSpec }) {
  const { vars, attrs } = useStyleVars(spec);
  const brand = spec.name.split(" ")[0];
  return (
    <div className="sm" {...attrs} style={vars}>
      <div className="sm-mesh" />
      <div className="sm-nav">
        <span className="sm-brand">{brand}</span>
        <span className="sm-links"><i>Home</i><i>Work</i><i>About</i></span>
        <span className="sm-btn">Start</span>
      </div>
      <div className="sm-hero">
        <div>
          <h4 className="sm-h1">Design that<br />feels like you</h4>
          <p className="sm-p">A quick look at type, color, shape and motion.</p>
          <div className="sm-btns"><span className="sm-btn">Get started</span><span className="sm-btn sm-btn--2">Learn</span></div>
        </div>
        <span className="sm-orb" />
      </div>
      <div className="sm-cards">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sm-card"><b /><i /><i /></div>
        ))}
      </div>
    </div>
  );
}
