// LETTERSOEP, het arenaspel van vrijdag. Speelbare testversie achter ?soep in
// de url (eigen brok, dus wie hem niet opent downloadt hem ook niet).
//
// HET SPEL: zestien letters, twee minuten. Een woord leg je door aangrenzende
// letters te verbinden, met de vinger (swipen) of door te tikken. Bestaat het
// woord, dan telt hij; de punten VERDUBBELEN per letter (3=100, 4=200, 5=400).
// Vind je genoeg woorden, dan vallen de letters van het bord en regent er een
// nieuw stel in: volgend level, dezelfde klok. Geen einde, dus de ceilingloze
// arenaregel geldt vanzelf.
//
// TWEE MANIEREN OM TE LEGGEN, en ze mogen door elkaar:
//  - SWIPEN: houd je vinger op een letter en sleep over de volgende. Loslaten
//    levert in. Dat is het snelst en het voelt als het spel dat het is.
//  - TIKKEN: tik letters een voor een, tik de laatste nog eens om in te
//    leveren. Nodig voor wie met een muis speelt of niet vloeiend sleept.
//  Het verschil zit in EEN vraag: is de vinger tijdens het indrukken op een
//  tweede vakje geweest? Zo ja, dan was het een veeg en levert loslaten in.
//
// WAT NOG NIET ECHT IS (testversie): er wordt niets ingeleverd bij de server,
// de score telt alleen op dit scherm.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Screen } from "../components/Layout";
import { KADER_LIJN_LOOP, KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { NL_PER_LENGTE, NL_WOORDEN } from "../data/nlwoorden";
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

const HALO = 0.11;
const GLOED = withAlpha("#FFA524", 0.7);
const PANEEL = "#1D0C29";

// ---- de regels --------------------------------------------------------------
const SPEELTIJD_S = 120;
/** Zoveel woorden per level. Vijf is genoeg om een bord echt af te zoeken en
 *  kort genoeg om vaart te houden; de druk komt van de klok, niet van het
 *  aantal. */
const WOORDEN_PER_LEVEL = 5;
/** Hoeveel er onderin passen. Meer dan vier en ze worden onleesbaar klein. */
const TOON_WOORDEN = 4;
const punten = (lengte: number) => (lengte < 3 ? 0 : 100 * 2 ** (lengte - 3));

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

/** Bouw een bord dat VOLLEDIG uit vier lijstwoorden bestaat: 5+4+4+3 = 16
 *  vakjes. Elk woord wordt als kronkelpad over nog vrije vakjes gelegd, dus er
 *  zit altijd wat in; door overlap van paden ontstaan er vanzelf meer woorden
 *  dan de vier die erin gelegd zijn. */
function maakBord(seed: string): string[] {
  const rng = maakRng(seed);
  const van = (n: number) => NL_PER_LENGTE.get(n) ?? [];
  for (let poging = 0; poging < 300; poging++) {
    const gekozen = new Set<string>();
    const woorden: string[] = [];
    for (const n of [5, 4, 4, 3]) {
      const opties = van(n).filter((w) => !gekozen.has(w));
      if (!opties.length) break;
      const w = opties[Math.floor(rng() * opties.length)];
      gekozen.add(w);
      woorden.push(w);
    }
    if (woorden.length < 4) continue;

    const cel: string[] = Array(16).fill("");
    const husselen = <T,>(a: T[]) => {
      for (let j = a.length - 1; j > 0; j--) {
        const k = Math.floor(rng() * (j + 1));
        [a[j], a[k]] = [a[k], a[j]];
      }
      return a;
    };
    const leg = (w: string): boolean => {
      const probeer = (pad: number[], i: number): boolean => {
        if (i === w.length) { pad.forEach((c, j) => { cel[c] = w[j]; }); return true; }
        const laatst = pad[pad.length - 1];
        const vrij: number[] = [];
        for (let c = 0; c < 16; c++) if (!cel[c] && !pad.includes(c) && buur(laatst, c)) vrij.push(c);
        for (const c of husselen(vrij)) if (probeer([...pad, c], i + 1)) return true;
        return false;
      };
      const starts: number[] = [];
      for (let c = 0; c < 16; c++) if (!cel[c]) starts.push(c);
      return husselen(starts).some((c) => probeer([c], 1));
    };
    if (woorden.every(leg)) return cel;
  }
  return "STERAKLONIEDMBAU".split("");
}

/** Een verse sleutel per POTJE, niet per dag: twee keer spelen hoort nooit
 *  hetzelfde bord te geven. Voor de echte arena komt hier de dagseed van de
 *  server terug als het bord voor iedereen gelijk moet zijn; dat is een keuze
 *  tussen variatie en een ranglijst waarin iedereen dezelfde borden had. */
const versSleutel = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---- bouwstenen -------------------------------------------------------------
function Sectie({ art, verhouding, breedte = VAK, kind, children }: { art: string; verhouding: number; breedte?: string; kind?: React.Ref<HTMLDivElement>; children?: React.ReactNode }) {
  return (
    <div ref={kind} style={{ position: "relative", width: breedte, height: `calc(${breedte} / ${verhouding})`, flexShrink: 0 }}>
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

/** Een gevonden woord in de vorm van de glasrijen, maar met de gouden lijn van
 *  deze sectie. De lijn is de rand die tussen twee geknipte lagen uitsteekt. */
function WoordVak({ woord, n, weg }: { woord: string; n: number; weg?: boolean }) {
  return (
    <span
      className={weg ? "soep-weg" : "soep-lijn soep-vak"}
      style={{
        display: "inline-flex", height: "84%", padding: 1,
        clipPath: ACHT(6),
        background: `linear-gradient(100deg, ${withAlpha("#B0710E", 0.85)} 0%, ${withAlpha("#FFD98A", 0.95)} 22%, ${withAlpha("#FFF6DC", 1)} 34%, ${withAlpha("#FFD98A", 0.95)} 46%, ${withAlpha("#B0710E", 0.85)} 70%, ${withAlpha("#B0710E", 0.85)} 100%)`,
        backgroundSize: "200% 100%",
      }}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, paddingInline: 9,
          clipPath: ACHT(5),
          background: PANEEL,
          fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: withAlpha("#FFE7A8", 0.92),
        }}
      >
        {woord}
        <span style={{ fontFamily: font.display, fontWeight: 800, color: "#FFC23D" }}>{punten(n)}</span>
      </span>
    </span>
  );
}

const klok = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---- het spel ---------------------------------------------------------------
export function PreviewLettersoep() {
  useEffect(() => {
    document.body.classList.add("soepspel");
    return () => document.body.classList.remove("soepspel");
  }, []);

  const [potje, setPotje] = useState(versSleutel);
  const [level, setLevel] = useState(1);
  const [totaal, setTotaal] = useState(0);
  const [pad, setPad] = useState<number[]>([]);
  const [gevonden, setGevonden] = useState<{ woord: string; n: number }[]>([]);
  const [dezeLevel, setDezeLevel] = useState(0);
  const [fout, setFout] = useState(false);
  const [oordeel, setOordeel] = useState<{ cellen: number[]; goed: boolean } | null>(null);
  const [weg, setWeg] = useState<{ woord: string; n: number } | null>(null);
  const [over, setOver] = useState(SPEELTIJD_S);
  const [fase, setFase] = useState<"spel" | "val" | "klaar">("spel");

  const timers = useRef<number[]>([]);
  const na = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const bord = useMemo(() => maakBord(`${potje}:${level}`), [potje, level]);

  // De klok. Hij stopt zodra de poging voorbij is, ook als je zelf op stoppen
  // drukt: `fase` staat in de afhankelijkheden, dus het interval wordt dan
  // opgeruimd in plaats van door te tellen op een scherm dat al klaar is.
  useEffect(() => {
    if (fase !== "spel" && fase !== "val") return;
    const id = window.setInterval(() => {
      setOver((s) => {
        if (s <= 1) { setFase("klaar"); sound.win(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [fase]);

  const padRef = useRef<number[]>([]);
  padRef.current = pad;

  const leg = useCallback((cellen: number[]) => {
    const w = cellen.map((x) => bord[x]).join("");
    const goed = w.length >= 3 && NL_WOORDEN.has(w) && !gevonden.some((g) => g.woord === w);
    setOordeel({ cellen, goed });
    na(560, () => setOordeel(null));
    setPad([]);
    if (!goed) {
      sound.uiTap();
      setFout(true);
      na(400, () => setFout(false));
      return;
    }
    sound.approve();
    setGevonden((g) => {
      // De onderste strook toont er vier. Valt er een af, dan glijdt die eerst
      // weg; zonder dat zou hij op hetzelfde moment verdwijnen als de nieuwe
      // verschijnt en zie je alleen dat de rij verspringt.
      if (g.length >= TOON_WOORDEN) {
        const oudste = g[g.length - TOON_WOORDEN];
        setWeg(oudste);
        na(320, () => setWeg(null));
      }
      return [...g, { woord: w, n: w.length }];
    });
    setTotaal((t) => t + punten(w.length));
    const nieuw = dezeLevel + 1;
    setDezeLevel(nieuw);
    if (nieuw >= WOORDEN_PER_LEVEL) {
      setFase("val");
      sound.win();
      na(760, () => {
        setLevel((l) => l + 1);
        setDezeLevel(0);
        setFase("spel");
      });
    }
  }, [bord, gevonden, dezeLevel]);

  // ---- invoer: swipen en tikken ---------------------------------------------
  const bordRef = useRef<HTMLDivElement>(null);
  // Is de vinger tijdens dit indrukken op een TWEEDE vakje geweest? Dan was het
  // een veeg en levert loslaten in. Bleef hij op een vakje, dan was het een tik
  // en blijft het pad open.
  const geveegd = useRef(false);
  const bezig = useRef(false);

  /** Welk vakje ligt er onder dit punt? Via elementFromPoint en niet via de
   *  gebeurtenis van de knop zelf: tijdens een veeg blijft de eerste knop de
   *  aanwijzer vasthouden, dus zijn eigen gebeurtenissen zeggen niets meer. */
  const vakOnder = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    const knop = el?.closest("[data-vak]");
    const n = knop?.getAttribute("data-vak");
    return n == null ? null : Number(n);
  };

  const voegToe = useCallback((c: number) => {
    const oud = padRef.current;
    if (oud.length === 0) { sound.uiTap(); setPad([c]); return; }
    const i = oud.indexOf(c);
    if (i >= 0) {
      // Terug over je eigen pad snoeit af tot daar; hetzelfde vakje doet niets.
      if (i < oud.length - 1) setPad(oud.slice(0, i + 1));
      return;
    }
    if (!buur(oud[oud.length - 1], c)) return;
    sound.uiTap();
    setPad([...oud, c]);
  }, []);

  const omlaag = (c: number) => (e: React.PointerEvent) => {
    if (fase !== "spel") return;
    bezig.current = true;
    geveegd.current = false;
    setFout(false);
    // Geen pointer capture: dan zou het eerste vakje alle bewegingen houden en
    // ligt er nooit een ander vakje onder de vinger.
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    const oud = padRef.current;
    if (oud.length && oud[oud.length - 1] === c) { leg(oud); bezig.current = false; return; }
    if (oud.length && !oud.includes(c) && !buur(oud[oud.length - 1], c)) { setPad([c]); sound.uiTap(); return; }
    voegToe(c);
  };

  const beweeg = (e: React.PointerEvent) => {
    if (!bezig.current || fase !== "spel") return;
    const c = vakOnder(e.clientX, e.clientY);
    if (c == null) return;
    const oud = padRef.current;
    if (oud.length && oud[oud.length - 1] === c) return;
    if (oud.length && !oud.includes(c) && !buur(oud[oud.length - 1], c)) return;
    geveegd.current = true;
    voegToe(c);
  };

  const omhoog = () => {
    if (!bezig.current) return;
    bezig.current = false;
    if (geveegd.current && padRef.current.length) leg(padRef.current);
    geveegd.current = false;
  };

  const stop = () => setFase("klaar");
  const opnieuw = () => {
    setPotje(versSleutel());
    setLevel(1); setTotaal(0); setPad([]); setGevonden([]); setDezeLevel(0);
    setOver(SPEELTIJD_S); setFase("spel"); setFout(false); setOordeel(null); setWeg(null);
  };

  const woord = pad.map((c) => bord[c]).join("");
  const geldig = woord.length >= 3 && NL_WOORDEN.has(woord) && !gevonden.some((g) => g.woord === woord);
  const inPad = (c: number) => pad.indexOf(c);
  const midX = (c: number) => (KOL[c % 4] + VAK_B / 2) * 100;
  const midY = (c: number) => (RIJ[Math.floor(c / 4)] + VAK_H / 2) * 100;
  const zichtbaar = gevonden.slice(-TOON_WOORDEN);

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

        {fase === "klaar" ? (
          // ---- de uitslag: ALLES wat je vond, in dezelfde sectie -------------
          <Sectie art="/ui/soep/bord.webp?v=1" verhouding={BORD_V}>
            <div
              style={{
                position: "absolute", left: 0, right: 0,
                top: pct(PANEEL_TOP), height: pct(RIJ[0] - PANEEL_TOP),
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
              }}
            >
              <span style={{ fontFamily: font.wide, fontSize: 16, letterSpacing: 2.8, color: "#FFD98A", textShadow: "0 0 10px rgba(255,180,50,.55)" }}>
                {gevonden.length} WOORDEN
              </span>
              <span style={{ fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, color: withAlpha("#FFE7A8", 0.72) }}>
                level {level} · {totaal} punten
              </span>
            </div>
            <div
              className="zachtscroll"
              style={{
                position: "absolute",
                left: pct(KOL[0]), right: pct(1 - (KOL[3] + VAK_B)),
                top: pct(RIJ[0]), bottom: pct(1 - (RIJ[3] + VAK_H)),
                display: "flex", flexWrap: "wrap", alignContent: "flex-start", justifyContent: "center",
                gap: 6, overflowY: "auto", paddingTop: 4,
              }}
            >
              {gevonden.length === 0 ? (
                <span style={{ alignSelf: "center", fontFamily: font.ui, fontSize: 12, color: withAlpha("#FFE7A8", 0.5) }}>
                  geen woorden gevonden
                </span>
              ) : (
                gevonden.map((g) => (
                  <span key={g.woord} style={{ height: 22 }}>
                    <WoordVak woord={g.woord} n={g.n} />
                  </span>
                ))
              )}
            </div>
          </Sectie>
        ) : (
          // ---- het bord ------------------------------------------------------
          <Sectie art="/ui/soep/bord.webp?v=1" verhouding={BORD_V} kind={bordRef}>
            <img src="/ui/soep/letters-dof.webp?v=1" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

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
                nog {WOORDEN_PER_LEVEL - dezeLevel} van de {WOORDEN_PER_LEVEL} woorden
              </span>
            </div>

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
                    pointerEvents: "none", zIndex: 1,
                  }}
                />
              );
            })}

            {/* De verbindingslijn ACHTER de vakjes: hij duikt eronderdoor en
                komt in de kieren boven. */}
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
                    display: "block", zIndex: 2, pointerEvents: "none",
                    opacity: aan ? 1 : 0,
                    transition: aan ? "opacity .08s linear" : "opacity .2s ease-out",
                  }}
                />
              );
            })}

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

            {/* De tikvlakken. Ze vangen ook de veeg: `onPointerMove` kijkt met
                elementFromPoint welk vakje er onder de vinger ligt, want tijdens
                een veeg blijft de eerste knop anders de aanwijzer vasthouden. */}
            {bord.map((letter, c) => {
              const i = inPad(c);
              const aan = i >= 0;
              const beoordeeld = !!oordeel?.cellen.includes(c);
              const r = Math.floor(c / 4), k = c % 4;
              return (
                <button
                  key={`tik-${level}-${c}`}
                  data-vak={c}
                  onPointerDown={omlaag(c)}
                  onPointerMove={beweeg}
                  onPointerUp={omhoog}
                  onPointerCancel={omhoog}
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
                    touchAction: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span
                    className={fase === "val" ? "soep-val" : "soep-kom"}
                    style={{
                      animationDelay: `${(fase === "val" ? c : r * 4 + k) * 30}ms`,
                      position: "relative", zIndex: 5,
                      fontFamily: font.wide, fontSize: 24, letterSpacing: 1,
                      color: aan || beoordeeld ? "#FFF6DC" : "#FFD98A",
                      textShadow: aan || beoordeeld ? "0 1px 2px rgba(20,16,10,.75)" : "0 0 9px rgba(255,170,40,.45)",
                    }}
                  >
                    {letter}
                  </span>
                  {aan && (
                    <span style={{ position: "absolute", top: "8%", right: "12%", zIndex: 5, fontFamily: font.ui, fontSize: 9, fontWeight: 800, color: "#FFE7A8" }}>
                      {i + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </Sectie>
        )}

        <Sectie art="/ui/soep/onder.webp?v=1" verhouding={ONDER_V}>
          <div
            className={fout ? "soep-fout" : undefined}
            style={{
              position: "absolute",
              left: pct(ONDER_RUIT.l), width: pct(ONDER_RUIT.b),
              top: pct(ONDER_RUIT.woord.t), height: pct(ONDER_RUIT.woord.h),
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            }}
          >
            {fase === "klaar" ? (
              <span style={{ fontFamily: font.wide, fontSize: 21, letterSpacing: 2.4, color: "#FFF3D0" }}>
                TIJD OM · {totaal} PUNTEN
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
                veeg over de letters, of tik ze een voor een
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
            {/* Op het eindscherm staat de volle lijst al in de sectie erboven;
                dezelfde vier daar nog eens herhalen leest als een fout. */}
            {fase === "klaar" ? (
              <span style={{ fontFamily: font.ui, fontSize: 11.5, color: withAlpha("#FFE7A8", 0.6) }}>
                tik op Opnieuw voor een nieuw bord
              </span>
            ) : (
              <>
                {weg && <WoordVak key={`weg-${weg.woord}`} woord={weg.woord} n={weg.n} weg />}
                {zichtbaar.map((g) => (
                  <WoordVak key={g.woord} woord={g.woord} n={g.n} />
                ))}
                {gevonden.length === 0 && (
                  <span style={{ fontFamily: font.ui, fontSize: 11, color: withAlpha("#FFE7A8", 0.45) }}>je woorden komen hier</span>
                )}
              </>
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
