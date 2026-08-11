"""Pen Neer — één catalogus voor alle meldingen.

De app stuurde meldingen op acht plekken, elk met een eigen zinnetje en een
eigen tag, en alleen als je toevallig OFFLINE was. Dat had drie gevolgen: de
toon verschilde per bericht, dezelfde gebeurtenis bereikte je wel via je
telefoon maar niet in de app, en niemand kon opsommen welke meldingen er
eigenlijk zijn.

Dit bestand is die opsomming. Elke soort staat hier één keer, met zijn tekst,
zijn tag, zijn pictogram en waar hij heen mag. `stuur()` is de enige weg naar
buiten, dus een nieuwe melding toevoegen is een regel hieronder en geen nieuwe
code op een negende plek.

Drie kanalen, en het verschil is opzettelijk:

  in-app   een balk in de app zelf, meteen. Alleen als je verbonden bent.
  bewaard  hij blijft in je meldingen-lijst staan tot je hem gezien hebt.
  push     de telefoon van iemand die de app dicht heeft.

Push gaat alleen naar wie NIET verbonden is: een melding op je telefoon over
iets wat een halve seconde eerder in beeld sprong is ruis.
"""
from __future__ import annotations

from typing import Optional

# Elk pictogram is een naam uit ArtIcoon op de client, niet een bestandsnaam.
# Zo kan de art verhuizen zonder dat de server het weet.
SOORTEN: dict[str, dict] = {
    # ---- sociaal -----------------------------------------------------------
    # ---- arena -------------------------------------------------------------
    "arena_gestoten": {
        "titel": "Van plek 1 gestoten",
        "body": "{naam} heeft je van plek 1 gestoten. Nog {tijd} om terug te slaan.",
        "tag": "arena",
        "icoon": "vlam",
        "naar": "dagronde",
        "push": True,
    },
    "vriend_verzoek": {
        "titel": "Nieuw vriendschapsverzoek",
        "body": "{naam} wil je vriend worden.",
        "tag": "friend",
        "icoon": "sterren",
        "naar": "inbox",
        "push": True,
    },
    "vriend_ja": {
        "titel": "Nieuwe vriend",
        "body": "{naam} heeft je verzoek geaccepteerd.",
        "tag": "friend",
        "icoon": "sterren",
        "naar": "vrienden",
        "push": True,
    },
    "bericht": {
        "titel": "Nieuw bericht",
        "body": "{naam}: {tekst}",
        "tag": "dm",
        "icoon": "boek",
        "naar": "dm",
        "push": True,
    },
    "club_uitnodiging": {
        "titel": "Clubuitnodiging",
        "body": "{naam} nodigt je uit voor club {club}.",
        "tag": "club-invite",
        "icoon": "kroon",
        "naar": "inbox",
        "push": True,
    },

    # ---- spelen ------------------------------------------------------------
    "uitnodiging": {
        "titel": "Je bent uitgenodigd",
        "body": "{naam} nodigt je uit voor een potje.",
        "tag": "invite",
        "icoon": "potjes",
        # Naar de ROOM en niet naar de inbox: je bent uitgenodigd voor dat ene
        # potje, en een tik die je in een lijst afzet laat je het werk nog een
        # keer doen. De code reist mee in de data.
        "naar": "room",
        "push": True,
    },
    "uitdaging": {
        "titel": "Uitdaging",
        # De inzet staat in de melding: je beslist of je hem opent op basis van
        # wat er op het spel staat, dus dat hoor je te zien voor je tikt.
        "body": "{naam} daagt je uit{inzet}.",
        "tag": "invite",
        "icoon": "vlam",
        # Naar het DUEL en niet naar de inbox: een uitdaging aannemen doe je in
        # het duel, en een tik die je een scherm eerder afzet is een halve tik.
        "naar": "duel",
        "push": True,
    },
    "duel_inzet": {
        "titel": "Inzet vastgelegd",
        # Ook als hij VERLAAGD is: dan hoor je meteen te weten waar je nu echt
        # om speelt, zonder het duel te hoeven openen.
        "body": "{naam} speelt met je mee{inzet}.",
        "tag": "duel",
        "icoon": "vlam",
        "naar": "duel",
        "push": True,
    },
    "duel_zoekt": {
        "titel": "Wie neemt het op?",
        # Geen push: dit is een oproep van het moment. Wie de app niet open
        # heeft, staat toch niet binnen een halve minuut aan de start, en dan
        # is een pushbericht over iets dat al voorbij is erger dan geen bericht.
        "body": "{naam} zoekt een tegenstander voor een live duel.",
        "tag": "duel",
        "icoon": "vlam",
        "naar": "duel_live",
        "push": False,
    },
    "duel_beurt": {
        "titel": "Jij bent aan de beurt",
        "body": "{naam} heeft gespeeld in jullie duel.",
        "tag": "duel",
        "icoon": "vlam",
        "naar": "duel",
        "push": True,
    },
    "duel_klaar": {
        "titel": "Duel afgelopen",
        "body": "{naam}: {uitslag}.",
        "tag": "duel",
        "icoon": "beker",
        "naar": "duel",
        "push": True,
    },
    "duel_herkansing": {
        "titel": "Herkansing",
        "body": "{naam} wil nog een duel.",
        "tag": "duel",
        "icoon": "vlam",
        "naar": "duel",
        "push": True,
    },

    "uitdaging_weg": {
        "titel": "Uitdaging weg",
        "body": "{naam} gaat niet in op je uitdaging.",
        "tag": "duel",
        "icoon": "vlam",
        "naar": "duel",
        "push": False,
    },

    # ---- de dagronde -------------------------------------------------------
    "dagronde_klaar": {
        "titel": "De dagronde is gesloten",
        "body": "Je werd {plek}e van de {n}.",
        "tag": "dagronde",
        "icoon": "beker",
        "naar": "dagronde",
        "push": True,
    },
    "dagronde_streak": {
        "titel": "Je reeks staat op het spel",
        "body": "{n} dagen op rij. Speel vandaag nog, anders is hij weg.",
        "tag": "dagronde",
        "icoon": "vlam",
        "naar": "dagronde",
        "push": True,
    },
    "dagronde_ingehaald": {
        "titel": "Ingehaald",
        "body": "{naam} staat nu boven je in de dagronde.",
        "tag": "dagronde",
        "icoon": "beker",
        "naar": "dagronde",
        "push": True,
    },

    # ---- club --------------------------------------------------------------
    "club_lid": {
        "titel": "Nieuw clublid",
        "body": "{naam} is lid geworden van {club}.",
        "tag": "club",
        "icoon": "kroon",
        "naar": "club",
        "push": False,
    },

    # ---- seizoen -----------------------------------------------------------
    "seizoen_klaar": {
        "titel": "Seizoen afgelopen",
        "body": "Je eindigde als {plek}e. Het nieuwe seizoen staat open.",
        "tag": "seizoen",
        "icoon": "krans",
        "naar": "ranglijst",
        "push": True,
    },

    # ---- missies -----------------------------------------------------------
    "missies_nieuw": {
        "titel": "Nieuwe missies",
        "body": "Drie nieuwe missies staan klaar.",
        "tag": "missies",
        "icoon": "ster",
        "naar": "home",
        "push": False,
    },

    # ---- wat je verdient ---------------------------------------------------
    "divisie_op": {
        "titel": "Promotie",
        "body": "Je speelde je naar {divisie}.",
        "tag": "divisie",
        "icoon": "schild",
        "naar": "profiel",
        "push": True,
    },
    "divisie_neer": {
        "titel": "Degradatie",
        "body": "Je staat nu in {divisie}.",
        "tag": "divisie",
        "icoon": "schild",
        "naar": "profiel",
        "push": False,   # een daling hoort je telefoon niet te laten trillen
    },
    "beloning": {
        "titel": "Er ligt iets voor je klaar",
        "body": "{wat} staat te wachten op je profiel.",
        "tag": "reward",
        "icoon": "krans",
        # Naar de main page: daar komt de claim-popup, niet op je profiel.
        "naar": "home",
        "push": True,
    },

    # ---- herinneringen -----------------------------------------------------
    # Deze komen niet uit een gebeurtenis maar uit een SWEEP: iets staat al een
    # tijd open en niemand heeft er iets mee gedaan. Hoogstens één per dag per
    # soort, anders is het geen herinnering meer maar gezeur.
    "herinnering_verzoek": {
        "titel": "Nog een verzoek open",
        "body": "{n} vriendschapsverzoek wacht nog op je.",
        "body_mv": "{n} vriendschapsverzoeken wachten nog op je.",
        "tag": "reminder-friend",
        "icoon": "sterren",
        "naar": "inbox",
        "push": True,
    },
    "herinnering_bericht": {
        "titel": "Ongelezen bericht",
        "body": "Je hebt {n} bericht niet gelezen.",
        "body_mv": "Je hebt {n} berichten niet gelezen.",
        "tag": "reminder-dm",
        "icoon": "boek",
        "naar": "inbox",
        "push": True,
    },
    "herinnering_dagronde": {
        "titel": "De dagronde staat klaar",
        "body": "Je reeks van {n} dagen loopt af als je vandaag niet speelt.",
        "tag": "reminder-daily",
        "icoon": "vlam",
        "naar": "dagronde",
        "push": True,
    },
    "herinnering_duel": {
        "titel": "Een duel wacht op jou",
        "body": "{naam} wacht al {dagen} dagen op je zet.",
        "tag": "reminder-duel",
        "icoon": "vlam",
        "naar": "duel",
        "push": True,
    },
}

# Soorten die WEL bewaard worden maar NIET in de meldingenlijst horen.
#
# Een bericht staat al in je inbox, met het gesprek eronder. Een tweede regel
# "je hebt een bericht" naast dat gesprek is dubbelop, dus de app liet ze daar
# altijd al weg. Alleen: de teller telde ze wél mee. Gevolg: je las het bericht,
# de bel bleef branden, en er was niets zichtbaars om aan te tikken waarmee je
# hem uit kreeg. Vandaar dat de lijst en de teller nu allebei op deze ene lijst
# staan in plaats van dat de app hem apart nog eens toepast.
#
# Ze blijven wel in de tabel staan, want daar hangen twee dingen aan: de push
# naar iemand die de app dicht heeft, en het dagslot van de herinneringen (dat
# kijkt wanneer dezelfde soort voor het laatst verstuurd is).
VERBORGEN = ("bericht", "herinnering_bericht")


def maak(soort: str, **vars) -> Optional[dict]:
    """De melding als dictionary, of None als de soort niet bestaat.

    Meervoud gaat via `body_mv`: "1 bericht" en "3 berichten" verschillen in het
    Nederlands, en een tekst met "(en)" erin leest als een formulier.
    """
    sjabloon = SOORTEN.get(soort)
    if not sjabloon:
        return None
    body = sjabloon["body"]
    if vars.get("n") is not None and int(vars["n"]) != 1 and sjabloon.get("body_mv"):
        body = sjabloon["body_mv"]
    # Een ontbrekende variabele mag NOOIT de sjabloontekst laten zien. Dat
    # gebeurde: een uitdaging uit de room stuurde geen `inzet` mee, `format`
    # struikelde over de KeyError en de terugval was de rauwe regel, dus er
    # stond letterlijk "{naam} daagt je uit{inzet}." op de telefoon. Nu vult een
    # ontbrekende naam zichzelf met niets, en blijft de zin leesbaar.
    class _Leeg(dict):
        def __missing__(self, sleutel: str) -> str:
            return ""

    try:
        tekst = body.format_map(_Leeg(vars))
    except (IndexError, ValueError):
        tekst = body
    return {
        "soort": soort,
        "titel": sjabloon["titel"],
        "body": tekst,
        "tag": sjabloon["tag"],
        "icoon": sjabloon["icoon"],
        "naar": sjabloon["naar"],
        "push": bool(sjabloon.get("push")),
    }


def link(naar: Optional[str], data: Optional[dict] = None) -> str:
    """De adresbalk-versie van een bestemming, voor een tik op een push.

    Een push komt binnen terwijl de app dicht is, dus de bestemming moet in de
    URL passen: de melding zelf is dan het enige wat de app nog heeft. De
    frontend leest deze twee parameters bij het opstarten en gooit ze daarna
    weg, zodat je bij het delen van de link niet iemands gesprek meestuurt.

    Het `wie` is bewust een tweede parameter en geen pad: alles achter de eerste
    schuine streep is een route die de app niet heeft, en die eindigt op de
    index met een lege staat.
    """
    if not naar:
        return "/"
    d = data or {}
    # Een roomcode is geen "wie" maar een "waar": een uitnodiging voor een potje
    # hoort je in dat potje te zetten en niet in een lijst.
    code = d.get("room_code") or ""
    if code:
        return f"/?melding={naar}&code={code}"
    wie = d.get("user_id") or d.get("duel_id") or ""
    return f"/?melding={naar}&wie={wie}" if wie else f"/?melding={naar}"

