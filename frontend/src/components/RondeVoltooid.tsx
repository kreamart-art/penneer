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
import { Brain, Check, Flame, Layers, RotateCw, Target, X as Kruis } from "lucide-react";
import { Button } from "./Button";
import { CloseIcon } from "./CloseIcon";
import { GoudKader } from "./GoudKader";
import { SierKop } from "./ProfileHero";
import { NeonText } from "./NeonText";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

/** De krans, opgemeten op /ui/krans.webp (871 x 823).
 *
 *  Het donkere binnenveld is met een flood fill vanuit het hart gevonden: 572 bij
 *  576 pixels, oppervlak 253593 tegen 258767 voor een perfecte ellips met die
 *  doos, dus het IS een cirkel. Daar gaat het muntlogo in. De krans zelf hangt
 *  hoger dan zijn doos suggereert, want de kroon zit erbovenop; vandaar dat het
 *  hart van de cirkel op 53,6% van de hoogte ligt en niet op de helft. */
const KRANS = { verh: 871 / 823, hartX: 0.4994, hartY: 0.5358, cirkel: 0.6567 };

/** De balk, opgemeten op /ui/balk-goud.webp (1292 x 281).
 *
 *  De gouden lijst loopt boven tot y 27 en onder vanaf y 219; links en rechts
 *  is de rand schuin, dus de veilige binnenmaat is gemeten op een kwart en
 *  driekwart hoogte (x 82..1210 en 106..1187). Het hart van het VELD ligt op
 *  43,8% van de hoogte en niet op de helft: de onderrand met zijn gloed is
 *  dikker dan de bovenrand. */
const BALK = { verh: 1292 / 281, l: 0.055, r: 0.055, t: 0.096, b: 0.221, hart: 0.438 };

/** Hoe groot de krans is ten opzichte van de balk. Op 1 zou hij precies zo hoog
 *  zijn als de balk en dan is het een medaille IN een balk; hierboven steekt hij
 *  er boven en onder uit en wordt de balk zijn voetstuk. Dat is wat de mockup
 *  doet en het is ook wat het beeld draagt.
 *
 *  1,62 en niet 1,75: bij 1,75 beslaat de krans 44% van het veld en dan lag hij
 *  over "Ervaring" en "Munten" heen. Zie MIDDEN. */
const KRANS_OP_BALK = 1.62;

/** Hoe breed de middenkolom van de balk is, als deel van het VELD. Daar staat de
 *  krans, dus dit moet minstens zijn breedte zijn, anders schuift de tekst
 *  eronder. De krans meet KRANS_OP_BALK / BALK.verh / KRANS.verh van de
 *  balkbreedte, wat op deze getallen 33,3% is; het veld is 89% van de balk, dus
 *  de krans is 37,4% van het veld en 40% laat er nog een kier omheen. */
const MIDDEN = "40%";

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

/** De kop: krans op de balk, met links de XP en rechts de munten.
 *
 *  De krans ligt als losse laag OVER de balk en telt niet mee voor de hoogte
 *  van de balk; de ruimte die hij erboven nodig heeft komt als padding op het
 *  omhulsel. Anders zou de balk meegroeien met de krans en zijn verhouding
 *  verliezen. */
function Kroon({ xp, munten }: { xp: number; munten: number }) {
  const { t } = useT();
  return (
    <div style={{ position: "relative", width: "100%", paddingTop: `${((KRANS_OP_BALK - 1) * 100) / BALK.verh / 2}%` }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: `${BALK.verh}` }}>
        <img
          src="/ui/balk-goud.webp" alt="" aria-hidden draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        />
        {/* Het veld binnen de lijst. De middenkolom is lucht: daar staat de
            krans, en tekst eronder zou erachter verdwijnen. */}
        <div
          style={{
            position: "absolute",
            left: `${BALK.l * 100}%`, right: `${BALK.r * 100}%`,
            top: `${BALK.t * 100}%`, bottom: `${BALK.b * 100}%`,
            display: "grid", gridTemplateColumns: `1fr ${MIDDEN} 1fr`, alignItems: "center", gap: 2,
          }}
        >
          <Winst teken={<XpTeken maat={22} />} waarde={xp} label={t("rvXp")} kleur={colors.ink} />
          <span />
          <Winst
            teken={<img src="/coin.webp" alt="" aria-hidden width={23} height={23} style={{ display: "block" }} />}
            waarde={munten} label={t("rvMunten")} kleur={colors.gold} rechts
          />
        </div>

        {/* De krans, gecentreerd op het HART VAN HET VELD en niet op de doos:
            de onderrand van de balk is dikker dan de bovenrand, dus op 50% zou
            hij zichtbaar te laag hangen. */}
        <div
          style={{
            position: "absolute", left: "50%", top: `${BALK.hart * 100}%`,
            transform: "translate(-50%, -50%)",
            width: `${(KRANS_OP_BALK * 100) / BALK.verh / KRANS.verh}%`,
            aspectRatio: `${KRANS.verh}`,
          }}
        >
          <img
            src="/ui/krans.webp" alt="" aria-hidden draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
          />
          {/* Het muntlogo in de binnencirkel. Op 62% van die cirkel: vol zou het
              tegen de binnenring plakken, en dan lezen twee ringen als een. */}
          <img
            src="/logo-klein.webp" alt="" aria-hidden draggable={false}
            style={{
              position: "absolute",
              left: `${KRANS.hartX * 100}%`, top: `${KRANS.hartY * 100}%`,
              width: `${KRANS.cirkel * 62}%`, transform: "translate(-50%, -50%)",
              display: "block",
            }}
          />
        </div>
      </div>
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
          position: "relative", width: "100%", aspectRatio: "658 / 1012",
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
        {/* Het lintje linksboven, half over de lijst heen zoals in het ontwerp. */}
        <span
          style={{
            position: "absolute", left: -2, top: 5,
            padding: "1px 5px 1px 4px", borderRadius: "0 3px 3px 0",
            background: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold})`,
            fontFamily: font.ui, fontSize: 7, fontWeight: 800, letterSpacing: 0.4,
            color: "#3A2405", textTransform: "uppercase",
          }}
        >
          {t("rvNieuw")}
        </span>
      </div>
    </div>
  );
}

/** Een voortgangsbalk met zijn kop en het aantal dat erbij kwam. */
function BalkRij({ v }: { v: Voortgang }) {
  const { t } = useT();
  const pct = v.total > 0 ? Math.min(100, Math.round((v.have / v.total) * 100)) : 0;
  const label = v.soort === "letter" ? t("rvLetterLabel", { letter: v.label }) : v.label;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
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
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 11, color: colors.gold }}>{pct}%</span>
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
  letter,
  goed,
  fout,
  kaarten,
  beloning,
  onSluit,
  onOpnieuw,
  onOntdekken,
  onQuiz,
}: {
  letter: string;
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
                {t("rvTitel")}
              </NeonText>
              <div style={{ marginTop: 3, fontFamily: font.ui, fontSize: 13, color: colors.ink }}>{t("rvSub")}</div>
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
                  <p style={{ margin: "8px 0 2px", fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.4, color: colors.sub, textAlign: "center" }}>
                    {sporen.length > 0 ? t("rvGeenGehaaldUitleg") : t("rvGeenKaarten")}
                  </p>
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
                      {sporen.slice(0, 12).map((k) => (
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
                    <p style={{ margin: "6px 0 0", fontFamily: font.ui, fontSize: 9.5, lineHeight: 1.35, color: colors.faint }}>
                      {t("rvSporenUitleg")}
                    </p>
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
                      {t("rvQuizKnop")}
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

            {/* De letter waar dit over ging, als voetregel: de popup zelf noemt
                hem nergens meer en zonder dat is het na twee rondes niet meer
                terug te zien welke ronde dit was. */}
            <span style={{ fontFamily: font.ui, fontSize: 10, color: colors.faint, textAlign: "center" }}>
              {t("rvLetterVoet", { letter })}
            </span>
          </div>
        </GoudKader>
      </div>
    </div>
  );
}
