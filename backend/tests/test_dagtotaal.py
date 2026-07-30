"""Het dagtotaal: woorden plus topografie plus de beste arenapoging.

De arena mag onbeperkt gespeeld worden, dus de valkuil is dat elke poging
meetelt en iemand zijn dagscore kan opstapelen door tien keer te spelen. Deze
tests leggen vast dat alleen de BESTE poging meedoet, precies één keer.
"""

import json
import time

import pytest

from app.db import Database


@pytest.fixture()
def db(tmp_path):
    return Database(str(tmp_path / "test.db"))


DAG = "2026-07-30"


def maak_speler(db: Database, naam: str) -> str:
    with db._lock:
        cur = db._conn.execute(
            "INSERT INTO users (id, name, name_lower, color, created_at) VALUES (?,?,?,?,?)",
            (naam.lower(), naam, naam.lower(), "#FFC23D", time.time()),
        )
        db._conn.commit()
    assert cur.rowcount
    return naam.lower()


def zet_woorden(db: Database, uid: str, score: int, tijd: int = 40000) -> None:
    with db._lock:
        db._conn.execute(
            "INSERT INTO daily_scores (day, user_id, score, time_ms, words, created_at) VALUES (?,?,?,?,?,?)",
            (DAG, uid, score, tijd, json.dumps({}), time.time()),
        )
        db._conn.commit()


def zet_topo(db: Database, uid: str, score: int, tijd: int = 30000) -> None:
    with db._lock:
        db._conn.execute(
            "INSERT INTO topo_scores (day, user_id, score, time_ms, answers, created_at) VALUES (?,?,?,?,?,?)",
            (DAG, uid, score, tijd, json.dumps({}), time.time()),
        )
        db._conn.commit()


def test_drie_delen_tellen_op(db):
    uid = maak_speler(db, "Aish")
    zet_woorden(db, uid, 50)
    zet_topo(db, uid, 40)
    aid = db.arena_start(uid, DAG, "flitsreeks", time.time())
    db.arena_finish(uid, aid, DAG, 900, 4, 20000, time.time())

    bord = db.dag_totaal_board(DAG)
    assert len(bord) == 1
    assert bord[0]["score"] == 50 + 40 + 900


def test_alleen_de_beste_arenapoging_telt(db):
    """Tien keer spelen mag, maar stapelt je dagscore niet op."""
    uid = maak_speler(db, "Kream")
    for score in (100, 900, 400, 250):
        aid = db.arena_start(uid, DAG, "flitsreeks", time.time())
        db.arena_finish(uid, aid, DAG, score, 4, 20000, time.time())

    assert db.dag_totaal_board(DAG)[0]["score"] == 900
    # En het bord bevat hem één keer, niet vier keer.
    assert len(db.dag_totaal_board(DAG)) == 1


def test_onafgeronde_poging_telt_niet(db):
    uid = maak_speler(db, "Ben")
    zet_woorden(db, uid, 30)
    db.arena_start(uid, DAG, "flitsreeks", time.time())  # nooit ingeleverd

    assert db.dag_totaal_board(DAG)[0]["score"] == 30


def test_alleen_arena_gespeeld_staat_ook_op_het_bord(db):
    """Je hoeft niet alle drie te doen om mee te tellen."""
    uid = maak_speler(db, "Milan")
    aid = db.arena_start(uid, DAG, "flitsreeks", time.time())
    db.arena_finish(uid, aid, DAG, 500, 3, 15000, time.time())

    bord = db.dag_totaal_board(DAG)
    assert [r["name"] for r in bord] == ["Milan"]
    assert bord[0]["score"] == 500
    assert db.dag_totaal_players_count(DAG) == 1


def test_hoogste_totaal_staat_bovenaan(db):
    laag = maak_speler(db, "Laag")
    hoog = maak_speler(db, "Hoog")
    zet_woorden(db, laag, 50)
    zet_woorden(db, hoog, 20)
    aid = db.arena_start(hoog, DAG, "flitsreeks", time.time())
    db.arena_finish(hoog, aid, DAG, 800, 4, 20000, time.time())

    assert [r["name"] for r in db.dag_totaal_board(DAG)] == ["Hoog", "Laag"]
