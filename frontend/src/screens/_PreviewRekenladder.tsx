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
import { VAK } from "./Arena";

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
// De KNIPLIJNEN zijn opgemeten en niet gegokt: er is per rij gekeken waar geen
// van de drie ook maar een zichtbare pixel verschilt. Precies daar ligt de knip.
// Dat is nodig omdat de gloed van een plaat op de gouden stijlen valt, en die
// gloed kleurt mee; snijd je daar doorheen, dan zie je een streep waar het groen
// ophoudt. Uit de bron: stille stroken op y 911-916, 1057-1062 en 1202-1205.
//
// Elke trede stapelt zijn drie versies en laat er ALTIJD maar een zien. Een
// halfdoorzichtige gloed over een andere halfdoorzichtige gloed geeft namelijk
// niet dezelfde kleur als de tekenaar bedoelde: het groen komt dan over het
// paars te liggen in plaats van ervoor in de plaats. Alleen TIJDENS de overgang
// is dat mengen precies wat je wil, want dat is wat een crossfade is.
const LADDER_B = 788;   // de maat waarop alles is opgemeten
const LADDER_H = 626;

/** Per trede: waar de strook zit in de ladder, en waar het VLAK van de plaat
 *  zit in die strook. Het vlak is het tikbare deel en de plek van het getal;
 *  daarbuiten liggen de stijlen en de gloed, waar een tik niet hoort te tellen.
 *  Alles in procenten, want de ladder schaalt mee met de schermbreedte. */
const TREDEN = [
  { band: [0, 145], vlak: [76, 33, 712, 139] },
  { band: [145, 292], vlak: [74, 167, 709, 282] },
  { band: [292, 436], vlak: [72, 312, 715, 428] },
  { band: [436, 626], vlak: [69, 459, 718, 576] },
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

type Staat = "rust" | "goed" | "fout" | "dood";
/** Wat er van een beurt bekend is. `gekozen` is null als de klok het deed en
 *  niet de speler: dan is er geen trede die rood hoort te worden. */
type Oordeel = { gekozen: number | null; goed: boolean } | null;

/** Een trede. De drie versies liggen op elkaar en alleen de huidige staat op
 *  vol; de andere twee staan op nul en faden mee. Zo is de overgang een echte
 *  kruisfade en niet een sprong, en zie je in rust nooit twee kleuren door
 *  elkaar. */
function Trede({ i, waarde, staat, onKies }: { i: number; waarde: number; staat: Staat; onKies: () => void }) {
  const t = TREDEN[i];
  const kleur = staat === "goed" ? "goed" : staat === "fout" ? "fout" : "rust";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: `${t.top}%`, bottom: `${t.bodem}%` }}>
      {(["rust", "goed", "fout"] as const).map((k) => (
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
          fontFamily: font.display, fontWeight: 800, fontSize: 30, letterSpacing: 1,
          color: "#FFF6DC",
          textShadow: "0 2px 6px rgba(0,0,0,.75), 0 0 14px rgba(0,0,0,.5)",
          opacity: staat === "dood" ? 0.4 : 1,
          transform: staat === "goed" ? "scale(1.06)" : "scale(1)",
          transition: "opacity .22s ease-out, transform .22s ease-out",
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
function Ladder({ keuzes, antwoord, oordeel, onKies }: {
  keuzes: number[];
  antwoord: number;
  oordeel: Oordeel;
  onKies: (w: number) => void;
}) {
  return (
    <div style={{ position: "relative", width: VAK, aspectRatio: `${LADDER_B} / ${LADDER_H}` }}>
      {keuzes.map((w, i) => (
        <Trede
          key={i}
          i={i}
          waarde={w}
          staat={
            !oordeel ? "rust"
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
        />
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
const VIOLET = "#B36BFF";
const VIOLET_LICHT = "#E3B8FF";

/** De verven voor de lijnen. Eén keer per svg neerzetten; wie ze twee keer
 *  neerzet krijgt dubbele id's en dan pakt de browser er willekeurig een. */
function Verven() {
  return (
    <defs>
      {/* Hetzelfde goud als KADER_LIJN_GOUD, maar als svg-verloop, zodat het
          een streek kan volgen die geen rechthoek is. */}
      <linearGradient id="rl-goud" x1="0" y1="0" x2="1" y2="0.8">
        <stop offset="0%" stopColor="#FFEBB8" />
        <stop offset="14%" stopColor="#FFCF4A" />
        {/* Waar het goud vroeger dof bruin werd, gloeit het nu koper. Een
            donkere plek in een neonlijn hoort niet dood te zijn maar alleen
            verder weg, en warm goud dat wegzakt IS oranje. */}
        <stop offset="30%" stopColor="#E08A1E" />
        <stop offset="50%" stopColor="#FFE08A" />
        <stop offset="68%" stopColor="#FF9A2E" />
        <stop offset="84%" stopColor="#A9600F" />
        <stop offset="100%" stopColor="#FFEBB8" />
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
      {/* Het paars van het bovenpaneel staat op 30%: je kijkt er doorheen naar
          de arena erachter. De kleurtrap blijft staan (licht bovenin, diep
          onderin), anders leest het vlak als een egale waas in plaats van als
          een belicht oppervlak. */}
      <linearGradient id="rl-vul" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2A1449" stopOpacity="0.3" />
        <stop offset="55%" stopColor="#180B2C" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#0C0519" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id="rl-vul-diep" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#101A30" />
        <stop offset="60%" stopColor="#0A1220" />
        <stop offset="100%" stopColor="#070C16" />
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
function NeonPad({ pad, vulling, breed = 1.1 }: { pad: string; vulling?: string; breed?: number }) {
  return (
    <>
      <path d={pad} fill="none" stroke="url(#rl-goud)" strokeWidth={breed + 1.2} opacity="0.3" filter="url(#rl-gloed)" />
      <path d={pad} fill={vulling ?? "none"} stroke="url(#rl-goud)" strokeWidth={breed} strokeLinejoin="round" />
      <path d={pad} fill="none" stroke="url(#rl-vonk)" strokeWidth={breed + 2.2} opacity="0.75" filter="url(#rl-kerngloed)" />
      <path d={pad} fill="none" stroke="url(#rl-kern)" strokeWidth={breed + 1.6} opacity="0.5" filter="url(#rl-kerngloed)" />
      <path d={pad} fill="none" stroke="url(#rl-kern)" strokeWidth={breed * 0.42} strokeLinejoin="round" />
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

  const TH = 30;   // hoogte van de tab
  const TB = 180;  // breedte van de tab, schouders meegerekend
  const HELLING = 17; // de schuine kant waarmee de lijn omhoog stapt
  const TC = 11;   // de facetten op de top, waarmee de tab een kristal wordt
  const C = 16;    // afsnijding van de hoeken

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

  return (
    <div ref={doos} style={{ position: "relative", width: "100%" }}>
      {b > 0 && (
        <svg width={b} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} aria-hidden>
          <Verven />
          <NeonPad pad={pad} vulling="url(#rl-vul)" />
        </svg>
      )}
      <span
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: TH,
          display: "grid", placeItems: "center", pointerEvents: "none",
          fontFamily: font.wide, fontSize: 11.5, letterSpacing: 2.4, textTransform: "uppercase",
          color: "#FFD98A", textShadow: "0 0 10px rgba(255,180,50,.55)",
        }}
      >
        {titel}
      </span>
      <div style={{ position: "relative", padding: `${TH + 14}px 16px 16px`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
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
  const op = rest < 0.28;
  const kleur = op ? "#FF5A4E" : VIOLET;
  const licht = op ? "#FF9A92" : VIOLET_LICHT;
  const omtrek = 2 * Math.PI * 15;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <Timer size={19} strokeWidth={1.8} color={withAlpha("#FFE7A8", 0.72)} style={{ flexShrink: 0 }} />
      <span style={{ position: "relative", flex: 1, height: 11, borderRadius: 999, background: "rgba(0,0,0,.45)", boxShadow: `inset 0 0 0 1px ${withAlpha("#FFE7A8", 0.18)}, inset 0 2px 5px rgba(0,0,0,.55)`, overflow: "hidden" }}>
        <span
          style={{
            position: "absolute", inset: 1, right: "auto",
            width: `calc(${Math.max(0, Math.min(1, rest)) * 100}% - 2px)`,
            borderRadius: 999,
            background: `linear-gradient(180deg, ${licht} 0%, ${kleur} 48%, ${withAlpha(kleur, 0.75)} 100%)`,
            boxShadow: `0 0 12px ${withAlpha(kleur, 0.65)}`,
          }}
        />
      </span>
      {/* De ring loopt tegen de klok in leeg, zoals een echte aftelling. */}
      <span style={{ position: "relative", width: 38, height: 38, flexShrink: 0, display: "grid", placeItems: "center" }}>
        <svg width="38" height="38" viewBox="0 0 38 38" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden>
          <circle cx="19" cy="19" r="15" fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="3.2" />
          <circle
            cx="19" cy="19" r="15" fill="none" stroke={kleur} strokeWidth="3.2" strokeLinecap="round"
            strokeDasharray={omtrek} strokeDashoffset={omtrek * (1 - Math.max(0, Math.min(1, rest)))}
            style={{ filter: `drop-shadow(0 0 5px ${withAlpha(kleur, 0.8)})` }}
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
          <NeonPad pad={achthoek(maat.b, maat.h, 13)} vulling="url(#rl-vul-diep)" breed={0.9} />
        </svg>
      )}
      <div style={{ position: "relative", padding: "18px 14px", display: "grid", placeItems: "center" }}>{children}</div>
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
  useEffect(() => {
    document.body.classList.add("soepspel");
    return () => document.body.classList.remove("soepspel");
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

  const trap = useMemo(() => trapVoor(trede), [trede]);
  const som = useMemo(() => maakSom(`${potje}:${trede}`, trap), [potje, trede, trap]);

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
  }, [potje, trede, fase]);

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
    na(420, () => { setOordeel(null); setTrede((k) => k + 1); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, som, rest, trede, mis]);

  const stop = () => setFase("klaar");

  return (
    <>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, paddingBottom: 24 }}>
        {/* Het vraagpaneel. Alles in code: een gouden verlooprand met een
            afsnijding op de hoeken, de naam op een tab die over de bovenrand
            valt, het somvak erin met zijn eigen dunnere lijn, en onderin de
            klok als balk plus ring. */}
        <div style={{ width: VAK }}>
          <TabKader titel="REKENLADDER">
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 17, letterSpacing: 0.4, color: "#FFFFFF", textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>
              {fase === "klaar" ? `GEVALLEN OP TREDE ${trede}` : "WAT IS HET ANTWOORD?"}
            </span>

            <SomVenster>
              <span
                key={fase === "tel" ? `tel-${tel}` : `som-${trede}`}
                className="klem-kom"
                style={{
                  fontFamily: font.display, fontWeight: 800,
                  fontSize: fase === "tel" ? 52 : 42, letterSpacing: 2, lineHeight: 1.1,
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
              <span style={{ height: 38, display: "grid", placeItems: "center", fontFamily: font.ui, fontSize: 12, color: withAlpha("#FFE7A8", 0.7) }}>
                {fase === "tel" ? "maak je klaar" : "punten"}
              </span>
            )}
          </TabKader>
        </div>

        {/* De teller staat onder het paneel tot de scorebalk er is. */}
        {fase !== "klaar" && (
          <div style={{ display: "flex", gap: 18, fontFamily: font.ui, fontSize: 12, color: withAlpha("#FFE7A8", 0.75) }}>
            <span>TREDE <b style={{ fontFamily: font.display, fontSize: 15, color: "#FFF3D0" }}>{trede}</b></span>
            <span>PUNTEN <b style={{ fontFamily: font.display, fontSize: 15, color: "#FFF3D0" }}>{totaal}</b></span>
          </div>
        )}

        {/* De vier antwoorden ZIJN de treden van de ladder. */}
        {fase !== "tel" && fase !== "klaar" && (
          <Ladder keuzes={som.keuzes} antwoord={som.antwoord} oordeel={oordeel} onKies={kies} />
        )}

        {(fase !== "klaar" || onOpnieuw) && (
        <NeonKader radius={999} dik={0.5} vulling="zwart" animeer lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
          <button
            onClick={fase === "klaar" ? onOpnieuw : stop}
            className="pressable"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
          >
            <LogOut size={14} /> {fase === "klaar" ? "Opnieuw" : "Stoppen"}
          </button>
        </NeonKader>
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
