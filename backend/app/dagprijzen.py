"""Wat je wint met je plek in de dagronde.

Een dagronde zonder prijzen is een lijstje; met prijzen is het een wedstrijd.
De ladder hieronder is de ENIGE plek waar die verdeling staat. De popup op de
main page tekent hem, en straks deelt het uitslagmoment hem uit. Zou de client
zijn eigen tabel bijhouden, dan lopen die twee vroeg of laat uiteen en zie je
een prijs die je niet krijgt.

De vorm van de ladder:

* plek 1        kist + munten + een beetje cash
* plek 2 en 3   kist + munten + minder cash
* plek 4 t/m 10 kist + munten
* daarna        alleen munten, en minder naarmate je lager staat

Plek 4 stond niet met zoveel woorden in de opdracht (die noemde 2-3 en dan 5-10)
maar hoort bij de kistengroep: anders valt er een gat waarin je wel een kist
verdient volgens de kistladder maar geen prijs volgens deze tabel.

CASH is de schaarse munt van de app: een scheidsrechter kost er 250 en je krijgt
er tien per vijf levels. Een dagwinnaar die er vijf pakt loopt dus niet de hele
economie voorbij, maar merkt het wel.

De kist die bij een plek hoort komt uit dezelfde ladder, met de duurste kist
bovenaan. Vanaf plek vijf is het voor iedereen dezelfde kist: zo houdt een
tiende plek nog iets vast zonder dat de eerste plek zijn glans verliest.
"""

from typing import Optional, TypedDict


class Prijs(TypedDict):
    kist: Optional[str]
    coins: int
    cash: int
    # XP bovenop de kist en de munten. De dagronde betaalt GEEN cash meer: die
    # is de schaarse munt van de app en hoort bij mijlpalen, niet bij iets wat
    # elke dag opnieuw te halen valt.
    #
    # Hier stond even een kaartpack. Dat komt terug zodra er een kaartinventaris
    # is om hem in te stoppen; de animatie en de art liggen klaar (zie
    # frontend/src/components/PackOpenen.tsx en het testscherm op /?pack).
    xp: int


# (tot en met welke plek, kist, munten, XP). De laatste regel is de staart en
# geldt voor alles daaronder.
#
# GEEN CASH MEER in de dagronde. Cash is de schaarse munt van de app (een
# scheidsrechter kost er 250) en hoort bij mijlpalen, niet bij iets wat elke dag
# opnieuw te halen is; wie hier elke dag twee pakte liep de hele economie
# voorbij. Er komt XP voor in de plaats: die telt mee voor je level en is dus
# wel iets waard, maar niemand kan er iets mee kopen.
LADDER: list[tuple[int, Optional[str], int, int]] = [
    (1, "kist5", 500, 250),
    (2, "kist4", 350, 180),
    (3, "kist3", 250, 140),
    (4, "kist2", 200, 100),
    (10, "kist1", 150, 75),
    (25, None, 100, 50),
    (50, None, 75, 35),
]
# Alles onder de laatste regel: nog steeds munten, want meedoen hoort iets waard
# te zijn, maar zonder kist.
STAART: Prijs = {"kist": None, "coins": 50, "cash": 0, "xp": 25}


def prijs_voor(plek: int) -> Prijs:
    """De prijs bij een plek in de dagranglijst. Plek 1 is de hoogste."""
    if plek < 1:
        return {"kist": None, "coins": 0, "cash": 0, "xp": 0}
    for tot, kist, coins, xp in LADDER:
        if plek <= tot:
            return {"kist": kist, "coins": coins, "cash": 0, "xp": xp}
    return dict(STAART)  # type: ignore[return-value]
