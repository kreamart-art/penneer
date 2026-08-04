"""Pen Neer — FastAPI entrypoint.

Serves the WebSocket game endpoint and, in production, the built frontend as
static files. CORS is open in dev so Vite (5173) can reach the API.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import ai_referee, arena, daily, dagprijzen, discover, duel, game, missies_lang, missions, paypal, push
from . import topo
from .db import AVATAR_MAX_BYTES, get_db
from .social import accounts, _level_of
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


@app.on_event("startup")
async def _seed_kaarten() -> None:
    """Zet de kaartcatalogus van Ontdekken klaar bij het opstarten.

    Het seed-script is idempotent en raakt user_cards nooit aan, dus elke keer
    draaien is goedkoop en scheelt een handmatige stap na een deploy: de
    catalogus hoort bij de code, de verzameling van een speler bij de data.

    Faalt hij, dan blijft de app gewoon staan. Ontdekken is dan leeg, en dat is
    oneindig veel beter dan een server die niet opstart omdat een CSV een
    tikfout heeft.
    """
    try:
        scripts = Path(__file__).resolve().parents[1] / "scripts"
        if not (scripts / "seed_cards.py").is_file():
            return
        if str(scripts) not in sys.path:
            sys.path.insert(0, str(scripts))
        import seed_cards  # noqa: PLC0415

        n = seed_cards.seed(list(discover.CATEGORIES))
        if n:
            print(f"[ontdekken] catalogus bijgewerkt, {n} rijen")
    except Exception as e:  # noqa: BLE001
        print(f"[ontdekken] seeden overgeslagen: {e}")


@app.on_event("startup")
async def _start_herinneringen() -> None:
    """De lus die openstaande dingen aantikt: verzoeken en berichten die blijven
    liggen, en duels waar iemand op wacht.

    Een lus en geen cron, want er is geen cron in deze container. Elk half uur
    is ruim genoeg: alles zit achter een dagslot per speler per soort, dus de
    frequentie hier bepaalt alleen hoe snel een herinnering na zijn drempel
    vertrekt, niet hoe vaak iemand er een krijgt.

    De eerste ronde wacht een minuut: bij een herstart is de app nog bezig met
    opstarten, en dan is een veegbeurt over de hele gebruikerstabel het laatste
    wat er bij moet.
    """
    async def lus() -> None:
        await asyncio.sleep(60)
        while True:
            try:
                await accounts.herinneringen_ronde()
                await _duel_herinneringen(get_db())
            except Exception as exc:  # nooit de lus laten sneuvelen
                print(f"[penneer] herinneringen: {exc}", flush=True)
            await asyncio.sleep(1800)

    asyncio.create_task(lus())


async def _duel_herinneringen(db) -> None:
    """Duels waar iemand al een dag op je zet wacht.

    Niet elk openstaand duel: alleen die waar de ANDER al klaar is en jij nog
    niets deed. Een duel waar allebei nog niets aan deden is geen wachttijd
    maar gewoon een duel dat net begon.
    """
    nu = time.time()
    for d in db.duel_wachtend(nu - 24 * 3600):
        naam = (db.get_user(d["other"]) or {}).get("name") or "?"
        if db.melding_laatst(d["user_id"], "herinnering_duel") < nu - 24 * 3600:
            dagen = max(1, int((nu - float(d["created_at"])) // 86400))
            await accounts.stuur(d["user_id"], "herinnering_duel",
                                 data={"duel_id": d["id"]}, naam=naam, dagen=dagen)


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


# ---- foto's en stickers (chat + DM). Zelfde model als de spraakberichten:
# eerst over HTTP omhoog, daarna reist alleen het id over de socket.
#
# Waarom een lijst met toegestane typen en niet gewoon "image/": een SVG is een
# afbeelding met een script erin, en die zou hier in andermans gesprek
# uitgevoerd worden. Deze vier zijn beeld en verder niets. WebP staat vooraan
# omdat stickers uit WhatsApp precies dat zijn.
BEELD_TYPEN = {"image/webp", "image/png", "image/jpeg", "image/gif"}
BEELD_MAX_BYTES = 3_000_000
BEELD_KEEP_PER_ROOM = 24


def _beeld_mime(request: Request) -> str | None:
    mime = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    return mime if mime in BEELD_TYPEN else None


@app.post("/api/image/{code}")
async def upload_room_image(code: str, request: Request):
    """Een speler in de room zet een plaatje neer; het id gaat in chat_send."""
    room = manager.rooms.get(code.upper())
    player_id = request.query_params.get("player") or ""
    if room is None or room.get_player(player_id) is None:
        return Response(status_code=403)
    mime = _beeld_mime(request)
    if mime is None:
        return Response(status_code=400)
    body = await request.body()
    if not body or len(body) > BEELD_MAX_BYTES:
        return Response("Afbeelding is te groot.", status_code=413)
    iid = uuid.uuid4().hex
    room.beeld[iid] = (mime, body)
    while len(room.beeld) > BEELD_KEEP_PER_ROOM:
        room.beeld.pop(next(iter(room.beeld)))
    return JSONResponse({"id": iid})


@app.get("/api/image/{code}/{iid}")
async def get_room_image(code: str, iid: str) -> Response:
    room = manager.rooms.get(code.upper())
    entry = room.beeld.get(iid) if room else None
    if entry is None:
        return Response(status_code=404)
    mime, body = entry
    return Response(body, media_type=mime, headers={"Cache-Control": "private, max-age=3600"})


@app.post("/api/dm/image")
async def upload_dm_image(request: Request):
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid is None:
        return Response(status_code=401)
    mime = _beeld_mime(request)
    if mime is None:
        return Response(status_code=400)
    body = await request.body()
    if not body or len(body) > BEELD_MAX_BYTES:
        return Response("Afbeelding is te groot.", status_code=413)
    return JSONResponse({"id": db.dm_image_store(uid, mime, body)})


@app.get("/api/dm/image/{iid}")
async def get_dm_image(iid: str) -> Response:
    entry = get_db().dm_image_get(iid)
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
    # Ontdekken stuurt de letter van vandaag mee: dan gaat de ronde over de
    # letter waar de hub je op wijst in plaats van een willekeurige. De server
    # keurt hem wel: alleen een letter die ook los te trekken zou zijn.
    gevraagd = str((body or {}).get("letter") or "").strip().upper()[:1]
    if gevraagd and gevraagd in game.letter_pool(True):
        letter = gevraagd
    else:
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
    seen: list[tuple[str, str | None, list[str]]] = []  # (cat, eigen woord, getoonde woorden)
    # Ontdekken haakt hier in. Optioneel: een gast speelt precies zoals eerst.
    db = get_db()
    uid = db.auth(_bearer(request))
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
        # De reveal is afgekapt op TRAIN_REVEAL_CAP en `missed` staat op
        # alfabet, dus zonder ingreep krijgt een speler elke ronde exact
        # dezelfde twaalf woorden te zien en zijn de kaarten daarachter nooit
        # te halen: letter B bleef op 10 van de 17 steken.
        #
        # Voor een ingelogde speler zetten we daarom de woorden die hij nog
        # niet heeft vooraan. Zelfde lijst, zelfde aantal, alleen een andere
        # volgorde, en de sortering is stabiel dus binnen elke groep blijft het
        # alfabet staan. Een gast ziet exact wat hij altijd al zag.
        dcat_pre = discover.LIST_TO_CAT.get(cat)
        if uid and dcat_pre:
            index = db.discover_card_index(dcat_pre)
            owned = db.discover_owned_card_ids(uid, dcat_pre)
            missed.sort(key=lambda w: index.get(game.normalize(w)) in owned)
        shown = missed[:TRAIN_REVEAL_CAP]
        out[cat] = {
            "your": word,
            "valid": valid,
            "in_list": in_list,
            "missed": shown,
            "missed_total": len(missed),
            "list_total": len(all_words),
        }
        seen.append((cat, canon if in_list else None, shown))
    # Ontdekken: wat je noemde en wat je daarna te zien kreeg wordt een kaart.
    # Alleen `shown` telt en niet `missed`, want je kunt niet verzamelen wat je
    # nooit gezien hebt: de reveal is afgekapt op TRAIN_REVEAL_CAP.
    new_cards: list[dict] = []
    if uid:
        for cat, own, shown in seen:
            dcat = discover.LIST_TO_CAT.get(cat)
            if not dcat:
                continue  # categorie zonder curated lijst, dus zonder kaarten
            words = ([own] if own else []) + shown
            norms = discover.match_words(dcat, letter, words)
            known = frozenset(discover.match_words(dcat, letter, [own])) if own else frozenset()
            new_cards.extend(db.discover_unlock(uid, dcat, norms, source="practice", known=known))
    return JSONResponse({
        "letter": letter,
        "categories": out,
        "correct": correct,
        "learned": learned,
        "new_cards": new_cards,
    })


# ---- Ontdekken (discover: every practised word becomes a collectible card) --
# Read-only in deze fase. Alles wat vrijkomt wordt server-side afgeleid uit
# ingediende antwoorden (fase 2), nooit door de client bepaald.
#
# Een gast mag rondkijken: hij ziet de catalogus met alles op discovered=false,
# zodat de modus uitlegbaar is zonder account. Verzamelen vereist inloggen.


def _discover_uid(request: Request) -> str | None:
    """De speler, of None voor een gast. Geen 401: rondkijken mag."""
    return get_db().auth(_bearer(request))


@app.get("/api/discover/overview")
async def discover_overview(request: Request) -> JSONResponse:
    """De hub: per categorie de voortgang, plus dagletter, streak en herhaalstapel."""
    db = get_db()
    uid = _discover_uid(request)
    totals = db.discover_totals()
    owned = db.discover_owned_counts(uid) if uid else {}
    rows = []
    for cat in discover.CATEGORIES:
        total = totals.get(cat, 0)
        got = owned.get(cat, 0)
        rows.append({
            "category": cat,
            "label": discover.CAT_LABEL[cat],
            "total": total,
            "discovered": got,
            # Afgerond naar beneden, zodat 99% pas 100% wordt als het echt af is.
            "percent": int(got * 100 / total) if total else 0,
        })
    state = db.discover_state(uid) if uid else {}
    dag = discover.today()
    dagletter = discover.daily_letter(uid, dag) if uid else None
    # Kan de speler de dagletter ook echt spelen? Zonder eigen kaarten van die
    # letter valt er niets te vragen, en dan hoort er geen quizknop te staan
    # maar de weg naar Oefenen: eerst verzamelen, dan overhoren.
    speelbaar = False
    if uid and dagletter:
        for cat in discover.CATEGORIES:
            if db.discover_quiz_kandidaten(cat, dagletter, uid, alleen_van_mij=True):
                speelbaar = True
                break
    return JSONResponse({
        "categories": rows,
        "fact_schema": {c: list(discover.fact_rows(c)) for c in discover.CATEGORIES},
        # BEREKEND en niet uit de tabel: daar staat alleen wat er gespeeld is,
        # en een speler die vandaag nog niets deed hoort zijn letter wel te zien.
        "daily_letter": dagletter,
        "daily_letter_date": dag,
        "daily_gespeeld": state.get("last_played_date") == dag,
        "daily_speelbaar": speelbaar,
        "streak_days": state.get("streak_days", 0),
        "review_due": db.discover_due_count(uid) if uid else 0,
        "recent": db.discover_recent(uid, 4) if uid else [],
        "guest": uid is None,
    })


@app.get("/api/discover/category/{category}")
async def discover_category(category: str, request: Request) -> JSONResponse:
    """De 26 lettertegels van een categorie, met per letter total en discovered."""
    if category not in discover.CATEGORIES:
        return JSONResponse({"error": "categorie"}, status_code=404)
    db = get_db()
    uid = _discover_uid(request)
    by_letter = {r["letter"]: r for r in db.discover_letters(category, uid)}
    letters = [
        by_letter.get(l, {"letter": l, "total": 0, "discovered": 0})
        for l in discover.LETTERS
    ]
    # '#' vangt woorden die niet op A..Z beginnen. Alleen meesturen als er iets
    # in zit, anders staat er een lege tegel in het raster die nooit vult.
    if "#" in by_letter:
        letters.append(by_letter["#"])
    total = sum(l["total"] for l in letters)
    got = sum(l["discovered"] for l in letters)
    return JSONResponse({
        "category": category,
        "label": discover.CAT_LABEL[category],
        "total": total,
        "discovered": got,
        "percent": int(got * 100 / total) if total else 0,
        "letters": letters,
        "fact_schema": list(discover.fact_rows(category)),
        "guest": uid is None,
    })


@app.get("/api/discover/category/{category}/letter/{letter}")
async def discover_letter(category: str, letter: str, request: Request) -> JSONResponse:
    """De kaarten van één letter. Niet ontdekte kaarten komen leeg terug."""
    if category not in discover.CATEGORIES:
        return JSONResponse({"error": "categorie"}, status_code=404)
    key = (letter or "").strip().upper()[:1] or "#"
    if key not in discover.LETTERS and key != "#":
        return JSONResponse({"error": "letter"}, status_code=404)
    db = get_db()
    uid = _discover_uid(request)
    cards = db.discover_cards_for_letter(category, key, uid)
    return JSONResponse({
        "category": category,
        "label": discover.CAT_LABEL[category],
        "letter": key,
        "total": len(cards),
        "discovered": sum(1 for c in cards if c["discovered"]),
        "cards": cards,
        "fact_schema": list(discover.fact_rows(category)),
        "guest": uid is None,
    })


@app.post("/api/discover/unlock")
async def discover_unlock(request: Request) -> JSONResponse:
    """Zet de woorden van een ronde om in kaarten. Geeft alleen de nieuwe terug.

    De client stuurt wel welke woorden er speelden, maar bepaalt niet wat ze
    waard zijn: match_words gooit alles weg dat niet op de curated lijst van
    precies deze categorie en letter staat. Een verzonnen verzoek kan dus nooit
    meer opleveren dan één echte ronde van dezelfde letter ook had gegeven.
    """
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json() or {}
    category = str(body.get("category") or "")
    if category not in discover.CATEGORIES:
        return JSONResponse({"error": "categorie"}, status_code=400)
    letter = (str(body.get("letter") or "").strip().upper() or "?")[:1]
    source = str(body.get("source") or "practice")
    if source not in discover.SOURCES:
        source = "practice"
    norms = discover.match_words(category, letter, body.get("words") or [])
    known = frozenset(discover.match_words(category, letter, body.get("known") or []))
    new_cards = db.discover_unlock(uid, category, norms, source=source, known=known)
    return JSONResponse({"new_cards": new_cards, "count": len(new_cards)})


# ---- Ontdekken: dagletter, quiz en herhaling --------------------------------
# De quizsessies staan in het geheugen, net als de rooms: een ronde duurt een
# minuut en overleeft een herstart niet, en dat is prima. Ze in de database
# zetten zou betekenen dat elke tik op een antwoord een schrijfactie is voor
# iets dat morgen niets meer betekent.

_QUIZ: dict[str, dict] = {}
_QUIZ_TTL = 30 * 60


def _quiz_opruimen(now: float) -> None:
    """Sessies die niemand meer afmaakt weggooien, zodat het geheugen niet loopt."""
    for sid in [k for k, v in _QUIZ.items() if now - v["gestart"] > _QUIZ_TTL]:
        _QUIZ.pop(sid, None)


@app.get("/api/discover/daily")
async def discover_daily(request: Request) -> JSONResponse:
    """De letter van vandaag, plus de stand van de reeks.

    Alleen LEZEN: de reeks gaat pas omhoog als de speler de letter uitspeelt
    (zie /quiz/finish). Anders houd je hem in stand door elke dag even te
    kijken, en dan meet hij niets.
    """
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    dag = discover.today()
    letter = discover.daily_letter(uid, dag)
    stand = db.discover_state(uid)
    return JSONResponse({
        "letter": letter,
        "day": dag,
        "streak_days": stand.get("streak_days", 0),
        "gespeeld": stand.get("last_played_date") == dag,
        "review_due": db.discover_due_count(uid),
    })


@app.post("/api/discover/quiz/start")
async def discover_quiz_start(request: Request) -> JSONResponse:
    """Vijf vragen. Het juiste antwoord blijft op de server."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json() or {}
    category = str(body.get("category") or "")
    if category not in discover.CATEGORIES:
        return JSONResponse({"error": "categorie"}, status_code=400)
    mode = str(body.get("mode") or "letter")
    letter = (str(body.get("letter") or "").strip().upper() or None)
    if letter and letter not in discover.LETTERS:
        letter = None

    now = time.time()
    _quiz_opruimen(now)

    if mode == "review":
        # Herhalen gaat over WAT JE HEBT, en de stapel bepaalt welke kaarten.
        stapel = db.discover_review_stapel(uid, discover.REVIEW_LIMIET, now)
        if not stapel:
            return JSONResponse({"error": "niets_te_herhalen"}, status_code=400)
        kandidaten = stapel
    else:
        kandidaten = db.discover_quiz_kandidaten(category, letter, uid, alleen_van_mij=True)
        if not kandidaten:
            return JSONResponse({"error": "geen_kaarten"}, status_code=400)

    # Gevraagd wordt alleen over kaarten die de speler HEEFT; de foute
    # antwoorden komen uit de hele categorie, want met een handvol kaarten in
    # bezit zou elke vraag dezelfde vier opties krijgen.
    vragen = discover.maak_vragen(
        kandidaten, category, pool=db.discover_quiz_kandidaten(category),
    )
    if not vragen:
        return JSONResponse({"error": "geen_vragen"}, status_code=400)

    sid = uuid.uuid4().hex
    _QUIZ[sid] = {
        "user": uid, "category": category, "letter": letter, "mode": mode,
        "vragen": vragen, "antwoorden": {}, "gestart": now,
    }
    return JSONResponse({
        "session_id": sid,
        "mode": mode,
        "category": category,
        "letter": letter,
        "vragen": discover.zonder_antwoord(vragen),
    })


@app.post("/api/discover/quiz/answer")
async def discover_quiz_answer(request: Request) -> JSONResponse:
    """Goed of fout, plus wat het juiste antwoord was."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json() or {}
    sessie = _QUIZ.get(str(body.get("session_id") or ""))
    if not sessie or sessie["user"] != uid:
        return JSONResponse({"error": "sessie"}, status_code=404)
    try:
        i = int(body.get("question_index"))
    except (TypeError, ValueError):
        return JSONResponse({"error": "vraag"}, status_code=400)
    if not 0 <= i < len(sessie["vragen"]):
        return JSONResponse({"error": "vraag"}, status_code=400)

    vraag = sessie["vragen"][i]
    # Een tweede antwoord op dezelfde vraag telt niet: anders tik je door tot
    # het goed is en betekent de uitslag niets.
    if i in sessie["antwoorden"]:
        eerder = sessie["antwoorden"][i]
        return JSONResponse({"goed": eerder, "juist": vraag["juist"], "opnieuw": True})

    gegeven = str(body.get("answer") or "").strip()
    goed = gegeven == vraag["juist"]
    sessie["antwoorden"][i] = goed
    return JSONResponse({"goed": goed, "juist": vraag["juist"]})


@app.post("/api/discover/quiz/finish")
async def discover_quiz_finish(request: Request) -> JSONResponse:
    """Sluit de ronde: Leitner bijwerken, belonen, en de reeks als het de
    dagletter was."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json() or {}
    sid = str(body.get("session_id") or "")
    sessie = _QUIZ.get(sid)
    if not sessie or sessie["user"] != uid:
        return JSONResponse({"error": "sessie"}, status_code=404)

    now = time.time()
    goed = 0
    for i, vraag in enumerate(sessie["vragen"]):
        antwoord = sessie["antwoorden"].get(i)
        if antwoord is None:
            continue  # niet beantwoord: niet fout rekenen, maar ook niet belonen
        goed += 1 if antwoord else 0
        db.discover_antwoord_verwerkt(uid, vraag["card_id"], bool(antwoord), now)

    beantwoord = len(sessie["antwoorden"])
    # Bescheiden en voorspelbaar: dit is oefenen, geen ranglijst. Wie alles goed
    # heeft krijgt een klein extraatje, zodat een volle ronde de moeite is.
    xp = goed * 4 + (6 if goed and goed == len(sessie["vragen"]) else 0)
    munten = goed * 2 + (5 if goed and goed == len(sessie["vragen"]) else 0)
    if xp:
        db.add_bonus_xp(uid, xp)
    if munten:
        db.grant_coins(uid, munten)

    # Was dit de dagletter? Dan telt de reeks, maar alleen nu hij is uitgespeeld.
    dag = discover.today()
    reeks = None
    if sessie["mode"] == "letter" and sessie["letter"] == discover.daily_letter(uid, dag):
        reeks = db.discover_dag_afgerond(uid, sessie["letter"], dag)

    _QUIZ.pop(sid, None)
    return JSONResponse({
        "goed": goed,
        "totaal": len(sessie["vragen"]),
        "beantwoord": beantwoord,
        "xp": xp,
        "munten": munten,
        "streak_days": (reeks or {}).get("streak_days"),
        "review_due": db.discover_due_count(uid),
    })


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


def _met_prijzen(board: list[dict]) -> list[dict]:
    """Hang aan elke rij de prijs die bij die plek hoort.

    De volgorde van de lijst IS de rangschikking, dus de index bepaalt de plek.
    """
    return [{**rij, "prijs": dagprijzen.prijs_voor(i + 1)} for i, rij in enumerate(board)]


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
        # Het topografiedeel is een eigen potje met een eigen ranglijst; je kunt
        # er los van het woordendeel aan meedoen.
        "topo_played": bool(uid and db.topo_entry(uid, day)),
        # De arena telt mee voor het knopje op de dagronde-tegel: drie
        # onderdelen, dus drie dingen die nog open kunnen staan. Hij heeft geen
        # "gedaan"-toestand zoals de andere twee (je mag onbeperkt spelen), dus
        # hier is de vraag simpelweg: heb je vandaag al een poging afgerond?
        "arena_played": bool(uid and db.arena_mijn(uid, day)["pogingen"] > 0),
        "topo_players": db.topo_players_count(day),
        # De STAND van vandaag, voor de uitslag-popup op de main page. EEN
        # lijst: de twee delen zijn twee potjes, maar de dagwinnaar is degene
        # met het hoogste dagtotaal. De prijs hangt aan de RIJ en niet aan de
        # client, zodat de ladder op een plek staat en de popup nooit iets kan
        # tonen wat je niet krijgt.
        "board": _met_prijzen(db.dag_totaal_board(day, 25)),
        "total_players": db.dag_totaal_players_count(day),
        # Waar JIJ staat, zodat de popup je eigen plek kan aanwijzen zonder de
        # hele lijst te hoeven doorzoeken (je kunt buiten de top 25 vallen).
        "rank": (db.dag_totaal_rank(uid, day)[0] if uid else 0),
        # Wat er vandaag bovenaan te winnen valt. Uit dezelfde ladder als de
        # uitbetaling, want een kop die zijn eigen bedragen bijhoudt gaat vroeg
        # of laat iets beloven wat niet wordt uitbetaald. Het bord kan leeg zijn
        # (nog niemand gespeeld), dus dit kan niet uit rij een van het bord.
        "prijs_top": dagprijzen.prijs_voor(1),
    })


@app.get("/api/daily/uitslag")
async def daily_uitslag(request: Request) -> JSONResponse:
    """De uitslag van de ronde die het laatst SLOOT, één keer per speler.

    Dit is het moment van 21:00: de stand is definitief, de prijs wordt hier
    uitbetaald en de client mag hem tonen. Leeg antwoord betekent: niets te
    vieren (je deed niet mee, of je hebt hem al gezien).

    De lopende ronde draagt de datum waarop hij sluit, dus de laatst gesloten
    ronde is per definitie de dag daarvoor.
    """
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({})
    dag = daily.previous_day(daily.today())
    # Geen terugwerkende uitbetaling. De rondes van voor deze functie liepen tot
    # middernacht en hadden geen prijzen; die alsnog uitkeren zou op de dag van
    # uitrollen in een keer de halve muntvoorraad de wereld in gooien. De eerste
    # ronde die meetelt is dus de ronde die liep toen dit aanging.
    vanaf = db.meta_get("uitslag_vanaf")
    if not vanaf:
        vanaf = daily.today()
        db.meta_set("uitslag_vanaf", vanaf)
    if dag < vanaf:
        return JSONResponse({})
    bon = db.dag_uitslag(uid, dag, time.time())
    if not bon or bon["gezien"]:
        return JSONResponse({})
    return JSONResponse({
        "day": dag,
        "plek": bon["plek"],
        "spelers": bon["spelers"],
        "score": bon["score"],
        "prijs": {"coins": bon["coins"], "cash": bon["cash"], "kist": bon["kist"]},
        "board": _met_prijzen(db.dag_totaal_board(dag, 25)),
    })


@app.post("/api/daily/uitslag/gezien")
async def daily_uitslag_gezien(request: Request) -> JSONResponse:
    db = get_db()
    uid = db.auth(_bearer(request))
    if uid:
        db.dag_uitslag_gezien(uid, daily.previous_day(daily.today()))
    return JSONResponse({"ok": True})


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
            # Dagronde-coins: meedoen levert altijd iets op, en je score doet
            # ertoe. 20 basis + 1 per punt, dus 20..~80. Achter de ranked-poort:
            # alleen een echte (eerste of vers herkanste) inzending betaalt. Na
            # een herkansing betaalt hij nog een keer, en dat is prima: die
            # kostte 500, dus winst maken kan er nooit op.
            if ranked:
                db.grant_coins(uid, 20 + max(0, int(score)))
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


# ---- topografie: het tweede deel van de Dagronde ----------------------------
# Zelfde vorm als de dagronde hierboven: dezelfde vragen voor iedereen, afgeleid
# uit de datum, een inzending per account per dag, en een eigen dagranglijst.


def _topo_streak(db, uid: str, day: str) -> int:
    days = set(db.topo_days_of(uid))
    streak = 0
    d = day
    while d in days:
        streak += 1
        d = daily.previous_day(d)
    return streak


def _topo_result_payload(db, uid: str, day: str, score: int, breakdown: list, ranked: bool, time_ms: int, lang: str) -> dict:
    rank, total = db.topo_rank(uid, day) if uid else (0, db.topo_players_count(day))
    qs = {q["id"]: q for q in topo.public_questions(day, lang)}
    return {
        "day": day,
        "score": score,
        "questions": [{**row, "q": qs.get(row["id"], {}).get("q", "")} for row in breakdown],
        "ranked": ranked,
        "rank": rank,
        "total": total,
        "streak": _topo_streak(db, uid, day) if uid else 0,
        "time_ms": time_ms,
        "board": db.topo_board(day, 10),
        "seconds_left": daily.seconds_to_next_day(),
        "max_score": topo.QUESTIONS_PER_DAY * topo.POINTS_PER_ANSWER,
    }


@app.post("/api/daily/topo/start")
async def topo_start(request: Request) -> JSONResponse:
    """Begin het topografiedeel. Geeft alleen HOEVEEL vragen er zijn, niet de
    vragen zelf: die worden een voor een uitgeserveerd, zodat je niet vooruit
    kunt lezen en de klok per vraag bij de server ligt."""
    db = get_db()
    day = daily.today()
    uid = db.auth(_bearer(request))
    if uid and db.topo_entry(uid, day):
        return JSONResponse({"day": day, "played": True, "seconds_left": daily.seconds_to_next_day()})
    if uid:
        db.topo_start(uid, day, time.time())
    return JSONResponse({
        "day": day,
        "total": topo.QUESTIONS_PER_DAY,
        "seconds": topo.QUESTION_S,
        "played": False,
    })


@app.post("/api/daily/topo/serve")
async def topo_serve(request: Request) -> JSONResponse:
    """Deel EEN vraag uit en stempel wanneer dat gebeurde. Opnieuw opvragen geeft
    dezelfde vraag met de resterende tijd, nooit een nieuwe klok."""
    db = get_db()
    body = await request.json()
    lang = "en" if str((body or {}).get("lang") or "nl").startswith("en") else "nl"
    idx = max(0, min(topo.QUESTIONS_PER_DAY - 1, int((body or {}).get("idx") or 0)))
    day = daily.today()
    uid = db.auth(_bearer(request))
    qs = topo.public_questions(day, lang)
    q = qs[idx]
    if not uid:
        # Gasten spelen ongerangschikt; hun klok loopt in de app zelf, want er is
        # niets om aan vast te leggen.
        return JSONResponse({"idx": idx, "id": q["id"], "q": q["q"], "seconds": topo.QUESTION_S, "seconds_left": topo.QUESTION_S, "total": len(qs)})
    served = db.topo_serve(uid, day, idx, time.time())
    left = max(0, topo.QUESTION_S - (time.time() - served))
    return JSONResponse({"idx": idx, "id": q["id"], "q": q["q"], "seconds": topo.QUESTION_S, "seconds_left": round(left, 1), "total": len(qs)})


@app.post("/api/daily/topo/answer")
async def topo_answer(request: Request) -> JSONResponse:
    """Leg het antwoord op EEN vraag vast. Per vraag krijg je een kans."""
    db = get_db()
    body = await request.json()
    idx = max(0, min(topo.QUESTIONS_PER_DAY - 1, int((body or {}).get("idx") or 0)))
    answer = str((body or {}).get("answer") or "")[:40]
    uid = db.auth(_bearer(request))
    if uid:
        db.topo_answer_set(uid, daily.today(), idx, answer, time.time())
    return JSONResponse({"ok": True})


@app.post("/api/daily/topo/submit")
async def topo_submit(request: Request) -> JSONResponse:
    db = get_db()
    body = await request.json()
    lang = "en" if str((body or {}).get("lang") or "nl").startswith("en") else "nl"
    day = daily.today()
    uid = db.auth(_bearer(request))
    now = time.time()
    lenient = db.lenient_of(uid) if uid else False

    entry = db.topo_entry(uid, day) if uid else None
    if entry is not None:
        # Al op het bord: geef de OPGESLAGEN uitslag terug, beoordeeld met de
        # instelling waarmee toen is ingeleverd.
        try:
            stored = json.loads(entry["answers"])
        except Exception:
            stored = {}
        _, breakdown = topo.score_answers(day, stored, lenient=bool(entry.get("lenient")))
        return JSONResponse({**_topo_result_payload(db, uid, day, int(entry["score"]), breakdown, True, int(entry["time_ms"]), lang), "already": True})

    qs = topo.questions_for(day)
    if uid:
        # De antwoorden komen uit de opslag, niet uit dit verzoek: ze zijn per
        # vraag vastgelegd toen ze werden gegeven. Een antwoord dat te laat kwam
        # telt niet mee, en de tijd is de som van wat elke vraag kostte.
        answers: dict = {}
        spent = 0.0
        by_idx = {row["idx"]: row for row in db.topo_progress_of(uid, day)}
        for i, q in enumerate(qs):
            row = by_idx.get(i)
            if not row:
                spent += topo.QUESTION_S
                continue
            took = (row["answered_at"] - row["served_at"]) if row["answered_at"] else topo.QUESTION_S
            spent += min(max(took, 0.0), topo.QUESTION_S)
            if row["answer"] and took <= topo.QUESTION_S + topo.GRACE_S:
                answers[q["id"]] = row["answer"]
    else:
        answers = {str(k)[:32]: str(v)[:40] for k, v in ((body or {}).get("answers") or {}).items()}
        spent = float(topo.DURATION_S)

    score, breakdown = topo.score_answers(day, answers, lenient=lenient)
    ranked = False
    time_ms = 0
    if uid:
        time_ms = int(min(max(spent, 1.0), topo.DURATION_S) * 1000)
        ranked = db.topo_submit(uid, day, score, time_ms, json.dumps(answers)[:4000], now, lenient=lenient)
        if ranked:
            # Zelfde beloningsvorm als het woordendeel: 20 basis + 1 per punt,
            # eenmalig per dag, want `ranked` is de eerste echte inzending.
            db.grant_coins(uid, 20 + max(0, int(score)))
    return JSONResponse({**_topo_result_payload(db, uid, day, score, breakdown, ranked, time_ms, lang), "already": False})


@app.get("/api/daily/topo/result")
async def topo_result(request: Request) -> JSONResponse:
    """Sla de opgeslagen uitslag van vandaag weer open (alleen accounts)."""
    db = get_db()
    day = daily.today()
    uid = db.auth(_bearer(request))
    lang = "en" if str(request.query_params.get("lang") or "nl").startswith("en") else "nl"
    entry = db.topo_entry(uid, day) if uid else None
    if not uid or entry is None:
        return JSONResponse({"error": "not_played"}, status_code=404)
    try:
        stored = json.loads(entry["answers"])
    except Exception:
        stored = {}
    _, breakdown = topo.score_answers(day, stored, lenient=bool(entry.get("lenient")))
    return JSONResponse(_topo_result_payload(db, uid, day, int(entry["score"]), breakdown, True, int(entry["time_ms"]), lang))


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
        "divisie": int(u.get("divisie") or 0),
        # Het schild onder de ring draagt je level, dus dat moet mee.
        "level": _level_of(db.stats_of(user_id))["level"],
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
        # De inzet per persoon en of hij al vastligt. Zolang hij niet vastligt
        # moet de TEGENSTANDER hem eerst aannemen (of verlagen) voor die kan
        # spelen; de uitdager wacht gewoon.
        "stake": int(d.get("stake") or 0),
        "stake_accepted": bool(d.get("stake_accepted")),
        "stakes": list(db.DUEL_STAKES),
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
    # duel_finish zegt of WIJ hem dichtzetten. Zo niet, dan was de sweep of het
    # andere antwoord ons voor en is de pot daar al uitgekeerd.
    if not db.duel_finish(d["id"], winner):
        return
    db.duel_stake_payout(d, winner)

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
        await accounts.stuur(uid, "duel_klaar", data={"duel_id": d["id"]},
                             naam=name, uitslag=f"{verdict} met {mine} - {opp}")
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
            uid = d["a"] if played_a else d["b"]
            if not db.duel_finish(d["id"], uid):
                continue
            db.duel_stake_payout(d, uid)
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


# Hoe lang de werfactie loopt. Een actie zonder eind is geen actie maar een
# knop, en dan haast niemand zich. Twee weken is de maat die werkt: lang genoeg
# om echt vrienden te vragen, kort genoeg om een gebeurtenis te zijn. Zet
# PENNEER_REFERRAL_END (ISO-tijd) om hem te verschuiven of te verlengen.
REFERRAL_END = os.environ.get("PENNEER_REFERRAL_END", "2026-08-11T23:59:59+02:00")


def _referral_ends_at() -> float:
    try:
        return datetime.fromisoformat(REFERRAL_END).timestamp()
    except (TypeError, ValueError):
        return 0.0


@app.get("/api/referral/info")
async def referral_info(request: Request) -> JSONResponse:
    """Alles wat de werf-advertentie nodig heeft: je code, hoeveel vrienden er
    al binnen zijn, en wat er per mijlpaal klaarstaat."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    code = db.referral_code_of(uid)
    aantal = db.referral_count(uid)
    opgehaald = set(db.referral_claimed(uid))
    tiers = []
    for t in db.REFERRAL_TIERS:
        tiers.append({**t, "reached": aantal >= t["n"], "claimed": t["n"] in opgehaald})
    # De herhaalregel erbij, maar alleen zolang hij speelt: pas tonen als de
    # ladder op is, en dan alleen de eerstvolgende.
    laatste = db.REFERRAL_TIERS[-1]["n"]
    for n in range(laatste + 1, aantal + 2):
        tiers.append({
            "n": n, "kind": "coins", "amount": db.REFERRAL_DAARNA,
            "reached": aantal >= n, "claimed": n in opgehaald,
        })
    einde = _referral_ends_at()
    return JSONResponse({
        "code": code,
        "count": aantal,
        "tiers": tiers,
        "repeat": db.REFERRAL_DAARNA,
        "ends_at": einde,
        # Voorbij de einddatum is de advertentie klaar; wat al verdiend is blijft
        # gewoon op te halen, dus dit sluit alleen het WERVEN af.
        "over": bool(einde and time.time() > einde),
    })


@app.post("/api/referral/claim")
async def referral_claim(request: Request) -> JSONResponse:
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json()
    try:
        milestone = int((body or {}).get("milestone") or 0)
    except (TypeError, ValueError):
        milestone = 0
    uitkomst = db.referral_claim(uid, milestone)
    if uitkomst != "ok":
        return JSONResponse({"error": uitkomst}, status_code=400)
    u = db.get_user(uid) or {}
    return JSONResponse({"ok": True, "coins": u.get("coins", 0), "ai_unlocked": bool(u.get("ai_unlocked"))})


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
    # De inzet. 0 is een geldige keuze: wedden is een optie, geen plicht. De
    # coins van de uitdager gaan METEEN in de pot, binnen duel_create zelf,
    # zodat je je inzet niet kunt uitgeven terwijl het duel loopt.
    stake = int((body or {}).get("stake") or 0)
    if stake not in db.DUEL_STAKES:
        return JSONResponse({"error": "stake"}, status_code=400)
    used, combos = db.duel_pair_state(uid, other)
    rounds, new_used, new_combos = duel.pick_rounds(used, combos)
    did = db.duel_create(uid, other, rounds, time.time() + duel.EXPIRY_H * 3600, stake=stake)
    if did is None:
        return JSONResponse({"error": "coins"}, status_code=402)
    db.duel_pair_set(uid, other, new_used, new_combos)
    name = (db.get_user(uid) or {}).get("name") or "?"
    await accounts.stuur(other, "uitdaging", data={"duel_id": did}, naam=name,
                         inzet=f" om {stake} coins" if stake else "")
    await accounts.push_account(uid)
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
    # De tegenstander speelt pas als de inzet vastligt (aannemen of verlagen).
    # De uitdager mag alvast: zijn helft van de pot staat er al in.
    if not d.get("stake_accepted") and uid == d["b"]:
        return JSONResponse({"error": "stake_open"}, status_code=409)
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


@app.post("/api/duel/{duel_id}/stake")
async def duel_stake(duel_id: str, request: Request) -> JSONResponse:
    """De tegenstander neemt de inzet aan of zet hem lager; het verschil gaat
    meteen terug naar de uitdager. Verhogen kan niet: dan wed je met andermans
    geld. Beide spelers krijgen daarna hun verse saldo gepusht."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    d = db.duel_get(duel_id)
    if not d or uid != d["b"]:
        return JSONResponse({"error": "not_found"}, status_code=404)
    body = await request.json()
    result = db.duel_stake_accept(duel_id, uid, int((body or {}).get("stake") or 0))
    if result != "ok":
        return JSONResponse({"error": result}, status_code=402 if result == "insufficient" else 400)
    await accounts.push_account(uid)
    await accounts.push_account(d["a"])
    d = db.duel_get(duel_id)
    # De UITDAGER hoort te horen waar er nu echt om gespeeld wordt: hij zette
    # iets in en de ander mocht dat verlagen, dus zonder deze melding zou hij
    # dat pas merken als het duel al klaar is.
    naam = (db.get_user(uid) or {}).get("name") or "?"
    n = int(d.get("stake") or 0)
    await accounts.stuur(d["a"], "duel_inzet", data={"duel_id": duel_id}, naam=naam,
                         inzet=f" om {n} coins" if n else " zonder inzet")
    return JSONResponse(_duel_payload(db, uid, d))


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
            await accounts.stuur(other, "duel_beurt", data={"duel_id": duel_id}, naam=name)
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
    # Een herkansing is een NIEUWE uitdaging en kiest dus opnieuw een inzet: hem
    # stilzwijgend op nul zetten zou het duel van zijn inzet ontdoen zonder dat
    # iemand daarvoor koos.
    body = await request.json()
    stake = int((body or {}).get("stake") or 0)
    if stake not in db.DUEL_STAKES:
        return JSONResponse({"error": "stake"}, status_code=400)
    used, combos = db.duel_pair_state(uid, other)
    rounds, new_used, new_combos = duel.pick_rounds(used, combos)
    did = db.duel_create(uid, other, rounds, time.time() + duel.EXPIRY_H * 3600, stake=stake)
    if did is None:
        return JSONResponse({"error": "coins"}, status_code=402)
    db.duel_pair_set(uid, other, new_used, new_combos)
    name = (db.get_user(uid) or {}).get("name") or "?"
    await accounts.stuur(other, "duel_herkansing", data={"duel_id": did}, naam=name)
    await accounts.push_account(uid)
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


@app.get("/api/missions/all")
async def missions_all(request: Request) -> JSONResponse:
    """Alle drie de lagen in een keer: dag, week en seizoen.

    De dagmissies claimen zichzelf zodra ze af zijn (dat deden ze altijd al),
    de week- en seizoensmissies moet je zelf ophalen. Daarom draagt elke rij een
    `claimed`, zodat de popup weet of er een knop hoort te staan.
    """
    db = get_db()
    uid = db.auth(_bearer(request))
    day = daily.today()
    defs = missions.missions_for(day)
    state = db.mission_state(uid, day) if uid else {}
    dag = [
        {**d, "progress": min(d["target"], int(state.get(d["key"], {}).get("progress", 0))),
         "done": bool(state.get(d["key"], {}).get("done", False)),
         # Een dagmissie is opgehaald op het moment dat hij af is.
         "claimed": bool(state.get(d["key"], {}).get("done", False))}
        for d in defs
    ]
    return JSONResponse({
        "authed": bool(uid),
        "dag": {"periode": day, "seconds_left": daily.seconds_to_next_day(), "missions": dag},
        "week": missies_lang.week_missies(db, uid),
        "seizoen": missies_lang.seizoen_missies(db, uid),
    })


@app.post("/api/missions/claim")
async def missions_claim(request: Request) -> JSONResponse:
    """Haal de beloning van een afgeronde week- of seizoensmissie op."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json()
    soort, key = str(body.get("soort") or ""), str(body.get("key") or "")
    spec = missies_lang.zoek(soort, key)
    if not spec:
        return JSONResponse({"error": "unknown"}, status_code=404)
    # Opnieuw TELLEN op het moment van ophalen. De client mag zeggen dat hij
    # klaar is, maar de server gelooft alleen zijn eigen telling.
    stand = db.missie_teller(uid, spec["teller"], spec["van"], spec["tot"])
    if stand < spec["target"]:
        return JSONResponse({"error": "not_done", "progress": stand}, status_code=409)
    if not db.missie_claim(uid, spec["periode"], key, spec["reward"], spec["cash"], time.time(), coins=spec.get("coins", 0)):
        return JSONResponse({"error": "already"}, status_code=409)
    await accounts.push_account(uid)
    return JSONResponse({"ok": True, "reward": spec["reward"], "coins": spec.get("coins", 0), "cash": spec["cash"]})


def _resterend_kort(s: int) -> str:
    """Restduur als korte NL-tekst voor in een pushbericht: 5u12m, 43m."""
    u, m = s // 3600, (s % 3600) // 60
    return f"{u}u{m:02d}m" if u else f"{m}m"


@app.get("/api/arena/info")
async def arena_info(request: Request) -> JSONResponse:
    """De arena van vandaag: welk spel, de stand, en waar jij staat."""
    db = get_db()
    day = daily.today()
    uid = db.auth(_bearer(request))
    spel = arena.spel_voor(day)
    mijn = db.arena_mijn(uid, day) if uid else {"pogingen": 0, "beste": 0}
    return JSONResponse({
        "day": day,
        "game": spel["key"],
        "af": spel["af"],
        "seconds_left": daily.seconds_to_next_day(),
        "players": db.arena_players_count(day),
        "board": db.arena_board(day, 25),
        "rank": (db.arena_rank(uid, day)[0] if uid else 0),
        "beste": int(mijn["beste"]),
        "pogingen": int(mijn["pogingen"]),
    })


@app.post("/api/arena/start")
async def arena_start(request: Request) -> JSONResponse:
    """Begin een poging. Gratis en onbeperkt: de 24 uur zijn de grens en de
    beste poging telt, dus elke extra poging is druk op het bord, geen kosten."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    day = daily.today()
    spel = arena.spel_voor(day)
    if not spel["af"]:
        return JSONResponse({"error": "not_ready"}, status_code=409)
    attempt = db.arena_start(uid, day, spel["key"], time.time())
    return JSONResponse({"attempt_id": attempt, "day": day, "game": spel["key"],
                         "seed": arena.seed_voor(day)})


@app.post("/api/arena/submit")
async def arena_submit(request: Request) -> JSONResponse:
    """Lever een poging in. De server controleert wat hij kan weten zonder mee
    te spelen; daarna kan de verdringingspush vallen: wie plek 1 kwijtraakt
    hoort dat meteen, met de tijd die nog rest."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json()
    day = daily.today()
    spel = arena.spel_voor(day)
    try:
        attempt_id = int(body.get("attempt_id") or 0)
        score = int(body.get("score") or 0)
        level = int(body.get("level") or 0)
        time_ms = int(body.get("time_ms") or 0)
    except (TypeError, ValueError):
        return JSONResponse({"error": "bad"}, status_code=400)
    if not arena.plausibel(spel["key"], score, level, time_ms):
        return JSONResponse({"error": "implausible"}, status_code=422)
    leider_voor = db.arena_leider(day)
    if not db.arena_finish(uid, attempt_id, day, score, level, time_ms, time.time()):
        return JSONResponse({"error": "geen_poging"}, status_code=404)
    leider_na = db.arena_leider(day)
    # De push is het hart van de arena: alleen bij een ECHTE wissel, nooit naar
    # jezelf, en met de resterende tijd erin zodat hij als uitnodiging leest.
    if leider_voor and leider_na == uid and leider_voor != uid:
        naam = (db.get_user(uid) or {}).get("name") or "Iemand"
        await accounts.stuur(leider_voor, "arena_gestoten", naam=naam,
                             tijd=_resterend_kort(daily.seconds_to_next_day()))
    mijn = db.arena_mijn(uid, day)
    rank, total = db.arena_rank(uid, day)
    return JSONResponse({"ok": True, "beste": int(mijn["beste"]), "pogingen": int(mijn["pogingen"]),
                         "rank": rank, "players": total, "board": db.arena_board(day, 25)})


@app.post("/api/arena/keten")
async def arena_keten(request: Request) -> JSONResponse:
    """De scheidsrechter van Woordketen: bestaat dit woord, en begint het met de
    gevraagde letter?

    DRIE LAGEN, in deze volgorde:
      1. de LETTER. Die weet de server zelf, daar is geen scheids voor nodig.
      2. de CACHE. Hetzelfde woord krijgt voor iedereen hetzelfde oordeel, en
         de AI hoeft nooit twee keer over hetzelfde woord na te denken. Dezelfde
         word_verdicts-tabel als de dagronde en het duel, met "woordketen" als
         categorie zodat de oordelen daar niet doorheen lopen: in de ketting is
         alleen "bestaat dit woord" de vraag.
      3. de AI. Pas als het woord nieuw is.

    Is de scheids niet bereikbaar, dan telt het woord GOED. Een speler hoort
    niet te vallen omdat onze verbinding hapert; liever een woord te veel
    goedgekeurd dan een eerlijke ketting afgebroken.
    """
    db = get_db()
    body = await request.json()
    woord = str(body.get("word") or "").strip()
    letter = str(body.get("letter") or "").strip().upper()[:1]
    taal = "en" if str(body.get("lang") or "nl").lower().startswith("en") else "nl"
    if not woord or not letter or len(woord) < 2 or len(woord) > 24:
        return JSONResponse({"ok": False, "bron": "vorm"})
    if not woord[:1].upper() == letter:
        return JSONResponse({"ok": False, "bron": "letter"})
    sleutel = ("woordketen", game.normalize(woord))
    cached = db.word_verdicts([sleutel], False)
    if sleutel in cached:
        return JSONResponse({"ok": bool(cached[sleutel]), "bron": "cache"})
    if not ai_referee.available():
        return JSONResponse({"ok": True, "bron": "geen_scheids"})
    oordelen = await ai_referee.judge_words(letter, [woord], taal)
    oordeel = oordelen[0] if oordelen else None
    if oordeel is None:
        return JSONResponse({"ok": True, "bron": "onbereikbaar"})
    db.set_word_verdict("woordketen", sleutel[1], False, bool(oordeel))
    return JSONResponse({"ok": bool(oordeel), "bron": "ai"})


@app.post("/api/kist/open")
async def kist_open(request: Request) -> JSONResponse:
    """Open je oudste dichte kist. De server bepaalt en betaalt de inhoud."""
    db = get_db()
    uid = db.auth(_bearer(request))
    if not uid:
        return JSONResponse({"error": "auth"}, status_code=401)
    body = await request.json()
    uit = db.kist_open(uid, int(body.get("id") or 0), time.time())
    if not uit:
        return JSONResponse({"error": "geen_kist"}, status_code=404)
    await accounts.push_account(uid)
    return JSONResponse({"ok": True, **uit})


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
    return JSONResponse({**paypal.status(), "coin_prices": get_db().COIN_PRICES, "cash_prices": get_db().CASH_PRICES, "land_buzzers": get_db().LAND_BUZZERS})


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

    if product in db.BUNDLE_GRANTS:  # een muntbundel -> coins en/of cash erbij
        saldo = db.fulfil_bundle(order_id, buyer, paypal.price(product), paypal.currency(), product=product)
        return JSONResponse({"ok": True, **saldo} if saldo is not None else {"ok": True, "already": True})
    code = db.fulfil_purchase(order_id, buyer, paypal.price(product), paypal.currency(), product=product)
    if code is None:
        # Lost a race; the winning request already fulfilled it.
        return JSONResponse({"ok": True, "already": True})
    return JSONResponse({"ok": True})


# Serve the built SPA when present (Docker copies it to ./static).
STATIC_DIR = Path(os.environ.get("PENNEER_STATIC", "static"))
# Kaart-art van Ontdekken. Eigen mount buiten de `if` hieronder, want in dev
# bestaat static/assets (de gebouwde frontend) niet en zou de art dan niet
# geserveerd worden terwijl Vite ernaar vraagt. Onveranderlijk per slug, dus
# een lange cache mag: nieuwe art krijgt een nieuwe naam of een nieuwe deploy.
_CARDS_DIR = STATIC_DIR / "cards"
if _CARDS_DIR.is_dir():
    app.mount("/static/cards", StaticFiles(directory=_CARDS_DIR), name="cards")

# Op static/ASSETS testen en niet op static/ zelf: sinds de kaart-art van
# Ontdekken bestaat static/ ook in dev, terwijl de gebouwde frontend er dan niet
# in staat. Op static/ testen liet de server dan stukgaan op een map die er
# alleen na een build is. In productie staan ze er allebei, dus daar verandert
# er niets.
if (STATIC_DIR / "assets").is_dir():
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
