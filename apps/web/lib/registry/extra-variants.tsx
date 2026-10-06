import type { VariantDef } from "./types";

/**
 * Additional, visually distinct variants per component. Patterns come from current (2026) web design
 * research: floating / centered-logo / mega-menu navbars, type-first / bento / mesh heroes, toggle & comparison
 * pricing, utility / CTA-led / wordmark footers, spotlight & wall testimonials. Styling lives in app/site-variants.css
 * and reads the Style Studio tokens (--s-*) when a design system is applied.
 */

const login = (p: Record<string, any>) => (p.loginLabel ? <button className="navbar__login v-login">{p.loginLabel}</button> : null);
const cta = (p: Record<string, any>, fallback = "Get Started") => p.ctaLabel || fallback;

const links = (p: Record<string, any>) => (p.links || []).map((l: string, i: number) => <span key={i}>{l}</span>);
const initials = (n: string) => (n || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/* ─────────────── Navbar ─────────────── */
export const NAVBAR_EXTRA: VariantDef[] = [
  {
    id: "floating",
    label: "Floating pill",
    render: (p) => (
      <div className="v-nav-float-wrap">
        <nav className="v-nav-float">
          <b className="v-brand">{p.brand}</b>
          <div className="v-links">{links(p)}</div>
          <span className="v-nav-actions">{login(p)}<button className="v-pill-btn">{cta(p)}</button></span>
        </nav>
      </div>
    ),
  },
  {
    id: "split",
    label: "Split logo",
    render: (p) => {
      const l = p.links || [];
      const half = Math.ceil(l.length / 2);
      return (
        <nav className="v-nav-split">
          <div className="v-links">{l.slice(0, half).map((x: string, i: number) => <span key={i}>{x}</span>)}</div>
          <b className="v-brand v-brand--center">{p.brand}</b>
          <div className="v-links v-links--right">
            {l.slice(half).map((x: string, i: number) => <span key={i}>{x}</span>)}
            <span className="v-nav-actions">{login(p)}<button className="v-pill-btn">{cta(p, p.loginLabel ? "Get started" : "Sign in")}</button></span>
          </div>
        </nav>
      );
    },
  },
  {
    id: "glass",
    label: "Glass overlay",
    render: (p) => (
      <div className="v-nav-glass-wrap">
        <nav className="v-nav-glass">
          <b className="v-brand">{p.brand}</b>
          <div className="v-links">{links(p)}</div>
          <span className="v-nav-actions">{login(p)}<button className="v-glass-btn">{cta(p)}</button></span>
        </nav>
        <div className="v-nav-glass-hero">
          <i />
          <i />
        </div>
      </div>
    ),
  },
  {
    id: "tabs",
    label: "Underline tabs",
    render: (p) => (
      <nav className="v-nav-tabs">
        <b className="v-brand">{p.brand}</b>
        <div className="v-tabs">
          {(p.links || []).map((l: string, i: number) => (
            <span key={i} className={i === 0 ? "is-on" : ""}>{l}</span>
          ))}
        </div>
        <span className="v-avatar">{initials(p.brand)}</span>
      </nav>
    ),
  },
  {
    id: "brutal",
    label: "Brutalist",
    render: (p) => (
      <nav className="v-nav-brutal">
        <b className="v-brand">{String(p.brand).toUpperCase()}</b>
        <div className="v-links">{links(p)}</div>
        <span className="v-nav-actions">{login(p)}<button className="v-brutal-btn">{String(cta(p)).toUpperCase()}</button></span>
      </nav>
    ),
  },
  {
    id: "search",
    label: "With search",
    render: (p) => (
      <nav className="v-nav-search">
        <b className="v-brand">{p.brand}</b>
        <div className="v-searchbox">
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </div>
        <div className="v-links">{links(p)}</div>
        <span className="v-nav-actions">{login(p)}<button className="v-pill-btn">{cta(p, p.loginLabel ? "Get started" : "Sign in")}</button></span>
      </nav>
    ),
  },
  {
    id: "mega",
    label: "Mega menu",
    render: (p) => (
      <div className="v-mega">
        <nav className="v-mega-bar">
          <b className="v-brand">{p.brand}</b>
          <div className="v-links">
            {(p.links || []).map((l: string, i: number) => (
              <span key={i} className={i === 0 ? "is-open" : ""}>{l}</span>
            ))}
          </div>
          <span className="v-nav-actions">{login(p)}<button className="v-pill-btn">{cta(p)}</button></span>
        </nav>
        <div className="v-mega-panel">
          {[["Build", "Canvas", "Components", "Templates"], ["Ship", "Export code", "GitHub push", "Hosting"], ["Learn", "Docs", "Guides", "Changelog"]].map(([h, ...items]) => (
            <div key={h}>
              <h4>{h}</h4>
              {items.map((x) => <span key={x}>{x}</span>)}
            </div>
          ))}
          <div className="v-mega-feature">
            <b>New</b>
            <span>AI assistant is live</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "twotier",
    label: "Two-tier",
    render: (p) => (
      <nav className="v-nav-two">
        {(p.topbar ?? ["Open every day", "Call us", "Visit us"]).length > 0 && (
          <div className="v-nav-two-top">
            {(p.topbar ?? ["Open every day", "Call us", "Visit us"]).map((t: string, i: number) => <span key={i}>{t}</span>)}
          </div>
        )}
        <div className="v-nav-two-main">
          <b className="v-brand">{p.brand}</b>
          <div className="v-links">{links(p)}</div>
          <span className="v-icons"><i /><i /><i /></span>
        </div>
      </nav>
    ),
  },
];

/* ─────────────── Hero ─────────────── */
export const HERO_EXTRA: VariantDef[] = [
  {
    id: "type",
    label: "Type-first",
    render: (p) => (
      <section className="v-hero-type">
        <span className="v-eyebrow">{p.eyebrow || "Now in open beta"}</span>
        <h1>{p.headline}</h1>
        <div className="v-hero-type-foot">
          <p>{p.subheadline}</p>
          <div className="v-hero-actions">
            <button className="v-pill-btn v-pill-btn--lg">{p.primaryCta}</button>
            <button className="v-link-btn">{p.secondaryCta}</button>
          </div>
        </div>
      </section>
    ),
  },
  {
    id: "bento",
    label: "Bento tiles",
    render: (p) => (
      <section className="v-hero-bento">
        <div className="v-tile v-tile--head">
          <h1>{p.headline}</h1>
          <p>{p.subheadline}</p>
          <button className="v-pill-btn">{p.primaryCta}</button>
        </div>
        <div className="v-tile v-tile--stat"><b>10K+</b><span>teams shipping</span></div>
        <div className="v-tile v-tile--grad"><span>{p.secondaryCta}</span></div>
        <div className="v-tile v-tile--quote">“Cut our build time in half.”<em>Jane, CTO</em></div>
        <div className="v-tile v-tile--pill"><i />Live<i />Secure<i />Fast</div>
      </section>
    ),
  },
  {
    id: "mesh",
    label: "Mesh gradient",
    render: (p) => (
      <section className="v-hero-mesh">
        <span className="v-badge">✦ {p.eyebrow || "Introducing v2"}</span>
        <h1>{p.headline}</h1>
        <p>{p.subheadline}</p>
        <div className="v-hero-actions">
          <button className="v-white-btn">{p.primaryCta}</button>
          <button className="v-ghost-btn">{p.secondaryCta}</button>
        </div>
      </section>
    ),
  },
  {
    id: "mockup",
    label: "App mockup",
    render: (p) => (
      <section className="v-hero-mock">
        <h1>{p.headline}</h1>
        <p>{p.subheadline}</p>
        <div className="v-hero-actions">
          <button className="v-pill-btn">{p.primaryCta}</button>
          <button className="v-ghost-btn v-ghost-btn--dark">{p.secondaryCta}</button>
        </div>
        <div className="v-browser">
          <div className="v-browser-bar"><i /><i /><i /><span /></div>
          <div className="v-browser-body">
            <aside>{[1, 2, 3, 4].map((n) => <i key={n} />)}</aside>
            <main>
              <div className="v-kpis">{[1, 2, 3].map((n) => <b key={n} />)}</div>
              <div className="v-chart">{[35, 55, 42, 70, 58, 88, 64, 95].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
            </main>
          </div>
        </div>
      </section>
    ),
  },
  {
    id: "cinema",
    label: "Cinematic",
    render: (p) => (
      <section
        className="v-hero-cinema"
        style={p.visualImage ? { backgroundImage: `url(${p.visualImage})`, backgroundSize: "cover", backgroundPosition: "center" } : p.visualColor ? { background: p.visualColor } : undefined}
      >
        <div className="v-cinema-copy">
          <span className="v-eyebrow v-eyebrow--light">Watch the story</span>
          <h1>{p.headline}</h1>
          <p>{p.subheadline}</p>
          <div className="v-hero-actions">
            <button className="v-play"><i />Play film</button>
            <button className="v-ghost-btn">{p.primaryCta}</button>
          </div>
        </div>
        <div className="v-cinema-scrim" />
      </section>
    ),
  },
  {
    id: "stats",
    label: "Split + proof",
    render: (p) => (
      <section className="v-hero-proof">
        <div>
          <h1>{p.headline}</h1>
          <p>{p.subheadline}</p>
          <div className="v-hero-actions">
            <button className="v-pill-btn v-pill-btn--lg">{p.primaryCta}</button>
            <button className="v-link-btn">{p.secondaryCta}</button>
          </div>
          <div className="v-proof-row">
            {[["4.9", "rating"], ["10K+", "teams"], ["99.9%", "uptime"]].map(([a, b]) => (
              <div key={a}><b>{a}</b><span>{b}</span></div>
            ))}
          </div>
        </div>
        <div className="v-proof-art">
          {p.visualImage ? (
            <i style={{ inset: 0, backgroundImage: `url(${p.visualImage})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          ) : (
            <>
              <i style={p.visualColor ? { background: p.visualColor } : undefined} />
              <i />
              <i />
            </>
          )}
        </div>
      </section>
    ),
  },
];

/* ─────────────── Features ─────────────── */
const featItems = (p: Record<string, any>) => (p.items || []) as { title: string; text: string; image?: string; color?: string; color2?: string }[];

export const FEATURES_EXTRA: VariantDef[] = [
  {
    id: "bento",
    label: "Bento grid",
    render: (p) => (
      <section className="v-feat">
        <div className="v-feat-head"><h2>{p.heading}</h2><p>{p.subheading}</p></div>
        <div className="v-bento">
          {featItems(p).map((i, n) => (
            <div key={n} className={`v-bento-cell v-bento-cell--${n % 4}`}>
              <span className="v-bento-ico">{["✦", "◆", "◐", "▦"][n % 4]}</span>
              <h3>{i.title}</h3>
              <p>{i.text}</p>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "zigzag",
    label: "Alternating rows",
    render: (p) => (
      <section className="v-feat">
        <div className="v-feat-head"><h2>{p.heading}</h2><p>{p.subheading}</p></div>
        <div className="v-zig">
          {featItems(p).map((i, n) => (
            <div key={n} className={`v-zig-row ${n % 2 ? "is-flip" : ""}`}>
              <div><span className="v-num">0{n + 1}</span><h3>{i.title}</h3><p>{i.text}</p></div>
              <div className="v-zig-art" style={i.image ? { backgroundImage: `url(${i.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                {!i.image && (
                  <>
                    <i style={i.color ? { background: i.color } : undefined} />
                    <i style={i.color2 ? { background: i.color2 } : undefined} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "spotlight",
    label: "Spotlight",
    render: (p) => {
      const it = featItems(p);
      return (
        <section className="v-feat v-spot">
          <div className="v-spot-main">
            <span className="v-eyebrow">Featured</span>
            <h2>{it[0]?.title || p.heading}</h2>
            <p>{it[0]?.text}</p>
            <button className="v-pill-btn">Learn more</button>
          </div>
          <ul className="v-spot-list">
            {it.slice(1).concat(it.slice(0, 1)).slice(0, 3).map((i, n) => (
              <li key={n}><b>{i.title}</b><span>{i.text}</span></li>
            ))}
          </ul>
        </section>
      );
    },
  },
  {
    id: "checks",
    label: "Checklist",
    render: (p) => (
      <section className="v-feat v-checks">
        <div className="v-feat-head v-feat-head--left"><h2>{p.heading}</h2><p>{p.subheading}</p></div>
        <ul>
          {featItems(p).map((i, n) => (
            <li key={n}><span className="v-tick">✓</span><div><b>{i.title}</b><p>{i.text}</p></div></li>
          ))}
        </ul>
      </section>
    ),
  },
];

/* ─────────────── Cards ─────────────── */
export const CARDS_EXTRA: VariantDef[] = [
  {
    id: "gradient",
    label: "Gradient tiles",
    render: (p) => (
      <section className="v-cards">
        {(p.items || []).map((i: any, n: number) => (
          <div key={n} className={`v-gcard v-gcard--${n % 3}`}>
            <h3>{i.title}</h3>
            <p>{i.text}</p>
          </div>
        ))}
      </section>
    ),
  },
  {
    id: "icons",
    label: "Icon tiles",
    render: (p) => (
      <section className="v-cards">
        {(p.items || []).map((i: any, n: number) => (
          <div key={n} className="v-icard">
            <span className="v-icard-ico">{["✦", "◆", "◐", "▦"][n % 4]}</span>
            <h3>{i.title}</h3>
            <p>{i.text}</p>
          </div>
        ))}
      </section>
    ),
  },
  {
    id: "horizontal",
    label: "Horizontal",
    render: (p) => (
      <section className="v-cards v-cards--col">
        {(p.items || []).map((i: any, n: number) => (
          <div key={n} className="v-hcard">
            <span
              className="v-hcard-thumb"
              style={i.image ? { backgroundImage: `url(${i.image})`, backgroundSize: "cover", backgroundPosition: "center" } : i.color ? { background: i.color } : undefined}
            />
            <div><h3>{i.title}</h3><p>{i.text}</p></div>
            <span className="v-hcard-go">View</span>
          </div>
        ))}
      </section>
    ),
  },
];

/* ─────────────── Pricing ─────────────── */
const tiers = (p: Record<string, any>) => (p.tiers || []) as { name: string; price: string; unit?: string; features: string[]; button?: string; featured?: boolean; badge?: string }[];

export const PRICING_EXTRA: VariantDef[] = [
  {
    id: "toggle",
    label: "Monthly / yearly",
    render: (p) => (
      <section className="v-price">
        <h2>{p.heading}</h2>
        <div className="v-toggle"><span className="is-on">Monthly</span><span>Yearly <em>-20%</em></span></div>
        <div className="v-price-grid">
          {tiers(p).map((t, n) => (
            <div key={n} className={`v-tier ${t.featured ? "is-featured" : ""}`}>
              {t.featured && <span className="v-tier-flag">Most popular</span>}
              <h3>{t.name}</h3>
              <div className="v-amount"><b>{t.price}</b><span>/{(t.unit || "month").replace("per ", "")}</span></div>
              <ul>{t.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <button className={t.featured ? "v-pill-btn" : "v-outline-btn"}>{t.button || "Choose"}</button>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "compare",
    label: "Comparison table",
    render: (p) => {
      const t = tiers(p);
      const all = Array.from(new Set(t.flatMap((x) => x.features)));
      return (
        <section className="v-price">
          <h2>{p.heading}</h2>
          <table className="v-compare">
            <thead>
              <tr><th />{t.map((x) => <th key={x.name} className={x.featured ? "is-featured" : ""}>{x.name}<b>{x.price}</b></th>)}</tr>
            </thead>
            <tbody>
              {all.map((f) => (
                <tr key={f}><td>{f}</td>{t.map((x) => <td key={x.name} className={x.featured ? "is-featured" : ""}>{x.features.includes(f) ? "✓" : "–"}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    },
  },
  {
    id: "rows",
    label: "Compact rows",
    render: (p) => (
      <section className="v-price v-price--rows">
        <h2>{p.heading}</h2>
        {tiers(p).map((t, n) => (
          <div key={n} className={`v-row-plan ${t.featured ? "is-featured" : ""}`}>
            <div><h3>{t.name}</h3><span>{t.features.slice(0, 3).join(" · ")}</span></div>
            <div className="v-amount"><b>{t.price}</b><span>/{(t.unit || "month").replace("per ", "")}</span></div>
            <button className={t.featured ? "v-pill-btn" : "v-outline-btn"}>{t.button || "Choose"}</button>
          </div>
        ))}
      </section>
    ),
  },
];

/* ─────────────── Footer ─────────────── */
export const FOOTER_EXTRA: VariantDef[] = [
  {
    id: "utility",
    label: "Utility bar",
    render: (p) => (
      <footer className="v-foot-util">
        <span>{p.left}</span>
        <div>{String(p.right || "").split("·").map((x, i) => <span key={i}>{x.trim()}</span>)}</div>
      </footer>
    ),
  },
  {
    id: "cta",
    label: "CTA-led",
    render: (p) => (
      <footer className="v-foot-cta">
        <div className="v-foot-cta-card">
          <h3>Ready when you are.</h3>
          <button className="v-white-btn">Start building</button>
        </div>
        <div className="v-foot-cols">
          <b>{p.brand}</b>
          {[["Product", "Features", "Pricing", "Docs"], ["Company", "About", "Careers", "Contact"], ["Legal", "Privacy", "Terms"]].map(([h, ...x]) => (
            <div key={h}><h4>{h}</h4>{x.map((y) => <span key={y}>{y}</span>)}</div>
          ))}
        </div>
        <div className="v-foot-base">{p.left}</div>
      </footer>
    ),
  },
  {
    id: "wordmark",
    label: "Big wordmark",
    render: (p) => (
      <footer className="v-foot-word">
        <div className="v-foot-word-top">
          <span>{p.right}</span>
          <span>{p.left}</span>
        </div>
        <div className="v-wordmark">{p.brand}</div>
      </footer>
    ),
  },
  {
    id: "newsletter",
    label: "Newsletter",
    render: (p) => (
      <footer className="v-foot-news">
        <div>
          <b>{p.brand}</b>
          <p>Product notes, once a month. No spam.</p>
          <div className="v-news-form"><span>you@company.com</span><button className="v-pill-btn">Subscribe</button></div>
        </div>
        <div className="v-foot-news-links">{String(p.right || "").split("·").map((x, i) => <span key={i}>{x.trim()}</span>)}<em>{p.left}</em></div>
      </footer>
    ),
  },
];

/* ─────────────── Testimonials ─────────────── */
const quotes = (p: Record<string, any>) => (p.items || []) as { quote: string; name: string; role: string }[];

export const TESTIMONIALS_EXTRA: VariantDef[] = [
  {
    id: "spotlight",
    label: "Big quote",
    render: (p) => {
      const q = quotes(p)[0];
      return (
        <section className="v-quote-big">
          <span className="v-qmark">“</span>
          <blockquote>{q?.quote}</blockquote>
          <div className="v-quote-by"><span className="v-avatar">{initials(q?.name)}</span><div><b>{q?.name}</b><span>{q?.role}</span></div></div>
          <div className="v-dots"><i className="is-on" /><i /><i /></div>
        </section>
      );
    },
  },
  {
    id: "wall",
    label: "Wall of love",
    render: (p) => (
      <section className="v-wall">
        <h2>{p.heading}</h2>
        <div className="v-wall-grid">
          {quotes(p).concat(quotes(p)).slice(0, 4).map((q, n) => (
            <div key={n} className="v-wall-card">
              <span className="v-stars">★★★★★</span>
              <p>{q.quote}</p>
              <div className="v-quote-by"><span className="v-avatar">{initials(q.name)}</span><div><b>{q.name}</b><span>{q.role}</span></div></div>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "rating",
    label: "Rating banner",
    render: (p) => (
      <section className="v-rating">
        <div className="v-rating-score"><b>4.9</b><span className="v-stars">★★★★★</span><em>from 2,400+ reviews</em></div>
        <div className="v-rating-quotes">
          {quotes(p).map((q, n) => <figure key={n}><blockquote>{q.quote}</blockquote><figcaption>{q.name}, {q.role}</figcaption></figure>)}
        </div>
      </section>
    ),
  },
];

/* ─────────────── CTA ─────────────── */
export const CTA_EXTRA: VariantDef[] = [
  {
    id: "card",
    label: "Split card",
    render: (p) => (
      <section className="v-cta-wrap">
        <div className="v-cta-card">
          <div><h2>{p.heading}</h2><p>{p.subheading}</p></div>
          <div className="v-cta-actions"><button className="v-white-btn">{p.button}</button>{(p.note ?? "No credit card") && <span>{p.note ?? "No credit card"}</span>}</div>
        </div>
      </section>
    ),
  },
  {
    id: "banner",
    label: "Gradient banner",
    render: (p) => (
      <section className="v-cta-banner">
        <h2>{p.heading}</h2>
        <p>{p.subheading}</p>
        <button className="v-white-btn v-white-btn--lg">{p.button}</button>
      </section>
    ),
  },
  {
    id: "line",
    label: "Minimal line",
    render: (p) => (
      <section className="v-cta-line">
        <h2>{p.heading}</h2>
        <button className="v-pill-btn v-pill-btn--lg">{p.button}</button>
      </section>
    ),
  },
];

/* ─────────────── Forms / FAQ ─────────────── */
export const FORMS_EXTRA: VariantDef[] = [
  {
    id: "split",
    label: "Split contact",
    render: (p) => (
      <section className="v-form-split">
        <div className="v-form-info">
          <h2>{p.heading}</h2>
          <p>{p.subheading}</p>
          <ul><li>hello@brand.com</li><li>+91 98765 43210</li><li>Mon to Fri, 9 to 6</li></ul>
        </div>
        <form className="v-form-card" onSubmit={(e) => e.preventDefault()}>
          <input placeholder="Full name" />
          <input placeholder="Email address" />
          <textarea placeholder="How can we help?" rows={3} />
          <button className="v-pill-btn">Send message</button>
        </form>
      </section>
    ),
  },
];

export const FAQ_EXTRA: VariantDef[] = [
  {
    id: "twocol",
    label: "Two columns",
    render: (p) => (
      <section className="v-faq2">
        <h2>{p.heading}</h2>
        <div className="v-faq2-grid">
          {(p.items || []).concat(p.items || []).slice(0, 4).map((i: any, n: number) => (
            <div key={n} className="v-faq2-item"><b>{i.q}</b><p>{i.a}</p></div>
          ))}
        </div>
      </section>
    ),
  },
];

export const EXTRA_VARIANTS: Record<string, VariantDef[]> = {
  navbar: NAVBAR_EXTRA,
  hero: HERO_EXTRA,
  features: FEATURES_EXTRA,
  cards: CARDS_EXTRA,
  pricing: PRICING_EXTRA,
  footer: FOOTER_EXTRA,
  testimonials: TESTIMONIALS_EXTRA,
  cta: CTA_EXTRA,
  forms: FORMS_EXTRA,
  faq: FAQ_EXTRA,
};
