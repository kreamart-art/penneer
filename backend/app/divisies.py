"""Pen Neer — divisies: het schild om je portret, en hoe je stijgt of daalt.

Het schild had een kleur die je zelf koos. Dat is aardig maar het zegt niets:
een kleur die iedereen kan kiezen is versiering, geen rang. Nu VERDIEN je hem.

De regel, in één zin: elke maandag kijkt de app naar de week die net voorbij is,
en wie in die week bij de eerste drie van de ranglijst stond gaat een divisie
omhoog; wie speelde maar er ver onder bleef zakt er een. Speelde je die week
helemaal niet, dan verandert er niets: wegblijven mag geen straf zijn, want dan
speelt iemand die op vakantie was zich terug naar beneden.

Waarom maandag en niet doorlopend: een stand die per potje verspringt is geen
divisie maar een teller. Eén moment per week maakt er iets van waar je naartoe
speelt, en het geeft de app een vast moment om iets te vieren.

De evaluatie gebeurt LAZY, op het moment dat je de app opent, net als de
seizoenswinnaar-badge. Er draait dus geen cron; er is alleen een weeknummer dat
onthoudt tot wanneer je al beoordeeld bent, en zolang dat achterloopt worden de
weken één voor één ingehaald.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Optional

# De ladder, van laag naar hoog. De kleuren zijn de schild-art die er al ligt.
# Zwart-met-goud staat bovenaan: dat is de enige die niet als kleur leest maar
# als materiaal, en dat hoort bij de top.
DIVISIES = ["paars", "blauw", "lichtblauw", "groen", "rood", "zilver", "zwart"]
HOOGSTE = len(DIVISIES) - 1

# Bij welke plek je stijgt, en onder welke plek je zakt.
STIJG_TOT = 3     # plek 1 tot en met 3
DAAL_VANAF = 10   # plek 10 of lager, of buiten de lijst terwijl je wel speelde

DAG = 86400
WEEK = 7 * DAG


def kleur_van(divisie: int) -> str:
    """De schildkleur die bij een divisie hoort."""
    return DIVISIES[max(0, min(HOOGSTE, int(divisie or 0)))]


def week_van(ts: float) -> int:
    """Het weeknummer sinds het begin van de tijdrekening, maandag als grens.

    1 januari 1970 was een donderdag, dus de deling schuift drie dagen op om op
    maandag uit te komen. Zo is 'de week ervoor' altijd hetzelfde blok voor
    iedereen, ongeacht wanneer op de dag je de app opent.
    """
    return int((ts + 3 * DAG) // WEEK)


def week_grenzen(week: int) -> tuple[float, float]:
    """Begin en eind (in seconden) van een weeknummer."""
    start = week * WEEK - 3 * DAG
    return start, start + WEEK


def volgende_maandag(ts: Optional[float] = None) -> float:
    """Wanneer de eerstvolgende beoordeling valt. Voor de aftelling in de app."""
    nu = ts if ts is not None else time.time()
    return week_grenzen(week_van(nu) + 1)[0]


def maandag_datum(week: int) -> str:
    """De maandag van een week als YYYY-MM-DD, voor in de melding."""
    start, _ = week_grenzen(week)
    return datetime.fromtimestamp(start, timezone.utc).strftime("%Y-%m-%d")


def beoordeel(plek: Optional[int], gespeeld: int, divisie: int) -> tuple[int, str]:
    """Wat er met je divisie gebeurt na een week.

    `plek` is je positie op de weekranglijst (1-gebaseerd) of None als je er
    niet op stond. `gespeeld` is hoeveel potjes je die week speelde.

    Geeft de nieuwe divisie terug plus wat er gebeurde: "op", "neer" of "blijft".
    """
    if gespeeld <= 0:
        return divisie, "blijft"
    if plek is not None and plek <= STIJG_TOT:
        return min(HOOGSTE, divisie + 1), ("op" if divisie < HOOGSTE else "blijft")
    if plek is None or plek >= DAAL_VANAF:
        return max(0, divisie - 1), ("neer" if divisie > 0 else "blijft")
    return divisie, "blijft"


# De namen van de zeven treden, gelijk aan DIVISIE_NAMEN op de client. Ze staan
# hier omdat een melding ("je staat nu in Smaragd") de naam nodig heeft en de
# server geen frontend-bestand kan lezen. Wijzigt de een, wijzig dan de ander.
NAMEN = ["Amethist", "Saffier", "Azuur", "Smaragd", "Robijn", "Platina", "Obsidiaan"]


def naam(divisie: int) -> str:
    return NAMEN[max(0, min(len(NAMEN) - 1, int(divisie or 0)))]


def inhalen(db, user_id: str, nu: Optional[float] = None) -> Optional[dict]:
    """Werk de divisie bij tot en met de vorige week.

    Geeft de openstaande verandering terug (om te vieren), of None. De
    verandering wordt in de database bewaard tot de speler hem gezien heeft:
    wie de app precies op maandag herlaadt zou zijn eigen promotie anders
    missen, en dat is nou net het moment dat je wilt vieren.
    """
    nu = nu if nu is not None else time.time()
    huidig = week_van(nu)
    rij = db.divisie_van(user_id)
    divisie = int(rij.get("divisie") or 0)
    tot = int(rij.get("divisie_week") or 0)
    open_change = rij.get("divisie_change")
    if tot == 0:
        # Eerste keer: vanaf nu meedoen, met terugwerkende kracht niets.
        db.zet_divisie(user_id, divisie, huidig)
        return None
    if tot >= huidig:
        return _lees(open_change)

    laatste: Optional[dict] = None
    # Nooit meer dan een handvol weken inhalen: wie een jaar wegblijft hoeft
    # niet tweeënvijftig keer te zakken.
    eerste = max(tot, huidig - 8)
    for week in range(eerste, huidig):
        start, eind = week_grenzen(week)
        plek, gespeeld = db.week_plek(user_id, start, eind)
        nieuw, wat = beoordeel(plek, gespeeld, divisie)
        if wat != "blijft":
            laatste = {
                "week": week,
                "datum": maandag_datum(week + 1),
                "van": divisie,
                "naar": nieuw,
                "richting": wat,
                "plek": plek,
                "gespeeld": gespeeld,
            }
        divisie = nieuw
    db.zet_divisie(user_id, divisie, huidig, json.dumps(laatste) if laatste else None)
    return laatste or _lees(open_change)


def _lees(rauw) -> Optional[dict]:
    if not rauw:
        return None
    try:
        return json.loads(rauw)
    except (TypeError, ValueError):
        return None
