"""De medaillekast: penningen die uit een TELLING volgen.

De winst van tellen in plaats van bijhouden is dat een penning niet aan één
moment hangt. Dat is precies wat hier wordt vastgelegd:

- wie de grens al voorbij is krijgt hem bij de eerstvolgende herziening, ook al
  gebeurde het lang geleden (met terugwerkende kracht);
- een tweede herziening levert niets nieuws op (geen dubbele toekenning);
- de grens moet echt gehaald zijn, eentje eronder telt niet;
- de oude penningen blijven van hun eigen pad: herzie() raakt ze niet aan.
"""

import time

import pytest

from app import prestaties
from app.db import Database


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


def speel(db: Database, uid: str, aantal: int, *, winst: bool = False, score: int = 20,
          uniques: int = 3, dubbels: int = 1, medespelers: int = 1) -> None:
    """Potjes op naam zetten langs dezelfde tabellen als een echt potje."""
    now = time.time()
    with db._lock:
        for i in range(aantal):
            gid = f"g{uid}{i}{score}{uniques}{dubbels}{medespelers}"
            db._conn.execute("INSERT OR IGNORE INTO games (id, room_code, finished_at, rounds) VALUES (?,?,?,?)",
                             (gid, "TEST", now - i, 5))
            db._conn.execute(
                "INSERT OR IGNORE INTO game_players (game_id, user_id, score, is_winner, uniques, dubbels) VALUES (?,?,?,?,?,?)",
                (gid, uid, score, 1 if winst else 0, uniques, dubbels))
            for m in range(medespelers - 1):
                mid = f"{uid}-mede{m}"
                db._conn.execute(
                    "INSERT OR IGNORE INTO users (id, name, name_lower, color, created_at) VALUES (?,?,?,?,?)",
                    (mid, mid, mid, "#FFC23D", now))
                db._conn.execute(
                    "INSERT OR IGNORE INTO game_players (game_id, user_id, score, is_winner, uniques, dubbels) VALUES (?,?,?,?,?,?)",
                    (gid, mid, 5, 0, 1, 0))
        db._conn.commit()


def test_met_terugwerkende_kracht(db):
    """Vijftig potjes die er al stonden leveren de penning op zodra we tellen."""
    uid = maak_speler(db, "Aap")
    speel(db, uid, 50)
    nieuw = prestaties.herzie(db, uid)
    assert "vijftig_games" in nieuw
    assert "volhouder" not in nieuw, "honderd is honderd"


def test_niet_twee_keer(db):
    uid = maak_speler(db, "Beer")
    speel(db, uid, 50)
    prestaties.herzie(db, uid)
    assert prestaties.herzie(db, uid) == []


def test_eentje_te_weinig_telt_niet(db):
    uid = maak_speler(db, "Cees")
    speel(db, uid, 49)
    assert "vijftig_games" not in prestaties.herzie(db, uid)


def test_de_oude_penningen_blijven_van_hun_eigen_pad(db):
    """eerste_game en zijn veertien broers worden aan het eind van een potje
    toegekend. herzie() mag daar niet naast gaan zitten toekennen."""
    uid = maak_speler(db, "Daan")
    speel(db, uid, 50, winst=True)
    nieuw = prestaties.herzie(db, uid)
    assert "eerste_game" not in nieuw and "tien_games" not in nieuw
    assert set(nieuw) <= set(prestaties.SLEUTELS)


def test_een_potje_zonder_dubbele_woorden(db):
    uid = maak_speler(db, "Eef")
    speel(db, uid, 1, uniques=12, dubbels=0)
    assert "eigenzinnig" in prestaties.herzie(db, uid)


def test_drie_woorden_zonder_dubbel_is_geen_prestatie(db):
    """Anders haal je hem met een potje dat na één ronde stukliep."""
    uid = maak_speler(db, "Fien")
    speel(db, uid, 1, uniques=3, dubbels=0)
    assert "eigenzinnig" not in prestaties.herzie(db, uid)


def test_gezelschap_kijkt_naar_het_grootste_potje(db):
    uid = maak_speler(db, "Gijs")
    speel(db, uid, 1, medespelers=4)
    assert "gezelschap" not in prestaties.herzie(db, uid)
    speel(db, uid, 1, medespelers=5, score=21)
    assert "gezelschap" in prestaties.herzie(db, uid)


def test_snelle_dagronde_moet_ook_goed_zijn(db):
    """Een lege inzending in twee tellen is snel maar geen prestatie."""
    uid = maak_speler(db, "Hein")
    with db._lock:
        db._conn.execute(
            "INSERT INTO daily_scores (day, user_id, score, time_ms, words, created_at) VALUES (?,?,?,?,?,?)",
            ("2026-08-01", uid, 5, 4000, "{}", time.time()))
        db._conn.commit()
    assert "sneldenker" not in prestaties.herzie(db, uid)
    with db._lock:
        db._conn.execute(
            "INSERT INTO daily_scores (day, user_id, score, time_ms, words, created_at) VALUES (?,?,?,?,?,?)",
            ("2026-08-02", uid, 34, 28000, "{}", time.time()))
        db._conn.commit()
    assert "sneldenker" in prestaties.herzie(db, uid)


def test_gast_krijgt_niets(db):
    assert prestaties.herzie(db, "") == []


def test_elke_penning_heeft_een_bestaande_teller(db):
    onbekend = [k for k, t, _ in prestaties.KAST if t not in prestaties.TELLERS and t != prestaties.REEKS]
    assert onbekend == []


def test_elke_teller_draait_ook_echt(db):
    """Een tikfout in het SQL van een teller mag niet pas in productie opvallen."""
    uid = maak_speler(db, "Ida")
    stand = prestaties.stand(db, uid)
    assert set(stand) >= set(prestaties.TELLERS)
    assert all(isinstance(v, int) for v in stand.values())


def test_de_volgorde_dekt_de_hele_kast(db):
    assert set(prestaties.SLEUTELS) <= set(prestaties.VOLGORDE)
    assert len(prestaties.VOLGORDE) == len(set(prestaties.VOLGORDE))


def test_doelen_hebben_geen_dubbele_sleutels(db):
    d = prestaties.doelen()
    assert set(d) <= set(prestaties.VOLGORDE)
    # Wat aan een gebeurtenis hangt heeft met opzet GEEN doel.
    assert "comeback" not in d and "perfecte_ronde" not in d
