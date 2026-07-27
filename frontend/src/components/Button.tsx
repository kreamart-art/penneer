// Chunky, pressable buttons with a solid bottom shadow for depth (§8).
// Variants: primary (violet), gold, danger (red), ghost (outline).
//
// De GOUDEN variant is geen CSS-verloop meer maar de studio-plaat (zie
// GoldButton.tsx), zodat elke gouden knop in het spel dezelfde is. De hero-tegel
// "Speel met vrienden" op de main page hoort daar bewust niet bij: dat is een
// tegel, geen knop, en die houdt zijn eigen vlakke goud.
import React, { useState } from "react";
import { GoldPlate, GOLD_FALLBACK, GOLD_MIN_WIDTH, GOLD_RATIO } from "./GoldButton";
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
    text: "#4A2E04",
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
  // De plaat kan ontbreken (asset weg / offline); dan valt goud terug op de
  // CSS-vorm en blijft de knop gewoon werken.
  const [plate, setPlate] = useState(true);
  const p = palette[variant];
  const gold = variant === "gold" && plate;
  const depth = variant === "ghost" || gold ? 0 : 5;

  return (
    <button
      {...rest}
      disabled={disabled}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        position: "relative",
        fontFamily: font.ui,
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: 0.2,
        color: p.text,
        // De plaat brengt zijn eigen goud mee; een verloop eronder zou er langs
        // de schuine hoeken uitsteken.
        background: gold ? "transparent" : p.bg,
        clipPath: variant === "gold" && !plate ? GOLD_FALLBACK.clipPath : undefined,
        border: p.border ? `1.5px solid ${p.border}` : "none",
        borderRadius: gold ? 0 : radius.button,
        padding: gold ? "0 26px" : "13px 20px",
        display: gold ? "grid" : undefined,
        placeItems: gold ? "center" : undefined,
        textAlign: "center",
        width: full ? "100%" : undefined,
        // Niet uitrekken: de hoogte volgt uit de breedte, in de verhouding van
        // de plaat. De minimumbreedte houdt korte knoppen leesbaar, want anders
        // zou "Terug" een streepje van 12 pixels hoog worden.
        aspectRatio: gold ? `${GOLD_RATIO}` : undefined,
        minWidth: gold ? GOLD_MIN_WIDTH : undefined,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: down || depth === 0 ? `0 0 0 ${p.shadow}` : `0 ${depth}px 0 ${p.shadow}`,
        transform: down ? "translateY(3px)" : "translateY(0)",
        transition: "transform .06s ease, box-shadow .06s ease",
        userSelect: "none",
        WebkitUserSelect: "none",
        ...style,
      }}
    >
      {variant === "gold" && plate && <GoldPlate onMissing={() => setPlate(false)} />}
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          // Geen correctie nodig: het knopvak IS het lichte vlak van de plaat,
          // dus het midden van de knop is het midden van het vlak.
          textShadow: gold ? "0 1px 0 rgba(255,240,190,.4)" : undefined,
        }}
      >
        {children}
      </span>
    </button>
  );
}
