"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { User } from "@/lib/types";
import { Mail } from "lucide-react";
import { Avatar, Card, Field, Pill, Toggle, useLocalPref } from "./SettingsUI";
import { BrandGlyph, BrandTile, type BrandKey } from "./BrandIcon";
import { PasswordOtpCard } from "./PasswordOtpCard";

function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError && typeof e.detail === "object" && e.detail && "detail" in (e.detail as object)
    ? String((e.detail as { detail: unknown }).detail)
    : fallback;
}

interface SectionProps {
  user: User;
  onUserChange: (u: User) => void;
}

/* ───────────────────────── Profile ───────────────────────── */
export function ProfileSection({ user, onUserChange }: SectionProps) {
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== user.name || avatar.trim() !== (user.avatar_url || "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.patch<User>("auth/me", { name: name.trim(), avatar_url: avatar.trim() });
      onUserChange(updated);
      toast("Profile updated.");
    } catch (err) {
      toast(errMsg(err, "Couldn't update your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Profile" description="How you appear across VIBE and in exported projects.">
      <form onSubmit={save} className="grid gap-5">
        <div className="flex items-center gap-4">
          <Avatar name={name || user.email} url={avatar.trim() || null} size={64} />
          <div className="text-sm text-muted">
            <div className="font-semibold text-main">{name || user.email}</div>
            Paste an image URL below to use a custom avatar.
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Display name">
            <input className="input-field" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" hint="Your sign-in email can't be changed yet.">
            <input className="input-field opacity-70" value={user.email} readOnly />
          </Field>
        </div>
        <Field label="Avatar URL">
          <input className="input-field" placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted">
            Member since {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}
          </span>
          <button className="btn btn-primary" disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Card>
  );
}

/* ───────────────────── Account & security ───────────────────── */
export function SecuritySection({ user, onUserChange }: SectionProps) {
  const router = useRouter();
  const [providers, setProviders] = useState<{ google?: boolean; github?: boolean }>({});

  useEffect(() => {
    api.get<{ google: boolean; github: boolean }>("auth/providers").then(setProviders).catch(() => {});
  }, []);

  async function unlink(provider: "google" | "github") {
    try {
      onUserChange(await api.post<User>(`auth/unlink/${provider}`));
      toast(`${provider === "google" ? "Google" : "GitHub"} unlinked.`);
    } catch (err) {
      toast(errMsg(err, "Couldn't unlink that account."));
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const methods = [
    { id: "password", label: "Email & password", note: user.email, linked: !!user.has_password },
    { id: "google", label: "Google", note: providers.google === false ? "Not configured on this server" : "Sign in with your Google account", linked: !!user.google_linked },
    { id: "github", label: "GitHub", note: providers.github === false ? "Not configured on this server" : "Sign in with your GitHub account", linked: !!user.github_linked },
  ] as const;
  const glyph = { google: "google", github: "github" } as const;

  return (
    <>
      <Card title="Sign-in methods" description="Ways you can log in to this account.">
        <ul className="divide-y divide-border">
          {methods.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-light bg-white">
                  {m.id === "password" ? <Mail className="h-[18px] w-[18px] text-primary" strokeWidth={1.9} /> : <BrandGlyph brand={glyph[m.id]} />}
                </span>
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-main">
                    {m.label} <Pill tone={m.linked ? "green" : "gray"}>{m.linked ? "Enabled" : "Not linked"}</Pill>
                  </div>
                  <div className="text-xs text-muted">{m.note}</div>
                </div>
              </div>
              {m.id !== "password" &&
                (m.linked ? (
                  <button className="btn h-9" onClick={() => unlink(m.id)}>
                    Unlink
                  </button>
                ) : (
                  <a
                    className={`btn h-9 ${providers[m.id] === false ? "pointer-events-none opacity-45" : ""}`}
                    href={`/api/auth/${m.id}`}
                    aria-disabled={providers[m.id] === false}
                  >
                    Link
                  </a>
                ))}
            </li>
          ))}
        </ul>
      </Card>

      <PasswordOtpCard user={user} onUserChange={onUserChange} />

      <Card title="Session" description="You're signed in on this browser.">
        <button className="btn" onClick={signOut}>
          Sign out
        </button>
      </Card>
    </>
  );
}

/* ───────────────────────── Billing ───────────────────────── */
const PLANS = [
  { key: "free", name: "Free", price: "₹0", tagline: "For trying VIBE out", features: ["3 projects", "Next.js / React / HTML export", "Community support"] },
  {
    key: "pro",
    name: "Pro",
    price: "₹199",
    tagline: "For solo builders",
    features: ["Unlimited projects", "AI assistant", "GitHub push", "Version history", "Priority support"],
  },
  {
    key: "team",
    name: "Team",
    price: "₹499",
    tagline: "For teams and agencies",
    features: ["Everything in Pro", "Shared projects", "Team roles", "Priority support"],
  },
] as const;

export function BillingSection({ user }: { user: User }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const isPro = user.plan !== "free";

  useEffect(() => {
    api.get<{ configured: boolean }>("billing/status").then((b) => setConfigured(b.configured)).catch(() => setConfigured(false));
  }, []);

  async function upgrade() {
    try {
      const res = await api.post<{ url: string }>("billing/checkout-session");
      window.location.href = res.url;
    } catch (e) {
      toast(e instanceof ApiError && e.status === 501 ? "Billing isn't configured on this deployment yet." : "Couldn't start checkout.");
    }
  }

  return (
    <>
      <Card title="Current plan" action={<Pill tone={isPro ? "pink" : "purple"}>{isPro ? "Pro" : "Free"}</Pill>}>
        <div className="grid items-stretch gap-5 pt-3 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const current = plan.key === (isPro ? "pro" : "free");
            const featured = plan.key === "pro";
            const dark = featured;
            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-3xl p-6 transition duration-300 hover:-translate-y-1 ${
                  dark
                    ? "bg-gradient-to-b from-[#6b4d9a] via-[#4f3a80] to-[#2b2140] text-white shadow-[0_24px_50px_rgba(107,77,154,0.4)]"
                    : "border border-border-light bg-white shadow-[0_10px_30px_rgba(107,77,154,0.08)]"
                } ${current && !dark ? "ring-2 ring-primary/70" : ""}`}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                    Most popular
                  </span>
                )}
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-sm font-bold uppercase tracking-[0.18em] ${dark ? "text-[#d9c9ff]" : "text-primary"}`}>{plan.name}</span>
                  {current && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${dark ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>Current</span>
                  )}
                </div>
                <p className={`mb-5 text-xs ${dark ? "text-white/70" : "text-muted"}`}>{plan.tagline}</p>
                <div className="mb-5 flex items-baseline gap-1">
                  <span className={`text-5xl font-extrabold tracking-tight ${dark ? "text-white" : "text-main"}`}>{plan.price}</span>
                  <span className={`text-sm font-medium ${dark ? "text-white/70" : "text-muted"}`}>/mo</span>
                </div>
                <div className={`mb-5 h-px ${dark ? "bg-white/15" : "bg-border-light"}`} />
                <ul className="mb-6 flex-1 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 ${dark ? "text-white/90" : "text-main"}`}>
                      <span
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-extrabold ${dark ? "bg-white text-primary" : "bg-primary/10 text-primary"}`}
                      >
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.key === "pro" && !isPro && (
                  <button
                    className="h-11 w-full rounded-xl bg-white text-sm font-bold text-primary shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={upgrade}
                    disabled={!configured}
                  >
                    Upgrade to Pro
                  </button>
                )}
                {plan.key === "team" && (
                  <button
                    className="h-11 w-full rounded-xl border border-primary/40 text-sm font-bold text-primary transition hover:bg-primary hover:text-white"
                    onClick={() => toast("Team plan is coming soon — we'll let you know.")}
                  >
                    Join the waitlist
                  </button>
                )}
                {plan.key === "free" && !isPro && <div className="h-11 rounded-xl bg-primary/5 text-center text-sm font-semibold leading-[2.75rem] text-primary">Your current plan</div>}
                {plan.key === "pro" && isPro && <div className="h-11 rounded-xl bg-white/15 text-center text-sm font-semibold leading-[2.75rem]">You&apos;re on Pro</div>}
              </div>
            );
          })}
        </div>
        {configured === false && !isPro && (
          <p className="mt-4 text-xs text-muted">Billing isn&apos;t configured on this deployment yet (no STRIPE_SECRET_KEY set), so upgrades are disabled.</p>
        )}
      </Card>

      <Card title="Payment method & invoices" description="Managed securely by Stripe once billing is enabled.">
        <div className="rounded-xl border border-dashed border-border-light p-6 text-center text-sm text-muted">No invoices yet.</div>
      </Card>
    </>
  );
}

/* ─────────────────────── Integrations ─────────────────────── */
const COMING_SOON: { id: BrandKey; name: string; text: string }[] = [
  { id: "gitlab", name: "GitLab", text: "Push generated projects to a GitLab repository." },
  { id: "bitbucket", name: "Bitbucket", text: "Sync exports to Bitbucket workspaces." },
  { id: "vercel", name: "Vercel", text: "One-click deploy every push." },
  { id: "netlify", name: "Netlify", text: "Publish previews and production builds." },
  { id: "figma", name: "Figma", text: "Import frames as VIBE components." },
  { id: "discord", name: "Discord", text: "Get export and deploy notifications." },
];

export function IntegrationsSection() {
  const [github, setGithub] = useState<{ connected: boolean; github_username: string | null } | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [notify, setNotify] = useLocalPref<Record<string, boolean>>("vibe.notify-integrations", {});

  function load() {
    api.get<{ connected: boolean; github_username: string | null }>("github/status").then(setGithub).catch(() => setGithub({ connected: false, github_username: null }));
  }

  useEffect(() => {
    load();
    api.get<{ github: boolean }>("auth/providers").then((p) => setConfigured(p.github)).catch(() => setConfigured(false));
  }, []);

  async function disconnect() {
    if (!confirm("Disconnect GitHub? You won't be able to push projects until you reconnect.")) return;
    try {
      await api.delete("github/connect");
      toast("GitHub disconnected.");
      load();
    } catch {
      toast("Couldn't disconnect GitHub.");
    }
  }

  return (
    <>
      <Card title="Git providers" description="Connect a provider to push generated projects straight to a repository.">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-light p-5">
          <div className="flex items-center gap-4">
            <BrandTile brand="github" />
            <div>
              <div className="flex items-center gap-2 font-semibold text-main">
                GitHub <Pill tone={github?.connected ? "green" : "gray"}>{github?.connected ? "Connected" : "Not connected"}</Pill>
              </div>
              <div className="text-sm text-muted">
                {github?.connected
                  ? `Signed in as @${github.github_username}. Use "Generate Code → Push to GitHub" in the builder.`
                  : configured === false
                    ? "GitHub isn't configured on this server yet (missing GITHUB_CLIENT_ID / SECRET)."
                    : "Authorize VIBE to create repositories on your behalf."}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {github?.connected && (
              <button className="btn h-9" onClick={disconnect}>
                Disconnect
              </button>
            )}
            <button className="btn btn-primary h-9" onClick={() => (window.location.href = "/api/github/connect")} disabled={configured === false}>
              {github?.connected ? "Reconnect" : "Connect GitHub"}
            </button>
          </div>
        </div>
      </Card>

      <Card title="More integrations" description="On the roadmap — switch on “Notify me” and we'll flag it when it's ready.">
        <div className="grid gap-4 sm:grid-cols-2">
          {COMING_SOON.map((p) => (
            <div key={p.id} className="flex flex-col justify-between gap-4 rounded-xl border border-border-light p-4">
              <div className="flex items-start gap-3">
                <BrandTile brand={p.id} />
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-main">
                    {p.name} <Pill tone="amber">Coming soon</Pill>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{p.text}</div>
                </div>
              </div>
              <Toggle checked={!!notify[p.id]} onChange={(v) => setNotify({ [p.id]: v })} label="Notify me" />
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">“Notify me” choices are saved on this device only.</p>
      </Card>
    </>
  );
}

/* ─────────────────────── Preferences ─────────────────────── */
interface Prefs {
  exportDefaults: { framework: string; language: string; styling: string };
}

export function PreferencesSection() {
  const [prefs, setPrefs] = useLocalPref<Prefs>("vibe.prefs", {
    exportDefaults: { framework: "nextjs", language: "typescript", styling: "tailwind" },
  });
  const d = prefs.exportDefaults;
  const set = (patch: Partial<Prefs["exportDefaults"]>) => {
    setPrefs({ exportDefaults: { ...d, ...patch } });
    toast("Preference saved.");
  };

  return (
    <Card title="Export defaults" description="Pre-selected in the builder's Generate Code dialog. Saved on this device.">
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Framework">
          <select className="input-field" value={d.framework} onChange={(e) => set({ framework: e.target.value })}>
            <option value="nextjs">Next.js</option>
            <option value="react">React (Vite)</option>
            <option value="html">HTML / CSS / JS</option>
          </select>
        </Field>
        <Field label="Language">
          <select className="input-field" value={d.language} onChange={(e) => set({ language: e.target.value })}>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </Field>
        <Field label="Styling">
          <select className="input-field" value={d.styling} onChange={(e) => set({ styling: e.target.value })}>
            <option value="tailwind">Tailwind CSS</option>
            <option value="css">Plain CSS</option>
          </select>
        </Field>
      </div>
    </Card>
  );
}

/* ────────────────────── Notifications ────────────────────── */
export function NotificationsSection() {
  const [n, setN] = useLocalPref("vibe.notifications", {
    product: true,
    exports: true,
    digest: false,
    security: true,
  });
  return (
    <Card title="Notifications" description="Choose what you'd like to hear about. Saved on this device — email delivery isn't set up yet.">
      <div className="divide-y divide-border">
        <Toggle checked={n.security} onChange={(v) => setN({ security: v })} label="Security alerts" description="New sign-ins and password changes." />
        <Toggle checked={n.exports} onChange={(v) => setN({ exports: v })} label="Export & push results" description="When a ZIP is ready or a GitHub push finishes." />
        <Toggle checked={n.product} onChange={(v) => setN({ product: v })} label="Product updates" description="New components, templates and features." />
        <Toggle checked={n.digest} onChange={(v) => setN({ digest: v })} label="Weekly digest" description="A summary of your projects' activity." />
      </div>
    </Card>
  );
}

/* ───────────────────────── Danger zone ───────────────────────── */
export function DangerSection({ user }: { user: User }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = confirmText.trim().toLowerCase() === user.email.toLowerCase();

  async function deleteAccount() {
    setBusy(true);
    try {
      await api.delete(`auth/me?confirm=${encodeURIComponent(user.email)}`);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (err) {
      toast(errMsg(err, "Couldn't delete your account."));
      setBusy(false);
    }
  }

  return (
    <Card danger title="Delete account" description="Permanently removes your account, all projects and pages. This can't be undone.">
      <div className="grid max-w-md gap-4">
        <Field label={`Type ${user.email} to confirm`}>
          <input className="input-field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={user.email} />
        </Field>
        <div>
          <button
            className="btn !border-red-500 !bg-red-500 !text-white hover:!bg-red-600 disabled:!opacity-40"
            disabled={!matches || busy}
            onClick={deleteAccount}
          >
            {busy ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </Card>
  );
}
