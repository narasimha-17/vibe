import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CodeShowcase } from "@/components/marketing/CodeShowcase";
import { AiConsole } from "@/components/marketing/AiConsole";
import { HeroSection } from "@/components/marketing/HeroSection";
import { FactsStrip } from "@/components/marketing/FactsStrip";
import { FeatureBento } from "@/components/marketing/FeatureBento";
import { TemplateGallery } from "@/components/marketing/TemplateGallery";
import { PricingShowcase } from "@/components/marketing/PricingShowcase";

const STEPS = [
  { title: "Start from a template or a blank page", text: "Pick a layout that fits — SaaS, portfolio, agency, restaurant — or describe your idea and let VIBE outline the pages." },
  { title: "Build visually", text: "Drag blocks onto the canvas, reorder sections and edit copy, colors and spacing from the inspector. Undo is always one shortcut away." },
  { title: "Refine with AI", text: "Ask for a new section or a new palette. VIBE proposes small, typed changes; you apply or reject each one." },
  { title: "Export the real project", text: "Download a ZIP or push to a new GitHub repository. Components become real files you can keep building on." },
];

const COMPARE: [string, boolean, boolean][] = [
  ["Exports clean, readable source code", true, false],
  ["Push straight to your own GitHub repo", true, false],
  ["AI edits are reviewable one by one", true, false],
  ["Design tokens update the whole site", true, true],
  ["Works without the builder after export", true, false],
  ["Drag-and-drop visual editing", true, true],
];

function Check({ on, hero }: { on: boolean; hero?: boolean }) {
  if (hero)
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-extrabold text-[#6b4d9a] shadow-[0_4px_14px_rgba(0,0,0,0.25)]">✓</span>
    );
  return on ? (
    <span className="grid h-6 w-6 place-items-center rounded-full border border-[#d6c9ee] bg-[#f3edff] text-xs font-bold text-[#6b4d9a]">✓</span>
  ) : (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#fff0f3] text-xs font-bold text-[#ff5b7f]/70">✕</span>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-app">
      <MarketingNav />

      <HeroSection />

      <FactsStrip />

      {/* Features */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-accent">The editor</div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-main sm:text-5xl">Everything a real project needs.</h2>
          <p className="text-muted">Not a toy canvas: a design system, responsive breakpoints, history and reviewable AI, all in one editor.</p>
        </div>
        <FeatureBento />
      </section>

      {/* Workflow */}
      <section id="workflow" className="bg-panel px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-main sm:text-4xl">From idea to a repo you own.</h2>
          <p className="text-muted">Four steps, one continuous workflow — no copy-pasting between tools.</p>
        </div>
        <ol className="relative mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="pointer-events-none absolute left-[12%] right-[12%] top-5 hidden h-px bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 lg:block" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-border-light bg-surface p-6 shadow-[0_10px_30px_rgba(59,45,90,0.06)]">
              <span className="relative mb-4 grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-white shadow-[0_6px_16px_rgba(107,77,154,0.4)]">
                {i + 1}
              </span>
              <h3 className="mb-2 font-semibold text-main">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* AI */}
      <section id="ai" className="px-3 py-10 sm:px-5">
        <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2rem] bg-[#2b2140] px-6 py-20 text-white sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "linear-gradient(#b79be6 1px, transparent 1px), linear-gradient(90deg, #b79be6 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse at 70% 40%, #000, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at 70% 40%, #000, transparent 75%)",
            }}
          />
          <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#b79be6]/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#ff5b7f]/20 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ff5b7f]/40 bg-[#ff5b7f]/10 px-3.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#ff8fb1]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff5b7f] shadow-[0_0_8px_#ff5b7f]" /> AI assistant
              </div>
              <h2 className="mb-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                Describe it.
                <br />
                Review it.
                <br />
                <span className="bg-gradient-to-r from-[#b79be6] via-[#ff8fb1] to-[#ff5b7f] bg-clip-text text-transparent">Apply it.</span>
              </h2>
              <p className="mb-8 max-w-md leading-relaxed text-[#b9adda]">
                The assistant understands your component tree, so it answers with precise operations — add a section, change a theme value, restyle one
                block — instead of rewriting your page. You stay in control of every change.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  ["⌘", "Add, remove or restyle sections"],
                  ["◐", "Switch palettes and light/dark themes"],
                  ["↺", "Every change undoable with Ctrl/Cmd + Z"],
                  ["◇", "Works offline with built-in rules; plug in your own model"],
                ].map(([ic, t]) => (
                  <li
                    key={t}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-[13px] leading-snug text-[#d9d0f2] transition hover:border-[#ff5b7f]/50 hover:bg-white/[0.07]"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#ff5b7f]/30 to-[#b79be6]/30 font-mono text-sm text-[#ff8fb1]">{ic}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <AiConsole />
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="bg-panel px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-accent">Templates</div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-main sm:text-4xl">Start with something that looks finished.</h2>
          <p className="text-muted">Each template is a live layout built from the same blocks you edit — every piece stays fully customizable.</p>
        </div>
        <TemplateGallery />
      </section>

      <CodeShowcase />

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-accent">Pricing</div>
          <h2 className="text-3xl font-bold tracking-tight text-main sm:text-4xl">Start free. Upgrade when you ship.</h2>
        </div>
        <PricingShowcase />
      </section>

      {/* Comparison */}
      <section className="bg-panel px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.25em] text-accent">Compare</p>
          <h2 className="mb-3 text-center text-3xl font-extrabold tracking-tight text-main sm:text-4xl">Why teams pick VIBE.</h2>
          <p className="mb-12 text-center text-muted">A general comparison with most hosted page builders.</p>

          <div className="relative rounded-3xl border border-border-light bg-surface pb-2 shadow-[0_30px_70px_rgba(59,45,90,0.14)]">
            {/* highlighted VIBE column */}
            <div
              className="pointer-events-none absolute -bottom-3 -top-4 right-[134px] w-[122px] rounded-[1.75rem] bg-gradient-to-b from-[#6b4d9a] via-[#4f3a80] to-[#2b2140] shadow-[0_24px_50px_rgba(107,77,154,0.45)]"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                Recommended
              </span>
            </div>

            <div className="relative grid grid-cols-[1fr_110px_110px] items-center gap-2 px-5 pb-4 pt-7 text-xs font-bold uppercase tracking-[0.18em]">
              <span className="text-muted">Capability</span>
              <span className="text-center text-sm tracking-[0.25em] text-white">VIBE</span>
              <span className="text-center text-muted">Others</span>
            </div>

            {COMPARE.map(([label, vibe, other]) => (
              <div
                key={label}
                className="relative grid grid-cols-[1fr_110px_110px] items-center gap-2 border-t border-border-light px-5 py-4 text-sm transition-colors hover:bg-[#faf7ff]"
              >
                <span className="font-medium text-main">{label}</span>
                <span className="flex justify-center">
                  <Check on={vibe} hero />
                </span>
                <span className="flex justify-center">
                  <Check on={other} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-accent">FAQ</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-main sm:text-4xl">Questions, answered.</h2>
          <p className="mt-3 text-muted">Pick a question — VIBE replies.</p>
        </div>
        <FaqAccordion />
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#3b2d5a] via-primary to-[#a45bb8] px-8 py-16 text-center text-white shadow-[0_30px_70px_rgba(59,45,90,0.35)]">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <h2 className="relative mb-4 text-3xl font-extrabold tracking-tight sm:text-5xl">Build your first site today.</h2>
          <p className="relative mx-auto mb-8 max-w-xl text-white/80">Start on the free plan. Export the code whenever you&apos;re ready — it&apos;s yours from the first commit.</p>
          <Link href="/signup" className="btn relative h-12 justify-center border-0 bg-white px-8 text-base font-bold text-[#3b2d5a] hover:bg-white/90">
            Start building free
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
