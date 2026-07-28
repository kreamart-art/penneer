// De zeshoek-art uit de UI-map, met een cijfer of teken erop.
//
// Losse plaat naast `HexPlate`. Die is van de main page: de knoppen voor
// instellingen, muziek en uitleg houden hun eigen, oudere paarse art. Deze
// gouden zeshoek is voor de CIJFERKNOPJES (dagronde, duel, missies) en voor de
// zeshoeken op het profiel.
import type { CSSProperties, ReactNode } from "react";

// Hoogte gedeeld door breedte van de art. Een zeshoek met de punt naar boven
// zit op 1,1547; deze komt daar vlak bij, dus de vorm klopt.
const RATIO = 912 / 787;
// Het hart van de zeshoek in de doos: vrijwel het midden, maar niet precies,
// want de art draagt zijn eigen gloed mee en die zit niet even ver rondom.
const HART_X = "49.9%";
const HART_Y = "49%";

export function HexArt({ maat, children, style }: { maat: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        position: "relative",
        display: "grid",
        placeItems: "center",
        width: maat,
        height: Math.round(maat * RATIO),
        lineHeight: 0,
        ...style,
      }}
    >
      <img
        src="/tiles/hex.webp"
        alt=""
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      <span
        style={{
          position: "absolute",
          left: HART_X,
          top: HART_Y,
          transform: "translate(-50%, -50%)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {children}
      </span>
    </span>
  );
}
