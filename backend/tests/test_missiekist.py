"""De kist voor drie op drie.

Maak je alle dagmissies af, dan staat er een kist klaar. Wat hier vastligt is
vooral dat het bij EEN kist blijft: de missies worden vanuit drie plekken
opgehoogd (een potje, de dagronde, de chat) en elk van die plekken loopt langs
dezelfde teller, dus zonder slot zou elke volgende bump er een kist bij leggen.
"""

import time

import pytest

from app import missions
from app.db import Database

DAG = "2026-08-12"


@pytest.fixture()
def db(tmp_path):
    return Database(str(tmp_path / "test.db"))


def maak_speler(db: Database, naam: str) -> str:
    with db._lock:
        db._conn.execute(
            "INSERT INTO users (id, name, name_lower, color, created_at) VALUES (?,?,?,?,?)",
            (naam.lower(), naam, naam.lower(), "#FFC23D", time.time()),
        )
        db._conn.commit()
    return naam.lower()


def maak_alles_af(db: Database, uid: str) -> None:
    """Elke missie van de dag op zijn doel zetten, langs de gewone weg."""
    for m in missions.missions_for(DAG):
        missions.bump_all(db, uid, DAG, ((m["key"], m["target"]),))


def kisten(db: Database, uid: str) -> int:
    return len(db._q("SELECT id FROM kisten WHERE user_id=?", (uid,)))


def test_alles_af_levert_een_kist(db):
    uid = maak_speler(db, "Aap")
    maak_alles_af(db, uid)
    assert missions.alles_af(db, uid, DAG)
    assert kisten(db, uid) == 1


def test_halverwege_nog_geen_kist(db):
    uid = maak_speler(db, "Beer")
    eerste = missions.missions_for(DAG)[0]
    missions.bump_all(db, uid, DAG, ((eerste["key"], eerste["target"]),))
    assert not missions.alles_af(db, uid, DAG)
    assert kisten(db, uid) == 0


def test_er_komt_er_nooit_een_tweede_bij(db):
    uid = maak_speler(db, "Cees")
    maak_alles_af(db, uid)
    # Nog een potje op dezelfde dag: de missies staan al af, maar ook een
    # rechtstreekse tweede poging mag niets opleveren.
    maak_alles_af(db, uid)
    assert db.missie_dagkist(uid, DAG, time.time()) is False
    assert kisten(db, uid) == 1


def test_de_kist_is_van_de_dag_en_niet_van_altijd(db):
    uid = maak_speler(db, "Daan")
    maak_alles_af(db, uid)
    assert db.missie_dagkist(uid, "2026-08-13", time.time()) is True
    assert kisten(db, uid) == 2


def test_de_kist_telt_niet_als_missie_mee(db):
    """De sleutel staat in dezelfde tabel als de missies, dus hij mag nooit
    voor een missie worden aangezien."""
    uid = maak_speler(db, "Eef")
    maak_alles_af(db, uid)
    stand = db.mission_state(uid, DAG)
    assert db.DAG_KIST_KEY in stand
    assert db.DAG_KIST_KEY not in {m["key"] for m in missions.missions_for(DAG)}
