// Music mute toggle — a music note that kills only the background beat (the
// intro/results effects keep playing). Shown wherever music plays: landing,
// lobby, hub. Self-contained so it can drop in anywhere.
import { useState } from "react";
import { Music } from "lucide-react";
import { sound } from "../sound/sound";
import { colors, withAlpha } from "../theme/tokens";
import { HexPlate } from "./HexPlate";

export function MusicToggle({ size = 20, padding = 4, plate = false, plateSize }: { size?: number; padding?: number; plate?: boolean; plateSize?: number }) {
  const [muted, setMuted] = useState(sound.isMusicMuted());
  const toggle = () => {
    sound.toggleMusicMuted();
    setMuted(sound.isMusicMuted());
  };
  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Muziek aan" : "Muziek uit"}
      title={muted ? "Muziek aan" : "Muziek uit"}
      style={{
        position: "relative",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: muted ? (plate ? colors.sub : colors.faint) : colors.gold,
        display: "flex",
        padding,
        lineHeight: 0,
      }}
    >
      <HexPlate on={plate} size={plateSize}>
        <Music size={size} />
      </HexPlate>
      {muted && (
        // diagonal strike = "off"
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size * 1.15,
            height: 2,
            background: colors.faint,
            borderRadius: 2,
            transform: "translate(-50%, -50%) rotate(-45deg)",
            boxShadow: `0 0 0 1.5px ${withAlpha(colors.bg0, 0.9)}`,
          }}
        />
      )}
    </button>
  );
}
