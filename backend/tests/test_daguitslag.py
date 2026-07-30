"""Het uitslagmoment: één keer uitbetalen, en daarna dezelfde bon.

De valkuil bij een prijs die je bij het OPHALEN krijgt is dat hij twee keer
uitbetaalt zodra iemand ververst of twee tabbladen open heeft. Daarom is de rij
in dag_prijzen tegelijk de bon en het slot: hij bestaat, dus er is al betaald.
"""

import json
import time

import pytest

from app.db import Database

DAG = "2026-07-30"


@pytest.fixture()
def db(tmp_path):
    return Database(str(tmp_path / "test.db"))


def speler(db: Database, naam: str) -> str:
    with db._lock:
        db._conn.execute(
            "INSERT INTO users (id, name, name_lower, color, created_at) VALUES (?,?,?,?,?)",
            (naam.lower(), naam, naam.lower(), "#FFC23D", time.time()),
        )
        db._conn.commit()
    return naam.lower()


def woorden(db: Database, uid: str, score: int) -> None:
    with db._lock:
        db._conn.execute(
            "INSERT INTO daily_scores (day, user_id, score, time_ms, words, created_at) VALUES (?,?,?,?,?,?)",
            (DAG, uid, score, 40000, json.dumps({}), time.time()),
        )
        db._conn.commit()


def saldo(db: Database, uid: str) -> tuple[int, int]:
    with db._lock:
        r = db._q("SELECT coins, cash FROM users WHERE id=?", (uid,))[0]
    return int(r["coins"]), int(r["cash"])


def test_winnaar_krijgt_kist_munten_en_cash(db):
    uid = speler(db, "Kream")
    woorden(db, uid, 50)

    bon = db.dag_uitslag(uid, DAG, time.time())
    assert bon["plek"] == 1 and bon["spelers"] == 1
    assert (bon["coins"], bon["cash"], bon["kist"]) == (500, 5, "kist5")
    assert saldo(db, uid) == (500, 5)
    # De kist staat klaar om te openen, hij is niet al leeggehaald.
    assert db.kist_dicht(uid)["kist"] == "kist5"


def test_tweede_keer_ophalen_betaalt_niet_opnieuw(db):
    uid = speler(db, "Aish")
    woorden(db, uid, 30)

    eerste = db.dag_uitslag(uid, DAG, time.time())
    tweede = db.dag_uitslag(uid, DAG, time.time())
    assert eerste["coins"] == tweede["coins"]
    assert saldo(db, uid) == (500, 5)          # niet verdubbeld
    with db._lock:
        assert len(db._q("SELECT id FROM kisten WHERE user_id=?", (uid,))) == 1


def test_lagere_plek_krijgt_de_ladder_van_die_plek(db):
    hoog, laag = speler(db, "Hoog"), speler(db, "Laag")
    woorden(db, hoog, 90)
    woorden(db, laag, 10)

    assert db.dag_uitslag(laag, DAG, time.time())["plek"] == 2
    assert saldo(db, laag) == (350, 2)
    assert saldo(db, hoog) == (0, 0)           # die heeft nog niet opgehaald


def test_wie_niet_meedeed_krijgt_niets(db):
    kijker = speler(db, "Kijker")
    speler_die_speelde = speler(db, "Speler")
    woorden(db, speler_die_speelde, 20)

    assert db.dag_uitslag(kijker, DAG, time.time()) is None
    assert saldo(db, kijker) == (0, 0)


def test_gezien_blijft_staan(db):
    uid = speler(db, "Milan")
    woorden(db, uid, 40)
    db.dag_uitslag(uid, DAG, time.time())
    db.dag_uitslag_gezien(uid, DAG)
    assert db.dag_uitslag(uid, DAG, time.time())["gezien"] == 1
