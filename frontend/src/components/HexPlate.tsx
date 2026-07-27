// De zeshoekige knopplaat uit de UI-map, met het pictogram erop.
//
// De plaat ligt eronder en het pictogram erop, in dezelfde doos, zodat het als
// één knop leest in plaats van als een icoon dat toevallig op een plaatje staat.
// Zonder de skin valt de plaat weg en blijft het kale pictogram over.
import type { CSSProperties } from "react";

const RATIO = 513 / 460; // hoogte / breedte van de art (inclusief zijn eigen gloed)
// De art draagt zijn eigen gloed mee, en die zit niet even ver rondom: het hart
// van de massieve zeshoek ligt op 50,2% breed en 47,6% hoog van de doos. Het
// pictogram gaat dus DAAR staan en niet in het midden van het plaatje, anders
// hangt het net te laag.
const HART_X = "50.2%";
const HART_Y = "47.6%";

export function HexPlate({
  on,
  size = 46,
  children,
  style,
}: {
  on: boolean;
  size?: number;
  children: React.ReactNode;
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
        src="/tiles/hexbutton.webp"
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
