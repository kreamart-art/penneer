// Player token — rounded-square filled with the player's color at low alpha,
// 2px colored border, soft colored glow, initial in Space Grotesk. Gold crown
// badge top-right for host / round winner (§8).
import { Crown } from "lucide-react";
import { colors, font, withAlpha } from "../theme/tokens";

interface Props {
  name: string;
  color: string;
  size?: number;
  crown?: boolean;
  dim?: boolean; // disconnected
}

export function Avatar({ name, color, size = 40, crown, dim }: Props) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          display: "grid",
          placeItems: "center",
          background: withAlpha(color, 0.16),
          border: `2px solid ${color}`,
          boxShadow: dim ? "none" : `0 0 16px ${withAlpha(color, 0.4)}`,
          opacity: dim ? 0.4 : 1,
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: size * 0.44,
          color,
          transition: "opacity .2s ease",
        }}
      >
        {initial}
      </div>
      {crown && (
        <div
          style={{
            position: "absolute",
            top: -9,
            right: -7,
            color: colors.gold,
            filter: `drop-shadow(0 0 6px ${withAlpha(colors.gold, 0.7)})`,
          }}
        >
          <Crown size={Math.max(14, size * 0.42)} fill={colors.gold} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
