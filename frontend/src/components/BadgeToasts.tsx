// Small toast for newly earned achievements, shown to the whole room on the
// final screen (the server broadcasts badge_earned per player).
import { useEffect } from "react";
import { Award } from "lucide-react";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

export function BadgeToasts({ game }: { game: GameApi }) {
  const { t } = useT();
  const toast = game.state.badgeToasts[0];

  useEffect(() => {
    if (!toast) return;
    sound.badge();
    const id = window.setTimeout(() => game.drainToasts(), 3200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(18px + env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        gap: 9,
        maxWidth: "min(92vw, 420px)",
        padding: "10px 16px",
        borderRadius: 999,
        background: "linear-gradient(180deg, #241738, #1A1030)",
        border: `1px solid ${withAlpha(colors.gold, 0.55)}`,
        boxShadow: `0 10px 34px rgba(0,0,0,.5), 0 0 22px ${withAlpha(colors.gold, 0.25)}`,
        fontFamily: font.ui,
        fontSize: 13.5,
        color: colors.ink,
      }}
    >
      <Award size={17} color={colors.gold} />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <strong style={{ color: colors.gold }}>{toast.name}</strong> {t("badgeEarned")}{" "}
        {t(`badge_${toast.badge}`)}
      </span>
    </div>
  );
}
