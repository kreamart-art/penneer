// Een gouden lijn in de achthoek van de secties, en verder niets.
//
// Geen glas, geen vulling, geen gloedlaag: de inhoud van het vak kijkt recht op
// de achtergrond van de app uit. Dat kan met CSS niet netjes, want een rand met
// afgeschuinde hoeken maak je met `clip-path`, en die knipt ook de rand zelf
// weg. Vandaar een SVG-omtrek: één pad, één streek, en de rest is lucht.
//
// De punten staan in echte pixels en niet in procenten, want een viewBox die in
// twee richtingen anders schaalt maakt van 45 graden iets anders en van een
// lijn van één pixel een lijn die aan de zijkanten dikker is dan boven.
import { useEffect, useId, useRef, useState } from "react";

/** Welke hoeken oplichten, in delen van de breedte en de hoogte. Linksboven en
 *  rechtsonder: twee tegenover elkaar, zodat het vak aan beide kanten een punt
 *  heeft in plaats van aan een kant te beginnen en aan de andere te verdwijnen. */
const HOEKEN: [number, number][] = [
  [0, 0],
  [1, 1],
];

export function GoudKader({
  children,
  hoek = 13,
  dik = 0.5,
  fade = false,
  kleur = "goud",
  gloed = false,
  padding = 12,
  style,
}: {
  children: React.ReactNode;
  /** Hoe schuin de hoeken zijn afgesneden, in pixels. */
  hoek?: number;
  /** Dikte van de lijn in CSS-pixels. Standaard een halve: dat is het dunste
   *  dat op een scherm met dubbele pixeldichtheid nog een echte lijn is en
   *  niet een rij grijze puntjes. */
  dik?: number;
  /** Laat de lijn uitdoven vanaf de linkerbovenhoek. Dan is alleen die hoek
   *  echt te zien en verdwijnt de rest richting de bovenkant en omlaag, alsof
   *  het licht daar vandaan komt. */
  fade?: boolean;
  /** Goud volgt de secties, violet is de kleur van de bedieningspillen. */
  kleur?: "goud" | "violet";
  /** Een neongloed onder de lijn: dezelfde vorm, dikker en vervaagd. Zo gloeit
   *  er precies wat er staat, in plaats van een schaduw die ernaast ligt. */
  gloed?: boolean;
  padding?: number | string;
  style?: React.CSSProperties;
}) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [maat, setMaat] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setMaat({ w: el.clientWidth, h: el.clientHeight });
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const id = useId().replace(/:/g, "");
  const tint = kleur === "violet"
    // Lavendel linksboven waar het licht vandaan komt, naar diep violet.
    ? { hoog: "#D9C2FF", mid: "#9159E8", laag: "#4B2394" }
    : { hoog: "#FEEB81", mid: "#F3B53E", laag: "#B8791F" };
  const { w, h } = maat;
  const k = Math.min(hoek, w / 2, h / 2);
  // De helft van de streek naar binnen, anders valt de andere helft buiten de
  // SVG en oogt de lijn aan de randen dunner dan in het midden.
  const o = dik / 2;
  const punten = w && h
    ? [
        `${k},${o}`, `${w - k},${o}`, `${w - o},${k}`, `${w - o},${h - k}`,
        `${w - k},${h - o}`, `${k},${h - o}`, `${o},${h - k}`, `${o},${k}`,
      ].join(" ")
    : "";

  return (
    <div ref={doos} style={{ position: "relative", ...style }}>
      {w > 0 && (
        <svg
          width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden
          style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "block" }}
        >
          <defs>
            {fade ? (
              // EEN STUKJE HOEK, en dat twee keer: linksboven en rechtsonder.
              // De lijn begint vol in zo'n hoek en is een eindje verderop al
              // weg, dus wat je ziet is de hoek zelf plus een klein stukje van
              // de twee randen die erop uitkomen. Daartussen is er geen lijn.
              //
              // TWEE VERLOPEN EN TWEE KEER DEZELFDE OMTREK. Een verloop rekent
              // met de afstand tot EEN punt, dus twee lichte hoeken passen niet
              // in een verloop; ze overlappen elkaar ook niet, want elk is al
              // op voordat het andere begint.
              //
              // De straal is de diagonaal, zodat de stops in delen van het hele
              // vak staan en niet van de langste zijde. Bij een lang vak zou de
              // hoek anders veel verder doorlopen dan bij een kort vak, terwijl
              // je in beide gevallen hetzelfde stukje hoort te zien.
              <>
                {HOEKEN.map(([hx, hy], i) => (
                  <radialGradient
                    key={i} id={`${id}h${i}`} gradientUnits="userSpaceOnUse"
                    cx={hx * w} cy={hy * h} r={Math.hypot(w, h)}
                  >
                    <stop offset="0%" stopColor={tint.hoog} stopOpacity="0.5" />
                    <stop offset="3%" stopColor={tint.hoog} stopOpacity="0.4" />
                    <stop offset="9%" stopColor={tint.mid} stopOpacity="0.15" />
                    <stop offset="15%" stopColor={tint.laag} stopOpacity="0" />
                    <stop offset="100%" stopColor={tint.laag} stopOpacity="0" />
                  </radialGradient>
                ))}
              </>
            ) : (
              // Diagonaal, want op een brede lage pil zie je een verticaal
              // verloop nauwelijks: de zijkanten zijn te kort om iets te tonen.
              <linearGradient id={`${id}h0`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={tint.hoog} />
                <stop offset="30%" stopColor={tint.mid} />
                <stop offset="100%" stopColor={tint.laag} />
              </linearGradient>
            )}
            {gloed && (
              <filter id={`${id}g`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation={Math.max(1.6, dik * 4)} />
              </filter>
            )}
          </defs>
          {(fade ? HOEKEN.map((_, i) => i) : [0]).map((i) => (
            <g key={i}>
              {/* De gloed is dezelfde vorm, dikker en vervaagd, onder de lijn. */}
              {gloed && (
                <polygon
                  points={punten} fill="none" stroke={`url(#${id}h${i})`}
                  strokeWidth={Math.max(dik * 3, 1.6)} filter={`url(#${id}g)`}
                  opacity={fade ? 0.9 : 0.75}
                />
              )}
              <polygon points={punten} fill="none" stroke={`url(#${id}h${i})`} strokeWidth={dik} opacity={fade ? 1 : 0.75} />
            </g>
          ))}
        </svg>
      )}
      <div style={{ position: "relative", padding }}>{children}</div>
    </div>
  );
}
