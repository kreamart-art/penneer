// Player token — rounded-square filled with the player's color at low alpha,
// 2px colored border, soft colored glow, initial in Space Grotesk. Gold crown
// badge top-right for host / round winner (§8).
import { ArtIcoon } from "./ArtIcoon";
import { neonSkin } from "../theme/neon";
import { font, withAlpha } from "../theme/tokens";

// De kleur per rang. Werd ooit als ring om de avatar getekend, maar dat lag over
// het frame dat je zelf koos: twee ringen om dezelfde avatar zijn niet uit elkaar
// te houden. De kleuren blijven wel bestaan voor plekken die ze los gebruiken.
export const RANK_RING: Record<string, string> = {
  krabbelaar: "#C08A50",       // brons
  pennenlikker: "#B9C4D0",     // zilver
  woordjager: "#36E0AE",       // groen
  woordsmid: "#7C5CFF",        // violet
  lettermeester: "#32ADE6",    // blauw
  categoriekoning: "#FFC23D",  // goud
  legende: "#FF5A3C",          // vuurrood
};

// Frames die in CODE getekend worden in plaats van uit een plaatje te komen. De
// hele look hangt aan een reeks die uit de accentkleur wordt afgeleid, dus een
// frame in een nieuwe kleur is een regel hier, geen nieuw bestand. Ids die hier
// NIET in staan zijn art-frames en worden als afbeelding geladen.
export const NEON_FRAMES: Record<string, string> = {
  "nf-violet": "#A96BFF",
  "nf-cyan": "#28E0FF",
  "nf-emerald": "#2AE58D",
  "nf-ember": "#FF7A35",
  "nf-rose": "#FF5FA8",
  "nf-silver": "#C9CEE0",
};

interface Props {
  name: string;
  color: string;
  /** De trede op de divisieladder. Als hij bekend is, kleurt de RAND van de
   *  avatar naar het schild in plaats van naar de gekozen spelerkleur: de ring
   *  is een rang, geen smaak. De spelerkleur blijft de vulling en de letter
   *  doen, want die is van de speler zelf. */
  divisie?: number;
  size?: number;
  crown?: boolean;
  dim?: boolean; // disconnected
  // Account photo: rendered when set (served by /api/avatar, ?v busts cache).
  userId?: string | null;
  hasAvatar?: boolean;
  avatarVer?: number;
  frame?: string | null; // avatar-frame id -> gold frame overlay (level reward)
  /** De gloed achter de avatar. Uit in lijsten: tussen tien avatars onder elkaar
   *  wordt dat een waas. Alleen aan waar er EEN avatar groot in beeld staat. */
  glow?: boolean;
}

// Dezelfde tinten als DIVISIE_ACCENT in ProfileHero, hier als hex omdat de
// neon-rand hex verwacht. Volgorde = de ladder: paars, blauw, lichtblauw,
// groen, rood, zilver, zwart(goud).
export const SCHILD_RAND = ["#AC7BE9", "#567CF0", "#58C4EC", "#54CE7C", "#E74C5A", "#C4CCDC", "#E8A817"] as const;

export function Avatar({ name, color, size = 40, crown, dim, userId, hasAvatar, avatarVer, frame, divisie, glow = false }: Props) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  // De randkleur: het schild als we de divisie kennen, anders de spelerkleur.
  const rand = divisie == null ? color : SCHILD_RAND[Math.max(0, Math.min(SCHILD_RAND.length - 1, divisie))];
  const photo = !!(userId && hasAvatar);
  const neonColor = frame ? NEON_FRAMES[frame] : undefined;
  const artFramed = !!frame && !neonColor;
  // An ART frame fills the size box and the avatar insets to ~0.70 so it sits in
  // the frame's transparent window. A CODE frame is a thin ring, so the avatar
  // only makes room for the ring itself. The frame is the badge of honor, so it
  // replaces the automatic rank ring while active.
  const inner = artFramed ? Math.round(size * 0.7) : neonColor ? size - 6 : size;
  const ringColor = neonColor;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: inner,
          height: inner,
          position: "relative",
          borderRadius: inner * 0.32,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          background: withAlpha(color, 0.16),
          // Geen vlakke rand: de ring hieronder is de rand, met een verloop dat
          // bovenaan oplicht en onderaan wegzakt. Zo krijgt de spelerkleur
          // dezelfde behandeling als de rangring eromheen.
          // De ring zelf is een eigen laag hieronder; hier alleen de gloed, want
          // een box-shadow kan geen verloop dragen.
          boxShadow: !glow || dim || artFramed
            ? "none"
            : `0 0 14px ${withAlpha(ringColor ?? rand, 0.45)}`,
          opacity: dim ? 0.4 : 1,
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: inner * 0.44,
          color,
          transition: "opacity .2s ease",
        }}
      >
        {photo ? (
          <img
            src={`/api/avatar/${userId}?v=${avatarVer ?? 0}`}
            alt={name}
            width={inner}
            height={inner}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          initial
        )}
        {/* De rand in de kleur van de speler. Ligt binnen het vak, dus over de
            foto heen, en volgt vanzelf de ronding. */}
        <span
          aria-hidden
          className="neon-ring"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            ...neonSkin(rand),
            ["--ng-w" as string]: "2px",
            opacity: dim ? 0.5 : 1,
            pointerEvents: "none",
          } as React.CSSProperties}
        />
      </div>
      {/* De ring: rangring of code-frame, in zijn eigen kleur. */}
      {ringColor && !dim && (
        <span
          aria-hidden
          className="neon-ring"
          style={{
            position: "absolute",
            inset: neonColor ? 0 : Math.round((size - inner) / 2) - 2,
            borderRadius: size * 0.32,
            ...neonSkin(ringColor),
            ["--ng-w" as string]: neonColor ? "3px" : "2px",
            pointerEvents: "none",
          } as React.CSSProperties}
        />
      )}
      {artFramed && (
        <img
          src={`/frames/${frame}.webp`}
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: size, height: size, objectFit: "contain", pointerEvents: "none", opacity: dim ? 0.4 : 1 }}
        />
      )}
      {crown && (
        <div style={{ position: "absolute", top: -9, right: -7 }}>
          <ArtIcoon naam="kroon" size={Math.max(15, Math.round(size * 0.44))} />
        </div>
      )}
    </div>
  );
}
