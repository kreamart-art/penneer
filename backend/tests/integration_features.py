"""Integration test for the expansion features against a running server :8000.

Covers: no-timer (0s) round, testbots (bot as spelleider auto-drives), ready
state, spectator join while a game is running.
"""
import asyncio
import json

import websockets

URL = "ws://localhost:8000/ws"


async def recv_until(ws, mtype, timeout=8.0):
    types = {mtype} if isinstance(mtype, str) else set(mtype)
    while True:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout))
        if msg.get("type") in types:
            return msg


async def latest_state(ws, timeout=8.0):
    """Return the most recent room_state seen within a short window."""
    state = None
    try:
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), 0.4))
            if msg.get("type") == "room_state":
                state = msg["room"]
    except asyncio.TimeoutError:
        pass
    if state is None:
        msg = await recv_until(ws, "room_state", timeout)
        state = msg["room"]
    return state


async def main():
    host = await websockets.connect(URL)
    await host.send(json.dumps({"type": "create_room", "name": "Host"}))
    joined = await recv_until(host, "joined")
    code, host_id = joined["code"], joined["player_id"]
    print(f"[create] room={code}")

    # Testbots are admin-gated now: log in as admin first.
    await host.send(json.dumps({"type": "admin_login", "secret": "penneer-admin"}))
    adm = await recv_until(host, "admin_ok")
    assert adm["is_admin"], "admin login should succeed with default password"
    print(f"[admin]  logged in, recovery codes: {len(adm['recovery_codes'])}")

    # No-timer mode + add two bots.
    await host.send(json.dumps({"type": "update_settings", "round_time": 0, "rounds": 3, "categories": ["Dier", "Land", "Stad"]}))
    await host.send(json.dumps({"type": "add_bot"}))
    await host.send(json.dumps({"type": "add_bot"}))
    st = await latest_state(host)
    bots = [p for p in st["players"] if p["is_bot"]]
    assert len(bots) == 2, f"expected 2 bots, got {len(bots)}"
    assert st["settings"]["round_time"] == 0
    print(f"[setup]  round_time=0, bots={[b['name'] for b in bots]}")

    # Start. Round 1 active = host (index 0). No timer, so host must stop.
    await host.send(json.dumps({"type": "start_game"}))
    await recv_until(host, "turn_started")
    await host.send(json.dumps({"type": "spin_start"}))
    await recv_until(host, "spin_started")
    await host.send(json.dumps({"type": "spin_stop"}))
    ts = await recv_until(host, "timer_started")
    assert ts["duration"] == 0 and ts["ends_at"] is None, "no-timer round should have no clock"
    print("[r1]     no-timer fill running (ends_at=None) ok")

    # Bots should auto-fill and report ready.
    ru = await recv_until(host, "ready_updated", timeout=6.0)
    assert any(b["id"] in ru["ready_ids"] for b in bots), "bots should become ready"
    print(f"[r1]     bots ready ids={len(ru['ready_ids'])} ok")

    # Host marks ready (informational), then stops the round.
    await host.send(json.dumps({"type": "set_ready", "ready": True}))
    await host.send(json.dumps({"type": "update_answers", "answers": {"Dier": "Aap", "Land": "Argentinie", "Stad": "Amsterdam"}}))
    await asyncio.sleep(0.2)
    await host.send(json.dumps({"type": "stop_round"}))
    res = await recv_until(host, "results", timeout=6.0)
    print(f"[r1]     scored, host points={res['points'][host_id]}")

    # Round 2: active should be a bot -> it auto-spins, auto-fills, auto-stops.
    await host.send(json.dumps({"type": "next_round"}))
    ts2 = await recv_until(host, "turn_started")
    active2 = ts2["active_player_id"]
    assert active2 in {b["id"] for b in bots}, "round2 active should be a bot"
    print(f"[r2]     active is a bot, waiting for it to auto-play...")
    # The bot drives reveal -> fill -> stop entirely on its own.
    await recv_until(host, "letter_locked", timeout=6.0)
    await recv_until(host, "results", timeout=12.0)
    print("[r2]     bot auto-drove the whole round ok")

    # Spectator joins mid-game.
    spec = await websockets.connect(URL)
    await spec.send(json.dumps({"type": "join_room", "code": code, "name": "Kijker"}))
    sj = await recv_until(spec, "joined", timeout=6.0)
    sstate = await latest_state(spec)
    me = next(p for p in sstate["players"] if p["id"] == sj["player_id"])
    assert me["is_spectator"], "mid-game joiner should be a spectator"
    print("[spec]   mid-game joiner admitted as spectator ok")

    # Round 3 is also a bot (3 players, round 3 -> index 2). It auto-plays.
    await host.send(json.dumps({"type": "next_round"}))
    await recv_until(host, "turn_started")
    await recv_until(host, "results", timeout=14.0)
    print("[r3]     bot auto-drove final round ok")

    # Finish the game.
    await host.send(json.dumps({"type": "next_round"}))
    over = await recv_until(host, "game_over", timeout=8.0)
    # Spectator must not appear in scores.
    assert sj["player_id"] not in over["scores"], "spectator must not be scored"
    print(f"[over]   winner={over['winner_id'][:6]}, spectator excluded from scores ok")

    await host.close()
    await spec.close()
    print("\nALL FEATURE CHECKS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
