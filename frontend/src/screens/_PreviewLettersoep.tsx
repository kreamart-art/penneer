// LETTERSOEP, het arenaspel van vrijdag. Speelbare testversie achter ?soep in
// de url (eigen brok, dus wie hem niet opent downloadt hem ook niet).
//
// HET SPEL: zestien letters, twee minuten. Woorden leg je door aangrenzende
// letters te tikken (ook diagonaal); vanaf drie letters telt hij, en de punten
// VERDUBBELEN per letter (3=100, 4=200, 5=400 ...). Haal je het doel van het
// level, dan vallen de letters van het bord en regent er een nieuw bord in:
// level twee, een hoger doel, dezelfde klok. Zo is er geen einde en geldt de
// no-ceiling-regel van de arena vanzelf.
//
// WAT NOG NIET ECHT IS (testversie):
//  - de woordenlijst is een meegestuurde lijst met gangbare Nederlandse
//    woorden van drie tot zes letters, niet de volledige lijst van de server;
//  - er wordt niets ingeleverd: de score telt alleen op dit scherm.
//
// De borden komen uit een seed (dag + level), dus iedereen die vandaag test
// speelt exact dezelfde borden. De generator vult het bord VOLLEDIG met vier
// lijstwoorden (5+4+4+3 = 16 vakjes), dus er zit altijd wat in; door overlap
// van paden ontstaan er vanzelf meer.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Screen } from "../components/Layout";
import { KADER_LIJN_LOOP, KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { VAK } from "./Arena";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

// ---- de maten van de art (gemeten in de bestanden) --------------------------
const BORD_V = 0.8349;
const SCORE_V = 3.7805;
const ONDER_V = 2.9589;
const KOL = [0.0561, 0.2803, 0.5051, 0.7297];
const RIJ = [0.1636, 0.359, 0.5497, 0.7451];
const VAK_B = 0.213;
const VAK_H = 0.1791;
const PANEEL_TOP = 0.024;
const SCORE_RUIT = { t: 0.2238, h: 0.6643, links: { l: 0.0407, b: 0.3213 }, rechts: { l: 0.637, b: 0.3213 } };
const ONDER_RUIT = { l: 0.0148, b: 0.9704, woord: { t: 0.1315, h: 0.4192 }, lijst: { t: 0.5589, h: 0.2849 } };

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
const ACHT = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;

// De gloed van een gekozen vakje. Kort: verder dan de kier tussen twee vakjes
// en de streep van het raster loopt vol.
const HALO = 0.11;
const GLOED = withAlpha("#FFA524", 0.7);
// De kleur van het paneel in de ondersectie, uit de art gemeten.
const PANEEL = "#1D0C29";

// ---- de regels --------------------------------------------------------------
const SPEELTIJD_S = 120;
const punten = (lengte: number) => (lengte < 3 ? 0 : 100 * 2 ** (lengte - 3));
/** Het doel van een level: wat je BINNEN dat level moet scoren om door te
 *  mogen. Oplopend, want de borden blijven even groot maar jij wordt warmer. */
const doelVan = (level: number) => 200 + level * 100;

// ---- de woordenlijst --------------------------------------------------------
// Gangbare Nederlandse woorden van drie tot zes letters. Dit is de TESTlijst;
// de echte versie valideert tegen de lijsten van de server.
const WOORDEN = [
  "AAP", "ARM", "BAD", "BAK", "BAL", "BED", "BEEN", "BEER", "BERG", "BIER", "BLAD", "BLOEM",
  "BOEK", "BOOM", "BOOT", "BORD", "BOS", "BRIL", "BROOD", "BRUG", "BUS", "DAG", "DAK", "DAS",
  "DEUR", "DIER", "DING", "DOEK", "DOEL", "DORP", "DROOM", "DRUIF", "DUIF", "EEND", "EI", "END",
  "FEEST", "FIETS", "FILM", "GANS", "GAT", "GELD", "GLAS", "GOUD", "GRAS", "GROEN", "HAAI",
  "HAAN", "HAAR", "HAND", "HART", "HEK", "HEMD", "HERT", "HOED", "HOND", "HOOI", "HOORN",
  "HUID", "HUIS", "IJS", "JAS", "JUF", "KAAS", "KAM", "KAN", "KAT", "KERK", "KERS", "KEUKEN",
  "KIP", "KIST", "KLEIN", "KLOK", "KNIE", "KOE", "KOEK", "KOP", "KRANT", "KROON", "KRUK",
  "LAMP", "LAND", "LEK", "LENTE", "LEPEL", "LICHT", "LIED", "LIJN", "LIP", "LUCHT", "MAAN",
  "MAAND", "MAP", "MELK", "MES", "MIST", "MOND", "MUIS", "MUUR", "NACHT", "NEK", "NEST",
  "NET", "NEUS", "NOOT", "OOG", "OOR", "OVEN", "PAARD", "PAD", "PAN", "PEER", "PEN", "PIT",
  "PLANT", "POES", "POORT", "POT", "PRINS", "RAAM", "REGEN", "RIJST", "RING", "RIVIER",
  "ROK", "ROL", "ROOS", "ROTS", "RUG", "SCHIP", "SCHOEN", "SLA", "SLANG", "SLEE", "SLOT",
  "SNEEUW", "SOEP", "SOK", "SPIN", "STAD", "STAK", "STAL", "STER", "STOEL", "STORM",
  "STRAND", "TAART", "TAK", "TAND", "TAS", "TENT", "THEE", "TIJD", "TOREN", "TREIN", "TROM",
  "TUIN", "UIL", "UUR", "VAAS", "VELD", "VIS", "VLAG", "VLOER", "VOET", "VOGEL", "VUUR",
  "WAND", "WEG", "WIEL", "WIND", "WOLK", "WOORD", "WORTEL", "ZAND", "ZEE", "ZEEP", "ZON",
  "ZOUT", "ZWAAN", "KAART", "KANS", "KOSTEN", "KRACHT", "MARKT", "PLEIN", "PRIJS", "SPEL",
  "START", "STEEN", "STROOM", "TEKST", "VERF", "VORK", "WINST", "ZAAL", "ZIN", "REEKS",
  "LOT", "PIL", "RIL", "KIL", "KIN", "LIST", "NIET", "LIEF", "RIET", "TIEN", "ELK", "ELF",
  "EIK", "EIS", "AAS", "AAL", "AAR", "NAT", "NAP", "RAT", "RAAK", "TAAI", "MAT", "MAL",
  "KALM", "KAAL", "TAAL", "ZAAL", "BAAN", "MAAT", "STRAAT", "PLAAT", "KLAAR", "PAAR",
] as const;
const LIJST = new Set<string>(WOORDEN);

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

const buur = (a: number, b: number) => {
  const [r1, k1] = [Math.floor(a / 4), a % 4];
  const [r2, k2] = [Math.floor(b / 4), b % 4];
  return a !== b && Math.abs(r1 - r2) <= 1 && Math.abs(k1 - k2) <= 1;
};

/** Bouw een bord dat VOLLEDIG uit vier lijstwoorden bestaat: 5+4+4+3 = 16.
 *  Elk woord wordt als kronkelpad over ongebruikte vakjes gelegd; lukt een
 *  greep niet binnen de pogingen, dan een nieuwe greep. Deterministisch uit de
 *  seed, dus iedereen speelt vandaag hetzelfde bord. */
function maakBord(seed: string): string[] {
  const rng = maakRng(seed);
  const van = (n: number) => WOORDEN.filter((w) => w.length === n);
  for (let poging = 0; poging < 200; poging++) {
    const kies = (n: number, verboden: Set<string>) => {
      const opties = van(n).filter((w) => !verboden.has(w));
      return opties[Math.floor(rng() * opties.length)];
    };
    const gekozen = new Set<string>();
    const woorden: string[] = [];
    for (const n of [5, 4, 4, 3]) {
      const w = kies(n, gekozen);
      if (!w) break;
      gekozen.add(w);
      woorden.push(w);
    }
    if (woorden.length < 4) continue;

    const cel: string[] = Array(16).fill("");
    const leg = (w: string): boolean => {
      // kronkelpad met terugkeer: vanaf een losse startcel steeds een vrije buur
      const probeer = (pad: number[], i: number): boolean => {
        if (i === w.length) { pad.forEach((c, j) => { cel[c] = w[j]; }); return true; }
        const laatst = pad[pad.length - 1];
        const vrij = [];
        for (let c = 0; c < 16; c++) if (!cel[c] && !pad.includes(c) && buur(laatst, c)) vrij.push(c);
        // door elkaar, zodat het pad per seed anders kronkelt
        for (let j = vrij.length - 1; j > 0; j--) {
          const k = Math.floor(rng() * (j + 1));
          [vrij[j], vrij[k]] = [vrij[k], vrij[j]];
        }
        for (const c of vrij) if (probeer([...pad, c], i + 1)) return true;
        return false;
      };
      const starts = [];
      for (let c = 0; c < 16; c++) if (!cel[c]) starts.push(c);
      for (let j = starts.length - 1; j > 0; j--) {
        const k = Math.floor(rng() * (j + 1));
        [starts[j], starts[k]] = [starts[k], starts[j]];
      }
      return starts.some((c) => probeer([c], 1));
    };
    if (woorden.every(leg)) return cel;
  }
  // Kan wiskundig bijna niet, maar een leeg bord mag nooit: vul dan plat.
  return "STERAKLONIEDMBAU".split("");
}

const dagSeed = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());

// ---- bouwstenen -------------------------------------------------------------
function Sectie({ art, verhouding, breedte = VAK, children }: { art: string; verhouding: number; breedte?: string; children?: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: breedte, height: `calc(${breedte} / ${verhouding})`, flexShrink: 0 }}>
      {/* Schaduw als kopie van de art: brightness(0) houdt het alfakanaal, dus
          hij volgt de vorm. Drop-shadow rastert op iOS de doos mee. */}
      <img
        src={art}
        alt=""
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(11px)", opacity: 0.55, transform: "translateY(9px)", pointerEvents: "none" }}
      />
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

const klok = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---- het spel ---------------------------------------------------------------
export function PreviewLettersoep() {
  useEffect(() => {
    document.body.classList.add("soepspel");
    return () => document.body.classList.remove("soepspel");
  }, []);

  const [level, setLevel] = useState(1);
  const [totaal, setTotaal] = useState(0);
  const [levelScore, setLevelScore] = useState(0);
  const [pad, setPad] = useState<number[]>([]);
  const [gevonden, setGevonden] = useState<{ woord: string; n: number }[]>([]);
  const [fout, setFout] = useState(false);
  // Het oordeel over je laatste legpoging: de vakjes van dat pad kleuren even
  // GROEN (goed) of ROOD (fout) op het moment dat je de laatste letter legt.
  const [oordeel, setOordeel] = useState<{ cellen: number[]; goed: boolean } | null>(null);
  const [over, setOver] = useState(SPEELTIJD_S);
  // "spel" is spelen; "val" is de wissel (letters vallen, nieuwe komen);
  // "klaar" is de tijd om.
  const [fase, setFase] = useState<"spel" | "val" | "klaar">("spel");
  const timers = useRef<number[]>([]);
  const na = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const bord = useMemo(() => maakBord(`soep:${dagSeed()}:${level}`), [level]);

  // De klok telt over levels heen door: het doel van een level haal je door
  // SNEL te zijn, niet door de tijd stil te zetten.
  useEffect(() => {
    if (fase === "klaar") return;
    const id = window.setInterval(() => {
      setOver((s) => {
        if (s <= 1) { setFase("klaar"); sound.win(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [fase]);

  const woord = pad.map((c) => bord[c]).join("");
  const geldig = woord.length >= 3 && LIJST.has(woord) && !gevonden.some((g) => g.woord === woord);

  // De tik-afhandeling staat BUITEN de state-updater. Eerder zat het inleveren
  // in setPad(oud => ...), en React voert zo'n updater in ontwikkelmodus twee
  // keer uit om bijwerkingen te betrappen: elk woord telde dubbel. Een updater
  // hoort puur te zijn; hier wordt eerst gerekend en daarna pas gezet.
  const padRef = useRef<number[]>([]);
  padRef.current = pad;

  const leg = useCallback((cellen: number[]) => {
    const w = cellen.map((x) => bord[x]).join("");
    const goed = w.length >= 3 && LIJST.has(w) && !gevonden.some((g) => g.woord === w);
    setOordeel({ cellen, goed });
    na(560, () => setOordeel(null));
    setPad([]);
    if (!goed) {
      sound.uiTap();
      setFout(true);
      return;
    }
    const erbij = punten(w.length);
    sound.approve();
    setGevonden((g) => [...g, { woord: w, n: w.length }]);
    setTotaal((t) => t + erbij);
    const nieuw = levelScore + erbij;
    setLevelScore(nieuw);
    if (nieuw >= doelVan(level)) {
      // Level gehaald: de letters vallen, en na de val begint het volgende
      // level met een vers bord en een hoger doel.
      setFase("val");
      sound.win();
      na(760, () => {
        setLevel((l) => l + 1);
        setLevelScore(0);
        setFase("spel");
      });
    }
  }, [bord, gevonden, level, levelScore]);

  const tik = useCallback((c: number) => {
    if (fase !== "spel") return;
    setFout(false);
    const oud = padRef.current;
    const i = oud.indexOf(c);
    if (i >= 0 && i < oud.length - 1) { setPad(oud.slice(0, i + 1)); return; } // terugsnoeien
    if (i === oud.length - 1 && oud.length > 0) { leg(oud); return; }          // zelfde vakje: inleveren
    sound.uiTap();
    if (oud.length === 0) { setPad([c]); return; }
    if (buur(oud[oud.length - 1], c)) { setPad([...oud, c]); return; }
    setPad([c]); // niet aangrenzend: nieuw pad vanaf hier
  }, [fase, leg]);

  const stop = () => { setFase("klaar"); };
  const opnieuw = () => {
    setLevel(1); setTotaal(0); setLevelScore(0); setPad([]);
    setGevonden([]); setOver(SPEELTIJD_S); setFase("spel"); setFout(false);
  };

  const inPad = (c: number) => pad.indexOf(c);
  const midX = (c: number) => (KOL[c % 4] + VAK_B / 2) * 100;
  const midY = (c: number) => (RIJ[Math.floor(c / 4)] + VAK_H / 2) * 100;
  const doel = doelVan(level);

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
          <Meter kop="TIJD" waarde={klok(over)} kleur={over <= 15 ? "#FF6A5A" : "#FFF3D0"} breuk={SCORE_RUIT.links} />
          <Meter kop="PUNTEN" waarde={String(totaal)} breuk={SCORE_RUIT.rechts} />
        </Sectie>

        <Sectie art="/ui/soep/bord.webp?v=1" verhouding={BORD_V}>
          <img src="/ui/soep/letters-dof.webp?v=1" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

          {/* Level en doel, gecentreerd in het open vak boven het raster. */}
          <div
            style={{
              position: "absolute", left: 0, right: 0,
              top: pct(PANEEL_TOP), height: pct(RIJ[0] - PANEEL_TOP),
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            }}
          >
            <span style={{ fontFamily: font.wide, fontSize: 16, letterSpacing: 2.8, color: "#FFD98A", textShadow: "0 0 10px rgba(255,180,50,.55)" }}>
              LEVEL {level}
            </span>
            <span style={{ fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, color: withAlpha("#FFE7A8", 0.72) }}>
              nog {Math.max(0, doel - levelScore)} punten
            </span>
          </div>

          {/* De neonlijn om het raster: hij leeft zolang je zoekt. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: pct(KOL[0] - 0.028), right: pct(1 - (KOL[3] + VAK_B) - 0.028),
              top: pct(RIJ[0] - 0.023), bottom: pct(1 - (RIJ[3] + VAK_H) - 0.023),
              pointerEvents: "none",
            }}
          >
            <NeonKader radius={16} dik={0.45} vulling="geen" lijn={KADER_LIJN_LOOP} animeer eindkap sterkte={0.5} style={{ width: "100%", height: "100%" }} binnen={{ padding: 0 }}>
              <span />
            </NeonKader>
          </div>

          {/* De gloed van gekozen vakjes, achter de art. */}
          {bord.map((_, c) => {
            const aan = inPad(c) >= 0;
            return (
              <span
                key={`gloed-${c}`}
                aria-hidden
                style={{
                  position: "absolute",
                  left: pct(KOL[c % 4] - VAK_B * HALO), top: pct(RIJ[Math.floor(c / 4)] - VAK_H * HALO),
                  width: pct(VAK_B * (1 + HALO * 2)), height: pct(VAK_H * (1 + HALO * 2)),
                  borderRadius: "28%",
                  background: `radial-gradient(circle, ${GLOED} 0%, ${GLOED} 46%, ${withAlpha("#FFB43C", 0.38)} 58%, ${withAlpha("#FFB43C", 0.14)} 68%, transparent 76%)`,
                  filter: "blur(6px)",
                  opacity: aan ? 1 : 0,
                  transition: aan ? "opacity .1s linear" : "opacity .25s ease-out",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
            );
          })}

          {/* De verbindingslijn, ACHTER de vakjes: hij duikt eronderdoor en komt
              in de kieren boven. */}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
          >
            {pad.length > 1 && (
              <>
                <polyline points={pad.map((c) => `${midX(c)},${midY(c)}`).join(" ")} fill="none" stroke={withAlpha("#FFC85A", 0.95)} strokeWidth={5.6} strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pad.map((c) => `${midX(c)},${midY(c)}`).join(" ")} fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
          </svg>

          {/* De opgelichte vakjes als art. */}
          {bord.map((_, c) => {
            const aan = inPad(c) >= 0;
            const r = Math.floor(c / 4), k = c % 4;
            return (
              <img
                key={`aan-${c}`}
                src={`/ui/soep/letter-aan-${r}${k}.webp?v=1`}
                alt=""
                aria-hidden
                style={{
                  position: "absolute",
                  left: pct(KOL[k] - 0.0015), top: pct(RIJ[r] + 0.0015),
                  width: pct(VAK_B + 0.003), height: "auto",
                  display: "block", zIndex: 2,
                  opacity: aan ? 1 : 0,
                  transition: aan ? "opacity .08s linear" : "opacity .2s ease-out",
                }}
              />
            );
          })}

          {/* Het oordeel: leg je de laatste letter, dan wisselen de vakjes van
              je pad naar hun GROENE (goed) of RODE (fout) stand. Dat is art, in
              dezelfde reeks als de gouden aan-stand en op dezelfde uitsnede
              geknipt, dus hij valt er pixelvast overheen. */}
          {oordeel &&
            oordeel.cellen.map((c) => {
              const r = Math.floor(c / 4), k = c % 4;
              return (
                <img
                  key={`oordeel-${c}`}
                  src={`/ui/soep/letter-${oordeel.goed ? "groen" : "rood"}-${r}${k}.webp?v=1`}
                  alt=""
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: pct(KOL[k] - 0.0015), top: pct(RIJ[r] + 0.0015),
                    width: pct(VAK_B + 0.003), height: "auto",
                    display: "block", zIndex: 3, pointerEvents: "none",
                  }}
                />
              );
            })}

          {/* De letters en tikvlakken. Bij de levelwissel VALLEN de letters van
              het bord (de vakjes zijn het bord zelf, dus die blijven staan) en
              regent het nieuwe stel erin: sleutel op het level, dus elke wissel
              start de val- en kom-animaties opnieuw. */}
          {bord.map((letter, c) => {
            const i = inPad(c);
            const aan = i >= 0;
            const r = Math.floor(c / 4), k = c % 4;
            return (
              <button
                key={`tik-${level}-${c}`}
                onClick={() => tik(c)}
                disabled={fase !== "spel"}
                aria-label={`letter ${letter}`}
                style={{
                  position: "absolute",
                  left: pct(KOL[k]), top: pct(RIJ[r]),
                  width: pct(VAK_B), height: pct(VAK_H),
                  zIndex: 4,
                  display: "grid", placeItems: "center",
                  background: "transparent", border: "none", padding: 0,
                  cursor: fase === "spel" ? "pointer" : "default",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  className={fase === "val" ? "soep-val" : "soep-kom"}
                  style={{
                    // De val golft over het bord: elk vakje een tikje later.
                    animationDelay: `${(fase === "val" ? c : r * 4 + k) * 30}ms`,
                    position: "relative", zIndex: 5,
                    fontFamily: font.wide, fontSize: 24, letterSpacing: 1,
                    color: aan || oordeel?.cellen.includes(c) ? "#FFF6DC" : "#FFD98A",
                    textShadow: aan || oordeel?.cellen.includes(c) ? "0 1px 2px rgba(20,16,10,.75)" : "0 0 9px rgba(255,170,40,.45)",
                  }}
                >
                  {letter}
                </span>
                {aan && (
                  <span style={{ position: "absolute", top: "8%", right: "12%", fontFamily: font.ui, fontSize: 9, fontWeight: 800, color: "#FFE7A8" }}>
                    {i + 1}
                  </span>
                )}
              </button>
            );
          })}
        </Sectie>

        <Sectie art="/ui/soep/onder.webp?v=1" verhouding={ONDER_V}>
          <div
            style={{
              position: "absolute",
              left: pct(ONDER_RUIT.l), width: pct(ONDER_RUIT.b),
              top: pct(ONDER_RUIT.woord.t), height: pct(ONDER_RUIT.woord.h),
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            }}
            className={fout ? "soep-fout" : undefined}
          >
            {fase === "klaar" ? (
              <span style={{ fontFamily: font.wide, fontSize: 21, letterSpacing: 2.4, color: "#FFF3D0" }}>
                KLAAR · {totaal} PUNTEN
              </span>
            ) : woord ? (
              <>
                <span style={{ fontFamily: font.wide, fontSize: 23, letterSpacing: 3, color: "#FFF3D0", textShadow: "0 0 12px rgba(255,190,60,.5)" }}>{woord}</span>
                {geldig ? (
                  <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, color: colors.green }}>+{punten(woord.length)}</span>
                ) : woord.length >= 3 ? (
                  <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint }}>nog geen woord</span>
                ) : null}
              </>
            ) : (
              <span style={{ fontFamily: font.ui, fontSize: 11.5, color: withAlpha("#FFE7A8", 0.6) }}>
                tik letters naast elkaar; tik de laatste nog eens om te leggen
              </span>
            )}
          </div>

          <div
            style={{
              position: "absolute",
              left: pct(ONDER_RUIT.l), width: pct(ONDER_RUIT.b),
              top: pct(ONDER_RUIT.lijst.t), height: pct(ONDER_RUIT.lijst.h),
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7, paddingInline: 10, overflow: "hidden",
            }}
          >
            {gevonden.slice(-3).map((g) => (
              <span
                key={g.woord}
                className="soep-lijn soep-vak"
                style={{
                  display: "inline-flex", height: "84%", padding: 1,
                  clipPath: ACHT(6),
                  background: `linear-gradient(100deg, ${withAlpha("#B0710E", 0.85)} 0%, ${withAlpha("#FFD98A", 0.95)} 22%, ${withAlpha("#FFF6DC", 1)} 34%, ${withAlpha("#FFD98A", 0.95)} 46%, ${withAlpha("#B0710E", 0.85)} 70%, ${withAlpha("#B0710E", 0.85)} 100%)`,
                  backgroundSize: "200% 100%",
                }}
              >
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, paddingInline: 10,
                    clipPath: ACHT(5),
                    background: PANEEL,
                    fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: withAlpha("#FFE7A8", 0.92),
                  }}
                >
                  {g.woord}
                  <span style={{ fontFamily: font.display, fontWeight: 800, color: "#FFC23D" }}>{punten(g.n)}</span>
                </span>
              </span>
            ))}
            {gevonden.length === 0 && (
              <span style={{ fontFamily: font.ui, fontSize: 11, color: withAlpha("#FFE7A8", 0.45) }}>je woorden komen hier</span>
            )}
          </div>
        </Sectie>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <NeonKader radius={999} dik={0.5} vulling="geen" animeer lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
            <button
              onClick={fase === "klaar" ? opnieuw : stop}
              className="pressable"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
            >
              <LogOut size={14} /> {fase === "klaar" ? "Opnieuw" : "Stoppen"}
            </button>
          </NeonKader>
        </div>
      </div>
    </Screen>
  );
}

export default PreviewLettersoep;
