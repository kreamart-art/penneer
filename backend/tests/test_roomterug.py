"""Terug de room in na een wegval, en de stille admin-herlogin.

Twee dingen die om dezelfde reden bestaan: een telefoon verliest zijn
verbinding nu eenmaal. Wie tijdens een potje wegvalt krijgt na een tijdje een
melding waarmee hij zonder code terug de room in kan; wie ooit een verkeerde
admincode intikte hoort daar niet bij elke herverbinding een foutbalk over te
krijgen.

De uitgestelde taak zelf (_meld_terug_na) wordt hier rechtstreeks gedraaid met
uitstel nul: in de testclient krijgt elke websocket zijn eigen event loop, en
een taak die op zo'n loop is gepland sterft met de verbinding mee. In productie
is er één loop die blijft leven. Dat de wegval de taak PLANT staat er los van,
met een stub.
"""

import asyncio
import json
import sys
import time

import pytest


def _verse_app(tmp_path, monkeypatch):
    monkeypatch.setenv("PENNEER_DB_PATH", str(tmp_path / "terug.db"))
    for mod in [m for m in list(sys.modules) if m.startswith("app.")] + ["app"]:
        sys.modules.pop(mod, None)
    from fastapi.testclient import TestClient
    from app import social, ws
    from app.main import app

    ws.manager.TERUG_NA_S = 0.0  # geen minuut wachten in een test
    return TestClient(app), ws.manager, social.accounts


def _account(ws, naam: str) -> str:
    ws.send_json({"type": "account_create", "name": naam})
    return _wacht(ws, "account")["account"]["id"]


def _wacht(ws, soort: str, max_berichten: int = 12) -> dict:
    for _ in range(max_berichten):
        m = ws.receive_json()
        if m.get("type") == soort:
            return m
    raise AssertionError(f"geen {soort} ontvangen")


def _room_met_spel(client, manager):
    """Twee accounts in een room, en het potje 'loopt' (phase fill)."""
    a = client.websocket_connect("/ws").__enter__()
    b = client.websocket_connect("/ws").__enter__()
    uid_a = _account(a, "Aap")
    uid_b = _account(b, "Beer")
    a.send_json({"type": "create_room", "name": "Aap"})
    code = _wacht(a, "joined")["code"]
    b.send_json({"type": "join_room", "code": code, "name": "Beer"})
    _wacht(b, "joined")
    room = manager.rooms[code]
    room.phase = "fill"  # het potje is bezig; de spelflow zelf is hier niet het onderwerp
    return a, b, uid_a, uid_b, code, room


def _meldingen(accounts_mgr, uid):
    return [m for m in accounts_mgr.db.meldingen_of(uid) if m["soort"] == "room_terug"]


def _pid(room, uid):
    return next(p.id for p in room.players if p.user_id == uid)


# ---- plant de wegval de taak? ------------------------------------------------

def _stub(manager):
    """Vervang de taak door een teller; de coroutine zelf doet niets."""
    calls: list = []

    def nep(code, player_id):
        calls.append((code, player_id))
        async def _niks():
            pass
        return _niks()

    manager._meld_terug_na = nep
    return calls


def test_wegvallen_tijdens_het_spel_plant_de_melding(tmp_path, monkeypatch):
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    calls = _stub(manager)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    b.__exit__(None, None, None)
    time.sleep(0.3)
    assert calls == [(code, _pid(room, uid_b))]
    a.__exit__(None, None, None)


def test_in_de_lobby_wegvallen_plant_niets(tmp_path, monkeypatch):
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    calls = _stub(manager)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    room.phase = "lobby"
    b.__exit__(None, None, None)
    time.sleep(0.3)
    assert calls == []
    a.__exit__(None, None, None)


# ---- doet de taak het juiste? ------------------------------------------------

def test_de_melding_wijst_naar_de_room(tmp_path, monkeypatch):
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    pid_b = _pid(room, uid_b)
    b.__exit__(None, None, None)
    time.sleep(0.2)
    asyncio.run(manager._meld_terug_na(code, pid_b))
    rijen = _meldingen(accounts, uid_b)
    assert len(rijen) == 1
    assert code in rijen[0]["body"]
    assert rijen[0]["naar"] == "room"
    assert json.loads(rijen[0]["data"])["room_code"] == code
    a.__exit__(None, None, None)


def test_een_melding_per_potje(tmp_path, monkeypatch):
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    pid_b = _pid(room, uid_b)
    b.__exit__(None, None, None)
    time.sleep(0.2)
    asyncio.run(manager._meld_terug_na(code, pid_b))
    asyncio.run(manager._meld_terug_na(code, pid_b))
    assert len(_meldingen(accounts, uid_b)) == 1
    a.__exit__(None, None, None)


def test_wie_terug_is_krijgt_hem_niet(tmp_path, monkeypatch):
    """De taak kijkt op het moment van sturen opnieuw: wie binnen het uitstel
    terugkwam heeft nergens last van gehad."""
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    pid_b = _pid(room, uid_b)
    b.__exit__(None, None, None)
    time.sleep(0.2)
    with client.websocket_connect("/ws") as b2:
        b2.send_json({"type": "reconnect", "code": code, "player_id": pid_b})
        _wacht(b2, "joined")
        asyncio.run(manager._meld_terug_na(code, pid_b))
        assert _meldingen(accounts, uid_b) == []
    a.__exit__(None, None, None)


def test_afgelopen_potje_stuurt_niets_meer(tmp_path, monkeypatch):
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    pid_b = _pid(room, uid_b)
    # Het potje is al klaar VOOR de wegval: geen melding, van geen van beide
    # kanten (de wegval plant niets, en ook een rechtstreekse taak kijkt zelf
    # naar de fase en zwijgt).
    room.phase = "final"
    b.__exit__(None, None, None)
    time.sleep(0.2)
    asyncio.run(manager._meld_terug_na(code, pid_b))
    assert _meldingen(accounts, uid_b) == []
    a.__exit__(None, None, None)


# ---- gaat de melding weer weg? ----------------------------------------------

def test_terugkomen_ruimt_de_melding_op(tmp_path, monkeypatch):
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    pid_b = _pid(room, uid_b)
    b.__exit__(None, None, None)
    time.sleep(0.2)
    asyncio.run(manager._meld_terug_na(code, pid_b))
    assert len(_meldingen(accounts, uid_b)) == 1
    with client.websocket_connect("/ws") as b2:
        b2.send_json({"type": "reconnect", "code": code, "player_id": pid_b})
        _wacht(b2, "joined")
        assert _meldingen(accounts, uid_b) == []
        # En het geheugen is leeg: een LATERE wegval in ditzelfde potje mag weer
        # een verse melding geven.
        assert uid_b not in room.terug_gemeld
    a.__exit__(None, None, None)


def test_andermans_intrede_raakt_jouw_melding_niet(tmp_path, monkeypatch):
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    pid_b = _pid(room, uid_b)
    b.__exit__(None, None, None)
    time.sleep(0.2)
    asyncio.run(manager._meld_terug_na(code, pid_b))
    with client.websocket_connect("/ws") as c:
        _account(c, "Cees")
        c.send_json({"type": "join_room", "code": code, "name": "Cees"})
        _wacht(c, "joined")
    assert len(_meldingen(accounts, uid_b)) == 1
    assert uid_b in room.terug_gemeld
    a.__exit__(None, None, None)


def test_einde_potje_ruimt_op(tmp_path, monkeypatch):
    """_terug_voorbij is wat _game_over en _destroy_room aanroepen."""
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    pid_b = _pid(room, uid_b)
    b.__exit__(None, None, None)
    time.sleep(0.2)
    asyncio.run(manager._meld_terug_na(code, pid_b))
    assert len(_meldingen(accounts, uid_b)) == 1
    manager._terug_voorbij(room)
    assert _meldingen(accounts, uid_b) == []
    assert room.terug_gemeld == set()
    a.__exit__(None, None, None)


def test_room_weggooien_ruimt_op(tmp_path, monkeypatch):
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    a, b, uid_a, uid_b, code, room = _room_met_spel(client, manager)
    pid_b = _pid(room, uid_b)
    b.__exit__(None, None, None)
    time.sleep(0.2)
    asyncio.run(manager._meld_terug_na(code, pid_b))
    manager._destroy_room(code)
    assert _meldingen(accounts, uid_b) == []
    a.__exit__(None, None, None)


# ---- de stille admin-herlogin ------------------------------------------------

def test_stille_admin_herlogin_geeft_geen_foutbalk(tmp_path, monkeypatch):
    """De oorzaak van de spookmelding op de main page: een ooit bewaarde
    verkeerde code werd bij elke herverbinding herhaald, en de server
    antwoordde met een rode foutbalk. Stil herlogen krijgt nu alleen de
    afwijzing (zodat de client de code weggooit), geen fout."""
    client, manager, accounts = _verse_app(tmp_path, monkeypatch)
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "admin_login", "secret": "fout123", "stil": True})
        assert ws.receive_json()["type"] == "admin_afgewezen"
        # Met de hand komt de foutbalk er WEL achteraan.
        ws.send_json({"type": "admin_login", "secret": "fout456"})
        assert ws.receive_json()["type"] == "admin_afgewezen"
        assert ws.receive_json()["type"] == "error"
