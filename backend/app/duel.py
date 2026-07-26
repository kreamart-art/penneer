"""Pen Neer — Duel: 1 tegen 1, om beurten, gescoord op ZELDZAAMHEID.

Een duel is vijf rondes. Elke ronde is een categorie plus een gedraaide letter
("een dier met een B") en je typt één woord. Goed antwoord telt altijd, maar de
punten hangen af van hoeveel andere spelers datzelfde woord gaven: beer levert
weinig op, bever veel. Dat is de uniek/dubbel-regel van Pen Neer, uitgesmeerd
over iedereen die ooit speelde in plaats van over de vier mensen in je room.

Om beurten, niet live: de uitdager speelt meteen, de tegenstander wanneer het
uitkomt. Zo werkt matchmaking ook bij tien spelers per dag. Beide spelers
krijgen exact dezelfde vijf rondes in dezelfde volgorde.

De letters volgen de alfabetregel PER KOPPEL: binnen een duel vijf verschillende
letters, en een herkansing tussen dezelfde twee spelers put uit wat er nog over
is van het alfabet. Pas als het koppel het alfabet rond is beginnen de letters
opnieuw, en dan nog nooit met dezelfde categorie erbij als de vorige keer.

De frequentietabel is op dag één leeg, dus alles lijkt dan zeldzaam. Daarom
wordt de bovenste trede pas uitgedeeld zodra er genoeg antwoorden voor die
categorie-en-letter binnen zijn (MIN_SAMPLE); tot die tijd is "zeldzaam" het
maximum. Het spel scoort de eerste weken dus wat vlakker, maar wel eerlijk.
"""
from __future__ import annotations

import random

from .models import ALL_CATEGORIES, LETTER_POOL

ROUNDS = 5
ROUND_S = 15          # denktijd per ronde
ROUND_GRACE_S = 10    # netwerk/telefoon-slack bovenop het venster
EXPIRY_H = 48         # niet gespeeld binnen twee dagen = de ander wint

# XP is bewust lager dan een gewoon potje (dat levert punten + 40 winst + 15
# deelname op). Anders worden de level-beloningen op 20/30/50 goedkoper dan ze
# nu zijn. Bovendien tellen alleen de eerste paar duels van een dag mee, zodat
# je niet naar een level kan grinden door dezelfde vriend te blijven uitdagen.
XP_WIN, XP_DRAW, XP_LOSS = 30, 15, 10
XP_DUELS_PER_DAY = 3

# Onder dit aantal geregistreerde antwoorden voor een categorie+letter weten we
# simpelweg niet of een woord zeldzaam is, dus geldt "zeldzaam" als plafond.
MIN_SAMPLE = 20

# trede -> punten. Vijf rondes, dus 100 is perfect.
TIER_POINTS = {"uniek": 20, "zeldzaam": 15, "gewoon": 10, "populair": 5, "mis": 0}

# Grenzen op het aandeel spelers dat hetzelfde antwoord gaf.
SHARE_POPULAIR = 0.25
SHARE_GEWOON = 0.08


def tier_for(n_before: int, total_before: int) -> tuple[str, int, float]:
    """(trede, punten, aandeel) voor een GOED antwoord.

    n_before/total_before zijn de tellingen van vóór deze inzending, zodat je
    eigen antwoord je eigen zeldzaamheid niet verpest.
    """
    share = (n_before / total_before) if total_before else 0.0
    if share >= SHARE_POPULAIR:
        tier = "populair"
    elif share >= SHARE_GEWOON:
        tier = "gewoon"
    elif n_before > 0:
        tier = "zeldzaam"
    else:
        # Nog nooit gezien. Alleen echt "uniek" als de tabel dik genoeg is om
        # dat te kunnen weten; anders zou week één iedereen twintigen geven.
        tier = "uniek" if total_before >= MIN_SAMPLE else "zeldzaam"
    return tier, TIER_POINTS[tier], share


def pick_rounds(
    used_letters: list[str], last_combos: list[str], rng: random.Random | None = None
) -> tuple[list[dict], list[str], list[str]]:
    """Vijf rondes voor dit koppel.

    Geeft (rondes, nieuwe used_letters, nieuwe last_combos) terug. Letters komen
    uit wat het koppel nog niet gehad heeft; is dat op, dan begint het alfabet
    opnieuw en zorgt last_combos dat je niet meteen dezelfde categorie met
    dezelfde letter terugkrijgt.
    """
    rng = rng or random
    used = [c for c in (used_letters or []) if c in LETTER_POOL]
    available = [c for c in LETTER_POOL if c not in used]
    if len(available) < ROUNDS:
        used = []                       # alfabet rond: opnieuw beginnen
        available = list(LETTER_POOL)
    letters = rng.sample(available, ROUNDS)

    cats = list(ALL_CATEGORIES)
    rng.shuffle(cats)
    banned = set(last_combos or [])
    rounds: list[dict] = []
    for i, letter in enumerate(letters):
        # Neem de eerste nog ongebruikte categorie die geen herhaling van het
        # vorige duel oplevert; swap hem naar voren zodat categorieën binnen
        # dit duel altijd verschillen.
        pick = next((j for j in range(i, len(cats)) if f"{cats[j]}|{letter}" not in banned), i)
        cats[i], cats[pick] = cats[pick], cats[i]
        rounds.append({"letter": letter, "category": cats[i]})
    return rounds, used + letters, [f"{r['category']}|{r['letter']}" for r in rounds]


def outcome(score_a: int, score_b: int) -> str:
    """'a', 'b' of 'draw'."""
    if score_a > score_b:
        return "a"
    if score_b > score_a:
        return "b"
    return "draw"


def xp_for(result: str) -> int:
    """XP voor één speler, gegeven 'win' | 'draw' | 'loss'."""
    return {"win": XP_WIN, "draw": XP_DRAW, "loss": XP_LOSS}.get(result, 0)
