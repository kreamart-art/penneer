// The slot machine — the centerpiece (§8). Recessed dark tile, top/bottom fade
// strips, huge gold letter. States: idle (dim "?"), spinning (blurred flicker +
// gold glow), locked (gold border + outer halo + strong text glow, pop on lock).
import { useEffect, useMemo, useRef, useState } from "react";
import { colors, font, withAlpha } from "../theme/tokens";

const STD_POOL = "ABCDEFGHIJKLMNOPRSTUVWZ".split("");
const FULL_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type ReelState = "idle" | "spinning" | "locked";

interface Props {
  state: ReelState;
  letter: string; // the locked letter (authoritative)
  exclude?: string[]; // letters already used this game (drop from the roulette)
  hard?: boolean; // include Q/X/Y
}

export function Reel({ state, letter, exclude = [], hard = false }: Props) {
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
    }, 60);
    return () => clearInterval(id);
  }, [state, pool]);

  const display = state === "locked" ? letter : state === "spinning" ? flick : "?";
  const isLocked = state === "locked";
  const isSpin = state === "spinning";

  return (
    <div
      style={{
        position: "relative",
        width: 168,
        height: 196,
        borderRadius: 22,
        background: "linear-gradient(180deg, #2a1c52 0%, #160d33 100%)",
        border: `2px solid ${isLocked ? colors.gold : colors.panelBorder}`,
        boxShadow: isLocked
          ? `0 0 0 1px ${withAlpha(colors.gold, 0.4)}, 0 0 40px ${withAlpha(
              colors.gold,
              0.55
            )}, inset 0 8px 26px rgba(0,0,0,.65)`
          : "inset 0 8px 26px rgba(0,0,0,.65), 0 16px 40px rgba(0,0,0,.4)",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        transition: "border-color .2s ease, box-shadow .25s ease",
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
          background: "linear-gradient(180deg, rgba(8,4,20,.92), rgba(8,4,20,0))",
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
          background: "linear-gradient(0deg, rgba(8,4,20,.92), rgba(8,4,20,0))",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      <div
        key={isLocked ? `lock-${letter}` : "spin"}
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 116,
          lineHeight: 1,
          color: state === "idle" ? withAlpha(colors.faint, 0.5) : colors.gold,
          filter: isSpin ? "blur(1.5px)" : "none",
          textShadow: isLocked
            ? `0 0 30px ${withAlpha(colors.gold, 0.9)}, 0 0 60px ${withAlpha(colors.gold, 0.5)}`
            : isSpin
              ? `0 0 22px ${withAlpha(colors.gold, 0.5)}`
              : "none",
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
  );
}
