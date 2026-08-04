// Een lijn in de achthoek van de secties, en verder wat het vak nodig heeft.
//
// De kern is nog steeds: geen glas en geen gloedlaag, alleen een omtrek. Dat
// kan met CSS niet netjes, want een rand met afgeschuinde hoeken maak je met
// `clip-path`, en die knipt ook de rand zelf weg. Vandaar een SVG-omtrek: een
// pad, een streek, en de rest is lucht.
//
// Daar bovenop kan een vak twee dingen krijgen die het diepte geven:
//   `vulling`     een paars verloop van licht boven naar donker onder
//   `binnenlijn`  een tweede omtrek vlak binnen de eerste, alleen sterk in de
//                 hoeken; dat leest als een afgeschuinde rand.
//
// De punten staan in echte pixels en niet in procenten, want een viewBox die in
// twee richtingen anders schaalt maakt van 45 graden iets anders en van een
// lijn van één pixel een lijn die aan de zijkanten dikker is dan boven.
import { useEffect, useId, useRef, useState } from "react";

/** Welke hoeken oplichten bij `fade`, in delen van de breedte en de hoogte.
 *  Linksboven en rechtsonder: twee tegenover elkaar, zodat het vak aan beide
 *  kanten een punt heeft in plaats van aan een kant te beginnen en aan de
 *  andere te verdwijnen. */
const HOEKEN: [number, number][] = [
  [0, 0],
  [1, 1],
];

/** De binnenlijn licht in ALLE VIER de hoeken op, want die hoort de hele vorm
 *  te verdiepen en niet één kant ervan. */
const HOEKEN4: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

export function GoudKader({
  children,
  hoek = 13,
  rond = 2.5,
  dik = 0.5,
  fade = false,
  kleur = "goud",
  gloed = false,
  vulling = false,
  binnenlijn = false,
  binnenSterkte = 0.2,
  padding = 12,
  style,
}: {
  children: React.ReactNode;
  /** Hoe schuin de hoeken zijn afgesneden, in pixels. */
  hoek?: number;
  /** Hoe rond de acht punten zijn, in pixels. Op 0 blijven het scherpe knikken.
   *  Klein houden: de vorm hoort strak te blijven, de bocht haalt alleen de
   *  scherpte van de punt af. */
  rond?: number;
  /** Dikte van de lijn in CSS-pixels. Standaard een halve: dat is het dunste
   *  dat op een scherm met dubbele pixeldichtheid nog een echte lijn is en
   *  niet een rij grijze puntjes. */
  dik?: number;
  /** Laat de lijn uitdoven vanaf de linkerbovenhoek. Dan is alleen die hoek
   *  echt te zien en verdwijnt de rest richting de bovenkant en omlaag, alsof
   *  het licht daar vandaan komt. Uit betekent: een hele omtrek. */
  fade?: boolean;
  /** Goud volgt de secties, violet is de kleur van de bedieningspillen. */
  kleur?: "goud" | "violet";
  /** Een neongloed onder de lijn: dezelfde vorm, dikker en vervaagd. Zo gloeit
   *  er precies wat er staat, in plaats van een schaduw die ernaast ligt. */
  gloed?: boolean;
  /** Vul het vak met een paars verloop, licht boven en donker onder. Zet dit
   *  aan als de sectie een binnenkant hoort te hebben in plaats van recht op
   *  de achtergrond van de app uit te kijken. */
  vulling?: boolean;
  /** Een tweede omtrek vlak binnen de eerste, sterk in de hoeken en weg in het
   *  midden van elke zijde. Twee lijnen zo dicht op elkaar lezen als een rand
   *  met dikte in plaats van als een streep. */
  binnenlijn?: boolean;
  /** Hoe sterk die tweede lijn staat. Op een grote sectie mag hij een fluistering
   *  zijn; op een tegel van een vijfde breed is er zo weinig lijn te zien dat
   *  hij daar meer moet aanzetten om nog als diepte te lezen. */
  binnenSterkte?: number;
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

  /** De acht punten van de achthoek, `naarBinnen` pixels naar binnen geschoven.
   *  Een vorm die overal even ver naar binnen gaat, krijgt een kleinere schuine
   *  hoek: die loopt onder 45 graden, dus hij verliest `naarBinnen * (√2 - 1)`
   *  aan beide kanten. Reken je dat niet mee, dan lopen de twee lijnen in de
   *  hoeken uit elkaar en precies daar moeten ze juist strak op elkaar liggen. */
  const hoekpunten = (naarBinnen: number): [number, number][] => {
    const x0 = o + naarBinnen;
    const y0 = o + naarBinnen;
    const x1 = w - o - naarBinnen;
    const y1 = h - o - naarBinnen;
    const kk = Math.max(2, k - naarBinnen * (Math.SQRT2 - 1));
    return [
      [x0 + kk, y0], [x1 - kk, y0], [x1, y0 + kk], [x1, y1 - kk],
      [x1 - kk, y1], [x0 + kk, y1], [x0, y1 - kk], [x0, y0 + kk],
    ];
  };

  /** Dezelfde acht punten, maar met een bocht op elke punt in plaats van een
   *  scherpe knik. Per punt loopt de lijn `rond` pixels vóór het punt van de
   *  rechte af en komt hij `rond` pixels erna weer terug; het punt zelf is het
   *  stuurpunt van de bocht. Zo blijft de achthoek een achthoek, maar zonder
   *  scherpe punten.
   *
   *  De straal wordt per punt afgeknepen op de helft van de kortste aanliggende
   *  zijde. Zonder die grens zouden op een klein vak twee bochten over elkaar
   *  heen lopen en klapt de vorm binnenstebuiten. */
  const pad = (naarBinnen: number) => {
    if (!w || !h) return "";
    const p = hoekpunten(naarBinnen);
    const n = p.length;
    let d = "";
    for (let i = 0; i < n; i++) {
      const vorige = p[(i - 1 + n) % n];
      const punt = p[i];
      const volgende = p[(i + 1) % n];
      const inX = punt[0] - vorige[0];
      const inY = punt[1] - vorige[1];
      const uitX = volgende[0] - punt[0];
      const uitY = volgende[1] - punt[1];
      const lIn = Math.hypot(inX, inY) || 1;
      const lUit = Math.hypot(uitX, uitY) || 1;
      const r = Math.min(rond, lIn / 2, lUit / 2);
      const ax = punt[0] - (inX / lIn) * r;
      const ay = punt[1] - (inY / lIn) * r;
      const bx = punt[0] + (uitX / lUit) * r;
      const by = punt[1] + (uitY / lUit) * r;
      d += `${i === 0 ? "M" : "L"}${ax},${ay}Q${punt[0]},${punt[1]} ${bx},${by}`;
    }
    return `${d}Z`;
  };

  const punten = pad(0);
  // Zo dicht mogelijk erop: net genoeg lucht dat je twee lijnen ziet en niet
  // een dikke. Onder de 2px lopen ze op een gewoon scherm in elkaar over.
  const binnen = pad(dik + 2);

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
            ) : vulling ? (
              // Staat er een binnenkant onder, dan komt het licht van BOVEN en
              // hoort de lijn dat te volgen: licht op de bovenrand, donker op
              // de onderrand. Zo zijn de rand en de vulling het over dezelfde
              // lichtbron eens.
              <linearGradient id={`${id}h0`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tint.hoog} />
                <stop offset="45%" stopColor={tint.mid} />
                <stop offset="100%" stopColor={tint.laag} />
              </linearGradient>
            ) : (
              // Diagonaal, want op een brede lage pil zie je een verticaal
              // verloop nauwelijks: de zijkanten zijn te kort om iets te tonen.
              <linearGradient id={`${id}h0`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={tint.hoog} />
                <stop offset="30%" stopColor={tint.mid} />
                <stop offset="100%" stopColor={tint.laag} />
              </linearGradient>
            )}
            {vulling && (
              // Opgemeten in de mockup: van (30,15,66) bovenin naar (21,6,40)
              // onderin. Donker genoeg dat witte tekst er gewoon op leest, en
              // net licht genoeg dat het vak van de achtergrond loskomt.
              <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2A1359" />
                <stop offset="55%" stopColor="#200C38" />
                <stop offset="100%" stopColor="#150628" />
              </linearGradient>
            )}
            {binnenlijn && HOEKEN4.map(([hx, hy], i) => (
              // Dezelfde truc als bij `fade`, maar dan in alle vier de hoeken:
              // vier keer dezelfde omtrek, elk met een verloop dat om zijn
              // eigen hoek heen licht is en verderop niets meer doet. Wat je
              // overhoudt zijn vier verdiepte hoeken met lucht ertussen.
              <radialGradient
                key={i} id={`${id}b${i}`} gradientUnits="userSpaceOnUse"
                cx={hx * w} cy={hy * h} r={Math.hypot(w, h)}
              >
                <stop offset="0%" stopColor={tint.hoog} stopOpacity="1" />
                <stop offset="5%" stopColor={tint.hoog} stopOpacity="0.75" />
                <stop offset="12%" stopColor={tint.mid} stopOpacity="0.28" />
                <stop offset="20%" stopColor={tint.laag} stopOpacity="0" />
                <stop offset="100%" stopColor={tint.laag} stopOpacity="0" />
              </radialGradient>
            ))}
            {gloed && (
              <filter id={`${id}g`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation={Math.max(1.6, dik * 4)} />
              </filter>
            )}
          </defs>

          {/* De binnenkant eerst, want alles wat lijn is hoort erbovenop. */}
          {vulling && <path d={punten} fill={`url(#${id}v)`} />}

          {(fade ? HOEKEN.map((_, i) => i) : [0]).map((i) => (
            <g key={i}>
              {/* De gloed is dezelfde vorm, dikker en vervaagd, onder de lijn. */}
              {gloed && (
                <path
                  d={punten} fill="none" stroke={`url(#${id}h${i})`}
                  strokeWidth={Math.max(dik * 3, 1.6)} filter={`url(#${id}g)`}
                  opacity={fade ? 0.9 : 0.75}
                />
              )}
              <path d={punten} fill="none" stroke={`url(#${id}h${i})`} strokeWidth={dik} opacity={fade ? 1 : 0.75} />
            </g>
          ))}

          {/* De sterkte staat als opacity op de vorm en niet in de stops, zodat
              het verloop van hoek naar midden hetzelfde blijft en alleen de
              lijn zwaarder of lichter wordt. */}
          {binnenlijn && HOEKEN4.map((_, i) => (
            <path key={i} d={binnen} fill="none" stroke={`url(#${id}b${i})`} strokeWidth={dik} opacity={binnenSterkte} />
          ))}
        </svg>
      )}
      <div style={{ position: "relative", padding }}>{children}</div>
    </div>
  );
}
