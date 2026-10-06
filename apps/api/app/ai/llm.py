"""One small door to whichever language model is configured (OpenRouter or Claude if a key is set, otherwise local Ollama).

Used for work that really needs a model: rewriting copy in another tone and translating. Everything is
timeout-guarded and returns None on failure, so callers can fall back or explain.
"""

import json
import logging
import re
import time

import httpx

from app.core.config import get_settings

settings = get_settings()
log = logging.getLogger(__name__)


last_problem = ""  # a plain-language reason for the last failure that the user can act on (for example, no credits)
_openrouter_paused_until = 0.0  # set after a 429 so every call doesn't wait on a quota that is used up


async def _openrouter(system: str, messages: list[dict], timeout: float, max_tokens: int, temperature: float, model: str | None = None) -> str:
    global _openrouter_paused_until, last_problem
    body: dict = {"model": model or settings.openrouter_model, "max_tokens": max_tokens, "temperature": temperature, "messages": [{"role": "system", "content": system}, *messages]}
    if settings.openrouter_reasoning_effort:
        body["reasoning"] = {"effort": settings.openrouter_reasoning_effort, "exclude": True}
    headers = {"Authorization": f"Bearer {settings.openrouter_api_key}", "X-Title": "VIBE"}
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(f"{settings.openrouter_base_url.rstrip('/')}/chat/completions", json=body, headers=headers)
    if res.status_code == 402:
        last_problem = "OpenRouter says the account is out of credits (402 Payment Required). Add credits at openrouter.ai, then try again."
    if res.status_code == 429:
        # The free tier has a daily cap; pause until it resets (or a few minutes when the reset time is unknown).
        try:
            reset = float(res.json()["error"]["metadata"]["headers"]["X-RateLimit-Reset"]) / 1000
        except Exception:  # noqa: BLE001
            reset = 0.0
        _openrouter_paused_until = max(reset, time.time() + 300)
    res.raise_for_status()
    choice = res.json()["choices"][0]
    if choice.get("finish_reason") == "length":
        log.warning("LLM openrouter reply was cut off at max_tokens=%s (model %s)", max_tokens, body["model"])
    return str(choice["message"].get("content") or "").strip()


async def _anthropic(system: str, messages: list[dict], timeout: float, max_tokens: int) -> str:
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=timeout)
    res = await client.messages.create(model="claude-sonnet-5", max_tokens=max_tokens, system=system, messages=messages)
    return "".join(b.text for b in res.content if getattr(b, "type", "") == "text").strip()


async def _ollama(system: str, messages: list[dict], json_mode: bool, timeout: float, max_tokens: int, temperature: float) -> str:
    body: dict = {
        "model": settings.ollama_model,
        "stream": False,
        "keep_alive": "30m",
        "options": {"temperature": temperature, "num_predict": max_tokens, "num_ctx": 4096},
        "messages": [{"role": "system", "content": system}, *messages],
    }
    if json_mode:
        body["format"] = "json"
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(f"{settings.ollama_base_url.rstrip('/')}/api/chat", json=body)
        res.raise_for_status()
    return str(res.json().get("message", {}).get("content", "")).strip()


async def chat(system: str, messages: list[dict], *, json_mode: bool = False, timeout: float = 60.0, max_tokens: int = 1500, temperature: float = 0.2, model: str | None = None, local_fallback: bool = True) -> str | None:
    """The model's reply to a conversation ([{"role": "user" | "assistant", "content": str}, ...]), or None if every model failed.

    Tries OpenRouter, then Claude, then local Ollama, in that order, skipping any that is not configured.
    `model` picks a different OpenRouter model for this call (for example a stronger one for the UI agent).
    """
    attempts = []
    if settings.openrouter_api_key and time.time() >= _openrouter_paused_until:
        attempts.append(("openrouter", lambda: _openrouter(system, messages, timeout, max_tokens, temperature, model)))
    if settings.anthropic_api_key:
        attempts.append(("anthropic", lambda: _anthropic(system, messages, timeout, max_tokens)))
    if settings.ai_provider.lower() == "ollama" and (local_fallback or not attempts):  # a small local model can't write whole code files
        attempts.append(("ollama", lambda: _ollama(system, messages, json_mode, timeout, max_tokens, temperature)))
    for name, call in attempts:
        try:
            reply = await call()
            if reply:
                return reply
        except Exception as exc:  # noqa: BLE001 - try the next model; callers handle "no answer"
            log.warning("LLM %s failed: %s", name, str(exc)[:200])
    return None


async def complete(system: str, user: str, *, json_mode: bool = False, timeout: float = 60.0, max_tokens: int = 1500) -> str | None:
    """The model's reply text, or None if no model is available or it failed."""
    return await chat(system, [{"role": "user", "content": user}], json_mode=json_mode, timeout=timeout, max_tokens=max_tokens)


def parse_json(text: str | None):
    if not text:
        return None
    m = re.search(r"[\[{].*[\]}]", text, re.S)
    try:
        return json.loads(m.group(0)) if m else None
    except ValueError:
        return None


def has_model() -> bool:
    return bool(settings.openrouter_api_key) or bool(settings.anthropic_api_key) or settings.ai_provider.lower() == "ollama"
