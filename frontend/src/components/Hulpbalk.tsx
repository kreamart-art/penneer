// De hulpbalk onder de ladder: drie glazen tegels in een langwerpige bak.
//
// De opbouw is de stapeling uit de mockup, van buiten naar binnen:
//
//   1. de BAK. Een haarlijn goud om een glasvlak van twintig procent. Dat is de
//      dunste lijn van het scherm en dat is met opzet: hij mag er ZIJN, niet
//      opvallen, want de ladder erboven is waar je naar kijkt.
//   2. de TEGELS. Hetzelfde glas van twintig procent met een dunne paarse lijn.
//   3. de HIGHLIGHTS. Een kort streepje net binnen de bovenrand. Kort met opzet:
//      loopt zo'n streepje over de halve rand, dan leest het niet als licht maar
//      als een gekleurd vlak.
//
// DE LIJN IS EEN GETEKEND PAD, geen rand en geen geknipte laag. Twee dingen die
// allebei geprobeerd zijn en niet werken:
//   - een gevulde laag met de vulling eroverheen: bij twintig procent vulling
//     schijnt de lijnkleur dwars door het hele vlak, en dan is het geen lijn
//     meer maar een gekleurd vak.
//   - de maskertruc (de padding uitknippen): die knipt een RECHTHOEK uit, dus op
//     de afgeschuinde hoeken wordt de lijn smaller en valt hij daar weg.
// Een pad volgt de afschuining wel, dus de hoeken zijn even dik als de rest.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { font, withAlpha } from "../theme/tokens";

const achthoek = (b: number, h: number, c: number) =>
  `M ${c} 0 L ${b - c} 0 L ${b} ${c} L ${b} ${h - c} L ${b - c} ${h} L ${c} ${h} L 0 ${h - c} L 0 ${c} Z`;

/** Een glasvlak met een getekende lijn eromheen. Het vak meet zichzelf op, want
 *  het pad wordt in ECHTE pixels getekend: alleen dan blijven de afschuiningen
 *  45 graden en is de lijn overal even dik, hoe breed het vak ook wordt. */
function Glas({ verf, dik, hoek, vulling, gloed, glans = "#FFFFFF", children, style }: {
  verf: string;
  dik: number;
  hoek: number;
  vulling: string;
  /** Een vervaagde kopie van de omtrek eronder: licht dat van het glas afkomt. */
  gloed?: string;
  /** De kleur van het streepje op de bovenrand. */
  glans?: string;
  children?: ReactNode;
  style?: React.CSSProperties;
}) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [maat, setMaat] = useState({ b: 0, h: 0 });
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setMaat({ b: el.clientWidth, h: el.clientHeight });
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { b, h } = maat;
  return (
    <div ref={doos} style={{ position: "relative", ...style }}>
      {b > 0 && (
        <svg width={b} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
          <defs>
            <linearGradient id="hb-goud" x1="0" y1="0" x2="1" y2="0.9">
              <stop offset="0%" stopColor="#FFE9B0" />
              <stop offset="26%" stopColor="#E0B45C" />
              <stop offset="52%" stopColor="#A87422" />
              <stop offset="74%" stopColor="#F2D38A" />
              <stop offset="100%" stopColor="#C8983A" />
            </linearGradient>
            {/* De vulling van een tegel: nog steeds twintig procent, maar
                belicht. Een egale twintig procent leest als een sticker; met
                licht bovenin en diepte onderin leest hetzelfde vlak als glas. */}
            <linearGradient id="hb-tegel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A863FF" stopOpacity="0.26" />
              <stop offset="42%" stopColor="#5E2FA8" stopOpacity="0.19" />
              <stop offset="100%" stopColor="#1B0B36" stopOpacity="0.24" />
            </linearGradient>
            <linearGradient id="hb-paars" x1="0" y1="0" x2="1" y2="0.9">
              <stop offset="0%" stopColor="#C79BFF" />
              <stop offset="34%" stopColor="#8B5BD6" />
              <stop offset="62%" stopColor="#5E3596" />
              <stop offset="100%" stopColor="#B487F5" />
            </linearGradient>
            <linearGradient id="hb-glans" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={glans} stopOpacity="0" />
              <stop offset="50%" stopColor={glans} stopOpacity="0.95" />
              <stop offset="100%" stopColor={glans} stopOpacity="0" />
            </linearGradient>
            {/* De binnenschaduw: donker onderin, niets bovenin. Dat is wat een
                vlak in een bak legt in plaats van erop. */}
            <linearGradient id="hb-diep" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity="0" />
              <stop offset="58%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
            </linearGradient>
            <filter id="hb-waas" x="-25%" y="-30%" width="150%" height="160%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          {gloed && (
            <path
              d={achthoek(b - dik, h - dik, hoek)}
              transform={`translate(${dik / 2}, ${dik / 2})`}
              fill="none" stroke={gloed} strokeWidth={dik + 2.2} opacity="0.55" filter="url(#hb-waas)"
            />
          )}
          <path
            d={achthoek(b - dik, h - dik, hoek)}
            transform={`translate(${dik / 2}, ${dik / 2})`}
            fill={vulling}
            stroke={verf}
            strokeWidth={dik}
            strokeLinejoin="round"
          />
          <path
            d={achthoek(b - dik, h - dik, hoek)}
            transform={`translate(${dik / 2}, ${dik / 2})`}
            fill="url(#hb-diep)" stroke="none"
          />
          <line x1={b * 0.22} y1={dik + 1.1} x2={b * 0.78} y2={dik + 1.1} stroke="url(#hb-glans)" strokeWidth="1.2" />
        </svg>
      )}
      <div style={{ position: "relative", height: "100%" }}>{children}</div>
    </div>
  );
}

/** Het edelsteentje met het aantal ernaast. */
function Prijs({ aantal }: { aantal: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <svg width="10" height="12" viewBox="0 0 11 13" aria-hidden style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="hb-steen" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#F0A6FF" />
            <stop offset="45%" stopColor="#B44BE8" />
            <stop offset="100%" stopColor="#7A22B0" />
          </linearGradient>
        </defs>
        <path d="M5.5 0 L11 4.4 L5.5 13 L0 4.4 Z" fill="url(#hb-steen)" />
        <path d="M5.5 0 L11 4.4 L5.5 5.6 Z" fill="#FFFFFF" opacity="0.35" />
      </svg>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 11.5, color: "#FFF3D0" }}>{aantal}</span>
    </span>
  );
}

export type Hulp = { sleutel: string; label: string; prijs: number; icoon: ReactNode };

/** De drie tegels in hun bak. `onKies` is optioneel: zonder blijft de balk staan
 *  maar doet hij niets. `op` zijn de hulpen die al gebruikt zijn. */
export function Hulpbalk({ hulpen, breedte, onKies, op = [] }: {
  hulpen: Hulp[];
  breedte: string;
  onKies?: (sleutel: string) => void;
  op?: string[];
}) {
  return (
    <Glas
      verf="url(#hb-goud)"
      dik={1}
      hoek={12}
      vulling="rgba(24,10,44,.20)"
      style={{ width: breedte, padding: 7, flexShrink: 0 }}
    >
      <div style={{ display: "flex", gap: 6, padding: "5px 0" }}>
        {hulpen.map((h) => (
          <Glas
            key={h.sleutel}
            verf="url(#hb-paars)"
            dik={1}
            hoek={9}
            gloed="#8B5BD6"
            glans="#E3C7FF"
            vulling="url(#hb-tegel)"
            style={{ flex: 1, minWidth: 0, opacity: op.includes(h.sleutel) ? 0.32 : 1, transition: "opacity .2s ease-out" }}
          >
            <button
              onPointerDown={(e) => { e.preventDefault(); if (!op.includes(h.sleutel)) onKies?.(h.sleutel); }}
              disabled={!onKies || op.includes(h.sleutel)}
              style={{
                width: "100%", background: "transparent", border: "none", padding: "6px 4px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                cursor: onKies ? "pointer" : "default",
                WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              }}
            >
              <span style={{ display: "grid", placeItems: "center", color: "#D9C1FF", flexShrink: 0, filter: "drop-shadow(0 0 6px rgba(150,90,235,.75))" }}>{h.icoon}</span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0 }}>
                <span style={{ fontFamily: font.wide, fontSize: 7.8, letterSpacing: 0.7, whiteSpace: "nowrap", color: withAlpha("#EBD9FF", 0.9) }}>
                  {h.label}
                </span>
                <Prijs aantal={h.prijs} />
              </span>
            </button>
          </Glas>
        ))}
      </div>
    </Glas>
  );
}
