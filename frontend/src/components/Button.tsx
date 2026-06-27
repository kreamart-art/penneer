// Chunky, pressable buttons with a solid bottom shadow for depth (§8).
// Variants: primary (violet), gold, danger (red), ghost (outline).
import React, { useState } from "react";
import { colors, font, radius } from "../theme/tokens";

type Variant = "primary" | "gold" | "danger" | "ghost";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
}

const palette: Record<
  Variant,
  { bg: string; shadow: string; text: string; border?: string }
> = {
  primary: {
    bg: `linear-gradient(180deg, ${colors.violet}, ${colors.violetDeep})`,
    shadow: "#3a2bb0",
    text: colors.ink,
  },
  gold: {
    bg: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold})`,
    shadow: "#b9851f",
    text: "#2A1B05",
  },
  danger: {
    bg: `linear-gradient(180deg, ${colors.redHi}, ${colors.redDeep})`,
    shadow: "#9c2820",
    text: colors.ink,
  },
  ghost: {
    bg: "transparent",
    shadow: "transparent",
    text: colors.ink,
    border: colors.panelBorder,
  },
};

export function Button({ variant = "primary", full, style, children, disabled, ...rest }: Props) {
  const [down, setDown] = useState(false);
  const p = palette[variant];
  const depth = variant === "ghost" ? 0 : 5;

  return (
    <button
      {...rest}
      disabled={disabled}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        fontFamily: font.ui,
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: 0.2,
        color: p.text,
        background: p.bg,
        border: p.border ? `1.5px solid ${p.border}` : "none",
        borderRadius: radius.button,
        padding: "13px 20px",
        width: full ? "100%" : undefined,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: down || depth === 0 ? `0 0 0 ${p.shadow}` : `0 ${depth}px 0 ${p.shadow}`,
        transform: down && depth ? "translateY(3px)" : "translateY(0)",
        transition: "transform .06s ease, box-shadow .06s ease",
        userSelect: "none",
        WebkitUserSelect: "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
