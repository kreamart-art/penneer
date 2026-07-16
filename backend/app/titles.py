"""Pen Neer — earnable cosmetic titles.

Titles unlock from real progress (stats, badges, level) and can be chosen to
show under your name in place of the auto rank label. Bot games are not
recorded, so titles can never be farmed. Display copy + requirement text live
in the frontend i18n (title_<key> / titlereq_<key>).
"""
from __future__ import annotations

# (key, predicate(stats, badge_set, level)). Order = display order, roughly by
# how hard it is to earn. 'nieuweling' is the always-unlocked default.
_CATALOG = [
    ("nieuweling", lambda s, b, l: True),
    ("speler", lambda s, b, l: s.get("games", 0) >= 5),
    ("winnaar", lambda s, b, l: s.get("wins", 0) >= 3),
    ("fanatiekeling", lambda s, b, l: s.get("games", 0) >= 25),
    ("woordkunstenaar", lambda s, b, l: s.get("uniques", 0) >= 50),
    ("scherpschutter", lambda s, b, l: s.get("best", 0) >= 80),
    ("kampioen", lambda s, b, l: s.get("wins", 0) >= 15),
    ("hattrickheld", lambda s, b, l: "hattrick" in b),
    ("perfectionist", lambda s, b, l: "perfecte_ronde" in b),
    ("legende", lambda s, b, l: l >= 15),
    ("maandkampioen", lambda s, b, l: "seizoenswinnaar" in b),
]

ALL_KEYS = [k for k, _ in _CATALOG]


def unlocked_for(stats: dict, badges, level: int) -> list[str]:
    """The title keys this account has unlocked (badges may be a list of str
    or of {badge: ...} dicts)."""
    bset = {x["badge"] if isinstance(x, dict) else x for x in (badges or [])}
    return [k for k, fn in _CATALOG if fn(stats or {}, bset, level)]
