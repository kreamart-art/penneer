// Chunky, pressable buttons with a solid bottom shadow for depth (§8).
// Variants: primary (violet), gold, danger (red), ghost (outline).
//
// PRIMARY en GOLD zijn geen CSS-verlopen meer maar de studio-platen (zie
// GoldButton.tsx): goud voor de hoofdacties, paars voor de kant van "Speel met
// vrienden" en "Maak een room". De hero-TEGEL op de main page hoort er niet
// bij: dat is een vierkante tegel, geen balk, en die houdt zijn eigen goud.
import React, { useState } from "react";
import { PlateArt, PLATE_CHAMFER, fullWidthButton, plateMetrics, type PlateKind } from "./GoldButton";
import { colors, font, radius } from "../theme/tokens";

type Variant = "primary" | "gold" | "danger" | "ghost";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
}

// Welke variant welke plaat krijgt; de rest blijft gewoon CSS.
//
// Alleen knoppen op VOLLE breedte krijgen de plaat. De art is een brede
// actiebalk; op een inline knopje naast een invoerveld ("Verstuur" in de chat,
// "Inloggen" naast een code) zou hij de hele rij opeten.
const PLATE_FOR: Partial<Record<Variant, PlateKind>> = { gold: "gold", primary: "violet" };

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
  // De plaat kan ontbreken (asset weg / offline); dan valt de knop terug op de
  // CSS-vorm en blijft hij gewoon werken.
  const [art, setArt] = useState(true);
  const kind = full ? PLATE_FOR[variant] : undefined;
  const plated = !!kind && art;
  const m = kind ? plateMetrics(kind) : null;
  const p = palette[variant];
  const depth = variant === "ghost" || plated ? 0 : 5;

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
        color: plated && m ? m.plate.text : p.text,
        // De plaat brengt zijn eigen kleur mee; een verloop eronder zou langs de
        // schuine hoeken uitsteken.
        background: plated ? "transparent" : p.bg,
        clipPath: !!kind && !art ? PLATE_CHAMFER : undefined,
        border: p.border ? `1.5px solid ${p.border}` : "none",
        borderRadius: plated ? 0 : radius.button,
        padding: full ? "0 26px" : "13px 20px",
        // ELKE knop op volle breedte krijgt hetzelfde vak, met of zonder plaat.
        // Anders staan een gouden, een paarse en een ghost-knop onder elkaar
        // alle drie net iets anders. De hoogte volgt uit de breedte (dus geen
        // uitrekken), de breedte laat ruimte over voor de gloed naast de plaat,
        // en het plafond houdt de knop op een tablet normaal van formaat.
        ...(full ? fullWidthButton : null),
        display: full ? "grid" : undefined,
        placeItems: full ? "center" : undefined,
        textAlign: "center",
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
      {plated && kind && <PlateArt kind={kind} onMissing={() => setArt(false)} />}
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          // Geen verticale correctie nodig: het knopvak IS het lichte vlak van
          // de plaat, dus het midden van de knop is het midden van het vlak.
          textShadow: plated && m ? m.plate.shine : undefined,
        }}
      >
        {children}
      </span>
    </button>
  );
}
