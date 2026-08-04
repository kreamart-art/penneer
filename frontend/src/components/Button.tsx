// Chunky, pressable buttons with a solid bottom shadow for depth (§8).
// Variants: primary (violet), gold, danger (red), ghost (outline).
//
// PRIMARY en GOLD zijn geen CSS-verlopen meer maar de studio-platen (zie
// GoldButton.tsx): goud voor de hoofdacties, paars voor de kant van "Speel met
// vrienden" en "Maak een room". De hero-TEGEL op de main page hoort er niet
// bij: dat is een vierkante tegel, geen balk, en die houdt zijn eigen goud.
import React, { useState } from "react";
import { PlateArt, PLATE_CHAMFER, fullWidthButton, compactButton, plateMetrics, type PlateKind } from "./GoldButton";
import { colors, font, radius } from "../theme/tokens";

type Variant = "primary" | "gold" | "danger" | "ghost";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
  /** Een slag kleiner, voor een knop in een paneel met een vaste hoogte.
   *
   *  Alleen de BREEDTE gaat omlaag. De plaat heeft een vaste verhouding, dus
   *  smaller is vanzelf ook lager, en het opschrift blijft op zijn eigen maat
   *  staan: een knop die kleiner moet passen is nog steeds even belangrijk om te
   *  kunnen lezen. */
  compact?: boolean;
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
    // Het VLAK wordt apart getekend (zie DANGER_FACE); hier alleen de kleur van
    // de tekst en de lip eronder.
    bg: "none",
    shadow: "#7d1c14",
    text: "#FFF1EE",
  },
  ghost: {
    bg: "transparent",
    shadow: "transparent",
    text: colors.ink,
    border: colors.panelBorder,
  },
};

export function Button({ variant = "primary", full, compact, style, children, disabled, ...rest }: Props) {
  const [down, setDown] = useState(false);
  // De plaat kan ontbreken (asset weg / offline); dan valt de knop terug op de
  // CSS-vorm en blijft hij gewoon werken.
  const [art, setArt] = useState(true);
  const kind = full ? PLATE_FOR[variant] : undefined;
  const plated = !!kind && art;
  const m = kind ? plateMetrics(kind) : null;
  const p = palette[variant];
  const depth = variant === "ghost" || plated ? 0 : 5;

  // De rode knop krijgt dezelfde behandeling als de gouden hero-knop op de main
  // page: een metalen rand met oplichtende hoeken als laag eronder, en daarop een
  // gelaagd vlak. Hij houdt wel zijn eigen vorm, een gewone afgeronde rechthoek.
  //
  // Een `border` kan geen verloop dragen, dus de rand is een laag eronder waar
  // het vlak net binnen valt. Geen gloed eromheen: al het licht blijft binnen de
  // knop, dit is een stopknop en geen beloning.
  if (variant === "danger") {
    const rim = [
      "radial-gradient(58% 58% at 4% 6%, rgba(255,226,220,.95) 0%, transparent 62%)",
      "radial-gradient(58% 58% at 96% 6%, rgba(255,226,220,.8) 0%, transparent 62%)",
      "radial-gradient(58% 58% at 4% 94%, rgba(255,226,220,.28) 0%, transparent 62%)",
      "radial-gradient(58% 58% at 96% 94%, rgba(255,226,220,.28) 0%, transparent 62%)",
      "linear-gradient(180deg, #FFB6A8 0%, #F2523F 40%, #B7291B 72%, #5C0D07 100%)",
    ].join(", ");
    const face = [
      "linear-gradient(180deg, rgba(255,235,230,.55) 0%, rgba(255,235,230,.12) 7%, transparent 20%)",
      "radial-gradient(66% 44% at 50% 14%, rgba(255,205,195,.4) 0%, transparent 68%)",
      "radial-gradient(125% 105% at 50% 46%, transparent 52%, rgba(80,12,6,.42) 100%)",
      `linear-gradient(180deg, ${colors.redHi} 0%, ${colors.red} 22%, ${colors.redDeep} 62%, #8E1A11 100%)`,
    ].join(", ");
    return (
      <button
        {...rest}
        disabled={disabled}
        onPointerDown={() => setDown(true)}
        onPointerUp={() => setDown(false)}
        onPointerLeave={() => setDown(false)}
        style={{
          position: "relative",
          padding: 2,
          border: "none",
          borderRadius: radius.button,
          backgroundImage: rim,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          // Een knop is van zichzelf inline, en `margin: auto` centreert alleen
          // een BLOK. Vandaar grid: dan pakken de automatische marges wel.
          display: full ? "grid" : "inline-grid",
          ...(full ? fullWidthButton : null),
          ...(full && compact ? compactButton : null),
          boxShadow: down
            ? "0 2px 6px rgba(0,0,0,.45), 0 1px 0 rgba(80,12,6,.9)"
            : "0 5px 12px rgba(0,0,0,.45), 0 3px 0 rgba(80,12,6,.9)",
          transform: down ? "translateY(2px)" : "translateY(0)",
          transition: "transform .06s ease, box-shadow .06s ease",
          userSelect: "none",
          WebkitUserSelect: "none",
          ...style,
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: "100%",
            height: "100%",
            minHeight: full ? undefined : 44,
            borderRadius: radius.button - 2,
            padding: full ? "0 26px" : "11px 18px",
            backgroundImage: face,
            // Afschuining: lichte bovenrand, donkere onderlip, licht dat naar
            // binnen wegvalt.
            boxShadow:
              "inset 0 1.5px 0 rgba(255,235,230,.85), inset 0 -3px 0 rgba(80,12,6,.6), inset 0 10px 16px rgba(255,120,100,.18), inset 0 -12px 18px rgba(80,12,6,.34)",
            fontFamily: font.ui,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: 0.2,
            color: "#FFF1EE",
            textShadow: "0 1px 2px rgba(80,12,6,.55)",
            textAlign: "center",
          }}
        >
          {children}
        </span>
      </button>
    );
  }

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
        // Let op: NIET ook nog `background` zetten. De shorthand wist
        // `background-image`, ook als je hem op undefined zet.
        backgroundImage: plated ? "none" : p.bg,
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
        ...(full && compact ? compactButton : null),
        display: full ? "grid" : undefined,
        placeItems: full ? "center" : undefined,
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        // De afschuining: lichte bovenrand, donkere onderlip, en zacht licht dat
        // naar binnen wegvalt. Daaronder de lip die de knop indrukbaar maakt.
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
