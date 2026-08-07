import datetime

from app import arena


def test_rotatie_dekt_de_hele_week():
    """Elke weekdag heeft een spel, en de kalender ligt vast."""
    assert [arena.GAMES[d]["key"] for d in range(7)] == [
        "woordketen", "flitsreeks", "lettersoep", "rekenladder",
        "kleurenklem", "waaghet", "wereldprik",
    ]
    # En elk spel draait precies EEN dag: sinds Wereldprik af is komt er geen
    # enkele twee keer per week langs.
    assert len({arena.GAMES[d]["key"] for d in range(7)}) == 7


def test_spel_voor_volgt_de_weekdag():
    # 2026-07-30 is een donderdag.
    assert arena.spel_voor("2026-07-30")["key"] == "rekenladder"
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


def test_onbekend_spel_weigert_inzendingen():
    """Wat geen spel is levert niets in. De zeven die er zijn worden hieronder
    stuk voor stuk nagerekend; dit vangt een sleutel die niet bestaat."""
    assert not arena.plausibel("hinkelpad", 100, 1, 60000)


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


def test_rekenladder_klok_staat_stil():
    """De klok is op elke trede twintig seconden. Hij liep af van negen naar
    drie, en dat mat reactiesnelheid in plaats van rekenen; de steiging zit nu in
    de sommen. Deze getallen moeten gelijk zijn aan vensterVoor() op de client."""
    assert arena.REKENLADDER_VENSTER(1) == 20000
    assert arena.REKENLADDER_VENSTER(8) == 20000
    assert arena.REKENLADDER_VENSTER(40) == 20000


def test_donderdag_is_rekenladder_en_speelbaar():
    """2026-08-06 is een donderdag: daar staat de Rekenladder sinds Wereldprik
    de zondag overnam."""
    spel = arena.spel_voor("2026-08-06")
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
    assert arena.KLEURENKLEM_VENSTER(1) == 2300
    assert arena.KLEURENKLEM_VENSTER(2) == 2210
    assert arena.KLEURENKLEM_VENSTER(18) == 770
    assert arena.KLEURENKLEM_VENSTER(19) == 700
    assert arena.KLEURENKLEM_VENSTER(40) == 700


def test_vrijdag_is_kleurenklem_en_speelbaar():
    """2026-08-07 is een vrijdag; de zaterdag ging naar Waag het."""
    spel = arena.spel_voor("2026-08-07")
    assert spel["key"] == "kleurenklem"
    assert spel["af"] is True
    assert arena.spel_voor("2026-08-08")["key"] == "waaghet"      # zaterdag


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


def test_wereldprik_scorecontract():
    """Ronde k is 100*k tot 200*k waard, en `level` is het aantal ronden dat je
    HAALDE. Zondag draait hierop."""
    # Meteen mis in ronde 1: nul ronden gehaald, nul punten, mag.
    assert arena.plausibel("wereldprik", 0, 0, 3000)
    # Vijf ronden gehaald: hoogstens 200*(1+2+3+4+5) = 3000.
    assert arena.plausibel("wereldprik", 2100, 5, 40000)
    assert arena.plausibel("wereldprik", 3000, 5, 40000)
    assert not arena.plausibel("wereldprik", 3001, 5, 40000)     # meer dan er kan
    assert not arena.plausibel("wereldprik", 2100, 5, 2400)      # onmogelijk snel
    ruimte = (arena.WERELDPRIK_VENSTER + 2500) * 6
    assert arena.plausibel("wereldprik", 2100, 5, 5000 + ruimte)
    assert not arena.plausibel("wereldprik", 2100, 5, 5001 + ruimte)
    assert not arena.plausibel("wereldprik", -1, 1, 1000)


def test_wereldprik_venster_staat_vast():
    """Vijftien seconden per plek, elke ronde dezelfde. Moet gelijk zijn aan
    VENSTER in _PreviewWereldprik.tsx."""
    assert arena.WERELDPRIK_VENSTER == 15000


def test_wereldprik_een_realistisch_potje_wordt_geaccepteerd():
    """Niet alleen de randen maar een POTJE zoals het echt gespeeld wordt.

    De client rekent per ronde 100*k plus hooguit nog eens 100*k naar rato van de
    nabijheid. Hieronder een speler die gemiddeld op driekwart van de tolerantie
    zit, twaalf ronden haalt en er per ronde vier seconden over doet plus de
    onthulling van 1,7 seconde. Zo'n poging hoort er gewoon door te komen; anders
    keurt de server een eerlijke speler af.
    """
    level = 12
    score = sum(100 * k + round(100 * k * 0.75) for k in range(1, level + 1))
    tijd = int((4000 + 1700) * level + 15000)      # plus de ronde waarin hij strandde
    assert arena.plausibel("wereldprik", score, level, tijd)
    # En een speler die er telkens de volle klok over doet, past er ook nog in.
    traag = (arena.WERELDPRIK_VENSTER + 1700) * level + arena.WERELDPRIK_VENSTER
    assert arena.plausibel("wereldprik", score, level, traag)
    # Wie precies raak prikt haalt het maximum, en dat is de bovengrens zelf.
    vol = sum(200 * k for k in range(1, level + 1))
    assert vol == 100 * level * (level + 1)
    assert arena.plausibel("wereldprik", vol, level, tijd)
    assert not arena.plausibel("wereldprik", vol + 1, level, tijd)
