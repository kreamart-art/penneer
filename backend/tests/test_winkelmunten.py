"""Een item, een munt.

Hiervoor was bijna alles met allebei te koop tegen een vaste koers, en dan is
cash geen tweede munt maar een compactere versie van dezelfde. Nu vertellen ze
twee verhalen: coins verdien je door te SPELEN (elke week een paar duizend),
cash door te BLIJVEN (alleen mijlpalen betalen hem uit).

De landenknoppen zijn de ene uitzondering, en die bestond al: de knop van JOUW
land koop je met coins, alle andere met cash. Per speler is het dus nog steeds
een munt per item.
"""

import time

import pytest

from app.db import Database, AVATAR_PACKS


@pytest.fixture()
def db(tmp_path):
    d = Database(str(tmp_path / "winkel.db"))
    d._conn.execute(
        "INSERT INTO users (id,name,name_lower,color,created_at,coins,cash,land)"
        " VALUES ('u','u','u','#FFC23D',?,?,?,'NL')",
        (time.time(), 100000, 1000),
    )
    d._conn.commit()
    return d


def test_alleen_de_landenknoppen_staan_in_allebei_de_lijsten():
    """En dat is de bestaande regel, geen dubbele prijskaart: buy_item_coins
    weigert een knop van een ander land."""
    allebei = set(Database.COIN_PRICES) & set(Database.CASH_PRICES)
    assert allebei == set(Database.LAND_BUZZER_IDS)


def test_de_avatarpacks_zijn_alleen_met_cash(db):
    for pk in AVATAR_PACKS:
        assert pk not in Database.COIN_PRICES
        assert Database.CASH_PRICES[pk] == 150
        assert db.buy_item_coins("u", pk) == "invalid", "ook met een volle beurs niet"


def test_de_rolskins_en_emotes_zijn_alleen_met_coins(db):
    for item in ("rs01", "rs09", "empack4", "empack5"):
        assert item in Database.COIN_PRICES
        assert item not in Database.CASH_PRICES
        assert db.buy_item_cash("u", item) == "invalid"


def test_de_scheidsrechter_blijft_cash(db):
    assert "referee" not in Database.COIN_PRICES
    assert Database.CASH_PRICES["referee"] == 250


def test_je_eigen_landenknop_koop_je_met_coins(db):
    """NL in dit profiel, dus bz01 mag met coins en de rest niet."""
    assert db.buy_item_coins("u", "bz01") == "ok"
    assert db.buy_item_coins("u", "bz02") == "locked"
    assert db.buy_item_cash("u", "bz02") == "ok", "andere landen gaan met cash"


def test_kopen_gaat_van_de_juiste_beurs_af(db):
    munten = lambda: int(db._q("SELECT coins FROM users WHERE id='u'")[0]["coins"])
    cash = lambda: int(db._q("SELECT cash FROM users WHERE id='u'")[0]["cash"])
    voor_c, voor_k = munten(), cash()
    db.buy_item_coins("u", "rs01")
    assert (munten(), cash()) == (voor_c - Database.COIN_PRICES["rs01"], voor_k)
    db.buy_item_cash("u", "avpack1")
    assert (munten(), cash()) == (voor_c - Database.COIN_PRICES["rs01"], voor_k - 150)


def test_alles_in_de_winkel_heeft_precies_een_prijs():
    """Een item zonder prijs is onkoopbaar en een item met twee prijzen vraagt
    om een omrekensom. Beide horen niet te bestaan (op de landenknoppen na)."""
    for item in set(Database.COIN_PRICES) | set(Database.CASH_PRICES):
        if item in Database.LAND_BUZZER_IDS:
            continue
        assert (item in Database.COIN_PRICES) != (item in Database.CASH_PRICES), item
