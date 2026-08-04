// Een testscherm voor het openscheuren van een pack. Bereikbaar op /?pack.
//
// Staat LOS van de dagronde met opzet: de animatie moet eerst op een echte
// telefoon kloppen voordat hij aan een prijs hangt. Zodra hij goed is, gaat
// dezelfde component naar het moment waarop je je dagprijs ophaalt.
import { useState } from "react";
import { PackOpenen } from "../components/PackOpenen";
import { colors, font, withAlpha } from "../theme/tokens";

export default function PreviewPack() {
  // Een sleutel die bij elke ronde omhoog gaat: dat zet de component opnieuw
  // op, want een animatie die al gelopen heeft speelt niet vanzelf opnieuw af.
  const [ronde, setRonde] = useState(0);
  const [open, setOpen] = useState(true);
  const [kant, setKant] = useState<"voor" | "achter">("voor");

  return (
    <div
      style={{
        minHeight: "100lvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14, padding: 24,
        background: "radial-gradient(circle at 50% 30%, #2A1150, #0A0518 70%)",
      }}
    >
      <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 16, letterSpacing: 1.4, textTransform: "uppercase", color: colors.gold }}>
        Pack openen
      </span>
      <span style={{ fontFamily: font.ui, fontSize: 13, color: "rgba(238,231,255,.7)", textAlign: "center", maxWidth: 280, lineHeight: 1.45 }}>
        Testversie. Tik op het pack om het te scheuren.
      </span>

      <span style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {(["voor", "achter"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setKant(k); setRonde((r) => r + 1); setOpen(true); }}
            style={{
              padding: "8px 16px", borderRadius: 999, cursor: "pointer",
              border: `1.4px solid ${withAlpha(colors.gold, kant === k ? 0.9 : 0.3)}`,
              background: kant === k ? withAlpha(colors.gold, 0.18) : "transparent",
              fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: colors.ink,
            }}
          >
            {k === "voor" ? "Kaart met embleem" : "Lege kaart"}
          </button>
        ))}
      </span>

      <button
        type="button"
        onClick={() => { setRonde((r) => r + 1); setOpen(true); }}
        style={{
          marginTop: 10, padding: "12px 24px", borderRadius: 999, cursor: "pointer", border: "none",
          background: "linear-gradient(180deg, #FFE08A, #F2AC22 55%, #C97A0B)",
          fontFamily: font.wide, fontWeight: 700, fontSize: 14, letterSpacing: 1,
          textTransform: "uppercase", color: "#2A1603",
        }}
      >
        Opnieuw
      </button>

      {open && (
        <PackOpenen
          key={ronde}
          kaartArt={kant === "voor" ? "/ui/dag/kaart-voor.webp" : "/ui/dag/kaart-achter.webp"}
          titel="Je hebt een kaart"
          onderschrift="Hij staat nu in je verzameling."
          knop="Openen"
          knopKlaar="Klaar"
          onKlaar={() => setOpen(false)}
        />
      )}
    </div>
  );
}
