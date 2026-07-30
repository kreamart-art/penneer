"""Foto's en stickers in privéberichten.

De valkuil bij een bericht dat naar een losse blob wijst is EIGENDOM: het
bericht draagt alleen een id, en zonder controle kun je met een gegokt of
afgekeken id andermans foto in je eigen gesprek plakken. Die controle is het
hart van deze tests. De rest legt vast dat een plaatje net als een emote en een
spraakbericht de andere velden uitzet, zodat een bericht altijd precies EEN
soort is en de weergave nooit hoeft te kiezen.
"""

import time

import pytest

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


PLAATJE = b"RIFF\x00\x00\x00\x00WEBPVP8 "


def test_opslaan_en_teruglezen(db):
    uid = maak_speler(db, "Aap")
    iid = db.dm_image_store(uid, "image/webp", PLAATJE)
    assert db.dm_image_get(iid) == ("image/webp", PLAATJE)


def test_onbekend_id_geeft_niets(db):
    assert db.dm_image_get("bestaatniet") is None


def test_eigen_plaatje_mag(db):
    a = maak_speler(db, "Aap")
    b = maak_speler(db, "Beer")
    iid = db.dm_image_store(a, "image/webp", PLAATJE)
    msg = db.dm_send(a, b, "", image_id=iid)
    assert msg is not None
    assert msg["image_id"] == iid
    # Een plaatjesbericht is alleen een plaatje: geen tekst, geen spraak.
    assert msg["text"] == ""
    assert msg["voice_id"] is None


def test_andermans_plaatje_mag_niet(db):
    a = maak_speler(db, "Aap")
    b = maak_speler(db, "Beer")
    van_b = db.dm_image_store(b, "image/webp", PLAATJE)
    # Aap probeert het plaatje van Beer te sturen. Dat hoort te stranden, ook al
    # bestaat het id echt.
    assert db.dm_send(a, b, "", image_id=van_b) is None


def test_tekst_naast_een_plaatje_valt_weg(db):
    a = maak_speler(db, "Aap")
    b = maak_speler(db, "Beer")
    iid = db.dm_image_store(a, "image/webp", PLAATJE)
    msg = db.dm_send(a, b, "kijk dan", image_id=iid)
    assert msg["text"] == ""


def test_emote_wint_van_een_plaatje(db):
    """Stuurt een client allebei, dan is het een emote en geen plaatje: de
    weergave kiest op volgorde en die volgorde moet ook in de opslag gelden."""
    a = maak_speler(db, "Aap")
    b = maak_speler(db, "Beer")
    iid = db.dm_image_store(a, "image/webp", PLAATJE)
    msg = db.dm_send(a, b, "", emote="ce01", image_id=iid)
    assert msg is not None
    assert msg["emote"] == "ce01"
    assert msg["image_id"] is None


def test_plaatje_komt_terug_in_de_thread(db):
    a = maak_speler(db, "Aap")
    b = maak_speler(db, "Beer")
    iid = db.dm_image_store(a, "image/webp", PLAATJE)
    db.dm_send(a, b, "", image_id=iid)
    thread = db.dm_thread(b, a)
    assert thread[-1]["image_id"] == iid


def test_gesprekkenlijst_toont_dat_het_laatste_een_plaatje_was(db):
    a = maak_speler(db, "Aap")
    b = maak_speler(db, "Beer")
    iid = db.dm_image_store(a, "image/webp", PLAATJE)
    db.dm_send(a, b, "", image_id=iid)
    rij = db.dm_threads(b)[0]
    assert rij["last_image"] is True
    assert rij["last_voice"] is False
