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
import { useLayoutEffect, useRef, useState } from "react";
import { font, withAlpha } from "../theme/tokens";

/** Breedte gedeeld door hoogte van de plaat. */
export const SCORE_V = 3.7805;

/** Waar de twee vensters in de plaat zitten, in breuken van de sectie.
 *
 *  OPGEMETEN in scorebord.webp (1080x286) en niet geschat. Het paarse vlak is
 *  te scheiden van de gouden lijst op TINT alleen (goud heeft rood boven blauw,
 *  het vlak blauw boven rood); op helderheid lukt dat niet, want er ligt een
 *  lichtstreep dwars door het vlak.
 *
 *  Het rechter vlak loopt van x 691 tot 1027 en van y 53 tot 250. Het linker is
 *  daar de spiegel van: 1080-1027 = 53 tot 1080-691 = 389. Dat de spiegeling
 *  klopt is apart nagegaan, door de plaat over zichzelf te leggen; de beste
 *  match ligt op nul verschuiving.
 *
 *  Waar het misging: de vensters stonden op t 0,17 en h 0,66, dus met hun hart
 *  op precies de helft van de plaat. Het vlak zit LAGER, want de bovenlijst is
 *  dikker dan de onderlijst. Op een plaat van 95 hoog scheelde dat drie pixels,
 *  en dat is precies genoeg om te zien dat de tellers te hoog hangen. */
export const SCORE_RUIT = {
  t: 53 / 286, h: (250 - 53) / 286,
  links: { l: 53 / 1080, b: (389 - 53) / 1080 },
  rechts: { l: 691 / 1080, b: (1027 - 691) / 1080 },
};

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

/** Hoeveel van de vensterbreedte het getal mag beslaan. De rest is lucht tegen
 *  de gouden lijst aan; een cijfer dat de rand raakt leest als een fout. */
const RUIMTE = 0.86;

/** Een van de twee ruitjes: een kop in klein kapitaal met het getal eronder.
 *
 *  Het getal KRIMPT als het niet past. In Waag het verdubbelt de pot elke ronde,
 *  dus na tien goede antwoorden staat er 5120 en na vijftien 163840; op de vaste
 *  maat liep dat het venster uit en stond het over de gouden lijst heen.
 *
 *  Meten en niet gokken op het aantal cijfers: een 1 is smaller dan een 8, en de
 *  breedte van het venster hangt aan de schermbreedte. `offsetWidth` is de maat
 *  ZONDER de schaal (een transform verandert de layout niet), dus de meting kan
 *  niet met zichzelf op hol slaan. */
export function Meter({ kop, waarde, kleur = "#FFF3D0", breuk }: {
  kop: string;
  waarde: string;
  kleur?: string;
  breuk: { l: number; b: number };
}) {
  const doos = useRef<HTMLDivElement | null>(null);
  const tekst = useRef<HTMLSpanElement | null>(null);
  const [schaal, setSchaal] = useState(1);

  useLayoutEffect(() => {
    const meet = () => {
      const d = doos.current;
      const s = tekst.current;
      if (!d || !s) return;
      const vol = s.offsetWidth;
      const ruimte = d.clientWidth * RUIMTE;
      setSchaal(vol > 0 && vol > ruimte ? ruimte / vol : 1);
    };
    meet();
    const d = doos.current;
    if (!d) return;
    // De balk schaalt met de schermbreedte, dus draaien of een ander toestel
    // verandert de ruimte. Dan hoort de meting opnieuw te gebeuren.
    const ro = new ResizeObserver(meet);
    ro.observe(d);
    return () => ro.disconnect();
  }, [waarde]);

  return (
    <div
      ref={doos}
      style={{
        position: "absolute",
        left: pct(breuk.l), width: pct(breuk.b),
        top: pct(SCORE_RUIT.t), height: pct(SCORE_RUIT.h),
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
      }}
    >
      {/* De negatieve marge is de letterspatie die ACHTER de laatste letter
          blijft staan. Die telt mee in de breedte, dus zonder de correctie staat
          het woord er een halve spatie te ver links in. */}
      <span style={{ fontFamily: font.wide, fontSize: 11, letterSpacing: 1.7, marginRight: -1.7, color: withAlpha("#FFE7A8", 0.72) }}>{kop}</span>
      <span
        ref={tekst}
        style={{
          fontFamily: font.display, fontWeight: 800, fontSize: 26, lineHeight: 1, color: kleur,
          fontVariantNumeric: "tabular-nums", textShadow: "0 0 12px rgba(255,190,60,.5)",
          whiteSpace: "nowrap",
          transform: schaal < 1 ? `scale(${schaal.toFixed(3)})` : undefined,
          transformOrigin: "center",
        }}
      >
        {waarde}
      </span>
    </div>
  );
}

/** De hele balk: de plaat met links en rechts een venster.
 *
 *  ALLEEN CIJFERS. Er heeft een tweede gezicht op gezeten met de avatars van
 *  jou en degene die je gaat passeren, dat er om de zeven tellen overheen
 *  schoof. Dat is er weer af: de ringen stonden niet goed in de plaat en het
 *  idee wordt opnieuw bedacht. De balk toont dus weer gewoon wat hij aankondigt.
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
