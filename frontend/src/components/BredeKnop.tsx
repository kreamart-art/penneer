// De brede gouden knop: even breed als de secties eronder.
//
// De gewone plaatknop (GoldButton) krimpt naar zijn opschrift, want dat is wat
// een actieknop hoort te doen. Deze niet: hij loopt van rand tot rand omdat hij
// de hoofdactie van het scherm is en in de kolom van de secties hoort te staan.
// Twee verschillende platen, twee verschillende regels.
//
// De art is een egale gouden balk met afgeschuinde hoeken, 1400x130 uit de
// bron gesneden op zijn zichtbare pixels. Hij wordt in de BREEDTE opgerekt en
// niet in de hoogte: de plaat is bijna vlak, dus horizontaal rekken valt niet
// op, en zo blijft de hoogte een keuze in plaats van een gevolg.
import type { ReactNode } from "react";
import { sound } from "../sound/sound";
import { font } from "../theme/tokens";

const ART = "/ui/knop-breed.webp";
/** Hoogte in pixels. De plaat is 10,8 keer zo breed als hoog; op een telefoon
 *  van 360 punten zou meeschalen 33px opleveren en dat is te laag om op te
 *  tikken. Vandaar een vaste hoogte en een plaat die meerekt. */
const HOOG = 52;

export function BredeKnop({
  children,
  onClick,
  disabled = false,
  hoog = HOOG,
  style,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hoog?: number;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={() => { if (!disabled) { sound.uiTap(); onClick(); } }}
      disabled={disabled}
      className={disabled ? undefined : "pressable"}
      style={{
        position: "relative", width: "100%", height: hoog,
        border: "none", background: "transparent", padding: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "block",
        ...style,
      }}
    >
      {/* Schaduw als tweede kopie, zoals overal: een box-shadow werpt een
          rechthoek achter een vorm met afgeschuinde hoeken. */}
      <img
        src={ART} alt="" aria-hidden draggable={false}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
          filter: "brightness(0) blur(6px)", opacity: 0.5, transform: "translateY(4px)",
          pointerEvents: "none",
        }}
      />
      <img
        src={ART} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />
      <span
        style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          padding: "0 18px",
          fontFamily: font.display, fontWeight: 800, fontSize: 16,
          letterSpacing: 0.3, color: "#3A2405",
          textShadow: "0 1px 0 rgba(255,240,190,.5)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {children}
      </span>
    </button>
  );
}
