"""Ontdekken, fase 1: catalogus, afscherming en de read-only endpoints.

De zwaarste test hier is test_letter_lekt_niets: een niet ontdekte kaart mag
nooit zijn woord, slug, facts of beeldpad teruggeven. Dat is de hele modus, en
het is precies het soort ding dat stilletjes stukgaat als iemand later een
kolom aan een SELECT toevoegt.
"""
import json
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import discover, game  # noqa: E402
from app.db import Database  # noqa: E402


@pytest.fixture()
def db(tmp_path):
    return Database(str(tmp_path / "t.db"))


def add_card(db, category, word, aliases=(), facts=None, number=1):
    conn = db._conn
    cur = conn.execute(
        "INSERT INTO cards (category, letter, word, slug, aliases, facts, image_path,"
        " card_number, sort_order) VALUES (?,?,?,?,?,?,?,?,?)",
        (
            category, discover.letter_of(word), word, discover.slugify(word),
            json.dumps([game.normalize(a) for a in aliases]),
            json.dumps(facts or {}),
            discover.image_path_for(category, discover.slugify(word)),
            number, number,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def add_user(db, uid="u1"):
    db._conn.execute(
        "INSERT INTO users (id, name, name_lower, created_at) VALUES (?,?,?,?)",
        (uid, uid, uid, time.time()),
    )
    db._conn.commit()
    return uid


def own(db, uid, card_id, source="practice"):
    db._conn.execute(
        "INSERT INTO user_cards (user_id, card_id, discovered_at, source)"
        " VALUES (?,?,?,?)",
        (uid, card_id, time.time(), source),
    )
    db._conn.commit()


# ---- fact schema ------------------------------------------------------------

def test_elke_categorie_heeft_een_factschema():
    for cat in discover.CATEGORIES:
        rows = discover.fact_rows(cat)
        assert rows, f"{cat} heeft geen FACT_SCHEMA"
        keys = [r["key"] for r in rows]
        assert len(keys) == len(set(keys)), f"{cat} heeft dubbele sleutels"


def test_elke_categorie_heeft_genoeg_quizvelden():
    # De quiz bouwt een vraag uit een feitveld met drie foute antwoorden uit
    # hetzelfde veld. Met minder dan twee bruikbare velden valt er niets te
    # vragen, dus dit bewaakt fase 5 vanaf nu.
    for cat in discover.CATEGORIES:
        assert len(discover.quiz_fields(cat)) >= 2, f"{cat} heeft te weinig quizvelden"


def test_weetje_is_nooit_een_quizveld():
    for cat in discover.CATEGORIES:
        assert "weetje" not in discover.quiz_fields(cat)


# ---- sleutels ---------------------------------------------------------------

@pytest.mark.parametrize("word,letter", [
    ("België", "B"), ("IJsland", "I"), ("Israël", "I"),
    ("Oostenrijk", "O"), ("aap", "A"), ("Den Haag", "D"),
])
def test_letter_of(word, letter):
    assert discover.letter_of(word) == letter


def test_slug_volgt_de_normalisatie_van_het_spel():
    # Als deze twee uit elkaar lopen, ontgrendelt een goed antwoord in Oefenen
    # de verkeerde kaart of geen enkele.
    for word in ("België", "Sao Tomé en Principe", "Côte d'Ivoire"):
        assert discover.slugify(word).replace("-", "") == game.normalize(word).replace(" ", "")


# ---- afscherming ------------------------------------------------------------

def test_letter_lekt_niets_van_een_onontdekte_kaart(db):
    uid = add_user(db)
    heb = add_card(db, "land", "België", number=1)
    heb_niet = add_card(db, "land", "Brazilië", number=2)
    own(db, uid, heb)

    cards = {c["card_number"]: c for c in db.discover_cards_for_letter("land", "B", uid)}
    assert len(cards) == 2

    open_kaart = cards[2]
    assert open_kaart["discovered"] is False
    # Alles waaruit het antwoord af te leiden is, moet ontbreken.
    for verboden in ("word", "slug", "facts", "image_path", "favorite", "discovered_at"):
        assert verboden not in open_kaart, f"{verboden} lekt op een onontdekte kaart"
    # En het mag ook nergens als losse waarde in de payload zitten.
    assert "brazil" not in json.dumps(open_kaart, ensure_ascii=False).lower()

    assert cards[1]["discovered"] is True
    assert cards[1]["word"] == "België"


def test_gast_ziet_alles_dicht(db):
    add_card(db, "land", "België", number=1)
    cards = db.discover_cards_for_letter("land", "B", None)
    assert [c["discovered"] for c in cards] == [False]
    assert "word" not in cards[0]


def test_card_detail_alleen_als_je_hem_hebt(db):
    uid = add_user(db)
    van_mij = add_card(db, "land", "België", facts={"hoofdstad": "Brussel"}, number=1)
    van_niemand = add_card(db, "land", "Brazilië", number=2)
    own(db, uid, van_mij)

    assert db.discover_card(van_mij, uid)["word"] == "België"
    assert db.discover_card(van_mij, uid)["facts"]["hoofdstad"] == "Brussel"
    # Niet van jou en niet bestaand geven allebei None: het verschil zou
    # verklappen welke kaartnummers er zijn.
    assert db.discover_card(van_niemand, uid) is None
    assert db.discover_card(999999, uid) is None
    assert db.discover_card(van_mij, None) is None
    assert db.discover_card(van_mij, "andere-user") is None


# ---- tellingen --------------------------------------------------------------

def test_letters_telt_per_letter(db):
    uid = add_user(db)
    b1 = add_card(db, "land", "België", number=1)
    add_card(db, "land", "Brazilië", number=2)
    add_card(db, "land", "Chili", number=3)
    own(db, uid, b1)

    per = {r["letter"]: r for r in db.discover_letters("land", uid)}
    assert per["B"]["total"] == 2 and per["B"]["discovered"] == 1
    assert per["C"]["total"] == 1 and per["C"]["discovered"] == 0
    assert "A" not in per  # lege letters komen niet terug, de frontend vult aan


def test_tellingen_zijn_per_speler(db):
    a, b = add_user(db, "a"), add_user(db, "b")
    kaart = add_card(db, "land", "België", number=1)
    own(db, a, kaart)
    assert db.discover_owned_counts(a) == {"land": 1}
    assert db.discover_owned_counts(b) == {}


def test_due_count_telt_alleen_verstreken(db):
    uid = add_user(db)
    k1 = add_card(db, "land", "België", number=1)
    k2 = add_card(db, "land", "Brazilië", number=2)
    k3 = add_card(db, "land", "Chili", number=3)
    own(db, uid, k1)
    own(db, uid, k2)
    own(db, uid, k3)
    now = time.time()
    db._conn.execute("UPDATE user_cards SET next_review_at=? WHERE card_id=?", (now - 10, k1))
    db._conn.execute("UPDATE user_cards SET next_review_at=? WHERE card_id=?", (now + 999, k2))
    db._conn.execute("UPDATE user_cards SET next_review_at=NULL WHERE card_id=?", (k3,))
    db._conn.commit()
    assert db.discover_due_count(uid, now) == 1


def test_state_is_leeg_voor_een_nieuwe_speler(db):
    uid = add_user(db)
    s = db.discover_state(uid)
    assert s["streak_days"] == 0 and s["daily_letter"] is None


# ---- catalogus --------------------------------------------------------------

def test_land_csv_dekt_de_hele_woordenlijst():
    """Elk woord dat Oefenen goedkeurt moet een kaart kunnen ontgrendelen.

    Zonder deze test levert een goed antwoord soms niets op, en dat voelt als
    een bug die niemand kan reproduceren.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import seed_cards

    rows = seed_cards.read_csv("land")
    assert rows, "data/cards/land.csv ontbreekt of is leeg"
    index = set()
    for r in rows:
        index.add(game.normalize(r["word"]))
        index.update(r["aliases"])
    missing = [w for w in game.RAW["Land"] if game.normalize(w) not in index]
    assert not missing, f"geen kaart voor: {missing}"


def test_csv_nummert_oplopend_en_uniek():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import seed_cards

    rows = seed_cards.read_csv("land")
    assert [r["card_number"] for r in rows] == list(range(1, len(rows) + 1))
    assert len({r["slug"] for r in rows}) == len(rows)
