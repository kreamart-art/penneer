// De gouden actieknop uit de studio-art, precies zoals hij in het bestand staat.
//
// De bron-PNG heeft ZELF al een alfakanaal; de asset is dus niets meer dan die
// PNG bijgesneden op zijn zichtbare pixels. (Eerder haalde ik er met een
// kleurmasker een uitsnede uit, omdat een viewer het bestand op grijs toonde en
// ik dacht dat het grijs erin zat. Dat masker maakte juist de wazige vorm die
// er niet hoorde te zijn. Open zo'n bestand altijd als RGBA en kijk naar het
// alfakanaal voordat je iets weg gaat knippen.)
//
// De plaat wordt NIET uitgerekt: de knop neemt de verhouding van de plaat over
// en de afbeelding ligt er onvervormd overheen. De getallen hieronder zijn uit
// de asset gemeten; vervang je de art, meet dan opnieuw.
import { useState } from "react";
import { colors, font } from "../theme/tokens";

const ASSET_W = 760;
const ASSET_H = 196;
const PLATE_W = 0.9513;   // deel van de assetbreedte dat de plaat is
const PLATE_H = 0.8418;   // idem in de hoogte

const PLATE_RATIO = (ASSET_W * PLATE_W) / (ASSET_H * PLATE_H); // breedte/hoogte van de plaat
const OVER_X = (1 / PLATE_W - 1) / 2;                          // gloedmarge links en rechts

// Terugval als de art niet laadt: dezelfde vorm in CSS, zodat er nooit een
// naamloze knop overblijft.
const CHAMFER =
  "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)";

export function GoldButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [art, setArt] = useState(true);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pressable"
      style={{
        position: "relative",
        width: "100%",
        // De knop volgt de verhouding van de plaat, dus de art hoeft nergens
        // voor te rekken.
        aspectRatio: art ? `${PLATE_RATIO}` : undefined,
        minHeight: art ? undefined : 54,
        border: "none",
        background: art
          ? "transparent"
          : `linear-gradient(180deg, #FFE08C 0%, ${colors.goldHi} 34%, ${colors.gold} 66%, #E29A1F 100%)`,
        clipPath: art ? undefined : CHAMFER,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "grid",
        placeItems: "center",
        padding: 0,
      }}
    >
      {art && (
        <img
          src="/btn-gold.webp"
          alt=""
          aria-hidden
          onError={() => setArt(false)}
          style={{
            position: "absolute",
            left: `${-OVER_X * 100}%`,
            width: `${(1 + OVER_X * 2) * 100}%`,
            height: "auto",          // nooit uitrekken: de hoogte volgt de breedte
            top: "50%",
            transform: "translateY(-50%)",
            // De reset zet `max-width: 100%` op afbeeldingen; die knipte de
            // plaat terug naar knopbreedte, waardoor hij te klein en uit het
            // midden stond.
            maxWidth: "none",
            pointerEvents: "none",
          }}
        />
      )}
      <span
        style={{
          position: "relative",
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: 2.2,
          textTransform: "uppercase",
          color: "#4A2E04",
          textShadow: "0 1px 0 rgba(255,240,190,.45)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
