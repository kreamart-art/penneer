// Het wachtscherm van het live duel: de radar die naar een tegenstander zoekt.
//
// WAAROM EEN HEEL SCHERM EN GEEN KAARTJE. Zoeken duurt seconden tot minuten en
// je kunt er niets aan doen. Een spinnertje in een kaart maakt van dat wachten
// dode tijd; een scherm dat iets DOET maakt er een moment van. Daarom staat
// hier de radar, en daarom staat er een tip onderin: wie toch wacht, leert in
// die tijd iets over het spel.
//
// DE RADAR IS GETEKEND EN GEEN ART. Ringen, een draaiende bundel, uitdijende
// pings en een paar stipjes: allemaal CSS en SVG. Dat is met opzet, want de
// maten moeten meebewegen met het scherm (een kleine telefoon heeft minder
// hoogte dan een grote) en art zou dan of rekken of afgesneden worden. De
// enige art is de achtergrond en de gouden ring uit het profiel.
//
// DE RING IS DIE VAN HET PROFIEL. Op de mockup stond een paarse achthoek, maar
// de app heeft al een ring met schild en die staat op het profiel, in de lobby
// en op het scorebord. Nog een tweede omlijsting erbij zou betekenen dat
// dezelfde speler er hier anders uitziet dan overal elders. Het schild draagt
// een vraagteken in plaats van een level: je weet nog niet tegen wie je speelt.
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { GoudKader } from "../components/GoudKader";
import { RingPortret, type SchildKleur } from "../components/ProfileHero";
import { useT } from "../i18n/i18n";
import { font, withAlpha } from "../theme/tokens";

/** De kleur van de radar. Violet als het accent van het duel, met een lichtere
 *  tint voor de koplijn van de bundel: die hoort het felst te zijn. */
const RADAR = "139,123,255";
const RADAR_LICHT = "205,190,255";
/** De donkere kant van de reeks. Een ring die aan de schaduwkant naar NEUTRAAL
 *  trekt wordt daar grijs; door de verzadiging vast te houden en alleen de
 *  helderheid te laten zakken blijft hij van hetzelfde materiaal gemaakt. */
const RADAR_DIEP = "74,54,168";

/** De stipjes op de radar: hoek in graden, afstand in delen van de straal.
 *  Vaste plekken en geen toeval, want twee keer laden hoort hetzelfde beeld te
 *  geven, en een stip die per keer ergens anders staat leest als ruis. */
const STIPPEN: [number, number][] = [
  [24, 0.92], [96, 0.62], [158, 0.88], [212, 0.44], [278, 0.78], [332, 0.55],
];

export function DuelZoeken({
  aantal, kleur, onStop,
}: {
  /** Hoeveel spelers er nu zoeken, jij meegerekend. */
  aantal: number;
  /** Het schild van de speler ZELF. De tegenstander is nog onbekend, dus zijn
   *  divisie ook; jouw schild houdt het scherm bij jouw account horen. */
  kleur: SchildKleur;
  onStop: () => void;
}) {
  const { t } = useT();
  // De tip wisselt, zodat wachten niet vier keer hetzelfde scherm is.
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTip((n) => (n + 1) % 4), 6000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
      {/* De achtergrond als eigen laag onder alles. `fixed` zodat hij niet
          meeschuift als de inhoud op een kleine telefoon toch moet scrollen. */}
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: "url(/ui/duel/zoeken.webp?v=1)",
          backgroundSize: "cover", backgroundPosition: "center",
          backgroundColor: "#0B0518",
        }}
      />

      {/* Drie blokken over de hoogte verdeeld: kop bovenaan, radar in het
          midden, de tip en de knop onderaan. Zonder die verdeling kruipt alles
          naar boven en blijft er onderin een halve pagina leeg staan. */}
      <div style={{
        position: "relative", zIndex: 1, flex: 1,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "space-between", gap: 10, padding: "4px 18px 14px",
      }}>
        <Kop t={t} />

        {/* De radar pakt de ruimte die overblijft en blijft daarin gecentreerd,
            zodat hij op een grote telefoon groter staat en op een kleine
            netjes krimpt in plaats van de knop weg te duwen. */}
        <div style={{ flex: 1, display: "grid", placeItems: "center", width: "100%", minHeight: 0 }}>
          <Radar kleur={kleur} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
        <span style={{ fontFamily: font.ui, fontSize: 12.5, color: withAlpha("#FFFFFF", 0.62), textAlign: "center" }}>
          {t("duelLiveQueue", { n: Math.max(1, aantal) })}
        </span>

        {/* De tip onderaan, met ruimte eromheen. Op de mockup hing er een
            icoontje half over de bovenrand; dat is hier de kop IN de lijn, want
            een los zwevend icoon boven een vak leest als een fout zodra de tekst
            een regel langer wordt. */}
        <GoudKader hoek={11} kleur="violet" gloed padding={0} style={{ width: "100%", maxWidth: 340 }}>
          <div style={{ padding: "11px 14px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{
              fontFamily: font.ui, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.6,
              textTransform: "uppercase", color: `rgb(${RADAR_LICHT})`, textAlign: "center",
            }}>
              {t("zoekTip")}
            </span>
            {/* Vaste hoogte voor twee regels: zonder dat springt de knop
                eronder heen en weer zodra er een kortere tip langskomt. */}
            <span style={{
              fontFamily: font.ui, fontSize: 12.5, lineHeight: 1.45, color: withAlpha("#FFFFFF", 0.82),
              textAlign: "center", minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {t(`zoekTip${tip + 1}`)}
            </span>
          </div>
        </GoudKader>

        <div style={{ width: "min(78%, 200px)" }}>
          <Button variant="ghost" full onClick={onStop}>{t("duelLiveStop")}</Button>
        </div>
        </div>
      </div>
    </div>
  );
}

/** De kop: twee regels plus de sierlijn eronder.
 *
 *  Bebas met een lichte schuinstand in plaats van de wordmark-letter: die is
 *  van PEN NEER alleen, en een tweede plek waar hij opduikt maakt hem minder
 *  bijzonder. De schuinstand komt van de mockup en geeft dezelfde vaart. */
function Kop({ t }: { t: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, paddingTop: 2 }}>
      <span style={{
        fontFamily: font.wide, fontSize: 20, letterSpacing: 3.4, lineHeight: 1,
        color: `rgb(${RADAR})`, transform: "skewX(-8deg)",
        textShadow: `0 0 18px rgba(${RADAR},.55)`,
      }}>
        {t("zoekTitel1")}
      </span>
      <span style={{
        fontFamily: font.wide, fontSize: 40, letterSpacing: 1.6, lineHeight: 1.05,
        color: "#FFFFFF", transform: "skewX(-8deg)",
        textShadow: `0 0 26px rgba(${RADAR},.75), 0 2px 0 rgba(0,0,0,.35)`,
      }}>
        {t("zoekTitel2")}
      </span>
      {/* De lijn met het pijltje eronder, als een SVG zodat de punt precies in
          het midden van de lijn valt en niet er net naast. */}
      <svg viewBox="0 0 300 14" width="min(84%, 300px)" height={14} aria-hidden style={{ marginTop: 6, overflow: "visible" }}>
        <defs>
          <linearGradient id="zoeklijn" x1="0" x2="1">
            <stop offset="0" stopColor={`rgba(${RADAR},0)`} />
            <stop offset="0.5" stopColor={`rgba(${RADAR},.85)`} />
            <stop offset="1" stopColor={`rgba(${RADAR},0)`} />
          </linearGradient>
        </defs>
        <path d="M0 3 H128 L150 12 L172 3 H300" fill="none" stroke="url(#zoeklijn)" strokeWidth="1.6" />
      </svg>
      <span style={{
        fontFamily: font.ui, fontSize: 13.5, color: withAlpha("#FFFFFF", 0.78),
        textAlign: "center", marginTop: 6, lineHeight: 1.4,
      }}>
        {t("zoekSub")}
      </span>
    </div>
  );
}

/** De radar. Ringen, een draaiende bundel, uitdijende pings, stipjes, en in het
 *  hart de gouden ring met het vraagteken.
 *
 *  De maat komt uit de KLEINSTE van drie grenzen: de breedte van het scherm, de
 *  hoogte ervan en een plafond. Zonder die hoogte-grens duwt de radar op een
 *  korte telefoon de tip en de knop van het scherm af, en juist die knop moet
 *  altijd bereikbaar blijven. */
function Radar({ kleur }: { kleur: SchildKleur }) {
  // De ring in het hart moet MEEGROEIEN met de radar, en de gouden ring rekent
  // in echte pixels (hij zet zijn schild op een gemeten plek). Daarom meten we
  // de doos op in plaats van percentages te gebruiken: dan klopt de verhouding
  // op elk scherm en hoeft er niets met de hand bijgesteld te worden.
  const doos = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(280);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setPx(el.clientWidth || 280);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={doos} style={{
      position: "relative", // 40vh en niet meer: op een korte telefoon (667 hoog) duwt 48vh de knop
      // onder de vouw, en juist die knop moet altijd te zien zijn.
      width: "min(86vw, 40vh, 360px)", aspectRatio: "1", flexShrink: 0,
      display: "grid", placeItems: "center",
    }}>
      {/* HET VLAK WAAR DE RADAR OP LIGT. Zonder dit hangen de ringen in het
          niets en blijft het een tekening; met een eigen schijf eronder wordt
          het een ding dat licht geeft. Twee lagen: een brede zachte gloed die
          ver buiten de ringen uitloopt, en een dieper schijfje in het hart. */}
      <div aria-hidden style={{
        position: "absolute", inset: "-6%", borderRadius: "50%",
        background: `radial-gradient(circle,
          rgba(${RADAR},.30) 0%,
          rgba(${RADAR},.17) 34%,
          rgba(${RADAR},.07) 58%,
          rgba(${RADAR},.02) 72%,
          rgba(${RADAR},0) 80%)`,
      }} />

      {/* de ringen, de spaken en het kruis */}
      {/* `screen` laat de lagen OPTELLEN zoals echt licht: waar de bundel over
          een ring gaat wordt die ring lichter in plaats van dat de bundel hem
          afdekt. Op een donkere ondergrond is dat precies het verschil tussen
          een tekening van een radar en een radar die aan staat. */}
      <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "screen" }} aria-hidden>
        <defs>
          {/* HET LICHT KOMT LINKSBOVEN VANDAAN, net als overal in deze app. Een
              ring met overal dezelfde helderheid leest als een getekende cirkel;
              een ring die aan de ene kant oplicht en aan de andere kant wegzakt
              leest als een ring van licht. */}
          <linearGradient id="radar-ring" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="0.22" stopColor={`rgb(${RADAR_LICHT})`} stopOpacity="1" />
            <stop offset="0.62" stopColor={`rgb(${RADAR})`} stopOpacity="0.85" />
            <stop offset="1" stopColor={`rgb(${RADAR_DIEP})`} stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="radar-spaak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`rgb(${RADAR})`} stopOpacity="0.42" />
            <stop offset="1" stopColor={`rgb(${RADAR})`} stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* de spaken: twaalf, vanaf de binnenste ring naar de buitenste. Ze
            geven het vlak zijn diepte; zonder spaken zijn het losse cirkels. */}
        {Array.from({ length: 12 }, (_, i) => i * 30).map((hoek) => (
          <line key={hoek} x1="50" y1="39" x2="50" y2="1.5"
                stroke="url(#radar-spaak)" strokeWidth="0.35"
                transform={`rotate(${hoek} 50 50)`} />
        ))}

        {/* Elke ring is DRIE strepen over elkaar: een brede met bijna geen
            dekking (dat is de bloom), een middelste, en een dunne felle bovenop.
            Zo gloeit hij zonder ook maar een filter, en dat is precies wat er op
            iOS nodig is: `filter: drop-shadow` rastert daar apart en zet een
            rechthoek over je element heen. */}
        {[49, 39.5, 30, 20.5, 11].map((r, i) => {
          const sterkte = 1 - i * 0.16;
          return (
            <g key={r}>
              <circle cx="50" cy="50" r={r} fill="none" stroke={`rgb(${RADAR})`}
                      strokeOpacity={0.07 * sterkte} strokeWidth={1.9} />
              <circle cx="50" cy="50" r={r} fill="none" stroke={`rgb(${RADAR})`}
                      strokeOpacity={0.16 * sterkte} strokeWidth={0.85} />
              <circle cx="50" cy="50" r={r} fill="none" stroke="url(#radar-ring)"
                      strokeOpacity={sterkte} strokeWidth={i === 0 ? 0.46 : 0.34} />
            </g>
          );
        })}

        {/* het kruis, zwakker dan de spaken zodat het de ringen niet overstemt */}
        <line x1="50" y1="1" x2="50" y2="99" stroke={`rgba(${RADAR},.14)`} strokeWidth="0.3" />
        <line x1="1" y1="50" x2="99" y2="50" stroke={`rgba(${RADAR},.14)`} strokeWidth="0.3" />
      </svg>

      {/* de bundel die rondgaat: een taartpunt die met de klok mee draait en
          achter zich uitdooft, zoals op een echte radar */}
      <div
        aria-hidden
        className="radar-bundel"
        style={{
          position: "absolute", inset: 0, borderRadius: "50%", mixBlendMode: "screen",
          // De KOPLIJN is de felle kant: op nul graden staat de bundel het
          // helderst en daarachter dooft hij uit. Andersom (dof vooraan, fel
          // achteraan) draait hij optisch de verkeerde kant op. De eerste twee
          // graden zijn bijna vol: dat is de scherpe rand die het licht maakt,
          // de rest is de staart.
          background: `conic-gradient(from 0deg,
            rgba(${RADAR_LICHT},.95) 0deg,
            rgba(${RADAR_LICHT},.62) 2.5deg,
            rgba(${RADAR},.40) 9deg,
            rgba(${RADAR},.20) 28deg,
            rgba(${RADAR},.07) 60deg,
            rgba(${RADAR},0) 92deg,
            rgba(${RADAR},0) 360deg)`,
          WebkitMaskImage: "radial-gradient(circle, #000 0 97%, transparent 100%)",
          maskImage: "radial-gradient(circle, #000 0 97%, transparent 100%)",
        }}
      />

      {/* de pings: ringen die vanuit het hart uitdijen en vervagen */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="radar-ping"
          style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `1px solid rgba(${RADAR_LICHT},.85)`,
            // De gloed hoort BIJ de ring en niet eromheen getekend: een
            // box-shadow naar buiten en naar binnen geeft precies de zachte
            // rand die een filter ook zou geven, maar dan zonder de iOS-val.
            boxShadow: `0 0 14px rgba(${RADAR},.55), inset 0 0 14px rgba(${RADAR},.35)`,
            animationDelay: `${i * 1.2}s`,
          }}
        />
      ))}

      {/* de stipjes op de ringen */}
      {STIPPEN.map(([hoek, ver], i) => (
        <span
          key={i}
          aria-hidden
          className="radar-stip"
          style={{
            position: "absolute", left: "50%", top: "50%", width: 6, height: 6, borderRadius: 999,
            background: "#FFFFFF",
            boxShadow: `0 0 6px rgba(${RADAR_LICHT},1), 0 0 16px rgba(${RADAR},.85)`,
            // De afstand in PIXELS en niet in procenten. Een percentage in
            // `translate` rekent met de maat van het STIPJE (zes pixels), niet
            // met die van de radar, dus stonden ze allemaal op een haar van het
            // midden en verdwenen ze achter de gouden ring. De 0,49 is de
            // buitenste ring uit het raster hierboven.
            transform: `translate(-50%, -50%) rotate(${hoek}deg) translateY(${-Math.round(px * 0.49 * ver)}px)`,
            animationDelay: `${i * 0.55}s`,
          }}
        />
      ))}

      {/* het hart: de ring uit het profiel, met een vraagteken waar anders de
          foto zit en op het schild in plaats van een level */}
      <div style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center" }}>
        <RingPortret maat={Math.round(px * 0.44)} level="?" kleur={kleur}>
          <span style={{
            fontFamily: font.display, fontWeight: 800, fontSize: Math.round(px * 0.17), lineHeight: 1,
            color: `rgb(${RADAR_LICHT})`, textShadow: `0 0 22px rgba(${RADAR},.9)`,
          }}>
            ?
          </span>
        </RingPortret>
      </div>
    </div>
  );
}
