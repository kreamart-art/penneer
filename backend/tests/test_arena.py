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
