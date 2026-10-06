"""Agent memory.

* `SessionMemory`  short-term: what has been learned in this interview, one entry per topic.
* `LongTermMemory` long-term: preferences that carry over to the user's next interview (industry, style, ...).

Both expose plain functions that the Strands agent calls as tools, and both serialize to JSON so they can be
stored on the database rows that own them.
"""

from typing import Any

from app.intake.topics import BY_KEY, LIST_TOPICS, TOPIC_KEYS, TOPICS, is_filled, parse


class SessionMemory:
    def __init__(self, data: dict | None = None):
        self.data: dict[str, Any] = dict(data or {})
        self.changed: list[str] = []  # topics written during the current turn

    # -- functions the agent can call ---------------------------------
    def remember(self, topic: str, value: Any) -> str:
        if topic not in BY_KEY:
            return f"Unknown topic '{topic}'. Use one of: {', '.join(TOPIC_KEYS)}."
        parsed = parse(topic, value) if isinstance(value, str) else value
        current = self.data.get(topic)
        if topic in LIST_TOPICS and isinstance(current, list) and isinstance(parsed, list):
            merged = current + [x for x in parsed if x not in current]
            parsed = merged
        if topic == "pages" and isinstance(current, dict) and isinstance(parsed, dict):
            names = current.get("names", []) + [n for n in parsed.get("names", []) if n not in current.get("names", [])]
            parsed = {"count": parsed.get("count") or current.get("count") or len(names) or None, "names": names}
        self.data[topic] = parsed
        if topic not in self.changed:
            self.changed.append(topic)
        return f"Remembered {topic}."

    def recall(self, topic: str | None = None) -> Any:
        return self.data.get(topic) if topic else dict(self.data)

    def forget(self, topic: str) -> str:
        self.data.pop(topic, None)
        return f"Forgot {topic}."

    # -- progress -----------------------------------------------------
    def missing(self, required_only: bool = True) -> list[str]:
        return [t["key"] for t in TOPICS if (t["required"] or not required_only) and not is_filled(self.data.get(t["key"]))]

    def progress(self) -> dict:
        required = [t["key"] for t in TOPICS if t["required"]]
        done = [k for k in required if is_filled(self.data.get(k))]
        return {"captured": len(done), "total": len(required), "topics": {t["key"]: is_filled(self.data.get(t["key"])) for t in TOPICS}}

    def as_text(self) -> str:
        if not self.data:
            return "Nothing captured yet."
        lines = []
        for t in TOPICS:
            v = self.data.get(t["key"])
            if is_filled(v):
                if isinstance(v, dict):
                    v = f"{v.get('count') or '?'} pages: {', '.join(v.get('names', [])) or 'names not given'}"
                elif isinstance(v, list):
                    v = ", ".join(v) or "none"
                lines.append(f"- {t['label']}: {v}")
        return "\n".join(lines)


class LongTermMemory:
    """Facts about the person that are useful in future interviews."""

    KEYS = ("industry", "style", "business_name", "integrations", "tone", "typical_pages")

    def __init__(self, data: dict | None = None):
        self.data: dict[str, Any] = dict(data or {})

    def remember(self, key: str, value: Any) -> str:
        if key not in self.KEYS:
            return f"Unknown preference '{key}'. Use one of: {', '.join(self.KEYS)}."
        self.data[key] = value
        return f"Saved preference {key}."

    def recall(self) -> dict:
        return dict(self.data)

    def greeting_hint(self) -> str:
        d = self.data
        if not d:
            return ""
        bits = []
        if d.get("business_name") or d.get("industry"):
            bits.append(f"your {d.get('industry') or 'last'} project {('“' + d['business_name'] + '”') if d.get('business_name') else ''}".strip())
        if d.get("style"):
            bits.append(f"a {d['style']} look")
        return "Welcome back! Last time you worked on " + " with ".join(bits) + ". Building something new, or another version of that?" if bits else ""
