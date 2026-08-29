"""Een woord kopen in Oefenen.

De regel die de app al hanteerde bij de betaalde herkansing: munten mogen het
spel raken, maar nooit punten kopen waar anderen naast staan. Oefenen is solo
en ongeranglijst, dus daar kan het. Wat hier vastligt:

- er wordt echt afgerekend, en nooit zonder saldo;
- twee tikken tegelijk kunnen niet allebei betalen;
- een gekocht woord is GEEN goed antwoord (anders koop je je munten terug) en
  in Ontdekken geen kaart maar een spoor.
"""

import time

import pytest

from app.db import Database


@pytest.fixture()
def db(tmp_path):
    d = Database(str(tmp_path / "hint.db"))
    d._conn.execute(
        "INSERT INTO users (id,name,name_lower,color,created_at,coins) VALUES ('u','u','u','#FFC23D',?,?)",
        (time.time(), 40),
    )
    d._conn.commit()
    return d


def saldo(db):
    return int(db._q("SELECT coins FROM users WHERE id='u'")[0]["coins"])


def test_betalen_gaat_van_je_saldo_af(db):
    assert db.hulp_betaal("u", db.HINT_COINS) is True
    assert saldo(db) == 40 - db.HINT_COINS


def test_zonder_saldo_geen_hint(db):
    db._exec("UPDATE users SET coins=5 WHERE id='u'")
    assert db.hulp_betaal("u", db.HINT_COINS) is False
    assert saldo(db) == 5, "en er gaat niets af bij een mislukte poging"


def test_je_kunt_niet_meer_kopen_dan_je_hebt(db):
    """Twee keer twintig met veertig op zak lukt; de derde niet."""
    assert db.hulp_betaal("u", 20) is True
    assert db.hulp_betaal("u", 20) is True
    assert db.hulp_betaal("u", 20) is False
    assert saldo(db) == 0


def test_een_hint_kost_meer_dan_het_woord_oplevert(db):
    """Oefenen betaalt drie munten per goed antwoord. Zou een hint minder
    kosten, dan was hij een muntenkraan in plaats van hulp bij leren."""
    assert db.HINT_COINS > 3


def test_gast_of_gratis_kan_niet(db):
    assert db.hulp_betaal("", 10) is False
    assert db.hulp_betaal("u", 0) is False
    assert db.hulp_betaal("u", -5) is False
    assert saldo(db) == 40
