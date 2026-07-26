"""Pen Neer — dagelijkse missies.

Three missions per day, the SAME for everyone (deterministic from the date,
like the daily letter), each worth bonus XP. Rewards auto-claim the moment a
mission completes: users.bonus_xp goes up, which _xp_of counts into the level.
Progress lives in the mission_progress table and is bumped from three places:
game over (social.record_game), the daily-round submit, and chat (rooms).
"""
from __future__ import annotations

import random

# key -> (target, reward XP, reward COINS). Small missions pay 10 coins, medium
# 15, the hard ones 20. Copy for names lives in the frontend i18n (mission_<key>).
# Keys are stored in mission_progress, so never rename one; only add.
POOL: dict[str, tuple[int, int, int]] = {
    # --- potjes ---------------------------------------------------------
    "play_game": (1, 30, 10),      # speel een potje
    "play2": (2, 40, 15),          # speel 2 potjes
    "win_game": (1, 50, 20),       # win een potje
    "unique5": (5, 40, 15),        # 5 unieke woorden
    "unique10": (10, 50, 20),      # 10 unieke woorden
    "dubbel3": (3, 30, 15),        # 3 dubbele woorden
    "dubbel5": (5, 40, 15),        # 5 dubbele woorden
    "multi3": (1, 40, 15),         # potje met 3+ spelers
    "multi4": (1, 50, 20),         # potje met 4+ spelers
    "perfect_round": (1, 50, 20),  # een ronde met alleen unieke woorden
    "comeback_win": (1, 50, 20),   # laatste halverwege, toch winnen
    "hard_game": (1, 30, 10),      # potje met moeilijke letters
    "score80": (1, 40, 15),        # 80+ punten in een potje
    # --- dagronde -------------------------------------------------------
    "daily_play": (1, 40, 10),     # speel de dagronde
    "daily_full": (1, 40, 15),     # vul elke categorie in
    "daily30": (1, 50, 20),        # scoor 30+
    "daily_perfect": (1, 50, 20),  # alles goed (50 punten)
    # --- sociaal --------------------------------------------------------
    "chat_msg": (1, 30, 10),       # stuur een bericht in de chat
    "chat_emote": (1, 30, 10),     # stuur een emote in de chat
}

# Which bucket a mission belongs to, and how many of a bucket may land on one
# day. Without this a roll could hand out three dagronde-missies (or three
# chat-missies), which reads as one mission instead of three.
GROUP: dict[str, str] = {
    **{k: "game" for k in (
        "play_game", "play2", "win_game", "unique5", "unique10", "dubbel3",
        "dubbel5", "multi3", "multi4", "perfect_round", "comeback_win",
        "hard_game", "score80",
    )},
    **{k: "daily" for k in ("daily_play", "daily_full", "daily30", "daily_perfect")},
    **{k: "social" for k in ("chat_msg", "chat_emote")},
}
# Missions that measure the same thing at two levels. Only one of a family may
# land on a day, otherwise the bigger one hands you the smaller one for free.
FAMILY: dict[str, str] = {
    "play_game": "play", "play2": "play",
    "unique5": "unique", "unique10": "unique",
    "dubbel3": "dubbel", "dubbel5": "dubbel",
    "multi3": "multi", "multi4": "multi",
}
HARD_COINS = 20  # a day gets at most one mission at this reward tier


def missions_for(day: str) -> list[dict]:
    """Today's three missions, day-seeded so every server agrees.

    The shape is fixed (two from playing a potje, one from the dagronde or the
    chat) so a day never turns into three variations of the same thing, and
    exactly one slot may hold a hard mission so the difficulty stays even.
    """
    rng = random.Random(f"penneer-missions:{day}")

    def bucket(group: str) -> list[str]:
        keys = sorted(k for k, g in GROUP.items() if g == group)
        rng.shuffle(keys)
        return keys

    games, dailies, socials = bucket("game"), bucket("daily"), bucket("social")
    # Two thirds of the days push the dagronde, the rest push the chat.
    third = dailies + socials if rng.random() < 0.66 else socials + dailies
    hard_slot = rng.randrange(3)  # which slot is allowed to be a hard mission

    picked: list[str] = []
    families: set[str] = set()

    def fill(candidates: list[str]) -> bool:
        for key in candidates:
            if key in picked:
                continue
            family = FAMILY.get(key)
            if family and family in families:
                continue
            if POOL[key][2] >= HARD_COINS and len(picked) != hard_slot:
                continue
            if family:
                families.add(family)
            picked.append(key)
            return True
        return False

    for candidates in (games, games, third):
        if not fill(candidates):
            fill(games + third)  # never hand out fewer than three
    return [{"key": k, "target": POOL[k][0], "reward": POOL[k][1], "coins": POOL[k][2]} for k in picked]


def active_keys(day: str) -> set[str]:
    return {m["key"] for m in missions_for(day)}


def spec(key: str) -> tuple[int, int, int]:
    return POOL[key]


def bump_all(db, user_id: str, day: str, pairs) -> list[dict]:
    """Apply progress for today's active missions only; return the completed ones."""
    active = active_keys(day)
    done: list[dict] = []
    for key, inc in pairs:
        if key not in active or inc <= 0:
            continue
        target, reward, coins = spec(key)
        if db.mission_bump(user_id, day, key, inc, target, reward, coins):
            done.append({"key": key, "reward": reward, "coins": coins})
    return done
