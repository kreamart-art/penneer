// Het tv-scherm met de marmeren binnenkant.
//
// Een lijst instellingen sluit af met een naamplaatje, en dat naamplaatje is
// hier een scherm: paars-gouden kast, zwart marmer met gloeiende aders erin.
// De inhoud gaat IN het scherm en niet op de kast, dus de plaatsing komt uit
// opgemeten randen en niet uit een schatting.
//
// Opgemeten op de bron (2946x1876 na bijsnijden op zichtbare pixels): de kast
// is fel paars (blauw ruim boven rood), het scherm is dat nergens. De mediaan
// van de laatste paarse pixel per rij en per kolom geeft het venster:
// links 6,48%, rechts 6,52%, boven 10,23%, onder 14,50%.
import type { CSSProperties, ReactNode } from "react";

const ART = "/ui/tv-marmer.webp";
/** Verhouding van de hele plaat (1200x764). */
const VERHOUDING = 1200 / 764;
/** Waar het marmeren scherm zit, als deel van de plaat. */
const SCHERM = { l: 0.0648, r: 0.0652, t: 0.1023, b: 0.145 };

export function TvPaneel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${VERHOUDING}`, ...style }}>
      <img
        src={ART} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", maxWidth: "none" }}
      />
      {/* Een zachte schaduw midden op het scherm. Het marmer heeft gloeiende
          aders die dwars door de tekst lopen; zonder deze laag hangt een witte
          letter zo nu en dan op een felle ader en valt hij weg. Naar de randen
          toe verdwijnt hij, dus het marmer blijft marmer. */}
      <div
        style={{
          position: "absolute",
          left: `${SCHERM.l * 100}%`, right: `${SCHERM.r * 100}%`,
          top: `${SCHERM.t * 100}%`, bottom: `${SCHERM.b * 100}%`,
          background: "radial-gradient(ellipse at 50% 50%, rgba(4,2,10,.72) 0%, rgba(4,2,10,.5) 45%, rgba(4,2,10,0) 78%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${SCHERM.l * 100}%`, right: `${SCHERM.r * 100}%`,
          top: `${SCHERM.t * 100}%`, bottom: `${SCHERM.b * 100}%`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          // De hoeken van het venster zijn afgeschuind, dus de inhoud houdt
          // afstand van de rand in plaats van er tot in de punt door te lopen.
          padding: "3% 7%", textAlign: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
