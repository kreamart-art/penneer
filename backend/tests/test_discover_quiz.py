"""Ontdekken, fase 5: quizgeneratie, Leitner en de dagletter.

Twee dingen die hier echt bewaakt worden. Een quizvraag mag nooit twee keer
dezelfde optie tonen, want dan is er geen goed antwoord meer aan te wijzen. En
de Leitner-lus moet eindigen: drie keer goed en de kaart is klaar, anders blijft
de herhaalstapel groeien tot hij niet meer leeg te spelen is.
"""
import json
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import discover  # noqa: E402
from app.db import Database  # noqa: E402

LANDEN = [
    ("België", "Brussel", "Europa"), ("Brazilië", "Brasilia", "Zuid-Amerika"),
    ("Chili", "Santiago", "Zuid-Amerika"), ("Duitsland", "Berlijn", "Europa"),
    ("Egypte", "Caïro", "Afrika"), ("Fiji", "Suva", "Oceanië"),
    ("Ghana", "Accra", "Afrika"), ("India", "New Delhi", "Azië"),
]


def kandidaten(n=len(LANDEN)):
    return [
        {"id": i + 1, "word": w, "facts": {"hoofdstad": h, "werelddeel": d}}
        for i, (w, h, d) in enumerate(LANDEN[:n])
    ]


@pytest.fixture()
def db(tmp_path):
    d = Database(str(tmp_path / "t.db"))
    d._conn.execute(
        "INSERT INTO users (id, name, name_lower, created_at) VALUES ('u','u','u',?)",
        (time.time(),),
    )
    d._conn.commit()
    return d


def add(db, word, facts, letter=None):
    cur = db._conn.execute(
        "INSERT INTO cards (category, letter, word, slug, aliases, facts, image_path,"
        " card_number, sort_order) VALUES ('land',?,?,?,'[]',?,NULL,1,1)",
        (letter or discover.letter_of(word), word, discover.slugify(word), json.dumps(facts)),
    )
    db._conn.commit()
    return int(cur.lastrowid)


def own(db, card_id, box=1, due=None):
    db._conn.execute(
        "INSERT INTO user_cards (user_id, card_id, discovered_at, source, box, next_review_at)"
        " VALUES ('u',?,?, 'practice',?,?)",
        (card_id, time.time(), box, due),
    )
    db._conn.commit()


# ---- dagletter --------------------------------------------------------------

def test_dagletter_is_stabiel_binnen_een_dag():
    a = discover.daily_letter("speler-1", "2026-08-04")
    for _ in range(20):
        assert discover.daily_letter("speler-1", "2026-08-04") == a


def test_dagletter_verschilt_per_speler_en_per_dag():
    dag = "2026-08-04"
    per_speler = {discover.daily_letter(f"u{i}", dag) for i in range(60)}
    assert len(per_speler) > 5, "alle spelers dezelfde letter is geen verdeling"
    per_dag = {discover.daily_letter("u1", f"2026-08-{d:02d}") for d in range(1, 29)}
    assert len(per_dag) > 5


def test_dagletter_slaat_de_lege_letters_over():
    # Q, X en Y hebben te weinig kaarten voor een ronde.
    gezien = {
        discover.daily_letter(f"u{i}", f"2026-0{m}-{d:02d}")
        for i in range(40) for m in (7, 8) for d in range(1, 15)
    }
    assert not (gezien & {"Q", "X", "Y"})
    assert gezien <= set(discover.LETTERS)


# ---- Leitner ----------------------------------------------------------------

@pytest.mark.parametrize("box,goed,verwacht", [
    (1, True, 2), (2, True, 3), (3, True, 3),
    (1, False, 1), (2, False, 1), (3, False, 1),
])
def test_box_verschuift(box, goed, verwacht):
    assert discover.volgende_box(box, goed) == verwacht


def test_wachttijd_loopt_op():
    nu = 1_000_000.0
    een = discover.volgende_review(1, True, nu)
    twee = discover.volgende_review(2, True, nu)
    assert een is not None and twee is not None
    assert twee - nu > een - nu, "een hogere bak moet langer wachten"
    assert (een - nu) / 86400 == pytest.approx(3)   # box 1 -> 2 -> na 3 dagen


def test_fout_zet_hem_morgen_weer_klaar():
    nu = 1_000_000.0
    assert (discover.volgende_review(3, False, nu) - nu) / 86400 == pytest.approx(1)


def test_drie_keer_goed_maakt_de_kaart_klaar(db):
    """Zonder eindpunt groeit de herhaalstapel tot hij niet leeg te spelen is."""
    cid = add(db, "België", {"hoofdstad": "Brussel"})
    own(db, cid, box=1, due=0)
    nu = time.time()
    standen = []
    for _ in range(3):
        standen.append(db.discover_antwoord_verwerkt("u", cid, True, nu))
    assert [s["box"] for s in standen] == [2, 3, 3]
    assert standen[-1]["klaar"] is True
    assert standen[-1]["next_review_at"] is None
    assert db.discover_due_count("u", nu + 10**7) == 0


def test_fout_haalt_hem_terug_uit_de_hoogste_bak(db):
    cid = add(db, "België", {"hoofdstad": "Brussel"})
    own(db, cid, box=3, due=0)
    stand = db.discover_antwoord_verwerkt("u", cid, False, time.time())
    assert stand["box"] == 1 and stand["klaar"] is False


def test_antwoord_op_een_kaart_die_niet_van_jou_is_doet_niets(db):
    cid = add(db, "België", {"hoofdstad": "Brussel"})
    assert db.discover_antwoord_verwerkt("u", cid, True) is None


def test_stapel_pakt_de_oudste_eerst_en_niet_meer_dan_het_maximum(db):
    nu = time.time()
    for i in range(15):
        cid = add(db, f"Land{i:02d}", {"hoofdstad": f"Stad{i}"})
        own(db, cid, box=1, due=nu - (15 - i) * 100)   # i=0 wacht het langst
    stapel = db.discover_review_stapel("u", discover.REVIEW_LIMIET, nu)
    assert len(stapel) == discover.REVIEW_LIMIET
    assert stapel[0]["word"] == "Land00"
    assert [s["next_review_at"] for s in stapel] == sorted(s["next_review_at"] for s in stapel)


def test_stapel_negeert_wat_nog_niet_aan_de_beurt_is(db):
    nu = time.time()
    a = add(db, "België", {"hoofdstad": "Brussel"}); own(db, a, due=nu - 5)
    b = add(db, "Brazilië", {"hoofdstad": "Brasilia"}); own(db, b, due=nu + 10_000)
    c = add(db, "Chili", {"hoofdstad": "Santiago"}); own(db, c, due=None)
    stapel = db.discover_review_stapel("u", 10, nu)
    assert [s["word"] for s in stapel] == ["België"]


# ---- quizgeneratie ----------------------------------------------------------

def test_vragen_hebben_altijd_vier_verschillende_opties():
    import random
    for zaad in range(40):
        for v in discover.maak_vragen(kandidaten(), "land", rnd=random.Random(zaad)):
            assert len(v["opties"]) == discover.QUIZ_OPTIES
            assert len(set(v["opties"])) == discover.QUIZ_OPTIES, "dubbele optie"
            assert v["juist"] in v["opties"]


def test_foute_antwoorden_komen_uit_hetzelfde_veld():
    hoofdsteden = {h for _, h, _ in LANDEN}
    werelddelen = {d for _, _, d in LANDEN}
    for v in discover.maak_vragen(kandidaten(), "land"):
        bron = hoofdsteden if v["veld"] == "hoofdstad" else werelddelen
        assert set(v["opties"]) <= bron, "een optie uit een ander veld verraadt zichzelf"


def test_niet_twee_vragen_over_dezelfde_kaart():
    for v in range(20):
        import random
        vragen = discover.maak_vragen(kandidaten(), "land", rnd=random.Random(v))
        ids = [q["card_id"] for q in vragen]
        assert len(ids) == len(set(ids))


def test_veld_met_te_weinig_waarden_doet_niet_mee():
    # Twee landen, twee werelddelen: te weinig voor vier opties. Hoofdstad kan
    # wel, want dat zijn vier verschillende waarden zodra er vier kaarten zijn.
    smal = [
        {"id": 1, "word": "A", "facts": {"hoofdstad": "P", "werelddeel": "Europa"}},
        {"id": 2, "word": "B", "facts": {"hoofdstad": "Q", "werelddeel": "Europa"}},
        {"id": 3, "word": "C", "facts": {"hoofdstad": "R", "werelddeel": "Azië"}},
        {"id": 4, "word": "D", "facts": {"hoofdstad": "S", "werelddeel": "Azië"}},
    ]
    velden = {v["veld"] for v in discover.maak_vragen(smal, "land")}
    assert "werelddeel" not in velden
    assert velden <= {"hoofdstad"}


def test_te_weinig_kaarten_geeft_geen_vragen_in_plaats_van_rommel():
    krap = kandidaten(2)
    assert discover.maak_vragen(krap, "land") == []


def test_het_juiste_antwoord_gaat_niet_naar_de_client():
    vragen = discover.maak_vragen(kandidaten(), "land")
    naar_buiten = discover.zonder_antwoord(vragen)
    tekst = json.dumps(naar_buiten, ensure_ascii=False)
    assert '"juist"' not in tekst
    for v in naar_buiten:
        assert set(v) == {"index", "card_id", "word", "veld", "label", "opties"}


def test_kandidaten_uit_de_database_kunnen_alleen_van_jou_zijn(db):
    van_mij = add(db, "België", {"hoofdstad": "Brussel"})
    add(db, "Brazilië", {"hoofdstad": "Brasilia"})
    own(db, van_mij)
    alles = db.discover_quiz_kandidaten("land")
    eigen = db.discover_quiz_kandidaten("land", None, "u", alleen_van_mij=True)
    assert len(alles) == 2
    assert [k["word"] for k in eigen] == ["België"]


# ---- reeks ------------------------------------------------------------------

def test_reeks_loopt_door_op_opeenvolgende_dagen(db):
    assert db.discover_dag_afgerond("u", "B", "2026-08-01")["streak_days"] == 1
    assert db.discover_dag_afgerond("u", "C", "2026-08-02")["streak_days"] == 2
    assert db.discover_dag_afgerond("u", "D", "2026-08-03")["streak_days"] == 3


def test_reeks_breekt_na_een_overgeslagen_dag(db):
    db.discover_dag_afgerond("u", "B", "2026-08-01")
    db.discover_dag_afgerond("u", "C", "2026-08-02")
    assert db.discover_dag_afgerond("u", "D", "2026-08-05")["streak_days"] == 1


def test_twee_keer_op_dezelfde_dag_telt_een_keer(db):
    db.discover_dag_afgerond("u", "B", "2026-08-01")
    assert db.discover_dag_afgerond("u", "B", "2026-08-01")["streak_days"] == 1


# ---- de reeks hangt aan de DAGLETTER ----------------------------------------
# "Werk de streak bij wanneer de speler de dagletter uitspeelt, niet wanneer hij
# hem opent." Dat zit in /quiz/finish en niet in de losse helpers, dus hier over
# HTTP getest.

def _client(tmp_path, monkeypatch):
    import os
    import secrets

    monkeypatch.setenv("PENNEER_DB_PATH", str(tmp_path / "api.db"))
    # Ook seed_cards weggooien: dat houdt een verwijzing naar de VORIGE app.db
    # vast en zou de catalogus dan in de database van een andere test zetten.
    for mod in [m for m in list(sys.modules) if m.startswith("app.")] + ["app", "seed_cards"]:
        sys.modules.pop(mod, None)
    from fastapi.testclient import TestClient
    from app import db as dbmod
    from app.db import get_db
    from app.main import app

    c = TestClient(app)
    c.__enter__()
    db = get_db()
    now = time.time()
    db._conn.execute(
        "INSERT INTO users (id,name,name_lower,created_at) VALUES ('u','Q','q',?)", (now,)
    )
    tok = secrets.token_urlsafe(16)
    db._conn.execute(
        "INSERT INTO tokens (token_hash,user_id,created_at,last_seen) VALUES (?,?,?,?)",
        (dbmod._hash(tok), "u", now, now),
    )
    db._conn.commit()
    return c, db, {"Authorization": f"Bearer {tok}"}, now


def _speel_letter(c, db, h, letter):
    ids = [
        r["id"]
        for r in db._conn.execute(
            "SELECT id FROM cards WHERE category='land' AND letter=?", (letter,)
        )
    ]
    for i in ids:
        db._conn.execute(
            "INSERT OR IGNORE INTO user_cards (user_id,card_id,discovered_at,source,box)"
            " VALUES ('u',?,?, 'practice',1)",
            (i, time.time()),
        )
    db._conn.commit()
    q = c.post(
        "/api/discover/quiz/start",
        json={"category": "land", "letter": letter, "mode": "letter"},
        headers=h,
    ).json()
    for v in q["vragen"]:
        c.post(
            "/api/discover/quiz/answer",
            json={"session_id": q["session_id"], "question_index": v["index"], "answer": "?"},
            headers=h,
        )
    return c.post(
        "/api/discover/quiz/finish", json={"session_id": q["session_id"]}, headers=h
    ).json()


def test_reeks_telt_alleen_bij_de_dagletter(tmp_path, monkeypatch):
    c, db, h, _ = _client(tmp_path, monkeypatch)
    try:
        from app import discover as d

        dag = d.today()
        vandaag = d.daily_letter("u", dag)
        anders = next(L for L in d.LETTERS if L != vandaag and L not in ("Q", "X", "Y"))

        assert _speel_letter(c, db, h, anders)["streak_days"] is None
        assert db.discover_state("u")["streak_days"] == 0

        uit = _speel_letter(c, db, h, vandaag)
        assert uit["streak_days"] == 1
        assert db.discover_state("u")["last_played_date"] == dag
    finally:
        c.__exit__(None, None, None)


def test_dagletter_opvragen_verandert_de_reeks_niet(tmp_path, monkeypatch):
    c, db, h, _ = _client(tmp_path, monkeypatch)
    try:
        for _ in range(3):
            c.get("/api/discover/daily", headers=h)
        assert db.discover_state("u")["streak_days"] == 0
    finally:
        c.__exit__(None, None, None)
