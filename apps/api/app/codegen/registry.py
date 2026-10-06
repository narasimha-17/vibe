"""Deterministic markup generators, keyed by (component type, variant).

Each generator takes `(props, theme, attr)` and returns a markup string.
`attr` is `"className"` when emitting JSX (Next.js/React) or `"class"`
when emitting plain HTML — the two are otherwise close enough for these
presentational components to share one generator per variant, which is
what keeps this deterministic engine (rather than an LLM) able to emit
both targets from the same source of truth.

This mirrors (independently — see the plan's note on why it's decoupled)
`apps/web/lib/registry/*` on the frontend: same `type`/`variant` keys,
same default props, so a project built in the editor maps predictably to
generated files.
"""

import json
from collections.abc import Callable

Generator = Callable[[dict, dict, str], str]


def _list_items(items: list[dict], key: str, fallback: str = "") -> list[str]:
    return [str(i.get(key, fallback)) for i in items] if items else []


def _brand(p: dict, attr: str) -> str:
    """The uploaded logo image when set (Design step / Inspector), else the brand name as text."""
    logo = p.get("logoUrl")
    brand = p.get("brand", "Brand")
    if logo:
        return f'<img {attr}="navbar__logo" src="{logo}" alt="{brand}" />'
    return f'<div {attr}="navbar__brand">{brand}</div>'


def _login(p: dict, attr: str) -> str:
    label = p.get("loginLabel")
    return f'<button {attr}="navbar__login">{label}</button>\n  ' if label else ""


# ── Navbar ────────────────────────────────────────────────────────
def _nav_links(p: dict, links: list) -> str:
    """Links that scroll to their section (see anchors.py); the engine passes each page's targets in `_hrefs`."""
    hrefs = p.get("_hrefs") or {}
    return "\n      ".join(f'<a href="{hrefs[str(link)]}">{link}</a>' if str(link) in hrefs else f"<span>{link}</span>" for link in links)


def navbar_default(p: dict, theme: dict, attr: str) -> str:
    links = p.get("links", ["Home", "About", "Contact"])
    link_items = _nav_links(p, links)
    return f"""<nav {attr}="navbar navbar--default">
  {_brand(p, attr)}
  <div {attr}="navbar__links">
      {link_items}
  </div>
  {_login(p, attr)}<button {attr}="navbar__cta">{p.get("ctaLabel", "Get Started")}</button>
</nav>"""


def navbar_dark(p: dict, theme: dict, attr: str) -> str:
    return navbar_default(p, theme, attr).replace("navbar--default", "navbar--dark")


def navbar_minimal(p: dict, theme: dict, attr: str) -> str:
    links = p.get("links", ["Home", "About", "Contact"])
    link_items = _nav_links(p, links)
    return f"""<nav {attr}="navbar navbar--minimal">
  {_brand(p, attr)}
  <div {attr}="navbar__links">
      {link_items}
  </div>
</nav>"""


def navbar_megabar(p: dict, theme: dict, attr: str) -> str:
    links = p.get("links", ["Home", "About", "Contact"])
    link_items = _nav_links(p, links)
    return f"""<nav {attr}="navbar navbar--megabar">
  <div {attr}="navbar__announcement">New: {p.get("announcement", "Build faster with VIBE")}</div>
  <div {attr}="navbar__main">
    {_brand(p, attr)}
    <div {attr}="navbar__links">
      {link_items}
    </div>
    {_login(p, attr)}<button {attr}="navbar__cta">{p.get("cta", "Get Started")}</button>
  </div>
</nav>"""


# ── Hero ──────────────────────────────────────────────────────────
def hero_split(p: dict, theme: dict, attr: str) -> str:
    return f"""<section {attr}="hero hero--split">
  <div {attr}="hero__content">
    <h1>{p.get("headline", "Build something remarkable.")}</h1>
    <p>{p.get("subheadline", "")}</p>
    <div {attr}="hero__actions">
      <button {attr}="btn btn--primary">{p.get("primaryCta", "Get Started")}</button>
      <button {attr}="btn btn--secondary">{p.get("secondaryCta", "Learn More")}</button>
    </div>
  </div>
  <div {attr}="hero__visual"></div>
</section>"""


def hero_centered(p: dict, theme: dict, attr: str) -> str:
    return f"""<section {attr}="hero hero--centered">
  <h1>{p.get("headline", "Build something remarkable.")}</h1>
  <p>{p.get("subheadline", "")}</p>
  <div {attr}="hero__actions">
    <button {attr}="btn btn--primary">{p.get("primaryCta", "Get Started")}</button>
    <button {attr}="btn btn--secondary">{p.get("secondaryCta", "Learn More")}</button>
  </div>
</section>"""


# ── Features ──────────────────────────────────────────────────────
def features_grid(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [])
    cards = "\n    ".join(
        f'<div {attr}="card"><h3>{i.get("title", "")}</h3><p>{i.get("text", "")}</p></div>' for i in items
    )
    return f"""<section {attr}="features features--grid">
  <div {attr}="features__heading">
    <h2>{p.get("heading", "Everything you need.")}</h2>
    <p>{p.get("subheading", "")}</p>
  </div>
  <div {attr}="features__grid">
    {cards}
  </div>
</section>"""


def features_list(p: dict, theme: dict, attr: str) -> str:
    return features_grid(p, theme, attr).replace("features--grid", "features--list")


# ── Cards ─────────────────────────────────────────────────────────
def cards_simple(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [])
    cards = "\n    ".join(
        f'<div {attr}="card"><h3>{i.get("title", "")}</h3><p>{i.get("text", "")}</p></div>' for i in items
    )
    return f'<section {attr}="cards cards--simple">\n    {cards}\n</section>'


def cards_numbered(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [])
    cards = "\n    ".join(
        f'<div {attr}="card card--numbered"><span {attr}="card__number">{idx + 1}</span>'
        f'<h3>{i.get("title", "")}</h3><p>{i.get("text", "")}</p></div>'
        for idx, i in enumerate(items)
    )
    return f'<section {attr}="cards cards--numbered">\n    {cards}\n</section>'


 # ── Catalog ──────────────────────────────────────────────────────
def catalog_grid(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [])
    cards = "\n    ".join(
      f'<article {attr}="catalog__item"><div {attr}="catalog__image" style="background-image:url({i.get("image", "")})"></div>'
      f'<div {attr}="catalog__body"><div><h3>{i.get("name", "Product")}</h3><strong>{i.get("price", "")}</strong></div>'
      f'<p>{i.get("description", "")}</p><button>View product</button></div></article>' for i in items
    )
    return f'<section {attr}="catalog catalog--grid"><div {attr}="catalog__heading"><h2>{p.get("heading", "Featured products")}</h2><p>{p.get("subheading", "")}</p></div><div {attr}="catalog__grid">{cards}</div></section>'


def catalog_editorial(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [])
    rows = "\n    ".join(
      f'<article {attr}="catalog__row"><div {attr}="catalog__image" style="background-image:url({i.get("image", "")})"></div>'
      f'<div {attr}="catalog__body"><h3>{i.get("name", "Product")}</h3><p>{i.get("description", "")}</p></div>'
      f'<strong>{i.get("price", "")}</strong><button>View</button></article>' for i in items
    )
    return f'<section {attr}="catalog catalog--editorial"><div {attr}="catalog__heading"><h2>{p.get("heading", "Featured products")}</h2><p>{p.get("subheading", "")}</p></div>{rows}</section>'


# ── Pricing ───────────────────────────────────────────────────────
def _split_price(price: str) -> tuple[str, str]:
    price = str(price or "")
    i = 0
    while i < len(price) and not price[i].isdigit():
        i += 1
    return price[:i].strip(), price[i:]


def _store_art(attr: str) -> str:
    sw = "strokeWidth" if attr == "className" else "stroke-width"
    cap = "strokeLinecap" if attr == "className" else "stroke-linecap"
    join = "strokeLinejoin" if attr == "className" else "stroke-linejoin"
    fo = "fillOpacity" if attr == "className" else "fill-opacity"
    return (
        f'<svg {attr}="price__art" viewBox="0 0 120 80" width="110" height="74" fill="none" stroke="currentColor" '
        f'{sw}="2" {cap}="round" {join}="round" aria-hidden="true">'
        f'<path d="M28 32 L34 16 H86 L92 32 Z" fill="currentColor" {fo}="0.25" />'
        f'<path d="M28 32 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0" fill="currentColor" {fo}="0.35" />'
        '<rect x="32" y="42" width="56" height="28" /><rect x="54" y="50" width="12" height="20" />'
        '<rect x="38" y="48" width="12" height="10" /><rect x="70" y="48" width="12" height="10" />'
        '<path d="M18 70 H102" /></svg>'
    )


def pricing_tiered(p: dict, theme: dict, attr: str) -> str:
    tier_html = []
    for t in p.get("tiers", []):
        featured = bool(t.get("featured"))
        cls = "price price--featured" if featured else "price"
        symbol, amount = _split_price(t.get("price", ""))
        features = "".join(f"<li>{f}</li>" for f in t.get("features", []))
        ribbon = f'<div {attr}="price__ribbon"><span>{t.get("ribbon", "Popular")}</span></div>' if featured else ""
        badge = f'<div {attr}="price__badge">{t["badge"]}</div>' if t.get("badge") else ""
        currency = f'<span {attr}="price__currency">{symbol}</span>' if symbol else ""
        unit = f'<span {attr}="price__unit">{t["unit"]}</span>' if t.get("unit") else ""
        button = t.get("button") or (f'Choose {t.get("name", "")}' if featured else "Get started")
        tier_html.append(
            f'<div {attr}="{cls}">{ribbon}{badge}{_store_art(attr)}<h3>{t.get("name", "")}</h3>'
            f"<ul>{features}</ul>"
            f'<div {attr}="price__amount">{currency}<strong {attr}="price__num">{amount}</strong>{unit}</div>'
            f'<button {attr}="price__btn">{button}</button></div>'
        )
    return f"""<section {attr}="pricing pricing--showcase">
  <div {attr}="pricing__heading"><h2>{p.get("heading", "Plans for everyone.")}</h2></div>
  <div {attr}="pricing__grid">
    {"".join(tier_html)}
  </div>
</section>"""


def pricing_simple(p: dict, theme: dict, attr: str) -> str:
    tiers = p.get("tiers", [])[:1]
    tier_html = []
    for t in tiers:
        features = "\n        ".join(f"<li>{f}</li>" for f in t.get("features", []))
        tier_html.append(
            f'<div {attr}="price price--featured"><h3>{t.get("name", "")}</h3><strong>{t.get("price", "")}</strong>'
            f'<ul>\n        {features}\n      </ul></div>'
        )
    return f"""<section {attr}="pricing pricing--simple">
  <div {attr}="pricing__heading"><h2>{p.get("heading", "Plans for everyone.")}</h2></div>
  <div {attr}="pricing__grid">
    {"".join(tier_html)}
  </div>
</section>"""


# ── Footer ────────────────────────────────────────────────────────
def footer_simple(p: dict, theme: dict, attr: str) -> str:
    return f"""<footer {attr}="footer footer--simple">
  <span>{p.get("left", "© 2026 Your Brand")}</span>
  <span>{p.get("right", "Privacy · Terms · Contact")}</span>
</footer>"""


def footer_columns(p: dict, theme: dict, attr: str) -> str:
    brand = p.get("brand", "Brand")
    return f"""<footer {attr}="footer footer--columns">
  <div {attr}="footer__cols">
    <div><strong>Product</strong><span>Features</span><span>Pricing</span></div>
    <div><strong>Company</strong><span>About</span><span>Careers</span></div>
    <div><strong>Legal</strong><span>Privacy</span><span>Terms</span></div>
  </div>
  <span>© 2026 {brand}</span>
</footer>"""


# ── Forms ─────────────────────────────────────────────────────────
def forms_contact(p: dict, theme: dict, attr: str) -> str:
    return f"""<section {attr}="formsec">
  <div {attr}="formsec__heading">
    <h2>{p.get("heading", "Get in touch.")}</h2>
    <p>{p.get("subheading", "We would love to hear from you.")}</p>
  </div>
  <form {attr}="form-card">
    <div {attr}="form-field"><label>Name</label><input {attr}="form-input" type="text" /></div>
    <div {attr}="form-field"><label>Email</label><input {attr}="form-input" type="email" /></div>
    <div {attr}="form-field"><label>Message</label><textarea {attr}="form-input form-textarea"></textarea></div>
    <button {attr}="form-submit" type="submit">Send Message</button>
  </form>
</section>"""


def forms_booking(p: dict, theme: dict, attr: str) -> str:
    return f"""<section {attr}="formsec">
  <div {attr}="formsec__heading">
    <h2>{p.get("heading", "Book an appointment.")}</h2>
    <p>{p.get("subheading", "Pick a date and time that works for you.")}</p>
  </div>
  <form {attr}="form-card">
    <div {attr}="form-field"><label>Date</label><input {attr}="form-input" type="text" /></div>
    <div {attr}="form-field"><label>Full Name</label><input {attr}="form-input" type="text" /></div>
    <div {attr}="form-field"><label>Email</label><input {attr}="form-input" type="email" /></div>
    <button {attr}="form-submit" type="submit">Book Now</button>
  </form>
</section>"""


def forms_subscription(p: dict, theme: dict, attr: str) -> str:
    return f"""<section {attr}="formsec formsec--inline">
  <div {attr}="formsec__heading">
    <h2>{p.get("heading", "Stay updated.")}</h2>
    <p>{p.get("subheading", "Get the latest news straight to your inbox.")}</p>
  </div>
  <form {attr}="form-card">
    <input {attr}="form-input" type="email" placeholder="you@example.com" />
    <button {attr}="form-submit" type="submit">Subscribe</button>
  </form>
</section>"""


# ── Testimonials ──────────────────────────────────────────────────
def testimonials_default(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [])
    cards = "\n    ".join(
        f'<div {attr}="testimonial"><p>"{i.get("quote", "")}"</p>'
        f'<div {attr}="testimonial__author"><strong>{i.get("name", "")}</strong>'
        f'<span>{i.get("role", "")}</span></div></div>'
        for i in items
    )
    return f"""<section {attr}="features">
  <div {attr}="features__heading"><h2>{p.get("heading", "Loved by teams everywhere.")}</h2></div>
  <div {attr}="features__grid">
    {cards}
  </div>
</section>"""


# ── CTA ───────────────────────────────────────────────────────────
def cta_default(p: dict, theme: dict, attr: str) -> str:
    return f"""<section {attr}="cta">
  <h2>{p.get("heading", "Ready to get started?")}</h2>
  <p>{p.get("subheading", "Join thousands of teams already building with us.")}</p>
  <button {attr}="btn btn--light">{p.get("button", "Get Started Free")}</button>
</section>"""


# ── Timeline ──────────────────────────────────────────────────────
def timeline_default(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [{"date": "2024", "title": "Milestone", "text": "What happened."}])
    entries = "\n    ".join(
        f'<li {attr}="timeline__item"><span {attr}="timeline__dot"></span>'
        f'<span {attr}="timeline__date">{i.get("date", "")}</span>'
        f'<h3>{i.get("title", "")}</h3><p>{i.get("text", "")}</p></li>'
        for i in items
    )
    return f"""<section {attr}="timeline">
  <h2>{p.get("heading", "Our journey")}</h2>
  <ol {attr}="timeline__list">
    {entries}
  </ol>
</section>"""


# ── Social & contact ──────────────────────────────────────────────
_SOCIAL_HREF = {
    "whatsapp": lambda v: "https://wa.me/" + "".join(c for c in v if c.isdigit()),
    "instagram": lambda v: "https://instagram.com/" + v.lstrip("@"),
    "facebook": lambda v: "https://facebook.com/" + v,
    "messenger": lambda v: "https://m.me/" + v,
    "x": lambda v: "https://x.com/" + v.lstrip("@"),
    "youtube": lambda v: "https://youtube.com/@" + v.lstrip("@"),
    "telegram": lambda v: "https://t.me/" + v.lstrip("@"),
    "linkedin": lambda v: "https://linkedin.com/in/" + v,
    "tiktok": lambda v: "https://tiktok.com/@" + v.lstrip("@"),
    "pinterest": lambda v: "https://pinterest.com/" + v,
    "discord": lambda v: "https://discord.gg/" + v,
    "github": lambda v: "https://github.com/" + v,
    "email": lambda v: "mailto:" + v,
    "phone": lambda v: "tel:" + "".join(c for c in v if c.isdigit() or c == "+"),
}


def socials_buttons(p: dict, theme: dict, attr: str) -> str:
    links = []
    for i in p.get("items", []):
        platform = i.get("platform", "")
        value = str(i.get("value", ""))
        make = _SOCIAL_HREF.get(platform)
        if not make:
            continue
        href = value if value.startswith("http") else make(value)
        label = i.get("label") or platform.capitalize()
        links.append(f'<a href="{href}" target="_blank" rel="noopener noreferrer" {attr}="socials__link">{label}</a>')
    joined = "\n    ".join(links)
    return f"""<section {attr}="socials">
  <h2>{p.get("heading", "Talk to us anywhere")}</h2>
  <p>{p.get("subheading", "")}</p>
  <div {attr}="socials__row">
    {joined}
  </div>
</section>"""


# ── FAQ ───────────────────────────────────────────────────────────
def faq_default(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [{"q": "What is your refund policy?", "a": "30-day money-back guarantee."}])
    entries = "\n    ".join(
        f'<div {attr}="accordion-item"><div {attr}="accordion-head">{i.get("q", "")}</div>'
        f'<div {attr}="accordion-body">{i.get("a", "")}</div></div>'
        for i in items
    )
    return f"""<section {attr}="features">
  <div {attr}="features__heading"><h2>{p.get("heading", "Frequently asked questions")}</h2></div>
  {entries}
</section>"""


# ── Stats ─────────────────────────────────────────────────────────
def stats_default(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [{"value": "10K+", "label": "Active users"}, {"value": "99.9%", "label": "Uptime"}])
    entries = "\n    ".join(
        f'<div {attr}="stat"><strong>{i.get("value", "")}</strong><span>{i.get("label", "")}</span></div>'
        for i in items
    )
    return f'<section {attr}="stats">\n    {entries}\n</section>'


def stats_cards(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [])
    entries = "\n    ".join(
        f'<div {attr}="stat"><span {attr}="stat__eyebrow">{i.get("label", "")}</span>'
        f'<strong>{i.get("value", "")}</strong><span {attr}="stat__trend">{i.get("trend", "Growing steadily")}</span></div>'
        for i in items
    )
    return f'<section {attr}="stats stats--cards">\n    {entries}\n</section>'


def stats_bars(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [])
    entries = "\n    ".join(
        f'<div {attr}="stat"><div {attr}="stat__bar-head"><span>{i.get("label", "")}</span><strong>{i.get("value", "")}</strong></div>'
        f'<div {attr}="stat__track"><span style="width:{i.get("percent", 75)}%"></span></div></div>'
        for i in items
    )
    return f'<section {attr}="stats stats--bars">\n    {entries}\n</section>'


# ── Team ──────────────────────────────────────────────────────────
def team_default(p: dict, theme: dict, attr: str) -> str:
    items = p.get("items", [{"name": "Alex Kim", "role": "Founder & CEO"}])
    entries = "\n    ".join(
        f'<div {attr}="team-card"><h3>{i.get("name", "")}</h3><p>{i.get("role", "")}</p></div>' for i in items
    )
    return f"""<section {attr}="features">
  <div {attr}="features__heading"><h2>{p.get("heading", "Meet the team.")}</h2></div>
  <div {attr}="features__grid">
    {entries}
  </div>
</section>"""


# ── Logo cloud / Icons ────────────────────────────────────────────
def logocloud_default(p: dict, theme: dict, attr: str) -> str:
    logos = p.get("logos", ["ACME", "Globex", "Umbrella", "Initech"])
    entries = "\n    ".join(f"<span>{logo}</span>" for logo in logos)
    return f"""<section {attr}="logocloud">
  <p>{p.get("heading", "Trusted by teams at")}</p>
  <div {attr}="logo-row">
    {entries}
  </div>
</section>"""


# ── Notifications / Banner ────────────────────────────────────────
def notifications_banner(p: dict, theme: dict, attr: str) -> str:
    return f"""<div {attr}="notif-banner">
  <span {attr}="notif-banner__text">{p.get("text", "We just launched v2.0 — check out what's new!")}</span>
  <button {attr}="notif-banner__close">&times;</button>
</div>"""


REGISTRY: dict[str, dict] = {
    "navbar": {"component_name": "Navbar", "variants": {"default": navbar_default, "dark": navbar_dark, "minimal": navbar_minimal, "megabar": navbar_megabar}},
    "hero": {"component_name": "Hero", "variants": {"split": hero_split, "centered": hero_centered}},
    "features": {"component_name": "FeatureGrid", "variants": {"grid": features_grid, "list": features_list}},
    "cards": {"component_name": "CardGrid", "variants": {"simple": cards_simple, "numbered": cards_numbered}},
    "catalog": {"component_name": "Catalog", "variants": {"grid": catalog_grid, "editorial": catalog_editorial}},
    "pricing": {"component_name": "Pricing", "variants": {"tiered": pricing_tiered, "simple": pricing_simple}},
    "footer": {"component_name": "Footer", "variants": {"simple": footer_simple, "columns": footer_columns}},
    "forms": {"component_name": "ContactForm", "variants": {"contact": forms_contact, "booking": forms_booking, "subscription": forms_subscription}},
    "testimonials": {"component_name": "Testimonials", "variants": {"default": testimonials_default}},
    "cta": {"component_name": "Cta", "variants": {"default": cta_default}},
    "faq": {"component_name": "Faq", "variants": {"default": faq_default}},
    "socials": {"component_name": "Socials", "variants": {"buttons": socials_buttons}},
    "timeline": {"component_name": "Timeline", "variants": {"default": timeline_default}},
    "stats": {"component_name": "Stats", "variants": {"default": stats_default, "cards": stats_cards, "bars": stats_bars}},
    "team": {"component_name": "Team", "variants": {"default": team_default}},
    "icons": {"component_name": "LogoCloud", "variants": {"default": logocloud_default}},
    "notifications": {"component_name": "NotifBanner", "variants": {"default": notifications_banner, "banner": notifications_banner}},
}


def render_node(node: dict, theme: dict, attr: str) -> str:
    from app.codegen.anchors import with_id
    from app.codegen.widgets import render_widget_node

    custom = (node.get("props") or {}).get("custom") or {}
    if custom.get("html"):  # designed from the user's description in the Design step (app/agents/custom_section.py)
        markup = f"<style>{custom.get('css', '')}</style>\n{custom['html']}"
        if attr == "class":
            return markup
        return "<div dangerouslySetInnerHTML={{ __html: " + json.dumps(markup) + " }} />"

    widget = render_widget_node(node)
    if widget is not None:
        return with_id(widget, node["_anchor"]) if node.get("_anchor") else widget
    entry = REGISTRY.get(node["type"])
    if not entry:
        return f"<!-- Unknown component type: {node['type']} -->"
    variants = entry["variants"]
    generator: Generator = variants.get(node["variant"]) or next(iter(variants.values()))
    props = node.get("props", {})
    html = generator(props, theme, attr)
    if node.get("_anchor"):
        html = with_id(html, node["_anchor"])
    if node["type"] == "hero" and props.get("bgVideo"):
        video_attrs = "autoPlay muted loop playsInline" if attr == "className" else "autoplay muted loop playsinline"
        dim = props.get("videoDim", 0.45)
        html = (
            f'<div {attr}="hero-video">\n'
            f'  <video {attr}="hero-video__media" src="{props["bgVideo"]}" {video_attrs}></video>\n'
            f'  <div {attr}="hero-video__scrim" style={{{{opacity: {dim}}}}}></div>\n'
            f'  <div {attr}="hero-video__content">\n{html}\n  </div>\n'
            f"</div>"
        )
        if attr == "class":
            html = html.replace("style={{opacity: " + str(dim) + "}}", f'style="opacity: {dim}"')
    return html


def component_name_for(type_: str) -> str:
    entry = REGISTRY.get(type_)
    return entry["component_name"] if entry else type_.capitalize()
