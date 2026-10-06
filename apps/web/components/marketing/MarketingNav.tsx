"use client";

import Link from "next/link";
import { VibeLogo } from "./VibeLogo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#ai", label: "AI" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-5 rounded-full bg-primary px-3 py-2.5 text-white shadow-[0_12px_30px_rgba(23,23,20,0.16)] sm:px-5">
        <Link href="/" className="group shrink-0 transition-transform hover:scale-[1.02]">
          <VibeLogo light />
        </Link>
        <nav className="mx-auto hidden items-center gap-1 text-xs font-semibold text-white/70 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3 py-2 transition-colors hover:bg-white/10 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/login" className="hidden px-2 py-2 text-sm font-semibold text-white/70 transition-colors hover:text-white sm:inline-flex">
            Log In
          </Link>
          <Link href="/signup" className="inline-flex h-10 items-center justify-center gap-3 rounded-full bg-white px-4 text-sm font-bold text-primary transition hover:bg-accent sm:px-5">
            Start building
          </Link>
        </div>
      </div>
    </header>
  );
}
