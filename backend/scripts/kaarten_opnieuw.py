#!/usr/bin/env python3
"""Zet de kaartfoto's in de ONBEKNOTTE lijst.

De oude kaarten zijn op de lijst bijgesneden, en daardoor is het edelsteentje
bovenop doormidden gesneden en zijn de hoekkrullen verdwenen. De nieuwe lijst
(static/cards/achterkant-nieuw.webp) heeft die volledige vorm: de steen steekt
boven de lijst uit en de alfa loopt daar netjes af.

Wat dit script doet, per kaart:

  1. het FOTOVENSTER uit de oude kaart snijden (x 24..633, y 50..993, opgemeten)
  2. dat beeld in het venster van de nieuwe lijst leggen (x 38..624, y 82..982)
  3. onderin laten uitlopen naar paars, want daar staat de naamplaat overheen
  4. de lijst er bovenop, zodat de gouden rand over de foto valt

Draaien vanuit backend/:
    ./.venv/bin/python scripts/kaarten_opnieuw.py          # alles
    ./.venv/bin/python scripts/kaarten_opnieuw.py --dry    # alleen tellen
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
KAARTEN = ROOT / "static" / "cards"
LIJST = KAARTEN / "achterkant-nieuw.webp"

# Opgemeten op voorkant-leeg.webp (658x1012): waar de gouden lijst ophoudt.
OUD_VENSTER = (24, 50, 634, 994)
# Opgemeten op achterkant-nieuw.webp (659x1013): idem.
NIEUW_VENSTER = (38, 82, 625, 983)
# De kleur waar de foto onderin naar uitloopt, gelezen uit het paarse vlak van
# de nieuwe lijst.
PAARS = (36, 16, 74)
# Vanaf welk deel van de fotohoogte de uitloop begint.
FADE_VANAF = 0.52


def uitloop(beeld: Image.Image) -> Image.Image:
    """Onderin naar paars laten uitlopen, zoals de oude kaarten deden."""
    b, h = beeld.size
    vlak = Image.new("RGB", (b, h), PAARS)
    masker = Image.new("L", (1, h))
    for y in range(h):
        f = (y / h - FADE_VANAF) / max(1e-6, 1 - FADE_VANAF)
        masker.putpixel((0, y), 0 if f <= 0 else int(255 * min(1.0, f) ** 1.35))
    return Image.composite(vlak, beeld.convert("RGB"), masker.resize((b, h)))


def vul(kaart: Path, lijst: Image.Image, dry: bool = False) -> bool:
    oud = Image.open(kaart).convert("RGBA")
    if oud.size != (658, 1012):
        print(f"   overslaan {kaart.name}: onverwachte maat {oud.size}")
        return False
    foto = oud.crop(OUD_VENSTER)
    doel = (NIEUW_VENSTER[2] - NIEUW_VENSTER[0], NIEUW_VENSTER[3] - NIEUW_VENSTER[1])
    # Vullen en de rest eraf, niet uitrekken: een gebouw dat een tiende smaller
    # wordt gemaakt ziet er meteen fout uit.
    schaal = max(doel[0] / foto.size[0], doel[1] / foto.size[1])
    tussen = foto.resize((round(foto.size[0] * schaal), round(foto.size[1] * schaal)), Image.LANCZOS)
    dx = (tussen.size[0] - doel[0]) // 2
    dy = (tussen.size[1] - doel[1]) // 2
    foto = tussen.crop((dx, dy, dx + doel[0], dy + doel[1]))
    if dry:
        return True
    uit = lijst.copy()
    uit.paste(uitloop(foto), (NIEUW_VENSTER[0], NIEUW_VENSTER[1]))
    # De lijst er weer overheen: zo valt de gouden rand over de foto in plaats
    # van ernaast, en houdt de steen bovenaan zijn eigen alfa.
    uit.alpha_composite(lijst)
    uit.save(kaart, "WEBP", quality=92, method=6)
    return True


def main() -> int:
    dry = "--dry" in sys.argv
    if not LIJST.is_file():
        print(f"lijst ontbreekt: {LIJST}")
        return 1
    lijst = Image.open(LIJST).convert("RGBA")
    n = 0
    for map_ in sorted(KAARTEN.iterdir()):
        if not map_.is_dir():
            continue
        for kaart in sorted(map_.glob("*.webp")):
            if not dry:
                rug = kaart.with_suffix(".webp.oud")
                if not rug.exists():
                    shutil.copy2(kaart, rug)
            if vul(kaart, lijst, dry):
                n += 1
    print(f"{n} kaarten {'gecontroleerd' if dry else 'opnieuw gezet'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
