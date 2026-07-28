// De getekende pictogrammen, op de plekken waar eerst een lijntekening stond.
//
// Waarom een eigen onderdeeltje en niet overal een <img>: een lijnicoon neemt
// zijn kleur over van de tekst eromheen en zit precies op de regel. Art doet
// geen van beide. Dus dit onderdeel doet drie dingen die je anders op twintig
// plekken opnieuw zou schrijven:
//
//   1. Het reserveert een VIERKANT van `size` en legt de art daarbinnen met
//      `object-fit: contain`. Zo springt de regelhoogte niet als het ene
//      bestand 128 breed is en het andere 200 hoog.
//   2. Het zet `flexShrink: 0`. Art in een rij naast tekst die te lang wordt,
//      werd anders platgedrukt.
//   3. Het legt een HALO achter de art, in de kleur van de art zelf. Zonder dat
//      valt een gouden pictogram op een donkerpaarse kaart weg, want alle
//      diepte in de art zit in de schaduwen en die zijn daar net zo donker.
//      Een `drop-shadow` zou korter zijn, maar die laat iOS de laag apart
//      rasteren en dan zie je zijn rechthoek over het pictogram heen. Dus een
//      echte laag eronder, net als bij de cijfers op de ranglijst.
//
// Ze staan hier in een lijst zodat een scherm om "beker" vraagt en niet om een
// bestandsnaam. Komt er nieuwe art, dan is dit de enige plek die het weet.
import type { CSSProperties } from "react";

/** Naam -> bestand + de gloedkleur die aan de art gemeten is. */
const ART = {
  beker: { src: "/ui/stat/winsten.webp", gloed: "232,168,23" },
  kroon: { src: "/ui/stat/kroon.webp", gloed: "232,168,23" },
  boek: { src: "/ui/stat/woorden.webp", gloed: "232,168,23" },
  vlam: { src: "/ui/stat/vlam.webp", gloed: "232,163,23" },
  sterren: { src: "/ui/stat/sterren.webp", gloed: "240,190,60" },
  ster: { src: "/ui/stat/ster.webp", gloed: "240,190,60" },
  krans: { src: "/ui/stat/krans.webp", gloed: "172,123,233" },
  munten: { src: "/ui/stat/punten.webp", gloed: "232,168,23" },
  potjes: { src: "/ui/stat/games.webp", gloed: "231,168,33" },
  rond: { src: "/ui/stat/dubbel.webp", gloed: "232,168,23" },
  schild: { src: "/ui/shield/zwart.webp", gloed: "232,168,23" },
} as const;

export type ArtNaam = keyof typeof ART;

export function ArtIcoon({
  naam,
  size = 18,
  gloed = true,
  style,
}: {
  naam: ArtNaam;
  size?: number;
  /** Uit als de art al op een verlicht vlak ligt en de gloed dubbelop zou zijn. */
  gloed?: boolean;
  style?: CSSProperties;
}) {
  const a = ART[naam];
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-grid",
        placeItems: "center",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {gloed && (
        <span
          style={{
            position: "absolute",
            inset: "6%",
            borderRadius: "50%",
            background: `radial-gradient(closest-side, rgba(${a.gloed},.5) 0%, rgba(${a.gloed},.16) 58%, transparent 100%)`,
            // Een derde van de maat, dezelfde vuistregel als bij tekst: groter
            // wordt het een waas om de vorm heen in plaats van licht erachter.
            filter: `blur(${Math.max(2, Math.round(size / 5))}px)`,
          }}
        />
      )}
      <img
        src={a.src}
        alt=""
        style={{ position: "relative", width: size, height: size, objectFit: "contain", display: "block" }}
      />
    </span>
  );
}
