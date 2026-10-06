"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useActivePage, useProjectStore } from "@/lib/store/project-store";
import type { AICommandResponse, AIOp } from "@/lib/types";
import { toast } from "@/lib/toast";
import { Brain, ImagePlus, MessageCircle, Send, Sparkles, Trash2, X } from "lucide-react";
import { REGISTRY } from "@/lib/registry";

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  undo?: number; // how many history steps this action added, so it can be undone from the chat
  done?: string[];
  choices?: string[];
}

export function AIPanel() {
  const project = useProjectStore((s) => s.project);
  const activePageId = useProjectStore((s) => s.activePageId);
  const page = useActivePage();
  const applyOps = useProjectStore((s) => s.applyOps);
  const addPages = useProjectStore((s) => s.addPages);
  const undo = useProjectStore((s) => s.undo);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingOps, setPendingOps] = useState<AIOp[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(true);
  const [progress, setProgress] = useState("");
  const [notes, setNotes] = useState<{ text: string; source: string }[]>([]);
  const [showMemory, setShowMemory] = useState(false);
  const projectId = project?.id;

  // The conversation and what the assistant has learned about this site are saved on the server, so they are here after a refresh.
  useEffect(() => {
    if (!projectId) return;
    api
      .get<{ history: { role: "user" | "ai"; text: string }[]; notes: { text: string; source: string }[] }>(`ai/memory/${projectId}`)
      .then((m) => {
        setMessages((cur) => (cur.length ? cur : m.history.map((h) => ({ role: h.role, text: h.text }))));
        setNotes(m.notes);
      })
      .catch(() => undefined);
  }, [projectId]);

  async function forget(index: number) {
    if (!projectId) return;
    await api.delete(`ai/memory/${projectId}/notes/${index}`);
    setNotes((n) => n.filter((_, i) => i !== index));
  }
  async function clearChat() {
    if (!projectId) return;
    await api.delete(`ai/memory/${projectId}`);
    setMessages([]);
    setPendingOps([]);
  }
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setAuto(localStorage.getItem("vibe.ai.auto") !== "off"); } catch { /* default on */ }
  }, []);
  function toggleAuto() {
    setAuto((a) => {
      try { localStorage.setItem("vibe.ai.auto", a ? "off" : "on"); } catch { /* ignore */ }
      return !a;
    });
  }

  /** Carries out edits on the page, one step at a time. Returns how many undo steps it added. */
  async function run(ops: AIOp[]): Promise<number> {
    if (!project) return 0;
    let steps = 0;
    const plain = ops.filter((o) => o.op !== "create_page");
    const pages = ops.filter((o) => o.op === "create_page");
    // pages first, so a navbar edit that links to them comes after they exist
    for (let i = 0; i < pages.length; i++) {
      const op = pages[i];
      setProgress(pages.length > 1 ? `Building page ${i + 1} of ${pages.length}: ${op.payload.name}…` : `Building ${op.payload.name}…`);
      if (op.payload.tree) {
        addPages([{ name: String(op.payload.name || "Imported"), path: String(op.payload.path || "/imported"), tree: op.payload.tree }]);
        steps += 1;
        continue;
      }
      try {
        const made = await api.post<{ name: string; path: string; tree: any[] }>("projects/pages/preset", {
          label: String(op.payload.name || "New page"),
          domain: op.payload.domain || "",
          business: op.payload.business || "",
          brand: op.payload.brand || "",
          pages: useProjectStore.getState().project!.pages.map((p) => ({ name: p.name, path: p.path, is_home: p.is_home, tree: p.tree })),
        });
        addPages([made]);
        steps += 1;
      } catch {
        applyOps([op]);
        steps += 1;
      }
    }
    setProgress("");
    if (plain.length) {
      // edits aimed at the page the user was on, even though new pages were just opened
      applyOps(plain.map((o) => (o.target_id && !o.payload?.page_id && page ? { ...o, payload: { ...o.payload, page_id: page.id } } : o)));
      steps += 1;
    }
    return steps;
  }

  // Everything the assistant may need to read: the page with all its text, and every page for site-wide requests.
  function sanitize(props: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(props, (_k, v) => (typeof v === "string" && (v.startsWith("data:") || v.length > 1500) ? "" : v)));
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || !project) return;
    setInput("");
    setOpen(true);
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setLoading(true);
    try {
      // Keep the prompt small: only short text values, so images, videos and long lists never reach the model.
      const brief = (props: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(props).filter(([, v]) => typeof v === "string" ? v.length <= 80 && !v.startsWith("data:") : typeof v === "number" || typeof v === "boolean" || (Array.isArray(v) && v.length <= 12 && v.every((x) => typeof x === "string" && x.length <= 40))));
      const treeSummary = (page?.tree || []).map((n) => ({ id: n.id, type: n.type, variant: n.variant, name: n.name, props: brief(n.props) }));
      const res = await api.post<AICommandResponse>("ai/command", {
        prompt,
        page_id: activePageId,
        tree_summary: treeSummary,
        pages: project.pages.map((p) => p.name),
        project_id: project.id,
        history: messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
        registry: Object.fromEntries(Object.entries(REGISTRY).map(([type, def]) => [type, { label: def.label, variants: def.variants.map((v) => v.id), props: def.defaultProps }])),
        last_ai: [...messages].reverse().find((m) => m.role === "ai")?.text || "",
        tree_full: (page?.tree || []).map((n) => ({ id: n.id, type: n.type, variant: n.variant, name: n.name, props: sanitize(n.props) })),
        all_pages: /\b(site|website|whole|entire|all pages|every page|all the pages|everything)\b/i.test(prompt) || project.pages.some((p) => p.id !== page?.id && prompt.toLowerCase().includes(p.name.toLowerCase()))
          ? project.pages.map((p) => ({ id: p.id, name: p.name, tree: p.tree.map((n) => ({ id: n.id, type: n.type, variant: n.variant, name: n.name, props: sanitize(n.props) })) }))
          : [],
        theme: project.theme,
      });
      if (auto && res.ops.length > 0 && !res.preview) {
        // Act on it: the assistant makes the change itself. Undo is one click away.
        const steps = await run(res.ops);
        setMessages((m) => [...m, { role: "ai", text: res.message, undo: steps, done: res.ops.map((o) => o.description).filter(Boolean) }]);
        setPendingOps([]);
      } else {
        setMessages((m) => [...m, { role: "ai", text: res.message, choices: res.choices }]);
        setPendingOps(res.ops);
      }
      // pick up anything new it learned
      api.get<{ notes: { text: string; source: string }[] }>(`ai/memory/${project.id}`).then((m) => setNotes(m.notes)).catch(() => undefined);
    } catch (e) {
      const msg = e instanceof ApiError ? String(e.detail) : "Something went wrong talking to the AI assistant.";
      setMessages((m) => [...m, { role: "ai", text: msg }]);
    } finally {
      setLoading(false);
    }
  }

  async function importScreenshot(file: File | undefined) {
    if (!file || !project) return;
    setOpen(true);
    setMessages((m) => [...m, { role: "user", text: `Rebuild this screenshot as a page (${file.name})` }]);
    setLoading(true);
    try {
      const b64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
      });
      const res = await api.post<AICommandResponse>("ai/import-image", { image_base64: b64, media_type: file.type || "image/png" });
      setMessages((m) => [...m, { role: "ai", text: res.message }]);
      setPendingOps(res.ops);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "I couldn't read that image. Try a PNG or JPG under 5 MB." }]);
    } finally {
      setLoading(false);
    }
  }

  async function applyOne(op: AIOp) {
    await run([op]);
    setPendingOps((ops) => ops.filter((o) => o !== op));
    toast("Applied — use Undo in the toolbar to revert.");
  }
  function rejectOne(op: AIOp) {
    setPendingOps((ops) => ops.filter((o) => o !== op));
  }
  async function applyAll() {
    await run(pendingOps);
    setPendingOps([]);
    toast("Applied all suggested changes.");
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(59,45,90,0.25)] transition duration-200 hover:-translate-y-1 hover:bg-primary-hover"
          aria-label="Open AI assistant"
          data-tour="ai"
        >
          <MessageCircle className="h-5 w-5" />
          AI Assistant
        </button>
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[min(420px,100vw)] flex-col border-l border-border-light bg-panel shadow-[-18px_0_50px_rgba(59,45,90,0.16)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="AI assistant panel"
      >
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-main">AI Assistant</p>
              <p className="text-xs text-muted">Tell me what to change and I&apos;ll do it</p>
              <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-muted">
                <input type="checkbox" checked={auto} onChange={toggleAuto} className="accent-[#6b4d9a]" /> Apply changes automatically
              </label>
            </div>
          </div>
          <button type="button" title="What the assistant remembers" aria-label="Memory" onClick={() => setShowMemory((v) => !v)} className={`relative grid h-9 w-9 place-items-center rounded-lg transition hover:bg-surface hover:text-main ${showMemory ? "bg-surface text-primary" : "text-muted"}`}>
            <Brain className="h-5 w-5" />
            {notes.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">{notes.length}</span>}
          </button>
          <button type="button" title="Clear this conversation" aria-label="Clear conversation" onClick={() => void clearChat()} className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-main">
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-main"
            onClick={() => setOpen(false)}
            aria-label="Close AI assistant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showMemory && (
          <div className="border-b border-border-light bg-surface px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">What I remember about this site</p>
            {notes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing yet. Tell me things like “my brand is Crumb &amp; Co” or “I prefer a warm, premium look” and I&apos;ll keep them.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg bg-panel px-3 py-2 text-sm text-main">
                    <span className="flex-1">{n.text}</span>
                    <button type="button" aria-label="Forget this" onClick={() => void forget(i)} className="text-muted hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {messages.length === 0 && pendingOps.length === 0 && (
            <div className="rounded-2xl border border-border-light bg-surface p-4 text-sm text-muted">
              Try &quot;add a cart button to the navbar&quot;, &quot;create a checkout page&quot;, &quot;add a pricing section&quot; or &quot;change the headline to Fresh cakes daily&quot;.
            </div>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user" ? "ml-auto bg-primary text-white" : "border border-border-light bg-surface text-main"
                }`}
              >
                {m.text}
                {m.choices && m.choices.length > 0 && i === messages.length - 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.choices.map((c) => (
                      <button key={c} type="button" onClick={() => { setInput(c); setTimeout(() => document.getElementById("ai-send")?.click(), 0); }} className="rounded-full border border-primary/40 bg-panel px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                {m.done && m.done.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-border-light pt-2 text-xs text-muted">
                    {m.done.map((d, k) => <li key={k}>✓ {d}</li>)}
                  </ul>
                )}
                {m.undo ? (
                  <button type="button" onClick={() => { for (let k = 0; k < (m.undo || 0); k++) undo(); setMessages((all) => all.map((x, j) => (j === i ? { ...x, undo: 0, text: x.text + " (undone)" } : x))); }} className="mt-2 rounded-full border border-border-light px-3 py-1 text-xs font-semibold text-primary hover:bg-panel">
                    Undo
                  </button>
                ) : null}
              </div>
            ))}
            {(loading || progress) && <div className="text-xs text-muted">{progress || "Thinking…"}</div>}
          </div>
          {pendingOps.length > 0 && (
            <div className="mt-5 flex flex-col gap-2 border-t border-border-light pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Suggested changes</p>
              {pendingOps.map((op, i) => (
                <div key={i} className="rounded-xl border border-border-light bg-surface p-3">
                  <p className="text-sm text-main">{op.description || `${op.op.replace(/_/g, " ")}${op.target_id ? "" : ""}`}</p>
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-primary flex-1 py-1.5 text-xs" onClick={() => applyOne(op)}>
                      Apply
                    </button>
                    <button className="btn flex-1 py-1.5 text-xs" onClick={() => rejectOne(op)}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingOps.length > 1 && (
                <div className="mt-1 flex gap-2">
                  <button className="btn btn-primary flex-1" onClick={applyAll}>Apply all ({pendingOps.length})</button>
                  <button className="btn flex-1" onClick={() => setPendingOps([])}>Reject all</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border-light bg-surface/80 p-4">
          <div className="flex items-center gap-2 rounded-2xl border border-border-light bg-surface p-1.5 shadow-sm transition focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(59,45,90,0.08)]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Tell me what to change or build..."
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-main outline-none focus:outline-none focus-visible:outline-none placeholder:text-muted"
            />
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void importScreenshot(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" title="Rebuild a screenshot as a page" aria-label="Import a screenshot" onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-panel hover:text-primary">
              <ImagePlus className="h-5 w-5" />
            </button>
            <button id="ai-send" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm transition hover:-translate-y-px hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted/50 disabled:shadow-none" onClick={send} disabled={loading || !input.trim()} aria-label="Send request">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted">Press Enter to send your request</p>
        </div>
      </aside>
    </>
  );
}
