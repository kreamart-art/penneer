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
import { sound } from "../sound/sound";
import { colors, font } from "../theme/tokens";

/** ?v= erbij omdat /ui/ cache-first in de service worker staat: zonder nieuwe
 *  URL houdt een geïnstalleerde app de oude plaat vast. */
const ART = "/ui/waaghet-machine.webp?v=4";
/** De twee bollen liggen los op de plaat, zodat ze kunnen indrukken. */
const BOL = { groen: "/ui/waag-bol-groen.webp", rood: "/ui/waag-bol-rood.webp" } as const;
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
  /** De uitgeknipte bollen, met de doos waarin ze uit de plaat zijn gehaald
   *  (groen 627,1081 en rood 1730,1081, allebei 517 x 477). */
  knip: {
    b: 517 / 2939, h: 477 / 1945, t: 1081 / 1945,
    groen: 627 / 2939, rood: 1730 / 2939,
  },
} as const;

/** Maten als deel van de BREEDTE van de machine. Niet overgenomen uit de mockup:
 *  die is 2939 breed en op een telefoon staat de machine op ~360, dus de maten
 *  van de mockup zouden hier onleesbaar klein uitvallen. */
/** De schaduw van de main page (de tegels op Landing), zodat de cijfers hier
 *  net zo op hun ondergrond liggen als daar. */
const SCHADUW = "0 2px 6px rgba(0,0,0,.65), 0 0 14px rgba(0,0,0,.5)";

const MAAT = { titel: 0.037, potKop: 0.026, potGetal: 0.082, woord: 0.036 } as const;

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

/** Een bol. Hij is uit de plaat GEKNIPT en ligt er als eigen plaatje bovenop;
 *  in de plaat staat op die plek een donkere holte. Daardoor kan hij echt
 *  indrukken: hij zakt in zijn eigen schaduw in plaats van over de originele bol
 *  heen te schuiven.
 *
 *  De klik loopt met een korte vertraging: doorgaan of incasseren haalt de hele
 *  machine weg, en zonder die tel zie je de knop nooit ingedrukt staan. */
function Bol({ vak, kunst, onClick, label }: {
  vak: { l: number; t: number; b: number; h: number }; kunst: string;
  onClick: () => void;
  /** voor schermlezers; het woord staat zichtbaar onder de machine */ label: string;
}) {
  const [gedrukt, setGedrukt] = useState(false);
  const bezig = useRef(false);
  const doe = () => {
    if (bezig.current) return;
    bezig.current = true;
    setGedrukt(true);
    sound.uiTap();
    window.setTimeout(onClick, 160);
  };
  return (
    <button
      aria-label={label}
      onPointerDown={() => setGedrukt(true)}
      onPointerUp={() => { if (!bezig.current) setGedrukt(false); }}
      onPointerCancel={() => { if (!bezig.current) setGedrukt(false); }}
      onPointerLeave={() => { if (!bezig.current) setGedrukt(false); }}
      onClick={doe}
      style={{
        position: "absolute",
        left: `${vak.l * 100}%`, top: `${vak.t * 100}%`,
        width: `${vak.b * 100}%`, height: `${vak.h * 100}%`,
        border: "none", background: "transparent", padding: 0, cursor: "pointer",
        WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
      }}
    >
      <img
        src={kunst} alt="" aria-hidden draggable={false}
        style={{
          width: "100%", height: "100%", display: "block", maxWidth: "none",
          transform: gedrukt ? "translateY(5%) scale(.985)" : "none",
          filter: gedrukt ? "brightness(.8)" : "none",
          transition: "transform .09s ease-out, filter .09s ease-out",
        }}
      />
    </button>
  );
}

/** Het woord onder de machine, in het hart van zijn eigen knop. Op de bol zelf
 *  past het niet: die is een zesde van de plaat en dus zestig punten breed. */
function Woord({ links, maat, kleur, children }: { links: number; maat: number; kleur: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        position: "absolute", left: `${links * 100}%`, top: "100%",
        transform: "translate(-50%, 2px)", whiteSpace: "nowrap",
        fontFamily: font.display, fontWeight: 700, fontSize: maat, letterSpacing: maat * 0.06,
        lineHeight: 1, color: kleur, textShadow: SCHADUW,
      }}
    >
      {children}
    </span>
  );
}

export function KeuzeMachine({ titel, potKop, pot, pakLabel, doorLabel, onPak, onDoor }: {
  /** Op de banner. */
  titel: string;
  /** Boven het bedrag in het scherm. */
  potKop: string;
  /** Wat er nu ligt. Staat in het scherm van de machine. */
  pot: number;
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

      {/* GROEN gaat door, ROOD stopt. Groen is overal "ga" en rood is overal
          "stop", en dat weegt zwaarder dan dat de groene knop het geld geeft:
          op een knop lees je eerst de kleur en pas daarna het getal. Op groen
          staat dus wat het WORDT, op rood wat je NU hebt. */}
      <Bol
        vak={{ l: VLAK.knip.groen, t: VLAK.knip.t, b: VLAK.knip.b, h: VLAK.knip.h }}
        kunst={BOL.groen} label={doorLabel} onClick={onDoor}
      />
      <Bol
        vak={{ l: VLAK.knip.rood, t: VLAK.knip.t, b: VLAK.knip.b, h: VLAK.knip.h }}
        kunst={BOL.rood} label={`${pakLabel} ${pot}`} onClick={onPak}
      />
      <Woord links={VLAK.bol.groen} maat={breed * MAAT.woord} kleur={colors.ink}>{doorLabel}</Woord>
      <Woord links={VLAK.bol.rood} maat={breed * MAAT.woord} kleur={colors.ink}>{pakLabel}</Woord>
    </div>
  );
}
