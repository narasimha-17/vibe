"use client";

import { useEffect, useRef, useState } from "react";

type Variant = "widget" | "inline" | "ai" | "whatsapp" | "support" | "bubble";
interface Props {
  botName?: string;
  brand?: string;
  greeting?: string;
  placeholder?: string;
  fallback?: string;
  quickReplies?: string[];
  knowledge?: { q: string; a: string }[];
}
interface Msg { from: "bot" | "me"; text: string }

const STOP = new Set(["the", "and", "for", "you", "your", "with", "what", "how", "can", "are", "have", "this", "that", "about", "does", "please", "need"]);
const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9₹]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));

/** Tiny keyword matcher, the same idea the generated backend uses: the entry sharing the most words wins. */
export function answer(text: string, knowledge: { q: string; a: string }[], fallback: string) {
  const words = new Set(tokens(text));
  let best = { score: 0, a: fallback };
  for (const k of knowledge) {
    const score = tokens(k.q).filter((w) => words.has(w)).length;
    if (score > best.score) best = { score, a: k.a };
  }
  return best.a;
}

const HEAD: Record<Variant, string> = {
  widget: "cb-head",
  inline: "cb-head cb-head--flat",
  ai: "cb-head cb-head--ai",
  whatsapp: "cb-head cb-head--wa",
  support: "cb-head cb-head--support",
  bubble: "cb-head",
};

export function ChatbotWidget({ variant, p, apiUrl, dock }: { variant: Variant; p: Props; apiUrl?: string; dock?: boolean }) {
  const bot = p.botName || "Aria";
  const knowledge = p.knowledge || [];
  const fallback = p.fallback || "I'm not sure about that yet. A teammate will get back to you shortly.";
  const [open, setOpen] = useState(dock ? false : variant !== "bubble");
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: p.greeting || `Hi! I'm ${bot}. How can I help?` }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setMsgs([{ from: "bot", text: p.greeting || `Hi! I'm ${bot}. How can I help?` }]);
  }, [p.greeting, bot]);
  useEffect(() => {
    const el = end.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function send(text: string) {
    const t = text.trim();
    if (!t || typing) return;
    setMsgs((m) => [...m, { from: "me", text: t }]);
    setInput("");
    setTyping(true);
    if (apiUrl) {
      // connected mode: the generated backend answers (and logs) the conversation
      fetch(`${apiUrl}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t }) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("chat failed"))))
        .then((d: { reply: string }) => setMsgs((m) => [...m, { from: "bot", text: d.reply }]))
        .catch(() => setMsgs((m) => [...m, { from: "bot", text: "Sorry, I can't reach the server right now. Please try again in a moment." }]))
        .finally(() => setTyping(false));
      return;
    }
    timer.current = setTimeout(() => {
      setMsgs((m) => [...m, { from: "bot", text: answer(t, knowledge, fallback) }]);
      setTyping(false);
    }, 700);
  }

  const panel = (
    <div className={`cb-panel cb-panel--${variant}`} onClick={(e) => e.stopPropagation()}>
      <div className={HEAD[variant]}>
        <span className="cb-avatar">{bot[0]}</span>
        <div className="cb-title">
          <b>{variant === "support" ? `${p.brand || "Help"} Support` : bot}</b>
          <span><i className="cb-online" /> {variant === "ai" ? "AI assistant" : "Online now"}</span>
        </div>
        {variant !== "inline" && (
          <button type="button" className="cb-x" aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
        )}
      </div>
      <div className="cb-body" role="log" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`cb-msg cb-msg--${m.from}`}>{m.text}</div>
        ))}
        {typing && <div className="cb-msg cb-msg--bot cb-typing" aria-label="Typing"><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      {!!p.quickReplies?.length && (
        <div className={`cb-quick ${variant === "support" ? "cb-quick--list" : ""}`}>
          {p.quickReplies.map((q) => (
            <button type="button" key={q} onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      )}
      <form className="cb-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={p.placeholder || "Type your question…"} aria-label="Message" onKeyDown={(e) => e.stopPropagation()} />
        <button type="submit" aria-label="Send" disabled={!input.trim() || typing}>➤</button>
      </form>
      <div className="cb-foot">Powered by {p.brand || "VIBE"}</div>
    </div>
  );

  if (variant === "inline" || variant === "support" || variant === "ai") {
    return (
      <section className={`cb-sec cb-sec--${variant}`}>
        {variant !== "support" && (
          <div className="cb-copy">
            <span className="v-eyebrow">{variant === "ai" ? "AI assistant" : "Live chat"}</span>
            <h2>{variant === "ai" ? `Ask ${bot} anything` : "Got a question? Just ask."}</h2>
            <p>{variant === "ai" ? "Instant answers about the product, pricing and setup." : "Our assistant replies instantly, any time of day."}</p>
          </div>
        )}
        {variant === "support" && (
          <div className="cb-copy">
            <span className="v-eyebrow">Help center</span>
            <h2>How can we help?</h2>
            <p>Pick a topic or type your question. A person is one click away.</p>
            <button type="button" className="v-outline-btn">Talk to a human</button>
          </div>
        )}
        {panel}
      </section>
    );
  }

  if (dock) {
    // Site-wide floating chat: rendered once (layout), pinned bottom-right on every page.
    return (
      <div className={`cb-dock cb-dock--${variant}`}>
        {open && panel}
        <button type="button" className="cb-launcher" aria-label={open ? "Close chat" : "Open chat"} onClick={() => setOpen(!open)}>
          {open ? "×" : "💬"}
        </button>
        {!open && variant === "bubble" && <div className="cb-tip">{p.greeting || `Hi! I'm ${bot}.`}</div>}
      </div>
    );
  }

  return (
    <section className={`cb-sec cb-sec--stage cb-sec--${variant}`}>
      <div className="cb-page" aria-hidden="true"><i /><i /><i /><i /></div>
      {open && panel}
      <button type="button" className="cb-launcher" aria-label={open ? "Close chat" : "Open chat"} onClick={() => setOpen(!open)}>
        {open ? "×" : "💬"}
      </button>
      {!open && variant === "bubble" && <div className="cb-tip">{p.greeting || `Hi! I'm ${bot}.`}</div>}
    </section>
  );
}
