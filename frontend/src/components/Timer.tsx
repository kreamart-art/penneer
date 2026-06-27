// Synced countdown — displays from the server's ends_at; never decides the end.
// Big gold (red under 10s) Space Grotesk number + thin gradient progress bar.
import { useEffect, useRef, useState } from "react";
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
  const num = colors.gold;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          textAlign: "center",
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1,
          color: low ? colors.red : num,
          textShadow: low
            ? `0 0 24px ${withAlpha(colors.red, 0.6)}`
            : `0 0 24px ${withAlpha(colors.gold, 0.45)}`,
          fontVariantNumeric: "tabular-nums",
          transition: "color .2s ease",
        }}
      >
        {secs}
      </div>
      <div
        style={{
          marginTop: 12,
          height: 8,
          borderRadius: 999,
          background: withAlpha("#FFFFFF", 0.08),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            borderRadius: 999,
            background: low
              ? `linear-gradient(90deg, ${colors.redDeep}, ${colors.red})`
              : `linear-gradient(90deg, ${colors.violet}, ${colors.gold})`,
            transition: "width .12s linear",
          }}
        />
      </div>
    </div>
  );
}
