// REKENLADDER, het arenaspel van zondag. Speelbare testversie achter ?reken in
// de url (eigen brok, dus wie hem niet opent downloadt hem ook niet).
//
// HET SPEL is een ladder van sommen. Elke trede is zwaarder dan de vorige en de
// klok zakt mee. Eén fout en het is meteen voorbij: geen levens, geen tweede
// kans. Dat staat ook zo op de tegel, en het is precies wat de spanning maakt.
// Bij Kleurenklem heb je drie levens en durf je te gokken; hier kost een gok je
// je hele poging, dus je rekent liever door tot je het zeker weet, terwijl de
// klok loopt.
//
// VIER ANTWOORDEN en geen invoerveld. Op een telefoon met een klok van drie
// seconden is een cijferpaneel geen rekentest maar een typtest, en dan meet je
// duimen in plaats van hoofdrekenen. De afleiders zijn daarom nooit willekeurig:
// het net-verkeerde antwoord (eentje ernaast), de omgekeerde bewerking en het
// getal met de cijfers omgedraaid. Wie de som overslaat en gokt heeft een op
// vier, en dat overleeft geen ladder van tien treden.
//
// DE LADDER loopt van optellen tot twee bewerkingen achter elkaar. Zie
// trapVoor(): welke soorten sommen er mogen komen, hoe groot de getallen zijn
// en hoeveel tijd je krijgt.
//
// CEILINGLOOS: er is geen laatste trede. De ladder houdt op met zwaarder worden
// (de klok stopt bij drie seconden en de getallen bij hun maximum), maar hij
// houdt niet op met tellen, en de PUNTEN blijven wel klimmen: trede k is k keer
// zoveel waard als trede 1. Zo lopen de scores ver uiteen, precies wat de
// arenaregel vraagt, en is de dertigste trede echt iets anders dan de
// vijfentwintigste.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Timer } from "lucide-react";
import { Screen } from "../components/Layout";
import { KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { colors, font, withAlpha } from "../theme/tokens";
import { sound } from "../sound/sound";
import { useT } from "../i18n/i18n";
import { VAK } from "./Arena";
import { Scorebord } from "../components/Scorebord";
import { Hulpbalk } from "../components/Hulpbalk";

// ---- de ladder --------------------------------------------------------------
//
// Drie knoppen lopen op: WELKE bewerkingen er mogen komen, hoe GROOT de
// getallen zijn, en hoeveel TIJD je krijgt. Ze lopen expres niet gelijk op:
// een nieuwe soort som komt nooit in dezelfde trede als een sprong in de klok,
// want twee klappen tegelijk is precies waar een ladder te steil wordt.
export type Soort = "plus" | "min" | "keer" | "deel" | "twee";
export type Trap = { soorten: Soort[]; groot: number; venster: number };

/** De klok: TWINTIG SECONDEN op elke trede.
 *
 *  Hij liep af van negen naar drie seconden, en dat was te scherp: niet iedereen
 *  rekent even snel, en dan meet je reactiesnelheid in plaats van rekenen.
 *
 *  Dat de klok niet meer krimpt maakt de ladder niet vlak, want de steiging zit
 *  in de sommen zelf. Zie trapVoor: er komt een bewerking bij op trede 3, 6, 10
 *  en 14, en de getallen springen van tien naar veertig. En snel zijn loont nog
 *  steeds, alleen niet meer om te overleven: de helft van de punten van een
 *  trede hangt aan de tijd die je overhoudt.
 *
 *  Moet gelijk lopen met REKENLADDER_VENSTER in backend/app/arena.py; staat het
 *  daar anders, dan keurt de server een eerlijke poging af. */
export function vensterVoor(_trede: number): number {
  return 20000;
}

export function trapVoor(trede: number): Trap {
  const k = Math.max(1, trede);
  // De soorten komen er een voor een bij, met genoeg treden ertussen om aan de
  // vorige te wennen.
  const soorten: Soort[] = ["plus"];
  if (k >= 3) soorten.push("min");
  if (k >= 6) soorten.push("keer");
  if (k >= 10) soorten.push("deel");
  if (k >= 14) soorten.push("twee");
  // De getallen groeien in stappen en niet vloeiend: een sprong die je ziet
  // aankomen voelt als een nieuwe trede, een die per som een beetje schuift
  // voelt als willekeur.
  const groot = k <= 2 ? 10 : k <= 5 ? 20 : k <= 9 ? 12 : k <= 13 ? 20 : k <= 20 ? 25 : 40;
  return { soorten, groot, venster: vensterVoor(k) };
}

/** Wat een goede trede oplevert: honderd maal de trede, plus de helft daarvan
 *  naar rato van de tijd die je overhield. Trede 1 is dus 100 tot 150 en trede
 *  20 is 2000 tot 3000.
 *
 *  Maal de trede en niet vast, en dat is met opzet: bij een vaste waarde per
 *  som is de score gewoon "hoe lang deed je mee" en liggen twee spelers die
 *  allebei ver komen dicht bij elkaar. Zo is doorgaan op trede 20 twintig keer
 *  zoveel waard als de eerste, lopen de eindstanden ver uiteen en bestaan
 *  gelijke standen bijna niet. Dat is arenaregel 1. */
export const puntenVoor = (trede: number, rest: number) =>
  100 * trede + Math.round(50 * trede * Math.max(0, Math.min(1, rest)));

// ---- seed en generator ------------------------------------------------------
function maakRng(seed: string): () => number {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (Math.imul(a, 31) + seed.charCodeAt(i)) | 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Som = { vraag: string; antwoord: number; keuzes: number[] };

/** Eén som voor deze trede, plus vier antwoorden.
 *
 *  De afleiders zijn NOOIT willekeurige getallen. Een willekeurig getal valt
 *  meteen af zonder dat je de som hoeft te maken, en dan is de vraag alleen nog
 *  "welke is niet raar". Deze drie lijken alle drie op een antwoord dat je zelf
 *  had kunnen krijgen:
 *    1. eentje ernaast (de klassieke telfout)
 *    2. de ANDERE bewerking op dezelfde getallen (plus in plaats van keer)
 *    3. de cijfers omgedraaid, of anders een tiental ernaast
 *  Wie de som echt maakt heeft er geen last van; wie hem overslaat wel.
 */
export function maakSom(seed: string, trap: Trap): Som {
  const rng = maakRng(seed);
  const pak = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const tot = (n: number) => 1 + Math.floor(rng() * n);

  const soort = pak(trap.soorten);
  let vraag = "";
  let antwoord = 0;
  let anders = 0; // de andere bewerking op dezelfde getallen

  if (soort === "plus") {
    const a = tot(trap.groot), b = tot(trap.groot);
    vraag = `${a} + ${b}`; antwoord = a + b; anders = Math.abs(a - b);
  } else if (soort === "min") {
    const a = tot(trap.groot), b = tot(a); // nooit onder nul: dat is een ander spel
    vraag = `${a} − ${b}`; antwoord = a - b; anders = a + b;
  } else if (soort === "keer") {
    const a = tot(trap.groot), b = tot(10);
    vraag = `${a} × ${b}`; antwoord = a * b; anders = a + b;
  } else if (soort === "deel") {
    const b = 1 + Math.floor(rng() * 9);
    const uit = tot(trap.groot);
    const a = b * uit;                      // altijd heel: een rest is hier ruis
    vraag = `${a} : ${b}`; antwoord = uit; anders = a - b;
  } else {
    const a = tot(10), b = tot(10), c = tot(9);
    vraag = `${a} + ${b} × ${c}`; antwoord = a + b * c; anders = (a + b) * c; // wie links naar rechts rekent
  }

  const kandidaten = [
    antwoord + (rng() < 0.5 ? 1 : -1),
    anders,
    antwoord + (rng() < 0.5 ? 10 : -10),
    antwoord + (rng() < 0.5 ? 2 : -2),
  ];
  const keuzes: number[] = [antwoord];
  for (const k of kandidaten) {
    if (keuzes.length >= 4) break;
    if (k >= 0 && !keuzes.includes(k)) keuzes.push(k);
  }
  // Vangnet: sommen met kleine getallen kunnen te weinig bruikbare afleiders
  // opleveren (nul en dubbelen vallen af). Dan schuiven we op tot er vier zijn.
  let d = 3;
  while (keuzes.length < 4) {
    if (!keuzes.includes(antwoord + d)) keuzes.push(antwoord + d);
    d += 1;
  }
  for (let j = keuzes.length - 1; j > 0; j--) {
    const i = Math.floor(rng() * (j + 1));
    [keuzes[j], keuzes[i]] = [keuzes[i], keuzes[j]];
  }
  return { vraag, antwoord, keuzes };
}

const versSleutel = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function startTrede(): number {
  if (typeof location === "undefined") return 1;
  const n = Number(new URLSearchParams(location.search).get("reken"));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

// ---- de ladder --------------------------------------------------------------
//
// DRIE LADDERS, EEN LADDER. De art kwam als drie hele ladders: paars, groen en
// rood. Die kun je niet als drie plaatjes wisselen, want dan kleurt de hele
// ladder mee terwijl er maar EEN trede is aangetikt.
//
// Ze zijn gelukkig pixel voor pixel dezelfde tekening: het alfakanaal van de
// drie verschilt exact 0, alleen de kleuren eronder lopen uiteen. Daarom is de
// ladder hier in vier stroken geknipt, op dezelfde coordinaten uit alle drie de
// bestanden, en heeft elke trede zijn eigen paarse, groene en rode versie.
//
// De KNIPLIJNEN zijn opgemeten en niet gegokt: er is per rij geteld hoeveel
// pixels er tussen de vier ladders verschillen, en de knip ligt op de RUSTIGSTE
// rij. Dat is nodig omdat de gloed van een plaat op de gouden stijlen valt en
// die gloed meekleurt; snijd je daar doorheen, dan zie je een streep waar het
// groen ophoudt. Uit de bron: y 675 en y 1202 verschillen 5 pixels (praktisch
// stil), y 1822 is met 165 het minimum van zijn strook en die zitten op de
// stijlen.
//
// Elke trede stapelt zijn drie versies en laat er ALTIJD maar een zien. Een
// halfdoorzichtige gloed over een andere halfdoorzichtige gloed geeft namelijk
// niet dezelfde kleur als de tekenaar bedoelde: het groen komt dan over het
// paars te liggen in plaats van ervoor in de plaats. Alleen TIJDENS de overgang
// is dat mengen precies wat je wil, want dat is wat een crossfade is.
const LADDER_B = 1100;  // de maat waarop alles is opgemeten
const LADDER_H = 733;

// WAAR DE LADDER STAAT. In de zaal-art zitten twee paarse meetpuntjes die de
// bovenhoeken van de ladder markeren, opgemeten op (1150,9, 2070,9) en
// (2927,1, 2070,3) van een doek van 4096. Daaruit volgt alles:
//   breedte = 1776,2 / 4096 = 43,36% van de zaalbreedte
//   bovenkant = 2070,6 / 4096 = 50,55% van de zaalhoogte
// Controle: met die maat lopen de poten tot y 3254, en het schaduwvlak dat in de
// art is bijgetekend ligt op y 3155-3325. De ladder staat dus precies in zijn
// eigen schaduw.
//
// De zaal staat op 195,8% van de SCHERMBREEDTE (zie index.css: dat is het
// telefoonkader uit de mockup, 2092 van 4096 breed). Eén zaalpixel is dus
// schermbreedte/2092, en daarmee is alles in vw uit te drukken:
//   breedte = 1776,2 / 2092 = 84,90% van de schermbreedte
// De zaal is bovenaan verankerd en heeft 442 rijen doorgetrokken plafond boven
// de tekening, dus het puntje zit (442 + 2070,6)/2092 = 120,11vw onder de
// schermrand.
const LADDER_BREED = 84.90;      // vw
// Waar hij verticaal landt bepaalt de kolom; de MAAT komt uit de puntjes.
// De puntjes zelf zijn gereedschap en geen decor; die zijn uit de zaal gepoetst.

/** Per trede: waar de strook zit in de ladder, en waar het VLAK van de plaat
 *  zit in die strook. Het vlak is het tikbare deel en de plek van het getal;
 *  daarbuiten liggen de stijlen en de gloed, waar een tik niet hoort te tellen.
 *  Alles in procenten, want de ladder schaalt mee met de schermbreedte. */
// De vakken zijn opgemeten op de GEKNIPTE stroken zoals ze in de app zitten, en
// niet overgenomen uit de oude art: die was 788 breed en de getallen stonden
// daardoor per trede een stukje links of rechts van het midden. De platen zelf
// liggen netjes op het hart van de ladder (548, 549, 549,5 en 551 op een ladder
// van 1100), dus als de vakken kloppen staan de getallen vanzelf onder elkaar.
const TREDEN = [
  { band: [0, 174], vlak: [101, 25, 995, 165] },
  { band: [174, 337], vlak: [104, 195, 994, 336] },
  { band: [337, 528], vlak: [99, 362, 1000, 507] },
  { band: [528, 733], vlak: [95, 537, 1007, 679] },
].map(({ band, vlak }) => ({
  top: (band[0] / LADDER_H) * 100,
  bodem: ((LADDER_H - band[1]) / LADDER_H) * 100,
  // Het vlak zit in de STROOK, dus de hoogtes gaan door de bandhoogte.
  vlak: {
    left: (vlak[0] / LADDER_B) * 100,
    breed: ((vlak[2] - vlak[0]) / LADDER_B) * 100,
    top: ((vlak[1] - band[0]) / (band[1] - band[0])) * 100,
    hoog: ((vlak[3] - vlak[1]) / (band[1] - band[0])) * 100,
  },
}));

// DE GOUDEN KNOPPEN komen als EEN vel, niet als vier losse knopjes. Ze zijn
// getekend bij deze ladder, dus de tekenaar heeft ze al op hun plek gezet; zelf
// vier keer een plek uitrekenen zet ze onvermijdelijk net iets schever dan
// bedoeld, en dat was ook precies wat er gebeurde.
//
// Het vel staat op 1,8850 keer het ladderbestand, met -363 in de hoogte en -156
// in de breedte. Dat is geen aanname maar een fit: de vier knopharten komen
// daarmee op 96,3 / 263,3 / 433,9 / 608,0 uit, tegen plaatmiddens van 96,5 /
// 265,5 / 436 / 607,5. Twee pixels ernaast op een ladder van 733 hoog.
//
// Omgerekend naar de maat van de ladder in de app beslaat het vel dit, met een
// tikje naar binnen (2,1% van de ladderbreedte) zodat de schijven op de stijl
// staan in plaats van ernaast.
const KNOPPEN = { links: -3.01, top: 3.48, breed: 16.76, hoog: 91.47 };
// En dit zijn de harten van de vier schijven daarin, met hun doorsnee, allemaal
// in procenten van de ladder. De letters gaan daar bovenop.
// De drie hulpen onder de ladder. De icoontjes komen uit de art (gesneden uit
// `Powerup icoontjes.png`) en niet uit een lijnenpakket: ze horen bij het goud en
// paars van de rest, en dat krijg je met een streekicoon niet voor elkaar.
//
// GEEN PRIJS. Je koopt deze hulpen niet: de eerste twee krijg je, de rest verdien
// je in de dagronde-league, de ranglijsten en de missies. Wat er staat is dus wat
// je HEBT. Dat is ook wat het bord eerlijk houdt: een ladder zonder plafond waar
// je hulp kunt bijkopen is geen ladder maar een kassa.
const HULP_ART: Record<string, string> = {
  vriend: "/ui/reken/hulp-vriend.webp",
  ververs: "/ui/reken/hulp-ververs.webp",
  vijftig: "/ui/reken/hulp-vijftig.webp",
};

function HulpIcoon({ sleutel }: { sleutel: string }) {
  return (
    <img
      src={HULP_ART[sleutel]}
      alt=""
      draggable={false}
      style={{ width: 36, height: 36, display: "block", flexShrink: 0 }}
    />
  );
}

const HULPEN = [
  { sleutel: "vriend", label: "HULPLIJN", icoon: <HulpIcoon sleutel="vriend" /> },
  { sleutel: "ververs", label: "VERVERS", icoon: <HulpIcoon sleutel="ververs" /> },
  { sleutel: "vijftig", label: "50 / 50", icoon: <HulpIcoon sleutel="vijftig" /> },
];

// De harten van de vier schijven en hun doorsnee, in procenten van de ladder.
//
// OPGEMETEN in knoppen.webp (200x727) en niet met de hand geplaatst. Per schijf
// is de evenaar gezocht (de breedste regel van het alfakanaal) en het midden
// daarvan; de schijven blijken rond te zijn, want de hoogte die uit die
// symmetrie volgt komt op een pixel na uit op de gemeten breedte:
//
//   A (113,25 / 77,0) d 84    C ( 92,70 / 442,0) d 92
//   B (103,44 / 257,5) d 90   D ( 82,62 / 629,5) d 95
//
// Nagegaan is ook of het LETTERVAK (de verzonken kant binnen de gouden rand)
// wel om datzelfde hart ligt en niet naar het licht toe verschoven staat. Dat
// ligt goed: het zwaartepunt ervan valt binnen anderhalve pixel op het hart.
//
// Daarna omgerekend met de plaatsing van het vel (KNOPPEN).
const LETTERS = [
  { letter: "A", x: 6.48, y: 13.17, d: 7.04 },
  { letter: "B", x: 5.66, y: 35.88, d: 7.54 },
  { letter: "C", x: 4.76, y: 59.09, d: 7.71 },
  { letter: "D", x: 3.91, y: 82.68, d: 7.96 },
];

type Staat = "uit" | "rust" | "goed" | "fout" | "dood";
/** Wat er van een beurt bekend is. `gekozen` is null als de klok het deed en
 *  niet de speler: dan is er geen trede die rood hoort te worden. */
type Oordeel = { gekozen: number | null; goed: boolean } | null;

/** Een trede. De drie versies liggen op elkaar en alleen de huidige staat op
 *  vol; de andere twee staan op nul en faden mee. Zo is de overgang een echte
 *  kruisfade en niet een sprong, en zie je in rust nooit twee kleuren door
 *  elkaar. */
function Trede({ i, waarde, staat, onKies, tip = false }: { i: number; waarde: number; staat: Staat; onKies: () => void; tip?: boolean }) {
  const t = TREDEN[i];
  const kleur = staat === "goed" ? "goed" : staat === "fout" ? "fout" : staat === "uit" ? "uit" : "rust";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: `${t.top}%`, bottom: `${t.bodem}%` }}>
      {(["uit", "rust", "goed", "fout"] as const).map((k) => (
        <img
          key={k}
          src={`/ui/reken/trede${i + 1}-${k}.webp`}
          alt=""
          draggable={false}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
            opacity: k === kleur ? 1 : 0,
            transition: "opacity .22s ease-out",
            pointerEvents: "none",
          }}
        />
      ))}
      {/* De flits. Een kruisfade tussen paars en groen gaat door een modderige
          middenkleur; een korte lichtflits op datzelfde moment dekt dat toe, en
          je leest een klap in plaats van een menging. */}
      {(staat === "goed" || staat === "fout") && (
        <span
          key={staat}
          className="reken-flits"
          style={{
            position: "absolute",
            left: `${t.vlak.left}%`, width: `${t.vlak.breed}%`,
            top: `${t.vlak.top}%`, height: `${t.vlak.hoog}%`,
            borderRadius: 14, pointerEvents: "none",
            background: staat === "goed"
              ? "radial-gradient(60% 120% at 50% 50%, rgba(190,255,205,.85), rgba(60,230,120,0) 70%)"
              : "radial-gradient(60% 120% at 50% 50%, rgba(255,205,195,.85), rgba(255,80,60,0) 70%)",
          }}
        />
      )}
      {/* De violette lichtlijn over de bovenrand van de plaat. In de art is die
          lijn crème; in de mockup gloeit hij paars. Twee streken: een vervaagde
          eronder voor de gloed en een scherpe erop. Alleen zolang de trede
          leeft, want op een dode of gekleurde plaat hoort geen paars licht. */}
      {(staat === "rust" || staat === "uit") && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: `${t.vlak.left + 1.5}%`, width: `${t.vlak.breed - 3}%`,
            top: `${t.vlak.top}%`, height: 2,
            pointerEvents: "none",
            opacity: staat === "uit" ? 0.45 : 1,
            background: "linear-gradient(90deg, rgba(190,120,255,0) 0%, #D9A8FF 18%, #F6E8FF 50%, #D9A8FF 82%, rgba(190,120,255,0) 100%)",
            boxShadow: "0 0 7px rgba(190,110,255,.95), 0 0 16px rgba(150,70,230,.6)",
            transition: "opacity .22s ease-out",
          }}
        />
      )}
      <button
        onPointerDown={(e) => { e.preventDefault(); if (staat === "rust") onKies(); }}
        disabled={staat !== "rust"}
        style={{
          position: "absolute",
          left: `${t.vlak.left}%`, width: `${t.vlak.breed}%`,
          top: `${t.vlak.top}%`, height: `${t.vlak.hoog}%`,
          border: "none", background: "transparent", padding: 0,
          cursor: staat === "rust" ? "pointer" : "default",
          WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
          display: "grid", placeItems: "center",
          fontFamily: font.display, fontWeight: 800, fontSize: 34, letterSpacing: 1,
          color: "#FFF6DC",
          opacity: staat === "uit" ? 0 : staat === "dood" ? 0.4 : 1,
          transform: staat === "goed" ? "scale(1.06)" : "scale(1)",
          transition: "opacity .22s ease-out, transform .22s ease-out",
          // De tip van je vriend: een gouden gloed om het getal, geen pijl of
          // vinkje. Het is een hint en geen antwoordblad.
          textShadow: tip
            ? "0 0 10px rgba(255,214,120,.95), 0 0 22px rgba(255,190,60,.7), 0 2px 6px rgba(0,0,0,.75)"
            : "0 2px 6px rgba(0,0,0,.75), 0 0 14px rgba(0,0,0,.5)",
        }}
      >
        {waarde}
      </button>
    </div>
  );
}

/** De hele ladder: vier stroken die precies op elkaar aansluiten. De stroken
 *  worden met top EN bodem vastgezet en niet met een hoogte, want dan rekent de
 *  browser de onderrand van de ene en de bovenrand van de volgende uit hetzelfde
 *  getal en valt er nooit een haarlijn tussen. */
function Ladder({ keuzes, antwoord, oordeel, onKies, slapend, klaar, weg = [], tip = null }: {
  keuzes: number[];
  antwoord: number;
  oordeel: Oordeel;
  onKies: (w: number) => void;
  /** Door 50/50 weggehaald: dof en niet meer aan te tikken. */
  weg?: number[];
  /** Wat de vriend aanwijst: die trede krijgt een gouden randje. */
  tip?: number | null;
  /** Tijdens het aftellen: de ladder staat er wel, maar uit en zonder getallen.
   *  Je ziet waar het gaat gebeuren zonder alvast te kunnen rekenen, en het
   *  scherm springt niet in elkaar op het moment dat de eerste som komt. */
  slapend?: boolean;
  /** Na afloop: blijft staan zoals hij eindigde, maar niets doet nog wat. */
  klaar?: boolean;
}) {
  return (
    // In de KOLOM en niet vast aan het scherm. Vast leek logisch omdat de zaal
    // ook vastzit, maar dan hangt de ladder aan de layout-viewport terwijl je
    // hem ziet in de visuele: zodra de adresbalk meedoet staat hij ergens waar
    // je niet bij kunt, en dan kun je het spel niet spelen. De maat blijft wel
    // uit de meetpuntjes komen.
    <div style={{ position: "relative", width: `${LADDER_BREED}vw`, aspectRatio: `${LADDER_B} / ${LADDER_H}`, flexShrink: 0 }}>
      {keuzes.map((w, i) => (
        <Trede
          key={i}
          i={i}
          waarde={w}
          staat={
            slapend ? "uit"
            : weg.includes(w) ? "dood"
            : !oordeel ? (klaar ? "dood" : "rust")
            // Het JUISTE antwoord wordt altijd groen, ook als je het niet koos:
            // je moet kunnen zien wat het was, anders leer je niets van je
            // laatste trede. Rood is alleen voor de trede die JIJ aantikte, en
            // bij een tijdopname is dat er geen: dan blijft alles dof op het
            // groene antwoord na.
            : w === antwoord ? "goed"
            : w === oordeel.gekozen ? "fout"
            : "dood"
          }
          onKies={() => onKies(w)}
          tip={tip === w}
        />
      ))}
      {/* Het knoppenvel gaat OVER de treden heen en niet eronder. Stond het
          ervoor, dan tekende de ladder er overheen en zag je alleen het randje
          dat links uitstak: dan lijkt het alsof de knoppen aan de ladder hangen
          in plaats van erop zitten. */}
      <img
        src="/ui/reken/knoppen.webp"
        alt=""
        draggable={false}
        style={{
          position: "absolute", pointerEvents: "none",
          left: `${KNOPPEN.links}%`, top: `${KNOPPEN.top}%`,
          width: `${KNOPPEN.breed}%`, height: `${KNOPPEN.hoog}%`,
        }}
      />
      {LETTERS.map((l) => (
        <span
          key={l.letter}
          style={{
            position: "absolute", pointerEvents: "none",
            left: `${l.x}%`, top: `${l.y}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: font.display, fontWeight: 800,
            fontSize: `${((LADDER_BREED * l.d) / 100) * 0.56}vw`,
            // GEEN letterspatie. Er stond 0,5, en die spatie komt ook achter de
            // letter te staan en telt mee in de breedte: bij een vertaling van
            // -50% zet dat de letter een kwart pixel links van het hart. Op een
            // los teken doet tracking bovendien niets nuttigs.
            color: "#FFE8B4", textShadow: "0 1px 2px rgba(0,0,0,.95), 0 0 6px rgba(255,190,90,.5)",
          }}
        >
          {l.letter}
        </span>
      ))}
    </div>
  );
}


// ---- het vraagpaneel --------------------------------------------------------
//
// Eigen kader in plaats van de geleende soep-platen. Alles is code: een gouden
// verlooprand met een afsnijding op de hoeken, een tab die over de bovenrand
// heen valt met de naam van het spel erin, en daarbinnen het somvak met zijn
// eigen dunnere lijn. De klok ligt onderin als balk met een tellertje ernaast,
// want een balk zegt HOEVER en een getal zegt HOEVEEL, en met een klok van drie
// seconden wil je allebei weten.
// De sectie is smaller dan de ladder: die twee zijn niet even breed in de
// mockup, en een vraagpaneel dat even breed is als het speelveld trekt de
// aandacht naar de verkeerde helft van het scherm.
// De ladder is 84,90vw breed en zijn BOVENkant 970/1100 daarvan = 74,9vw. De
// sectie staat daar net iets boven, maar blijft onder de volle ladderbreedte:
// even breed als het speelveld trekt de aandacht naar de verkeerde helft.
const SECTIE = "81.9vw";
const VIOLET = "#B36BFF";
const VIOLET_LICHT = "#E3B8FF";
const ROOD = "#FF5A4E";
const ROOD_LICHT = "#FFB0A6";

/** Twee kleuren mengen. In hex en niet in rgb(), want withAlpha() leest alleen
 *  hex; geef je hem rgb(), dan komt er rgba(NaN,...) uit en gooit de browser het
 *  hele verloop weg zonder een kik. */
function meng(van: string, naar: string, deel: number): string {
  const t = Math.max(0, Math.min(1, deel));
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(van), p(naar)];
  const k = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${a.map((v, i) => k(v + (b[i] - v) * t)).join("")}`;
}
const donkerder = (hex: string, deel: number) => meng(hex, "#000000", 1 - deel);

// De sectie en het somvak zijn ART geworden, dus de svg-verven die hier stonden
// (het goud, de blauwe kern, de vullingen, de gloedfilters) hebben geen tekening
// meer om op te zetten. Ze zijn met NeonPad en achthoek mee verdwenen. Wat er nu
// nog in code staat is de klokbalk, en die tekent zijn eigen kleuren.

/** Het kader van de sectie. Dit is ART en geen getekend pad meer.
 *
 *  Het vel is `sectie-lijn.webp`: één gouden lijn met een violette gloed en een
 *  kristalpil die er bovenuit steekt. Het stond op puur zwart, en licht op zwart
 *  is voorvermenigvuldigd (wat je ziet is kleur maal alfa), dus het hoogste
 *  kanaal IS de alfa en delen door die alfa geeft de kleur terug. De naamplaat
 *  is daarbij ondoorzichtig gemaakt: hij draagt de naam, daar mag de zaal niet
 *  doorheen schijnen.
 *
 *  De VULLING zit niet in de art maar in een eigen laag met `sectie-vlak.webp`
 *  als masker. Zo blijft de kleur van de sectie in CSS te kiezen zonder dat er
 *  een nieuw plaatje aan te pas komt, en volgt hij toch precies de binnenkant
 *  van de lijn, tot en met de schouders onder de pil.
 *
 *  Alle maten hieronder zijn OPGEMETEN in het vel, want er zit lucht omheen (de
 *  gloed) en de pil steekt boven de lijn uit. De sectie IS de lijndoos; het vel
 *  hangt daar met negatieve marges omheen.
 */
const SECTIE_ART = {
  vel: { b: 3824, h: 2046 },
  lijn: { l: 8, r: 3816, t: 189, o: 2025 },    // waar de gouden lijn loopt
  plaat: { l: 1333, r: 2486, t: 40, o: 249 },  // de binnenkant van de naamplaat
};

/** En hetzelfde voor het somvak, `som-vak.webp`. Dat vel kwam WEL op wit
 *  platgeslagen binnen: waargenomen = kunst maal alfa plus 255 maal (1 min
 *  alfa). Photoshop laat dat niet zien want dat leest alleen het alfakanaal,
 *  maar een browser mengt de RGB eronder wel mee en dan zie je een witte rand.
 *  Teruggerekend en daarna pas verkleind. */
const SOM_ART = {
  vel: { b: 3896, h: 912 },
  lijn: { l: 9, r: 3886, t: 15, o: 893 },
};

/** Het vel op zijn lijndoos leggen: de doos IS het element, het vel hangt er met
 *  negatieve marges omheen. Zo staat de gouden lijn precies op de rand van het
 *  vak, wat er ook aan gloed of uitsteeksel omheen zit. */
function velOp(art: { vel: { b: number; h: number }; lijn: { l: number; r: number; t: number; o: number } }) {
  const LB = art.lijn.r - art.lijn.l;
  const LH = art.lijn.o - art.lijn.t;
  return {
    LB, LH,
    bd: (v: number) => `${((v / LB) * 100).toFixed(4)}%`,
    hd: (v: number) => `${((v / LH) * 100).toFixed(4)}%`,
    laag: {
      left: `${((-art.lijn.l / LB) * 100).toFixed(4)}%`,
      top: `${((-art.lijn.t / LH) * 100).toFixed(4)}%`,
      width: `${((art.vel.b / LB) * 100).toFixed(4)}%`,
      height: `${((art.vel.h / LH) * 100).toFixed(4)}%`,
    } as const,
  };
}

/** De vulling van de sectie. Eén regel, want dit is precies wat er nog gekozen
 *  moet worden. Nu zwart op 19 tot 23 procent, zoals het getekende kader had. */
const SECTIE_VUL = "linear-gradient(180deg, rgba(0,0,0,.19) 0%, rgba(0,0,0,.21) 55%, rgba(0,0,0,.23) 100%)";

/** De letterspatie van de naam op de plaat. De spatie komt ook ACHTER de laatste
 *  letter te staan en telt mee in de breedte, dus zonder de negatieve marge
 *  hieronder staat het woord een halve spatie te ver links op de plaat. */
const NAAM_SPATIE = 2.2;

function TabKader({ titel, children }: { titel: string; children: React.ReactNode }) {
  const A = SECTIE_ART;
  const { LB, LH, bd, hd, laag: vel } = velOp(A);
  const masker = "url(/ui/reken/sectie-vlak.webp?v=2)";
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${LB} / ${LH}` }}>
      <span
        aria-hidden
        style={{
          position: "absolute", ...vel, pointerEvents: "none", background: SECTIE_VUL,
          WebkitMaskImage: masker, maskImage: masker,
          WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        }}
      />
      <img
        src="/ui/reken/sectie-lijn.webp?v=2"
        alt=""
        aria-hidden
        draggable={false}
        style={{ position: "absolute", ...vel, maxWidth: "none", pointerEvents: "none", display: "block" }}
      />
      <span
        style={{
          position: "absolute",
          left: bd(A.plaat.l - A.lijn.l), width: bd(A.plaat.r - A.plaat.l),
          top: hd(A.plaat.t - A.lijn.t), height: hd(A.plaat.o - A.plaat.t),
          display: "grid", placeItems: "center", pointerEvents: "none",
          fontFamily: font.wide, fontSize: 11, letterSpacing: NAAM_SPATIE, textTransform: "uppercase",
          color: "#FFD98A", textShadow: "0 0 10px rgba(255,180,50,.55)",
        }}
      >
        <span style={{ marginRight: -NAAM_SPATIE, whiteSpace: "nowrap" }}>{titel}</span>
      </span>
      {/* De inhoud staat BINNEN de lijndoos, en LAGER dan het midden. Gelijk
          verdeeld gaf boven en onder allebei 12,7, maar de naamplaat hangt vijf
          pixels over de bovenlijst heen: dan is er boven nog maar 7,6 tot de
          plaat en onder 12,7 tot de lijn, en dat leest scheef. Vandaar boven
          meer dan onder; optisch staat het dan midden in het vak. */}
      <div
        style={{
          position: "absolute", inset: 0, padding: "19px 16px 6px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 3,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** De klokbalk: een spoor met een violette vulling die leegloopt, met het
 *  stopwatchje ervoor en de seconden erachter in een ring. De ring loopt mee
 *  leeg, dus je ziet hetzelfde tweemaal maar op twee schalen: de balk voor de
 *  grote lijn, de ring voor de laatste tellen. */
function Klokbalk({ rest, seconden }: { rest: number; seconden: number }) {
  const r = Math.max(0, Math.min(1, rest));
  // Geen omslagpunt maar een VERLOOP. Een balk die op 28 procent ineens rood
  // wordt leest als een storing; een die geleidelijk warmer wordt leest als tijd
  // die opraakt. Hij begint te kleuren op 70 procent en is op nul helemaal rood.
  const hitte = Math.max(0, Math.min(1, (0.7 - r) / 0.7));
  const kleur = meng(VIOLET, ROOD, hitte);
  const licht = meng(VIOLET_LICHT, ROOD_LICHT, hitte);
  const omtrek = 2 * Math.PI * 15;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <Timer size={19} strokeWidth={1.8} color={licht} style={{ flexShrink: 0, filter: `drop-shadow(0 0 5px ${withAlpha(kleur, 0.7)})` }} />
      {/* De goot is neon: een donkere kern met een gekleurde lijn eromheen en een
          gloed eronder, in dezelfde kleur als de balk. Zo hoort de lege helft bij
          de volle in plaats van dat het een grijze rest is. */}
      <span
        style={{
          position: "relative", flex: 1, height: 11, borderRadius: 999,
          background: "rgba(4,1,12,.72)",
          boxShadow: `inset 0 0 0 1px ${withAlpha(kleur, 0.55)}, inset 0 2px 5px rgba(0,0,0,.6), 0 0 10px ${withAlpha(kleur, 0.3)}`,
        }}
      >
        <span
          style={{
            position: "absolute", inset: 1, right: "auto",
            width: `calc(${r * 100}% - 2px)`,
            borderRadius: 999,
            // Licht bovenin, kleur in het midden, donker onderin: dat leest als
            // een ronde buis en niet als een gekleurde reep.
            background: `linear-gradient(180deg, ${licht} 0%, ${kleur} 46%, ${donkerder(kleur, 0.62)} 100%)`,
            boxShadow: `0 0 12px ${withAlpha(kleur, 0.7)}, 0 0 3px ${withAlpha(licht, 0.9)}`,
            transition: "background .3s linear",
          }}
        />
      </span>
      {/* De ring loopt tegen de klok in leeg, zoals een echte aftelling, en
          krijgt dezelfde neonbehandeling: een vervaagde kopie eronder voor de
          gloed en een lichte kern erop. */}
      <span style={{ position: "relative", width: 38, height: 38, flexShrink: 0, display: "grid", placeItems: "center" }}>
        <svg width="38" height="38" viewBox="0 0 38 38" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", overflow: "visible" }} aria-hidden>
          <circle cx="19" cy="19" r="15" fill="none" stroke="rgba(4,1,12,.72)" strokeWidth="3.4" />
          <circle cx="19" cy="19" r="15" fill="none" stroke={withAlpha(kleur, 0.5)} strokeWidth="1" />
          <circle
            cx="19" cy="19" r="15" fill="none" stroke={kleur} strokeWidth="4.4" strokeLinecap="round"
            strokeDasharray={omtrek} strokeDashoffset={omtrek * (1 - r)}
            opacity="0.5" style={{ filter: "blur(3px)" }}
          />
          <circle
            cx="19" cy="19" r="15" fill="none" stroke={kleur} strokeWidth="3.2" strokeLinecap="round"
            strokeDasharray={omtrek} strokeDashoffset={omtrek * (1 - r)}
          />
          <circle
            cx="19" cy="19" r="15" fill="none" stroke={licht} strokeWidth="1.1" strokeLinecap="round"
            strokeDasharray={omtrek} strokeDashoffset={omtrek * (1 - r)}
          />
        </svg>
        <span style={{ position: "relative", fontFamily: font.display, fontWeight: 800, fontSize: 15, color: "#FFF3D0", fontVariantNumeric: "tabular-nums" }}>{seconden}</span>
      </span>
    </div>
  );
}

/** Het vak met de som erin. Ook ART: `som-vak.webp`, dezelfde afsnijding als het
 *  kader eromheen maar een slag kleiner en een slag donkerder, zodat het erin
 *  ligt in plaats van erop.
 *
 *  Het vel is PLATTER dan het getekende vak dat hier stond (4,42 tegen ongeveer
 *  3,5 breed op hoog). Dat is precies de bedoeling: het somvak was te hoog en
 *  duwde "GEVALLEN OP TREDE 1" tegen de bovenlijst aan. De hoogte volgt nu uit
 *  de verhouding van het vel, dus daar valt niets meer aan te verschuiven.
 *
 *  Het getal krijgt GEEN eigen hoogte meer maar wordt in het vak gecentreerd.
 *  Een vaste hoogte plus een lettergrootte die per fase verschilt (48 voor de
 *  som, 58 voor het aftellen) is twee maten die tegen elkaar in werken. */
function SomVenster({ children }: { children: React.ReactNode }) {
  const { LB, LH, laag: vel } = velOp(SOM_ART);
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${LB} / ${LH}`, flexShrink: 0 }}>
      <img
        src="/ui/reken/som-vak.webp?v=1"
        alt=""
        aria-hidden
        draggable={false}
        style={{ position: "absolute", ...vel, maxWidth: "none", pointerEvents: "none", display: "block" }}
      />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// ---- het spel ---------------------------------------------------------------
//
// Twee schillen om dezelfde motor, net als bij Lettersoep en Kleurenklem. De
// arena geeft de seed van de poging mee en krijgt via `onKlaar` de uitslag
// terug; de testversie hieronder geeft een eigen sleutel en levert NIETS in.
export function Rekenladder({ seed, onKlaar, onOpnieuw }: {
  seed: string;
  onKlaar?: (score: number, level: number, timeMs: number) => void;
  onOpnieuw?: () => void;
}) {
  const { t } = useT();
  useEffect(() => {
    document.body.classList.add("rekenspel");
    return () => document.body.classList.remove("rekenspel");
  }, []);

  const potje = seed;
  // `?reken=12` alleen in de testversie; in de arena zou het een trede opleveren
  // die je niet geklommen hebt.
  const [trede, setTrede] = useState(() => (onKlaar ? 1 : startTrede()));
  const [totaal, setTotaal] = useState(0);
  const [rest, setRest] = useState(1);
  const [oordeel, setOordeel] = useState<Oordeel>(null);
  const [fase, setFase] = useState<"tel" | "spel" | "klaar">("tel");
  const [tel, setTel] = useState(3);
  // De hulpen. Elk EEN keer per poging: dat is de rem. Zonder die rem is een
  // ladder zonder plafond geen ladder meer maar een kassa, want dan koop je je
  // eindeloos naar boven.
  const [gebruikt, setGebruikt] = useState<string[]>([]);
  // De voorraad. Tot de opslag er is krijgt iedereen de twee gratis hulpen en
  // staat de derde op nul, zodat je meteen ziet hoe een lege tegel oogt.
  const [voorraad, setVoorraad] = useState<Record<string, number>>({ vriend: 1, ververs: 1, vijftig: 0 });
  const [vers, setVers] = useState(0);      // ververs-teller, zit in de seed
  const [weg, setWeg] = useState<number[]>([]);   // door 50/50 weggehaald
  const [tip, setTip] = useState<number | null>(null); // wat de vriend aanwijst

  const trap = useMemo(() => trapVoor(trede), [trede]);
  const som = useMemo(() => maakSom(`${potje}:${trede}:${vers}`, trap), [potje, trede, trap, vers]);

  const t0 = useRef(performance.now());
  const ingeleverd = useRef(false);
  useEffect(() => {
    if (fase !== "klaar" || !onKlaar || ingeleverd.current) return;
    ingeleverd.current = true;
    onKlaar(totaal, trede, Math.round(performance.now() - t0.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);
  useEffect(() => {
    if (fase === "spel") t0.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase === "spel"]);

  const timers = useRef<number[]>([]);
  const na = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    if (fase !== "tel") return;
    const id = window.setInterval(() => {
      setTel((n) => {
        if (n <= 1) { setFase("spel"); return 3; }
        return n - 1;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [fase]);

  // Of deze trede al beantwoord is. Een ref en geen state, want de klok leest
  // hem in een animatielus en die mag daar niet op herstarten.
  const beslist = useRef(false);

  const mis = useCallback((gekozen: number | null) => {
    if (beslist.current) return;
    beslist.current = true;
    sound.klemFout();
    setOordeel({ gekozen, goed: false });
    na(1100, () => setFase("klaar"));
  }, []);

  // De klok, op requestAnimationFrame en niet op een interval: bij drie seconden
  // is een stap van 1/60 het verschil tussen een balk die loopt en een die
  // springt.
  useEffect(() => {
    if (fase !== "spel") return;
    beslist.current = false;
    setRest(1);
    const start = performance.now();
    let vraag = 0;
    const stap = () => {
      const over = 1 - (performance.now() - start) / trap.venster;
      if (beslist.current) return;
      if (over <= 0) { setRest(0); mis(null); return; }
      setRest(over);
      vraag = requestAnimationFrame(stap);
    };
    vraag = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(vraag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potje, trede, fase, vers]);

  const kies = useCallback((w: number) => {
    if (beslist.current || fase !== "spel") return;
    if (w !== som.antwoord) { mis(w); return; }
    beslist.current = true;
    sound.klemGoed();
    setOordeel({ gekozen: w, goed: true });
    setTotaal((t) => t + puntenVoor(trede, rest));
    // Elke vijfde trede een eigen klank: een mijlpaal, geen tweede geluid bij
    // elke goede som.
    if (trede % 5 === 0) sound.reeks();
    na(420, () => { setOordeel(null); setWeg([]); setTip(null); setTrede((k) => k + 1); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, som, rest, trede, mis]);

  /** Een hulp inzetten. Alleen tijdens het spel en alleen als hij nog niet op
   *  is; het aftellen en het oordeel zijn geen moment om iets te kopen. */
  const hulp = useCallback((sleutel: string) => {
    if (fase !== "spel" || beslist.current || gebruikt.includes(sleutel)) return;
    if ((voorraad[sleutel] ?? 0) <= 0) return;
    setGebruikt((g) => [...g, sleutel]);
    setVoorraad((v) => ({ ...v, [sleutel]: Math.max(0, (v[sleutel] ?? 0) - 1) }));
    if (sleutel === "vijftig") {
      // Twee foute antwoorden weg. Uit de lijst zelf gekozen en niet willekeurig
      // door elkaar: zo blijft de volgorde staan en springt er niets.
      const fout = som.keuzes.filter((w) => w !== som.antwoord);
      setWeg(fout.slice(0, 2));
      sound.klemGoed();
    } else if (sleutel === "ververs") {
      // Een andere som op dezelfde trede, en de klok begint opnieuw. Dat laatste
      // hoort erbij: anders koop je een som die je toch niet meer haalt.
      setWeg([]);
      setTip(null);
      setVers((v) => v + 1);
      sound.woosh();
    } else if (sleutel === "vriend") {
      setTip(som.antwoord);
      sound.reeks();
    }
  }, [fase, gebruikt, som, voorraad]);

  const stop = () => setFase("klaar");

  return (
    <>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, paddingBottom: 24 }}>
        {/* De volgorde ligt vast: scorebord, de sectie, de ladder. En alle drie
            staan er in ELKE fase, ook als het spel al voorbij is. Onderdelen die
            per fase verschijnen en verdwijnen laten de rest verspringen, en op
            een spel waar je in drie tellen moet tikken is een scherm dat onder je
            duim opschuift geen detail maar een gemiste trede. */}
        <Scorebord
          breedte={VAK}
          links={{ kop: t("rekenTrede"), waarde: String(trede) }}
          rechts={{ kop: t("soepPunten"), waarde: String(totaal) }}
        />

        {/* Het vraagpaneel. Alles in code: een gouden verlooprand met een
            afsnijding op de hoeken, de naam op een tab die IN de bovenrand valt,
            het somvak erin met zijn eigen dunnere lijn, en onderin de klok als
            balk plus ring. */}
        <div style={{ width: SECTIE, marginTop: 12 }}>
          <TabKader titel="REKENLADDER">
            <span
              style={{
                height: 20, display: "grid", placeItems: "center",
                whiteSpace: "nowrap", lineHeight: 1,
                fontFamily: font.display, fontWeight: 800, fontSize: 15.5, letterSpacing: 0.4,
                color: "#FFFFFF", textShadow: "0 2px 6px rgba(0,0,0,.6)",
              }}
            >
              {fase === "klaar" ? `GEVALLEN OP TREDE ${trede}` : "WAT IS HET ANTWOORD?"}
            </span>

            <SomVenster>
              <span
                key={fase === "tel" ? `tel-${tel}` : `som-${trede}`}
                className="klem-kom"
                style={{
                  lineHeight: 1,
                  fontFamily: font.display, fontWeight: 800,
                  fontSize: fase === "tel" ? 58 : 48, letterSpacing: 2,
                  color: "#FFFFFF",
                  textShadow: "0 0 18px rgba(160,200,255,.35), 0 2px 4px rgba(0,0,0,.8)",
                }}
              >
                {fase === "klaar" ? totaal : fase === "tel" ? tel : som.vraag}
              </span>
            </SomVenster>

            {fase === "spel" ? (
              <Klokbalk rest={rest} seconden={Math.max(0, Math.ceil((rest * trap.venster) / 1000))} />
            ) : (
              // De hoogte blijft staan ook als er niets staat: de klok zit hier
              // tijdens het spel, en een vak dat leegloopt zou de ladder omhoog
              // trekken.
              <span style={{ height: 38, display: "grid", placeItems: "center", fontFamily: font.ui, fontSize: 12, color: withAlpha("#FFE7A8", 0.7) }}>
                {fase === "tel" ? "maak je klaar" : ""}
              </span>
            )}
          </TabKader>
        </div>

        {/* De vier antwoorden ZIJN de treden van de ladder. Tijdens het aftellen
            staat diezelfde ladder er al, maar dan uit: je ziet waar het gaat
            gebeuren zonder de getallen alvast te kunnen lezen. En na afloop
            blijft hij staan zoals hij eindigde, met je misgreep in het rood en
            het juiste antwoord in het groen. */}
        <Ladder
          keuzes={som.keuzes}
          antwoord={som.antwoord}
          oordeel={oordeel}
          onKies={kies}
          slapend={fase === "tel"}
          klaar={fase === "klaar"}
          weg={weg}
          tip={tip}
        />

        {/* De hulpbalk onder de ladder. Wat er staat is je VOORRAAD; de opslag
            ervan (en het verdienen in de league en de missies) moet nog. */}
        <div style={{ marginTop: 10 }}>
          <Hulpbalk
            hulpen={HULPEN.map((h) => ({ ...h, aantal: voorraad[h.sleutel] ?? 0 }))}
            breedte={`${LADDER_BREED}vw`}
            onKies={hulp}
            op={gebruikt}
          />
        </div>

        {(fase !== "klaar" || onOpnieuw) && (
        <div style={{ marginTop: 10 }}>
        <NeonKader radius={999} dik={0.5} vulling="zwart" animeer lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
          <button
            onClick={fase === "klaar" ? onOpnieuw : stop}
            className="pressable"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
          >
            <LogOut size={14} /> {fase === "klaar" ? "Opnieuw" : "Stoppen"}
          </button>
        </NeonKader>
        </div>
        )}
      </div>
    </>
  );
}

/** De testversie achter `?reken`: eigen kop, eigen sleutel, levert niets in. */
export function PreviewRekenladder() {
  const [potje, setPotje] = useState(versSleutel);
  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>Arena</span>
          <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, color: colors.redHi }}>testversie, telt niet mee</span>
        </div>
      }
    >
      <Rekenladder key={potje} seed={potje} onOpnieuw={() => setPotje(versSleutel())} />
    </Screen>
  );
}

export default PreviewRekenladder;
