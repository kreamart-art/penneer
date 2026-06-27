// The red arcade buzzer — round, 3D, pressable (§8). Label "Draai" then "STOP".
import { useState } from "react";
import { colors, font, withAlpha } from "../theme/tokens";

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}

export function Buzzer({ label, onPress, disabled, size = 138 }: Props) {
  const [down, setDown] = useState(false);

  return (
    <button
      onClick={() => !disabled && onPress()}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        position: "relative",
        background: `radial-gradient(circle at 50% 32%, ${colors.redHi} 0%, ${colors.red} 45%, ${colors.redDeep} 100%)`,
        boxShadow: down
          ? `0 4px 0 ${colors.redDeep}, inset 0 6px 14px rgba(255,255,255,.35), 0 0 30px ${withAlpha(
              colors.red,
              0.5
            )}`
          : `0 12px 0 ${colors.redDeep}, inset 0 8px 18px rgba(255,255,255,.4), 0 18px 40px ${withAlpha(
              colors.red,
              0.45
            )}`,
        transform: down ? "translateY(8px)" : "translateY(0)",
        transition: "transform .08s ease, box-shadow .08s ease",
        fontFamily: font.display,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: 1,
        color: colors.ink,
        textShadow: "0 2px 6px rgba(0,0,0,.35)",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {label}
    </button>
  );
}
