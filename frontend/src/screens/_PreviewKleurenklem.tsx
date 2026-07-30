// KLEURENKLEM, het arenaspel van zaterdag. Speelbare testversie achter ?klem
// in de url (eigen brok, dus wie hem niet opent downloadt hem ook niet).
//
// HET SPEL is de Stroop-test: er staat een KLEURNAAM op het scherm, in een INKT
// die daar meestal niet mee klopt. Je tikt de kleur van de inkt, niet het woord
// dat er staat. Je hersenen lezen sneller dan ze kijken, dus dat vecht tegen
// elkaar, en dat gevecht IS het spel.
//
// DE KLEM is de tijd. Per opgave sluiten twee kaken op het woord; raken ze
// elkaar, dan ben je te laat. Elke ronde sluiten ze sneller. Dat is ook waar de
// naam vandaan komt: niet jij loopt uit de tijd, de tijd loopt op jou dicht.
//
// DE OMKERING. Vanaf ronde acht draait de regel om: dan moet je juist het WOORD
// kiezen en de inkt negeren. Daarna wisselt hij elke zes rondes. Het moment van
// wisselen is expres luid (banner + het paneel kleurt), want een stille wissel
// is geen uitdaging maar een streek.
//
// VAN MAKKELIJK NAAR MOEILIJK, dezelfde ladder-gedachte als in Lettersoep:
// ronde 1 heeft vier kleuren, ruim twee seconden en meestal een woord dat wél
// klopt met zijn inkt. Ronde 25 heeft zes kleuren, zeven tienden van een
// seconde en bijna altijd een botsing. Zie LADDER.
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
const ACHT = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;

const PANEEL = "#1D0C29";

// ---- de kleuren -------------------------------------------------------------
//
// Zes hues die ook náást elkaar op een donkerpaars paneel uit elkaar te houden
// zijn. Paars zit er met opzet NIET bij: de hele app is paars, dus een paarse
// knop op een paars paneel is geen keuze maar een gok. Roze doet hetzelfde werk
// en blijft leesbaar. Per kleur een reeks van drie: diep, vlak, fel.
type Kleur = { key: string; naam: string; diep: string; vlak: string; fel: string; inkt: string };

const KLEUREN: Kleur[] = [
  { key: "rood", naam: "ROOD", diep: "#5E0A0C", vlak: "#C51F26", fel: "#FF6A63", inkt: "#FF4A44" },
  { key: "oranje", naam: "ORANJE", diep: "#5A2A00", vlak: "#D2700B", fel: "#FFB65A", inkt: "#FF9A2E" },
  { key: "geel", naam: "GEEL", diep: "#54430A", vlak: "#C9A214", fel: "#FFE773", inkt: "#FFD63D" },
  { key: "groen", naam: "GROEN", diep: "#0A4423", vlak: "#1E9350", fel: "#63E39B", inkt: "#3FD37E" },
  { key: "blauw", naam: "BLAUW", diep: "#0A2A5E", vlak: "#1E63C8", fel: "#6FAEFF", inkt: "#4A97FF" },
  { key: "roze", naam: "ROZE", diep: "#5A0A38", vlak: "#C41E78", fel: "#FF7CC0", inkt: "#FF5FAE" },
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
type Trap = { kleuren: number; venster: number; botsing: number; regel: Regel };
type Regel = "inkt" | "woord";

const OMKEER_VANAF = 8;
const OMKEER_ELKE = 6;

export function trapVoor(ronde: number): Trap {
  const r = Math.max(1, ronde);
  // Vier of zes, nooit vijf: vijf knoppen worden een rij van drie met een rij
  // van twee eronder, en dat leest als een fout in de opmaak. Vier is 2x2, zes
  // is 3x2, allebei recht.
  const kleuren = r <= 6 ? 4 : 6;
  const venster = Math.max(700, 2300 - (r - 1) * 90);
  const botsing = Math.min(0.9, 0.2 + (r - 1) * 0.06);
  // Elke blok van OMKEER_ELKE rondes na de eerste omkering draait de regel om.
  const blok = r < OMKEER_VANAF ? 0 : Math.floor((r - OMKEER_VANAF) / OMKEER_ELKE) + 1;
  return { kleuren, venster, botsing, regel: blok % 2 === 1 ? "woord" : "inkt" };
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

/** Eén opgave voor deze ronde. De keuzeknoppen bevatten ALTIJD het goede
 *  antwoord en, als de opgave botst, ook de afleider: het woord dat er staat.
 *  Anders zou je bij een botsing kunnen winnen door de valstrik simpelweg niet
 *  te zien staan, en dan test het spel niets meer. */
function maakOpgave(seed: string, trap: Trap, dwingBotsing = false): Opgave {
  const rng = maakRng(seed);
  const pak = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const pot = KLEUREN.slice(0, trap.kleuren);

  const woord = pak(pot);
  // Bij een kloppend woord maakt de regel niet uit, dus dan is de opgave in de
  // ronde waarin de regel net omdraaide een cadeautje na een luide waarschuwing.
  // Die ronde botst altijd.
  const botst = dwingBotsing || rng() < trap.botsing;
  const inkt = botst ? pak(pot.filter((k) => k.key !== woord.key)) : woord;
  const goed = trap.regel === "inkt" ? inkt : woord;

  const moet = [goed, ...(botst ? [trap.regel === "inkt" ? woord : inkt] : [])];
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

/** Een kleurknop: een gem in zijn eigen reeks. De rand is de padding-truc (een
 *  laag met het verloop, met daarop een iets kleinere laag met de vulling), want
 *  een border volgt de rechthoek en niet de afgeschuinde vorm. De glans zit als
 *  eigen laagje bovenop en alleen in de bovenste helft, anders leest hij als een
 *  lichter vlak in plaats van als licht. */
function KleurKnop({ kleur, staat, hoog, onKies }: { kleur: Kleur; staat: "rust" | "goed" | "fout" | "dood"; hoog: number; onKies: () => void }) {
  const dood = staat === "dood";
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); if (!dood) onKies(); }}
      disabled={dood}
      aria-label={kleur.naam.toLowerCase()}
      style={{
        position: "relative", padding: 1.6, border: "none", background: "transparent",
        clipPath: ACHT(11), cursor: dood ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
        filter: dood ? "grayscale(.7) brightness(.55)" : undefined,
        transform: staat === "goed" ? "scale(1.06)" : staat === "fout" ? "scale(.94)" : "scale(1)",
        transition: "transform .12s ease-out",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute", inset: 0, clipPath: ACHT(11),
          background: `linear-gradient(160deg, ${kleur.fel} 0%, ${kleur.vlak} 34%, ${kleur.diep} 72%, ${kleur.vlak} 100%)`,
          boxShadow: staat === "goed" ? `0 0 18px 2px ${withAlpha(kleur.fel, 0.75)}` : undefined,
        }}
      />
      <span
        style={{
          position: "relative", display: "grid", placeItems: "center",
          width: "100%", height: hoog, clipPath: ACHT(10),
          background: `linear-gradient(180deg, ${kleur.vlak} 0%, ${kleur.diep} 78%, ${withAlpha(kleur.diep, 0.9)} 100%)`,
          boxShadow: `inset 0 -7px 12px -6px rgba(0,0,0,.75)`,
        }}
      >
        {/* De korte glans, alleen bovenin en met een eigen breedte. */}
        <span aria-hidden style={{ position: "absolute", left: "14%", right: "14%", top: 3, height: "34%", borderRadius: 999, background: `linear-gradient(180deg, ${withAlpha("#FFFFFF", 0.34)} 0%, ${withAlpha("#FFFFFF", 0.05)} 70%, transparent 100%)` }} />
        <span aria-hidden style={{ width: 18, height: 18, borderRadius: 6, background: `radial-gradient(circle at 34% 30%, ${kleur.fel} 0%, ${kleur.vlak} 58%, ${kleur.diep} 100%)`, boxShadow: `0 0 12px ${withAlpha(kleur.fel, 0.65)}, inset 0 1px 1.5px ${withAlpha("#FFFFFF", 0.55)}` }} />
      </span>
    </button>
  );
}

/** De klem: twee kaken die op het woord dichtlopen. Ze staan in dezelfde doos
 *  als het woord, en hun breedte IS de resterende tijd; er is dus geen aparte
 *  balk nodig die hetzelfde nog eens vertelt. */
function Klem({ rest, alarm }: { rest: number; alarm: boolean }) {
  const dicht = (1 - rest) * 0.5;
  const kleur = alarm ? "#FF5A4E" : "#FFC23D";
  const kaak = (kant: "left" | "right"): React.CSSProperties => ({
    position: "absolute", top: 0, bottom: 0, [kant]: 0, width: pct(dicht),
    background: `linear-gradient(${kant === "left" ? "90deg" : "270deg"}, ${withAlpha(kleur, 0.02)} 0%, ${withAlpha(kleur, 0.14)} 62%, ${withAlpha(kleur, 0.42)} 92%, ${withAlpha(kleur, 0.95)} 100%)`,
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
export function PreviewKleurenklem() {
  useEffect(() => {
    document.body.classList.add("soepspel");
    return () => document.body.classList.remove("soepspel");
  }, []);

  const [potje, setPotje] = useState(versSleutel);
  const [ronde, setRonde] = useState(startRonde);
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

  const trap = useMemo(() => trapVoor(ronde), [ronde]);
  const vorigeRegel = useMemo(() => trapVoor(Math.max(1, ronde - 1)).regel, [ronde]);
  const netGedraaid = ronde > 1 && trap.regel !== vorigeRegel;
  const opgave = useMemo(() => maakOpgave(`${potje}:${ronde}`, trap, netGedraaid), [potje, ronde, trap, netGedraaid]);

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
    const duur = trap.venster + (netGedraaid ? 500 : 0);
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
    sound.uiTap();
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
    sound.approve();
    setOordeel({ key: k.key, goed: true });
    setTotaal((t) => t + punten(rest));
    setReeks((s) => { const n = s + 1; setBeste((b) => Math.max(b, n)); return n; });
    volgende();
  }, [fase, opgave, rest, mis, volgende]);

  const stop = () => setFase("klaar");
  const opnieuw = () => {
    setPotje(versSleutel());
    setRonde(startRonde()); setTotaal(0); setLevens(LEVENS); setRest(1);
    setOordeel(null); setReeks(0); setBeste(0); setTel(3); setFase("tel");
  };

  const alarm = rest < 0.34;
  const regelTekst = trap.regel === "inkt" ? "KIES DE INKTKLEUR" : "KIES HET WOORD";

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>Arena</span>
          <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>testversie</span>
        </div>
      }
    >
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
              key={`regel-${trap.regel}`}
              className={netGedraaid ? "klem-wissel" : undefined}
              style={{
                fontFamily: font.wide, fontSize: 14, letterSpacing: 2.4,
                color: netGedraaid ? "#FF9A2E" : "#FFD98A",
                textShadow: `0 0 10px ${withAlpha(netGedraaid ? "#FF9A2E" : "#FFB43C", 0.6)}`,
              }}
            >
              {fase === "klaar" ? "KLEURENKLEM" : regelTekst}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, color: withAlpha("#FFE7A8", 0.72) }}>
              {fase === "klaar" ? (
                <>ronde {ronde} · langste reeks {beste}</>
              ) : fase === "tel" ? (
                <span>maak je klaar</span>
              ) : netGedraaid ? (
                <span style={{ color: "#FFB65A" }}>de regel is omgedraaid</span>
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
              {/* Het woord met de klem eromheen. */}
              <div
                style={{
                  position: "absolute",
                  left: pct(VENSTER.l), right: pct(VENSTER.r), top: pct(VENSTER.t + 0.02),
                  height: pct(0.24),
                  display: "grid", placeItems: "center", overflow: "hidden",
                  clipPath: ACHT(10),
                  background: `radial-gradient(120% 140% at 50% 20%, ${withAlpha("#3A1B52", 0.85)} 0%, ${withAlpha(PANEEL, 0.92)} 70%)`,
                }}
              >
                {fase === "spel" && <Klem rest={rest} alarm={alarm} />}
                <span
                  key={fase === "tel" ? `tel-${tel}` : `woord-${ronde}`}
                  className="klem-kom"
                  style={{
                    position: "relative", zIndex: 2,
                    fontFamily: font.display, fontWeight: 800, fontSize: fase === "tel" ? 52 : 40, letterSpacing: 1.5, lineHeight: 1,
                    color: fase === "tel" ? "#FFD98A" : opgave.inkt.inkt,
                    textShadow: `0 0 16px ${withAlpha(fase === "tel" ? "#FFB43C" : opgave.inkt.inkt, 0.55)}, 0 2px 3px rgba(0,0,0,.6)`,
                  }}
                >
                  {fase === "tel" ? tel : opgave.woord.naam}
                </span>
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
                    hoog={trap.kleuren <= 4 ? 66 : 56}
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
                {trap.regel === "inkt"
                  ? "tik de kleur waarin het woord geschreven staat"
                  : "tik de kleur die het woord NOEMT, niet de inkt"}
              </span>
            )}
          </div>
        </Sectie>

        <button
          onClick={fase === "klaar" ? opnieuw : stop}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
        >
          <LogOut size={14} /> {fase === "klaar" ? "Opnieuw" : "Stoppen"}
        </button>
      </div>
    </Screen>
  );
}

export default PreviewKleurenklem;
