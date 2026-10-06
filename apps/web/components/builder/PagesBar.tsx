"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProjectStore } from "@/lib/store/project-store";
import { FileText, Plus, Wand2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";

const PRESETS = ["Shop", "Track order", "Login", "Register", "Profile", "Contact", "About", "Pricing", "FAQ", "Team", "Blog", "Portfolio", "Reviews"];

export function PagesBar() {
  const project = useProjectStore((s) => s.project);
  const activePageId = useProjectStore((s) => s.activePageId);
  const setActivePage = useProjectStore((s) => s.setActivePage);
  const createPage = useProjectStore((s) => s.createPage);
  const addPages = useProjectStore((s) => s.addPages);
  const deletePage = useProjectStore((s) => s.deletePage);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const plus = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [name, setName] = useState("");

  function submitNewPage() {
    const trimmed = name.trim();
    if (trimmed) createPage(trimmed, "/" + trimmed.toLowerCase().replace(/\s+/g, "-"));
    setName("");
    setAdding(false);
  }

  async function addPreset(label: string) {
    if (!project) return;
    setMenu(false);
    try {
      const page = await api.post<{ name: string; path: string; tree: any[] }>("projects/pages/preset", {
        label,
        pages: project.pages.map((p) => ({ name: p.name, path: p.path, is_home: p.is_home, tree: p.tree })),
      });
      addPages([page]);
    } catch {
      toast("Couldn't create that page.");
    }
  }

  /** Creates a ready-made page (with components) for every navbar link that has no page yet. */
  async function fromNavbar() {
    if (!project || busy) return;
    setBusy(true);
    try {
      const made = await api.post<{ name: string; path: string; tree: any[] }[]>("projects/pages/from-navbar", {
        pages: project.pages.map((p) => ({ name: p.name, path: p.path, is_home: p.is_home, tree: p.tree })),
      });
      if (made.length === 0) toast("Every navbar link already has a page.");
      else {
        addPages(made);
        toast(`Created ${made.length} page${made.length > 1 ? "s" : ""}: ${made.map((m) => m.name).join(", ")}.`);
      }
    } catch {
      toast("Couldn't create pages from the navbar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-tour="pages" className="flex min-h-0 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border-light bg-app px-4 py-2.5">
      {project?.pages.map((page) => (
        <div
          key={page.id}
          className={`group flex items-center whitespace-nowrap rounded-t-lg border ${
            page.id === activePageId
              ? "border-border-light border-b-panel bg-panel text-main"
              : "border-transparent text-muted hover:bg-surface-hover hover:text-main"
          }`}
        >
          <button onClick={() => setActivePage(page.id)} className={`py-2 text-[13px] font-semibold ${page.is_home ? "px-3.5" : "pl-3.5 pr-1.5"}`}>
            {page.name}
          </button>
          {!page.is_home && (
            <button
              aria-label={`Delete page ${page.name}`}
              title="Delete this page"
              onClick={() => {
                if (confirm(`Delete the "${page.name}" page? You can undo this with Ctrl+Z.`)) deletePage(page.id);
              }}
              className={`mr-1.5 grid h-5 w-5 place-items-center rounded-full text-muted transition hover:bg-red-100 hover:text-red-600 ${page.id === activePageId ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover:opacity-100"}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      {adding ? (
        <input
          autoFocus
          className="input-field h-8 w-32 py-1"
          value={name}
          placeholder="Page name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitNewPage()}
          onBlur={submitNewPage}
        />
      ) : (
        <div className="relative">
          <button
            ref={plus}
            onClick={() => {
              const r = plus.current?.getBoundingClientRect();
              if (r) setMenuPos({ top: r.bottom + 8, left: Math.min(r.left, window.innerWidth - 240) });
              setMenu((m) => !m);
            }}
            className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-border-light text-muted hover:border-primary hover:text-primary"
            title="Add page"
            aria-haspopup="menu"
            aria-expanded={menu}
          >
            <Plus className="h-4 w-4" />
          </button>
          {menu && createPortal(
            <>
              <div className="fixed inset-0 z-[999]" onClick={() => setMenu(false)} />
              <div role="menu" style={{ position: "fixed", top: menuPos.top, left: menuPos.left }} className="z-[1000] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-2xl">
                <button role="menuitem" onClick={() => { setMenu(false); setAdding(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-100"><FileText className="h-4 w-4 text-slate-400" /> Blank page</button>
                <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ready-made pages</div>
                <div className="grid grid-cols-2 gap-0.5">
                  {PRESETS.map((label) => (
                    <button key={label} role="menuitem" onClick={() => void addPreset(label)} className="rounded-lg px-3 py-2 text-left text-[13px] font-medium hover:bg-slate-100">{label}</button>
                  ))}
                </div>
              </div>
            </>,
            document.body,
          )}
        </div>
      )}
      <button
        onClick={() => void fromNavbar()}
        disabled={busy}
        title="Create a page, pre-filled with components, for every navbar link that doesn't have one"
        className="ml-1 flex h-[30px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border-light px-2.5 text-[12px] font-semibold text-muted hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <Wand2 className="h-3.5 w-3.5" /> {busy ? "Creating…" : "Pages from navbar"}
      </button>
    </div>
  );
}
