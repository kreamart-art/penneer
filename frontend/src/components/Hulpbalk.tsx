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
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ARENA_GOUD, font, withAlpha } from "../theme/tokens";

const achthoek = (b: number, h: number, c: number) =>
  `M ${c} 0 L ${b - c} 0 L ${b} ${c} L ${b} ${h - c} L ${b - c} ${h} L ${c} ${h} L 0 ${h - c} L 0 ${c} Z`;

/** Een glasvlak met een getekende lijn eromheen. Het vak meet zichzelf op, want
 *  het pad wordt in ECHTE pixels getekend: alleen dan blijven de afschuiningen
 *  45 graden en is de lijn overal even dik, hoe breed het vak ook wordt. */
function Glas({ verf, dik, hoek, vulling, gloed, glans = "#FFFFFF", children, style }: {
  /** "goud" of "tegel": welke verf, niet de url. De id's worden per instantie
   *  uniek gemaakt, want vier keer dezelfde id in een document betekent dat de
   *  browser bij url(#id) ALTIJD de eerste pakt. Dan vullen de tegels zich met
   *  de verf van de bak eronder, en dat zie je terug op de hoeken. */
  verf: "goud" | "tegel";
  dik: number;
  hoek: number;
  vulling: "leeg" | "tegel";
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
  const eig = useId().replace(/:/g, "");   // eigen id's per instantie
  const id = (n: string) => `${eig}-${n}`;
  const verfUrl = `url(#${id(verf === "goud" ? "goud" : "paars")})`;
  const vulUrl = vulling === "leeg" ? "rgba(24,10,44,.20)" : `url(#${id("tegel")})`;
  return (
    <div ref={doos} style={{ position: "relative", ...style }}>
      {b > 0 && (
        <svg width={b} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
          <defs>
            {/* Hetzelfde goud als de ladder en de scoreplaat: opgemeten uit de
                art, niet gekozen. Zie ARENA_GOUD in theme/tokens.ts. */}
            <linearGradient id={id("goud")} x1="0" y1="0" x2="1" y2="0.9">
              <stop offset="0%" stopColor={ARENA_GOUD[0]} />
              <stop offset="24%" stopColor={ARENA_GOUD[1]} />
              <stop offset="52%" stopColor={ARENA_GOUD[2]} />
              <stop offset="76%" stopColor={ARENA_GOUD[3]} />
              <stop offset="100%" stopColor={ARENA_GOUD[1]} />
            </linearGradient>
            {/* De vulling van een tegel: nog steeds twintig procent, maar
                belicht. Een egale twintig procent leest als een sticker; met
                licht bovenin en diepte onderin leest hetzelfde vlak als glas. */}
            <linearGradient id={id("tegel")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A863FF" stopOpacity="0.26" />
              <stop offset="42%" stopColor="#5E2FA8" stopOpacity="0.19" />
              <stop offset="100%" stopColor="#1B0B36" stopOpacity="0.24" />
            </linearGradient>
            <linearGradient id={id("paars")} x1="0" y1="0" x2="1" y2="0.9">
              <stop offset="0%" stopColor="#C79BFF" />
              <stop offset="34%" stopColor="#8B5BD6" />
              <stop offset="62%" stopColor="#5E3596" />
              <stop offset="100%" stopColor="#B487F5" />
            </linearGradient>
            {/* De punt op de omtrek. Wit dat meteen op nul valt geeft een harde
                stip; hier loopt hij van lila naar wit en weer terug naar lila
                voordat hij verdwijnt. Dat verloop is wat een glans op gepolijst
                materiaal doet: de kern is wit, de aanloop draagt de kleur van
                het materiaal zelf. */}
            <linearGradient id={id("punt")} x1="0" y1="0" x2="1" y2="0.9">
              <stop offset="0%" stopColor="#B98CFF" stopOpacity="0" />
              <stop offset="8%" stopColor="#B98CFF" stopOpacity="0.18" />
              <stop offset="13%" stopColor="#D9BEFF" stopOpacity="0.55" />
              <stop offset="17%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="21%" stopColor="#D9BEFF" stopOpacity="0.55" />
              <stop offset="27%" stopColor="#B98CFF" stopOpacity="0.16" />
              <stop offset="36%" stopColor="#B98CFF" stopOpacity="0" />
              <stop offset="52%" stopColor="#B98CFF" stopOpacity="0" />
              <stop offset="57%" stopColor="#C9A8FF" stopOpacity="0.22" />
              <stop offset="62%" stopColor="#F0E2FF" stopOpacity="0.6" />
              <stop offset="67%" stopColor="#C9A8FF" stopOpacity="0.22" />
              <stop offset="76%" stopColor="#B98CFF" stopOpacity="0" />
              <stop offset="100%" stopColor="#B98CFF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={id("glans")} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={glans} stopOpacity="0" />
              <stop offset="50%" stopColor={glans} stopOpacity="0.95" />
              <stop offset="100%" stopColor={glans} stopOpacity="0" />
            </linearGradient>
            {/* De binnenschaduw: donker onderin, niets bovenin. Dat is wat een
                vlak in een bak legt in plaats van erop. */}
            <linearGradient id={id("diep")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity="0" />
              <stop offset="58%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
            </linearGradient>
            <filter id={id("waas")} x="-25%" y="-30%" width="150%" height="160%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          {gloed && (
            <path
              d={achthoek(b - dik, h - dik, hoek)}
              transform={`translate(${dik / 2}, ${dik / 2})`}
              fill="none" stroke={gloed} strokeWidth={dik + 2.2} opacity="0.55" filter={`url(#${id("waas")})`}
            />
          )}
          <path
            d={achthoek(b - dik, h - dik, hoek)}
            transform={`translate(${dik / 2}, ${dik / 2})`}
            fill={vulUrl}
            stroke={verfUrl}
            strokeWidth={dik}
            strokeLinejoin="round"
          />
          <path
            d={achthoek(b - dik, h - dik, hoek)}
            transform={`translate(${dik / 2}, ${dik / 2})`}
            fill={`url(#${id("diep")})`} stroke="none"
          />
          <line x1={b * 0.22} y1={dik + 1.1} x2={b * 0.78} y2={dik + 1.1} stroke={`url(#${id("glans")})`} strokeWidth="1.2" />
          <path
            d={achthoek(b - dik, h - dik, hoek)}
            transform={`translate(${dik / 2}, ${dik / 2})`}
            fill="none" stroke={`url(#${id("punt")})`} strokeWidth={dik * 1.1} strokeLinecap="round"
          />
        </svg>
      )}
      <div style={{ position: "relative", height: "100%" }}>{children}</div>
    </div>
  );
}

/** Hoeveel je er nog hebt. Geen prijs meer: deze hulpen koop je niet, je krijgt
 *  de eerste twee en de rest verdien je in de league, de ranglijsten en de
 *  missies. Een kruisje in plaats van een muntje, want dit is een voorraad. */
function Voorraad({ aantal }: { aantal: number }) {
  const leeg = aantal <= 0;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 1,
        fontFamily: font.display, fontWeight: 800, fontSize: 15,
        color: leeg ? withAlpha("#EBD9FF", 0.45) : "#FFF3D0",
        textShadow: leeg ? "none" : "0 1px 2px rgba(0,0,0,.7)",
      }}
    >
      <span style={{ fontSize: 11, opacity: 0.75 }}>x</span>
      {aantal}
    </span>
  );
}

export type Hulp = {
  sleutel: string;
  label: string;
  /** Hoeveel je er hebt. Nul betekent: wel te zien, niet te gebruiken. */
  aantal: number;
  icoon: ReactNode;
};

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
      verf="goud"
      dik={1}
      hoek={12}
      vulling="leeg"
      style={{ width: breedte, padding: 7, flexShrink: 0 }}
    >
      <div style={{ display: "flex", gap: 4, padding: 5 }}>
        {hulpen.map((h) => (
          <Glas
            key={h.sleutel}
            verf="tegel"
            dik={1}
            hoek={9}
            gloed="#8B5BD6"
            glans="#E3C7FF"
            vulling="tegel"
            style={{ flex: 1, minWidth: 0, opacity: op.includes(h.sleutel) || h.aantal <= 0 ? 0.32 : 1, transition: "opacity .2s ease-out" }}
          >
            <button
              onPointerDown={(e) => { e.preventDefault(); if (!op.includes(h.sleutel) && h.aantal > 0) onKies?.(h.sleutel); }}
              disabled={!onKies || op.includes(h.sleutel) || h.aantal <= 0}
              style={{
                width: "100%", background: "transparent", border: "none", padding: "5px 3px 5px 7px",
                display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 4,
                cursor: onKies ? "pointer" : "default",
                WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
              }}
            >
              <span style={{ display: "grid", placeItems: "center", color: "#D9C1FF", flexShrink: 0, filter: "drop-shadow(0 0 6px rgba(150,90,235,.75))" }}>{h.icoon}</span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0, marginTop: 4 }}>
                <span
                  style={{
                    fontFamily: font.wide, fontSize: 11.5, letterSpacing: 0.2, lineHeight: 1.02,
                    whiteSpace: "nowrap",
                    textAlign: "left", color: withAlpha("#F2E6FF", 0.95),
                    textShadow: "0 1px 2px rgba(0,0,0,.65)",
                  }}
                >
                  {h.label}
                </span>
                <Voorraad aantal={h.aantal} />
              </span>
            </button>
          </Glas>
        ))}
      </div>
    </Glas>
  );
}
