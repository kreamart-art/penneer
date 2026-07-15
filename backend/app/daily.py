"""Pen Neer — Dagronde (daily round) logic.

One letter per day, the SAME for everyone (unlike Oefenen, where every player
gets a different random sequence — the whole point of a daily is comparable
scores). Deterministic from the date, so every server instance and restart
agrees without storing anything. Scoring is list-only (no AI, no corrections):
deterministic and equal for all players, which is what a ranked daily needs.

The day rolls over at midnight Dutch time (the player base), not UTC.
"""
from __future__ import annotations

import datetime as dt
import random
from zoneinfo import ZoneInfo

from . import game
from .models import LETTER_POOL

TZ = ZoneInfo("Europe/Amsterdam")  # tzdata pip package backs this on slim images

DURATION_S = 60          # fill window
GRACE_S = 15             # network/submit slack on top of the window
POINTS_PER_WORD = 10     # score = list words x this (max 50 with 5 categories)
REVEAL_CAP = 12          # missed-words shown per category (same as training)
BOARD_LIMIT = 25


def now_local() -> dt.datetime:
    return dt.datetime.now(TZ)


def today() -> str:
    """The current daily-round day, e.g. '2026-07-13'."""
    return now_local().date().isoformat()


def seconds_to_next_day() -> int:
    n = now_local()
    tomorrow = dt.datetime.combine(n.date() + dt.timedelta(days=1), dt.time.min, TZ)
    return max(1, int((tomorrow - n).total_seconds()))


def previous_day(day: str) -> str:
    return (dt.date.fromisoformat(day) - dt.timedelta(days=1)).isoformat()


def letter_for(day: str) -> str:
    """Everyone gets this letter on this day. Q/X/Y stay out (LETTER_POOL)."""
    return random.Random(f"penneer-daily:{day}:letter").choice(list(LETTER_POOL))


def categories_for(day: str) -> list[str]:
    """All five list-checked categories, in a day-seeded order (cosmetic)."""
    cats = list(game.TRAINABLE_CATEGORIES)
    random.Random(f"penneer-daily:{day}:cats").shuffle(cats)
    return cats


def score_answers(day: str, answers: dict) -> tuple[int, dict]:
    """Judge a submission against the day's letter. Returns (score, per-cat).

    Only list words count (10 each): the daily has no correction round and no
    AI referee, so validity must be fully deterministic. A valid-letter word
    that is not on the list shows as the familiar orange '?' but scores 0.
    """
    letter = letter_for(day)
    out: dict[str, dict] = {}
    score = 0
    for cat in categories_for(day):
        word = str((answers or {}).get(cat) or "").strip()[:40]
        valid, in_list = game.classify(word, letter, cat)
        canon = game.list_canonical(word, cat) if in_list else None
        all_words = game.list_words_for_letter(cat, letter)
        missed = [w for w in all_words if game.normalize(w) != canon]
        if in_list:
            score += POINTS_PER_WORD
        out[cat] = {
            "your": word,
            "valid": valid,
            "in_list": in_list,
            "points": POINTS_PER_WORD if in_list else 0,
            "missed": missed[:REVEAL_CAP],
            "missed_total": len(missed),
            "list_total": len(all_words),
        }
    return score, out
