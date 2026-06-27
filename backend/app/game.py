"""Pen Neer — pure game logic: normalization, validity, scoring, letter picking.

Everything here is deterministic and side-effect free (except letter picking,
which takes the RNG state via the used-letter list). Unit-testable in isolation.
"""
from __future__ import annotations

import random
import unicodedata

from .models import FULL_LETTER_POOL, LETTER_POOL, PT_FULL, PT_HALF, Answer, Round
from .wordlists import RAW

MIN_ANSWER_LEN = 2  # a lone letter never counts


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


# Normalized lookup set per checkable category (built once at import).
WORD_SETS: dict[str, set[str]] = {cat: {normalize(w) for w in words} for cat, words in RAW.items()}

# Original words grouped by first letter, so bots can play real list words.
_BOT_WORDS: dict[str, dict[str, list[str]]] = {}
for _cat, _words in RAW.items():
    _by_letter: dict[str, list[str]] = {}
    for _w in _words:
        _fl = first_letter(_w)
        if _fl:
            _by_letter.setdefault(_fl, []).append(_w)
    _BOT_WORDS[_cat] = _by_letter


def _plural_variants(key: str) -> set[str]:
    """A few light stems so 'appels' matches 'appel', 'honden' matches 'hond'."""
    out = {key}
    if key.endswith("s") and len(key) > 3:
        out.add(key[:-1])
    if key.endswith("en") and len(key) > 4:
        out.add(key[:-2])
    return out


def in_wordlist(text: str, category: str) -> bool:
    """True if the answer is in the category's list. Open categories (no list)
    return True (nothing to check against)."""
    words = WORD_SETS.get(category)
    if words is None:
        return True
    key = normalize(text)
    if not key:
        return False
    return any(v in words for v in _plural_variants(key))


def classify(text: str, letter: str, category: str) -> tuple[bool, bool]:
    """Return (valid, in_list).

    valid drives scoring (counts or not); in_list drives the results display:
    in a checked category, a valid answer NOT in the list shows an orange "?".
    Wrong letter, empty, or shorter than MIN_ANSWER_LEN never counts.
    """
    t = (text or "").strip()
    key = normalize(t)
    if len(key) < MIN_ANSWER_LEN or not starts_with(t, letter):
        return (False, False)
    return (True, in_wordlist(t, category))


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
    """Generate a plausible answer that starts with the letter.

    For checked categories the bot plays a REAL word from the list (so green
    checks and dubbels happen naturally); otherwise a letter+suffix stub. Bots
    sometimes skip a category (empty) so results look human.
    """
    if rng.random() < 0.12:
        return ""
    words = _BOT_WORDS.get(cat, {}).get(letter.upper())
    if words:
        return rng.choice(words)
    return letter.upper() + rng.choice(_BOT_SUFFIXES)


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
            valid, in_list = classify(text, letter, cat)
            out[pid][cat] = Answer(text=text, valid=valid, in_list=in_list)
    return out
