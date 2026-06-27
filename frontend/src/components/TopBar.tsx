// Compact top bar: wordmark + room code + round indicator + connection dot.
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

interface Props {
  code?: string;
  roundNo?: number;
  totalRounds?: number;
  connected: boolean;
}

export function TopBar({ code, roundNo, totalRounds, connected }: Props) {
  const { t } = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
      }}
    >
      <span
        style={{
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: 1,
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
            style={{
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: 2,
              color: colors.gold,
              padding: "3px 10px",
              borderRadius: 8,
              background: withAlpha(colors.gold, 0.12),
              border: `1px solid ${withAlpha(colors.gold, 0.35)}`,
            }}
          >
            {code}
          </span>
        )}
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
      </div>
    </div>
  );
}
