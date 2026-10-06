import type { VariantDef } from "./types";

const initials = (n: string) => (n || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const GRADS = ["linear-gradient(135deg,#6b4d9a,#ff5b7f)", "linear-gradient(135deg,#3b82f6,#6b4d9a)", "linear-gradient(135deg,#f59e0b,#ef4444)", "linear-gradient(135deg,#10b981,#0f766e)"];
const photo = (i: { image?: string }, n: number): React.CSSProperties =>
  i.image ? { backgroundImage: `url(${i.image})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: GRADS[n % 4] };

type Member = { name: string; role: string; image?: string };
const members = (p: Record<string, any>) => (p.items || []) as Member[];
const more = (p: Record<string, any>) => members(p).concat(members(p)).slice(0, Math.max(4, members(p).length));

/* ─────────────── Team ─────────────── */
export const TEAM_EXTRA: VariantDef[] = [
  {
    id: "photo",
    label: "Photo cards",
    render: (p) => (
      <section className="v-team">
        <h2 className="v-team-title">{p.heading}</h2>
        <div className="v-team-grid">
          {more(p).map((m, n) => (
            <div key={n} className="v-pcard">
              <div className="v-pcard-photo" style={photo(m, n)}>{!m.image && <span>{initials(m.name)}</span>}</div>
              <b>{m.name}</b><span>{m.role}</span>
              <div className="v-pcard-soc"><i>in</i><i>X</i><i>@</i></div>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "circles",
    label: "Round avatars",
    render: (p) => (
      <section className="v-team v-team--center">
        <h2 className="v-team-title">{p.heading}</h2>
        <div className="v-team-round">
          {more(p).map((m, n) => (
            <div key={n}><span className="v-round" style={photo(m, n)}>{!m.image && initials(m.name)}</span><b>{m.name}</b><em>{m.role}</em></div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "overlay",
    label: "Overlay tiles",
    render: (p) => (
      <section className="v-team">
        <h2 className="v-team-title">{p.heading}</h2>
        <div className="v-team-tiles">
          {more(p).map((m, n) => (
            <div key={n} className="v-ttile" style={photo(m, n)}>
              <div><b>{m.name}</b><span>{m.role}</span></div>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "list",
    label: "Directory list",
    render: (p) => (
      <section className="v-team v-team--narrow">
        <h2 className="v-team-title">{p.heading}</h2>
        {more(p).map((m, n) => (
          <div key={n} className="v-trow">
            <span className="v-round v-round--sm" style={photo(m, n)}>{!m.image && initials(m.name)}</span>
            <div><b>{m.name}</b><span>{m.role}</span></div>
            <button className="v-outline-btn">Contact</button>
          </div>
        ))}
      </section>
    ),
  },
  {
    id: "leader",
    label: "Leader spotlight",
    render: (p) => {
      const m = members(p);
      return (
        <section className="v-team v-team-lead">
          <div className="v-lead-main">
            <div className="v-lead-photo" style={photo(m[0] || {}, 0)}>{!m[0]?.image && <span>{initials(m[0]?.name)}</span>}</div>
            <span className="v-eyebrow">Leadership</span>
            <h3>{m[0]?.name}</h3><p>{m[0]?.role}</p>
          </div>
          <div>
            <h2 className="v-team-title v-team-title--left">{p.heading}</h2>
            <div className="v-lead-grid">
              {m.slice(1).concat(m.slice(0, 1)).map((x, n) => (
                <div key={n} className="v-trow v-trow--card"><span className="v-round v-round--sm" style={photo(x, n + 1)}>{!x.image && initials(x.name)}</span><div><b>{x.name}</b><span>{x.role}</span></div></div>
              ))}
            </div>
          </div>
        </section>
      );
    },
  },
  {
    id: "minimal",
    label: "Text only",
    render: (p) => (
      <section className="v-team">
        <h2 className="v-team-title">{p.heading}</h2>
        <div className="v-tmin">
          {more(p).map((m, n) => (
            <div key={n}><span className="v-num">{String(n + 1).padStart(2, "0")}</span><b>{m.name}</b><span>{m.role}</span></div>
          ))}
        </div>
      </section>
    ),
  },
];

/* ─────────────── Logo cloud ─────────────── */
const logos = (p: Record<string, any>) => (p.logos || []) as string[];
const many = (p: Record<string, any>) => logos(p).concat(logos(p)).concat(logos(p)).slice(0, 8);

export const LOGO_EXTRA: VariantDef[] = [
  {
    id: "marquee",
    label: "Scrolling marquee",
    render: (p) => (
      <section className="v-logo">
        <p className="v-logo-cap">{p.heading}</p>
        <div className="v-marquee"><div className="v-marquee-track">{many(p).concat(many(p)).map((l, n) => <span key={n}>{l}</span>)}</div></div>
      </section>
    ),
  },
  {
    id: "grid",
    label: "Bordered grid",
    render: (p) => (
      <section className="v-logo">
        <p className="v-logo-cap">{p.heading}</p>
        <div className="v-logo-grid">{many(p).map((l, n) => <span key={n}>{l}</span>)}</div>
      </section>
    ),
  },
  {
    id: "badges",
    label: "Pill badges",
    render: (p) => (
      <section className="v-logo">
        <p className="v-logo-cap">{p.heading}</p>
        <div className="v-logo-pills">{many(p).map((l, n) => <span key={n}><i style={{ background: GRADS[n % 4] }} />{l}</span>)}</div>
      </section>
    ),
  },
  {
    id: "split",
    label: "Label + logos",
    render: (p) => (
      <section className="v-logo v-logo-split">
        <h3>{p.heading}</h3>
        <div>{many(p).slice(0, 6).map((l, n) => <span key={n}>{l}</span>)}</div>
      </section>
    ),
  },
  {
    id: "dark",
    label: "Dark band",
    render: (p) => (
      <section className="v-logo v-logo-dark">
        <p className="v-logo-cap">{p.heading}</p>
        <div className="v-logo-row">{many(p).slice(0, 6).map((l, n) => <span key={n}>{l}</span>)}</div>
      </section>
    ),
  },
  {
    id: "rated",
    label: "With ratings",
    render: (p) => (
      <section className="v-logo">
        <p className="v-logo-cap">{p.heading}</p>
        <div className="v-logo-rated">
          {logos(p).map((l, n) => <div key={n}><b>{l}</b><span className="v-stars">★★★★★</span><em>{(4.6 + (n % 4) / 10).toFixed(1)} rating</em></div>)}
        </div>
      </section>
    ),
  },
];

/* ─────────────── FAQ (native <details> = real accordion) ─────────────── */
type QA = { q: string; a: string };
const qas = (p: Record<string, any>) => (p.items || []) as QA[];
const qmore = (p: Record<string, any>) => qas(p).concat(qas(p)).slice(0, Math.max(4, qas(p).length));

export const FAQ_EXTRA_2: VariantDef[] = [
  {
    id: "numbered",
    label: "Numbered accordion",
    render: (p) => (
      <section className="v-faq">
        <h2 className="v-faq-title">{p.heading}</h2>
        <div className="v-faq-list">
          {qmore(p).map((x, n) => (
            <details key={n} open={n === 0}><summary><span className="v-num">{String(n + 1).padStart(2, "0")}</span>{x.q}<i /></summary><p>{x.a}</p></details>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "sidebar",
    label: "Sidebar + help card",
    render: (p) => (
      <section className="v-faq v-faq-side">
        <div>
          <h2 className="v-faq-title v-faq-title--left">{p.heading}</h2>
          <p>Can't find what you need?</p>
          <div className="v-help"><b>Talk to a human</b><span>We reply within a few hours.</span><button className="v-pill-btn">Contact support</button></div>
        </div>
        <div className="v-faq-list">
          {qmore(p).map((x, n) => (
            <details key={n} open={n === 1}><summary>{x.q}<i /></summary><p>{x.a}</p></details>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "tabs",
    label: "Category tabs",
    render: (p) => (
      <section className="v-faq">
        <h2 className="v-faq-title">{p.heading}</h2>
        <div className="v-tabs v-faq-tabs">{["General", "Billing", "Technical", "Security"].map((t, n) => <span key={t} className={n === 0 ? "is-on" : ""}>{t}</span>)}</div>
        <div className="v-faq-list">
          {qmore(p).map((x, n) => (
            <details key={n} open={n === 0}><summary>{x.q}<i /></summary><p>{x.a}</p></details>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "chat",
    label: "Chat bubbles",
    render: (p) => (
      <section className="v-faq v-faq-chat">
        <h2 className="v-faq-title">{p.heading}</h2>
        {qas(p).map((x, n) => (
          <div key={n} className="v-chat-pair">
            <div className="v-chat-q">{x.q}</div>
            <div className="v-chat-a"><span className="v-toast-av">V</span><p>{x.a}</p></div>
          </div>
        ))}
      </section>
    ),
  },
  {
    id: "cards",
    label: "Plus-icon cards",
    render: (p) => (
      <section className="v-faq">
        <h2 className="v-faq-title">{p.heading}</h2>
        <div className="v-faq-cards">
          {qmore(p).map((x, n) => (
            <details key={n} className="v-fcard"><summary>{x.q}<i /></summary><p>{x.a}</p></details>
          ))}
        </div>
      </section>
    ),
  },
];

/* ─────────────── Stats ─────────────── */
type Stat = { value: string; label: string; trend?: string; percent?: string };
const stats = (p: Record<string, any>) => (p.items || []) as Stat[];

export const STATS_EXTRA: VariantDef[] = [
  {
    id: "big",
    label: "Big numerals",
    render: (p) => (
      <section className="v-stats v-stats-big">
        {stats(p).map((s, n) => <div key={n}><b>{s.value}</b><span>{s.label}</span></div>)}
      </section>
    ),
  },
  {
    id: "rings",
    label: "Progress rings",
    render: (p) => (
      <section className="v-stats v-stats-rings">
        {stats(p).map((s, n) => {
          const pct = Number(s.percent) || [92, 99, 96, 78][n % 4];
          return (
            <div key={n}>
              <span className="v-ring" style={{ background: `conic-gradient(var(--vp) ${pct * 3.6}deg, var(--vs2) 0)` }}><b>{s.value}</b></span>
              <span>{s.label}</span>
            </div>
          );
        })}
      </section>
    ),
  },
  {
    id: "band",
    label: "Dark band",
    render: (p) => (
      <section className="v-stats v-stats-band">
        {stats(p).map((s, n) => <div key={n}><b>{s.value}</b><span>{s.label}</span></div>)}
      </section>
    ),
  },
  {
    id: "icons",
    label: "Icon tiles",
    render: (p) => (
      <section className="v-stats v-stats-icons">
        {stats(p).map((s, n) => (
          <div key={n}><span className="v-icard-ico">{["◆", "✦", "★", "◐"][n % 4]}</span><b>{s.value}</b><span>{s.label}</span></div>
        ))}
      </section>
    ),
  },
  {
    id: "spark",
    label: "Sparkline cards",
    render: (p) => (
      <section className="v-stats v-stats-spark">
        {stats(p).map((s, n) => (
          <div key={n}>
            <span>{s.label}</span>
            <b>{s.value}</b>
            <em>{s.trend || `+${(n + 2) * 3}%`}</em>
            <div className="v-spark">{[30, 48, 40, 62, 55, 78, 70, 92].map((h, i) => <i key={i} style={{ height: `${h - n * 4}%` }} />)}</div>
          </div>
        ))}
      </section>
    ),
  },
  {
    id: "outline",
    label: "Outlined ticker",
    render: (p) => (
      <section className="v-stats v-stats-outline">
        {stats(p).map((s, n) => <div key={n}><b>{s.value}</b><span>{s.label}</span></div>)}
      </section>
    ),
  },
];

export const EXTRA_VARIANTS_3: Record<string, VariantDef[]> = {
  team: TEAM_EXTRA,
  icons: LOGO_EXTRA,
  faq: FAQ_EXTRA_2,
  stats: STATS_EXTRA,
};
