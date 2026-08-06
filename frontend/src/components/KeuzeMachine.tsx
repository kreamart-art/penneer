// De keuzemachine van Waag het: incasseren of doorgaan.
//
// De plaat komt uit de mockup (de tweede, op 3072 breed). Wat eruit is gehaald:
//   - de LETTERS (KIES JE OPTIE, IN DE POT, 20, INCASSEER 20, DOORGAAN). Die
//     komen er live overheen, want ze zijn tweetalig en het bedrag verandert
//     elke ronde. De banner is hersteld door de band tussen schone randen per
//     KOLOM te interpoleren (verticaal verloop met horizontale strepen), het
//     scherm per RIJ (dan blijft het verloop van donker naar minder donker
//     staan), en de twee knopbollen met een genormaliseerde vervaging: het
//     gemiddelde van alleen de bekende pixels over een straal die ruim groter
//     is dan de letter. Een bol is laagfrequent, dus wat je terugkrijgt is
//     precies de welving. Dat masker loopt binnen een ELLIPS om het hart van de
//     bol; over het hele vierkant liep de gouden rand mee en stond er daarna een
//     rechthoek om de knop.
// Het alfakanaal zat al in deze plaat, dus die is alleen uitgesneden op wat er
// werkelijk staat, met de gloed erbij.
//
// De vlakken zijn OPGEMETEN op de plaat (de gouden lijst van de banner, de
// paarse neonlijst van het scherm, de tint van de bollen) en staan hier als deel
// van de afbeelding. Ze schalen mee, want alle maten worden uit de gemeten
// breedte gerekend en niet uit vaste pixels.
import { useEffect, useRef, useState } from "react";
import { colors, font } from "../theme/tokens";

/** ?v= erbij omdat /ui/ cache-first in de service worker staat: zonder nieuwe
 *  URL houdt een geïnstalleerde app de oude plaat vast. */
const ART = "/ui/waaghet-machine.webp?v=3";
/** Verhouding van de plaat (2939x1945 na het uitsnijden). */
const VERHOUDING = 2939 / 1945;

/** Waar de weggehaalde tekst stond, als deel van de plaat. In de coördinaten van
 *  de uitsnede (de bron is links 87 en boven 2 afgesneden):
 *    banner  x 863..2023  y 304..479    binnenkant van de gouden lijst
 *    scherm  x 603..2293  y 588..963    binnenkant van de paarse neonlijst
 *    bollen  hart op (885, 1319) en (1988, 1319), vlak 490 x 450 */
const VLAK = {
  banner: { l: 863 / 2939, r: 2023 / 2939, t: 304 / 1945, b: 479 / 1945 },
  scherm: { l: 603 / 2939, r: 2293 / 2939, t: 588 / 1945, b: 963 / 1945 },
  bol: { b: 490 / 2939, h: 450 / 1945, y: 1319 / 1945, groen: 885 / 2939, rood: 1988 / 2939 },
} as const;

/** Maten als deel van de BREEDTE van de machine. Niet overgenomen uit de mockup:
 *  die is 2939 breed en op een telefoon staat de machine op ~360, dus de maten
 *  van de mockup zouden hier onleesbaar klein uitvallen. */
/** De schaduw van de main page (de tegels op Landing), zodat de cijfers hier
 *  net zo op hun ondergrond liggen als daar. */
const SCHADUW = "0 2px 6px rgba(0,0,0,.65), 0 0 14px rgba(0,0,0,.5)";

const MAAT = { titel: 0.037, potKop: 0.026, potGetal: 0.082, bolGetal: 0.075 } as const;
/** Hoe ver de twee bollen naar achteren staan, in graden. Opgemeten aan de
 *  gouden ring om de knop: die is in het echt rond en op de plaat een ellips. */
const KANTEL = 16;

/** Goud met een verloop, geknipt op de letter.
 *
 *  De schaduw kan er NIET als text-shadow bij: die wordt over het geknipte
 *  verloop heen getekend en maakt het goud vuil. Hij komt daarom als tweede,
 *  ONZICHTBARE kopie eronder te liggen: zelfde letters, kleur transparant, en
 *  alleen zijn text-shadow is te zien. Geen filter, want `drop-shadow` rastert
 *  op iOS apart en zet dan de rechthoek van die laag over je element heen. */
function Goud({ maat, spatie = 0.5, schaduw = false, children }: {
  maat: number; spatie?: number; schaduw?: boolean; children: React.ReactNode;
}) {
  const letters: React.CSSProperties = {
    fontFamily: font.display, fontWeight: 800, fontSize: maat, letterSpacing: spatie,
    lineHeight: 1, whiteSpace: "nowrap",
  };
  const goud: React.CSSProperties = {
    ...letters,
    backgroundImage: "linear-gradient(180deg,#FFF6D2 0%,#FFD983 42%,#E7A63A 74%,#F6DD8A 100%)",
    WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
  };
  if (!schaduw) return <span style={goud}>{children}</span>;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span aria-hidden style={{ ...letters, position: "absolute", left: 0, top: 0, color: "transparent", textShadow: SCHADUW }}>
        {children}
      </span>
      <span style={{ ...goud, position: "relative" }}>{children}</span>
    </span>
  );
}

/** Een bol. Geen woord en geen teken erop, alleen een BEDRAG: de bol is een
 *  zesde van de plaat, dus op een telefoon zestig punten breed, en daar past
 *  "INCASSEER" niet op. Met de twee bedragen naast elkaar staat de hele keuze er
 *  ook zonder woorden: groen is wat je zeker hebt, rood is wat het wordt als je
 *  doorgaat. De kleur zegt de rest. */
function Bol({ links, breed, hoog, maat, bedrag, onClick, label }: {
  links: number; breed: number; hoog: number; /** lettergrootte, uit de breedte van de MACHINE */ maat: number;
  bedrag: string; onClick: () => void; label: string;
}) {
  // Vier cijfers passen niet op dezelfde maat als twee.
  const krimp = bedrag.length >= 5 ? 0.62 : bedrag.length === 4 ? 0.76 : 1;
  return (
    <button
      onClick={onClick}
      aria-label={label}
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
      <span
        style={{
          fontFamily: font.display, fontWeight: 800, fontSize: maat * krimp,
          lineHeight: 1, color: "#FFFFFF",
          // Een schaduw ONDER het getal en niet eromheen: hij hoort te lezen als
          // licht dat van boven komt, niet als een waas achter de cijfers.
          textShadow: `0 ${(maat * 0.11).toFixed(1)}px ${(maat * 0.16).toFixed(1)}px rgba(0,0,0,.6)`,
          // De bollen staan een slag naar achteren gekanteld. Een getal dat
          // kaarsrecht op het scherm staat ligt daardoor niet OP de knop maar
          // ervoor. Vandaar dezelfde kanteling: de perspectiefafstand loopt mee
          // met de maat, anders klopt de verkorting alleen op één schermbreedte.
          // De opwaartse schuif is een OOGCORRECTIE: op het rekenkundige hart
          // van het groene vlak leest het getal als te laag, want de onderste
          // helft van de bol vangt het licht en de gouden rand zit daar vlak
          // onder. Zeven procent van de bolhoogte is genoeg.
          transform: `perspective(${breed * 0.62}px) translateY(${-(hoog * 0.07).toFixed(2)}px) rotateX(${KANTEL}deg)`,
          transformOrigin: "center",
        }}
      >
        {bedrag}
      </span>
    </button>
  );
}

export function KeuzeMachine({ titel, potKop, pot, volgende, pakLabel, doorLabel, onPak, onDoor }: {
  /** Op de banner. */
  titel: string;
  /** Boven het bedrag in het scherm. */
  potKop: string;
  /** Wat er nu ligt: op het scherm en op de groene bol. */
  pot: number;
  /** Wat het wordt als je doorgaat: op de rode bol. */
  volgende: number;
  /** Alleen voor schermlezers; op de bol staat een bedrag. */
  pakLabel: string;
  doorLabel: string;
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

  const bolBreed = breed * VLAK.bol.b;
  // De hoogte gaat DOOR de verhouding en niet er maal: het vlak is een deel van
  // de HOOGTE van de plaat, en die is breed/VERHOUDING. Maal in plaats van deel
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

      {/* het scherm. Label en bedrag staan op de hoogte waar ze in de mockup
          stonden en niet netjes gecentreerd: "IN DE POT" hoort dichter op het
          getal te zitten dan op de bovenrand. Gemeten op de bron: het label op
          17,3% van de binnenkant en het getal op 60%. */}
      <div
        style={{
          position: "absolute",
          left: `${VLAK.scherm.l * 100}%`, right: `${(1 - VLAK.scherm.r) * 100}%`,
          top: `${VLAK.scherm.t * 100}%`, bottom: `${(1 - VLAK.scherm.b) * 100}%`,
        }}
      >
        <span
          style={{
            position: "absolute", left: 0, right: 0, top: "17.3%",
            transform: "translateY(-50%)", textAlign: "center",
            fontFamily: font.display, fontWeight: 700, fontSize: breed * MAAT.potKop,
            letterSpacing: breed * 0.006, lineHeight: 1, whiteSpace: "nowrap",
            color: colors.ink, textTransform: "uppercase",
          }}
        >
          {potKop}
        </span>
        <div style={{ position: "absolute", left: 0, right: 0, top: "60%", transform: "translateY(-50%)", textAlign: "center" }}>
          <Goud maat={breed * MAAT.potGetal} spatie={breed * 0.002} schaduw>{pot}</Goud>
        </div>
      </div>

      <Bol links={VLAK.bol.groen} breed={bolBreed} hoog={bolHoog} maat={breed * MAAT.bolGetal} bedrag={String(pot)} label={pakLabel} onClick={onPak} />
      <Bol links={VLAK.bol.rood} breed={bolBreed} hoog={bolHoog} maat={breed * MAAT.bolGetal} bedrag={String(volgende)} label={doorLabel} onClick={onDoor} />
    </div>
  );
}
