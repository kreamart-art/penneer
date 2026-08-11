"""Pen Neer — toezicht: merken dat er iets mis is voordat een speler het zegt.

Er was geen enkele manier om te weten hoe de server erbij stond. Ging er iets
stuk in de socket, dan ving `ws.py` de fout op en gooide hem weg: geen regel in
het log, geen teller, niets. Liep de schijf vol of stopte de nachtelijke kopie
met werken, dan bleef dat stil tot het te laat was.

DRIE LAGEN, want ze zien elk iets anders.

1. `/healthz` is de hartslag naar buiten. Hij doet nu ook echt iets: een lees
   op de database. Lukt dat niet, dan is het antwoord 503 en niet 200, zodat
   een pinger van buiten rood ziet in plaats van groen.
2. `admin_status` is de meterkast: geheugen, schijf, database, de laatste
   fouten, wat de rem heeft geweigerd. Voor als je WEL kijkt.
3. De bewaaklus is voor als je NIET kijkt. Elk kwartier langs de dingen die
   stil kapotgaan (schijf vol, kopie te oud, fouten die zich opstapelen) en bij
   narigheid gaat er een melding naar de baas. Elk alarm hoogstens één keer per
   twaalf uur, anders is het na de tweede keer ruis en kijkt niemand meer.

WAT DIT NIET ZIET. Ligt het proces zelf plat, dan draait deze lus ook niet.
Daarvoor staat er een wachter OP de host (buiten de container) die elke vijf
minuten `/healthz` opvraagt en mailt als het twee keer misgaat; zie
`scripts/wachter.sh`. Sterft de hele machine, dan zwijgen ze allebei: dat is
het moment voor een dienst van buiten, en die moet iemand met een account
aanzetten.
"""
from __future__ import annotations

import asyncio
import os
import shutil
import time
import traceback
from collections import deque
from pathlib import Path
from typing import Any, Deque, Optional

from . import backup, push, rem
from .db import DB_PATH, get_db

START = time.time()

#: Wie het alarm krijgt. Een naam en niet een id, want een naam kun je onthouden.
BAAS = os.environ.get("PENNEER_BAAS", "Kream")

#: Hoe vaak de lus rondgaat, en hoe lang een alarm zijn mond houdt daarna.
RONDE_S = 15 * 60
STIL_S = 12 * 3600

#: Drempels. Ruim, want een vals alarm is erger dan een laat alarm: na twee
#: keer loos wordt de melding weggeklikt zonder lezen.
SCHIJF_VRIJ_MIN = 0.10          # minder dan 10% vrij
SCHIJF_VRIJ_BYTES = 1_000_000_000   # of minder dan een gigabyte
KOPIE_MAX_UREN = 30.0           # de lus draait elke 6 uur, dus 30 is echt stuk
FOUTEN_PER_KWARTIER = 25

_fouten: Deque[dict] = deque(maxlen=50)
_fout_totaal = 0
_laatste_alarm: dict[str, float] = {}


# ---- fouten -----------------------------------------------------------------

#: Wat er altijd is en niets betekent: iemand loopt een tunnel in of legt zijn
#: telefoon weg terwijl de server nog aan het schrijven is. Zou dit meetellen,
#: dan sloeg het alarm aan op doodnormaal verkeer en keek er na een week
#: niemand meer naar.
_RUIS = ("WebSocketDisconnect", "ConnectionClosedOK", "ConnectionClosedError",
         "ConnectionResetError", "ClientDisconnected", "CancelledError",
         "BrokenPipeError")


def ruis(exc: BaseException) -> bool:
    if type(exc).__name__ in _RUIS:
        return True
    tekst = str(exc).lower()
    return isinstance(exc, RuntimeError) and ("websocket" in tekst or "close message" in tekst)


def fout(bron: str, exc: BaseException) -> None:
    """Leg een fout vast EN zet hem in het log.

    Bewust allebei: het log is waar je kijkt als je al weet dat er iets is, de
    ringbuffer is wat de meterkast laat zien als je nog niets weet.
    """
    global _fout_totaal
    if ruis(exc):
        return
    _fout_totaal += 1
    _fouten.append({
        "t": time.time(),
        "bron": bron,
        "soort": type(exc).__name__,
        "tekst": str(exc)[:200],
    })
    print(f"[fout] {bron}: {type(exc).__name__}: {exc}", flush=True)
    traceback.print_exc()


def fouten_sinds(seconden: float) -> int:
    grens = time.time() - seconden
    return sum(1 for f in _fouten if f["t"] >= grens)


# ---- wat er te melden valt --------------------------------------------------

def versie() -> str:
    """Welke uitrol hier draait. De build schrijft hem naast de SPA."""
    stat = os.environ.get("PENNEER_STATIC", "")
    if stat:
        pad = Path(stat) / "versie.txt"
        if pad.is_file():
            return pad.read_text().strip()[:20] or "?"
    bron = Path(__file__).resolve().parents[2] / "frontend" / "src" / "version.ts"
    if bron.is_file():
        for regel in bron.read_text().splitlines():
            if "APP_VERSION" in regel and '"' in regel:
                return regel.split('"')[1]
    return "dev"


def _schijf() -> dict:
    try:
        totaal, gebruikt, vrij = shutil.disk_usage(str(Path(DB_PATH).resolve().parent))
    except Exception:
        return {}
    return {"totaal": totaal, "vrij": vrij, "vrij_deel": round(vrij / totaal, 3) if totaal else 0}


def _geheugen() -> int:
    """RSS in bytes, of 0 waar /proc niet bestaat (macOS bij het ontwikkelen)."""
    try:
        with open("/proc/self/status") as f:
            for regel in f:
                if regel.startswith("VmRSS:"):
                    return int(regel.split()[1]) * 1024
    except Exception:
        pass
    return 0


def _db_maat() -> dict:
    uit: dict[str, int] = {}
    for naam, achter in (("db", ""), ("wal", "-wal")):
        try:
            uit[naam] = Path(DB_PATH + achter).stat().st_size
        except OSError:
            uit[naam] = 0
    return uit


def gezondheid() -> dict:
    """Het antwoord van /healthz. Klein, snel, en met een ECHTE controle erin."""
    ok = get_db().leeft()
    return {
        "ok": ok,
        "versie": versie(),
        "op": round(time.time() - START),
        "db": ok,
    }


def status() -> dict:
    """De meterkast. Alles wat je wilt zien als er iets aan de hand is."""
    # Hier pas importeren: ws importeert rooms importeert social, en die keten
    # loopt bij het opstarten al door dit bestand heen.
    from .ws import manager

    spelers = sum(len(r.players) for r in manager.rooms.values())
    return {
        "versie": versie(),
        "op": round(time.time() - START),
        "db_leeft": get_db().leeft(),
        "schijf": _schijf(),
        "geheugen": _geheugen(),
        "db_maat": _db_maat(),
        "kopie": backup.laatste(DB_PATH),
        "rooms": len(manager.rooms),
        "spelers": spelers,
        "verbindingen": len(manager.connections),
        "fouten_totaal": _fout_totaal,
        "fouten_kwartier": fouten_sinds(900),
        "fouten": list(_fouten)[-10:][::-1],
        "geweigerd": rem.stand(),
        "rem_aan": rem.AAN,
    }


# ---- de bewaaklus -----------------------------------------------------------

async def _alarm(sleutel: str, titel: str, tekst: str) -> None:
    """Meld het, maar hoogstens één keer per twaalf uur per soort."""
    nu = time.time()
    if nu - _laatste_alarm.get(sleutel, 0) < STIL_S:
        return
    _laatste_alarm[sleutel] = nu
    print(f"[alarm] {sleutel}: {tekst}", flush=True)
    uid = get_db().user_id_by_name(BAAS)
    if uid:
        await push.notify(uid, titel, tekst, tag=f"toezicht-{sleutel}", url="/")


def _klachten() -> list[tuple[str, str, str]]:
    """Wat er nu mis is. Leeg is goed."""
    uit: list[tuple[str, str, str]] = []

    if not get_db().leeft():
        uit.append(("db", "Pen Neer: database", "De database antwoordt niet meer."))

    schijf = _schijf()
    vrij = schijf.get("vrij", 0)
    if schijf and (schijf["vrij_deel"] < SCHIJF_VRIJ_MIN or vrij < SCHIJF_VRIJ_BYTES):
        uit.append(("schijf", "Pen Neer: schijf",
                    f"Nog {vrij // 1_000_000} MB vrij ({round(schijf['vrij_deel'] * 100)}%)."))

    kopie = backup.laatste(DB_PATH)
    uren = kopie.get("uren_oud")
    if kopie.get("aantal", 0) == 0:
        uit.append(("kopie", "Pen Neer: kopie", "Er staat geen enkele kopie van de database."))
    elif uren is not None and uren > KOPIE_MAX_UREN:
        uit.append(("kopie", "Pen Neer: kopie", f"De laatste kopie is {round(uren)} uur oud."))

    recent = fouten_sinds(900)
    if recent >= FOUTEN_PER_KWARTIER:
        uit.append(("fouten", "Pen Neer: fouten", f"{recent} fouten in het laatste kwartier."))

    return uit


async def bewaak() -> None:
    """De lus. Draait tot het proces stopt."""
    await asyncio.sleep(120)  # eerst rustig opstarten
    while True:
        try:
            for sleutel, titel, tekst in _klachten():
                await _alarm(sleutel, titel, tekst)
        except Exception as exc:  # de wachter mag zelf nooit de boel omleggen
            fout("toezicht", exc)
        await asyncio.sleep(RONDE_S)
