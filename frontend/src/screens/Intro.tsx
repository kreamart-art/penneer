// The Artnomad typewriter intro (same as Kings/Ezelen): the studio mark lands on
// the FIRST key-strike, then "An Artnomad Game" is typed out a character at a
// time with a carriage bell at the end, and the app continues. Waits for a tap
// (which unlocks audio so the strikes actually sound); auto-runs silently after
// a generous window so it is never a dead end; a second tap skips.
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { NeonText } from "../components/NeonText";
import { colors, font, withAlpha } from "../theme/tokens";

const INTRO_TEXT = "An Artnomad Game";
// Het merk is wit, dus de reeks vertrekt vanuit zilver.
const INTRO_SILVER = "#DDE3F2";
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
          {/* De gloed is een VERVAAGDE KOPIE van het merk zelf. Eerder stond
              hier niets, omdat een drop-shadow op iOS zijn laagrechthoek liet
              zien en een radiale stand-in zijn eigen cirkelrand. Een kopie van de
              vorm heeft dat probleem niet: hij vervaagt langs het merk en houdt
              nergens een rand over. */}
          <div style={{ position: "relative", width: MARK_SIZE, height: MARK_SIZE }}>
            {/* De vervaagde kopie krijgt ruimte om zich heen. Een blur wordt
                afgeknipt op de doos van zijn element; loopt hij tot aan die rand,
                dan zie je die doos als rechthoek op de kale achtergrond. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: -34,
                display: "grid",
                placeItems: "center",
                filter: "blur(14px)",
                opacity: markIn ? 0.5 : 0,
                transform: markIn ? "scale(1.04)" : "scale(0.8)",
                transition: reduced ? "none" : "opacity 320ms ease-out, transform 260ms cubic-bezier(.2,1.5,.4,1)",
                pointerEvents: "none",
              }}
            >
              <img src="/artnomad.webp" alt="" width={112} height={112} style={{ width: MARK_SIZE, height: MARK_SIZE, display: "block" }} />
            </div>
            <img
              src="/artnomad.webp"
              alt=""
              aria-hidden
              width={112}
              height={112}
              style={{
                position: "relative",
                display: "block",
                width: MARK_SIZE,
                height: MARK_SIZE,
                opacity: markIn ? 0.96 : 0,
                transform: markIn ? "scale(1)" : "scale(0.8)",
                transition: reduced ? "none" : "opacity 200ms ease-out, transform 260ms cubic-bezier(.2,1.5,.4,1)",
              }}
            />
          </div>
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
          }}
        >
          {/* invisible full line reserves the width, so the text never shifts */}
          <span aria-hidden style={{ visibility: "hidden" }}>{INTRO_TEXT}</span>
          <span style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}>
            {/* Zilver, want dat is de kleur van het merk. De cursor staat er
                bewust BUITEN: die is goud, en een verloop dat op de tekst wordt
                geknipt zou hem meepakken. */}
            <NeonText accent={INTRO_SILVER} blur={11} glow={0.5}>{shown}</NeonText>
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
