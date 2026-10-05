"""Hoe Pen Neer ervoor staat, voor JARVIS (de desktop-app van de eigenaar).

Alleen tellingen: spelers, nieuwe aanmeldingen, wie er speelde, potjes. Geen
namen, geen e-mail, geen ids. Het endpoint staat uit zolang JARVIS_STATS_KEY
niet is gezet; JARVIS stuurt die sleutel als bearer token mee.
"""
from __future__ import annotations

import hmac
import os
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

DAYS = 30
TZ = ZoneInfo("Europe/Amsterdam")


def key_ok(header: str | None) -> bool | None:
    """None: het endpoint staat uit. Anders of de sleutel klopt (tijdsconstant vergeleken)."""
    want = os.environ.get("JARVIS_STATS_KEY", "").strip()
    if not want:
        return None
    got = (header or "").removeprefix("Bearer ").strip()
    return bool(got) and hmac.compare_digest(got.encode(), want.encode())


def stats(db, now: float | None = None) -> dict:
    now = time.time() if now is None else now
    q = db._q
    start = datetime.fromtimestamp(now, TZ).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=DAYS - 1)
    t0 = start.timestamp()

    def per_day(sql: str) -> list[int]:
        # één query per reeks: de dag-index in SQL, zodat 30 dagen niet 30 rondes zijn
        counts = [0] * DAYS
        for r in q(sql, (t0,)):
            i = int(r[0])
            if 0 <= i < DAYS:
                counts[i] = int(r[1])
        return counts

    day_ix = f"CAST((ts - {t0}) / 86400 AS INTEGER)"
    signups = per_day(f"SELECT {day_ix} AS d, COUNT(*) FROM (SELECT created_at AS ts FROM users WHERE created_at >= ?) GROUP BY d")
    games = per_day(f"SELECT {day_ix} AS d, COUNT(*) FROM (SELECT finished_at AS ts FROM games WHERE finished_at >= ?) GROUP BY d")
    players = per_day(
        f"SELECT {day_ix} AS d, COUNT(DISTINCT uid) FROM (SELECT g.finished_at AS ts, p.user_id AS uid FROM games g"
        " JOIN game_players p ON p.game_id = g.id WHERE g.finished_at >= ?) GROUP BY d"
    )
    total = int(q("SELECT COUNT(*) FROM users")[0][0])
    before = int(q("SELECT COUNT(*) FROM users WHERE created_at < ?", (t0,))[0][0])
    running, users = before, []
    for n in signups:
        running += n
        users.append(running)
    active = lambda days: int(q("SELECT COUNT(DISTINCT user_id) FROM tokens WHERE last_seen >= ?", (now - days * 86400,))[0][0])  # noqa: E731
    return {
        "platform": "Pen Neer",
        "at": int(now * 1000),
        "from": start.date().isoformat(),
        "users": {"total": total, "new7": sum(signups[-7:]), "new30": sum(signups), "active1": active(1), "active7": active(7), "active30": active(30)},
        "games": {"total": int(q("SELECT COUNT(*) FROM games")[0][0]), "last7": sum(games[-7:]), "last30": sum(games)},
        "series": {"users": users, "signups": signups, "games": games, "players": players},
    }
