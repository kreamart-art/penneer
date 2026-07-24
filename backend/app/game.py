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


def letter_pool(hard_letters: bool = False) -> list[str]:
    """The letters in play under the current settings (Q/X/Y only when hard)."""
    return list(FULL_LETTER_POOL if hard_letters else LETTER_POOL)


def pool_exhausted(used_letters: list[str], hard_letters: bool = False) -> bool:
    """True once every letter of the current pool has been drawn."""
    used = set(used_letters)
    return all(c in used for c in letter_pool(hard_letters))


def pick_letter(
    used_letters: list[str], hard_letters: bool = False, rng: random.Random | None = None
) -> str:
    """Pick a random letter not yet used in this room.

    With hard_letters off, Q/X/Y are excluded. If the pool is exhausted, reset
    (letters do not repeat until every letter has been drawn).
    """
    rng = rng or random
    available = [c for c in letter_pool(hard_letters) if c not in used_letters]
    if not available:
        available = letter_pool(hard_letters)
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


# Real-looking answers for the OPEN categories. Jongen/Meisje/Ding carry no
# wordlist (any letter-matching word is valid), so without their own banks the
# bots emitted "letter+suffix" gibberish ("Aaan") that instantly outed them as
# bots and, worse, still scored green. These give them believable names/things.
_BOT_JONGEN = [
    "Aron", "Adam", "Alex", "Abel", "Aiden", "Ahmed",
    "Bram", "Bas", "Ben", "Boris", "Bart", "Bilal",
    "Cas", "Chris", "Colin", "Cedric", "Christiaan",
    "Daan", "David", "Dylan", "Dennis", "Dave", "Damian",
    "Emiel", "Elias", "Erik", "Ewout", "Evan",
    "Finn", "Floris", "Frank", "Ferry", "Fedde", "Faas",
    "Gijs", "Guus", "Giel", "Gerard", "Gio",
    "Hugo", "Hidde", "Hans", "Henk", "Hamza",
    "Ivo", "Ivan", "Ismael", "Idris",
    "Jan", "Jesse", "Job", "Joris", "Julian", "Jayden", "Jack",
    "Kai", "Kees", "Kevin", "Koen", "Karel", "Kaan",
    "Lars", "Luuk", "Levi", "Liam", "Lucas", "Lou",
    "Max", "Mees", "Milan", "Mohammed", "Mark", "Mike",
    "Noah", "Niels", "Nick", "Nout", "Nathan",
    "Otis", "Olivier", "Oscar", "Onno", "Omar",
    "Pieter", "Pim", "Paul", "Peter", "Pepijn",
    "Ruben", "Rick", "Robin", "Roel", "Ravi", "Rens",
    "Sem", "Sam", "Stijn", "Sven", "Said", "Senna",
    "Tim", "Thomas", "Teun", "Tygo", "Tobias", "Tarik",
    "Ubbo", "Umut", "Ugur",
    "Victor", "Vince", "Valentijn", "Vigo",
    "Wout", "Willem", "Wesley", "Wim",
    "Zack", "Zeb", "Zion", "Ziggy",
]
_BOT_MEISJE = [
    "Anna", "Amber", "Aisha", "Ava", "Anouk", "Amira",
    "Britt", "Bo", "Bente", "Bibi", "Bella",
    "Cato", "Chloe", "Charlotte", "Cindy", "Claire",
    "Demi", "Dana", "Dewi", "Daphne", "Deniz",
    "Emma", "Eva", "Elin", "Esmee", "Evi", "Elif",
    "Fleur", "Femke", "Fenna", "Faye", "Fatima",
    "Gwen", "Gina", "Guusje", "Gaby",
    "Hannah", "Hedi", "Hailey", "Hind", "Hana",
    "Isa", "Iris", "Ilse", "Imke", "Ines",
    "Julia", "Jasmijn", "Jill", "Jolijn", "Jade", "Jana",
    "Kim", "Kiki", "Kayla", "Kate", "Kaya",
    "Lisa", "Lynn", "Luna", "Lieke", "Lara", "Layla",
    "Mila", "Maud", "Mia", "Mette", "Maryam", "Marit",
    "Noor", "Nina", "Nova", "Nadia", "Naomi",
    "Olivia", "Ona", "Ouarda",
    "Pip", "Puck", "Paula", "Priya",
    "Roos", "Rosa", "Renske", "Rania", "Romy",
    "Sofie", "Sara", "Saar", "Sophie", "Selin",
    "Tess", "Tessa", "Tara", "Tinne", "Tirza",
    "Uma", "Ulrike",
    "Vera", "Veerle", "Vlinder", "Vajèn",
    "Wende", "Willemijn", "Wies",
    "Zoe", "Zara", "Zita", "Zeynep",
]
_BOT_DING = [
    "Auto", "Anker", "Agenda", "Antenne",
    "Bal", "Bed", "Bank", "Boek", "Bord", "Bezem",
    "Computer", "Cadeau", "Camera",
    "Deur", "Doos", "Deken", "Douche",
    "Emmer", "Ei", "Envelop",
    "Fiets", "Fles", "Foto", "Fluit", "Fornuis",
    "Glas", "Gitaar", "Gordijn", "Gsm",
    "Hamer", "Huis", "Hoed", "Hark",
    "Iglo", "Inktpot", "Ijskast",
    "Jas", "Juk", "Jurk", "Jerrycan",
    "Kast", "Kom", "Kaars", "Klok", "Kussen", "Kruk",
    "Lamp", "Lepel", "Ladder", "Laken", "Lade",
    "Mes", "Mand", "Mat", "Muts", "Molen",
    "Naald", "Net", "Nietmachine",
    "Oven", "Ordner", "Orgel",
    "Pen", "Pan", "Potlood", "Poster", "Paraplu",
    "Radio", "Raam", "Riem", "Rugzak", "Rok",
    "Stoel", "Sok", "Schaar", "Servet", "Spiegel",
    "Tafel", "Tas", "Telefoon", "Trui", "Toeter",
    "Uurwerk", "Ukelele",
    "Vork", "Vaas", "Vlag", "Vaatdoek", "Viool",
    "Wiel", "Wekker", "Wasmand", "Wasknijper",
    "Zak", "Zaag", "Zeep", "Zadel", "Zwaard",
]


def _bank_by_letter(words: list[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for _w in words:
        _fl = first_letter(_w)
        if _fl:
            out.setdefault(_fl, []).append(_w)
    return out


_BOT_OPEN: dict[str, dict[str, list[str]]] = {
    "Jongen": _bank_by_letter(_BOT_JONGEN),
    "Meisje": _bank_by_letter(_BOT_MEISJE),
    "Ding": _bank_by_letter(_BOT_DING),
}


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


def _edit_distance_capped(a: str, b: str, maxd: int) -> int:
    """Levenshtein distance, capped: returns maxd + 1 as soon as it exceeds."""
    if abs(len(a) - len(b)) > maxd:
        return maxd + 1
    if maxd <= 0:
        return 0 if a == b else 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        row_min = i
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            v = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            cur.append(v)
            if v < row_min:
                row_min = v
        if row_min > maxd:
            return maxd + 1
        prev = cur
    return prev[-1]


def _fuzzy_budget(key: str) -> int:
    """How many letters a spelling may be off, by word length.

    Short words stay exact (too easy to morph one word into another); medium
    words get 1, long words 2. The FIRST letter is never fuzzed: it is the game.
    """
    n = len(key)
    if n < 4:
        return 0
    if n <= 6:
        return 1
    return 2


def list_canonical(text: str, category: str, lenient: bool = False) -> str | None:
    """The normalized list word this answer matches, or None.

    Exact (incl. light plural stems) always matches. With lenient on, a spelling
    that is a near-miss of a list word (bounded edit distance, same first
    letter) matches too: 'miloen' -> 'meloen'. Deterministic: closest match
    wins, ties broken alphabetically.
    """
    words = WORD_SETS.get(category)
    if words is None:
        return None
    key = normalize(text)
    if not key:
        return None
    # Deterministic order: the word as typed first, then stemmed variants
    # sorted, so every player's identical answer canonicalizes identically.
    variants = [key] + sorted(_plural_variants(key) - {key})
    for v in variants:
        if v in words:
            return v
    if not lenient:
        return None
    best: tuple[int, str] | None = None
    for v in variants:
        budget = _fuzzy_budget(v)
        if budget == 0:
            continue
        first = v[0]
        for w in words:
            if not w or w[0] != first:
                continue
            d = _edit_distance_capped(v, w, budget)
            if d <= budget and (best is None or (d, w) < best):
                best = (d, w)
    return best[1] if best else None


# Categories that have a curated list, so they can be TRAINED (the reveal shows
# the words you missed). Open categories (Jongen/Meisje/Ding) are excluded.
TRAINABLE_CATEGORIES = list(RAW.keys())


def list_words_for_letter(category: str, letter: str) -> list[str]:
    """Display words (as written in the list) in this category that start with
    the letter, deduped by normalized form and alphabetized. Powers the
    training reveal ("words you did not name yet")."""
    words = RAW.get(category)
    if not words:
        return []
    seen: set[str] = set()
    out: list[str] = []
    # Sorted so the base form (shorter) is met before its plural, then collapse
    # plural variants the same way scoring does (vijg == vijgen), so the reveal
    # never shows the same word twice. NL/EN variants stay (both are teachable).
    for w in sorted(words, key=normalize):
        if not starts_with(w, letter):
            continue
        variants = _plural_variants(normalize(w))
        if seen & variants:
            continue
        seen |= variants
        out.append(w)
    return out


def classify(text: str, letter: str, category: str) -> tuple[bool, bool]:
    """Return (valid, in_list).

    valid drives scoring (counts or not); in_list drives the results display:
    in a checked category, a valid answer NOT in the list shows an orange "?".
    Wrong letter, empty, or shorter than MIN_ANSWER_LEN never counts.

    NB: fuzzy near-misses deliberately do NOT green-check here, even in lenient
    rooms. Edit distance cannot tell 'Miloen' (means meloen) from 'bier' (a
    real word that just is not an animal); an audit measured ~10% of common
    Dutch words wrongly matching a Dier list word. So a near-miss stays "?"
    and the AI referee (judging phonetically in lenient rooms) decides; the
    fuzzy match only powers Answer.canon so spelling variants score as dubbel.
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
            # canon is set by build_answers; in lenient rooms 'miloen' and
            # 'meloen' share a canon so they count as dubbel, not two uniques.
            key = ans.canon or normalize(ans.text)
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
    """Generate a human-looking answer that (usually) starts with the letter.

    The point is to read like a real opponent, mistakes and all:
    - Open categories (Jongen/Meisje/Ding) draw a real name/thing from the bot
      banks, so they look like a person typed them, not "Aaan".
    - Checked categories mostly play a REAL list word (natural greens + dubbels),
      but now and then a plausible off-list guess, the way a real player writes
      something that turns out not to count (an orange "?").
    - Either way bots leave the odd box blank, because people run out of time.
    """
    L = letter.upper()
    # People miss some boxes (blanked, ran out of time).
    if rng.random() < 0.12:
        return ""
    open_bank = _BOT_OPEN.get(cat)
    if open_bank is not None:
        words = open_bank.get(L)
        # No name for this (hard) letter? Leave it blank rather than emit
        # gibberish, since an open category greens ANY letter-matching word.
        return rng.choice(words) if words else ""
    words = _BOT_WORDS.get(cat, {}).get(L)
    if words:
        # ~1 in 6 is a plausible guess that isn't on the list, a human "?"
        # moment rather than a flawless encyclopedia.
        if rng.random() < 0.16:
            return L + rng.choice(_BOT_SUFFIXES)
        return rng.choice(words)
    # Checked category with no list word for this letter: a plausible guess.
    return L + rng.choice(_BOT_SUFFIXES)


def build_answers(
    raw: dict[str, dict[str, str]],
    letter: str,
    player_ids: list[str],
    categories: list[str],
    lenient: bool = False,
) -> dict[str, dict[str, Answer]]:
    """Turn raw {player_id: {cat: text}} into validated Answer objects.

    Missing entries become empty, invalid Answers so the results screen shows a
    blank crossed-out slot rather than nothing. In lenient (soepele spelling)
    rooms each answer also gets a canonical key so near-miss spellings of the
    same word score as dubbel.
    """
    out: dict[str, dict[str, Answer]] = {}
    for pid in player_ids:
        out[pid] = {}
        player_raw = raw.get(pid, {})
        for cat in categories:
            text = (player_raw.get(cat) or "").strip()
            valid, in_list = classify(text, letter, cat)
            canon = (list_canonical(text, cat, lenient=True) if lenient and valid else None) or normalize(text)
            out[pid][cat] = Answer(text=text, valid=valid, in_list=in_list, canon=canon)
    return out
