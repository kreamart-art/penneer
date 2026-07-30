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
      className="pressable glowhover"
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
      {/* De rand: een gouden ring die linksboven het licht vangt. Het glas ligt
          er als tweede laag net binnen, dus wat overblijft IS de lijn. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `linear-gradient(155deg, ${GOUD_LICHT} 0%, ${GOUD_LIJN} 34%, ${GOUD_DONKER} 68%, ${GOUD_LIJN} 100%)`,
        }}
      />
      {/* Het glas. Donker en doorschijnend, met een lichte bovenhelft: een bol
          oppervlak vangt bovenaan meer licht dan onderaan. */}
      <span
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: "50%",
          background:
            "radial-gradient(120% 100% at 30% 0%, rgba(255,222,138,.20) 0%, rgba(255,222,138,.05) 38%, rgba(0,0,0,0) 62%)," +
            "linear-gradient(180deg, rgba(52,34,86,.92) 0%, rgba(18,9,38,.95) 100%)",
          boxShadow: "inset 0 1px 1px rgba(255,222,138,.30), inset 0 -3px 8px rgba(0,0,0,.55)",
        }}
      />
      {/* De glans: een kort streepje bovenaan, niet een halve ring. Licht is
          kort, anders leest het als een gekleurd vlak in plaats van als glas. */}
      <span
        style={{
          position: "absolute",
          top: maat * 0.11,
          left: "50%",
          transform: "translateX(-50%)",
          width: maat * 0.44,
          height: maat * 0.16,
          borderRadius: "50%",
          background: "linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,0))",
          pointerEvents: "none",
        }}
      />
      {children}
    </button>
  );
}
