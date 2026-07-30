"""Pen Neer — Dagronde (daily round) logic.

One letter per day, the SAME for everyone (unlike Oefenen, where every player
gets a different random sequence — the whole point of a daily is comparable
scores). Deterministic from the date, so every server instance and restart
agrees without storing anything. Scoring is list-first with no human
corrections; words the curated list misses are settled once by the AI referee
and then cached in word_verdicts, so every player on the board is judged by the
same verdict — which is what a ranked daily needs.

De ronde sluit om 21:00 Nederlandse tijd (de spelersgroep), niet om
middernacht en niet op UTC. Om negen uur 's avonds is iedereen thuis: dan valt
de uitslag op een moment dat je hem ook kunt zien, in plaats van in je slaap.
De ronde die om 21:00 sluit draagt de datum van DIE dag, dus na 21:00 loopt de
ronde van morgen al.
"""
from __future__ import annotations

import datetime as dt
import random
from zoneinfo import ZoneInfo

from . import game
from .models import LETTER_POOL

TZ = ZoneInfo("Europe/Amsterdam")  # tzdata pip package backs this on slim images

# Het uur waarop de ronde sluit en de volgende begint (lokale tijd).
SLUIT_UUR = 21

DURATION_S = 60          # fill window
GRACE_S = 15             # network/submit slack on top of the window
POINTS_PER_WORD = 10     # score = list words x this (max 50 with 5 categories)
REVEAL_CAP = 12          # missed-words shown per category (same as training)
BOARD_LIMIT = 25


def now_local() -> dt.datetime:
    return dt.datetime.now(TZ)


def today(now: dt.datetime | None = None) -> str:
    """De ronde die NU loopt, bijvoorbeeld '2026-07-13'.

    De naam is de dag waarop de ronde sluit. Voor 21:00 is dat vandaag; daarna
    loopt de ronde die morgen om 21:00 sluit, dus dan is het morgen.
    """
    n = now or now_local()
    d = n.date()
    if n.hour >= SLUIT_UUR:
        d += dt.timedelta(days=1)
    return d.isoformat()


def sluit_op(day: str) -> dt.datetime:
    """Het moment waarop deze ronde dicht gaat."""
    return dt.datetime.combine(dt.date.fromisoformat(day), dt.time(SLUIT_UUR), TZ)


def seconds_to_next_day(now: dt.datetime | None = None) -> int:
    n = now or now_local()
    return max(1, int((sluit_op(today(n)) - n).total_seconds()))


def previous_day(day: str) -> str:
    return (dt.date.fromisoformat(day) - dt.timedelta(days=1)).isoformat()


def _seeded_letter(day: str, salt: str = "") -> str:
    return random.Random(f"penneer-daily:{day}:letter{salt}").choice(list(LETTER_POOL))


def letter_for(day: str) -> str:
    """Everyone gets this letter on this day (Q/X/Y stay out of LETTER_POOL).

    The letter is chosen once and stored, and picked to differ from the PREVIOUS
    stored day's letter, so you never get the same letter two days in a row. On
    the common case (no clash) it equals the plain seeded pick, so today's letter
    is unchanged when this first runs."""
    from .db import get_db

    db = get_db()
    stored = db.daily_letter_get(day)
    if stored:
        return stored
    base = _seeded_letter(day)
    prev = db.daily_letter_get(previous_day(day))
    if prev and base == prev:
        pool = [c for c in LETTER_POOL if c != prev]
        base = random.Random(f"penneer-daily:{day}:letter-alt").choice(pool)
    return db.daily_letter_set(day, base)


def categories_for(day: str) -> list[str]:
    """All five list-checked categories, in a day-seeded order (cosmetic)."""
    cats = list(game.TRAINABLE_CATEGORIES)
    random.Random(f"penneer-daily:{day}:cats").shuffle(cats)
    return cats


def score_answers(day: str, answers: dict, lenient: bool = False,
                  approved: set | None = None) -> tuple[int, dict]:
    """Judge a submission against the day's letter. Returns (score, per-cat).

    List words count 10 each. `approved` holds (category, normalized word) pairs
    the AI referee already OK'd — real words the curated list simply misses, like
    'zwaluw'. Those count too and show green. Verdicts are cached server-side and
    shared by everyone, so the day board stays comparable.

    With lenient on (a per-account dyslexia aid) a near-miss spelling of a real
    list word counts too, via the same fuzzy match the room option uses.
    """
    approved = approved or set()
    letter = letter_for(day)
    out: dict[str, dict] = {}
    score = 0
    for cat in categories_for(day):
        word = str((answers or {}).get(cat) or "").strip()[:40]
        valid, in_list_exact = game.classify(word, letter, cat)
        if lenient and valid:
            canon = game.list_canonical(word, cat, lenient=True)
            in_list = canon is not None
        else:
            in_list = in_list_exact
            canon = game.list_canonical(word, cat) if in_list else None
        if valid and not in_list and (cat, game.normalize(word)) in approved:
            in_list = True          # the referee vouched for it
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
