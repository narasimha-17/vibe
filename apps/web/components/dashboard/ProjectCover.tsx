const GRADIENTS = [
  "linear-gradient(135deg, #5f4d88 0%, #8b5fc7 55%, #ff5b7f 130%)",
  "linear-gradient(135deg, #3b2d5a 0%, #6b4d9a 55%, #b79be6 130%)",
  "linear-gradient(135deg, #6b4d9a 0%, #a45bb8 55%, #ff8fb1 130%)",
  "linear-gradient(135deg, #2b2140 0%, #6b4d9a 60%, #ff5b7f 140%)",
  "linear-gradient(135deg, #7a69a3 0%, #a45bb8 50%, #ffb3c7 130%)",
];

const TEMPLATE_LABELS: Record<string, string> = {
  saas: "SaaS",
  portfolio: "Portfolio",
  agency: "Agency",
  restaurant: "Restaurant",
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Generated thumbnail: a mini website wireframe on a per-project gradient. */
export function ProjectCover({ seed, templateKey }: { seed: string; templateKey?: string | null }) {
  const h = hash(seed);
  const layout = h % 3; // 0 hero-left · 1 hero-right · 2 centered
  const label = templateKey ? TEMPLATE_LABELS[templateKey] || "Template" : "Blank";

  return (
    <div className="relative h-44 w-full overflow-hidden" style={{ background: GRADIENTS[h % GRADIENTS.length] }}>
      <span className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
      <span className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[#ff5b7f]/30 blur-2xl" />

      <span className="absolute left-3 top-3 z-10 rounded-full bg-black/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur">
        {label}
      </span>

      <div className="absolute inset-x-8 top-9 rounded-t-xl bg-white/95 shadow-[0_18px_40px_rgba(30,15,60,0.35)] transition-transform duration-500 group-hover:-translate-y-1.5 project-cover-window">
        <div className="flex items-center gap-1.5 border-b border-[#ece6fb] px-3 py-2">
          <i className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
          <i className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
          <i className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
          <i className="mx-auto h-2 w-20 rounded-full bg-[#f0e6fb]" />
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <i className="h-2 w-8 rounded bg-[#6b4d9a]" />
          <span className="flex gap-1.5">
            <i className="h-1.5 w-6 rounded-full bg-[#d6c9ee]" />
            <i className="h-1.5 w-6 rounded-full bg-[#d6c9ee]" />
            <i className="h-1.5 w-6 rounded-full bg-[#d6c9ee]" />
          </span>
        </div>
        <div className={`flex gap-3 px-3 pb-3 ${layout === 1 ? "flex-row-reverse" : ""} ${layout === 2 ? "flex-col items-center text-center" : "items-center"}`}>
          <div className={`flex-1 space-y-1.5 ${layout === 2 ? "flex w-full flex-col items-center" : ""}`}>
            <i className="block h-2.5 w-4/5 rounded bg-[#3b2d5a]" />
            <i className="block h-2.5 w-3/5 rounded bg-[#3b2d5a]" />
            <i className="block h-1.5 w-full rounded bg-[#e6def5]" />
            <i className="mt-2 block h-4 w-14 rounded-full bg-[#ff5b7f]" />
          </div>
          {layout !== 2 && <i className="block h-16 w-24 rounded-lg" style={{ background: GRADIENTS[(h + 2) % GRADIENTS.length] }} />}
        </div>
        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
          {[0, 1, 2].map((i) => (
            <i key={i} className="block h-10 rounded-md bg-[#f0e6fb]" />
          ))}
        </div>
      </div>
    </div>
  );
}
