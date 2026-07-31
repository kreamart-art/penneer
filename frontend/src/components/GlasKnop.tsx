// De ronde glazen tegel met de gouden rand: de knopvorm van de chatbalk.
//
// Drie knoppen delen hem (versturen, foto, microfoon) en daarom staat hij hier
// en niet drie keer uitgeschreven. Ze horen bij elkaar: het zijn drie manieren
// om hetzelfde te doen, en dan mogen ze niet drie verschillende dingen lijken.
//
// De opbouw is de gewone stapel: de rand als eigen laag met de padding-truc
// (een border volgt een verloop niet), daarbinnen het glas, dan de glans en als
// laatste het teken. De rand is DUN: op een knop van 44 pixels leest anderhalve
// pixel al als een ring in plaats van als een lijn.
import type { CSSProperties, ReactNode } from "react";

export const GOUD_DONKER = "#8A5A12";
export const GOUD_LIJN = "#E8B33C";
export const GOUD_LICHT = "#FFDE8A";

/** Hetzelfde goud als de knopranden, als lijnverloop voor een NeonKader: de
 *  popup en de knoppen erin horen uit een stuk metaal te komen. */
export const KNOP_GOUD_VERLOOP = `linear-gradient(155deg, ${GOUD_LICHT} 0%, ${GOUD_LIJN} 34%, ${GOUD_DONKER} 68%, ${GOUD_LIJN} 100%)`;

/** Een gouden HAARLIJN boven- of onderaan een vlak, in hetzelfde verloop als
 *  de knopranden. Als achtergrondlaag van 1px hoog, want een border kan geen
 *  verloop volgen. In plaats van de grijze `colors.hairline`-schotten. */
export function goudHaarlijn(kant: "top" | "bottom"): React.CSSProperties {
  return {
    backgroundImage: `linear-gradient(90deg, ${GOUD_DONKER} 0%, ${GOUD_LIJN} 30%, ${GOUD_LICHT} 50%, ${GOUD_LIJN} 70%, ${GOUD_DONKER} 100%)`,
    backgroundSize: "100% 1px",
    backgroundPosition: kant,
    backgroundRepeat: "no-repeat",
  };
}

/** Het verloop voor een teken in dezelfde gouden lijn als de rand. */
export function GoudLijnDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={GOUD_LICHT} />
        <stop offset="0.55" stopColor={GOUD_LIJN} />
        <stop offset="1" stopColor={GOUD_DONKER} />
      </linearGradient>
    </defs>
  );
}

export function GlasKnop({
  onClick,
  label,
  maat = 44,
  actief = true,
  submit = false,
  uit = false,
  style,
  children,
}: {
  onClick?: () => void;
  label: string;
  maat?: number;
  /** Uit = niets te doen: dezelfde vorm, alleen zachter. */
  actief?: boolean;
  /** In een form is de knop de indiener; daarbuiten een gewone knop. */
  submit?: boolean;
  uit?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type={submit ? "submit" : "button"}
      onClick={onClick}
      disabled={uit}
      aria-label={label}
      title={label}
      className="pressable glowhover-klein"
      style={{
        position: "relative",
        flexShrink: 0,
        width: maat,
        height: maat,
        borderRadius: "50%",
        border: "none",
        padding: 0,
        cursor: uit ? "default" : "pointer",
        background: "transparent",
        display: "grid",
        placeItems: "center",
        opacity: actief && !uit ? 1 : 0.55,
        transition: "opacity .15s",
        ...style,
      }}
    >
      {/* De rand: een gouden ring die linksboven het licht vangt. Als ECHTE
          ring, met het masker dat het midden wegknipt: het glas erbinnen is
          doorschijnend, en een volle gouden schijf eronder scheen daar geel
          doorheen. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          padding: 1,
          background: `linear-gradient(155deg, ${GOUD_LICHT} 0%, ${GOUD_LIJN} 34%, ${GOUD_DONKER} 68%, ${GOUD_LIJN} 100%)`,
          opacity: 0.85,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
        }}
      />
      {/* Het glas: VLAK, dezelfde finish als de glasrijen van de ranglijst. De
          eerdere versie had een radiale lichtbron bovenin plus een ovale
          glansstreep, en dat samen las als een bolle knikker. Vlak glas is een
          donkere vulling (dezelfde als het invulveld ernaast) met een schuine
          witte glans van een paar procent, meer niet. */}
      <span
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.02) 34%, rgba(255,255,255,0) 56%)," +
            "linear-gradient(180deg, rgba(6,3,18,.62) 0%, rgba(6,3,18,.55) 100%)",
        }}
      />
      {children}
    </button>
  );
}
