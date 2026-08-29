from app import dagprijzen


def test_de_dagronde_betaalt_geen_cash():
    """Cash is de schaarse munt (een scheidsrechter kost er 250) en hoort bij
    mijlpalen, niet bij iets wat elke dag opnieuw te halen is. Wie hier elke
    dag twee pakte liep de hele economie voorbij; er kwam XP voor in de plaats.

    Deze test stond er nog van toen het podium wel cash kreeg, en bleef daarna
    een jaar rood staan. Een rode test die niemand meer leest, verbergt de
    volgende echte fout."""
    for plek in (1, 2, 3, 4, 5, 10, 11, 100):
        assert dagprijzen.prijs_voor(plek)["cash"] == 0


def test_xp_loopt_mee_met_de_plek():
    """Wat er voor de cash in de plaats kwam: XP telt mee voor je level, maar
    je kunt er niets voor kopen."""
    xp = [dagprijzen.prijs_voor(p)["xp"] for p in range(1, 120)]
    assert all(a >= b for a, b in zip(xp, xp[1:])), "nooit meer XP voor een lagere plek"
    assert xp[0] == 250
    assert xp[-1] == 25


def test_kist_tot_en_met_plek_tien():
    """Een kist hoort bij de top tien; daaronder zijn het alleen munten.

    De top vier krijgt elk een eigen kist, plek vijf tot en met tien dezelfde
    laagste. Bij tien spelers houden de laatste zes dus dezelfde kist over.
    """
    assert [dagprijzen.prijs_voor(p)["kist"] for p in range(1, 11)] == [
        "kist5", "kist4", "kist3", "kist2",
        "kist1", "kist1", "kist1", "kist1", "kist1", "kist1",
    ]
    assert dagprijzen.prijs_voor(11)["kist"] is None


def test_munten_lopen_alleen_omlaag():
    """Nooit meer munten voor een lagere plek: dat zou de ranglijst omkeren."""
    coins = [dagprijzen.prijs_voor(p)["coins"] for p in range(1, 120)]
    assert all(a >= b for a, b in zip(coins, coins[1:]))
    assert coins[0] == 500
    assert coins[-1] == 50  # meedoen blijft iets waard


def test_geen_plek_geen_prijs():
    """Wie niet meespeelde heeft geen plek, en dan valt er niets uit te delen."""
    assert dagprijzen.prijs_voor(0) == {"kist": None, "coins": 0, "cash": 0, "xp": 0}
