// Tekst met dezelfde behandeling als de letter op de rol: een verloop over het
// glyph, een gloed als vervaagde kopie erachter, en een klein glanslichtje
// linksboven. In elke kleur, want de reeks wordt uit het accent afgeleid.
//
// Twee dingen die niet kunnen en waarom:
//  - `text-shadow` voor de gloed. Die wordt OVER het verloop getekend dat op de
//    letter is geknipt, dus je verliest precies het verloop dat je wilde. Voor
//    het kleine glanslichtje is dat juist het gewenste effect, dus dat blijft.
//  - `filter: drop-shadow`. iOS rastert die laag apart en dan zie je zijn
//    rechthoek over de tekst heen.
// Vandaar de vervaagde kopie eronder.
import type React from "react";
import { faceGradient, rampFrom } from "../theme/neon";

export function NeonText({
  accent,
  children,
  blur = 14,
  glow = 0.85,
  depth = "full",
  glowColor,
  style,
}: {
  accent: string;
  children: React.ReactNode;
  /** Hoe ver de gloed uitwaaiert. Schaal mee met de lettergrootte. */
  blur?: number;
  glow?: number;
  /** `full` loopt door tot de donkerste tint: mooi op iets dat zelf verlicht is,
   *  zoals een letter op een kaart. `light` stopt bij de lichte tint, voor losse
   *  tekst op een donkere achtergrond: daar zou de onderste helft van elke letter
   *  anders wegvallen en wordt het geheel dof. */
  depth?: "full" | "light";
  /** Een afwijkende kleur voor de gloed. Handig als het VLAK licht moet blijven
   *  maar de gloed eromheen juist verzadigd. */
  glowColor?: string;
  style?: React.CSSProperties;
}) {
  const ramp = rampFrom(accent);
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <span
        aria-hidden
        style={{ position: "absolute", inset: 0, color: glowColor ?? ramp[2], filter: `blur(${blur}px)`, opacity: glow, pointerEvents: "none" }}
      >
        {children}
      </span>
      <span
        style={{
          position: "relative",
          backgroundImage:
            depth === "light"
              ? `linear-gradient(155deg, ${ramp[3]} 0%, ${ramp[3]} 24%, ${ramp[2]} 100%)`
              : faceGradient(accent),
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          textShadow: "-1px -1px 0 rgba(255,255,255,.3)",
        }}
      >
        {children}
      </span>
    </span>
  );
}
