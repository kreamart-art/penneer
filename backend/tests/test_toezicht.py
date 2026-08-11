"""Het toezicht: merken dat er iets mis is voordat een speler het zegt.

Twee dingen moeten hier kloppen, en ze trekken aan verschillende kanten.

EEN ALARM MOET AFGAAN als de database niet meer leest, de schijf volloopt, de
nachtelijke kopie stilstaat of de fouten zich opstapelen. Dat is waar het hele
ding voor is.

EN HET MAG NIET AFGAAN op doodnormaal verkeer. Iemand die een tunnel in rijdt
terwijl de server nog aan het schrijven is, levert een fout op die niets
betekent. Zou die meetellen, dan gaat het alarm elke dag af en kijkt er na een
week niemand meer naar; dan heb je een bewaker die niets meer bewaakt.
"""

import asyncio

import pytest

from app import toezicht


class NepDb:
    def __init__(self, leeft: bool = True):
        self._leeft = leeft

    def leeft(self) -> bool:
        return self._leeft

    def user_id_by_name(self, naam: str):
        return "baas-id"


@pytest.fixture(autouse=True)
def schone_ring():
    toezicht._fouten.clear()
    yield
    toezicht._fouten.clear()
    toezicht._laatste_alarm.clear()


# ---- wat telt als fout ------------------------------------------------------

def test_een_echte_fout_wordt_onthouden():
    toezicht.fout("test", ValueError("kapot"))
    assert toezicht.fouten_sinds(60) == 1
    assert toezicht._fouten[-1]["bron"] == "test"


def test_weglopende_speler_is_geen_fout():
    class WebSocketDisconnect(Exception):
        pass

    toezicht.fout("ws", WebSocketDisconnect())
    assert toezicht.fouten_sinds(60) == 0, "anders gaat het alarm af op normaal verkeer"


def test_schrijven_naar_een_gesloten_socket_is_geen_fout():
    toezicht.fout("ws", RuntimeError('Cannot call "send" once a close message has been sent.'))
    assert toezicht.fouten_sinds(60) == 0


# ---- de klachten -----------------------------------------------------------

def _stil(monkeypatch, *, leeft=True, kopie=None, schijf=None):
    """Alles gezond, behalve wat de test expres kapotmaakt."""
    monkeypatch.setattr(toezicht, "get_db", lambda: NepDb(leeft))
    monkeypatch.setattr(toezicht.backup, "laatste",
                        lambda _p: kopie if kopie is not None else
                        {"aantal": 3, "pad": "/x", "bytes": 100, "uren_oud": 2.0})
    monkeypatch.setattr(toezicht, "_schijf",
                        lambda: schijf if schijf is not None else
                        {"totaal": 100_000_000_000, "vrij": 50_000_000_000, "vrij_deel": 0.5})


def _sleutels(monkeypatch, **kw):
    _stil(monkeypatch, **kw)
    return [s for s, _, _ in toezicht._klachten()]


def test_gezonde_server_klaagt_nergens_over(monkeypatch):
    assert _sleutels(monkeypatch) == []


def test_database_die_niet_leest_geeft_alarm(monkeypatch):
    assert "db" in _sleutels(monkeypatch, leeft=False)


def test_volle_schijf_geeft_alarm(monkeypatch):
    vol = {"totaal": 100_000_000_000, "vrij": 4_000_000_000, "vrij_deel": 0.04}
    assert "schijf" in _sleutels(monkeypatch, schijf=vol)


def test_bijna_lege_schijf_op_een_kleine_machine_geeft_ook_alarm(monkeypatch):
    # Procenten alleen is niet genoeg: op een grote schijf is 10% nog veel, en
    # onder een gigabyte is het altijd raak.
    krap = {"totaal": 20_000_000_000, "vrij": 800_000_000, "vrij_deel": 0.04}
    assert "schijf" in _sleutels(monkeypatch, schijf=krap)


def test_kopie_die_stilstaat_geeft_alarm(monkeypatch):
    oud = {"aantal": 5, "pad": "/x", "bytes": 100, "uren_oud": 40.0}
    assert "kopie" in _sleutels(monkeypatch, kopie=oud)


def test_helemaal_geen_kopie_geeft_alarm(monkeypatch):
    leeg = {"aantal": 0, "pad": None, "bytes": 0, "uren_oud": None}
    assert "kopie" in _sleutels(monkeypatch, kopie=leeg)


def test_stapel_fouten_geeft_alarm(monkeypatch):
    _stil(monkeypatch)
    for i in range(toezicht.FOUTEN_PER_KWARTIER):
        toezicht.fout("test", ValueError(str(i)))
    assert "fouten" in [s for s, _, _ in toezicht._klachten()]


# ---- de hartslag -----------------------------------------------------------

def test_healthz_kijkt_echt_in_de_database(monkeypatch):
    monkeypatch.setattr(toezicht, "get_db", lambda: NepDb(False))
    assert toezicht.gezondheid()["ok"] is False, "een server die niets meer kan lezen is stuk"


def test_healthz_noemt_de_versie(monkeypatch):
    monkeypatch.setattr(toezicht, "get_db", lambda: NepDb(True))
    uit = toezicht.gezondheid()
    assert uit["ok"] is True and uit["versie"]


# ---- niet twee keer hetzelfde ----------------------------------------------

def test_hetzelfde_alarm_gaat_maar_een_keer_af(monkeypatch):
    verstuurd = []

    async def nep_notify(*a, **k):
        verstuurd.append(a)

    monkeypatch.setattr(toezicht, "get_db", lambda: NepDb(True))
    monkeypatch.setattr(toezicht.push, "notify", nep_notify)

    async def twee_keer():
        await toezicht._alarm("schijf", "t", "b")
        await toezicht._alarm("schijf", "t", "b")

    asyncio.run(twee_keer())
    assert len(verstuurd) <= 1, "een alarm dat blijft herhalen wordt weggeklikt"
