"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FAQS = [
  {
    q: "Do I actually own the code VIBE generates?",
    a: "Yes. Every export is a complete, standalone Next.js/React/HTML project with no VIBE runtime dependency. Download it or push it to your own GitHub repo and keep developing anywhere.",
  },
  {
    q: "Is the code generation AI-powered or deterministic?",
    a: "The exporter is a deterministic engine: the same design always produces the same files. AI is only involved when you explicitly ask it to add or restyle something in the editor — never in the final code generation step.",
  },
  {
    q: "Can I use my own components after exporting?",
    a: "Yes. Generated components (Navbar.tsx, Hero.tsx, etc.) are plain React/HTML — edit them like any other file in your codebase.",
  },
  {
    q: "What frameworks can I export to?",
    a: "Next.js, React (Vite), or plain HTML/CSS/JS, with TypeScript or JavaScript and Tailwind or plain CSS.",
  },
  {
    q: "Does VIBE support responsive design?",
    a: "Yes — every project has desktop, tablet, and mobile breakpoints, and the generated output is genuinely responsive, not a scaled-down desktop layout.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const [shown, setShown] = useState(0);
  const answer = FAQS[open].a;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(answer.length);
    setShown(0);
    const id = setInterval(() => setShown((n) => (n >= answer.length ? (clearInterval(id), n) : n + 3)), 16);
    return () => clearInterval(id);
  }, [answer]);

  const typing = shown < answer.length;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.15fr]">
      {/* questions */}
      <div className="space-y-2.5">
        {FAQS.map((f, i) => {
          const on = open === i;
          return (
            <button
              key={i}
              onClick={() => setOpen(i)}
              aria-pressed={on}
              className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition duration-300 ${
                on
                  ? "border-transparent bg-[#6b4d9a] text-white shadow-[0_16px_34px_rgba(107,77,154,0.4)] lg:translate-x-3"
                  : "border-[#d6c9ee] bg-white text-[#3b2d5a] hover:-translate-y-0.5 hover:border-[#b79be6]"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-mono text-xs font-bold ${
                  on ? "bg-white/20 text-white" : "bg-[#f0e6fb] text-[#6b4d9a]"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[15px] font-semibold leading-snug">{f.q}</span>
              <span className={`transition-transform duration-300 ${on ? "translate-x-0 text-[#ff8fb1]" : "text-[#b79be6] group-hover:translate-x-1"}`}>→</span>
            </button>
          );
        })}
      </div>

      {/* answer panel */}
      <div className="relative lg:sticky lg:top-28 lg:self-start">
        <div className="absolute -inset-3 -z-10 rounded-[2.2rem] bg-gradient-to-br from-[#6b4d9a]/25 to-[#ff5b7f]/20 blur-2xl" />
        <div className="overflow-hidden rounded-3xl bg-[#1b1330] text-white shadow-[0_30px_60px_rgba(43,33,64,0.4)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b9adda]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#9be7c4]" /> VIBE help · live
          </div>
          <div className="space-y-4 px-5 py-6">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#6b4d9a] px-4 py-3 text-sm font-medium">{FAQS[open].q}</div>
            <div className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff5b7f] to-[#6b4d9a] text-xs font-extrabold">V</span>
              <div className="min-h-[7.5rem] rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-3 text-sm leading-relaxed text-[#e9e2fb]">
                {answer.slice(0, shown)}
                {typing && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[#ff8fb1] align-middle" />}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-5 py-3 text-xs text-[#b9adda]">
            <span>Question {open + 1} of {FAQS.length}</span>
            <Link href="/signup" className="font-bold text-[#ff8fb1] hover:text-white">
              Try it yourself
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
