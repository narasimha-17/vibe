"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Monitor, Smartphone, Tablet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ScaledFrame, useStyleVars } from "@/components/style/PreviewSite";
import { getVariant, REGISTRY } from "@/lib/registry";
import { api } from "@/lib/api-client";
import { buildTokens, themePatch } from "@/lib/style/engine";
import { ALL_FONTS, ensureFonts } from "@/lib/style/fonts";
import { BASE_TAG, INDUSTRY, TAGS } from "@/lib/style/industry";
import type { TagId } from "@/lib/style/industry";
import { PRESET_BY_ID, PRESETS } from "@/lib/style/presets";
import { applyRecipe, BASE_LABEL, RECIPES, STYLE_BASE } from "@/lib/style/templates";
import type { Recipe } from "@/lib/style/templates";
import type { Node, ProjectDetail } from "@/lib/types";
import type { StyleSpec } from "@/lib/style/types";
import { toast } from "@/lib/toast";

interface ApiTemplate { key: string; label: string; description: string; pages: { name: string; path: string; tree: Node[] }[] }

/** One marketplace card. Industry templates carry their real content; style templates use a recipe. */
interface Card {
  id: string;
  tag: TagId;
  spec: StyleSpec;
  title: string;
  blurb: string;
  label: string;
  templateKey: string;
  nodes?: Node[]; // industry: home page content served by the API
  pages?: number;
  recipe?: Recipe; // style template
}

const FLOATING = new Set(["widget", "whatsapp", "bubble"]);

function block(type: string, variant: string, props: Record<string, unknown> = {}) {
  const def = REGISTRY[type];
  return def ? (getVariant(type, variant) || def.variants[0]).render({ ...def.defaultProps, ...props }) : null;
}

const renderNode = (n: Node) => block(n.type, n.variant, n.props);

/** Navbar + hero + the next section, exactly as the generated site will look. */
function TemplatePreview({ card }: { card: Card }) {
  const { vars, attrs } = useStyleVars(card.spec);
  const r = card.recipe;
  const content = r ? (r.base === "saas" || r.base === "agency" ? block("features", r.features) : block("cards", r.cards)) : null;
  return (
    <div>
      <ScaledFrame width={1100} maxHeight={250}>
        <div className="site-preview" {...attrs} style={vars}>
          {card.nodes ? (
            card.nodes.filter((n) => !(n.type === "chatbot" && FLOATING.has(n.variant))).slice(0, 3).map((n) => <div key={n.id}>{renderNode(n)}</div>)
          ) : (
            r && (
              <>
                {block("navbar", r.nav, { brand: r.brand, links: ["Home", "Work", "About", "Contact"] })}
                {block("hero", r.hero, { headline: r.headline, subheadline: r.sub, primaryCta: r.primary, secondaryCta: r.secondary })}
                {content}
              </>
            )
          )}
        </div>
      </ScaledFrame>
    </div>
  );
}

/** Whole-page preview of a template in its style. */
function FullPreview({ card, onClose, onUse, busy }: { card: Card; onClose: () => void; onUse: (c: Card) => void; busy: boolean }) {
  const { vars, attrs } = useStyleVars(card.spec);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const width = { desktop: 1100, tablet: 768, mobile: 390 }[device];
  const box = { desktop: "100%", tablet: "70%", mobile: "min(380px, 100%)" }[device];
  const r = card.recipe;
  const wide = r ? r.base === "saas" || r.base === "agency" : false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${card.title} preview`} className="fixed inset-0 z-[110] flex flex-col bg-[#1b1330]/85 backdrop-blur-md" onClick={onClose}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#180f2b] px-5 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold">{card.title}</div>
          <div className="text-[11px] text-[#ff8fb1]">{card.label} · {card.spec.name} style{card.pages && card.pages > 1 ? ` · ${card.pages} pages` : ""}</div>
        </div>
        <div className="mx-auto flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="radiogroup" aria-label="Device">
          {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
            <button key={d} role="radio" aria-checked={device === d} aria-label={d} onClick={() => setDevice(d)} className={`grid h-8 w-10 place-items-center rounded-lg transition ${device === d ? "bg-white/15 text-white" : "text-[#8b83b5] hover:text-white"}`}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <button className="btn btn-primary h-9" disabled={busy} onClick={() => onUse(card)}>{busy ? "Creating…" : "Use this template"}</button>
        <button onClick={onClose} aria-label="Close preview" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white transition hover:rotate-90"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto overflow-hidden rounded-xl shadow-[0_30px_80px_rgba(0,0,0,0.5)] transition-[width] duration-500" style={{ width: box }}>
          <ScaledFrame width={width}>
            <div className="site-preview" {...attrs} style={vars}>
              {card.nodes
                ? card.nodes.filter((n) => !(n.type === "chatbot" && FLOATING.has(n.variant))).map((n) => <div key={n.id}>{renderNode(n)}</div>)
                : r && (
                    <>
                      {block("navbar", r.nav, { brand: r.brand, links: ["Home", "Work", "About", "Contact"] })}
                      {block("hero", r.hero, { headline: r.headline, subheadline: r.sub, primaryCta: r.primary, secondaryCta: r.secondary })}
                      {wide ? block("features", r.features) : block("cards", r.cards)}
                      {wide ? block("pricing", r.pricing) : block("forms", r.forms)}
                      {block("testimonials", r.testimonials)}
                      {block("cta", r.cta)}
                      {block("footer", r.footer, { brand: r.brand })}
                    </>
                  )}
            </div>
          </ScaledFrame>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ c, onUse, onPreview, busy }: { c: Card; onUse: (c: Card) => void; onPreview: (c: Card) => void; busy: boolean }) {
  const pal = useMemo(() => buildTokens(c.spec).colors[c.spec.mode], [c.spec]);
  const types = c.nodes ? Array.from(new Set(c.nodes.map((n) => n.type))).filter((t) => !["navbar", "footer"].includes(t)).slice(0, 5) : [];
  return (
    <div className="group flex flex-col overflow-hidden rounded-3xl border border-border-light bg-surface shadow-[0_10px_30px_rgba(59,45,90,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(59,45,90,0.2)]">
      <div className="relative h-[250px] overflow-hidden border-b border-border-light">
        <TemplatePreview card={c} />
        <span className="absolute left-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">{c.label}</span>
        <span className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-main">{c.spec.mode === "dark" ? "Dark" : "Light"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-[17px] font-extrabold text-main">{c.title}</p>
          <p className="text-xs font-semibold text-accent">{c.spec.name} style</p>
        </div>
        <p className="line-clamp-2 flex-1 text-xs text-muted">{c.blurb}</p>
        {types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {types.map((t) => <span key={t} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-primary">{REGISTRY[t]?.label || t}</span>)}
            {(c.pages || 1) > 1 && <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{c.pages} pages</span>}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[pal.primary, pal.secondary, pal.accent, pal.background, pal.surface].map((col, i) => <span key={i} className="h-5 w-5 rounded-full border border-black/10" style={{ background: col }} />)}
          </div>
          <span className="text-xl leading-none text-main" style={{ fontFamily: `'${c.spec.heading}', serif` }}>Aa</span>
        </div>
        <div className="mt-1 grid grid-cols-[auto_1fr] gap-2">
          <button className="btn justify-center" onClick={() => onPreview(c)}><Eye className="h-4 w-4" /> Preview</button>
          <button className="btn btn-primary justify-center" disabled={busy} onClick={() => onUse(c)}>{busy ? "Creating…" : "Use this template"}</button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | TagId>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<Card | null>(null);
  const [api_, setApiTemplates] = useState<ApiTemplate[]>([]);

  useEffect(() => ensureFonts(ALL_FONTS), []);
  useEffect(() => {
    api.get<ApiTemplate[]>("projects/templates?full=true").then(setApiTemplates).catch(() => setApiTemplates([]));
  }, []);

  const cards: Card[] = useMemo(() => {
    const industry: Card[] = api_
      .filter((t) => INDUSTRY[t.key])
      .map((t) => {
        const meta = INDUSTRY[t.key];
        const tag = TAGS.find((x) => x.id === meta.tag)!;
        return {
          id: t.key,
          tag: meta.tag,
          spec: PRESET_BY_ID[meta.style],
          title: t.label,
          blurb: t.description,
          label: tag.label,
          templateKey: t.key,
          nodes: t.pages[0]?.tree || [],
          pages: t.pages.length,
        };
      });
    const styled: Card[] = PRESETS.map((p) => ({
      id: p.id,
      tag: BASE_TAG[STYLE_BASE[p.id]],
      spec: p,
      title: p.name,
      blurb: p.blurb,
      label: BASE_LABEL[STYLE_BASE[p.id]],
      templateKey: STYLE_BASE[p.id],
      recipe: RECIPES[p.id],
    }));
    return [...industry, ...styled];
  }, [api_]);

  /** Using a template starts the requirements conversation first, on its own page. */
  function create(c: Card) {
    try {
      sessionStorage.setItem("vibe.guide.preset", JSON.stringify({ templateKey: c.templateKey, title: c.title, spec: c.spec, recipe: c.recipe }));
    } catch {}
    router.push("/start");
  }

  async function createBlank() {
    setBusyId("blank");
    try {
      const project = await api.post<{ id: string }>("projects", { name: "Untitled Project", template_key: null });
      router.push(`/builder/${project.id}`);
    } catch {
      toast("Couldn't create the project.");
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: cards.length };
    for (const c of cards) m[c.tag] = (m[c.tag] || 0) + 1;
    return m;
  }, [cards]);
  const list = cards.filter((c) => filter === "all" || c.tag === filter);

  return (
    <div className="min-h-screen bg-app">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl px-8 py-10">
        <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-main">Template Marketplace</h1>
        <p className="mb-6 text-sm text-muted">{cards.length} templates across industries. Each one has its own style, layout and components, and is fully customizable afterward.</p>

        <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter templates">
          {([{ id: "all" as const, label: "All" }, ...TAGS]).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${filter === t.id ? "border-primary bg-primary text-white shadow-md" : "border-border-light bg-surface text-muted hover:border-primary hover:text-primary"}`}
            >
              {t.label} <span className="ml-1 opacity-70">{counts[t.id] || 0}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <button
            className="flex min-h-[22rem] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border-light bg-surface/60 p-10 text-center transition hover:-translate-y-1.5 hover:border-primary"
            disabled={busyId === "blank"}
            onClick={createBlank}
          >
            <div className="text-4xl text-primary">＋</div>
            <p className="text-lg font-bold text-main">Blank Canvas</p>
            <p className="max-w-[14rem] text-xs text-muted">Start from scratch with just a navbar, hero, and footer.</p>
          </button>
          {list.map((c) => (
            <TemplateCard key={c.id} c={c} busy={busyId === c.id} onPreview={setPreviewing} onUse={create} />
          ))}
        </div>
        {list.length === 0 && <p className="mt-10 text-center text-sm text-muted">Loading templates…</p>}
      </main>
      {previewing && <FullPreview card={previewing} busy={busyId === previewing.id} onClose={() => setPreviewing(null)} onUse={create} />}
    </div>
  );
}
