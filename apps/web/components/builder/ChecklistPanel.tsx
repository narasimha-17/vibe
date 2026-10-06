"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ClipboardCheck, Sparkles, Wand2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useProjectStore } from "@/lib/store/project-store";
import type { ProjectDetail } from "@/lib/types";

interface Item { id: string; category: string; text: string; done: boolean; auto: boolean | null; note: string; met: boolean }
interface Board { has_checklist: boolean; items: Item[]; met: number; total: number }
interface AutoFixResult extends Board { linked: string[]; still_thin: string[] }

/** The acceptance checklist from the OORA conversation, kept next to the site. Items tick themselves as the site meets them. */
export function ChecklistChip({ saveStatus, openSignal }: { saveStatus: "saved" | "saving" | "dirty"; openSignal: number }) {
  const projectId = useProjectStore((s) => s.project?.id);
  const [board, setBoard] = useState<Board | null>(null);
  const [open, setOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [fixing, setFixing] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const next = await api.get<Board>(`projects/${projectId}/checklist`);
      setBoard((prev) => {
        if (prev && prev.met < prev.total && next.met === next.total && next.total > 0) setCelebrate(true);
        return next;
      });
    } catch {
      /* the chip simply stays hidden */
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);
  // re-check whenever the latest edits have been saved, because the server judges the saved site
  useEffect(() => { if (saveStatus === "saved") void load(); }, [saveStatus, load]);
  useEffect(() => { if (openSignal > 0) setOpen(true); }, [openSignal]);

  async function tick(item: Item) {
    if (!projectId) return;
    setBoard(await api.patch<Board>(`projects/${projectId}/checklist/${item.id}`, { done: !item.done }));
  }

  /** Deterministic, free fix: every page that exists gets linked from the navbar. No model call, so it's instant. */
  async function autoFix() {
    if (!projectId) return;
    setFixing(true);
    try {
      const result = await api.post<AutoFixResult>(`projects/${projectId}/checklist/auto-fix`);
      setBoard(result);
      useProjectStore.getState().loadProject(await api.get<ProjectDetail>(`projects/${projectId}`));
      if (result.linked.length === 0) {
        toast("Every page was already linked from the navbar.");
      } else {
        toast(`Linked from the navbar: ${result.linked.join(", ")}.` + (result.still_thin.length ? ` Still needs content: ${result.still_thin.join(", ")}.` : ""));
      }
    } catch {
      toast("Couldn't fix the linkage automatically. Try again.");
    } finally {
      setFixing(false);
    }
  }

  const hasUnlinkedPage = (board?.items || []).some((i) => !i.met && i.note.includes("isn't linked in the navbar"));

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of board?.items || []) m.set(i.category, [...(m.get(i.category) || []), i]);
    return [...m.entries()];
  }, [board]);

  if (!board?.has_checklist) return null;
  const pct = Math.round((board.met / Math.max(1, board.total)) * 100);

  return (
    <>
      <button className="btn h-9" onClick={() => setOpen(true)} title="Your acceptance checklist" data-tour="checklist">
        <ClipboardCheck className="h-4 w-4" /> Checklist <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{board.met}/{board.total}</span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[1500]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <aside role="dialog" aria-label="Acceptance checklist" className="absolute right-0 top-0 flex h-full w-[min(440px,100vw)] flex-col bg-white text-slate-900 shadow-[-20px_0_60px_rgba(30,20,60,0.25)]">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f3edfb] text-[#6b4d9a]"><ClipboardCheck className="h-5 w-5" /></span>
              <div className="flex-1">
                <h2 className="text-base font-extrabold">Acceptance checklist</h2>
                <p className="text-xs text-slate-500">From your conversation with OORA. Verified items tick themselves.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
            </div>
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500"><span>{board.met} of {board.total} met</span><span>{pct}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#6b4d9a] to-[#ff5b7f] transition-all duration-500" style={{ width: `${pct}%` }} /></div>
              {celebrate && <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><Sparkles className="h-4 w-4" /> Everything is met. Your site is ready to publish.</p>}
              {hasUnlinkedPage && (
                <button onClick={() => void autoFix()} disabled={fixing} className="btn mt-3 h-9 w-full justify-center text-[13px]">
                  <Wand2 className="h-3.5 w-3.5" /> {fixing ? "Linking pages…" : "Link every page in the navbar automatically"}
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {groups.map(([category, items]) => (
                <section key={category}>
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b4d9a]">{category}</h3>
                  <ul className="space-y-1">
                    {items.map((item) => {
                      const autoMet = item.auto === true && !item.done;
                      return (
                        <li key={item.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={item.met}
                            aria-label={item.text}
                            disabled={autoMet}
                            onClick={() => void tick(item)}
                            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${item.met ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-[#6b4d9a]"} ${autoMet ? "cursor-default" : ""}`}
                          >
                            {item.met && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </button>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[13.5px] leading-snug ${item.met ? "text-slate-400 line-through" : "text-slate-800"}`}>{item.text}</span>
                            {autoMet && <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Verified automatically</span>}
                            {!item.met && item.auto === false && item.note && <span className="mt-0.5 block text-xs font-medium text-amber-700">To do: {item.note}</span>}
                            {!item.met && item.auto === null && <span className="mt-0.5 block text-xs text-slate-400">Needs you to check it</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
