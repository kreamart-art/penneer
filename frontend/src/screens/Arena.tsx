// De Arena: het derde deel van de dagronde, met elke weekdag een eigen spel.
//
// De drie regels van elke arenadag:
//   ceilingloos scoren, 24 uur open met onbeperkte gratis pogingen waarvan de
//   beste telt, en de verdringingspush zodra iemand je van plek 1 stoot (die
//   verstuurt de server bij het inleveren).
//
// Dit scherm is de schil voor alle zeven spellen: intro met het bord, het spel
// zelf, en de uitslag met "nog een poging". Vandaag is alleen de Flitsreeks
// gebouwd; de andere dagen tonen hun naam met "binnenkort", zodat de kalender
// vanaf dag een klopt.
//
// FLITSREEKS: een geseede reeks pads flitst op en jij tikt hem na. Elke ronde
// wordt DEZELFDE reeks een element langer (zo werkt het onthouden: je bouwt
// een pad op, je leert niet elke ronde een nieuw). Score-contract met de
// server: per voltooide reeks van lengte k komt er k*100 bij plus een
// snelheidsbonus van hoogstens 99. De server controleert dat bij het
// inleveren, samen met de minimaal benodigde tijd.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { KnopPlaat } from "../components/KnopPlaat";
import { Screen } from "../components/Layout";
import { NeonText } from "../components/NeonText";
import { ArtSchaduw, GOUD, KADER_LIJN_ROOD, NeonKader, Paneel, PlekWapen } from "../components/ProfileHero";
import { GlasRij, Lijst } from "./Hub";
import { Kleurenklem } from "./_PreviewKleurenklem";
import { Rekenladder } from "./_PreviewRekenladder";
import { Woordketen } from "./_PreviewWoordketen";
import { Lettersoep } from "./_PreviewLettersoep";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

interface BordRij {
  id: string;
  name: string;
  color: string;
  has_avatar?: boolean | number;
  avatar_ver: number;
  divisie?: number;
  score: number;
  time_ms: number;
}
interface Info {
  day: string;
  game: string;
  af: boolean;
  seconds_left: number;
  players: number;
  board: BordRij[];
  rank: number;
  beste: number;
  pogingen: number;
}

/** Seeded RNG (mulberry32) uit de dag-seed van de server: elke speler krijgt
 *  exact dezelfde reeks, anders is het bord een loterij. */
function maakRng(seedHex: string): () => number {
  let a = parseInt(seedHex.slice(0, 8), 16) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function klok(s: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const u = Math.floor(s / 3600);
  return `${u}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// De breedte van het hele apparaat. De LED-balk en de kast delen hem, want ze
// horen als EEN geheel te lezen: de stand boven, het bord eronder.
export const VAK = "min(360px, 94vw)";
// De verhouding van de kast-art, na het wegknippen van de doorzichtige rand.
export const KAST = 0.9241;

// De vier pads staan nu OP de sectie opgemaakt: de kast, de doffe knoppen en de
// opgelichte knoppen komen als hetzelfde doek uit de art, op dezelfde uitsnede
// geknipt. Daarmee is de OPMAAK de uitlijning en valt er niets meer te plaatsen.
// Zolang de knoppen los stonden moest ik hun raster narekenen (hoe groot, welk
// gat, waar in de ruit) en daar liep het steeds op scheef.
//
// De opgelichte stand staat per pad apart, want er brandt er maar een tegelijk.
// De maten hieronder zijn breuken van de uitsnede: `a*` is de doos van de
// opgelichte art (die reikt verder, want zijn licht valt buiten de knop), `k*` is
// de doos van de knop zelf en daarmee het tikvlak.
const KNOPPEN = [
  { kleur: colors.gold, art: "goud", aL: 0.0733, aT: 0.1225, aB: 0.4104, kL: 0.1515, kT: 0.1806, kB: 0.3301, kH: 0.3327 },
  { kleur: colors.violet, art: "violet", aL: 0.5101, aT: 0.1663, aB: 0.3746, kL: 0.5098, kT: 0.1806, kB: 0.3550, kH: 0.3327 },
  { kleur: colors.green, art: "groen", aL: 0.1094, aT: 0.5382, aB: 0.3734, kL: 0.1515, kT: 0.5374, kB: 0.3301, kH: 0.3368 },
  { kleur: colors.red, art: "rood", aL: 0.5101, aT: 0.5380, aB: 0.4131, kL: 0.5098, kT: 0.5374, kB: 0.3550, kH: 0.3368 },
] as const;

// Hoeveel de halo buiten de knop uitwaaiert, als deel van de knop.
const HALO = 0.17;
const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

/** Het bord: de kast met de vier knoppen erin.
 *
 *  Drie lagen op inset 0 (kast, doffe knoppen) plus per pad een opgelichte laag
 *  op zijn eigen plek. De tikvlakken liggen als laatste bovenop, want die moeten
 *  de aanraking krijgen. */
function Bord({ aanNu, uit, onTik }: { aanNu: number | null; uit: boolean; onTik: (i: number) => void }) {
  const { t } = useT();
  return (
    <div style={{ position: "relative", width: VAK, height: `calc(${VAK} / ${KAST})`, flexShrink: 0 }}>
      <ArtSchaduw art="/ui/flits/machine.webp?v=5" />
      <img src="/ui/flits/machine.webp?v=5" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <img src="/ui/flits/knoppen-dof.webp?v=4" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {KNOPPEN.map((k, i) => {
        const aan = aanNu === i;
        return (
          <div key={k.art} aria-hidden style={{ position: "absolute", inset: 0, zIndex: aan ? 2 : 1, pointerEvents: "none" }}>
            {/* De halo: het licht dat de kast OP loopt. De art houdt zijn eigen
                gloed binnen de omranding van de knop, dus dit is wat er buiten
                valt. Als eigen vervaagde laag en niet als drop-shadow-filter:
                die rastert op iOS de doos van de laag mee en dan zie je een
                rechthoek om je flits. */}
            <span
              style={{
                position: "absolute",
                left: pct(k.kL - k.kB * HALO),
                top: pct(k.kT - k.kH * HALO),
                width: pct(k.kB * (1 + HALO * 2)),
                height: pct(k.kH * (1 + HALO * 2)),
                borderRadius: "30%",
                // De kracht staat BUITEN de knop: de dekkende knop bedekt dit
                // verloop tot ruim de helft, dus alles voor dat punt zie je toch
                // niet. Vol tot 46 procent en pas daarna de afval, anders is de
                // gloed al uitgedoofd voordat hij achter de knop uit komt.
                background: `radial-gradient(circle, ${k.kleur} 0%, ${k.kleur} 46%, ${withAlpha(k.kleur, 0.82)} 57%, ${withAlpha(k.kleur, 0.42)} 65%, ${withAlpha(k.kleur, 0.14)} 71%, transparent 76%)`,
                filter: "blur(12px)",
                opacity: aan ? 1 : 0,
                // Snel AAN, langzamer uit: zo tikt de flits en dooft hij na.
                transition: aan ? "opacity .05s linear" : "opacity .22s ease-out",
              }}
            />
            <img
              src={`/ui/flits/knop-${k.art}.webp?v=5`}
              alt=""
              style={{
                position: "absolute",
                left: pct(k.aL),
                top: pct(k.aT),
                width: pct(k.aB),
                height: "auto",
                display: "block",
                opacity: aan ? 1 : 0,
                transition: aan ? "opacity .05s linear" : "opacity .2s ease-out",
              }}
            />
          </div>
        );
      })}
      {KNOPPEN.map((k, i) => (
        <button
          key={`tik-${k.art}`}
          onClick={() => onTik(i)}
          disabled={uit}
          aria-label={t("arenaPad", { n: i + 1 })}
          style={{
            position: "absolute",
            left: pct(k.kL),
            top: pct(k.kT),
            width: pct(k.kB),
            height: pct(k.kH),
            zIndex: 3,
            background: "transparent",
            border: "none",
            padding: 0,
            borderRadius: "18%",
            cursor: uit ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        />
      ))}
    </div>
  );
}

/** Een stuk sectie-art met een RUIT waar inhoud in gaat.
 *
 *  De maten van elke ruit zijn uitgemeten in de art zelf (binnen de binnenste
 *  neonlijn) en staan als factor van de BREEDTE, dus ze schuiven mee zodra het
 *  vak smaller wordt.
 *
 *  Waarom factoren van de breedte en niet procenten: de hoogte van de doos komt
 *  uit een verhouding, en een procent op een kind rekent dan niet betrouwbaar
 *  terug naar die hoogte. Met calc op één bekende maat is er niets te raden. */
export type Maten = { verhouding: number; links: number; rechts: number; boven: number; onder: number };

export const LED: Maten = { verhouding: 4.6374, links: 0.0722, rechts: 0.062, boven: 0.0435, onder: 0.0435 };

// De kast vult zijn eigen doos NIET helemaal: zijn dekkende silhouet is 98,44%
// breed en hangt daarbinnen 0,47% links van het midden (de gloed loopt rechts
// iets verder uit). De LED-balk is strak op zijn balk gesneden en vult zijn doos
// dus wel. Om ze even breed te laten LIJKEN krijgt de balk die 98,44% als doos
// mee, plus een marge die zijn midden op dat van de kast legt: in een gecentreerde
// kolom schuift een marge rechts het element de helft daarvan naar links.
const KAST_VUL = 0.9844;
export const KAST_SCHEEF = 0.0047;
export const BALK = `calc(${VAK} * ${KAST_VUL})`;

export function Ruit({ art, maat, breedte = VAK, binnen, style, children }: { art: string; maat: Maten; breedte?: string; binnen?: React.CSSProperties; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: breedte, height: `calc(${breedte} / ${maat.verhouding})`, flexShrink: 0, ...style }}>
      <ArtSchaduw art={art} />
      <img
        src={art}
        alt=""
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
      <div
        style={{
          position: "absolute",
          left: `calc(${breedte} * ${maat.links})`,
          right: `calc(${breedte} * ${maat.rechts})`,
          top: `calc(${breedte} * ${maat.boven})`,
          bottom: `calc(${breedte} * ${maat.onder})`,
          ...binnen,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// De kleurtrap van de stand: hoe hoger je komt, hoe heter de cijfers. Van goud
// via oranje naar rood, dezelfde taal als de rode neonrand van de balk zelf.
// Per twee rondes een stap, en vanaf ronde elf blijft hij op het heetste rood
// staan: een trap zonder eind zou onzichtbaar traag verkleuren.
const LED_TRAP = ["#FFC23D", "#FFAD2B", "#FF921F", "#FF711C", "#FF4E26", "#FF3038"] as const;
export const ledKleur = (level: number) => LED_TRAP[Math.min(LED_TRAP.length - 1, Math.floor((level - 1) / 2))];

/** Cijfers achter het glas van de LED-balk.
 *
 *  Geen verloop en geen glansrandje zoals op goud: een lampje is uit zichzelf
 *  fel en overal even fel. Wat het licht doet is de vervaagde kopie erachter.
 *  De puntletter doet de rest, en die krijgt ruimte per punt via letterSpacing,
 *  anders lopen de matrixen van twee cijfers in elkaar. */
export function Led({ maat, sterk = 1, kleur = GOUD[3], children }: { maat: number; sterk?: number; kleur?: string; children: React.ReactNode }) {
  const ruimte = Math.ceil(maat * 0.6);
  return (
    <span style={{ position: "relative", display: "inline-block", fontFamily: font.dot, fontSize: maat, lineHeight: 1, letterSpacing: maat * 0.06, whiteSpace: "nowrap" }}>
      {/* De overgang zit op de KLEUR zelf: als de trap een stap neemt glijden
          cijfers en gloed samen naar de nieuwe tint in plaats van te knippen. */}
      <span
        aria-hidden
        style={{ position: "absolute", top: -ruimte, right: -ruimte, bottom: -ruimte, left: -ruimte, display: "grid", placeItems: "center", color: kleur, filter: `blur(${Math.round(maat * 0.26)}px)`, opacity: 0.85 * sterk, transition: "color .5s ease", pointerEvents: "none" }}
      >
        {children}
      </span>
      <span style={{ position: "relative", color: kleur, transition: "color .5s ease" }}>{children}</span>
    </span>
  );
}

function Flitsreeks({ seed, onKlaar }: { seed: string; onKlaar: (score: number, level: number, timeMs: number) => void }) {
  const { t } = useT();
  // De reeks ligt vast zodra de seed er is; levels zijn er een prefix van. Elke
  // ronde binnen EEN poging is dus dezelfde reeks, een element langer: zo bouw
  // je een pad op in je hoofd in plaats van elke ronde iets nieuws te leren.
  //
  // Tussen twee POGINGEN is hij wel anders, want in de seed zit het
  // pogingsnummer (zie waar dit gemaakt wordt). Stond hij op de kale dagseed,
  // dan kreeg je de tweede keer exact dezelfde reeksen en werd het een
  // geheugenspel in plaats van een kijkspel.
  const reeks = useRef<number[]>([]);
  if (reeks.current.length === 0) {
    const rng = maakRng(seed);
    let vorige = -1;
    for (let i = 0; i < 64; i++) {
      let p = Math.floor(rng() * 4);
      if (p === vorige) p = (p + 1 + Math.floor(rng() * 3)) % 4;
      reeks.current.push(p);
      vorige = p;
    }
  }

  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [fase, setFase] = useState<"kijk" | "doe" | "goed">("kijk");
  // TWEE lampjes, bewust gescheiden: `lit` is de reeks die voorspeelt, `tik` is
  // je eigen aanraking. In de eerste versie deelden ze één toestand, en dan
  // doofde de na-oplichting van je laatste tik de EERSTE flits van de nieuwe
  // ronde. Dat is precies wat er in de opname te zien was.
  const [lit, setLit] = useState<number | null>(null);
  const [tik, setTik] = useState<number | null>(null);
  const [stap, setStap] = useState(0);
  const stapRef = useRef(0);
  const start = useRef(0);
  const invoerStart = useRef(0);
  const timers = useRef<number[]>([]);

  const stopTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  // ELKE timer loopt hierlangs, ook de korte na-oplichting van een tik. Eén
  // losse timer die aan deze lijst ontsnapt overleeft de rondewissel en gaat
  // daar iets doven wat net was aangegaan.
  const na = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const speel = useCallback((lvl: number) => {
    stopTimers();
    setLit(null);
    setTik(null);
    setStap(0);
    stapRef.current = 0;
    setFase("kijk");
    // Leesbaar blijven is belangrijker dan snel worden: de moeilijkheid zit in
    // de LENGTE van de reeks, niet in onzichtbaar korte flitsen. Daarom een
    // bodem van 300ms aan en 180ms stilte.
    const AAN = Math.max(300, 420 - lvl * 8);
    const UIT = Math.max(180, 240 - lvl * 4);
    let i = 0;
    // Zelf-plannend: de volgende stap wordt pas gezet NADAT de vorige echt
    // gelopen heeft. De eerste versie plande de hele reeks vooruit met vaste
    // deadlines, en dan eet een haperende telefoon de eerste flitsen op omdat
    // hun aan-timer te laat komt terwijl de uit-timer op tijd is.
    const stapje = () => {
      if (i >= lvl) {
        na(120, () => {
          setFase("doe");
          invoerStart.current = performance.now();
        });
        return;
      }
      const pad = reeks.current[i];
      i += 1;
      setLit(pad);
      sound.uiTap();
      na(AAN, () => {
        setLit(null);
        na(UIT, stapje);
      });
    };
    // Aanloop voordat de eerste flits komt. Zonder die stilte valt hij samen
    // met de rondewissel en zie je hem niet.
    na(380, stapje);
  }, []);

  useEffect(() => {
    start.current = performance.now();
    speel(1);
    return stopTimers;
  }, [speel]);

  // Het decor achter de kast. Op de BODY en niet op een laag hierbinnen: het
  // moet ook onder de bovenbalk en in de veilige zones doorlopen, en die staan
  // buiten dit onderdeel. Weg zodra je stopt met spelen.
  useEffect(() => {
    document.body.classList.add("flitskast");
    return () => document.body.classList.remove("flitskast");
  }, []);

  const tikPad = (pad: number) => {
    if (fase !== "doe") return;
    if (pad !== reeks.current[stapRef.current]) {
      stopTimers();
      // Het level dat je HAALDE is er een minder dan waar je in zat.
      onKlaar(score, level - 1, Math.round(performance.now() - start.current));
      return;
    }
    sound.uiTap();
    setTik(pad);
    na(160, () => setTik(null));
    const volgendeStap = stapRef.current + 1;
    stapRef.current = volgendeStap;
    setStap(volgendeStap);
    if (volgendeStap < level) return;

    // Reeks compleet: punten, en dan een korte bevestiging voordat de volgende
    // reeks begint. Die pauze is niet cosmetisch: hij houdt jouw tik en de
    // eerste nieuwe flits uit elkaar.
    const invoerMs = performance.now() - invoerStart.current;
    const bonus = Math.max(0, Math.min(99, Math.round(99 * (1 - invoerMs / (level * 1000)))));
    setScore((s) => s + level * 100 + bonus);
    const volgend = level + 1;
    setLevel(volgend);
    setFase("goed");
    na(520, () => speel(volgend));
  };

  // Vrijwillig stoppen levert in wat je HEBT: elke voltooide reeks is al
  // bijgeschreven, dus het gehaalde level is er een minder dan waar je in zit.
  const stop = () => {
    stopTimers();
    onKlaar(score, level - 1, Math.round(performance.now() - start.current));
  };

  const aanNu = lit ?? tik;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* De stand achter glas. Ronde links, punten rechts, allebei in de
          puntletter: dat is wat een scorebord doet, en het haalt de cijfers weg
          uit de losse regels die boven de pads zweefden. */}
      <Ruit
        art="/ui/flits/ledbalk.webp?v=4"
        maat={LED}
        breedte={BALK}
        style={{ marginRight: `calc(${VAK} * ${KAST_SCHEEF * 2})` }}
        binnen={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 22, gap: 12, overflow: "hidden" }}
      >
        <Led maat={13} sterk={0.7} kleur={ledKleur(level)}>{t("arenaRonde", { n: level }).toUpperCase()}</Led>
        {/* De sleutel op de score: elke verhoging hermonteert het cijfer en
            start de klop opnieuw. De kleur zit NIET in de sleutel, dus de
            tintwissel blijft een glijdende overgang. */}
        <span key={score} className={score > 0 ? "led-klop" : undefined} style={{ display: "inline-flex" }}>
          {/* De cijfers staan in VASTE punten, dus ze krimpen niet mee als de
              balk smaller wordt. Wat wel meebeweegt is het AANTAL cijfers: vanaf
              vijf stappen ze een maat terug en vanaf zes nog een, zodat een
              topscore nooit tegen "ronde" aan loopt. Zonder die trap zou de
              ruimte ergens boven de tienduizend opraken. */}
          <Led maat={score >= 100000 ? 24 : score >= 10000 ? 27 : 30} kleur={ledKleur(level)}>{String(score)}</Led>
        </span>
      </Ruit>

      <Bord aanNu={aanNu} uit={fase !== "doe"} onTik={tikPad} />

      {/* Wat er van je verwacht wordt, plus hoe ver je in de reeks bent. Vanaf
          een reeks van zes weet je zonder die stipjes niet meer of je bij de
          vierde of de vijfde zit, en dan verlies je op tellen in plaats van op
          onthouden. */}
      <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, minHeight: 18, color: fase === "goed" ? colors.green : fase === "kijk" ? colors.gold : colors.sub }}>
        {fase === "goed" ? t("arenaGoed") : fase === "kijk" ? t("arenaKijk") : t("arenaDoe")}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 5, minHeight: 8, maxWidth: VAK }}>
        {fase === "doe" && Array.from({ length: level }, (_, i) => (
          <span
            key={i}
            style={{
              width: i < stap ? 8 : 6,
              height: i < stap ? 8 : 6,
              borderRadius: "50%",
              background: i < stap ? colors.gold : "rgba(255,255,255,.22)",
              transition: "width .15s ease, height .15s ease, background .15s ease",
            }}
          />
        ))}
      </div>

      {/* Stoppen: je poging inleveren met wat je tot nu toe hebt. Zonder deze
          knop was de pijl in de bovenbalk de enige uitweg, en die levert NIET
          in: wie zo wegliep verloor zijn hele score zonder het te weten. Zelfde
          vorm als "verlaat club": zo breed als zijn eigen tekst, want een knop
          die iets afbreekt hoort niet even groot te zijn als het spel. */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <NeonKader radius={999} dik={0.5} vulling="zwart" animeer lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
          <button
            onClick={stop}
            className="pressable"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
          >
            <LogOut size={14} /> {t("arenaStop")}
          </button>
        </NeonKader>
      </div>
    </div>
  );
}

export function ArenaDeel({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const [info, setInfo] = useState<Info | null>(null);
  const [fase, setFase] = useState<"intro" | "spel" | "klaar">("intro");
  const [poging, setPoging] = useState<{ attempt_id: number; seed: string } | null>(null);
  const [uitslag, setUitslag] = useState<{ score: number; level: number; rank: number } | null>(null);
  const [over, setOver] = useState(0);

  const haal = useCallback(() => {
    fetch("/api/arena/info", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setInfo(d); setOver(d.seconds_left); } })
      .catch(() => {});
  }, []);
  useEffect(haal, [haal]);
  // De hal om de kast heen, passend bij het spel van de dag. Alleen op het
  // voorportaal en de uitslag: tijdens het spel neemt het spel zijn eigen
  // decor over, en twee lagen tegelijk zou twee panelen door elkaar tekenen.
  useEffect(() => {
    if (fase === "spel") return;
    // EEN hal voor het voorportaal, welk spel er die dag ook draait. De hal
    // hoorde bij het spel, en dan stond je elke dag in een ander gebouw terwijl
    // je op dezelfde plek was: de arena is een plek, niet een spel. Tijdens het
    // spel neemt het spel wel zijn eigen decor over.
    document.body.classList.add("soephal");
    return () => document.body.classList.remove("soephal");
  }, [fase, info?.game]);
  useEffect(() => {
    const id = window.setInterval(() => setOver((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const start = () => {
    sound.uiTap();
    fetch("/api/arena/start", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: "{}" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.attempt_id) { setPoging(d); setUitslag(null); setFase("spel"); }
      })
      .catch(() => {});
  };

  const klaar = (score: number, level: number, timeMs: number) => {
    if (!poging) return;
    fetch("/api/arena/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ attempt_id: poging.attempt_id, score, level, time_ms: timeMs }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setUitslag({ score, level, rank: d?.rank ?? 0 });
        if (d) setInfo((oud) => (oud ? { ...oud, board: d.board, rank: d.rank, beste: d.beste, pogingen: d.pogingen, players: d.players } : oud));
        setFase("klaar");
        sound.win();
      })
      .catch(() => { setUitslag({ score, level, rank: 0 }); setFase("klaar"); });
  };

  const spelNaam = info ? t(`arenaSpel_${info.game}`) : "";

  const header = (
    // Met een z-index, want Woordketen hangt zijn ketting tot voorbij de bovenrand
    // van het scherm en die zou anders dwars door de titel heen lopen.
    <div style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button onClick={() => (fase === "intro" ? onBack() : setFase("intro"))} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
        <ArrowLeft size={20} />
      </button>
      <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("arenaTitel")}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 13, color: colors.gold, fontVariantNumeric: "tabular-nums" }}>{klok(over)}</span>
    </div>
  );

  // Het bord met de dunne glasrijen: zelfde taal als de dagronde-uitslag.
  const bord = info && (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ paddingInline: 6, fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>
        {t("arenaSpelers", { n: info.players })}
      </span>
      {info.board.length === 0 ? (
        <p style={{ margin: 0, paddingInline: 6, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("dailyEmptyBoard")}</p>
      ) : (
        <Lijst n={info.board.length} gap={5} rij={38} toon={5.5}>
          {info.board.map((row, i) => {
            const ik = !!account && row.id === account.id;
            return (
              <GlasRij key={row.id} dun wapen={<PlekWapen plek={i + 1} maat={24} />}>
                <Avatar name={row.name} color={row.color} size={26} userId={row.id} hasAvatar={!!row.has_avatar} avatarVer={row.avatar_ver} divisie={row.divisie} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: ik ? GOUD[3] : colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.name}{ik && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
                </span>
                <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, color: i === 0 ? colors.gold : colors.ink, textAlign: "right" }}>{row.score}</span>
              </GlasRij>
            );
          })}
        </Lijst>
      )}
      {!!info.rank && info.rank > 0 && !info.board.some((r) => r.id === account?.id) && (
        <span style={{ paddingInline: 6, fontFamily: font.ui, fontSize: 12, color: GOUD[3] }}>{t("arenaJouwPlek", { n: info.rank })}</span>
      )}
    </div>
  );

  if (fase === "spel" && poging) {
    return (
      <Screen top={header}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
          {info?.game === "lettersoep" ? (
            // De seed van de dag GEMENGD met het pogingsnummer: bij Lettersoep
            // hoort elke poging een vers bord te geven (twee keer spelen met
            // dezelfde letters is een geheugenspel, geen zoekspel). De server
            // kent beide helften, dus de reeks blijft controleerbaar.
            <Lettersoep seed={`${poging.seed}:${poging.attempt_id}`} onKlaar={klaar} />
          ) : info?.game === "rekenladder" ? (
            // Ook per poging vers. Twee keer dezelfde sommen in dezelfde
            // volgorde is geen rekentest meer maar een geheugentest.
            <Rekenladder seed={`${poging.seed}:${poging.attempt_id}`} onKlaar={klaar} />
          ) : info?.game === "kleurenklem" ? (
            // Kleurenklem ook per poging vers, en om dezelfde reden: de reeks
            // opgaven is kort en je onthoudt hem. Twee keer dezelfde kleuren in
            // dezelfde volgorde is niet meer de Stroop-test maar een dictee.
            <Kleurenklem seed={`${poging.seed}:${poging.attempt_id}`} onKlaar={klaar} />
          ) : info?.game === "woordketen" ? (
            // Ook per poging vers. Twee keer dezelfde ketting is geen
            // taalspel meer maar een geheugenspel.
            <Woordketen seed={`${poging.seed}:${poging.attempt_id}`} onKlaar={klaar} />
          ) : (
            // Ook per poging vers, net als de andere vier. Hij stond op de kale
            // dagseed, dus elke poging van elke speler kreeg de hele dag exact
            // dezelfde reeksen: de tweede keer wist je ze al en werd het een
            // geheugenspel in plaats van een kijkspel. De server kent beide
            // helften van deze sleutel, dus de reeks blijft controleerbaar.
            <Flitsreeks seed={`${poging.seed}:${poging.attempt_id}`} onKlaar={klaar} />
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen top={header}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Paneel>
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, paddingInline: 14 }}>
            <img src="/ui/arena.webp?v=1" alt="" aria-hidden style={{ height: 74, width: "auto", display: "block" }} />
            <span style={{ fontFamily: font.wide, fontSize: 14, letterSpacing: 1.6, textTransform: "uppercase", color: colors.ink }}>
              {fase === "klaar" && uitslag ? t("arenaKlaarTitel") : spelNaam || t("arenaTitel")}
            </span>
            {fase === "klaar" && uitslag ? (
              <NeonText accent={colors.gold} blur={16} glow={0.75} style={{ fontFamily: font.display, fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
                {String(uitslag.score)}
              </NeonText>
            ) : (
              <span style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12, color: colors.sub, lineHeight: 1.4 }}>
                {info?.af ? t(`arenaUitleg_${info.game}`) : t("arenaBinnenkort")}
              </span>
            )}
          </div>
        </Paneel>

        {/* Jouw dag in een regel: beste, pogingen, plek. */}
        {!!account && !!info && (info.pogingen > 0 || fase === "klaar") && (
          <span style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>
            {t("arenaMijnRegel", { beste: info.beste, n: info.pogingen })}
            {info.rank > 0 && <span style={{ color: GOUD[3] }}> · {t("arenaJouwPlek", { n: info.rank })}</span>}
          </span>
        )}

        {!account ? (
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("arenaGast")}</p>
        ) : info?.af ? (
          // Onbeperkt en gratis: elke knoptekst die naar kosten riekt hoort
          // hier niet. De 24 uur zijn de grens, de beste poging telt.
          // In een flex-kolom staat een plaat met een vaste breedte links: de
          // uitlijning is `stretch` en die valt voor iets van 150 breed terug op
          // het begin van de regel. Vandaar een eigen doos die hem centreert.
          // Het opschrift draagt dezelfde letter als de gouden knoppen elders:
          // 16px met 0,3 spatiering, want de plaat rekent zijn maat normaal uit
          // zijn breedte en werd hier 23px.
          <div style={{ display: "flex", justifyContent: "center" }}>
            <KnopPlaat
              kleur="paars"
              breed={150}
              onClick={start}
              label={<span style={{ fontSize: 16, letterSpacing: 0.3 }}>{(fase === "klaar" ? t("arenaOpnieuw") : t("arenaStart")).toUpperCase()}</span>}
            />
          </div>
        ) : null}

        {bord}
      </div>
    </Screen>
  );
}
