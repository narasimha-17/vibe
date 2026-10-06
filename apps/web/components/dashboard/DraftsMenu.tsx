"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FileText, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";

interface Draft { id: string; title: string; captured: number; total: number; updated_at: string | null }

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

/** A dropdown of unfinished project conversations, for the top bar and the dashboard. */
export function DraftsMenu({ variant = "ghost" }: { variant?: "ghost" | "primary" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  // The panel is drawn on the page itself (not inside the header), so no card or stacking context can cover it.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btn.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 12, right: Math.max(12, window.innerWidth - r.right - 24) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setDrafts(null);
    api.get<Draft[]>("intake/sessions").then(setDrafts).catch(() => setDrafts([]));
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  async function remove(id: string) {
    setDrafts((d) => (d || []).filter((x) => x.id !== id));
    try { await api.delete(`intake/sessions/${id}`); } catch { /* the list refreshes next time it opens */ }
  }

  const trigger = variant === "primary"
    ? "btn btn-primary inline-flex items-center gap-1.5"
    : "inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium text-muted transition hover:bg-surface hover:text-main";

  return (
    <div ref={box} className="relative">
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className={trigger}>
        Drafts <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && createPortal(
        <div ref={panel} role="menu" style={{ position: "fixed", top: pos.top, right: pos.right }} className="z-[1000] w-[380px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_24px_60px_rgba(30,20,60,0.28)]">
          <span aria-hidden className="absolute -top-1.5 right-8 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white" />
          <div className="flex items-center justify-between rounded-t-2xl px-5 pb-2 pt-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Unfinished projects</span>
            {drafts && drafts.length > 0 && <span className="rounded-full bg-[#f3edfb] px-2 py-0.5 text-[11px] font-bold text-[#6b4d9a]">{drafts.length}</span>}
          </div>
          <div className="max-h-[340px] overflow-y-auto px-2 pb-2">
            {drafts === null && <div className="space-y-2 p-3">{[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>}
            {drafts && drafts.length === 0 && (
              <div className="px-4 py-8 text-center">
                <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#f3edfb] text-[#6b4d9a]"><FileText className="h-5 w-5" /></span>
                <p className="text-sm font-semibold">No drafts yet</p>
                <p className="mt-1 text-xs text-slate-500">Start describing a project to OORA and it is saved here until you create it.</p>
              </div>
            )}
            {drafts?.slice(0, 6).map((d) => (
              <div key={d.id} className="group flex items-center gap-1 rounded-xl hover:bg-slate-50">
                <button role="menuitem" onClick={() => { setOpen(false); router.push(`/start?draft=${d.id}`); }} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f3edfb] text-[#6b4d9a]"><FileText className="h-[18px] w-[18px]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold leading-tight">{d.title}</span>
                    <span className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100"><i className="block h-full rounded-full bg-gradient-to-r from-[#6b4d9a] to-[#ff5b7f]" style={{ width: `${Math.max(6, (d.captured / d.total) * 100)}%` }} /></span>
                      <span className="whitespace-nowrap">{d.captured} of {d.total}</span><span aria-hidden>·</span><span className="whitespace-nowrap">{ago(d.updated_at)}</span>
                    </span>
                  </span>
                </button>
                <button aria-label={`Delete draft ${d.title}`} title="Delete draft" onClick={() => void remove(d.id)} className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-3 py-2.5">
            <Link href="/start" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 rounded-full bg-[#6b4d9a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#5a3f86]"><Plus className="h-4 w-4" /> New project</Link>
            <Link href="/drafts" onClick={() => setOpen(false)} className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-900">See all</Link>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
