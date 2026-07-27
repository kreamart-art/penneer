"""Pen Neer — FastAPI entrypoint.

Serves the WebSocket game endpoint and, in production, the built frontend as
static files. CORS is open in dev so Vite (5173) can reach the API.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import ai_referee, daily, duel, game, missions, paypal, push
from .db import AVATAR_MAX_BYTES, get_db
from .social import accounts
from .ws import manager, router as ws_router

app = FastAPI(title="Pen Neer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


@app.post("/api/debug/viewport")
async def debug_viewport(request: Request) -> Response:
    """Meetlijn voor de iOS-PWA launch-bug (de balk die te hoog start).

    De app kan op een echte iPhone niet gedebugd worden vanaf deze kant, dus
    stuurt standalone iOS zijn viewport-cijfers hierheen en lezen we ze uit de
    containerlogs. Tijdelijk; mag weg zodra de oorzaak vaststaat."""
    try:
        body = await request.json()
    except Exception:
        return Response(status_code=204)
    keep = {k: body.get(k) for k in ("tag", "inner", "client", "visual", "screen", "dpr", "scrollY")}
    print(f"[viewport] {keep} ua={str(body.get('ua'))[:80]}", flush=True)
    return Response(status_code=204)


@app.on_event("startup")
async def _load_custom_categories() -> None:
    """Woordenlijsten van admin-categorieen weer in het spel hangen na een
    herstart, anders scoort zo'n categorie ineens letter-only."""
    db = get_db()
    n = 0
    for cat in db.category_list():
        words = db.parse_words(cat["words"])
        if words:
            game.register_category(cat["name"], words)
            n += 1
    if n:
        print(f"[penneer] {n} eigen categorie(en) met woordenlijst geladen", flush=True)


@app.get("/api/categories")
async def categories_get(request: Request) -> JSONResponse:
    """Eigen categorieen voor de winkel en de lobby: wat er is, wat het kost en
    wat JIJ mag aanzetten (gratis, gekocht, of zelf gemaakt)."""
    db = get_db()
    uid = db.auth(_bearer(request))
    owned = db.owned_items_of(uid) if uid else set()
    return JSONResponse({
        "categories": [
            {
                "id": c["id"],
                "name": c["name"],
                "price": int(c["price"]),
                "checked": bool(db.parse_words(c["words"])),
                "owned": c["price"] == 0 or f"{db.CATEGORY_ITEM}{c['id']}" in owned,
            }
            for c in db.category_list()
        ],
    })


@app.on_event("startup")
async def _seed_rarity_table() -> None:
    """Cold start for Duel: fold the stored dagronde answers into the rarity
    table once, so the very first duel is judged against real player answers
    instead of an empty table."""
    n = get_db().answer_seed_from_daily()
    if n:
        print(f"[penneer] zeldzaamheidstabel gevuld met {n} dagronde-antwoorden", flush=True)


# ---- avatars (HTTP: binary in/out is awkward over the game WebSocket) -------

def _bearer(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    return auth[7:] if auth.lower().startswith("bearer ") else ""


@app.post("/api/avatar")
async def upload_avatar(request: Request) -> Response:
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return Response(status_code=401)
    mime = request.headers.get("content-type", "")
    body = await request.body()
    if len(body) > AVATAR_MAX_BYTES:
        return Response("Foto is te groot.", status_code=413)
    if not db.set_avatar(uid, body, mime):
        return Response("Ongeldig beeldformaat.", status_code=400)
    return Response(status_code=204)


# ---- voice memos (chat + DM). Uploaded over HTTP, referenced by id in the
# chat/dm message; blobs never travel over the WebSocket. Playback GETs are
# capability URLs (unguessable uuid ids), the same privacy model as avatars.
VOICE_MAX_BYTES = 1_600_000  # ~60s of opus/aac comfortably
VOICE_KEEP_PER_ROOM = 24


@app.post("/api/voice/{code}")
async def upload_room_voice(code: str, request: Request):
    """A room member uploads a memo; returns the id to reference in chat_send."""
    room = manager.rooms.get(code.upper())
    player_id = request.query_params.get("player") or ""
    if room is None or room.get_player(player_id) is None:
        return Response(status_code=403)
    mime = request.headers.get("content-type", "")
    if not mime.startswith("audio/"):
        return Response(status_code=400)
    body = await request.body()
    if not body or len(body) > VOICE_MAX_BYTES:
        return Response("Opname is te groot.", status_code=413)
    vid = uuid.uuid4().hex
    room.voice[vid] = (mime, body)
    while len(room.voice) > VOICE_KEEP_PER_ROOM:
        room.voice.pop(next(iter(room.voice)))
    return JSONResponse({"id": vid})


@app.get("/api/voice/{code}/{vid}")
async def get_room_voice(code: str, vid: str) -> Response:
    room = manager.rooms.get(code.upper())
    entry = room.voice.get(vid) if room else None
    if entry is None:
        return Response(status_code=404)
    mime, body = entry
    return Response(body, media_type=mime, headers={"Cache-Control": "private, max-age=3600"})


@app.post("/api/dm/voice")
async def upload_dm_voice(request: Request):
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return Response(status_code=401)
    mime = request.headers.get("content-type", "")
    if not mime.startswith("audio/"):
        return Response(status_code=400)
    body = await request.body()
    if not body or len(body) > VOICE_MAX_BYTES:
        return Response("Opname is te groot.", status_code=413)
    return JSONResponse({"id": db.dm_voice_store(uid, mime, body)})


@app.get("/api/dm/voice/{vid}")
async def get_dm_voice(vid: str) -> Response:
    entry = get_db().dm_voice_get(vid)
    if entry is None:
        return Response(status_code=404)
    mime, body = entry
    return Response(body, media_type=mime, headers={"Cache-Control": "private, max-age=31536000, immutable"})


@app.delete("/api/avatar")
async def delete_avatar(request: Request) -> Response:
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return Response(status_code=401)
    db.clear_avatar(uid)
    # Nobody goes avatar-less (the v1.16 invariant): removing a custom photo
    # immediately falls back to the account's default preset.
    db.ensure_avatar(uid)
    return Response(status_code=204)


@app.post("/api/avatar/preset")
async def set_avatar_preset(request: Request) -> Response:
    """Pick a built-in illustrated avatar (av01..av18)."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return Response(status_code=401)
    body = await request.json()
    preset_id = (body or {}).get("id") or ""
    if not db.set_avatar_preset(uid, preset_id):
        return Response("Onbekende avatar.", status_code=400)
    return Response(status_code=204)


@app.get("/api/avatar/{user_id}")
async def get_avatar(user_id: str) -> Response:
    found = get_db().get_avatar(user_id)
    if found is None:
        return Response(status_code=404)
    data, mime = found
    # The client busts the cache with ?v=<avatar_ver>, so cache hard.
    return Response(content=data, media_type=mime, headers={"Cache-Control": "public, max-age=31536000, immutable"})


# ---- training (solo practice to learn more words) ---------------------------
# Stateless and account-free: the client picks categories + a running set of
# used letters, the server picks a fresh random letter (so everyone gets a
# different sequence), then judges answers and reveals the words you missed
# straight from the curated lists (which stay server-side).

TRAIN_REVEAL_CAP = 12


@app.get("/api/train/categories")
async def train_categories() -> JSONResponse:
    """Which categories can be trained (the ones with a curated word list)."""
    return JSONResponse({"categories": game.TRAINABLE_CATEGORIES})


@app.post("/api/train/round")
async def train_round(request: Request) -> JSONResponse:
    body = await request.json()
    used = [str(x).strip().upper()[:1] for x in (body or {}).get("used") or []]
    hard = bool((body or {}).get("hard"))
    letter = game.pick_letter(used, hard)
    return JSONResponse({"letter": letter})


@app.post("/api/train/check")
async def train_check(request: Request) -> JSONResponse:
    body = await request.json()
    letter = (str((body or {}).get("letter") or "").strip() or "?")[:1]
    cats = [c for c in ((body or {}).get("categories") or []) if c in game.TRAINABLE_CATEGORIES]
    answers = (body or {}).get("answers") or {}
    # Soepele spelling: the client sends its account setting; training is not
    # ranked, so trusting it is fine (a dyslexia aid, not a competitive edge).
    lenient = bool((body or {}).get("lenient"))
    out = {}
    learned = 0  # words revealed that the player did not know
    correct = 0  # answers that were in the list
    for cat in cats:
        word = str(answers.get(cat) or "").strip()
        valid, in_list_exact = game.classify(word, letter, cat)
        if lenient and valid:
            canon = game.list_canonical(word, cat, lenient=True)
            in_list = canon is not None
        else:
            in_list = in_list_exact
            canon = game.list_canonical(word, cat) if in_list else None
        all_words = game.list_words_for_letter(cat, letter)
        missed = [w for w in all_words if game.normalize(w) != canon]
        if in_list:
            correct += 1
        learned += len(missed)
        out[cat] = {
            "your": word,
            "valid": valid,
            "in_list": in_list,
            "missed": missed[:TRAIN_REVEAL_CAP],
            "missed_total": len(missed),
            "list_total": len(all_words),
        }
    return JSONResponse({"letter": letter, "categories": out, "correct": correct, "learned": learned})


# ---- dagronde (daily round: same letter for everyone, ranked) ---------------
# Unlike Oefenen, the daily is deliberately identical for every player, since a
# ranking only means something when everyone faced the same letter. Accounts
# land on the day board (one attempt, 60s window anchored at their FIRST
# start); guests play the same round unranked and get a profile nudge.


def _daily_streak(db, uid: str, day: str) -> int:
    """Consecutive played days ending at `day`."""
    days = set(db.daily_days_of(uid))
    streak = 0
    d = day
    while d in days:
        streak += 1
        d = daily.previous_day(d)
    return streak


async def _daily_approvals(db, day: str, answers: dict, lenient: bool, ask_ai: bool) -> set:
    """(category, normalized word) pairs that count even though the curated list
    misses them, e.g. 'zwaluw'.

    Verdicts live in a SHARED cache, so the same word always scores the same for
    everyone on the day board and the AI is asked at most once per word. Cache
    lookups are free; only genuinely new words cost a call, and the answer is
    stored for every future player.
    """
    letter = daily.letter_for(day)
    pending: list[tuple[str, str]] = []
    for cat in daily.categories_for(day):
        word = str((answers or {}).get(cat) or "").strip()[:40]
        valid, in_list = game.classify(word, letter, cat)
        if valid and not in_list:
            pending.append((cat, word))
    if not pending:
        return set()
    keys = [(cat, game.normalize(w)) for cat, w in pending]
    cached = db.word_verdicts(keys, lenient)
    approved = {k for k, ok in cached.items() if ok}
    unknown = [(cat, w) for (cat, w), k in zip(pending, keys) if k not in cached]
    if unknown and ask_ai and ai_referee.available():
        verdicts = await ai_referee.judge(letter, unknown, lenient=lenient)
        for (cat, w), verdict in zip(unknown, verdicts):
            if verdict is None:
                continue  # undecided: don't cache, so it can be retried later
            key = (cat, game.normalize(w))
            db.set_word_verdict(cat, key[1], lenient, bool(verdict))
            if verdict:
                approved.add(key)
    return approved


def _daily_result_payload(db, uid: str | None, day: str, score: int, breakdown: dict,
                          ranked: bool, time_ms: int) -> dict:
    rank, total = db.daily_rank(uid, day) if uid else (0, db.daily_players_count(day))
    return {
        "day": day,
        "letter": daily.letter_for(day),
        "score": score,
        "categories": breakdown,
        "ranked": ranked,
        "rank": rank,
        "total": total,
        "streak": _daily_streak(db, uid, day) if uid else 0,
        "time_ms": time_ms,
        "board": db.daily_board(day, 10),
        "seconds_left": daily.seconds_to_next_day(),
    }


@app.get("/api/daily/info")
async def daily_info(request: Request) -> JSONResponse:
    """Landing/intro state: the day, how many played, whether YOU played."""
    db = get_db()
    day = daily.today()
    uid = db.auth(_bearer(request))
    return JSONResponse({
        "day": day,
        "seconds_left": daily.seconds_to_next_day(),
        "players": db.daily_players_count(day),
        "played": bool(uid and db.daily_entry(uid, day)),
        "streak": _daily_streak(db, uid, day) if uid else 0,
    })


@app.post("/api/daily/start")
async def daily_start(request: Request) -> JSONResponse:
    """Hand out today's letter. For accounts this anchors the submit window at
    the FIRST start of the day, so closing and reopening never resets it."""
    db = get_db()
    day = daily.today()
    uid = db.auth(_bearer(request))
    if uid and db.daily_entry(uid, day):
        return JSONResponse({"day": day, "played": True, "seconds_left": daily.seconds_to_next_day()})
    if uid:
        db.daily_start(uid, day, time.time())
    return JSONResponse({
        "day": day,
        "letter": daily.letter_for(day),
        "categories": daily.categories_for(day),
        "duration": daily.DURATION_S,
        "played": False,
    })


@app.post("/api/daily/submit")
async def daily_submit(request: Request) -> JSONResponse:
    db = get_db()
    body = await request.json()
    day = daily.today()
    uid = db.auth(_bearer(request))
    now = time.time()

    lenient = db.lenient_of(uid) if uid else False
    entry = db.daily_entry(uid, day) if uid else None
    if entry is not None:
        # Already on the board: return the STORED result, never re-judge new
        # words into a second attempt. Score it with the lenient setting the
        # submission used, so the breakdown matches the stored score.
        try:
            stored = json.loads(entry["words"])
        except Exception:
            stored = {}
        len_used = bool(entry.get("lenient"))
        approved = await _daily_approvals(db, day, stored, len_used, ask_ai=False)
        _, breakdown = daily.score_answers(day, stored, lenient=len_used, approved=approved)
        return JSONResponse({**_daily_result_payload(db, uid, day, int(entry["score"]), breakdown, True, int(entry["time_ms"])), "already": True})

    answers = {str(k)[:24]: str(v)[:40] for k, v in ((body or {}).get("answers") or {}).items()}
    approved = await _daily_approvals(db, day, answers, lenient, ask_ai=True)
    score, breakdown = daily.score_answers(day, answers, lenient=lenient, approved=approved)
    ranked = False
    time_ms = 0
    missions_done: list[dict] = []
    if uid:
        started = db.daily_start(uid, day, now)
        elapsed = now - started
        # Note: someone who starts seconds before midnight submits into the new
        # day and scores against its letter; rare enough to keep the code flat.
        if elapsed <= daily.DURATION_S + daily.GRACE_S:
            time_ms = int(min(max(elapsed, 1.0), daily.DURATION_S) * 1000)
            ranked = db.daily_submit(uid, day, score, time_ms, json.dumps(answers)[:4000], now, lenient=lenient)
        # Missions: playing counts (even a late submit), but only today's
        # active missions ever get progress.
        cats = daily.categories_for(day)
        filled = sum(1 for c in cats if (answers.get(c) or "").strip())
        top = len(cats) * daily.POINTS_PER_WORD
        missions_done = missions.bump_all(db, uid, day, (
            ("daily_play", 1),
            ("daily_full", 1 if cats and filled == len(cats) else 0),
            ("daily30", 1 if score >= 30 else 0),
            ("daily_perfect", 1 if score >= top else 0),
        ))
        # Anti-cheat: offer the one paid retry BEFORE revealing the score. When it
        # is available we withhold the score/breakdown entirely; the client asks
        # "retry for N coins?" and only fetches the reveal (/api/daily/result) once
        # the player declines. So you decide blind — you can't peek then redo.
        if ranked and not db.daily_retried(uid, day) and db.coins_of(uid) >= db.DAILY_RETRY_COINS:
            return JSONResponse({"day": day, "retry_available": True, "retry_cost": db.DAILY_RETRY_COINS})
    return JSONResponse({**_daily_result_payload(db, uid, day, score, breakdown, ranked, time_ms), "already": False, "missions_done": missions_done})


@app.post("/api/daily/retry")
async def daily_retry(request: Request) -> JSONResponse:
    """Spend coins to wipe today's daily attempt for one fresh try (once/day)."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    res = db.daily_retry(uid, daily.today())
    if res != "ok":
        return JSONResponse({"error": res}, status_code=402 if res == "insufficient" else 409)
    return JSONResponse({"ok": True, "coins": db.coins_of(uid)})


@app.get("/api/daily/result")
async def daily_result(request: Request) -> JSONResponse:
    """Re-open today's stored result (accounts; guests keep a local copy)."""
    db = get_db()
    day = daily.today()
    uid = db.auth(_bearer(request))
    entry = db.daily_entry(uid, day) if uid else None
    if not uid or entry is None:
        return JSONResponse({"error": "not_played"}, status_code=404)
    try:
        stored = json.loads(entry["words"])
    except Exception:
        stored = {}
    len_used = bool(entry.get("lenient"))
    approved = await _daily_approvals(db, day, stored, len_used, ask_ai=False)
    _, breakdown = daily.score_answers(day, stored, lenient=len_used, approved=approved)
    return JSONResponse(_daily_result_payload(db, uid, day, int(entry["score"]), breakdown, True, int(entry["time_ms"])))


# ---- duel (1v1 om beurten, gescoord op zeldzaamheid) -------------------------
# Zie duel.py voor de spelregels. Hier zit de opslag-, scoring- en meldingslijm:
# rondes worden één voor één GESERVEERD (de klok loopt server-side), een antwoord
# wordt meteen beoordeeld tegen de gedeelde woordcache en de zeldzaamheidstabel,
# en zodra beide spelers klaar zijn valt de uitslag met XP en een melding.


def _duel_user_card(db, user_id: str) -> dict:
    u = db.get_user(user_id) or {}
    return {
        "id": user_id,
        "name": u.get("name") or "?",
        "color": u.get("color") or "#FFC23D",
        "has_avatar": bool(u.get("has_avatar")),
        "avatar_ver": u.get("avatar_ver", 0),
    }


async def _duel_judge(db, category: str, letter: str, word: str, lenient: bool) -> tuple[bool, str]:
    """(telt mee, canonieke sleutel) voor één antwoord.

    Een woord dat de curatielijst mist gaat één keer langs de AI-scheids en
    belandt in dezelfde gedeelde verdict-cache als de dagronde, zodat hetzelfde
    woord voor iedereen hetzelfde oordeel krijgt en de AI nooit twee keer over
    hetzelfde woord hoeft na te denken.
    """
    valid, in_list = game.classify(word, letter, category)
    if not valid:
        return False, ""
    canon = game.list_canonical(word, category, lenient=lenient) or game.normalize(word)
    if lenient and not in_list:
        in_list = game.list_canonical(word, category, lenient=True) is not None
    if in_list:
        return True, canon
    key = (category, game.normalize(word))
    cached = db.word_verdicts([key], lenient)
    if key in cached:
        return bool(cached[key]), canon
    if ai_referee.available():
        verdicts = await ai_referee.judge(letter, [(category, word)], lenient=lenient)
        verdict = verdicts[0] if verdicts else None
        if verdict is not None:
            db.set_word_verdict(category, key[1], lenient, bool(verdict))
            return bool(verdict), canon
    return False, canon


def _duel_payload(db, uid: str, d: dict) -> dict:
    """The duel as THIS player may see it. The opponent's words stay hidden
    until the duel is settled, otherwise playing second would be free."""
    rounds = d["rounds"]
    opponent_id = d["b"] if d["a"] == uid else d["a"]
    mine = {int(r["idx"]): r for r in db.duel_answers_of(d["id"], uid)}
    theirs = {int(r["idx"]): r for r in db.duel_answers_of(d["id"], opponent_id)}
    done = d["status"] != "open"
    my_done = sum(1 for r in mine.values() if r["answered_at"] is not None)
    their_done = sum(1 for r in theirs.values() if r["answered_at"] is not None)
    my_score = sum(int(r["points"]) for r in mine.values())
    their_score = sum(int(r["points"]) for r in theirs.values())

    detail = []
    for i, rnd in enumerate(rounds):
        m, o = mine.get(i), theirs.get(i)
        detail.append({
            "idx": i,
            "letter": rnd["letter"],
            "category": rnd["category"],
            "mine": None if not m or m["answered_at"] is None else
                    {"word": m["word"], "tier": m["tier"], "points": int(m["points"])},
            # Redacted while the duel is live: the second player must not be
            # able to read the first player's answers.
            "theirs": None if not done or not o or o["answered_at"] is None else
                      {"word": o["word"], "tier": o["tier"], "points": int(o["points"])},
        })

    # The round this player is on: the first one they have not answered.
    current = None
    if not done and my_done < len(rounds):
        idx = my_done
        rnd = rounds[idx]
        served = mine.get(idx, {}).get("served_at")
        # What the player SEES is the plain 15 seconds. ROUND_GRACE_S is only a
        # server-side tolerance for a slow submit, never extra thinking time.
        left = duel.ROUND_S
        if served is not None:
            left = max(0.0, duel.ROUND_S - (time.time() - float(served)))
        current = {"idx": idx, "letter": rnd["letter"], "category": rnd["category"],
                   "seconds": duel.ROUND_S, "seconds_left": round(left, 1), "served": served is not None}

    winner = None
    if done:
        winner = "draw" if not d["winner"] else ("me" if d["winner"] == uid else "them")
    return {
        "id": d["id"],
        "status": d["status"],
        "i_challenged": d["a"] == uid,
        "opponent": _duel_user_card(db, opponent_id),
        "rounds": len(rounds),
        "my_done": my_done,
        "their_done": their_done,
        "my_score": my_score,
        "their_score": their_score if done else None,
        "current": current,
        "detail": detail,
        "winner": winner,
        "created_at": d["created_at"],
        "expires_at": d["expires_at"],
    }


async def _duel_settle(db, d: dict) -> None:
    """Both players finished (or the clock ran out): score it, pay out, notify.

    The rarity table is only fed HERE, never at answer time, so the two players
    of one duel are judged against the same snapshot and playing first is not
    an advantage.
    """
    a, b = d["a"], d["b"]
    ans_a = db.duel_answers_of(d["id"], a)
    ans_b = db.duel_answers_of(d["id"], b)
    score_a = sum(int(r["points"]) for r in ans_a)
    score_b = sum(int(r["points"]) for r in ans_b)
    res = duel.outcome(score_a, score_b)
    winner = a if res == "a" else b if res == "b" else None
    db.duel_finish(d["id"], winner)

    for rows in (ans_a, ans_b):
        for r in rows:
            if r["answered_at"] is None or not r["word"]:
                continue
            rnd = d["rounds"][int(r["idx"])]
            db.answer_bump(rnd["category"], rnd["letter"], game.normalize(r["word"]))

    # XP, but only for the first few duels of a day: a second XP tap must not
    # make the level rewards at 20/30/50 cheaper than they are now.
    since = time.time() - 24 * 3600
    for uid, mine_won in ((a, res == "a"), (b, res == "b")):
        if db.duel_finished_today_count(uid, since) > duel.XP_DUELS_PER_DAY:
            continue
        db.add_bonus_xp(uid, duel.xp_for("draw" if res == "draw" else "win" if mine_won else "loss"))

    for uid, other in ((a, b), (b, a)):
        name = (db.get_user(other) or {}).get("name") or "?"
        mine = score_a if uid == a else score_b
        opp = score_b if uid == a else score_a
        verdict = "Gelijkspel" if res == "draw" else ("Je wint" if mine > opp else "Je verliest")
        await push.notify(uid, "Pen Neer", f"Duel tegen {name} is klaar. {verdict}: {mine} - {opp}.", tag="duel")
        await accounts.push_account(uid)


async def _duel_sweep(db) -> None:
    """Settle duels past their 48 hours: whoever played wins by walkover."""
    now = time.time()
    for d in db.duel_expired(now):
        try:
            d["rounds"] = json.loads(d["rounds"])
        except Exception:
            d["rounds"] = []
        played_a = any(r["answered_at"] is not None for r in db.duel_answers_of(d["id"], d["a"]))
        played_b = any(r["answered_at"] is not None for r in db.duel_answers_of(d["id"], d["b"]))
        if played_a == played_b:
            # Both or neither missed the deadline: settle on the points that
            # exist (nobody played -> a 0-0 draw, which we just record as done).
            await _duel_settle(db, d)
        else:
            db.duel_finish(d["id"], d["a"] if played_a else d["b"])
            uid = d["a"] if played_a else d["b"]
            since = now - 24 * 3600
            if db.duel_finished_today_count(uid, since) <= duel.XP_DUELS_PER_DAY:
                db.add_bonus_xp(uid, duel.xp_for("win"))
            for r in db.duel_answers_of(d["id"], uid):
                if r["answered_at"] is not None and r["word"]:
                    rnd = d["rounds"][int(r["idx"])]
                    db.answer_bump(rnd["category"], rnd["letter"], game.normalize(r["word"]))


@app.get("/api/duel/list")
async def duel_list(request: Request) -> JSONResponse:
    """My duels (newest first) plus the friends I can challenge."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    await _duel_sweep(db)
    duels = []
    for row in db.duels_of(uid, 20):
        d = dict(row)
        try:
            d["rounds"] = json.loads(d["rounds"])
        except Exception:
            d["rounds"] = []
        duels.append(_duel_payload(db, uid, d))
    friends = [f for f in db.friends_of(uid) if f["status"] == "accepted"]
    return JSONResponse({
        "duels": duels,
        "friends": friends,
        "pending": db.duel_open_count(uid),
        "record": db.duel_record(uid),
        "rounds": duel.ROUNDS,
        "round_seconds": duel.ROUND_S,
    })


@app.get("/api/duel/info")
async def duel_info(request: Request) -> JSONResponse:
    """Tiny poll for the landing tile: how many duels wait for you."""
    db = get_db()
    uid = db.auth(_bearer(request))
    return JSONResponse({"pending": db.duel_open_count(uid) if uid else 0})


@app.post("/api/duel/start")
async def duel_start(request: Request) -> JSONResponse:
    """Challenge a friend. Both get the same five rounds; the letters follow
    the pair's own alphabet rule so a rematch never repeats them."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json()
    other = str((body or {}).get("opponent") or "")
    if not other or other == uid:
        return JSONResponse({"error": "opponent"}, status_code=400)
    if not db.is_friend(uid, other) or db.is_blocked(uid, other):
        return JSONResponse({"error": "not_friends"}, status_code=403)
    # One live duel per pair keeps the list readable and stops challenge spam.
    live = db.duel_open_with(uid, other)
    if live:
        return JSONResponse({"error": "already_open", "id": live}, status_code=409)
    used, combos = db.duel_pair_state(uid, other)
    rounds, new_used, new_combos = duel.pick_rounds(used, combos)
    did = db.duel_create(uid, other, rounds, time.time() + duel.EXPIRY_H * 3600)
    db.duel_pair_set(uid, other, new_used, new_combos)
    name = (db.get_user(uid) or {}).get("name") or "?"
    await push.notify(other, "Pen Neer", f"{name} daagt je uit voor een duel.", tag="duel")
    d = db.duel_get(did)
    return JSONResponse(_duel_payload(db, uid, d))


@app.get("/api/duel/{duel_id}")
async def duel_get(duel_id: str, request: Request) -> JSONResponse:
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    await _duel_sweep(db)
    d = db.duel_get(duel_id)
    if not d or uid not in (d["a"], d["b"]):
        return JSONResponse({"error": "not_found"}, status_code=404)
    return JSONResponse(_duel_payload(db, uid, d))


@app.post("/api/duel/{duel_id}/serve")
async def duel_serve(duel_id: str, request: Request) -> JSONResponse:
    """Hand out the round this player is on and start ITS clock server-side, so
    closing the app or reloading never buys extra thinking time."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    d = db.duel_get(duel_id)
    if not d or uid not in (d["a"], d["b"]):
        return JSONResponse({"error": "not_found"}, status_code=404)
    if d["status"] != "open":
        return JSONResponse({"error": "closed"}, status_code=409)
    rows = db.duel_answers_of(duel_id, uid)
    idx = sum(1 for r in rows if r["answered_at"] is not None)
    if idx >= len(d["rounds"]):
        return JSONResponse({"error": "done"}, status_code=409)
    served = db.duel_serve_round(duel_id, uid, idx, time.time())
    rnd = d["rounds"][idx]
    left = max(0.0, duel.ROUND_S - (time.time() - served))
    return JSONResponse({
        "idx": idx,
        "letter": rnd["letter"],
        "category": rnd["category"],
        "seconds": duel.ROUND_S,
        "seconds_left": round(left, 1),
        "total": len(d["rounds"]),
    })


@app.post("/api/duel/{duel_id}/answer")
async def duel_answer(duel_id: str, request: Request) -> JSONResponse:
    """Score one round. Rarity is read from the table as it stands right now;
    this answer only lands in the table once the whole duel is settled."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    d = db.duel_get(duel_id)
    if not d or uid not in (d["a"], d["b"]):
        return JSONResponse({"error": "not_found"}, status_code=404)
    if d["status"] != "open":
        return JSONResponse({"error": "closed"}, status_code=409)
    body = await request.json()
    idx = int((body or {}).get("idx", -1))
    word = str((body or {}).get("word") or "").strip()[:40]
    if idx < 0 or idx >= len(d["rounds"]):
        return JSONResponse({"error": "idx"}, status_code=400)
    rows = {int(r["idx"]): r for r in db.duel_answers_of(duel_id, uid)}
    row = rows.get(idx)
    if row is None:
        return JSONResponse({"error": "not_served"}, status_code=409)
    if row["answered_at"] is not None:
        return JSONResponse({"error": "already"}, status_code=409)

    rnd = d["rounds"][idx]
    now = time.time()
    late = now - float(row["served_at"]) > duel.ROUND_S + duel.ROUND_GRACE_S
    lenient = db.lenient_of(uid)
    counts_for_score = False
    canon = ""
    if word and not late:
        counts_for_score, canon = await _duel_judge(db, rnd["category"], rnd["letter"], word, lenient)
    if counts_for_score:
        freq, total = db.answer_freq(rnd["category"], rnd["letter"])
        tier, points, share = duel.tier_for(freq.get(canon, 0), total)
    else:
        tier, points, share = ("te_laat" if late and word else "mis"), 0, 0.0
    db.duel_answer_set(duel_id, uid, idx, word, points, tier, share, now)

    # Last round: if the opponent already finished, the duel settles right here.
    my_done = sum(1 for r in db.duel_answers_of(duel_id, uid) if r["answered_at"] is not None)
    finished = False
    if my_done >= len(d["rounds"]):
        other = d["b"] if d["a"] == uid else d["a"]
        their_done = sum(1 for r in db.duel_answers_of(duel_id, other) if r["answered_at"] is not None)
        if their_done >= len(d["rounds"]):
            await _duel_settle(db, d)
            finished = True
        else:
            name = (db.get_user(uid) or {}).get("name") or "?"
            await push.notify(other, "Pen Neer", f"{name} heeft gespeeld. Jij bent aan de beurt.", tag="duel")
        await accounts.push_missions(uid, missions.bump_all(db, uid, daily.today(), (("duel_play", 1),)))
    d = db.duel_get(duel_id)
    return JSONResponse({
        "tier": tier, "points": points, "share": round(share, 4),
        "word": word, "finished": finished, "duel": _duel_payload(db, uid, d),
    })


@app.post("/api/duel/{duel_id}/rematch")
async def duel_rematch(duel_id: str, request: Request) -> JSONResponse:
    """Play the same opponent again. Fresh letters: the pair's alphabet rule
    means a rematch draws from what they have NOT had yet."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    d = db.duel_get(duel_id)
    if not d or uid not in (d["a"], d["b"]):
        return JSONResponse({"error": "not_found"}, status_code=404)
    if d["status"] == "open":
        return JSONResponse({"error": "still_open"}, status_code=409)
    other = d["b"] if d["a"] == uid else d["a"]
    if not db.is_friend(uid, other) or db.is_blocked(uid, other):
        return JSONResponse({"error": "not_friends"}, status_code=403)
    live = db.duel_open_with(uid, other)
    if live:
        return JSONResponse({"error": "already_open", "id": live}, status_code=409)
    used, combos = db.duel_pair_state(uid, other)
    rounds, new_used, new_combos = duel.pick_rounds(used, combos)
    did = db.duel_create(uid, other, rounds, time.time() + duel.EXPIRY_H * 3600)
    db.duel_pair_set(uid, other, new_used, new_combos)
    name = (db.get_user(uid) or {}).get("name") or "?"
    await push.notify(other, "Pen Neer", f"{name} wil een herkansing.", tag="duel")
    return JSONResponse(_duel_payload(db, uid, db.duel_get(did)))


# ---- dagelijkse missies ------------------------------------------------------

@app.get("/api/missions")
async def missions_get(request: Request) -> JSONResponse:
    """Today's three missions with the caller's progress (guests: no progress,
    the client shows a make-a-profile nudge instead)."""
    db = get_db()
    day = daily.today()
    uid = db.auth(_bearer(request))
    defs = missions.missions_for(day)
    state = db.mission_state(uid, day) if uid else {}
    out = []
    for d in defs:
        s = state.get(d["key"], {})
        out.append({**d, "progress": min(d["target"], int(s.get("progress", 0))), "done": bool(s.get("done", False))})
    return JSONResponse({
        "day": day,
        "seconds_left": daily.seconds_to_next_day(),
        "authed": bool(uid),
        "missions": out,
    })


# ---- web push (real notifications while the app is closed) ------------------

@app.get("/api/push/key")
async def push_key() -> JSONResponse:
    """The VAPID public key the browser needs to subscribe."""
    if not push.available():
        return JSONResponse({"enabled": False})
    return JSONResponse({"enabled": True, "key": push.public_key()})


@app.post("/api/push/subscribe")
async def push_subscribe(request: Request) -> Response:
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return Response(status_code=401)
    body = await request.json()
    endpoint = (body or {}).get("endpoint") or ""
    keys_ = (body or {}).get("keys") or {}
    if not db.push_subscribe(uid, endpoint, keys_.get("p256dh") or "", keys_.get("auth") or ""):
        return Response(status_code=400)
    return Response(status_code=204)


@app.post("/api/push/unsubscribe")
async def push_unsubscribe(request: Request) -> Response:
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return Response(status_code=401)
    body = await request.json()
    endpoint = (body or {}).get("endpoint") or ""
    if endpoint:
        db.push_unsubscribe(endpoint)
    return Response(status_code=204)


# ---- shop: PayPal checkout for the AI-referee unlock ------------------------

@app.get("/api/shop/status")
async def shop_status() -> JSONResponse:
    """What the shop UI needs to render: PayPal availability + coin bundle prices
    + the coin cost of each buyable item."""
    return JSONResponse({**paypal.status(), "coin_prices": get_db().COIN_PRICES})


@app.post("/api/shop/paypal/create")
async def shop_paypal_create(request: Request) -> JSONResponse:
    """Start a PayPal order for the authenticated account. The buyer's id is
    baked into the order server-side, so capture can only unlock the payer."""
    uid = get_db().auth(_bearer(request))
    if uid is None:
        return JSONResponse({"error": "auth"}, status_code=401)
    if not paypal.configured():
        return JSONResponse({"error": "unavailable"}, status_code=503)
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    product = (body or {}).get("product") or "ai"
    order = await paypal.create_order(uid, product)
    if not order:
        return JSONResponse({"error": "paypal"}, status_code=502)
    return JSONResponse(order)


@app.post("/api/shop/paypal/capture")
async def shop_paypal_capture(request: Request) -> JSONResponse:
    """Capture an approved order and unlock AI for the payer, exactly once.

    Trust boundary: we never take the price or the account from the client. We
    capture with PayPal, require status COMPLETED, verify the amount/currency
    match our configured price, and unlock the account baked into the order's
    custom_id at create time."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json()
    order_id = (body or {}).get("order_id") or ""
    if not isinstance(order_id, str) or not order_id.strip():
        return JSONResponse({"error": "order"}, status_code=400)
    order_id = order_id.strip()

    # Idempotent: a re-open of the return URL just re-confirms the unlock.
    if db.purchase_code(order_id):
        return JSONResponse({"ok": True, "already": True})

    result = await paypal.capture_order(order_id)
    if result is None:
        return JSONResponse({"error": "paypal"}, status_code=502)
    # A 422 (already captured) came back without a COMPLETED capture body; read
    # the order to reconcile before deciding.
    if result.get("status") != "COMPLETED":
        result = await paypal.get_order(order_id) or result
    if result.get("status") != "COMPLETED":
        # PENDING = an eCheck/on-hold capture: money may still bounce, so no
        # unlock yet. The UI tells the buyer it is being processed.
        if result.get("status") == "PENDING":
            return JSONResponse({"error": "pending"}, status_code=402)
        return JSONResponse({"error": "not_completed"}, status_code=402)

    # custom_id is "uid|product" (older AI-only orders were just "uid").
    custom = result.get("custom_id") or ""
    buyer, _, product = custom.partition("|")
    product = product or "ai"
    if product not in paypal.PRODUCTS:
        product = "ai"

    # Amount + currency must match what we sell for THIS product — never trust
    # the returned order blindly (defense against a tampered/foreign order id).
    if (result.get("amount") != paypal.price(product)) or (result.get("currency") != paypal.currency()):
        return JSONResponse({"error": "amount"}, status_code=402)

    # Fall back to the authenticated caller only if PayPal dropped custom_id.
    if not buyer or not db.get_user(buyer):
        buyer = uid

    if product in db.COIN_BUNDLES:  # a coin bundle -> credit its coins
        bal = db.fulfil_coins(order_id, buyer, paypal.price(product), paypal.currency(), product=product)
        return JSONResponse({"ok": True, "coins": bal} if bal is not None else {"ok": True, "already": True})
    code = db.fulfil_purchase(order_id, buyer, paypal.price(product), paypal.currency(), product=product)
    if code is None:
        # Lost a race; the winning request already fulfilled it.
        return JSONResponse({"ok": True, "already": True})
    return JSONResponse({"ok": True})


# Serve the built SPA when present (Docker copies it to ./static).
STATIC_DIR = Path(os.environ.get("PENNEER_STATIC", "static"))
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # The app shell + service worker must always revalidate, so a new deploy
    # reaches installed PWAs immediately instead of stranding them on a stale
    # cached shell whose (now-deleted) asset hashes 404 into a black screen.
    _NO_CACHE = {"Cache-Control": "no-cache"}

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            if full_path == "sw.js" or full_path == "index.html" or full_path.endswith(".webmanifest"):
                return FileResponse(candidate, headers=_NO_CACHE)
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html", headers=_NO_CACHE)
