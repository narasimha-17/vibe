import Link from "next/link";
import { VibeLogo } from "./VibeLogo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border-light bg-panel px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:justify-between">
        <div>
          <div className="mb-3"><VibeLogo /></div>
          <p className="max-w-xs text-sm text-muted">Design visually. Build intelligently. Own the code.</p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          <div>
            <div className="mb-3 font-semibold text-main">Product</div>
            <div className="flex flex-col gap-2 text-muted">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <Link href="/templates">Templates</Link>
            </div>
          </div>
          <div>
            <div className="mb-3 font-semibold text-main">Company</div>
            <div className="flex flex-col gap-2 text-muted">
              <span>About</span>
              <span>Blog</span>
              <span>Careers</span>
            </div>
          </div>
          <div>
            <div className="mb-3 font-semibold text-main">Get Started</div>
            <div className="flex flex-col gap-2 text-muted">
              <Link href="/signup">Create account</Link>
              <Link href="/login">Log in</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-border-light pt-6 text-xs text-muted">
        © 2026 VIBE. All rights reserved.
      </div>
    </footer>
  );
}
