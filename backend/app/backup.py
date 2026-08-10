"""Pen Neer — de nachtelijke kopie van de database.

Alles wat spelers hebben opgebouwd staat in EEN bestand: accounts, munten,
reeksen, clubs, vriendschappen, aankopen. Zonder kopie is één kapot volume het
einde van al die geschiedenis, en dat is niet iets waar je achteraf nog iets aan
kunt doen.

WAAROM `VACUUM INTO` EN GEEN `cp`. De database draait in WAL-modus: het echte
bestand loopt achter op wat er in de WAL staat, en een kopie halverwege een
schrijfactie is een kopie van een halve transactie. `VACUUM INTO` laat SQLite
zelf een NIEUWE database schrijven die consistent is op het moment van kopiëren,
terwijl de app gewoon doorloopt. Hij is bovendien compact: de kopie heeft geen
lege pagina's meer.

WAAROM IN DE APP EN NIET IN CRON. Er is geen cron in deze container, en een
taak op de host zou de containernaam moeten kennen die bij elke uitrol
verandert. Deze lus hoort bij de code, dus hij reist mee en kan niet vergeten
worden bij een verhuizing.

WAT DIT WEL EN NIET REDT. Wel: een foute migratie, een verkeerd verwijderde
speler, een database die corrupt raakt, een uitrol die iets stukmaakt. Niet:
het verliezen van de machine zelf, want de kopie staat op hetzelfde volume.
Zodra er een tweede plek is (een storage box, een emmer bij een dienst) is dit
bestand precies wat je daarheen stuurt; zie `laatste()`.
"""
from __future__ import annotations

import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

#: Waar de kopieën komen. Naast de database, dus op hetzelfde volume: dat is de
#: enige plek waarvan we zeker weten dat hij een uitrol overleeft.
MAP = os.environ.get("PENNEER_BACKUP_DIR", "")
#: Hoeveel dagen we bewaren. Veertien is ruim genoeg om een fout te ontdekken
#: die je pas een week later opvalt, en kost bij deze omvang een paar megabyte.
BEWAAR = int(os.environ.get("PENNEER_BACKUP_KEEP", "14") or 14)


def map_voor(db_pad: str) -> Path:
    """De map waar de kopieën in gaan: naast de database, tenzij anders gezet."""
    if MAP:
        return Path(MAP)
    return Path(db_pad).resolve().parent / "backups"


def maak(db_pad: str) -> Path:
    """Schrijf een kopie van vandaag en ruim de oude op. Geeft het pad terug.

    De naam is de DATUM en niet de tijd: draait de lus vaker (of start de app
    twee keer op een dag opnieuw), dan overschrijft hij de kopie van vandaag in
    plaats van er twintig te maken. Daarvoor moet het doelbestand eerst weg,
    want VACUUM INTO weigert te schrijven naar iets dat al bestaat.
    """
    doel_map = map_voor(db_pad)
    doel_map.mkdir(parents=True, exist_ok=True)
    dag = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doel = doel_map / f"penneer-{dag}.db"
    tijdelijk = doel_map / f".penneer-{dag}.bezig"
    if tijdelijk.exists():
        tijdelijk.unlink()
    # Alleen-lezen open: een kopie maken hoort nooit iets te veranderen aan het
    # origineel, ook niet per ongeluk.
    con = sqlite3.connect(f"file:{db_pad}?mode=ro", uri=True, timeout=30)
    try:
        con.execute("VACUUM INTO ?", (str(tijdelijk),))
    finally:
        con.close()
    # Pas op het laatst op zijn plek zetten. Wie tijdens het schrijven kijkt,
    # ziet dan nog de kopie van gisteren en nooit een half bestand.
    tijdelijk.replace(doel)
    _ruim_op(doel_map)
    return doel


def _ruim_op(doel_map: Path) -> None:
    """Alles boven `BEWAAR` weg, oudste eerst."""
    kopieen = sorted(doel_map.glob("penneer-*.db"))
    for oud in kopieen[:-BEWAAR] if BEWAAR > 0 else []:
        try:
            oud.unlink()
        except OSError:
            pass


def laatste(db_pad: str) -> dict:
    """Wat er nu ligt: de nieuwste kopie, hoe oud hij is en hoeveel het er zijn.

    Dit is ook het haakje voor een tweede plek: wie deze kopie naar buiten wil
    sturen, heeft aan `pad` genoeg.
    """
    doel_map = map_voor(db_pad)
    kopieen = sorted(doel_map.glob("penneer-*.db")) if doel_map.is_dir() else []
    if not kopieen:
        return {"aantal": 0, "pad": None, "bytes": 0, "uren_oud": None}
    nieuwste = kopieen[-1]
    st = nieuwste.stat()
    return {
        "aantal": len(kopieen),
        "pad": str(nieuwste),
        "bytes": st.st_size,
        "uren_oud": round((time.time() - st.st_mtime) / 3600, 1),
    }
