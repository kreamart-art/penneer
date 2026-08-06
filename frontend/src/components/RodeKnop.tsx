// De rode stopknop: "Pen neer".
//
// Art in plaats van de getekende variant. Waarom apart van BredeKnop: die plaat
// is een vlakke balk (1600x148) die je horizontaal mag uitrekken zonder dat het
// opvalt. Deze is een DIKKE pil met ronde koppen (1600x330). Rek je die in de
// breedte, dan worden de koppen ovaal en zie je het meteen. Hij houdt dus zijn
// eigen verhouding, en om te voorkomen dat hij op volle breedte een blok van
// bijna negentig punten wordt, geldt er een plafond op de hoogte: hij wordt zo
// breed als die hoogte toelaat en staat verder gecentreerd.
import type { ReactNode } from "react";
import { sound } from "../sound/sound";
import { font } from "../theme/tokens";

const ART = "/ui/knop-rood.webp";
/** Verhouding van de plaat zelf (1600x330). */
const VERH = 1600 / 330;
/** Hoger dan dit wordt hij niet, hoe breed de kolom ook is. */
const MAX_HOOG = 70;

export function RodeKnop({
  children,
  onClick,
  disabled = false,
  style,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={() => { if (!disabled) { sound.uiTap(); onClick(); } }}
      disabled={disabled}
      className="pressable"
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        maxWidth: MAX_HOOG * VERH,
        margin: "0 auto",
        aspectRatio: `${VERH}`,
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      {/* Schaduw als tweede kopie, zoals overal in de app: een box-shadow werpt
          een rechthoek achter een vorm met ronde koppen. */}
      <img
        src={ART} alt="" aria-hidden draggable={false}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", maxWidth: "none",
          filter: "brightness(0) blur(7px)", opacity: 0.55, transform: "translateY(5px)", pointerEvents: "none",
        }}
      />
      <img
        src={ART} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", maxWidth: "none" }}
      />
      <span
        style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          padding: "0 20px",
          fontFamily: font.display, fontWeight: 800, fontSize: 15.5, letterSpacing: 0.3,
          color: "#FFF3F0", textShadow: "0 2px 5px rgba(90,8,4,.8)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {children}
      </span>
    </button>
  );
}
