"use client";

/*
 * TrackingWidget: customers look up an order by number + email and see its progress.
 * Portable (React only). Pass `apiUrl` for live data; without it a demo order is shown.
 */
import { useState } from "react";

interface OrderView {
  number: string;
  status: string;
  total: number;
  created_at?: string;
  items: { name: string; qty: number; price: number }[];
  events: { status: string; note?: string; created_at?: string }[];
}

const STEPS: { key: string; label: string }[] = [
  { key: "placed", label: "Order placed" },
  { key: "paid", label: "Payment received" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const DEMO: OrderView = {
  number: "DEMO-123456",
  status: "shipped",
  total: 2498,
  items: [{ name: "Everyday Tote", qty: 1, price: 1999 }, { name: "Field Notes", qty: 1, price: 499 }],
  events: [
    { status: "placed", note: "We received your order" },
    { status: "paid", note: "Payment confirmed" },
    { status: "packed", note: "Packed at our warehouse" },
    { status: "shipped", note: "Handed to the courier" },
  ],
};

export default function TrackingWidget({ heading = "Track your order", apiUrl }: { heading?: string; apiUrl?: string }) {
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    if (!apiUrl) {
      setOrder({ ...DEMO, number: number || DEMO.number });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiUrl}/api/orders/${encodeURIComponent(number.trim())}?email=${encodeURIComponent(email.trim())}`);
      if (!res.ok) throw new Error(res.status === 404 ? "We couldn't find an order with those details." : "Something went wrong. Please try again.");
      setOrder((await res.json()) as OrderView);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reached = order ? new Set(order.events.map((ev) => ev.status)) : new Set<string>();
  const cancelled = order?.status === "cancelled";
  const currentIndex = order ? Math.max(...STEPS.map((s, i) => (reached.has(s.key) ? i : -1))) : -1;

  return (
    <section className="trk">
      <h2>{heading}</h2>
      <p className="trk-sub">Enter the order number from your confirmation and the email you used at checkout.</p>
      {!apiUrl && <p className="shop-note">Preview mode: shows a sample order.</p>}
      <form className="trk-form" onSubmit={lookup}>
        <input className="shop-input" required placeholder="Order number (e.g. ORD-AB12CD)" aria-label="Order number" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className="shop-input" required={Boolean(apiUrl)} type="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="shop-add shop-add--lg" disabled={busy}>{busy ? "Looking up…" : "Track order"}</button>
      </form>
      {error && <p className="shop-error" role="alert">{error}</p>}
      {order && (
        <div className="trk-card">
          <div className="trk-top"><b>{order.number}</b><span className={`trk-pill ${cancelled ? "is-bad" : ""}`}>{cancelled ? "Cancelled" : order.status.replace("_", " ")}</span></div>
          {!cancelled && (
            <ol className="trk-steps">
              {STEPS.map((s, i) => {
                const ev = order.events.find((x) => x.status === s.key);
                return (
                  <li key={s.key} className={`${i <= currentIndex ? "is-done" : ""} ${i === currentIndex ? "is-now" : ""}`}>
                    <span className="trk-dot">{i <= currentIndex ? "✓" : i + 1}</span>
                    <div><b>{s.label}</b>{ev?.note && <span>{ev.note}</span>}</div>
                  </li>
                );
              })}
            </ol>
          )}
          <ul className="trk-items">
            {order.items.map((it, i) => <li key={i}><span>{it.qty} × {it.name}</span><b>{money(it.price * it.qty)}</b></li>)}
          </ul>
          <div className="shop-total"><span>Total</span><strong>{money(order.total)}</strong></div>
        </div>
      )}
    </section>
  );
}
