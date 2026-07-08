"""Pen Neer — persistence layer (SQLite, stdlib sqlite3).

Everything account-related lives here: users, device tokens, magic-link login
codes, friendships, blocks, room invites, game history and badges. Rooms stay
in-memory (RoomManager); this database only holds what must survive a restart.

Single-process server, tiny queries: sync sqlite3 behind one lock is plenty.
WAL mode keeps readers and the writer out of each other's way. The DB path
comes from PENNEER_DB_PATH (prod: a Coolify persistent volume, e.g.
/data/penneer.db) and falls back to ./penneer.db for local dev.
"""
from __future__ import annotations

import hashlib
import os
import re
import secrets
import sqlite3
import threading
import time
from typing import Any, Optional

DB_PATH = os.environ.get("PENNEER_DB_PATH", "penneer.db")

NAME_RE = re.compile(r"^[A-Za-z0-9À-ÿ_\- ]{2,20}$")
# Small blunt blocklist for public profile names (substring match, lowercase).
NAME_BLOCKLIST = ("hitler", "nazi", "kanker", "neger", "faggot")

TOKEN_BYTES = 24
LOGIN_CODE_TTL = 15 * 60          # magic link valid for 15 minutes
INVITE_TTL = 60 * 60              # room invites expire after an hour
AVATAR_MAX_BYTES = 300_000        # client resizes to ~256px JPEG; hard cap here

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_lower TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    avatar BLOB,
    avatar_mime TEXT,
    avatar_ver INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#FFC23D',
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    last_seen REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS login_codes (
    code_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at REAL NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS friends (
    a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,             -- pending | accepted
    requested_by TEXT NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (a, b)                -- canonical: a < b
);
CREATE TABLE IF NOT EXISTS blocks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL NOT NULL,
    PRIMARY KEY (user_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_code TEXT NOT NULL,
    kind TEXT NOT NULL,               -- invite | challenge
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | declined
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    finished_at REAL NOT NULL,
    rounds INTEGER NOT NULL,
    lenient INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS game_players (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    is_winner INTEGER NOT NULL,
    uniques INTEGER NOT NULL DEFAULT 0,
    dubbels INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, user_id)
);
CREATE TABLE IF NOT EXISTS badges (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge TEXT NOT NULL,
    earned_at REAL NOT NULL,
    PRIMARY KEY (user_id, badge)
);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_games_finished ON games(finished_at);
CREATE INDEX IF NOT EXISTS idx_invites_to ON invites(to_user, status);
"""


def _hash(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def _new_id() -> str:
    return secrets.token_hex(12)


class Database:
    def __init__(self, path: str = DB_PATH) -> None:
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(
                "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;" + _SCHEMA
            )
            self._conn.commit()

    def _exec(self, sql: str, args: tuple = ()) -> sqlite3.Cursor:
        cur = self._conn.execute(sql, args)
        self._conn.commit()
        return cur

    def _q(self, sql: str, args: tuple = ()) -> list[sqlite3.Row]:
        return self._conn.execute(sql, args).fetchall()

    # ---- users / auth -------------------------------------------------------

    @staticmethod
    def valid_name(name: str) -> bool:
        n = (name or "").strip()
        if not NAME_RE.match(n):
            return False
        low = n.lower()
        return not any(bad in low for bad in NAME_BLOCKLIST)

    def create_user(self, name: str, color: str) -> Optional[dict]:
        """Create an account + first device token. None if the name is taken/bad."""
        name = (name or "").strip()
        if not self.valid_name(name):
            return None
        uid = _new_id()
        token = secrets.token_hex(TOKEN_BYTES)
        now = time.time()
        with self._lock:
            try:
                self._exec(
                    "INSERT INTO users (id, name, name_lower, color, created_at) VALUES (?,?,?,?,?)",
                    (uid, name, name.lower(), color, now),
                )
            except sqlite3.IntegrityError:
                return None  # name taken
            self._exec(
                "INSERT INTO tokens (token_hash, user_id, created_at, last_seen) VALUES (?,?,?,?)",
                (_hash(token), uid, now, now),
            )
        return {"user_id": uid, "token": token, "name": name}

    def auth(self, token: str) -> Optional[str]:
        """token -> user_id (updates last_seen)."""
        if not token:
            return None
        with self._lock:
            rows = self._q("SELECT user_id FROM tokens WHERE token_hash=?", (_hash(token),))
            if not rows:
                return None
            self._exec("UPDATE tokens SET last_seen=? WHERE token_hash=?", (time.time(), _hash(token)))
            return rows[0]["user_id"]

    def get_user(self, user_id: str) -> Optional[dict]:
        with self._lock:
            rows = self._q(
                "SELECT id, name, email, color, avatar_ver, avatar IS NOT NULL AS has_avatar, created_at "
                "FROM users WHERE id=?",
                (user_id,),
            )
        return dict(rows[0]) if rows else None

    def find_users(self, query: str, limit: int = 8) -> list[dict]:
        q = (query or "").strip().lower()
        if len(q) < 2:
            return []
        with self._lock:
            rows = self._q(
                "SELECT id, name, color, avatar_ver, avatar IS NOT NULL AS has_avatar "
                "FROM users WHERE name_lower LIKE ? ORDER BY name_lower LIMIT ?",
                (q + "%", limit),
            )
        return [dict(r) for r in rows]

    def rename_user(self, user_id: str, name: str) -> bool:
        name = (name or "").strip()
        if not self.valid_name(name):
            return False
        with self._lock:
            try:
                self._exec(
                    "UPDATE users SET name=?, name_lower=? WHERE id=?",
                    (name, name.lower(), user_id),
                )
                return True
            except sqlite3.IntegrityError:
                return False

    def set_color(self, user_id: str, color: str) -> None:
        if re.match(r"^#[0-9A-Fa-f]{6}$", color or ""):
            with self._lock:
                self._exec("UPDATE users SET color=? WHERE id=?", (color, user_id))

    def delete_user(self, user_id: str) -> None:
        with self._lock:
            self._exec("DELETE FROM users WHERE id=?", (user_id,))

    # ---- avatar -------------------------------------------------------------

    def set_avatar(self, user_id: str, data: bytes, mime: str) -> bool:
        if not data or len(data) > AVATAR_MAX_BYTES or mime not in ("image/jpeg", "image/png", "image/webp"):
            return False
        with self._lock:
            self._exec(
                "UPDATE users SET avatar=?, avatar_mime=?, avatar_ver=avatar_ver+1 WHERE id=?",
                (data, mime, user_id),
            )
        return True

    def clear_avatar(self, user_id: str) -> None:
        with self._lock:
            self._exec(
                "UPDATE users SET avatar=NULL, avatar_mime=NULL, avatar_ver=avatar_ver+1 WHERE id=?",
                (user_id,),
            )

    def get_avatar(self, user_id: str) -> Optional[tuple[bytes, str]]:
        with self._lock:
            rows = self._q("SELECT avatar, avatar_mime FROM users WHERE id=?", (user_id,))
        if rows and rows[0]["avatar"]:
            return (rows[0]["avatar"], rows[0]["avatar_mime"] or "image/jpeg")
        return None

    # ---- email + magic link -------------------------------------------------

    def set_email(self, user_id: str, email: str) -> bool:
        email = (email or "").strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            return False
        with self._lock:
            try:
                self._exec("UPDATE users SET email=? WHERE id=?", (email, user_id))
                return True
            except sqlite3.IntegrityError:
                return False  # e-mail already linked to another account

    def start_login(self, email: str) -> Optional[tuple[str, str]]:
        """Request a magic-link code for the account behind this email.
        Returns (user_id, plain_code) or None if the email is unknown."""
        email = (email or "").strip().lower()
        with self._lock:
            rows = self._q("SELECT id FROM users WHERE email=?", (email,))
            if not rows:
                return None
            code = secrets.token_urlsafe(24)
            self._exec(
                "INSERT INTO login_codes (code_hash, user_id, expires_at) VALUES (?,?,?)",
                (_hash(code), rows[0]["id"], time.time() + LOGIN_CODE_TTL),
            )
            return (rows[0]["id"], code)

    def finish_login(self, code: str) -> Optional[dict]:
        """Redeem a one-time magic-link code -> fresh device token."""
        with self._lock:
            rows = self._q(
                "SELECT user_id FROM login_codes WHERE code_hash=? AND used=0 AND expires_at>?",
                (_hash(code), time.time()),
            )
            if not rows:
                return None
            uid = rows[0]["user_id"]
            self._exec("UPDATE login_codes SET used=1 WHERE code_hash=?", (_hash(code),))
            token = secrets.token_hex(TOKEN_BYTES)
            now = time.time()
            self._exec(
                "INSERT INTO tokens (token_hash, user_id, created_at, last_seen) VALUES (?,?,?,?)",
                (_hash(token), uid, now, now),
            )
            return {"user_id": uid, "token": token}

    # ---- friends / blocks ---------------------------------------------------

    @staticmethod
    def _pair(u1: str, u2: str) -> tuple[str, str]:
        return (u1, u2) if u1 < u2 else (u2, u1)

    def is_blocked(self, u1: str, u2: str) -> bool:
        with self._lock:
            rows = self._q(
                "SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)",
                (u1, u2, u2, u1),
            )
        return bool(rows)

    def friend_request(self, from_id: str, to_id: str) -> str:
        """Returns: 'sent' | 'accepted' (they had already asked you) | 'exists' | 'blocked' | 'invalid'."""
        if from_id == to_id or not self.get_user(to_id):
            return "invalid"
        if self.is_blocked(from_id, to_id):
            return "blocked"
        a, b = self._pair(from_id, to_id)
        with self._lock:
            rows = self._q("SELECT status, requested_by FROM friends WHERE a=? AND b=?", (a, b))
            if rows:
                if rows[0]["status"] == "accepted":
                    return "exists"
                if rows[0]["requested_by"] != from_id:
                    # They asked first: this request accepts it.
                    self._exec("UPDATE friends SET status='accepted' WHERE a=? AND b=?", (a, b))
                    return "accepted"
                return "exists"  # duplicate pending request
            self._exec(
                "INSERT INTO friends (a, b, status, requested_by, created_at) VALUES (?,?,?,?,?)",
                (a, b, "pending", from_id, time.time()),
            )
            return "sent"

    def friend_respond(self, user_id: str, other_id: str, accept: bool) -> bool:
        a, b = self._pair(user_id, other_id)
        with self._lock:
            rows = self._q(
                "SELECT 1 FROM friends WHERE a=? AND b=? AND status='pending' AND requested_by=?",
                (a, b, other_id),
            )
            if not rows:
                return False
            if accept:
                self._exec("UPDATE friends SET status='accepted' WHERE a=? AND b=?", (a, b))
            else:
                self._exec("DELETE FROM friends WHERE a=? AND b=?", (a, b))
            return True

    def friend_remove(self, user_id: str, other_id: str) -> None:
        a, b = self._pair(user_id, other_id)
        with self._lock:
            self._exec("DELETE FROM friends WHERE a=? AND b=?", (a, b))

    def block(self, user_id: str, other_id: str) -> None:
        self.friend_remove(user_id, other_id)
        with self._lock:
            self._exec(
                "INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?,?,?)",
                (user_id, other_id, time.time()),
            )

    def unblock(self, user_id: str, other_id: str) -> None:
        with self._lock:
            self._exec("DELETE FROM blocks WHERE user_id=? AND blocked_id=?", (user_id, other_id))

    def friends_of(self, user_id: str) -> list[dict]:
        """Accepted friends + pending requests (both directions)."""
        with self._lock:
            rows = self._q(
                """
                SELECT u.id, u.name, u.color, u.avatar_ver, u.avatar IS NOT NULL AS has_avatar,
                       f.status, f.requested_by
                FROM friends f
                JOIN users u ON u.id = CASE WHEN f.a=? THEN f.b ELSE f.a END
                WHERE f.a=? OR f.b=?
                ORDER BY f.status, u.name_lower
                """,
                (user_id, user_id, user_id),
            )
        return [dict(r) for r in rows]

    # ---- invites ------------------------------------------------------------

    def create_invite(self, from_user: str, to_user: str, room_code: str, kind: str) -> Optional[dict]:
        if self.is_blocked(from_user, to_user):
            return None
        iid = _new_id()
        now = time.time()
        with self._lock:
            # One live invite per sender/receiver/room; refresh instead of stacking.
            self._exec(
                "DELETE FROM invites WHERE from_user=? AND to_user=? AND room_code=? AND status='pending'",
                (from_user, to_user, room_code),
            )
            self._exec(
                "INSERT INTO invites (id, from_user, to_user, room_code, kind, created_at) VALUES (?,?,?,?,?,?)",
                (iid, from_user, to_user, room_code, kind, now),
            )
        return {"id": iid, "from_user": from_user, "to_user": to_user, "room_code": room_code, "kind": kind, "created_at": now}

    def inbox(self, user_id: str) -> list[dict]:
        """Pending invites for this user (fresh ones only) + pending friend requests."""
        cutoff = time.time() - INVITE_TTL
        with self._lock:
            self._exec("DELETE FROM invites WHERE status='pending' AND created_at<?", (cutoff,))
            inv = self._q(
                """
                SELECT i.id, i.room_code, i.kind, i.created_at,
                       u.id AS from_id, u.name AS from_name, u.color AS from_color,
                       u.avatar_ver, u.avatar IS NOT NULL AS has_avatar
                FROM invites i JOIN users u ON u.id=i.from_user
                WHERE i.to_user=? AND i.status='pending'
                ORDER BY i.created_at DESC
                """,
                (user_id,),
            )
            reqs = self._q(
                """
                SELECT u.id AS from_id, u.name AS from_name, u.color AS from_color,
                       u.avatar_ver, u.avatar IS NOT NULL AS has_avatar, f.created_at
                FROM friends f
                JOIN users u ON u.id = f.requested_by
                WHERE (f.a=? OR f.b=?) AND f.status='pending' AND f.requested_by<>?
                ORDER BY f.created_at DESC
                """,
                (user_id, user_id, user_id),
            )
        items = [{**dict(r), "type": r["kind"]} for r in inv]
        items += [{**dict(r), "type": "friend_request"} for r in reqs]
        items.sort(key=lambda x: -x["created_at"])
        return items

    def resolve_invite(self, user_id: str, invite_id: str, accept: bool) -> Optional[str]:
        """Mark an invite handled. Returns the room code on accept."""
        with self._lock:
            rows = self._q(
                "SELECT room_code FROM invites WHERE id=? AND to_user=? AND status='pending'",
                (invite_id, user_id),
            )
            if not rows:
                return None
            self._exec(
                "UPDATE invites SET status=? WHERE id=?",
                ("accepted" if accept else "declined", invite_id),
            )
            return rows[0]["room_code"] if accept else None

    # ---- games / stats / badges --------------------------------------------

    def record_game(
        self,
        room_code: str,
        rounds: int,
        lenient: bool,
        players: list[dict],  # {user_id, score, is_winner, uniques, dubbels}
    ) -> Optional[str]:
        """Store a finished game for the account players. None if no accounts."""
        players = [p for p in players if p.get("user_id")]
        if not players:
            return None
        gid = _new_id()
        with self._lock:
            self._exec(
                "INSERT INTO games (id, room_code, finished_at, rounds, lenient) VALUES (?,?,?,?,?)",
                (gid, room_code, time.time(), rounds, int(lenient)),
            )
            for p in players:
                self._exec(
                    "INSERT OR REPLACE INTO game_players (game_id, user_id, score, is_winner, uniques, dubbels) "
                    "VALUES (?,?,?,?,?,?)",
                    (gid, p["user_id"], p["score"], int(p["is_winner"]), p.get("uniques", 0), p.get("dubbels", 0)),
                )
        return gid

    def stats_of(self, user_id: str) -> dict:
        with self._lock:
            rows = self._q(
                """
                SELECT COUNT(*) AS games, COALESCE(SUM(is_winner),0) AS wins,
                       COALESCE(SUM(score),0) AS points, COALESCE(MAX(score),0) AS best,
                       COALESCE(SUM(uniques),0) AS uniques, COALESCE(SUM(dubbels),0) AS dubbels
                FROM game_players WHERE user_id=?
                """,
                (user_id,),
            )
            streak_rows = self._q(
                """
                SELECT gp.is_winner FROM game_players gp
                JOIN games g ON g.id=gp.game_id
                WHERE gp.user_id=? ORDER BY g.finished_at DESC LIMIT 25
                """,
                (user_id,),
            )
        streak = 0
        for r in streak_rows:
            if r["is_winner"]:
                streak += 1
            else:
                break
        out = dict(rows[0])
        out["streak"] = streak
        return out

    def leaderboard(self, since: float = 0.0, limit: int = 25) -> list[dict]:
        with self._lock:
            rows = self._q(
                """
                SELECT u.id, u.name, u.color, u.avatar_ver, u.avatar IS NOT NULL AS has_avatar,
                       COALESCE(SUM(gp.score),0) AS points, COUNT(*) AS games,
                       COALESCE(SUM(gp.is_winner),0) AS wins
                FROM game_players gp
                JOIN games g ON g.id=gp.game_id
                JOIN users u ON u.id=gp.user_id
                WHERE g.finished_at >= ?
                GROUP BY u.id ORDER BY points DESC, wins DESC LIMIT ?
                """,
                (since, limit),
            )
        return [dict(r) for r in rows]

    def grant_badge(self, user_id: str, badge: str) -> bool:
        """True if newly earned."""
        with self._lock:
            cur = self._exec(
                "INSERT OR IGNORE INTO badges (user_id, badge, earned_at) VALUES (?,?,?)",
                (user_id, badge, time.time()),
            )
            return cur.rowcount > 0

    def badges_of(self, user_id: str) -> list[dict]:
        with self._lock:
            rows = self._q(
                "SELECT badge, earned_at FROM badges WHERE user_id=? ORDER BY earned_at",
                (user_id,),
            )
        return [dict(r) for r in rows]


# Module-level singleton, created lazily so tests can use their own path.
_db: Optional[Database] = None


def get_db() -> Database:
    global _db
    if _db is None:
        _db = Database()
    return _db
