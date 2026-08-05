// De uitlegstrook onder de sierkop: vier kolommen met een label en een regel.
//
// Per kolom het label met zijn getal eraan vast (60 seconden, 5 categorieen,
// 1 poging) en daaronder de regel die het uitlegt. Geen pictogrammen erboven:
// dan kijk je langs vier tekeningen naar vier woorden. De dunne gouden lijnen
// doen het scheiden.
//
// Vier kolommen op een telefoon is smal (rond de 85 punten), dus de tekst is
// klein en breekt af. Dat is de bedoeling: het is een overzicht dat je scant,
// geen stuk om te lezen.
import { GOUD, SierKop } from "./ProfileHero";
import { colors, font, withAlpha } from "../theme/tokens";

export function UitlegRaster({ kop, punten }: { kop: string; punten: { titel: string; tekst: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SierKop label={kop} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${punten.length}, 1fr)` }}>
        {punten.map((p, i) => (
          <div
            key={p.titel}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              padding: "0 6px", textAlign: "center",
              borderLeft: i === 0 ? "none" : `1px solid ${withAlpha(GOUD[2], 0.22)}`,
            }}
          >
            {/* Getal boven het woord, in ELKE kolom. "1 poging" en "60
                seconden" passen op een regel en de andere twee niet, en dan
                staan de vier koppen niet meer op dezelfde lijn. Dus breken we
                zelf, op de eerste spatie. */}
            <span style={{ fontFamily: font.ui, fontWeight: 800, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase", color: colors.gold, lineHeight: 1.25 }}>
              {p.titel.split(" ").slice(0, 1).map((w) => (
                <span key={w} style={{ display: "block" }}>{w}</span>
              ))}
              <span style={{ display: "block" }}>{p.titel.split(" ").slice(1).join(" ")}</span>
            </span>
            <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.ink, lineHeight: 1.35 }}>
              {p.tekst}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

