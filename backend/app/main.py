"""Pen Neer — FastAPI entrypoint.

Serves the WebSocket game endpoint and, in production, the built frontend as
static files. CORS is open in dev so Vite (5173) can reach the API.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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
