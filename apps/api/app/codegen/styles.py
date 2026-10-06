"""Generates the plain-CSS stylesheet shared by every generated project.

Written once from `DesignTokens` so changing a token (via the design
system editor or an `update_theme` AI op) regenerates a consistently
updated stylesheet — this file, not per-component inline styles, is the
single place color/spacing/radius tokens live in the generated output.
"""


def base_stylesheet(theme: dict) -> str:
    colors = theme.get("colors", {})

    def c(key: str, fallback: str) -> str:
        return colors.get(key, fallback)

    return f""":root {{
  --primary: {c("primary", "#7c5cff")};
  --secondary: {c("secondary", "#22d3ee")};
  --accent: {c("accent", "#f97316")};
  --background: {c("background", "#06080a")};
  --surface: {c("surface", "#151921")};
  --text: {c("text", "#eef1f7")};
  --muted: {c("muted", "#8a93a6")};
  --border: {c("border", "#222733")};
  --success: {c("success", "#10b981")};
  --warning: {c("warning", "#f59e0b")};
  --error: {c("error", "#ef4444")};
  --font-heading: "{theme.get("heading_font", "Inter")}", ui-sans-serif, system-ui, sans-serif;
  --font-body: "{theme.get("body_font", "Inter")}", ui-sans-serif, system-ui, sans-serif;
}}

* {{ box-sizing: border-box; }}
html {{ scroll-behavior: smooth; }}
:target {{ scroll-margin-top: 24px; }}
body {{ margin: 0; font-family: var(--font-body); background: var(--background); color: var(--text); }}
h1, h2, h3 {{ font-family: var(--font-heading); }}
img {{ max-width: 100%; display: block; }}
.btn {{ padding: 12px 22px; border-radius: 10px; border: 0; font-weight: 600; cursor: pointer; font-size: 15px; }}
.btn--primary {{ background: var(--primary); color: #fff; }}
.btn--secondary {{ background: var(--surface); color: var(--text); border: 1px solid var(--border); }}
.btn--light {{ background: #fff; color: #0f172a; }}

.navbar {{ display: flex; align-items: center; justify-content: space-between; padding: 20px 48px; background: var(--surface); border-bottom: 1px solid var(--border); }}
.navbar--dark {{ background: #0f172a; color: #fff; }}
.navbar--minimal {{ justify-content: center; gap: 40px; }}
.navbar--megabar {{ display: block; padding: 0; background: #10233f; color: #fff; }}
.navbar--megabar .navbar__announcement {{ padding: 9px 48px; background: #ff7657; color: #10233f; font-size: 12px; font-weight: 700; text-align: center; }}
.navbar--megabar .navbar__main {{ display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 22px 48px; }}
.navbar--megabar .navbar__links {{ color: rgba(255,255,255,.72); }}
.navbar--megabar .navbar__cta {{ background: #fff; color: #10233f; }}
.navbar__brand {{ font-weight: 800; font-size: 20px; }}
.navbar__links {{ display: flex; gap: 32px; font-size: 14px; font-weight: 500; }}
.navbar__links a {{ color: inherit; text-decoration: none; }}
.navbar__links a:hover {{ color: var(--primary); }}
.navbar__cta {{ background: var(--primary); color: #fff; border: 0; border-radius: 8px; padding: 10px 18px; font-weight: 600; cursor: pointer; }}

.hero {{ padding: 100px 70px; display: grid; gap: 50px; align-items: center; }}
.hero--split {{ grid-template-columns: 1fr 1fr; }}
.hero--centered {{ grid-template-columns: 1fr; text-align: center; max-width: 760px; margin: 0 auto; }}
.hero h1 {{ font-size: 56px; line-height: 1.1; letter-spacing: -2px; margin: 0 0 24px; }}
.hero p {{ font-size: 18px; color: var(--muted); line-height: 1.6; margin-bottom: 32px; }}
.hero__actions {{ display: flex; gap: 12px; }}
.hero--centered .hero__actions {{ justify-content: center; }}
.hero__visual {{ height: 340px; border-radius: 24px; background: linear-gradient(145deg, var(--primary), var(--secondary)); }}

.features {{ padding: 90px 70px; }}
.features__heading {{ text-align: center; max-width: 600px; margin: 0 auto 50px; }}
.features__heading h2 {{ font-size: 38px; letter-spacing: -1px; margin: 0 0 16px; }}
.features__heading p {{ color: var(--muted); font-size: 17px; }}
.features__grid, .cards {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }}
.features--list .features__grid {{ grid-template-columns: 1fr; max-width: 640px; margin: 0 auto; }}
.card {{ padding: 28px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); position: relative; }}
.card--numbered {{ padding-top: 46px; }}
.card__number {{ position: absolute; top: 18px; left: 20px; width: 26px; height: 26px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }}
.card h3 {{ margin: 0 0 10px; }}
.card p {{ color: var(--muted); font-size: 15px; line-height: 1.6; margin: 0; }}

.catalog {{ padding: 90px 70px; }}
.catalog__heading {{ max-width: 620px; margin-bottom: 42px; }}
.catalog__heading h2 {{ font-size: 38px; margin: 0 0 12px; }}
.catalog__heading p {{ color: var(--muted); font-size: 17px; margin: 0; }}
.catalog__grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }}
.catalog__item {{ overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); }}
.catalog__image {{ min-height: 190px; background: linear-gradient(135deg, var(--secondary), var(--primary)); background-position: center; background-size: cover; }}
.catalog__body {{ padding: 22px; }}
.catalog__body > div {{ display: flex; justify-content: space-between; gap: 12px; }}
.catalog__body h3 {{ margin: 0; font-size: 18px; }}
.catalog__body strong {{ color: var(--primary); white-space: nowrap; }}
.catalog__body p {{ color: var(--muted); line-height: 1.55; }}
.catalog__body button, .catalog__row button {{ border: 0; border-radius: 8px; padding: 9px 14px; background: var(--primary); color: #fff; font-weight: 600; cursor: pointer; }}
.catalog--editorial .catalog__row {{ display: grid; grid-template-columns: 120px 1fr auto auto; gap: 24px; align-items: center; padding: 18px 0; border-top: 1px solid var(--border); }}
.catalog--editorial .catalog__image {{ min-height: 90px; border-radius: 12px; }}
.catalog--editorial .catalog__body {{ padding: 0; }}

.pricing {{ padding: 90px 70px; }}
.pricing__heading {{ text-align: center; margin-bottom: 50px; }}
.pricing__grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: center; }}
.pricing--simple .pricing__grid {{ grid-template-columns: 1fr; max-width: 340px; margin: 0 auto; }}
.price {{ padding: 36px 28px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border); }}
.price--featured {{ border: 2px solid var(--primary); transform: scale(1.05); }}
.price h3 {{ margin: 0 0 12px; color: var(--muted); }}
.price strong {{ font-size: 44px; display: block; margin-bottom: 20px; letter-spacing: -1px; }}
.price ul {{ padding: 0; list-style: none; color: var(--muted); font-size: 14px; }}
.price ul li {{ margin-bottom: 10px; }}

.pricing--showcase {{ padding: 80px 60px 90px; background: radial-gradient(circle at 12% 8%, #6a2a70 0%, transparent 42%), linear-gradient(135deg, #43266f, #2a1550 60%, #1d0f3c); }}
.pricing--showcase .pricing__heading h2 {{ color: #fff; }}
.pricing--showcase .pricing__grid {{ max-width: 920px; margin: 0 auto; gap: 18px; }}
.pricing--showcase .price {{ position: relative; text-align: center; background: #fff; border: 0; border-radius: 8px; padding: 34px 28px 30px; box-shadow: 0 20px 40px rgba(10, 0, 30, 0.35); transform: none; color: #111; }}
.pricing--showcase .price--featured {{ padding-top: 46px; padding-bottom: 42px; z-index: 2; box-shadow: 0 28px 60px rgba(10, 0, 30, 0.5); }}
.pricing--showcase .price__art {{ display: block; margin: 0 auto 18px; color: #c9c5d4; }}
.pricing--showcase .price--featured .price__art {{ color: #43266f; }}
.pricing--showcase .price h3 {{ margin: 0 0 14px; font-size: 16px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #111; }}
.pricing--showcase .price ul {{ margin: 0 0 24px; text-align: center; color: #3a3450; font-size: 13px; line-height: 1.9; }}
.pricing--showcase .price ul li {{ margin: 0; }}
.pricing--showcase .price__amount {{ display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px; }}
.pricing--showcase .price__currency {{ align-self: flex-start; margin-top: 6px; font-size: 18px; font-weight: 600; }}
.pricing--showcase .price strong {{ display: inline; margin: 0; font-size: 44px; line-height: 1; letter-spacing: -1px; }}
.pricing--showcase .price--featured strong, .pricing--showcase .price--featured .price__currency {{ color: #f5a524; }}
.pricing--showcase .price__unit {{ max-width: 46px; padding-left: 8px; border-left: 1px solid #dcd9e4; text-align: left; font-size: 11px; font-weight: 700; line-height: 1.15; color: #a5a0b5; }}
.pricing--showcase .price__btn {{ display: block; width: 100%; border: 0; border-radius: 999px; padding: 12px; background: #dddbe4; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }}
.pricing--showcase .price--featured .price__btn {{ background: #563574; }}
.pricing--showcase .price__ribbon {{ position: absolute; top: 0; right: 0; width: 78px; height: 78px; overflow: hidden; border-top-right-radius: 8px; pointer-events: none; }}
.pricing--showcase .price__ribbon span {{ position: absolute; top: 15px; right: -26px; width: 104px; padding: 3px 0; transform: rotate(45deg); background: #563574; color: #fff; text-align: center; font-size: 8px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }}
.pricing--showcase .price__badge {{ position: absolute; top: -16px; right: -14px; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #563574; color: #fff; text-align: center; font-size: 10px; font-weight: 800; line-height: 1.1; box-shadow: 0 6px 16px rgba(10, 0, 30, 0.4); }}

.footer {{ padding: 40px 70px; background: #0f172a; color: #94a3b8; display: flex; justify-content: space-between; font-size: 14px; }}
.footer--columns {{ flex-direction: column; gap: 24px; }}
.footer__cols {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }}
.footer__cols strong {{ display: block; color: #fff; margin-bottom: 10px; font-size: 13px; }}
.footer__cols span {{ display: block; margin-bottom: 6px; font-size: 13px; }}

.formsec {{ padding: 90px 70px; }}
.formsec__heading {{ text-align: center; max-width: 560px; margin: 0 auto 40px; }}
.form-card {{ max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }}
.formsec--inline .form-card {{ flex-direction: row; max-width: 520px; }}
.form-field label {{ display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }}
.form-input {{ width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; font-size: 14px; background: var(--surface); color: var(--text); }}
.form-textarea {{ min-height: 100px; resize: vertical; }}
.form-submit {{ background: var(--primary); color: #fff; border: 0; padding: 12px 28px; border-radius: 10px; font-weight: 600; cursor: pointer; }}

.testimonial {{ padding: 28px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); text-align: left; }}
.testimonial__author strong {{ display: block; }}
.testimonial__author span {{ color: var(--muted); font-size: 13px; }}

.cta {{ padding: 80px 70px; text-align: center; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: #fff; }}
.cta h2 {{ font-size: 34px; margin: 0 0 12px; }}
.cta p {{ opacity: .85; margin: 0 0 28px; }}

.accordion-item {{ border-bottom: 1px solid var(--border); padding: 16px 4px; max-width: 640px; margin: 0 auto; }}
.accordion-head {{ font-weight: 600; }}
.accordion-body {{ margin-top: 10px; color: var(--muted); font-size: 14px; }}

.stats {{ padding: 70px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; background: #0f172a; text-align: center; }}
.stat strong {{ display: block; font-size: 34px; color: #fff; }}
.stat span {{ color: #94a3b8; font-size: 13px; }}

.team-card h3 {{ margin: 0 0 4px; }}
.team-card p {{ margin: 0; color: var(--muted); font-size: 13px; }}

.logocloud {{ padding: 50px 70px; text-align: center; }}
.logocloud p {{ color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 24px; }}
.logo-row {{ display: flex; justify-content: center; gap: 48px; flex-wrap: wrap; font-weight: 800; font-size: 20px; color: var(--muted); }}

.notif-banner {{ display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 32px; background: var(--surface); border-bottom: 1px solid var(--border); }}
.notif-banner__close {{ background: transparent; border: 0; color: var(--muted); font-size: 16px; cursor: pointer; }}

.timeline {{ padding: 70px; }}
.timeline h2 {{ text-align: center; font-size: 34px; margin: 0 0 36px; }}
.timeline__list {{ list-style: none; margin: 0 auto; padding: 0 0 0 28px; max-width: 700px; border-left: 2px solid var(--border); }}
.timeline__item {{ position: relative; margin-bottom: 28px; }}
.timeline__dot {{ position: absolute; left: -37px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--primary); border: 3px solid var(--bg); box-shadow: 0 0 0 2px var(--primary); }}
.timeline__date {{ font: 700 12px monospace; letter-spacing: .1em; color: var(--accent); }}
.timeline h3 {{ margin: 4px 0; }}
.timeline p {{ margin: 0; color: var(--muted); }}
.navbar__login {{ background: transparent; border: 0; color: inherit; font-weight: 600; padding: 10px 14px; cursor: pointer; }}

.socials {{ padding: 70px; text-align: center; }}
.socials h2 {{ font-size: 34px; margin: 0 0 8px; }}
.socials p {{ color: var(--muted); margin: 0 0 24px; }}
.socials__row {{ display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; }}
.socials__link {{ padding: 12px 22px; border-radius: 999px; background: var(--primary); color: #fff; text-decoration: none; font-weight: 700; }}

.hero-video {{ position: relative; overflow: hidden; color: #fff; background: #0d0918; }}
.hero-video__media {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
.hero-video__scrim {{ position: absolute; inset: 0; background: #000; }}
.hero-video__content {{ position: relative; z-index: 1; }}
.hero-video__content .hero, .hero-video__content section {{ background: transparent; }}
.hero-video__content h1, .hero-video__content p {{ color: #fff; }}
@media (prefers-reduced-motion: reduce) {{ .hero-video__media {{ display: none; }} }}
"""
