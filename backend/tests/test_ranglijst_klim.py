"""De stijging op de ranglijst: hoeveel plekken iemand in 24 uur op of neer ging.

Er is geen tabel met momentopnames en die is er ook niet nodig. De ranglijst
wordt uit de potjes zelf gerekend, dus dezelfde som met een venster dat een dag
eerder ophoudt geeft de stand van gisteren, en het verschil in plek is de
stijging. Dat klopt altijd, ook als er dagen niets gedraaid heeft.

Waar het mis KAN gaan is de volgorde bij gelijke stand. Geeft de database twee
spelers met evenveel punten en winsten in willekeurige volgorde terug, dan
verschilt die volgorde ook tussen de som van vandaag en die van gisteren, en dan
ziet iedereen die gelijk staat spookbewegingen. Vandaar de naam als derde
sleutel, en vandaar de laatste test hieronder.
"""

import time

import pytest

from app.db import Database

DAG = 86400.0


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


def potje(db: Database, wanneer: float, punten: dict[str, int], winnaar: str | None = None) -> None:
    """Een afgerond potje op een gekozen moment. `record_game` stempelt zelf de
    tijd, dus voor een test over TIJD moet die achteraf gezet worden."""
    gid = db.record_game("TEST", 3, False, [
        {"user_id": uid, "score": s, "is_winner": uid == winnaar} for uid, s in punten.items()
    ])
    with db._lock:
        db._conn.execute("UPDATE games SET finished_at=? WHERE id=?", (wanneer, gid))
        db._conn.commit()


def plekken(db: Database, until: float | None = None) -> list[str]:
    return [r["id"] for r in db.leaderboard(since=0.0, until=until, limit=500)]


def klim(db: Database, nu: float) -> dict[str, int | None]:
    """Dezelfde rekensom als de server: nu tegen een dag geleden."""
    rijen = db.leaderboard(since=0.0, until=None, limit=25)
    eerder = {r["id"]: i for i, r in enumerate(db.leaderboard(since=0.0, until=nu - DAG, limit=500))}
    return {r["id"]: (eerder[r["id"]] - i if r["id"] in eerder else None) for i, r in enumerate(rijen)}


def test_inhaler_stijgt_en_ingehaalde_daalt(db):
    nu = time.time()
    a, b = speler(db, "Aap"), speler(db, "Beer")
    # Twee dagen geleden stond Aap voor.
    potje(db, nu - 2 * DAG, {a: 500, b: 100}, winnaar=a)
    assert plekken(db, until=nu - DAG) == [a, b]
    # Vannacht haalde Beer hem in.
    potje(db, nu - 2 * 3600, {b: 900}, winnaar=b)
    assert plekken(db) == [b, a]

    k = klim(db, nu)
    assert k[b] == 1     # van plek twee naar plek een
    assert k[a] == -1


def test_wie_gisteren_nog_niet_meedeed_krijgt_geen_nul(db):
    """None en niet 0. Nul betekent "je stond stil", en dat is een ander bericht
    dan "je was er nog niet"."""
    nu = time.time()
    oud, nieuw = speler(db, "Oud"), speler(db, "Nieuw")
    potje(db, nu - 3 * DAG, {oud: 400}, winnaar=oud)
    potje(db, nu - 3600, {nieuw: 100}, winnaar=nieuw)

    k = klim(db, nu)
    assert k[oud] == 0
    assert k[nieuw] is None


def test_stilstaan_is_nul(db):
    nu = time.time()
    a, b = speler(db, "Aap"), speler(db, "Beer")
    potje(db, nu - 4 * DAG, {a: 300, b: 200}, winnaar=a)
    potje(db, nu - 2 * 3600, {a: 10, b: 10})     # allebei evenveel erbij
    k = klim(db, nu)
    assert k[a] == 0 and k[b] == 0


def test_gelijke_stand_geeft_geen_spookbeweging(db):
    """Vier spelers met exact dezelfde punten en winsten. Zonder een vaste derde
    sleutel mag de database ze elke keer anders teruggeven, en dan zou hier een
    stijging uit komen terwijl er niets gebeurd is."""
    nu = time.time()
    ids = [speler(db, n) for n in ("Delta", "Alfa", "Charlie", "Bravo")]
    for uid in ids:
        potje(db, nu - 5 * DAG, {uid: 250})

    assert plekken(db) == sorted(ids)            # op naam, dus voorspelbaar
    assert all(v == 0 for v in klim(db, nu).values())


def test_volgorde_is_over_aanroepen_heen_gelijk(db):
    nu = time.time()
    ids = [speler(db, n) for n in ("Zulu", "Yankee", "Xray")]
    for uid in ids:
        potje(db, nu - 5 * DAG, {uid: 100})
    eerste = plekken(db)
    for _ in range(5):
        assert plekken(db) == eerste
