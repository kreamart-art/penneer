// Woordketen: het arenaspel van maandag.
//
// EEN KETTING DIE BLIJFT GROEIEN. Elk woord begint met de laatste letter van het
// vorige, en dat woord verzin je ZELF: je typt het in. Bestaat het, en begint het
// met de goede letter, dan klikt het aan de ketting en telt de volgende schakel.
//
// DE SCHEIDSRECHTER STAAT OP DE SERVER. De woordenlijst op de client (1306 NL,
// 1557 EN) is prima om woorden UIT te halen maar te mager om woorden AF TE
// KEUREN, dus die lijst is alleen de snelweg: staat je woord erin, dan is het
// meteen goed en gaat er niets over de lijn. Alles daarbuiten gaat langs
// /api/arena/keten, waar eerst de gedeelde verdict-cache kijkt en pas daarna de
// AI-scheids. Is die niet bereikbaar, dan telt het woord GOED: een speler hoort
// niet te vallen omdat onze verbinding hapert.
//
// DE INDELING KOMT UIT DE MOCKUP en is helemaal art:
//
//   het hangende bord aan kettingen   de stand, met het schakel-medaillon
//   het lange klembord                de ketting die je hebt gebouwd
//   het groene bord                   het woord waar je nu op staat
//   het korte klembord                het invulveld
//   de houten plaat                   opnieuw of stoppen
//
// Alles staat absoluut in EEN doos met een vaste verhouding, net als in het
// bestand waar de mockup uit komt. De onderdelen overlappen elkaar daar (het
// groene bord ligt OP het lange klembord), en dat krijg je met een kolom van
// blokken nooit precies goed.
//
// DE SCHADUWEN zijn tweede kopieën van dezelfde art met brightness(0) en een
// blur, net als bij de knoppen op de main page. Geen drop-shadow-filter: die
// rastert Safari apart en dan zie je de rechthoek van de laag over de art heen.
// Het lange klembord krijgt er GEEN, want dat vervaagt aan de onderkant naar de
// achtergrond toe en een schaduw zou die overgang verraden.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { Screen } from "../components/Layout";
import { colors, font, withAlpha } from "../theme/tokens";
import { sound } from "../sound/sound";
import { useT } from "../i18n/i18n";
import { woordenboek, type Woordenboek } from "../data/woorden";

/** De klok per schakel. TWINTIG SECONDEN, elke schakel dezelfde: je moet een
 *  woord VERZINNEN en typen, en dat kost meer dan een tik. Moet gelijk lopen met
 *  WOORDKETEN_VENSTER in backend/app/arena.py; staat het daar anders, dan keurt
 *  de server een eerlijke poging af. */
export const KETEN_VENSTER = 20000;

/** Hoeveel woorden er minstens met een letter moeten beginnen voordat die letter
 *  een geldig EINDE van een startwoord is. Onder die grens zet je de speler op
 *  een letter waar hij zelf ook bijna niets op kan verzinnen. */
const MIN_VERVOLG = 8;

/** Wat een schakel oplevert: honderd maal het nummer, plus de helft daarvan naar
 *  rato van de tijd die je overhield. Maal het nummer en niet vast, zodat twee
 *  spelers die allebei ver komen niet op dezelfde stand uitkomen. Dat is
 *  arenaregel 1: een score zonder plafond. */
export const puntenVoor = (schakel: number, rest: number) =>
  100 * schakel + Math.round(50 * schakel * Math.max(0, Math.min(1, rest)));

// ---- seed en woordenlijst ---------------------------------------------------

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

/** De woorden op beginletter, plus de letters waar genoeg woorden mee beginnen.
 *  Eén keer per woordenboek uitrekenen en bewaren. */
const kaartjes = new WeakMap<Woordenboek, { per: Map<string, string[]>; levend: Set<string> }>();
function kaart(wb: Woordenboek) {
  const oud = kaartjes.get(wb);
  if (oud) return oud;
  const per = new Map<string, string[]>();
  for (const w of wb.WOORDEN) {
    const lijst = per.get(w[0]);
    if (lijst) lijst.push(w); else per.set(w[0], [w]);
  }
  for (const lijst of per.values()) lijst.sort();
  const levend = new Set<string>();
  for (const [l, lijst] of per) if (lijst.length >= MIN_VERVOLG) levend.add(l);
  const nieuw = { per, levend };
  kaartjes.set(wb, nieuw);
  return nieuw;
}

/** Het woord waar de ketting mee begint. Kort, en het moet ergens heen kunnen. */
export function startWoord(rng: () => number, wb: Woordenboek): string {
  const { per, levend } = kaart(wb);
  const alles: string[] = [];
  for (const lijst of per.values()) for (const w of lijst) if (w.length <= 5 && levend.has(w[w.length - 1])) alles.push(w);
  alles.sort();
  return alles[Math.floor(rng() * alles.length)];
}

const schoon = (s: string) => s.trim().toUpperCase().replace(/[^A-ZÀ-Ü'\- ]/g, "");

// ---- de maten van de art ----------------------------------------------------
//
// Alles in delen van de BREEDTE van de doos, ook de hoogtes: dan schaalt de hele
// bouw met de schermbreedte mee en blijft de verhouding tussen de onderdelen
// staan. De verhoudingen komen uit de bestanden zelf, de plekken uit de mockup.
//
// OPGEMETEN IN DE MOCKUP, niet geschat. Het doek daar is 872 breed, en de vijf
// stukken staan er op (links, breedte, top) in doekpunten:
//
//   bord    48  778   0      klembord  40  790  427
//   groen   48  782  712     invul     40  790  1073
//   knop   229  366  1483
//
// Gedeeld door 872 wordt dat de tabel hieronder. Nagerekend of de art dan ook
// zijn eigen verhouding houdt: het groene bord komt uit op 2,52 tegen 2,58 in
// het bestand, het lange klembord op 0,89 tegen 0,87, het korte op 3,59 tegen
// 3,66. Er is dus NIETS uitgerekt in de mockup, en hier hoeft dat ook niet.
const ART = {
  bord: { v: 1080 / 545, l: 0.055, b: 0.892, t: 0 },     // hangend bord met kettingen
  klem: { v: 1080 / 1244, l: 0.046, b: 0.906, t: 0.490 },// lang klembord, de ketting
  woord: { v: 1080 / 419, l: 0.055, b: 0.897, t: 0.817 },// groen bord, het woord
  invul: { v: 1080 / 295, l: 0.046, b: 0.906, t: 1.231 },// kort klembord, het veld
  knop: { v: 720 / 202, l: 0.263, b: 0.420, t: 1.701 },  // houten plaat, de knop
} as const;
/** Hoe hoog de hele bouw is, in dezelfde eenheid. */
const HOOG = ART.knop.t + ART.knop.b / ART.knop.v + 0.02;

/** In het hangende bord: waar de twee planken liggen, in delen van de arthoogte.
 *  Opgemeten: boven de 0,54 zijn het de kettingen, daaronder het hout. */
const PLANK = { t: 0.55, h: 0.36, links: [0.04, 0.34], rechts: [0.66, 0.96] };

const GOUD_FEL = "#FFE9A8";
const GOUD = "#E7B75A";
const INKT = "#3A2A17";     // de kleur van geschreven tekst op het papier
const GROEN_INKT = "#EBF5DC";

/** Een stuk art op zijn plek, met een schaduw eronder tenzij die uit staat. */
function Laag({ art, maat, schaduw = true, zIndex, children, blur = 9, zak = 7 }: {
  art: string;
  maat: { v: number; l: number; b: number; t: number };
  schaduw?: boolean;
  zIndex?: number;
  children?: React.ReactNode;
  blur?: number;
  zak?: number;
}) {
  const pb = (v: number) => `${(v * 100).toFixed(4)}%`;
  return (
    <div
      style={{
        position: "absolute",
        left: pb(maat.l), width: pb(maat.b),
        // De hoogte via de verhouding van het bestand, en de top in dezelfde
        // eenheid als de breedte: `padding-top` en `top` rekenen allebei met de
        // BREEDTE van de doos, dus dat klopt vanzelf met elkaar.
        // `top` in procenten rekent met de HOOGTE van de doos en `left`/`width`
        // met de breedte. De maten hieronder staan allemaal in delen van de
        // BREEDTE, dus de top wordt hier omgerekend door HOOG. Zonder die deling
        // zakt alles ruim anderhalf keer te ver naar beneden.
        top: pb(maat.t / HOOG), aspectRatio: `${maat.v}`,
        zIndex,
      }}
    >
      {schaduw && (
        <img
          src={art} alt="" aria-hidden draggable={false}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
            filter: `brightness(0) blur(${blur}px)`, opacity: 0.5, transform: `translateY(${zak}px)`,
            pointerEvents: "none",
          }}
        />
      )}
      <img
        src={art} alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
      />
      {children}
    </div>
  );
}

/** Een teller op een plank van het hangende bord. */
function Teller({ kop, waarde, kant }: { kop: string; waarde: string; kant: "links" | "rechts" }) {
  const [a, b] = kant === "links" ? PLANK.links : PLANK.rechts;
  return (
    <span
      style={{
        position: "absolute",
        left: `${a * 100}%`, width: `${(b - a) * 100}%`,
        top: `${PLANK.t * 100}%`, height: `${PLANK.h * 100}%`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
        pointerEvents: "none",
      }}
    >
      <span style={{ fontFamily: font.wide, fontSize: 9, letterSpacing: 1.4, marginRight: -1.4, color: withAlpha(GOUD_FEL, 0.82) }}>{kop}</span>
      <span
        style={{
          fontFamily: font.display, fontWeight: 800, fontSize: 20, lineHeight: 1,
          color: "#FFF6DE", fontVariantNumeric: "tabular-nums",
          textShadow: "0 1px 2px rgba(40,20,0,.8)",
        }}
      >
        {waarde}
      </span>
    </span>
  );
}

/** Een pijltje tussen twee schakels op het klembord. Wijst NAAR BENEDEN, want
 *  daar groeit de ketting heen. */
function Pijl() {
  return (
    <svg width="11" height="9" viewBox="0 0 11 9" aria-hidden style={{ display: "block", opacity: 0.5 }}>
      <path d="M5.5 8.4 L0.7 1.2 L10.3 1.2 Z" fill={INKT} />
    </svg>
  );
}

// ---- het spel ---------------------------------------------------------------

type Fase = "tel" | "spel" | "kijkt" | "klaar";

export function Woordketen({ seed, onKlaar, onOpnieuw }: {
  seed: string;
  onKlaar?: (score: number, level: number, timeMs: number) => void;
  onOpnieuw?: () => void;
}) {
  const { t, lang } = useT();
  const wb = useMemo(() => woordenboek(lang), [lang]);
  useEffect(() => {
    document.body.classList.add("ketenspel");
    return () => document.body.classList.remove("ketenspel");
  }, []);

  const [fase, setFase] = useState<Fase>("tel");
  const [tel, setTel] = useState(3);
  const [ketting, setKetting] = useState<string[]>([]);
  const [invoer, setInvoer] = useState("");
  const [melding, setMelding] = useState<string | null>(null);
  const [totaal, setTotaal] = useState(0);
  const [rest, setRest] = useState(1);

  const rng = useRef(maakRng(seed));
  const gebruikt = useRef<Set<string>>(new Set());
  const beslist = useRef(false);
  const t0 = useRef(performance.now());
  const ingeleverd = useRef(false);
  const veld = useRef<HTMLInputElement | null>(null);

  const schakel = Math.max(0, ketting.length - 1);   // hoeveel schakels je maakte
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
    beslist.current = false;
    setRest(1);
    t0.current = performance.now();
  }, [fase, tel, wb]);

  // De klok van deze schakel. Staat STIL terwijl de scheidsrechter kijkt: dat
  // wachten is van ons en niet van de speler.
  useEffect(() => {
    if (fase !== "spel" || !huidig) return;
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
  }, [fase, ketting.length]);

  // Het veld pakt de aandacht zodra er een nieuwe schakel te maken is.
  useEffect(() => { if (fase === "spel") veld.current?.focus(); }, [fase, ketting.length]);

  useEffect(() => {
    if (fase !== "klaar" || !onKlaar || ingeleverd.current) return;
    ingeleverd.current = true;
    onKlaar(totaal, schakel, Math.round(performance.now() - t0.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  function mis(reden: string | null) {
    if (beslist.current) return;
    beslist.current = true;
    sound.klemFout();
    sound.haptic([18, 40, 18]);
    setMelding(reden);
    na(900, () => setFase("klaar"));
  }

  async function lever() {
    if (fase !== "spel" || beslist.current) return;
    const woord = schoon(invoer);
    if (woord.length < 2) return;
    if (woord[0] !== letter) { setMelding(t("ketenFoutLetter", { letter })); return; }
    if (gebruikt.current.has(woord)) { setMelding(t("ketenFoutHerhaling")); return; }

    const overGehouden = rest;
    // De lijst is de snelweg: staat het woord erin, dan gaat er niets over de
    // lijn en voelt de ketting meteen door.
    if (wb.WOORDEN.has(woord)) { goed(woord, overGehouden); return; }

    setFase("kijkt");
    setMelding(null);
    let ok = true;
    try {
      const r = await fetch("/api/arena/keten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: woord, letter, lang }),
      });
      const d = r.ok ? await r.json() : null;
      ok = d ? !!d.ok : true;
    } catch {
      ok = true;                       // onbereikbaar telt als goed
    }
    if (beslist.current) return;
    if (ok) { setFase("spel"); goed(woord, overGehouden); }
    else { setFase("spel"); mis(t("ketenFoutOnbekend", { woord })); }
  }

  function goed(woord: string, overGehouden: number) {
    const nummer = schakel + 1;
    sound.klemGoed();
    sound.haptic(10);
    if (nummer % 5 === 0) sound.reeks();
    gebruikt.current.add(woord);
    setTotaal((s) => s + puntenVoor(nummer, overGehouden));
    setInvoer("");
    setMelding(null);
    setKetting((k) => [...k, woord]);
  }

  // De laatste drie schakels op het klembord, de nieuwste onderaan.
  const zichtbaar = ketting.slice(-4, -1);
  const bezig = fase === "spel" || fase === "kijkt";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: 4 }}>
      <div style={{ position: "relative", width: "min(360px, 94vw)", paddingBottom: `${HOOG * 100}%` }}>
        {/* HET HANGENDE BORD: de stand. */}
        <Laag art="/ui/keten/scorebord.webp?v=1" maat={ART.bord} zIndex={4} blur={10} zak={8}>
          <Teller kant="links" kop={t("ketenSchakel")} waarde={String(schakel)} />
          <Teller kant="rechts" kop={t("soepPunten")} waarde={String(totaal)} />
        </Laag>

        {/* HET LANGE KLEMBORD: de ketting die je hebt gebouwd. Geen schaduw: hij
            vervaagt aan de onderkant naar de achtergrond toe. */}
        <Laag art="/ui/keten/klembord-lang.webp?v=1" maat={ART.klem} schaduw={false} zIndex={1}>
          <div
            style={{
              position: "absolute", left: "10%", right: "10%", top: "8%", height: "28%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 2,
              pointerEvents: "none",
            }}
          >
            {zichtbaar.length === 0 && (
              <span style={{ fontFamily: font.ui, fontSize: 11.5, color: withAlpha(INKT, 0.5), marginTop: 6 }}>{t("ketenLeeg")}</span>
            )}
            {zichtbaar.map((w, i) => (
              <span key={`${w}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, opacity: 0.45 + i * 0.22 }}>
                <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, letterSpacing: 0.9, marginRight: -0.9, color: INKT }}>{w}</span>
                {i < zichtbaar.length - 1 && <Pijl />}
              </span>
            ))}
            {zichtbaar.length > 0 && <Pijl />}
          </div>
        </Laag>

        {/* HET GROENE BORD: het woord waar je nu op staat, met de letter die je
            moet gebruiken in het goud. */}
        <Laag art="/ui/keten/woordvak.webp?v=1" maat={ART.woord} zIndex={3} blur={10} zak={7}>
          <div
            style={{
              // Het WOORD krijgt de ruimte in het midden; de streep en de regel
              // eronder zakken naar de onderrand van het bord. Zo staat er boven
              // het woord net zoveel lucht als er onder de regel overblijft en
              // leest het bord van boven naar beneden: waar sta je, hoe lang heb
              // je nog, en wat is er aan de hand.
              position: "absolute", inset: "7% 7% 5%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 0,
              pointerEvents: "none",
            }}
          >
            {/* Twee lagen: een vak dat de ruimte pakt en centreert, en DAARIN het
                woord als één regel. Zonder dat tussenvak worden de twee stukken
                (het woord en zijn laatste letter) twee vakken onder elkaar. */}
            <span style={{ flex: 1, display: "grid", placeItems: "center", width: "100%", minHeight: 0 }}>
              <span
                style={{
                  fontFamily: font.display, fontWeight: 800, fontSize: 34, lineHeight: 1.05,
                  letterSpacing: 2.2, marginRight: -2.2, color: GROEN_INKT,
                  textShadow: "0 2px 6px rgba(0,0,0,.5)", whiteSpace: "nowrap",
                }}
              >
                {huidig ? huidig.slice(0, -1) : ""}
                {huidig && <span style={{ color: GOUD, textShadow: `0 0 14px ${withAlpha(GOUD, 0.6)}, 0 2px 6px rgba(0,0,0,.6)` }}>{letter}</span>}
              </span>
            </span>
            {/* De klok als dun spoor TUSSEN het woord en de regel eronder, zoals
                in de mockup: hij hoort bij het woord waar je op staat en niet bij
                de tekst die uitlegt wat er aan de hand is. */}
            <span
              style={{
                width: "88%", height: 3, marginBottom: 3,
                borderRadius: 999, background: "rgba(0,0,0,.28)", overflow: "hidden", flexShrink: 0,
              }}
            >
              <span
                style={{
                  display: "block", height: "100%", borderRadius: 999,
                  width: `${(bezig ? rest : 0) * 100}%`,
                  background: rest > 0.45 ? GOUD : rest > 0.2 ? "#FF9F45" : "#FF5A4E",
                  transition: "width .1s linear, background .3s",
                }}
              />
            </span>
            <span style={{ fontFamily: font.ui, fontSize: 11, letterSpacing: 0.6, color: withAlpha(GROEN_INKT, 0.66), textAlign: "center" }}>
              {fase === "tel" ? t("ketenKlaar")
                : fase === "kijkt" ? t("ketenKijkt")
                : fase === "klaar" ? (melding ?? t("ketenGebroken", { n: schakel }))
                : melding ?? t("ketenKies", { letter })}
            </span>
          </div>
        </Laag>

        {/* HET KORTE KLEMBORD: het invulveld. */}
        <Laag art="/ui/keten/klembord-invul.webp?v=1" maat={ART.invul} zIndex={3} blur={9} zak={6}>
          <form
            onSubmit={(e) => { e.preventDefault(); void lever(); }}
            style={{ position: "absolute", inset: "22% 8% 14%", display: "flex", alignItems: "center", gap: 8 }}
          >
            <input
              ref={veld}
              value={invoer}
              onChange={(e) => setInvoer(e.target.value)}
              disabled={!bezig}
              placeholder={letter ? t("ketenVeld", { letter }) : ""}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="send"
              style={{
                flex: 1, minWidth: 0, appearance: "none", background: "transparent", border: "none", outline: "none",
                fontFamily: font.display, fontWeight: 800, fontSize: 19, letterSpacing: 1.4,
                // ZWART, niet de bruine inkt van het papier: wat je zelf typt moet
                // eruit springen tegen wat er al staat.
                color: "#12100C", textTransform: "uppercase",
                borderBottom: `1.5px dashed ${withAlpha(INKT, 0.35)}`, padding: "2px 2px 3px",
              }}
            />
            <button
              type="submit"
              className="pressable"
              disabled={!bezig || schoon(invoer).length < 2}
              style={{
                appearance: "none", border: "none", cursor: "pointer", flexShrink: 0,
                padding: "6px 13px", borderRadius: 8,
                background: "linear-gradient(180deg, #2F6B33 0%, #1C4520 100%)",
                boxShadow: `inset 0 0 0 1px ${withAlpha(GOUD, 0.6)}, inset 0 1px 0 rgba(255,255,255,.2), 0 2px 6px rgba(0,0,0,.35)`,
                opacity: !bezig || schoon(invoer).length < 2 ? 0.45 : 1,
                fontFamily: font.wide, fontSize: 11, letterSpacing: 1.2, marginRight: -1.2, color: "#FFF3D0",
              }}
            >
              {fase === "kijkt" ? t("ketenKijktKort") : t("ketenLever")}
            </button>
          </form>
        </Laag>

        {/* DE HOUTEN PLAAT: opnieuw of stoppen. */}
        {(fase !== "klaar" || onOpnieuw) && (
          <Laag art="/ui/keten/knop.webp?v=1" maat={ART.knop} zIndex={3} blur={8} zak={6}>
            <button
              onClick={fase === "klaar" ? onOpnieuw : () => setFase("klaar")}
              className="pressable"
              style={{
                position: "absolute", inset: 0, appearance: "none", background: "transparent", border: "none",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                fontFamily: font.wide, fontSize: 12.5, letterSpacing: 1.4, marginRight: -1.4,
                color: GOUD_FEL, textShadow: "0 1px 3px rgba(30,14,0,.85)",
              }}
            >
              {fase === "klaar" ? <RotateCcw size={14} /> : <LogOut size={14} />}
              {fase === "klaar" ? t("soepOpnieuw") : t("arenaStop")}
            </button>
          </Laag>
        )}

        {fase === "tel" && (
          <span
            style={{
              position: "absolute", left: 0, right: 0, top: `${((ART.woord.t + 0.06) / HOOG) * 100}%`,
              textAlign: "center", zIndex: 5, pointerEvents: "none",
              fontFamily: font.display, fontWeight: 800, fontSize: 46, lineHeight: 1,
              color: "#FFFFFF", textShadow: "0 0 18px rgba(255,220,150,.5), 0 3px 8px rgba(0,0,0,.6)",
            }}
          >
            {Math.max(1, tel)}
          </span>
        )}
      </div>
    </div>
  );
}

const versSleutel = () => `keten-${Math.random().toString(36).slice(2)}`;

/** De testversie achter `?keten`: eigen kop, eigen sleutel, levert niets in. */
export function PreviewWoordketen() {
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
      <Woordketen key={potje} seed={potje} onOpnieuw={() => setPotje(versSleutel())} />
    </Screen>
  );
}

export default PreviewWoordketen;
