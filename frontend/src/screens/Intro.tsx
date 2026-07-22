// Artnomad-style intro: emblem + wordmark reveal with a synthesized sound.
// Tap unlocks audio (iOS) and plays the sting; auto-advances after a beat.
import { useEffect, useState } from "react";
import { Logo } from "../components/Logo";
import { Button } from "../components/Button";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

export function Intro({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    const id = setTimeout(onDone, 1700);
    return () => clearTimeout(id);
  }, [started, onDone]);

  // The tap unlocks audio (iOS), blesses the music element and plays a short
  // arcade EFFECT. The musical sting + track start on the main page, so no
  // background music is heard during the intro.
  const begin = () => {
    if (started) return;
    sound.unlock();
    sound.primeMusic();
    sound.introFx();
    setStarted(true);
  };

  return (
    <div
      onClick={begin}
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        cursor: started ? "default" : "pointer",
        position: "relative",
      }}
    >
      <div
        style={{
          transform: started ? "scale(1)" : "scale(0.9)",
          opacity: started ? 1 : 0.85,
          transition: "transform .8s cubic-bezier(.2,1,.3,1), opacity .8s ease",
        }}
      >
        <Logo size={236} />
      </div>
      <h1
        style={{
          margin: 0,
          // Same wordmark face as the main page (Cybergame is condensed,
          // hence the larger px size and wider tracking).
          fontFamily: "'Cybergame', 'Space Grotesk', sans-serif",
          fontWeight: 400,
          fontSize: "min(62px, 15vw)",
          letterSpacing: "0.14em",
          whiteSpace: "nowrap",
          color: colors.ink,
          textShadow: `0 0 34px ${withAlpha(colors.violet, 0.8)}`,
          opacity: started ? 1 : 0,
          transform: started ? "translateY(0)" : "translateY(8px)",
          transition: "opacity .7s ease .15s, transform .7s ease .15s",
        }}
      >
        PEN NEER
      </h1>

      {!started ? (
        <p style={{ fontFamily: font.ui, fontSize: 14, color: colors.sub, animation: "fill-pulse 2s ease-in-out infinite" }}>
          {t("tapToBegin")}
        </p>
      ) : (
        <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>Artnomad</span>
      )}

      {!started && (
        <div style={{ position: "absolute", bottom: "calc(28px + env(safe-area-inset-bottom))" }}>
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              sound.primeMusic();
              onDone();
            }}
          >
            {t("skip")}
          </Button>
        </div>
      )}
    </div>
  );
}
