"""Pen Neer — dagelijkse missies.

Three missions per day, the SAME for everyone (deterministic from the date,
like the daily letter), each worth bonus XP. Rewards auto-claim the moment a
mission completes: users.bonus_xp goes up, which _xp_of counts into the level.
Progress lives in the mission_progress table and is bumped from three places:
game over (social.record_game), the daily-round submit, and chat (rooms).
"""
from __future__ import annotations

import random

# key -> (target, reward XP, reward COINS). Small missions pay 100 coins, medium
# 150, the hard ones 200. Copy for names lives in the frontend i18n (mission_<key>).
# Keys are stored in mission_progress, so never rename one; only add.
POOL: dict[str, tuple[int, int, int]] = {
    # --- potjes ---------------------------------------------------------
    "play_game": (1, 30, 100),      # speel een potje
    "play2": (2, 40, 150),          # speel 2 potjes
    "win_game": (1, 50, 200),       # win een potje
    "unique5": (5, 40, 150),        # 5 unieke woorden
    "unique10": (10, 50, 200),      # 10 unieke woorden
    "dubbel3": (3, 30, 150),        # 3 dubbele woorden
    "dubbel5": (5, 40, 150),        # 5 dubbele woorden
    "multi3": (1, 40, 150),         # potje met 3+ spelers
    "multi4": (1, 50, 200),         # potje met 4+ spelers
    "perfect_round": (1, 50, 200),  # een ronde met alleen unieke woorden
    "comeback_win": (1, 50, 200),   # laatste halverwege, toch winnen
    "hard_game": (1, 30, 100),      # potje met moeilijke letters
    "score80": (1, 40, 150),        # 80+ punten in een potje
    # --- dagronde -------------------------------------------------------
    "daily_play": (1, 40, 100),     # speel de dagronde
    "daily_full": (1, 40, 150),     # vul elke categorie in
    "daily30": (1, 50, 200),        # scoor 30+
    "daily_perfect": (1, 50, 200),  # alles goed (50 punten)
    # --- sociaal --------------------------------------------------------
    "chat_msg": (1, 30, 100),       # stuur een bericht in de chat
    "chat_emote": (1, 30, 100),     # stuur een emote in de chat
    "duel_play": (1, 40, 150),      # speel een duel uit
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
    **{k: "social" for k in ("chat_msg", "chat_emote", "duel_play")},
}
# Missions that measure the same thing at two levels. Only one of a family may
# land on a day, otherwise the bigger one hands you the smaller one for free.
FAMILY: dict[str, str] = {
    "play_game": "play", "play2": "play",
    "unique5": "unique", "unique10": "unique",
    "dubbel3": "dubbel", "dubbel5": "dubbel",
    "multi3": "multi", "multi4": "multi",
}
# MOET meeschalen met de POOL-bedragen: toen de economie maal tien ging en dit
# op 20 bleef staan, gold elke missie als zwaar en kwamen twee van de drie
# sloten leeg te staan. Een dag had toen maar één missie.
HARD_COINS = 200  # a day gets at most one mission at this reward tier

# Twee vaste dagen per week draagt de zware missie van de dag 10 cash bovenop
# zijn coins: woensdag (midweek-haakje) en zondag (de drukste speeldag). Dat is
# 20 cash per week wie alles meepakt, dus de scheidsrechter (250) is via
# missies alleen ruwweg een kwartaal spelen. Sneller dan de levels (level 45),
# maar het blijft werken; en het is deterministisch uit de datum, dus elke
# server en elke cliënt zien dezelfde dag.
CASH_DAGEN = (2, 6)  # maandag = 0
CASH_PRIJS = 10


def cash_dag(day: str) -> bool:
    import datetime
    try:
        return datetime.date.fromisoformat(day).weekday() in CASH_DAGEN
    except ValueError:
        return False


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
    # Op een cash-dag draagt de missie in het zware slot de cash. Niet "de
    # zwaarste van de dag": het slot is deterministisch en bestaat altijd, ook
    # als de terugval er een gewone missie in legde.
    extra = CASH_PRIJS if cash_dag(day) else 0
    return [
        {"key": k, "target": POOL[k][0], "reward": POOL[k][1], "coins": POOL[k][2],
         "cash": extra if i == hard_slot else 0}
        for i, k in enumerate(picked)
    ]


def active_keys(day: str) -> set[str]:
    return {m["key"] for m in missions_for(day)}


def spec(key: str) -> tuple[int, int, int]:
    return POOL[key]


def bump_all(db, user_id: str, day: str, pairs) -> list[dict]:
    """Apply progress for today's active missions only; return the completed ones."""
    vandaag = {m["key"]: m for m in missions_for(day)}
    done: list[dict] = []
    for key, inc in pairs:
        m = vandaag.get(key)
        if not m or inc <= 0:
            continue
        if db.mission_bump(user_id, day, key, inc, m["target"], m["reward"], m["coins"], cash=m["cash"]):
            done.append({"key": key, "reward": m["reward"], "coins": m["coins"], "cash": m["cash"]})
    return done
