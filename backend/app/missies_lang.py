"""Week- en seizoensmissies.

De dagmissies in missions.py tellen mee via bump_all: elk potje, elke dagronde
en elk chatbericht duwt een teller omhoog. Dat werkt voor een dag, maar voor een
week of een maand is het broos. Mist een bump ooit zijn moment, bijvoorbeeld
omdat de server tijdens een potje herstart, dan loopt een missie van dertig
dagen de rest van de maand achter en is er geen weg terug.

Daarom worden deze missies niet BIJGEHOUDEN maar BEREKEND. De voortgang is een
telling over tabellen die er toch al zijn: game_players voor de potjes, winsten,
unieke woorden en punten, daily_scores en topo_scores voor de dagrondes, duels
voor de duels. Herstart de server, dan klopt de stand nog steeds, en een missie
die halverwege wordt toegevoegd telt met terugwerkende kracht mee.

Het enige dat wel wordt opgeslagen is of je je beloning hebt OPGEHAALD, want dat
is een gebeurtenis en geen telling. Dat staat in mission_claims.

Beloningen zijn XP, en op het seizoen een enkele cash. Munten hebben al drie
kranen (levels, dagmissies en de dagronde) en een vierde zou de winkelprijzen
uithollen. Cash moet SCHAARS blijven: de week betaalde eerst 3-6 per missie en
dat telde op tot een scheidsrechter per anderhalve maand uit missies alleen,
dus de week betaalt nu niets en het seizoen precies 1 per missie.
"""

from __future__ import annotations

import datetime
import random
from typing import Any

# key -> (teller, doel, XP, coins, cash). De teller verwijst naar een telling in
# db.missie_teller. Keys komen in mission_claims te staan, dus hernoem er nooit
# een; alleen toevoegen.
#
# Week en seizoen betalen XP en MUNTEN. Cash zit op precies EEN plek: de
# seizoensmissie met de honderd dubbele woorden. Zo blijft cash schaars zonder
# dat de missies leeg aanvoelen.
WEEK_POOL: dict[str, tuple[str, int, int, int, int]] = {
    "wk_potjes": ("potjes", 10, 150, 150, 0),
    "wk_winsten": ("winsten", 3, 200, 200, 0),
    "wk_dagrondes": ("dagrondes", 5, 150, 150, 0),
    "wk_topo": ("topo", 4, 150, 150, 0),
    "wk_unieken": ("unieken", 40, 200, 200, 0),
    "wk_punten": ("punten", 400, 150, 150, 0),
    "wk_duels": ("duelwin", 2, 200, 200, 0),
    "wk_dubbels": ("dubbels", 25, 150, 150, 0),
    "wk_duelspeel": ("duels", 5, 150, 150, 0),
    "wk_dagpunten": ("dagpunten", 300, 200, 200, 0),
    "wk_potjes20": ("potjes", 20, 250, 250, 0),
    "wk_winsten6": ("winsten", 6, 300, 300, 0),
    "wk_unieken80": ("unieken", 80, 250, 250, 0),
}
SEIZOEN_POOL: dict[str, tuple[str, int, int, int, int]] = {
    "sz_potjes": ("potjes", 40, 600, 500, 0),
    "sz_winsten": ("winsten", 15, 800, 700, 0),
    "sz_dagrondes": ("dagrondes", 20, 600, 500, 0),
    "sz_unieken": ("unieken", 200, 800, 700, 0),
    "sz_duels": ("duelwin", 10, 600, 500, 0),
    "sz_punten": ("punten", 3000, 700, 600, 0),
    "sz_topo": ("topo", 15, 600, 500, 0),
    "sz_dubbels": ("dubbels", 100, 600, 0, 10),
    "sz_dagpunten": ("dagpunten", 1200, 700, 600, 0),
    "sz_duelspeel": ("duels", 25, 700, 600, 0),
}
WEEK_AANTAL = 4
SEIZOEN_AANTAL = 4


def week_id(nu: datetime.datetime | None = None) -> str:
    """De ISO-week als sleutel, bijvoorbeeld 2026-W31."""
    nu = nu or datetime.datetime.now()
    jaar, week, _ = nu.isocalendar()
    return f"{jaar}-W{week:02d}"


def seizoen_id(nu: datetime.datetime | None = None) -> str:
    """Het seizoen is de kalendermaand, net als de seizoensranglijst."""
    nu = nu or datetime.datetime.now()
    return f"{nu.year}-{nu.month:02d}"


# Het eerste seizoen was juli 2026: de maand waarin de maandranglijst live ging
# (de app zelf staat sinds eind juni 2026 online). Het nummer is dus het aantal
# maanden daarna, plus een.
SEIZOEN_EEN = (2026, 7)


def seizoen_nummer(nu: datetime.datetime | None = None) -> int:
    nu = nu or datetime.datetime.now()
    jaar, maand = SEIZOEN_EEN
    return max(1, (nu.year - jaar) * 12 + (nu.month - maand) + 1)


def week_venster(nu: datetime.datetime | None = None) -> tuple[datetime.datetime, datetime.datetime]:
    nu = nu or datetime.datetime.now()
    start = datetime.datetime.combine(nu.date() - datetime.timedelta(days=nu.weekday()), datetime.time.min)
    return start, start + datetime.timedelta(days=7)


def seizoen_venster(nu: datetime.datetime | None = None) -> tuple[datetime.datetime, datetime.datetime]:
    nu = nu or datetime.datetime.now()
    start = datetime.datetime(nu.year, nu.month, 1)
    eind = datetime.datetime(nu.year + (nu.month == 12), (nu.month % 12) + 1, 1)
    return start, eind


def _kies(pool: dict[str, tuple[str, int, int, int]], aantal: int, zaad: str) -> list[str]:
    """Deterministisch kiezen uit de pool, zodat elke server en elke telefoon
    dezelfde missies laat zien zonder dat het ergens opgeslagen hoeft."""
    keys = sorted(pool)
    random.Random(f"penneer-missies:{zaad}").shuffle(keys)
    return keys[:aantal]


def _lijst(db: Any, uid: str | None, pool, keys, periode, van, tot, geclaimd: set[str]) -> list[dict]:
    uit = []
    for key in keys:
        teller, doel, xp, coins, cash = pool[key]
        stand = db.missie_teller(uid, teller, van, tot) if uid else 0
        uit.append({
            "key": key,
            "teller": teller,
            "target": doel,
            "progress": min(doel, stand),
            "done": stand >= doel,
            "claimed": key in geclaimd,
            "reward": xp,
            "coins": coins,
            "cash": cash,
            "periode": periode,
        })
    return uit


def week_missies(db: Any, uid: str | None, nu: datetime.datetime | None = None) -> dict:
    nu = nu or datetime.datetime.now()
    periode = week_id(nu)
    van, tot = week_venster(nu)
    keys = _kies(WEEK_POOL, WEEK_AANTAL, periode)
    geclaimd = db.missie_claims(uid, periode) if uid else set()
    return {
        "periode": periode,
        "seconds_left": int((tot - nu).total_seconds()),
        "missions": _lijst(db, uid, WEEK_POOL, keys, periode, van, tot, geclaimd),
    }


def seizoen_missies(db: Any, uid: str | None, nu: datetime.datetime | None = None) -> dict:
    nu = nu or datetime.datetime.now()
    periode = seizoen_id(nu)
    van, tot = seizoen_venster(nu)
    keys = _kies(SEIZOEN_POOL, SEIZOEN_AANTAL, periode)
    geclaimd = db.missie_claims(uid, periode) if uid else set()
    return {
        "periode": periode,
        "nummer": seizoen_nummer(nu),
        "seconds_left": int((tot - nu).total_seconds()),
        "missions": _lijst(db, uid, SEIZOEN_POOL, keys, periode, van, tot, geclaimd),
    }


def zoek(periode_soort: str, key: str, nu: datetime.datetime | None = None):
    """De definitie achter een key, maar alleen als hij in de HUIDIGE periode
    actief is. Zo kan een oude of verzonnen key nooit worden opgehaald."""
    nu = nu or datetime.datetime.now()
    if periode_soort == "week":
        periode, pool, aantal = week_id(nu), WEEK_POOL, WEEK_AANTAL
        van, tot = week_venster(nu)
    elif periode_soort == "seizoen":
        periode, pool, aantal = seizoen_id(nu), SEIZOEN_POOL, SEIZOEN_AANTAL
        van, tot = seizoen_venster(nu)
    else:
        return None
    if key not in _kies(pool, aantal, periode):
        return None
    teller, doel, xp, coins, cash = pool[key]
    return {"periode": periode, "teller": teller, "target": doel, "reward": xp, "coins": coins, "cash": cash, "van": van, "tot": tot}
