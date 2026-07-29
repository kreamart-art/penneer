// De rondleiding voorbij de hoofdpagina: één kleine tip per scherm, de eerste
// keer dat je er komt.
//
// Bewust geen stappen-carrousel zoals de grote Tour: een scherm legt zichzelf
// uit zodra je erin staat, en één zin die op het juiste moment verschijnt leert
// meer dan vijf dia's vooraf. Weggetikt = weg, per scherm onthouden, en de
// grote Tour op de hoofdpagina blijft gewoon bestaan.
import { useState } from "react";
import { X } from "lucide-react";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

const SLEUTEL = (id: string) => `penneer.tip.${id}`;

export function SchermTip({ id, tekst }: { id: string; tekst: string }) {
  const [weg, setWeg] = useState(() => {
    try { return localStorage.getItem(SLEUTEL(id)) === "1"; } catch { return true; }
  });
  if (weg) return null;
  const sluit = () => {
    try { localStorage.setItem(SLEUTEL(id), "1"); } catch { /* prima */ }
    setWeg(true);
  };
  return (
    <div
      className="pop-in"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "10px 12px",
        borderRadius: 14,
        // Goudglas, iets voller dan een gewone kaart: een tip mag heel even
        // opvallen, daarna is hij weg.
        background: `linear-gradient(180deg, ${withAlpha(colors.gold, 0.14)}, ${withAlpha(colors.gold, 0.07)})`,
        border: `1px solid ${withAlpha(colors.gold, 0.4)}`,
        boxShadow: `inset 0 1px 0 ${withAlpha("#FFEBB8", 0.25)}`,
      }}
    >
      {/* De lamp uit de UI-map, niet de lijn-versie van lucide: een tip is een
          klein cadeautje en mag er zo uitzien. */}
      <img src="/ui/lamp.webp?v=1" alt="" width={18} height={18} style={{ flexShrink: 0, marginTop: 1, objectFit: "contain" }} />
      <p style={{ flex: 1, margin: 0, fontFamily: font.ui, fontSize: 12.5, lineHeight: 1.45, color: colors.ink }}>{tekst}</p>
      <button
        onClick={() => { sound.uiTap(); sluit(); }}
        aria-label="Sluiten"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 1, flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
