// De kop van de Dagronde: de sierlijst met het kalenderembleem.
//
// De plaat komt uit de mockup zelf, uitgesneden op de kaart (x 6..935,
// y 145..1005 van het origineel) en met een ALFAKANAAL: buiten de lijst valt de
// bijna-zwarte achtergrond van de mockup weg en blijft alleen de gloed staan,
// zodat de plaat op het decor van de app ligt en niet als donkere rechthoek.
// De LETTERS zijn eruit gehaald: titel, uitleg
// en de spelerspil zijn weggewerkt door hun band verticaal te interpoleren
// tussen de schone rijen erboven en eronder, en daarna horizontaal uit te
// middelen. Dat laatste is nodig omdat de gloed van het embleem anders als
// smalle lichtstreep door de lege band bleef staan. Het embleem, de sierlijn
// met de ruit en de lijst zelf zijn onaangeroerd.
//
// De tekst komt er dus LIVE overheen. Dat moet ook: hij is tweetalig en de
// spelersteller verandert per dag.
//
// De drie tekstvlakken zijn opgemeten op de bron en staan hier als deel van de
// plaat. Ze schalen mee, want de maten worden uit de gemeten BREEDTE gerekend
// en niet uit een vaste pixelmaat: op een smal toestel hoort de titel mee te
// krimpen, anders loopt hij uit de lijst.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { KADER_LIJN_PAARS, NeonKader } from "./ProfileHero";
import { colors, font } from "../theme/tokens";

/** Dezelfde lijst, twee emblemen. De schijf in de ring is bij allebei opnieuw
 *  opgebouwd uit zijn eigen omgeving, en daar staat het teken van dat deel op:
 *  een boek voor de woorden en een wereldbol voor de topografie. De kalender
 *  hoorde bij de dagronde als geheel en staat daarom nergens meer in een deel.
 *  Ring, lauwerkrans en stralen zijn in beide gelijk, want het is hetzelfde
 *  onderdeel van dezelfde dag.
 *
 *  De `?v=` hoort erbij: /ui/ komt bij de servicewerker uit de cache, dus een
 *  overschreven plaat op hetzelfde adres blijft anders de oude tonen. */
const ART = {
  woorden: "/ui/dag-sectie.webp?v=2",
  topo: "/ui/dag-sectie-topo.webp",
} as const;
/** Verhouding van de plaat (929x860). */
const VERHOUDING = 929 / 860;
/** Waar de weggehaalde tekst stond, als deel van de plaat. */
const VLAK = {
  x0: 0.0818, x1: 0.9171,
  titel: { t: 0.3872, b: 0.4791 },
  tekst: { t: 0.5291, b: 0.7791 },
  pil: { t: 0.7849, b: 0.8988 },
} as const;
/** Lettergroottes als deel van de BREEDTE van de plaat, opgemeten op de bron. */
const MAAT = { titel: 0.0969, tekst: 0.0323, pil: 0.0323 } as const;

function Vlak({ boven, onder, children }: { boven: number; onder: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${VLAK.x0 * 100}%`, right: `${(1 - VLAK.x1) * 100}%`,
        top: `${boven * 100}%`, bottom: `${(1 - onder) * 100}%`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

export function DagKaart({ titel, tekst, pil, soort = "woorden" }: { titel: string; tekst: string; pil?: ReactNode; soort?: keyof typeof ART }) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [breed, setBreed] = useState(360);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setBreed(el.getBoundingClientRect().width || 360);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={doos} style={{ position: "relative", width: "100%", aspectRatio: `${VERHOUDING}` }}>
      <img
        src={ART[soort]} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", maxWidth: "none" }}
      />

      <Vlak boven={VLAK.titel.t} onder={VLAK.titel.b}>
        {/* Goud met een verloop, geknipt op de letter. Geen text-shadow erbij:
            die wordt over het geknipte verloop heen getekend en maakt de titel
            vuil in plaats van verlicht. */}
        <span
          style={{
            fontFamily: font.display, fontWeight: 800,
            fontSize: breed * MAAT.titel, lineHeight: 1,
            letterSpacing: breed * 0.004,
            textTransform: "uppercase", whiteSpace: "nowrap",
            backgroundImage: "linear-gradient(180deg, #FFF3C4 0%, #FFD873 34%, #F2AE33 62%, #C97C16 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}
        >
          {titel}
        </span>
      </Vlak>

      <Vlak boven={VLAK.tekst.t} onder={VLAK.tekst.b}>
        {/* Smaller dan het vlak: een regel die van lijst tot lijst loopt leest
            als een blok, en de kaart heeft juist lucht aan de zijkanten nodig. */}
        <p style={{ margin: 0, maxWidth: "76%", fontFamily: font.ui, fontSize: breed * MAAT.tekst, lineHeight: 1.45, color: colors.ink }}>
          {tekst}
        </p>
      </Vlak>

      {pil && (
        <Vlak boven={VLAK.pil.t} onder={VLAK.pil.b}>
          {/* Een neon pil met een DOORZICHTIGE binnenkant: de sterrenhemel van
              de plaat loopt eronder door, en dat is precies wat een pil op deze
              lijst hoort te doen. Vandaar `vulling="geen"` plus het hoeklicht
              uit; die wassing zou het vlak alsnog vullen. */}
          <NeonKader
            radius={999}
            vulling="geen"
            hoeklicht={false}
            lijn={KADER_LIJN_PAARS}
            dik={0.5}
            gloed="0 0 12px rgba(154,75,240,.34)"
            binnen={{ padding: `${breed * 0.011}px ${breed * 0.038}px` }}
          >
            <span style={{ fontFamily: font.ui, fontWeight: 700, fontSize: breed * MAAT.pil, color: colors.ink, whiteSpace: "nowrap" }}>
              {pil}
            </span>
          </NeonKader>
        </Vlak>
      )}
    </div>
  );
}
