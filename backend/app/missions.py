"""Pen Neer — dagelijkse missies.

Three missions per day, the SAME for everyone (deterministic from the date,
like the daily letter), each worth bonus XP. Rewards auto-claim the moment a
mission completes: users.bonus_xp goes up, which _xp_of counts into the level.
Progress lives in the mission_progress table and is bumped from two places:
game over (social.record_game) and the daily-round submit.
"""
from __future__ import annotations

import random

# key -> (target, reward XP). Copy for names lives in the frontend i18n
# (mission_<key>).
POOL: dict[str, tuple[int, int]] = {
    "play_game": (1, 30),   # speel een potje
    "win_game": (1, 50),    # win een potje
    "unique5": (5, 40),     # 5 unieke woorden
    "dubbel3": (3, 30),     # 3 dubbele woorden
    "multi3": (1, 40),      # potje met 3+ spelers
    "daily_play": (1, 40),  # speel de dagronde
    "daily30": (1, 50),     # scoor 30+ in de dagronde
}


def missions_for(day: str) -> list[dict]:
    """Today's three missions, day-seeded so every server agrees."""
    keys = sorted(POOL)
    rng = random.Random(f"penneer-missions:{day}")
    picked = rng.sample(keys, 3)
    return [{"key": k, "target": POOL[k][0], "reward": POOL[k][1]} for k in picked]


def active_keys(day: str) -> set[str]:
    return {m["key"] for m in missions_for(day)}


def spec(key: str) -> tuple[int, int]:
    return POOL[key]
