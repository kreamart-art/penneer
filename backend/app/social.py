"""Pen Neer — accounts + social layer over the WebSocket.

Bridges the persistent Database (db.py) and the live connections: profile
management, friends, blocks, room invites, inbox, leaderboard, stats and
presence (who is online). Everything is optional: guests keep playing without
any of this. The RoomManager stays the authority on rooms; this class only
knows which ws belongs to which account and pushes inbox events in realtime.

Magic-link mail goes through Resend when RESEND_API_KEY is set; otherwise the
link is logged so local dev still works.
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Optional

from .db import get_db
from .models import PLAYER_COLORS

BASE_URL = os.environ.get("PENNEER_BASE_URL", "https://penneer.artnomad.nl")
WEEK = 7 * 24 * 3600

# Badge catalog: key -> (check function name). Copy lives in the frontend i18n.
BADGE_KEYS = [
    "eerste_game", "eerste_winst", "tien_games", "vijf_winsten",
    "hattrick", "woordenaar", "perfecte_ronde",
]


class AccountManager:
    def __init__(self) -> None:
        self.db = get_db()
        # Presence: ws-id -> user_id and user_id -> set of ws objects.
        self.ws_users: dict[int, str] = {}
        self.user_conns: dict[str, set[Any]] = {}

    # ---- presence -----------------------------------------------------------

    def online(self, user_id: str) -> bool:
        return bool(self.user_conns.get(user_id))

    def bind(self, ws: Any, user_id: str) -> None:
        self.ws_users[id(ws)] = user_id
        self.user_conns.setdefault(user_id, set()).add(ws)

    def unbind(self, ws: Any) -> None:
        uid = self.ws_users.pop(id(ws), None)
        if uid:
            conns = self.user_conns.get(uid)
            if conns:
                conns.discard(ws)
                if not conns:
                    self.user_conns.pop(uid, None)

    def user_of(self, ws: Any) -> Optional[str]:
        return self.ws_users.get(id(ws))

    async def _push(self, user_id: str, message: dict) -> None:
        for ws in list(self.user_conns.get(user_id, ())):
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def _send(self, ws: Any, message: dict) -> None:
        try:
            await ws.send_json(message)
        except Exception:
            pass

    # ---- public profile snippet ---------------------------------------------

    def _public(self, user: dict) -> dict:
        return {
            "id": user["id"],
            "name": user["name"],
            "color": user.get("color") or PLAYER_COLORS[0],
            "has_avatar": bool(user.get("has_avatar")),
            "avatar_ver": user.get("avatar_ver", 0),
            "online": self.online(user["id"]),
        }

    async def _account_payload(self, ws: Any, user_id: str) -> dict:
        user = self.db.get_user(user_id)
        if user is None:
            return {"type": "account", "account": None}
        return {
            "type": "account",
            "account": {
                **self._public(user),
                "email": user.get("email"),
                "stats": self.db.stats_of(user_id),
                "badges": self.db.badges_of(user_id),
                "inbox_count": len(self.db.inbox(user_id)),
            },
        }

    # ---- message handlers (called from ws.py) --------------------------------

    async def handle(self, ws: Any, mtype: str, data: dict) -> bool:
        """Route an account/social message. Returns True when handled."""
        handler = {
            "account_create": self.account_create,
            "account_login": self.account_login,
            "account_get": self.account_get,
            "account_update": self.account_update,
            "account_delete": self.account_delete,
            "account_link_email": self.account_link_email,
            "account_request_login": self.account_request_login,
            "account_redeem": self.account_redeem,
            "user_search": self.user_search,
            "profile_view": self.profile_view,
            "friends_list": self.friends_list,
            "friend_request": self.friend_request,
            "friend_respond": self.friend_respond,
            "friend_remove": self.friend_remove,
            "friend_block": self.friend_block,
            "blocked_list": self.blocked_list,
            "inbox_get": self.inbox_get,
            "invite_respond": self.invite_respond,
            "leaderboard_get": self.leaderboard_get,
        }.get(mtype)
        if handler is None:
            return False
        await handler(ws, data)
        return True

    async def account_create(self, ws: Any, data: dict) -> None:
        name = (data.get("name") or "").strip()
        color = data.get("color") or PLAYER_COLORS[0]
        res = self.db.create_user(name, color)
        if res is None:
            reason = "Naam is bezet of ongeldig." if self.db.valid_name(name) else "Kies een naam van 2 tot 20 letters."
            await self._send(ws, {"type": "error", "message": reason})
            return
        self.bind(ws, res["user_id"])
        payload = await self._account_payload(ws, res["user_id"])
        payload["token"] = res["token"]
        await self._send(ws, payload)

    async def account_login(self, ws: Any, data: dict) -> None:
        uid = self.db.auth(data.get("token") or "")
        if uid is None:
            await self._send(ws, {"type": "account", "account": None})
            return
        self.bind(ws, uid)
        await self._send(ws, await self._account_payload(ws, uid))
        await self._notify_friends_presence(uid)

    async def account_get(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if uid:
            await self._send(ws, await self._account_payload(ws, uid))

    async def account_update(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        if "name" in data:
            if not self.db.rename_user(uid, data["name"]):
                await self._send(ws, {"type": "error", "message": "Naam is bezet of ongeldig."})
                return
        if "color" in data:
            self.db.set_color(uid, data["color"])
        await self._send(ws, await self._account_payload(ws, uid))

    async def account_delete(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        self.db.delete_user(uid)
        self.unbind(ws)
        await self._send(ws, {"type": "account", "account": None, "deleted": True})

    async def account_link_email(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        if not self.db.set_email(uid, data.get("email") or ""):
            await self._send(ws, {"type": "error", "message": "Dit e-mailadres is ongeldig of al gekoppeld."})
            return
        await self._send(ws, await self._account_payload(ws, uid))

    async def account_request_login(self, ws: Any, data: dict) -> None:
        res = self.db.start_login(data.get("email") or "")
        # Same reply whether the email exists or not (no account probing).
        await self._send(ws, {"type": "login_link_sent"})
        if res is None:
            return
        _, code = res
        link = f"{BASE_URL}/?login={code}"
        asyncio.create_task(self._send_login_mail(data.get("email"), link))

    async def _send_login_mail(self, email: str, link: str) -> None:
        key = os.environ.get("RESEND_API_KEY")
        if not key:
            print(f"[penneer] magic link voor {email}: {link}", flush=True)
            return
        # Sender: needs a Resend-verified domain. Set PENNEER_MAIL_FROM to
        # "onboarding@resend.dev" to test immediately without verifying a domain
        # (that test sender only delivers to your own Resend account email).
        mail_from = os.environ.get("PENNEER_MAIL_FROM", "Pen Neer <penneer@artnomad.nl>")
        try:
            import httpx

            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {key}"},
                    json={
                        "from": mail_from,
                        "to": [email],
                        "subject": "Inloggen bij Pen Neer",
                        "text": "Log in op dit apparaat met deze link (15 minuten geldig):\n\n"
                                f"{link}\n\nNiet zelf aangevraagd? Negeer deze mail dan.",
                    },
                )
        except Exception as exc:
            print(f"[penneer] mail versturen mislukt: {exc}; link: {link}", flush=True)

    async def account_redeem(self, ws: Any, data: dict) -> None:
        res = self.db.finish_login(data.get("code") or "")
        if res is None:
            await self._send(ws, {"type": "error", "message": "Deze inloglink is verlopen of al gebruikt."})
            return
        self.bind(ws, res["user_id"])
        payload = await self._account_payload(ws, res["user_id"])
        payload["token"] = res["token"]
        await self._send(ws, payload)

    async def user_search(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        users = [u for u in self.db.find_users(data.get("query") or "") if u["id"] != uid]
        await self._send(ws, {"type": "user_search", "users": [self._public(u) for u in users]})

    async def profile_view(self, ws: Any, data: dict) -> None:
        target = self.db.get_user(data.get("user_id") or "")
        if target is None:
            await self._send(ws, {"type": "error", "message": "Deze speler bestaat niet meer."})
            return
        await self._send(ws, {
            "type": "profile",
            "profile": {
                **self._public(target),
                "stats": self.db.stats_of(target["id"]),
                "badges": self.db.badges_of(target["id"]),
            },
        })

    async def friends_list(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        friends = self.db.friends_of(uid)
        await self._send(ws, {
            "type": "friends",
            "friends": [{**self._public(f), "status": f["status"], "requested_by": f["requested_by"]} for f in friends],
        })

    async def friend_request(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        result = self.db.friend_request(uid, data.get("user_id") or "")
        await self.friends_list(ws, {})
        if result in ("sent", "accepted"):
            await self._push_inbox(data["user_id"])

    async def friend_respond(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        self.db.friend_respond(uid, data.get("user_id") or "", bool(data.get("accept")))
        await self.friends_list(ws, {})
        await self._push_inbox(uid)
        if data.get("accept"):
            await self._push_inbox(data["user_id"])

    async def friend_remove(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        self.db.friend_remove(uid, data.get("user_id") or "")
        await self.friends_list(ws, {})

    async def friend_block(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        if data.get("unblock"):
            self.db.unblock(uid, data.get("user_id") or "")
        else:
            self.db.block(uid, data.get("user_id") or "")
        await self.friends_list(ws, {})
        await self.blocked_list(ws, {})

    async def blocked_list(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        await self._send(ws, {"type": "blocked", "users": [self._public(u) for u in self.db.blocked_of(uid)]})

    async def inbox_get(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        await self._send(ws, {"type": "inbox", "items": self.db.inbox(uid)})

    async def invite_send(self, ws: Any, room_code: str, to_user: str, kind: str) -> None:
        """Called by the room layer (invite friends to my room / challenge)."""
        uid = self.user_of(ws)
        if not uid:
            await self._send(ws, {"type": "error", "message": "Maak eerst een profiel aan."})
            return
        inv = self.db.create_invite(uid, to_user, room_code, kind)
        if inv:
            await self._push_inbox(to_user)
        await self._send(ws, {"type": "invite_sent", "to_user": to_user})

    async def invite_respond(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        room = self.db.resolve_invite(uid, data.get("invite_id") or "", bool(data.get("accept")))
        await self._push_inbox(uid)
        if room:
            # The client joins the room itself with its own name/avatar.
            await self._send(ws, {"type": "invite_accepted", "room_code": room})

    async def leaderboard_get(self, ws: Any, data: dict) -> None:
        since = time.time() - WEEK if data.get("period") == "week" else 0.0
        rows = self.db.leaderboard(since=since)
        await self._send(ws, {
            "type": "leaderboard",
            "period": "week" if data.get("period") == "week" else "all",
            "rows": [{**self._public(r), "points": r["points"], "games": r["games"], "wins": r["wins"]} for r in rows],
        })

    # ---- realtime pushes ------------------------------------------------------

    async def _push_inbox(self, user_id: str) -> None:
        items = self.db.inbox(user_id)
        await self._push(user_id, {"type": "inbox", "items": items})

    async def _notify_friends_presence(self, user_id: str) -> None:
        """Tell online friends this user's presence changed."""
        for f in self.db.friends_of(user_id):
            if f["status"] == "accepted" and self.online(f["id"]):
                await self._push(f["id"], {"type": "presence", "user_id": user_id, "online": self.online(user_id)})

    async def dropped(self, ws: Any) -> None:
        uid = self.user_of(ws)
        self.unbind(ws)
        if uid and not self.online(uid):
            await self._notify_friends_presence(uid)

    # ---- game recording + badges ---------------------------------------------

    async def record_game(self, room, notify) -> None:
        """Store a finished game for account players and evaluate badges.
        `notify(user_id, badge_key)` is awaited for each newly earned badge."""
        history = room.history
        scores = room.scores or {}
        if not scores:
            return
        top = max(scores.values())
        players = []
        for p in room.players:
            uid = getattr(p, "user_id", None)
            if not uid or p.is_spectator:
                continue
            uniques = dubbels = 0
            perfect = False
            for rnd in history:
                pts = rnd.points.get(p.id, {})
                vals = list(pts.values())
                uniques += sum(1 for v in vals if v == 10)
                dubbels += sum(1 for v in vals if v == 5)
                if vals and all(v == 10 for v in vals):
                    perfect = True
            players.append({
                "user_id": uid, "score": scores.get(p.id, 0),
                "is_winner": scores.get(p.id, 0) == top,
                "uniques": uniques, "dubbels": dubbels, "_perfect": perfect,
            })
        if not players:
            return
        self.db.record_game(room.code, room.round_no, room.settings.lenient_spelling, players)
        for p in players:
            stats = self.db.stats_of(p["user_id"])
            earned = []
            def maybe(badge: str, cond: bool) -> None:
                if cond and self.db.grant_badge(p["user_id"], badge):
                    earned.append(badge)
            maybe("eerste_game", stats["games"] >= 1)
            maybe("eerste_winst", stats["wins"] >= 1)
            maybe("tien_games", stats["games"] >= 10)
            maybe("vijf_winsten", stats["wins"] >= 5)
            maybe("hattrick", stats["streak"] >= 3)
            maybe("woordenaar", stats["uniques"] >= 50)
            maybe("perfecte_ronde", p["_perfect"])
            for badge in earned:
                await notify(p["user_id"], badge)


# Singleton, mirroring RoomManager's lifetime.
accounts = AccountManager()
