"""Wanneer telt een topografie-antwoord als goed?

De aanleiding: "De Nijl" viel om terwijl "Nijl" goed was, en "United States of
America" viel om terwijl "United States" goed was. Het eerste is een lidwoord
dat toevallig twee bewerkingen kost, het tweede een variant die niet in de bank
stond. Wat hier vastligt:

- vulwoorden (lidwoorden, en soortnamen als rivier of zee) doen niet mee;
- ze gaan aan BEIDE kanten weg, dus een naam die zelf met een lidwoord begint
  (Den Haag, La Paz) blijft gewoon kloppen;
- een verkeerd antwoord blijft verkeerd, ook na al dat strippen;
- de beoordeling hangt NIET af van de soepele spelling: dezelfde inzending
  hoort in een gedeelde dagranglijst hetzelfde te scoren.
"""

import pytest

from app import topo


@pytest.fixture()
def vraag():
    return {x["id"]: x for x in topo.BANK}


def test_lidwoord_maakt_niet_uit(vraag):
    for tekst in ("Nijl", "De Nijl", "de nijl", "The Nile", "Nile"):
        assert topo.check(tekst, vraag["riv-egypte"]), tekst


def test_ook_zonder_soepele_spelling(vraag):
    """Dit was de scheve situatie: met soepele spelling aan telde "De Nijl" wel
    en zonder niet, terwijl iedereen in dezelfde ranglijst staat."""
    assert topo.check("De Nijl", vraag["riv-egypte"], lenient=False)
    assert topo.check("De Nijl", vraag["riv-egypte"], lenient=True)


def test_soortnaam_erbij_mag(vraag):
    assert topo.check("Amazon river", vraag["riv-zuidamerika"])
    assert topo.check("de Middellandse Zee", vraag["zee-europa-afrika"])
    assert topo.check("Lake Victoria", vraag["meer-afrika"])


def test_naam_die_zelf_met_een_lidwoord_begint(vraag):
    """Den Haag wordt aan beide kanten "haag", dus hij blijft kloppen."""
    for tekst in ("Den Haag", "den haag", "The Hague", "'s-Gravenhage"):
        assert topo.check(tekst, vraag["nl-regering"]), tekst


def test_een_woord_dat_helemaal_uit_vulwoorden_bestaat_telt_niet(vraag):
    assert not topo.check("de", vraag["riv-egypte"])
    assert not topo.check("the", vraag["riv-egypte"])


def test_lange_officiele_naam(vraag):
    for tekst in ("United States of America", "Verenigde Staten van Amerika", "USA", "Amerika"):
        assert topo.check(tekst, vraag["land-hollywood"]), tekst


def test_fout_blijft_fout(vraag):
    # Reykjavik is niet de hoofdstad van Bulgarije, ook niet met speling.
    assert not topo.check("Refjavik", vraag["hs-bulgarije"])
    assert not topo.check("Reykjavik", vraag["hs-bulgarije"], lenient=True)
    # En een andere rivier is geen antwoord.
    assert not topo.check("Donau", vraag["riv-egypte"])
    assert not topo.check("Seine", vraag["riv-rome"])
    assert not topo.check("", vraag["riv-egypte"])


def test_spelfout_blijft_toegestaan(vraag):
    """De speling waar de bank altijd al voor was: een letter naast is goed."""
    assert topo.check("Kopenhagen", vraag["hs-denemarken"])
    assert topo.check("Copenhaguen", vraag["hs-denemarken"])


def test_geen_overbodige_varianten_in_de_bank():
    """Twee antwoorden die na het strippen hetzelfde zijn, zeggen twee keer
    hetzelfde. Dat is geen fout, maar het maakt de bank onduidelijk."""
    dubbel = [x["id"] for x in topo.BANK if len({topo.kern(w) for w in x["a"]}) != len(x["a"])]
    assert dubbel == []


def test_elke_vraag_heeft_een_antwoord_dat_zichzelf_goedkeurt():
    """Het antwoord dat in de uitslag getoond wordt, moet zelf door de check
    komen. Anders leert iemand iets aan wat de app afkeurt."""
    for x in topo.BANK:
        assert topo.check(x["a"][0], x), x["id"]
