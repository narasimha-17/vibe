import Link from "next/link";
import { Anton } from "next/font/google";
import { siGithub, siHtml5, siInstagram, siNextdotjs, siReact, siX, siYoutube } from "simple-icons";
import { HeroStack } from "./HeroStack";

const display = Anton({ subsets: ["latin"], weight: "400" });

const CHIPS = [
  { text: "Published in 1 click", dot: "#22c55e", pos: "-right-2 top-6", dur: 5, delay: 0 },
  { text: "Pushed to GitHub", dot: "#6b4d9a", pos: "-left-6 top-[46%]", dur: 6, delay: 1.2 },
  { text: "AI: 3 changes ready", dot: "#ff5b7f", pos: "right-6 bottom-32", dur: 4.5, delay: 0.6 },
];

const SOCIAL = [siGithub, siX, siInstagram, siYoutube];
const STACK = [siNextdotjs, siReact, siHtml5, siGithub];

function Glyph({ icon, className = "h-5 w-5" }: { icon: { path: string; title: string }; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label={icon.title}>
      <path d={icon.path} />
    </svg>
  );
}

/** Dark, poster-style hero: social rail, condensed headline, chevron backdrop with the live builder demo. */
export function HeroSection() {
  return (
    <section className="px-3 pb-6 pt-2 sm:px-5">
      <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2rem] bg-[#f6f2fd] text-[#3b2d5a] shadow-[0_30px_70px_rgba(59,45,90,0.22)] ring-1 ring-[#d6c9ee]">
        {/* backdrop: chevron + ghost wordmark + dots */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-[62%]"
          style={{ background: "linear-gradient(135deg, #ece6fb 0%, #e3d9f7 100%)" }}
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 hidden h-[86%] w-[58%] bg-gradient-to-br from-[#6b4d9a] to-[#3b2d5a] lg:block"
          style={{ clipPath: "polygon(0 8%, 100% 42%, 100% 100%, 0 100%)" }}
        />
        <div
          className={`${display.className} pointer-events-none absolute -right-6 -top-6 hidden select-none text-[17rem] leading-none tracking-tight text-transparent lg:block`}
          style={{ WebkitTextStroke: "2px rgba(107,77,154,0.14)" }}
          aria-hidden="true"
        >
          VIBE
        </div>
        <div
          className="pointer-events-none absolute left-[42%] top-10 hidden h-28 w-28 opacity-60 lg:block"
          style={{ backgroundImage: "radial-gradient(#b79be6 1.5px, transparent 1.5px)", backgroundSize: "14px 14px" }}
        />

        <div className="relative grid gap-10 lg:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.25fr)]">
          {/* social rail */}
          <aside className="hidden flex-col items-center justify-between border-r border-[#d6c9ee] py-10 lg:flex">
            <div className="flex flex-col gap-6 text-[#6b4d9a]">
              {SOCIAL.map((s) => (
                <a key={s.title} href="#" aria-label={s.title} className="transition hover:scale-125 hover:text-[#ff5b7f]">
                  <Glyph icon={s} className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
            <a href="#features" className="flex flex-col items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6b4d9a]">
              <span style={{ writingMode: "vertical-rl" }}>Scroll down</span>
              <span className="animate-bounce">↓</span>
            </a>
          </aside>

          {/* copy */}
          <div className="relative flex flex-col justify-center px-6 pb-40 pt-14 lg:px-2 lg:pb-44 lg:pt-16">
            <span className="mb-7 w-fit rounded-sm bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b4d9a] shadow-sm">
              Open beta · Free plan available
            </span>
            <h1 className={`${display.className} text-[3.6rem] uppercase leading-[1] tracking-wide text-[#3b2d5a] sm:text-[4.6rem] lg:text-[3.4rem] xl:text-[4.4rem] 2xl:text-[5.2rem]`}>
              Design the site.
              <br />
              <span className="bg-gradient-to-r from-[#6b4d9a] to-[#ff5b7f] bg-clip-text text-transparent">Keep the code.</span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#7a69a3]">
              A drag-and-drop builder with an AI assistant that edits your design safely — and exports a clean Next.js, React or HTML project.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Link href="/signup" className="group flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#ff5b7f] shadow-[0_0_0_0_rgba(255,91,127,0.6)] transition group-hover:scale-110 group-hover:shadow-[0_0_0_10px_rgba(255,91,127,0.2)]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-px fill-white" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="text-sm font-semibold">Start building free</span>
              </Link>
              <a href="#workflow" className="rounded-sm border border-[#6b4d9a] px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#6b4d9a] transition hover:bg-[#6b4d9a] hover:text-white">
                See how it works
              </a>
            </div>

            <div className="mt-10 flex items-center gap-7 text-[#7a69a3]">
              {STACK.map((s, i) => (
                <span key={i} className="flex items-center gap-2 text-xs font-semibold">
                  <Glyph icon={s} className="h-5 w-5" />
                  <span className="hidden sm:inline">{s.title.replace(".js", "")}</span>
                </span>
              ))}
            </div>
          </div>

          {/* live demo */}
          <div className="relative flex items-center px-4 pb-44 pt-6 lg:px-0 lg:pb-40 lg:pr-10 lg:pt-14">
            <div className="relative w-full min-w-0">
              <HeroStack />
              {CHIPS.map((c) => (
                <span
                  key={c.text}
                  className={`absolute z-30 hidden items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-[#3b2d5a] shadow-[0_12px_30px_rgba(43,33,64,0.3)] lg:flex ${c.pos}`}
                  style={{ animation: `auth-float ${c.dur}s ease-in-out ${c.delay}s infinite` }}
                >
                  <i className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
                  {c.text}
                </span>
              ))}
            </div>

          </div>
        </div>

        {/* about band */}
        <div className="absolute inset-x-0 bottom-0 z-10 lg:left-[4.5rem] lg:right-auto lg:w-[46%]">
          <div className="bg-[#6b4d9a] px-8 py-6 text-white">
            <h2 className={`${display.className} text-2xl uppercase tracking-wider`}>About VIBE</h2>
            <p className="mt-2 max-w-md text-[11px] font-semibold uppercase leading-relaxed tracking-wide text-white/85">
              VIBE is a visual website builder. Drag blocks, ask the AI for changes, then take the real code with you — zip or GitHub.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
