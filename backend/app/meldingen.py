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
        "naar": "inbox",
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
        "naar": "profiel",
        "push": False,
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
    try:
        tekst = body.format(**vars)
    except (KeyError, IndexError):
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
