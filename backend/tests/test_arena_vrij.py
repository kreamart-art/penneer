"""Vrij spelen in de arena.

De rotatie geeft een spel per weekdag, dus zes van de zeven lagen zes dagen per
week stil terwijl ze af waren. Vrij spelen zet ze open. De hele vraag is waar
de grens loopt: een vrije poging is een ECHTE poging (je record, je penning)
maar hij staat buiten de wedstrijd van vandaag. Anders zou je het dagbord
kunnen vullen met een spel dat vandaag niet draait.
"""

import time

import pytest

from app import arena
from app.db import Database

DAG = "2026-08-30"


@pytest.fixture()
def db(tmp_path):
    d = Database(str(tmp_path / "arena.db"))
    now = time.time()
    for uid in ("a", "b"):
        d._conn.execute(
            "INSERT INTO users (id,name,name_lower,color,created_at) VALUES (?,?,?,?,?)",
            (uid, uid, uid, "#FFC23D", now),
        )
    d._conn.commit()
    return d


@pytest.fixture()
def spellen():
    vandaag = arena.spel_voor(DAG)["key"]
    ander = next(k for k in arena.ALLE if k != vandaag)
    return vandaag, ander


def test_een_vrije_poging_komt_niet_op_het_bord(db, spellen):
    vandaag, ander = spellen
    now = time.time()
    p = db.arena_start("a", DAG, vandaag, now)
    db.arena_finish("a", p, DAG, 100, 3, 20000, now)
    vrij = db.arena_start("b", DAG, ander, now, vrij=True)
    db.arena_finish("b", vrij, DAG, 9999, 9, 20000, now)

    assert [r["id"] for r in db.arena_board(DAG)] == ["a"]
    assert db.arena_players_count(DAG) == 1
    assert db.arena_rank("b", DAG)[0] == 0, "geen plek met een vrije poging"


def test_een_vrije_poging_telt_niet_mee_voor_het_dagtotaal(db, spellen):
    vandaag, ander = spellen
    now = time.time()
    vrij = db.arena_start("b", DAG, ander, now, vrij=True)
    db.arena_finish("b", vrij, DAG, 9999, 9, 20000, now)
    assert db.dag_totaal_players_count(DAG) == 0
    assert db.dag_totaal_board(DAG) == []


def test_maar_hij_telt_wel_voor_je_record(db, spellen):
    _, ander = spellen
    now = time.time()
    p = db.arena_start("b", DAG, ander, now, vrij=True)
    db.arena_finish("b", p, DAG, 40, 2, 9000, now)
    p2 = db.arena_start("b", DAG, ander, now, vrij=True)
    db.arena_finish("b", p2, DAG, 75, 4, 9000, now)
    assert db.arena_records("b")[ander] == {"beste": 75, "pogingen": 2}


def test_de_server_bepaalt_zelf_of_een_poging_vrij_was(db, spellen):
    """De client mag niet zeggen of zijn score voor het bord telt."""
    vandaag, ander = spellen
    now = time.time()
    dag = db.arena_start("a", DAG, vandaag, now)
    vrij = db.arena_start("a", DAG, ander, now, vrij=True)
    assert db.arena_is_vrij(dag, "a") is False
    assert db.arena_is_vrij(vrij, "a") is True
    assert db.arena_is_vrij(vrij, "b") is None, "een poging van iemand anders bestaat niet voor jou"


def test_alle_zeven_spellen_bestaan_en_zijn_af():
    """De penning 'allrounder' vraagt om alle zeven; als er eentje niet af is,
    is die penning onhaalbaar."""
    assert len(arena.ALLE) == 7
    assert all(arena.af(k) for k in arena.ALLE)
    assert not arena.bestaat("bestaatniet")
