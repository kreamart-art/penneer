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
import { useEffect, useState } from "react";
import { font, withAlpha } from "../theme/tokens";
import { RingFoto } from "./ProfileHero";

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

export type Speler = {
  id: string;
  naam: string;
  kleur: string;
  foto: boolean;
  versie: number;
  score: number;
};

/** Een kop in het ruitje: de foto in een gouden ring met er tekst naast.
 *
 *  GEEN PUNTEN meer op dit gezicht. Je eigen stand staat een paar tellen later
 *  toch in het andere gezicht, en de scores in de arena lopen in de duizenden:
 *  dan past het getal niet meer in het ruitje en is het bovendien dubbelop. Wat
 *  hier telt is WIE je gaat passeren en hoe ver dat nog is, en dat is een klein
 *  getal.
 *
 *  De letters krimpen mee als de tekst lang wordt. Een naam kan alles zijn, dus
 *  een vaste lettergrootte gaat er vroeg of laat overheen. */
function Kop({ speler, kant, kop, waarde }: {
  speler: Speler;
  kant: "links" | "rechts";
  kop: string;
  waarde?: string;
}) {
  const M = 38;
  const kopMaat = kop.length > 9 ? 8 : kop.length > 7 ? 8.8 : 9.5;
  const waardeMaat = !waarde ? 0 : waarde.length > 5 ? 13 : 15;
  return (
    <span
      style={{
        position: "absolute",
        // In het RUITJE en niet tegen de lijst: de plaat heeft twee vensters en
        // die staan al opgemeten in SCORE_RUIT.
        top: pct(SCORE_RUIT.t), height: pct(SCORE_RUIT.h),
        [kant === "links" ? "left" : "right"]: pct(kant === "links" ? SCORE_RUIT.links.l : 1 - (SCORE_RUIT.rechts.l + SCORE_RUIT.rechts.b)),
        width: pct(SCORE_RUIT.links.b),
        boxSizing: "border-box",
        // GESTAPELD en niet naast elkaar. Naast elkaar kwam de ring op het gouden
        // sierwerk van de plaat te staan: het ruitje loopt van 229,3 tot 345 en de
        // ring stond op 296 tot 334, precies waar dat werk zit. Boven elkaar
        // hoeft er horizontaal niets meer naast en staat de ring midden in het
        // venster. Het ruitje is 63 hoog en ring plus naam samen 51, dus het past.
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
      }}
    >
      <span
        style={{
          position: "relative", width: M, height: M, flexShrink: 0, borderRadius: "50%",
          overflow: "hidden",
          boxShadow: "0 0 0 1px #D8A63C, 0 0 0 1.7px #6E4A0E, 0 0 7px rgba(255,190,60,.4)",
        }}
      >
        <RingFoto userId={speler.id} versie={speler.versie} heeftFoto={speler.foto} naam={speler.naam} kleur={speler.kleur} />
      </span>
      <span
        style={{
          fontFamily: font.wide, fontSize: kopMaat, letterSpacing: 0.9, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
          color: withAlpha("#FFE7A8", 0.82), lineHeight: 1,
        }}
      >
        {kop}
      </span>
      {waarde && (
        <span
          style={{
            fontFamily: font.display, fontWeight: 800, fontSize: waardeMaat, lineHeight: 1,
            color: "#FFF3D0", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
            textShadow: "0 0 12px rgba(255,190,60,.5)",
          }}
        >
          {waarde}
        </span>
      )}
    </span>
  );
}

/** De hele balk: de plaat met links en rechts een ruitje.
 *
 *  De schaduw is een tweede kopie van dezelfde plaat, zwartgemaakt en vervaagd,
 *  en niet een drop-shadow: die breekt op iOS, waar Safari de laag apart rastert
 *  en je de rechthoek van die laag over de art heen ziet liggen. */
export function Scorebord({ links, rechts, breedte, duel }: {
  links: { kop: string; waarde: string; kleur?: string };
  rechts: { kop: string; waarde: string; kleur?: string };
  breedte: string;
  /** Jij tegen degene die je gaat passeren. Zit hij erin, dan wisselt de balk om
   *  de zoveel tellen tussen de cijfers en deze twee koppen. */
  duel?: { mij: Speler; rivaal: Speler } | null;
}) {
  const art = "/ui/soep/scorebord.webp?v=1";
  // De wissel loopt door zolang er een rivaal is. Zeven tellen: kort genoeg om
  // op te vallen, lang genoeg om je som af te maken zonder dat er iets in je
  // ooghoek beweegt.
  const [kant, setKant] = useState(0);
  useEffect(() => {
    if (!duel) { setKant(0); return; }
    const id = window.setInterval(() => setKant((k) => 1 - k), 7000);
    return () => window.clearInterval(id);
  }, [duel]);
  const toonDuel = !!duel && kant === 1;
  return (
    <div style={{ position: "relative", width: breedte, height: `calc(${breedte} / ${SCORE_V})`, flexShrink: 0 }}>
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(11px)", opacity: 0.55, transform: "translateY(9px)", pointerEvents: "none" }} />
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {/* Twee gezichten op dezelfde plaat, over elkaar heen. Kruisfade en geen
          omschakeling: een balk die knippert leest als een fout. */}
      <span style={{ position: "absolute", inset: 0, opacity: toonDuel ? 0 : 1, transition: "opacity .45s ease-in-out", pointerEvents: "none" }}>
        <Meter kop={links.kop} waarde={links.waarde} kleur={links.kleur} breuk={SCORE_RUIT.links} />
        <Meter kop={rechts.kop} waarde={rechts.waarde} kleur={rechts.kleur} breuk={SCORE_RUIT.rechts} />
      </span>
      {duel && (
        <span style={{ position: "absolute", inset: 0, opacity: toonDuel ? 1 : 0, transition: "opacity .45s ease-in-out", pointerEvents: "none" }}>
          {/* Links wie je bent, rechts wie je gaat passeren en hoeveel je nog
              tekort komt. Dat verschil is het enige getal dat hier iets zegt. */}
          <Kop speler={duel.mij} kant="links" kop={duel.mij.naam.toUpperCase()} />
          <Kop
            speler={duel.rivaal}
            kant="rechts"
            kop={duel.rivaal.naam.toUpperCase()}
            waarde={`+${duel.rivaal.score - duel.mij.score}`}
          />
        </span>
      )}
    </div>
  );
}
