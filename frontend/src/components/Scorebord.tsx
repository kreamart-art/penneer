// De scorebalk van de arena: de gouden plaat met twee ruitjes erin.
//
// Getekend voor Lettersoep, maar er is niets soep-eigens aan: het zijn twee
// vakken met een kop en een getal. Rekenladder gebruikt dezelfde balk met
// andere koppen, en elk volgend arenaspel kan dat ook. Vandaar hier en niet in
// een van de twee spellen, want een gedeelde plaat met twee kopieen van dezelfde
// maten loopt gegarandeerd uit elkaar.
//
// De maten zijn OPGEMETEN in het bestand en staan in breuken van de sectie, niet
// in pixels: de balk schaalt mee met de schermbreedte en de ruitjes moeten dan
// vanzelf mee schuiven.
import { font, withAlpha } from "../theme/tokens";

/** Breedte gedeeld door hoogte van de plaat. */
export const SCORE_V = 3.7805;

/** Waar de twee ruitjes in de plaat zitten, in breuken van de sectie. */
export const SCORE_RUIT = {
  t: 0.17, h: 0.66,
  links: { l: 0.0407, b: 0.3213 },
  rechts: { l: 0.637, b: 0.3213 },
};

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

/** Een van de twee ruitjes: een kop in klein kapitaal met het getal eronder. */
export function Meter({ kop, waarde, kleur = "#FFF3D0", breuk }: {
  kop: string;
  waarde: string;
  kleur?: string;
  breuk: { l: number; b: number };
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: pct(breuk.l), width: pct(breuk.b),
        top: pct(SCORE_RUIT.t), height: pct(SCORE_RUIT.h),
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
      }}
    >
      <span style={{ fontFamily: font.wide, fontSize: 11, letterSpacing: 1.7, color: withAlpha("#FFE7A8", 0.72) }}>{kop}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 26, lineHeight: 1, color: kleur, fontVariantNumeric: "tabular-nums", textShadow: "0 0 12px rgba(255,190,60,.5)" }}>{waarde}</span>
    </div>
  );
}

/** De hele balk: de plaat met links en rechts een ruitje.
 *
 *  De schaduw is een tweede kopie van dezelfde plaat, zwartgemaakt en vervaagd,
 *  en niet een drop-shadow: die breekt op iOS, waar Safari de laag apart rastert
 *  en je de rechthoek van die laag over de art heen ziet liggen. */
export function Scorebord({ links, rechts, breedte }: {
  links: { kop: string; waarde: string; kleur?: string };
  rechts: { kop: string; waarde: string; kleur?: string };
  breedte: string;
}) {
  const art = "/ui/soep/scorebord.webp?v=1";
  return (
    <div style={{ position: "relative", width: breedte, height: `calc(${breedte} / ${SCORE_V})`, flexShrink: 0 }}>
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(11px)", opacity: 0.55, transform: "translateY(9px)", pointerEvents: "none" }} />
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <Meter kop={links.kop} waarde={links.waarde} kleur={links.kleur} breuk={SCORE_RUIT.links} />
      <Meter kop={rechts.kop} waarde={rechts.waarde} kleur={rechts.kleur} breuk={SCORE_RUIT.rechts} />
    </div>
  );
}
