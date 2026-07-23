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

from . import daily, missions, push, titles
from .db import get_db, LEVEL_BUZZERS, BUZZER_SKIN_IDS, LEVEL_FOR_BUZZER
from .models import PLAYER_COLORS

BASE_URL = os.environ.get("PENNEER_BASE_URL", "https://penneer.artnomad.nl")
WEEK = 7 * 24 * 3600

# Level curve: xp is earned from points, wins and games; level n starts at
# 50*n*(n-1) xp (L2=100, L3=300, L4=600, ...). Ranks are named tiers by level;
# the client localizes the rank key.
RANKS = [(20, "legende"), (16, "categoriekoning"), (12, "lettermeester"),
         (9, "woordsmid"), (6, "woordjager"), (4, "pennenlikker"),
         (2, "krabbelaar"), (1, "beginneling")]


def _xp_of(stats: dict) -> int:
    # Match XP derives from stats; bonus_xp is the stored mission-reward pot.
    return int(
        stats.get("points", 0)
        + 40 * stats.get("wins", 0)
        + 15 * stats.get("games", 0)
        + stats.get("bonus_xp", 0)
    )


def _level_of(stats: dict) -> dict:
    xp = _xp_of(stats)
    level = 1
    while 50 * level * (level + 1) <= xp and level < 99:
        level += 1
    start = 50 * (level - 1) * level
    nxt = 50 * level * (level + 1)
    rank = next(key for minlvl, key in RANKS if level >= minlvl)
    return {"level": level, "xp": xp, "level_start": start, "next_level": nxt, "rank": rank}

# Badge catalog: key -> (check function name). Copy lives in the frontend i18n.
BADGE_KEYS = [
    "eerste_game", "eerste_winst", "tien_games", "vijfentwintig_games",
    "vijf_winsten", "tien_winsten", "hattrick", "woordenaar",
    "perfecte_ronde", "comeback", "durfal", "eerste_vriend", "eerste_bericht",
    "seizoenswinnaar",
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

    def _allowed_buzzers(self, user: dict, level: int) -> set:
        """Skins this account may select: the paid pack (if owned) plus every
        level-reward skin whose milestone the account has reached."""
        allowed = set()
        if user.get("buzzer_skins"):
            allowed |= set(BUZZER_SKIN_IDS)
        allowed |= {skin for lvl, skin, _ in LEVEL_BUZZERS if level >= lvl}
        return allowed

    async def _account_payload(self, ws: Any, user_id: str) -> dict:
        user = self.db.get_user(user_id)
        if user is None:
            return {"type": "account", "account": None}
        stats = self.db.stats_of(user_id)
        level = _level_of(stats)
        # Coins: earn 1 per level reached (retroactive), then surface balance +
        # how many are new since the last coin popup was seen.
        coins = self.db.credit_level_coins(user_id, level["level"])
        coins_pending = self.db.coins_owed(level["level"]) - self.db.coins_owed(user.get("coins_seen_level", 0))
        badges = self.db.badges_of(user_id)
        unlocked = set(titles.unlocked_for(stats, badges, level["level"]))
        chosen = user.get("title")
        if chosen not in unlocked:  # a title that is no longer valid falls back to rank
            chosen = None
        return {
            "type": "account",
            "account": {
                **self._public(user),
                "email": user.get("email"),
                "avatar_preset": user.get("avatar_preset"),
                "ai_unlocked": bool(user.get("ai_unlocked")),
                "premium_avatars": bool(user.get("premium_avatars")),
                "buzzer_skins": bool(user.get("buzzer_skins")),
                "buzzer_skin": user.get("buzzer_skin"),
                "buzzer_rewards": [
                    {"skin": skin, "level": lvl, "name": key,
                     "unlocked": level["level"] >= lvl,
                     "claimed": skin in self.db.level_rewards_claimed(user_id)}
                    for lvl, skin, key in LEVEL_BUZZERS
                ],
                "coins": coins,
                "coins_pending": coins_pending,
                "coins_pack_price": self.db.BUZZER_PACK_COINS,
                "stats": stats,
                "level": level,
                "badges": badges,
                "title": chosen,
                "titles": [{"key": k, "unlocked": k in unlocked} for k in titles.ALL_KEYS],
                "club": self.db.club_of(user_id),
                "lenient_spelling": bool(user.get("lenient_spelling")),
                "inbox_count": len(self.db.inbox(user_id)),
                "dm_unread": self.db.dm_unread_total(user_id),
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
            "shop_redeem": self.shop_redeem,
            "user_search": self.user_search,
            "profile_view": self.profile_view,
            "history_get": self.history_get,
            "dm_send": self.dm_send,
            "dm_thread": self.dm_thread,
            "dm_threads": self.dm_threads,
            "friends_list": self.friends_list,
            "friend_request": self.friend_request,
            "friend_respond": self.friend_respond,
            "friend_remove": self.friend_remove,
            "friend_block": self.friend_block,
            "blocked_list": self.blocked_list,
            "inbox_get": self.inbox_get,
            "invite_respond": self.invite_respond,
            "leaderboard_get": self.leaderboard_get,
            "club_create": self.club_create,
            "club_join": self.club_join,
            "club_leave": self.club_leave,
            "club_get": self.club_get,
            "set_lenient": self.set_lenient,
            "set_buzzer_skin": self.set_buzzer_skin,
            "claim_buzzer_reward": self.claim_buzzer_reward,
            "buy_buzzer_pack_coins": self.buy_buzzer_pack_coins,
            "ack_coin_reward": self.ack_coin_reward,
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
        self.db.ensure_avatar(uid)  # backfill a default avatar for old accounts
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
        if "title" in data:
            # Empty string clears (back to the rank label). Any other value must
            # be a currently-unlocked title, else it is ignored.
            want = data["title"] or None
            if want is None:
                self.db.set_title(uid, None)
            else:
                stats = self.db.stats_of(uid)
                unlocked = titles.unlocked_for(stats, self.db.badges_of(uid), _level_of(stats)["level"])
                if want in unlocked:
                    self.db.set_title(uid, want)
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
        self.db.ensure_avatar(res["user_id"])
        self.bind(ws, res["user_id"])
        payload = await self._account_payload(ws, res["user_id"])
        payload["token"] = res["token"]
        await self._send(ws, payload)

    async def shop_redeem(self, ws: Any, data: dict) -> None:
        """Redeem a shop unlock code for the logged-in account (AI only, never
        admin). Sends a shop_result and, on success, the refreshed account."""
        uid = self.user_of(ws)
        if not uid:
            await self._send(ws, {"type": "shop_result", "ok": False, "reason": "auth"})
            return
        result = self.db.redeem_ai_code(uid, data.get("code") or "")
        ok = result in ("ok", "already")
        await self._send(ws, {"type": "shop_result", "ok": ok, "reason": result})
        if ok:
            await self._send(ws, await self._account_payload(ws, uid))

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
        stats = self.db.stats_of(target["id"])
        viewer = self.user_of(ws)
        # Head-to-head: the viewer against this profile (games played together).
        h2h = None
        if viewer and viewer != target["id"]:
            h = self.db.head_to_head(viewer, target["id"])
            if h["games"] > 0:
                h2h = h
        await self._send(ws, {
            "type": "profile",
            "profile": {
                **self._public(target),
                "stats": stats,
                "level": _level_of(stats),
                "badges": self.db.badges_of(target["id"]),
                "is_friend": bool(viewer and self.db.is_friend(viewer, target["id"])),
                "h2h": h2h,
            },
        })

    async def history_get(self, ws: Any, data: dict) -> None:
        """The logged-in player's own recent games ("Laatste potjes")."""
        uid = self.user_of(ws)
        if not uid:
            return
        await self._send(ws, {"type": "history", "games": self.db.history_of(uid)})

    # ---- direct messages (profile-to-profile, outside any room) --------------

    async def dm_send(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        to = data.get("user_id") or ""
        if not uid:
            return
        # Friends only, and blocks win from either side.
        if not self.db.is_friend(uid, to) or self.db.is_blocked(uid, to):
            await self._send(ws, {"type": "error", "message": "Je kunt alleen vrienden een bericht sturen."})
            return
        msg = self.db.dm_send(
            uid, to, data.get("text") or "",
            voice_id=data.get("voice_id") or None,
            voice_dur=int(data.get("voice_dur") or 0),
        )
        if msg is None:
            return
        # Social badge: your very first message.
        if self.db.grant_badge(uid, "eerste_bericht"):
            await self._push_account(uid)
        payload = {"type": "dm", "message": msg}
        await self._push(uid, payload)
        await self._push(to, payload)
        # Real push when the recipient has no live connection (app closed).
        if not self.online(to):
            sender = self.db.get_user(uid)
            preview = "Spraakbericht" if msg.get("voice_id") else msg["text"][:120]
            asyncio.create_task(push.notify(
                to, "Pen Neer",
                f"{sender['name'] if sender else 'Iemand'}: {preview}",
                tag=f"dm-{uid}",
            ))

    async def dm_thread(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        other = data.get("user_id") or ""
        if not uid or not other:
            return
        messages = self.db.dm_thread(uid, other)
        await self._send(ws, {"type": "dm_thread", "user_id": other, "messages": messages})

    async def dm_threads(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        threads = self.db.dm_threads(uid)
        # Decorate with the partner's public profile so the list can render.
        out = []
        for t in threads:
            u = self.db.get_user(t["partner"])
            if u:
                out.append({**t, "user": self._public(u)})
        await self._send(ws, {"type": "dm_threads", "threads": out})

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
            if result == "sent" and not self.online(data["user_id"]):
                me = self.db.get_user(uid)
                asyncio.create_task(push.notify(
                    data["user_id"], "Pen Neer",
                    f"{me['name'] if me else 'Iemand'} wil je vriend worden",
                    tag="friend",
                ))

    async def friend_respond(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        other = data.get("user_id") or ""
        self.db.friend_respond(uid, other, bool(data.get("accept")))
        await self.friends_list(ws, {})
        await self._push_inbox(uid)
        if data.get("accept"):
            await self._push_inbox(other)
            # Social badge: your very first friend, on both sides.
            for user in (uid, other):
                if self.db.is_friend(uid, other) and self.db.grant_badge(user, "eerste_vriend"):
                    await self._push_account(user)

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
            if not self.online(to_user):
                me = self.db.get_user(uid)
                naam = me["name"] if me else "Iemand"
                body = (
                    f"{naam} daagt je uit voor een potje" if kind == "challenge"
                    else f"{naam} nodigt je uit voor room {room_code}"
                )
                asyncio.create_task(push.notify(to_user, "Pen Neer", body, tag="invite"))
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

    @staticmethod
    def _month_start(dt: "datetime.datetime") -> float:
        import datetime

        return datetime.datetime(dt.year, dt.month, 1).timestamp()

    async def _maybe_award_season(self) -> None:
        """Season prize, awarded lazily: the first leaderboard request in a new
        month crowns last month's number 1 with the seizoenswinnaar badge. The
        meta key makes this exactly-once, restart-safe."""
        import datetime

        now = datetime.datetime.now()
        prev_last_day = datetime.datetime(now.year, now.month, 1) - datetime.timedelta(days=1)
        key = f"season_awarded_{prev_last_day.year}-{prev_last_day.month:02d}"
        if self.db.meta_get(key) is not None:
            return
        prev_start = self._month_start(prev_last_day)
        cur_start = self._month_start(now)
        rows = self.db.leaderboard(since=prev_start, until=cur_start, limit=1)
        if rows:
            winner = rows[0]["id"]
            self.db.meta_set(key, winner)
            if self.db.grant_badge(winner, "seizoenswinnaar"):
                await self._push_account(winner)
        else:
            self.db.meta_set(key, "none")

    async def leaderboard_get(self, ws: Any, data: dict) -> None:
        await self._maybe_award_season()
        import datetime

        period = data.get("period")
        if period == "week":
            since, until = time.time() - WEEK, None
        elif period == "month":
            since, until = self._month_start(datetime.datetime.now()), None
        else:
            period = "all"
            since, until = 0.0, None
        rows = self.db.leaderboard(since=since, until=until)
        await self._send(ws, {
            "type": "leaderboard",
            "period": period,
            "rows": [{**self._public(r), "points": r["points"], "games": r["games"], "wins": r["wins"]} for r in rows],
        })

    # ---- realtime pushes ------------------------------------------------------

    async def _push_inbox(self, user_id: str) -> None:
        items = self.db.inbox(user_id)
        await self._push(user_id, {"type": "inbox", "items": items})

    # ---- clubs ---------------------------------------------------------------

    def _club_payload(self, user_id: str, period: str) -> dict:
        import datetime

        club = self.db.club_of(user_id)
        if not club:
            return {"type": "club", "club": None, "period": "month", "members": []}
        if period == "month":
            since: float = self._month_start(datetime.datetime.now())
        else:
            period = "all"
            since = 0.0
        rows = self.db.club_ranked(club["id"], since=since)
        members = [
            {**self._public(r), "points": r["points"], "games": r["games"], "wins": r["wins"], "is_owner": bool(r["is_owner"])}
            for r in rows
        ]
        return {"type": "club", "club": club, "period": period, "members": members}

    async def club_create(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        club = self.db.create_club(uid, data.get("name") or "")
        if club is None:
            await self._send(ws, {"type": "error", "message": "Kies een clubnaam van 2 tot 24 tekens, of verlaat eerst je huidige club."})
            return
        await self._send(ws, await self._account_payload(ws, uid))
        await self._send(ws, self._club_payload(uid, data.get("period") or "month"))

    async def club_join(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        club, reason = self.db.join_club(uid, data.get("code") or "")
        if club is None:
            msg = {
                "already_in_club": "Je zit al in een club. Verlaat die eerst.",
                "no_club": "Geen club met deze code.",
                "club_full": "Deze club zit vol.",
            }.get(reason, "Kon niet lid worden.")
            await self._send(ws, {"type": "error", "message": msg})
            return
        await self._send(ws, await self._account_payload(ws, uid))
        await self._send(ws, self._club_payload(uid, data.get("period") or "month"))

    async def club_leave(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        self.db.leave_club(uid)
        await self._send(ws, await self._account_payload(ws, uid))
        await self._send(ws, {"type": "club", "club": None, "period": "month", "members": []})

    async def club_get(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        await self._send(ws, self._club_payload(uid, data.get("period") or "month"))

    async def set_lenient(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        self.db.set_lenient(uid, bool(data.get("on")))
        await self._send(ws, await self._account_payload(ws, uid))

    async def set_buzzer_skin(self, ws: Any, data: dict) -> None:
        uid = self.user_of(ws)
        if not uid:
            return
        skin = data.get("skin")
        skin = skin if isinstance(skin, str) and skin else None
        user = self.db.get_user(uid)
        level = _level_of(self.db.stats_of(uid))["level"]
        self.db.set_buzzer_skin(uid, skin, self._allowed_buzzers(user, level))
        await self._send(ws, await self._account_payload(ws, uid))

    async def claim_buzzer_reward(self, ws: Any, data: dict) -> None:
        """Acknowledge a level-reward buzzer (the victory popup's Claim button).
        Only marks a reward the account has actually reached; optionally selects
        it as the active buzzer right away."""
        uid = self.user_of(ws)
        if not uid:
            return
        skin = data.get("skin")
        if not isinstance(skin, str) or skin not in LEVEL_FOR_BUZZER:
            return
        level = _level_of(self.db.stats_of(uid))["level"]
        if level < LEVEL_FOR_BUZZER[skin]:
            return  # not actually reached; ignore
        self.db.claim_level_reward(uid, skin)
        if data.get("equip"):
            user = self.db.get_user(uid)
            self.db.set_buzzer_skin(uid, skin, self._allowed_buzzers(user, level))
        await self._send(ws, await self._account_payload(ws, uid))

    async def buy_buzzer_pack_coins(self, ws: Any, data: dict) -> None:
        """Spend coins to unlock the country buzzer pack."""
        uid = self.user_of(ws)
        if not uid:
            return
        result = self.db.buy_buzzer_pack_coins(uid)
        await self._send(ws, {"type": "coins_result", "ok": result == "ok", "reason": result})
        await self._send(ws, await self._account_payload(ws, uid))

    async def ack_coin_reward(self, ws: Any, data: dict) -> None:
        """The coin victory popup was seen up to the given level."""
        uid = self.user_of(ws)
        if not uid:
            return
        try:
            lvl = int(data.get("level") or 0)
        except (TypeError, ValueError):
            return
        self.db.ack_coin_reward(uid, lvl)
        await self._send(ws, await self._account_payload(ws, uid))

    async def _push_account(self, user_id: str) -> None:
        """Send the fresh account payload to every live connection of a user
        (e.g. after an out-of-game badge grant)."""
        await self._push(user_id, await self._account_payload(None, user_id))

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
        # A game with any bot is casual: never recorded, so bots give no stats,
        # XP, missions, badges, leaderboard or ceremony. This keeps titles and
        # levels farm-proof while letting anyone play a full game solo.
        if any(getattr(p, "is_bot", False) for p in room.players):
            return
        top = max(scores.values())

        # Halfway standings across ALL playing players (guests included), for
        # the comeback badge: last at the half, winner at the end.
        playing_ids = [p.id for p in room.players if not p.is_spectator]
        halfway_last: set[str] = set()
        if room.round_no >= 2 and len(playing_ids) >= 2:
            half = room.round_no // 2
            totals = {pid: 0 for pid in playing_ids}
            for rnd in history[:half]:
                for pid in playing_ids:
                    totals[pid] += sum(rnd.points.get(pid, {}).values())
            low = min(totals.values())
            halfway_last = {pid for pid, v in totals.items() if v == low}

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
            is_winner = scores.get(p.id, 0) == top
            players.append({
                "user_id": uid, "score": scores.get(p.id, 0),
                "is_winner": is_winner,
                "uniques": uniques, "dubbels": dubbels, "_perfect": perfect,
                "_comeback": is_winner and p.id in halfway_last,
            })
        if not players:
            return
        # Snapshot the level BEFORE recording, so the post-match ceremony can
        # animate from the exact pre-game state.
        before = {p["user_id"]: _level_of(self.db.stats_of(p["user_id"])) for p in players}
        playing_count = len(playing_ids)
        day = daily.today()
        active = missions.active_keys(day)
        self.db.record_game(room.code, room.round_no, room.settings.lenient_spelling, players)
        for p in players:
            uid = p["user_id"]
            stats = self.db.stats_of(uid)
            earned = []
            def maybe(badge: str, cond: bool) -> None:
                if cond and self.db.grant_badge(uid, badge):
                    earned.append(badge)
            maybe("eerste_game", stats["games"] >= 1)
            maybe("eerste_winst", stats["wins"] >= 1)
            maybe("tien_games", stats["games"] >= 10)
            maybe("vijfentwintig_games", stats["games"] >= 25)
            maybe("vijf_winsten", stats["wins"] >= 5)
            maybe("tien_winsten", stats["wins"] >= 10)
            maybe("hattrick", stats["streak"] >= 3)
            maybe("woordenaar", stats["uniques"] >= 50)
            maybe("comeback", p["_comeback"])
            maybe("durfal", p["is_winner"] and room.settings.hard_letters)
            maybe("perfecte_ronde", p["_perfect"])
            for badge in earned:
                await notify(uid, badge)
            # Missions: only today's active three ever get progress.
            missions_done = []
            def bump(key: str, inc: int) -> None:
                if key not in active or inc <= 0:
                    return
                target, reward = missions.spec(key)
                if self.db.mission_bump(uid, day, key, inc, target, reward):
                    missions_done.append({"key": key, "reward": reward})
            bump("play_game", 1)
            bump("win_game", 1 if p["is_winner"] else 0)
            bump("unique5", p.get("uniques", 0))
            bump("dubbel3", p.get("dubbels", 0))
            bump("multi3", 1 if playing_count >= 3 else 0)
            # Ceremony payload: exact XP delta (game + mission rewards), level
            # and rank before/after, plus what was earned this match.
            after = _level_of(self.db.stats_of(uid))
            await self._push(uid, {
                "type": "match_summary",
                "won": bool(p["is_winner"]),
                "xp_gained": max(0, after["xp"] - before[uid]["xp"]),
                "level_before": before[uid],
                "level_after": after,
                "badges": earned,
                "missions_done": missions_done,
            })


# Singleton, mirroring RoomManager's lifetime.
accounts = AccountManager()
