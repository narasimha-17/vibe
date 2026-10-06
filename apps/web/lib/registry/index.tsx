import { Heart, Search, ShoppingCart, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { ComponentDef } from "./types";
import { EXTRA_VARIANTS } from "./extra-variants";
import { EXTRA_VARIANTS_2, timeline } from "./extra-variants-2";
import { EXTRA_VARIANTS_3 } from "./extra-variants-3";
import { socials } from "./socials";
import { chatbot } from "./chatbot";
import { shop, tracking } from "./shop";
import { auth } from "./auth";

/**
 * Single source of truth for the palette, canvas renderer, and the
 * generic Inspector (driven entirely by `editableFields` — see
 * components/builder/Inspector.tsx). Mirrors apps/api/app/codegen/registry.py
 * type/variant keys and default props so a project built here maps
 * predictably onto the generated code (the two are intentionally
 * decoupled implementations of the same contract — see the plan).
 */

/** Optional Login button (+ custom CTA label) shared by every navbar variant. */
const withLogin = (p: Record<string, any>, cta: ReactNode) =>
  p.loginLabel ? (
    <div className="navbar__actions">
      <button className="navbar__login">{p.loginLabel}</button>
      {cta}
    </div>
  ) : (
    cta
  );

/** The brand: the uploaded logo image when set (Design step / Inspector), else the brand name as text. */
const Brand = (p: Record<string, any>) => (p.logoUrl ? <img className="navbar__logo" src={p.logoUrl} alt={p.brand || "Logo"} /> : <div className="navbar__brand">{p.brand}</div>);

const navbar: ComponentDef = {
  type: "navbar",
  label: "Navbar",
  category: "Navigation",
  icon: "▤",
  variants: [
    {
      id: "default",
      label: "Default",
      render: (p) => (
        <nav className="navbar">
          <Brand {...p} />
          <div className="navbar__links">
            {(p.links || []).map((l: string, i: number) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          {withLogin(p, <button className="navbar__cta">{p.ctaLabel || "Get Started"}</button>)}
        </nav>
      ),
    },
    {
      id: "dark",
      label: "Dark",
      render: (p) => (
        <nav className="navbar navbar--dark">
          <Brand {...p} />
          <div className="navbar__links">
            {(p.links || []).map((l: string, i: number) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          {withLogin(p, <button className="navbar__cta">{p.ctaLabel || "Get Started"}</button>)}
        </nav>
      ),
    },
    {
      id: "minimal",
      label: "Minimal",
      render: (p) => (
        <nav className="navbar navbar--minimal">
          <Brand {...p} />
          <div className="navbar__links">
            {(p.links || []).map((l: string, i: number) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          {p.loginLabel && <button className="navbar__login">{p.loginLabel}</button>}
        </nav>
      ),
    },
    {
      id: "megabar",
      label: "Megabar",
      render: (p) => (
        <nav className="navbar navbar--megabar">
          <div className="navbar__announcement">New: {p.announcement || "Build faster with VIBE"}</div>
          <div className="navbar__main">
            <Brand {...p} />
            <div className="navbar__links">
              {(p.links || []).map((l: string, i: number) => (
                <span key={i}>{l}</span>
              ))}
            </div>
            {withLogin(p, <button className="navbar__cta">{p.cta || "Get Started"}</button>)}
          </div>
        </nav>
      ),
    },
  ],
  defaultProps: { brand: "Brand", logoUrl: "", links: ["Home", "About", "Contact"] },
  editableFields: [
    { key: "brand", label: "Brand Name", type: "text", path: "brand" },
    { key: "logoUrl", label: "Logo (replaces the brand name)", type: "image", path: "logoUrl" },
    { key: "ctaLabel", label: "Main button label", type: "text", path: "ctaLabel" },
    { key: "loginLabel", label: "Login button label (empty = hidden)", type: "text", path: "loginLabel" },
    {
      key: "links",
      label: "Nav Links",
      type: "array",
      path: "links",
      itemLabel: "Link",
      itemFields: [{ key: "value", label: "Label", type: "text", path: "" }],
    },
    {
      key: "topbar",
      label: "Top strip (Two-tier style)",
      type: "array",
      path: "topbar",
      itemLabel: "Item",
      itemFields: [{ key: "value", label: "Text", type: "text", path: "" }],
    },
  ],
};

const hero: ComponentDef = {
  type: "hero",
  label: "Hero",
  category: "Headers",
  icon: "✦",
  variants: [
    {
      id: "split",
      label: "Split",
      render: (p) => (
        <section className="hero hero--split">
          <div className="hero__content">
            <h1>{p.headline}</h1>
            <p>{p.subheadline}</p>
            <div className="hero__actions">
              <button className="btn btn-primary">{p.primaryCta}</button>
              <button className="btn">{p.secondaryCta}</button>
            </div>
          </div>
          <div
            className="hero__visual"
            style={{
              background: p.visualImage ? `url(${p.visualImage}) center / cover no-repeat` : p.visualColor || undefined,
            }}
          >
            {p.visualVideo && <video className="hero__video" src={p.visualVideo} poster={p.visualImage || undefined} autoPlay muted loop playsInline preload="metadata" />}
          </div>
        </section>
      ),
    },
    {
      id: "page-header",
      label: "Page header",
      render: (p) => (
        <section className="page-head">
          <div className="page-head__crumb"><span>Home</span><i>/</i><b>{p.eyebrow || p.headline}</b></div>
          <div className="page-head__row">
            <div>
              <h1>{p.headline}</h1>
              <p>{p.subheadline}</p>
            </div>
            {(p.primaryCta || p.secondaryCta) && (
              <div className="page-head__actions">
                {p.primaryCta && <button className="btn btn-primary">{p.primaryCta}</button>}
                {p.secondaryCta && <button className="btn">{p.secondaryCta}</button>}
              </div>
            )}
          </div>
        </section>
      ),
    },
    {
      id: "centered",
      label: "Centered",
      render: (p) => (
        <section className="hero hero--centered">
          <h1>{p.headline}</h1>
          <p>{p.subheadline}</p>
          <div className="hero__actions">
            <button className="btn btn-primary">{p.primaryCta}</button>
            <button className="btn">{p.secondaryCta}</button>
          </div>
        </section>
      ),
    },
  ],
  defaultProps: {
    headline: "Build something remarkable.",
    subheadline: "A visual website builder for people who want the speed of no-code and the freedom of production-ready code.",
    primaryCta: "Start Building",
    secondaryCta: "Explore Features",
    visualColor: "#30256f",
    visualImage: "",
    visualVideo: "",
    bgVideo: "",
    videoDim: 0.45,
  },
  editableFields: [
    { key: "headline", label: "Headline", type: "textarea", path: "headline" },
    { key: "subheadline", label: "Subheadline", type: "textarea", path: "subheadline" },
    { key: "primaryCta", label: "Primary Button", type: "text", path: "primaryCta" },
    { key: "secondaryCta", label: "Secondary Button", type: "text", path: "secondaryCta" },
    { key: "visualColor", label: "Visual Color", type: "color", path: "visualColor" },
  ],
};

const features: ComponentDef = {
  type: "features",
  label: "Features",
  category: "Content Sections",
  icon: "◫",
  variants: [
    {
      id: "grid",
      label: "Grid",
      render: (p) => (
        <section className="features">
          <div className="features__heading">
            <h2>{p.heading}</h2>
            <p>{p.subheading}</p>
          </div>
          <div className="features__grid">
            {(p.items || []).map((i: any, idx: number) => (
              <div className="card" key={idx}>
                <h3>{i.title}</h3>
                <p>{i.text}</p>
              </div>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: "list",
      label: "List",
      render: (p) => (
        <section className="features features--list">
          <div className="features__heading">
            <h2>{p.heading}</h2>
            <p>{p.subheading}</p>
          </div>
          <div className="features__grid">
            {(p.items || []).map((i: any, idx: number) => (
              <div className="card" key={idx}>
                <h3>{i.title}</h3>
                <p>{i.text}</p>
              </div>
            ))}
          </div>
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Everything you need.",
    subheading: "Design faster without compromising on code quality.",
    items: [
      { title: "Visual Design", text: "Drag components onto the canvas and customize every detail." },
      { title: "AI Powered", text: "Describe changes in plain language and let AI edit your design." },
      { title: "Own Your Code", text: "Export a clean, production-ready project anytime." },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    { key: "subheading", label: "Subheading", type: "textarea", path: "subheading" },
    {
      key: "items",
      label: "Feature Items",
      type: "array",
      path: "items",
      itemLabel: "Feature",
      itemFields: [
        { key: "title", label: "Title", type: "text", path: "title" },
        { key: "text", label: "Description", type: "textarea", path: "text" },
        { key: "image", label: "Image (replaces the artwork)", type: "image", path: "image" },
        { key: "color", label: "Artwork color 1", type: "color", path: "color" },
        { key: "color2", label: "Artwork color 2", type: "color", path: "color2" },
      ],
    },
  ],
};

const cards: ComponentDef = {
  type: "cards",
  label: "Cards",
  category: "Cards",
  icon: "▭",
  variants: [
    {
      id: "simple",
      label: "Simple",
      render: (p) => (
        <section className="cards">
          {(p.items || []).map((i: any, idx: number) => (
            <div className="card" key={idx}>
              <h3>{i.title}</h3>
              <p>{i.text}</p>
            </div>
          ))}
        </section>
      ),
    },
    {
      id: "numbered",
      label: "Numbered",
      render: (p) => (
        <section className="cards">
          {(p.items || []).map((i: any, idx: number) => (
            <div className="card card--numbered" key={idx}>
              <span className="card__number">{idx + 1}</span>
              <h3>{i.title}</h3>
              <p>{i.text}</p>
            </div>
          ))}
        </section>
      ),
    },
  ],
  defaultProps: {
    items: [
      { title: "Card One", text: "Add your content here." },
      { title: "Card Two", text: "Add your content here." },
      { title: "Card Three", text: "Add your content here." },
    ],
  },
  editableFields: [
    {
      key: "items",
      label: "Cards",
      type: "array",
      path: "items",
      itemLabel: "Card",
      itemFields: [
        { key: "title", label: "Title", type: "text", path: "title" },
        { key: "text", label: "Description", type: "textarea", path: "text" },
        { key: "image", label: "Image", type: "image", path: "image" },
        { key: "color", label: "Accent color", type: "color", path: "color" },
      ],
    },
  ],
};

const catalog: ComponentDef = {
  type: "catalog",
  label: "Catalog",
  category: "Commerce",
  icon: "▦",
  variants: [
    {
      id: "grid",
      label: "Product Grid",
      render: (p) => (
        <section className="catalog catalog--grid">
          <div className="catalog__heading"><h2>{p.heading}</h2><p>{p.subheading}</p></div>
          <div className="catalog__grid">
            {(p.items || []).map((item: any, idx: number) => (
              <article className="catalog__item" key={idx}>
                <div className="catalog__image" style={item.image ? { backgroundImage: `url(${item.image})` } : undefined} />
                <div className="catalog__body"><div><h3>{item.name}</h3><strong>{item.price}</strong></div><p>{item.description}</p><button>View product</button></div>
              </article>
            ))}
          </div>
        </section>
      ),
    },
    {
      id: "editorial",
      label: "Editorial List",
      render: (p) => (
        <section className="catalog catalog--editorial">
          <div className="catalog__heading"><h2>{p.heading}</h2><p>{p.subheading}</p></div>
          {(p.items || []).map((item: any, idx: number) => (
            <article className="catalog__row" key={idx}>
              <div className="catalog__image" style={item.image ? { backgroundImage: `url(${item.image})` } : undefined} />
              <div className="catalog__body"><h3>{item.name}</h3><p>{item.description}</p></div><strong>{item.price}</strong><button>View</button>
            </article>
          ))}
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Featured products",
    subheading: "Thoughtful objects, selected for your everyday.",
    items: [
      { name: "Everyday Tote", price: "₹1,999", description: "A durable carryall made for daily movement.", image: "" },
      { name: "Studio Mug", price: "₹899", description: "Hand-finished ceramic with a soft matte glaze.", image: "" },
      { name: "Field Notes", price: "₹499", description: "A pocket notebook for ideas worth keeping.", image: "" },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    { key: "subheading", label: "Subheading", type: "textarea", path: "subheading" },
    { key: "items", label: "Products", type: "array", path: "items", itemLabel: "Product", itemFields: [
      { key: "name", label: "Name", type: "text", path: "name" },
      { key: "price", label: "Price", type: "text", path: "price" },
      { key: "description", label: "Description", type: "textarea", path: "description" },
      { key: "image", label: "Image URL", type: "text", path: "image" },
    ] },
  ],
};

function splitPrice(price: string) {
  const m = String(price ?? "").match(/^(\D*)(.*)$/);
  return { symbol: (m?.[1] || "").trim(), amount: m?.[2] || "" };
}

function StoreArt() {
  return (
    <svg className="price__art" viewBox="0 0 120 80" width="110" height="74" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M28 32 L34 16 H86 L92 32 Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M28 32 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0" fill="currentColor" fillOpacity="0.35" />
      <rect x="32" y="42" width="56" height="28" />
      <rect x="54" y="50" width="12" height="20" />
      <rect x="38" y="48" width="12" height="10" />
      <rect x="70" y="48" width="12" height="10" />
      <path d="M18 70 H102" />
    </svg>
  );
}

const pricing: ComponentDef = {
  type: "pricing",
  label: "Pricing",
  category: "Pricing",
  icon: "◈",
  variants: [
    {
      id: "tiered",
      label: "3-Tier",
      render: (p) => (
        <section className="pricing pricing--showcase">
          <div className="pricing__heading">
            <h2>{p.heading}</h2>
          </div>
          <div className="pricing__grid">
            {(p.tiers || []).map((t: any, idx: number) => {
              const { symbol, amount } = splitPrice(t.price);
              return (
                <div className={`price ${t.featured ? "price--featured" : ""}`} key={idx}>
                  {t.featured && (
                    <div className="price__ribbon">
                      <span>{t.ribbon || "Popular"}</span>
                    </div>
                  )}
                  {t.badge && <div className="price__badge">{t.badge}</div>}
                  <StoreArt />
                  <h3>{t.name}</h3>
                  <ul>
                    {(t.features || []).map((f: string, fi: number) => (
                      <li key={fi}>{f}</li>
                    ))}
                  </ul>
                  <div className="price__amount">
                    {symbol && <span className="price__currency">{symbol}</span>}
                    <strong className="price__num">{amount}</strong>
                    {t.unit && <span className="price__unit">{t.unit}</span>}
                  </div>
                  <button className="price__btn">{t.button || (t.featured ? `Choose ${t.name}` : "Get started")}</button>
                </div>
              );
            })}
          </div>
        </section>
      ),
    },
    {
      id: "simple",
      label: "Single Plan",
      render: (p) => (
        <section className="pricing pricing--simple">
          <div className="pricing__heading">
            <h2>{p.heading}</h2>
          </div>
          <div className="pricing__grid">
            {(p.tiers || []).slice(0, 1).map((t: any, idx: number) => (
              <div className="price price--featured" key={idx}>
                <h3>{t.name}</h3>
                <strong>{t.price}</strong>
                <ul>
                  {(t.features || []).map((f: string, fi: number) => (
                    <li key={fi}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Plans for everyone.",
    tiers: [
      { name: "Starter", price: "₹499", unit: "per month", button: "Get started", features: ["Core features", "Email support"] },
      { name: "Pro", price: "₹999", unit: "per month", featured: true, button: "Choose Pro", features: ["All features", "Priority support", "Custom domain", "Advanced analytics"] },
      { name: "Business", price: "₹2,499", unit: "per month", badge: "20% OFF", button: "Choose Business", features: ["Everything in Pro", "Team seats", "Dedicated manager"] },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    {
      key: "tiers",
      label: "Pricing Tiers",
      type: "array",
      path: "tiers",
      itemLabel: "Tier",
      itemFields: [
        { key: "name", label: "Name", type: "text", path: "name" },
        { key: "price", label: "Price", type: "text", path: "price" },
        { key: "unit", label: "Price Unit (e.g. per store)", type: "text", path: "unit" },
        { key: "button", label: "Button Text", type: "text", path: "button" },
        { key: "badge", label: "Corner Badge (e.g. 20% OFF)", type: "text", path: "badge" },
      ],
    },
  ],
};

const footer: ComponentDef = {
  type: "footer",
  label: "Footer",
  category: "Footers",
  icon: "▬",
  variants: [
    {
      id: "simple",
      label: "Simple",
      render: (p) => (
        <footer className="footer">
          <span>{p.left}</span>
          <span>{p.right}</span>
        </footer>
      ),
    },
    {
      id: "columns",
      label: "Multi-column",
      render: (p) => (
        <footer className="footer footer--columns">
          <div className="footer__cols">
            <div>
              <strong>Product</strong>
              <span>Features</span>
              <span>Pricing</span>
            </div>
            <div>
              <strong>Company</strong>
              <span>About</span>
              <span>Careers</span>
            </div>
            <div>
              <strong>Legal</strong>
              <span>Privacy</span>
              <span>Terms</span>
            </div>
          </div>
          <span>© 2026 {p.brand}</span>
        </footer>
      ),
    },
  ],
  defaultProps: { left: "© 2026 Your Brand", right: "Privacy · Terms · Contact", brand: "Your Brand" },
  editableFields: [
    { key: "left", label: "Left Text", type: "text", path: "left" },
    { key: "right", label: "Right Text", type: "text", path: "right" },
    { key: "brand", label: "Brand (columns variant)", type: "text", path: "brand" },
  ],
};

const forms: ComponentDef = {
  type: "forms",
  label: "Forms",
  category: "Forms",
  icon: "▤",
  variants: [
    {
      id: "contact",
      label: "Contact Form",
      render: (p) => (
        <section className="formsec">
          <div className="formsec__heading">
            <h2>{p.heading}</h2>
            <p>{p.subheading}</p>
          </div>
          <div className="form-card">
            <div className="form-field">
              <label>Name</label>
              <input className="form-input" />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input className="form-input" />
            </div>
            <div className="form-field">
              <label>Message</label>
              <textarea className="form-input form-textarea" />
            </div>
            <button className="form-submit">Send Message</button>
          </div>
        </section>
      ),
    },
    {
      id: "booking",
      label: "Booking Form",
      render: (p) => (
        <section className="formsec">
          <div className="formsec__heading">
            <h2>{p.heading}</h2>
            <p>{p.subheading}</p>
          </div>
          <div className="form-card">
            <div className="form-field">
              <label>Date</label>
              <input className="form-input" />
            </div>
            <div className="form-field">
              <label>Full Name</label>
              <input className="form-input" />
            </div>
            <button className="form-submit">Book Now</button>
          </div>
        </section>
      ),
    },
    {
      id: "subscription",
      label: "Newsletter",
      render: (p) => (
        <section className="formsec formsec--inline">
          <div className="formsec__heading">
            <h2>{p.heading}</h2>
            <p>{p.subheading}</p>
          </div>
          <div className="form-card">
            <input className="form-input" placeholder="you@example.com" />
            <button className="form-submit">Subscribe</button>
          </div>
        </section>
      ),
    },
  ],
  defaultProps: { heading: "Get in touch.", subheading: "We'd love to hear from you." },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    { key: "subheading", label: "Subheading", type: "textarea", path: "subheading" },
  ],
};

const testimonials: ComponentDef = {
  type: "testimonials",
  label: "Testimonials",
  category: "Testimonials",
  icon: "❝",
  variants: [
    {
      id: "default",
      label: "Default",
      render: (p) => (
        <section className="features">
          <div className="features__heading">
            <h2>{p.heading}</h2>
          </div>
          <div className="features__grid">
            {(p.items || []).map((i: any, idx: number) => (
              <div className="testimonial" key={idx}>
                <p>&ldquo;{i.quote}&rdquo;</p>
                <div className="testimonial__author">
                  <strong>{i.name}</strong>
                  <span>{i.role}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Loved by teams everywhere.",
    items: [
      { quote: "This tool cut our build time in half.", name: "Jane Doe", role: "CTO, Acme Inc" },
      { quote: "Finally a builder that gets out of the way.", name: "Sam Lee", role: "Founder, Globex" },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    {
      key: "items",
      label: "Testimonials",
      type: "array",
      path: "items",
      itemLabel: "Testimonial",
      itemFields: [
        { key: "quote", label: "Quote", type: "textarea", path: "quote" },
        { key: "name", label: "Name", type: "text", path: "name" },
        { key: "role", label: "Role", type: "text", path: "role" },
      ],
    },
  ],
};

const cta: ComponentDef = {
  type: "cta",
  label: "CTA",
  category: "CTAs",
  icon: "➤",
  variants: [
    {
      id: "default",
      label: "Default",
      render: (p) => (
        <section className="cta">
          <h2>{p.heading}</h2>
          <p>{p.subheading}</p>
          <button className="btn" style={{ background: "#fff", color: "#3b2d5a" }}>
            {p.button}
          </button>
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Ready to get started?",
    subheading: "Join thousands of teams already building with us.",
    button: "Get Started Free",
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    { key: "subheading", label: "Subheading", type: "textarea", path: "subheading" },
    { key: "button", label: "Button Text", type: "text", path: "button" },
  ],
};

const faq: ComponentDef = {
  type: "faq",
  label: "FAQ",
  category: "FAQ",
  icon: "?",
  variants: [
    {
      id: "default",
      label: "Default",
      render: (p) => (
        <section className="features">
          <div className="features__heading">
            <h2>{p.heading}</h2>
          </div>
          {(p.items || []).map((i: any, idx: number) => (
            <div className="accordion-item" key={idx}>
              <div className="accordion-head">{i.q}</div>
              <div className="accordion-body">{i.a}</div>
            </div>
          ))}
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Frequently asked questions",
    items: [
      { q: "What is your refund policy?", a: "We offer a 30-day money-back guarantee." },
      { q: "Do you offer discounts?", a: "Yes, for annual plans and non-profits." },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    {
      key: "items",
      label: "Questions",
      type: "array",
      path: "items",
      itemLabel: "Question",
      itemFields: [
        { key: "q", label: "Question", type: "text", path: "q" },
        { key: "a", label: "Answer", type: "textarea", path: "a" },
      ],
    },
  ],
};

const stats: ComponentDef = {
  type: "stats",
  label: "Stats",
  category: "Statistics",
  icon: "▲",
  variants: [
    {
      id: "default",
      label: "Default",
      render: (p) => (
        <section className="stats">
          {(p.items || []).map((i: any, idx: number) => (
            <div className="stat" key={idx}>
              <strong>{i.value}</strong>
              <span>{i.label}</span>
            </div>
          ))}
        </section>
      ),
    },
    {
      id: "cards",
      label: "Metric Cards",
      render: (p) => (
        <section className="stats stats--cards">
          {(p.items || []).map((i: any, idx: number) => (
            <div className="stat" key={idx} style={{ animationDelay: `${idx * 80}ms` }}>
              <span className="stat__eyebrow">{i.label}</span>
              <strong>{i.value}</strong>
              <span className="stat__trend">{i.trend || "Growing steadily"}</span>
            </div>
          ))}
        </section>
      ),
    },
    {
      id: "bars",
      label: "Progress Bars",
      render: (p) => (
        <section className="stats stats--bars">
          {(p.items || []).map((i: any, idx: number) => (
            <div className="stat" key={idx} style={{ animationDelay: `${idx * 90}ms` }}>
              <div className="stat__bar-head"><span>{i.label}</span><strong>{i.value}</strong></div>
              <div className="stat__track"><span style={{ width: `${i.percent || 75}%` }} /></div>
            </div>
          ))}
        </section>
      ),
    },
  ],
  defaultProps: {
    items: [
      { value: "10K+", label: "Active users" },
      { value: "99.9%", label: "Uptime" },
      { value: "4.9/5", label: "User rating" },
      { value: "120+", label: "Countries" },
    ],
  },
  editableFields: [
    {
      key: "items",
      label: "Stats",
      type: "array",
      path: "items",
      itemLabel: "Stat",
      itemFields: [
        { key: "value", label: "Value", type: "text", path: "value" },
        { key: "label", label: "Label", type: "text", path: "label" },
        { key: "trend", label: "Trend", type: "text", path: "trend" },
        { key: "percent", label: "Percent", type: "text", path: "percent" },
      ],
    },
  ],
};

const team: ComponentDef = {
  type: "team",
  label: "Team",
  category: "Content Sections",
  icon: "◍",
  variants: [
    {
      id: "default",
      label: "Default",
      render: (p) => (
        <section className="features">
          <div className="features__heading">
            <h2>{p.heading}</h2>
          </div>
          <div className="features__grid">
            {(p.items || []).map((i: any, idx: number) => (
              <div className="team-card" key={idx}>
                <h3>{i.name}</h3>
                <p>{i.role}</p>
              </div>
            ))}
          </div>
        </section>
      ),
    },
  ],
  defaultProps: {
    heading: "Meet the team.",
    items: [
      { name: "Alex Kim", role: "Founder & CEO" },
      { name: "Riya Nair", role: "Head of Design" },
    ],
  },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    {
      key: "items",
      label: "Team Members",
      type: "array",
      path: "items",
      itemLabel: "Member",
      itemFields: [
        { key: "name", label: "Name", type: "text", path: "name" },
        { key: "role", label: "Role", type: "text", path: "role" },
      ],
    },
  ],
};

const icons: ComponentDef = {
  type: "icons",
  label: "Logo Cloud",
  category: "Logos",
  icon: "◎",
  variants: [
    {
      id: "default",
      label: "Default",
      render: (p) => (
        <section className="logocloud">
          <p>{p.heading}</p>
          <div className="logo-row">
            {(p.logos || []).map((l: string, idx: number) => (
              <span key={idx}>{l}</span>
            ))}
          </div>
        </section>
      ),
    },
  ],
  defaultProps: { heading: "Trusted by teams at", logos: ["ACME", "Globex", "Umbrella", "Initech"] },
  editableFields: [
    { key: "heading", label: "Heading", type: "text", path: "heading" },
    {
      key: "logos",
      label: "Logos",
      type: "array",
      path: "logos",
      itemLabel: "Logo",
      itemFields: [{ key: "value", label: "Name", type: "text", path: "" }],
    },
  ],
};

const notifications: ComponentDef = {
  type: "notifications",
  label: "Banner",
  category: "Social Sections",
  icon: "◭",
  variants: [
    {
      id: "default",
      label: "Announcement Banner",
      render: (p) => (
        <div className="notif-banner">
          <span>{p.text}</span>
          <button className="notif-banner__close">&times;</button>
        </div>
      ),
    },
  ],
  defaultProps: { text: "We just launched v2.0 — check out what's new!", cta: "See what's new", handle: "@yourbrand" },
  editableFields: [
    { key: "text", label: "Banner Text", type: "text", path: "text" },
    { key: "cta", label: "Button Text", type: "text", path: "cta" },
    { key: "handle", label: "Social handle (Follow banner)", type: "text", path: "handle" },
  ],
};

/** Adds an optional search and cart button to any navbar variant (set by the assistant or the Inspector). */
const withNavExtras = (render: (p: Record<string, any>) => ReactNode) => (p: Record<string, any>): ReactNode =>
  p.showCart || p.showSearch || p.showProfile || p.showWishlist || p.hideCta || p.extraButton ? (
    <div className={`nav-extras${p.hideCta ? " nav-extras--nocta" : ""}`}>
      {render(p)}
      <div className="nav-extras__tools">
        {p.extraButton && <button type="button" className="nav-extras__pill">{p.extraButton}</button>}
        {((p.navOrder as string[] | undefined) || ["search", "wishlist", "profile", "cart"]).map((k) => {
          if (k === "search" && p.showSearch) return <button key={k} type="button" aria-label="Search" className="nav-extras__btn"><Search size={18} /></button>;
          if (k === "wishlist" && p.showWishlist) return <button key={k} type="button" aria-label="Wishlist" className="nav-extras__btn"><Heart size={18} /></button>;
          if (k === "profile" && p.showProfile) return <button key={k} type="button" aria-label="Profile" className="nav-extras__btn"><UserRound size={18} /></button>;
          if (k === "cart" && p.showCart) return <button key={k} type="button" aria-label="Cart" className="nav-extras__btn" onClick={() => window.dispatchEvent(new Event("vibe:open-cart"))}><ShoppingCart size={18} /><i>0</i></button>;
          return null;
        })}
      </div>
    </div>
  ) : (
    render(p)
  );

/** Wraps any hero variant with a looping background video when `bgVideo` is set. */
const withHeroVideo = (render: (p: Record<string, any>) => ReactNode) => (p: Record<string, any>): ReactNode =>
  p.bgVideo ? (
    <div className="hero-video">
      <video className="hero-video__media" src={p.bgVideo} poster={p.visualImage || undefined} autoPlay muted loop playsInline preload="metadata" />
      <div className="hero-video__scrim" style={{ opacity: p.videoDim ?? 0.45 }} />
      <div className="hero-video__content">{render(p)}</div>
    </div>
  ) : (
    render(p)
  );

export const REGISTRY: Record<string, ComponentDef> = Object.fromEntries(
  [navbar, hero, features, cards, catalog, timeline, socials, chatbot, shop, tracking, auth, pricing, footer, forms, testimonials, cta, faq, stats, team, icons, notifications].map(
    (c) => [c.type, { ...c, variants: (c.type === "hero" ? (vs: ComponentDef["variants"]) => vs.map((v) => ({ ...v, render: withHeroVideo(v.render) })) : c.type === "navbar" ? (vs: ComponentDef["variants"]) => vs.map((v) => ({ ...v, render: withNavExtras(v.render) })) : (vs: ComponentDef["variants"]) => vs)([...c.variants, ...(EXTRA_VARIANTS[c.type] || []), ...(EXTRA_VARIANTS_2[c.type] || []), ...(EXTRA_VARIANTS_3[c.type] || [])]) }]
  )
);

export const REGISTRY_LIST = Object.values(REGISTRY);

export function getVariant(type: string, variant: string) {
  const def = REGISTRY[type];
  if (!def) return undefined;
  return def.variants.find((v) => v.id === variant) || def.variants[0];
}
