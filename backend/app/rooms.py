"""Pen Neer — RoomManager: in-memory room state, connections, round flow.

Single-process v1: all rooms live in a dict. To scale to multiple processes,
swap `self.rooms` / `self.connections` for Redis (state) + a pub/sub fan-out for
broadcasts, and move the per-room timer into a single scheduler keyed by code.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import secrets
import time
import uuid
from typing import Any, Optional

from . import ai_referee, game
from .db import get_db
from .social import _level_of
from .models import (
    BOT_NAMES,
    CODE_ALPHABET,
    MAX_PLAYERS_CAP,
    PLAYER_COLORS,
    ROOM_EMPTY_GRACE,
    Player,
    Room,
    Round,
    Settings,
)


def _new_id() -> str:
    return uuid.uuid4().hex


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.connections: dict[str, Any] = {}  # player_id -> WebSocket
        # Transient typed-but-not-yet-submitted answers during the fill phase.
        # pending[code][player_id][category] -> text
        self.pending: dict[str, dict[str, dict[str, str]]] = {}
        self.timer_tasks: dict[str, asyncio.Task] = {}
        # Per-room teardown timer, armed only when nobody is connected.
        self.empty_room_tasks: dict[str, asyncio.Task] = {}
        # Players who sent their final answers for the round being scored.
        self.submits: dict[str, set[str]] = {}
        # Admin (owner) state. Password from env; recovery codes derived from it
        # so they're stable across restarts without a database.
        self.admin_password = os.environ.get("PENNEER_ADMIN_PASSWORD", "penneer-admin")
        self.used_recovery: set[str] = set()
        self.admin_conns: set[int] = set()  # id(ws) of admin-logged-in connections
        # AI referee runtime switch (admin-controlled; needs a configured key).
        self.ai_enabled = ai_referee.default_enabled()

    # ---- admin / AI --------------------------------------------------------

    def _recovery_codes(self) -> list[str]:
        """8 stable one-time codes derived from the admin password."""
        codes = []
        for i in range(8):
            h = hashlib.sha256(f"{self.admin_password}:penneer:{i}".encode()).hexdigest()
            codes.append(h[:10].upper())
        return codes

    def _admin_payload(self, is_admin: bool, ai_codes: Optional[list[str]] = None) -> dict:
        codes = self._recovery_codes()
        return {
            "type": "admin_ok",
            "is_admin": is_admin,
            "ai": {**ai_referee.status(), "enabled": self.ai_enabled},
            "recovery_codes": [{"code": c, "used": c in self.used_recovery} for c in codes],
            # Shop unlock codes: aggregate stats always; the plain codes only when
            # freshly generated (they are never recoverable after this reply).
            "ai_codes": {**get_db().ai_code_stats(), "new": ai_codes or []},
        }

    def _is_admin_conn(self, ws: Any) -> bool:
        # Admin is scoped to the WebSocket connection, so it works before the
        # user has created/joined a room (the pre-room Settings screen).
        return ws is not None and id(ws) in self.admin_conns

    def _player_is_admin(self, player_id: str) -> bool:
        return self._is_admin_conn(self.connections.get(player_id))

    async def admin_login(self, ws: Any, player_id: Optional[str], payload: dict) -> None:
        secret = (payload.get("secret") or "").strip()
        ok = False
        if secret and secret == self.admin_password:
            ok = True
        elif secret:
            up = secret.upper()
            if up in self._recovery_codes() and up not in self.used_recovery:
                self.used_recovery.add(up)  # one-time
                ok = True
        if ok:
            self.admin_conns.add(id(ws))
            try:
                await ws.send_json(self._admin_payload(True))
            except Exception:
                pass
            room = self.room_of_player(player_id) if player_id else None
            if room:
                await self.send_state(room)
        else:
            try:
                await ws.send_json({"type": "error", "message": "Onjuiste admincode."})
            except Exception:
                pass

    async def admin_set_ai(self, ws: Any, player_id: Optional[str], payload: dict) -> None:
        if not self._is_admin_conn(ws):
            return
        self.ai_enabled = bool(payload.get("enabled"))
        try:
            await ws.send_json(self._admin_payload(True))
        except Exception:
            pass
        room = self.room_of_player(player_id) if player_id else None
        if room:
            await self.send_state(room)

    async def admin_gen_ai_codes(self, ws: Any, player_id: Optional[str], payload: dict) -> None:
        """Owner mints one-time shop codes that unlock the AI for ONE account
        each (never admin). Handed out or sold manually; PayPal mints its own."""
        if not self._is_admin_conn(ws):
            return
        try:
            count = int(payload.get("count") or 1)
        except (TypeError, ValueError):
            count = 1
        count = max(1, min(count, 20))
        codes = [get_db().create_ai_code("admin") for _ in range(count)]
        try:
            await ws.send_json(self._admin_payload(True, ai_codes=codes))
        except Exception:
            pass

    def drop_connection(self, ws: Any) -> None:
        self.admin_conns.discard(id(ws))

    def _host_ai_unlocked(self, room: Optional[Room]) -> bool:
        """True when the room's host bought the AI unlock for their account."""
        if room is None:
            return False
        host = room.get_player(room.host_id)
        uid = getattr(host, "user_id", None) if host else None
        return bool(uid and get_db().is_ai_unlocked(uid))

    def _ai_active(self, room: Optional[Room] = None) -> bool:
        # Available AND (owner flipped it on globally OR this room's host paid).
        if not ai_referee.available():
            return False
        return self.ai_enabled or self._host_ai_unlocked(room)

    # ---- code / lookup -----------------------------------------------------

    def _gen_code(self) -> str:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))
            if code not in self.rooms:
                return code

    def room_of_player(self, player_id: str) -> Optional[Room]:
        for room in self.rooms.values():
            if room.get_player(player_id):
                return room
        return None

    @staticmethod
    def playing_players(room: Room) -> list[Player]:
        """Players who actually play (excludes spectators). Bots count."""
        return [p for p in room.players if not p.is_spectator]

    # ---- send / broadcast --------------------------------------------------

    async def _send(self, player_id: str, message: dict) -> None:
        ws = self.connections.get(player_id)
        if ws is None:
            return
        try:
            await ws.send_json(message)
        except Exception:
            # Drop a dead socket silently; disconnect handler cleans up state.
            pass

    async def broadcast(self, room: Room, message: dict) -> None:
        for p in room.players:
            if p.connected:
                await self._send(p.id, message)

    async def send_state(self, room: Room, player_id: Optional[str] = None) -> None:
        pub = room.public()
        pub["ai_referee"] = self._ai_active(room)  # AI scheidsrechter on the "?"
        msg = {"type": "room_state", "room": pub}
        if player_id is not None:
            await self._send(player_id, msg)
        else:
            await self.broadcast(room, msg)

    async def error(self, player_id: str, message: str) -> None:
        await self._send(player_id, {"type": "error", "message": message})

    # ---- chat --------------------------------------------------------------

    async def _send_chat_history(self, room: Room, player_id: str) -> None:
        await self._send(player_id, {"type": "chat_history", "messages": list(room.chat)})

    async def chat_send(self, player_id: str, payload: dict) -> None:
        """A player sends a room chat message (so people can ask what a word
        means without leaving the app). Visible to everyone in the room."""
        room = self.room_of_player(player_id)
        if room is None:
            return
        p = room.get_player(player_id)
        if p is None or p.is_bot:
            return
        text = payload.get("text")
        if not isinstance(text, str):
            return
        text = text.strip()[:280]
        if not text:
            return
        room.chat_seq += 1
        msg = {
            "id": room.chat_seq,
            "player_id": player_id,
            "name": p.name,
            "color": p.color,
            "text": text,
            "ts": time.time(),
        }
        room.chat.append(msg)
        if len(room.chat) > 60:
            room.chat = room.chat[-60:]
        await self.broadcast(room, {"type": "chat", "message": msg})

    async def chat_typing(self, player_id: str, payload: dict) -> None:
        """Relay a typing signal to everyone else in the room. Best-effort; the
        client shows it briefly and auto-expires, so no server state is kept."""
        room = self.room_of_player(player_id)
        if room is None:
            return
        p = room.get_player(player_id)
        if p is None or p.is_bot:
            return
        typing = bool(payload.get("typing"))
        for other in room.players:
            if other.connected and other.id != player_id:
                await self._send(
                    other.id,
                    {"type": "chat_typing", "player_id": player_id, "name": p.name, "typing": typing},
                )

    # ---- create / join / reconnect ----------------------------------------

    @staticmethod
    def _apply_account(player: Player, account: Optional[dict]) -> None:
        """Link a joined player to their account: profile name, color, avatar."""
        if not account:
            return
        player.user_id = account["id"]
        player.name = account["name"]
        if account.get("color"):
            player.color = account["color"]
        player.has_avatar = bool(account.get("has_avatar"))
        player.avatar_ver = account.get("avatar_ver", 0)
        # Rank ring + title in the room, from the account's current level.
        lvl = _level_of(get_db().stats_of(account["id"]))
        player.level = lvl["level"]
        player.rank = lvl["rank"]

    async def create_room(self, ws: Any, name: str, account: Optional[dict] = None) -> tuple[Room, Player]:
        code = self._gen_code()
        pid = _new_id()
        player = Player(id=pid, name=name.strip() or "Speler", color=PLAYER_COLORS[0], is_host=True)
        self._apply_account(player, account)
        room = Room(code=code, host_id=pid, players=[player], settings=Settings())
        room.scores[pid] = 0
        self.rooms[code] = room
        self.pending[code] = {}
        self.connections[pid] = ws
        await self._send(pid, {"type": "joined", "code": code, "player_id": pid})
        await self.send_state(room, pid)
        return room, player

    async def join_room(self, ws: Any, code: str, name: str, account: Optional[dict] = None) -> Optional[tuple[Room, Player]]:
        code = (code or "").strip().upper()
        room = self.rooms.get(code)
        if room is None:
            await ws.send_json({"type": "error", "message": "Deze room bestaat niet."})
            return None
        # One account = one seat per room. If that seat already exists (a dropped
        # or stuck player, or another device), REJOIN it instead of rejecting, so
        # a kicked-out player can get back in with the room code.
        if account:
            existing = next((p for p in room.players if p.user_id == account["id"]), None)
            if existing:
                self._cancel_room_cleanup(code)
                old_ws = self.connections.get(existing.id)
                if old_ws is not None and old_ws is not ws:
                    try:
                        await old_ws.send_json({"type": "error", "message": "Je bent op een ander apparaat verder gegaan."})
                    except Exception:
                        pass
                self._apply_account(existing, account)  # refresh name/avatar
                existing.connected = True
                existing.disconnected_at = None
                self.connections[existing.id] = ws
                await self._send(existing.id, {"type": "joined", "code": code, "player_id": existing.id})
                await self.send_state(room, existing.id)
                await self._send_chat_history(room, existing.id)
                await self.broadcast(room, {"type": "player_joined", "player": existing.public()})
                await self.send_state(room)
                return room, existing
        self._cancel_room_cleanup(code)  # a new arrival keeps the room alive

        spectator = False
        if room.phase not in ("lobby", "rules"):
            # Game in progress: admit as spectator if allowed, else reject.
            if room.settings.allow_spectators:
                spectator = True
            else:
                await ws.send_json({"type": "error", "message": "Het spel is al bezig."})
                return None
        else:
            # Pre-game (lobby or the rules gate): join as a player unless full
            # (spectators don't count toward the cap).
            if len(self.playing_players(room)) >= room.settings.max_players:
                if room.settings.allow_spectators:
                    spectator = True
                else:
                    await ws.send_json({"type": "error", "message": "De room is vol."})
                    return None

        pid = _new_id()
        color = PLAYER_COLORS[len(room.players) % len(PLAYER_COLORS)]
        player = Player(id=pid, name=name.strip() or "Speler", color=color, is_spectator=spectator)
        self._apply_account(player, account)
        room.players.append(player)
        room.scores[pid] = 0
        self.connections[pid] = ws

        await self._send(pid, {"type": "joined", "code": code, "player_id": pid})
        await self.send_state(room, pid)
        await self._send_chat_history(room, pid)
        await self.broadcast(room, {"type": "player_joined", "player": player.public()})
        await self.send_state(room)
        return room, player

    async def reconnect(self, ws: Any, code: str, player_id: str) -> Optional[tuple[Room, Player]]:
        code = (code or "").strip().upper()
        room = self.rooms.get(code)
        if room is None:
            await ws.send_json({"type": "error", "message": "Deze room bestaat niet meer."})
            return None
        player = room.get_player(player_id)
        if player is None:
            await ws.send_json({"type": "error", "message": "Je plek in deze room is verlopen."})
            return None

        # Someone's back — cancel any pending room teardown.
        self._cancel_room_cleanup(code)

        player.connected = True
        player.disconnected_at = None
        self.connections[player_id] = ws
        await self._send(player_id, {"type": "joined", "code": code, "player_id": player_id})
        await self.send_state(room, player_id)
        await self._send_chat_history(room, player_id)
        await self.broadcast(room, {"type": "player_joined", "player": player.public()})
        await self.send_state(room)
        return room, player

    # ---- disconnect / removal ---------------------------------------------

    async def disconnect(self, player_id: str) -> None:
        self.connections.pop(player_id, None)
        room = self.room_of_player(player_id)
        if room is None:
            return
        player = room.get_player(player_id)
        if player is None:
            return
        player.connected = False
        player.disconnected_at = time.time()

        # Host migration only if someone else is connected; otherwise the host
        # keeps the crown and reclaims it on reconnect.
        if room.host_id == player_id:
            self._migrate_host(room)

        # If the spelleider drops while spinning, auto-resolve the reveal so the
        # round still happens for everyone else.
        if room.active_player_id == player_id and room.phase == "reveal":
            await self._auto_lock_letter(room)

        # Keep their slot — they may have just backgrounded the app. Others see
        # them dimmed; a reconnect restores them. No per-player removal anymore.
        await self.broadcast(room, {"type": "player_left", "player_id": player_id})
        await self.send_state(room)

        # A drop during results may have been the last player the gate waited on.
        if room.phase == "results":
            await self._maybe_advance(room)

        # Only tear the room down once nobody is connected, after a long grace,
        # so a whole group briefly backgrounding the app never loses the room.
        if not self._has_humans(room):
            self._schedule_room_cleanup(room.code)

    def _migrate_host(self, room: Room) -> None:
        # Only a connected HUMAN PLAYER can hold the crown: a bot can't drive
        # host controls (the room would stall) and a spectator isn't playing.
        # Both also have no paid account, which would silently drop a paying
        # host's AI referee. If no candidate exists, keep the current host: a
        # disconnected human host keeps the seat (grace) and re-takes control
        # on reconnect.
        for p in room.players:
            if p.connected and p.id != room.host_id and not p.is_bot and not p.is_spectator:
                room.host_id = p.id
                for q in room.players:
                    q.is_host = q.id == p.id
                return

    def _schedule_room_cleanup(self, code: str) -> None:
        """Arm room teardown after a long grace with nobody connected."""
        old = self.empty_room_tasks.pop(code, None)
        if old:
            old.cancel()
        self.empty_room_tasks[code] = asyncio.create_task(self._destroy_room_after_grace(code))

    def _cancel_room_cleanup(self, code: str) -> None:
        task = self.empty_room_tasks.pop(code, None)
        if task:
            task.cancel()

    async def _destroy_room_after_grace(self, code: str) -> None:
        try:
            await asyncio.sleep(ROOM_EMPTY_GRACE)
        except asyncio.CancelledError:
            return
        room = self.rooms.get(code)
        if room is not None and not self._has_humans(room):
            self._destroy_room(code)
        self.empty_room_tasks.pop(code, None)

    def _destroy_room(self, code: str) -> None:
        self.rooms.pop(code, None)
        self.pending.pop(code, None)
        task = self.timer_tasks.pop(code, None)
        if task:
            task.cancel()
        empty = self.empty_room_tasks.pop(code, None)
        if empty:
            empty.cancel()

    # ---- settings / start --------------------------------------------------

    async def update_settings(self, player_id: str, payload: dict) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id or room.phase != "lobby":
            return
        s = room.settings
        if "round_time" in payload and payload["round_time"] in (0, 30, 60, 90):
            s.round_time = payload["round_time"]
        if "rounds" in payload and isinstance(payload["rounds"], int) and 2 <= payload["rounds"] <= 20:
            s.rounds = payload["rounds"]
        if "categories" in payload and isinstance(payload["categories"], list):
            # Accept known categories and custom strings (from a deelcode pack):
            # trimmed, capped at 24 chars, de-duplicated, in the requested order.
            seen: set[str] = set()
            cats: list[str] = []
            for c in payload["categories"]:
                if not isinstance(c, str):
                    continue
                c = c.strip()[:24]
                key = c.lower()
                if c and key not in seen:
                    seen.add(key)
                    cats.append(c)
            if 3 <= len(cats) <= 6:
                s.categories = cats
        if "hard_letters" in payload and isinstance(payload["hard_letters"], bool):
            s.hard_letters = payload["hard_letters"]
        if "max_players" in payload and isinstance(payload["max_players"], int):
            s.max_players = max(2, min(MAX_PLAYERS_CAP, payload["max_players"]))
        if "allow_spectators" in payload and isinstance(payload["allow_spectators"], bool):
            s.allow_spectators = payload["allow_spectators"]
        if "lenient_spelling" in payload and isinstance(payload["lenient_spelling"], bool):
            s.lenient_spelling = payload["lenient_spelling"]
        await self.send_state(room)

    def _init_turn_order(self, room: Room) -> None:
        """Freeze the spelleider rotation at game start, in seat order."""
        room.turn_order = [p.id for p in self.playing_players(room)]
        room.turn_ptr = 0

    def _next_active(self, room: Room, peek: bool = False) -> Optional[str]:
        """Next spelleider. The pointer walks a FIXED game-start order and only
        advances past the player who actually gets the turn, so a dropped
        player is skipped for now but slots right back into the cycle when
        they return — nobody ends up with two or three turns in a row just
        because someone else went offline (the old round_no % len(players)
        arithmetic did exactly that whenever the list or connectivity shifted).
        peek=True answers "who is next" without consuming the turn."""
        order = [pid for pid in room.turn_order if room.get_player(pid) is not None]
        if not order:
            order = [p.id for p in self.playing_players(room)]
            if not order:
                return None
        n = len(order)
        ptr = room.turn_ptr % n
        for step in range(n):
            cand_id = order[(ptr + step) % n]
            cand = room.get_player(cand_id)
            if cand and cand.connected and not cand.is_spectator:
                if not peek:
                    room.turn_ptr = (ptr + step + 1) % n
                return cand_id
        # Nobody connected: hand it to the pointer's slot and move on.
        cand_id = order[ptr]
        if not peek:
            room.turn_ptr = (ptr + 1) % n
        return cand_id

    async def start_game(self, player_id: str) -> None:
        """Two-step start (Kingsen-style): from the lobby the host first opens
        the RULES gate — everyone must tap "klaar" — and only then does a second
        host start actually begin round 1."""
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id:
            return
        # Need at least one player who actually plays.
        if not self.playing_players(room):
            return
        if room.phase == "lobby":
            room.phase = "rules"
            # Bots have read the rules by definition.
            room.ready_ids = [p.id for p in self.playing_players(room) if p.is_bot]
            await self.send_state(room)
            return
        if room.phase != "rules" or not self._all_ready(room):
            return
        await self._really_start(room)

    async def rules_cancel(self, player_id: str) -> None:
        """Host backs out of the rules gate to the lobby (change settings etc.)."""
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id or room.phase != "rules":
            return
        room.phase = "lobby"
        room.ready_ids = []
        await self.send_state(room)

    async def _really_start(self, room: Room) -> None:
        room.round_no = 0
        room.used_letters = []
        room.history = []
        room.ready_ids = []
        room.scores = {p.id: 0 for p in self.playing_players(room)}
        self._init_turn_order(room)
        await self.broadcast(
            room,
            {"type": "game_started", "round_no": 1, "active_player_id": self._next_active(room, peek=True)},
        )
        await self._begin_round(room)

    # ---- round flow --------------------------------------------------------

    async def _begin_round(self, room: Room) -> None:
        room.round_no += 1
        room.phase = "reveal"
        room.active_player_id = self._next_active(room)
        room.timer.ends_at = None
        room.timer.duration = None
        room.ready_ids = []
        room.sat_out = []  # everyone who sat the previous round out is back in
        room.history.append(Round())
        self.pending[room.code] = {}
        self.submits[room.code] = set()
        await self.broadcast(
            room,
            {
                "type": "turn_started",
                "round_no": room.round_no,
                "active_player_id": room.active_player_id,
            },
        )
        await self.send_state(room)
        # If a bot is the spelleider, let it drive the reveal.
        active = room.get_player(room.active_player_id) if room.active_player_id else None
        if active and active.is_bot:
            asyncio.create_task(self._bot_drive_reveal(room.code, active.id))

    async def spin_start(self, player_id: str) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.phase != "reveal" or room.active_player_id != player_id:
            return
        await self.broadcast(room, {"type": "spin_started"})

    async def spin_stop(self, player_id: str) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.phase != "reveal" or room.active_player_id != player_id:
            return
        await self._lock_letter(room)

    async def _auto_lock_letter(self, room: Room) -> None:
        # Spelleider vanished during reveal; resolve it for the rest.
        await self._lock_letter(room)

    async def _lock_letter(self, room: Room) -> None:
        if room.phase != "reveal":
            return
        letter = game.pick_letter(room.used_letters, room.settings.hard_letters)
        room.used_letters.append(letter)
        rnd = room.current_round
        rnd.letter = letter
        await self.broadcast(room, {"type": "letter_locked", "letter": letter})
        # A short beat so everyone sees the letter snap in before the clock runs.
        await asyncio.sleep(1.3)
        # Guard: the room could have been torn down during the beat.
        if room.code not in self.rooms or room.phase != "reveal":
            return
        await self._start_timer(room)

    async def _start_timer(self, room: Room) -> None:
        room.phase = "fill"
        room.ready_ids = []
        duration = room.settings.round_time
        if duration <= 0:
            # No-timer mode: the round runs open-ended until the spelleider stops.
            room.timer.ends_at = None
            room.timer.duration = 0
            await self.broadcast(room, {"type": "timer_started", "duration": 0, "ends_at": None})
        else:
            ends_at = time.time() + duration
            room.timer.ends_at = ends_at
            room.timer.duration = duration
            await self.broadcast(room, {"type": "timer_started", "duration": duration, "ends_at": ends_at})
        await self.send_state(room)
        # Cancel any prior timer; start a fresh authoritative one only if timed.
        old = self.timer_tasks.pop(room.code, None)
        if old:
            old.cancel()
        if duration > 0:
            self.timer_tasks[room.code] = asyncio.create_task(self._run_timer(room.code, duration))
        # Schedule bot answers (and bot auto-stop if a bot is the spelleider).
        if any(p.is_bot for p in self.playing_players(room)):
            asyncio.create_task(self._bot_fill(room.code))

    async def _run_timer(self, code: str, duration: float) -> None:
        try:
            await asyncio.sleep(duration)
        except asyncio.CancelledError:
            return
        room = self.rooms.get(code)
        if room is None or room.phase != "fill":
            return
        await self._end_round(room)

    async def update_answers(self, player_id: str, payload: dict) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.phase != "fill":
            return
        if player_id in room.sat_out:
            return  # left mid-round: sitting this one out
        answers = payload.get("answers") or {}
        if not isinstance(answers, dict):
            return
        bucket = self.pending.setdefault(room.code, {}).setdefault(player_id, {})
        for cat in room.settings.categories:
            if cat in answers and isinstance(answers[cat], str):
                bucket[cat] = answers[cat]

    async def submit_answers(self, player_id: str, payload: dict) -> None:
        """Final answers sent the moment the round ends. Merged into pending and
        recorded so the server can score as soon as everyone has submitted
        (instead of guessing with a fixed delay), so nothing gets truncated."""
        room = self.room_of_player(player_id)
        if room is None or room.phase not in ("fill", "results"):
            return
        if player_id in room.sat_out:
            return  # left mid-round: nothing of theirs may be scored
        answers = payload.get("answers") or {}
        if isinstance(answers, dict):
            bucket = self.pending.setdefault(room.code, {}).setdefault(player_id, {})
            for cat in room.settings.categories:
                if cat in answers and isinstance(answers[cat], str):
                    bucket[cat] = answers[cat]
        self.submits.setdefault(room.code, set()).add(player_id)

    async def set_ready(self, player_id: str, payload: dict) -> None:
        """Mark a player ready ("Ik ben klaar"). In the fill phase it is
        informational (the spelleider decides); in the rules gate it is what
        unlocks the host's start button."""
        room = self.room_of_player(player_id)
        if room is None or room.phase not in ("fill", "rules"):
            return
        player = room.get_player(player_id)
        if player is None or player.is_spectator or player_id in room.sat_out:
            return
        ready = bool(payload.get("ready", True))
        if ready and player_id not in room.ready_ids:
            room.ready_ids.append(player_id)
        elif not ready and player_id in room.ready_ids:
            room.ready_ids.remove(player_id)
        await self.broadcast(room, {"type": "ready_updated", "ready_ids": list(room.ready_ids)})
        await self.send_state(room)

    async def stop_round(self, player_id: str) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.phase != "fill" or room.active_player_id != player_id:
            return
        task = self.timer_tasks.pop(room.code, None)
        if task:
            task.cancel()
        await self._end_round(room)

    async def _end_round(self, room: Room) -> None:
        if room.phase != "fill":
            return
        room.phase = "results"
        room.timer.ends_at = None
        room.ready_ids = []  # fresh readiness for the "next round" gate
        self.submits[room.code] = set()
        # Tell clients fill is over so they submit their final answers...
        await self.broadcast(room, {"type": "round_ended"})
        # ...then wait until everyone's final submit lands (early-exit), so the
        # last keystrokes are never lost to a fixed-delay race.
        expected = {p.id for p in self.playing_players(room) if p.connected and not p.is_bot and p.id not in room.sat_out}
        for _ in range(25):  # up to ~2.5s
            if expected.issubset(self.submits.get(room.code, set())):
                break
            await asyncio.sleep(0.1)
        await self._score_and_broadcast(room)

    async def _ai_resolve(self, room: Room, rnd: Round, lenient: bool = False) -> None:
        """Send the orange "?" answers (valid but not in any list) to the AI
        referee; resolve each to a green check (in_list) or red cross (invalid).
        Undecided stays "?". Deduped so identical answers cost one judgement.
        With lenient on the referee judges phonetically (soepele spelling)."""
        if not self._ai_active(room) or rnd is None:
            return
        index: dict[tuple[str, str], int] = {}
        items: list[tuple[str, str]] = []
        for cats in rnd.answers.values():
            for cat, ans in cats.items():
                if ans.valid and not ans.in_list and ans.text:
                    k = (cat, game.normalize(ans.text))
                    if k not in index:
                        index[k] = len(items)
                        items.append((cat, ans.text))
        if not items:
            return
        verdicts = await ai_referee.judge(rnd.letter, items, lenient=lenient)
        for cats in rnd.answers.values():
            for cat, ans in cats.items():
                if ans.valid and not ans.in_list and ans.text:
                    v = verdicts[index[(cat, game.normalize(ans.text))]]
                    if v is True:
                        ans.in_list = True   # AI confirms -> green check
                    elif v is False:
                        ans.valid = False    # AI rejects -> red cross, 0

    async def _score_and_broadcast(self, room: Room) -> None:
        rnd = room.current_round
        player_ids = [p.id for p in self.playing_players(room)]
        cats = room.settings.categories
        raw = self.pending.get(room.code, {})
        lenient = room.settings.lenient_spelling
        rnd.answers = game.build_answers(raw, rnd.letter, player_ids, cats, lenient=lenient)
        await self._ai_resolve(room, rnd, lenient=lenient)  # hybrid: AI scheidsrechter on the "?"
        rnd.points = game.score_round(rnd, player_ids, cats)
        room.scores = game.total_scores(room.history, player_ids)
        await self.broadcast(
            room,
            {
                "type": "results",
                "round_no": room.round_no,
                "answers": {
                    pid: {cat: a.public() for cat, a in c.items()} for pid, c in rnd.answers.items()
                },
                "points": {pid: dict(c) for pid, c in rnd.points.items()},
                "scores": dict(room.scores),
            },
        )
        await self.send_state(room)
        # Bots are always ready to move on, so the gate only waits on humans.
        bot_ids = [p.id for p in self.playing_players(room) if p.is_bot]
        if bot_ids:
            room.ready_ids = list(dict.fromkeys(room.ready_ids + bot_ids))
            await self.broadcast(room, {"type": "ready_updated", "ready_ids": list(room.ready_ids)})
            await self.send_state(room)

    async def challenge_answer(self, player_id: str, payload: dict) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.phase != "results":
            return
        target = payload.get("player_id")
        cat = payload.get("cat")
        rnd = room.current_round
        if rnd is None:
            return
        ans = rnd.answers.get(target, {}).get(cat)
        if ans is None:
            return
        # A tap toggles validity (or honors an explicit value).
        if "valid" in payload and isinstance(payload["valid"], bool):
            ans.valid = payload["valid"]
        else:
            ans.valid = not ans.valid
        player_ids = [p.id for p in self.playing_players(room)]
        rnd.points = game.score_round(rnd, player_ids, room.settings.categories)
        room.scores = game.total_scores(room.history, player_ids)
        await self.broadcast(
            room,
            {
                "type": "results_updated",
                "points": {pid: dict(c) for pid, c in rnd.points.items()},
                "scores": dict(room.scores),
                # Resend answers so the challenged cross/check flips for everyone.
                "answers": {
                    pid: {cat: a.public() for cat, a in c.items()} for pid, c in rnd.answers.items()
                },
            },
        )
        await self.send_state(room)

    async def mark_same(self, player_id: str, payload: dict) -> None:
        """Pair an answer with another player's word in the same category, so
        both score as dubbel ('manja' = 'mango'). as_player_id None unpairs.
        Pairing implies the word counts (approves it)."""
        room = self.room_of_player(player_id)
        if room is None or room.phase != "results":
            return
        rnd = room.current_round
        if rnd is None:
            return
        target = payload.get("player_id")
        cat = payload.get("cat")
        ans = rnd.answers.get(target, {}).get(cat)
        if ans is None or not ans.text:
            return
        as_pid = payload.get("as_player_id")
        if as_pid:
            other = rnd.answers.get(as_pid, {}).get(cat)
            if other is None or not other.valid or not other.text or as_pid == target:
                return
            # Take the partner's canon so chains collapse to one bucket.
            ans.canon = other.canon or game.normalize(other.text)
            ans.valid = True
        else:
            ans.canon = game.normalize(ans.text)  # unpair: back to its own word
        player_ids = [p.id for p in self.playing_players(room)]
        rnd.points = game.score_round(rnd, player_ids, room.settings.categories)
        room.scores = game.total_scores(room.history, player_ids)
        await self.broadcast(
            room,
            {
                "type": "results_updated",
                "points": {pid: dict(c) for pid, c in rnd.points.items()},
                "scores": dict(room.scores),
                "answers": {
                    pid: {c2: a.public() for c2, a in c.items()} for pid, c in rnd.answers.items()
                },
            },
        )
        await self.send_state(room)

    async def ready_next(self, player_id: str) -> None:
        """A player taps "klaar voor de volgende ronde". Advance only once every
        connected playing player has tapped (so nobody misses the results)."""
        room = self.room_of_player(player_id)
        if room is None or room.phase != "results":
            return
        p = room.get_player(player_id)
        if p is None or p.is_spectator:
            return
        if player_id not in room.ready_ids:
            room.ready_ids.append(player_id)
        await self.broadcast(room, {"type": "ready_updated", "ready_ids": list(room.ready_ids)})
        await self.send_state(room)
        await self._maybe_advance(room)

    def _all_ready(self, room: Room) -> bool:
        need = [p.id for p in self.playing_players(room) if p.connected]
        return bool(need) and all(pid in room.ready_ids for pid in need)

    async def _maybe_advance(self, room: Room) -> None:
        if room.phase == "results" and self._all_ready(room):
            await self._advance(room)

    async def _advance(self, room: Room) -> None:
        if room.round_no >= room.settings.rounds:
            await self._game_over(room)
        else:
            await self._begin_round(room)

    async def next_round(self, player_id: str) -> None:
        """Host/active override: force-advance without waiting for everyone."""
        room = self.room_of_player(player_id)
        if room is None or room.phase != "results":
            return
        if player_id != room.host_id and player_id != room.active_player_id:
            return
        await self._advance(room)

    async def end_game(self, player_id: str) -> None:
        """Host ends the game early (for custom/long games): jump to the final
        standings from the current scores."""
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id or room.phase != "results":
            return
        await self._game_over(room)

    async def _game_over(self, room: Room) -> None:
        room.phase = "final"
        room.timer.ends_at = None
        winner_id = None
        if room.scores:
            winner_id = max(room.scores, key=lambda pid: room.scores[pid])
        await self.broadcast(
            room,
            {"type": "game_over", "scores": dict(room.scores), "winner_id": winner_id},
        )
        await self.send_state(room)
        # Persist the result for account players + evaluate badges. The social
        # layer is optional plumbing: never let it break the game flow.
        try:
            from .social import accounts

            async def notify(user_id: str, badge: str) -> None:
                target = next((p for p in room.players if p.user_id == user_id), None)
                await self.broadcast(room, {
                    "type": "badge_earned",
                    "player_id": target.id if target else None,
                    "name": target.name if target else "",
                    "badge": badge,
                })

            await accounts.record_game(room, notify)
        except Exception:
            pass

    def _reset_for_new_game(self, room: Room) -> None:
        room.round_no = 0
        room.used_letters = []
        room.history = []
        room.active_player_id = None
        room.timer.ends_at = None
        room.ready_ids = []
        room.sat_out = []
        room.turn_order = []
        room.turn_ptr = 0
        room.scores = {p.id: 0 for p in self.playing_players(room)}
        self.pending[room.code] = {}

    async def play_again(self, player_id: str) -> None:
        """Reset back to lobby keeping the same players (host only)."""
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id or room.phase != "final":
            return
        room.phase = "lobby"
        self._reset_for_new_game(room)
        await self.send_state(room)

    async def rematch(self, player_id: str) -> None:
        """Host restarts instantly from the final screen: same group, same
        settings, straight into round 1 (counts for stats like any game)."""
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id or room.phase != "final":
            return
        if not self.playing_players(room):
            return
        self._reset_for_new_game(room)
        # Same group just finished a game: skip the rules gate, straight in.
        await self._really_start(room)

    async def leave_room(self, player_id: str) -> None:
        room = self.room_of_player(player_id)
        if room is None:
            return
        player = room.get_player(player_id)
        # Leaving DURING a game is a soft-leave: the seat (and scores) stay so
        # the player can come back with the room code. House rule: walk out
        # during a round and you sit that exact round out — you're back in the
        # game from the next round. (Backgrounding/app crashes are handled by
        # disconnect() and never count as walking out.)
        if player is not None and not player.is_spectator and room.phase in ("reveal", "fill", "results"):
            if room.phase in ("reveal", "fill") and player_id not in room.sat_out:
                room.sat_out.append(player_id)
                # Their part of this round is over; drop them from the ready list
                # and their pending answers so nothing half-typed gets scored.
                if player_id in room.ready_ids:
                    room.ready_ids.remove(player_id)
                self.pending.get(room.code, {}).pop(player_id, None)
            await self.disconnect(player_id)
            return
        room.players = [p for p in room.players if p.id != player_id]
        room.scores.pop(player_id, None)
        self.connections.pop(player_id, None)
        if self._cleanup_if_empty(room):
            return
        if room.host_id == player_id:
            self._migrate_host(room)
        await self.broadcast(room, {"type": "player_left", "player_id": player_id})
        await self.send_state(room)

    def _has_humans(self, room: Room) -> bool:
        return any(p.connected and not p.is_bot for p in room.players)

    def _cleanup_if_empty(self, room: Room) -> bool:
        """Destroy the room once no connected humans remain (bots don't count)."""
        if not self._has_humans(room):
            self._destroy_room(room.code)
            return True
        return False

    # ---- testbots ----------------------------------------------------------

    async def add_bot(self, player_id: str) -> None:
        room = self.room_of_player(player_id)
        # Testbots are an admin (owner) tool.
        if room is None or not self._player_is_admin(player_id) or room.phase != "lobby":
            return
        if len(self.playing_players(room)) >= room.settings.max_players:
            await self.error(player_id, "De room is vol.")
            return
        used = {p.name for p in room.players}
        name = next((n for n in BOT_NAMES if n not in used), None)
        if name is None:
            name = f"Bot {len(room.players) + 1}"
        pid = _new_id()
        color = PLAYER_COLORS[len(room.players) % len(PLAYER_COLORS)]
        bot = Player(id=pid, name=name, color=color, is_bot=True, connected=True)
        room.players.append(bot)
        room.scores[pid] = 0
        await self.broadcast(room, {"type": "player_joined", "player": bot.public()})
        await self.send_state(room)

    async def remove_bot(self, player_id: str, payload: dict) -> None:
        room = self.room_of_player(player_id)
        if room is None or not self._player_is_admin(player_id) or room.phase != "lobby":
            return
        target = payload.get("bot_id")
        bot = room.get_player(target) if target else None
        if bot is None or not bot.is_bot:
            return
        room.players = [p for p in room.players if p.id != target]
        room.scores.pop(target, None)
        await self.broadcast(room, {"type": "player_left", "player_id": target})
        await self.send_state(room)

    async def _bot_drive_reveal(self, code: str, bot_id: str) -> None:
        """A bot is the spelleider: animate the buzzer and lock a letter."""
        await asyncio.sleep(1.2)
        room = self.rooms.get(code)
        if room is None or room.phase != "reveal" or room.active_player_id != bot_id:
            return
        await self.broadcast(room, {"type": "spin_started"})
        await asyncio.sleep(1.5)
        room = self.rooms.get(code)
        if room is None or room.phase != "reveal" or room.active_player_id != bot_id:
            return
        await self._lock_letter(room)

    async def _bot_fill(self, code: str) -> None:
        """Fill in answers for every bot, then auto-stop if a bot is active."""
        import random as _random

        rng = _random.Random()
        # Stagger bot answers so they trickle in like real players.
        await asyncio.sleep(rng.uniform(0.8, 2.0))
        room = self.rooms.get(code)
        if room is None or room.phase != "fill":
            return
        rnd = room.current_round
        if rnd is None:
            return
        for bot in [p for p in self.playing_players(room) if p.is_bot]:
            bucket = self.pending.setdefault(code, {}).setdefault(bot.id, {})
            for cat in room.settings.categories:
                bucket[cat] = game.bot_answer(rnd.letter, cat, rng)
            if bot.id not in room.ready_ids:
                room.ready_ids.append(bot.id)
        await self.broadcast(room, {"type": "ready_updated", "ready_ids": list(room.ready_ids)})
        await self.send_state(room)
        # If a bot is the spelleider it must end the round (essential for 0s).
        active = room.get_player(room.active_player_id) if room.active_player_id else None
        if active and active.is_bot:
            await asyncio.sleep(rng.uniform(2.5, 4.5))
            room = self.rooms.get(code)
            if room and room.phase == "fill" and room.active_player_id == active.id:
                task = self.timer_tasks.pop(code, None)
                if task:
                    task.cancel()
                await self._end_round(room)
