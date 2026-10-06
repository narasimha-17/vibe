"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, CreditCard, Plug, Shield, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Avatar, Pill } from "@/components/settings/SettingsUI";
import {
  BillingSection,
  DangerSection,
  IntegrationsSection,
  NotificationsSection,
  PreferencesSection,
  ProfileSection,
  SecuritySection,
} from "@/components/settings/sections";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { toast } from "@/lib/toast";

type TabId = "profile" | "security" | "billing" | "integrations" | "preferences" | "notifications" | "danger";

const TABS: { id: TabId; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", hint: "Name and avatar", icon: UserRound },
  { id: "security", label: "Account & security", hint: "Sign-in and password", icon: Shield },
  { id: "billing", label: "Billing & plan", hint: "Plan, usage, invoices", icon: CreditCard },
  { id: "integrations", label: "Integrations", hint: "GitHub, GitLab and more", icon: Plug },
  { id: "preferences", label: "Preferences", hint: "Export defaults", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", hint: "What you hear about", icon: Bell },
  { id: "danger", label: "Danger zone", hint: "Delete account", icon: Trash2 },
];

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { user, loading, setUser } = useCurrentUser();
  const params = useSearchParams();
  const [tab, setTab] = useState<TabId>("profile");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as TabId;
    if (TABS.some((t) => t.id === hash)) setTab(hash);
    if (params.get("github") === "connected") {
      setTab("integrations");
      toast("GitHub connected!");
    } else if (params.get("github") === "failed") {
      setTab("integrations");
      toast("GitHub connection failed. Please try again.");
    } else if (params.get("upgraded") === "1") {
      setTab("billing");
      toast("Upgraded to Pro!");
    }
  }, [params]);

  function pick(id: TabId) {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app-shell min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Settings</p>
          <h1 className="text-3xl font-bold tracking-tight text-main">Manage your account</h1>
        </div>

        {loading && <p className="text-sm text-muted">Loading your settings…</p>}
        {!loading && !user && (
          <div className="card-surface max-w-xl p-6">
            <p className="font-semibold text-main">Couldn&apos;t load your account</p>
            <p className="mt-1 text-sm text-muted">Your session may have expired, or the API isn&apos;t running.</p>
            <a href="/login?next=/dashboard/settings" className="btn btn-primary mt-4">
              Sign in again
            </a>
          </div>
        )}

        {user && (
          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="card-surface mb-4 hidden items-center gap-3 p-4 lg:flex">
                <Avatar name={user.name || user.email} url={user.avatar_url} size={44} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-main">{user.name || "Your account"}</div>
                  <div className="truncate text-xs text-muted">{user.email}</div>
                </div>
                <Pill tone={user.plan === "free" ? "purple" : "pink"}>{user.plan === "free" ? "Free" : "Pro"}</Pill>
              </div>
              <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const on = t.id === tab;
                  return (
                    <button
                      key={t.id}
                      onClick={() => pick(t.id)}
                      aria-current={on ? "page" : undefined}
                      className={`group flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition ${
                        on ? "bg-primary text-white shadow-[0_8px_20px_rgba(107,77,154,0.3)]" : "text-muted hover:bg-surface hover:text-main"
                      } ${t.id === "danger" && !on ? "hover:!text-red-600" : ""}`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
                      <span className="text-sm font-semibold">
                        {t.label}
                        <span className={`hidden text-[11px] font-normal lg:block ${on ? "text-white/70" : "text-muted/80"}`}>{t.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section key={tab} className="min-w-0 animate-[fade-in_250ms_ease-out]" aria-label={active.label}>
              {tab === "profile" && <ProfileSection user={user} onUserChange={setUser} />}
              {tab === "security" && <SecuritySection user={user} onUserChange={setUser} />}
              {tab === "billing" && <BillingSection user={user} />}
              {tab === "integrations" && <IntegrationsSection />}
              {tab === "preferences" && <PreferencesSection />}
              {tab === "notifications" && <NotificationsSection />}
              {tab === "danger" && <DangerSection user={user} />}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
