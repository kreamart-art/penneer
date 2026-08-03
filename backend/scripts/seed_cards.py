#!/usr/bin/env python3
"""Seed the Ontdekken card catalogue from the curated CSVs in backend/data/cards.

Run from backend/:
    ./.venv/bin/python scripts/seed_cards.py            # seed everything
    ./.venv/bin/python scripts/seed_cards.py land       # one category
    ./.venv/bin/python scripts/seed_cards.py --dry      # show what would change
    ./.venv/bin/python scripts/seed_cards.py --starter  # write starter CSVs

Idempotent: running it twice changes nothing. A card is keyed on
(category, slug), so re-running updates the row in place and never touches
user_cards.

It also NEVER deletes. A card that disappears from the CSV stays in the DB and
is only reported, because user_cards has ON DELETE CASCADE: dropping a card
would silently wipe it from every player's collection. Removing one is a
deliberate act, not a side effect of editing a spreadsheet.

CSV format, one file per category, header required:

    word,aliases,<fact keys in FACT_SCHEMA order>

`word` is what the card shows. `aliases` is pipe-separated and holds the other
spellings that unlock the same card, which is what keeps "Belgium" and "België"
from becoming two cards. Empty fact cells are allowed and stay empty until
someone fills them in.
"""
from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import discover, game  # noqa: E402
from app.db import get_db  # noqa: E402

DATA_DIR = ROOT / "data" / "cards"
STATIC_DIR = Path(os.environ.get("PENNEER_STATIC", ROOT / "static"))


def csv_path(category: str) -> Path:
    return DATA_DIR / f"{category}.csv"


def read_csv(category: str) -> list[dict]:
    """Parse one category CSV into card dicts, or raise with a usable message."""
    path = csv_path(category)
    if not path.is_file():
        return []
    fact_keys = [f["key"] for f in discover.fact_rows(category)]
    rows: list[dict] = []
    seen: dict[str, str] = {}
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        missing = {"word", "aliases"} - set(reader.fieldnames or ())
        if missing:
            raise SystemExit(f"{path.name}: kolom {', '.join(sorted(missing))} ontbreekt")
        unknown = set(reader.fieldnames or ()) - {"word", "aliases", "iso"} - set(fact_keys)
        if unknown:
            raise SystemExit(
                f"{path.name}: onbekende kolom {', '.join(sorted(unknown))}. "
                f"Toegestaan volgens FACT_SCHEMA: {', '.join(fact_keys)}"
            )
        for lineno, raw in enumerate(reader, start=2):
            word = (raw.get("word") or "").strip()
            if not word:
                continue
            slug = discover.slugify(word)
            if not slug:
                raise SystemExit(f"{path.name} regel {lineno}: '{word}' levert een lege slug")
            if slug in seen:
                raise SystemExit(
                    f"{path.name} regel {lineno}: '{word}' botst met '{seen[slug]}' "
                    f"(beide slug '{slug}')"
                )
            seen[slug] = word
            aliases = [a.strip() for a in (raw.get("aliases") or "").split("|") if a.strip()]
            # Store aliases normalized: matching happens on game.normalize, so
            # doing it once here keeps the unlock query a plain lookup.
            alias_norms = sorted({game.normalize(a) for a in aliases} - {game.normalize(word)})
            facts = {k: (raw.get(k) or "").strip() for k in fact_keys}
            facts = {k: v for k, v in facts.items() if v}
            rows.append({
                "category": category,
                "letter": discover.letter_of(word),
                "word": word,
                "slug": slug,
                "aliases": alias_norms,
                "iso": (raw.get("iso") or "").strip().upper() or None,
                "facts": facts,
            })
    # Alphabetical within the category, on the normalized form so diacritics do
    # not scatter België away from Belize.
    rows.sort(key=lambda r: (game.normalize(r["word"]), r["slug"]))
    for i, r in enumerate(rows, start=1):
        r["card_number"] = i
        r["sort_order"] = i
    return rows


def image_for(category: str, slug: str) -> str | None:
    """Alleen een beeldpad opslaan als het bestand er echt is.

    De URL begint met /static/ en STATIC_DIR wijst al naar die map, dus dat
    stuk moet eraf voordat we op schijf kijken. Zonder dat zocht hij in
    static/static/ en bleef image_path altijd leeg.
    """
    rel = discover.image_path_for(category, slug)
    op_schijf = rel[len("/static/"):] if rel.startswith("/static/") else rel.lstrip("/")
    return rel if (STATIC_DIR / op_schijf).is_file() else None


def seed(categories: list[str], dry: bool = False) -> int:
    db = get_db()
    conn = db._conn
    changed = 0
    for category in categories:
        rows = read_csv(category)
        if not rows:
            print(f"{category:8s} geen CSV in data/cards, overgeslagen")
            continue
        have = {
            r["slug"]: dict(r)
            for r in conn.execute(
                "SELECT slug, word, aliases, facts, letter, card_number, sort_order, image_path, iso"
                " FROM cards WHERE category = ?",
                (category,),
            )
        }
        added = updated = 0
        for r in rows:
            payload = (
                r["letter"], r["word"], json.dumps(r["aliases"], ensure_ascii=False),
                json.dumps(r["facts"], ensure_ascii=False),
                image_for(category, r["slug"]), r["card_number"], r["sort_order"], r["iso"],
            )
            old = have.pop(r["slug"], None)
            if old is None:
                added += 1
                if not dry:
                    conn.execute(
                        "INSERT INTO cards (category, slug, letter, word, aliases, facts,"
                        " image_path, card_number, sort_order, iso)"
                        " VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (category, r["slug"]) + payload,
                    )
            else:
                same = (
                    old["letter"] == payload[0] and old["word"] == payload[1]
                    and old["aliases"] == payload[2] and old["facts"] == payload[3]
                    and old["image_path"] == payload[4] and old["card_number"] == payload[5]
                    and old["sort_order"] == payload[6] and old["iso"] == payload[7]
                )
                if not same:
                    updated += 1
                    if not dry:
                        conn.execute(
                            "UPDATE cards SET letter=?, word=?, aliases=?, facts=?,"
                            " image_path=?, card_number=?, sort_order=?, iso=?"
                            " WHERE category=? AND slug=?",
                            payload + (category, r["slug"]),
                        )
        if not dry:
            conn.commit()
        changed += added + updated
        note = f"{category:8s} {len(rows):4d} kaarten  nieuw {added:4d}  bijgewerkt {updated:4d}"
        if have:
            note += f"  |  {len(have)} niet meer in de CSV, blijven staan: " + ", ".join(
                sorted(have)[:5]
            ) + ("..." if len(have) > 5 else "")
        print(note)
    return changed


def write_starters() -> None:
    """Write a starter CSV for any category that has none yet.

    One row per unique word from the curated list, aliases and facts empty. It
    is a starting point to curate, not a finished catalogue: the NL/EN pairs in
    wordlists.py still show up as separate rows and have to be merged by hand
    into one row with the other spelling in `aliases`.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for category in discover.CATEGORIES:
        path = csv_path(category)
        if path.exists():
            print(f"{category:8s} CSV bestaat al, niet overschreven")
            continue
        words = game.RAW.get(discover.CAT_TO_LIST[category], [])
        seen: dict[str, str] = {}
        for w in words:
            seen.setdefault(discover.slugify(w), w)
        fact_keys = [f["key"] for f in discover.fact_rows(category)]
        with path.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh)
            writer.writerow(["word", "aliases"] + fact_keys)
            for _slug, word in sorted(seen.items(), key=lambda kv: game.normalize(kv[1])):
                writer.writerow([word, ""] + [""] * len(fact_keys))
        print(f"{category:8s} starter geschreven, {len(seen)} regels -> {path}")


def main() -> None:
    args = [a for a in sys.argv[1:]]
    if "--starter" in args:
        write_starters()
        return
    dry = "--dry" in args
    picked = [a for a in args if not a.startswith("-")]
    for c in picked:
        if c not in discover.CATEGORIES:
            raise SystemExit(f"onbekende categorie '{c}', kies uit {', '.join(discover.CATEGORIES)}")
    categories = picked or list(discover.CATEGORIES)
    n = seed(categories, dry=dry)
    print(("[dry] " if dry else "") + f"klaar, {n} rijen zouden wijzigen" if dry else f"klaar, {n} rijen gewijzigd")


if __name__ == "__main__":
    main()
