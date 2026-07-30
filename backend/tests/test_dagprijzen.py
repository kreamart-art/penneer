from app import dagprijzen


def test_top_drie_krijgt_cash_en_de_rest_niet():
    """Alleen het podium krijgt cash, en de winnaar het meest."""
    assert dagprijzen.prijs_voor(1)["cash"] == 5
    assert dagprijzen.prijs_voor(2)["cash"] == 2
    assert dagprijzen.prijs_voor(3)["cash"] == 2
    for plek in (4, 5, 10, 11, 100):
        assert dagprijzen.prijs_voor(plek)["cash"] == 0


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
    assert dagprijzen.prijs_voor(0) == {"kist": None, "coins": 0, "cash": 0}
