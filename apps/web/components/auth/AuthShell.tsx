import Link from "next/link";
import { VibeLogo } from "@/components/marketing/VibeLogo";

interface AuthShellProps {
  /** Register flips the layout: illustration left, form right (and slides in from the opposite sides). */
  reverse?: boolean;
  title: string;
  switchText: string;
  switchLabel: string;
  switchHref: string;
  panelTitle: string;
  panelText: string;
  children: React.ReactNode;
}

function Illustration() {
  return (
    <svg viewBox="0 0 420 460" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[80%] w-full" aria-hidden="true">
      <g className="auth-drift">
        <path d="M-30 330 C 40 250, 110 320, 190 262 S 330 210, 450 275 L 450 480 L -30 480 Z" fill="#3b2d5a" />
        <circle cx="352" cy="382" r="70" fill="#8b7ab0" opacity="0.45" />
      </g>
      <circle className="auth-float-slow" cx="392" cy="96" r="13" fill="#ff5b7f" />
      <circle className="auth-float" cx="66" cy="318" r="16" fill="#ff5b7f" />
      <circle className="auth-float-slow" cx="300" cy="150" r="7" fill="#ff5b7f" opacity="0.85" />

      <g className="auth-float-slow">
        <circle cx="92" cy="128" r="34" fill="#d9d0f2" />
        <circle cx="92" cy="128" r="16" fill="#f1edfb" />
        <ellipse className="auth-spin" cx="92" cy="128" rx="54" ry="15" fill="none" stroke="#b6a7dc" strokeWidth="4" transform="rotate(-22 92 128)" />
      </g>

      <circle className="auth-twinkle" cx="160" cy="70" r="2.5" fill="#fff" />
      <circle className="auth-twinkle" style={{ animationDelay: "0.8s" }} cx="330" cy="62" r="2" fill="#fff" />
      <circle className="auth-twinkle" style={{ animationDelay: "1.5s" }} cx="40" cy="220" r="2" fill="#fff" />
      <circle className="auth-twinkle" style={{ animationDelay: "0.4s" }} cx="372" cy="240" r="2.5" fill="#fff" />

      <g className="auth-float">
        <path d="M205 300 L222 300 L218 400 L200 400 Z" fill="#2a2140" />
        <path d="M226 300 L243 300 L250 400 L232 400 Z" fill="#2a2140" />
        <rect x="192" y="397" width="30" height="10" rx="5" fill="#fff" />
        <rect x="230" y="397" width="32" height="10" rx="5" fill="#fff" />
        <path d="M198 210 Q225 195 252 210 L256 305 L196 305 Z" fill="#b8a9e3" />
        <path d="M201 220 L192 286" stroke="#b8a9e3" strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d="M250 220 L272 262 L248 262" stroke="#b8a9e3" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="238" y="230" width="17" height="30" rx="3" fill="#fff" stroke="#2a2140" strokeWidth="2" />
        <circle cx="247" cy="262" r="6" fill="#f2c4a5" />
        <rect x="219" y="192" width="12" height="14" fill="#f2c4a5" />
        <circle cx="225" cy="178" r="20" fill="#f2c4a5" />
        <path d="M204 177 Q204 150 226 152 Q247 152 246 177 Q236 164 222 166 Q212 168 204 177 Z" fill="#2a2140" />
      </g>
    </svg>
  );
}

export function AuthShell({ reverse = false, title, switchText, switchLabel, switchHref, panelTitle, panelText, children }: AuthShellProps) {
  const formFrom = reverse ? "auth-from-right" : "auth-from-left";
  const artFrom = reverse ? "auth-from-left" : "auth-from-right";

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb--a" />
      <div className="auth-orb auth-orb--b" />

      <div className="auth-card grid w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-[0_30px_80px_rgba(80,50,140,0.25)] md:grid-cols-2">
        <section className={`auth-panel ${formFrom} flex flex-col p-8 sm:p-10 ${reverse ? "md:order-2" : ""}`}>
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/" aria-label="VIBE home">
              <VibeLogo compact />
            </Link>
            <p className="text-right text-xs text-[#7a6d96]">
              {switchText}{" "}
              <Link href={switchHref} className="font-bold text-[#6b4d9a] hover:underline">
                {switchLabel}
              </Link>
            </p>
          </div>
          <h1 className="auth-title mb-6 text-3xl font-semibold text-[#6b4d9a]">{title}</h1>
          {children}
        </section>

        <aside
          className={`auth-panel ${artFrom} relative hidden min-h-[560px] overflow-hidden text-white md:block ${reverse ? "md:order-1" : ""}`}
          style={{
            background:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0) 0 0 / 14px 14px, linear-gradient(160deg, #7a69a3, #5f4d88)",
          }}
        >
          <div className="relative z-10 p-10">
            <h2 className="auth-title mb-3 text-lg font-bold uppercase tracking-[0.08em]">{panelTitle}</h2>
            <p className="max-w-[16rem] text-sm leading-relaxed text-white/75">{panelText}</p>
          </div>
          <Illustration />
        </aside>
      </div>
    </div>
  );
}
