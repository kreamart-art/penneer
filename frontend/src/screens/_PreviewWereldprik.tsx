// WERELDPRIK, het arenaspel van zondag. Speelbare testversie achter ?prik in de
// url (eigen brok, dus wie hem niet opent downloadt hem ook niet).
//
// HET SPEL: er staat een plek op het bord en jij wijst hem aan op de
// wereldkaart. Hoe dichter je zit, hoe meer punten. Zit je verder dan de
// tolerantie van die ronde, dan is het voorbij. Eén prik per ronde, geen levens.
//
// WAAROM DIT NAAST DE ANDERE ZES PAST: dit is het enige spel waarin je niets
// hoeft te lezen, te rekenen of te typen. Je weet het of je weet het niet, en de
// rest is je duim. Het topografiedeel van de dagronde vraagt naar namen; dit
// vraagt naar PLEKKEN, en dat is een ander soort weten.
//
// DE KAART is zelf getekend uit Natural Earth, in vlakke plaatprojectie:
//
//     x = (lengte + 180) / 360
//     y = (84 - breedte) / 142
//
// Dat is geen decor maar het rekenwerk: de punten volgen uit de afstand tussen
// waar je prikt en waar de plek echt ligt, dus de projectie moet exact bekend
// zijn. Antarctica valt buiten de uitsnede (noordpunt -63); alles wat een doel
// kan zijn past erin, tot Noord-Groenland aan toe.
//
// DE LOEP is geen versiering. De hele wereld is op een telefoon ruim driehonderd
// punten breed, en dan is één punt honderd kilometer: met een duim erop zie je
// niet waar je staat. Zolang je drukt staat er dus een vergrootglas boven je
// vinger met het kruis erin, en pas als je LOSLAAT telt de prik. Zo kun je
// bijsturen zonder dat je hoeft te mikken.
//
// CEILINGLOOS: ronde k is k keer zoveel waard als ronde 1, en de doelen worden
// bekender naar onbekender. Er is geen laatste ronde.
//
// Het puntencontract met de server staat in backend/app/arena.py onder
// "wereldprik": ronde k levert hoogstens 200k op, dus na `level` ronden staat er
// hoogstens 100 * level * (level + 1). Wijkt de een af van de ander, dan keurt
// de server een eerlijke poging af.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Screen } from "../components/Layout";
import { Scorebord, WERELD_PLAAT } from "../components/Scorebord";
import { KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { Klokbalk, SECTIE, SomVenster, TabKader } from "./_PreviewRekenladder";
import { DOELEN, PER_TIER, type Doel } from "../data/wereld";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

// ---- de kaart ---------------------------------------------------------------
/** De uitsnede van de plaat. Moet gelijk lopen met het script dat hem tekent
 *  (scratchpad/kaart.py); staat het hier anders, dan wijst elke prik ernaast. */
const LAT_BOVEN = 84;
const LAT_ONDER = -58;
const KAART = "/ui/wereld/kaart.webp?v=1";
/** Breed op hoog, uit dezelfde twee getallen: 360 graden lengte op 142 breedte. */
const KAART_VERH = 360 / (LAT_BOVEN - LAT_ONDER);
/** Hoe breed de kaart op het scherm staat. Zo breed als er is: de hoogte volgt
 *  uit de projectie (ruim tweeënhalf keer zo breed als hoog), dus alles wat je
 *  aan breedte inlevert lever je twee keer in aan aanwijsbaarheid. */
const KAART_BREED = "min(420px, 96vw)";

/** Waar een plek op de kaart staat, als deel van breedte en hoogte (0 tot 1). */
export function naarVak(la: number, lo: number): { x: number; y: number } {
  return { x: (lo + 180) / 360, y: (LAT_BOVEN - la) / (LAT_BOVEN - LAT_ONDER) };
}

/** En terug: waar je prikte, in graden. */
export function naarGraden(x: number, y: number): { la: number; lo: number } {
  return { la: LAT_BOVEN - y * (LAT_BOVEN - LAT_ONDER), lo: x * 360 - 180 };
}

/** Hemelsbrede afstand in kilometers (haversine, straal 6371).
 *
 *  Niet pythagoras op de kaartcoördinaten, en dat is geen muggenzifterij: op
 *  deze projectie is een graad lengte bij de evenaar 111 kilometer en bij
 *  Reykjavik nog maar 48. Wie IJsland aanwijst zou anders systematisch te veel
 *  punten krijgen en wie Kenia aanwijst te weinig. */
export function afstandKm(a: readonly [number, number], b: readonly [number, number]): number {
  const r = Math.PI / 180;
  const la1 = a[0] * r, la2 = b[0] * r;
  const h =
    Math.sin((la2 - la1) / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Hoe ver je ernaast mag zitten in ronde `k`, in kilometers.
 *
 *  Ruim aan het begin (een werelddeel raken is genoeg) en daarna elke ronde
 *  scherper, tot een bodem van achthonderd. Lager kan niet: de kaart is op een
 *  telefoon ruim driehonderd punten breed, dus achthonderd kilometer is daar een
 *  punt of zeven. Onder de dikte van een vingertop meten is geen aardrijkskunde
 *  meer maar een fijnmotoriektest. */
export const tolerantieVoor = (k: number) => Math.max(800, 2600 - 140 * (Math.max(1, k) - 1));

/** Wat een goede prik oplevert: honderd maal de ronde, plus nog eens zoveel naar
 *  rato van hoe dicht je zat. Ronde 1 is dus 100 tot 200 en ronde 20 is 2000 tot
 *  4000.
 *
 *  Maal de ronde en niet vast, om dezelfde reden als bij de Rekenladder: anders
 *  is de score gewoon "hoe lang deed je mee" en liggen twee spelers die allebei
 *  ver komen dicht bij elkaar. Zo lopen de eindstanden uiteen. Dat is
 *  arenaregel 1. */
export const puntenVoor = (ronde: number, nabij: number) =>
  100 * ronde + Math.round(100 * ronde * Math.max(0, Math.min(1, nabij)));

// ---- de doelen --------------------------------------------------------------
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

function schud<T>(rij: readonly T[], rng: () => number): T[] {
  const a = [...rij];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** De reeks doelen van een potje, van bekend naar onbekend.
 *
 *  Vier bakken, en per bak een eigen geschudde stapel. Zo komt er binnen een
 *  potje nooit twee keer hetzelfde doel langs, en krijgt iedereen op dezelfde
 *  seed dezelfde reeks: zonder dat laatste is de dagranglijst een loterij.
 *
 *  Vanaf ronde 13 komen de twee zwaarste bakken samen in één stapel. Vijfentwintig
 *  doelen in de zwaarste bak zou betekenen dat wie ver komt ze allemaal al heeft
 *  gehad; zo blijft er tot ver voorbij ronde honderd nieuw materiaal. */
export function reeksVoor(seed: string): Doel[][] {
  const rng = maakRng(seed);
  const t1 = schud(PER_TIER[0], rng);
  const t2 = schud(PER_TIER[1], rng);
  const t3 = schud(PER_TIER[2], rng);
  const laat = schud([...PER_TIER[3], ...PER_TIER[2]], rng);
  return [t1, t2, t3, laat];
}

/** Uit welke bak ronde `k` komt, en de hoeveelste uit die bak het is. */
export function bakVoor(k: number): { bak: number; nr: number } {
  if (k <= 3) return { bak: 0, nr: k - 1 };
  if (k <= 7) return { bak: 1, nr: k - 4 };
  if (k <= 12) return { bak: 2, nr: k - 8 };
  return { bak: 3, nr: k - 13 };
}

export function doelVoor(reeks: Doel[][], k: number): Doel {
  const { bak, nr } = bakVoor(k);
  const stapel = reeks[bak].length ? reeks[bak] : DOELEN;
  return stapel[nr % stapel.length];
}

// ---- de onderdelen op de kaart ---------------------------------------------
type Punt = { x: number; y: number };

/** Het kruis waar je prikt. Rood met een witte kern: die twee zijn op elke
 *  ondergrond te zien, en dat is nodig, want de kaart is goud en de zee bijna
 *  zwart. */
function Kruis({ p, klein = false }: { p: Punt; klein?: boolean }) {
  const r = klein ? 7 : 9;
  return (
    <span
      aria-hidden
      style={{
        position: "absolute", left: `${p.x * 100}%`, top: `${p.y * 100}%`,
        width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r,
        borderRadius: "50%",
        border: "2px solid #FF5A4E",
        boxShadow: "0 0 8px rgba(255,90,78,.8), inset 0 0 4px rgba(255,255,255,.6)",
        pointerEvents: "none",
      }}
    >
      <span style={{ position: "absolute", left: "50%", top: "50%", width: 3, height: 3, marginLeft: -1.5, marginTop: -1.5, borderRadius: "50%", background: "#FFF" }} />
    </span>
  );
}

/** De speld van het antwoord: een gouden druppel met een ring die er één keer
 *  uit slaat, zodat je hem vindt ook als hij aan de andere kant van de wereld
 *  staat. De NAAM staat er niet bij: die staat onder de kaart, want op de kaart
 *  zelf ligt hij half in zee of over een buurland heen. */
function Speld({ p }: { p: Punt }) {
  return (
    <span
      aria-hidden
      style={{ position: "absolute", left: `${p.x * 100}%`, top: `${p.y * 100}%`, pointerEvents: "none" }}
    >
      <span
        className="prik-slag"
        style={{
          position: "absolute", left: -13, top: -13, width: 26, height: 26,
          borderRadius: "50%", border: "2px solid rgba(255,216,115,.9)",
        }}
      />
      <span
        style={{
          position: "absolute", left: -6, top: -6, width: 12, height: 12,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #FFF3C4, #F2AE33 60%, #A9701C)",
          boxShadow: "0 0 10px rgba(255,196,80,.9), 0 0 2px #fff",
        }}
      />
    </span>
  );
}

/** Het vergrootglas boven je vinger: dezelfde kaart, vier keer zo groot, met het
 *  kruis in het hart. Alleen zo weet je waar je staat terwijl je duim de plek
 *  bedekt. */
function Loep({ p, breed }: { p: Punt; breed: number }) {
  const MAAT = 96;
  const ZOOM = 4;
  const kaartBreed = breed * ZOOM;
  const kaartHoog = kaartBreed / KAART_VERH;
  // Boven je vinger, want daar komt hij vandaan: onder je vinger zou het glas
  // achter je hand liggen. Alleen in de bovenste kwart van de kaart wijkt hij
  // naar beneden, anders zou hij precies de naam bedekken die je aan het lezen
  // bent. Zijwaarts blijft hij binnen de kaart, anders loopt hij het scherm uit.
  const boven = p.y > 0.25;
  const links = Math.min(Math.max(p.x * breed, MAAT / 2 + 2), breed - MAAT / 2 - 2);
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: links, top: `${p.y * 100}%`,
        width: MAAT, height: MAAT, marginLeft: -MAAT / 2,
        marginTop: boven ? -MAAT - 18 : 18,
        borderRadius: "50%", overflow: "hidden",
        border: "2px solid rgba(242,174,51,.75)",
        boxShadow: "0 0 0 1px rgba(0,0,0,.6), 0 6px 18px rgba(0,0,0,.6), 0 0 16px rgba(242,174,51,.35)",
        background: "#080418",
        pointerEvents: "none",
      }}
    >
      <img
        src={KAART} alt="" draggable={false}
        style={{
          position: "absolute", width: kaartBreed, height: kaartHoog, maxWidth: "none",
          left: MAAT / 2 - p.x * kaartBreed,
          top: MAAT / 2 - p.y * kaartHoog,
          WebkitUserSelect: "none", userSelect: "none", pointerEvents: "none",
        } as React.CSSProperties}
      />
      <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, marginLeft: -0.5, background: "rgba(255,90,78,.55)" }} />
      <span style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, marginTop: -0.5, background: "rgba(255,90,78,.55)" }} />
      <span
        style={{
          position: "absolute", left: "50%", top: "50%", width: 14, height: 14, marginLeft: -7, marginTop: -7,
          borderRadius: "50%", border: "2px solid #FF5A4E", boxShadow: "0 0 6px rgba(255,90,78,.9)",
        }}
      />
    </span>
  );
}

/** De kaart zelf, met alles wat erop ligt.
 *
 *  De aanraking loopt over pointer-events en niet over een klik: een klik weet
 *  pas achteraf waar hij viel, en dan kun je niet bijsturen. Nu volgt het kruis
 *  je vinger en telt pas wat er staat als je loslaat. */
function Kaart({
  wijs, prik, doel, dichtst, actief, onWijs, onPrik,
}: {
  wijs: Punt | null;
  prik: Punt | null;
  doel: Doel | null;
  dichtst: Punt | null;
  actief: boolean;
  onWijs: (p: Punt | null) => void;
  onPrik: (p: Punt) => void;
}) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [breed, setBreed] = useState(340);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setBreed(el.getBoundingClientRect().width || 340);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Of er op DIT moment een vinger op de kaart ligt. Een ref en geen state, en
  // dat is geen detail: bij een snelle tik komen pointerdown en pointerup in
  // dezelfde taak binnen, en dan heeft React nog niet opnieuw getekend. Keek de
  // opvolger naar de STAAT, dan was die nog leeg en telde de prik niet. Wie kort
  // tikt hoort net zo goed te prikken als wie lang mikt.
  const drukt = useRef(false);

  const uitVak = (e: React.PointerEvent): Punt => {
    const r = (doos.current as HTMLDivElement).getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };

  const speld = doel ? naarVak(doel.la, doel.lo) : null;

  return (
    <div
      ref={doos}
      onPointerDown={(e) => {
        if (!actief) return;
        // Vangen: de aanwijzer blijft bij ons ook als je vinger buiten de kaart
        // komt, anders is een prik die net over de rand eindigt geen prik. De
        // try eromheen is geen sier: een aanwijzer die al losgelaten is bestaat
        // niet meer, en dan gooit deze aanroep.
        try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* niets */ }
        drukt.current = true;
        sound.uiTap();
        onWijs(uitVak(e));
      }}
      onPointerMove={(e) => { if (actief && drukt.current) onWijs(uitVak(e)); }}
      onPointerUp={(e) => {
        if (!actief || !drukt.current) return;
        drukt.current = false;
        onPrik(uitVak(e));
      }}
      onPointerCancel={() => { drukt.current = false; onWijs(null); }}
      className="prik-vlak"
      style={{
        // GEEN overflow hier. De loep hangt boven je vinger en steekt dus buiten
        // de kaart uit; knip je hem hier af, dan zie je een halve cirkel op de
        // kaartrand. Alles wat wel binnen de lijst hoort te blijven (de zee, de
        // plaat, de hulplijnen) zit daarom in een eigen geknipte laag hieronder.
        position: "relative", width: "100%", aspectRatio: `${KAART_VERH}`,
        touchAction: "none",
        cursor: actief ? "crosshair" : "default",
        WebkitTapHighlightColor: "transparent",
        // ZONDER DEZE DRIE IS HET SPEL OP IOS ONSPEELBAAR. Het mikken is
        // ingedrukt HOUDEN op een afbeelding, en dat is precies het gebaar
        // waarmee Safari na een halve seconde zijn eigen menu opent
        // ("Afbeelding bewaren"). Dan ligt er een systeemvenster over de kaart
        // terwijl de klok loopt. `touch-action` houdt dat niet tegen: dat gaat
        // over scrollen en zoomen, niet over de vergrootknop.
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      } as React.CSSProperties}
    >
     <div
       style={{
        position: "absolute", inset: 0, borderRadius: 10, overflow: "hidden",
        // De zee. Die zit niet in de plaat (die is land alleen, met een
        // doorzichtige oceaan) maar hier, zodat hij dezelfde diepte heeft als
        // elk ander donker vlak in de app.
        background:
          "radial-gradient(120% 150% at 50% 20%, #16103A 0%, #0A0620 62%, #05020E 100%)",
        boxShadow: "inset 0 0 0 1px rgba(154,75,240,.35), inset 0 2px 14px rgba(0,0,0,.7), 0 0 16px rgba(154,75,240,.18)",
       }}
     >
      <img
        src={KAART} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", maxWidth: "none", WebkitUserSelect: "none", userSelect: "none", pointerEvents: "none" } as React.CSSProperties}
      />
      {/* De breedtegraden als rustige hulplijnen: evenaar, keerkringen en de
          poolcirkel. Ze staan op hun ECHTE plek in de projectie, dus ze zijn
          ook meteen een controle op de kaart zelf. */}
      {[66.5, 23.4, 0, -23.4].map((la) => (
        <span
          key={la}
          aria-hidden
          style={{
            position: "absolute", left: 0, right: 0, top: `${naarVak(la, 0).y * 100}%`,
            height: 1, background: la === 0 ? "rgba(154,75,240,.30)" : "rgba(154,75,240,.16)",
          }}
        />
      ))}

      {/* De lijn van je prik naar het dichtstbijzijnde stukje van het doel: dat
          is precies de afstand die geteld is, dus wat je ziet is wat je krijgt. */}
      {prik && dichtst && (
        <svg
          viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        >
          <line
            x1={prik.x * 100} y1={prik.y * 100} x2={dichtst.x * 100} y2={dichtst.y * 100}
            stroke="#FF5A4E" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke"
            opacity={0.9}
          />
        </svg>
      )}

      {/* Het dichtstbijzijnde stukje van het doel, in de kleur van de LIJN en
          niet in die van de speld: dit hoort bij de meting, niet bij het
          antwoord. Zonder dit ringetje eindigt de lijn in het niets, en dat
          leest als een streep die nergens heen wijst. Bij een stad valt hij
          samen met de speld en laten we hem weg. */}
      {prik && dichtst && speld && (Math.abs(dichtst.x - speld.x) > 0.008 || Math.abs(dichtst.y - speld.y) > 0.02) && (
        <span
          aria-hidden
          style={{
            position: "absolute", left: `${dichtst.x * 100}%`, top: `${dichtst.y * 100}%`,
            width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5,
            borderRadius: "50%", border: "1.5px solid rgba(255,90,78,.9)",
            pointerEvents: "none",
          }}
        />
      )}
      {speld && prik && <Speld p={speld} />}
      {prik && <Kruis p={prik} />}
      {wijs && !prik && <Kruis p={wijs} klein />}
     </div>

      {/* De loep hangt BUITEN de geknipte laag, want hij steekt over de rand. */}
      {wijs && !prik && <Loep p={wijs} breed={breed} />}
    </div>
  );
}

/** De naam van het doel in het venster. Lange namen (Bosnië en Herzegovina,
 *  Verenigde Arabische Emiraten) passen niet op de maat van een korte, dus de
 *  letter krimpt tot hij past. Gemeten en niet op het aantal tekens geteld: een
 *  i is smaller dan een W. */
function Naam({ tekst }: { tekst: string }) {
  const doos = useRef<HTMLDivElement | null>(null);
  const span = useRef<HTMLSpanElement | null>(null);
  const [schaal, setSchaal] = useState(1);
  useEffect(() => {
    const meet = () => {
      const d = doos.current, s = span.current;
      if (!d || !s) return;
      const ruimte = d.clientWidth * 0.92;
      const vol = s.offsetWidth;
      setSchaal(vol > ruimte && vol > 0 ? ruimte / vol : 1);
    };
    meet();
    const d = doos.current;
    if (!d) return;
    const ro = new ResizeObserver(meet);
    ro.observe(d);
    return () => ro.disconnect();
  }, [tekst]);
  return (
    <div ref={doos} style={{ width: "100%", display: "grid", placeItems: "center" }}>
      <span
        ref={span}
        key={tekst}
        className="klem-kom"
        style={{
          whiteSpace: "nowrap", lineHeight: 1,
          fontFamily: font.display, fontWeight: 800, fontSize: 34, letterSpacing: 0.5,
          color: "#FFFFFF",
          textShadow: "0 0 18px rgba(255,210,120,.4), 0 2px 4px rgba(0,0,0,.8)",
          transform: schaal < 1 ? `scale(${schaal.toFixed(3)})` : undefined,
          transformOrigin: "center",
        }}
      >
        {tekst}
      </span>
    </div>
  );
}

// ---- het spel ---------------------------------------------------------------
const VENSTER = 15000;

/** De klok van de TESTVERSIE, in seconden achter `?prik=`. Dezelfde afspraak als
 *  `?reken=12` bij de Rekenladder: handig om de kaart na te lopen zonder dat de
 *  klok je eruit gooit. In de arena telt hij niet mee, want daar komt er een
 *  `onKlaar` binnen en dan staat de klok op de vaste vijftien seconden. */
function testVenster(): number {
  if (typeof location === "undefined") return VENSTER;
  const n = Number(new URLSearchParams(location.search).get("prik"));
  return Number.isFinite(n) && n >= 1 && n <= 600 ? n * 1000 : VENSTER;
}

type Uitslag = { km: number; punten: number; raak: boolean };

export function Wereldprik({ seed, onKlaar, onOpnieuw }: {
  seed: string;
  /** (score, level, ms) — level is het aantal ronden dat je GEHAALD hebt. */
  onKlaar?: (score: number, level: number, timeMs: number) => void;
  onOpnieuw?: () => void;
}) {
  const { t, lang } = useT();
  useEffect(() => {
    document.body.classList.add("wereldspel");
    return () => document.body.classList.remove("wereldspel");
  }, []);

  const reeks = useMemo(() => reeksVoor(seed), [seed]);
  const [ronde, setRonde] = useState(1);
  const [totaal, setTotaal] = useState(0);
  const [rest, setRest] = useState(1);
  const [fase, setFase] = useState<"spel" | "toon" | "klaar">("spel");
  const [wijs, setWijs] = useState<Punt | null>(null);
  const [prik, setPrik] = useState<Punt | null>(null);
  const [uitslag, setUitslag] = useState<Uitslag | null>(null);

  const doel = useMemo(() => doelVoor(reeks, ronde), [reeks, ronde]);
  const naam = lang === "en" ? doel.en : doel.nl;
  const tolerantie = tolerantieVoor(ronde);
  const venster = useMemo(() => (onKlaar ? VENSTER : testVenster()), [onKlaar]);

  const t0 = useRef(performance.now());
  const beslist = useRef(false);
  const ingeleverd = useRef(false);
  const timers = useRef<number[]>([]);
  const na = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // Het aantal GEHAALDE ronden, en dat is er één minder dan de ronde waarin je
  // strandde. De server rekent daarmee de bovengrens van je score uit.
  const gehaald = useRef(0);
  useEffect(() => {
    if (fase !== "klaar" || !onKlaar || ingeleverd.current) return;
    ingeleverd.current = true;
    onKlaar(totaal, gehaald.current, Math.round(performance.now() - t0.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const mis = useCallback(() => {
    if (beslist.current) return;
    beslist.current = true;
    sound.klemFout();
    setUitslag({ km: -1, punten: 0, raak: false });
    setFase("toon");
    na(1600, () => setFase("klaar"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // De klok van deze ronde. Op nul zonder prik is het voorbij: wachten mag geen
  // gratis ronde opleveren.
  useEffect(() => {
    if (fase !== "spel") return;
    beslist.current = false;
    setRest(1);
    const start = performance.now();
    let vraag = 0;
    const stap = () => {
      if (beslist.current) return;
      const over = 1 - (performance.now() - start) / venster;
      if (over <= 0) { setRest(0); mis(); return; }
      setRest(over);
      vraag = requestAnimationFrame(stap);
    };
    vraag = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(vraag);
  }, [ronde, fase, mis, venster]);

  /** Waar op de kaart het dichtstbijzijnde stukje van het doel ligt, en hoe ver
   *  dat is. Het is de afstand tot het NAASTE anker en niet tot het middelpunt:
   *  zie data/wereld.ts, want anders zit wie Moskou aanwijst voor Rusland
   *  drieduizend kilometer "ernaast" terwijl hij het gewoon goed heeft. */
  const dichtstbij = (p: Punt): { km: number; punt: Punt } => {
    const g = naarGraden(p.x, p.y);
    let beste = Infinity;
    let waar = doel.p[0];
    for (const anker of doel.p) {
      const d = afstandKm([g.la, g.lo], anker);
      if (d < beste) { beste = d; waar = anker; }
    }
    return { km: beste, punt: naarVak(waar[0], waar[1]) };
  };

  const [naaste, setNaaste] = useState<Punt | null>(null);

  const doePrik = (p: Punt) => {
    if (beslist.current || fase !== "spel") return;
    beslist.current = true;
    setWijs(null);
    setPrik(p);
    const { km, punt } = dichtstbij(p);
    setNaaste(punt);
    if (km > tolerantie) {
      sound.klemFout();
      setUitslag({ km: Math.round(km), punten: 0, raak: false });
      setFase("toon");
      na(2000, () => setFase("klaar"));
      return;
    }
    const nabij = 1 - km / tolerantie;
    const punten = puntenVoor(ronde, nabij);
    gehaald.current = ronde;
    sound.klemGoed();
    if (ronde % 5 === 0) sound.reeks();
    setUitslag({ km: Math.round(km), punten, raak: km < 60 });
    setTotaal((s) => s + punten);
    setFase("toon");
    na(1700, () => {
      setPrik(null);
      setNaaste(null);
      setUitslag(null);
      setRonde((k) => k + 1);
      setFase("spel");
    });
  };

  const stop = () => {
    if (fase === "klaar") return;
    beslist.current = true;
    setFase("klaar");
  };

  const kop =
    fase === "klaar" ? (gehaald.current === 1 ? t("prikGestrandEen") : t("prikGestrand", { n: gehaald.current }))
      : uitslag ? (uitslag.raak ? t("prikMiddenin") : uitslag.km < 0 ? t("prikTeLaat") : t("prikErnaast", { n: uitslag.km }))
        : t("prikWaarLigt");

  return (
    <div
      style={{
        position: "relative", flex: 1, width: "100%",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 9, paddingBottom: 24,
      }}
    >
      {/* Eigen bord: zwart met goud, met de wereldbol en de speld in het hart.
          Hij staat zo breed als de kaart eronder, want die twee horen als een
          geheel te lezen. */}
      <Scorebord
        plaat={WERELD_PLAAT}
        maat={30}
        breedte={KAART_BREED}
        links={{ kop: t("prikRonde"), waarde: String(ronde) }}
        rechts={{ kop: t("soepPunten"), waarde: String(totaal) }}
      />

      <div style={{ width: SECTIE, marginTop: 12 }}>
        <TabKader titel="WERELDPRIK">
          <span
            style={{
              height: 20, display: "grid", placeItems: "center",
              whiteSpace: "nowrap", lineHeight: 1,
              fontFamily: font.display, fontWeight: 800, fontSize: 15.5, letterSpacing: 0.4,
              color: uitslag && !uitslag.punten ? "#FF8E86" : uitslag ? "#9BE8A0" : "#FFFFFF",
              textShadow: "0 2px 6px rgba(0,0,0,.6)",
            }}
          >
            {kop}
          </span>

          <SomVenster>
            {fase === "klaar" ? (
              <span
                className="klem-kom"
                style={{
                  lineHeight: 1, fontFamily: font.display, fontWeight: 800, fontSize: 44,
                  color: "#FFFFFF", textShadow: "0 0 18px rgba(255,210,120,.4), 0 2px 4px rgba(0,0,0,.8)",
                }}
              >
                {totaal}
              </span>
            ) : (
              <Naam tekst={naam} />
            )}
          </SomVenster>

          {fase === "spel" ? (
            <Klokbalk rest={rest} seconden={Math.max(0, Math.ceil((rest * venster) / 1000))} />
          ) : (
            <span
              style={{
                height: 38, display: "grid", placeItems: "center",
                fontFamily: font.display, fontWeight: 800, fontSize: 17,
                color: uitslag?.punten ? "#FFD873" : withAlpha("#FFE7A8", 0.6),
              }}
            >
              {uitslag?.punten ? `+${uitslag.punten}` : ""}
            </span>
          )}
        </TabKader>
      </div>

      {/* De kaart staat BREDER dan het vraagpaneel, en dat is geen smaak: elke
          punt breedte is hier honderd kilometer nauwkeurigheid. Op 96vw is de
          wereld op een telefoon van 393 punten 377 breed in plaats van de 322
          van de sectie, en dat scheelt een vijfde in wat je kunt aanwijzen. */}
      <div style={{ width: KAART_BREED, marginTop: 4 }}>
        <Kaart
          wijs={wijs}
          prik={prik}
          doel={fase === "spel" ? null : doel}
          dichtst={naaste}
          actief={fase === "spel"}
          onWijs={setWijs}
          onPrik={doePrik}
        />
        {/* De naam onder de kaart en niet erop: op de kaart ligt hij half in
            zee of over een buurland heen, en dan lees je hem net niet. */}
        <div style={{ height: 20, marginTop: 6, display: "grid", placeItems: "center" }}>
          {fase !== "spel" ? (
            <span style={{ fontFamily: font.ui, fontSize: 12.5, fontWeight: 700, color: "#FFE7A8" }}>
              {naam}
            </span>
          ) : (
            <span style={{ fontFamily: font.ui, fontSize: 11.5, color: withAlpha("#FFE7A8", 0.55) }}>
              {t("prikHint", { n: Math.round(tolerantie) })}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <NeonKader radius={999} dik={0.5} vulling="zwart" lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
          <button
            onClick={fase === "klaar" ? onOpnieuw : stop}
            className="pressable"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
          >
            <LogOut size={14} /> {fase === "klaar" ? t("arenaOpnieuw") : t("arenaStop")}
          </button>
        </NeonKader>
      </div>
    </div>
  );
}

/** De testversie achter `?prik`: eigen kop, eigen sleutel, levert niets in. */
export function PreviewWereldprik() {
  const vers = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const [potje, setPotje] = useState(vers);
  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>Arena</span>
          <button
            onClick={() => setPotje(vers())}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, color: colors.redHi }}
          >
            testversie, telt niet mee
          </button>
        </div>
      }
    >
      <Wereldprik key={potje} seed={potje} onOpnieuw={() => setPotje(vers())} />
    </Screen>
  );
}

export default PreviewWereldprik;
