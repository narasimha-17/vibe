"use client";

import { useEffect, useState } from "react";

const PROMPT = "Add a pricing section and make the palette blue and purple.";
type State = "hidden" | "pending" | "applied" | "rejected";

const OPS = [
  { op: "add_component", text: "Add a pricing section", meta: "pricing · tiered" },
  { op: "update_theme", text: "Set primary #3b82f6, secondary #7c5cff", meta: "2 tokens" },
];

/** Futuristic AI console: types a prompt, streams typed operations, lets you apply / reject each. */
export function AiConsole() {
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<"typing" | "thinking" | "ready">("typing");
  const [states, setStates] = useState<State[]>(["hidden", "hidden"]);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    setTyped(0);
    setPhase("typing");
    setStates(["hidden", "hidden"]);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(PROMPT.length);
      setPhase("ready");
      setStates(["applied", "pending"]);
      return;
    }
    for (let i = 1; i <= PROMPT.length; i++) at(500 + i * 32, () => setTyped(i));
    const t = 500 + PROMPT.length * 32;
    at(t + 200, () => setPhase("thinking"));
    at(t + 1300, () => {
      setPhase("ready");
      setStates(["pending", "hidden"]);
    });
    at(t + 1800, () => setStates(["pending", "pending"]));
    at(t + 2800, () => setStates((s) => [s[0] === "pending" ? "applied" : s[0], s[1]]));
    return () => timers.forEach(clearTimeout);
  }, [run]);

  const set = (i: number, v: State) => setStates((s) => s.map((x, j) => (j === i ? v : x)));
  const themed = states[1] === "applied";

  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-[#6b4d9a]/40 via-[#b79be6]/25 to-[#ff5b7f]/25 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#241a3a]/90 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur">
        {/* scan line */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-24 animate-[ai-scan_4.5s_linear_infinite] bg-gradient-to-b from-transparent via-[#ff5b7f]/10 to-transparent" />

        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#ff8fb1]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff5b7f] shadow-[0_0_10px_#ff5b7f]" /> vibe.ai · online
          </div>
          <button onClick={() => setRun((r) => r + 1)} className="font-mono text-[11px] text-[#8b83b5] transition hover:text-white">
            ↻ replay
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-[#b79be6]/40 bg-[#b79be6]/10 px-4 py-3 font-mono text-[13px] leading-relaxed text-[#e9e2fb]">
            <span className="text-[#ff5b7f]">&gt;</span> {PROMPT.slice(0, typed)}
            {phase === "typing" && <span className="ml-0.5 inline-block h-4 w-[7px] animate-pulse bg-[#ff5b7f] align-middle" />}
          </div>

          {phase === "thinking" && (
            <div className="flex items-center gap-2 font-mono text-xs text-[#8b83b5]">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <i key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff5b7f]" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
              reading component tree…
            </div>
          )}

          {phase === "ready" && <div className="font-mono text-xs text-[#8b83b5]">{"// 2 typed operations · review each before it touches your page"}</div>}

          <div className="space-y-2.5">
            {OPS.map((o, i) => {
              const st = states[i];
              if (st === "hidden") return null;
              const glow =
                st === "applied"
                  ? "border-[#34d399]/50 shadow-[0_0_24px_rgba(52,211,153,0.15)]"
                  : st === "rejected"
                    ? "border-white/10 opacity-50"
                    : "border-[#ff5b7f]/40";
              return (
                <div key={o.op} className={`flex animate-[fade-in_.4s_ease-out] items-center justify-between gap-3 rounded-xl border bg-white/[0.04] px-4 py-3 transition ${glow}`}>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#ff8fb1]">
                      {o.op} <span className="text-[#6b638f]">· {o.meta}</span>
                    </div>
                    <div className={`text-sm font-semibold text-white ${st === "rejected" ? "line-through" : ""}`}>{o.text}</div>
                    {i === 1 && (
                      <div className="mt-2 flex gap-1.5" aria-hidden="true">
                        {(themed ? ["#3b82f6", "#7c5cff", "#b79be6"] : ["#6b4d9a", "#ff5b7f", "#b79be6"]).map((c) => (
                          <span key={c} className="h-3 w-8 rounded-full transition-colors duration-700" style={{ background: c }} />
                        ))}
                      </div>
                    )}
                  </div>
                  {st === "pending" ? (
                    <span className="flex shrink-0 gap-1.5 text-xs font-bold">
                      <button
                        onClick={() => set(i, "applied")}
                        className="rounded-lg bg-gradient-to-r from-[#ff5b7f] to-[#b79be6] px-3 py-1.5 text-white shadow-[0_0_16px_rgba(255,91,127,0.4)] transition hover:scale-105"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => set(i, "rejected")}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-[#b9adda] transition hover:border-[#ff5b7f] hover:text-[#ff8fb1]"
                      >
                        Reject
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => set(i, "pending")}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${st === "applied" ? "bg-[#34d399]/15 text-[#6ee7b7]" : "bg-white/10 text-[#b9adda]"}`}
                      title="Undo"
                    >
                      {st === "applied" ? "Applied ✓ · undo" : "Rejected · undo"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
