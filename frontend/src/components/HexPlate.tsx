// De zeshoekige knopplaat uit de UI-map, met het pictogram of het cijfer erop.
//
// Eén onderdeel voor ALLE zeshoeken in het spel: de knopjes op de main page, de
// telknopjes op de tegels, de XP-penning op het profiel, het teken in de
// rangpil. Daarvoor werd elke zeshoek los in code getekend, met een eigen
// stapel geknipte lagen; nu is het overal dezelfde art en dus ook overal
// hetzelfde materiaal.
//
// De plaat ligt eronder en de inhoud erop, in dezelfde doos, zodat het als één
// knop leest in plaats van als een icoon dat toevallig op een plaatje staat.
import type { CSSProperties, ReactNode } from "react";

// Hoogte gedeeld door breedte van de art. Een zeshoek met de punt naar boven
// zit op 1,1547; deze komt daar vlak bij, dus de vorm klopt.
const RATIO = 912 / 787;
// Het hart van de zeshoek in de doos: vrijwel het midden, maar niet precies,
// want de art draagt zijn eigen gloed mee en die zit niet even ver rondom.
const HART_X = "49.9%";
const HART_Y = "49%";

export function HexPlate({
  on = true,
  size = 46,
  children,
  style,
}: {
  /** Uit betekent: geen plaat, alleen de inhoud. Voor de main page, die zijn
   *  platen-skin aan en uit kan zetten. */
  on?: boolean;
  size?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  if (!on) return <>{children}</>;
  return (
    <span
      style={{
        position: "relative",
        display: "grid",
        placeItems: "center",
        width: size,
        height: Math.round(size * RATIO),
        lineHeight: 0,
        ...style,
      }}
    >
      <img
        aria-hidden
        alt=""
        src="/tiles/hex.webp"
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
