"""De betaalde herkansing van het topografiedeel.

Dezelfde afspraken als bij het woordendeel: een keer per dag, je betaalt vooraf
en je beslist voordat je je score ziet. Wat hier anders is: het topografiedeel
serveert zijn vragen een voor een en stempelt per vraag wanneer hij kwam en
wanneer je antwoordde. Blijft dat staan, dan erft de tweede poging de tijd van
de eerste en loopt hij meteen af. Daarom gaat topo_progress ook weg.
"""

import json
import time

import pytest

from app.db import Database

DAG = "2026-08-31"


@pytest.fixture()
def db(tmp_path):
    d = Database(str(tmp_path / "toporetry.db"))
    d._conn.execute(
        "INSERT INTO users (id,name,name_lower,color,created_at,coins) VALUES ('u','u','u','#FFC23D',?,?)",
        (time.time(), 500),
    )
    d._conn.commit()
    return d


def speel(db, score=40):
    now = time.time()
    db._exec("INSERT INTO topo_starts (day,user_id,started_at) VALUES (?,?,?)", (DAG, "u", now))
    for i in range(3):
        db._exec(
            "INSERT INTO topo_progress (day,user_id,idx,served_at,answer,answered_at) VALUES (?,?,?,?,?,?)",
            (DAG, "u", i, now, "iets", now + 2),
        )
    db.topo_submit("u", DAG, score, 30000, json.dumps({"a": "b"}), now, lenient=False)


def saldo(db):
    return int(db._q("SELECT coins FROM users WHERE id='u'")[0]["coins"])


def test_de_herkansing_wist_alles_van_die_dag(db):
    speel(db)
    assert db.topo_retry("u", DAG) == "ok"
    assert db._q("SELECT 1 FROM topo_scores WHERE day=? AND user_id='u'", (DAG,)) == []
    assert db._q("SELECT 1 FROM topo_starts WHERE day=? AND user_id='u'", (DAG,)) == []
    assert db._q("SELECT 1 FROM topo_progress WHERE day=? AND user_id='u'", (DAG,)) == [], \
        "anders erft de tweede poging de klok van de eerste"


def test_hij_kost_wat_hij_kost(db):
    speel(db)
    voor = saldo(db)
    db.topo_retry("u", DAG)
    assert saldo(db) == voor - Database.DAILY_RETRY_COINS


def test_een_keer_per_dag(db):
    speel(db)
    assert db.topo_retry("u", DAG) == "ok"
    speel(db, 55)
    assert db.topo_retry("u", DAG) == "already"
    assert db.topo_retried("u", DAG) is True


def test_zonder_inzending_valt_er_niets_over_te_doen(db):
    assert db.topo_retry("u", DAG) == "no_entry"
    assert saldo(db) == 500


def test_zonder_munten_geen_herkansing(db):
    speel(db)
    db._exec("UPDATE users SET coins=10 WHERE id='u'")
    assert db.topo_retry("u", DAG) == "insufficient"
    assert saldo(db) == 10, "en er gaat niets af"
    assert db._q("SELECT 1 FROM topo_scores WHERE day=? AND user_id='u'", (DAG,)) != [], \
        "de inzending blijft staan als er niet betaald is"


def test_hij_staat_los_van_de_woordenherkansing(db):
    """Twee delen, twee herkansingen. Wie zijn woorden overdeed, mag zijn
    topografie nog steeds overdoen."""
    speel(db)
    db._exec("INSERT INTO daily_retries (day,user_id,used_at) VALUES (?,?,?)", (DAG, "u", time.time()))
    assert db.daily_retried("u", DAG) is True
    assert db.topo_retried("u", DAG) is False
    assert db.topo_retry("u", DAG) == "ok"


def test_dezelfde_prijs_als_bij_de_woorden(db):
    assert Database.DAILY_RETRY_COINS == 100
