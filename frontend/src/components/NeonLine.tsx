// Een sierlijn die als licht leest in plaats van als streep, in elke kleur.
//
// Opbouw van onder naar boven: een kleine bloom, het verloop zelf (donker aan de
// uiteinden, fel in het midden), en een dun bijna-wit glansje bovenop dat ALLEEN
// in het midden zit. Dat laatste is belangrijk: bijna-wit over een bijna-zwarte
// flank mengt tot grijs, en op een lijn van anderhalve pixel is zo'n glansje al
// gauw de halve lijn. Glans hoort waar de lijn oplicht, nergens anders.
//
// Het uitfaden aan de uiteinden doet EEN masker over de hele stapel. Kreeg elke
// laag zijn eigen fade, dan lopen ze niet gelijk uit en zie je de laagjes los van
// elkaar eindigen.
import type React from "react";
import { lineGradient, rampFrom } from "../theme/neon";

const FADE = "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)";

export function NeonLine({
  accent,
  side = "top",
  height = 1.5,
  /** Uit: de lijn loopt door tot de rand in plaats van weg te vallen. */
  fade = true,
  /** Hoe breed het glansje in het midden is, als deel van de lijn. */
  shine = 16,
}: {
  accent: string;
  side?: "top" | "bottom";
  height?: number;
  fade?: boolean;
  shine?: number;
}) {
  const ramp = lineGradient(accent);
  const bright = rampFrom(accent)[3];
  const mask = fade ? ({ WebkitMaskImage: FADE, maskImage: FADE } as React.CSSProperties) : {};
  const span: React.CSSProperties = { position: "absolute", left: 0, right: 0, pointerEvents: "none" };
  return (
    <>
      {/* De bloom is bewust klein: een brede gloed maakt de lijn juist vaag in
          plaats van verlicht. */}
      <span
        aria-hidden
        style={{ ...span, [side]: -2, height: height + 4, background: ramp, opacity: 0.45, filter: "blur(3px)", ...mask }}
      />
      <span aria-hidden style={{ ...span, [side]: 0, height, background: ramp, ...mask }} />
      <span
        aria-hidden
        style={{
          ...span,
          [side]: 0,
          height: Math.min(0.8, height * 0.5),
          background: `linear-gradient(90deg, transparent ${50 - shine}%, ${bright} 50%, transparent ${50 + shine}%)`,
          opacity: 0.75,
        }}
      />
    </>
  );
}
