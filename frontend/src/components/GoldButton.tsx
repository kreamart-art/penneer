// De knopplaten uit de studio-art: goud voor de hoofdacties, paars voor de
// spelen-met-vrienden-kant ("Maak een room" en de rest van de primaire
// knoppen). De hero-TEGEL "Speel met vrienden" op de main page hoort er niet
// bij: dat is een vierkante tegel, geen balk, en die houdt zijn eigen goud.
//
// Beide bron-PNG's hebben ZELF al een alfakanaal; de assets zijn dus niets meer
// dan die PNG's bijgesneden op hun zichtbare pixels. (Bij de gouden ging ik er
// eerst met een kleurmasker overheen, omdat een viewer het bestand op grijs
// toonde en ik dacht dat het grijs erin zat. Dat masker maakte juist een wazige
// vorm die er niet hoorde te zijn. Open zo'n bestand altijd als RGBA en kijk
// naar het alfakanaal voordat je iets weg gaat knippen.)
//
// Twee dingen die voor allebei gelden:
//  - Het knopvak is niet de hele plaat maar zijn LICHTE BOVENVLAK. De donkere
//    3D-lip onderaan telt wel mee in de hoogte maar hoort niet bij het vlak waar
//    tekst op staat, dus door het vlak als vak te nemen staat de tekst vanzelf
//    gecentreerd, zonder correcties die verkeerd meeschalen.
//  - De plaat wordt niet uitgerekt: het vak neemt de verhouding van de plaat
//    over, dus de hoogte volgt uit de breedte. En omdat de gloed BUITEN de plaat
//    valt, is de knop iets smaller dan de ruimte, anders duwt die gloed zichzelf
//    van het scherm af.
//
// Alle getallen hieronder zijn uit de assets gemeten. Vervang je de art, meet
// dan opnieuw (bijsnijden op alfa > 8, dan het lichte vlak opmeten).
import { useState } from "react";
import { colors, font } from "../theme/tokens";

export type PlateKind = "gold" | "violet";

interface Plate {
  src: string;
  w: number;      // afmetingen van de asset
  h: number;
  fx: number;     // het lichte vlak binnen de asset
  fy: number;
  fw: number;
  fh: number;
  text: string;   // leesbare tekstkleur op deze plaat
  shine: string;  // subtiele highlight onder de letters
}

const PLATES: Record<PlateKind, Plate> = {
  gold: {
    src: "/btn-gold.webp",
    w: 760, h: 196,
    fx: 51, fy: 12, fw: 663, fh: 150,
    text: "#4A2E04",
    shine: "0 1px 0 rgba(255,240,190,.45)",
  },
  violet: {
    src: "/btn-violet.webp",
    w: 760, h: 228,
    fx: 52, fy: 18, fw: 682, fh: 156,
    text: colors.ink,
    shine: "0 1px 2px rgba(20,0,60,.5)",
  },
};

/** Alles wat uit de maten volgt: verhouding, gloedmarge, breedtegrenzen. */
function metrics(kind: PlateKind) {
  const p = PLATES[kind];
  const faceW = p.fw / p.w;
  const faceH = p.fh / p.h;
  const ratio = (p.w * faceW) / (p.h * faceH);
  return {
    plate: p,
    ratio,
    // De knop mag precies dit deel van de ruimte innemen; de rest is gloed.
    fit: `${(faceW * 100).toFixed(2)}%`,
    // Plafond, anders wordt de knop op een tablet een banier: de hoogte volgt
    // immers uit de breedte.
    maxWidth: 320,
    minWidth: Math.round(44 * ratio),
    img: {
      left: `${(-p.fx / p.fw) * 100}%`,
      width: `${(p.w / p.fw) * 100}%`,
      top: `${(-p.fy / p.fh) * 100}%`,
      height: `${(p.h / p.fh) * 100}%`,
    },
  };
}

export const GOLD = metrics("gold");
export const VIOLET = metrics("violet");
export const plateMetrics = (kind: PlateKind) => (kind === "gold" ? GOLD : VIOLET);

/** Breedte-regels voor een plaatknop op volle breedte. */
export function plateWidth(kind: PlateKind) {
  const m = plateMetrics(kind);
  return { width: `min(${m.fit}, ${m.maxWidth}px)`, marginLeft: "auto", marginRight: "auto" } as const;
}

/** Terugval als een asset niet laadt: dezelfde vorm in CSS, zodat er nooit een
 *  naamloze knop overblijft. */
export const PLATE_CHAMFER =
  "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)";

/** De plaat als laag over de knop heen. `onMissing` gaat af als het bestand er
 *  niet is, zodat de knop op de CSS-vorm kan terugvallen. */
export function PlateArt({ kind, onMissing }: { kind: PlateKind; onMissing: () => void }) {
  const m = plateMetrics(kind);
  return (
    <img
      src={m.plate.src}
      alt=""
      aria-hidden
      onError={onMissing}
      style={{
        position: "absolute",
        ...m.img,
        // De reset zet `max-width: 100%` op afbeeldingen; die knipte de plaat
        // terug naar knopbreedte, waardoor hij te klein en uit het midden stond.
        maxWidth: "none",
        pointerEvents: "none",
      }}
    />
  );
}

const LETTER_SPACING = 2.2;

/** De hero-variant: volle breedte, hoofdletters, voor de hoofdactie van een
 *  scherm (VASTLEGGEN in Duel). Gewone knoppen gaan via `Button`. */
export function GoldButton({
  label,
  onClick,
  disabled = false,
  kind = "gold",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  kind?: PlateKind;
}) {
  const [art, setArt] = useState(true);
  const m = plateMetrics(kind);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pressable"
      style={{
        position: "relative",
        ...(art ? plateWidth(kind) : { width: "100%" }),
        aspectRatio: art ? `${m.ratio}` : undefined,
        minHeight: art ? undefined : 54,
        border: "none",
        background: art ? "transparent" : colors.gold,
        clipPath: art ? undefined : PLATE_CHAMFER,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "grid",
        placeItems: "center",
        padding: 0,
      }}
    >
      {art && <PlateArt kind={kind} onMissing={() => setArt(false)} />}
      <span
        style={{
          position: "relative",
          fontFamily: font.display,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: LETTER_SPACING,
          textTransform: "uppercase",
          color: m.plate.text,
          textShadow: m.plate.shine,
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
