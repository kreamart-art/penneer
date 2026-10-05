"""JARVIS-statistieken: alleen tellingen, en dicht zonder (de juiste) sleutel."""
import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import jarvis_stats  # noqa: E402
from app.db import Database  # noqa: E402

DAY = 86400


@pytest.fixture()
def db(tmp_path):
    return Database(str(tmp_path / "t.db"))


def user(db, uid, created):
    db._conn.execute("INSERT INTO users (id, name, name_lower, created_at) VALUES (?,?,?,?)", (uid, uid, uid.lower(), created))


def test_counts(db):
    # midden op de dag, zodat "twee uur geleden" vandaag is, hoe laat de test ook draait
    now = datetime(2026, 10, 6, 12, 0, tzinfo=jarvis_stats.TZ).timestamp()
    user(db, "oud", now - 90 * DAY)
    user(db, "a", now - 3 * DAY)
    user(db, "b", now - 1 * 3600)
    db._conn.execute("INSERT INTO tokens (token_hash, user_id, created_at, last_seen) VALUES ('t1','a',?,?)", (now - 3 * DAY, now - 2 * 3600))
    db._conn.execute("INSERT INTO tokens (token_hash, user_id, created_at, last_seen) VALUES ('t2','oud',?,?)", (now - 90 * DAY, now - 20 * DAY))
    db._conn.execute("INSERT INTO games (id, room_code, finished_at, rounds) VALUES ('g1','ABCD',?,3)", (now - 2 * 3600,))
    db._conn.execute("INSERT INTO game_players (game_id, user_id, score, is_winner) VALUES ('g1','a',10,1),('g1','b',4,0)")
    db._conn.commit()
    s = jarvis_stats.stats(db, now)
    assert s["users"] == {"total": 3, "new7": 2, "new30": 2, "active1": 1, "active7": 1, "active30": 2}
    assert s["games"] == {"total": 1, "last7": 1, "last30": 1}
    assert len(s["series"]["users"]) == 30 and s["series"]["users"][-1] == 3 and s["series"]["users"][0] == 1
    assert s["series"]["players"][-1] == 2 and sum(s["series"]["signups"]) == 2
    # er gaat niets persoonlijks mee
    flat = repr(s)
    assert "oud" not in flat and "'a'" not in flat and "ABCD" not in flat


def test_key(monkeypatch):
    monkeypatch.delenv("JARVIS_STATS_KEY", raising=False)
    assert jarvis_stats.key_ok("Bearer x") is None
    monkeypatch.setenv("JARVIS_STATS_KEY", "geheim-123")
    assert jarvis_stats.key_ok(None) is False
    assert jarvis_stats.key_ok("Bearer fout") is False
    assert jarvis_stats.key_ok("Bearer geheim-123") is True
