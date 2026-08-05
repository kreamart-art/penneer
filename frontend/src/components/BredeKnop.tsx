// De brede gouden knop: even breed als de secties eronder.
//
// De gewone plaatknop (GoldButton) krimpt naar zijn opschrift, want dat is wat
// een actieknop hoort te doen. Deze niet: hij loopt van rand tot rand omdat hij
// de hoofdactie van het scherm is en in de kolom van de secties hoort te staan.
// Twee verschillende platen, twee verschillende regels.
//
// De art is een egale gouden balk met afgeschuinde hoeken, 1600x148 uit de
// bron gesneden op zijn zichtbare pixels.
//
// Twee maten:
//  - `strek` (standaard): een vaste hoogte, plaat rekt in de breedte mee. Op een
//    telefoon van 360 punten zou meeschalen 33px opleveren, en dat is te laag om
//    op te tikken. De plaat is bijna vlak, dus horizontaal rekken valt niet op.
//  - `strek={false}`: de plaat houdt zijn EIGEN verhouding, dus hij wordt niet
//    dikker dan hij is. Het raakvlak blijft 44 punten doordat er lucht boven en
//    onder de plaat in de knop zit, niet doordat de plaat groeit.
import type { ReactNode } from "react";
import { sound } from "../sound/sound";
import { font } from "../theme/tokens";

// ?v=2: de plaat is vervangen door de nieuwe, hogere-resolutie versie. /ui/
// zit in de lange-adem-cache van de service worker, dus zonder andere URL
// blijft een geïnstalleerde telefoon de oude houden.
const ART = "/ui/knop-breed.webp?v=2";
/** Hoogte in pixels als de plaat meerekt. */
const HOOG = 52;
/** Verhouding van de plaat zelf (1600x148). */
export const BREED_VERH = 1600 / 148;

export function BredeKnop({
  children,
  onClick,
  disabled = false,
  hoog = HOOG,
  strek = true,
  style,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hoog?: number;
  /** Uit als de plaat zijn eigen verhouding moet houden. */
  strek?: boolean;
  style?: React.CSSProperties;
}) {
  const plaat = (
    <>
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
          fontFamily: font.display, fontWeight: 800, fontSize: strek ? 16 : 14,
          letterSpacing: 0.3, color: "#3A2405",
          textShadow: "0 1px 0 rgba(255,240,190,.5)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {children}
      </span>
    </>
  );

  const basis: React.CSSProperties = {
    border: "none", background: "transparent",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    width: "100%",
  };

  if (!strek) {
    return (
      <button
        onClick={() => { if (!disabled) { sound.uiTap(); onClick(); } }}
        disabled={disabled}
        className={disabled ? undefined : "pressable"}
        // De lucht boven en onder maakt het raakvlak 44 punten hoog zonder de
        // plaat op te rekken.
        style={{ ...basis, display: "flex", alignItems: "center", padding: "7px 0", ...style }}
      >
        <span style={{ position: "relative", display: "block", width: "100%", aspectRatio: `${BREED_VERH}` }}>
          {plaat}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => { if (!disabled) { sound.uiTap(); onClick(); } }}
      disabled={disabled}
      className={disabled ? undefined : "pressable"}
      style={{ ...basis, position: "relative", height: hoog, padding: 0, display: "block", ...style }}
    >
      {plaat}
    </button>
  );
}
