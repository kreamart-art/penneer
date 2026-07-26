// The Artnomad typewriter intro (same as Kings/Ezelen): the studio mark lands on
// the FIRST key-strike, then "An Artnomad Game" is typed out a character at a
// time with a carriage bell at the end, and the app continues. Waits for a tap
// (which unlocks audio so the strikes actually sound); auto-runs silently after
// a generous window so it is never a dead end; a second tap skips.
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

const INTRO_TEXT = "An Artnomad Game";
const PER_CHAR_MS = 135;
const MARK_MS = 420; // beat between the logo strike and the first letter
const MARK_SIZE = "clamp(78px, 22vw, 112px)";

export function Intro({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [typed, setTyped] = useState(0);
  const [markIn, setMarkIn] = useState(false); // the logo's own strike, before the text
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
        setMarkIn(true);
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
      // Strike one is the logo; the letters follow a beat later.
      timers.current.push(
        window.setTimeout(() => {
          if (cancelled.current) return;
          setMarkIn(true);
          if (withSound) sound.twKey();
          timers.current.push(window.setTimeout(step, MARK_MS));
        }, 350)
      );
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
      {/* Every row keeps its box whether or not it is showing, so the group
          stays optically centred instead of jumping when the hint disappears. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* The box is claimed the moment the run starts, in the same frame the
            tap hint leaves, so the group re-centres once while nothing is drawn
            there yet. The strike itself is then pure fade + scale: no clipping. */}
        <div
          style={{
            height: started ? MARK_SIZE : 0,
            marginBottom: started ? 26 : 0,
          }}
        >
          {/* No halo at all. A drop-shadow filter showed its layer rectangle on
              iOS, and a radial stand-in showed its own circle edge: on a dark
              backdrop any glow that fades to nothing leaves a visible boundary.
              The white mark carries itself. */}
          <img
            src="/artnomad.webp"
            alt=""
            aria-hidden
            width={112}
            height={112}
            style={{
              display: "block",
              width: MARK_SIZE,
              height: MARK_SIZE,
              opacity: markIn ? 0.96 : 0,
              transform: markIn ? "scale(1)" : "scale(0.8)",
              transition: reduced ? "none" : "opacity 200ms ease-out, transform 260ms cubic-bezier(.2,1.5,.4,1)",
            }}
          />
        </div>
        <span
          style={{
            position: "relative",
            display: "inline-block",
            // The studio intro face, same as Kings; the typewriter line is the
            // one place every Artnomad game looks identical.
            fontFamily: "'OwnersBlack', Georgia, serif",
            fontWeight: 900,
            fontSize: "clamp(17px, 5.2vw, 29px)",
            lineHeight: 1,
            letterSpacing: 0.4,
            color: colors.ink,
            whiteSpace: "nowrap",
            textShadow: "0 2px 14px rgba(0,0,0,.5)",
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
        <span
          aria-hidden={started}
          style={{
            marginTop: 18,
            fontFamily: font.ui,
            fontSize: 11,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: withAlpha(colors.gold, 0.55),
            visibility: started ? "hidden" : "visible",
            animation: reduced || started ? "none" : "fill-pulse 1.6s ease-in-out infinite",
          }}
        >
          {t("tapToBegin")}
        </span>
      </div>
    </div>
  );
}
