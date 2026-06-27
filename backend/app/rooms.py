"""Pen Neer — RoomManager: in-memory room state, connections, round flow.

Single-process v1: all rooms live in a dict. To scale to multiple processes,
swap `self.rooms` / `self.connections` for Redis (state) + a pub/sub fan-out for
broadcasts, and move the per-room timer into a single scheduler keyed by code.
"""
from __future__ import annotations

import asyncio
import secrets
import time
import uuid
from typing import Any, Optional

from . import game
from .models import (
    BOT_NAMES,
    CODE_ALPHABET,
    MAX_PLAYERS_CAP,
    PLAYER_COLORS,
    RECONNECT_GRACE,
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
        self.removal_tasks: dict[str, asyncio.Task] = {}

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
        msg = {"type": "room_state", "room": room.public()}
        if player_id is not None:
            await self._send(player_id, msg)
        else:
            await self.broadcast(room, msg)

    async def error(self, player_id: str, message: str) -> None:
        await self._send(player_id, {"type": "error", "message": message})

    # ---- create / join / reconnect ----------------------------------------

    async def create_room(self, ws: Any, name: str) -> tuple[Room, Player]:
        code = self._gen_code()
        pid = _new_id()
        player = Player(id=pid, name=name.strip() or "Speler", color=PLAYER_COLORS[0], is_host=True)
        room = Room(code=code, host_id=pid, players=[player], settings=Settings())
        room.scores[pid] = 0
        self.rooms[code] = room
        self.pending[code] = {}
        self.connections[pid] = ws
        await self._send(pid, {"type": "joined", "code": code, "player_id": pid})
        await self.send_state(room, pid)
        return room, player

    async def join_room(self, ws: Any, code: str, name: str) -> Optional[tuple[Room, Player]]:
        code = (code or "").strip().upper()
        room = self.rooms.get(code)
        if room is None:
            await ws.send_json({"type": "error", "message": "Deze room bestaat niet."})
            return None

        spectator = False
        if room.phase != "lobby":
            # Game in progress: admit as spectator if allowed, else reject.
            if room.settings.allow_spectators:
                spectator = True
            else:
                await ws.send_json({"type": "error", "message": "Het spel is al bezig."})
                return None
        else:
            # Lobby is full of players (spectators don't count toward the cap).
            if len(self.playing_players(room)) >= room.settings.max_players:
                if room.settings.allow_spectators:
                    spectator = True
                else:
                    await ws.send_json({"type": "error", "message": "De room is vol."})
                    return None

        pid = _new_id()
        color = PLAYER_COLORS[len(room.players) % len(PLAYER_COLORS)]
        player = Player(id=pid, name=name.strip() or "Speler", color=color, is_spectator=spectator)
        room.players.append(player)
        room.scores[pid] = 0
        self.connections[pid] = ws

        await self._send(pid, {"type": "joined", "code": code, "player_id": pid})
        await self.send_state(room, pid)
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

        # Cancel any pending removal.
        task = self.removal_tasks.pop(player_id, None)
        if task:
            task.cancel()

        player.connected = True
        player.disconnected_at = None
        self.connections[player_id] = ws
        await self._send(player_id, {"type": "joined", "code": code, "player_id": player_id})
        await self.send_state(room, player_id)
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

        # Host migration: hand host to the next connected player immediately.
        if room.host_id == player_id:
            self._migrate_host(room)

        # If the spelleider drops while spinning, auto-resolve the reveal so the
        # round still happens for everyone else.
        if room.active_player_id == player_id and room.phase == "reveal":
            await self._auto_lock_letter(room)

        await self.broadcast(room, {"type": "player_left", "player_id": player_id})
        await self.send_state(room)

        # Schedule removal after the grace window.
        self.removal_tasks[player_id] = asyncio.create_task(self._remove_after_grace(room.code, player_id))

    def _migrate_host(self, room: Room) -> None:
        for p in room.players:
            if p.connected and p.id != room.host_id:
                room.host_id = p.id
                for q in room.players:
                    q.is_host = q.id == p.id
                return

    async def _remove_after_grace(self, code: str, player_id: str) -> None:
        try:
            await asyncio.sleep(RECONNECT_GRACE)
        except asyncio.CancelledError:
            return
        room = self.rooms.get(code)
        if room is None:
            return
        player = room.get_player(player_id)
        if player is None or player.connected:
            return
        # Only remove from the lobby; mid-game we keep them on the scoreboard.
        if room.phase == "lobby":
            room.players = [p for p in room.players if p.id != player_id]
            room.scores.pop(player_id, None)
            if room.host_id == player_id:
                self._migrate_host(room)
            if self._cleanup_if_empty(room):
                return
            await self.broadcast(room, {"type": "player_left", "player_id": player_id})
            await self.send_state(room)
        else:
            # Mid-game: if the last human is gone for good, tear the room down so
            # bot-only rooms don't linger.
            if self._cleanup_if_empty(room):
                return
        self.removal_tasks.pop(player_id, None)

    def _destroy_room(self, code: str) -> None:
        self.rooms.pop(code, None)
        self.pending.pop(code, None)
        task = self.timer_tasks.pop(code, None)
        if task:
            task.cancel()

    # ---- settings / start --------------------------------------------------

    async def update_settings(self, player_id: str, payload: dict) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id or room.phase != "lobby":
            return
        s = room.settings
        if "round_time" in payload and payload["round_time"] in (0, 30, 60, 90):
            s.round_time = payload["round_time"]
        if "rounds" in payload and payload["rounds"] in (3, 5, 7):
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
        await self.send_state(room)

    def _active_for_round(self, room: Room, round_no: int) -> Optional[str]:
        """Rotate the spelleider among playing players; skip disconnected ones."""
        players = self.playing_players(room)
        if not players:
            return None
        n = len(players)
        start = (round_no - 1) % n
        for offset in range(n):
            cand = players[(start + offset) % n]
            if cand.connected:
                return cand.id
        return players[start].id  # all disconnected; pick anyway

    async def start_game(self, player_id: str) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id or room.phase != "lobby":
            return
        # Need at least one player who actually plays.
        if not self.playing_players(room):
            return
        room.round_no = 0
        room.used_letters = []
        room.history = []
        room.scores = {p.id: 0 for p in self.playing_players(room)}
        await self.broadcast(
            room,
            {"type": "game_started", "round_no": 1, "active_player_id": self._active_for_round(room, 1)},
        )
        await self._begin_round(room)

    # ---- round flow --------------------------------------------------------

    async def _begin_round(self, room: Room) -> None:
        room.round_no += 1
        room.phase = "reveal"
        room.active_player_id = self._active_for_round(room, room.round_no)
        room.timer.ends_at = None
        room.timer.duration = None
        room.ready_ids = []
        room.history.append(Round())
        self.pending[room.code] = {}
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
        answers = payload.get("answers") or {}
        if not isinstance(answers, dict):
            return
        bucket = self.pending.setdefault(room.code, {}).setdefault(player_id, {})
        for cat in room.settings.categories:
            if cat in answers and isinstance(answers[cat], str):
                bucket[cat] = answers[cat]

    async def set_ready(self, player_id: str, payload: dict) -> None:
        """Mark a player ready ("Ik ben klaar"). Informational only: the
        spelleider still decides when the round actually ends."""
        room = self.room_of_player(player_id)
        if room is None or room.phase != "fill":
            return
        player = room.get_player(player_id)
        if player is None or player.is_spectator:
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
        # Tell clients fill is over so they flush their final answers...
        await self.broadcast(room, {"type": "round_ended"})
        # ...then give them a brief moment to land, and score from pending.
        await asyncio.sleep(0.4)
        await self._score_and_broadcast(room)

    async def _score_and_broadcast(self, room: Room) -> None:
        rnd = room.current_round
        player_ids = [p.id for p in self.playing_players(room)]
        cats = room.settings.categories
        raw = self.pending.get(room.code, {})
        rnd.answers = game.build_answers(raw, rnd.letter, player_ids, cats)
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

    async def next_round(self, player_id: str) -> None:
        room = self.room_of_player(player_id)
        if room is None or room.phase != "results":
            return
        if player_id != room.host_id and player_id != room.active_player_id:
            return
        if room.round_no >= room.settings.rounds:
            await self._game_over(room)
            return
        await self._begin_round(room)

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

    async def play_again(self, player_id: str) -> None:
        """Reset back to lobby keeping the same players (host only)."""
        room = self.room_of_player(player_id)
        if room is None or room.host_id != player_id or room.phase != "final":
            return
        room.phase = "lobby"
        room.round_no = 0
        room.used_letters = []
        room.history = []
        room.active_player_id = None
        room.timer.ends_at = None
        room.ready_ids = []
        room.scores = {p.id: 0 for p in self.playing_players(room)}
        self.pending[room.code] = {}
        await self.send_state(room)

    async def leave_room(self, player_id: str) -> None:
        room = self.room_of_player(player_id)
        if room is None:
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
        if room is None or room.host_id != player_id or room.phase != "lobby":
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
        if room is None or room.host_id != player_id or room.phase != "lobby":
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
