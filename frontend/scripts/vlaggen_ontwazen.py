#!/usr/bin/env python3
"""Haal de witte waas van de vlaggen af.

De vlagbestanden hebben langs hun randen half-doorzichtige WITTE pixels staan
(alfa rond de 60 tot 80 met rgb rond 255,250,245). Op een donkere kaart leest
dat als een witte gloed om de vlag heen, en dat hoort er niet te zijn.

Wat dit doet, per vlag:

  1. de kern zoeken: het gebied waar de vlag echt ondoorzichtig is (alfa > 200)
  2. daarop bijsnijden, zodat de zachte rand eraf valt
  3. wat er dan nog aan halve alfa overblijft hard maken (alles boven 128 wordt
     255, de rest 0), want een vlag is een rechthoek en heeft geen zachte rand

Draaien vanuit frontend/:
    python3 scripts/vlaggen_ontwazen.py
    python3 scripts/vlaggen_ontwazen.py --dry
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

MAP = Path(__file__).resolve().parents[1] / "public" / "vlaggen"


def schoon(pad: Path, dry: bool = False) -> bool:
    im = Image.open(pad).convert("RGBA")
    a = np.array(im)
    al = a[..., 3]
    ys, xs = np.where(al > 200)
    if len(xs) == 0:
        return False
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    if dry:
        return box != (0, 0, im.size[0], im.size[1])
    k = im.crop(box)
    b = np.array(k)
    # Hard maken: geen halve rand meer over.
    b[..., 3] = np.where(b[..., 3] > 128, 255, 0)
    Image.fromarray(b).save(pad, "WEBP", quality=95, method=6)
    return True


def main() -> int:
    dry = "--dry" in sys.argv
    n = 0
    for pad in sorted(MAP.glob("*.webp")):
        if schoon(pad, dry):
            n += 1
    print(f"{n} vlaggen {'zouden veranderen' if dry else 'ontwaasd'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
