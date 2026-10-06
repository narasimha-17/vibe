"""API agent: designs the REST contract the UI and backend agents both build against."""

import json

from app.agents.base import AgentError, BuildContext, ask, missing_features, prompt, required_features, team_context
from app.ai import llm

NAME = "API agent"
SYSTEM = prompt("api_agent")  # prompts/api_agent.md



def _valid(contract) -> bool:
    eps = contract.get("endpoints") if isinstance(contract, dict) else None
    return isinstance(eps, list) and bool(eps) and all(isinstance(e, dict) and e.get("method") and str(e.get("path", "")).startswith("/api") for e in eps)


async def run(ctx: BuildContext) -> str:
    if not ctx.needs_backend:
        ctx.contract = None
        return "skipped: this site has no forms, shop or accounts, so it needs no API"
    extra = team_context(ctx, NAME)
    brief = ctx.spec + (f"\n\n{extra}" if extra else "")
    # A shop's contract is long, and thinking models spend part of the budget before answering: leave plenty of room.
    reply = await ask(ctx, SYSTEM, brief, max_tokens=24000, timeout=300)
    data = llm.parse_json(reply)
    if not _valid(data):
        # One retry, saying what went wrong (usually the JSON was cut off or wrapped in prose).
        retry = (f"{brief}\n\nYour previous answer was not a complete, valid JSON contract (it was {len(reply)} characters "
                 "and could not be parsed). Answer again with ONLY the JSON object, complete, with shorter purpose texts.")
        data = llm.parse_json(await ask(ctx, SYSTEM, retry, max_tokens=24000, timeout=300))
    if not _valid(data):
        raise AgentError("The API design came back incomplete twice (the model's reply was cut off or wasn't valid JSON). Try the build again.")
    # The contract must cover everything the site needs; one retry naming what's missing.
    missing = missing_features(data, required_features(ctx.project))
    if missing:
        retry = (f"{brief}\n\nYour previous contract misses required parts of this site:\n" + "\n".join(f"- {m}" for m in missing)
                 + "\nAnswer again with the COMPLETE contract (everything from before plus these), as ONLY the JSON object.")
        better = llm.parse_json(await ask(ctx, SYSTEM, retry, max_tokens=24000, timeout=300))
        if _valid(better):
            data, missing = better, missing_features(better, required_features(ctx.project))
        for m in missing:
            ctx.note(NAME, f"Not covered by the contract: {m}", "finding")
    for ep in data["endpoints"]:
        ep["method"] = str(ep["method"]).upper()
    ctx.contract = data
    ctx.note(NAME, "Contract endpoints: " + ", ".join(f"{e['method']} {e['path']}" for e in data["endpoints"][:40]))
    ctx.write({"api-contract.json": json.dumps(data, indent=2, ensure_ascii=False) + "\n"})
    return f"{len(data['endpoints'])} endpoints, {len(data.get('entities', []))} entities"


def contract_text(ctx: BuildContext) -> str:
    if not ctx.contract:
        return "There is no backend: the site is static."
    rows = [f"{e['method']} {e['path']}{' (needs login)' if e.get('auth') else ''}: {e.get('purpose', '')}; request {json.dumps(e.get('request'))}; response {e.get('response')}" for e in ctx.contract["endpoints"]]
    ents = "; ".join(f"{x.get('name')} {json.dumps(x.get('fields', {}))}" for x in ctx.contract.get("entities", []))
    return "API contract (base URL from the environment):\n" + "\n".join(rows) + f"\nEntities: {ents}\nSeed data: {ctx.contract.get('seed', '')}"
