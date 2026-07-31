"""De kreet waarmee je klaar gaat.

Dit is de enige plek in het spel waar een speler iets stuurt dat rechtstreeks op
het scherm van alle anderen belandt, in de uitzending boven zijn naam. De
bescherming is dat er geen TEKST over de lijn gaat maar een SLEUTEL, en dat
alleen sleutels uit de vaste lijst blijven staan. Deze tests leggen precies dat
vast: bekende sleutel blijft, alles daarbuiten verdwijnt zonder de klaarmelding
zelf te breken.
"""

import asyncio

import pytest

from app.models import Room, Settings
from app.rooms import KREET_SLEUTELS, RoomManager


@pytest.fixture()
def kamer():
    """Een room in de invulfase met twee spelers, zonder websockets."""
    mgr = RoomManager()
    room = Room(code="TEST", host_id="a", settings=Settings())
    room.phase = "fill"
    mgr.rooms[room.code] = room
    return mgr, room


def _speler(room: Room, pid: str, naam: str) -> None:
    from app.models import Player

    room.players.append(Player(id=pid, name=naam, color="#FFC23D"))


def _klaar(mgr: RoomManager, pid: str, payload: dict) -> None:
    asyncio.run(mgr.set_ready(pid, payload))


def test_bekende_kreet_blijft_staan(kamer):
    mgr, room = kamer
    _speler(room, "a", "Aish")
    _klaar(mgr, "a", {"ready": True, "kreet": "winnen"})
    assert "a" in room.ready_ids
    assert room.ready_kreten["a"] == "winnen"


def test_onbekende_kreet_wordt_weggegooid_maar_klaar_telt(kamer):
    """Een verzonnen sleutel mag de klaarmelding niet slopen, alleen zichzelf."""
    mgr, room = kamer
    _speler(room, "a", "Aish")
    _klaar(mgr, "a", {"ready": True, "kreet": "<script>alert(1)</script>"})
    assert "a" in room.ready_ids
    assert "a" not in room.ready_kreten


def test_vrije_tekst_komt_er_niet_door(kamer):
    """Wie zijn eigen zin meestuurt in plaats van een sleutel, stuurt niets."""
    mgr, room = kamer
    _speler(room, "a", "Aish")
    _klaar(mgr, "a", {"ready": True, "kreet": "is klaar en jullie zijn stom"})
    assert room.ready_kreten == {}


def test_klaar_zonder_kreet_wist_een_eerdere(kamer):
    """Bedenk je je, dan blijft je opschepperij niet staan."""
    mgr, room = kamer
    _speler(room, "a", "Aish")
    _klaar(mgr, "a", {"ready": True, "kreet": "beter"})
    _klaar(mgr, "a", {"ready": True})
    assert "a" in room.ready_ids
    assert room.ready_kreten == {}


def test_niet_meer_klaar_wist_de_kreet(kamer):
    mgr, room = kamer
    _speler(room, "a", "Aish")
    _klaar(mgr, "a", {"ready": True, "kreet": "makkelijk"})
    _klaar(mgr, "a", {"ready": False})
    assert room.ready_ids == []
    assert room.ready_kreten == {}


def test_kreten_gaan_mee_in_de_room_state(kamer):
    mgr, room = kamer
    _speler(room, "a", "Aish")
    _klaar(mgr, "a", {"ready": True, "kreet": "koffie"})
    assert room.public()["ready_kreten"] == {"a": "koffie"}


def test_iedere_speler_heeft_zijn_eigen_kreet(kamer):
    mgr, room = kamer
    _speler(room, "a", "Aish")
    _speler(room, "b", "Kream")
    _klaar(mgr, "a", {"ready": True, "kreet": "winnen"})
    _klaar(mgr, "b", {"ready": True, "kreet": "rotletter"})
    assert room.ready_kreten == {"a": "winnen", "b": "rotletter"}


def test_de_lijst_dekt_de_vier_pakketten():
    """Zestien zinnen, vier per pakket. Loopt dit uit de pas met
    components/Kreten.tsx, dan kiest de app iets dat de server weggooit."""
    assert len(KREET_SLEUTELS) == 16
    for sleutel in ("winnen", "beter", "rotletter", "mazzel"):
        assert sleutel in KREET_SLEUTELS
