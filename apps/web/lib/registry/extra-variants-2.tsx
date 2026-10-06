import type { ComponentDef, VariantDef } from "./types";

type Product = { name: string; price: string; description: string; image?: string };
const products = (p: Record<string, any>) => (p.items || []) as Product[];
const art = (i: { image?: string }, n: number): React.CSSProperties =>
  i.image
    ? { backgroundImage: `url(${i.image})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: ["linear-gradient(135deg,#22d3ee,#4c1d95)", "linear-gradient(135deg,#ff5b7f,#6b4d9a)", "linear-gradient(135deg,#f59e0b,#b45309)", "linear-gradient(135deg,#34d399,#0f766e)"][n % 4] };

/* ─────────────── Catalog ─────────────── */
export const CATALOG_EXTRA: VariantDef[] = [
  {
    id: "showcase",
    label: "Hero product + list",
    render: (p) => {
      const it = products(p);
      return (
        <section className="v-cat v-cat-show">
          <div className="v-cat-feature">
            <div className="v-cat-feature-art" style={art(it[0] || {}, 0)}><span className="v-cat-flag">Best seller</span></div>
            <div className="v-cat-feature-info"><h3>{it[0]?.name}</h3><p>{it[0]?.description}</p><div><b>{it[0]?.price}</b><button className="v-pill-btn">Add to cart</button></div></div>
          </div>
          <div className="v-cat-side">
            <h2>{p.heading}</h2>
            {it.slice(1).map((i, n) => (
              <div key={n} className="v-cat-row"><span className="v-cat-thumb" style={art(i, n + 1)} /><div><b>{i.name}</b><span>{i.description}</span></div><em>{i.price}</em></div>
            ))}
          </div>
        </section>
      );
    },
  },
  {
    id: "menu",
    label: "Price list (menu)",
    render: (p) => (
      <section className="v-cat v-cat-menu">
        <div className="v-cat-menu-head"><h2>{p.heading}</h2><p>{p.subheading}</p></div>
        <div className="v-cat-menu-list">
          {products(p).map((i, n) => (
            <div key={n} className="v-menu-item"><div className="v-menu-line"><b>{i.name}</b><span className="v-dots-fill" /><em>{i.price}</em></div><p>{i.description}</p></div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "tiles",
    label: "Overlay tiles",
    render: (p) => (
      <section className="v-cat">
        <h2 className="v-cat-title">{p.heading}</h2>
        <div className="v-cat-tiles">
          {products(p).map((i, n) => (
            <div key={n} className="v-cat-tile" style={art(i, n)}>
              <div className="v-cat-tile-info"><b>{i.name}</b><span>{i.price}</span></div>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "carousel",
    label: "Scrolling row",
    render: (p) => (
      <section className="v-cat">
        <div className="v-cat-bar"><h2 className="v-cat-title">{p.heading}</h2><span className="v-cat-arrows"><i /><i /></span></div>
        <div className="v-cat-rail">
          {products(p).concat(products(p)).map((i, n) => (
            <div key={n} className="v-cat-slide">
              <div className="v-cat-slide-art" style={art(i, n)}><span className="v-heart">♡</span></div>
              <b>{i.name}</b><em>{i.price}</em>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "masonry",
    label: "Staggered gallery",
    render: (p) => (
      <section className="v-cat">
        <h2 className="v-cat-title">{p.heading}</h2>
        <div className="v-cat-mason">
          {products(p).concat(products(p)).map((i, n) => (
            <div key={n} className="v-mason-item">
              <div style={{ ...art(i, n), height: [180, 240, 150, 210][n % 4] }} />
              <div className="v-mason-info"><b>{i.name}</b><span>{i.price}</span></div>
            </div>
          ))}
        </div>
      </section>
    ),
  },
  {
    id: "compact",
    label: "Compact quick-add",
    render: (p) => (
      <section className="v-cat">
        <h2 className="v-cat-title">{p.heading}</h2>
        <div className="v-cat-compact">
          {products(p).concat(products(p)).slice(0, 6).map((i, n) => (
            <div key={n} className="v-compact-card">
              <span className="v-compact-art" style={art(i, n)} />
              <div><b>{i.name}</b><em>{i.price}</em></div>
              <button className="v-plus" aria-label={`Add ${i.name}`}>+</button>
            </div>
          ))}
        </div>
      </section>
    ),
  },
];

/* ─────────────── Banners (social sections) ─────────────── */
const AV = ["#6b4d9a", "#ff5b7f", "#3b82f6", "#f59e0b"];
const avatars = () => (
  <span className="v-avstack">
    {AV.map((c, i) => <i key={i} style={{ background: c }}>{["A", "R", "M", "S"][i]}</i>)}
  </span>
);

export const BANNER_EXTRA: VariantDef[] = [
  {
    id: "gradient",
    label: "Gradient announcement",
    render: (p) => (
      <div className="v-ban v-ban-grad"><span className="v-ban-tag">New</span><span>{p.text}</span><button className="v-white-btn">{p.cta || "See what's new"}</button></div>
    ),
  },
  {
    id: "follow",
    label: "Follow us",
    render: (p) => (
      <div className="v-ban v-ban-follow">
        <b>Follow {p.handle || "@yourbrand"}</b>
        <div className="v-soc">
          {[["Instagram", "#e1306c"], ["X", "#111"], ["YouTube", "#ff0000"], ["LinkedIn", "#0a66c2"]].map(([n, c]) => <span key={n} style={{ ["--c" as string]: c }}><i>{n[0]}</i>{n}</span>)}
        </div>
      </div>
    ),
  },
  {
    id: "proof",
    label: "Social proof",
    render: (p) => (
      <div className="v-ban v-ban-proof">
        {avatars()}
        <div><span className="v-stars">★★★★★</span><b>Loved by 12,000+ makers</b><span>{p.text}</span></div>
        <button className="v-pill-btn">{p.cta || "Join them"}</button>
      </div>
    ),
  },
  {
    id: "countdown",
    label: "Sale countdown",
    render: (p) => (
      <div className="v-ban v-ban-sale">
        <b>{p.text}</b>
        <div className="v-count">{[["02", "days"], ["14", "hrs"], ["37", "min"], ["09", "sec"]].map(([n, l]) => <span key={l}><b>{n}</b>{l}</span>)}</div>
        <button className="v-white-btn">{p.cta || "Shop the sale"}</button>
      </div>
    ),
  },
  {
    id: "cookie",
    label: "Cookie consent",
    render: (p) => (
      <div className="v-ban v-ban-cookie">
        <span className="v-cookie-ico">◔</span>
        <p>{p.text}</p>
        <button className="v-outline-btn">Settings</button>
        <button className="v-pill-btn">Accept all</button>
      </div>
    ),
  },
  {
    id: "newsletter",
    label: "Newsletter strip",
    render: (p) => (
      <div className="v-ban v-ban-news">
        <div><b>Stay in the loop</b><span>{p.text}</span></div>
        <div className="v-news-form"><span>you@company.com</span><button className="v-pill-btn">{p.cta || "Subscribe"}</button></div>
      </div>
    ),
  },
  {
    id: "toast",
    label: "Live activity",
    render: (p) => (
      <div className="v-ban v-ban-toast">
        <div className="v-toast"><span className="v-toast-av">A</span><div><b>Aarav from Pune</b><span>just upgraded to Pro · 2 min ago</span></div><i className="v-live" /></div>
        <div className="v-toast v-toast--2"><span className="v-toast-av" style={{ background: "#ff5b7f" }}>M</span><div><b>Meera from Kochi</b><span>{p.text}</span></div></div>
      </div>
    ),
  },
  {
    id: "share",
    label: "Share bar",
    render: () => (
      <div className="v-ban v-ban-share">
        <b>Share this</b>
        {["X", "in", "WhatsApp", "Copy link"].map((n) => <button key={n} className="v-share-btn">{n}</button>)}
        <span className="v-share-count">1.2k shares</span>
      </div>
    ),
  },
  {
    id: "community",
    label: "Join community",
    render: (p) => (
      <div className="v-ban v-ban-comm">
        <span className="v-comm-logo">◆</span>
        <div><b>Join the community</b><span>{p.text}</span></div>
        {avatars()}
        <button className="v-white-btn">{p.cta || "Join Discord"}</button>
      </div>
    ),
  },
  {
    id: "ticker",
    label: "Scrolling ticker",
    render: (p) => (
      <div className="v-ban v-ban-ticker">
        <div className="v-ticker-track">
          {Array.from({ length: 6 }).map((_, i) => <span key={i}>{p.text} ✦</span>)}
        </div>
      </div>
    ),
  },
];

/* ─────────────── Timeline (new component) ─────────────── */
type Step = { date: string; title: string; text: string };
const steps = (p: Record<string, any>) => (p.items || []) as Step[];

export const timeline: ComponentDef = {
  type: "timeline",
  label: "Timeline",
  category: "Content",
  icon: "⌁",
  variants: [
    {
      id: "alternating",
      label: "Alternating vertical",
      render: (p) => (
        <section className="v-tl">
          <h2 className="v-tl-title">{p.heading}</h2>
          <div className="v-tl-alt">
            {steps(p).map((s, n) => (
              <div key={n} className={`v-tl-row ${n % 2 ? "is-right" : ""}`}>
                <div className="v-tl-card"><span className="v-tl-date">{s.date}</span><h3>{s.title}</h3><p>{s.text}</p></div>
                <span className="v-tl-dot" />
              </div>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: "simple",
      label: "Simple line",
      render: (p) => (
        <section className="v-tl v-tl-simple-wrap">
          <h2 className="v-tl-title">{p.heading}</h2>
          <ol className="v-tl-simple">
            {steps(p).map((s, n) => (
              <li key={n}><span className="v-tl-dot" /><span className="v-tl-date">{s.date}</span><h3>{s.title}</h3><p>{s.text}</p></li>
            ))}
          </ol>
        </section>
      ),
    },
    {
      id: "horizontal",
      label: "Horizontal",
      render: (p) => (
        <section className="v-tl">
          <h2 className="v-tl-title">{p.heading}</h2>
          <div className="v-tl-h">
            {steps(p).map((s, n) => (
              <div key={n} className="v-tl-h-step"><span className="v-tl-date">{s.date}</span><span className="v-tl-dot" /><h3>{s.title}</h3><p>{s.text}</p></div>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: "steps",
      label: "Numbered steps",
      render: (p) => (
        <section className="v-tl">
          <h2 className="v-tl-title">{p.heading}</h2>
          <div className="v-tl-steps">
            {steps(p).map((s, n) => (
              <div key={n} className="v-tl-step"><span className="v-tl-num">{String(n + 1).padStart(2, "0")}</span><h3>{s.title}</h3><p>{s.text}</p><em>{s.date}</em></div>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: "roadmap",
      label: "Roadmap columns",
      render: (p) => (
        <section className="v-tl">
          <h2 className="v-tl-title">{p.heading}</h2>
          <div className="v-tl-road">
            {steps(p).slice(0, 4).map((s, n) => (
              <div key={n} className="v-road-col">
                <div className="v-road-head"><b>{s.date}</b><span className={`v-road-state ${n === 0 ? "is-done" : n === 1 ? "is-now" : ""}`}>{n === 0 ? "Shipped" : n === 1 ? "In progress" : "Planned"}</span></div>
                <div className="v-road-card"><h3>{s.title}</h3><p>{s.text}</p></div>
              </div>
            ))}
          </div>
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Our journey",
    items: [
      { date: "2022", title: "Founded", text: "Three friends, one idea and a very small office." },
      { date: "2023", title: "First 1,000 customers", text: "Word of mouth carried us further than we expected." },
      { date: "2024", title: "AI assistant launched", text: "Describe a change, review it, apply it." },
      { date: "2025", title: "Going global", text: "Localized for 12 languages and new regions." },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    {
      key: "items",
      label: "Milestones",
      type: "array",
      path: "items",
      itemLabel: "Milestone",
      itemFields: [
        { key: "date", label: "Date / label", type: "text", path: "date" },
        { key: "title", label: "Title", type: "text", path: "title" },
        { key: "text", label: "Description", type: "textarea", path: "text" },
      ],
    },
  ],
};

export const EXTRA_VARIANTS_2: Record<string, VariantDef[]> = {
  catalog: CATALOG_EXTRA,
  notifications: BANNER_EXTRA,
};
