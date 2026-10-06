import type { ReactNode } from "react";
import type { ComponentDef } from "./types";

/**
 * Login, sign-up, password, one-time-code and profile-settings sections. The builder shows them as static previews
 * in the site's theme (styles in app/site-auth.css); the exported site and the build agents turn them into working
 * account pages. Variant ids are "<kind>-<layout>", the same keys the code generator's AuthWidget understands.
 */

type P = Record<string, any>;
type Kind = "login" | "register" | "forgot" | "otp";

const COPY: Record<string, { heading: string; sub: string; button: string }> = {
  login: { heading: "Welcome back", sub: "Sign in to continue.", button: "Sign in" },
  register: { heading: "Create your account", sub: "It only takes a minute.", button: "Create account" },
  forgot: { heading: "Forgot your password?", sub: "Enter your email and we'll send you a reset link.", button: "Send reset link" },
  otp: { heading: "Sign in with a code", sub: "We'll send a 6-digit code to your email.", button: "Verify and sign in" },
  profile: { heading: "Account settings", sub: "Manage your details, password and orders.", button: "Save changes" },
};

const text = (p: P, kind: string, key: "heading" | "sub" | "button") =>
  (key === "heading" ? p.heading : key === "sub" ? p.subheading : p.buttonLabel) || COPY[kind][key];

const Field = ({ label, type = "text", placeholder, hint, extra }: { label: string; type?: string; placeholder?: string; hint?: ReactNode; extra?: ReactNode }) => (
  <label className="au-field">
    <span className="au-label">
      {label}
      {hint}
    </span>
    <span className="au-control">
      <input className="au-input" type={type} placeholder={placeholder} readOnly />
      {extra}
    </span>
  </label>
);

const Eye = () => (
  <span className="au-eye" aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
  </span>
);

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.77 0 2.96.75 3.64 1.4l2.48-2.4C16.7 3.4 14.6 2.5 12 2.5A9.5 9.5 0 1 0 21.5 12c0-.66-.07-1.24-.18-1.8H12Z" />
  </svg>
);

const KeyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);

const MailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3 7 9 6 9-6" /></svg>
);

function LoginForm({ p }: { p: P }) {
  return (
    <form className="au-form" onSubmit={(e) => e.preventDefault()}>
      <Field label="Email" type="email" placeholder="you@example.com" />
      <Field label="Password" type="password" placeholder="••••••••" hint={<a className="au-link au-link--small" href="#forgot">Forgot password?</a>} extra={<Eye />} />
      <label className="au-check"><input type="checkbox" readOnly /> <span>Keep me signed in</span></label>
      <button type="submit" className="au-btn">{text(p, "login", "button")}</button>
      <p className="au-alt">New here? <a className="au-link" href="#register">Create an account</a></p>
    </form>
  );
}

function LoginFormSocial({ p }: { p: P }) {
  return (
    <form className="au-form" onSubmit={(e) => e.preventDefault()}>
      <button type="button" className="au-social"><GoogleG /> Continue with Google</button>
      <div className="au-divider"><span>or sign in with email</span></div>
      <Field label="Email" type="email" placeholder="you@example.com" />
      <Field label="Password" type="password" placeholder="••••••••" hint={<a className="au-link au-link--small" href="#forgot">Forgot password?</a>} extra={<Eye />} />
      <button type="submit" className="au-btn">{text(p, "login", "button")}</button>
      <p className="au-alt">New here? <a className="au-link" href="#register">Create an account</a></p>
    </form>
  );
}

function RegisterForm({ p }: { p: P }) {
  return (
    <form className="au-form" onSubmit={(e) => e.preventDefault()}>
      <Field label="Full name" placeholder="Your name" />
      <Field label="Email" type="email" placeholder="you@example.com" />
      <Field label="Password" type="password" placeholder="At least 8 characters" extra={<Eye />} />
      <div className="au-strength" aria-hidden="true"><i className="is-on" /><i className="is-on" /><i /><i /><span>Medium strength</span></div>
      <label className="au-check"><input type="checkbox" readOnly /> <span>I agree to the <a className="au-link" href="#terms">terms</a> and <a className="au-link" href="#privacy">privacy policy</a></span></label>
      <button type="submit" className="au-btn">{text(p, "register", "button")}</button>
      <p className="au-alt">Already have an account? <a className="au-link" href="#login">Sign in</a></p>
    </form>
  );
}

function ForgotForm({ p }: { p: P }) {
  return (
    <form className="au-form" onSubmit={(e) => e.preventDefault()}>
      <Field label="Email" type="email" placeholder="you@example.com" />
      <button type="submit" className="au-btn">{text(p, "forgot", "button")}</button>
      <p className="au-alt"><a className="au-link" href="#login">← Back to sign in</a></p>
    </form>
  );
}

function OtpForm({ p }: { p: P }) {
  return (
    <form className="au-form" onSubmit={(e) => e.preventDefault()}>
      <div className="au-label au-label--center">Enter the 6-digit code</div>
      <div className="au-code" aria-hidden="true">{[1, 2, 3, 4, 5, 6].map((n) => <span key={n} className={n <= 2 ? "is-filled" : n === 3 ? "is-active" : ""}>{n === 1 ? "4" : n === 2 ? "8" : ""}</span>)}</div>
      <button type="submit" className="au-btn">{text(p, "otp", "button")}</button>
      <p className="au-alt">Didn&apos;t get it? <a className="au-link" href="#resend">Send a new code</a></p>
    </form>
  );
}

const FORMS: Record<Kind, (a: { p: P }) => ReactNode> = { login: LoginForm, register: RegisterForm, forgot: ForgotForm, otp: OtpForm };
const ICONS: Partial<Record<Kind, () => ReactNode>> = { forgot: KeyIcon, otp: MailIcon };

function Head({ p, kind, center = false }: { p: P; kind: string; center?: boolean }) {
  return (
    <header className={`au-head ${center ? "au-head--center" : ""}`}>
      {p.brand && <span className="au-brand">{p.brand}</span>}
      <h1 className="au-title">{text(p, kind, "heading")}</h1>
      <p className="au-sub">{text(p, kind, "sub")}</p>
    </header>
  );
}

function Side({ p }: { p: P }) {
  const points: string[] = Array.isArray(p.points) && p.points.length ? p.points : ["Track your orders and bookings", "Save your details for faster checkout", "Get offers made for you"];
  return (
    <aside className="au-side">
      <span className="au-side__brand">{p.brand || "Your brand"}</span>
      <div className="au-side__body">
        <h2 className="au-side__title">{p.sideTitle || "Everything you love, in one place."}</h2>
        {p.sideText && <p className="au-side__text">{p.sideText}</p>}
        <ul className="au-side__list">
          {points.map((pt) => <li key={pt}><span className="au-tick"><Check /></span>{pt}</li>)}
        </ul>
      </div>
      <span className="au-side__glow" aria-hidden="true" />
    </aside>
  );
}

/** Two columns: a brand/benefits panel and the form. */
const split = (kind: Kind) => (p: P) => (
  <section className="au au--split">
    <div className="au-split">
      <Side p={p} />
      <div className="au-panel">
        <Head p={p} kind={kind} />
        {FORMS[kind]({ p })}
      </div>
    </div>
  </section>
);

/** A single card, centred on a soft background, with an icon or brand initial above the heading. */
const card = (kind: Kind) => (p: P) => (
  <section className="au au--card">
    <div className="au-card">
      {ICONS[kind] ? (
        <span className="au-mark au-mark--icon" aria-hidden="true">{ICONS[kind]!()}</span>
      ) : (
        <span className="au-mark" aria-hidden="true">{String(p.brand || "B").trim().charAt(0).toUpperCase()}</span>
      )}
      <Head p={p} kind={kind} center />
      {FORMS[kind]({ p })}
    </div>
  </section>
);

/** No card, no side panel: a narrow column straight on the page background. */
const minimal = (kind: Kind) => (p: P) => (
  <section className="au au--minimal">
    <div className="au-narrow">
      <Head p={p} kind={kind} />
      {FORMS[kind]({ p })}
    </div>
  </section>
);

/** A full-bleed cover (photo or gradient) behind a translucent glass card, centred. */
const cover = (kind: Kind) => (p: P) => (
  <section className="au au--cover">
    {p.coverImage ? <img className="au-cover__img" src={p.coverImage} alt="" /> : <span className="au-cover__img au-cover__img--fallback" aria-hidden="true" />}
    <span className="au-cover__shade" aria-hidden="true" />
    <div className="au-glass">
      <Head p={p} kind={kind} center />
      {FORMS[kind]({ p })}
    </div>
  </section>
);

const NAV = ["Profile", "Security", "My orders", "Addresses", "Notifications"];

function ProfileFields({ p, name }: { p: P; name: string }) {
  return (
    <>
      <form className="au-pane" onSubmit={(e) => e.preventDefault()}>
        <div className="au-pane__title">
          <span className="au-avatar" aria-hidden="true">{name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase()}</span>
          <div>
            <h2>Profile</h2>
            <p className="au-sub">Your name and contact details, used for orders and bookings.</p>
          </div>
        </div>
        <div className="au-grid-2">
          <Field label="Full name" placeholder={name} />
          <Field label="Phone" type="tel" placeholder="+91 98765 43210" />
        </div>
        <Field label="Email" type="email" placeholder="asha@example.com" />
        <div className="au-actions"><button type="submit" className="au-btn au-btn--auto">{text(p, "profile", "button")}</button></div>
      </form>
      <form className="au-pane" onSubmit={(e) => e.preventDefault()}>
        <div className="au-pane__title">
          <div>
            <h2>Password</h2>
            <p className="au-sub">Use at least 8 characters, with a number or symbol.</p>
          </div>
        </div>
        <Field label="Current password" type="password" placeholder="••••••••" extra={<Eye />} />
        <div className="au-grid-2">
          <Field label="New password" type="password" placeholder="••••••••" extra={<Eye />} />
          <Field label="Confirm new password" type="password" placeholder="••••••••" extra={<Eye />} />
        </div>
        <div className="au-actions"><button type="submit" className="au-btn au-btn--secondary au-btn--auto">Update password</button></div>
      </form>
    </>
  );
}

/** Tabbed sidebar layout: a side list of sections next to the active pane. */
const profileTabs = (p: P) => {
  const name = String(p.sampleName || "Asha Kumar");
  return (
    <section className="au au--profile">
      <div className="au-account">
        <header className="au-account__head">
          <div>
            <h1 className="au-title">{text(p, "profile", "heading")}</h1>
            <p className="au-sub">{text(p, "profile", "sub")}</p>
          </div>
          <a className="au-btn au-btn--ghost" href="#logout">Sign out</a>
        </header>
        <div className="au-account__grid">
          <nav className="au-tabs" aria-label="Account sections">
            {NAV.map((item, i) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, "-")}`} className={`au-tab ${i === 0 ? "is-active" : ""}`} aria-current={i === 0 ? "page" : undefined}>{item}</a>
            ))}
          </nav>
          <div className="au-account__main"><ProfileFields p={p} name={name} /></div>
        </div>
      </div>
    </section>
  );
};

/** One simple column, no side navigation: everything stacked, for smaller sites with little to manage. */
const profileSimple = (p: P) => {
  const name = String(p.sampleName || "Asha Kumar");
  return (
    <section className="au au--profile au--profile-simple">
      <div className="au-account au-account--narrow">
        <header className="au-account__head">
          <div>
            <h1 className="au-title">{text(p, "profile", "heading")}</h1>
            <p className="au-sub">{text(p, "profile", "sub")}</p>
          </div>
          <a className="au-btn au-btn--ghost" href="#logout">Sign out</a>
        </header>
        <div className="au-account__main"><ProfileFields p={p} name={name} /></div>
      </div>
    </section>
  );
};

/** A cover banner across the top with the avatar overlapping it, sections stacked below. */
const profileBanner = (p: P) => {
  const name = String(p.sampleName || "Asha Kumar");
  const initials = name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase();
  return (
    <section className="au au--profile au--profile-banner">
      <div className="au-banner" aria-hidden="true" />
      <div className="au-account">
        <header className="au-account__head au-account__head--banner">
          <span className="au-avatar au-avatar--lg">{initials}</span>
          <div>
            <h1 className="au-title">{name}</h1>
            <p className="au-sub">{text(p, "profile", "sub")}</p>
          </div>
          <a className="au-btn au-btn--ghost" href="#logout">Sign out</a>
        </header>
        <div className="au-account__main au-account__main--wide"><ProfileFields p={p} name={name} /></div>
      </div>
    </section>
  );
};

export const auth: ComponentDef = {
  type: "auth",
  label: "Login / Account",
  category: "Accounts",
  icon: "◉",
  variants: [
    { id: "login-split", label: "Sign in · Split", render: split("login") },
    { id: "login-card", label: "Sign in · Card", render: card("login") },
    { id: "login-minimal", label: "Sign in · Minimal", render: minimal("login") },
    { id: "login-cover", label: "Sign in · Cover photo", render: cover("login") },
    { id: "login-social", label: "Sign in · Social first", render: (p: P) => (
      <section className="au au--card">
        <div className="au-card">
          <span className="au-mark" aria-hidden="true">{String(p.brand || "B").trim().charAt(0).toUpperCase()}</span>
          <Head p={p} kind="login" center />
          <LoginFormSocial p={p} />
        </div>
      </section>
    ) },
    { id: "register-split", label: "Sign up · Split", render: split("register") },
    { id: "register-card", label: "Sign up · Card", render: card("register") },
    { id: "register-minimal", label: "Sign up · Minimal", render: minimal("register") },
    { id: "register-cover", label: "Sign up · Cover photo", render: cover("register") },
    { id: "forgot-card", label: "Forgot password · Card", render: card("forgot") },
    { id: "forgot-split", label: "Forgot password · Split", render: split("forgot") },
    { id: "forgot-minimal", label: "Forgot password · Minimal", render: minimal("forgot") },
    { id: "otp-card", label: "One-time code · Card", render: card("otp") },
    { id: "otp-split", label: "One-time code · Split", render: split("otp") },
    { id: "otp-minimal", label: "One-time code · Minimal", render: minimal("otp") },
    { id: "profile", label: "Profile · Sidebar tabs", render: profileTabs },
    { id: "profile-simple", label: "Profile · Single column", render: profileSimple },
    { id: "profile-banner", label: "Profile · Cover banner", render: profileBanner },
  ],
  defaultProps: { brand: "Your Brand", heading: "", subheading: "", buttonLabel: "", sideTitle: "", sideText: "", coverImage: "" },
  editableFields: [
    { key: "brand", label: "Brand", type: "text", path: "brand" },
    { key: "heading", label: "Heading (empty = default)", type: "text", path: "heading" },
    { key: "subheading", label: "Subheading (empty = default)", type: "text", path: "subheading" },
    { key: "buttonLabel", label: "Button label (empty = default)", type: "text", path: "buttonLabel" },
    { key: "sideTitle", label: "Side panel title (Split styles)", type: "text", path: "sideTitle" },
    { key: "sideText", label: "Side panel text (Split styles)", type: "textarea", path: "sideText" },
    { key: "coverImage", label: "Cover photo (Cover styles)", type: "image", path: "coverImage" },
  ],
};
