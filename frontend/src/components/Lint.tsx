// Het lint dat over een kaart valt: NIEUW in goud, DUBBEL in blauw.
//
// Art en geen CSS-pil: het lint is gebogen, heeft een lichtflits in de linker
// punt en een schaduw onder de knik. Dat krijg je met een border-radius niet
// voor elkaar, en het is precies wat een kaart een moment geeft.
//
// De bron is 441x368 en bestaat voor het grootste deel uit lucht: de flits
// steekt linksboven ver uit en de schaduw valt rechtsonder. Het LINT zelf zit
// in het midden, dus de tekst gaat niet op het midden van de doos maar op het
// midden van de band (opgemeten: x 12..93%, y 30..70%).
import type { CSSProperties } from "react";
import { font } from "../theme/tokens";

const ART = {
  nieuw: "/ui/lint-nieuw.webp",
  dubbel: "/ui/lint-dubbel.webp",
} as const;

/** Waar de BAND in de art zit, als deel van het beeld. De rest is flits en
 *  schaduw en hoort geen tekst te dragen. */
const BAND = { l: 0.12, r: 0.07, t: 0.30, b: 0.30 };

const VERHOUDING = 441 / 368;

export function Lint({
  soort,
  tekst,
  breed = 62,
  style,
}: {
  soort: keyof typeof ART;
  tekst: string;
  /** Breedte in pixels; de hoogte volgt uit de verhouding van de art. */
  breed?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden={false}
      style={{
        position: "relative", display: "block",
        width: breed, height: breed / VERHOUDING,
        pointerEvents: "none",
        ...style,
      }}
    >
      <img
        src={ART[soort]} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />
      <span
        style={{
          position: "absolute",
          left: `${BAND.l * 100}%`, right: `${BAND.r * 100}%`,
          top: `${BAND.t * 100}%`, bottom: `${BAND.b * 100}%`,
          display: "grid", placeItems: "center",
          fontFamily: font.ui, fontWeight: 800,
          fontSize: Math.max(6.5, breed * 0.145), letterSpacing: ".06em",
          textTransform: "uppercase", whiteSpace: "nowrap",
          color: soort === "nieuw" ? "#3B2300" : "#04122C",
          textShadow: soort === "nieuw" ? "0 1px 0 rgba(255,240,190,.45)" : "0 1px 0 rgba(190,220,255,.35)",
        }}
      >
        {tekst}
      </span>
    </span>
  );
}
