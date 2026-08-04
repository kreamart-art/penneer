"""Ontdekken, fase 2: matching en het toekennen van kaarten.

De kern is dat de server bepaalt wat een ronde oplevert. De client stuurt wel
welke woorden er speelden, maar match_words gooit alles weg dat niet op de
curated lijst van precies die categorie en letter staat.
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
    d = Database(str(tmp_path / "t.db"))
    d._conn.execute(
        "INSERT INTO users (id, name, name_lower, created_at) VALUES ('u','u','u',?)",
        (time.time(),),
    )
    d._conn.commit()
    return d


def add(db, category, word, aliases=()):
    cur = db._conn.execute(
        "INSERT INTO cards (category, letter, word, slug, aliases, facts, image_path,"
        " card_number, sort_order) VALUES (?,?,?,?,?,'{}',NULL,1,1)",
        (
            category, discover.letter_of(word), word, discover.slugify(word),
            json.dumps([game.normalize(a) for a in aliases]),
        ),
    )
    db._conn.commit()
    return int(cur.lastrowid)


# ---- matching ---------------------------------------------------------------

def test_match_houdt_alleen_woorden_van_die_letter_over():
    got = discover.match_words("land", "B", ["België", "Chili", "Brazilië"])
    assert game.normalize("België") in got
    assert game.normalize("Brazilië") in got
    assert game.normalize("Chili") not in got, "Chili is een C, mag niet via letter B"


def test_match_weigert_verzonnen_woorden():
    assert discover.match_words("land", "B", ["Bananenland", "Blurp", ""]) == []


def test_match_accepteert_de_engelse_variant():
    # Belgium staat in de woordenlijst, dus een ronde mag hem opleveren.
    assert game.normalize("Belgium") in discover.match_words("land", "B", ["Belgium"])


def test_match_dedupliceert_en_houdt_volgorde():
    got = discover.match_words("land", "B", ["België", "Belgie", "België", "Brazilië"])
    assert got == list(dict.fromkeys(got))
    assert got[0] == game.normalize("België")


def test_match_is_leeg_voor_een_onbekende_categorie():
    assert discover.match_words("kaas", "B", ["België"]) == []


# ---- toekennen --------------------------------------------------------------

def test_unlock_geeft_alleen_nieuwe_kaarten_terug(db):
    add(db, "land", "België")
    add(db, "land", "Brazilië")
    norms = discover.match_words("land", "B", ["België", "Brazilië"])

    eerste = db.discover_unlock("u", "land", norms)
    assert {c["word"] for c in eerste} == {"België", "Brazilië"}

    tweede = db.discover_unlock("u", "land", norms)
    assert tweede == [], "een tweede ronde mag dezelfde kaarten niet opnieuw geven"
    assert db.discover_owned_counts("u") == {"land": 2}


def test_engelse_variant_ontgrendelt_de_nederlandse_kaart(db):
    # Dit is waarvoor aliases bestaat: anders wordt Belgium een tweede kaart.
    add(db, "land", "België", aliases=["Belgium"])
    got = db.discover_unlock("u", "land", discover.match_words("land", "B", ["Belgium"]))
    assert [c["word"] for c in got] == ["België"]
    assert db.discover_owned_counts("u") == {"land": 1}


def test_zelf_genoemd_telt_anders_dan_voorgeschoteld(db):
    cid_a = add(db, "land", "België")
    cid_b = add(db, "land", "Brazilië")
    norms = discover.match_words("land", "B", ["België", "Brazilië"])
    known = frozenset(discover.match_words("land", "B", ["België"]))
    db.discover_unlock("u", "land", norms, known=known)

    zelf = db.discover_card(cid_a, "u")
    gezien = db.discover_card(cid_b, "u")
    assert (zelf["correct_count"], zelf["missed_count"]) == (1, 0)
    assert (gezien["correct_count"], gezien["missed_count"]) == (0, 1)


def test_opnieuw_spelen_telt_door_zonder_nieuwe_kaart(db):
    cid = add(db, "land", "België")
    norms = discover.match_words("land", "B", ["België"])
    known = frozenset(norms)
    db.discover_unlock("u", "land", norms, known=known)
    db.discover_unlock("u", "land", norms, known=known)
    assert db.discover_card(cid, "u")["correct_count"] == 2


def test_unlock_zonder_speler_doet_niets(db):
    add(db, "land", "België")
    assert db.discover_unlock("", "land", ["belgie"]) == []
    assert db._conn.execute("SELECT COUNT(*) c FROM user_cards").fetchone()["c"] == 0


def test_unlock_negeert_een_woord_zonder_kaart(db):
    # Het woord staat in de lijst maar de catalogus heeft er geen kaart voor.
    # Dat mag geen fout geven, alleen niets opleveren.
    add(db, "land", "België")
    norms = discover.match_words("land", "B", ["België", "Brazilië"])
    got = db.discover_unlock("u", "land", norms)
    assert [c["word"] for c in got] == ["België"]


def test_een_woord_dat_je_kreeg_voorgeschoteld_begint_onderaan(db):
    """Wie het woord niet zelf noemde start in bak 1 en ziet hem morgen terug."""
    cid = add(db, "land", "België")
    db.discover_unlock("u", "land", discover.match_words("land", "B", ["België"]))
    assert db.discover_card(cid, "u")["box"] == 1


def test_source_wordt_bewaard(db):
    cid = add(db, "land", "België")
    db.discover_unlock("u", "land", ["belgie"], source="daily")
    row = db._conn.execute("SELECT source FROM user_cards WHERE card_id=?", (cid,)).fetchone()
    assert row["source"] == "daily"


def test_index_kent_slug_en_alias(db):
    add(db, "land", "België", aliases=["Belgium"])
    index = db.discover_card_index("land")
    assert index[game.normalize("België")] == index[game.normalize("Belgium")]


# ---- catalogus tegen woordenlijst -------------------------------------------
# Deze twee moeten allebei kloppen, en ze bewaken iets anders.


def _seeded(db, category="land"):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import seed_cards

    rows = seed_cards.read_csv(category)
    for i, r in enumerate(rows, 1):
        db._conn.execute(
            "INSERT INTO cards (category, letter, word, slug, aliases, facts, image_path,"
            " card_number, sort_order) VALUES (?,?,?,?,?,?,NULL,?,?)",
            (category, r["letter"], r["word"], r["slug"],
             json.dumps(r["aliases"]), json.dumps(r["facts"]), i, i),
        )
    db._conn.commit()
    return rows


def test_elk_woord_uit_de_lijst_levert_een_kaart(db):
    """Anders levert een goed antwoord in Oefenen soms niets op."""
    _seeded(db)
    index = db.discover_card_index("land")
    missing = [w for w in game.RAW["Land"] if game.normalize(w) not in index]
    assert not missing, f"geen kaart voor: {missing}"


def test_elke_kaart_is_te_ontgrendelen(db):
    """En andersom: een kaart die geen enkel woord kan ontgrendelen is een kaart
    die niemand ooit krijgt. Eén zo'n kaart maakt de letter oncompleetbaar en
    dus het 'Letter voltooid'-scherm onbereikbaar."""
    _seeded(db)
    index = db.discover_card_index("land")
    reachable = {index[game.normalize(w)] for w in game.RAW["Land"] if game.normalize(w) in index}
    alle = {
        int(r["id"]): r["word"]
        for r in db._conn.execute("SELECT id, word FROM cards WHERE category='land'")
    }
    dood = sorted(alle[c] for c in set(alle) - reachable)
    assert not dood, f"niet te ontgrendelen: {dood}"


def test_reveal_zet_onbekende_woorden_vooraan(db):
    """De reveal is afgekapt op 12 en staat op alfabet, dus zonder deze
    sortering krijgt een speler elke ronde dezelfde twaalf woorden en blijft
    letter B op 10 van de 17 hangen. Dit is die bug."""
    _seeded(db)
    woorden = game.list_words_for_letter("Land", "B")
    index = db.discover_card_index("land")

    # Ronde 1: de eerste twaalf van het alfabet.
    eerste = woorden[:12]
    db.discover_unlock("u", "land", discover.match_words("land", "B", eerste))
    owned = db.discover_owned_card_ids("u", "land")
    assert owned, "ronde 1 moet kaarten opleveren"

    # Ronde 2 sorteert zoals main.py doet: al bezeten woorden naar achteren.
    rest = list(woorden)
    rest.sort(key=lambda w: index.get(game.normalize(w)) in owned)
    nieuw = db.discover_unlock("u", "land", discover.match_words("land", "B", rest[:12]))
    assert nieuw, "ronde 2 moet nieuwe kaarten geven, anders loopt de letter vast"

    totaal = db._conn.execute(
        "SELECT COUNT(*) c FROM cards WHERE category='land' AND letter='B'"
    ).fetchone()["c"]
    assert len(db.discover_owned_card_ids("u", "land")) == totaal


def test_letter_is_compleet_te_spelen(db):
    """Een ronde van één letter moet die letter helemaal kunnen vullen.

    Zonder de reveal-cap zou dat vanzelf gelden; mét de cap is dit de test die
    laat zien hoeveel rondes een letter kost.
    """
    _seeded(db)
    totaal = db._conn.execute(
        "SELECT COUNT(*) c FROM cards WHERE category='land' AND letter='B'"
    ).fetchone()["c"]
    norms = discover.match_words("land", "B", game.list_words_for_letter("Land", "B"))
    got = db.discover_unlock("u", "land", norms)
    assert len(got) == totaal, "de hele B-lijst spelen moet alle B-kaarten geven"


def test_nieuwe_kaart_komt_in_de_herhaallus(db):
    """Zonder dit blijft de herhaalstapel altijd leeg en heeft de modus geen lus."""
    from app import discover as d

    a = add(db, "land", "België")
    b = add(db, "land", "Brazilië")
    nu = 1_000_000.0
    norms = discover.match_words("land", "B", ["België", "Brazilië"])
    db.discover_unlock("u", "land", norms, known=frozenset([game.normalize("België")]), now=nu)

    zelf = db.discover_card(a, "u")
    gezien = db.discover_card(b, "u")
    # Zelf genoemd start een bak hoger en wacht dus langer.
    assert zelf["box"] == 2 and gezien["box"] == 1

    rij = {
        r["card_id"]: r["next_review_at"]
        for r in db._conn.execute("SELECT card_id, next_review_at FROM user_cards")
    }
    assert rij[a] is not None and rij[b] is not None
    assert (rij[b] - nu) / 86400 == d.BOX_DAGEN[1]
    assert (rij[a] - nu) / 86400 == d.BOX_DAGEN[2]
    assert rij[b] < rij[a], "wat je moest opzoeken hoort eerder terug te komen"

    # En de stapel pikt ze op zodra de termijn verstreken is.
    assert db.discover_due_count("u", nu) == 0
    assert db.discover_due_count("u", nu + 2 * 86400) == 1
    assert db.discover_due_count("u", nu + 5 * 86400) == 2
