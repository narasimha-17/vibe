"use client";

/*
 * AuthWidget: sign in, register, forgot password, reset password, one-time-code sign-in and a profile panel.
 * Portable (React only). Pass `apiUrl` to use the generated backend (/api/auth/*); without it every form
 * validates and shows a preview-mode success message.
 */
import { useEffect, useState } from "react";

type Kind = "login" | "register" | "forgot" | "reset" | "otp" | "profile";
type Layout = "card" | "split" | "minimal";

const TOKEN_KEY = "vibe.token";
const readToken = () => {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};
const saveToken = (t: string) => {
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

async function call<T>(base: string, path: string, init?: { method?: string; body?: unknown; token?: string }): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: init?.method || "POST",
    headers: { "Content-Type": "application/json", ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => ({}))) as { detail?: unknown; error?: string; errors?: Record<string, string> };
  if (!res.ok) {
    const d = data.detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? String((d[0] as { msg?: string })?.msg || "Please check the form.") : data.error || `Request failed (${res.status})`;
    throw new Error(msg.replace(/^Value error, /, ""));
  }
  return data as T;
}

const COPY: Record<Kind, { title: string; sub: string; button: string }> = {
  login: { title: "Welcome back", sub: "Sign in to your account.", button: "Sign in" },
  register: { title: "Create your account", sub: "It takes less than a minute.", button: "Create account" },
  forgot: { title: "Forgot your password?", sub: "Enter your email and we'll send a reset code.", button: "Send reset code" },
  reset: { title: "Choose a new password", sub: "Enter the code we sent you and a new password.", button: "Reset password" },
  otp: { title: "Sign in with a code", sub: "No password needed. We'll send a 6-digit code.", button: "Send code" },
  profile: { title: "Your account", sub: "Manage your details.", button: "Save changes" },
};

export default function AuthWidget({ kind, layout = "card", brand = "Your Brand", heading, subheading, apiUrl, redirect = "/" }: { kind: Kind; layout?: Layout; brand?: string; heading?: string; subheading?: string; apiUrl?: string; redirect?: string }) {
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [me, setMe] = useState<{ email: string; name?: string } | null>(null);
  const [show, setShow] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const copy = COPY[kind];

  useEffect(() => {
    if (kind !== "profile") return;
    const token = readToken();
    if (apiUrl && token) {
      call<{ email: string; name?: string }>(apiUrl, "/api/auth/me", { method: "GET", token })
        .then((u) => {
          setMe(u);
          setV((x) => ({ ...x, name: u.name || "" }));
        })
        .catch(() => saveToken(""));
    } else if (!apiUrl) {
      setMe({ email: "you@example.com", name: "Alex Kim" });
      setV((x) => ({ ...x, name: "Alex Kim" }));
    }
  }, [kind, apiUrl]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void run(async () => {
      if (!apiUrl) {
        await new Promise((r) => setTimeout(r, 450));
        if (kind === "otp" && step === "form") {
          setStep("code");
          return setNote("Preview mode: any 6 digits will work.");
        }
        setStep("done");
        return setNote("Preview mode: nothing was sent. Connect the backend to make this live.");
      }
      const token = readToken();
      if (kind === "login" || kind === "register") {
        if (kind === "register" && v.password !== v.confirm) throw new Error("Passwords don't match.");
        const res = await call<{ access_token: string }>(apiUrl, `/api/auth/${kind}`, { body: kind === "login" ? { email: v.email, password: v.password } : { email: v.email, password: v.password, name: v.name || "" } });
        saveToken(res.access_token);
        setStep("done");
      } else if (kind === "forgot") {
        const res = await call<{ dev_code?: string }>(apiUrl, "/api/auth/forgot", { body: { email: v.email } });
        setStep("done");
        setNote(res.dev_code ? `If that email exists, a code was sent. Development code: ${res.dev_code}` : "If that email exists, we've sent a reset code.");
      } else if (kind === "reset") {
        await call(apiUrl, "/api/auth/reset", { body: { email: v.email, code: v.code, password: v.password } });
        setStep("done");
      } else if (kind === "otp") {
        if (step === "form") {
          const res = await call<{ dev_code?: string }>(apiUrl, "/api/auth/otp/send", { body: { email: v.email } });
          setStep("code");
          setNote(res.dev_code ? `Development code: ${res.dev_code}` : "We've sent a 6-digit code to your email.");
        } else {
          const res = await call<{ access_token: string }>(apiUrl, "/api/auth/otp/verify", { body: { email: v.email, code: v.code } });
          saveToken(res.access_token);
          setStep("done");
        }
      } else if (kind === "profile") {
        const u = await call<{ email: string; name?: string }>(apiUrl, "/api/auth/me", { method: "PATCH", token, body: { name: v.name || "" } });
        setMe(u);
        if (v.new_password) {
          await call(apiUrl, "/api/auth/change-password", { token, body: { current_password: v.current_password, new_password: v.new_password } });
          setV((x) => ({ ...x, current_password: "", new_password: "" }));
        }
        setNote("Saved.");
      }
    });
  }

  const pw = show ? "text" : "password";
  const field = (name: string, label: string, type = "text", extra: Record<string, string | number | boolean> = {}) => (
    <label className="auth-field" key={name}>
      <span>{label}</span>
      <input className="shop-input" name={name} type={type} required value={v[name] || ""} onChange={set(name)} {...extra} />
    </label>
  );

  let body: React.ReactNode;
  if (kind === "profile" && !me) {
    body = <p className="shop-muted">You are not signed in. <a href={redirect}>Sign in</a> to see your account.</p>;
  } else if (step === "done" && kind !== "profile") {
    body = (
      <div className="auth-done">
        <span className="shop-tick">✓</span>
        <h4>{kind === "reset" ? "Password updated" : kind === "forgot" ? "Check your email" : kind === "register" ? "Account created" : "You're signed in"}</h4>
        {note && <p>{note}</p>}
        {kind !== "forgot" && <a className="shop-add shop-add--lg" href={kind === "reset" ? "#" : redirect}>{kind === "reset" ? "Back to sign in" : "Continue"}</a>}
      </div>
    );
  } else {
    body = (
      <form className="auth-form" onSubmit={submit}>
        {kind === "login" && (
          <>
            {field("email", "Email", "email", { autoComplete: "email" })}
            {field("password", "Password", pw, { autoComplete: "current-password" })}
          </>
        )}
        {kind === "register" && (
          <>
            {field("name", "Full name", "text", { autoComplete: "name" })}
            {field("email", "Email", "email", { autoComplete: "email" })}
            {field("password", "Password (8+ characters)", pw, { minLength: 8, autoComplete: "new-password" })}
            {field("confirm", "Confirm password", pw, { minLength: 8, autoComplete: "new-password" })}
          </>
        )}
        {kind === "forgot" && field("email", "Email", "email", { autoComplete: "email" })}
        {kind === "reset" && (
          <>
            {field("email", "Email", "email")}
            {field("code", "6-digit code", "text", { inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6 })}
            {field("password", "New password (8+ characters)", pw, { minLength: 8, autoComplete: "new-password" })}
          </>
        )}
        {kind === "otp" && (step === "form" ? field("email", "Email", "email", { autoComplete: "email" }) : field("code", "Enter the 6-digit code", "text", { inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6, autoComplete: "one-time-code" }))}
        {kind === "profile" && me && (
          <>
            <label className="auth-field"><span>Email</span><input className="shop-input" value={me.email} disabled readOnly /></label>
            <label className="auth-field"><span>Full name</span><input className="shop-input" value={v.name || ""} onChange={set("name")} /></label>
            <details className="auth-details">
              <summary>Change password</summary>
              <label className="auth-field"><span>Current password</span><input className="shop-input" type="password" value={v.current_password || ""} onChange={set("current_password")} autoComplete="current-password" /></label>
              <label className="auth-field"><span>New password</span><input className="shop-input" type="password" minLength={8} value={v.new_password || ""} onChange={set("new_password")} autoComplete="new-password" /></label>
            </details>
          </>
        )}
        {(kind === "login" || kind === "register" || kind === "reset") && (
          <label className="auth-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password</label>
        )}
        {error && <p className="shop-error" role="alert">{error}</p>}
        {note && step !== "done" && <p className="shop-instock" role="status">{note}</p>}
        <button type="submit" className="shop-add shop-add--lg shop-add--block" disabled={busy}>{busy ? "Please wait…" : kind === "otp" && step === "code" ? "Verify and sign in" : copy.button}</button>
        {kind === "login" && <div className="auth-links"><a href="#forgot">Forgot password?</a><a href="#register">Create an account</a></div>}
        {kind === "register" && <div className="auth-links"><span>Already have an account?</span><a href="#login">Sign in</a></div>}
        {kind === "profile" && (
          <button type="button" className="shop-link" onClick={() => { saveToken(""); setMe(null); }}>Sign out</button>
        )}
      </form>
    );
  }

  const title = heading || copy.title;
  const sub = subheading || copy.sub;
  const panel = (
    <div className="auth-card">
      <div className="auth-brand">{brand}</div>
      <h2>{title}</h2>
      <p className="auth-sub">{sub}</p>
      {body}
    </div>
  );

  if (layout === "split") {
    return (
      <section className="auth auth--split">
        <div className="auth-art">
          <div className="auth-art-brand">{brand}</div>
          <h3>{kind === "register" ? "Join thousands of happy customers." : "Good to see you again."}</h3>
          <p>Secure sign in, fast checkout and everything you need in one place.</p>
          <ul><li>✓ Encrypted passwords</li><li>✓ Order history</li><li>✓ Saved details</li></ul>
        </div>
        <div className="auth-side">{panel}</div>
      </section>
    );
  }
  return <section className={`auth auth--${layout}`}>{panel}</section>;
}
