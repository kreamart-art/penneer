"""De rem: hoe vaak iets mag.

Wat hier vastligt is niet "er zit een limiet op" maar de VORM ervan, want daar
zit het verschil tussen een rem die werkt en een rem die echte spelers in de
weg zit:

- het venster SCHUIFT, dus na afloop mag het weer, en niet pas na een vast
  blok van een uur;
- de sleutel is per adres, dus twee spelers achter dezelfde wifi remmen elkaar
  niet;
- bij inloggen tellen alleen MISSERS, en een gelukte poging wist de teller;
- de socket gebruikt een emmer en geen venster, want een salvo aan het eind van
  een ronde is normaal spel en moet gewoon door.
"""

import time

import pytest

from app import rem


@pytest.fixture(autouse=True)
def schoon():
    """Elke test zijn eigen tellers; de module-remmen zijn gedeeld."""
    rem.GEWEIGERD.clear()
    yield
    rem.GEWEIGERD.clear()


def test_derde_poging_wordt_geweigerd():
    r = rem.Rem("test/kort", 2, 60)
    assert r.wacht("a") == 0.0
    assert r.wacht("a") == 0.0
    assert r.wacht("a") > 0


def test_venster_schuift_mee():
    r = rem.Rem("test/schuif", 1, 0.3)
    assert r.wacht("a") == 0.0
    assert r.wacht("a") > 0
    time.sleep(0.35)
    assert r.wacht("a") == 0.0, "na het venster hoort het gewoon weer te mogen"


def test_sleutels_staan_los_van_elkaar():
    r = rem.Rem("test/sleutels", 1, 60)
    assert r.wacht("speler-a") == 0.0
    assert r.wacht("speler-b") == 0.0, "een andere sleutel mag niet meegeremd worden"


def test_gewicht_telt_megabytes_en_niet_pogingen():
    r = rem.Rem("test/bytes", 10 * rem.MB, 3600)
    assert r.wacht("a", 4 * rem.MB) == 0.0
    assert r.wacht("a", 4 * rem.MB) == 0.0
    assert r.wacht("a", 4 * rem.MB) > 0, "derde upload past niet meer in het budget"


def test_wis_geeft_vrij_baan_na_een_gelukte_poging():
    r = rem.Rem("test/wis", 2, 60)
    r.tel("a")
    r.tel("a")
    assert r.over("a") > 0
    r.wis("a")
    assert r.over("a") == 0.0


def test_over_telt_zelf_niet_mee():
    r = rem.Rem("test/kijken", 1, 60)
    assert r.over("a") == 0.0
    assert r.over("a") == 0.0, "kijken mag niet hetzelfde zijn als afboeken"
    r.tel("a")
    assert r.over("a") > 0


def test_weigeringen_worden_geteld_voor_de_meterkast():
    r = rem.Rem("test/teller", 1, 60)
    r.wacht("a")
    r.wacht("a")
    r.wacht("a")
    assert rem.stand()["test/teller"] == 2


def test_emmer_laat_een_salvo_door_en_knijpt_daarna_af():
    e = rem.Emmer(5, 1.0)
    assert all(e.pak() for _ in range(5)), "de eerste vijf zijn het salvo"
    assert not e.pak(), "daarna is de emmer leeg"


def test_emmer_loopt_weer_vol():
    e = rem.Emmer(1, 20.0)
    assert e.pak()
    assert not e.pak()
    time.sleep(0.12)
    assert e.pak(), "met 20 per seconde is er na 0,1s weer een druppel"


class NepVerbinding:
    def __init__(self, koppen: dict, host: str = "10.0.0.1"):
        self.headers = koppen
        self.client = type("C", (), {"host": host})()


def test_ip_komt_van_achter_de_proxy_vandaan():
    v = NepVerbinding({"x-forwarded-for": "203.0.113.7, 10.0.0.1"})
    assert rem.ip_van(v) == "203.0.113.7", "anders zit de hele wereld achter het proxy-adres"


def test_ip_valt_terug_op_de_verbinding_zelf():
    assert rem.ip_van(NepVerbinding({}, host="192.168.1.9")) == "192.168.1.9"


def test_rem_uit_laat_alles_door(monkeypatch):
    monkeypatch.setattr(rem, "AAN", False)
    r = rem.Rem("test/uit", 1, 60)
    assert r.wacht("a") == 0.0
    assert r.wacht("a") == 0.0


# ---- over de echte socket ---------------------------------------------------
#
# Hierboven staat het mechanisme, hieronder of het ook ECHT in de weg staat op
# de plek waar het geld kost. Met een verse app per test, want de remmen zijn
# module-breed en zouden anders over de tests heen lopen.

def _verse_app(tmp_path, monkeypatch):
    import sys

    monkeypatch.setenv("PENNEER_DB_PATH", str(tmp_path / "rem.db"))
    for mod in [m for m in list(sys.modules) if m.startswith("app.")] + ["app"]:
        sys.modules.pop(mod, None)
    from fastapi.testclient import TestClient
    from app import social
    from app.main import app

    return TestClient(app), social


def test_magic_link_stuurt_maar_twee_mails_per_adres(tmp_path, monkeypatch):
    """De duurste knop van de app: elke druk is een echte mail."""
    client, social = _verse_app(tmp_path, monkeypatch)
    gestuurd = []
    monkeypatch.setattr(social.accounts.db, "start_login", lambda e: gestuurd.append(e))

    with client.websocket_connect("/ws") as ws:
        for _ in range(6):
            ws.send_json({"type": "account_request_login", "email": "iemand@voorbeeld.nl"})
            # Altijd hetzelfde antwoord, ook als er geremd wordt: of een adres
            # bestaat en of het al een mail kreeg, hoort niemand te zien.
            assert ws.receive_json()["type"] == "login_link_sent"

    assert len(gestuurd) == 2, "zes drukken, hooguit twee mails"


def test_accounts_aanmaken_stopt_na_tien_vanaf_hetzelfde_adres(tmp_path, monkeypatch):
    client, _ = _verse_app(tmp_path, monkeypatch)
    gelukt = 0
    with client.websocket_connect("/ws") as ws:
        for i in range(13):
            ws.send_json({"type": "account_create", "name": f"Speler{i}"})
            if ws.receive_json()["type"] == "account":
                gelukt += 1
    assert gelukt == 10, f"tien mag, de rest niet ({gelukt} gelukt)"
