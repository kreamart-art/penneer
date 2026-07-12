// Player token — rounded-square filled with the player's color at low alpha,
// 2px colored border, soft colored glow, initial in Space Grotesk. Gold crown
// badge top-right for host / round winner (§8).
import { Crown } from "lucide-react";
import { colors, font, withAlpha } from "../theme/tokens";

// Rank ring colors per tier (badge of honor around the avatar, 8BP-style).
// Beginneling has no ring; every rank above it gets its own metal/color.
export const RANK_RING: Record<string, string> = {
  krabbelaar: "#C08A50",       // brons
  pennenlikker: "#B9C4D0",     // zilver
  woordjager: "#36E0AE",       // groen
  woordsmid: "#7C5CFF",        // violet
  lettermeester: "#32ADE6",    // blauw
  categoriekoning: "#FFC23D",  // goud
  legende: "#FF5A3C",          // vuurrood
};

interface Props {
  name: string;
  color: string;
  size?: number;
  crown?: boolean;
  dim?: boolean; // disconnected
  // Account photo: rendered when set (served by /api/avatar, ?v busts cache).
  userId?: string | null;
  hasAvatar?: boolean;
  avatarVer?: number;
  rank?: string | null; // rank key -> colored ring (see RANK_RING)
}

export function Avatar({ name, color, size = 40, crown, dim, userId, hasAvatar, avatarVer, rank }: Props) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  const photo = !!(userId && hasAvatar);
  const ring = rank ? RANK_RING[rank] : undefined;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          background: withAlpha(color, 0.16),
          border: `2px solid ${color}`,
          boxShadow: dim
            ? "none"
            : ring
              ? `0 0 0 2px ${ring}, 0 0 14px ${withAlpha(ring, 0.55)}`
              : `0 0 16px ${withAlpha(color, 0.4)}`,
          opacity: dim ? 0.4 : 1,
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: size * 0.44,
          color,
          transition: "opacity .2s ease",
        }}
      >
        {photo ? (
          <img
            src={`/api/avatar/${userId}?v=${avatarVer ?? 0}`}
            alt={name}
            width={size}
            height={size}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          initial
        )}
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
