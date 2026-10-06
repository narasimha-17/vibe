"use client";

/*
 * ShopWidget: browse, filter, view a product with reviews, keep a cart and pay with Razorpay.
 * Portable: only depends on React. Pass `apiUrl` to talk to the generated backend, or leave it
 * empty to run in preview mode with the built-in demo products (checkout is simulated).
 * Canonical copy lives in apps/api/app/codegen/templates; apps/web/components/shop has an identical copy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface Product {
  id: number;
  name: string;
  price: number;
  description?: string;
  image?: string;
  category?: string;
  stock?: number;
  rating?: number;
  reviews_count?: number;
}
interface CartLine { id: number; name: string; price: number; image?: string; qty: number }
interface Review { id: number; author: string; rating: number; comment: string }
interface Confirmation { number: string; total: number; demo: boolean }

const CART_KEY = "vibe.cart";
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const stars = (n: number) => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

/** Cart shared by every widget on the page (persists in localStorage). */
function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    setLines(readCart());
    const sync = () => setLines(readCart());
    window.addEventListener("vibe-cart", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vibe-cart", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const save = useCallback((next: CartLine[]) => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep in memory only */
    }
    setLines(next);
    window.dispatchEvent(new Event("vibe-cart"));
  }, []);
  const add = (p: Product, qty = 1) => {
    const cur = readCart();
    const hit = cur.find((l) => l.id === p.id);
    const max = p.stock ?? 99;
    if (hit) hit.qty = Math.min(max, hit.qty + qty);
    else cur.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: Math.min(max, qty) });
    save(cur);
  };
  const setQty = (id: number, qty: number) => save(readCart().flatMap((l) => (l.id !== id ? [l] : qty > 0 ? [{ ...l, qty }] : [])));
  const clear = () => save([]);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.qty * l.price, 0);
  return { lines, add, setQty, clear, count, subtotal };
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string; error?: string }).detail || (data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const DEMO_REVIEWS: Review[] = [
  { id: 1, author: "Asha", rating: 5, comment: "Exactly as described. Lovely quality." },
  { id: 2, author: "Rohan", rating: 4, comment: "Great value, quick delivery." },
];

export default function ShopWidget({ heading = "Shop", products: demo = [], apiUrl, layout = "sidebar", hideCart = false }: { heading?: string; products?: Product[]; apiUrl?: string; layout?: "sidebar" | "top"; hideCart?: boolean }) {
  const live = Boolean(apiUrl);
  const cart = useCart();
  const [items, setItems] = useState<Product[]>(demo);
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [sort, setSort] = useState("newest");
  const [inStock, setInStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Product | null>(null);
  const [drawer, setDrawer] = useState(false);
  // A cart icon elsewhere on the page (for example in the navbar) opens the same cart.
  useEffect(() => {
    const open = () => { setDrawer(true); setStep("cart"); };
    window.addEventListener("vibe:open-cart", open);
    return () => window.removeEventListener("vibe:open-cart", open);
  }, []);
  const [step, setStep] = useState<"cart" | "details" | "done">("cart");
  const [done, setDone] = useState<Confirmation | null>(null);

  // categories
  useEffect(() => {
    if (live) {
      call<string[]>(`${apiUrl}/api/products/categories`).then(setCategories).catch(() => setCategories([]));
    } else {
      setCategories(Array.from(new Set(demo.map((p) => p.category || "").filter(Boolean))));
    }
  }, [live, apiUrl, demo]);

  // products (filters run on the server in live mode)
  useEffect(() => {
    if (!live) {
      let list = demo.filter((p) => (!q || `${p.name} ${p.description || ""}`.toLowerCase().includes(q.toLowerCase())) && (!category || p.category === category) && (!minP || p.price >= Number(minP)) && (!maxP || p.price <= Number(maxP)) && (!inStock || (p.stock ?? 1) > 0));
      list = [...list].sort((a, b) => (sort === "price_asc" ? a.price - b.price : sort === "price_desc" ? b.price - a.price : sort === "rating" ? (b.rating ?? 0) - (a.rating ?? 0) : b.id - a.id));
      setItems(list);
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (minP) params.set("min_price", minP);
      if (maxP) params.set("max_price", maxP);
      if (inStock) params.set("in_stock", "true");
      params.set("sort", sort);
      setLoading(true);
      setError("");
      call<Product[]>(`${apiUrl}/api/products?${params.toString()}`)
        .then(setItems)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [live, apiUrl, demo, q, category, minP, maxP, sort, inStock]);

  const filters = (
    <aside className="shop-filters" aria-label="Filters">
      <input className="shop-input" placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="shop-filter-group">
        <b>Category</b>
        <button type="button" className={`shop-chip ${category === "" ? "is-on" : ""}`} onClick={() => setCategory("")}>All</button>
        {categories.map((c) => (
          <button type="button" key={c} className={`shop-chip ${category === c ? "is-on" : ""}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>
      <div className="shop-filter-group">
        <b>Price (₹)</b>
        <div className="shop-range">
          <input className="shop-input" inputMode="numeric" placeholder="Min" aria-label="Minimum price" value={minP} onChange={(e) => setMinP(e.target.value.replace(/\D/g, ""))} />
          <input className="shop-input" inputMode="numeric" placeholder="Max" aria-label="Maximum price" value={maxP} onChange={(e) => setMaxP(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      <label className="shop-check"><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /> In stock only</label>
      <div className="shop-filter-group">
        <b>Sort by</b>
        <select className="shop-input" aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
      </div>
    </aside>
  );

  return (
    <section className={`shop shop--${layout}`} data-live={live ? "true" : "false"}>
      <div className="shop-head">
        <h2>{heading}</h2>
        {!hideCart && (
          <button type="button" className="shop-cart-btn" onClick={() => { setDrawer(true); setStep("cart"); }} aria-label={`Open cart, ${cart.count} items`}>
            Cart <span className="shop-badge">{cart.count}</span>
          </button>
        )}
      </div>
      {!live && <p className="shop-note">Preview mode: sample products. Connect the backend to use real data and payments.</p>}
      <div className="shop-layout">
        {filters}
        <div className="shop-main">
          {error && <p className="shop-error" role="alert">{error}</p>}
          {loading && <p className="shop-muted">Loading…</p>}
          {!loading && items.length === 0 && <p className="shop-muted">No products match your filters.</p>}
          <div className="shop-grid">
            {items.map((p) => (
              <article key={p.id} className="shop-card">
                <button type="button" className="shop-card-media" onClick={() => setOpen(p)} aria-label={`View ${p.name}`}>
                  {p.image ? <img src={p.image} alt={p.name} /> : <span className="shop-ph" style={{ background: `linear-gradient(135deg, hsl(${(p.id * 67) % 360} 70% 55%), hsl(${(p.id * 67 + 40) % 360} 70% 35%))` }} />}
                  {(p.stock ?? 1) <= 0 && <span className="shop-sold">Sold out</span>}
                </button>
                <div className="shop-card-body">
                  {p.category && <span className="shop-cat">{p.category}</span>}
                  <b>{p.name}</b>
                  <span className="shop-stars" aria-label={`Rated ${p.rating ?? 0} out of 5`}>{stars(p.rating ?? 0)} <em>({p.reviews_count ?? 0})</em></span>
                  <div className="shop-buy">
                    <strong>{money(p.price)}</strong>
                    <button type="button" className="shop-add" disabled={(p.stock ?? 1) <= 0} onClick={() => { cart.add(p); setDrawer(true); setStep("cart"); }}>Add to cart</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {open && <ProductModal product={open} apiUrl={apiUrl} onClose={() => setOpen(null)} onAdd={(qty) => { cart.add(open, qty); setOpen(null); setDrawer(true); setStep("cart"); }} />}
      {drawer && (
        <CartDrawer
          cart={cart} apiUrl={apiUrl} step={step} setStep={setStep} done={done}
          onDone={(c) => { setDone(c); setStep("done"); cart.clear(); }}
          onClose={() => setDrawer(false)}
        />
      )}
    </section>
  );
}

function ProductModal({ product, apiUrl, onClose, onAdd }: { product: Product; apiUrl?: string; onClose: () => void; onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState<Review[]>(apiUrl ? [] : DEMO_REVIEWS);
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const stock = product.stock ?? 99;

  useEffect(() => {
    if (apiUrl) call<Review[]>(`${apiUrl}/api/products/${product.id}/reviews`).then(setReviews).catch(() => setReviews([]));
  }, [apiUrl, product.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      if (apiUrl) {
        const r = await call<Review>(`${apiUrl}/api/products/${product.id}/reviews`, { method: "POST", body: JSON.stringify({ author, rating, comment }) });
        setReviews((list) => [r, ...list]);
      } else {
        setReviews((list) => [{ id: Date.now(), author, rating, comment }, ...list]);
      }
      setAuthor("");
      setComment("");
      setMsg("Thanks for your review!");
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const avg = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;
  return (
    <div className="shop-overlay" role="dialog" aria-modal="true" aria-label={product.name} onClick={onClose}>
      <div className="shop-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="shop-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="shop-modal-media">{product.image ? <img src={product.image} alt={product.name} /> : <span className="shop-ph" style={{ background: `linear-gradient(135deg, hsl(${(product.id * 67) % 360} 70% 55%), hsl(${(product.id * 67 + 40) % 360} 70% 35%))` }} />}</div>
        <div className="shop-modal-info">
          {product.category && <span className="shop-cat">{product.category}</span>}
          <h3>{product.name}</h3>
          <div className="shop-stars">{stars(avg)} <em>{reviews.length ? `${avg.toFixed(1)} (${reviews.length} reviews)` : "No reviews yet"}</em></div>
          <strong className="shop-price">{money(product.price)}</strong>
          <p>{product.description}</p>
          <p className={stock > 0 ? "shop-instock" : "shop-error"}>{stock > 0 ? `${stock} in stock` : "Sold out"}</p>
          <div className="shop-qty">
            <button type="button" aria-label="Decrease" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span>{qty}</span>
            <button type="button" aria-label="Increase" onClick={() => setQty(Math.min(stock, qty + 1))}>+</button>
            <button type="button" className="shop-add shop-add--lg" disabled={stock <= 0} onClick={() => onAdd(qty)}>Add to cart</button>
          </div>
          <h4>Customer reviews</h4>
          <form className="shop-review-form" onSubmit={submit}>
            <input className="shop-input" placeholder="Your name" aria-label="Your name" required value={author} onChange={(e) => setAuthor(e.target.value)} />
            <select className="shop-input" aria-label="Rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
            </select>
            <textarea className="shop-input" placeholder="Share your experience" aria-label="Your review" required rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            <button type="submit" className="shop-add">Post review</button>
            {msg && <span className="shop-muted">{msg}</span>}
          </form>
          <ul className="shop-reviews">
            {reviews.map((r) => (
              <li key={r.id}><span className="shop-stars">{stars(r.rating)}</span> <b>{r.author}</b><p>{r.comment}</p></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ cart, apiUrl, step, setStep, done, onDone, onClose }: { cart: ReturnType<typeof useCart>; apiUrl?: string; step: "cart" | "details" | "done"; setStep: (s: "cart" | "details" | "done") => void; done: Confirmation | null; onDone: (c: Confirmation) => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", line1: "", city: "", state: "", pincode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => panel.current?.focus(), [step]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!apiUrl) {
        await new Promise((r) => setTimeout(r, 600));
        onDone({ number: `DEMO-${Math.floor(100000 + Math.random() * 900000)}`, total: cart.subtotal, demo: true });
        return;
      }
      const order = await call<{ order_number: string; total: number; razorpay: { order_id: string; key_id: string; amount: number; currency: string; mode: string } }>(`${apiUrl}/api/orders`, {
        method: "POST",
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone },
          address: { line1: form.line1, city: form.city, state: form.state, pincode: form.pincode },
          items: cart.lines.map((l) => ({ product_id: l.id, qty: l.qty })),
        }),
      });
      const verify = (payment_id: string, signature: string) =>
        call<{ status: string }>(`${apiUrl}/api/payments/razorpay/verify`, {
          method: "POST",
          body: JSON.stringify({ order_number: order.order_number, razorpay_order_id: order.razorpay.order_id, razorpay_payment_id: payment_id, razorpay_signature: signature }),
        }).then(() => onDone({ number: order.order_number, total: order.total, demo: false }));

      if (order.razorpay.mode === "mock") {
        // No Razorpay keys on the server: complete the flow with the test signature so the whole path can be exercised.
        const sig = await call<{ signature: string; payment_id: string }>(`${apiUrl}/api/payments/razorpay/mock-sign?order_id=${order.razorpay.order_id}`);
        await verify(sig.payment_id, sig.signature);
        return;
      }
      if (!(await loadRazorpay())) throw new Error("Could not load Razorpay. Check your connection.");
      const Rzp = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void } }).Razorpay;
      const rzp = new Rzp({
        key: order.razorpay.key_id,
        amount: order.razorpay.amount,
        currency: order.razorpay.currency,
        order_id: order.razorpay.order_id,
        name: "Checkout",
        prefill: { name: form.name, email: form.email, contact: form.phone },
        handler: (r: { razorpay_payment_id: string; razorpay_signature: string }) => {
          verify(r.razorpay_payment_id, r.razorpay_signature).catch((err: Error) => setError(err.message));
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", () => setError("Payment failed. You were not charged. Please try again."));
      rzp.open();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shop-overlay shop-overlay--right" role="dialog" aria-modal="true" aria-label="Shopping cart" onClick={onClose}>
      <div className="shop-drawer" ref={panel} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="shop-drawer-head">
          <h3>{step === "cart" ? "Your cart" : step === "details" ? "Checkout" : "Order placed"}</h3>
          <button type="button" className="shop-close" aria-label="Close cart" onClick={onClose}>×</button>
        </div>

        {step === "cart" && (
          <>
            {cart.lines.length === 0 ? <p className="shop-muted">Your cart is empty.</p> : (
              <ul className="shop-lines">
                {cart.lines.map((l) => (
                  <li key={l.id}>
                    <div className="shop-line-media">{l.image ? <img src={l.image} alt="" /> : <span className="shop-ph" style={{ background: `hsl(${(l.id * 67) % 360} 65% 50%)` }} />}</div>
                    <div className="shop-line-info"><b>{l.name}</b><span>{money(l.price)}</span></div>
                    <div className="shop-qty shop-qty--sm">
                      <button type="button" aria-label={`Decrease ${l.name}`} onClick={() => cart.setQty(l.id, l.qty - 1)}>−</button>
                      <span>{l.qty}</span>
                      <button type="button" aria-label={`Increase ${l.name}`} onClick={() => cart.setQty(l.id, l.qty + 1)}>+</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="shop-total"><span>Subtotal</span><strong>{money(cart.subtotal)}</strong></div>
            <p className="shop-muted">Shipping and final total are calculated at checkout.</p>
            <button type="button" className="shop-add shop-add--lg shop-add--block" disabled={cart.lines.length === 0} onClick={() => setStep("details")}>Checkout</button>
          </>
        )}

        {step === "details" && (
          <form className="shop-checkout" onSubmit={pay}>
            <input className="shop-input" required placeholder="Full name" aria-label="Full name" value={form.name} onChange={set("name")} />
            <input className="shop-input" required type="email" placeholder="Email" aria-label="Email" value={form.email} onChange={set("email")} />
            <input className="shop-input" required placeholder="Phone" aria-label="Phone" value={form.phone} onChange={set("phone")} />
            <input className="shop-input" required placeholder="Address" aria-label="Address" value={form.line1} onChange={set("line1")} />
            <div className="shop-range">
              <input className="shop-input" required placeholder="City" aria-label="City" value={form.city} onChange={set("city")} />
              <input className="shop-input" required placeholder="State" aria-label="State" value={form.state} onChange={set("state")} />
            </div>
            <input className="shop-input" required inputMode="numeric" pattern="[0-9]{6}" placeholder="PIN code" aria-label="PIN code" value={form.pincode} onChange={set("pincode")} />
            <div className="shop-total"><span>Items ({cart.count})</span><strong>{money(cart.subtotal)}</strong></div>
            {error && <p className="shop-error" role="alert">{error}</p>}
            <button type="submit" className="shop-add shop-add--lg shop-add--block" disabled={busy}>{busy ? "Processing…" : apiUrl ? "Pay securely with Razorpay" : "Place demo order"}</button>
            <button type="button" className="shop-link" onClick={() => setStep("cart")}>Back to cart</button>
          </form>
        )}

        {step === "done" && done && (
          <div className="shop-done">
            <span className="shop-tick">✓</span>
            <h4>Thank you for your order!</h4>
            <p>Your order number is <b>{done.number}</b>. {done.demo ? "This was a preview, so no payment was taken." : `We received ${money(done.total)}. Use your order number and email to track it.`}</p>
            <button type="button" className="shop-add shop-add--lg" onClick={onClose}>Continue shopping</button>
          </div>
        )}
      </div>
    </div>
  );
}
