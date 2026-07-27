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
  style,
}: {
  accent: string;
  children: React.ReactNode;
  /** Hoe ver de gloed uitwaaiert. Schaal mee met de lettergrootte. */
  blur?: number;
  glow?: number;
  style?: React.CSSProperties;
}) {
  const ramp = rampFrom(accent);
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <span
        aria-hidden
        style={{ position: "absolute", inset: 0, color: ramp[2], filter: `blur(${blur}px)`, opacity: glow, pointerEvents: "none" }}
      >
        {children}
      </span>
      <span
        style={{
          position: "relative",
          backgroundImage: faceGradient(accent),
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
