"""Pen Neer — Ontdekken (discover mode).

Every word from the curated lists in wordlists.py is a collectible card. This
module holds the pure, DB-free part of that: which categories exist, which fact
rows a card of a given category shows, and how a word becomes a card key.

The tables live in db.py with the rest of the schema; the endpoints in main.py
under /api/discover. Nothing here touches sqlite or FastAPI, so it stays cheap
to unit-test.

Two things differ from the rest of the app on purpose:

- Category keys are lowercase here ('land'), while game.RAW uses the display
  form ('Land'). The DB key must survive a rename of the visible label, so it
  is its own thing; CAT_TO_LIST maps between them.
- The daily letter rolls over at local midnight, not at 21:00 like the Dagronde.
  The Dagronde closes at 21:00 because it is a ranked round that everyone plays
  against the same clock. Ontdekken is solo and its streak is personal, so a
  calendar day is what a player expects.
"""
from __future__ import annotations

import datetime as dt
import re
import unicodedata

from . import game
from .daily import TZ

# ---- categories -------------------------------------------------------------
# The five checkable categories. Open categories (Jongen, Meisje, Ding) have no
# curated list, so they cannot become cards: there would be no finite set to
# collect and no facts to put on the back.

LAND = "land"
STAD = "stad"
VRUCHT = "vrucht"
DIER = "dier"
BEROEP = "beroep"

CATEGORIES = (LAND, STAD, VRUCHT, DIER, BEROEP)

# DB key -> key in game.RAW / wordlists.py
CAT_TO_LIST = {
    LAND: "Land",
    STAD: "Stad",
    VRUCHT: "Vrucht",
    DIER: "Dier",
    BEROEP: "Beroep",
}
LIST_TO_CAT = {v: k for k, v in CAT_TO_LIST.items()}

# What the player sees as the row label in the hub.
CAT_LABEL = {
    LAND: "Land",
    STAD: "Stad",
    VRUCHT: "Vrucht",
    DIER: "Dier",
    BEROEP: "Beroep",
}

LETTERS = tuple(chr(c) for c in range(ord("A"), ord("Z") + 1))

# Where a card unlock can come from.
SOURCES = ("practice", "quiz", "daily", "review")

# ---- fact schema ------------------------------------------------------------
# Per category: which rows the card back shows, in this order, with the Dutch
# label the frontend renders. The frontend reads this from /overview so a new
# fact row never needs a frontend release.
#
# `quiz` marks a field the quiz may build a question from. It needs short,
# comparable, single-value answers, so free prose is excluded: "weetje" is a
# sentence and would make a nonsense multiple choice. Every category therefore
# keeps at least two quizzable fields.

FACT_SCHEMA: dict[str, tuple[dict, ...]] = {
    LAND: (
        {"key": "hoofdstad", "label": "Hoofdstad", "quiz": True},
        {"key": "werelddeel", "label": "Werelddeel", "quiz": True},
        {"key": "taal", "label": "Taal", "quiz": True},
        {"key": "weetje", "label": "Weetje", "quiz": False},
    ),
    STAD: (
        {"key": "land", "label": "Land", "quiz": True},
        {"key": "inwoners", "label": "Inwoners", "quiz": False},
        {"key": "bekend_om", "label": "Bekend om", "quiz": True},
        {"key": "weetje", "label": "Weetje", "quiz": False},
    ),
    VRUCHT: (
        {"key": "herkomst", "label": "Herkomst", "quiz": True},
        {"key": "kleur", "label": "Kleur", "quiz": True},
        {"key": "smaak", "label": "Smaak", "quiz": True},
        {"key": "weetje", "label": "Weetje", "quiz": False},
    ),
    DIER: (
        {"key": "leefgebied", "label": "Leefgebied", "quiz": True},
        {"key": "grootte", "label": "Grootte", "quiz": False},
        {"key": "voedsel", "label": "Voedsel", "quiz": True},
        {"key": "weetje", "label": "Weetje", "quiz": False},
    ),
    BEROEP: (
        {"key": "sector", "label": "Sector", "quiz": True},
        {"key": "werkplek", "label": "Werkplek", "quiz": True},
        {"key": "opleiding", "label": "Opleiding", "quiz": True},
        {"key": "weetje", "label": "Weetje", "quiz": False},
    ),
}


def fact_rows(category: str) -> tuple[dict, ...]:
    return FACT_SCHEMA.get(category, ())


def quiz_fields(category: str) -> tuple[str, ...]:
    return tuple(f["key"] for f in fact_rows(category) if f["quiz"])


# ---- keys -------------------------------------------------------------------

_SLUG_STRIP = re.compile(r"[^a-z0-9]+")


def slugify(word: str) -> str:
    """Stable key for a card inside its category.

    Built on game.normalize so a card key and the answer-matching in Oefenen can
    never drift apart: whatever the game considers the same word must land on
    the same card. The extra step here only makes it URL- and filename-safe,
    because it is also the image filename on /static/cards.
    """
    base = game.normalize(word or "")
    base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode()
    return _SLUG_STRIP.sub("-", base).strip("-")


def letter_of(word: str) -> str:
    """The letter tile a word belongs to, uppercase A..Z.

    Uses the normalized form so "IJsland" and "Israël" land where a player
    expects them, and anything outside A..Z falls back to '#' rather than
    creating a tile nobody can reach.
    """
    s = game.normalize(word or "")
    if not s:
        return "#"
    c = s[0].upper()
    return c if c in LETTERS else "#"


def today(now: dt.datetime | None = None) -> str:
    """Today in the app timezone, 'YYYY-MM-DD'. Rolls at local midnight."""
    return (now or dt.datetime.now(TZ)).date().isoformat()


def image_path_for(category: str, slug: str) -> str:
    """Waar de kaart-art ligt zodra hij bestaat.

    WebP en geen JPEG: de art is de HELE kaart, gouden lijst en al, met
    afgeschuinde hoeken die doorzichtig zijn. JPEG kent geen alfa en zou daar
    zwarte driehoekjes van maken. Staand, 658 bij 1012, de maat van het
    sjabloon in Oefenen/.
    """
    return f"/static/cards/{category}/{category}_{slug}.webp"


# ---- unlocking --------------------------------------------------------------
# What a round is allowed to hand out. The client sends the words it played and
# saw, but it does not get to decide what those are worth: everything below is
# checked against the curated list the server already holds, so a crafted
# request can never unlock a card that a genuine round of the same letter would
# not also have revealed.


def playable_norms(category: str, letter: str) -> set[str]:
    """Normalized forms that genuinely belong to this category and letter.

    Straight from game.list_words_for_letter, the same source the reveal at the
    end of a practice round uses. That is the whole guard: a card can only come
    from a word the server itself would have shown for this letter.
    """
    listname = CAT_TO_LIST.get(category)
    if not listname:
        return set()
    return {game.normalize(w) for w in game.list_words_for_letter(listname, letter)}


def match_words(category: str, letter: str, words) -> list[str]:
    """Filter submitted words down to the normalized forms a round may unlock.

    Deduped, order preserved. Anything not on the curated list for this exact
    letter is dropped without comment: it is either a typo, an open-category
    answer, or someone poking at the endpoint.
    """
    allowed = playable_norms(category, letter)
    out: list[str] = []
    seen: set[str] = set()
    for w in words or []:
        n = game.normalize(str(w or ""))
        if n and n in allowed and n not in seen:
            seen.add(n)
            out.append(n)
    return out
