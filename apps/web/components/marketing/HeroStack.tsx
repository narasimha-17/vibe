"use client";

import { useEffect, useState } from "react";
import { getVariant, REGISTRY } from "@/lib/registry";
import { FitScale } from "./FitScale";

const PROMPT = "Add a pricing section";

function block(type: string, variant: string, props: Record<string, unknown> = {}) {
  const def = REGISTRY[type];
  return getVariant(type, variant)?.render({ ...def.defaultProps, ...props });
}

const NAVBAR = { brand: "NOVA", links: ["Product", "Pricing", "Docs"] };
const HERO = {
  headline: "Ship your SaaS in days, not months.",
  subheadline: "Auth, billing and a polished UI, ready on day one.",
  primaryCta: "Start free trial",
  secondaryCta: "View demo",
};
const PRICING = {
  heading: "Plans for every team.",
  tiers: [
    { name: "Starter", price: "₹499", unit: "per month", features: ["Core features", "Email support"], button: "Get started" },
    { name: "Pro", price: "₹999", unit: "per month", featured: true, features: ["All features", "Priority support"], button: "Choose Pro" },
    { name: "Business", price: "₹2,499", unit: "per month", features: ["Teams", "SSO"], button: "Choose Business" },
  ],
};

/** Interactive hero: the same component tree drives the canvas, the structure and the generated code. */
export function HeroStack() {
  const [applied, setApplied] = useState(false);
  const [typed, setTyped] = useState(0);
  const [flash, setFlash] = useState(0); // 1 canvas · 2 tree · 3 code

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setApplied(true);
      setTyped(PROMPT.length);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const cycle = () => {
      setApplied(false);
      setTyped(0);
      setFlash(0);
      for (let i = 1; i <= PROMPT.length; i++) at(1500 + i * 70, () => setTyped(i));
      const done = 1500 + PROMPT.length * 70 + 500;
      at(done, () => {
        setApplied(true);
        setFlash(1);
      });
      at(done + 500, () => setFlash(2));
      at(done + 1000, () => setFlash(3));
      at(done + 1600, () => setFlash(0));
      at(done + 5200, cycle);
    };
    cycle();
    return () => timers.forEach(clearTimeout);
  }, []);

  const ring = (n: number) => (flash === n ? "0 0 0 3px #ff5b7f, 0 24px 50px rgba(255,91,127,0.35)" : "0 24px 50px rgba(43,33,64,0.22)");
  const kw = "text-[#ff8fb1]";
  const str = "text-[#9be7c4]";

  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/25 via-accent/15 to-transparent blur-3xl" />

      <FitScale baseWidth={640} ratio={0.93}>
        <div className="relative h-[595px] w-[640px]">
          {/* AI prompt */}
          <div className="absolute left-0 top-0 z-30 flex items-center gap-2 rounded-full border border-[#d6c9ee] bg-white px-4 py-2 text-[13px] shadow-lg">
            <span className="text-[#ff5b7f]">✦</span>
            <span className={typed ? "font-medium text-[#3b2d5a]" : "text-[#a08bc4]"}>
              {typed ? PROMPT.slice(0, typed) : "Ask AI to change your site…"}
              {typed > 0 && typed < PROMPT.length && <span className="ml-px inline-block h-3.5 w-px animate-pulse bg-[#6b4d9a] align-middle" />}
            </span>
            {applied && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Applied</span>}
          </div>

          {/* canvas window */}
          <div className="absolute left-0 top-14 h-[350px] w-[640px] overflow-hidden rounded-2xl border border-[#d6c9ee] bg-white transition-shadow duration-500" style={{ boxShadow: ring(1) }}>
            <div className="flex h-8 items-center gap-1.5 border-b border-[#ece6fb] bg-[#faf7ff] px-3">
              <i className="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <i className="h-2 w-2 rounded-full bg-[#febc2e]" />
              <i className="h-2 w-2 rounded-full bg-[#28c840]" />
              <span className="mx-auto rounded-full bg-[#f0e6fb] px-3 py-0.5 text-[10px] font-semibold text-[#6b4d9a]">Visual canvas</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 top-8 overflow-hidden">
              <FitScale baseWidth={1100} ratio={318 / 640} className="site-preview">
                <div className="transition-transform duration-[1000ms] ease-out" style={{ transform: `translateY(${applied ? -330 : 0}px)` }}>
                  {block("navbar", "default", NAVBAR)}
                  {block("hero", "split", HERO)}
                  <div className="overflow-hidden transition-all duration-700" style={{ maxHeight: applied ? 900 : 0, opacity: applied ? 1 : 0 }}>
                    {block("pricing", "tiered", PRICING)}
                  </div>
                </div>
              </FitScale>
            </div>
          </div>

          {/* component tree card */}
          <div className="absolute bottom-0 left-0 z-20 h-[170px] w-[240px] overflow-hidden rounded-2xl border border-white/10 bg-[#241a3a] transition-shadow duration-500" style={{ boxShadow: ring(2) }}>
            <span className="m-3 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d9d0f2]">Component tree</span>
            <div className="space-y-1.5 px-4 font-mono text-[11.5px] text-[#d9d0f2]">
              <div>page <span className={str}>&quot;/&quot;</span></div>
              {["navbar", "hero"].map((t) => (
                <div key={t} className="flex items-center gap-2 pl-3">
                  <span className="text-[#8a7db0]">├─</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5">{t}</span>
                </div>
              ))}
              <div className={`flex items-center gap-2 pl-3 transition-all duration-500 ${applied ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"}`}>
                <span className="text-[#8a7db0]">└─</span>
                <span className="rounded bg-[#ff5b7f] px-1.5 py-0.5 font-bold text-white">pricing</span>
              </div>
            </div>
          </div>

          {/* code card */}
          <div className="absolute bottom-0 right-0 z-20 h-[170px] w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-[#1b1330] transition-shadow duration-500" style={{ boxShadow: ring(3) }}>
            <span className="m-3 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d9d0f2]">page.tsx</span>
            <pre className="px-4 font-mono text-[11px] leading-[1.6] text-[#e9e2fb]">
              <span className={kw}>import</span> Hero <span className={kw}>from</span> <span className={str}>&quot;@/components/Hero&quot;</span>
              {"\n"}
              <span className={`transition-opacity duration-500 ${applied ? "opacity-100" : "opacity-0"}`}>
                <span className={kw}>import</span> Pricing <span className={kw}>from</span> <span className={str}>&quot;@/components/Pricing&quot;</span>
              </span>
              {"\n\n"}
              <span className={kw}>export default function</span> <span className="text-[#7dd3fc]">Page</span>() {"{"}
              {"\n"}  <span className={kw}>return</span> <span className="text-[#b79be6]">&lt;main&gt;</span>
              {"\n"}    <span className="text-[#b79be6]">&lt;Hero /&gt;</span>
              {"\n"}    <span className={`text-[#b79be6] transition-opacity duration-500 ${applied ? "opacity-100" : "opacity-0"}`}>&lt;Pricing /&gt;</span>
              {"\n"}  <span className="text-[#b79be6]">&lt;/main&gt;</span>
            </pre>
          </div>
        </div>
      </FitScale>
    </div>
  );
}
