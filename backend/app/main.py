"""Pen Neer — FastAPI entrypoint.

Serves the WebSocket game endpoint and, in production, the built frontend as
static files. CORS is open in dev so Vite (5173) can reach the API.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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
