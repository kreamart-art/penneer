// The Artnomad typewriter intro (same as Kings/Ezelen): "An Artnomad Game" is
// typed out with a key-strike per character and a carriage bell at the end,
// then the app continues. Waits for a tap (which unlocks audio so the strikes
// actually sound); auto-runs silently after a generous window so it is never a
// dead end; a second tap skips.
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

const INTRO_TEXT = "An Artnomad Game";
const PER_CHAR_MS = 135;

export function Intro({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [typed, setTyped] = useState(0);
  const [started, setStarted] = useState(false);
  const ran = useRef(false);
  const cancelled = useRef(false);
  const timers = useRef<number[]>([]);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const run = useCallback(
    (withSound: boolean) => {
      if (ran.current) return;
      ran.current = true;
      setStarted(true);
      const full = INTRO_TEXT.length;
      if (withSound) {
        sound.unlock();
        sound.primeMusic();
      }
      if (reduced) {
        setTyped(full);
        timers.current.push(window.setTimeout(onDone, 900));
        return;
      }
      let i = 0;
      const step = () => {
        if (cancelled.current) return;
        i += 1;
        setTyped(i);
        const ch = INTRO_TEXT[i - 1];
        if (withSound && ch && ch !== " ") sound.twKey();
        if (i < full) timers.current.push(window.setTimeout(step, PER_CHAR_MS));
        else {
          if (withSound) sound.twBell();
          timers.current.push(window.setTimeout(onDone, 1300));
        }
      };
      timers.current.push(window.setTimeout(step, 350));
    },
    [reduced, onDone]
  );

  // Last-resort dead-end guard: if nobody taps, run silently after a while.
  useEffect(() => {
    const tmo = window.setTimeout(() => run(false), 6500);
    return () => {
      window.clearTimeout(tmo);
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, [run]);

  const onTap = () => {
    if (ran.current) {
      cancelled.current = true;
      sound.primeMusic();
      onDone();
    } else {
      run(true);
    }
  };

  const shown = INTRO_TEXT.slice(0, typed);
  const done = typed >= INTRO_TEXT.length;

  return (
    <div
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onTap()}
      aria-label={INTRO_TEXT}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        padding: "8vw",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            position: "relative",
            display: "inline-block",
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: "clamp(19px, 5.6vw, 32px)",
            lineHeight: 1,
            letterSpacing: 0.5,
            color: colors.ink,
            whiteSpace: "nowrap",
            textShadow: `0 0 26px ${withAlpha(colors.violet, 0.7)}, 0 2px 18px rgba(0,0,0,.55)`,
          }}
        >
          {/* invisible full line reserves the width, so the text never shifts */}
          <span aria-hidden style={{ visibility: "hidden" }}>{INTRO_TEXT}</span>
          <span style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}>
            {shown}
            <span
              className={done || !started ? "caret-blink" : undefined}
              style={{ display: "inline-block", marginLeft: 1, color: colors.gold, fontWeight: 400, transform: "translateY(-1px)" }}
            >
              |
            </span>
          </span>
        </span>
        {!started && (
          <span
            style={{
              marginTop: 18,
              fontFamily: font.ui,
              fontSize: 11,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: withAlpha(colors.gold, 0.55),
              animation: reduced ? "none" : "fill-pulse 1.6s ease-in-out infinite",
            }}
          >
            {t("tapToBegin")}
          </span>
        )}
      </div>
    </div>
  );
}
