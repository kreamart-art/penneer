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
//
// En die kopie krijgt RUIMTE om zich heen. Een blur wordt afgeknipt op de doos
// van zijn eigen element: waaiert hij tot aan die rand, dan houdt hij daar
// abrupt op en zie je de doos als rechthoek. Binnen een kaart met een eigen
// vulling valt dat niet op, op een kale achtergrond wel. Door de doos ruim twee
// keer de blur groter te maken is de vervaging al uitgestorven voor de rand.
import type React from "react";
import { faceGradient, rampFrom } from "../theme/neon";

export function NeonText({
  accent,
  children,
  blur = 14,
  glow = 0.85,
  depth = "full",
  glowColor,
  flat = false,
  drop = 0,
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
  /** Kaal: geen gloed en geen zijkant, alleen het vlak van de letter met de
   *  schaduw eronder. Voor een woordmerk dat plat moet leggen in plaats van
   *  uit het scherm te komen. */
  flat?: boolean;
  /** Zachte schaduw recht onder de letter, in em. 0 is uit. */
  drop?: number;
  /** Een afwijkende kleur voor de gloed. Handig als het VLAK licht moet blijven
   *  maar de gloed eromheen juist verzadigd. */
  glowColor?: string;
  style?: React.CSSProperties;
}) {
  const ramp = rampFrom(accent);
  const room = Math.ceil(blur * 2.2);
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      {!flat && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -room,
            right: -room,
            bottom: -room,
            left: -room,
            display: "grid",
            placeItems: "center",
            color: glowColor ?? ramp[2],
            filter: `blur(${blur}px)`,
            opacity: glow,
            pointerEvents: "none",
          }}
        >
          {children}
        </span>
      )}
      {drop > 0 && (
        // De schaduw op de grond. Het licht komt van BOVEN, dus hij valt recht
        // naar beneden en niet schuin: geen horizontale verschuiving, alleen
        // een verticale. Twee lagen, een korte harde en een lange zachte, want
        // een schaduw is dichter bij de letter donkerder dan aan zijn eind.
        // Als text-shadow, dus hij volgt de vorm van de letters.
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            whiteSpace: "nowrap",
            color: "transparent",
            textShadow: `0 ${drop.toFixed(3)}em ${(drop * 0.62).toFixed(3)}em rgba(10,3,28,.72), 0 ${(drop * 0.5).toFixed(3)}em ${(drop * 0.3).toFixed(3)}em rgba(10,3,28,.5)`,
            pointerEvents: "none",
          }}
        >
          {children}
        </span>
      )}
      <span
        style={{
          position: "relative",
          backgroundImage:
            depth === "light"
              ? `linear-gradient(155deg, ${ramp[3]} 0%, ${ramp[3]} 18%, ${ramp[2]} 62%, ${ramp[1]} 100%)`
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
