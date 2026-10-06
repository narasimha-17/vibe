"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface Draft { id: string; title: string; captured: number; total: number; updated_at: string | null }

/** Unfinished project conversations. Resume one, or throw it away. */
export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  useEffect(() => {
    api.get<Draft[]>("intake/sessions").then(setDrafts).catch(() => { setDrafts([]); toast("Couldn't load your drafts."); });
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    try {
      await api.delete(`intake/sessions/${id}`);
      setDrafts((d) => (d || []).filter((x) => x.id !== id));
    } catch {
      toast("Couldn't delete that draft.");
    }
  }

  return (
    <div className="app-shell min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-4xl px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Workspace</p>
            <h1 className="text-3xl font-bold tracking-tight text-main">Drafts</h1>
            <p className="mt-2 text-sm text-muted">Project conversations you started but haven&apos;t finished. Pick one up where you left off.</p>
          </div>
          <Link href="/start" className="btn btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> New project</Link>
        </div>

        {drafts === null && <p className="text-sm text-muted">Loading drafts…</p>}
        {drafts && drafts.length === 0 && (
          <div className="card-surface flex flex-col items-center gap-3 p-14 text-center">
            <FileText className="h-8 w-8 text-muted" />
            <p className="text-main">No drafts yet.</p>
            <p className="max-w-sm text-sm text-muted">When you start describing a project and leave before creating it, it will be saved here.</p>
            <Link href="/start" className="btn btn-primary">Start a project</Link>
          </div>
        )}
        <ul className="space-y-3">
          {drafts?.map((d) => (
            <li key={d.id} className="card-surface flex items-center gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-main">{d.title}</p>
                <p className="text-xs text-muted">{d.captured} of {d.total} questions answered{d.updated_at ? ` · edited ${new Date(d.updated_at).toLocaleString()}` : ""}</p>
                <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${(d.captured / d.total) * 100}%` }} /></div>
              </div>
              <button className="btn btn-primary" onClick={() => router.push(`/start?draft=${d.id}`)}>Resume</button>
              <button aria-label="Delete draft" title="Delete draft" onClick={() => void remove(d.id)} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
