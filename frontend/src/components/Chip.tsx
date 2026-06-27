// Settings pill toggle — violet gradient + glow when active, outline when not.
import { colors, font, radius, withAlpha } from "../theme/tokens";

interface Props {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Chip({ active, onClick, children, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: font.ui,
        fontWeight: 600,
        fontSize: 14,
        padding: "9px 16px",
        borderRadius: radius.chip,
        cursor: disabled ? "not-allowed" : "pointer",
        color: active ? colors.ink : colors.sub,
        background: active
          ? `linear-gradient(180deg, ${colors.violet}, ${colors.violetDeep})`
          : "transparent",
        border: `1.5px solid ${active ? "transparent" : colors.panelBorder}`,
        boxShadow: active ? `0 0 18px ${withAlpha(colors.violet, 0.55)}` : "none",
        opacity: disabled ? 0.45 : 1,
        transition: "all .12s ease",
        userSelect: "none",
      }}
    >
      {children}
    </button>
  );
}
