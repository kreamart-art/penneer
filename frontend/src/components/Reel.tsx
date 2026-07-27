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
    face: "linear-gradient(155deg, #B96DFF 0%, #8C3FFF 55%, #5B1FD6 100%)",
    innerGlow: "rgba(190,120,255,.45)",
    outerGlow: "rgba(140,70,255,.35)",
    // De rand is hetzelfde verloop als het vraagteken. De lichte stukken zijn
    // KORT gehouden: alleen vlak bij de hoeken een highlight, niet een halve
    // rand die oplicht.
    edge: "linear-gradient(135deg, #C98BFF 0%, #8C3FFF 7%, #5B1FD6 50%, #8C3FFF 93%, #C98BFF 100%)",
    fill: "radial-gradient(120% 100% at 50% 38%, #121A35 0%, #0A1023 100%)",
  };
  const plain = !skin;
  // Skinned reels show their color on the border even before lock, so the
  // theme reads at a glance.
  const idleBorder = skin ? withAlpha(th.border, 0.45) : PLAIN.edge;

  // De rol is afgeschuind zoals de rest van het toneel. Een `border` volgt geen
  // clip-path, dus de rand is een tweede, iets grotere geknipte laag eronder:
  // wat ertussenuit steekt IS de lijn.
  const CHAMFER =
    "polygon(20px 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 20px 100%, 0 calc(100% - 20px), 0 20px)";
  const line = isLocked ? th.border : idleBorder;

  return (
    <div
      style={{
        position: "relative",
        width: 172,
        height: 200,
        padding: 2,
        clipPath: CHAMFER,
        background: line,
        boxShadow: isLocked
          ? `0 0 44px ${withAlpha(th.glow, 0.6)}`
          : plain
            ? `0 0 30px ${PLAIN.outerGlow}, 0 0 70px ${PLAIN.outerGlow}`
            : `0 0 26px ${withAlpha(th.glow, 0.35)}`,
        transition: "background .2s ease, box-shadow .25s ease",
      }}
    >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        clipPath: CHAMFER,
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
