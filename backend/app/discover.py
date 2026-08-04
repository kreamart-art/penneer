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
import hashlib
import random
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


# ---- dagletter --------------------------------------------------------------


def daily_letter(user_id: str, day: str | None = None) -> str:
    """De letter van vandaag voor deze speler.

    Deterministisch uit user_id en datum, dus vernieuwen verandert hem niet en
    er hoeft niets opgeslagen te worden om hem terug te vinden. Per speler
    verschillend, want de dagletter van Ontdekken is een persoonlijke oefening
    en geen ranglijst; wie samen speelt hoeft niet dezelfde letter te hebben.

    Q, X en Y vallen af: die hebben zo weinig kaarten dat een dagronde erop
    binnen een minuut op is en de volgende dag niets nieuws meer geeft.
    """
    pool = [c for c in LETTERS if c not in ("Q", "X", "Y")]
    sleutel = f"{user_id}|{day or today()}".encode()
    n = int(hashlib.sha256(sleutel).hexdigest()[:8], 16)
    return pool[n % len(pool)]


# ---- herhalen (Leitner) -----------------------------------------------------
# Drie bakken. Fout valt terug naar 1, goed schuift een bak op. De wachttijden
# lopen op zodat iets wat je twee keer goed had niet morgen alweer langskomt.

BOX_DAGEN = {1: 1, 2: 3, 3: 10}
MAX_BOX = 3
REVIEW_LIMIET = 10          # hoeveel kaarten een herhaalronde hoogstens pakt


def volgende_box(box: int, goed: bool) -> int:
    """Waar de kaart na dit antwoord terechtkomt."""
    box = max(1, min(int(box or 1), MAX_BOX))
    if not goed:
        return 1
    return min(box + 1, MAX_BOX)


def volgende_review(box: int, goed: bool, now: float) -> float | None:
    """Wanneer de kaart weer langskomt, of None als hij klaar is.

    Klaar is alleen: in de hoogste bak EN goed. Dan heb je hem drie keer op rij
    geweten met steeds langere tussenpozen, en dan is doorgaan tijd afnemen van
    de kaarten die je nog niet kent.
    """
    if goed and box >= MAX_BOX:
        return None
    nieuw = volgende_box(box, goed)
    return now + BOX_DAGEN[nieuw] * 86400


# ---- quiz -------------------------------------------------------------------

QUIZ_VRAGEN = 5             # vragen per ronde
QUIZ_OPTIES = 4             # een goede plus drie foute


def maak_vragen(
    kandidaten: list[dict],
    category: str,
    aantal: int = QUIZ_VRAGEN,
    rnd: "random.Random | None" = None,
    pool: list[dict] | None = None,
) -> list[dict]:
    """Bouw quizvragen uit de facts van kaarten.

    `kandidaten` zijn de kaarten waarover GEVRAAGD wordt: die moet de speler
    hebben, anders is het geen overhoring maar gokken. `pool` levert alleen de
    foute antwoorden en mag de hele categorie zijn. Zonder pool is dat dezelfde
    lijst.

    Die scheiding is nodig en niet cosmetisch: met vijf kaarten in bezit zou
    elke vraag dezelfde vier opties krijgen. Ze samenvoegen tot één lijst werkt
    ook niet, want dan gaan de meeste vragen over kaarten die de speler niet
    heeft en houd je er na het filteren bijna niets over.

    Elke vraag is: dit is de kaart, dit is het feitveld, wat hoort erbij. De
    drie foute antwoorden komen uit HETZELFDE veld, want een fout antwoord uit
    een ander veld verraadt zichzelf: bij "hoofdstad" is "Europa" geen keuze
    maar een grap.

    Een veld doet alleen mee als de pool er minstens vier verschillende waarden
    voor heeft. Anders vallen de foute antwoorden samen met het goede en staat
    dezelfde optie twee keer in de lijst.
    """
    r = rnd or random.Random()
    velden = quiz_fields(category)
    if not velden or not kandidaten:
        return []
    bron = pool if pool is not None else kandidaten

    # Per veld alle waarden die in de POOL voorkomen, ontdubbeld.
    waarden: dict[str, list[str]] = {}
    for veld in velden:
        gezien = {(k.get("facts") or {}).get(veld, "").strip() for k in bron}
        waarden[veld] = sorted(w for w in gezien if w)

    # Alle bruikbare combinaties van een EIGEN kaart en een veld, dan schudden.
    mogelijk = [
        (k, veld)
        for k in kandidaten
        for veld in velden
        if (k.get("facts") or {}).get(veld, "").strip()
        and len(waarden[veld]) >= QUIZ_OPTIES
    ]
    r.shuffle(mogelijk)

    vragen: list[dict] = []
    gebruikt: set[int] = set()
    for kaart, veld in mogelijk:
        if len(vragen) >= aantal:
            break
        # Niet twee vragen over dezelfde kaart in een ronde van vijf: dan
        # voelt het als een overhoring van een kaart in plaats van een ronde.
        if kaart["id"] in gebruikt:
            continue
        juist = (kaart.get("facts") or {})[veld].strip()
        anders = [w for w in waarden[veld] if w != juist]
        if len(anders) < QUIZ_OPTIES - 1:
            continue
        opties = r.sample(anders, QUIZ_OPTIES - 1) + [juist]
        r.shuffle(opties)
        gebruikt.add(kaart["id"])
        vragen.append({
            "card_id": kaart["id"],
            "word": kaart["word"],
            "veld": veld,
            "opties": opties,
            "juist": juist,
        })
    return vragen


def zonder_antwoord(vragen: list[dict]) -> list[dict]:
    """Wat de client mag zien: alles behalve welk antwoord goed is."""
    labels = {}
    for cat in CATEGORIES:
        for rij in fact_rows(cat):
            labels[rij["key"]] = rij["label"]
    return [
        {
            "index": i,
            "card_id": v["card_id"],
            "word": v["word"],
            "veld": v["veld"],
            "label": labels.get(v["veld"], v["veld"]),
            "opties": v["opties"],
        }
        for i, v in enumerate(vragen)
    ]
