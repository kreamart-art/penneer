"""Pen Neer — de medaillekast.

De veertien oudste penningen worden TOEGEKEND op het moment zelf: aan het eind
van een potje kijkt social.record_game of je er een verdiend hebt. Dat werkt,
maar het is broos. Mist die ene aanroep ooit zijn moment (de server herstart
tijdens een potje, een pad dat later wordt toegevoegd vergeet de regel), dan is
de penning voorgoed weg, want er is geen tweede kans.

De dertig penningen hier worden daarom niet bijgehouden maar GETELD, precies
zoals de week- en seizoensmissies. Elke prestatie is een vraag aan de database
die altijd hetzelfde antwoord geeft: hoeveel potjes staan er op je naam, hoeveel
kaarten heb je, hoe ver sta je op de divisieladder. Daardoor:

  - kan een gemiste aanroep niets kosten: de volgende keer telt hij gewoon weer;
  - tellen prestaties met terugwerkende kracht, dus wie al honderd potjes speelde
    heeft zijn penning zodra deze regel bestaat;
  - staat de voorwaarde op EEN plek, hier, en niet verspreid over de plekken
    waar iets gebeurt.

Wat er wordt bewaard is alleen DAT je hem hebt (tabel badges), want dat is een
gebeurtenis en geen telling.

Een prestatie levert geen munten of XP op. Ze zijn er om te verzamelen; zodra er
een prijs aan hangt worden het missies, en die zijn er al.
"""
from __future__ import annotations

from typing import Any

# ---- de tellers -------------------------------------------------------------
# Elke teller is EEN vraag die EEN getal geeft. Het aantal vraagtekens staat
# erbij, want sommige vragen hebben het id twee keer nodig.
#
# Alleen echte potjes tellen: `games` bevat geen botpotjes (social.record_game
# slaat die over), dus dat filter hoeft hier niet nog eens.
TELLERS: dict[str, tuple[str, int]] = {
    # -- potjes ---------------------------------------------------------------
    "potjes": ("SELECT COUNT(*) AS n FROM game_players WHERE user_id=?", 1),
    "winsten": ("SELECT COUNT(*) AS n FROM game_players WHERE user_id=? AND is_winner=1", 1),
    "beste": ("SELECT COALESCE(MAX(score), 0) AS n FROM game_players WHERE user_id=?", 1),
    # Een heel potje zonder een enkel gedeeld woord, en niet met drie woorden
    # bij elkaar gesprokkeld: dat laatste is geen prestatie maar een korte pot.
    "solopotje": ("SELECT COUNT(*) AS n FROM game_players WHERE user_id=? AND dubbels=0 AND uniques>=10", 1),
    # Het grootste gezelschap waar je in speelde. De spelers van een potje staan
    # in game_players, dus tellen we de rijen van elk potje waar jij in zat.
    "grootste_potje": ("""
        SELECT COALESCE(MAX(n), 0) AS n FROM (
            SELECT COUNT(*) AS n FROM game_players
            WHERE game_id IN (SELECT game_id FROM game_players WHERE user_id=?)
            GROUP BY game_id)
    """, 1),
    # -- dagronde -------------------------------------------------------------
    "dagrondes": ("SELECT COUNT(*) AS n FROM daily_scores WHERE user_id=?", 1),
    "dag_beste": ("SELECT COALESCE(MAX(score), 0) AS n FROM daily_scores WHERE user_id=?", 1),
    # SNEL EN GOED, en niet alleen snel: de ronde duurt zestig seconden, dus
    # "binnen de tijd" haalt iedereen. Een lege inzending in twee tellen is
    # geen prestatie, dus de score moet er ook staan (30 is de bar van de
    # dagmissie daily30).
    "snelle_dagronde": ("SELECT COUNT(*) AS n FROM daily_scores WHERE user_id=? AND time_ms<=30000 AND score>=30", 1),
    "dagkoning": ("SELECT COUNT(*) AS n FROM dag_prijzen WHERE user_id=? AND plek=1", 1),
    # -- duel -----------------------------------------------------------------
    "duelwinst": ("SELECT COUNT(*) AS n FROM duels WHERE winner=?", 1),
    "duelwinst_inzet": ("SELECT COUNT(*) AS n FROM duels WHERE winner=? AND stake>0", 1),
    # -- arena ----------------------------------------------------------------
    "arena_soorten": ("SELECT COUNT(DISTINCT game) AS n FROM arena_attempts WHERE user_id=? AND finished_at IS NOT NULL", 1),
    "arena_flits": ("SELECT COUNT(*) AS n FROM arena_attempts WHERE user_id=? AND game='flitsreeks' AND finished_at IS NOT NULL", 1),
    # -- ontdekken ------------------------------------------------------------
    # Alleen echte kaarten: een spoor is een woord dat je te zien kreeg, niet
    # een woord dat je verdiende.
    "kaarten": ("SELECT COUNT(*) AS n FROM user_cards WHERE user_id=? AND spoor=0", 1),
    "packkaarten": ("SELECT COUNT(*) AS n FROM user_cards WHERE user_id=? AND source='pack'", 1),
    "oefendagen": ("SELECT COUNT(*) AS n FROM practice_rewards WHERE user_id=?", 1),
    # -- sociaal --------------------------------------------------------------
    "vrienden": ("SELECT COUNT(*) AS n FROM friends WHERE status='accepted' AND (a=? OR b=?)", 2),
    "clubs": ("SELECT COUNT(*) AS n FROM club_members WHERE user_id=?", 1),
    "berichten": ("SELECT COUNT(*) AS n FROM dms WHERE from_user=?", 1),
    "spraak": ("SELECT COUNT(*) AS n FROM dms WHERE from_user=? AND voice_id IS NOT NULL", 1),
    "meldingen_aan": ("SELECT COUNT(*) AS n FROM push_subs WHERE user_id=?", 1),
    # -- account --------------------------------------------------------------
    "munten": ("SELECT COALESCE(coins, 0) AS n FROM users WHERE id=?", 1),
    "divisie": ("SELECT COALESCE(divisie, 0) AS n FROM users WHERE id=?", 1),
    # Alleen om de OUDE penningen een balk te geven; zie WEERGAVE.
    "unieken": ("SELECT COALESCE(SUM(uniques), 0) AS n FROM game_players WHERE user_id=?", 1),
}

# De reeks dagrondes op rij staat niet in een enkele vraag: db rekent hem uit
# over de dagen terug vanaf vandaag.
REEKS = "reeks"

# ---- de kast ----------------------------------------------------------------
# (sleutel, teller, doel). De volgorde is de volgorde van het vel art; de
# sleutel staat in de tabel badges, dus hernoem er nooit een. De app vertaalt
# de naam zelf, met badgeshort_<sleutel>.
KAST: list[tuple[str, str, int]] = [
    ("vijftig_games", "potjes", 50),
    ("flitser", "arena_flits", 1),
    ("dobbelaar", "duelwinst_inzet", 1),
    ("raak", "dag_beste", 50),
    ("sneldenker", "snelle_dagronde", 1),
    ("divisie_klim", "divisie", 2),
    ("divisie_top", "divisie", 5),
    ("maandvol", "dagrondes", 30),
    ("komeet", "beste", 100),
    ("schatkist", "munten", 5000),
    ("duellist", "duelwinst", 10),
    ("gezelschap", "grootste_potje", 5),
    ("clublid", "clubs", 1),
    ("prater", "berichten", 50),
    ("student", "oefendagen", 10),
    ("vijfentwintig_winsten", "winsten", 25),
    ("vijftig_winsten", "winsten", 50),
    ("tien_dagen", REEKS, 10),
    ("allrounder", "arena_soorten", 7),
    ("verzamelaar", "kaarten", 50),
    ("pakjesdag", "packkaarten", 1),
    ("eigenzinnig", "solopotje", 1),
    ("ontdekker", "kaarten", 1),
    ("volhouder", "potjes", 100),
    ("dagkoning", "dagkoning", 1),
    ("tien_vrienden", "vrienden", 10),
    ("stem", "spraak", 1),
    ("honderd_winsten", "winsten", 100),
    ("zeven_dagen", REEKS, 7),
    ("aangesloten", "meldingen_aan", 1),
]

SLEUTELS = [k for k, *_ in KAST]

# De VEERTIEN oudste penningen worden nog steeds toegekend waar ze altijd al
# werden toegekend (aan het eind van een potje, bij je eerste vriend, bij het
# seizoen). Ze staan hier alleen om te LATEN ZIEN hoever je bent; herzie() raakt
# ze niet aan, want die regels werken en twee plekken die hetzelfde toekennen is
# vragen om verschil.
#
# Wat aan een gebeurtenis hangt en niet aan een telling (een comeback, een
# perfecte ronde, een winst met moeilijke letters) heeft geen teller: daar hoort
# een slotje, geen balk.
WEERGAVE: dict[str, tuple[str, int]] = {
    "eerste_game": ("potjes", 1),
    "eerste_winst": ("winsten", 1),
    "tien_games": ("potjes", 10),
    "vijfentwintig_games": ("potjes", 25),
    "vijf_winsten": ("winsten", 5),
    "tien_winsten": ("winsten", 10),
    "hattrick": ("winreeks", 3),
    "woordenaar": ("unieken", 50),
    "eerste_vriend": ("vrienden", 1),
}

# De volgorde waarin de kast op het scherm staat: eerst de klassiekers, daarna
# het nieuwe vel.
VOLGORDE = [
    "eerste_game", "eerste_winst", "tien_games", "vijf_winsten", "hattrick", "woordenaar",
    "vijfentwintig_games", "tien_winsten", "perfecte_ronde", "comeback", "durfal",
    "eerste_vriend", "eerste_bericht", "seizoenswinnaar",
] + SLEUTELS


def doelen() -> dict[str, dict]:
    """Per penning waar hij aan hangt, voor het scherm. Zonder teller = slot."""
    uit: dict[str, dict] = {k: {"teller": t, "doel": d} for k, (t, d) in WEERGAVE.items()}
    for sleutel, teller, doel in KAST:
        uit[sleutel] = {"teller": teller, "doel": doel}
    return uit


def stand(db: Any, user_id: str) -> dict[str, int]:
    """Alle tellers in één keer, voor het scherm dat de kast laat zien."""
    uit: dict[str, int] = {}
    for naam in list(TELLERS) + [REEKS, "winreeks"]:
        uit[naam] = _teller(db, user_id, naam)
    return uit


def _teller(db: Any, user_id: str, naam: str) -> int:
    if naam == REEKS:
        return int(db.daily_streak_of(user_id))
    if naam == "winreeks":
        # Hoeveel potjes je op DIT moment op rij hebt gewonnen. Staat niet in
        # een kolom maar in de laatste rijen van game_players, en db rekent hem
        # al uit voor het profiel.
        return int(db.stats_of(user_id).get("streak", 0))
    vraag = TELLERS.get(naam)
    if not vraag:
        return 0
    sql, aantal = vraag
    with db._lock:
        rijen = db._q(sql, (user_id,) * aantal)
    return int(rijen[0]["n"]) if rijen else 0


def herzie(db: Any, user_id: str) -> list[str]:
    """Ken toe wat er te halen valt; geef terug wat er NIEUW bij kwam.

    Alleen de penningen die je nog niet hebt worden geteld, dus hoe verder je
    komt hoe minder werk dit is; wie alles heeft doet één vraag naar zijn eigen
    kast en klaar.
    """
    if not user_id:
        return []
    al = {b["badge"] for b in db.badges_of(user_id)}
    open_kast = [rij for rij in KAST if rij[0] not in al]
    if not open_kast:
        return []
    gemeten: dict[str, int] = {}
    nieuw: list[str] = []
    for sleutel, teller, doel in open_kast:
        if teller not in gemeten:
            gemeten[teller] = _teller(db, user_id, teller)
        if gemeten[teller] >= doel and db.grant_badge(user_id, sleutel):
            nieuw.append(sleutel)
    return nieuw
