// "Ronde voltooid" — het scherm dat na een oefenronde over de uitslag heen valt.
//
// Waarom een popup en niet een sectie op de uitslag: de uitslag gaat over WAT JE
// MISTE, en dat is een lijst om na te lopen. Wat je eraan overhield is een
// moment, en een moment hoort de aandacht een tel te krijgen voordat je verder
// scrolt. Vandaar dat hij over de pagina valt en vandaar de confetti.
//
// De opbouw volgt de mockup, van boven naar beneden:
//   1. de kop, met de krans op de balk als hart van de pagina
//   2. de kaarten die vrijkwamen
//   3. de voortgang van deze ronde: categorie en letter
//   4. je prestaties naast de volgende stap
//   5. de twee uitgangen
//
// TWEE STUKKEN ART, allebei opgemeten en niet geschat (zie KRANS en BALK).
// Verder is alles code: dezelfde GoudKader met binnenlijn als de rest van de
// laatste schermen, zodat deze pagina bij Oefenen hoort en niet erop lijkt.
import { useEffect, useMemo, useState } from "react";
import { Apple, Brain, Briefcase, Building2, ChevronRight, Check, Flame, Globe, Layers, PawPrint, RotateCw, Target, X as Kruis } from "lucide-react";
import { Button } from "./Button";
import { CloseIcon } from "./CloseIcon";
import { GoudKader } from "./GoudKader";
import { Lint } from "./Lint";
import { SierKop } from "./ProfileHero";
import { NeonText } from "./NeonText";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

/** De medaille. De nieuwe plaat draagt de pen ER AL IN, dus de lege krans met
 *  het muntlogo als tweede laag erin kan weg, en daarmee ook het gereken aan het
 *  hart van die binnencirkel.
 *
 *  ?v=2 omdat de plaat is vervangen: /ui/ staat cache-first in de service
 *  worker, dus zonder nieuwe URL houdt een geinstalleerde app de oude. */
const KRANS_ART = "/ui/krans.webp?v=2";
/** Verhouding van die plaat (1294 x 996 na het uitsnijden). Nodig om in de balk
 *  zijn BREEDTE vrij te houden: reserveer je alleen zijn hoogte, dan legt hij
 *  zijn krans over "+75 Munten" heen. */
const KRANS_VERH = 1294 / 996;

/** Hoe hoog de medaille is ten opzichte van de balk. Boven de 1 steekt hij er
 *  boven en onder uit en wordt de balk zijn voetstuk; dat is wat de mockup doet
 *  en het is ook wat het beeld draagt. */
const KRANS_OP_BALK = 1.5;

/** De hoogte van de balk zelf, in punten. De balk is nu code en geen plaat meer,
 *  dus hij heeft geen verhouding die zijn hoogte bepaalt: die komt uit wat erin
 *  staat (een teken van 22 met een getal van 20 erboven een label van 10). */
const BALK_HOOG = 62;

const SNIPPERS = [colors.gold, colors.goldHi, colors.violet, colors.green, "#FF7AC2", colors.orange];

/** Kaart zoals /api/train/check hem teruggeeft. */
export interface NieuweKaart {
  id: number;
  category: string;
  letter: string;
  word: string;
  image_path?: string | null;
  /** Gezien maar niet verdiend. Sporen staan apart en tellen niet als winst. */
  spoor?: boolean;
}

export interface Voortgang {
  soort: "categorie" | "letter";
  sleutel: string;
  label: string;
  have: number;
  total: number;
  plus: number;
}

export interface Beloning {
  xp: number;
  munten: number;
  /** De dagpot voor oefenen is op; er was meer verdiend dan er uitbetaald is. */
  vol: boolean;
  voortgang: Voortgang[];
  streak_days: number;
}

/** Snippers die over de popup vallen. Eén bui, en daarna ruimt hij zichzelf op:
 *  een animatie die blijft lopen achter een pagina die je aan het lezen bent
 *  is geen feest meer maar geflikker. */
function Snippers() {
  const stukjes = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: Math.random() * 100,
        w: 5 + Math.random() * 5,
        h: 9 + Math.random() * 6,
        delay: Math.random() * 0.9,
        dur: 2.4 + Math.random() * 1.5,
        kleur: SNIPPERS[i % SNIPPERS.length],
        kantel: Math.random() * 360,
      })),
    [],
  );
  const [weg, setWeg] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setWeg(true), 4600);
    return () => window.clearTimeout(id);
  }, []);
  if (weg) return null;
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 2, overflow: "hidden", pointerEvents: "none" }}>
      {stukjes.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`, width: p.w, height: p.h, background: p.kleur,
            borderRadius: 2, rotate: `${p.kantel}deg`,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Een getal dat vanaf nul omhoog telt. Een beloning die er meteen staat is een
 *  mededeling; een die oploopt is er een die je krijgt. */
function Teller({ naar, duur = 900 }: { naar: number; duur?: number }) {
  const [nu, setNu] = useState(0);
  useEffect(() => {
    if (naar <= 0) { setNu(0); return; }
    const start = performance.now();
    let id = 0;
    const stap = (t: number) => {
      const f = Math.min(1, (t - start) / duur);
      // Snel beginnen en zacht uitlopen, zodat het eindgetal blijft hangen.
      setNu(Math.round(naar * (1 - Math.pow(1 - f, 3))));
      if (f < 1) id = requestAnimationFrame(stap);
    };
    id = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(id);
  }, [naar, duur]);
  return <>{nu}</>;
}

/** De XP- of muntenkant van de balk: het teken, het getal, en waar het voor is. */
function Winst({ teken, waarde, label, kleur, rechts }: {
  teken: React.ReactNode; waarde: number; label: string; kleur: string; rechts?: boolean;
}) {
  return (
    <span
      style={{
        display: "flex", alignItems: "center", gap: 7, minWidth: 0,
        justifyContent: rechts ? "flex-end" : "flex-start",
        flexDirection: rechts ? "row-reverse" : "row",
      }}
    >
      <span style={{ flexShrink: 0, display: "flex" }}>{teken}</span>
      <span style={{ minWidth: 0, textAlign: rechts ? "right" : "left" }}>
        <span style={{ display: "block", fontFamily: font.display, fontWeight: 800, fontSize: "clamp(14px, 4.7vw, 19px)", lineHeight: 1, color: kleur, whiteSpace: "nowrap" }}>
          +<Teller naar={waarde} />
        </span>
        <span style={{ display: "block", marginTop: 2, fontFamily: font.ui, fontSize: "clamp(8px, 2.4vw, 10px)", lineHeight: 1, color: colors.sub, whiteSpace: "nowrap" }}>
          {label}
        </span>
      </span>
    </span>
  );
}

/** Het zeshoekige XP-teken. Geen art nodig: het is een vorm en een letterpaar. */
function XpTeken({ maat = 30 }: { maat?: number }) {
  return (
    <span
      style={{
        width: maat, height: maat * 1.09, display: "grid", placeItems: "center",
        clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
        background: `linear-gradient(180deg, ${colors.violet}, ${colors.violetDeep})`,
        boxShadow: `0 0 10px ${withAlpha(colors.violet, 0.5)}`,
        fontFamily: font.display, fontWeight: 800, fontSize: maat * 0.36, color: "#FFFFFF",
        letterSpacing: 0.2,
      }}
    >
      XP
    </span>
  );
}

/** De kop: de medaille op de balk, met links de XP en rechts de munten.
 *
 *  De balk is CODE en geen plaat: een brede gouden achthoeklijn met een donkere
 *  vulling op dertig procent, zodat de confetti en de gloed erachter meespelen
 *  in plaats van te worden afgedekt. Dezelfde achthoek als alle secties in de
 *  app, dus hij hoort er vanzelf bij.
 *
 *  De medaille ligt als losse laag OVER de balk en telt niet mee voor de hoogte;
 *  de ruimte die hij erboven en eronder nodig heeft komt als padding op het
 *  omhulsel. */
function Kroon({ xp, munten }: { xp: number; munten: number }) {
  const { t } = useT();
  const medaille = BALK_HOOG * KRANS_OP_BALK;
  const oversteek = (medaille - BALK_HOOG) / 2;
  return (
    <div style={{ position: "relative", width: "100%", paddingTop: oversteek, paddingBottom: oversteek }}>
      <GoudKader hoek={16} rond={2.5} dik={0.9} vulKleur="rgba(6,2,18,.3)" binnenlijn binnenSterkte={0.16} padding={0}>
        <div
          style={{
            height: BALK_HOOG,
            display: "grid", gridTemplateColumns: `1fr ${Math.round(medaille * KRANS_VERH + 6)}px 1fr`,
            alignItems: "center", gap: 2, padding: "0 14px",
          }}
        >
          <Winst teken={<XpTeken maat={22} />} waarde={xp} label={t("rvXp")} kleur={colors.ink} />
          <span />
          <Winst
            teken={<img src="/coin.webp" alt="" aria-hidden width={23} height={23} style={{ display: "block" }} />}
            waarde={munten} label={t("rvMunten")} kleur={colors.gold} rechts
          />
        </div>
      </GoudKader>

      {/* De medaille, op het hart van de balk. Hij draagt de pen zelf al, dus er
          ligt niets meer overheen. */}
      <img
        src={KRANS_ART} alt="" aria-hidden draggable={false}
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          height: medaille, width: "auto", maxWidth: "none", display: "block",
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,.55))",
        }}
      />
    </div>
  );
}

/** Een kaart die vrijkwam: het plaatje in een gouden lijst, met NIEUW eroverheen.
 *
 *  Lang niet elke kaart heeft al een foto. Een lege tegel leest als een fout,
 *  dus zonder foto krijgt hij zijn eigen letter groot en gedempt als gezicht.
 *  Dat is ook wat er komt te staan als het plaatje niet laadt. */
function KaartTegel({ kaart }: { kaart: NieuweKaart }) {
  const { t, tCat } = useT();
  const [foto, setFoto] = useState(!!kaart.image_path);
  // De sleutel van Ontdekken is kleingeschreven ("land"), de vertaaltabel kent
  // de categorie zoals het spel hem noemt ("Land").
  const soort = tCat(kaart.category.charAt(0).toUpperCase() + kaart.category.slice(1));
  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <div
        style={{
          position: "relative", width: "100%", aspectRatio: "659 / 1013",
          borderRadius: 5, overflow: "hidden",
          border: `1px solid ${withAlpha(colors.gold, 0.7)}`,
          boxShadow: `0 0 9px ${withAlpha(colors.gold, 0.28)}`,
          background: foto ? "#180B33" : `linear-gradient(180deg, #2A1550, #150A2E)`,
        }}
      >
        {foto ? (
          <img
            src={kaart.image_path as string}
            alt="" aria-hidden draggable={false}
            onError={() => setFoto(false)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              fontFamily: font.display, fontWeight: 800, fontSize: "clamp(22px, 7.5vw, 34px)",
              lineHeight: 1, color: withAlpha(colors.gold, 0.32),
              transform: "translateY(-8%)",
            }}
          >
            {kaart.letter}
          </span>
        )}
        {/* Naar onderen donker, zodat de naam op elk plaatje leesbaar is. */}
        <span
          aria-hidden
          style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 45%, rgba(8,3,22,.88) 100%)" }}
        />
        {/* De categoriepil en de naam, als een blok tegen de onderrand. In het
            ontwerp staat de pil boven de naam en dat is ook wat hij doet: hij
            zegt WELKE kaart dit is, en de naam zegt welke van die soort. */}
        <span
          style={{
            position: "absolute", left: 0, right: 0, bottom: 3,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            paddingInline: 2, minWidth: 0,
          }}
        >
          <span
            style={{
              maxWidth: "100%", padding: "1px 5px", borderRadius: 999,
              background: `linear-gradient(180deg, ${withAlpha(colors.violet, 0.95)}, ${withAlpha(colors.violetDeep, 0.95)})`,
              border: `1px solid ${withAlpha("#D9A6DF", 0.6)}`,
              fontFamily: font.ui, fontSize: 6.5, fontWeight: 800, letterSpacing: 0.3,
              lineHeight: 1.5, color: "#FFFFFF", textTransform: "uppercase",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {soort}
          </span>
          <span
            style={{
              maxWidth: "100%",
              fontFamily: font.display, fontWeight: 800, fontSize: "clamp(7.5px, 2.5vw, 10px)",
              lineHeight: 1.05, color: colors.gold, textShadow: "0 1px 3px rgba(0,0,0,.9)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {kaart.word.toUpperCase()}
          </span>
        </span>
        {/* Het lint linksboven, half over de lijst heen zoals in het ontwerp. */}
        <Lint soort="nieuw" tekst={t("rvNieuw")} breed={50} style={{ position: "absolute", left: "-6%", top: "0%" }} />
      </div>
    </div>
  );
}

/** Het teken voor een voortgangsrij: de categorie krijgt zijn eigen icoon, de
 *  letter zichzelf in een ring. Uit de mockup, en het scheelt lezen: je ziet aan
 *  de vorm al of de rij over een categorie of over de letter gaat. */
const CAT_TEKEN: Record<string, typeof Globe> = {
  land: Globe, stad: Building2, vrucht: Apple, dier: PawPrint, beroep: Briefcase,
};

function VoortgangTeken({ v }: { v: Voortgang }) {
  const maat = 30;
  const ring: React.CSSProperties = {
    width: maat, height: maat, borderRadius: "50%", flexShrink: 0,
    display: "grid", placeItems: "center",
    background: "rgba(0,0,0,.42)",
    boxShadow: `inset 0 0 0 1.5px ${withAlpha(v.soort === "letter" ? colors.gold : colors.violet, 0.75)}`,
  };
  if (v.soort === "letter") {
    return (
      <span style={ring} aria-hidden>
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, lineHeight: 1, color: colors.gold }}>
          {v.label.toUpperCase()}
        </span>
      </span>
    );
  }
  const Teken = CAT_TEKEN[v.sleutel.toLowerCase()] ?? Layers;
  return (
    <span style={ring} aria-hidden>
      <Teken size={15} color="#C89BFF" />
    </span>
  );
}

/** Een voortgangsbalk met zijn kop en het aantal dat erbij kwam. */
function BalkRij({ v }: { v: Voortgang }) {
  const { t } = useT();
  const pct = v.total > 0 ? Math.min(100, Math.round((v.have / v.total) * 100)) : 0;
  // Hoeveel procent er deze ronde bij kwam. Uit de mockup, en het is het enige
  // getal op deze pagina dat zegt wat DEZE ronde deed in plaats van waar je
  // staat.
  const voor = v.total > 0 ? Math.round(((v.have - v.plus) / v.total) * 100) : 0;
  const delta = Math.max(0, pct - voor);
  const label = v.soort === "letter" ? t("rvLetterLabel", { letter: v.label }) : v.label;
  return (
    <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
      <VoortgangTeken v={v} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: font.display, fontWeight: 700, fontSize: 12.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {v.plus > 0 && (
          <span style={{ flexShrink: 0, fontFamily: font.display, fontWeight: 800, fontSize: 12, color: colors.green }}>
            +{v.plus}
          </span>
        )}
      </div>
      <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.sub }}>
        {v.have} / {v.total}
      </span>
      <div
        style={{
          position: "relative", height: 7, borderRadius: 999, overflow: "hidden",
          background: "rgba(0,0,0,.5)", border: `1px solid ${withAlpha(colors.gold, 0.25)}`,
        }}
      >
        <div
          style={{
            height: "100%", width: `${pct}%`, borderRadius: 999,
            background: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold} 55%, #B07C17)`,
            boxShadow: `inset 0 1px 0 ${withAlpha("#FFF3C6", 0.8)}`,
            transition: "width .8s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 11, color: colors.gold }}>{pct}%</span>
        {delta > 0 && (
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 10, color: colors.green }}>▲+{delta}%</span>
        )}
      </div>
      </div>
    </div>
  );
}

/** Een regel in "Jouw prestaties". */
function Prestatie({ teken, label, waarde, na }: {
  teken: React.ReactNode; label: string; waarde: string; na?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <span style={{ flexShrink: 0, display: "flex" }}>{teken}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 11, color: colors.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ flexShrink: 0, fontFamily: font.display, fontWeight: 800, fontSize: 13, color: colors.ink }}>
        {waarde}
        {na && <span style={{ fontFamily: font.ui, fontWeight: 500, fontSize: 8.5, color: colors.faint }}> {na}</span>}
      </span>
    </div>
  );
}

export function RondeVoltooid({
  goed,
  fout,
  kaarten,
  beloning,
  onSluit,
  onOpnieuw,
  onOntdekken,
  onQuiz,
}: {
  /** Antwoorden die in de lijst stonden, over deze oefensessie. */
  goed: number;
  /** Antwoorden die fout of leeg waren, over dezelfde sessie. */
  fout: number;
  kaarten: NieuweKaart[];
  /** Alleen voor een account: een gast verdient niets en verzamelt niets. */
  beloning: Beloning | null;
  onSluit: () => void;
  onOpnieuw: () => void;
  onOntdekken?: () => void;
  onQuiz?: () => void;
}) {
  const { t } = useT();
  const totaal = goed + fout;
  const raak = totaal > 0 ? Math.round((goed / totaal) * 100) : 0;
  // VERDIEND en GEZIEN staan los van elkaar. Een spoor is geen beloning, dus
  // hij hoort niet tussen de kaarten die je wel binnenhaalde.
  const gehaald = kaarten.filter((k) => !k.spoor);
  const sporen = kaarten.filter((k) => k.spoor);
  const toon = gehaald.slice(0, 3);
  // De quiz gaat over kaarten die je HEBT, dus zonder profiel valt er niets te
  // overhoren. Een knop die je naar een leeg scherm stuurt is erger dan geen
  // knop, dus voor een gast staat de hele volgende stap er niet.
  const quizAan = !!onQuiz && !!beloning;

  // Weg met Escape, zoals elke andere popup.
  useEffect(() => {
    const opToets = (e: KeyboardEvent) => { if (e.key === "Escape") onSluit(); };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [onSluit]);

  const vak = { hoek: 11, kleur: "violet" as const, dik: 0.6, gloed: true, vulling: "licht" as const, binnenlijn: true, hoekAccent: "#F3B53E", padding: 11 };

  return (
    <div
      onClick={onSluit}
      style={{
        position: "fixed", inset: 0, zIndex: 97,
        background: "rgba(6,3,18,.86)",
        backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
        display: "grid", placeItems: "center",
        padding: "14px 12px",
        overflowY: "auto",
      }}
    >
      <Snippers />
      <div
        role="dialog"
        aria-label={t("rvTitel")}
        onClick={(e) => e.stopPropagation()}
        className="pop-in"
        style={{
          position: "relative", zIndex: 3,
          width: "min(370px, 100%)",
          // De pagina is lang: op een telefoon scrolt hij binnen zijn eigen
          // lijst, zodat de gouden omtrek altijd heel blijft.
          maxHeight: "calc(100dvh - 28px)",
          display: "flex",
        }}
      >
        <GoudKader
          hoek={16} dik={1} rond={3} gloed vulling binnenlijn binnenSterkte={0.3}
          hoekAccent="#F3B53E" puntjes padding={0}
          style={{ width: "100%", display: "flex", minHeight: 0 }}
        >
          <div
            className="zachtscroll"
            style={{
              width: "100%", minHeight: 0, overflowY: "auto",
              padding: "16px 13px 13px",
              display: "flex", flexDirection: "column", gap: 11,
            }}
          >
            {/* ---- kop ---- */}
            <div style={{ position: "relative", textAlign: "center" }}>
              <button
                onClick={() => { sound.uiTap(); onSluit(); }}
                aria-label={t("back")}
                className="pressable"
                style={{ position: "absolute", right: -2, top: -4, background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex" }}
              >
                <CloseIcon size={25} />
              </button>
              <NeonText
                accent={colors.gold} blur={16} glow={0.65}
                style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(23px, 7.6vw, 30px)", lineHeight: 1.05 }}
              >
                {t("rvTitel").toUpperCase()}
              </NeonText>
            </div>

            {/* ---- de beloning ---- */}
            {beloning ? (
              <>
                <Kroon xp={beloning.xp} munten={beloning.munten} />
                {beloning.vol && (
                  <p style={{ margin: "-4px 0 0", fontFamily: font.ui, fontSize: 10.5, lineHeight: 1.3, color: colors.faint, textAlign: "center" }}>
                    {t("rvPotVol")}
                  </p>
                )}
              </>
            ) : (
              <GoudKader {...vak}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, color: colors.gold }}>{t("rvGastKop")}</div>
                  <p style={{ margin: "4px 0 0", fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.4, color: colors.sub }}>{t("rvGastBody")}</p>
                </div>
              </GoudKader>
            )}

            {/* ---- de kaarten ---- */}
            {beloning && (
              <GoudKader {...vak}>
                <SierKop label={t("rvKaartenKop")} />
                {gehaald.length === 0 ? (
                  // Alleen de kale mededeling als er ook geen sporen zijn. De
                  // uitleg eronder is weg: die maakte van een korte sectie een
                  // lap tekst, en wie sporen ziet staan snapt het uit de rij.
                  sporen.length === 0 ? (
                    <p style={{ margin: "8px 0 2px", fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.4, color: colors.sub, textAlign: "center" }}>
                      {t("rvGeenKaarten")}
                    </p>
                  ) : null
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${toon.length}, 1fr) 1.05fr`, gap: 6, marginTop: 7 }}>
                    {toon.map((k) => <KaartTegel key={k.id} kaart={k} />)}
                    {/* Het telvak: hoeveel het er in totaal waren. Ook als er maar
                        drie zijn, want dan is dit de zin die zegt waar ze heen
                        gingen. */}
                    <div
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 1, padding: "4px 3px", borderRadius: 6,
                        background: "rgba(0,0,0,.28)", border: `1px solid ${withAlpha(colors.violet, 0.4)}`,
                        textAlign: "center",
                      }}
                    >
                      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(17px, 6vw, 24px)", lineHeight: 1, color: colors.gold }}>
                        {gehaald.length}
                      </span>
                      <span style={{ fontFamily: font.ui, fontSize: 8.5, lineHeight: 1.15, color: colors.ink }}>
                        {gehaald.length === 1 ? t("rvKaartEnkel") : t("rvKaartMeer")}
                      </span>
                      <span style={{ fontFamily: font.ui, fontSize: 7.5, lineHeight: 1.15, color: colors.faint }}>
                        {t("rvKaartenNaar")}
                      </span>
                    </div>
                  </div>
                )}
                {/* De sporen als rij woorden. Geen tegels: het zijn geen
                    kaarten, en ze als kaart tonen zou precies het misverstand
                    zijn dat we net hebben weggehaald. */}
                {sporen.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${withAlpha("#8B93B5", 0.28)}` }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 5 }}>
                      <span style={{ fontFamily: font.wide, fontSize: 10.5, letterSpacing: 1.1, color: "#9AA2C4" }}>
                        {t("rvSporen")}
                      </span>
                      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 12, color: "#B6BEDD" }}>
                        {sporen.length}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {sporen.slice(0, 9).map((k) => (
                        <span
                          key={k.id}
                          style={{
                            padding: "2px 7px", borderRadius: 999,
                            background: "rgba(0,0,0,.3)", border: `1px solid ${withAlpha("#8B93B5", 0.45)}`,
                            fontFamily: font.ui, fontSize: 10, color: colors.sub,
                          }}
                        >
                          {k.word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </GoudKader>
            )}

            {/* ---- de voortgang ---- */}
            {beloning && beloning.voortgang.length > 0 && (
              <GoudKader {...vak}>
                <SierKop label={t("rvVoortgangKop")} />
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(2, beloning.voortgang.length)}, 1fr)`, gap: 10, marginTop: 8 }}>
                  {beloning.voortgang.map((v) => <BalkRij key={`${v.soort}${v.sleutel}`} v={v} />)}
                </div>
              </GoudKader>
            )}

            {/* ---- prestaties naast de volgende stap ---- */}
            <div style={{ display: "grid", gridTemplateColumns: quizAan ? "1fr 1fr" : "1fr", gap: 8 }}>
              <GoudKader {...vak}>
                <SierKop label={t("rvPrestatiesKop")} />
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
                  <Prestatie teken={<Check size={13} color={colors.green} />} label={t("rvGoed")} waarde={String(goed)} />
                  <Prestatie teken={<Kruis size={13} color={colors.red} />} label={t("rvGemist")} waarde={String(fout)} />
                  <Prestatie teken={<Target size={13} color="#58C4EC" />} label={t("rvAccuraat")} waarde={`${raak}%`} />
                  <Prestatie
                    teken={<Flame size={13} color={colors.orange} />}
                    label={t("rvReeks")}
                    waarde={String(beloning?.streak_days ?? 0)}
                    na={(beloning?.streak_days ?? 0) === 1 ? t("rvDag") : t("rvDagen")}
                  />
                </div>
              </GoudKader>

              {quizAan && onQuiz && (
                <GoudKader {...vak}>
                  <SierKop label={t("rvVolgendeKop")} />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 8 }}>
                    <Brain
                      size={26} color="#D986FC"
                      style={{ filter: "drop-shadow(0 0 9px rgba(223,146,255,.35))" }}
                    />
                    <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 13, color: colors.ink, textAlign: "center", lineHeight: 1.15 }}>
                      {t("rvQuizKop")}
                    </span>
                    <span style={{ fontFamily: font.ui, fontSize: 10, lineHeight: 1.3, color: colors.sub, textAlign: "center" }}>
                      {t("rvQuizBody")}
                    </span>
                    <Button variant="gold" full compact onClick={() => { sound.uiTap(); onQuiz(); }} style={{ fontSize: 12.5 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {t("rvQuizKnop")} <ChevronRight size={14} />
                      </span>
                    </Button>
                  </div>
                </GoudKader>
              )}
            </div>

            {/* ---- de twee uitgangen ----
                Naast elkaar zoals in het ontwerp, en met een kleiner opschrift
                dan een gewone knop: op een halve popupbreedte past "Opnieuw
                oefenen" op 16px niet op een regel. Zonder de tweede knop staat
                de eerste alleen en houdt hij zijn gewone maat. */}
            <div style={{ display: "grid", gridTemplateColumns: onOntdekken ? "1fr 1fr" : "1fr", gap: 8, marginTop: 1, justifyItems: "center" }}>
              <Button
                variant="primary" full compact={!!onOntdekken}
                onClick={() => { sound.uiTap(); onOpnieuw(); }}
                style={onOntdekken ? { fontSize: 12, padding: "0 12px" } : undefined}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <RotateCw size={13} /> {t("rvOpnieuw")}
                </span>
              </Button>
              {onOntdekken && (
                <Button
                  variant="gold" full compact
                  onClick={() => { sound.uiTap(); onOntdekken(); }}
                  style={{ fontSize: 12, padding: "0 12px" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Layers size={13} /> {t("rvNaarOntdekken")}
                  </span>
                </Button>
              )}
            </div>

          </div>
        </GoudKader>
      </div>
    </div>
  );
}
