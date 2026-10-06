"""AI colour advisor.

Recommends brand palettes (base hue, saturation, colour-theory harmony, light/dark mode) for a brief and
explains *why* each suits the audience, using the configured LLM (Ollama or Anthropic). If no model is
reachable, or its answer is not valid JSON, a deterministic colour-theory rule engine answers instead, so the
editor always gets reasoned recommendations.
"""

import json
import re

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth.deps import get_current_user
from app.core.config import get_settings
from app.models.models import User

settings = get_settings()
router = APIRouter(prefix="/ai", tags=["ai"])

SCHEMES = ["complementary", "analogous", "triadic", "split", "tetradic", "mono"]


class ColorAdviceRequest(BaseModel):
    brief: str = ""
    industry: str = ""
    audience: str = ""
    mood: str = ""
    avoid: str = ""


class ColorOption(BaseModel):
    name: str
    hue: int = Field(ge=0, le=359)
    sat: int = Field(ge=15, le=100)
    scheme: str
    mode: str
    justification: str
    psychology: str
    audience_fit: str
    caution: str


class ColorAdviceResponse(BaseModel):
    provider: str
    summary: str
    options: list[ColorOption]


# ── deterministic colour-theory engine ─────────────────────────────
# (keywords, hue, sat, scheme, mode, name, psychology, audience)
PROFILES = [
    (["bank", "finance", "fintech", "payment", "insurance", "invest", "wallet", "accounting"], 215, 72, "split", "light", "Trust Blue", "Blue signals stability and competence, the reason most financial brands use it.", "People handing over money want calm and reliability, not excitement."),
    (["health", "clinic", "hospital", "medical", "doctor", "pharma", "dental"], 175, 60, "analogous", "light", "Clinical Calm", "Teal blends the reassurance of blue with the vitality of green.", "Patients respond to clean, calm and safe cues; saturated reds raise anxiety."),
    (["wellness", "yoga", "spa", "meditation", "organic", "eco", "sustain", "nature", "farm", "plant"], 140, 42, "analogous", "light", "Living Green", "Green is read as growth, health and renewal; muted tones feel natural.", "Values-driven audiences trust earthy, low-chroma palettes over loud ones."),
    (["restaurant", "food", "cafe", "bakery", "pizza", "kitchen", "catering", "bar"], 18, 78, "complementary", "light", "Appetite Warm", "Warm reds and oranges are linked to appetite and sociability.", "Diners decide quickly and emotionally, so warmth and energy convert."),
    (["kid", "child", "school", "education", "learn", "course", "toy", "game for kids"], 262, 80, "triadic", "light", "Playful Primary", "Evenly spaced hues feel lively and balanced, which suits learning and play.", "Young audiences and parents respond to bright, friendly colour variety."),
    (["luxury", "jewel", "premium", "fashion", "boutique", "hotel", "watch", "perfume"], 42, 50, "mono", "dark", "Noir & Gold", "Dark grounds with a restrained warm metallic hue read as exclusive.", "High-spend buyers associate restraint and darkness with quality."),
    (["ai", "saas", "software", "startup", "developer", "cloud", "api", "platform", "data", "analytics"], 252, 76, "split", "dark", "Electric Product", "Blue-violet reads as innovative and technical while staying credible.", "Tech buyers expect modern, dark-friendly interfaces with a single bright accent."),
    (["travel", "tour", "airline", "beach", "hotel booking", "adventure", "holiday"], 195, 70, "complementary", "light", "Horizon Cyan", "Cyan evokes sea, sky and openness; a warm coral accent adds excitement.", "Travellers are buying an escape, so airy, open colours help."),
    (["beauty", "cosmetic", "salon", "makeup", "skincare", "florist", "wedding"], 335, 55, "analogous", "light", "Soft Bloom", "Pinks and roses signal care, femininity and elegance.", "Beauty buyers respond to soft, flattering, image-led palettes."),
    (["law", "legal", "consult", "advisory", "b2b", "corporate", "enterprise", "government"], 220, 55, "mono", "light", "Boardroom Navy", "Deep, low-chroma blue communicates authority and seriousness.", "Decision makers want credibility over personality."),
    (["gaming", "esport", "music", "nightlife", "club", "festival", "streaming"], 305, 90, "triadic", "dark", "Neon Night", "Saturated magenta and cyan on near-black create energy and excitement.", "Young, entertainment-driven audiences expect high stimulation."),
    (["news", "blog", "magazine", "media", "editorial", "publish"], 12, 70, "complementary", "light", "Editorial Red", "A confident red on paper-toned neutrals feels urgent and journalistic.", "Readers scan quickly; strong accents guide the eye through dense content."),
]

DEFAULT_PROFILE = (215, 65, "analogous", "light", "Balanced Blue", "Blue is the most universally liked hue and reads as dependable.", "A broad audience is best served by familiar, low-risk colour.")
MOODS = {
    "playful": (25, "triadic"), "bold": (5, "complementary"), "calm": (190, "analogous"), "luxurious": (42, "mono"),
    "trustworthy": (215, "split"), "friendly": (30, "analogous"), "modern": (255, "split"), "elegant": (330, "mono"),
}


def _profile(text: str):
    best, score = None, 0
    for prof in PROFILES:
        s = sum(1 for k in prof[0] if k in text)
        if s > score:
            best, score = prof, s
    return best


def _clamp_hue(v: int) -> int:
    return int(v) % 360


def rule_advice(req: ColorAdviceRequest) -> ColorAdviceResponse:
    text = " ".join([req.brief, req.industry, req.audience, req.mood]).lower()
    prof = _profile(text)
    hue, sat, scheme, mode, name, psych, aud = (prof[1:] if prof else DEFAULT_PROFILE)
    industry = (req.industry or req.brief.strip()[:50] or "your brand").strip()

    for mood, (mh, ms) in MOODS.items():
        if mood in text and not prof:
            hue, scheme = mh, ms
            name = f"{mood.capitalize()} Palette"
            psych = f"A {mood} personality maps to this hue and harmony."
            break
    if "dark" in text:
        mode = "dark"
    if "light" in text or "bright" in text:
        mode = "light"

    def why(scheme_id: str, hue_: int) -> str:
        explain = {
            "complementary": "a complementary accent 180° across the wheel gives the strongest contrast for calls to action",
            "analogous": "neighbouring hues (±30°) keep the whole interface calm and cohesive",
            "triadic": "three evenly spaced hues (120°) give variety while staying balanced",
            "split": "split-complementary accents give contrast without the tension of a pure complement",
            "tetradic": "four hues 90° apart offer richness, as long as one stays dominant",
            "mono": "a single hue in tints and shades feels elegant and unmistakably on-brand",
        }[scheme_id]
        return f"For {industry}, hue {hue_}° fits because {psych.lower()} The {scheme_id} harmony works here because {explain}. Neutrals are tinted with the base hue (60%), the primary carries the brand (30%) and the accent is kept to about 10%, and every text/button pair is checked against WCAG contrast."

    alt_scheme = "complementary" if scheme != "complementary" else "analogous"
    options = [
        ColorOption(name=name, hue=_clamp_hue(hue), sat=sat, scheme=scheme, mode=mode, justification=why(scheme, hue), psychology=psych, audience_fit=aud, caution="Test the accent colour on your real content; very small text needs the contrast fixes in the checker."),
        ColorOption(name=f"{name}, high contrast", hue=_clamp_hue(hue), sat=min(100, sat + 10), scheme=alt_scheme, mode=mode, justification=why(alt_scheme, hue), psychology=psych, audience_fit="Better if you need conversion-focused buttons that stand out from the page.", caution="A stronger accent can feel loud; keep it to the primary call to action."),
        ColorOption(name=f"{name}, {'light' if mode == 'dark' else 'dark'} variant", hue=_clamp_hue(hue + 15), sat=max(30, sat - 15), scheme="mono", mode="light" if mode == "dark" else "dark", justification=why("mono", hue + 15), psychology=psych, audience_fit="A quieter alternative when the audience prefers restraint over energy.", caution="Monochrome needs strong typography and spacing to keep hierarchy clear."),
    ]
    summary = (
        f"Based on “{(req.brief or industry).strip()[:80]}”, {name.lower()} is the closest match. "
        f"{psych}"
    )
    return ColorAdviceResponse(provider="rule_based", summary=summary, options=options)


# ── LLM path ───────────────────────────────────────────────────────
SYSTEM = (
    "You are a senior brand colour strategist. Recommend website colour palettes for the brief. "
    "Ground every choice in colour theory (harmony type, contrast, the 60-30-10 rule), colour psychology, "
    "industry conventions and the target audience. Respond with ONLY JSON of the form "
    '{"summary": string, "options": [{"name": string, "hue": integer 0-359 (HSL hue of the brand/primary colour), '
    '"sat": integer 25-100, "scheme": one of ["complementary","analogous","triadic","split","tetradic","mono"], '
    '"mode": "light" or "dark", "justification": string (3-4 sentences: why this hue, why this harmony, why it suits the audience), '
    '"psychology": string (one sentence), "audience_fit": string (one sentence), "caution": string (one sentence)}]}. '
    "Return exactly 3 distinct options, ordered best first. No text outside the JSON."
)


def _parse(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError("no JSON in model output")
    return json.loads(match.group(0))


def _valid_options(data: dict) -> list[ColorOption]:
    out: list[ColorOption] = []
    for raw in data.get("options", []):
        try:
            scheme = str(raw.get("scheme", "")).lower()
            if scheme not in SCHEMES:
                scheme = "analogous"
            mode = "dark" if str(raw.get("mode", "light")).lower() == "dark" else "light"
            out.append(
                ColorOption(
                    name=str(raw.get("name", "Palette"))[:60],
                    hue=_clamp_hue(int(float(raw.get("hue", 0)))),
                    sat=max(15, min(100, int(float(raw.get("sat", 65))))),
                    scheme=scheme,
                    mode=mode,
                    justification=str(raw.get("justification", ""))[:900],
                    psychology=str(raw.get("psychology", ""))[:300],
                    audience_fit=str(raw.get("audience_fit", ""))[:300],
                    caution=str(raw.get("caution", ""))[:300],
                )
            )
        except (ValueError, TypeError):
            continue
    return [o for o in out if o.justification]


async def _ask_llm(req: ColorAdviceRequest) -> tuple[str, dict]:
    payload = json.dumps(req.model_dump())
    if settings.ai_provider.lower() == "ollama":
        body = {
            "model": settings.ollama_model,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.4},
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": payload}],
        }
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
            res = await client.post(f"{settings.ollama_base_url}/api/chat", json=body)
            res.raise_for_status()
        return f"ollama:{settings.ollama_model}", _parse(str(res.json().get("message", {}).get("content", "")))
    if settings.anthropic_api_key:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        msg = await client.messages.create(model="claude-sonnet-5", max_tokens=1600, system=SYSTEM, messages=[{"role": "user", "content": payload}])
        return "anthropic", _parse("".join(b.text for b in msg.content if hasattr(b, "text")))
    raise RuntimeError("no LLM configured")


@router.post("/color-advice", response_model=ColorAdviceResponse)
async def color_advice(req: ColorAdviceRequest, user: User = Depends(get_current_user)) -> ColorAdviceResponse:
    fallback = rule_advice(req)
    try:
        provider, data = await _ask_llm(req)
        options = _valid_options(data)
        if not options:
            return fallback
        # top up to three options with the rule engine so the UI always has a choice
        for extra in fallback.options:
            if len(options) >= 3:
                break
            options.append(extra)
        return ColorAdviceResponse(provider=provider, summary=str(data.get("summary", fallback.summary))[:500], options=options[:3])
    except Exception:  # noqa: BLE001 — never fail the editor because a model is offline
        return fallback
