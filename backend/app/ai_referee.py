"""Pen Neer — optional AI referee for the orange "?" answers.

This is the hybrid layer: the word lists handle the bulk for free, and only the
answers that aren't in a list (the orange "?") are sent here to be resolved into
valid/invalid. The provider is pluggable so it can call Claude directly or route
through Nous (or any chat endpoint), and the credential lives server-side only.

Config (env):
  PENNEER_AI_PROVIDER   "anthropic" (default) | "nous"
  PENNEER_AI_KEY        API key / bearer token (required to be "available")
  PENNEER_AI_MODEL      model id (default "claude-haiku-4-5")
  PENNEER_AI_URL        endpoint URL (Nous chat endpoint; anthropic has a default)
  PENNEER_AI_ENABLED    "1" to start enabled (admin can also toggle at runtime)

The judge is best-effort: any error/timeout returns no verdicts and the answers
stay as "?", so the game never blocks on the AI.
"""
from __future__ import annotations

import json
import os
import re

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
TIMEOUT_S = 8.0


def provider() -> str:
    return (os.environ.get("PENNEER_AI_PROVIDER") or "anthropic").strip().lower()


def model() -> str:
    return (os.environ.get("PENNEER_AI_MODEL") or "claude-haiku-4-5").strip()


def _key() -> str:
    return (os.environ.get("PENNEER_AI_KEY") or "").strip()


def available() -> bool:
    """The referee can run only if a credential (or a Nous URL) is configured."""
    if provider() == "nous":
        return bool(os.environ.get("PENNEER_AI_URL"))
    return bool(_key())


def default_enabled() -> bool:
    return os.environ.get("PENNEER_AI_ENABLED", "") in ("1", "true", "True")


def status() -> dict:
    return {
        "available": available(),
        "provider": provider(),
        "model": model(),
    }


def _build_prompt(letter: str, items: list[tuple[str, str]]) -> str:
    lines = [
        "Je bent scheidsrechter in het woordspel Pen Neer.",
        f"De gevraagde beginletter is '{letter}'.",
        "Beoordeel per item of het antwoord een ECHT bestaand woord in de gevraagde",
        "categorie is (Nederlands of Engels) dat met die letter begint.",
        "Wees soepel met spelling en meervoud, streng op de categorie.",
        'Antwoord ALLEEN met JSON in dit formaat: {"results":[{"i":0,"ok":true}]}',
        "",
        "Items:",
    ]
    for idx, (cat, text) in enumerate(items):
        lines.append(f"{idx}. {cat}: \"{text}\"")
    return "\n".join(lines)


def _parse_results(raw: str, n: int) -> list[bool | None]:
    out: list[bool | None] = [None] * n
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return out
    try:
        data = json.loads(m.group(0))
    except Exception:
        return out
    for r in data.get("results", []):
        try:
            i = int(r.get("i"))
            if 0 <= i < n:
                out[i] = bool(r.get("ok"))
        except Exception:
            continue
    return out


async def _call_anthropic(client, prompt: str) -> str:
    resp = await client.post(
        ANTHROPIC_URL,
        headers={
            "x-api-key": _key(),
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
        json={
            "model": model(),
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        },
    )
    resp.raise_for_status()
    data = resp.json()
    # Concatenate any text blocks.
    parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
    return "".join(parts)


async def _call_nous(client, prompt: str) -> str:
    url = os.environ["PENNEER_AI_URL"]
    headers = {"content-type": "application/json"}
    if _key():
        headers["authorization"] = f"Bearer {_key()}"
    resp = await client.post(
        url,
        headers=headers,
        json={"model": model(), "messages": [{"role": "user", "content": prompt}]},
    )
    resp.raise_for_status()
    # Nous / chat endpoints vary; try the common shapes, fall back to raw text.
    try:
        data = resp.json()
    except Exception:
        return resp.text
    if isinstance(data, str):
        return data
    for key in ("text", "content", "reply", "message", "output"):
        v = data.get(key)
        if isinstance(v, str):
            return v
        if isinstance(v, dict) and isinstance(v.get("content"), str):
            return v["content"]
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message", {})
        if isinstance(msg.get("content"), str):
            return msg["content"]
    return resp.text


async def judge(letter: str, items: list[tuple[str, str]]) -> list[bool | None]:
    """Return a verdict per item: True (valid), False (invalid), None (undecided).

    Never raises — on any failure every verdict is None so callers leave the
    answers as "?".
    """
    if not items or not available():
        return [None] * len(items)
    try:
        import httpx
    except Exception:
        return [None] * len(items)
    prompt = _build_prompt(letter, items)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            raw = await (_call_nous(client, prompt) if provider() == "nous" else _call_anthropic(client, prompt))
        return _parse_results(raw, len(items))
    except Exception:
        return [None] * len(items)
