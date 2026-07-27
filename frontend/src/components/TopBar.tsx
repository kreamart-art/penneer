// Compact top bar: wordmark + room code + round indicator + chat + connection dot + exit.
import { LogOut } from "lucide-react";
import { NeonText } from "./NeonText";
import { neonSkin } from "../theme/neon";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";
import { ChatButton } from "./Chat";
import type { GameApi } from "../net/socket";

interface Props {
  code?: string;
  roundNo?: number;
  totalRounds?: number;
  connected: boolean;
  onLeave?: () => void;
  game?: GameApi; // when present, shows the in-room chat button
}

export function TopBar({ code, roundNo, totalRounds, connected, onLeave, game }: Props) {
  const { t } = useT();
  // Leaving mid-round has a consequence (sit that round out) — say so.
  const midRound = game?.state.room?.phase === "reveal" || game?.state.room?.phase === "fill";
  const confirmText = midRound && !game?.isSpectator ? t("leaveConfirmRound") : t("leaveConfirm");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        paddingTop: "calc(14px + env(safe-area-inset-top))",
      }}
    >
      <span
        style={{
          // The wordmark face (Cybergame is condensed, so larger px + spacing).
          fontFamily: "'Cybergame', 'Space Grotesk', sans-serif",
          fontWeight: 400,
          fontSize: 24,
          letterSpacing: 2.5,
          whiteSpace: "nowrap",
          color: colors.ink,
          textShadow: `0 0 18px ${withAlpha(colors.violet, 0.5)}`,
        }}
      >
        PEN NEER
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {roundNo != null && totalRounds != null && (
          <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
            {t("roundN", { n: roundNo, total: totalRounds })}
          </span>
        )}
        {code && (
          <span
            className="neon-ring"
            style={{
              // De roomcode is het enige wat je overtypt, dus hij mag opvallen:
              // de letters krijgen dezelfde behandeling als de letter op de rol,
              // en het vakje eromheen dezelfde verlooprand als de panelen. Beide
              // in goud, de kleur die de code al had.
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: 8,
              background: withAlpha(colors.gold, 0.12),
              ...neonSkin(colors.gold),
              ["--ng-w" as string]: "1px",
            } as React.CSSProperties}
          >
            <NeonText
              accent={colors.gold}
              blur={7}
              glow={0.7}
              style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, letterSpacing: 2 }}
            >
              {code}
            </NeonText>
          </span>
        )}
        {game && <ChatButton game={game} />}
        <span
          title={connected ? t("connected") : t("searching")}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: connected ? colors.green : colors.red,
            boxShadow: `0 0 10px ${connected ? colors.green : colors.red}`,
          }}
        />
        {onLeave && (
          <button
            onClick={() => {
              if (window.confirm(confirmText)) onLeave();
            }}
            aria-label={t("leaveRoom")}
            title={t("leaveRoom")}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
