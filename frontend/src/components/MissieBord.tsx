// Het missiebord: vier tabbladen op de nieuwe plaat.
//
// DE PLAAT IS IN DRIEEN GESNEDEN (`ui/missies/bord-boven|midden|onder.webp`).
// De art is 3958 x 5919 en dus veel korter dan een telefoon; uitrekken op
// `100% 100%` zou de gouden lijst boven en onder dikker maken dan opzij en de
// hoeken vervormen. Nu blijven de kop (met het embleem en de vier vakjes) en
// de voet op hun eigen verhouding staan, en groeit alleen het middenstuk mee.
// Dat middenstuk is de MEDIAAN van een band uit het midden van de plaat, zodat
// de rail overal hetzelfde is en het uitrekken niets uitsmeert.
//
// HET EERSTE VAKJE STOND IN DE ART AAN. Welke tab actief is bepaalt de app, dus
// dat gouden vakje is in de plaat overgeschilderd met het rustige vakje ernaast
// en de actieve staat wordt hier getekend.
//
// ALLE MATEN ZIJN DELEN VAN DE PLAAT, opgemeten op de gouden lijnen zelf:
//
//   vakjes   y 0,1010 .. 0,1446
//            x 0,0558-0,2711 | 0,2865-0,4939 | 0,5099-0,7175 | 0,7309-0,9424
//   paneel   x 0,0419 .. 0,9581   y 0,1559 .. 0,9470
//
// WAT ER OP HET BORD STAAT KOMT UIT HET SPEL. De dag-, week- en seizoensmissies
// uit /api/missions/all, de prestaties uit je account, de reeks uit je
// dagrondes, het schild uit je divisie en de pen uit je level. Er staat niets
// op dat nergens vandaan komt.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  BookOpen, CalendarDays, Check, Globe2, Link2, MessageCircle, Star, Swords, Trophy,
} from "lucide-react";
import { CloseIcon } from "./CloseIcon";
import { Schild, divisieNaam } from "./Divisie";
import { GOUD, Prestatie, SCHILD_KLEUREN } from "./ProfileHero";
import { VOLGORDE, badgeArt, teken, usePrestaties, voortgang } from "../data/prestaties";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import type { Account } from "../net/socket";
import { colors, font, withAlpha } from "../theme/tokens";

// ---- de plaat --------------------------------------------------------------

const ART_B = 3958;
const ART_H = 5919;
const VERH = ART_B / ART_H;          // breedte / hoogte van de hele plaat
const SNEE_BOVEN = 0.2;              // waar het kopstuk ophoudt (het voetstuk
                                     // begint op 0,9; dat stuk draagt zijn eigen
                                     // verhouding en hoeft hier niet te rekenen)
const TAB_X = [
  [0.0558, 0.2711],
  [0.2865, 0.4939],
  [0.5099, 0.7175],
  [0.7309, 0.9424],
] as const;
const TAB_T = 0.101;
const TAB_B = 0.1446;
const PANEEL_L = 0.0419;

const pct = (v: number) => `${(v * 100).toFixed(4)}%`;

// ---- pennen ----------------------------------------------------------------
// De pen is je level in het echt: zeven treden, van hout tot kosmisch. De art
// komt uit het vel in de UI-map (het witte stickerrandje is eraf gesneden).
//
// De levelcurve staat in de backend: level n begint op 50*n*(n-1) XP. Daarmee
// is "nog zoveel XP tot de volgende pen" een echte som en geen schatting.
const PENNEN = [
  { id: "hout", level: 1 },
  { id: "brons", level: 5 },
  { id: "zilver", level: 10 },
  { id: "goud", level: 20 },
  { id: "platina", level: 35 },
  { id: "diamant", level: 50 },
  { id: "kosmisch", level: 75 },
] as const;
const xpVoorLevel = (l: number) => 50 * l * (l - 1);

/** Welke pen je nu hebt, en welke er hierna komt (null als je de laatste hebt). */
function penStand(level: number) {
  let i = 0;
  for (let n = 0; n < PENNEN.length; n++) if (level >= PENNEN[n].level) i = n;
  return { nu: i, volgend: i + 1 < PENNEN.length ? i + 1 : null };
}

// ---- soorten missies -------------------------------------------------------
// Elke missie krijgt een teken en een kleur die bij het onderdeel horen waar hij
// over gaat: de dagronde oranje, duels rood, woorden violet. Zo herken je aan
// de linkerkant van een rij al waar hij je heen stuurt.
const SOORTEN: { test: RegExp; Icoon: typeof Swords; kleur: string }[] = [
  { test: /daily|dagrond|dagpunt/, Icoon: CalendarDays, kleur: "#FF9F45" },
  { test: /duel/, Icoon: Swords, kleur: "#FF564A" },
  { test: /topo/, Icoon: Globe2, kleur: "#36E0AE" },
  { test: /dubbel/, Icoon: Link2, kleur: "#FF7AC2" },
  { test: /uniek|unique/, Icoon: BookOpen, kleur: "#A76BFF" },
  { test: /chat/, Icoon: MessageCircle, kleur: "#4FD8E8" },
  { test: /win/, Icoon: Trophy, kleur: "#FFC23D" },
  { test: /punten|score/, Icoon: Star, kleur: "#FFC23D" },
];
const soortVan = (key: string) =>
  SOORTEN.find((s) => s.test.test(key)) ?? { Icoon: Swords, kleur: "#A76BFF" };

// ---- schaal ----------------------------------------------------------------
// Alles is getekend op een bord van 334 punten binnenwerk (een telefoon van
// 393). Op een smallere telefoon krimpt het geheel mee in plaats van dat er
// een regel omvalt; groter dan een wordt het niet, want dan gaat het bord er op
// een tablet uit zien als een poster.
const SchaalCtx = createContext(1);
const useK = () => useContext(SchaalCtx);

// ---- bouwstenen ------------------------------------------------------------

/** Een kaart op het bord: donker glas met een gouden haarlijn en licht van
 *  linksboven. Geen NeonKader: er staan er zes onder elkaar en die zou met zijn
 *  ring- en gloedlagen elke rij duurder maken dan de inhoud zelf. */
function Kaart({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const k = useK();
  return (
    <div
      style={{
        borderRadius: 14 * k,
        padding: `${10 * k}px ${11 * k}px`,
        background:
          "linear-gradient(168deg, rgba(84,44,150,.42) 0%, rgba(34,14,72,.52) 46%, rgba(18,7,42,.58) 100%)",
        border: "1px solid rgba(255,214,110,.18)",
        boxShadow: "inset 0 1px 0 rgba(255,236,190,.14), 0 4px 14px rgba(0,0,0,.35)",
        display: "flex",
        flexDirection: "column",
        gap: 8 * k,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** De kop van een kaart: opschrift in goud, bijschrift eronder. */
function KaartKop({ kop, sub, rechts }: { kop: string; sub?: string; rechts?: React.ReactNode }) {
  const k = useK();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 * k }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 * k }}>
        <span
          style={{
            fontFamily: font.wide,
            fontWeight: 700,
            fontSize: 15 * k,
            lineHeight: 1,
            letterSpacing: 0.6 * k,
            textTransform: "uppercase",
            color: "#FFF3D0",
            textShadow: `0 0 ${7 * k}px ${withAlpha(colors.gold, 0.35)}`,
          }}
        >
          {kop}
        </span>
        {!!sub && (
          <span style={{ fontFamily: font.ui, fontSize: 10 * k, lineHeight: 1.25, color: colors.faint }}>{sub}</span>
        )}
      </div>
      {rechts}
    </div>
  );
}

/** Een voortgangsbalk. Goud voor wat je verdient, violet voor de inkt. */
function Balk({ deel, hoog = 5, kleur = "goud" }: { deel: number; hoog?: number; kleur?: "goud" | "violet" }) {
  const k = useK();
  const vulling =
    kleur === "goud"
      ? `linear-gradient(90deg, ${GOUD[1]}, ${GOUD[2]} 62%, ${GOUD[3]})`
      : "linear-gradient(90deg, #6A2DD8, #A868F5 58%, #E4C6FF)";
  return (
    <span
      style={{
        display: "block",
        flex: 1,
        height: hoog * k,
        borderRadius: 999,
        background: "rgba(0,0,0,.45)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,.55)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.round(Math.max(0, Math.min(1, deel)) * 100)}%`,
          borderRadius: 999,
          background: vulling,
          boxShadow: `0 0 ${6 * k}px ${kleur === "goud" ? withAlpha(colors.gold, 0.5) : "rgba(168,104,245,.6)"}`,
          transition: "width .4s ease",
        }}
      />
    </span>
  );
}

/** Munten en cash achter een getal, in de maat van de regel waar ze in staan. */
function Prijs({ xp, coins, cash }: { xp?: number; coins?: number; cash?: number }) {
  const k = useK();
  const maat = 11 * k;
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 * k }}>
      {!!xp && (
        <span style={{ fontFamily: font.ui, fontSize: 11 * k, fontWeight: 800, color: GOUD[3], whiteSpace: "nowrap" }}>
          +{xp} XP
        </span>
      )}
      {!!coins && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 * k, fontFamily: font.ui, fontSize: 10.5 * k, fontWeight: 700, color: GOUD[3] }}>
          <img src="/coins-stack.webp" alt="" aria-hidden style={{ height: maat, width: "auto", display: "block" }} />
          {coins}
        </span>
      )}
      {!!cash && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 * k, fontFamily: font.ui, fontSize: 10.5 * k, fontWeight: 700, color: "#8FE3A8" }}>
          <img src="/ui/valuta/cash.webp?v=1" alt="" aria-hidden style={{ height: maat, width: "auto", display: "block" }} />
          {cash}
        </span>
      )}
    </span>
  );
}

// ---- een missierij ---------------------------------------------------------

interface Missie {
  key: string;
  target: number;
  progress: number;
  done: boolean;
  claimed: boolean;
  reward: number;
  coins?: number;
  cash?: number;
}

function Rij({ m, laag, onClaim }: { m: Missie; laag: Laag; onClaim: (key: string) => void }) {
  const { t } = useT();
  const k = useK();
  const [bezig, setBezig] = useState(false);
  const { Icoon, kleur } = soortVan(m.key);
  const teHalen = m.done && !m.claimed && laag !== "dag";
  const af = m.done;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9 * k,
        padding: `${8 * k}px ${10 * k}px`,
        borderRadius: 13 * k,
        background: teHalen
          ? "linear-gradient(168deg, rgba(255,194,61,.22), rgba(40,18,80,.5))"
          : "linear-gradient(168deg, rgba(58,30,110,.38), rgba(20,8,46,.5))",
        border: `1px solid ${teHalen ? withAlpha(colors.gold, 0.5) : "rgba(255,255,255,.08)"}`,
        boxShadow: "inset 0 1px 0 rgba(255,236,190,.1)",
      }}
    >
      {/* Het tegeltje met het teken. De kleur zit in de rand en de gloed, niet
          in een vol vlak: een gekleurd blok trekt de rij uit balans. */}
      <span
        style={{
          width: 38 * k,
          height: 38 * k,
          flexShrink: 0,
          borderRadius: 11 * k,
          display: "grid",
          placeItems: "center",
          background: `radial-gradient(120% 120% at 30% 10%, ${withAlpha(kleur, 0.34)}, rgba(10,4,26,.6))`,
          border: `1px solid ${withAlpha(kleur, 0.55)}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), 0 0 ${8 * k}px ${withAlpha(kleur, 0.28)}`,
          opacity: af ? 0.75 : 1,
        }}
      >
        <Icoon size={19 * k} color={kleur} strokeWidth={2.1} />
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 * k }}>
        <span
          style={{
            fontFamily: font.ui,
            fontSize: 12 * k,
            fontWeight: 600,
            lineHeight: 1.22,
            color: af ? colors.faint : colors.ink,
          }}
        >
          {t(`mission_${m.key}`)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 * k }}>
          <span style={{ fontFamily: font.ui, fontSize: 9.5 * k, fontVariantNumeric: "tabular-nums", color: colors.faint, flexShrink: 0 }}>
            {m.progress}/{m.target}
          </span>
          <Balk deel={m.target ? m.progress / m.target : 0} hoog={4} />
        </span>
      </div>

      <Prijs xp={m.reward} coins={m.coins} cash={m.cash} />

      {/* Rechts staat altijd iets: de knop als er te halen valt, het vinkje als
          het af is, en anders niets dan de prijs. */}
      {teHalen ? (
        <button
          disabled={bezig}
          onClick={() => { sound.uiTap(); setBezig(true); onClaim(m.key); }}
          className="pressable"
          style={{
            flexShrink: 0,
            border: "none",
            borderRadius: 999,
            padding: `${6 * k}px ${11 * k}px`,
            cursor: bezig ? "default" : "pointer",
            opacity: bezig ? 0.6 : 1,
            background: `linear-gradient(180deg, ${GOUD[3]}, ${GOUD[1]})`,
            color: "#2A1A05",
            fontFamily: font.ui,
            fontSize: 11 * k,
            fontWeight: 800,
          }}
        >
          {t("missiesClaim")}
        </button>
      ) : af ? (
        <span
          aria-label={t("missiesOpgehaald")}
          style={{
            flexShrink: 0,
            width: 22 * k,
            height: 22 * k,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(160deg, #6BE39A, #1F9E58)",
            boxShadow: "0 0 8px rgba(60,220,140,.45)",
            color: "#04240F",
          }}
        >
          <Check size={13 * k} strokeWidth={3.2} />
        </span>
      ) : null}
    </div>
  );
}

// ---- de reeks --------------------------------------------------------------
// Zeven dagen dagronde op rij levert het emotepakket Verdriet op. Dat is geen
// verzonnen beloning voor dit scherm: die regel staat in de backend
// (EMOTE_PACK_UNLOCK) en gold al voordat dit bord er was.
const REEKS_DOEL = 7;

function ReeksKaart({ reeks }: { reeks: number }) {
  const { t } = useT();
  const k = useK();
  const rond = Math.min(reeks, REEKS_DOEL);
  return (
    <Kaart>
      <KaartKop
        kop={t("bordReeks")}
        sub={reeks === 1 ? t("bordReeksDag") : t("bordReeksDagen", { n: reeks })}
        rechts={
          <img src="/ui/stat/vlam.webp" alt="" aria-hidden style={{ height: 26 * k, width: "auto", display: "block", opacity: reeks ? 1 : 0.4 }} />
        }
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 4 * k }}>
        {Array.from({ length: REEKS_DOEL }, (_, i) => {
          const gehaald = i < rond;
          const prijs = i === REEKS_DOEL - 1;
          return (
            <span
              key={i}
              style={{
                width: 29 * k,
                height: 29 * k,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: gehaald
                  ? "linear-gradient(160deg, rgba(255,214,110,.3), rgba(120,60,10,.35))"
                  : "rgba(0,0,0,.32)",
                border: `1px solid ${gehaald ? withAlpha(colors.gold, 0.7) : prijs ? withAlpha(colors.gold, 0.35) : "rgba(255,255,255,.12)"}`,
                boxShadow: gehaald ? `0 0 ${7 * k}px ${withAlpha(colors.gold, 0.35)}` : "none",
                color: gehaald ? GOUD[3] : colors.faint,
                fontFamily: font.ui,
                fontSize: 10.5 * k,
                fontWeight: 700,
              }}
            >
              {gehaald ? <Check size={14 * k} strokeWidth={3} /> : i + 1}
            </span>
          );
        })}
      </div>
      <span style={{ fontFamily: font.ui, fontSize: 9.5 * k, color: colors.faint, lineHeight: 1.3 }}>
        {t("bordReeksDoel")}
      </span>
    </Kaart>
  );
}

// ---- de pen ----------------------------------------------------------------

function PenBalk({ account }: { account: Account | null }) {
  const { t, lang } = useT();
  const k = useK();
  const level = account?.level.level ?? 1;
  const xp = account?.level.xp ?? 0;
  const { nu, volgend } = penStand(level);
  const van = xpVoorLevel(PENNEN[nu].level);
  const tot = volgend !== null ? xpVoorLevel(PENNEN[volgend].level) : van;
  const deel = volgend === null ? 1 : Math.max(0, Math.min(1, (xp - van) / Math.max(1, tot - van)));
  const teGaan = volgend === null ? 0 : Math.max(0, tot - xp);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10 * k,
        padding: `${8 * k}px ${11 * k}px`,
        borderRadius: 14 * k,
        background: "linear-gradient(168deg, rgba(94,40,180,.4), rgba(22,8,54,.62))",
        border: "1px solid rgba(168,104,245,.32)",
        boxShadow: "inset 0 1px 0 rgba(226,200,255,.16), 0 4px 14px rgba(0,0,0,.35)",
      }}
    >
      {/* De pen die je NU hebt, groot, op een plas licht. In de mockup staat hij
          links van de balk en dat is ook waar hij hoort: hij is het onderwerp,
          de rij eronder is de ladder. */}
      <span style={{ position: "relative", width: 34 * k, height: 62 * k, flexShrink: 0, display: "grid", placeItems: "center" }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "62%",
            width: 40 * k,
            height: 22 * k,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(186,120,255,.65), rgba(120,50,220,.2) 60%, transparent)",
            filter: `blur(${4 * k}px)`,
          }}
        />
        {/* In PIXELS en niet op 100%: een procenthoogte in een rasterhokje pakt
            de intrinsieke maat van de art en dan schiet de pen dwars door de
            kaart heen. */}
        <img
          src={`/ui/pen/${PENNEN[nu].id}.webp`}
          alt=""
          aria-hidden
          style={{ position: "relative", height: 62 * k, width: "auto", maxWidth: "none", display: "block" }}
        />
      </span>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 * k }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 * k }}>
          <span
            style={{
              fontFamily: font.wide,
              fontWeight: 700,
              fontSize: 13 * k,
              letterSpacing: 0.7 * k,
              textTransform: "uppercase",
              color: "#FFF3D0",
            }}
          >
            {t("bordPen")}
          </span>
          <span style={{ flex: 1, fontFamily: font.ui, fontSize: 9.5 * k, color: colors.faint, textAlign: "right" }}>
            {t(`pen_${PENNEN[nu].id}`)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7 * k }}>
          <Balk deel={deel} hoog={6} kleur="violet" />
          <span style={{ fontFamily: font.ui, fontSize: 8.5 * k, fontWeight: 700, letterSpacing: 0.4 * k, color: deel >= 1 ? "#E4C6FF" : colors.faint, whiteSpace: "nowrap" }}>
            {deel >= 1 ? t("bordInktVol") : t("bordInkt")}
          </span>
        </div>

        {/* De hele ladder, want een trede die je nog niet hebt is precies wat je
            wilt halen. Wat je al hebt staat vol, de rest gedempt.
            SCHUIN IN EEN RONDJE, zoals op de mockup: een pen is lang en dun, dus
            rechtop op deze maat is hij een streepje van zeven pixels breed. Over
            de diagonaal van het rondje heeft hij de ruimte om een pen te zijn. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {PENNEN.map((p, i) => {
            const heeft = level >= p.level;
            const maat = 30 * k;
            return (
              <span key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 * k }}>
              <span
                style={{
                  position: "relative",
                  width: maat,
                  height: maat,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  background: i === nu
                    ? "radial-gradient(closest-side, rgba(255,214,110,.26), rgba(20,8,46,.5))"
                    : "rgba(0,0,0,.26)",
                  border: `1px solid ${i === nu ? withAlpha(colors.gold, 0.8) : heeft ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.08)"}`,
                  boxShadow: i === nu ? `0 0 ${8 * k}px ${withAlpha(colors.gold, 0.5)}` : "none",
                }}
              >
                <img
                  src={`/ui/pen/${p.id}.webp`}
                  alt=""
                  aria-hidden
                  style={{
                    // Ruim groter dan het rondje: over de diagonaal past een pen
                    // van anderhalf keer de doorsnee, en dan is het weer een pen
                    // in plaats van een streepje.
                    height: maat * 1.5,
                    width: "auto",
                    maxWidth: "none",
                    display: "block",
                    transform: "rotate(-38deg)",
                    filter: heeft ? "none" : "grayscale(1) brightness(1.35) contrast(.7)",
                    opacity: heeft ? 1 : 0.34,
                  }}
                />
              </span>
              {/* De naam eronder, zoals op de mockup. Klein, want een rondje is
                  dertig punten breed; de trede waar je op staat licht op. */}
              <span
                style={{
                  fontFamily: font.ui,
                  fontSize: 6.5 * k,
                  letterSpacing: 0.2 * k,
                  textTransform: "uppercase",
                  lineHeight: 1,
                  color: i === nu ? GOUD[3] : heeft ? colors.faint : "rgba(199,192,218,.5)",
                }}
              >
                {t(`penkort_${p.id}`)}
              </span>
              </span>
            );
          })}
        </div>

        <span style={{ fontFamily: font.ui, fontSize: 9 * k, color: colors.faint, lineHeight: 1.2 }}>
          {volgend === null
            ? t("bordPenKlaar")
            : t("bordPenNog", { n: teGaan.toLocaleString(lang === "en" ? "en-GB" : "nl-NL"), pen: t(`pen_${PENNEN[volgend].id}`) })}
        </span>
      </div>
    </div>
  );
}

// ---- het seizoen -----------------------------------------------------------

function SeizoenKaart({ account, nummer, seconden }: { account: Account | null; nummer: number; seconden: number }) {
  const { t, lang } = useT();
  const k = useK();
  const taal = lang === "en" ? "en-GB" : "nl-NL";
  const divisie = Math.max(0, SCHILD_KLEUREN.indexOf((account?.shield ?? "paars") as never));
  const lvl = account?.level;
  const deel = lvl ? (lvl.xp - lvl.level_start) / Math.max(1, lvl.next_level - lvl.level_start) : 0;

  // De eerstvolgende mijlpaal die je nog niet hebt: een knop-skin of een frame,
  // wat het eerst komt. Dat is de echte "volgende beloning" van dit account.
  const volgende = useMemo(() => {
    if (!account) return null;
    // `name` IS de sleutel (buzzReward_gold, frameReward_violet), dus er hoeft
    // geen voorvoegsel meer voor.
    const alles = [
      ...account.buzzer_rewards.map((b) => ({ level: b.level, naam: t(b.name), art: `/buzzers/${b.skin}.webp` })),
      ...account.frame_rewards.map((f) => ({ level: f.level, naam: t(f.name), art: `/frames/${f.frame}.webp` })),
    ]
      .filter((r) => r.level > account.level.level)
      .sort((a, b) => a.level - b.level);
    return alles[0] ?? null;
  }, [account, t]);

  return (
    <Kaart>
      <KaartKop kop={t("bordSeizoen", { n: nummer })} sub={t("bordNog", { t: resterend(seconden, t("kortUur")) })} />

      <div style={{ display: "flex", alignItems: "center", gap: 11 * k }}>
        <Schild divisie={divisie} maat={46 * k} cijfer={lvl?.level ?? 1} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 * k }}>
          <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 13 * k, letterSpacing: 0.6 * k, textTransform: "uppercase", color: "#FFF3D0" }}>
            {divisieNaam(divisie)}
          </span>
          <Balk deel={deel} hoog={6} />
          <span style={{ fontFamily: font.ui, fontSize: 9.5 * k, color: colors.faint, fontVariantNumeric: "tabular-nums" }}>
            {(lvl?.xp ?? 0).toLocaleString(taal)} / {(lvl?.next_level ?? 0).toLocaleString(taal)} XP
          </span>
        </div>
      </div>

      {volgende && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9 * k,
            padding: `${7 * k}px ${9 * k}px`,
            borderRadius: 11 * k,
            background: "rgba(0,0,0,.28)",
            border: "1px solid rgba(255,214,110,.16)",
          }}
        >
          <img src={volgende.art} alt="" aria-hidden style={{ height: 30 * k, width: "auto", display: "block" }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 * k }}>
            <span style={{ fontFamily: font.ui, fontSize: 8.5 * k, letterSpacing: 0.6 * k, textTransform: "uppercase", color: colors.faint }}>
              {t("bordVolgende")}
            </span>
            <span style={{ fontFamily: font.ui, fontSize: 11.5 * k, fontWeight: 700, color: GOUD[3], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {volgende.naam}
            </span>
          </div>
          <span style={{ fontFamily: font.ui, fontSize: 10 * k, fontWeight: 700, color: colors.sub, whiteSpace: "nowrap" }}>
            {t("bordLevelN", { n: volgende.level })}
          </span>
        </div>
      )}
    </Kaart>
  );
}

// ---- het bord --------------------------------------------------------------

type Laag = "dag" | "week" | "prestaties" | "seizoen";

interface Blok {
  periode: string;
  nummer?: number;
  seconds_left: number;
  missions: Missie[];
  kist?: { soort: string; coins: number; gehaald: boolean };
}
interface Alles {
  authed: boolean;
  dag: Blok;
  week: Blok;
  seizoen: Blok;
}

const TABS: { key: Laag; label: string }[] = [
  { key: "dag", label: "missiesDag" },
  { key: "week", label: "missiesWeek" },
  { key: "prestaties", label: "missiesPrestaties" },
  { key: "seizoen", label: "missiesSeizoen" },
];

/** Resterende tijd als grove eenheid: op een seizoensmissie zegt een aftelling
 *  op de seconde niets, "nog 12 dagen" zegt alles. */
function resterend(s: number, uur: string): string {
  if (s >= 172800) return `${Math.floor(s / 86400)}d`;
  if (s >= 7200) return `${Math.floor(s / 3600)}${uur}`;
  return `${Math.max(1, Math.floor(s / 60))}m`;
}

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

export function MissieBord({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { t } = useT();
  const [laag, setLaag] = useState<Laag>("dag");
  const [alles, setAlles] = useState<Alles | null>(null);
  const [breedte, setBreedte] = useState(0);
  const [doos, setDoos] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!doos) return;
    const meet = () => setBreedte(doos.clientWidth);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(doos);
    return () => ro.disconnect();
  }, [doos]);

  const haal = useCallback(() => {
    fetch("/api/missions/all", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAlles(d); })
      .catch(() => {});
  }, []);
  useEffect(haal, [haal]);

  const claim = useCallback((key: string) => {
    fetch("/api/missions/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ soort: laag, key }),
    })
      .then((r) => r.json())
      .then((d) => { if (d?.ok) sound.uiTap(); haal(); })
      .catch(() => haal());
  }, [laag, haal]);

  // De binnenmaat van het paneel; alles binnen het bord rekent daarmee.
  const binnen = breedte * (1 - 2 * (PANEEL_L + 0.017));
  const k = Math.max(0.82, Math.min(1, binnen / 334));
  const gast = alles ? !alles.authed : false;

  const dag = alles?.dag;
  const dagAf = dag ? dag.missions.filter((m) => m.done).length : 0;
  const open = dag ? dag.missions.length - dagAf : 0;
  const weekTeHalen = alles ? alles.week.missions.filter((m) => m.done && !m.claimed).length : 0;
  const seizoenTeHalen = alles ? alles.seizoen.missions.filter((m) => m.done && !m.claimed).length : 0;
  const badges = { dag: open, week: weekTeHalen, prestaties: 0, seizoen: seizoenTeHalen } as Record<Laag, number>;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 96,
        background: "rgba(6,3,18,.84)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        // EEN FLEXKOLOM en geen raster met placeItems: center. In een
        // gecentreerd rasterhokje is de hoogte onbepaald, dus `height: 100%` op
        // het bord viel terug op de inhoud en liep het bord onderaan het scherm
        // uit beeld. In een flexkolom met een vaste hoogte klopt die honderd
        // procent wel.
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(env(safe-area-inset-top, 0px) + 8px) 6px calc(env(safe-area-inset-bottom, 0px) + 8px)",
      }}
    >
      <SchaalCtx.Provider value={k}>
        <div
          ref={setDoos}
          role="dialog"
          aria-label={t("missiesTitel")}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 440,
            height: "100%",
            minHeight: 0,
            // Nooit hoger dan het bord bij zijn eigen verhouding nodig heeft
            // maal twee: op een tablet zou het anders een poster worden.
            maxHeight: `calc(100vw / ${VERH} * 1.35)`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* KOPSTUK: embleem, opschrift, kruis en de vier vakjes. */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img
              src="/ui/missies/bord-boven.webp?v=1"
              alt=""
              aria-hidden
              style={{ width: "100%", height: "auto", display: "block" }}
            />

            {/* MISSIES staat tussen de bovenrand van de lijst en de vakjes. Dat
                is een smalle strook, dus de tekst rekent met de plaathoogte en
                niet met een vaste maat. */}
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: pct(0.052 / SNEE_BOVEN),
                height: pct(0.05 / SNEE_BOVEN),
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  fontFamily: font.wide,
                  fontWeight: 700,
                  fontSize: breedte * 0.066,
                  lineHeight: 1,
                  letterSpacing: breedte * 0.006,
                  marginRight: -breedte * 0.006,
                  textTransform: "uppercase",
                  backgroundImage: `linear-gradient(180deg, #FFF8E2 0%, ${GOUD[3]} 38%, ${GOUD[2]} 62%, #B9761A 100%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  // Een klein glanslichtje mag met background-clip mee; een
                  // gloed niet, die zou over het verloop heen komen te liggen.
                  textShadow: "0 1px 0 rgba(255,255,255,.25)",
                }}
              >
                {t("missiesTitel")}
              </span>
            </span>

            <button
              onClick={() => { sound.uiTap(); onClose(); }}
              aria-label={t("back")}
              className="pressable"
              style={{
                position: "absolute",
                right: "2.2%",
                top: pct(0.055 / SNEE_BOVEN),
                zIndex: 4,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
              }}
            >
              <CloseIcon size={Math.max(20, breedte * 0.068)} />
            </button>

            {/* De vier vakjes zitten in de plaat; hier komt alleen wat erin
                staat en de gouden rand van het actieve vakje bovenop. */}
            {TABS.map((tab, i) => {
              const actief = laag === tab.key;
              const [l, r] = TAB_X[i];
              const hoogte = (TAB_B - TAB_T) / SNEE_BOVEN;
              const snee = breedte * 0.014;
              return (
                <button
                  key={tab.key}
                  onClick={() => { sound.uiTap(); setLaag(tab.key); }}
                  aria-pressed={actief}
                  className="pressable"
                  style={{
                    position: "absolute",
                    left: pct(l),
                    width: pct(r - l),
                    top: pct(TAB_T / SNEE_BOVEN),
                    height: pct(hoogte),
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                    border: "none",
                    background: actief
                      ? "linear-gradient(180deg, rgba(255,214,110,.22), rgba(120,52,10,.18))"
                      : "transparent",
                    clipPath: `polygon(${snee}px 0, calc(100% - ${snee}px) 0, 100% ${snee}px, 100% calc(100% - ${snee}px), calc(100% - ${snee}px) 100%, ${snee}px 100%, 0 calc(100% - ${snee}px), 0 ${snee}px)`,
                    boxShadow: actief ? `0 0 ${breedte * 0.03}px ${withAlpha(colors.gold, 0.45)}` : "none",
                    cursor: "pointer",
                  }}
                >
                  {actief && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        clipPath: `polygon(${snee}px 0, calc(100% - ${snee}px) 0, 100% ${snee}px, 100% calc(100% - ${snee}px), calc(100% - ${snee}px) 100%, ${snee}px 100%, 0 calc(100% - ${snee}px), 0 ${snee}px)`,
                        padding: Math.max(1.4, breedte * 0.0045),
                        background: `linear-gradient(180deg, #FFF3C8, ${GOUD[2]} 45%, #A5670F)`,
                        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                        WebkitMaskComposite: "xor",
                        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                        maskComposite: "exclude",
                      }}
                    />
                  )}
                  <span
                    style={{
                      position: "relative",
                      fontFamily: font.wide,
                      fontWeight: 700,
                      fontSize: Math.max(8.5, breedte * 0.0305),
                      lineHeight: 1,
                      letterSpacing: breedte * 0.0016,
                      textTransform: "uppercase",
                      color: actief ? "#FFF3D0" : "rgba(214,198,242,.72)",
                      textShadow: actief ? `0 0 ${breedte * 0.012}px ${withAlpha(colors.gold, 0.6)}` : "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t(tab.label)}
                  </span>
                </button>
              );
            })}

            {/* DE TELLERTJES STAAN BUITEN DE VAKJES, en niet erin. Een vakje is
                een achthoek en dus geknipt met clip-path, en clip-path knipt
                ALLES wat erin zit: een bolletje in de hoek verloor daardoor
                precies het stuk dat buiten de achthoek stak. Hier hangen ze aan
                dezelfde doos als de vakjes zelf, op de rechterbovenhoek van hun
                vakje, zodat ze heel blijven.

                Niet precies op de hoek maar een stuk naar binnen (0,075 van
                de plaat): op de hoek zelf botst het laatste bolletje tegen het
                kruis rechtsboven, gemeten zes pixels overlap. Nu ligt elk
                bolletje op de bovenrand van zijn eigen vakje, ruim binnen de
                lijst. */}
            {TABS.map((tab, i) => {
              const n = badges[tab.key];
              if (!n) return null;
              const maat = Math.max(14, breedte * 0.046);
              return (
                <span
                  key={`teller-${tab.key}`}
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: pct(TAB_X[i][1] - 0.075),
                    top: pct(TAB_T / SNEE_BOVEN),
                    transform: "translate(-50%, -50%)",
                    zIndex: 3,
                    minWidth: maat,
                    height: maat,
                    padding: `0 ${maat * 0.2}px`,
                    boxSizing: "border-box",
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(180deg, #FF6B5A, #C41F12)",
                    border: `1px solid rgba(255,190,180,.65)`,
                    boxShadow: "0 2px 6px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.35)",
                    color: "#FFF",
                    fontFamily: font.ui,
                    fontSize: maat * 0.62,
                    fontWeight: 800,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                    // Het bolletje meldt iets, het vangt geen tik: die hoort bij
                    // het vakje eronder.
                    pointerEvents: "none",
                  }}
                >
                  {n > 99 ? "99+" : n}
                </span>
              );
            })}
          </div>

          {/* MIDDENSTUK: het uitgerekte deel met de inhoud erin. */}
          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              backgroundImage: "url(/ui/missies/bord-midden.webp?v=1)",
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              display: "flex",
              flexDirection: "column",
              padding: `0 ${breedte * (PANEEL_L + 0.017)}px`,
              gap: 8 * k,
            }}
          >
            <div
              className="zachtscroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8 * k,
                paddingTop: 2 * k,
                paddingBottom: 4 * k,
              }}
            >
              {gast ? (
                <Kaart>
                  <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5 * k, lineHeight: 1.45, color: colors.sub, textAlign: "center" }}>
                    {t("missiesGast")}
                  </p>
                </Kaart>
              ) : !alles ? null : laag === "prestaties" ? (
                <PrestatieTab account={account} />
              ) : laag === "seizoen" ? (
                <>
                  <SeizoenKaart account={account} nummer={alles.seizoen.nummer ?? 1} seconden={alles.seizoen.seconds_left} />
                  {alles.seizoen.missions.map((m) => <Rij key={m.key} m={m} laag="seizoen" onClaim={claim} />)}
                </>
              ) : laag === "week" ? (
                <>
                  <Kaart>
                    <KaartKop
                      kop={t("bordWeekKop")}
                      sub={t("bordNog", { t: resterend(alles.week.seconds_left, t("kortUur")) })}
                      rechts={
                        <span style={{ fontFamily: font.ui, fontSize: 11 * k, fontWeight: 700, color: GOUD[3], whiteSpace: "nowrap" }}>
                          {alles.week.missions.filter((m) => m.claimed).length}/{alles.week.missions.length}
                        </span>
                      }
                    />
                    <Balk deel={alles.week.missions.filter((m) => m.claimed).length / Math.max(1, alles.week.missions.length)} />
                  </Kaart>
                  {alles.week.missions.map((m) => <Rij key={m.key} m={m} laag="week" onClaim={claim} />)}
                </>
              ) : (
                <>
                  <Kaart>
                    <KaartKop
                      kop={t("bordDagKop")}
                      sub={t("bordVernieuwt", { t: resterend(alles.dag.seconds_left, t("kortUur")) })}
                      rechts={<KistPrijs kist={alles.dag.kist} klaar={dagAf === alles.dag.missions.length} />}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 * k }}>
                      <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 15 * k, lineHeight: 1, color: "#FFF3D0", fontVariantNumeric: "tabular-nums" }}>
                        {dagAf}/{alles.dag.missions.length}
                      </span>
                      <Balk deel={dagAf / Math.max(1, alles.dag.missions.length)} hoog={6} />
                    </div>
                  </Kaart>
                  {alles.dag.missions.map((m) => <Rij key={m.key} m={m} laag="dag" onClaim={claim} />)}
                  <ReeksKaart reeks={account?.stats.streak ?? 0} />
                </>
              )}
            </div>

            {/* De pen staat VAST onderaan, zoals op de mockup: hij hoort niet bij
                een tabblad maar bij jou, en hij is op elk tabblad je volgende
                doel. */}
            <div style={{ flexShrink: 0, paddingBottom: 4 * k }}>
              <PenBalk account={account} />
            </div>
          </div>

          <img
            src="/ui/missies/bord-onder.webp?v=1"
            alt=""
            aria-hidden
            style={{ width: "100%", height: "auto", display: "block", flexShrink: 0 }}
          />
        </div>
      </SchaalCtx.Provider>
    </div>
  );
}

/** De kist voor drie op drie, rechts in de kop van de dagkaart. */
function KistPrijs({ kist, klaar }: { kist?: { soort: string; coins: number; gehaald: boolean }; klaar: boolean }) {
  const { t } = useT();
  const k = useK();
  if (!kist) return null;
  const uit = kist.gehaald || klaar;
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 * k, flexShrink: 0 }}>
      <span style={{ fontFamily: font.ui, fontSize: 8.5 * k, letterSpacing: 0.5 * k, textTransform: "uppercase", color: colors.faint }}>
        {t("bordBeloning")}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 * k }}>
        <img
          src={`/ui/${kist.soort}${uit ? "-open" : ""}.webp`}
          alt=""
          aria-hidden
          style={{ height: 30 * k, width: "auto", display: "block", filter: uit ? "none" : "saturate(.92)" }}
        />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 * k, fontFamily: font.ui, fontSize: 11 * k, fontWeight: 800, color: GOUD[3] }}>
          <img src="/coins-stack.webp" alt="" aria-hidden style={{ height: 12 * k, width: "auto", display: "block" }} />
          {kist.coins}
        </span>
      </span>
    </span>
  );
}

/** Het derde tabblad: de medaillekast. Dezelfde penningen als op je profiel,
 *  want het is dezelfde verzameling; hier staan ze alleen compleet.
 *
 *  De grenzen komen van de SERVER (/api/prestaties): die kent ze toe, dus die
 *  hoort ook te zeggen waar de balk naartoe loopt. */
function PrestatieTab({ account }: { account: Account | null }) {
  const { t } = useT();
  const k = useK();
  const kast = usePrestaties(true);
  const volgorde = kast?.volgorde?.length ? kast.volgorde : VOLGORDE;
  const behaald = new Set(kast?.behaald ?? (account?.badges ?? []).map((b) => b.badge));
  const lijst = [...volgorde].sort((a, b) => Number(behaald.has(b)) - Number(behaald.has(a)));
  const deel = volgorde.length ? behaald.size / volgorde.length : 0;
  return (
    <>
      <Kaart>
        <KaartKop
          kop={t("badgesTitle")}
          sub={t("badgesOf", { n: behaald.size, m: volgorde.length })}
          rechts={
            <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 17 * k, lineHeight: 1, color: GOUD[3] }}>
              {Math.round(deel * 100)}%
            </span>
          }
        />
        <Balk deel={deel} />
      </Kaart>
      <Kaart style={{ gap: 12 * k }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: `${14 * k}px ${2 * k}px`, justifyItems: "center" }}>
          {lijst.map((sleutel) => {
            const Teken = teken(sleutel);
            const { nu, doel } = voortgang(kast, sleutel);
            return (
              <Prestatie
                key={sleutel}
                icoon={<Teken size={22} />}
                art={badgeArt(sleutel)}
                naam={t(`badgeshort_${sleutel}`)}
                behaald={behaald.has(sleutel)}
                nu={nu}
                doel={doel}
              />
            );
          })}
        </div>
      </Kaart>
    </>
  );
}
