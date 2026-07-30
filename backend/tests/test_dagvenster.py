"""Het venster van de dagronde: van 21:00 tot 21:00 Nederlandse tijd.

De ronde heette vroeger naar de kalenderdag en rolde om middernacht. Dat gaf een
uitslag midden in de nacht, dus op een moment dat niemand hem ziet. Nu sluit hij
om negen uur 's avonds en draagt hij de datum van de dag waarop hij SLUIT.

Deze tests staan er vooral voor de grens zelf: één minuut ervoor en één minuut
erna, en de overgang over de jaarwisseling.
"""

import datetime as dt

from app import daily


def op(jaar, maand, dag, uur, minuut=0):
    return dt.datetime(jaar, maand, dag, uur, minuut, tzinfo=daily.TZ)


def test_voor_negen_uur_is_het_vandaag():
    assert daily.today(op(2026, 7, 30, 8, 0)) == "2026-07-30"
    assert daily.today(op(2026, 7, 30, 20, 59)) == "2026-07-30"


def test_vanaf_negen_uur_loopt_de_ronde_van_morgen():
    assert daily.today(op(2026, 7, 30, 21, 0)) == "2026-07-31"
    assert daily.today(op(2026, 7, 30, 23, 59)) == "2026-07-31"


def test_na_middernacht_blijft_het_dezelfde_ronde():
    """De ronde die om 21:00 op de 31e sluit begint al op de 30e om 21:00, dus
    de nacht ertussen hoort er nog bij."""
    assert daily.today(op(2026, 7, 31, 0, 30)) == "2026-07-31"
    assert daily.today(op(2026, 7, 31, 20, 59)) == "2026-07-31"


def test_over_de_jaarwisseling():
    assert daily.today(op(2026, 12, 31, 21, 30)) == "2027-01-01"


def test_teller_loopt_naar_negen_uur():
    assert daily.seconds_to_next_day(op(2026, 7, 30, 20, 0)) == 3600
    # Vlak na sluiten telt hij af naar de sluiting van MORGEN, niet naar nul.
    assert daily.seconds_to_next_day(op(2026, 7, 30, 21, 0)) == 24 * 3600
    assert daily.seconds_to_next_day(op(2026, 7, 30, 22, 0)) == 23 * 3600


def test_sluitmoment_hoort_bij_zijn_eigen_dag():
    assert daily.sluit_op("2026-07-30") == op(2026, 7, 30, 21, 0)
