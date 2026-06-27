"""Pen Neer — pure game logic: normalization, validity, scoring, letter picking.

Everything here is deterministic and side-effect free (except letter picking,
which takes the RNG state via the used-letter list). Unit-testable in isolation.
"""
from __future__ import annotations

import random
import unicodedata

from .models import FULL_LETTER_POOL, LETTER_POOL, PT_FULL, PT_HALF, Answer, Round


def strip_diacritics(s: str) -> str:
    """Remove combining marks: 'ëé' -> 'ee', 'ç' -> 'c'."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize(text: str) -> str:
    """Normalized key for duplicate detection.

    lowercase, strip diacritics, keep only alphanumerics.
    """
    base = strip_diacritics(text).lower()
    return "".join(c for c in base if c.isalnum())


def first_letter(text: str) -> str:
    """First alphabetic character, diacritics stripped, uppercased.

    Lenient on IJ: the Dutch digraph 'ij' counts as starting with 'I'.
    Y is treated as itself (kept simple).
    """
    cleaned = strip_diacritics(text).strip()
    for ch in cleaned:
        if ch.isalpha():
            return ch.upper()
    return ""


def starts_with(text: str, letter: str) -> bool:
    """Case/diacritic-insensitive check that text starts with letter.

    Lenient on IJ/Y: when the round letter is I, an answer starting with IJ
    is fine (it already starts with I). When the round letter is Y, accept an
    answer starting with IJ as well, since the schoolyard game treats them
    loosely.
    """
    if not text.strip():
        return False
    fl = first_letter(text)
    target = strip_diacritics(letter).upper()
    if fl == target:
        return True
    # IJ/Y leniency
    if target == "Y" and fl == "I":
        return True
    if target == "I" and fl == "Y":
        return True
    return False


def pick_letter(
    used_letters: list[str], hard_letters: bool = False, rng: random.Random | None = None
) -> str:
    """Pick a random letter not yet used this game.

    With hard_letters off, Q/X/Y are excluded. If the pool is exhausted, reset
    (letters do not repeat until exhausted).
    """
    rng = rng or random
    pool = FULL_LETTER_POOL if hard_letters else LETTER_POOL
    available = [c for c in pool if c not in used_letters]
    if not available:
        available = list(pool)
    return rng.choice(available)


def auto_validate(text: str, letter: str) -> bool:
    """Provisional validity: non-empty and starts with the round letter."""
    return bool(text and text.strip()) and starts_with(text, letter)


def score_round(rnd: Round, player_ids: list[str], categories: list[str]) -> dict[str, dict[str, int]]:
    """Compute points[player_id][category] for a round.

    For each category, gather valid answers across all players (by normalized
    key). Unique -> PT_FULL. Shared by 2+ -> PT_HALF each. Invalid/empty -> 0.

    Challenges set Answer.valid = False before this runs; invalid answers are
    excluded from the duplicate count entirely.
    """
    points: dict[str, dict[str, int]] = {pid: {} for pid in player_ids}

    for cat in categories:
        # Map normalized key -> list of player_ids who gave a valid answer.
        buckets: dict[str, list[str]] = {}
        for pid in player_ids:
            ans = rnd.answers.get(pid, {}).get(cat)
            if ans is None or not ans.valid:
                points[pid][cat] = 0
                continue
            key = normalize(ans.text)
            if not key:
                points[pid][cat] = 0
                continue
            buckets.setdefault(key, []).append(pid)

        for key, pids in buckets.items():
            value = PT_FULL if len(pids) == 1 else PT_HALF
            for pid in pids:
                points[pid][cat] = value

    return points


def total_scores(history: list[Round], player_ids: list[str]) -> dict[str, int]:
    """Sum every round's points per player into a running game scoreboard."""
    scores = {pid: 0 for pid in player_ids}
    for rnd in history:
        for pid in player_ids:
            scores[pid] += sum(rnd.points.get(pid, {}).values())
    return scores


# Small suffix bank for bot answers. A limited bank means bots sometimes collide,
# which is exactly what we want to exercise the unique/dubbel scoring.
_BOT_SUFFIXES = ["aan", "el", "o", "ie", "us", "and", "er", "ka"]


def bot_answer(letter: str, cat: str, rng: random.Random) -> str:
    """Generate a plausible, valid-looking answer that starts with the letter.

    Bots sometimes skip a category (empty) so results look human.
    """
    if rng.random() < 0.12:
        return ""
    suffix = rng.choice(_BOT_SUFFIXES)
    return (letter.upper() + suffix)


def build_answers(
    raw: dict[str, dict[str, str]], letter: str, player_ids: list[str], categories: list[str]
) -> dict[str, dict[str, Answer]]:
    """Turn raw {player_id: {cat: text}} into validated Answer objects.

    Missing entries become empty, invalid Answers so the results screen shows a
    blank crossed-out slot rather than nothing.
    """
    out: dict[str, dict[str, Answer]] = {}
    for pid in player_ids:
        out[pid] = {}
        player_raw = raw.get(pid, {})
        for cat in categories:
            text = (player_raw.get(cat) or "").strip()
            out[pid][cat] = Answer(text=text, valid=auto_validate(text, letter))
    return out
