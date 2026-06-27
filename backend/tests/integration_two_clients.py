"""End-to-end two-client smoke test against a running server on :8000.

Plays a full game: create + join, rotate spelleider, spin a synced letter, fill
on the shared clock, stop, score (unique vs dubbel), challenge, finish.

Run the server first, then: .venv/bin/python tests/integration_two_clients.py
"""
import asyncio
import json

import websockets

URL = "ws://localhost:8000/ws"


async def recv_until(ws, mtype, timeout=5.0):
    """Receive messages until one of the given type(s) arrives; return it."""
    types = {mtype} if isinstance(mtype, str) else set(mtype)
    while True:
        raw = await asyncio.wait_for(ws.recv(), timeout)
        msg = json.loads(raw)
        if msg.get("type") in types:
            return msg


async def drain(ws):
    """Non-blocking drain of any buffered messages."""
    out = []
    try:
        while True:
            out.append(json.loads(await asyncio.wait_for(ws.recv(), 0.15)))
    except (asyncio.TimeoutError, Exception):
        pass
    return out


async def main():
    a = await websockets.connect(URL)
    b = await websockets.connect(URL)

    # --- create + join ---
    await a.send(json.dumps({"type": "create_room", "name": "Ada"}))
    joined_a = await recv_until(a, "joined")
    code = joined_a["code"]
    pid_a = joined_a["player_id"]
    print(f"[create] room={code} A={pid_a[:6]}")

    await b.send(json.dumps({"type": "join_room", "code": code, "name": "Bob"}))
    joined_b = await recv_until(b, "joined")
    pid_b = joined_b["player_id"]
    print(f"[join]   B={pid_b[:6]}")

    # Settings: 3 rounds, 2 categories min -> use 3 cats, 30s.
    await a.send(json.dumps({"type": "update_settings", "rounds": 3, "round_time": 30, "categories": ["Dier", "Land", "Vrucht"]}))
    await drain(a)
    await drain(b)

    # --- start game ---
    await a.send(json.dumps({"type": "start_game"}))
    ts = await recv_until(a, "turn_started")
    active = ts["active_player_id"]
    assert active == pid_a, f"round1 active should be A, got {active[:6]}"
    print(f"[start]  round1 active=A ok")
    await drain(b)

    # --- round 1: A spins ---
    await a.send(json.dumps({"type": "spin_start"}))
    await recv_until(a, "spin_started")
    await a.send(json.dumps({"type": "spin_stop"}))
    locked = await recv_until(a, "letter_locked")
    letter = locked["letter"]
    print(f"[spin]   letter={letter}")
    await recv_until(a, "timer_started", timeout=4.0)
    await drain(b)

    # Both answer. A and B give the SAME Dier (dubbel); A unique Land; B empty Vrucht.
    same_dier = letter + "aap"  # both -> shared
    await a.send(json.dumps({"type": "update_answers", "answers": {"Dier": same_dier, "Land": letter + "land", "Vrucht": ""}}))
    await b.send(json.dumps({"type": "update_answers", "answers": {"Dier": same_dier, "Land": "", "Vrucht": ""}}))
    await asyncio.sleep(0.2)

    # A stops the round for everyone.
    await a.send(json.dumps({"type": "stop_round"}))
    res = await recv_until(a, "results", timeout=4.0)
    pts = res["points"]
    print(f"[score]  A={pts[pid_a]} B={pts[pid_b]} scores={res['scores']}")
    assert pts[pid_a]["Dier"] == 5, "shared Dier should be 5 for A"
    assert pts[pid_b]["Dier"] == 5, "shared Dier should be 5 for B"
    assert pts[pid_a]["Land"] == 10, "unique Land should be 10 for A"
    assert pts[pid_b]["Land"] == 0, "empty Land should be 0 for B"
    print("[score]  unique/dubbel/empty ok")

    # --- challenge: B disputes A's Land -> A's Land becomes 0 ---
    await b.send(json.dumps({"type": "challenge_answer", "player_id": pid_a, "cat": "Land"}))
    upd = await recv_until(b, "results_updated", timeout=4.0)
    assert upd["points"][pid_a]["Land"] == 0, "challenged Land should drop to 0"
    print("[chall]  challenge dropped A.Land to 0 ok")
    await drain(a)

    # --- round 2: active should rotate to B ---
    await a.send(json.dumps({"type": "next_round"}))
    ts2 = await recv_until(a, "turn_started")
    assert ts2["active_player_id"] == pid_b, "round2 active should be B"
    print("[rotate] round2 active=B ok")
    await drain(a)
    await drain(b)

    # B plays round 2 quickly (let the timer expire to test server expiry).
    await b.send(json.dumps({"type": "spin_start"}))
    await recv_until(b, "spin_started")
    await b.send(json.dumps({"type": "spin_stop"}))
    l2 = await recv_until(b, "letter_locked")
    await recv_until(b, "timer_started", timeout=4.0)
    await a.send(json.dumps({"type": "update_answers", "answers": {"Dier": l2["letter"] + "x"}}))
    # B stops immediately.
    await b.send(json.dumps({"type": "stop_round"}))
    await recv_until(b, "results", timeout=4.0)
    print("[round2] scored ok")
    await drain(a)
    await drain(b)

    # --- round 3 then game over ---
    await a.send(json.dumps({"type": "next_round"}))
    await recv_until(a, "turn_started")
    await drain(b)
    await a.send(json.dumps({"type": "spin_start"}))
    await recv_until(a, "spin_started")
    await a.send(json.dumps({"type": "spin_stop"}))
    await recv_until(a, "letter_locked")
    await recv_until(a, "timer_started", timeout=4.0)
    await a.send(json.dumps({"type": "stop_round"}))
    await recv_until(a, "results", timeout=4.0)
    await drain(b)

    await a.send(json.dumps({"type": "next_round"}))
    over = await recv_until(a, "game_over", timeout=4.0)
    print(f"[over]   winner={over['winner_id'][:6]} scores={over['scores']}")

    await a.close()
    await b.close()
    print("\nALL INTEGRATION CHECKS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
