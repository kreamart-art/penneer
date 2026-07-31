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
import { KADER_LIJN_GOUD, KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { colors, font, withAlpha } from "../theme/tokens";
import { sound } from "../sound/sound";
import { VAK } from "./Arena";

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

/** De tab die over de bovenrand van het kader valt. Een kleiner kader met
 *  dezelfde lijn, zodat het één stuk metaal lijkt in plaats van een etiket. */
function Tab({ tekst }: { tekst: string }) {
  return (
    <div style={{ position: "absolute", top: -13, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 2, pointerEvents: "none" }}>
      <NeonKader
        radius={7}
        hoek={9}
        dik={0.45}
        vulling="zwart"
        lijn={KADER_LIJN_GOUD}
        gloed="0 0 12px rgba(255,190,60,.3)"
        binnen={{ padding: "4px 22px" }}
      >
        <span style={{ fontFamily: font.wide, fontSize: 11.5, letterSpacing: 2.4, textTransform: "uppercase", color: "#FFD98A", textShadow: "0 0 10px rgba(255,180,50,.55)" }}>
          {tekst}
        </span>
      </NeonKader>
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

/** Het vak met de som erin: dezelfde vorm als het kader eromheen, een slag
 *  kleiner en een slag donkerder, zodat het erin ligt in plaats van erop. */
function SomVenster({ children }: { children: React.ReactNode }) {
  return (
    <NeonKader
      radius={10}
      hoek={13}
      dik={0.4}
      vulling="geen"
      lijn={KADER_LIJN_GOUD}
      gloed="0 0 10px rgba(255,190,60,.22)"
      style={{ width: "100%" }}
      binnen={{
        padding: "18px 14px",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #101A30 0%, #0A1220 60%, #070C16 100%)",
        boxShadow: "inset 0 2px 14px rgba(0,0,0,.6)",
      }}
    >
      {children}
    </NeonKader>
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
        {/* Het vraagpaneel. Alles in code: een gouden verlooprand met een
            afsnijding op de hoeken, de naam op een tab die over de bovenrand
            valt, het somvak erin met zijn eigen dunnere lijn, en onderin de
            klok als balk plus ring. */}
        <div style={{ position: "relative", width: VAK }}>
          <Tab tekst="REKENLADDER" />
          <NeonKader
            radius={14}
            hoek={18}
            dik={0.55}
            vulling="geen"
            lijn={KADER_LIJN_GOUD}
            gloed="verloop"
            binnen={{
              padding: "22px 16px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              background: "linear-gradient(180deg, rgba(30,14,52,.92) 0%, rgba(18,8,34,.94) 55%, rgba(10,4,22,.96) 100%)",
            }}
          >
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
          </NeonKader>
        </div>

        {/* De teller staat onder het paneel tot de ladder-art er is. */}
        {fase !== "klaar" && (
          <div style={{ display: "flex", gap: 18, fontFamily: font.ui, fontSize: 12, color: withAlpha("#FFE7A8", 0.75) }}>
            <span>TREDE <b style={{ fontFamily: font.display, fontSize: 15, color: "#FFF3D0" }}>{trede}</b></span>
            <span>PUNTEN <b style={{ fontFamily: font.display, fontSize: 15, color: "#FFF3D0" }}>{totaal}</b></span>
          </div>
        )}

        {/* De vier antwoorden. Zolang de ladder-art er nog niet is staan ze in
            een raster; ze worden de treden zodra die er is. */}
        {fase !== "tel" && fase !== "klaar" && (
          <div style={{ width: VAK, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {som.keuzes.map((w) => (
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
