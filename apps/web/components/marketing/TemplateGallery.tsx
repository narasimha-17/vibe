import Link from "next/link";

/* Four hand-styled template previews. Each has its own palette, type and layout. */

function Chrome({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-2 ${dark ? "bg-black/40" : "bg-black/[0.04]"}`}>
      <i className="h-2 w-2 rounded-full bg-[#ff5f57]" />
      <i className="h-2 w-2 rounded-full bg-[#febc2e]" />
      <i className="h-2 w-2 rounded-full bg-[#28c840]" />
      {children}
    </div>
  );
}

/** 1 · SaaS: airy lavender, product dashboard on the right. */
function SaasPreview() {
  return (
    <div className="h-full bg-gradient-to-br from-[#f3edff] via-white to-[#ffe9f0]">
      <Chrome>
        <span className="mx-auto rounded-full bg-white px-4 py-0.5 text-[9px] text-[#7a69a3]">nova.app</span>
      </Chrome>
      <div className="flex items-center justify-between px-6 py-3 text-[11px]">
        <b className="text-[#3b2d5a]">◆ NOVA</b>
        <span className="flex gap-4 text-[#7a69a3]">
          <span>Product</span>
          <span>Pricing</span>
          <span>Docs</span>
        </span>
        <span className="rounded-full bg-[#6b4d9a] px-3 py-1 text-[10px] font-bold text-white">Get started</span>
      </div>
      <div className="grid grid-cols-[1fr_1.1fr] items-center gap-5 px-6 pt-4">
        <div>
          <div className="text-[26px] font-extrabold leading-[1.05] tracking-tight text-[#3b2d5a]">
            Ship your SaaS in <span className="text-[#ff5b7f]">days.</span>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-[#7a69a3]">Auth, billing and a polished UI, ready on day one.</p>
          <div className="mt-3 flex gap-2 text-[10px] font-bold">
            <span className="rounded-full bg-[#6b4d9a] px-3 py-1.5 text-white">Start free trial</span>
            <span className="rounded-full border border-[#d6c9ee] bg-white px-3 py-1.5 text-[#6b4d9a]">View demo</span>
          </div>
        </div>
        <div className="relative -mb-8 rounded-xl border border-[#d6c9ee] bg-white p-3 shadow-[0_20px_40px_rgba(107,77,154,0.25)]">
          <div className="mb-2 flex gap-1.5">
            {[68, 44, 82].map((w, i) => (
              <span key={i} className="flex-1 rounded-md bg-[#f3edff] p-1.5">
                <span className="block text-[8px] text-[#7a69a3]">{["MRR", "Users", "Churn"][i]}</span>
                <span className="text-[13px] font-extrabold text-[#3b2d5a]">{["₹4.2L", "1,284", "1.2%"][i]}</span>
              </span>
            ))}
          </div>
          <div className="flex h-16 items-end gap-1">
            {[30, 45, 38, 60, 52, 78, 66, 92].map((h, i) => (
              <span key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i > 5 ? "#ff5b7f" : "#b79be6" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 2 · Portfolio: editorial serif on warm paper, asymmetric work grid. */
function PortfolioPreview() {
  return (
    <div className="h-full bg-[#f4efe6] px-6 py-5 font-serif text-[#1f1a17]">
      <div className="flex items-baseline justify-between text-[11px]">
        <b className="text-sm italic">Alex Kim</b>
        <span className="flex gap-4 font-sans text-[10px] uppercase tracking-widest text-[#8a7f70]">
          <span>Work</span>
          <span>About</span>
          <span>Contact</span>
        </span>
      </div>
      <div className="mt-5 text-[34px] leading-[1] tracking-tight">
        Designer <em className="text-[#c2410c]">&amp;</em>
        <br />
        front-end dev.
      </div>
      <div className="mt-4 grid grid-cols-[1.4fr_1fr_1fr] grid-rows-2 gap-2">
        <span className="row-span-2 rounded-sm bg-[#1f1a17] p-2 font-sans text-[9px] text-[#f4efe6]">
          <span className="text-[#f59e0b]">01</span>
          <br />
          Lumen
        </span>
        <span className="h-12 rounded-sm bg-[#c2410c] p-2 font-sans text-[9px] text-white">02 Fern</span>
        <span className="h-12 rounded-sm bg-[#d9cfbd] p-2 font-sans text-[9px]">03 Orbit</span>
        <span className="h-12 rounded-sm bg-[#e7dfd0] p-2 font-sans text-[9px]">04 Kite</span>
        <span className="h-12 rounded-sm border border-[#1f1a17]/30 p-2 font-sans text-[9px]">All work →</span>
      </div>
    </div>
  );
}

/** 3 · Agency: black, oversized uppercase, neon marquee. */
function AgencyPreview() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#0a0a0f] text-white">
      <div className="flex items-center justify-between px-6 py-4 text-[10px] font-bold uppercase tracking-[0.25em]">
        <span>Studio®</span>
        <span className="text-white/50">Work · Services · Contact</span>
      </div>
      <div className="px-6">
        <div className="text-[44px] font-black uppercase leading-[0.88] tracking-tighter">
          We build
          <br />
          <span className="bg-[#d4ff3a] px-1 text-black">brands</span> that
          <br />
          stick.
        </div>
      </div>
      <div className="mt-auto -rotate-2 whitespace-nowrap bg-[#d4ff3a] py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-black">
        Branding ✱ Web ✱ Motion ✱ Strategy ✱ Branding ✱ Web ✱ Motion ✱ Strategy ✱
      </div>
      <div className="h-6" />
      <span className="absolute -right-6 top-8 h-28 w-28 rounded-full border-[14px] border-[#ff2e93]/80" />
    </div>
  );
}

/** 4 · Restaurant: warm terracotta, italic serif, menu with dotted prices. */
function RestaurantPreview() {
  const menu = [
    ["Burrata & peach", "₹520"],
    ["Cacio e pepe", "₹640"],
    ["Wood-fired pizza", "₹720"],
  ];
  return (
    <div className="grid h-full grid-cols-[1.1fr_1fr] bg-[#fbf3e6] font-serif text-[#3a1d12]">
      <div className="flex flex-col justify-center px-6">
        <span className="font-sans text-[9px] font-bold uppercase tracking-[0.3em] text-[#b45309]">Est. 2014 · Downtown</span>
        <div className="mt-2 text-[32px] italic leading-[1]">Osteria</div>
        <p className="mt-2 font-sans text-[11px] leading-snug text-[#7c5a45]">Fresh, seasonal Italian in a warm, welcoming room.</p>
        <span className="mt-3 w-fit rounded-full bg-[#9a3412] px-4 py-1.5 font-sans text-[10px] font-bold text-white">Book a table</span>
      </div>
      <div className="relative bg-[#9a3412] px-5 py-5 text-[#fbf3e6]">
        <span className="absolute -left-4 top-6 h-8 w-8 rounded-full bg-[#fbf3e6]" />
        <span className="absolute -left-4 bottom-6 h-8 w-8 rounded-full bg-[#fbf3e6]" />
        <div className="mb-2 text-center text-[11px] italic tracking-widest text-[#fcd9b6]">— Menu —</div>
        {menu.map(([n, p]) => (
          <div key={n} className="flex items-baseline gap-1 py-1.5 text-[11px]">
            <span>{n}</span>
            <span className="flex-1 border-b border-dotted border-[#fcd9b6]/60" />
            <span className="font-sans font-bold">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TEMPLATES = [
  { name: "SaaS product", tag: "Landing page", blurb: "Navbar, split hero and a live dashboard card for a software launch.", span: "lg:col-span-7", accent: "#6b4d9a", Preview: SaasPreview },
  { name: "Personal portfolio", tag: "Portfolio", blurb: "Editorial serif type with an asymmetric grid of project cards.", span: "lg:col-span-5", accent: "#c2410c", Preview: PortfolioPreview },
  { name: "Creative agency", tag: "Agency", blurb: "Black canvas, oversized type and a neon marquee for bold studios.", span: "lg:col-span-5", accent: "#8aa800", Preview: AgencyPreview },
  { name: "Restaurant", tag: "Local business", blurb: "Warm palette with a menu card and a booking-first call to action.", span: "lg:col-span-7", accent: "#9a3412", Preview: RestaurantPreview },
];

export function TemplateGallery() {
  return (
    <div className="mx-auto mt-14 grid max-w-6xl gap-6 lg:grid-cols-12">
      {TEMPLATES.map(({ name, tag, blurb, span, accent, Preview }) => (
        <Link
          key={name}
          href="/signup"
          className={`group flex flex-col overflow-hidden rounded-3xl border border-border-light bg-surface shadow-[0_10px_30px_rgba(59,45,90,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(59,45,90,0.2)] ${span}`}
        >
          <div className="h-[290px] overflow-hidden border-b border-border-light transition-transform duration-500 [&>*]:origin-top group-hover:[&>*]:scale-[1.03]">
            <div className="h-full transition-transform duration-500">
              <Preview />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 p-5">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold text-main">{name}</h3>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${accent}1a`, color: accent }}>
                  {tag}
                </span>
              </div>
              <p className="text-sm text-muted">{blurb}</p>
            </div>
            <span className="shrink-0 text-sm font-bold transition-transform group-hover:translate-x-1" style={{ color: accent }}>
              Use it →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
