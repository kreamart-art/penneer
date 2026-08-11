"""Pen Neer — de rem: hoe vaak iets mag.

De app had overal een grens op de GROOTTE van iets (een avatar van 300 kB, een
spraakbericht van 1,6 MB) en nergens een grens op hoe VAAK het mocht. Dat is
precies het gat waar het misgaat: één regel in een lus stuurt duizend
magic-links naar een adres dat niet van de afzender is, maakt duizend accounts
aan, of zet de schijf vol met foto's van drie megabyte. Niets in de code zei
ooit "nu even niet".

HOE. Een schuivend venster per sleutel: we onthouden de tijdstippen van de
laatste keren en tellen wat er binnen het venster valt. Geen bibliotheek en
geen Redis: dit is één proces met een paar honderd spelers, dus een woordenboek
met tijdstempels is genoeg en gaat mee met een herstart (wat prima is, een
herstart is zeldzamer dan het venster).

MET GEWICHT. Dezelfde teller doet ook megabytes: een regel telt `gewicht` op
in plaats van 1. Zo is "zestig uploads per uur" en "tachtig megabyte per uur"
hetzelfde mechanisme, en dat tweede is wat de schijf echt beschermt.

DE SLEUTEL. Per e-mailadres waar het om een adres gaat (anders kan iemand met
één IP nog steeds elk adres bestoken), per account waar iemand ingelogd is, en
anders per IP. Let op: achter de proxy staat het echte IP in
`X-Forwarded-For`; zonder die uitlezing zit de hele wereld achter één adres en
zet je bij de eerste de beste piek iedereen tegelijk op slot.

WAT DIT NIET IS. Geen beveiliging tegen iemand met duizend IP-adressen, en
geen firewall. Het is de rem die voorkomt dat één script, of één kapotte
client die in een lus blijft hangen, de kosten opdrijft of de schijf volzet.
"""
from __future__ import annotations

import os
import time
from collections import deque
from typing import Any, Deque, Dict

#: Uit te zetten met PENNEER_REM=0. Alleen bedoeld om in een test of bij een
#: incident even niet in de weg te zitten; standaard staat hij aan.
AAN = (os.environ.get("PENNEER_REM", "1") or "1").lower() not in ("0", "false", "off", "nee")

MB = 1_000_000

#: Hoeveel er geweigerd is, per rem. De statuspagina leest dit uit: een teller
#: die oploopt is het verschil tussen "er gebeurt niets" en "er wordt geramd".
GEWEIGERD: Dict[str, int] = {}

#: Boven dit aantal sleutels ruimen we de dode op. Een aanvaller die steeds een
#: ander adres verzint zou anders geheugen blijven stapelen.
_MAX_SLEUTELS = 20_000


class Rem:
    """Maximaal `ruimte` (aantal of gewicht) per `venster` seconden per sleutel."""

    def __init__(self, naam: str, ruimte: int, venster: float) -> None:
        self.naam = naam
        self.ruimte = ruimte
        self.venster = float(venster)
        self._per_sleutel: Dict[str, Deque[tuple[float, int]]] = {}
        GEWEIGERD.setdefault(naam, 0)

    # ---- lezen -----------------------------------------------------------

    def _schoon(self, sleutel: str, nu: float) -> Deque[tuple[float, int]]:
        rij = self._per_sleutel.get(sleutel)
        if rij is None:
            rij = deque()
            self._per_sleutel[sleutel] = rij
            if len(self._per_sleutel) > _MAX_SLEUTELS:
                self._veeg(nu)
        grens = nu - self.venster
        while rij and rij[0][0] <= grens:
            rij.popleft()
        return rij

    def _veeg(self, nu: float) -> None:
        """Sleutels zonder recent verkeer weg. Alleen bij te veel sleutels."""
        grens = nu - self.venster
        dood = [k for k, rij in self._per_sleutel.items() if not rij or rij[-1][0] <= grens]
        for k in dood:
            self._per_sleutel.pop(k, None)

    def over(self, sleutel: str, gewicht: int = 1) -> float:
        """Seconden die de sleutel nog moet wachten, 0.0 als het mag. Telt niet."""
        if not AAN:
            return 0.0
        nu = time.monotonic()
        rij = self._schoon(sleutel, nu)
        gebruikt = sum(g for _, g in rij)
        if gebruikt + gewicht <= self.ruimte:
            return 0.0
        # Wachten tot er genoeg oude regels uit het venster gevallen zijn.
        nodig = gebruikt + gewicht - self.ruimte
        weg = 0
        for t, g in rij:
            weg += g
            if weg >= nodig:
                return max(0.1, round(t + self.venster - nu, 1))
        return round(self.venster, 1)

    # ---- schrijven -------------------------------------------------------

    def tel(self, sleutel: str, gewicht: int = 1) -> None:
        """Registreer een poging, ook als hij daarna geweigerd wordt."""
        if not AAN:
            return
        nu = time.monotonic()
        self._schoon(sleutel, nu).append((nu, gewicht))

    def wacht(self, sleutel: str, gewicht: int = 1) -> float:
        """Mag het? 0.0 = ja (en geteld), anders de seconden die het nog duurt.

        Dit is de gewone vorm: kijken en meteen afboeken. Voor inloggen bestaat
        `over` + `tel` apart, want daar willen we alleen MISLUKTE pogingen
        tellen: wie zijn eigen wachtwoord goed intikt hoort nooit tegen een rem
        aan te lopen.
        """
        te_gaan = self.over(sleutel, gewicht)
        if te_gaan > 0:
            GEWEIGERD[self.naam] = GEWEIGERD.get(self.naam, 0) + 1
            return te_gaan
        self.tel(sleutel, gewicht)
        return 0.0

    def wis(self, sleutel: str) -> None:
        """Schoon bij een gelukte poging, zodat een goede login vrij baan houdt."""
        self._per_sleutel.pop(sleutel, None)


class Emmer:
    """Een emmer met druppels: `dak` stuks, loopt vol met `vul` per seconde.

    Voor de socket, waar berichten in golven komen: tijdens het invullen stuurt
    de client elke 300 ms een update, en na een ronde volgt een klein salvo. Een
    schuivend venster zou zo'n salvo weigeren; een emmer laat een burst door en
    knijpt alleen af als het aanhoudt.
    """

    def __init__(self, dak: int, vul: float) -> None:
        self.dak = float(dak)
        self.vul = float(vul)
        self._druppels = float(dak)
        self._t = time.monotonic()

    def pak(self) -> bool:
        if not AAN:
            return True
        nu = time.monotonic()
        self._druppels = min(self.dak, self._druppels + (nu - self._t) * self.vul)
        self._t = nu
        if self._druppels < 1:
            return False
        self._druppels -= 1
        return True


# ---- de sleutel: wie is dit -------------------------------------------------

def ip_van(verbinding: Any) -> str:
    """Het IP van een Request of WebSocket, van achter de proxy vandaan.

    Coolify zet nginx ervoor, dus `client.host` is altijd de proxy zelf. Het
    echte adres staat vooraan in X-Forwarded-For. Ontbreekt die kop (lokaal),
    dan is client.host wel het echte adres.
    """
    try:
        koppen = verbinding.headers
    except Exception:
        koppen = {}
    door = (koppen.get("x-forwarded-for") or "") if koppen else ""
    if door:
        eerste = door.split(",")[0].strip()
        if eerste:
            return eerste[:45]
    try:
        return (verbinding.client.host or "?")[:45]
    except Exception:
        return "?"


# ---- de remmen zelf ---------------------------------------------------------
#
# De getallen zijn zo gekozen dat een echte speler ze nooit voelt. Wie zijn
# inlogmail niet ziet aankomen vraagt hem twee keer, niet twintig keer; wie een
# avatar kiest doet dat een paar keer achter elkaar, niet zestig keer per uur.

#: Magic link. Dit is de duurste: elke aanvraag stuurt een ECHTE mail via
#: Resend, dus dit kost geld en, erger, de reputatie van het afzenderdomein.
LINK_ADRES = Rem("magic-link/adres", 2, 120)
LINK_ADRES_UUR = Rem("magic-link/adres-uur", 5, 3600)
LINK_IP = Rem("magic-link/ip", 12, 3600)

#: Inloggen met wachtwoord. Alleen missers tellen mee.
WW_ADRES = Rem("wachtwoord/adres", 8, 900)
WW_IP = Rem("wachtwoord/ip", 30, 900)

#: Nieuwe accounts. Ruim genoeg voor een huiskamer vol mensen op één wifi die
#: samen een potje beginnen, te krap voor een script.
NIEUW_IP = Rem("account/ip", 10, 3600)

#: Uploads. Twee remmen over hetzelfde: op aantal EN op megabytes, want honderd
#: kleine plaatjes zijn iets anders dan honderd van drie megabyte.
UPLOAD = Rem("upload/account", 60, 3600)
UPLOAD_BYTES = Rem("upload-bytes/account", 80 * MB, 3600)

#: Berichten. Een gesprek is snel, maar niet dertig berichten in een minuut.
DM = Rem("dm/account", 30, 60)
RAPPORT = Rem("rapport/account", 10, 3600)

#: De socket zelf. De client knijpt zijn invulberichten al af tot ~3 per
#: seconde, dus twintig per seconde is ver boven alles wat echt spel oplevert.
WS_DAK = 60
WS_VUL = 20.0
#: Zoveel geweigerde berichten achter elkaar en de verbinding gaat dicht: dan
#: is het geen speler meer maar een lus.
WS_GEDULD = 60


def noteer(naam: str) -> None:
    """Handmatig een weigering optellen, voor wie `over` en `tel` los gebruikt."""
    GEWEIGERD[naam] = GEWEIGERD.get(naam, 0) + 1


def stand() -> Dict[str, int]:
    """Wat er tot nu toe geweigerd is. Voor de statuspagina."""
    return {naam: n for naam, n in sorted(GEWEIGERD.items()) if n}
