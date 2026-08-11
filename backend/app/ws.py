"""Pen Neer — /ws endpoint and event router.

One WebSocket per client. Messages are JSON {type, ...payload}. The router maps
client intents to RoomManager methods; the manager owns all state and broadcasts.
"""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from . import rem, toezicht
from .rooms import RoomManager
from .social import accounts

router = APIRouter()
manager = RoomManager()


def _account_of(ws: WebSocket) -> dict | None:
    """The account bound to this connection (via account_login), if any."""
    uid = accounts.user_of(ws)
    return accounts.db.get_user(uid) if uid else None


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    player_id: str | None = None
    # De rem op de socket zelf. Een emmer en geen venster: tijdens het invullen
    # komt er elke 300 ms een bericht en na een ronde een klein salvo, en dat
    # moet gewoon door. Blijft het aanhouden, dan is het geen speler meer maar
    # een lus, en na WS_GEDULD geweigerde berichten gaat de verbinding dicht.
    emmer = rem.Emmer(rem.WS_DAK, rem.WS_VUL)
    te_druk = 0
    try:
        while True:
            data = await ws.receive_json()
            mtype = data.get("type")

            if not emmer.pak():
                te_druk += 1
                if te_druk == 1:
                    rem.noteer("socket")
                    await ws.send_json({"type": "error", "message": "Te veel berichten tegelijk."})
                if te_druk > rem.WS_GEDULD:
                    await ws.close(code=1008)
                    break
                continue
            te_druk = 0

            # --- accounts + social: connection-scoped, works outside rooms ---
            if await accounts.handle(ws, mtype, data):
                continue

            # --- pre-identity messages ---
            if mtype == "create_room":
                _, player = await manager.create_room(ws, data.get("name", ""), _account_of(ws),
                                                      cpu_game=bool(data.get("cpu")))
                player_id = player.id
                continue
            if mtype == "join_room":
                res = await manager.join_room(ws, data.get("code", ""), data.get("name", ""), _account_of(ws))
                if res:
                    player_id = res[1].id
                continue
            if mtype == "reconnect":
                res = await manager.reconnect(ws, data.get("code", ""), data.get("player_id", ""))
                if res:
                    player_id = res[1].id
                continue

            # --- admin is connection-scoped: works before joining a room ---
            if mtype == "admin_login":
                await manager.admin_login(ws, player_id, data)
                continue
            if mtype == "admin_set_ai":
                await manager.admin_set_ai(ws, player_id, data)
                continue
            if mtype == "admin_toezicht":
                await manager.admin_toezicht(ws, player_id, data)
                continue
            if mtype == "admin_rapporten":
                await manager.admin_rapporten(ws, player_id, data)
                continue
            if mtype == "admin_rapport_sluit":
                await manager.admin_rapport_sluit(ws, player_id, data)
                continue
            if mtype == "admin_stats":
                await manager.admin_stats(ws, player_id, data)
                continue
            if mtype == "admin_gen_ai_codes":
                await manager.admin_gen_ai_codes(ws, player_id, data)
                continue
            if mtype == "admin_cat_list":
                await manager.admin_cat_list(ws, player_id, data)
                continue
            if mtype == "admin_cat_create":
                await manager.admin_cat_create(ws, player_id, data)
                continue
            if mtype == "admin_cat_delete":
                await manager.admin_cat_delete(ws, player_id, data)
                continue

            # --- everything else needs an identity ---
            if player_id is None:
                await ws.send_json({"type": "error", "message": "Nog niet in een room."})
                continue

            if mtype == "update_settings":
                await manager.update_settings(player_id, data)
            elif mtype == "start_game":
                await manager.start_game(player_id)
            elif mtype == "spin_start":
                await manager.spin_start(player_id)
            elif mtype == "spin_stop":
                await manager.spin_stop(player_id)
            elif mtype == "update_answers":
                await manager.update_answers(player_id, data)
            elif mtype == "submit_answers":
                await manager.submit_answers(player_id, data)
            elif mtype == "set_ready":
                await manager.set_ready(player_id, data)
            elif mtype == "kreet":
                await manager.kreet(player_id, data)
            elif mtype == "rules_cancel":
                await manager.rules_cancel(player_id)
            elif mtype == "stop_round":
                await manager.stop_round(player_id)
            elif mtype == "add_bot":
                await manager.add_bot(player_id)
            elif mtype == "remove_bot":
                await manager.remove_bot(player_id, data)
            elif mtype == "challenge_answer":
                await manager.challenge_answer(player_id, data)
            elif mtype == "mark_same":
                await manager.mark_same(player_id, data)
            elif mtype == "next_round":
                await manager.next_round(player_id)
            elif mtype == "ready_next":
                await manager.ready_next(player_id)
            elif mtype == "chat_send":
                await manager.chat_send(player_id, data)
            elif mtype == "chat_delete":
                await manager.chat_delete(player_id, data)
            elif mtype == "chat_typing":
                await manager.chat_typing(player_id, data)
            elif mtype == "end_game":
                await manager.end_game(player_id)
            elif mtype == "play_again":
                await manager.play_again(player_id)
            elif mtype == "rematch":
                await manager.rematch(player_id)
            elif mtype == "invite_send":
                room = manager.room_of_player(player_id)
                if room:
                    kind = "challenge" if data.get("kind") == "challenge" else "invite"
                    await accounts.invite_send(ws, room.code, data.get("user_id") or "", kind)
            elif mtype == "leave_room":
                await manager.leave_room(player_id)
                player_id = None
            else:
                await ws.send_json({"type": "error", "message": f"Onbekend bericht: {mtype}"})

    except WebSocketDisconnect:
        manager.drop_connection(ws)
        await accounts.dropped(ws)
        if player_id is not None:
            await manager.disconnect(player_id)
    except Exception as exc:
        # Deze vangst gooide de fout stilzwijgend weg: geen regel in het log,
        # geen teller, dus een stukje dat voor iedereen kapot was viel pas op
        # als een speler het zei. Nu telt hij mee en staat hij in de meterkast.
        toezicht.fout("ws", exc)
        manager.drop_connection(ws)
        await accounts.dropped(ws)
        if player_id is not None:
            await manager.disconnect(player_id)
