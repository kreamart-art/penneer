// De hulpbalk onder de ladder, nagebouwd naar de mockup.
//
// EEN veld en geen drie tegels. In de mockup zit er een gouden lijst om het
// geheel en wordt de paarse binnenkant verdeeld door twee gouden separators;
// drie losse doosjes naast elkaar geeft zes randen waar er twee horen te staan,
// en dat is precies waarom een eerdere poging goedkoop oogde.
//
// DE LIJST is opgebouwd zoals echt metaal: van buiten naar binnen een schaduw,
// een donkere buitenrand, de gouden body, een donkere binnenrand en bovenop een
// heldere glans. Het licht komt van BOVEN, dus elke gouden laag is licht aan de
// bovenkant en donker aan de onderkant; dat ene gegeven maakt het verschil
// tussen een gouden lijst en een gele rand.
//
// DE BINNENKANT is nooit een vlakke kleur. Er liggen zes dingen op elkaar: een
// donkere bodem, een verticaal verloop, een gloed vanuit het midden, ruis, een
// donkere rand rondom (ambient occlusion) en een binnenschaduw. Elk daarvan is
// nauwelijks te zien; samen zijn ze het verschil tussen glas en papier.
//
// Alles wordt in ECHTE pixels getekend en het vak meet zichzelf op: alleen dan
// blijven de bochten rond en de lijnen overal even dik, hoe breed het scherm ook
// is.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { font } from "../theme/tokens";

export type Hulp = { sleutel: string; label: string; prijs: number; icoon: ReactNode };

/** Een rechthoek met ronde hoeken, als pad zodat een streek hem kan volgen. */
function rond(x: number, y: number, b: number, h: number, r: number): string {
  const k = Math.min(r, b / 2, h / 2);
  return [
    `M ${x + k} ${y}`,
    `L ${x + b - k} ${y}`,
    `Q ${x + b} ${y} ${x + b} ${y + k}`,
    `L ${x + b} ${y + h - k}`,
    `Q ${x + b} ${y + h} ${x + b - k} ${y + h}`,
    `L ${x + k} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - k}`,
    `L ${x} ${y + k}`,
    `Q ${x} ${y} ${x + k} ${y}`,
    "Z",
  ].join(" ");
}

const HOOG = 60;   // hoogte van de balk
const LIJST = 4;   // dikte van de gouden lijst
const R = 13;      // straal van de hoeken

function Verven() {
  return (
    <defs>
      {/* Het goud. Drie lagen, allemaal met het licht van boven: helder aan de
          top, dieper naar onderen. */}
      <linearGradient id="hb-goud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFF3CE" />
        <stop offset="18%" stopColor="#F0CE7A" />
        <stop offset="46%" stopColor="#C9982F" />
        <stop offset="72%" stopColor="#9A6D18" />
        <stop offset="100%" stopColor="#6E4A0E" />
      </linearGradient>
      <linearGradient id="hb-goud-diep" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8A6316" />
        <stop offset="55%" stopColor="#4E340A" />
        <stop offset="100%" stopColor="#2A1B05" />
      </linearGradient>
      <linearGradient id="hb-glans" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#FFF8DF" stopOpacity="0" />
        <stop offset="22%" stopColor="#FFF8DF" stopOpacity="0.95" />
        <stop offset="78%" stopColor="#FFF8DF" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#FFF8DF" stopOpacity="0" />
      </linearGradient>

      {/* De binnenkant, laag voor laag. */}
      <linearGradient id="hb-veld" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2C1250" />
        <stop offset="42%" stopColor="#1D0A38" />
        <stop offset="100%" stopColor="#100520" />
      </linearGradient>
      <radialGradient id="hb-kern" cx="0.5" cy="0.42" r="0.72">
        <stop offset="0%" stopColor="#8B4BE0" stopOpacity="0.22" />
        <stop offset="55%" stopColor="#6A2FB8" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#3A1A66" stopOpacity="0" />
      </radialGradient>
      {/* De donkere rand rondom: waar twee vlakken elkaar raken valt licht weg. */}
      <radialGradient id="hb-hoeken" cx="0.5" cy="0.5" r="0.75">
        <stop offset="60%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
      </radialGradient>
      <linearGradient id="hb-inschaduw" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
        <stop offset="16%" stopColor="#000000" stopOpacity="0" />
        <stop offset="80%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
      </linearGradient>
      {/* De lichtlijn bovenin: violet, niet wit. */}
      <linearGradient id="hb-lichtlijn" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#C98BFF" stopOpacity="0" />
        <stop offset="18%" stopColor="#D9AEFF" stopOpacity="0.9" />
        <stop offset="50%" stopColor="#F1DEFF" stopOpacity="1" />
        <stop offset="82%" stopColor="#D9AEFF" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#C98BFF" stopOpacity="0" />
      </linearGradient>

      <filter id="hb-ruis" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <filter id="hb-waas" x="-40%" y="-60%" width="180%" height="220%">
        <feGaussianBlur stdDeviation="2.6" />
      </filter>
      <filter id="hb-slag" x="-20%" y="-40%" width="140%" height="200%">
        <feGaussianBlur stdDeviation="3.4" />
      </filter>
    </defs>
  );
}

/** De lijst en de binnenkant. Alles hier is decor; de knoppen liggen erboven. */
function Lijst({ b, h, vakken }: { b: number; h: number; vakken: number }) {
  const buiten = rond(LIJST / 2, LIJST / 2, b - LIJST, h - LIJST, R);
  const binnenR = Math.max(3, R - LIJST);
  const binnen = rond(LIJST, LIJST, b - 2 * LIJST, h - 2 * LIJST, binnenR);
  const iB = b - 2 * LIJST;
  return (
    <svg width={b} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} aria-hidden>
      <Verven />

      {/* 1. de slagschaduw onder de balk */}
      <path d={buiten} fill="#000000" opacity="0.55" filter="url(#hb-slag)" transform="translate(0, 3)" />

      {/* 2. de buitenste bevel: donker goud, iets breder dan de body */}
      <path d={buiten} fill="none" stroke="url(#hb-goud-diep)" strokeWidth={LIJST + 1.6} />
      {/* 3. de gouden body */}
      <path d={buiten} fill="none" stroke="url(#hb-goud)" strokeWidth={LIJST} />
      {/* 4. de donkere binnenrand, waar de lijst het paars raakt */}
      <path d={binnen} fill="none" stroke="#3A2606" strokeWidth="1.2" opacity="0.85" />

      {/* 5. de binnenkant, zes lagen op elkaar */}
      <path d={binnen} fill="url(#hb-veld)" />
      <path d={binnen} fill="url(#hb-kern)" />
      <g clipPath="url(#hb-knip)">
        <rect x="0" y="0" width={b} height={h} filter="url(#hb-ruis)" opacity="0.06" />
      </g>
      <clipPath id="hb-knip"><path d={binnen} /></clipPath>
      <path d={binnen} fill="url(#hb-hoeken)" />
      <path d={binnen} fill="url(#hb-inschaduw)" />

      {/* 6. de violette lichtlijn over de volle breedte, met zijn eigen gloed */}
      <line
        x1={LIJST + 6} y1={LIJST + 2.2} x2={b - LIJST - 6} y2={LIJST + 2.2}
        stroke="url(#hb-lichtlijn)" strokeWidth="3.2" opacity="0.6" filter="url(#hb-waas)"
      />
      <line
        x1={LIJST + 6} y1={LIJST + 2.2} x2={b - LIJST - 6} y2={LIJST + 2.2}
        stroke="url(#hb-lichtlijn)" strokeWidth="1.1"
      />

      {/* 7. de gouden separators tussen de vakken */}
      {Array.from({ length: vakken - 1 }, (_, i) => {
        const x = LIJST + (iB * (i + 1)) / vakken;
        return (
          <g key={i}>
            <line x1={x} y1={LIJST + 4} x2={x} y2={h - LIJST - 4} stroke="url(#hb-goud)" strokeWidth="2.6" opacity="0.5" filter="url(#hb-waas)" />
            <line x1={x} y1={LIJST + 4} x2={x} y2={h - LIJST - 4} stroke="url(#hb-goud)" strokeWidth="1.8" />
            <line x1={x - 1} y1={LIJST + 7} x2={x - 1} y2={h - LIJST - 9} stroke="#FFEFC2" strokeWidth="0.5" opacity="0.3" />
          </g>
        );
      })}

      {/* 8. de glans over de bovenrand van de lijst, en een zachtere links */}
      <line x1={b * 0.16} y1={LIJST / 2} x2={b * 0.84} y2={LIJST / 2} stroke="url(#hb-glans)" strokeWidth="1.4" />
      <line x1={LIJST / 2} y1={R} x2={LIJST / 2} y2={h - R} stroke="#FFF3CE" strokeWidth="0.9" opacity="0.3" />

      {/* 9. de hoekjes: een kort helder streepje op elke hoek van de lijst */}
      {[[R, LIJST / 2], [b - R, LIJST / 2]].map(([x, y], i) => (
        <line key={i} x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="#FFFCEC" strokeWidth="1.6" opacity="0.75" />
      ))}
    </svg>
  );
}

/** Het edelsteentje. */
function Steen() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden style={{ flexShrink: 0, filter: "drop-shadow(0 0 5px rgba(190,90,240,.85))" }}>
      <defs>
        <linearGradient id="hb-steen" x1="0.1" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FBC8FF" />
          <stop offset="30%" stopColor="#D46BF5" />
          <stop offset="70%" stopColor="#9A2ED0" />
          <stop offset="100%" stopColor="#5E1288" />
        </linearGradient>
      </defs>
      <path d="M7 0 L14 5.4 L7 16 L0 5.4 Z" fill="url(#hb-steen)" />
      <path d="M7 0 L14 5.4 L7 6.9 Z" fill="#FFFFFF" opacity="0.45" />
      <path d="M7 0 L0 5.4 L7 6.9 Z" fill="#FFFFFF" opacity="0.18" />
      <path d="M0 5.4 L14 5.4" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.35" />
    </svg>
  );
}

export function Hulpbalk({ hulpen, breedte, onKies, op = [] }: {
  hulpen: Hulp[];
  breedte: string;
  onKies?: (sleutel: string) => void;
  op?: string[];
}) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [b, setB] = useState(0);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setB(el.clientWidth);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={doos} style={{ position: "relative", width: breedte, height: HOOG, flexShrink: 0 }}>
      {b > 0 && <Lijst b={b} h={HOOG} vakken={hulpen.length} />}
      <div style={{ position: "relative", height: "100%", display: "flex", padding: LIJST }}>
        {hulpen.map((h) => (
          <button
            key={h.sleutel}
            onPointerDown={(e) => { e.preventDefault(); if (!op.includes(h.sleutel)) onKies?.(h.sleutel); }}
            disabled={!onKies || op.includes(h.sleutel)}
            style={{
              flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              cursor: onKies && !op.includes(h.sleutel) ? "pointer" : "default",
              opacity: op.includes(h.sleutel) ? 0.3 : 1,
              transition: "opacity .2s ease-out",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
            }}
          >
            <span
              style={{
                display: "grid", placeItems: "center", flexShrink: 0,
                color: "#F2E9FF",
                filter: "drop-shadow(0 0 6px rgba(170,110,255,.9))",
              }}
            >
              {h.icoon}
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: font.wide, fontSize: 9.5, fontWeight: 600, letterSpacing: 0.9,
                  whiteSpace: "nowrap", color: "#F4ECFF",
                  textShadow: "0 1px 2px rgba(0,0,0,.7)",
                }}
              >
                {h.label}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Steen />
                <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 14.5, color: "#FFF6DC", textShadow: "0 1px 2px rgba(0,0,0,.75)" }}>
                  {h.prijs}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
