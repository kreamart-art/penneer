// De gouden knopplaat uit de studio-art, gedeeld door ELKE gouden knop in het
// spel (de hero-tegel "Speel met vrienden" op de main page uitgezonderd: die is
// geen knop maar een tegel en houdt zijn eigen vlakke goud).
//
// De bron-PNG heeft ZELF al een alfakanaal; de asset is dus niets meer dan die
// PNG bijgesneden op zijn zichtbare pixels. (Eerder haalde ik er met een
// kleurmasker een uitsnede uit, omdat een viewer het bestand op grijs toonde en
// ik dacht dat het grijs erin zat. Dat masker maakte juist de wazige vorm die
// er niet hoorde te zijn. Open zo'n bestand altijd als RGBA en kijk naar het
// alfakanaal voordat je iets weg gaat knippen.)
//
// De plaat wordt NIET uitgerekt: elke gouden knop neemt de verhouding van de
// plaat over, dus de hoogte volgt uit de breedte. Een minimumbreedte zorgt dat
// een korte knop ("Terug") daardoor niet te laag wordt om te lezen.
//
// De getallen hieronder zijn uit de asset gemeten: welk deel ervan de scherpe
// plaat is, en dus hoeveel gloed er omheen zit. Vervang je de art, meet opnieuw.
import { useState } from "react";
import { colors, font } from "../theme/tokens";

const ASSET_W = 760;
const ASSET_H = 196;
// Het LICHTE BOVENVLAK van de plaat, gemeten in de asset: x 51-713, y 12-161.
// Dat vlak is waar de tekst op hoort te staan, dus DAT wordt het knopvak. De
// donkere 3D-lip onderaan en de gloed eromheen steken er buiten uit.
//
// Zo hoeft de tekst nergens voor gecorrigeerd te worden: hij staat gewoon in
// het midden van de knop, en dat midden IS het midden van het vlak. (Eerder
// schoof ik de tekst met een procentuele margin-top omhoog, maar procentuele
// marges rekenen tegen de BREEDTE van het element, niet de hoogte, dus die
// correctie schaalde volkomen verkeerd mee.)
const FACE_X = 51 / ASSET_W;
const FACE_Y = 12 / ASSET_H;
const FACE_W = 663 / ASSET_W;
const FACE_H = 150 / ASSET_H;

const LETTER_SPACING = 2.2;

/** Breedte/hoogte van het vlak: hier volgt de hoogte van elke gouden knop uit. */
export const GOLD_RATIO = (ASSET_W * FACE_W) / (ASSET_H * FACE_H);
/** Onder deze hoogte is een knop niet meer te lezen, dus dwingt hij zijn eigen
 *  breedte af in plaats van platter te worden. */
export const GOLD_MIN_WIDTH = Math.round(44 * GOLD_RATIO);

/** Terugval als de art niet laadt: dezelfde vorm in CSS, zodat er nooit een
 *  naamloze knop overblijft. */
export const GOLD_FALLBACK = {
  background: `linear-gradient(180deg, #FFE08C 0%, ${colors.goldHi} 34%, ${colors.gold} 66%, #E29A1F 100%)`,
  clipPath:
    "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
};

/** De plaat zelf, als laag over de knop heen. `onMissing` gaat af als het
 *  bestand er niet is, zodat de knop op de CSS-vorm kan terugvallen. */
export function GoldPlate({ onMissing }: { onMissing: () => void }) {
  return (
    <img
      src="/btn-gold.webp"
      alt=""
      aria-hidden
      onError={onMissing}
      style={{
        position: "absolute",
        left: `${(-FACE_X / FACE_W) * 100}%`,
        width: `${(1 / FACE_W) * 100}%`,
        top: `${(-FACE_Y / FACE_H) * 100}%`,
        height: `${(1 / FACE_H) * 100}%`,
        // De reset zet `max-width: 100%` op afbeeldingen; die knipte de plaat
        // terug naar knopbreedte, waardoor hij te klein en uit het midden stond.
        maxWidth: "none",
        pointerEvents: "none",
      }}
    />
  );
}

/** De hero-variant: volle breedte, hoofdletters, voor de hoofdactie van een
 *  scherm (VASTLEGGEN in Duel). Gewone gouden knoppen gaan via `Button`. */
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
        aspectRatio: art ? `${GOLD_RATIO}` : undefined,
        minHeight: art ? undefined : 54,
        border: "none",
        background: art ? "transparent" : GOLD_FALLBACK.background,
        clipPath: art ? undefined : GOLD_FALLBACK.clipPath,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "grid",
        placeItems: "center",
        padding: 0,
      }}
    >
      {art && <GoldPlate onMissing={() => setArt(false)} />}
      <span
        style={{
          position: "relative",
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: LETTER_SPACING,
          textTransform: "uppercase",
          color: "#4A2E04",
          textShadow: "0 1px 0 rgba(255,240,190,.45)",
          // letter-spacing zet ook ruimte NA de laatste letter, dus zonder dit
          // staat het woord optisch een halve spatie te ver naar links.
          marginLeft: LETTER_SPACING,
        }}
      >
        {label}
      </span>
    </button>
  );
}
