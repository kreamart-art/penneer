// De kleine gouden knopplaat uit de UI-map, met een opschrift erop.
//
// Waarvoor: een KORT opschrift op een gouden knop. De gewone Button is gemaakt
// voor een regel over de volle breedte; zet je daar een prijs of een woord van
// vijf letters op, dan is de knop groter dan wat erop staat en leest dat als
// een lege balk met een tekstje in het midden. Deze is art, dus hij houdt zijn
// eigen verhouding en groeit niet mee met de doos.
//
// De grote acties (start het spel, nodig uit) blijven de gewone Button: die
// dragen wel een hele regel en moeten wel de breedte hebben.
import type { ReactNode } from "react";
import { sound } from "../sound/sound";
import { font } from "../theme/tokens";

/** Hoogte gedeeld door breedte van de art. */
const VERH = 150 / 384;

export function KnopPlaat({
  label,
  breed = 92,
  uit,
  onClick,
}: {
  label: ReactNode;
  breed?: number;
  uit?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => { if (!uit) { sound.uiTap(); onClick(); } }}
      disabled={uit}
      className={uit ? undefined : "pressable"}
      style={{
        position: "relative",
        width: breed,
        height: Math.round(breed * VERH),
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: uit ? "default" : "pointer",
        opacity: uit ? 0.55 : 1,
        flexShrink: 0,
        display: "block",
      }}
    >
      <img src="/ui/knop-klein.webp" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {/* Op het VLAK van de knop en niet op het midden van de doos: onder het
          vlak zit nog een rand en een schaduw, en die trekken het midden
          omlaag. Gemeten aan de art loopt het gele veld van 4 tot 125 van de
          150, dus zijn hart ligt op 43,3 procent. */}
      <span
        style={{
          position: "absolute",
          left: "50.4%",
          top: "43.3%",
          transform: "translate(-50%, -50%)",
          display: "block",
          whiteSpace: "nowrap",
          fontFamily: font.display,
          fontWeight: 800,
          fontSize: Math.round(breed * 0.15),
          lineHeight: 1,
          color: "#3A2405",
          textShadow: "0 1px 0 rgba(255,240,190,.5)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
