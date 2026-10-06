"""Rewrite copy in another tone, and translate a page or the whole site.

The trick that makes this reliable on any model: pull every piece of visible text out of the components as a numbered
list, ask the model to return the same list rewritten or translated, and put the results back in the same places.
The model never sees or edits the structure, so it cannot break a component.
"""

import copy
from typing import Any

from app.ai import llm
from app.schemas.schemas import AIOp

# props that hold text people read. Everything else (ids, urls, colours, variants, flags) is left alone.
TEXT_KEYS = {"headline", "subheadline", "heading", "subheading", "text", "title", "quote", "primaryCta", "secondaryCta", "button", "cta", "q", "a", "description", "name", "role", "label", "brand", "greeting", "placeholder", "left", "sub", "subtitle", "unit", "value"}
SKIP_NODE_TYPES = {"chatbot"}  # knowledge bases are matched by keywords, so they are translated separately
MAX_STRINGS = 60

LANGUAGES = {
    "hindi": "Hindi", "malayalam": "Malayalam", "tamil": "Tamil", "telugu": "Telugu", "kannada": "Kannada", "bengali": "Bengali", "marathi": "Marathi",
    "gujarati": "Gujarati", "punjabi": "Punjabi", "urdu": "Urdu", "spanish": "Spanish", "french": "French", "german": "German", "italian": "Italian",
    "portuguese": "Portuguese", "arabic": "Arabic", "japanese": "Japanese", "korean": "Korean", "chinese": "Chinese", "english": "English",
}
TONES = ("friendly", "formal", "premium", "luxury", "playful", "professional", "casual", "persuasive", "shorter", "concise", "warm", "bold", "simple", "witty", "trustworthy", "energetic", "elegant")


def _collect(value: Any, path: tuple, out: list[tuple[tuple, str]], keys: set[str] = TEXT_KEYS) -> None:
    if isinstance(value, dict):
        for k, v in value.items():
            if isinstance(v, str) and k in keys and 1 < len(v.strip()) <= 400 and not v.startswith(("data:", "http", "#", "/")):
                out.append((path + (k,), v))
            elif isinstance(v, (dict, list)):
                _collect(v, path + (k,), out, keys)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            if isinstance(v, str) and 1 < len(v.strip()) <= 60 and path and path[-1] in ("links", "topbar"):
                out.append((path + (i,), v))
            else:
                _collect(v, path + (i,), out, keys)


def _set(root: dict, path: tuple, value: str) -> None:
    cur: Any = root
    for step in path[:-1]:
        cur = cur[step]
    cur[path[-1]] = value


async def transform(nodes: list[dict], instruction: str) -> tuple[list[AIOp], int, str | None]:
    """Rewrites the text of `nodes` following `instruction`. Returns (edits, number of strings changed, error)."""
    slots: list[tuple[int, tuple, str]] = []
    for ni, node in enumerate(nodes):
        if node.get("type") in SKIP_NODE_TYPES:
            continue
        found: list[tuple[tuple, str]] = []
        _collect(node.get("props") or {}, (), found)
        slots += [(ni, path, text) for path, text in found]
    slots = slots[:MAX_STRINGS]
    if not slots:
        return [], 0, "There is no text on this page to change yet."
    numbered = "\n".join(f"{i + 1}. {t}" for i, (_n, _p, t) in enumerate(slots))
    system = ("You edit website copy. You receive a numbered list of short texts. Apply the instruction to each one and reply with ONLY JSON: "
              '{"texts": ["...", "..."]} containing exactly the same number of items in the same order. Keep names, numbers, prices and currency symbols. '
              "Never add facts, offers or details that are not in the original text. Do not add explanations.")
    raw = await llm.complete(system, f"Instruction: {instruction}\n\nTexts:\n{numbered}", json_mode=True, timeout=90, max_tokens=2500)
    data = llm.parse_json(raw)
    texts = data.get("texts") if isinstance(data, dict) else data if isinstance(data, list) else None
    if not isinstance(texts, list) or len(texts) != len(slots):
        return [], 0, "The AI model didn't return usable text (it may be busy or too small for this). Try again, or use a hosted model for better results."

    new_props = {ni: copy.deepcopy(nodes[ni].get("props") or {}) for ni in {s[0] for s in slots}}
    changed = 0
    for (ni, path, old), new in zip(slots, texts):
        if isinstance(new, str) and new.strip() and new.strip() != old:
            _set(new_props[ni], path, new.strip())
            changed += 1
    ops = []
    for ni, props in new_props.items():
        node = nodes[ni]
        ops.append(AIOp(op="update_component", description=f"Update the text of {node.get('name') or node.get('type')}", target_id=node.get("id"), payload={"props": props}))
    return ops, changed, None


def find_tone(low: str) -> str | None:
    """The tone named in a request, including forms like "friendlier" or "more premium"."""
    import re

    for tone in TONES:
        stem = tone[:6] if len(tone) > 6 else tone[:-1] if tone.endswith("y") else tone
        if re.search(rf"\b{re.escape(stem)}", low):
            return tone
    return None
