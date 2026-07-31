// KLEURENKLEM, het arenaspel van zaterdag. Speelbare testversie achter ?klem
// in de url (eigen brok, dus wie hem niet opent downloadt hem ook niet).
//
// HET SPEL is de Stroop-test, omgekeerd gespeeld: er staat een KLEURNAAM op het
// scherm, in een inkt die er NOOIT mee klopt. Je tikt de kleur die er GESCHREVEN
// staat en negeert de kleur van de letters. Lezen gaat vanzelf, maar de kleur
// die je ziet blijft de hele tijd het tegenovergestelde roepen, en dat gevecht
// IS het spel.
//
// Waarom altijd botsen en niet soms: een opgave waarin woord en inkt toevallig
// gelijk zijn heeft geen tegenspraak, en dus niets te negeren. Dat is geen
// makkelijke opgave maar een lege.
//
// DE KLEM is de tijd. Per opgave sluiten twee kaken op het woord; raken ze
// elkaar, dan ben je te laat. Elke ronde sluiten ze sneller. Dat is ook waar de
// naam vandaan komt: niet jij loopt uit de tijd, de tijd loopt op jou dicht.
//
// EEN REGEL, DE HELE POT. Er was een omkering waarbij je vanaf ronde acht juist
// de inkt moest kiezen, met een luide banner erbij. Die is eruit: twee regels
// door elkaar maakt van een reactiespel een geheugenspel over welke regel nu
// ook alweer geldt, en dat is niet waar de klok voor bedoeld is.
//
// VAN MAKKELIJK NAAR MOEILIJK, dezelfde ladder-gedachte als in Lettersoep:
// ronde 1 heeft vier kleuren en ruim twee seconden, ronde 19 en verder zes
// kleuren en zeven tienden van een seconde. Zie trapVoor().
//
// CEILINGLOOS: je hebt drie levens en speelt door tot ze op zijn. Er is geen
// eindronde, dus de arenaregel geldt vanzelf.
//
// WAT NOG NIET ECHT IS (testversie): er wordt niets ingeleverd bij de server,
// en er is nog geen eigen art. De secties zijn geleend van Lettersoep, de
// kleurknoppen en de klem zijn in code getekend.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Screen } from "../components/Layout";
import { KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { colors, font, withAlpha } from "../theme/tokens";
import { sound } from "../sound/sound";
import { VAK } from "./Arena";

// ---- de maten van de geleende art -------------------------------------------
const SCORE_V = 3.7805;
const BORD_V = 0.8349;
const ONDER_V = 2.9589;
const PANEEL_TOP = 0.024;
const VENSTER = { l: 0.0561, r: 0.0573, t: 0.1636, b: 0.0758 };
const SCORE_RUIT = { t: 0.2238, h: 0.6643, links: { l: 0.0407, b: 0.3213 }, rechts: { l: 0.637, b: 0.3213 } };
const ONDER_RUIT = { l: 0.0148, b: 0.9704, t: 0.1315, h: 0.7 };

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;


// ---- de kleuren -------------------------------------------------------------
//
// Zes edelstenen uit de UI-map, alle zes op dezelfde maat gebracht: in de bron
// waren groen en paars zeven procent smaller dan de rest, en naast elkaar in
// een raster zie je dat meteen.
//
// De INKT is de kleur waarin het woord op het scherm staat. Die is niet zomaar
// de kleur van de steen: een steen mag donker zijn, een letter op een
// donkerpaars paneel niet. Het is de tint van de steen, opgetrokken tot hij
// leesbaar is en niet verder, zodat knop en woord nog steeds dezelfde kleur
// heten. Goud is expres bleker dan het goud van de app zelf, anders lijkt het
// woord GOUD gewoon een stuk gewone tekst.
type Kleur = { key: string; naam: string; inkt: string };

// De tinten zijn GEMETEN uit de stenen zelf (public/ui/klem/*.webp): per steen
// de overheersende kleurhoek, gewogen op verzadiging en middentoon, zodat de
// glans bovenop en de schaduw onderin de uitslag niet scheeftrekken. Daarna op
// een vast licht van 62 procent gezet, want een letter moet op een donker
// paneel leesbaar zijn en de steen zelf is daar veel te donker voor.
//
// Zo hoort het ook: het WOORD dat je leest en de STEEN die je aantikt zijn
// dezelfde kleur. Stonden die naast elkaar iets uit de pas, dan twijfel je in
// een spel waar je zeven tienden seconde hebt.
//
// Bruin heette eerst goud. Die steen deelt zijn kleurhoek met oranje (31 om 32
// graden) en verschilde alleen in verzadiging, en twee stenen die alleen daarin
// verschillen zijn in zeven tienden seconde niet uit elkaar te houden. Als
// BRUIN heeft hij een eigen naam en een eigen plek: zelfde hoek, maar veel
// minder verzadigd en donkerder, en dat is precies wat bruin is.
const KLEUREN: Kleur[] = [
  { key: "rood", naam: "ROOD", inkt: "#FA4642" },
  { key: "blauw", naam: "BLAUW", inkt: "#4275FA" },
  { key: "groen", naam: "GROEN", inkt: "#42FA79" },
  { key: "oranje", naam: "ORANJE", inkt: "#FAA342" },
  { key: "paars", naam: "PAARS", inkt: "#E842FA" },
  { key: "bruin", naam: "BRUIN", inkt: "#BC864E" },
];

// ---- de ladder --------------------------------------------------------------
//
// Drie knoppen lopen op, en ze doen elk iets anders met je hoofd:
//   AANTAL   meer kleuren = meer om uit te kiezen, dus langer zoeken.
//   VENSTER  minder tijd = geen ruimte meer om te twijfelen.
//   BOTSING  hoe vaak woord en inkt elkaar tegenspreken. Dit is de echte
//            moeilijkheid: een woord dat klopt met zijn inkt lees je gewoon af,
//            een woord dat botst moet je actief negeren.
// De eerste rondes hebben expres veel kloppende woorden. Dat is niet om het
// makkelijk te houden maar om de gewoonte te bouwen die daarna gesloopt wordt.
type Trap = { kleuren: number; venster: number; gelijk: number };

export function trapVoor(ronde: number): Trap {
  const r = Math.max(1, ronde);
  // Vier of zes, nooit vijf: vijf knoppen worden een rij van drie met een rij
  // van twee eronder, en dat leest als een fout in de opmaak. Vier is 2x2, zes
  // is 3x2, allebei recht.
  //
  // Pas vanaf ronde tien zes stenen. Stond op zeven, en dan komt de sprong van
  // vier naar zes precies terwijl de klok ook al korter wordt: twee klappen
  // tegelijk, en dat is waar het te snel zwaar werd.
  const kleuren = r <= 9 ? 4 : 6;
  // De klok zakt 65ms per ronde in plaats van 90, begint iets ruimer en stopt
  // op acht tienden in plaats van zeven. Ronde 10 heeft nu 1815ms waar dat
  // eerst 1490 was, en de bodem ligt op ronde 26 in plaats van 19.
  const venster = Math.max(800, 2400 - (r - 1) * 65);
  // De kans dat inkt en woord toevallig kloppen. Nul tot en met ronde 17, daarna
  // heel langzaam omhoog tot hoogstens een op de acht. Meer zou de tegenspraak
  // ondermijnen die het spel IS.
  const gelijk = r <= 17 ? 0 : Math.min(0.12, (r - 17) * 0.015);
  return { kleuren, venster, gelijk };
}

/** De punten van één goede opgave: honderd vast, plus honderd naar rato van de
 *  tijd die je overhield. Zo betaalt snel spelen echt uit zonder dat traag
 *  spelen niets waard is, en zit er een harde bovengrens van 200 per opgave op
 *  waar de server later aan kan rekenen. */
const punten = (rest: number) => 100 + Math.round(100 * Math.max(0, Math.min(1, rest)));

const LEVENS = 3;

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

type Opgave = { woord: Kleur; inkt: Kleur; keuzes: Kleur[]; goed: Kleur };

/** Eén opgave voor deze ronde.
 *
 *  Het antwoord is ALTIJD het woord: je tikt de kleur die er staat geschreven,
 *  nooit de kleur van de inkt. En de inkt klopt NOOIT met het woord. Dat was
 *  eerst een kans die per ronde opliep; nu is het een regel, want een opgave
 *  waarin ze toevallig gelijk zijn heeft geen tegenspraak en is dus geen opgave.
 *
 *  De keuzeknoppen bevatten altijd het goede antwoord én de afleider, de kleur
 *  van de inkt. Zonder die twee samen kun je winnen door de valstrik simpelweg
 *  niet te zien staan, en dan test het spel niets meer. */
function maakOpgave(seed: string, trap: Trap, vorige: Opgave | null = null): Opgave {
  const rng = maakRng(seed);
  const pak = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const pot = KLEUREN.slice(0, trap.kleuren);

  const woord = pak(pot);
  // Woord en inkt zijn in principe NOOIT gelijk: een opgave zonder tegenspraak
  // heeft niets te negeren. Maar vanaf de zwaardere rondes mag het heel af en
  // toe wel, en juist dan is het gemeen: je hebt inmiddels de gewoonte om de
  // inkt weg te denken, en dan klopt hij ineens. Dat kost je een tel twijfel,
  // en een tel heb je daar niet.
  let inkt = rng() < trap.gelijk ? woord : pak(pot.filter((k) => k.key !== woord.key));
  // Twee keer exact hetzelfde paar achter elkaar (BLAUW in goud, en dan weer
  // BLAUW in goud) voelt als een haperende app en niet als een nieuwe opgave.
  // Alleen de INKT wisselt dan; het woord mag best twee keer komen, want dat is
  // met vier kleuren onvermijdelijk en het is ook niet wat opvalt.
  if (vorige && vorige.woord.key === woord.key && vorige.inkt.key === inkt.key) {
    inkt = pak(pot.filter((k) => k.key !== woord.key && k.key !== inkt.key));
  }
  const goed = woord;

  // Klopt de inkt toevallig met het woord, dan is er geen afleider om erbij te
  // zetten; anders staat dezelfde steen twee keer in de rij.
  const moet = inkt.key === woord.key ? [goed] : [goed, inkt];
  const rest = pot.filter((k) => !moet.some((m) => m.key === k.key));
  for (let j = rest.length - 1; j > 0; j--) {
    const k = Math.floor(rng() * (j + 1));
    [rest[j], rest[k]] = [rest[k], rest[j]];
  }
  const keuzes = [...moet, ...rest].slice(0, trap.kleuren);
  for (let j = keuzes.length - 1; j > 0; j--) {
    const k = Math.floor(rng() * (j + 1));
    [keuzes[j], keuzes[k]] = [keuzes[k], keuzes[j]];
  }
  return { woord, inkt, keuzes, goed };
}

const versSleutel = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function startRonde(): number {
  if (typeof location === "undefined") return 1;
  const n = Number(new URLSearchParams(location.search).get("klem"));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

// ---- bouwstenen -------------------------------------------------------------
function Sectie({ art, verhouding, children }: { art: string; verhouding: number; children?: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: VAK, height: `calc(${VAK} / ${verhouding})`, flexShrink: 0 }}>
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(11px)", opacity: 0.55, transform: "translateY(9px)", pointerEvents: "none" }} />
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {children}
    </div>
  );
}

function Meter({ kop, waarde, kleur = "#FFF3D0", breuk }: { kop: string; waarde: string; kleur?: string; breuk: { l: number; b: number } }) {
  return (
    <div
      style={{
        position: "absolute",
        left: pct(breuk.l), width: pct(breuk.b),
        top: pct(SCORE_RUIT.t), height: pct(SCORE_RUIT.h),
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
      }}
    >
      <span style={{ fontFamily: font.wide, fontSize: 10, letterSpacing: 1.6, color: withAlpha("#FFE7A8", 0.72) }}>{kop}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 22, lineHeight: 1, color: kleur, fontVariantNumeric: "tabular-nums", textShadow: "0 0 12px rgba(255,190,60,.5)" }}>{waarde}</span>
    </div>
  );
}

/** Een kleurknop is de edelsteen zelf. De schaduw eronder is een tweede kopie
 *  van dezelfde art met brightness(0) en een blur: `drop-shadow` breekt op iOS
 *  (Safari rastert de laag apart en dan zie je de rechthoek eromheen), maar een
 *  zwartgemaakte kopie volgt het alfakanaal en dus de achthoek. */
function KleurKnop({ kleur, staat, onKies }: { kleur: Kleur; staat: "rust" | "goed" | "fout" | "dood"; onKies: () => void }) {
  const dood = staat === "dood";
  const art = `/ui/klem/${kleur.key}.webp?v=1`;
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); if (!dood) onKies(); }}
      disabled={dood}
      aria-label={kleur.naam.toLowerCase()}
      className={staat === "fout" ? "klem-mis" : undefined}
      style={{
        position: "relative", border: "none", background: "transparent", padding: 0,
        aspectRatio: "420 / 244", width: "100%",
        cursor: dood ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
        filter: dood ? "grayscale(.75) brightness(.42)" : staat === "goed" ? "brightness(1.22) saturate(1.15)" : undefined,
        transform: staat === "goed" ? "scale(1.07)" : "scale(1)",
        transition: "transform .12s ease-out, filter .12s ease-out",
      }}
    >
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(7px)", opacity: 0.6, transform: "translateY(6px)", pointerEvents: "none" }} />
      {staat === "goed" && (
        <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "blur(11px)", opacity: 0.85, pointerEvents: "none" }} />
      )}
      <img src={art} alt="" style={{ position: "relative", width: "100%", height: "100%", display: "block" }} />
    </button>
  );
}

/** Het vak waarin het woord staat: een gouden neonlijn met doorschijnende
 *  vulling, en in die lijn een verloop in de kleur van het woord.
 *
 *  Waarom SVG en niet de padding-truc met twee lagen: die truc maakt een rand
 *  door een gevulde laag over een verlooplaag te leggen, en dan MOET de
 *  binnenkant dus dekkend zijn. Hier moet het paneel er juist doorheen te zien
 *  zijn. Een `stroke` op een polygoon doet dat wel, houdt zijn dikte gelijk op
 *  elke schermbreedte, en kan een verloop met alfa dragen.
 *
 *  De viewBox heeft precies de verhouding van het vak, dus er wordt niets
 *  uitgerekt en de hoeken blijven 45 graden. */
/** De maten van het woordvak. De gouden lijn is een SVG die met
 *  `preserveAspectRatio="none"` wordt uitgerekt, dus zijn hoeken schalen mee met
 *  de breedte EN de hoogte van het vak. De vulling werd geknipt op 16 echte
 *  pixels, en dat is een andere vorm zodra het vak niet toevallig 319x104 groot
 *  is: op een breed scherm stak de kleur boven de lijn uit. Daarom staan de
 *  getallen nu hier, en leiden allebei hun vorm er zelf uit af. */
const VAK_MAAT = { B: 319, H: 104, c: 16, m: 2.4 };

/** Dezelfde achthoek als de lijn, maar in procenten, zodat een clip-path hem
 *  precies volgt hoe groot het vak ook wordt. De vulling loopt tot het HART van
 *  de lijn; de buitenste helft van de streek ligt er dus overheen, en dat is
 *  precies wat een rand hoort te doen. */
const VAK_VORM = (() => {
  const { B, H, c, m } = VAK_MAAT;
  const x = (v: number) => `${((v / B) * 100).toFixed(3)}%`;
  const y = (v: number) => `${((v / H) * 100).toFixed(3)}%`;
  return `polygon(${x(c + m)} ${y(m)}, ${x(B - c - m)} ${y(m)}, ${x(B - m)} ${y(c + m)}, ${x(B - m)} ${y(H - c - m)}, ${x(B - c - m)} ${y(H - m)}, ${x(c + m)} ${y(H - m)}, ${x(m)} ${y(H - c - m)}, ${x(m)} ${y(c + m)})`;
})();

function WoordVak({ kleur, id }: { kleur: string; id: string }) {
  const { B, H, c, m } = VAK_MAAT;
  const punten = [
    [c + m, m], [B - c - m, m], [B - m, c + m], [B - m, H - c - m],
    [B - c - m, H - m], [c + m, H - m], [m, H - c - m], [m, c + m],
  ].map((p) => p.join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3, overflow: "visible" }}>
      <defs>
        {/* Goud is de lijn, de kleur is een doorloop erin. Geef je de kleur de
            helft van het verloop, dan is het geen gouden lijn meer maar een
            gekleurde, en dan gaat de art van de kast er tegenin. */}
        <linearGradient id={`lijn-${id}`} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor="#B0710E" stopOpacity="0.7" />
          <stop offset="20%" stopColor="#FFD98A" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#FFF6DC" stopOpacity="1" />
          <stop offset="52%" stopColor={kleur} stopOpacity="1" />
          <stop offset="64%" stopColor="#FFF6DC" stopOpacity="1" />
          <stop offset="84%" stopColor="#FFD98A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#B0710E" stopOpacity="0.7" />
        </linearGradient>
        <filter id={`bloei-${id}`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
      </defs>
      {/* De bloei is een tweede, vervaagde kopie ACHTER de lijn. Ruim baan
          eromheen, anders knipt het filtervenster de vervaging af. */}
      <polygon points={punten} fill="none" stroke="#FFB43C" strokeWidth="4.2" opacity="0.42" filter={`url(#bloei-${id})`} />
      <polygon points={punten} fill="none" stroke={kleur} strokeWidth="3" opacity="0.3" filter={`url(#bloei-${id})`} />
      <polygon points={punten} fill="none" stroke={`url(#lijn-${id})`} strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

type Rgb = [number, number, number];

function rgbVan(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Terug naar HEX, en dat is hier geen smaakkwestie. `withAlpha` uit de tokens
 *  leest een kleur met `parseInt(..., 16)` en spreekt dus alleen hex; geef je
 *  hem `rgb(144, 41, 155)`, dan komt er `rgba(NaN, NaN, NaN, .02)` uit, gooit de
 *  browser het hele verloop weg en verdwijnt de klem zonder een spoor in de
 *  console. Precies dat is een keer gebeurd. */
function hexVan([r, g, b]: Rgb): string {
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${k(r)}${k(g)}${k(b)}`;
}

/** Dezelfde kleur, alleen minder licht. Met alfa zou hij doorschijnend worden
 *  en mee verkleuren met wat eronder ligt; hier moet het echt dezelfde tint
 *  blijven, een slag donkerder. */
function donkerder(hex: string, deel: number): string {
  return hexVan(rgbVan(hex).map((v) => v * deel) as Rgb);
}

/** Onderweg van de ene kleur naar de andere. 0 is helemaal `van`, 1 helemaal `naar`. */
function meng(van: Rgb, naar: Rgb, deel: number): string {
  const t = Math.max(0, Math.min(1, deel));
  return hexVan(van.map((v, i) => v + (naar[i] - v) * t) as Rgb);
}

/** Waar de klem naartoe kleurt als de tijd opraakt, en vanaf hoeveel resterende
 *  tijd hij daaraan begint. Pas op zeventig procent van de beweging: de eerste
 *  twee derde hoort de klem gewoon de kleur van het vak te zijn, en het rood is
 *  het laatste stuk. Stond op 0,55 en dat kleurde te vroeg, waardoor de helft
 *  van elke ronde al rood was en de waarschuwing niets meer zei. */
const KLEM_ROOD: Rgb = [255, 90, 78];
const KLEM_VERKLEURT_VANAF = 0.3;

/** De klem: twee kaken die op het woord dichtlopen. Ze staan in dezelfde doos
 *  als het woord, en hun breedte IS de resterende tijd; er is dus geen aparte
 *  balk nodig die hetzelfde nog eens vertelt.
 *
 *  Altijd DEZELFDE kleur. De kaken sprongen vlak voor tijd van goud naar rood,
 *  en dat is nou juist het enige wat in dit spel niet mag: je zit te beoordelen
 *  welke kleur je ziet, en dan gaat de kader zelf van kleur wisselen. Dat er
 *  weinig tijd over is lees je al aan hoe ver ze dicht staan, en dat is een
 *  maat en geen kleur. */
function Klem({ rest, inkt }: { rest: number; inkt: string }) {
  const dicht = (1 - rest) * 0.5;
  // De kaken beginnen in dezelfde kleur als het vak eronder (de inkt van het
  // woord, een slag donkerder) en LOPEN van daaruit naar rood naarmate de tijd
  // opraakt. Geen schakelaar die op een drempel omklapt: dan is het een schrik,
  // en een schrik vertelt je niets over hoeveel tijd je nog hebt. Zo zie je aan
  // de kleur hoe ver het is, net als aan hoe ver ze dicht staan.
  const basis = rgbVan(inkt).map((v) => v * 0.78) as Rgb;
  const kleur = meng(basis, KLEM_ROOD, (KLEM_VERKLEURT_VANAF - rest) / KLEM_VERKLEURT_VANAF);
  const kaak = (kant: "left" | "right"): React.CSSProperties => ({
    position: "absolute", top: 0, bottom: 0, [kant]: 0, width: pct(dicht),
    // Vrijwel dekkend, en dat moet ook: de kaken hebben dezelfde kleur als het
    // vak eronder, dus ze kunnen het niet van een kleurverschil hebben maar
    // alleen van hun helderheid. Een verloop dat grotendeels doorzichtig is
    // laat het vak er dan gewoon doorheen schijnen en dan zie je niets.
    background: `linear-gradient(${kant === "left" ? "90deg" : "270deg"}, ${withAlpha(kleur, 0.35)} 0%, ${withAlpha(kleur, 0.72)} 55%, ${withAlpha(kleur, 0.94)} 88%, ${kleur} 100%)`,
    boxShadow: `${kant === "left" ? "" : "-"}3px 0 14px ${withAlpha(kleur, 0.55)}`,
    pointerEvents: "none",
  });
  return (
    <>
      <span aria-hidden style={kaak("left")} />
      <span aria-hidden style={kaak("right")} />
    </>
  );
}

// ---- het spel ---------------------------------------------------------------
//
// Twee schillen om dezelfde motor, net als bij Lettersoep. De arena geeft de
// seed van de poging mee en krijgt via `onKlaar` de uitslag terug; de
// testversie hieronder geeft een eigen sleutel en levert NIETS in.
export function Kleurenklem({ seed, onKlaar, onOpnieuw }: {
  seed: string;
  /** Arena-schil: de uitslag inleveren zodra de levens op zijn. */
  onKlaar?: (score: number, level: number, timeMs: number) => void;
  /** Testversie: een nieuw potje. Door de `key` op de ouder herstart alles. */
  onOpnieuw?: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("soepspel");
    return () => document.body.classList.remove("soepspel");
  }, []);

  const potje = seed;
  // `?klem=12` alleen in de TESTVERSIE. In de arena zou het je op een hogere
  // ronde laten beginnen en dus een level opleveren dat je niet gespeeld hebt.
  const [ronde, setRonde] = useState(() => (onKlaar ? 1 : startRonde()));
  const [totaal, setTotaal] = useState(0);
  const [levens, setLevens] = useState(LEVENS);
  const [rest, setRest] = useState(1);
  const [oordeel, setOordeel] = useState<{ key: string; goed: boolean } | null>(null);
  // Er wordt eerst AFGETELD. Zonder dat begint ronde 1 terwijl het scherm nog
  // aan het opbouwen is, en dan ben je een leven kwijt aan het laden.
  const [fase, setFase] = useState<"tel" | "spel" | "klaar">("tel");
  const [tel, setTel] = useState(3);
  const [reeks, setReeks] = useState(0);
  const [beste, setBeste] = useState(0);

  // De speeltijd loopt vanaf het eerste beeldje van het spel. Het aftellen
  // hoort er niet bij: dat is drie tellen waarin je niets kan doen, en de
  // server rekent met deze tijd of het level echt gehaald kan zijn.
  const t0 = useRef(performance.now());
  const ingeleverd = useRef(false);
  useEffect(() => {
    if (fase !== "klaar" || !onKlaar || ingeleverd.current) return;
    ingeleverd.current = true;
    onKlaar(totaal, ronde, Math.round(performance.now() - t0.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);
  useEffect(() => {
    if (fase === "spel") t0.current = performance.now();
    // Alleen bij de OVERGANG naar spelen, dus niet elke ronde opnieuw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase === "spel"]);

  const trap = useMemo(() => trapVoor(ronde), [ronde]);
  const opgave = useMemo(() => {
    // Van ronde 1 af opbouwen en niet alleen de vorige uitrekenen: de vorige
    // opgave kan ZELF een aangepaste inkt hebben gekregen, en dan klopt een
    // losse herberekening daarvan niet met wat er echt op het scherm stond.
    // Het is hooguit honderd keer een handvol worpen, dus dat mag.
    let vorige: Opgave | null = null;
    for (let r = 1; r <= ronde; r++) vorige = maakOpgave(`${potje}:${r}`, trapVoor(r), vorige);
    return vorige as Opgave;
  }, [potje, ronde]);

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

  // Of deze opgave al beantwoord is. Een ref en geen state, want de klok leest
  // hem in een animatielus en die mag daar niet op herstarten.
  const beslist = useRef(false);

  // De klok van de klem. Hij loopt op requestAnimationFrame en niet op een
  // interval: bij een venster van zeven tienden seconde is een stap van 1/60
  // het verschil tussen een klem die sluit en een klem die springt. Bij een
  // ronde met een omkering krijg je een halve seconde extra leestijd, anders is
  // de wissel geen uitdaging maar een val.
  useEffect(() => {
    if (fase !== "spel") return;
    beslist.current = false;
    setRest(1);
    const duur = trap.venster;
    const start = performance.now();
    let vraag = 0;
    const stap = () => {
      const over = 1 - (performance.now() - start) / duur;
      if (beslist.current) return;
      if (over <= 0) { setRest(0); mis(); return; }
      setRest(over);
      vraag = requestAnimationFrame(stap);
    };
    vraag = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(vraag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potje, ronde, fase]);

  const volgende = useCallback(() => {
    na(360, () => {
      setOordeel(null);
      setRonde((r) => r + 1);
    });
  }, []);

  const mis = useCallback(() => {
    if (beslist.current) return;
    beslist.current = true;
    sound.klemFout();
    setOordeel({ key: opgave.goed.key, goed: false });
    setReeks(0);
    setLevens((l) => {
      if (l <= 1) { na(420, () => setFase("klaar")); return 0; }
      volgende();
      return l - 1;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opgave, volgende]);

  const kies = useCallback((k: Kleur) => {
    if (beslist.current || fase !== "spel") return;
    if (k.key !== opgave.goed.key) { setOordeel({ key: k.key, goed: false }); mis(); return; }
    beslist.current = true;
    sound.klemGoed();
    setOordeel({ key: k.key, goed: true });
    setTotaal((t) => t + punten(rest));
    // Elke vijfde op rij krijgt zijn eigen klank. Elke goede opgave belonen met
    // twee geluiden tegelijk wordt lawaai; om de vijf is het een mijlpaal.
    setReeks((s) => { const n = s + 1; if (n % 5 === 0) sound.reeks(); setBeste((b) => Math.max(b, n)); return n; });
    volgende();
  }, [fase, opgave, rest, mis, volgende]);

  const stop = () => setFase("klaar");

  // Tijdens het aftellen is er nog geen opgave, dus dan is de lijn gewoon goud.
  const inktNu = fase === "tel" ? "#FFD98A" : opgave.inkt.inkt;

  return (
    <>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, paddingBottom: 24 }}>
        <Sectie art="/ui/soep/scorebord.webp?v=1" verhouding={SCORE_V}>
          <Meter kop="RONDE" waarde={String(ronde)} breuk={SCORE_RUIT.links} />
          <Meter kop="PUNTEN" waarde={String(totaal)} breuk={SCORE_RUIT.rechts} />
        </Sectie>

        <Sectie art="/ui/soep/bord.webp?v=1" verhouding={BORD_V}>
          {/* De regel staat in de kop van het paneel en NIET bij het woord: daar
              zou je hem lezen als onderdeel van de opgave. */}
          <div
            style={{
              position: "absolute", left: 0, right: 0,
              top: pct(PANEEL_TOP), height: pct(VENSTER.t - PANEEL_TOP),
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
            }}
          >
            <span
              style={{
                fontFamily: font.wide, fontSize: 14, letterSpacing: 2.4,
                color: "#FFD98A",
                textShadow: `0 0 10px ${withAlpha("#FFB43C", 0.6)}`,
              }}
            >
              {fase === "klaar" ? "KLEURENKLEM" : "KIES HET WOORD"}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, color: withAlpha("#FFE7A8", 0.72) }}>
              {fase === "klaar" ? (
                <>ronde {ronde} · langste reeks {beste}</>
              ) : fase === "tel" ? (
                <span>maak je klaar</span>
              ) : (
                <>
                  {Array.from({ length: LEVENS }, (_, i) => (
                    <span
                      key={i}
                      aria-hidden
                      style={{
                        width: 7, height: 7, borderRadius: 2, transform: "rotate(45deg)",
                        background: i < levens ? "#FFC23D" : withAlpha("#FFE7A8", 0.16),
                        boxShadow: i < levens ? "0 0 7px rgba(255,180,50,.7)" : undefined,
                      }}
                    />
                  ))}
                  {reeks >= 3 && <span style={{ marginLeft: 4, color: "#FFB65A" }}>reeks {reeks}</span>}
                </>
              )}
            </span>
          </div>

          {fase === "klaar" ? (
            <div
              style={{
                position: "absolute",
                left: pct(VENSTER.l), right: pct(VENSTER.r), top: pct(VENSTER.t), bottom: pct(VENSTER.b),
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 46, lineHeight: 1, color: "#FFF3D0", textShadow: "0 0 18px rgba(255,190,60,.55)" }}>{totaal}</span>
              <span style={{ fontFamily: font.ui, fontSize: 12, color: withAlpha("#FFE7A8", 0.7) }}>punten</span>
            </div>
          ) : (
            <>
              {/* Het vak achter het woord draagt de INKT van dat woord, alleen
                  veel donkerder. Staat er ROOD in paarse letters, dan is het
                  vlak erachter ook paars. Zo liegt het hele paneel mee en zijn
                  de letters het enige wat waar is.
                  De wash blijft rond een derde en ligt op de donkere
                  paneelkleur, anders vallen de letters weg in hun eigen kleur;
                  de donkere slagschaduw eronder snijdt ze er hoe dan ook uit. */}
              <div
                style={{
                  position: "absolute",
                  left: pct(VENSTER.l), right: pct(VENSTER.r), top: pct(VENSTER.t + 0.02),
                  height: pct(0.24),
                  display: "grid", placeItems: "center", overflow: "hidden",
                  clipPath: VAK_VORM,
                  // Drie trappen van dezelfde kleur: de letters op vol, de klem
                  // op 62 procent, het vak op 34. Zo is alles in beeld dezelfde
                  // kleur als de inkt en blijven de letters er toch uit komen.
                  backgroundColor: donkerder(inktNu, 0.34),
                  backgroundImage: "radial-gradient(125% 155% at 50% 14%, rgba(255,255,255,.09) 0%, rgba(255,255,255,.03) 46%, rgba(0,0,0,.16) 100%)",
                }}
              >
                {fase === "spel" && <Klem rest={rest} inkt={inktNu} />}
                <span
                  key={fase === "tel" ? `tel-${tel}` : `woord-${ronde}`}
                  className="klem-kom"
                  style={{
                    position: "relative", zIndex: 2,
                    fontFamily: font.display, fontWeight: 800, fontSize: fase === "tel" ? 52 : 40, letterSpacing: 1.5, lineHeight: 1,
                    color: inktNu,
                    textShadow: `0 0 14px ${withAlpha(inktNu, 0.5)}, 0 1px 4px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.7)`,
                  }}
                >
                  {fase === "tel" ? tel : opgave.woord.naam}
                </span>
                <WoordVak kleur={inktNu} id={fase === "tel" ? "tel" : opgave.inkt.key} />
              </div>

              {/* De knoppen. Altijd twee volle rijen, dus vier kleuren worden
                  2x2 en zes worden 3x2. Een raster met een losse knop op de
                  tweede rij leest als een fout, en bij zeven tienden seconde is
                  een grote trefkans geen luxe maar de helft van het spel. */}
              <div
                style={{
                  position: "absolute",
                  left: pct(VENSTER.l), right: pct(VENSTER.r),
                  top: pct(VENSTER.t + 0.29), bottom: pct(VENSTER.b),
                  display: "grid",
                  gridTemplateColumns: `repeat(${trap.kleuren <= 4 ? 2 : 3}, 1fr)`,
                  alignContent: "center", gap: 10,
                  opacity: fase === "tel" ? 0.4 : 1,
                  transition: "opacity .25s ease-out",
                }}
              >
                {opgave.keuzes.map((k) => (
                  <KleurKnop
                    key={k.key}
                    kleur={k}
                    staat={
                      fase === "tel" ? "dood"
                      : oordeel?.key === k.key ? (oordeel.goed ? "goed" : "fout")
                      : oordeel && !oordeel.goed ? "dood"
                      : "rust"
                    }
                    onKies={() => kies(k)}
                  />
                ))}
              </div>
            </>
          )}
        </Sectie>

        <Sectie art="/ui/soep/onder.webp?v=1" verhouding={ONDER_V}>
          <div
            style={{
              position: "absolute",
              left: pct(ONDER_RUIT.l), width: pct(ONDER_RUIT.b),
              top: pct(ONDER_RUIT.t), height: pct(ONDER_RUIT.h),
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}
          >
            {fase === "klaar" ? (
              <span style={{ fontFamily: font.wide, fontSize: 18, letterSpacing: 2.2, color: "#FFF3D0" }}>
                LEVENS OP · RONDE {ronde}
              </span>
            ) : (
              <span style={{ fontFamily: font.ui, fontSize: 11.5, color: withAlpha("#FFE7A8", 0.6), textAlign: "center" }}>
                {"tik de kleur die er STAAT, niet de kleur van de letters"}
              </span>
            )}
          </div>
        </Sectie>

        {/* Dezelfde pil als in de arena: zwarte vulling, want hij ligt op de
            zaal en zonder vulling loopt die er dwars doorheen. */}
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

/** De testversie achter `?klem`: eigen kop, eigen sleutel, levert niets in. */
export function PreviewKleurenklem() {
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
      {/* De key is de herstart: een nieuw potje remount alles, dus er blijft
          geen half opgeruimde staat hangen. */}
      <Kleurenklem key={potje} seed={potje} onOpnieuw={() => setPotje(versSleutel())} />
    </Screen>
  );
}

export default PreviewKleurenklem;
