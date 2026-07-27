// The slot machine — the centerpiece (§8). Recessed dark tile, top/bottom fade
// strips, huge gold letter. States: idle (dim "?"), spinning (blurred flicker +
// gold glow), locked (gold border + outer halo + strong text glow, pop on lock).
// A reel SKIN swaps the colors (tile, border, glow, letter); the whole room
// sees the active spelleider's skin.
import { useEffect, useMemo, useRef, useState } from "react";
import { sound } from "../sound/sound";
import { reelTheme } from "../theme/reelSkins";
import { colors, font, withAlpha } from "../theme/tokens";

const STD_POOL = "ABCDEFGHIJKLMNOPRSTUVWZ".split("");
const FULL_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// De rol is afgeschuind: een achthoek met schuine hoeken. Alleen mochten die
// hoeken niet in een scherpe punt eindigen, en dat kan een `polygon()` niet: die
// verbindt punten met rechte lijnen en dus met scherpe hoeken. Daarom tekenen we
// dezelfde achthoek als PAD, waarbij elke hoek een kwartbocht krijgt: we stoppen
// een stukje voor het hoekpunt, en buigen met dat hoekpunt als stuurpunt naar het
// stukje erna. Dat werkt alleen omdat de rol een vaste maat heeft, want een
// `path()` rekent in echte pixels en schaalt niet mee.
function chamferPath(w: number, h: number, cut: number, r: number): string {
  const pts: Array<[number, number]> = [
    [cut, 0], [w - cut, 0],
    [w, cut], [w, h - cut],
    [w - cut, h], [cut, h],
    [0, h - cut], [0, cut],
  ];
  const toward = (from: [number, number], to: [number, number]): [number, number] => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(r, len / 2) / len;
    return [+(from[0] + dx * t).toFixed(2), +(from[1] + dy * t).toFixed(2)];
  };
  let d = "";
  pts.forEach((cur, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    const a = toward(cur, prev);
    const b = toward(cur, next);
    d += `${i === 0 ? "M" : "L"} ${a[0]} ${a[1]} Q ${cur[0]} ${cur[1]} ${b[0]} ${b[1]} `;
  });
  return `${d}Z`;
}

// De rol heeft een vaste maat; de binnenkant zit 2px binnen de buitenkant, dus
// daar valt de schuine snede 2px korter uit.
const REEL_W = 172;
const REEL_H = 200;
const CORNER_R = 5;
const CLIP_OUTER = `path("${chamferPath(REEL_W, REEL_H, 20, CORNER_R)}")`;
const CLIP_INNER = `path("${chamferPath(REEL_W - 4, REEL_H - 4, 18, CORNER_R)}")`;

type ReelState = "idle" | "spinning" | "locked";

interface Props {
  state: ReelState;
  letter: string; // the locked letter (authoritative)
  exclude?: string[]; // letters already used this game (drop from the roulette)
  hard?: boolean; // include Q/X/Y
  skin?: string | null; // the active player's reel theme (everyone sees it)
}

export function Reel({ state, letter, exclude = [], hard = false, skin = null }: Props) {
  const [flick, setFlick] = useState("A");
  const idxRef = useRef(0);

  // The spinning pool excludes letters already played, so a used letter never
  // flicks past again (the server also never picks it).
  const pool = useMemo(() => {
    const base = hard ? FULL_POOL : STD_POOL;
    const used = new Set(exclude.map((c) => c.toUpperCase()));
    const left = base.filter((c) => !used.has(c));
    return left.length ? left : base;
  }, [exclude, hard]);

  useEffect(() => {
    if (state !== "spinning") return;
    const id = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % pool.length;
      setFlick(pool[idxRef.current]);
      sound.spinTick(); // one click per letter, for as long as the reel runs
    }, 60);
    return () => clearInterval(id);
  }, [state, pool]);

  const display = state === "locked" ? letter : state === "spinning" ? flick : "?";
  const isLocked = state === "locked";
  const isSpin = state === "spinning";
  const th = reelTheme(skin);

  // De STANDAARDROL (zonder skin) heeft zijn eigen, uitgewerkte look: de kaart
  // moet aanvoelen als een voorwerp dat op onthulling wacht, niet als een leeg
  // vlak. Vaste waarden uit de art-richtlijn; een skin overschrijft ze.
  const PLAIN = {
    // Zelfde kleurenreeks als de energielijnen van de spelerbanner: fel violet in
    // het midden, donker paars naar de randen. Zo horen rol, lijnen en pijlen
    // zichtbaar bij elkaar.
    face: "linear-gradient(155deg, #C46BFF 0%, #9A4DFF 42%, #6A2DFF 76%, #3A167E 100%)",
    innerGlow: "rgba(154,77,255,.42)",
    outerGlow: "rgba(106,45,255,.4)",
    // Het lichte stuk is KORT: alleen waar het verloop door zijn top gaat licht
    // de rand op, niet een halve rand die staat te schijnen.
    edge: "linear-gradient(135deg, #3A167E 0%, #6A2DFF 14%, #9A4DFF 36%, #C46BFF 50%, #9A4DFF 64%, #6A2DFF 86%, #3A167E 100%)",
    fill: "radial-gradient(120% 100% at 50% 38%, #121A35 0%, #0A1023 100%)",
  };
  const plain = !skin;
  // Skinned reels show their color on the border even before lock, so the
  // theme reads at a glance.
  const idleBorder = skin ? withAlpha(th.border, 0.45) : PLAIN.edge;

  // Een `border` volgt geen clip-path, dus de rand is een tweede, iets grotere
  // geknipte laag eronder: wat ertussenuit steekt IS de lijn.
  const line = isLocked ? th.border : idleBorder;

  return (
    <div
      style={{
        position: "relative",
        width: 172,
        height: 200,
        padding: 2,
        clipPath: CLIP_OUTER,
        background: line,
        boxShadow: isLocked
          ? `0 0 44px ${withAlpha(th.glow, 0.6)}`
          : plain
            ? `0 0 12px ${PLAIN.outerGlow}, 0 0 30px rgba(106,45,255,.22)`
            : `0 0 26px ${withAlpha(th.glow, 0.35)}`,
        transition: "background .2s ease, box-shadow .25s ease",
      }}
    >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        clipPath: CLIP_INNER,
        background: plain && !isLocked ? PLAIN.fill : th.bg,
        boxShadow: plain && !isLocked
          ? `inset 0 0 34px ${PLAIN.innerGlow}, inset 0 8px 26px rgba(0,0,0,.55)`
          : "inset 0 8px 26px rgba(0,0,0,.65)",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* top fade strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 46,
          background: `linear-gradient(180deg, rgba(${th.fade},.92), rgba(${th.fade},0))`,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      {/* bottom fade strip */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 46,
          background: `linear-gradient(0deg, rgba(${th.fade},.92), rgba(${th.fade},0))`,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      {/* Het vraagteken krijgt zijn gloed van een vervaagde kopie erachter, niet
          van een filter: een drop-shadow laat iOS de laag apart rasteren en dan
          zie je zijn rechthoek over de kaart heen. */}
      {plain && state === "idle" && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: 116,
            lineHeight: 1,
            color: PLAIN.innerGlow,
            filter: "blur(14px)",
          }}
        >
          ?
        </div>
      )}
      <div
        key={isLocked ? `lock-${letter}` : "spin"}
        style={{
          position: "relative",
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 116,
          lineHeight: 1,
          ...(plain && state === "idle"
            ? {
                backgroundImage: PLAIN.face,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                // Klein glanslichtje linksboven, zodat het glyph bol lijkt.
                textShadow: "-1px -1px 0 rgba(255,255,255,.35)",
              }
            : { color: state === "idle" ? withAlpha(colors.faint, 0.5) : th.letter }),
          filter: isSpin ? "blur(1.5px)" : "none",
          ...(isLocked
            ? { textShadow: `0 0 30px ${withAlpha(th.glow, 0.9)}, 0 0 60px ${withAlpha(th.glow, 0.5)}` }
            : isSpin
              ? { textShadow: `0 0 22px ${withAlpha(th.glow, 0.5)}` }
              : null),
          animation: isSpin
            ? "reel-flick .12s linear infinite"
            : isLocked
              ? "lock-pop .35s cubic-bezier(.2,1.4,.4,1)"
              : undefined,
        }}
      >
        {display}
      </div>
    </div>
    </div>
  );
}
