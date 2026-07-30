"""Pen Neer — de Arena: het derde deel van de dagronde.

Elke weekdag heeft zijn eigen spel, en over alle zeven gelden dezelfde drie
regels:

  1. CEILINGLOOS scoren. Geen "20 van de 20" maar een score die blijft klimmen
     tot je faalt. Daardoor lopen de getallen ver uiteen en bestaan gelijke
     standen praktisch niet.
  2. HERHAALBAAR, beste telt. De ronde staat 24 uur open en je speelt zo vaak
     als je wil, gratis. Alleen je beste poging staat op het bord.
  3. VERDRINGING. Wie van plek 1 wordt gestoten hoort dat meteen, met de tijd
     die nog rest om terug te slaan. Dat kan alleen omdat regel 2 bestaat.

De rotatie is een vaste weekkalender. Een spel dat nog niet gebouwd is staat er
wel in ("af": False): de tegel toont dan de naam van het spel van vandaag met
"binnenkort", zodat de kalender vanaf dag een klopt en er nooit een dag stil
uitziet zonder uitleg.

De SEED per dag komt uit de datum, net als de dagletter: iedereen speelt
dezelfde reeks, anders is de ranglijst een loterij. De client genereert het
spel uit de seed; de server controleert bij het inleveren alleen wat hij kan
weten zonder mee te spelen: bestaat de poging, is hij van jou, is hij nog open,
en is de score fysiek mogelijk binnen de gespeelde tijd.
"""

from __future__ import annotations

import datetime
import hashlib

# Weekdag (maandag = 0) -> spel. De key is ook de i18n-sleutel op de client
# (arena_<key> en arena_<key>_uitleg).
GAMES: dict[int, dict] = {
    0: {"key": "woordketen", "af": False},
    1: {"key": "wereldprik", "af": False},
    2: {"key": "waaghet", "af": False},
    3: {"key": "flitsreeks", "af": True},
    4: {"key": "lettersoep", "af": False},
    5: {"key": "kleurenklem", "af": False},
    6: {"key": "rekenladder", "af": False},
}


def spel_voor(day: str) -> dict:
    """Het spel van deze dag: {key, af}."""
    try:
        wd = datetime.date.fromisoformat(day).weekday()
    except ValueError:
        wd = 0
    return GAMES[wd]


def seed_voor(day: str) -> str:
    """De dagseed waar de client het spel uit genereert. Deterministisch uit de
    datum, zodat elke speler exact dezelfde opgaven krijgt."""
    return hashlib.sha256(f"penneer-arena:{day}".encode()).hexdigest()


def plausibel(game: str, score: int, level: int, time_ms: int) -> bool:
    """Kan deze score echt zijn? De server speelt niet mee, dus dit is geen
    bewijs; het is de ondergrens die scriptjes en ongeduld eruit filtert.

    Per spel twee vragen: past de score bij het gehaalde level, en is de
    gespeelde tijd lang genoeg om dat level ECHT te halen?
    """
    if score < 0 or level < 0 or time_ms < 0:
        return False
    if game == "flitsreeks":
        # Score-contract met de client: per voltooide reeks van lengte k komt
        # er k*100 bij, plus een snelheidsbonus van hoogstens 99 per reeks.
        basis = 50 * level * (level + 1)          # som k*100 voor k=1..level
        if not (basis <= score <= basis + 99 * level or (level == 0 and score == 0)):
            return False
        # Tijd: reeks k kost minstens k keer (flits + tik). De flits duurt per
        # element minstens 260ms en een tik minstens 60ms; we rekenen ruim de
        # helft, want de laatste (gefaalde) reeks telt niet mee in level.
        minimum = sum(k * 160 for k in range(1, level + 1))
        return time_ms >= minimum
    # Spellen die nog niet af zijn accepteren geen inzendingen.
    return False
