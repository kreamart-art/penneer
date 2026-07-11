"""Pen Neer — FastAPI entrypoint.

Serves the WebSocket game endpoint and, in production, the built frontend as
static files. CORS is open in dev so Vite (5173) can reach the API.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import paypal, push
from .db import AVATAR_MAX_BYTES, get_db
from .ws import router as ws_router

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


@app.delete("/api/avatar")
async def delete_avatar(request: Request) -> Response:
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return Response(status_code=401)
    db.clear_avatar(uid)
    return Response(status_code=204)


@app.get("/api/avatar/{user_id}")
async def get_avatar(user_id: str) -> Response:
    found = get_db().get_avatar(user_id)
    if found is None:
        return Response(status_code=404)
    data, mime = found
    # The client busts the cache with ?v=<avatar_ver>, so cache hard.
    return Response(content=data, media_type=mime, headers={"Cache-Control": "public, max-age=31536000, immutable"})


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
    """What the shop UI needs to render: whether PayPal is live + the price."""
    return JSONResponse(paypal.status())


@app.post("/api/shop/paypal/create")
async def shop_paypal_create(request: Request) -> JSONResponse:
    """Start a PayPal order for the authenticated account. The buyer's id is
    baked into the order server-side, so capture can only unlock the payer."""
    uid = get_db().auth(_bearer(request))
    if uid is None:
        return JSONResponse({"error": "auth"}, status_code=401)
    if not paypal.configured():
        return JSONResponse({"error": "unavailable"}, status_code=503)
    order = await paypal.create_order(uid)
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

    # Amount + currency must match what we sell — never trust the returned order
    # blindly (defense against a tampered/foreign order id).
    if (result.get("amount") != paypal.price()) or (result.get("currency") != paypal.currency()):
        return JSONResponse({"error": "amount"}, status_code=402)

    # The payer is whoever the order was created for (custom_id). Fall back to
    # the authenticated caller only if PayPal dropped custom_id.
    buyer = result.get("custom_id") or uid
    if not db.get_user(buyer):
        buyer = uid

    code = db.fulfil_purchase(order_id, buyer, paypal.price(), paypal.currency())
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
