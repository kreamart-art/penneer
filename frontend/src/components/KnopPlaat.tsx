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

/** Per kleur: het bestand, de verhouding en waar het VLAK van de knop zit.
 *  Het opschrift hoort op dat vlak en niet op het midden van de doos: onder het
 *  vlak zit nog een rand en een schaduw, en die trekken het midden omlaag. Beide
 *  cijfers zijn aan de art gemeten.
 *
 *  DEZELFDE PLAAT ALS DE GROTE KNOP en geen eigen bestand meer. Er waren twee
 *  aparte plaatjes voor de kleine knop, in een andere vorm dan de grote, en dan
 *  staan er twee soorten gouden knoppen in hetzelfde scherm. Nu is het één
 *  ontwerp op twee maten, en het scheelt ook twee downloads.
 *
 *  De knop wordt daardoor LAGER: op dezelfde breedte was hij 0,391 hoog en nu
 *  0,269. De tekst niet: die hangt aan de BREEDTE (breed * 0.15), dus die blijft
 *  precies zoals hij was. */
const PLAAT = {
  goud: { src: "/btn-gold.webp", verh: 269 / 1000, hart: "48.0%", tekst: "#3A2405", glans: "rgba(255,240,190,.5)" },
  paars: { src: "/btn-violet.webp", verh: 269 / 1000, hart: "48.0%", tekst: "#FFFFFF", glans: "rgba(60,20,110,.55)" },
} as const;

export function KnopPlaat({
  label,
  breed = 92,
  kleur = "goud",
  uit,
  onClick,
}: {
  label: ReactNode;
  breed?: number;
  kleur?: keyof typeof PLAAT;
  uit?: boolean;
  onClick: () => void;
}) {
  const p = PLAAT[kleur];
  return (
    <button
      onClick={() => { if (!uit) { sound.uiTap(); onClick(); } }}
      disabled={uit}
      className={uit ? undefined : "pressable"}
      style={{
        position: "relative",
        width: breed,
        height: Math.round(breed * p.verh),
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: uit ? "default" : "pointer",
        opacity: uit ? 0.55 : 1,
        flexShrink: 0,
        display: "block",
      }}
    >
      <img src={p.src} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <span
        style={{
          position: "absolute",
          left: "50.4%",
          top: p.hart,
          transform: "translate(-50%, -50%)",
          display: "block",
          whiteSpace: "nowrap",
          fontFamily: font.display,
          fontWeight: 800,
          fontSize: Math.round(breed * 0.15),
          lineHeight: 1,
          color: p.tekst,
          textShadow: `0 1px 0 ${p.glans}`,
        }}
      >
        {label}
      </span>
    </button>
  );
}
