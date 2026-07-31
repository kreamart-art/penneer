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

/** De maten van het somvak, waar de lijn en de vulling allebei uit komen. Zie
 *  de les uit Kleurenklem: een SVG die met `preserveAspectRatio="none"` wordt
 *  uitgerekt en een clip-path in vaste pixels zijn TWEE vormen. */
const VAK_MAAT = { B: 319, H: 104, c: 16, m: 2.4 };
const VAK_VORM = (() => {
  const { B, H, c, m } = VAK_MAAT;
  const x = (v: number) => `${((v / B) * 100).toFixed(3)}%`;
  const y = (v: number) => `${((v / H) * 100).toFixed(3)}%`;
  return `polygon(${x(c + m)} ${y(m)}, ${x(B - c - m)} ${y(m)}, ${x(B - m)} ${y(c + m)}, ${x(B - m)} ${y(H - c - m)}, ${x(B - c - m)} ${y(H - m)}, ${x(c + m)} ${y(H - m)}, ${x(m)} ${y(H - c - m)}, ${x(m)} ${y(c + m)})`;
})();

const PANEEL = "#0F1B2E";
const LICHT = "#7BD8FF";

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

// ---- bouwstenen -------------------------------------------------------------
function Sectie({ art, verhouding, children }: { art: string; verhouding: number; children?: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: VAK, height: `calc(${VAK} / ${verhouding})`, flexShrink: 0 }}>
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", maxWidth: "none" }} />
      {children}
    </div>
  );
}

function Meter({ kop, waarde, breuk }: { kop: string; waarde: string; breuk: { l: number; b: number } }) {
  return (
    <div
      style={{
        position: "absolute",
        left: pct(breuk.l), width: pct(breuk.b),
        top: pct(SCORE_RUIT.t), height: pct(SCORE_RUIT.h),
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
      }}
    >
      <span style={{ fontFamily: font.ui, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: withAlpha("#FFE7A8", 0.72) }}>{kop}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 22, lineHeight: 1, color: "#FFF3D0" }}>{waarde}</span>
    </div>
  );
}

/** De lijst om het somvak: dezelfde gouden neonlijn als bij Kleurenklem, met de
 *  kleur van dit spel in het midden van het verloop. */
function SomVak({ kleur, id }: { kleur: string; id: string }) {
  const { B, H, c, m } = VAK_MAAT;
  const punten = [
    [c + m, m], [B - c - m, m], [B - m, c + m], [B - m, H - c - m],
    [B - c - m, H - m], [c + m, H - m], [m, H - c - m], [m, c + m],
  ].map((p) => p.join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3, overflow: "visible" }}>
      <defs>
        <linearGradient id={`rl-lijn-${id}`} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor="#B0710E" stopOpacity="0.7" />
          <stop offset="20%" stopColor="#FFD98A" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#FFF6DC" stopOpacity="1" />
          <stop offset="52%" stopColor={kleur} stopOpacity="1" />
          <stop offset="64%" stopColor="#FFF6DC" stopOpacity="1" />
          <stop offset="84%" stopColor="#FFD98A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#B0710E" stopOpacity="0.7" />
        </linearGradient>
        <filter id={`rl-bloei-${id}`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
      </defs>
      <polygon points={punten} fill="none" stroke="#FFB43C" strokeWidth="4.2" opacity="0.42" filter={`url(#rl-bloei-${id})`} />
      <polygon points={punten} fill="none" stroke={`url(#rl-lijn-${id})`} strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

/** De trap: de balk onder de som die leegloopt. Geen cijfers, want een aftellend
 *  getal naast een som die je moet uitrekenen vecht om dezelfde aandacht. */
function Trapbalk({ rest }: { rest: number }) {
  const kleur = rest < 0.3 ? "#FF5A4E" : LICHT;
  return (
    <span aria-hidden style={{ position: "absolute", left: "8%", right: "8%", bottom: "9%", height: 5, borderRadius: 3, background: "rgba(255,255,255,.09)", overflow: "hidden" }}>
      <span
        style={{
          display: "block", height: "100%", width: `${Math.max(0, Math.min(1, rest)) * 100}%`,
          background: `linear-gradient(90deg, ${withAlpha(kleur, 0.5)} 0%, ${kleur} 100%)`,
          boxShadow: `0 0 10px ${withAlpha(kleur, 0.6)}`,
        }}
      />
    </span>
  );
}

function AntwoordKnop({ waarde, staat, onKies }: { waarde: number; staat: "rust" | "goed" | "fout" | "dood"; onKies: () => void }) {
  const rand = staat === "goed" ? "#2FE06E" : staat === "fout" ? "#FF5A4E" : withAlpha(LICHT, 0.45);
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); if (staat === "rust") onKies(); }}
      disabled={staat === "dood"}
      className={staat === "fout" ? "klem-mis" : undefined}
      style={{
        position: "relative", border: "none", padding: 0, cursor: staat === "rust" ? "pointer" : "default",
        WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
        width: "100%", aspectRatio: "2.1 / 1", borderRadius: 12,
        background: "linear-gradient(180deg, rgba(24,42,70,.95) 0%, rgba(12,22,40,.95) 100%)",
        boxShadow: `inset 0 0 0 1.5px ${rand}, 0 0 ${staat === "rust" ? 0 : 14}px ${withAlpha(rand, 0.5)}`,
        opacity: staat === "dood" ? 0.35 : 1,
        transform: staat === "goed" ? "scale(1.05)" : "scale(1)",
        transition: "transform .12s ease-out, opacity .12s ease-out, box-shadow .12s ease-out",
        fontFamily: font.display, fontWeight: 800, fontSize: 26,
        color: staat === "fout" ? "#FF9A92" : "#EAF6FF",
      }}
    >
      {waarde}
    </button>
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
  const [oordeel, setOordeel] = useState<{ waarde: number; goed: boolean } | null>(null);
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

  const mis = useCallback(() => {
    if (beslist.current) return;
    beslist.current = true;
    sound.klemFout();
    setOordeel({ waarde: som.antwoord, goed: false });
    na(700, () => setFase("klaar"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [som]);

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
      if (over <= 0) { setRest(0); mis(); return; }
      setRest(over);
      vraag = requestAnimationFrame(stap);
    };
    vraag = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(vraag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potje, trede, fase]);

  const kies = useCallback((w: number) => {
    if (beslist.current || fase !== "spel") return;
    if (w !== som.antwoord) { setOordeel({ waarde: w, goed: false }); mis(); return; }
    beslist.current = true;
    sound.klemGoed();
    setOordeel({ waarde: w, goed: true });
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
        <Sectie art="/ui/soep/scorebord.webp?v=1" verhouding={SCORE_V}>
          <Meter kop="TREDE" waarde={String(trede)} breuk={SCORE_RUIT.links} />
          <Meter kop="PUNTEN" waarde={String(totaal)} breuk={SCORE_RUIT.rechts} />
        </Sectie>

        <Sectie art="/ui/soep/bord.webp?v=1" verhouding={BORD_V}>
          <div
            style={{
              position: "absolute", left: 0, right: 0,
              top: pct(PANEEL_TOP), height: pct(VENSTER.t - PANEEL_TOP),
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
            }}
          >
            <span style={{ fontFamily: font.wide, fontSize: 14, letterSpacing: 2.4, color: "#FFD98A", textShadow: `0 0 10px ${withAlpha("#FFB43C", 0.6)}` }}>
              {fase === "klaar" ? "REKENLADDER" : "WAT IS HET ANTWOORD"}
            </span>
            <span style={{ fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, color: withAlpha("#FFE7A8", 0.72) }}>
              {fase === "klaar" ? `trede ${trede}` : fase === "tel" ? "maak je klaar" : "een fout is meteen einde"}
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
              {/* De som. Hetzelfde vak als de letter bij Kleurenklem, dus de twee
                  spellen lijken familie zonder dat ze hetzelfde zijn. */}
              <div
                style={{
                  position: "absolute",
                  left: pct(VENSTER.l), right: pct(VENSTER.r), top: pct(VENSTER.t + 0.02),
                  height: pct(0.24),
                  display: "grid", placeItems: "center", overflow: "hidden",
                  clipPath: VAK_VORM,
                  backgroundColor: PANEEL,
                  backgroundImage: "radial-gradient(125% 155% at 50% 14%, rgba(123,216,255,.16) 0%, rgba(123,216,255,.06) 52%, rgba(0,0,0,.18) 100%)",
                }}
              >
                <span
                  key={fase === "tel" ? `tel-${tel}` : `som-${trede}`}
                  className="klem-kom"
                  style={{
                    position: "relative", zIndex: 2,
                    fontFamily: font.display, fontWeight: 800,
                    fontSize: fase === "tel" ? 52 : 36, letterSpacing: 1, lineHeight: 1,
                    color: "#EAF6FF",
                    textShadow: `0 0 14px ${withAlpha(LICHT, 0.5)}, 0 1px 4px rgba(0,0,0,.9)`,
                  }}
                >
                  {fase === "tel" ? tel : som.vraag}
                </span>
                {fase === "spel" && <Trapbalk rest={rest} />}
                <SomVak kleur={LICHT} id={String(trede)} />
              </div>

              {/* Vier antwoorden in 2x2. Altijd vier, altijd even groot: een
                  raster dat per som van vorm verandert kost je een halve tel om
                  opnieuw te lezen, en die halve tel heb je hier niet. */}
              <div
                style={{
                  position: "absolute",
                  left: pct(VENSTER.l), right: pct(VENSTER.r),
                  top: pct(VENSTER.t + 0.29), bottom: pct(VENSTER.b),
                  display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "4.5%", alignContent: "center",
                }}
              >
                {fase !== "tel" && som.keuzes.map((w) => (
                  <AntwoordKnop
                    key={w}
                    waarde={w}
                    staat={
                      !oordeel ? "rust"
                      : oordeel.waarde === w ? (oordeel.goed ? "goed" : "fout")
                      : w === som.antwoord && !oordeel.goed ? "goed"
                      : "dood"
                    }
                    onKies={() => kies(w)}
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
                GEVALLEN OP TREDE {trede}
              </span>
            ) : (
              <span style={{ fontFamily: font.ui, fontSize: 11.5, color: withAlpha("#FFE7A8", 0.6), textAlign: "center" }}>
                hoe hoger de trede, hoe meer elke som opbrengt
              </span>
            )}
          </div>
        </Sectie>

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
