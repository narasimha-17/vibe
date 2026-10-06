"""The requirements interviewer (OORA).

Each turn the configured language model (see app/ai/llm.py: OpenRouter, Claude or Ollama) is given:
  * the conversation so far (restored from the database),
  * what has been captured so far and what this user prefers from earlier projects,
  * a hint with what is still unknown and the next thing to ask.

The model only writes the reply; the engine never depends on it for memory: the user's answer is
always stored deterministically under the topic that was just asked, and if the model is unavailable, slow or
returns nothing usable, a built-in interviewer asks the next question instead. The reply says which one answered.
"""

import asyncio
import json
import re
from app.ai import llm
from app.core.config import get_settings
from app.intake.memory import LongTermMemory, SessionMemory
from app.intake.topics import BY_KEY, TOPICS, TOPIC_KEYS

settings = get_settings()

SYSTEM = f"""You are OORA, the Outcome-Oriented Requirements Assistant inside VIBE, a visual website builder. You interview the user to understand
exactly what website they need, one question at a time, like a friendly product manager.

Topics to cover: {", ".join(TOPIC_KEYS)}.

Rules:
- Be conversational and curious, like ChatGPT talking to a client. Ask ONE question per message, at most 3 short sentences.
- If an answer already covers several topics, do not ask about them again.
- Ask sharp follow-ups when it helps: numbers, deadlines, who the customers are, what goes wrong today, what "success" looks like.
- Suggest ideas the user may not have thought of (for example a page or integration) and ask if they want them.
- Briefly acknowledge what the user just said, then ask about the next topic you are told to ask.
- Never invent details, never mention internal notes or topic names.
- If an answer is vague, ask one short follow-up instead of moving on.
- When every topic is covered, thank them, summarise in one sentence and tell them to press "See what I understood".
"""


def build_model() -> bool | None:
    """True when a language model is configured (OpenRouter, Claude or Ollama), else None."""
    return True if llm.has_model() else None


def _history(transcript: list[dict]) -> list[dict]:
    return [{"role": m["role"], "content": m["text"]} for m in transcript if m.get("role") in ("user", "assistant") and m.get("text")]


async def _run_agent(transcript: list[dict], prompt: str, mem: SessionMemory, ltm: LongTermMemory) -> str:
    known = ltm.recall()
    system = SYSTEM + (f"\nWhat you remember about this user from earlier projects: {json.dumps(known)}" if known else "")
    reply = await llm.chat(system, _history(transcript) + [{"role": "user", "content": prompt}], timeout=settings.intake_agent_timeout, max_tokens=400, temperature=0.4)
    if reply is None:
        raise RuntimeError("no model reply")
    return reply.strip()


CHIPS = """You suggest quick replies for a chat. Given the question an assistant just asked a user about the website they want,
write 4 short answers (2 to 6 words each) the user could tap to reply. Make them specific to their business when it is known,
and different from each other.
If the question asks about pages, suggest only pages that plainly fit what this business does (for example a bakery
gets Menu, Gallery, Order online — not generic boutique jargon like Journal, Lookbook or Manifesto just because it
sounds premium). Never suggest a page whose only purpose is to sound trendy.
Reply with ONLY JSON: {"chips": ["...", "...", "...", "..."]}"""


async def suggest_chips(question: str, mem: SessionMemory) -> list[str]:
    """Quick replies for `question`, written by the model; [] when there is no model or it fails (the fixed chips are used then)."""
    if not settings.intake_use_agent or build_model() is None or not question.strip():
        return []
    known = mem.as_text()
    raw = await llm.complete(CHIPS, f"Known so far:\n{known or 'Nothing yet.'}\n\nQuestion: {question}", json_mode=True, timeout=min(settings.intake_agent_timeout, 20), max_tokens=200)
    data = llm.parse_json(raw)
    chips = data.get("chips") if isinstance(data, dict) else data if isinstance(data, list) else None
    return _clean_items(chips)[:4]


def _clean_items(items) -> list[str]:
    """Model-written chips as short, readable, unique phrases ("PropertyGallery" -> "Property gallery")."""
    out: list[str] = []
    for item in items if isinstance(items, list) else []:
        text = str(item).strip().strip('"').rstrip(".")
        if re.fullmatch(r"[A-Z][a-z]+(?:[A-Z][a-z]+)+", text):  # CamelCase from a small model
            text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text).capitalize()
        if 2 <= len(text) <= 48 and text.lower() not in (x.lower() for x in out):
            out.append(text)
    return out


FEATURES = """You are a website strategist. Given what is known about a client's website project, suggest 6 features their site
should have, specific to their kind of business (for example "Site visit booking" for real estate, "Menu with photos" for a cafe).
Each is a short name of 2 to 5 words. Reply with ONLY JSON: {"features": ["...", ...]}"""


async def feature_ideas(mem: SessionMemory) -> list[str]:
    """Features that fit this business, written by the model; [] when there is no model or it fails."""
    if not settings.intake_use_agent or build_model() is None:
        return []
    raw = await llm.complete(FEATURES, f"Known so far:\n{mem.as_text()}", json_mode=True, timeout=min(settings.intake_agent_timeout, 25), max_tokens=250)
    data = llm.parse_json(raw)
    items = data.get("features") if isinstance(data, dict) else data if isinstance(data, list) else None
    return _clean_items(items)[:6]


# ───────────────────────── built-in interviewer ─────────────────────────
ACKS = ["Got it.", "Thanks, that helps.", "Understood.", "Great, noted.", "That's clear."]


def greeting(ltm: LongTermMemory, template_label: str | None = None) -> str:
    first = TOPICS[0]["question"]
    if template_label:
        return (f"Great choice: the “{template_label}” template is a good starting point. Before I set it up, I'd like to tailor it to you. "
                f"I'll ask a few short questions.\n\n{first}")
    hint = ""  # earlier projects are remembered for suggestions, but never recited back at the user
    intro = "Hi! I'm OORA, your Outcome-Oriented Requirements Assistant. I'll ask a few short questions so I understand exactly what you need before we build anything."
    return f"{hint}\n\n{first}" if hint else f"{intro}\n\n{first}"



FOLLOW_UP = "Could you tell me a little more about that?"
VAGUE_TOPICS = {"business": "what you sell or offer and who it's for", "objectives": "the main result you want, such as more orders or more enquiries",
                "pain_points": "what goes wrong today, for example missed orders or too many calls", "outcome": "a number or result that would tell you it worked"}
LABELS = {t["key"]: t["label"].lower() for t in TOPICS}


def _extract_extra(text: str, mem: SessionMemory, taken: str | None) -> None:
    """The agent's own reading of a message: pick up details about other topics the user volunteered."""
    from app.intake.analysis import FEATURES
    from app.intake.topics import INTEGRATIONS, parse_integrations

    low = text.lower()
    if taken != "integrations" and mem.recall("integrations") is None:
        found = [f for f in parse_integrations(text) if f in ("Razorpay", "Stripe", "PayPal")]  # payment gateways are unambiguous; other apps are asked about
        if found:
            mem.remember("integrations", ", ".join(found))
    if taken != "pages" and mem.recall("pages") is None:
        m = re.search(r"(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+pages", low)
        if m:
            mem.remember("pages", text)
    if taken != "features" and mem.recall("features") is None:
        hits = []
        for words, label, _c, _s, _n in FEATURES:
            hit = next((w for w in words if w in low), None)
            if hit:
                hits.append(hit)
        if len(hits) >= 2:
            mem.remember("features", ", ".join(hits[:6]))
    if taken != "name" and mem.recall("name") is None:
        m = re.search(r"(?:called|named|name is|brand is)\s+[\"“']?([A-Z][\w&' -]{1,40})", text)
        if m:
            mem.remember("name", m.group(1).strip(" .,'\"”"))
    if taken != "style" and mem.recall("style") is None:
        m = re.search(r"\b(minimal|premium|elegant|playful|bold|modern|warm|luxury|clean|colou?rful)\b", low)
        if m and re.search(r"\b(look|feel|style|design|vibe)\b", low):
            mem.remember("style", text)


def _acknowledge(mem: SessionMemory, taken: str | None, turn: int) -> str:
    extra = [LABELS[t] for t in mem.changed if t != taken and t in LABELS]
    if extra:
        return f"Thanks, I also noted your {', '.join(extra[:-1]) + (' and ' if len(extra) > 1 else '') + extra[-1]}."
    return ACKS[turn % len(ACKS)]


def fallback_reply(mem: SessionMemory, next_topic: str | None, turn: int, taken: str | None = None) -> str:
    if next_topic is None:
        return "That covers everything I need. Press “See what I understood” and I'll show you my summary, some recommendations and an acceptance checklist to review."
    if next_topic == "features":
        from app.intake import reasoning

        return f"{_acknowledge(mem, taken, turn)} {reasoning.feature_question(mem)[0]}"
    return f"{_acknowledge(mem, taken, turn)} {BY_KEY[next_topic]['question']}"  # the built-in interviewer follows the fixed order of topics


def _usable(reply: str) -> bool:
    low = reply.lower()
    return bool(reply) and len(reply) < 900 and "internal note" not in low and "remember_requirement" not in low



REQUEST = re.compile(r"(\?\s*$|^\s*(can|could|would|will|what|which|who|why|how|should|do you|is it|are there|any idea)\b|\b(suggest|recommend|advise|help me|what do you think)\b)", re.I)
NAME_REQUEST = re.compile(r"\bnames?\b", re.I)


def is_request(text: str) -> bool:
    """The user is asking for something (a suggestion, advice, an explanation) rather than answering the question."""
    return bool(REQUEST.search(text.strip()))


def _pending_question(pending: str | None, mem: SessionMemory) -> str:
    if pending in BY_KEY:
        return BY_KEY[pending]["question"]
    return ""


async def _handle_request(transcript: list[dict], pending: str | None, text: str, mem: SessionMemory, ltm: LongTermMemory, wants_name: bool = False) -> dict:
    """Respond to what the user actually asked, then return to the open question."""
    from app.intake import content

    if wants_name:
        round_ = int(mem.data.get("_name_round", 0))
        mem.data["_name_round"] = round_ + 1
        names = content.suggest_names(mem.data, round_)
        mem.data["_offered_names"] = names
        mem.data["_chips"] = names + ["Suggest more names"]
        reply = "Here are some name ideas that fit your business:\n\n" + "\n".join(f"{i + 1}. {n}" for i, n in enumerate(names)) + "\n\nPick one, or tell me the feel you want (shorter, more playful, more premium) and I'll suggest more."
        return {"reply": reply, "engine": "agent", "note": "", "next_topic": "name", "ready": False, "chips": names + ["Suggest more names"]}

    reply = ""
    if settings.intake_use_agent and settings.intake_chat_use_model and build_model() is not None:
        back = _pending_question(pending, mem)
        prompt = "\n".join([text, "", "(Internal note, never mention it.", "The user is asking you for help instead of answering. Answer their request directly and helpfully first, using what is known:", mem.as_text(), "Keep it under 90 words." + (f" Then gently return to: {back}" if back else ""), ")"])
        try:
            reply = await asyncio.wait_for(_run_agent(transcript, prompt, mem, ltm), timeout=settings.intake_agent_timeout)
        except Exception:  # noqa: BLE001
            reply = ""
    if not _usable(reply):
        back = _pending_question(pending, mem)
        reply = "Good question. I'll note it, and we can settle it together once I understand the project better." + (f" For now: {back}" if back else "")
    return {"reply": reply, "engine": "llm" if _usable(reply) and settings.intake_chat_use_model else "agent", "note": "", "next_topic": pending, "ready": False}


def chips_for(pending_topic: str | None, mem: SessionMemory) -> list[str]:
    """Quick-reply suggestions that fit the question currently being asked."""
    from app.intake import reasoning

    if mem.data.get("_chips"):
        return list(mem.data["_chips"])
    if pending_topic and pending_topic.startswith("clar:"):
        return reasoning.chips_for(pending_topic[5:])
    if pending_topic == "features":
        return reasoning.feature_question(mem)[1]
    return list(BY_KEY[pending_topic]["chips"]) if pending_topic in BY_KEY else []


async def step(transcript: list[dict], pending_topic: str | None, user_text: str, mem: SessionMemory, ltm: LongTermMemory) -> dict:
    """One interview turn: understand the message, decide what still needs asking, and ask it."""
    from app.intake import reasoning

    mem.changed = []
    mem.data.pop("_chips", None)
    clarifying = bool(pending_topic and pending_topic.startswith("clar:"))
    wants_name = bool(re.search(r"\bnames?\b", user_text, re.I)) and not mem.recall("name") and pending_topic != "name_given" \
        and not re.search(r"(called|named|name is|our name|my name|brand is|brand name is)", user_text, re.I) \
        and user_text.strip() not in mem.data.get("_offered_names", []) and not (pending_topic == "name" and len(user_text.split()) <= 3 and not is_request(user_text))
    if wants_name or (is_request(user_text) and len(user_text.split()) >= 3 and user_text.strip() not in mem.data.get("_offered_names", [])):
        return await _handle_request(transcript, pending_topic, user_text, mem, ltm, wants_name)
    if clarifying:
        reasoning.apply_answer(pending_topic[5:], user_text, mem)
    elif pending_topic in VAGUE_TOPICS and len(user_text.split()) < 3 and not any(m.get("text", "").startswith(FOLLOW_UP) for m in transcript[-1:]):
        # A very short answer to an important question: ask for detail once instead of moving on.
        return {"reply": f"{FOLLOW_UP} For example, {VAGUE_TOPICS[pending_topic]}.", "engine": "agent", "note": "", "next_topic": pending_topic, "ready": False}
    elif pending_topic and pending_topic in BY_KEY:
        mem.remember(pending_topic, user_text)  # deterministic capture, independent of the model
    _extract_extra(user_text, mem, None if clarifying else pending_topic)

    # Reason about what was said: anything that needs a closer look goes on the agenda and is asked about first.
    reasoning.detect(user_text, mem)
    follow = reasoning.next_question(mem, user_text)
    if follow:
        qid, ack, question = follow
        return {"reply": f"{ack or ACKS[len(transcript) % len(ACKS)]} {question}".strip(), "engine": "agent", "note": "", "next_topic": f"clar:{qid}", "ready": False}

    missing = mem.missing()
    next_topic = missing[0] if missing else None
    reply, engine, note = "", "agent", ""
    if next_topic and next_topic != "features" and settings.intake_use_agent and settings.intake_chat_use_model and build_model() is not None:
        t = BY_KEY[next_topic]
        hint = f"Ask about “{t['label']}” next. Suggested question: {t['question']}"
        prompt = "\n".join([user_text, "", "(Internal note, never mention it.", "Captured so far:", mem.as_text(), hint + ")"])
        try:
            reply = await asyncio.wait_for(_run_agent(transcript, prompt, mem, ltm), timeout=settings.intake_agent_timeout)
            engine = "llm"
        except Exception:  # noqa: BLE001 - slow, unavailable or unusable: the built-in reasoning answers instead
            reply = ""

    missing_after = mem.missing()
    if not _usable(reply):
        engine = "agent"
        reply = fallback_reply(mem, missing_after[0] if missing_after else None, len(transcript), None if clarifying else pending_topic)
        next_topic = missing_after[0] if missing_after else None
        if next_topic == "features":
            # Feature ideas written for this business by the model; the fixed per-industry list is the fallback.
            ideas = await feature_ideas(mem)
            if ideas:
                engine = "llm"
                mem.data["_chips"] = ideas
                reply = f"{_acknowledge(mem, None if clarifying else pending_topic, len(transcript))} Which features should your website include? For a business like yours, people often want: {', '.join(ideas[:4])}. Pick any that fit, or describe your own."
    else:
        next_topic = next_topic if next_topic in missing_after else (missing_after[0] if missing_after else None)
    return {"reply": reply, "engine": engine, "note": note, "next_topic": next_topic, "ready": not missing_after}


# ───────────────────────── analyst (extra recommendations) ─────────────────────────
ANALYST = """You are a senior website strategist. Given a requirements summary, suggest up to 3 concrete, non-obvious
improvements the client has not asked for (for example a missing page, a trust signal, or a risk). Think about how this kind of
website is really used by its visitors and its owner, and which pages that requires. Reply with ONLY JSON:
{"suggestions": [{"title": "...", "why": "...", "page": "optional short name of a page to add"}]}. Each item under 25 words. Never repeat what they already asked for."""


async def analyst_suggestions(summary_text: str) -> list[dict]:
    if not settings.intake_use_agent or build_model() is None:
        return []

    text = await llm.complete(ANALYST, summary_text, json_mode=True, timeout=settings.intake_agent_timeout, max_tokens=600)
    data = llm.parse_json(text)
    out = []
    for item in (data.get("suggestions", []) if isinstance(data, dict) else [])[:3]:
        if isinstance(item, dict) and item.get("title"):
            entry = {"title": str(item["title"])[:120], "why": str(item.get("why", ""))[:240], "priority": "medium", "source": "ai"}
            if item.get("page") and len(str(item["page"]).split()) <= 3:
                entry["page"] = str(item["page"]).strip()[:40]
            out.append(entry)
    return out
