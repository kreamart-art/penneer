"""De onderlinge stand tegen wie je vaak speelt.

Niet bijgehouden maar GETELD, uit de potjes en duels die er toch al liggen.
Daardoor kan de stand niet uit de pas lopen met de wedstrijden waar hij uit
volgt, en telt een potje van vorig jaar gewoon mee.
"""

import time

import pytest

from app.db import Database


@pytest.fixture()
def db(tmp_path):
    d = Database(str(tmp_path / "riv.db"))
    now = time.time()
    for uid in ("a", "b", "c"):
        d._conn.execute(
            "INSERT INTO users (id,name,name_lower,color,created_at) VALUES (?,?,?,?,?)",
            (uid, uid.upper(), uid, "#FFC23D", now),
        )
    d._conn.commit()
    return d


def potje(db, gid, winnaar, *spelers, wanneer=None):
    now = wanneer or time.time()
    db._conn.execute("INSERT INTO games (id,room_code,finished_at,rounds) VALUES (?,?,?,?)", (gid, "X", now, 5))
    for uid in spelers:
        db._conn.execute(
            "INSERT INTO game_players (game_id,user_id,score,is_winner,uniques,dubbels) VALUES (?,?,?,?,?,?)",
            (gid, uid, 50, 1 if uid == winnaar else 0, 5, 1),
        )
    db._conn.commit()


def duel(db, did, a, b, winnaar):
    now = time.time()
    db._conn.execute(
        "INSERT INTO duels (id,a,b,rounds,status,winner,created_at,expires_at,finished_at)"
        " VALUES (?,?,?,'[]','done',?,?,?,?)",
        (did, a, b, winnaar, now, now + 100, now),
    )
    db._conn.commit()


def test_de_stand_telt_potjes_en_duels_bij_elkaar(db):
    potje(db, "g1", "a", "a", "b")
    potje(db, "g2", "a", "a", "b")
    potje(db, "g3", "b", "a", "b")
    duel(db, "d1", "a", "b", "a")
    r = db.rivalen("a")[0]
    assert (r["ik"], r["hij"]) == (3, 1)
    assert (r["potjes"], r["duels"], r["ontmoetingen"]) == (3, 1, 4)


def test_de_stand_is_omgekeerd_voor_de_ander(db):
    potje(db, "g1", "a", "a", "b")
    assert (db.rivalen("a")[0]["ik"], db.rivalen("a")[0]["hij"]) == (1, 0)
    assert (db.rivalen("b")[0]["ik"], db.rivalen("b")[0]["hij"]) == (0, 1)


def test_wie_je_het_vaakst_tegenkwam_staat_bovenaan(db):
    for i in range(3):
        potje(db, f"gb{i}", "a", "a", "b")
    potje(db, "gc", "c", "a", "c")
    namen = [r["id"] for r in db.rivalen("a")]
    assert namen == ["b", "c"]


def test_een_potje_met_drie_geeft_twee_rivalen(db):
    potje(db, "g1", "a", "a", "b", "c")
    stand = {r["id"]: (r["ik"], r["hij"]) for r in db.rivalen("a")}
    assert stand == {"b": (1, 0), "c": (1, 0)}


def test_gelijkspel_telt_voor_niemand(db):
    """In teams kunnen twee spelers allebei winnen. Dan is er niets te vieren
    en niets goed te maken."""
    potje(db, "g1", None, "a", "b")            # niemand won
    db._conn.execute("UPDATE game_players SET is_winner=1 WHERE game_id='g1'")  # allebei
    db._conn.commit()
    r = db.rivalen("a")[0]
    assert (r["ik"], r["hij"]) == (0, 0)
    assert r["ontmoetingen"] == 1, "de ontmoeting telt wel"


def test_een_duel_zonder_winnaar_telt_alleen_als_ontmoeting(db):
    duel(db, "d1", "a", "b", None)
    r = db.rivalen("a")[0]
    assert (r["ik"], r["hij"], r["duels"]) == (0, 0, 1)


def test_zonder_geschiedenis_geen_rivalen(db):
    assert db.rivalen("a") == []
    assert db.rivalen("") == []
