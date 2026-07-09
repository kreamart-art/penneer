"""Pen Neer — server-side data model (in-memory).

The server is the single source of truth. Clients only render and send intents.
All state lives in these dataclasses, held by the RoomManager.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# ---- Server constants -------------------------------------------------------

PT_FULL = 10  # unique answer
PT_HALF = 5   # shared (dubbel) answer; keep the 2:1 ratio

# Player colors, round-robin. The local player is re-tinted to gold client-side.
PLAYER_COLORS = ["#FFC23D", "#36E0AE", "#FF7AC2", "#7A67FF", "#FF8A4C", "#8BE36A"]

# Letter pool excludes Q, X, Y (hard in Dutch). No repeats within a game.
LETTER_POOL = [c for c in "ABCDEFGHIJKLMNOPRSTUVWZ"]
# Full pool incl. the hard letters, used when settings.hard_letters is on.
FULL_LETTER_POOL = [c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"]

# Room codes: uppercase, no ambiguous chars.
CODE_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ"

# Canonical category keys (language-neutral). The frontend localizes the labels;
# the server only stores keys (plus any custom strings from a deelcode pack).
ALL_CATEGORIES = ["Jongen", "Meisje", "Dier", "Vrucht", "Land", "Stad", "Beroep", "Ding"]
DEFAULT_CATEGORIES = ["Jongen", "Meisje", "Dier", "Vrucht", "Land"]

RECONNECT_GRACE = 60.0  # (legacy) seconds a disconnected player keeps their slot
# Players now keep their slot as long as the room lives (so backgrounding the app
# never drops you). The room itself is only torn down after this long a stretch
# with nobody connected at all.
ROOM_EMPTY_GRACE = 1200.0  # 20 minutes

MAX_PLAYERS_CAP = 16     # hard ceiling regardless of room setting
BOT_NAMES = ["Robbie", "Pixel", "Bitje", "Nova", "Tika", "Zappy", "Mips", "Loek", "Fae", "Otto"]


@dataclass
class Player:
    id: str
    name: str
    color: str
    is_host: bool = False
    connected: bool = True
    disconnected_at: Optional[float] = None  # wall-clock when they dropped
    is_spectator: bool = False
    is_bot: bool = False
    # Account link (None for guests). Snapshot of the avatar at join time; the
    # client renders /api/avatar/{user_id}?v={avatar_ver} when has_avatar.
    user_id: Optional[str] = None
    has_avatar: bool = False
    avatar_ver: int = 0

    def public(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "is_host": self.is_host,
            "connected": self.connected,
            "is_spectator": self.is_spectator,
            "is_bot": self.is_bot,
            "user_id": self.user_id,
            "has_avatar": self.has_avatar,
            "avatar_ver": self.avatar_ver,
        }


@dataclass
class Settings:
    round_time: int = 60                       # 0 means "no timer", spelleider decides
    rounds: int = 5
    categories: list[str] = field(default_factory=lambda: list(DEFAULT_CATEGORIES))
    hard_letters: bool = False                 # include Q/X/Y
    max_players: int = 8                        # lobby cap (excludes spectators)
    allow_spectators: bool = True              # admit late joiners as spectators
    lenient_spelling: bool = False             # soepele spelling (dyslexie): near-miss spellings count

    def public(self) -> dict:
        return {
            "round_time": self.round_time,
            "rounds": self.rounds,
            "categories": list(self.categories),
            "hard_letters": self.hard_letters,
            "max_players": self.max_players,
            "allow_spectators": self.allow_spectators,
            "lenient_spelling": self.lenient_spelling,
        }


@dataclass
class Answer:
    text: str
    valid: bool          # counts for scoring; server-computed, mutable via challenge
    in_list: bool = True  # found in the category word list (False -> orange "?" on results)
    # Duplicate-detection key. In lenient (soepele spelling) rooms a near-miss
    # spelling gets the list word it matches ('miloen' -> 'meloen'), so both
    # score as dubbel. Players can also pair it by hand on the results screen
    # ('manja' = 'mango'), so it goes over the wire for the pairing UI.
    canon: str = ""

    def public(self) -> dict:
        return {"text": self.text, "valid": self.valid, "in_list": self.in_list, "canon": self.canon}


@dataclass
class Round:
    letter: str = ""
    # answers[player_id][category] -> Answer
    answers: dict[str, dict[str, Answer]] = field(default_factory=dict)
    # points[player_id][category] -> int
    points: dict[str, dict[str, int]] = field(default_factory=dict)

    def public(self) -> dict:
        return {
            "letter": self.letter,
            "answers": {
                pid: {cat: a.public() for cat, a in cats.items()}
                for pid, cats in self.answers.items()
            },
            "points": {pid: dict(cats) for pid, cats in self.points.items()},
        }


@dataclass
class Timer:
    ends_at: Optional[float] = None  # server wall-clock (time.time())
    duration: Optional[int] = None

    def public(self) -> dict:
        return {"ends_at": self.ends_at, "duration": self.duration}


@dataclass
class Room:
    code: str
    host_id: str
    players: list[Player] = field(default_factory=list)
    settings: Settings = field(default_factory=Settings)
    phase: str = "lobby"  # lobby | reveal | fill | results | final
    round_no: int = 0
    used_letters: list[str] = field(default_factory=list)
    active_player_id: Optional[str] = None
    timer: Timer = field(default_factory=Timer)
    history: list[Round] = field(default_factory=list)
    scores: dict[str, int] = field(default_factory=dict)
    ready_ids: list[str] = field(default_factory=list)  # players who tapped "Ik ben klaar"
    # Players who left mid-round and came back: they sit out the CURRENT round
    # (cannot fill in, score no points) and rejoin play next round.
    sat_out: list[str] = field(default_factory=list)
    # In-room chat (so players can ask what a word means without leaving). Kept
    # out of public() — it has its own channel (chat_history on join, chat on send).
    chat: list[dict] = field(default_factory=list)
    chat_seq: int = 0

    # ---- helpers ----
    def get_player(self, pid: str) -> Optional[Player]:
        for p in self.players:
            if p.id == pid:
                return p
        return None

    def connected_players(self) -> list[Player]:
        return [p for p in self.players if p.connected]

    @property
    def current_round(self) -> Optional[Round]:
        if self.history:
            return self.history[-1]
        return None

    def public(self) -> dict:
        return {
            "code": self.code,
            "host_id": self.host_id,
            "players": [p.public() for p in self.players],
            "settings": self.settings.public(),
            "phase": self.phase,
            "round_no": self.round_no,
            "used_letters": list(self.used_letters),
            "active_player_id": self.active_player_id,
            "timer": self.timer.public(),
            "scores": dict(self.scores),
            "ready_ids": list(self.ready_ids),
            "sat_out": list(self.sat_out),
            # The current round (answers + points) so reconnecting clients
            # can rebuild reveal/results screens.
            "round": self.current_round.public() if self.current_round else None,
        }
