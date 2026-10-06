"use client";

/*
 * FormWidget: a contact / booking / newsletter form that submits to the generated backend.
 * Portable (React only). Without `apiUrl` it validates and shows a success message only.
 */
import { useState } from "react";

type Kind = "contact" | "booking" | "subscription";

const FIELDS: Record<Kind, { name: string; label: string; type: string; required: boolean; textarea?: boolean }[]> = {
  contact: [
    { name: "name", label: "Your name", type: "text", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "message", label: "How can we help?", type: "text", required: true, textarea: true },
  ],
  booking: [
    { name: "name", label: "Your name", type: "text", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "time", label: "Time", type: "time", required: false },
    { name: "notes", label: "Notes", type: "text", required: false, textarea: true },
  ],
  subscription: [{ name: "email", label: "Your email", type: "email", required: true }],
};
const ENDPOINT: Record<Kind, string> = { contact: "/api/contact", booking: "/api/bookings", subscription: "/api/subscribers" };
const BUTTON: Record<Kind, string> = { contact: "Send message", booking: "Book now", subscription: "Subscribe" };

export default function FormWidget({ kind, heading, subheading, apiUrl }: { kind: Kind; heading?: string; subheading?: string; apiUrl?: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setMessage("");
    try {
      if (apiUrl) {
        const res = await fetch(`${apiUrl}${ENDPOINT[kind]}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: unknown; errors?: Record<string, string> };
          throw new Error(body.errors ? Object.entries(body.errors).map(([k, v]) => `${k}: ${v}`).join(", ") : typeof body.detail === "string" ? body.detail : "Please check the form and try again.");
        }
      }
      setState("ok");
      setValues({});
      setMessage(kind === "subscription" ? "You're subscribed. Thank you!" : kind === "booking" ? "Booking received. We'll confirm shortly." : "Thanks! We'll get back to you soon.");
    } catch (err) {
      setState("error");
      setMessage((err as Error).message);
    }
  }

  return (
    <section className="frm">
      {heading && <h2>{heading}</h2>}
      {subheading && <p className="frm-sub">{subheading}</p>}
      <form className="frm-card" onSubmit={submit}>
        {FIELDS[kind].map((f) =>
          f.textarea ? (
            <textarea key={f.name} className="shop-input" rows={3} required={f.required} placeholder={f.label} aria-label={f.label} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          ) : (
            <input key={f.name} className="shop-input" type={f.type} required={f.required} placeholder={f.label} aria-label={f.label} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          )
        )}
        <button type="submit" className="shop-add shop-add--lg" disabled={state === "busy"}>{state === "busy" ? "Sending…" : BUTTON[kind]}</button>
        {message && <p className={state === "ok" ? "shop-instock" : "shop-error"} role="status">{message}</p>}
      </form>
    </section>
  );
}
