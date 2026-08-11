"""Samen tegen samen: wat er anders is als een room in teams speelt.

De hele modus hangt aan EEN regel: dubbel telt alleen binnen je eigen kamp.
Daar zit het spel in. Schrijf jij hetzelfde als de overkant, dan is dat geen
straf (je kunt toch niet weten wat zij typen); schrijf jij hetzelfde als je
eigen teamgenoot, dan wel, want dat had je kunnen afspreken. Zonder die regel
is een team niets anders dan een optelsom en verandert er niets aan het spel.

De rest hier zijn de dingen die stuk kunnen zonder dat je het merkt: dat de
verdeling gelijk is, dat wie later binnenkomt in het kleinste kamp gaat, en dat
een potje niet kan starten met een leeg team.
"""

import pytest

from app import game
from app.models import Answer, Player, Room, Round, Settings
from app.rooms import RoomManager


def _ronde(woorden: dict[str, str], cat: str = "Dier") -> Round:
    """Een ronde waarin iedereen precies een woord invulde."""
    rnd = Round(letter="B")
    for pid, woord in woorden.items():
        rnd.answers[pid] = {cat: Answer(text=woord, valid=True, canon=game.normalize(woord))}
    return rnd


def test_zelfde_woord_in_twee_kampen_is_twee_keer_uniek():
    rnd = _ronde({"a": "Beer", "b": "Beer"})
    punten = game.score_round(rnd, ["a", "b"], ["Dier"], teams={"a": 1, "b": 2})
    assert punten["a"]["Dier"] == 10
    assert punten["b"]["Dier"] == 10, "de overkant kun je niet zien, dus dat mag niet straffen"


def test_zelfde_woord_binnen_een_kamp_is_dubbel():
    rnd = _ronde({"a": "Beer", "b": "Beer"})
    punten = game.score_round(rnd, ["a", "b"], ["Dier"], teams={"a": 1, "b": 1})
    assert punten["a"]["Dier"] == 5
    assert punten["b"]["Dier"] == 5, "met je teamgenoot overleg je, dus dit hoort te kosten"


def test_zonder_teams_verandert_er_niets():
    rnd = _ronde({"a": "Beer", "b": "Beer"})
    assert game.score_round(rnd, ["a", "b"], ["Dier"]) == \
        game.score_round(rnd, ["a", "b"], ["Dier"], teams=None)


def test_soepele_spelling_werkt_ook_binnen_een_kamp():
    """De koppeling (canon) gaat voor: 'miloen' en 'meloen' zijn een woord."""
    rnd = Round(letter="M")
    rnd.answers["a"] = {"Vrucht": Answer(text="miloen", valid=True, canon="meloen")}
    rnd.answers["b"] = {"Vrucht": Answer(text="meloen", valid=True, canon="meloen")}
    punten = game.score_round(rnd, ["a", "b"], ["Vrucht"], teams={"a": 1, "b": 1})
    assert punten["a"]["Vrucht"] == 5 and punten["b"]["Vrucht"] == 5


# ---- de stand per kamp -------------------------------------------------------

def _room(teams: int, hoeveel: int) -> Room:
    room = Room(code="TEST", host_id="p0", settings=Settings(teams=teams))
    for i in range(hoeveel):
        room.players.append(Player(id=f"p{i}", name=f"S{i}", color="#fff"))
    RoomManager()._verdeel_teams(room)
    return room


def test_de_stand_telt_per_kamp_op():
    room = _room(2, 4)
    room.scores = {"p0": 30, "p1": 10, "p2": 20, "p3": 5}
    # p0/p2 in kamp 1, p1/p3 in kamp 2 (om en om)
    assert room.team_scores() == {1: 50, 2: 15}


def test_zonder_teams_is_de_stand_per_kamp_leeg():
    room = _room(0, 3)
    room.scores = {"p0": 10}
    assert room.team_scores() == {}


def test_verdelen_gaat_om_en_om():
    room = _room(2, 5)
    assert [p.team for p in room.players] == [1, 2, 1, 2, 1]


def test_drie_kampen_kan_ook():
    room = _room(3, 6)
    assert sorted(p.team for p in room.players) == [1, 1, 2, 2, 3, 3]


def test_teams_uit_zet_iedereen_terug_op_geen_kamp():
    room = _room(2, 4)
    room.settings.teams = 0
    RoomManager()._verdeel_teams(room)
    assert all(p.team == 0 for p in room.players)


def test_kijkers_horen_bij_geen_enkel_kamp():
    room = _room(2, 3)
    room.players.append(Player(id="k", name="Kijker", color="#fff", is_spectator=True))
    RoomManager()._verdeel_teams(room)
    assert room.get_player("k").team == 0


# ---- wie er later binnenkomt -------------------------------------------------

def test_nieuwkomer_gaat_naar_het_kleinste_kamp():
    room = _room(2, 3)          # kamp 1 heeft er twee, kamp 2 een
    laat = Player(id="laat", name="Laat", color="#fff")
    room.players.append(laat)
    RoomManager()._plaats_in_team(room, laat)
    assert laat.team == 2, "anders komt iedereen die later binnenkomt in kamp 1"


def test_nieuwkomer_zonder_teams_krijgt_geen_kamp():
    room = _room(0, 2)
    laat = Player(id="laat", name="Laat", color="#fff")
    room.players.append(laat)
    RoomManager()._plaats_in_team(room, laat)
    assert laat.team == 0


# ---- starten -----------------------------------------------------------------

def test_starten_mag_niet_met_een_leeg_kamp():
    room = _room(2, 2)
    for p in room.players:
        p.team = 1
    assert RoomManager()._team_klaar(room) is False


def test_starten_mag_als_elk_kamp_bezet_is():
    assert RoomManager()._team_klaar(_room(2, 2)) is True


def test_zonder_teams_is_er_niets_te_controleren():
    assert RoomManager()._team_klaar(_room(0, 1)) is True
