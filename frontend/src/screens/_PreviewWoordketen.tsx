// Woordketen: het arenaspel van maandag.
//
// EEN KETTING DIE BLIJFT GROEIEN. Elk woord begint met de laatste letter van het
// vorige. Je typt niets, je TIKT: onder de ketting liggen woordtegels en precies
// een daarvan begint met de goede letter. Tik je hem aan, dan klikt hij aan de
// ketting en schuift de rest een plek op.
//
// WAAROM TIKKEN EN NIET TYPEN. Een kettingspel waarin je zelf een woord intikt
// klinkt beter dan het is. De woordenlijst in deze app telt 1306 Nederlandse
// woorden (zie data/nlwoorden.ts) en dat is prima om woorden UIT te halen, maar
// te mager om woorden aan AF TE KEUREN: je typt een gewoon Nederlands woord dat
// er niet in staat en het spel zegt dat het niet bestaat. Dat is geen spel maar
// een ruzie. Door de woorden aan te bieden gebruik je de lijst waar hij goed in
// is en heeft niemand ooit ongelijk.
//
// EIGEN INDELING, en dat mag: de ketting staat rechtop en groeit naar beneden,
// met de laatste twee schakels er nog boven zodat je ziet waar je vandaan komt.
// De andere arenaspellen hebben een vast vak met een bord erin; dit spel IS de
// beweging naar beneden.
//
// DE KLIM ZIT NIET IN DE KLOK. Tien seconden per schakel, elke schakel dezelfde,
// om dezelfde reden als bij de Rekenladder: onder een paar tellen meet je
// reactiesnelheid in plaats van taal. Wat wel klimt:
//
//   1. HET AANTAL TEGELS. Vier, dan zes, dan acht. Meer lezen in dezelfde tijd.
//   2. DE LENGTE van de woorden. Kort in het begin, lang verderop.
//   3. DE LOKKERS. Eerst beginnen ze met een letter die nergens in het woord
//      zit, dus je kunt op vorm zoeken. Later beginnen ze met een letter die WEL
//      in het huidige woord staat, en vanaf schakel dertien staat er ook een
//      tussen die begint met de letter waar je NET vandaan komt. Dan moet je
//      echt op de laatste letter letten en niet op wat je herkent.
//
// DOODLOPENDE EINDEN. Op de C, X en Y begint geen enkel woord in de lijst, en op
// de U maar vier. Een woord dat daarop eindigt zou de ketting doodslaan, dus een
// antwoord mag alleen eindigen op een letter waar minstens acht woorden mee
// beginnen. Dat is geen kunstgreep om het makkelijk te maken maar de enige
// manier waarop een ketting eindeloos KAN zijn.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Screen } from "../components/Layout";
import { KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { ARENA_GOUD, colors, font, withAlpha } from "../theme/tokens";
import { sound } from "../sound/sound";
import { useT } from "../i18n/i18n";
import { VAK } from "./Arena";
import { Scorebord } from "../components/Scorebord";
import { woordenboek, type Woordenboek } from "../data/woorden";

/** De klok per schakel. TIEN SECONDEN, elke schakel dezelfde. Moet gelijk lopen
 *  met WOORDKETEN_VENSTER in backend/app/arena.py; staat het daar anders, dan
 *  keurt de server een eerlijke poging af. */
export const KETEN_VENSTER = 10000;

/** Hoeveel woorden er minstens met een letter moeten beginnen voordat die letter
 *  een geldig EINDE van een antwoord is. Onder deze grens kan de ketting op de
 *  volgende beurt niet verder. */
const MIN_VERVOLG = 8;

export type Trap = {
  /** Hoeveel tegels er liggen. */
  tegels: number;
  /** De lengte die de woorden bij voorkeur hebben. Voorkeur en geen eis: op
   *  sommige beginletters bestaan er domweg geen lange woorden. */
  band: [number, number];
  /** 0 = lokkers met een vreemde letter, 1 = lokkers uit het woord zelf,
   *  2 = plus een lokker op de letter waar je net vandaan komt. */
  gemeen: 0 | 1 | 2;
};

export function trapVoor(schakel: number): Trap {
  const k = Math.max(1, schakel);
  if (k <= 3) return { tegels: 4, band: [3, 5], gemeen: 0 };
  if (k <= 7) return { tegels: 6, band: [3, 6], gemeen: 1 };
  if (k <= 12) return { tegels: 8, band: [4, 7], gemeen: 1 };
  return { tegels: 8, band: [4, 9], gemeen: 2 };
}

/** Wat een schakel oplevert: honderd maal het nummer, plus de helft daarvan naar
 *  rato van de tijd die je overhield. Maal het nummer en niet vast, zodat twee
 *  spelers die allebei ver komen niet op dezelfde stand uitkomen. Dat is
 *  arenaregel 1: een score zonder plafond. */
export const puntenVoor = (schakel: number, rest: number) =>
  100 * schakel + Math.round(50 * schakel * Math.max(0, Math.min(1, rest)));

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

const kiesUit = <T,>(rng: () => number, lijst: readonly T[]): T => lijst[Math.floor(rng() * lijst.length)];

function schud<T>(rng: () => number, lijst: T[]): T[] {
  const uit = lijst.slice();
  for (let i = uit.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [uit[i], uit[j]] = [uit[j], uit[i]];
  }
  return uit;
}

/** De woorden op beginletter, plus de letters waar genoeg woorden mee beginnen.
 *
 *  Eén keer per woordenboek uitrekenen en bewaren: het is een paar duizend
 *  woorden en dat is te veel om per beurt opnieuw te doen, maar te weinig om
 *  ingewikkeld over te doen. */
const kaartjes = new WeakMap<Woordenboek, { per: Map<string, string[]>; levend: Set<string> }>();
function kaart(wb: Woordenboek) {
  const oud = kaartjes.get(wb);
  if (oud) return oud;
  const per = new Map<string, string[]>();
  for (const w of wb.WOORDEN) {
    const l = w[0];
    const lijst = per.get(l);
    if (lijst) lijst.push(w); else per.set(l, [w]);
  }
  for (const lijst of per.values()) lijst.sort();
  const levend = new Set<string>();
  for (const [l, lijst] of per) if (lijst.length >= MIN_VERVOLG) levend.add(l);
  const nieuw = { per, levend };
  kaartjes.set(wb, nieuw);
  return nieuw;
}

export type Beurt = {
  /** Het woord dat aan de ketting mag. */
  antwoord: string;
  /** Alle tegels, geschud, met het antwoord ertussen. */
  tegels: string[];
};

/** Uit een lijst kiezen met een voorkeur voor een lengte. Zit er niets in de
 *  band, dan wint de lengte die er het dichtst bij ligt: liever een kort woord
 *  dan geen beurt. */
function kiesMetLengte(rng: () => number, lijst: string[], band: [number, number]): string | null {
  if (!lijst.length) return null;
  const in_band = lijst.filter((w) => w.length >= band[0] && w.length <= band[1]);
  if (in_band.length) return kiesUit(rng, in_band);
  const doel = (band[0] + band[1]) / 2;
  let beste = lijst[0];
  let afstand = Math.abs(beste.length - doel);
  for (const w of lijst) {
    const d = Math.abs(w.length - doel);
    if (d < afstand) { beste = w; afstand = d; }
  }
  return beste;
}

/** Een beurt zetten: één goed woord op `letter` en de rest lokkers.
 *
 *  `null` als het niet lukt. Dat kan alleen als de lijst bijna op is (na
 *  honderden schakels), en dan is de ketting gewoon uit. */
export function maakBeurt(
  rng: () => number,
  wb: Woordenboek,
  letter: string,
  gebruikt: ReadonlySet<string>,
  trap: Trap,
  huidig: string,
  vorigeLetter: string | null,
): Beurt | null {
  const { per, levend } = kaart(wb);
  const kandidaten = (per.get(letter) ?? []).filter((w) => !gebruikt.has(w) && levend.has(w[w.length - 1]));
  const antwoord = kiesMetLengte(rng, kandidaten, trap.band);
  if (!antwoord) return null;

  // De lokkers. Welke beginletters mogen ze hebben?
  const alle = [...per.keys()].filter((l) => l !== letter);
  const inWoord = new Set(huidig.split(""));
  const dichtbij = alle.filter((l) => inWoord.has(l));
  const veraf = alle.filter((l) => !inWoord.has(l));

  const gekozen: string[] = [];
  const bezet = new Set<string>([antwoord]);
  const pak = (uitLetters: string[]) => {
    for (let poging = 0; poging < 24 && uitLetters.length; poging++) {
      const l = kiesUit(rng, uitLetters);
      const lijst = (per.get(l) ?? []).filter((w) => !gebruikt.has(w) && !bezet.has(w));
      const w = kiesMetLengte(rng, lijst, trap.band);
      if (w) { gekozen.push(w); bezet.add(w); return true; }
    }
    return false;
  };

  // Vanaf schakel dertien ligt er een lokker op de letter waar je NET vandaan
  // komt. Dat is de gemeenste die er is: je oog wil terug naar wat het herkent.
  if (trap.gemeen >= 2 && vorigeLetter && vorigeLetter !== letter) pak([vorigeLetter]);
  while (gekozen.length < trap.tegels - 1) {
    const bron = trap.gemeen >= 1 && dichtbij.length && rng() < 0.6 ? dichtbij : veraf.length ? veraf : alle;
    if (!pak(bron) && !pak(alle)) break;
  }
  return { antwoord, tegels: schud(rng, [antwoord, ...gekozen]) };
}

/** Het woord waar de ketting mee begint. Kort, en het moet ergens heen kunnen. */
export function startWoord(rng: () => number, wb: Woordenboek): string {
  const { per, levend } = kaart(wb);
  const alles: string[] = [];
  for (const lijst of per.values()) for (const w of lijst) if (w.length <= 5 && levend.has(w[w.length - 1])) alles.push(w);
  return kiesUit(rng, alles.sort());
}

// ---- het beeld --------------------------------------------------------------

const GOUD = ARENA_GOUD;
const VIOLET = "#B36BFF";
const GROEN = "#3BE08F";
const ROOD = "#FF5A4E";

/** Een schakel in de ketting. `plek` is 0 voor de actieve en telt op naar boven,
 *  zodat oudere schakels kleiner en doffer worden en de ketting diepte krijgt. */
function Schakel({ woord, plek, staat }: { woord: string; plek: number; staat?: "goed" | "fout" }) {
  const dof = Math.max(0, 1 - plek * 0.34);
  const actief = plek === 0;
  const rand = staat === "goed" ? GROEN : staat === "fout" ? ROOD : GOUD[2];
  return (
    <div
      style={{
        width: actief ? "100%" : `${94 - plek * 7}%`,
        height: actief ? 52 : 30,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        borderRadius: 12,
        opacity: 0.25 + dof * 0.75,
        background: actief
          ? "linear-gradient(180deg, rgba(96,44,168,.55) 0%, rgba(44,17,84,.62) 100%)"
          : "linear-gradient(180deg, rgba(70,32,124,.34) 0%, rgba(32,13,62,.4) 100%)",
        boxShadow: actief
          ? `inset 0 0 0 1px ${withAlpha(rand, 0.85)}, 0 0 14px ${withAlpha(rand, 0.3)}, inset 0 1px 0 rgba(255,255,255,.16)`
          : `inset 0 0 0 1px ${withAlpha(GOUD[3], 0.6 * dof + 0.2)}`,
        transition: "all .22s ease-out",
      }}
    >
      <span
        style={{
          fontFamily: font.display, fontWeight: 800,
          fontSize: actief ? 26 : 15,
          letterSpacing: actief ? 1.6 : 0.8, marginRight: actief ? -1.6 : -0.8,
          color: actief ? "#FFFFFF" : withAlpha("#E7D9FF", 0.8),
          textShadow: actief ? "0 2px 6px rgba(0,0,0,.6)" : "none",
          whiteSpace: "nowrap",
        }}
      >
        {actief ? woord.slice(0, -1) : woord}
        {actief && (
          // De laatste letter is de opdracht, dus die staat er niet als deel van
          // het woord maar als een eigen teken in het goud van de arena.
          <span style={{ color: GOUD[1], textShadow: `0 0 12px ${withAlpha(GOUD[1], 0.7)}, 0 2px 6px rgba(0,0,0,.7)` }}>
            {woord.slice(-1)}
          </span>
        )}
      </span>
    </div>
  );
}

/** Het stukje ketting tussen twee schakels: twee schalmen die in elkaar haken. */
function Schalm({ dof }: { dof: number }) {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" aria-hidden style={{ display: "block", opacity: dof, flexShrink: 0 }}>
      <ellipse cx="7" cy="4" rx="3.1" ry="3.6" fill="none" stroke={GOUD[2]} strokeWidth="1.5" />
      <ellipse cx="7" cy="9" rx="3.1" ry="3.6" fill="none" stroke={GOUD[3]} strokeWidth="1.5" />
    </svg>
  );
}

/** Een woordtegel om aan te tikken. */
function Tegel({ woord, staat, onKies }: {
  woord: string;
  staat: "rust" | "goed" | "fout" | "dood";
  onKies: () => void;
}) {
  const rand = staat === "goed" ? GROEN : staat === "fout" ? ROOD : VIOLET;
  const dood = staat === "dood";
  return (
    <button
      onClick={onKies}
      className="pressable"
      disabled={staat !== "rust"}
      style={{
        appearance: "none", border: "none", cursor: staat === "rust" ? "pointer" : "default",
        minHeight: 46, padding: "8px 6px", borderRadius: 11,
        display: "grid", placeItems: "center",
        opacity: dood ? 0.3 : 1,
        background:
          staat === "goed" ? "linear-gradient(180deg, rgba(30,120,74,.85) 0%, rgba(12,58,36,.9) 100%)"
          : staat === "fout" ? "linear-gradient(180deg, rgba(150,42,34,.85) 0%, rgba(70,16,12,.9) 100%)"
          : "linear-gradient(180deg, rgba(86,40,150,.5) 0%, rgba(38,15,72,.6) 100%)",
        boxShadow: `inset 0 0 0 1px ${withAlpha(rand, dood ? 0.25 : 0.7)}, inset 0 1px 0 rgba(255,255,255,.14), 0 2px 8px rgba(0,0,0,.35)`,
        transition: "all .18s ease-out",
      }}
    >
      <span
        style={{
          fontFamily: font.display, fontWeight: 800, fontSize: woord.length > 7 ? 15 : 17,
          letterSpacing: 0.6, marginRight: -0.6, color: "#F6EEFF",
          textShadow: "0 1px 3px rgba(0,0,0,.6)", whiteSpace: "nowrap",
        }}
      >
        {woord}
      </span>
    </button>
  );
}

/** De klokbalk. Loopt van violet naar rood zonder omslagpunt: een balk die op
 *  een vast percentage ineens van kleur springt leest als een fout. */
function Klokbalk({ rest }: { rest: number }) {
  const r = Math.max(0, Math.min(1, rest));
  const kleur = r > 0.5 ? VIOLET : r > 0.22 ? "#FF9F45" : ROOD;
  return (
    <div style={{ width: "100%", height: 8, borderRadius: 999, background: "rgba(20,8,40,.7)", boxShadow: `inset 0 0 0 1px ${withAlpha(GOUD[3], 0.45)}`, overflow: "hidden" }}>
      <div
        style={{
          width: `${r * 100}%`, height: "100%", borderRadius: 999,
          background: `linear-gradient(90deg, ${withAlpha(kleur, 0.65)} 0%, ${kleur} 100%)`,
          boxShadow: `0 0 10px ${withAlpha(kleur, 0.6)}`,
          transition: "width .1s linear, background .3s",
        }}
      />
    </div>
  );
}

// ---- het spel ---------------------------------------------------------------

type Fase = "tel" | "spel" | "klaar";

export function Woordketen({ seed, onKlaar, onOpnieuw }: {
  seed: string;
  onKlaar?: (score: number, level: number, timeMs: number) => void;
  onOpnieuw?: () => void;
}) {
  const { t, lang } = useT();
  const wb = useMemo(() => woordenboek(lang), [lang]);

  const [fase, setFase] = useState<Fase>("tel");
  const [tel, setTel] = useState(3);
  const [ketting, setKetting] = useState<string[]>([]);
  const [beurt, setBeurt] = useState<Beurt | null>(null);
  const [oordeel, setOordeel] = useState<{ gekozen: string } | null>(null);
  const [totaal, setTotaal] = useState(0);
  const [rest, setRest] = useState(1);

  const rng = useRef(maakRng(seed));
  const gebruikt = useRef<Set<string>>(new Set());
  const beslist = useRef(false);
  const t0 = useRef(performance.now());
  const ingeleverd = useRef(false);

  const schakel = ketting.length;              // hoeveel schakels je hebt gemaakt
  const huidig = ketting.length ? ketting[ketting.length - 1] : "";
  const letter = huidig ? huidig[huidig.length - 1] : "";

  const timers = useRef<number[]>([]);
  const na = useCallback((ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);

  // Het aftellen, en daarna het startwoord.
  useEffect(() => {
    if (fase !== "tel") return;
    if (tel > 0) { const id = window.setTimeout(() => setTel((n) => n - 1), 900); return () => window.clearTimeout(id); }
    const start = startWoord(rng.current, wb);
    gebruikt.current.add(start);
    setKetting([start]);
    setFase("spel");
    t0.current = performance.now();
  }, [fase, tel, wb]);

  // Een nieuwe beurt zodra de ketting is gegroeid.
  useEffect(() => {
    if (fase !== "spel" || !huidig || oordeel) return;
    const vorige = ketting.length >= 2 ? ketting[ketting.length - 2] : null;
    const b = maakBeurt(
      rng.current, wb, letter, gebruikt.current, trapVoor(schakel),
      huidig, vorige ? vorige[vorige.length - 1] : null,
    );
    if (!b) { setFase("klaar"); return; }
    setBeurt(b);
    beslist.current = false;
    setRest(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, ketting.length]);

  // De klok van deze beurt.
  useEffect(() => {
    if (fase !== "spel" || !beurt) return;
    const begin = performance.now();
    let stop = false;
    const tik = () => {
      if (stop) return;
      const over = 1 - (performance.now() - begin) / KETEN_VENSTER;
      setRest(Math.max(0, over));
      if (over <= 0) { mis(null); return; }
      requestAnimationFrame(tik);
    };
    const id = requestAnimationFrame(tik);
    return () => { stop = true; cancelAnimationFrame(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beurt, fase]);

  // De uitslag inleveren. Eén keer, en pas als het spel echt uit is.
  useEffect(() => {
    if (fase !== "klaar" || !onKlaar || ingeleverd.current) return;
    ingeleverd.current = true;
    // Het aantal SCHAKELS, niet het aantal woorden: het startwoord kreeg je
    // cadeau. Zo sluit het plafond in plausibel() precies op de punten aan die
    // hier zijn uitgedeeld (som van 150k voor k=1..schakels).
    onKlaar(totaal, Math.max(0, schakel - 1), Math.round(performance.now() - t0.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  function mis(gekozen: string | null) {
    if (beslist.current) return;
    beslist.current = true;
    sound.klemFout();
    sound.haptic([18, 40, 18]);
    setOordeel({ gekozen: gekozen ?? "" });
    na(700, () => setFase("klaar"));
  }

  function kies(woord: string) {
    if (fase !== "spel" || !beurt || beslist.current) return;
    if (woord !== beurt.antwoord) { mis(woord); return; }
    beslist.current = true;
    const nummer = schakel;                      // deze schakel maakt hem langer
    sound.klemGoed();
    sound.haptic(10);
    if (nummer % 5 === 0) sound.reeks();
    setOordeel({ gekozen: woord });
    setTotaal((s) => s + puntenVoor(nummer, rest));
    na(320, () => {
      gebruikt.current.add(woord);
      setOordeel(null);
      setKetting((k) => [...k, woord]);
    });
  }

  const staatVan = (w: string): "rust" | "goed" | "fout" | "dood" => {
    if (!oordeel) return "rust";
    if (w === beurt?.antwoord) return "goed";
    if (w === oordeel.gekozen) return "fout";
    return "dood";
  };

  // De laatste drie schakels: de actieve onderaan en twee erboven.
  const zichtbaar = ketting.slice(-3).reverse();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 20 }}>
      <Scorebord
        breedte={VAK}
        links={{ kop: t("ketenSchakel"), waarde: String(Math.max(0, schakel - 1)) }}
        rechts={{ kop: t("soepPunten"), waarde: String(totaal) }}
      />

      {/* DE KETTING. Van boven naar beneden: de oudste schakel die nog te zien is,
          dan de schalmen, dan de actieve onderaan. Hij groeit dus naar je duim
          toe en niet ervandaan. */}
      <div style={{ width: VAK, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, marginTop: 4, minHeight: 118, justifyContent: "flex-end" }}>
        {zichtbaar.slice().reverse().map((w, i) => {
          const plek = zichtbaar.length - 1 - i;
          return (
            <div key={`${w}-${plek}`} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <Schakel woord={w} plek={plek} staat={plek === 0 && oordeel ? (oordeel.gekozen === beurt?.antwoord ? "goed" : "fout") : undefined} />
              {plek > 0 && <Schalm dof={Math.max(0.25, 1 - (plek - 1) * 0.3)} />}
            </div>
          );
        })}
      </div>

      {/* De opdracht in woorden, want de gouden letter alleen is te weinig als je
          het spel voor het eerst speelt. */}
      <span style={{ fontFamily: font.ui, fontSize: 12.5, color: withAlpha("#E7D9FF", 0.72), textAlign: "center", minHeight: 17 }}>
        {fase === "tel" ? t("ketenKlaar")
          : fase === "klaar" ? t("ketenGebroken", { n: Math.max(0, schakel - 1) })
          : t("ketenKies", { letter })}
      </span>

      <div style={{ width: VAK }}>
        <Klokbalk rest={fase === "spel" ? rest : 0} />
      </div>

      {/* DE TEGELS. Twee kolommen, ook bij acht: drie kolommen maakt de woorden
          zo smal dat ze afbreken, en een woord dat je moet ontcijferen voordat je
          hem kunt lezen is geen keuze maar een obstakel. */}
      <div style={{ width: VAK, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 2, alignContent: "start", minHeight: 4 * 46 + 3 * 8 }}>
        {fase === "tel" || !beurt
          ? null
          : beurt.tegels.map((w) => <Tegel key={w} woord={w} staat={staatVan(w)} onKies={() => kies(w)} />)}
      </div>

      {fase === "tel" && (
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 58, lineHeight: 1, color: "#FFFFFF", textShadow: "0 0 18px rgba(160,200,255,.35)" }}>
          {Math.max(1, tel)}
        </span>
      )}

      {(fase !== "klaar" || onOpnieuw) && (
        <div style={{ marginTop: 6 }}>
          <NeonKader radius={999} dik={0.5} vulling="zwart" animeer lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
            <button
              onClick={fase === "klaar" ? onOpnieuw : () => setFase("klaar")}
              className="pressable"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
            >
              <LogOut size={14} /> {fase === "klaar" ? t("soepOpnieuw") : t("arenaStop")}
            </button>
          </NeonKader>
        </div>
      )}
    </div>
  );
}

const versSleutel = () => `keten-${Math.random().toString(36).slice(2)}`;

/** De testversie achter `?keten`: eigen kop, eigen sleutel, levert niets in. */
export function PreviewWoordketen() {
  const [potje, setPotje] = useState(versSleutel);
  useEffect(() => {
    document.body.classList.add("soephal");
    return () => document.body.classList.remove("soephal");
  }, []);
  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>Arena</span>
          <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, color: colors.redHi }}>testversie, telt niet mee</span>
        </div>
      }
    >
      <Woordketen key={potje} seed={potje} onOpnieuw={() => setPotje(versSleutel())} />
    </Screen>
  );
}

export default PreviewWoordketen;
