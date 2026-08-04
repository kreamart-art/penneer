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

// De vlakken zijn OPGEMETEN op de art en niet geschat: vanuit het hart naar
// buiten lopen tot de helderheid echt springt. Het binnenvlak is glad, de
// afschuining eromheen niet, dus die sprong is de rand.
const PLATES: Record<PlateKind, Plate> = {
  gold: {
    src: "/btn-gold.webp?v=2",
    w: 1000, h: 269,
    fx: 36, fy: 28, fw: 930, fh: 202,
    text: "#4A2E04",
    shine: "0 1px 0 rgba(255,240,190,.45)",
  },
  violet: {
    src: "/btn-violet.webp?v=2",
    w: 1000, h: 269,
    fx: 36, fy: 29, fw: 930, fh: 200,
    text: colors.ink,
    shine: "0 1px 2px rgba(20,0,60,.5)",
  },
};

// EEN gedeeld knopvak voor alle knoppen op volle breedte, plaat of niet. De twee
// platen hebben elk net een andere verhouding (goud 663x150 = 4.42, paars
// 682x156 = 4.37) en een andere gloedmarge; als je die ieder hun eigen maat
// geeft, staan een gouden en een paarse knop onder elkaar zichtbaar ongelijk.
// Daarom: één vak, en elke plaat legt zijn eigen VLAK daar overheen. De
// afwijking van ~1% die dat per plaat oplevert zie je niet.
//
// De breedte is die van de KRAPSTE plaat, zodat bij allebei de gloed er nog
// naast past in plaats van van het scherm af te lopen.
// Opgemeten op de nieuwe platen: het binnenvlak is 930x202 bij goud (4,604) en
// 930x200 bij paars (4,650). Het vak ligt daar precies tussenin, zodat geen van
// beide platen merkbaar rekt: goud een halve procent, paars een halve procent.
// Op 4,4 (de oude waarde) zou de nieuwe art er 4,5% te hoog uit komen te zien.
export const BUTTON_RATIO = 4.63;
// DE MAAT VAN DE KNOP. Er valt maar aan één ding te draaien: de BREEDTE. De
// hoogte volgt daaruit via BUTTON_RATIO, dus de knop schaalt altijd aan beide
// kanten tegelijk en de plaat rekt nooit.
//
// En die breedte komt van het OPSCHRIFT, niet van het scherm. Een vaste maat
// ging steeds van 320 naar 280 naar 220 en bleef te groot, want het probleem
// was niet het getal: op "Start het spel" vulde de tekst 107px van een plaat
// van 220, dus 113px stond leeg. Zo'n knop is geen knop meer maar een balk met
// een woord erin. Nu is de plaat de tekst plus zijn lucht: diezelfde knop is
// 159 breed en 34 hoog.
//
// BUTTON_MIN_WIDTH is alleen nog een bodem voor "Ja" of "OK", zodat een kort
// woord geen knopje wordt. Naar boven is er geen grens behalve de ruimte zelf:
// een lang opschrift maakt de knop breder in plaats van de tekst te breken.
//
// Het opschrift schaalt bewust NIET mee (vast getal in Button.tsx): de knop
// krimpt, de letters blijven leesbaar.
export const BUTTON_MIN_WIDTH = 150;

/** Breedte-regels die elke knop op volle breedte deelt. */
export const fullWidthButton = {
  width: "fit-content",
  minWidth: `min(100%, ${BUTTON_MIN_WIDTH}px)`,
  maxWidth: "100%",
  whiteSpace: "nowrap",
  aspectRatio: `${BUTTON_RATIO}`,
  // ANDERS REKT DE PLAAT ALSNOG. Een knop in een flex-kolom (elke popup, elk
  // paneel) krijgt van de browser `min-height: auto`, en die ondergrens is
  // hoger dan wat de verhouding wil: opgemeten 48px waar 39px hoorde, dus de
  // plaat werd 4,63 breed en 3,7 hoog getekend. Met 0 wint de verhouding en
  // blijft de art overal in proportie.
  minHeight: 0,
  marginLeft: "auto",
  marginRight: "auto",
} as const;

/** `compact`: een slag kleiner, voor een knop in een paneel met een vaste
 *  hoogte. Dit MOET onder BUTTON_MIN_WIDTH blijven, anders is "compact" juist
 *  de grootste knop op het scherm. Hij stond op 232 terwijl de gewone knop naar
 *  220 ging, en dat was precies waar de knop nog te groot uitzag. */
export const COMPACT_MIN_WIDTH = 120;
export const compactButton = {
  minWidth: `min(100%, ${COMPACT_MIN_WIDTH}px)`,
} as const;

/** Waar de plaat moet liggen zodat zijn LICHTE VLAK precies het knopvak vult. */
function metrics(kind: PlateKind) {
  const p = PLATES[kind];
  return {
    plate: p,
    img: {
      left: `${(-p.fx / p.fw) * 100}%`,
      width: `${(p.w / p.fw) * 100}%`,
      top: `${(-p.fy / p.fh) * 100}%`,
      height: `${(p.h / p.fh) * 100}%`,
    },
  };
}

const GOLD = metrics("gold");
const VIOLET = metrics("violet");
export const plateMetrics = (kind: PlateKind) => (kind === "gold" ? GOLD : VIOLET);

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
        ...fullWidthButton,
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
