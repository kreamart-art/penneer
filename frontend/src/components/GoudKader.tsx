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

export function GoudKader({
  children,
  hoek = 13,
  dik = 0.5,
  fade = false,
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
              // Vanuit de linkerbovenhoek naar buiten. De straal is iets meer
              // dan de halve breedte, zodat de lijn halverwege de bovenrand op
              // is en langs de linkerkant nog net zichtbaar naar beneden loopt.
              <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={Math.max(w, h) * 0.62}>
                <stop offset="0%" stopColor="#FEEB81" stopOpacity="0.95" />
                <stop offset="35%" stopColor="#F3B53E" stopOpacity="0.5" />
                <stop offset="70%" stopColor="#B8791F" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#B8791F" stopOpacity="0" />
              </radialGradient>
            ) : (
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FEEB81" />
                <stop offset="45%" stopColor="#F3B53E" />
                <stop offset="100%" stopColor="#B8791F" />
              </linearGradient>
            )}
          </defs>
          <polygon points={punten} fill="none" stroke={`url(#${id})`} strokeWidth={dik} opacity={fade ? 1 : 0.55} />
        </svg>
      )}
      <div style={{ position: "relative", padding }}>{children}</div>
    </div>
  );
}
