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
    assert not arena.plausibel("wereldprik", 100, 1, 60000)
    assert not arena.plausibel("waaghet", 100, 1, 60000)


def test_rekenladder_scorecontract():
    """Trede k is 100*k tot 150*k waard, en de trede waarop je VALT telt niet
    mee. Op trede 10 gevallen betekent dus negen goede sommen."""
    # Meteen fout op trede 1: nul punten, mag.
    assert arena.plausibel("rekenladder", 0, 1, 2000)
    # Trede 10 = 9 goede sommen, hoogstens 150*(1+..+9) = 6750.
    assert arena.plausibel("rekenladder", 4200, 10, 30000)
    assert arena.plausibel("rekenladder", 6750, 10, 30000)
    assert not arena.plausibel("rekenladder", 6751, 10, 30000)   # meer dan er kan
    assert not arena.plausibel("rekenladder", 4200, 10, 3000)    # onmogelijk snel
    ruimte = sum(arena.REKENLADDER_VENSTER(k) for k in range(1, 11))
    assert arena.plausibel("rekenladder", 4200, 10, 5000 + ruimte + 9000)
    assert not arena.plausibel("rekenladder", 4200, 10, 5000 + ruimte + 9001)
    assert not arena.plausibel("rekenladder", -1, 1, 1000)


def test_rekenladder_klok_zakt_en_stopt():
    """De klok zakt per trede en blijft op drie seconden staan; daaronder is een
    som van twee bewerkingen geen rekenwerk meer maar een gok. Deze getallen
    moeten gelijk zijn aan vensterVoor() op de client."""
    assert arena.REKENLADDER_VENSTER(1) == 9000
    assert arena.REKENLADDER_VENSTER(8) == 6200
    assert arena.REKENLADDER_VENSTER(15) == 3400
    assert arena.REKENLADDER_VENSTER(16) == 3000
    assert arena.REKENLADDER_VENSTER(40) == 3000


def test_zondag_is_rekenladder_en_speelbaar():
    """2026-08-02 is een zondag: de eerste dagronde met dit spel."""
    spel = arena.spel_voor("2026-08-02")
    assert spel["key"] == "rekenladder"
    assert spel["af"] is True


def test_kleurenklem_scorecontract():
    """Elke goede opgave is 100 tot 200 punten, en er zijn nooit meer goede
    opgaven dan gespeelde rondes. Zaterdag draait hierop."""
    # Meteen alle levens kwijt in ronde 1: nul punten, mag.
    assert arena.plausibel("kleurenklem", 0, 1, 1500)
    # Tien rondes: hoogstens 2000 punten. Tijd tussen de 2,7s (9 x 300ms
    # animatie) en 5000 + som van de vensters + 900 per ronde.
    ruimte = sum(arena.KLEURENKLEM_VENSTER(r) for r in range(1, 11))
    assert arena.plausibel("kleurenklem", 1400, 10, 20000)
    assert arena.plausibel("kleurenklem", 2000, 10, 20000)
    assert not arena.plausibel("kleurenklem", 2001, 10, 20000)      # meer dan er past
    assert not arena.plausibel("kleurenklem", 1400, 10, 2600)       # onmogelijk snel
    assert arena.plausibel("kleurenklem", 1400, 10, 5000 + ruimte + 9000)
    assert not arena.plausibel("kleurenklem", 1400, 10, 5000 + ruimte + 9001)
    assert not arena.plausibel("kleurenklem", -1, 1, 1000)


def test_kleurenklem_venster_loopt_dicht_en_stopt():
    """De klem sluit steeds sneller, maar nooit sneller dan zeven tienden;
    daaronder is het geen reactietest meer maar een gokje. Deze getallen moeten
    gelijk zijn aan trapVoor() op de client."""
    assert arena.KLEURENKLEM_VENSTER(1) == 2400
    assert arena.KLEURENKLEM_VENSTER(2) == 2335
    assert arena.KLEURENKLEM_VENSTER(25) == 840
    assert arena.KLEURENKLEM_VENSTER(26) == 800
    assert arena.KLEURENKLEM_VENSTER(40) == 800


def test_zaterdag_is_kleurenklem_en_speelbaar():
    """2026-08-01 is een zaterdag: de eerste dagronde waarin dit spel draait."""
    spel = arena.spel_voor("2026-08-01")
    assert spel["key"] == "kleurenklem"
    assert spel["af"] is True


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
