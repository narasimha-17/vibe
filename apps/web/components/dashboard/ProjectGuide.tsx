"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, FileText, Mic, Paperclip, Pencil, Plus, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api-client";
import type { StyleSpec } from "@/lib/style/types";
import { buildTokens, themePatch } from "@/lib/style/engine";
import { PRESET_BY_ID, PRESETS } from "@/lib/style/presets";
import { toast } from "@/lib/toast";

interface Msg { role: "assistant" | "user"; text: string; engine?: string }
interface Topic { key: string; label: string; required: boolean }
interface View {
  id: string;
  status: string;
  messages: Msg[];
  memory: Record<string, unknown>;
  progress: { captured: number; total: number; topics: Record<string, boolean> };
  ready: boolean;
  next_topic: string | null;
  topics: Topic[];
  suggestions: string[];
  engine?: string;
  note?: string;
}
interface Understood { key: string; label: string; value: string }
interface Rec { title: string; why: string; priority: "high" | "medium" | "low"; source: string; page?: string }
interface Criterion { id: string; category: string; text: string; done: boolean }
interface Summary {
  understanding: Understood[];
  features: { feature: string; supported: boolean; note: string }[];
  integrations: { name: string; supported: boolean; note: string }[];
  pages: { requested_count: number | null; names: string[]; implied: { name: string; why: string }[] };
  recommended: { template: string; style: string };
  recommendations: Rec[];
  acceptance: Criterion[];
  ai_suggestions: number;
  brand_name?: string;
}
interface TemplateInfo { key: string; label: string }

const PRIORITY: Record<Rec["priority"], string> = { high: "bg-rose-100 text-rose-700", medium: "bg-amber-100 text-amber-700", low: "bg-slate-100 text-slate-600" };

function display(v: unknown): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as { count?: number; names?: string[] };
    return `${o.count ?? "?"} pages: ${(o.names || []).join(", ")}`;
  }
  return Array.isArray(v) ? v.join(", ") || "None" : String(v ?? "");
}

export interface GuidePreset { templateKey: string; title: string; spec?: StyleSpec }

export function ProjectGuide({ onClose, onCreated, preset, draftId }: { onClose: () => void; onCreated: (id: string) => void | Promise<void>; preset?: GuidePreset; draftId?: string }) {
  const [view, setView] = useState<View | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<"chat" | "review" | "creating">("chat");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");
  const [style, setStyle] = useState("");
  const [extraPages, setExtraPages] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [custom, setCustom] = useState("");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [engineNote, setEngineNote] = useState("");
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recognition = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  // The box fits its text: one line when empty (also after sending), growing up to about six lines.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 160)}px`;
    el.style.overflowY = el.scrollHeight > 160 ? "auto" : "hidden";
  }, [input, phase, view?.id]);
  useEffect(() => {
    setVoiceOk(typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    return () => { try { recognition.current?.abort(); } catch {} };
  }, []);

  /** Ends the current dictation for good, so its words can never leak into the next message. */
  function endVoice() {
    const rec = recognition.current;
    recognition.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try { rec.abort(); } catch {}
    }
    setListening(false);
  }

  function toggleVoice() {
    if (listening) {
      endVoice();
      return;
    }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = true;
    const base = input ? `${input.trimEnd()} ` : "";
    rec.onresult = (e: any) => {
      if (recognition.current !== rec) return;
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(base + text);
    };
    rec.onerror = () => { setListening(false); toast("I couldn't hear anything. Check that the microphone is allowed."); };
    rec.onend = () => setListening(false);
    recognition.current = rec;
    rec.start();
    setListening(true);
  }

  async function attach(file: File | undefined) {
    if (!file) return;
    if (!/\.(txt|md|markdown|csv|json)$/i.test(file.name) && !file.type.startsWith("text/")) {
      toast("Please attach a text document: .txt, .md, .csv or .json.");
      return;
    }
    const text = (await file.text()).trim();
    if (!text) { toast("That file is empty."); return; }
    setAttachment({ name: file.name, text: text.slice(0, 3200) });
  }

  // The preset arrives as a new object on every parent render; keep it in a ref so it can never re-trigger the interview.
  const presetRef = useRef(preset);
  const started = useRef(false);
  const start = useCallback(async (fresh: boolean) => {
    const preset = presetRef.current;
    if (!fresh && draftId) {
      setView(await api.get<View>(`intake/sessions/${draftId}`));
      setResumed(true);
      return;
    }
    setResumed(false);
    setView(await api.post<View>("intake/sessions", preset ? { template_label: preset.title } : {}));
  }, [draftId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start(false).catch(() => setFailed(true));
    api.get<TemplateInfo[]>("projects/templates").then(setTemplates).catch(() => setTemplates([]));
  }, [start]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [view?.messages.length, sending]);

  async function send(text = input) {
    const doc = attachment;
    const lead = text.trim() ? text.trim() : "Here is my brief.";
    const t = (doc ? [lead, "", "[Attached: " + doc.name + "]", doc.text].join("\n") : text).trim();
    if (!t || !view || sending) return;
    setInput("");
    setAttachment(null);
    endVoice();
    setSending(true);
    setView({ ...view, messages: [...view.messages, { role: "user", text: t }] });
    try {
      const res = await api.post<View>(`intake/sessions/${view.id}/message`, { text: t });
      setView(res);
      setEngineNote("");
    } catch {
      toast("That message didn't go through. Please try again.");
      setView(view);
      setInput(t);
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(topic: string) {
    if (!view) return;
    try {
      setView(await api.patch<View>(`intake/sessions/${view.id}/memory`, { topic, value: editValue }));
    } catch {
      toast("Couldn't save that change.");
    }
    setEditing(null);
  }

  async function review() {
    if (!view) return;
    setLoadingSummary(true);
    try {
      const s = await api.post<Summary>(`intake/sessions/${view.id}/summary`);
      setSummary(s);
      setTemplate(preset?.templateKey || s.recommended.template);
      setStyle(preset?.spec?.id || s.recommended.style);
      setCriteria(s.acceptance);
      setExtraPages([]);
      setName((n) => n || s.brand_name || "My Website");
      setPhase("review");
    } catch {
      toast("Couldn't build the summary.");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function create() {
    if (!view || !summary) return;
    setPhase("creating");
    try {
      const spec = preset?.spec && style === preset.spec.id ? preset.spec : PRESET_BY_ID[style];
      const res = await api.post<{ project_id: string }>(`intake/sessions/${view.id}/provision`, {
        name: name.trim() || "My Website",
        template_key: template,
        theme: spec ? themePatch(spec, buildTokens(spec)) : undefined,
        extra_pages: extraPages,
        acceptance: criteria,
      });
      await onCreated(res.project_id);
    } catch {
      toast("Couldn't create the workspace.");
      setPhase("review");
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Criterion[]>();
    for (const c of criteria) m.set(c.category, [...(m.get(c.category) || []), c]);
    return [...m.entries()];
  }, [criteria]);

  const captured = view?.progress.captured ?? 0;
  const total = view?.progress.total ?? 9;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-b from-[#f3edfb] via-white to-white text-slate-900" role="dialog" aria-modal="true" aria-label="OORA, the Outcome-Oriented Requirements Assistant">
      <header className="flex items-center gap-4 border-b border-slate-200/70 bg-white/70 px-5 py-3 backdrop-blur sm:px-8">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#6b4d9a] text-white"><Sparkles className="h-5 w-5" /></span>
        <div className="leading-tight">
          <div className="text-base font-extrabold">OORA</div>
          <div className="text-xs text-slate-500">Outcome-Oriented Requirements Assistant</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden w-44 sm:block">
            <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500"><span>Understanding</span><span>{captured} of {total}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#6b4d9a] to-[#ff5b7f] transition-all duration-500" style={{ width: `${(captured / total) * 100}%` }} /></div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>
      </header>

      {failed && !view && (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div className="max-w-sm">
            <p className="text-lg font-bold">I couldn't start the conversation</p>
            <p className="mt-1 text-sm text-slate-500">The server didn't respond. Make sure the API is running, then try again.</p>
            <button className="mt-4 rounded-full bg-[#6b4d9a] px-6 py-2.5 text-sm font-bold text-white" onClick={() => { setFailed(false); void start(true).catch(() => setFailed(true)); }}>Try again</button>
          </div>
        </div>
      )}
      {!failed && !view && phase === "chat" && (
        <div className="grid flex-1 place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#6b4d9a]" /></div>
      )}

      {phase === "creating" && (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#6b4d9a]" />
            <p className="text-lg font-bold">Setting up your workspace…</p>
            <p className="text-sm text-slate-500">Creating pages, your requirements, checklist and documentation.</p>
          </div>
        </div>
      )}

      {phase === "chat" && view && (
        <div className="flex min-h-0 flex-1 flex-col">
          {resumed && (
            <div className="flex items-center justify-center gap-3 bg-amber-50 px-6 py-2 text-xs text-amber-800">
              <span>Continuing your earlier conversation.</span>
              <button className="font-bold underline" onClick={() => void start(true)}>Start over</button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
            <div className="mx-auto w-full max-w-3xl space-y-7 px-5 py-8">
              {view.messages.length <= 1 && (
                <div className="guide-in pb-2 pt-6 text-center">
                  <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#6b4d9a] to-[#ff5b7f] text-white shadow-[0_10px_30px_rgba(107,77,154,0.35)]"><Sparkles className="h-7 w-7" /></span>
                  <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900">Meet OORA</h1>
                  <p className="mx-auto mt-2 max-w-md text-[15px] text-slate-500">Your Outcome-Oriented Requirements Assistant. Describe your idea in your own words. OORA works out what you need, asks the right follow-ups, then gives you a plan and checklist to review.</p>
                </div>
              )}
              {view.messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="guide-in flex justify-end">
                    <div className="max-w-[80%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-gradient-to-br from-[#6b4d9a] to-[#8a63c4] px-5 py-3 text-[15px] leading-relaxed text-white shadow-[0_6px_20px_rgba(107,77,154,0.28)]">{m.text}</div>
                  </div>
                ) : (
                  <div key={i} className="guide-in flex gap-3.5">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#6b4d9a] to-[#ff5b7f] text-white shadow-md"><Sparkles className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0 max-w-[92%] rounded-[22px] rounded-tl-md border border-slate-200/80 bg-white px-5 py-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.05)]">
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#6b4d9a]">OORA</div>
                      <div className="whitespace-pre-wrap text-[15.5px] leading-[1.65] text-slate-800">{m.text}</div>
                    </div>
                  </div>
                ),
              )}
              {sending && (
                <div className="guide-in flex items-center gap-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#6b4d9a] to-[#ff5b7f] text-white shadow-md"><Sparkles className="h-[18px] w-[18px]" /></span>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                    {[0, 1, 2].map((i) => <i key={i} className="guide-dot h-2 w-2 rounded-full bg-[#6b4d9a]" style={{ animationDelay: `${i * 160}ms` }} />)}
                    <span className="ml-1 text-xs font-medium text-slate-400">Thinking</span>
                  </div>
                </div>
              )}
              {view.ready && !sending && (
                <div className="ml-12 rounded-2xl border border-[#6b4d9a]/25 bg-[#f6f2fd] p-5">
                  <p className="text-sm font-semibold text-slate-800">I have what I need. Want to review my understanding, recommendations and the acceptance checklist?</p>
                  <button onClick={() => void review()} disabled={loadingSummary} className="mt-3 rounded-full bg-[#ff5b7f] px-6 py-2.5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(255,91,127,0.35)] hover:brightness-105 disabled:opacity-60">
                    {loadingSummary ? "Preparing…" : "Review what you understood"}
                  </button>
                </div>
              )}
              {engineNote && !sending && <p className="text-center text-[11px] text-slate-400">{engineNote}</p>}
              <div ref={end} />
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="mx-auto max-w-3xl">
              {view.suggestions.length > 0 && !sending && (
                <div className={view.messages.length <= 1 ? "mb-3 grid gap-2 sm:grid-cols-2" : "mb-3 flex flex-wrap gap-2"}>
                  {view.suggestions.map((s) => <button key={s} onClick={() => void send(s)} className={view.messages.length <= 1 ? "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-[14px] font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#6b4d9a] hover:text-[#6b4d9a] hover:shadow-md" : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:border-[#6b4d9a] hover:bg-[#f6f2fd] hover:text-[#6b4d9a]"}>{s}</button>)}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="rounded-[28px] border border-slate-200 bg-white pb-2 pl-3 pr-2.5 pt-2 shadow-[0_8px_30px_rgba(107,77,154,0.12)] transition focus-within:border-[#6b4d9a] focus-within:shadow-[0_8px_30px_rgba(107,77,154,0.22)]">
                {attachment && (
                  <div className="mb-1 ml-1 inline-flex max-w-full items-center gap-2 rounded-full bg-[#f3edfb] py-1 pl-3 pr-1.5 text-xs font-semibold text-[#6b4d9a]">
                    <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{attachment.name}</span>
                    <button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)} className="grid h-5 w-5 place-items-center rounded-full hover:bg-white"><X className="h-3 w-3" /></button>
                  </div>
                )}
                <div className="flex items-end gap-1">
                  <input ref={fileInput} type="file" accept=".txt,.md,.markdown,.csv,.json,text/*" hidden onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ""; }} />
                  <button type="button" onClick={() => fileInput.current?.click()} title="Attach a brief (.txt, .md, .csv, .json)" aria-label="Attach a document" className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-[#6b4d9a]"><Paperclip className="h-[18px] w-[18px]" /></button>
                  <textarea
                    ref={box}
                    value={input}
                    onChange={(e) => setInput(e.target.value)} rows={1} aria-label="Your answer" placeholder={listening ? "Listening… speak now" : "Message OORA…"} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    style={{ outline: "none", boxShadow: "none", border: "none", overflowY: "hidden" }}
                    className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-1 py-3 text-[15.5px] leading-6 text-slate-900 placeholder:text-slate-400"
                  />
                  {voiceOk && (
                    <button type="button" onClick={toggleVoice} title={listening ? "Stop listening" : "Speak your answer"} aria-label={listening ? "Stop voice input" : "Start voice input"} aria-pressed={listening}
                      className={`relative mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${listening ? "bg-rose-500 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-[#6b4d9a]"}`}>
                      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/50" />}
                      <Mic className="relative h-[18px] w-[18px]" />
                    </button>
                  )}
                  <button disabled={(!input.trim() && !attachment) || sending} className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#6b4d9a] text-white transition hover:bg-[#5a3f86] disabled:bg-slate-200 disabled:text-slate-400" aria-label="Send"><Send className="h-4 w-4" /></button>
                </div>
              </form>
              <p className="mt-2 text-center text-[11px] text-slate-400">Answer in your own words. You can give several details at once, and correct me any time.</p>
            </div>
          </div>
        </div>
      )}

      {phase === "review" && summary && view && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-8 sm:px-10">
          <div className="mx-auto max-w-5xl space-y-6">
            <button onClick={() => setPhase("chat")} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Back to the conversation</button>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-extrabold">Here's what I understood</h2>
              <p className="mb-5 text-sm text-slate-500">Please check this is right. Use the pencil to correct anything.</p>
              <dl className="grid gap-3 md:grid-cols-2">
                {summary.understanding.map((u) => (
                  <div key={u.key} className={`rounded-2xl p-4 ${u.key === "plan" ? "bg-[#f6f2fd] md:col-span-2" : "bg-slate-50"}`}>
                    <dt className="flex items-center text-xs font-bold uppercase tracking-wider text-[#6b4d9a]">{u.label}
                      {u.key !== "plan" && u.key !== "details" && editing !== u.key && <button aria-label={`Edit ${u.label}`} className="ml-auto text-slate-400 hover:text-[#6b4d9a]" onClick={() => { setEditing(u.key); setEditValue(u.value); }}><Pencil className="h-3.5 w-3.5" /></button>}
                    </dt>
                    {editing === u.key ? (
                      <dd className="mt-2 space-y-2">
                        <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:border-[#6b4d9a]" />
                        <div className="flex gap-3"><button className="rounded-full bg-[#6b4d9a] px-4 py-1.5 text-xs font-bold text-white" onClick={async () => { await saveEdit(u.key); await review(); }}>Save</button><button className="text-xs text-slate-500" onClick={() => setEditing(null)}>Cancel</button></div>
                      </dd>
                    ) : <dd className="mt-1 text-sm leading-relaxed text-slate-700">{u.value}</dd>}
                  </div>
                ))}
              </dl>
              {(summary.features.length > 0 || summary.integrations.length > 0) && (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-bold">Features and how they'll be covered</h3>
                    <ul className="space-y-1.5">{summary.features.map((f) => <li key={f.feature} className="flex gap-2 text-[13px]"><span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${f.supported ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{f.supported ? "Built in" : "Custom"}</span><span><b>{f.feature}.</b> <span className="text-slate-500">{f.note}</span></span></li>)}</ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-bold">Integrations</h3>
                    <ul className="space-y-1.5">{summary.integrations.map((f) => <li key={f.name} className="flex gap-2 text-[13px]"><span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${f.supported ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{f.supported ? "Built in" : "Manual"}</span><span><b>{f.name}.</b> <span className="text-slate-500">{f.note}</span></span></li>)}{summary.integrations.length === 0 && <li className="text-[13px] text-slate-500">None for now.</li>}</ul>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-extrabold">My recommendations</h2>
              <p className="mb-5 text-sm text-slate-500">{summary.ai_suggestions > 0 ? `Includes ${summary.ai_suggestions} suggestion${summary.ai_suggestions > 1 ? "s" : ""} from the AI analyst. ` : ""}Tick the pages you'd like me to add.</p>
              <ul className="space-y-2.5">
                {summary.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    {r.page ? (
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#6b4d9a]" aria-label={`Add ${r.page} page`} checked={extraPages.includes(r.page)} onChange={(e) => setExtraPages(e.target.checked ? [...extraPages, r.page!] : extraPages.filter((p) => p !== r.page))} />
                    ) : <span className="mt-1 h-4 w-4" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><b className="text-sm">{r.title}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY[r.priority]}`}>{r.priority}</span>{r.source === "ai" && <span className="rounded-full bg-[#f0e6fb] px-2 py-0.5 text-[10px] font-bold text-[#6b4d9a]">AI</span>}</div>
                      <p className="mt-0.5 text-[13px] text-slate-500">{r.why}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-extrabold">Acceptance criteria</h2>
              <p className="mb-5 text-sm text-slate-500">This is how we'll know the site is done. Tick items you already consider met, edit the list, or add your own. It becomes your project's checklist.</p>
              <div className="space-y-5">
                {grouped.map(([cat, items]) => (
                  <div key={cat}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#6b4d9a]">{cat}</h3>
                    <ul className="space-y-1.5">
                      {items.map((c) => (
                        <li key={c.id} className="flex items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
                          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#6b4d9a]" checked={c.done} onChange={(e) => setCriteria(criteria.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)))} aria-label={c.text} />
                          <span className={`flex-1 text-[13.5px] ${c.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{c.text}</span>
                          <button aria-label="Remove item" className="text-slate-300 hover:text-rose-500" onClick={() => setCriteria(criteria.filter((x) => x.id !== c.id))}><X className="h-3.5 w-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { setCriteria([...criteria, { id: `u${Date.now()}`, category: "Custom", text: custom.trim(), done: false }]); setCustom(""); } }}>
                <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own criterion…" className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#6b4d9a]" />
                <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50"><Plus className="h-4 w-4" /> Add</button>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-extrabold">Create your workspace</h2>
              <p className="mb-5 text-sm text-slate-500">I'll create the pages, save these requirements and the checklist, and write the project documentation with steps to start the frontend, backend and the whole project.</p>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm font-semibold">Project name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 font-normal outline-none focus:border-[#6b4d9a]" /></label>
                <label className="block text-sm font-semibold">Starting template
                  <select value={template} onChange={(e) => setTemplate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#6b4d9a]">
                    {(templates.length ? templates : [{ key: template, label: template }]).map((t) => <option key={t.key} value={t.key}>{t.label}{t.key === summary.recommended.template ? " (recommended)" : ""}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold">Visual style
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#6b4d9a]">
                    {preset?.spec && !PRESET_BY_ID[preset.spec.id] && <option value={preset.spec.id}>{preset.title} style</option>}
                    {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === summary.recommended.style ? " (recommended)" : ""}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setPhase("chat")} className="btn rounded-full px-5">Back</button>
                <button onClick={() => void create()} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6b4d9a] px-7 text-sm font-bold text-white shadow-[0_8px_24px_rgba(107,77,154,0.4)] hover:bg-[#5a3f86]"><Check className="h-4 w-4" /> Create workspace</button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
