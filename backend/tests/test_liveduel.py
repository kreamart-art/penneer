"""Het live duel: twee mensen die tegelijk in de wachtrij staan.

Een live duel is met opzet GEEN nieuw soort wedstrijd. Het is hetzelfde duel,
alleen ontstaan uit een wachtrij, met allebei de spelers tegelijk aan zet.
Wat hier vastligt is dus vooral dat de koppeling klopt en dat de rij niemand
kwijtraakt of dubbel zet:

- twee zoekers worden aan elkaar gekoppeld en krijgen hetzelfde duel;
- wie in zijn eentje zoekt, blijft wachten (en krijgt geen duel tegen zichzelf);
- wie weggaat, staat er niet meer in;
- een gast zonder profiel kan niet zoeken, want een duel hangt aan een account.
"""

import sys

import pytest


def _verse_app(tmp_path, monkeypatch):
    monkeypatch.setenv("PENNEER_DB_PATH", str(tmp_path / "duel.db"))
    for mod in [m for m in list(sys.modules) if m.startswith("app.")] + ["app"]:
        sys.modules.pop(mod, None)
    from fastapi.testclient import TestClient
    from app import social
    from app.main import app

    return TestClient(app), social.accounts


def _maak_account(ws, naam: str) -> str:
    ws.send_json({"type": "account_create", "name": naam})
    m = ws.receive_json()
    assert m["type"] == "account", m
    return m["account"]["id"]


def test_twee_zoekers_krijgen_hetzelfde_duel(tmp_path, monkeypatch):
    client, _ = _verse_app(tmp_path, monkeypatch)
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        _maak_account(a, "Aap")
        _maak_account(b, "Beer")

        a.send_json({"type": "duel_zoek"})
        assert a.receive_json()["type"] == "duel_zoekt", "alleen: er staat er een te wachten"

        b.send_json({"type": "duel_zoek"})
        # Allebei horen nu hetzelfde duel te krijgen.
        ma = _wacht_op(a, "duel_match")
        mb = _wacht_op(b, "duel_match")
        assert ma["duel_id"] == mb["duel_id"]
        assert ma["tegen"] == "Beer" and mb["tegen"] == "Aap"


def test_in_je_eentje_zoeken_levert_geen_duel_op(tmp_path, monkeypatch):
    client, accounts = _verse_app(tmp_path, monkeypatch)
    with client.websocket_connect("/ws") as a:
        _maak_account(a, "Aap")
        a.send_json({"type": "duel_zoek"})
        m = a.receive_json()
        assert m["type"] == "duel_zoekt" and m["aantal"] == 1
        assert len(accounts.duel_rij) == 1, "en zeker geen duel tegen zichzelf"


def test_twee_keer_zoeken_zet_je_niet_twee_keer_in_de_rij(tmp_path, monkeypatch):
    client, accounts = _verse_app(tmp_path, monkeypatch)
    with client.websocket_connect("/ws") as a:
        _maak_account(a, "Aap")
        for _ in range(3):
            a.send_json({"type": "duel_zoek"})
            a.receive_json()
        assert accounts.duel_rij.count(accounts.duel_rij[0]) == 1


def test_stoppen_haalt_je_uit_de_rij(tmp_path, monkeypatch):
    client, accounts = _verse_app(tmp_path, monkeypatch)
    with client.websocket_connect("/ws") as a:
        _maak_account(a, "Aap")
        a.send_json({"type": "duel_zoek"})
        a.receive_json()
        a.send_json({"type": "duel_zoek_stop"})
        assert _wacht_op(a, "duel_zoekt")["gestopt"] is True
        assert accounts.duel_rij == []


def test_weglopen_haalt_je_ook_uit_de_rij(tmp_path, monkeypatch):
    """Anders zit iemand die de app sloot een minuut later aan een duel vast."""
    client, accounts = _verse_app(tmp_path, monkeypatch)
    with client.websocket_connect("/ws") as a:
        _maak_account(a, "Aap")
        a.send_json({"type": "duel_zoek"})
        a.receive_json()
        assert accounts.duel_rij != []
    assert accounts.duel_rij == []


def test_een_gast_kan_niet_zoeken(tmp_path, monkeypatch):
    """Een duel hangt aan een account: zonder profiel is er niets om te bewaren."""
    client, accounts = _verse_app(tmp_path, monkeypatch)
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "duel_zoek"})
        m = a.receive_json()
        assert m["type"] == "error"
        assert accounts.duel_rij == []


def test_geblokkeerde_spelers_worden_niet_gekoppeld(tmp_path, monkeypatch):
    client, accounts = _verse_app(tmp_path, monkeypatch)
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        uid_a = _maak_account(a, "Aap")
        uid_b = _maak_account(b, "Beer")
        accounts.db.block(uid_a, uid_b)

        a.send_json({"type": "duel_zoek"})
        a.receive_json()
        b.send_json({"type": "duel_zoek"})
        b.receive_json()
        assert len(accounts.duel_rij) == 2, "allebei blijven wachten, en niet op elkaar"


def _wacht_op(ws, soort: str, max_berichten: int = 6) -> dict:
    """Het eerstvolgende bericht van dit soort. De socket stuurt ook andere
    dingen (een stand van de rij, een melding), en daar gaat deze test niet over."""
    for _ in range(max_berichten):
        m = ws.receive_json()
        if m.get("type") == soort:
            return m
    raise AssertionError(f"geen {soort} ontvangen")
