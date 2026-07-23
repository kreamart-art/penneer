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

from . import daily, game, missions, paypal, push
from .db import AVATAR_MAX_BYTES, get_db
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
        _, breakdown = daily.score_answers(day, stored, lenient=bool(entry.get("lenient")))
        return JSONResponse({**_daily_result_payload(db, uid, day, int(entry["score"]), breakdown, True, int(entry["time_ms"])), "already": True})

    answers = {str(k)[:24]: str(v)[:40] for k, v in ((body or {}).get("answers") or {}).items()}
    score, breakdown = daily.score_answers(day, answers, lenient=lenient)
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
        active = missions.active_keys(day)
        for key, inc in (("daily_play", 1), ("daily30", 1 if score >= 30 else 0)):
            if key in active and inc > 0:
                target, reward, coins = missions.spec(key)
                if db.mission_bump(uid, day, key, inc, target, reward, coins):
                    missions_done.append({"key": key, "reward": reward, "coins": coins})
    return JSONResponse({**_daily_result_payload(db, uid, day, score, breakdown, ranked, time_ms), "already": False, "missions_done": missions_done})


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
    _, breakdown = daily.score_answers(day, stored, lenient=bool(entry.get("lenient")))
    return JSONResponse(_daily_result_payload(db, uid, day, int(entry["score"]), breakdown, True, int(entry["time_ms"])))


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

    @app.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
