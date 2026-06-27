# Pen Neer

Real-time multiplayer party word game (studio: Artnomad, `penneer.artnomad.nl`).
The Dutch schoolyard game: a letter is revealed, everyone races to fill in a word
per category that starts with that letter. Unique answers score full points,
shared answers score half. Everyone plays on their own phone in one room,
Kahoot/Jackbox style. The server is the single source of truth.

## Stack
- Frontend: React + Vite + Tailwind + TypeScript
- Backend: FastAPI + WebSocket (server-authoritative)
- Deploy: Docker, target Coolify on Hetzner

## Run locally (two terminals)

Backend:
```
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Frontend:
```
cd frontend
npm install
npm run dev      # http://localhost:5400  (proxies /ws to :8000)
```

Open the dev URL in two or more browser tabs to play as separate players in one
room.

## Tests
```
cd backend
.venv/bin/python -m pytest tests/test_game.py -q          # scoring + validity units
.venv/bin/python tests/integration_two_clients.py         # full 2-client game (server must be up)
```

## Production / Docker
The image builds the SPA and serves it from FastAPI on the same origin as `/ws`,
so there is no separate proxy to configure.
```
docker compose up --build      # http://localhost:8000
```
On Coolify: point the app at this repo, build with the Dockerfile, expose port
8000. Traefik forwards the WebSocket upgrade automatically; the client picks
`wss://` under HTTPS.

## Configuration (env vars, server-side)
All optional. The AI referee stays off until a key is set AND an admin enables it.

| Var | Default | Purpose |
|---|---|---|
| `PENNEER_ADMIN_PASSWORD` | `penneer-admin` | Admin login (set this in production). Recovery codes derive from it. |
| `PENNEER_AI_KEY` | (none) | API key / bearer token for the AI referee. No key = AI unavailable. |
| `PENNEER_AI_PROVIDER` | `anthropic` | `anthropic` (Claude direct) or `nous` (route through a Nous-style chat URL). |
| `PENNEER_AI_MODEL` | `claude-haiku-4-5` | Model id for the referee. |
| `PENNEER_AI_URL` | (none) | Chat endpoint URL (required for `nous`; anthropic uses its own). |
| `PENNEER_AI_ENABLED` | `0` | Start with the referee enabled (admin can also toggle at runtime). |

The AI referee only judges the orange "?" answers (not in the word lists), so token
cost stays tiny. The key never reaches the client.

## How a round works (§3)
1. Reveal: the spelleider presses the buzzer, an alphabet reel spins, they press
   STOP. The server picks the real letter (random, no repeats) and broadcasts it.
2. Fill: everyone types at once on one server-run clock.
3. Stop: the spelleider presses "Pen neer" (or the timer expires) to end fill.
4. Score: unique answer = 10, shared (dubbel) = 5, empty/wrong-letter = 0. Tap an
   answer on the results screen to challenge it; the server recomputes for all.

The spelleider role rotates every round. Highest total after the last round wins.

## Layout
```
frontend/   React app (net/socket.ts, theme/tokens.ts, components/, screens/)
backend/    FastAPI app (main.py, ws.py, rooms.py, game.py, models.py) + tests/
Dockerfile  docker-compose.yml
```

State is in-memory in a single process (RoomManager). To scale to multiple
processes, move room state to Redis and fan out broadcasts via pub/sub (see notes
in `backend/app/rooms.py`).
