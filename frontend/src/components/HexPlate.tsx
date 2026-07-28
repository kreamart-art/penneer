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
// Bump zodra je een plaat op DEZELFDE naam vervangt: de service worker bewaart
// plaatjes cache-first en ruimt pas op bij zijn volgende activatie.
const PLAAT_ART = 1;

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
      {/* De rustende plaat, met de opgelichte er BOVENOP. Die is er altijd, hij
          staat alleen op nul; zo hoeft de browser bij het indrukken niets in te
          laden en is de overgang een vervaging in plaats van een sprong. De twee
          bestanden zijn op dezelfde doos en dezelfde hartlijn uitgesneden, dus ze
          vallen precies over elkaar. */}
      <img
        aria-hidden
        alt=""
        src="/tiles/hexbutton.webp"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      <img
        aria-hidden
        alt=""
        src={`/tiles/hexbutton-on.webp?v=${PLAAT_ART}`}
        className="hex-aan"
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
