"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { FolderKanban, LayoutTemplate, LogOut, Plus, Search, Settings } from "lucide-react";
import { VibeLogo } from "@/components/marketing/VibeLogo";
import { Avatar } from "@/components/settings/SettingsUI";
import { api } from "@/lib/api-client";
import type { Project } from "@/lib/types";

const LINKS = [
  { href: "/dashboard", label: "Projects" },
  { href: "/templates", label: "Templates" },
];

const SHORTCUTS = [
  { label: "Browse templates", href: "/templates", icon: LayoutTemplate },
  { label: "Account settings", href: "/dashboard/settings", icon: Settings },
  { label: "All projects", href: "/dashboard", icon: FolderKanban },
];

function ProjectSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    if (open && projects.length === 0) api.get<Project[]>("projects").then(setProjects).catch(() => setProjects([]));
  }, [open, projects.length]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const found = projects
      .filter((p) => !term || p.name.toLowerCase().includes(term))
      .slice(0, 6)
      .map((p) => ({ key: p.id, label: p.name, sub: "Open in builder", href: `/builder/${p.id}`, icon: FolderKanban }));
    const shortcuts = SHORTCUTS.filter((s) => !term || s.label.toLowerCase().includes(term)).map((s) => ({ key: s.href, label: s.label, sub: "Go to", href: s.href, icon: s.icon }));
    return [...found, ...shortcuts];
  }, [q, projects]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <div ref={box} className="relative hidden w-full max-w-md md:block">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={input}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          }
          if (e.key === "Enter" && results[active]) go(results[active].href);
          if (e.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          }
        }}
        placeholder="Search projects and pages"
        aria-label="Search projects"
        className="h-10 w-full rounded-full border border-border-light bg-surface pl-10 pr-16 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border-light bg-app px-1.5 py-0.5 text-[10px] font-semibold text-muted">Ctrl K</kbd>
      {open && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
          {results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-slate-500">Nothing matches your search.</p>
          ) : (
            results.map((r, i) => (
              <button key={r.key} onMouseEnter={() => setActive(i)} onClick={() => go(r.href)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === active ? "bg-slate-100" : ""}`}>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <r.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{r.label}</span>
                  <span className="block text-xs text-slate-500">{r.sub}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function DashboardHeader() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const path = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <header className="app-header relative z-[60] flex items-center gap-5 border-b border-border bg-panel/80 px-8 py-3.5 backdrop-blur-xl">
      <Link href="/dashboard" className="flex items-center gap-2 text-lg font-extrabold text-main">
        <VibeLogo compact={false} />
      </Link>
      <nav className="flex gap-1 text-sm font-medium text-muted">
        {LINKS.map((l) => {
          const on = l.href === "/dashboard" ? path === "/dashboard" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 transition ${on ? "bg-surface font-bold text-main shadow-sm" : "hover:bg-surface hover:text-main"}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-1 justify-center">
        <ProjectSearch />
      </div>
      <div className="flex items-center gap-2">
        <Link href="/start" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-white shadow-md transition hover:brightness-110">
          <Plus className="h-4 w-4" /> New project
        </Link>
        <Link
          href="/dashboard/settings#profile"
          title={user ? `${user.name || user.email} — profile` : "Profile"}
          aria-label="Your profile"
          className="rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-transparent transition hover:ring-primary/50"
        >
          <Avatar name={user?.name || user?.email || "?"} url={user?.avatar_url} size={36} />
        </Link>
        <button type="button" onClick={logout} title="Log out" aria-label="Log out" className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-main">
          <LogOut className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </div>
    </header>
  );
}
