// Ranked rows: avatar + name + score. Leader row gets a gold gradient wash and
// gold border. Scores in Space Grotesk (§8).
import { Avatar } from "./Avatar";
import type { Player } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

interface Props {
  players: Player[];
  scores: Record<string, number>;
  meId: string | null;
}

export function Scoreboard({ players, scores, meId }: Props) {
  const { t } = useT();
  // Spectators never appear on the scoreboard.
  const ranked = [...players]
    .filter((p) => !p.is_spectator)
    .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const top = ranked.length ? scores[ranked[0].id] ?? 0 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {ranked.map((p, i) => {
        const score = scores[p.id] ?? 0;
        const leader = score === top && top > 0;
        const isMe = p.id === meId;
        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 14,
              background: leader
                ? `linear-gradient(90deg, ${withAlpha(colors.gold, 0.22)}, ${withAlpha(
                    colors.gold,
                    0.06
                  )})`
                : colors.panel,
              border: `1px solid ${leader ? withAlpha(colors.gold, 0.55) : colors.panelBorder}`,
            }}
          >
            <span
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 16,
                color: leader ? colors.gold : colors.faint,
                width: 20,
                textAlign: "center",
              }}
            >
              {i + 1}
            </span>
            <Avatar name={p.name} color={p.color} size={34} crown={leader} dim={!p.connected} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} />
            <span
              style={{
                flex: 1,
                fontFamily: font.ui,
                fontWeight: 600,
                fontSize: 15,
                color: colors.ink,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {p.name}
              {isMe && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
            </span>
            <span
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 22,
                color: leader ? colors.gold : colors.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
