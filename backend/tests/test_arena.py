import datetime

from app import arena


def test_rotatie_dekt_de_hele_week():
    """Elke weekdag heeft een spel, en de kalender ligt vast."""
    assert [arena.GAMES[d]["key"] for d in range(7)] == [
        "woordketen", "wereldprik", "waaghet", "flitsreeks",
        "lettersoep", "kleurenklem", "rekenladder",
    ]


def test_spel_voor_volgt_de_weekdag():
    # 2026-07-30 is een donderdag.
    assert arena.spel_voor("2026-07-30")["key"] == "flitsreeks"
    assert arena.spel_voor("2026-08-03")["key"] == "woordketen"  # maandag


def test_seed_is_deterministisch_en_per_dag_anders():
    assert arena.seed_voor("2026-07-30") == arena.seed_voor("2026-07-30")
    assert arena.seed_voor("2026-07-30") != arena.seed_voor("2026-07-31")


def test_flitsreeks_scorecontract():
    """Score moet tussen de basis en basis+bonus liggen, en de tijd moet lang
    genoeg zijn om het level echt te halen."""
    # level 5: basis 50*5*6 = 1500, max bonus 495; minimumtijd 15*160 = 2400ms
    assert arena.plausibel("flitsreeks", 1500, 5, 30000)
    assert arena.plausibel("flitsreeks", 1995, 5, 30000)
    assert not arena.plausibel("flitsreeks", 1996, 5, 30000)   # bonus te hoog
    assert not arena.plausibel("flitsreeks", 1400, 5, 30000)   # onder de basis
    assert not arena.plausibel("flitsreeks", 1500, 5, 1000)    # onmogelijk snel
    assert arena.plausibel("flitsreeks", 0, 0, 500)            # meteen gefaald mag
    assert not arena.plausibel("flitsreeks", -1, 0, 0)


def test_onaffe_spellen_weigeren_inzendingen():
    assert not arena.plausibel("woordketen", 100, 1, 60000)
    assert not arena.plausibel("kleurenklem", 100, 1, 60000)


def test_lettersoep_scorecontract():
    """De grens is ruim maar bestaat: hij vangt scriptjes, geen snelle spelers."""
    # Poging die in level 1 eindigt zonder een woord: mag, ook snel.
    assert arena.plausibel("lettersoep", 0, 1, 2000)
    # Level 3 bereikt = doelen 3+4 uitgespeeld, in level 3 hooguit 3 woorden:
    # max (3+4+3) * 3200 = 32000, minimumtijd (3+4) * 250 = 1750 ms.
    assert arena.plausibel("lettersoep", 2400, 3, 60000)
    assert arena.plausibel("lettersoep", 32000, 3, 60000)
    assert not arena.plausibel("lettersoep", 32001, 3, 60000)   # meer dan er past
    assert not arena.plausibel("lettersoep", 2400, 3, 1000)     # onmogelijk snel
    # Boven de klok: 3 levels van 55s plus 30s marge = 195s.
    assert not arena.plausibel("lettersoep", 2400, 3, 196000)
    assert not arena.plausibel("lettersoep", -1, 1, 1000)


def test_lettersoep_doelen_lopen_op():
    doelen = [arena.LETTERSOEP_DOEL(i) for i in range(1, 14)]
    assert doelen[0] == 3 and doelen[9] == 8
    assert doelen == sorted(doelen)              # nooit omlaag
    assert arena.LETTERSOEP_DOEL(99) == 8        # voorbij de ladder blijft hij staan
