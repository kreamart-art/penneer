// Pill switch for boolean settings (green when on).
import { colors, withAlpha } from "../theme/tokens";

interface Props {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ on, onChange, disabled }: Props) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        border: "none",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        background: on ? colors.green : withAlpha("#FFFFFF", 0.14),
        boxShadow: on ? `0 0 14px ${withAlpha(colors.green, 0.5)}` : "none",
        opacity: disabled ? 0.5 : 1,
        transition: "background .15s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .15s ease",
          boxShadow: "0 2px 4px rgba(0,0,0,.4)",
        }}
      />
    </button>
  );
}
