// Het arena-decor: de plaat met het gloeiende podium, op een ondergrond in de
// kleuren van die plaat zelf. Gedeeld door Duel en het gewone potje, zodat die
// twee schermen op hetzelfde toneel spelen.
//
// De plaat is boven en onder doorzichtig gemaakt, dus wat eronder ligt moet
// exact die randkleuren hebben, anders zie je een naad. Deze waarden zijn uit
// de platen gemeten en komen uit het Duel-palet: donkerste achtergrond #09002C,
// donker paars #170150, midden paars #360287.
//
// Het podium zit op een bekende fractie van de plaathoogte (gemeten: de
// helderste beeldrij). Door de plaat precies die fractie omhoog te schuiven
// landt het podium op de lijn die je kiest, op elk schermformaat. En omdat de
// randen vervagen maakt het niet uit als dat er een paar pixels naast zit.
import { useState } from "react";
import { withAlpha } from "../theme/tokens";

export const ARENA = {
  base: "#09002C",   // donkerste achtergrond, gelijk aan de bovenrand van de plaat
  deep: "#0D0134",
  mid: "#10013B",    // de onderrand van de plaat
  glow: "#360287",   // midden paars, alleen als zachte lichtspreiding
} as const;

export function Arena({
  src,
  /** Waar het podium in de PLAAT zit, als fractie van de plaathoogte. */
  podium,
  /** Waar het podium op het SCHERM moet komen. */
  at,
  /** Hoe breed de plaat wordt getekend, als deel van de schermbreedte. */
  width = "205%",
  /** Waar de lichtspreiding zijn kern heeft. */
  glowAt = "46%",
  /** `fill` laat de plaat het hele scherm vullen (object-fit: cover) in plaats
   *  van als losse band met vervaagde randen te liggen. Dan bepaalt de plaat
   *  zelf waar het podium uitkomt, en `podium`/`at`/`width` doen niets meer. */
  fill = false,
}: {
  src: string;
  podium: number;
  at: string;
  width?: string;
  glowAt?: string;
  fill?: boolean;
}) {
  const [art, setArt] = useState(true);
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Dekkende ondergrond in het palet van de plaat: dekt de app-gradient af. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${ARENA.base} 0%, ${ARENA.base} 16%, ${ARENA.deep} 44%, ${ARENA.mid} 68%, ${ARENA.deep} 86%, ${ARENA.base} 100%)`,
        }}
      />
      {/* Zachte lichtspreiding rond het podium, zodat de overgang van plaat naar
          ondergrond als licht leest en niet als een rand. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(80% 40% at 50% ${glowAt}, ${withAlpha(ARENA.glow, 0.4)} 0%, transparent 70%)`,
        }}
      />
      {art && (
        <img
          src={src}
          alt=""
          onError={() => setArt(false)}
          style={
            fill
              ? {
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  maxWidth: "none",
                  objectFit: "cover",
                  // Staand is de hoogte de krappe kant, dus de hele plaat is in
                  // beeld en het podium landt vanzelf op zijn eigen fractie; de
                  // zijkanten worden bijgesneden.
                  objectPosition: "50% 50%",
                }
              : {
                  position: "absolute",
                  left: "50%",
                  top: at,
                  width,
                  maxWidth: "none",   // de reset knipt afbeeldingen anders terug naar schermbreedte
                  transform: `translate(-50%, -${podium * 100}%)`,
                }
          }
        />
      )}
      {/* Vignet: houdt de aandacht in het midden en dempt de randen. */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(125% 70% at 50% 40%, transparent 30%, ${withAlpha(ARENA.base, 0.62)} 100%)` }} />
    </div>
  );
}
