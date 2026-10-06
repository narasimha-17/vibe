"use client";

import { useEffect, useRef, useState } from "react";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

function CountUp({ to, active }: { to: number; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(to);
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to]);
  return <>{n}</>;
}

const BIG = "bg-gradient-to-br from-[#6b4d9a] to-[#ff5b7f] bg-clip-text text-7xl font-extrabold leading-none tracking-[-0.05em] text-transparent";
const CARD =
  "group relative flex flex-col overflow-hidden rounded-3xl border border-[#d6c9ee] bg-white p-7 shadow-[0_10px_30px_rgba(107,77,154,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(107,77,154,0.2)]";

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="mb-5 w-fit rounded-full bg-[#f0e6fb] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b4d9a]">{children}</span>;
}

export function FactsStrip() {
  const [ref, seen] = useInView<HTMLElement>();

  return (
    <section ref={ref} className="relative px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#3b2d5a] sm:text-4xl">Built to be owned, not rented.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[#7a69a3]">Four numbers that explain how VIBE treats your work.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* 14 blocks */}
          <div className={CARD}>
            <Tag>Library</Tag>
            <div className={BIG}>
              <CountUp to={14} active={seen} />
            </div>
            <div className="mt-4 text-base font-bold text-[#3b2d5a]">Block types</div>
            <div className="mb-6 text-sm text-[#7a69a3]">each with layout variants</div>
            <div className="mt-auto grid grid-cols-7 gap-1.5" aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  className="h-4 rounded-md bg-[#ece6fb] transition-colors duration-500"
                  style={{ transitionDelay: `${i * 70}ms`, ...(seen ? { background: i % 3 === 0 ? "#ff5b7f" : "#b79be6" } : {}) }}
                />
              ))}
            </div>
          </div>

          {/* 3 targets */}
          <div className={CARD}>
            <Tag>Export</Tag>
            <div className={BIG}>
              <CountUp to={3} active={seen} />
            </div>
            <div className="mt-4 text-base font-bold text-[#3b2d5a]">Export targets</div>
            <div className="mb-6 text-sm text-[#7a69a3]">one project, your choice of stack</div>
            <div className="mt-auto flex flex-wrap gap-2">
              {["Next.js", "React", "HTML"].map((t, i) => (
                <span
                  key={t}
                  className={`rounded-full border border-[#d6c9ee] bg-[#faf7ff] px-3 py-1 text-xs font-bold text-[#6b4d9a] transition-all duration-500 ${seen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
                  style={{ transitionDelay: `${300 + i * 150}ms` }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* 1:1 */}
          <div className={CARD}>
            <Tag>Output</Tag>
            <div className={BIG}>1:1</div>
            <div className="mt-4 text-base font-bold text-[#3b2d5a]">Deterministic output</div>
            <div className="mb-6 text-sm text-[#7a69a3]">same design in, same files out</div>
            <div className="mt-auto flex items-center gap-2 font-mono text-xs" aria-hidden="true">
              <span className="rounded-lg bg-[#3b2d5a] px-2.5 py-1.5 text-white">design</span>
              <span className={`h-0.5 flex-1 origin-left rounded bg-[#ff5b7f] transition-transform duration-700 ${seen ? "scale-x-100" : "scale-x-0"}`} />
              <span className="rounded-lg bg-[#3b2d5a] px-2.5 py-1.5 text-white">files</span>
            </div>
          </div>

          {/* 0 */}
          <div className={CARD}>
            <Tag>Freedom</Tag>
            <div className={BIG}>0</div>
            <div className="mt-4 text-base font-bold text-[#3b2d5a]">Lock-in</div>
            <div className="mb-6 text-sm text-[#7a69a3]">no runtime dependency on VIBE</div>
            <div className="mt-auto flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[11px] text-white">✓</span> Your repo, your code
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
