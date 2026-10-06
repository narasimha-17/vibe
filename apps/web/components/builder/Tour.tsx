"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const KEY = "vibe.tour.v1";

interface Step { target: string; title: string; body: string; side?: "right" | "left" | "bottom" | "top" }

const STEPS: Step[] = [
  { target: "palette", side: "right", title: "Add sections", body: "Click any block to add it to the page, such as a hero, pricing table or FAQ. Each block comes in several styles." },
  { target: "canvas", side: "left", title: "Your page", body: "This is your site. Click a section to select it, drag to reorder, and click text to edit it in place." },
  { target: "inspector", side: "left", title: "Change the details", body: "With a section selected, its text, images and options appear here. The Design System tab sets colours and fonts for the whole site." },
  { target: "pages", side: "bottom", title: "Pages", body: "Switch pages here. The + menu adds ready-made pages like Shop or Checkout, and “Pages from navbar” creates a page for every navbar link." },
  { target: "ai", side: "left", title: "Ask the assistant", body: "Type what you want in plain words: “add a cart button to the navbar”, “build me a full bakery site”, “translate this page to Hindi” or “review my design”." },
  { target: "checklist", side: "bottom", title: "Your checklist", body: "The goals you agreed with OORA. Items tick themselves as your site meets them, and you can tick the rest by hand." },
  { target: "publish", side: "bottom", title: "Publish in one click", body: "Put your site on the web at your own address, or connect your own domain. You can also export the code or push it to GitHub." },
];

export function startTour() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event("vibe:start-tour"));
}

function rectOf(target: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

/** A short walkthrough of the builder that runs the first time someone opens it, and any time from the Tour button. */
export function Tour({ ready }: { ready: boolean }) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const steps = useMemo(() => (active ? STEPS.filter((s) => rectOf(s.target)) : []), [active]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = steps[index];

  const finish = useCallback(() => {
    setActive(false);
    setIndex(0);
    try { localStorage.setItem(KEY, "done"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!ready) return;
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "done"; } catch { /* treat as unseen */ }
    if (!seen) {
      const t = setTimeout(() => setActive(true), 900); // let the builder settle first
      return () => clearTimeout(t);
    }
  }, [ready]);

  useEffect(() => {
    const start = () => { setIndex(0); setActive(true); };
    window.addEventListener("vibe:start-tour", start);
    return () => window.removeEventListener("vibe:start-tour", start);
  }, []);

  useLayoutEffect(() => {
    if (!active || !step) return;
    const update = () => { setRect(rectOf(step.target)); setSize({ w: window.innerWidth, h: window.innerHeight }); };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [active, step]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") setIndex((i) => (i < steps.length - 1 ? i + 1 : (finish(), i)));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, steps.length, finish]);

  if (!active || !step || !rect) return null;

  const pad = 8;
  const box = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const cardW = 340;
  const gap = 16;
  let top = box.top;
  let left = box.left + box.width + gap;
  const side = step.side || "right";
  if (side === "left") left = box.left - cardW - gap;
  if (side === "bottom") { top = box.top + box.height + gap; left = box.left + box.width / 2 - cardW / 2; }
  if (side === "top") { top = box.top - 190; left = box.left + box.width / 2 - cardW / 2; }
  left = Math.max(16, Math.min(left, size.w - cardW - 16));
  top = Math.max(16, Math.min(top, size.h - 220));
  const last = index === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[3000]" role="dialog" aria-modal="true" aria-label="Guided tour">
      <div className="pointer-events-none absolute rounded-2xl transition-all duration-300" style={{ ...box, boxShadow: "0 0 0 9999px rgba(20, 12, 40, 0.62)", outline: "2px solid rgba(255,255,255,0.85)" }} />
      <div className="absolute inset-0" onClick={finish} aria-hidden />
      <div className="absolute rounded-2xl bg-white p-5 text-slate-900 shadow-2xl" style={{ top, left, width: cardW }}>
        <button onClick={finish} aria-label="Skip the tour" className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#6b4d9a]">Step {index + 1} of {steps.length}</div>
        <h3 className="pr-6 text-base font-extrabold">{step.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{step.body}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" aria-hidden>{steps.map((_, i) => <i key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-[#6b4d9a]" : "w-1.5 bg-slate-200"}`} />)}</div>
          {index > 0 && <button onClick={() => setIndex(index - 1)} className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Back</button>}
          <button onClick={() => (last ? finish() : setIndex(index + 1))} className="rounded-full bg-[#6b4d9a] px-5 py-2 text-sm font-bold text-white hover:bg-[#5a3f86]">{last ? "Done" : "Next"}</button>
        </div>
        {!last && <button onClick={finish} className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-600">Skip the tour</button>}
      </div>
    </div>,
    document.body,
  );
}
