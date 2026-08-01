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
import { ARENA_GOUD, colors, font, withAlpha } from "../theme/tokens";
import { sound } from "../sound/sound";
import { useT } from "../i18n/i18n";
import { VAK } from "./Arena";
import { Scorebord, type Speler } from "../components/Scorebord";
import { Hulpbalk } from "../components/Hulpbalk";

// ---- de ladder --------------------------------------------------------------
//
// Drie knoppen lopen op: WELKE bewerkingen er mogen komen, hoe GROOT de
// getallen zijn, en hoeveel TIJD je krijgt. Ze lopen expres niet gelijk op:
// een nieuwe soort som komt nooit in dezelfde trede als een sprong in de klok,
// want twee klappen tegelijk is precies waar een ladder te steil wordt.
export type Soort = "plus" | "min" | "keer" | "deel" | "twee";
export type Trap = { soorten: Soort[]; groot: number; venster: number };

/** De klok van trede k. Begint royaal en zakt naar drie seconden; die bodem is
 *  bewust hoog, want onder de drie tellen is een som van twee bewerkingen geen
 *  rekenwerk meer maar een gok. Moet gelijk lopen met REKENLADDER_VENSTER in
 *  backend/app/arena.py. */
export function vensterVoor(trede: number): number {
  return Math.max(3000, 9000 - (Math.max(1, trede) - 1) * 400);
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
// De drie hulpen onder de ladder. De iconen zijn getekend en niet uit een pakket
// gehaald: ze moeten dezelfde lijndikte hebben als de rest van dit scherm.
const HULPEN = [
  {
    sleutel: "vriend", label: "VRIEND HULP", prijs: 10,
    icoon: (
      <svg width="17" height="14" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="5" r="3" />
        <path d="M1.6 14.4c.4-2.7 2.7-4.4 5.4-4.4s5 1.7 5.4 4.4" />
        <circle cx="14.6" cy="6" r="2.2" />
        <path d="M13 10.4c2.4-.5 4.7.9 5.4 3.4" />
      </svg>
    ),
  },
  {
    sleutel: "ververs", label: "VERVERS", prijs: 5,
    icoon: (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7.2" />
        <path d="M9 4.4l1.1 3.5 3.5 1.1-3.5 1.1L9 13.6l-1.1-3.5L4.4 9l3.5-1.1z" />
      </svg>
    ),
  },
  {
    sleutel: "vijftig", label: "50 / 50", prijs: 15,
    icoon: (
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7.2" />
        <path d="M13 4.6L5 13.4" />
        <text x="4.6" y="7.9" fontSize="4.6" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="700">50</text>
        <text x="8.6" y="14.2" fontSize="4.6" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="700">50</text>
      </svg>
    ),
  },
];

const LETTERS = [
  { letter: "A", x: 6.51, y: 13.14, d: 6.96 },
  { letter: "B", x: 5.69, y: 35.92, d: 7.41 },
  { letter: "C", x: 4.79, y: 59.20, d: 7.74 },
  { letter: "D", x: 3.95, y: 82.95, d: 8.11 },
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
            letterSpacing: 0.5,
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

/** De verven voor de lijnen. Eén keer per svg neerzetten; wie ze twee keer
 *  neerzet krijgt dubbele id's en dan pakt de browser er willekeurig een. */
function Verven() {
  return (
    <defs>
      {/* Hetzelfde goud als KADER_LIJN_GOUD, maar als svg-verloop, zodat het
          een streek kan volgen die geen rechthoek is. */}
      {/* Hetzelfde goud als de ladder en de scoreplaat: opgemeten uit de art,
          niet gekozen. Zie ARENA_GOUD in theme/tokens.ts. */}
      <linearGradient id="rl-goud" x1="0" y1="0" x2="1" y2="0.8">
        <stop offset="0%" stopColor={ARENA_GOUD[0]} />
        <stop offset="14%" stopColor={ARENA_GOUD[1]} />
        {/* Waar het goud vroeger dof bruin werd, gloeit het nu koper. Een
            donkere plek in een neonlijn hoort niet dood te zijn maar alleen
            verder weg, en warm goud dat wegzakt IS oranje. */}
        <stop offset="30%" stopColor={ARENA_GOUD[2]} />
        <stop offset="50%" stopColor={ARENA_GOUD[0]} />
        <stop offset="68%" stopColor="#FF9A2E" />
        <stop offset="84%" stopColor={ARENA_GOUD[4]} />
        <stop offset="100%" stopColor={ARENA_GOUD[1]} />
      </linearGradient>
      {/* De oranje vonk. Hij brandt op een KWART en op driekwart van de lijn,
          precies waar de blauwe kern uitdooft, dus de twee vullen elkaar aan in
          plaats van elkaar te vertroebelen. Alleen vervaagd getekend: een vonk
          hoort licht te zijn, geen streep. */}
      <linearGradient id="rl-vonk" x1="0" y1="0" x2="1" y2="0.8">
        <stop offset="0%" stopColor="#FF9A2E" stopOpacity="0" />
        <stop offset="22%" stopColor="#FFB55A" stopOpacity="0.85" />
        <stop offset="40%" stopColor="#FF9A2E" stopOpacity="0" />
        <stop offset="60%" stopColor="#FF9A2E" stopOpacity="0" />
        <stop offset="78%" stopColor="#FFB55A" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#FF9A2E" stopOpacity="0" />
      </linearGradient>
      {/* De blauwe kern. Aan de uiteinden doorzichtig en in het MIDDEN op zijn
          felst: zo is het een highlight op de lijn en niet een tweede lijn
          ernaast. Een kern die overal even hard staat leest als twee gestapelde
          randen in twee kleuren. */}
      <linearGradient id="rl-kern" x1="0" y1="0" x2="1" y2="0.8">
        <stop offset="0%" stopColor="#7BD8FF" stopOpacity="0" />
        <stop offset="28%" stopColor="#7BD8FF" stopOpacity="0.55" />
        <stop offset="50%" stopColor="#E8FBFF" stopOpacity="0.95" />
        <stop offset="72%" stopColor="#7BD8FF" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#7BD8FF" stopOpacity="0" />
      </linearGradient>
      {/* Het paars van het bovenpaneel staat op 20%: je moet er doorheen kunnen
          kijken naar de zaal. Naar onderen een haartje zwaarder, zodat het vlak
          nog steeds belicht oogt en niet als een egale waas. */}
      {/* Dezelfde kern als hierboven maar in paars, voor de naamplaat. Het goud
          aan de uiteinden blijft daarmee goud; alleen het licht dat er middenin
          doorheen brandt is paars. */}
      <linearGradient id="rl-kern-paars" x1="0" y1="0" x2="1" y2="0.8">
        <stop offset="0%" stopColor="#C98BFF" stopOpacity="0" />
        <stop offset="28%" stopColor="#C98BFF" stopOpacity="0.55" />
        <stop offset="50%" stopColor="#F3E2FF" stopOpacity="0.95" />
        <stop offset="72%" stopColor="#C98BFF" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#C98BFF" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="rl-vul" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2A1449" stopOpacity="0.19" />
        <stop offset="55%" stopColor="#180B2C" stopOpacity="0.21" />
        <stop offset="100%" stopColor="#0C0519" stopOpacity="0.23" />
      </linearGradient>
      {/* De naamplaat dekt wel: hij is klein en draagt de naam, dus daar mag de
          zaal niet doorheen schijnen. */}
      <linearGradient id="rl-plaat" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3A1B62" />
        <stop offset="52%" stopColor="#24103F" />
        <stop offset="100%" stopColor="#150826" />
      </linearGradient>
      <linearGradient id="rl-vul-diep" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#101A30" />
        <stop offset="60%" stopColor="#0A1220" />
        <stop offset="100%" stopColor="#070C16" />
      </linearGradient>
      {/* De witte punt: een KORTE felle plek op de lijn, niet een lichte lijn.
          Twee glinsters, een sterke linksboven en een zwakkere verderop, want
          gepolijst metaal vangt het licht op een paar plekken en niet overal.
          Loopt zo'n glans over de halve lijn, dan leest het niet als licht maar
          als een lichtere kleur. */}
      <linearGradient id="rl-glans" x1="0" y1="0" x2="1" y2="0.8">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="15%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="19%" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="23%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="64%" stopColor="#FFFFFF" stopOpacity="0.5" />
        <stop offset="68%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <filter id="rl-gloed" x="-14%" y="-16%" width="128%" height="132%">
        <feGaussianBlur stdDeviation="1.5" />
      </filter>
      <filter id="rl-kerngloed" x="-14%" y="-16%" width="128%" height="132%">
        <feGaussianBlur stdDeviation="2.4" />
      </filter>
    </defs>
  );
}

/** Eén omtrek, vier keer getekend: de vervaagde gouden gloed, de gouden body,
 *  een vervaagde blauwe kern en daarbovenop de scherpe blauwe kern. Van buiten
 *  naar binnen dus goud met een blauw hart, wat op afstand leest als één lijn
 *  die van binnenuit brandt. */
function NeonPad({ pad, vulling, breed = 0.8, kern = "rl-kern", gloed = true, glans = false }: { pad: string; vulling?: string; breed?: number; kern?: string; gloed?: boolean; glans?: boolean }) {
  return (
    <>
      {/* De vervaagde lagen zijn de gloed. Zonder die drie blijft er een kale
          gouden lijn met een kern over, en dat is precies wat het kader hoort te
          zijn: de plaat met de naam is het enige dat mag oplichten. */}
      {gloed && <path d={pad} fill="none" stroke="url(#rl-goud)" strokeWidth={breed + 1.2} opacity="0.3" filter="url(#rl-gloed)" />}
      <path d={pad} fill={vulling ?? "none"} stroke="url(#rl-goud)" strokeWidth={breed} strokeLinejoin="round" />
      {gloed && <path d={pad} fill="none" stroke="url(#rl-vonk)" strokeWidth={breed + 2.2} opacity="0.75" filter="url(#rl-kerngloed)" />}
      {gloed && <path d={pad} fill="none" stroke={`url(#${kern})`} strokeWidth={breed + 1.6} opacity="0.5" filter="url(#rl-kerngloed)" />}
      <path d={pad} fill="none" stroke={`url(#${kern})`} strokeWidth={breed * 0.42} strokeLinejoin="round" />
      {glans && <path d={pad} fill="none" stroke="url(#rl-glans)" strokeWidth={breed * 0.9} strokeLinecap="round" />}
    </>
  );
}

/** Een achthoek in echte pixels: dezelfde afsnijding als het kader, zodat de
 *  twee vakken familie zijn. */
function achthoek(b: number, h: number, c: number): string {
  return `M ${c} 0 L ${b - c} 0 L ${b} ${c} L ${b} ${h - c} L ${b - c} ${h} L ${c} ${h} L 0 ${h - c} L 0 ${c} Z`;
}

/** Het kader MET de tab erin: één doorlopende gouden lijn die bovenaan in het
 *  midden omhoog stapt, over de naam heen loopt en weer afdaalt. De naam zit dus
 *  IN de rand en ligt er niet als een etiket op.
 *
 *  Waarom een eigen pad en niet twee NeonKaders op elkaar: een kader kan alleen
 *  een gesloten rechthoek tekenen, en dan krijg je een pil BOVENOP een lijn, met
 *  het stuk lijn er nog achter. Hier is het één omtrek, dus er is geen "achter".
 *
 *  Het pad wordt in ECHTE pixels getekend, niet in een uitgerekte viewBox: dan
 *  blijven de afsnijdingen 45 graden en de lijn overal even dik, hoe breed het
 *  vak ook wordt. Vandaar dat het vak zichzelf opmeet.
 */
function TabKader({ titel, children }: { titel: string; children: React.ReactNode }) {
  const doos = useRef<HTMLDivElement | null>(null);
  const naam = useRef<HTMLSpanElement | null>(null);
  const [maat, setMaat] = useState({ b: 0, h: 0 });
  // De plaat is precies zo breed als de naam die erop staat. Meten en niet
  // gokken: het lettertype laadt na de eerste tekening, en een breedte die je
  // uit de letters uitrekent klopt daarna nooit meer.
  const [naamBreed, setNaamBreed] = useState(0);
  useEffect(() => {
    const el = naam.current;
    if (!el) return;
    const meet = () => setNaamBreed(el.getBoundingClientRect().width);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    document.fonts?.ready.then(meet).catch(() => {});
    return () => ro.disconnect();
  }, [titel]);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setMaat({ b: el.clientWidth, h: el.clientHeight });
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const TH = 15;   // hoogte van de tab: net genoeg om uit de lijn te stappen
  const TB = 208;  // breedte van de tab, schouders meegerekend
  const HELLING = 10; // de schuine kant waarmee de lijn omhoog stapt
  const TC = 5;    // de facetten op de top, waarmee de tab een kristal wordt
  const C = 16;    // afsnijding van de hoeken

  // DE NAAMPLAAT. De lijn stapt omhoog (dat zijn de schouders) en daar ligt een
  // eigen plaatje overheen met de naam erop: zeshoekig, met de uiteinden
  // afgeschuind naar een punt. De plaat is smaller dan de tab, precies zoveel
  // dat de schuine schouders er aan weerszijden onderuit komen.
  const PC = 9;                 // de afschuining van de uiteinden
  // De punten sluiten om de naam heen: de tekst plus de twee schuintes plus een
  // haar lucht.
  const PB = Math.max(90, Math.round(naamBreed) + 2 * PC + 16);
  const PH = TH + 12;           // hoogte: hij steekt boven EN onder de lijn uit

  const { b, h } = maat;
  const x1 = Math.round((b - TB) / 2);
  const x2 = Math.round((b + TB) / 2);
  // Vier knikken per kant in plaats van een: de lijn stapt schuin omhoog en
  // breekt vlak onder de top nog een keer. Dat tweede facet maakt het verschil
  // tussen een bult in de rand en een geslepen kristal; met een enkele helling
  // leest de tab als een hoekje dat is opgetild.
  const pad = b > 0 ? [
    `M ${C} ${TH}`,
    `L ${x1} ${TH}`,
    `L ${x1 + HELLING} ${TC}`,
    `L ${x1 + HELLING + TC} 0`,
    `L ${x2 - HELLING - TC} 0`,
    `L ${x2 - HELLING} ${TC}`,
    `L ${x2} ${TH}`,
    `L ${b - C} ${TH}`,
    `L ${b} ${TH + C}`,
    `L ${b} ${h - C}`,
    `L ${b - C} ${h}`,
    `L ${C} ${h}`,
    `L 0 ${h - C}`,
    `L 0 ${TH + C}`,
    "Z",
  ].join(" ") : "";

  const px = (b - PB) / 2;
  // Het hart van de plaat ligt op de lijn van de INHAM (die op nul), niet op de
  // bovenlijn van het kader. Zo loopt de opgetilde lijn dwars door de plaat heen
  // en blijft de kaderlijn er als tweede lijn onderdoor lopen.
  const py = -PH / 2;
  const plaat = b > 0 ? [
    `M ${px + PC} ${py}`,
    `L ${px + PB - PC} ${py}`,
    `L ${px + PB} ${py + PH / 2}`,
    `L ${px + PB - PC} ${py + PH}`,
    `L ${px + PC} ${py + PH}`,
    `L ${px} ${py + PH / 2}`,
    "Z",
  ].join(" ") : "";

  // Alleen de ONDERrand van de plaat: van punt, langs de onderkant, naar punt.
  // Daar glijdt het licht overheen.
  const plaatOnder = b > 0 ? [
    `M ${px} ${py + PH / 2}`,
    `L ${px + PC} ${py + PH}`,
    `L ${px + PB - PC} ${py + PH}`,
    `L ${px + PB} ${py + PH / 2}`,
  ].join(" ") : "";

  return (
    <div ref={doos} style={{ position: "relative", width: "100%" }}>
      {b > 0 && (
        <svg width={b} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} aria-hidden>
          <Verven />
          <NeonPad pad={pad} vulling="url(#rl-vul)" gloed={false} />
          <NeonPad pad={plaat} vulling="url(#rl-plaat)" breed={0.62} kern="rl-kern-paars" gloed={false} glans />
          {/* De veeg over de onderrand. `pathLength` zet de lijn om naar honderd
              eenheden, dus de streepmaat klopt bij elke schermbreedte zonder dat
              ik de echte lengte hoef te kennen. */}
          <path
            d={plaatOnder} fill="none" pathLength="100" className="reken-veeg"
            stroke="#F3E2FF" strokeWidth="2.6" strokeLinecap="round"
            strokeDasharray="13 100" opacity="0.55" style={{ filter: "blur(2.2px)" }}
          />
          <path
            d={plaatOnder} fill="none" pathLength="100" className="reken-veeg"
            stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round"
            strokeDasharray="13 100"
          />
        </svg>
      )}
      <span
        style={{
          position: "absolute", top: py, left: 0, right: 0, height: PH,
          display: "grid", placeItems: "center", pointerEvents: "none",
          fontFamily: font.wide, fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase",
          color: "#FFD98A", textShadow: "0 0 10px rgba(255,180,50,.55)",
        }}
      >
        <span ref={naam}>{titel}</span>
      </span>
      <div style={{ position: "relative", padding: `${TH + 16}px 16px 11px`, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
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

/** Het vak met de som erin: dezelfde omtrek en dezelfde lijn als het kader
 *  eromheen, een slag kleiner en een slag donkerder, zodat het erin ligt in
 *  plaats van erop. */
function SomVenster({ children }: { children: React.ReactNode }) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [maat, setMaat] = useState({ b: 0, h: 0 });
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setMaat({ b: el.clientWidth, h: el.clientHeight });
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={doos} style={{ position: "relative", width: "100%" }}>
      {maat.b > 0 && (
        <svg width={maat.b} height={maat.h} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} aria-hidden>
          <Verven />
          <NeonPad pad={achthoek(maat.b, maat.h, 13)} vulling="url(#rl-vul-diep)" breed={0.72} gloed={false} glans />
        </svg>
      )}
      <div style={{ position: "relative", padding: "10px 14px", display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}

// ---- het spel ---------------------------------------------------------------
//
// Twee schillen om dezelfde motor, net als bij Lettersoep en Kleurenklem. De
// arena geeft de seed van de poging mee en krijgt via `onKlaar` de uitslag
// terug; de testversie hieronder geeft een eigen sleutel en levert NIETS in.
export function Rekenladder({ seed, onKlaar, onOpnieuw, bord, ik }: {
  seed: string;
  onKlaar?: (score: number, level: number, timeMs: number) => void;
  onOpnieuw?: () => void;
  /** Het dagbord, om te zien wie je gaat passeren. */
  bord?: Speler[];
  /** Jijzelf, zonder score: die komt live uit dit potje. */
  ik?: Omit<Speler, "score">;
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
    setGebruikt((g) => [...g, sleutel]);
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
  }, [fase, gebruikt, som]);

  // WIE JE GAAT PASSEREN. Niet je plek op het bord van gisteren maar de laagste
  // score BOVEN je huidige stand, dus zodra je eroverheen gaat schuift hij
  // vanzelf door naar de volgende. Dat is precies wat het spannend maakt: er is
  // altijd iemand net buiten bereik.
  const duel = useMemo(() => {
    if (!bord || !ik) return null;
    const boven = bord.filter((s) => s.id !== ik.id && s.score > totaal).sort((a, b) => a.score - b.score)[0];
    if (!boven) return null;
    return { mij: { ...ik, score: totaal }, rivaal: boven };
  }, [bord, ik, totaal]);

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
          duel={duel}
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
                  height: 62, display: "grid", placeItems: "center", lineHeight: 1,
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

        {/* De hulpbalk onder de ladder. De prijzen staan er wel bij maar er wordt
            nog niets afgeschreven: de knoppen werken, het betalen wacht op de
            koppeling met je saldo. */}
        <div style={{ marginTop: 10 }}>
          <Hulpbalk hulpen={HULPEN} breedte={`${LADDER_BREED}vw`} onKies={hulp} op={gebruikt} />
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
      {/* De testversie heeft geen dagbord, dus hier staat er een verzonnen bord
          in: anders is er niets te zien van de wissel. */}
      <Rekenladder
        key={potje}
        seed={potje}
        onOpnieuw={() => setPotje(versSleutel())}
        ik={{ id: "ik", naam: "JIJ", kleur: "#B36BFF", foto: false, versie: 0 }}
        bord={[
          { id: "a", naam: "TIJGER", kleur: "#FF8A3D", foto: false, versie: 0, score: 450 },
          { id: "b", naam: "PANTYU", kleur: "#3DD6FF", foto: false, versie: 0, score: 1200 },
          { id: "c", naam: "KREAM", kleur: "#FFD24A", foto: false, versie: 0, score: 2600 },
        ]}
      />
    </Screen>
  );
}

export default PreviewRekenladder;
