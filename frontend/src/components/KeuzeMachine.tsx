// De keuzemachine van Waag het: incasseren of doorgaan.
//
// De plaat komt uit de mockup. Wat eruit is gehaald:
//   - de LETTERS (KIES JE OPTIE, IN DE POT, 20, INCASSEER 20, DOORGAAN). Die
//     komen er live overheen, want ze zijn tweetalig en het bedrag verandert
//     elke ronde. De banner en het scherm zijn hersteld door de band tussen
//     schone randen te interpoleren, de twee knopbollen met een genormaliseerde
//     vervaging: het gemiddelde van alleen de bekende pixels over een straal die
//     ruim groter is dan de letter. Een bol is laagfrequent, dus wat je
//     terugkrijgt is precies de welving.
//   - het ZWART eromheen. De machine heeft een alfakanaal: de gloed blijft, de
//     achtergrond valt weg, en de binnenkant (het scherm is zelf bijna zwart)
//     staat hard op ondoorzichtig via een vulling vanaf de beeldrand.
//
// De drie vlakken zijn OPGEMETEN op de plaat (de gouden lijst van de banner, de
// paarse neonlijst van het scherm, de tint van de bollen) en staan hier als deel
// van de afbeelding. Ze schalen mee, want alle maten worden uit de gemeten
// breedte gerekend en niet uit vaste pixels.
import { useEffect, useRef, useState } from "react";
import { colors, font } from "../theme/tokens";

const ART = "/ui/waaghet-machine.webp";
/** Verhouding van de plaat (1466x1003 na het uitsnijden). */
const VERHOUDING = 1466 / 1003;

/** Waar de weggehaalde tekst stond, als deel van de plaat.
 *  banner  x 420..1005  y 155..238   (binnenkant van de gouden lijst)
 *  scherm  x 296..1143  y 296..481   (binnenkant van de paarse neonlijst)
 *  bollen  hart op (435, 648) en (986, 648), vlak 240 x 203 */
const VLAK = {
  banner: { l: 420 / 1466, r: 1005 / 1466, t: 155 / 1003, b: 238 / 1003 },
  scherm: { l: 296 / 1466, r: 1143 / 1466, t: 296 / 1003, b: 481 / 1003 },
  bol: { b: 240 / 1466, h: 203 / 1003, y: 648 / 1003, groen: 435 / 1466, rood: 986 / 1466 },
} as const;

/** Lettergroottes als deel van de BREEDTE van de machine. Niet overgenomen uit
 *  de mockup: die is 1466 breed en op een telefoon staat de machine op ~380, dus
 *  de maten van de mockup zouden hier onleesbaar klein uitvallen. */
const MAAT = { titel: 0.037, potKop: 0.026, potGetal: 0.082, bolKlein: 0.042, bolGetal: 0.058, bolWoord: 0.045 } as const;

/** Goud met een verloop, geknipt op de letter. Geen text-shadow erbij: die
 *  wordt over het geknipte verloop heen getekend en maakt het vuil. */
function Goud({ maat, spatie = 0.5, children }: { maat: number; spatie?: number; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: font.display, fontWeight: 800, fontSize: maat, letterSpacing: spatie,
        lineHeight: 1, whiteSpace: "nowrap",
        backgroundImage: "linear-gradient(180deg,#FFF6D2 0%,#FFD983 42%,#E7A63A 74%,#F6DD8A 100%)",
        WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
      }}
    >
      {children}
    </span>
  );
}

function Bol({ links, breed, hoog, label, onClick }: {
  links: number; breed: number; hoog: number; label: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="pressable"
      style={{
        position: "absolute",
        left: `${links * 100}%`, top: `${VLAK.bol.y * 100}%`,
        width: breed, height: hoog, transform: "translate(-50%,-50%)",
        display: "grid", placeItems: "center",
        border: "none", background: "transparent", padding: 0, cursor: "pointer",
        borderRadius: "50%",
      }}
    >
      {label}
    </button>
  );
}

export function KeuzeMachine({ titel, potKop, pot, pakKort, doorKort, onPak, onDoor }: {
  /** Op de banner. */
  titel: string;
  /** Boven het bedrag in het scherm. */
  potKop: string;
  pot: number;
  /** Op de groene bol, boven het bedrag. */
  pakKort: string;
  /** Op de rode bol. */
  doorKort: string;
  onPak: () => void;
  onDoor: () => void;
}) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [breed, setBreed] = useState(360);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setBreed(el.getBoundingClientRect().width || 360);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bedrag = String(pot);
  // Een pot van vier cijfers of meer past niet op dezelfde maat als "20".
  const krimp = bedrag.length >= 4 ? 0.76 : 1;
  const bolBreed = breed * VLAK.bol.b;
  // De hoogte gaat DOOR de verhouding en niet er maal: het vlak is een deel van
  // de hoogte van de plaat, en die is breed/VERHOUDING. Maal in plaats van deel
  // maakt het tikvlak ruim twee keer te hoog, en dan ligt de knop half over het
  // scherm erboven.
  const bolHoog = (breed / VERHOUDING) * VLAK.bol.h;

  return (
    <div
      ref={doos}
      className="waag-machine"
      style={{ position: "relative", width: "100%", aspectRatio: `${VERHOUDING}`, flexShrink: 0 }}
    >
      <img
        src={ART} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", maxWidth: "none" }}
      />

      {/* de banner */}
      <div
        style={{
          position: "absolute",
          left: `${VLAK.banner.l * 100}%`, right: `${(1 - VLAK.banner.r) * 100}%`,
          top: `${VLAK.banner.t * 100}%`, bottom: `${(1 - VLAK.banner.b) * 100}%`,
          display: "grid", placeItems: "center",
        }}
      >
        <Goud maat={breed * MAAT.titel} spatie={breed * 0.004}>{titel}</Goud>
      </div>

      {/* het scherm */}
      <div
        style={{
          position: "absolute",
          left: `${VLAK.scherm.l * 100}%`, right: `${(1 - VLAK.scherm.r) * 100}%`,
          top: `${VLAK.scherm.t * 100}%`, bottom: `${(1 - VLAK.scherm.b) * 100}%`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: breed * 0.012,
        }}
      >
        <span
          style={{
            fontFamily: font.display, fontWeight: 700, fontSize: breed * MAAT.potKop,
            letterSpacing: breed * 0.006, lineHeight: 1, whiteSpace: "nowrap",
            color: colors.ink, textTransform: "uppercase",
          }}
        >
          {potKop}
        </span>
        <Goud maat={breed * MAAT.potGetal} spatie={breed * 0.002}>{bedrag}</Goud>
      </div>

      {/* de twee bollen. De tekst is wit met een korte schaduw, zoals in de
          mockup: op een felgekleurde bol leest goud niet. */}
      <Bol
        links={VLAK.bol.groen} breed={bolBreed} hoog={bolHoog} onClick={onPak}
        label={
          <span style={{ display: "grid", justifyItems: "center", gap: breed * 0.004, textShadow: "0 2px 5px rgba(0,0,0,.55)" }}>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: breed * MAAT.bolKlein, letterSpacing: breed * 0.003, lineHeight: 1, color: "#FFFFFF" }}>
              {pakKort}
            </span>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: breed * MAAT.bolGetal * krimp, lineHeight: 1, color: "#FFFFFF" }}>
              {bedrag}
            </span>
          </span>
        }
      />
      <Bol
        links={VLAK.bol.rood} breed={bolBreed} hoog={bolHoog} onClick={onDoor}
        label={
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: breed * MAAT.bolWoord, letterSpacing: breed * 0.003, lineHeight: 1, color: "#FFFFFF", textShadow: "0 2px 5px rgba(0,0,0,.55)" }}>
            {doorKort}
          </span>
        }
      />
    </div>
  );
}
