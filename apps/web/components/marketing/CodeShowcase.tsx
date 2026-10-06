"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Framework = "nextjs" | "react" | "html";
type Styling = "tailwind" | "css";
type Kind = "page" | "navbar" | "hero" | "pricing" | "html" | "css";

interface FileDef {
  path: string;
  kind: Kind;
}

const FILES: Record<Framework, FileDef[]> = {
  nextjs: [
    { path: "app/page.tsx", kind: "page" },
    { path: "components/Navbar.tsx", kind: "navbar" },
    { path: "components/Hero.tsx", kind: "hero" },
    { path: "components/Pricing.tsx", kind: "pricing" },
  ],
  react: [
    { path: "src/App.tsx", kind: "page" },
    { path: "src/components/Navbar.tsx", kind: "navbar" },
    { path: "src/components/Hero.tsx", kind: "hero" },
    { path: "src/components/Pricing.tsx", kind: "pricing" },
  ],
  html: [
    { path: "index.html", kind: "html" },
    { path: "assets/styles.css", kind: "css" },
  ],
};

function snippet(kind: Kind, styling: Styling): string {
  const tw = styling === "tailwind";
  switch (kind) {
    case "page":
      return `import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Pricing from "@/components/Pricing";

export default function Page() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Pricing />
    </main>
  );
}`;
    case "navbar":
      return `export default function Navbar() {
  return (
    <nav className="${tw ? "flex items-center justify-between px-10 py-5" : "navbar"}">
      <div className="${tw ? "text-xl font-black" : "navbar__brand"}">NOVA</div>
      <button className="${tw ? "rounded-lg bg-violet-700 px-4 py-2 text-white" : "navbar__cta"}">
        Get Started
      </button>
    </nav>
  );
}`;
    case "hero":
      return `export default function Hero() {
  return (
    <section className="${tw ? "grid gap-12 px-16 py-24 lg:grid-cols-2" : "hero hero--split"}">
      <h1 className="${tw ? "text-6xl font-bold tracking-tight" : "hero__title"}">
        Build something remarkable.
      </h1>
      <p className="${tw ? "text-lg text-slate-600" : "hero__text"}">
        Visual design in, clean code out.
      </p>
    </section>
  );
}`;
    case "pricing":
      return `export default function Pricing() {
  return (
    <section className="${tw ? "px-16 py-24 text-center" : "pricing"}">
      <h2 className="${tw ? "text-4xl font-bold" : "pricing__heading"}">Plans for everyone.</h2>
      <div className="${tw ? "mt-10 grid gap-6 sm:grid-cols-3" : "pricing__grid"}">
        {/* Starter · Pro · Business */}
      </div>
    </section>
  );
}`;
    case "html":
      return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NOVA</title>
  <link rel="stylesheet" href="assets/styles.css" />
</head>
<body>
  <nav class="navbar">…</nav>
  <section class="hero hero--split">…</section>
</body>
</html>`;
    case "css":
      return `:root {
  --primary: #6b4d9a;
  --accent: #ff5b7f;
  --radius: 12px;
}

.hero { padding: 96px 64px; }
.btn--primary {
  background: var(--primary);
  border-radius: var(--radius);
}`;
  }
}

const TOKEN = /(\/\/.*$|\/\*.*?\*\/|\{\/\*.*?\*\/\})|("[^"]*"|'[^']*')|(<\/?[A-Za-z][\w.]*|\/?>)|\b(import|export|default|function|return|from|const)\b|(--[\w-]+|\.[\w-]+(?=\s*\{))/g;

function Highlight({ code }: { code: string }) {
  const out: React.ReactNode[] = [];
  const lines = code.split("\n");
  lines.forEach((line, li) => {
    let last = 0;
    let m: RegExpExecArray | null;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(line))) {
      if (m.index > last) out.push(line.slice(last, m.index));
      const color = m[1] ? "#8a7db0" : m[2] ? "#9be7c4" : m[3] ? "#b79be6" : m[4] ? "#ff8fb1" : "#7dd3fc";
      out.push(
        <span key={`${li}-${m.index}`} style={{ color }}>
          {m[0]}
        </span>
      );
      last = m.index + m[0].length;
    }
    // Newline only between lines: a lone leading "\n" inside <pre> is dropped by the
    // browser's HTML parser, which breaks hydration when the server renders empty code.
    out.push(line.slice(last) + (li < lines.length - 1 ? "\n" : ""));
  });
  return <>{out}</>;
}

function Pill<T extends string>({ value, current, onPick, label }: { value: T; current: T; onPick: (v: T) => void; label: string }) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
        active ? "bg-[#ff5b7f] text-white shadow-[0_6px_16px_rgba(255,91,127,0.4)]" : "bg-white/10 text-[#d9d0f2] hover:bg-white/20"
      }`}
    >
      {label}
    </button>
  );
}

const PUSH_STEPS = ["Generating files", "Creating repository", "Committing", "Pushed to main"];

export function CodeShowcase() {
  const [framework, setFramework] = useState<Framework>("nextjs");
  const [styling, setStyling] = useState<Styling>("tailwind");
  const [fileIndex, setFileIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [pushStep, setPushStep] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const files = FILES[framework];
  const file = files[Math.min(fileIndex, files.length - 1)];
  const code = useMemo(() => snippet(file.kind, styling), [file.kind, styling]);

  useEffect(() => {
    setFileIndex(0);
  }, [framework]);

  useEffect(() => {
    clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(code.length);
      return;
    }
    setTyped(0);
    timer.current = setInterval(() => {
      setTyped((n) => {
        if (n >= code.length) {
          clearInterval(timer.current);
          return n;
        }
        return n + 4;
      });
    }, 14);
    return () => clearInterval(timer.current);
  }, [code]);

  useEffect(() => {
    if (pushStep === 0 || pushStep >= PUSH_STEPS.length) return;
    const t = setTimeout(() => setPushStep((s) => s + 1), 750);
    return () => clearTimeout(t);
  }, [pushStep]);

  const done = pushStep >= PUSH_STEPS.length;

  return (
    <section className="relative overflow-hidden bg-[#2b2140] px-6 py-24 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 85% 10%, rgba(255,91,127,0.22), transparent 38%), radial-gradient(circle at 5% 90%, rgba(183,155,230,0.25), transparent 40%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#ff8fb1]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5b7f]" /> Live export
          </div>
          <h2 className="mb-4 text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            Real code.
            <br />
            <span className="bg-gradient-to-r from-[#ff8fb1] to-[#b79be6] bg-clip-text text-transparent">Real repo.</span>
          </h2>
          <p className="mb-7 max-w-md text-[#d9d0f2]/80">
            Pick your stack and watch the exact files VIBE would hand you. Every component becomes a real source file — no lock-in, no blob.
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="w-20 text-[11px] font-bold uppercase tracking-wider text-[#d9d0f2]/60">Stack</span>
            <Pill value="nextjs" current={framework} onPick={setFramework} label="Next.js" />
            <Pill value="react" current={framework} onPick={setFramework} label="React" />
            <Pill value="html" current={framework} onPick={setFramework} label="HTML" />
          </div>
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="w-20 text-[11px] font-bold uppercase tracking-wider text-[#d9d0f2]/60">Styling</span>
            <Pill value="tailwind" current={styling} onPick={setStyling} label="Tailwind" />
            <Pill value="css" current={styling} onPick={setStyling} label="Plain CSS" />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-lg bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20">
              Download .ZIP
            </button>
            <button
              type="button"
              onClick={() => setPushStep(1)}
              disabled={pushStep > 0 && !done}
              className="rounded-lg bg-[#ff5b7f] px-5 py-3 text-sm font-bold shadow-[0_10px_24px_rgba(255,91,127,0.4)] transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {done ? "Push again" : "Push to GitHub"}
            </button>
          </div>

          {pushStep > 0 && (
            <ol className="mt-7 flex flex-col gap-2 text-sm">
              {PUSH_STEPS.map((label, i) => {
                const state = i + 1 < pushStep || done ? "done" : i + 1 === pushStep ? "active" : "todo";
                return (
                  <li key={label} className={`flex items-center gap-3 transition ${state === "todo" ? "opacity-35" : "opacity-100"}`}>
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${
                        state === "done" ? "bg-[#9be7c4] text-[#2b2140]" : state === "active" ? "animate-pulse bg-[#ff5b7f]" : "bg-white/15"
                      }`}
                    >
                      {state === "done" ? "✓" : ""}
                    </span>
                    {label}
                  </li>
                );
              })}
              {done && <li className="ml-8 font-mono text-xs text-[#9be7c4]">github.com/you/my-site · initial commit from VIBE</li>}
            </ol>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1f1733] shadow-[0_30px_80px_rgba(0,0,0,0.45)] [transform:perspective(1400px)_rotateY(-4deg)] transition-transform duration-500 hover:[transform:perspective(1400px)_rotateY(0deg)]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 font-mono text-xs text-[#d9d0f2]/70">my-site — {file.path}</span>
          </div>
          <div className="grid min-h-[340px] grid-cols-[190px_1fr]">
            <div className="border-r border-white/10 p-3 font-mono text-xs">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#d9d0f2]/40">Explorer</div>
              {files.map((f, i) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setFileIndex(i)}
                  className={`mb-0.5 block w-full truncate rounded px-2 py-1.5 text-left transition ${
                    i === fileIndex ? "bg-[#ff5b7f]/20 text-white" : "text-[#d9d0f2]/70 hover:bg-white/5"
                  }`}
                >
                  {f.path}
                </button>
              ))}
              <div className="mt-2 px-2 text-[#d9d0f2]/40">package.json</div>
              <div className="px-2 text-[#d9d0f2]/40">README.md</div>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-[#e9e2fb]">
              <Highlight code={code.slice(0, typed)} />
              {typed < code.length && <span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-[#ff5b7f]" />}
            </pre>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 bg-[#6b4d9a] px-4 py-1.5 font-mono text-[11px] text-white">
            <span>⎇ main</span>
            <span>{files.length + 2} files · {framework === "html" ? "HTML" : framework === "react" ? "React" : "Next.js"} · {styling === "tailwind" ? "Tailwind" : "CSS"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
