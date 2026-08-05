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

De rotatie is een vaste weekkalender, en die is nu VOL: elke dag draait een spel
dat af is. Dat betekent dat twee spellen twee keer per week langskomen, en dat is
beter dan een dag met "binnenkort" erop. Zodra er een nieuw spel bij komt neemt
dat gewoon een van de dubbele plekken over.

Het veld "af" blijft bestaan voor spellen die nog gebouwd worden: staat er False,
dan toont de tegel de naam met "binnenkort" en accepteert de server geen
inzendingen. Op dit moment staat er geen enkel spel meer op False.

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
#
# Vijf gebouwde spellen over zeven dagen, dus twee komen twee keer langs. Ze
# staan zo ver mogelijk uit elkaar: Rekenladder op zondag en donderdag, Woordketen
# op maandag en zaterdag. Nooit twee dagen achter elkaar hetzelfde.
#
# Waaghet heeft de dubbele zaterdag overgenomen; Woordketen draait dus weer één
# dag. NOG TE BOUWEN: Wereldprik, die krijgt de zondag zodra hij af is en dan
# heeft elk spel zijn eigen dag.
GAMES: dict[int, dict] = {
    0: {"key": "woordketen", "af": True},
    1: {"key": "flitsreeks", "af": True},
    2: {"key": "lettersoep", "af": True},
    3: {"key": "rekenladder", "af": True},
    4: {"key": "kleurenklem", "af": True},
    5: {"key": "waaghet", "af": True},
    6: {"key": "rekenladder", "af": True},
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
    if game == "waaghet":
        # Score-contract met de client: de pot verdubbelt per goed antwoord en
        # begint op tien. Je incasseert 10 * 2^(level-1), of je verliest alles
        # en dan is de score nul. Iets ertussenin bestaat niet.
        if score not in (0, 10 * 2 ** max(0, level - 1)):
            return False
        if score and level < 1:
            return False
        # Tijd: elke vraag kost minstens lezen plus tikken, en de keuze
        # incasseren-of-doorgaan erna kost ook een tik. Acht tienden per vraag is
        # ruim onder wat een mens haalt en ver boven wat een scriptje nodig
        # heeft. De klok krimpt met de rondes (12 -> 8 seconden), maar dat is een
        # BOVENgrens; hier staat de ondergrens.
        return time_ms >= 800 * level
    if game == "lettersoep":
        # Score-contract met de client: een woord van n letters is 100 * 2^(n-3),
        # dus 100 voor drie letters en 3200 voor acht, en langer bestaat niet.
        # `level` is het level waarin de poging eindigde, dus level-1 levels zijn
        # UITGESPEELD en in het laatste kunnen er hooguit doel-1 woorden liggen
        # (bij doel was hij doorgegaan).
        doelen = [LETTERSOEP_DOEL(i) for i in range(1, max(1, level) + 1)]
        woorden_max = sum(doelen[:-1]) + max(0, doelen[-1] - 1) if doelen else 0
        if score > woorden_max * 3200:
            return False
        # Tijd. Elk uitgespeeld level kostte minstens zijn doel aantal woorden,
        # en een woord leggen kost een mens minstens een halve seconde: vinden,
        # vegen, loslaten. Ruim de helft daarvan aangehouden, want dit moet
        # scriptjes vangen en geen snelle spelers.
        minimum = sum(doelen[:-1]) * 250
        if time_ms < minimum:
            return False
        # En van boven: de klok geeft 55 seconden per level en meer levels dan
        # gespeeld kan niet. Een royale marge voor het laden en de valanimatie.
        return time_ms <= (max(1, level) * 55 + 30) * 1000
    if game == "kleurenklem":
        # Score-contract met de client: elke GOEDE opgave levert 100 punten plus
        # hooguit 100 naar rato van de tijd die overbleef, dus nooit meer dan
        # 200. `level` is de ronde waarin de poging eindigde, en er zijn nooit
        # meer goede opgaven geweest dan gespeelde rondes.
        if score > 200 * level:
            return False
        # Tijd van onderen. Tussen twee opgaven zit een vaste animatie van 360ms
        # (het oordeel dat oplicht voor de volgende komt), dus zoveel rondes
        # kosten minstens zoveel tijd. Ruim onder de 360 gerekend, want dit moet
        # scriptjes vangen en geen snelle spelers met een trage telefoon.
        if time_ms < 300 * max(0, level - 1):
            return False
        # En van boven: langer dan alle vensters bij elkaar plus een royale
        # marge per ronde kan niet, want dan was de klem allang dichtgeslagen.
        ruimte = sum(KLEURENKLEM_VENSTER(r) for r in range(1, level + 1))
        return time_ms <= 5000 + ruimte + 900 * level
    if game == "woordketen":
        # Score-contract met de client: schakel k levert (100 plus hoogstens 50
        # naar rato van de overgehouden tijd) maal k maal de lengtefactor van je
        # woord. Die factor loopt van 1 bij drie letters naar 2,5 bij acht, dus
        # het hoogste dat schakel k kan opleveren is k * 150 * 2,5 = 375k.
        # `level` is het aantal schakels dat je HEBT gemaakt, dus die zijn alle
        # k = 1..level goed gegaan.
        #   som van 375*k voor k=1..level  =  375 * level * (level+1) / 2
        if score > 375 * level * (level + 1) // 2:
            return False
        # Tijd van onderen: na elke goede tegel klikt de schakel eerst aan de
        # ketting voordat de volgende beurt komt (320ms). Ruim eronder gerekend,
        # want dit moet scriptjes vangen en geen snelle lezers.
        if time_ms < 250 * level:
            return False
        # En van boven: alle klokken bij elkaar plus marge, plus de drie tellen
        # aftellen aan het begin. Langer kan niet, want dan was de klok allang
        # leeg gelopen.
        ruimte = sum(WOORDKETEN_VENSTER(k) for k in range(1, level + 2))
        return time_ms <= 8000 + ruimte + 900 * level
    if game == "rekenladder":
        # Score-contract met de client: trede k levert 100*k punten plus hooguit
        # 50*k naar rato van de overgehouden tijd, dus ten hoogste 150*k. `level`
        # is de trede waarop de poging EINDIGDE, en die is per definitie niet
        # gehaald; goed gegaan zijn de treden 1 tot en met level-1.
        #   som van 150*k voor k=1..level-1  =  75 * level * (level-1)
        if score > 75 * level * max(0, level - 1):
            return False
        # Tijd van onderen: na elk goed antwoord licht het even op voordat de
        # volgende som komt (420ms). Ruim eronder gerekend, want dit moet
        # scriptjes vangen en geen snelle rekenaars op een trage telefoon.
        if time_ms < 350 * max(0, level - 1):
            return False
        # En van boven: alle klokken bij elkaar plus marge. Langer kan niet, want
        # dan was de balk allang leeg.
        ruimte = sum(REKENLADDER_VENSTER(k) for k in range(1, level + 1))
        return time_ms <= 5000 + ruimte + 900 * level
    # Spellen die nog niet af zijn accepteren geen inzendingen.
    return False


def WOORDKETEN_VENSTER(schakel: int) -> int:
    """Hoeveel milliseconden je voor een schakel krijgt: TIEN SECONDEN, elke
    schakel dezelfde. De klim zit in het aantal tegels, de lengte van de woorden
    en de gemeenheid van de lokkers, niet in de klok.

    Moet gelijk lopen met KETEN_VENSTER in
    frontend/src/screens/_PreviewWoordketen.tsx; staat het hier anders, dan keurt
    de server een eerlijke poging af."""
    return 20000


def REKENLADDER_VENSTER(trede: int) -> int:
    """Hoeveel milliseconden je voor trede `trede` krijgt: TWINTIG SECONDEN, op
    elke trede dezelfde.

    Hij liep af van negen naar drie seconden, en dat was te scherp: niet iedereen
    rekent even snel, en dan meet je reactiesnelheid in plaats van rekenen. De
    steiging zit in de sommen zelf, niet in de klok.

    Moet gelijk lopen met vensterVoor() in
    frontend/src/screens/_PreviewRekenladder.tsx; staat het hier anders, dan
    keurt de server een eerlijke poging af."""
    return 20000


def KLEURENKLEM_VENSTER(ronde: int) -> int:
    """Hoeveel milliseconden je voor opgave `ronde` krijgt. Moet gelijk lopen
    met trapVoor() in frontend/src/screens/_PreviewKleurenklem.tsx; staat het
    hier anders, dan keurt de server een eerlijke poging af."""
    return max(700, 2300 - (max(1, ronde) - 1) * 90)


def LETTERSOEP_DOEL(level: int) -> int:
    """Hoeveel woorden een level vraagt. Moet gelijk lopen met de LADDER in
    frontend/src/screens/_PreviewLettersoep.tsx; staat het hier anders, dan keurt
    de server een eerlijke poging af."""
    ladder = [3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8]
    return ladder[min(len(ladder), max(1, level)) - 1]
