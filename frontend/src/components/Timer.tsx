// Synced countdown — displays from the server's ends_at; never decides the end.
// Big gold (red under 10s) Space Grotesk number + thin gradient progress bar.
import { useEffect, useRef, useState } from "react";
import { NeonText } from "./NeonText";
import { neonSkin, rampFrom } from "../theme/neon";
import { colors, font, withAlpha } from "../theme/tokens";

interface Props {
  endsAt: number | null; // server wall-clock seconds
  duration: number | null;
  onTick?: (secs: number) => void; // fires once per second change
}

export function Timer({ endsAt, duration, onTick }: Props) {
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 100);
    return () => clearInterval(id);
  }, []);

  const remaining = endsAt ? Math.max(0, endsAt - now) : duration ?? 0;
  const secs = Math.ceil(remaining);
  const low = secs <= 10;

  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    if (lastSec.current !== secs) {
      lastSec.current = secs;
      onTick?.(secs);
    }
  }, [secs, onTick]);
  const pct = duration ? Math.max(0, Math.min(1, remaining / duration)) : 0;
  // Onder de tien seconden slaat alles om naar rood: het getal, de staaf en de
  // gloed. Dat is de enige plek waar de kleur zelf iets vertelt.
  const accent = low ? colors.red : colors.gold;
  const ramp = rampFrom(accent);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ textAlign: "center" }}>
        <NeonText
          accent={accent}
          blur={20}
          glow={0.75}
          style={{ fontFamily: font.display, fontWeight: 700, fontSize: 64, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
        >
          {secs}
        </NeonText>
      </div>
      {/* De balk is een GROEF met een staaf erin, niet een streep erop. De
          schaduw valt binnenin en van bovenaf, en de ring eromheen is omgedraaid:
          bij licht van boven ligt de bovenrand van een gat juist in de schaduw. */}
      <div
        className="neon-ring"
        style={{
          marginTop: 12,
          height: 10,
          borderRadius: 999,
          background: withAlpha("#000000", 0.55),
          boxShadow: "inset 0 2px 4px rgba(0,0,0,.8), inset 0 -1px 0 rgba(255,255,255,.07)",
          overflow: "hidden",
          ...neonSkin(accent, true),
          ["--ng-w" as string]: "1px",
          transition: "background .2s ease",
        } as React.CSSProperties}
      >
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            borderRadius: 999,
            background: `linear-gradient(180deg, ${ramp[3]} 0%, ${ramp[2]} 42%, ${ramp[1]} 100%)`,
            boxShadow: `inset 0 1px 0 ${withAlpha(ramp[3], 0.8)}, inset 0 -2px 3px rgba(0,0,0,.45)`,
            transition: "width .12s linear",
          }}
        />
      </div>
    </div>
  );
}
