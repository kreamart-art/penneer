// Ontdekken — de verzamelmodus. Hub, categorie en letter.
//
// Drie schermen in één bestand met een eigen stapel, want de app heeft geen
// router: navigatie zijn state-vlaggen in App.tsx en dit sluit daarop aan. De
// stapel is bewust een array zodat "terug" altijd één stap terug is, ook als je
// van de hub via een categorie in een letter zit.
//
// Voortgang komt ALTIJD van de server en gaat nooit in localStorage. Een
// verzameling die op twee toestellen anders staat is erger dan een verzameling
// die een halve seconde later verschijnt.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Apple, ArrowLeft, Brain, Briefcase, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Flame, Globe, Layers, Lightbulb, PawPrint } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../components/Button";
import { LetterTegel } from "../components/LetterTegel";
import { GoudKader } from "../components/GoudKader";
import { OntdekQuiz } from "./OntdekQuiz";
import { useT } from "../i18n/i18n";
import { colors, font, panelStyle, withAlpha } from "../theme/tokens";
import { sound } from "../sound/sound";

// ---- types (spiegelen de payload van /api/discover) -------------------------

interface FactRow { key: string; label: string; quiz: boolean }
interface CatRow { category: string; label: string; total: number; discovered: number; percent: number }
interface Overview {
  categories: CatRow[];
  fact_schema: Record<string, FactRow[]>;
  daily_letter: string | null;
  daily_gespeeld: boolean;
  daily_speelbaar: boolean;
  streak_days: number;
  review_due: number;
  recent: Kaart[];
  guest: boolean;
}
interface LetterRow { letter: string; total: number; discovered: number }
interface CategoryView {
  category: string; label: string; total: number; discovered: number; percent: number;
  letters: LetterRow[]; guest: boolean;
}
export interface Kaart {
  id: number;
  card_number: number;
  discovered: boolean;
  word?: string;
  slug?: string;
  facts?: Record<string, string>;
  image_path?: string | null;
  iso?: string | null;
  category?: string;
  letter?: string;
  discovered_at?: number | null;
  favorite?: boolean;
}
interface LetterView {
  category: string; label: string; letter: string;
  total: number; discovered: number; cards: Kaart[]; fact_schema: FactRow[]; guest: boolean;
}

// Iconen zijn lijntekeningen, geen emoji: emoji ziet er op elk toestel anders
// uit en hoort niet bij de huisstijl.
const CAT_ICON: Record<string, LucideIcon> = {
  land: Globe, stad: Building2, vrucht: Apple, dier: PawPrint, beroep: Briefcase,
};

// ---- fetch ------------------------------------------------------------------

async function haal<T>(pad: string): Promise<T> {
  const token = localStorage.getItem("penneer.accountToken") || "";
  const res = await fetch(pad, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

// ---- kleine bouwstenen ------------------------------------------------------

function Kop({ titel, onBack }: { titel: string; onBack: () => void }) {
  const { t } = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button
        onClick={() => { sound.uiTap(); onBack(); }}
        aria-label={t("back")}
        style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}
      >
        <ArrowLeft size={20} />
      </button>
      <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 800, fontSize: 21, color: colors.ink }}>
        {titel}
      </h1>
    </div>
  );
}

/** Ring met het percentage erin. Puur SVG, geen extra afhankelijkheid. */
function Ring({ percent, size = 54 }: { percent: number; size?: number }) {
  const r = (size - 7) / 2;
  const omtrek = 2 * Math.PI * r;
  const vol = percent >= 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth={5} />
      {/* Bij 0% helemaal geen boog: met ronde uiteinden geeft lengte 0 toch
          een puntje, en dat leest als "er staat al iets". */}
      {percent > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colors.gold}
          strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${(omtrek * percent) / 100} ${omtrek}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fontFamily={font.display} fontWeight={800} fontSize={size * 0.28}
        fill={vol ? colors.gold : colors.ink}
      >
        {percent}%
      </text>
    </svg>
  );
}

function Paneel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="panel-neon" style={{ ...panelStyle, padding: 16, ...style }}>
      {children}
    </div>
  );
}

// ---- hub --------------------------------------------------------------------
// De opbouw volgt de mockup: de dagletter in een eigen sectie, dan je
// voortgang per categorie, de laatste vondsten, het herhaalblok en onderaan de
// weg naar de hele verzameling.
//
// De sectie is art (hub-sectie.webp, 894x407) met de medaille links, een
// donkere plaat rechtsboven voor de reeks en een gouden knop rechtsonder.
// Opgemeten in de bron:
//   ring      midden (28.4%, 51.7%)  buitendiameter 30.7% van de breedte
//   binnenvlak van de ring: diameter 229px, dus 25.6% van de breedte
//   plaat     x 52.8..94.7%   y  9.6..40.5%
//   knop      x 48.9..95.2%   y 67.1..93.4%
//   het play-driehoekje zit AL in de knop, van 56.6% tot 60.7% breed
const HUB_RATIO = 894 / 407;
// De ondersectie (onder-sectie.webp, 887x143) is een paarse balk met een gouden
// kader en een chevron die AL in de art zit, vanaf 92% van de breedte. De
// rechtermarge van het opschrift houdt die vrij.
const ONDER_RATIO = 887 / 143;
const HUB = {
  // Een VIERKANT vak van 234px midden op de ring (28.4%, 51.7%). De letter-art
  // is 256x256 met de glyph in de middelste 59%, dus bij objectFit contain
  // wordt de glyph 137px: ruim zestig procent van de opening van 229px, en
  // breed genoeg dat zelfs een W (92% van zijn vak) nog binnen de ring past.
  letter:  { left: "15.3%", right: "58.5%", top: "23.0%", bottom: "19.5%" },
  // Gecentreerd BOVEN de ring: die begint op 18.1% van de hoogte en zijn
  // midden ligt op 28.4% van de breedte, dus dit vak loopt van 4% tot 52.8%.
  bovenop: { left: "4.0%",  right: "47.2%", top: "2.0%",  bottom: "84.0%" },
  plaat:   { left: "52.8%", right: "5.3%",  top: "9.6%",  bottom: "59.5%" },
  uitleg:  { left: "50.0%", right: "3.5%", top: "42.0%", bottom: "34.0%" },
  knop:    { left: "48.9%", right: "4.8%",  top: "67.1%", bottom: "6.6%" },
} as const;

/** Het rijtje vinkjes onder de reeks, zoals in het ontwerp. */
function Reeks({ dagen }: { dagen: number }) {
  const punten = Math.max(5, Math.min(dagen, 7));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4%", width: "100%" }}>
      {Array.from({ length: punten }, (_, i) => {
        const aan = i < dagen;
        return (
          <span
            key={i}
            style={{
              flex: "0 0 auto", width: "11%", aspectRatio: "1 / 1", borderRadius: "50%",
              display: "grid", placeItems: "center",
              border: `1.5px solid ${aan ? colors.gold : withAlpha(colors.gold, 0.3)}`,
              background: aan ? withAlpha(colors.gold, 0.16) : "transparent",
              boxShadow: aan ? `0 0 8px ${withAlpha(colors.gold, 0.45)}` : "none",
            }}
          >
            {aan && <Check size={9} color={colors.gold} strokeWidth={3.5} />}
          </span>
        );
      })}
    </div>
  );
}

function HubSectie({ letter, streak, onSpeel }: {
  letter: string | null; streak: number; onSpeel: () => void;
}) {
  const { t } = useT();
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${HUB_RATIO}` }}>
      {/* Schaduw als tweede kopie, zoals overal in de app: een box-shadow zou
          een rechthoek werpen achter een vorm met afgeschuinde hoeken. */}
      <img
        src="/ontdek/hub-sectie.webp" alt="" aria-hidden draggable={false}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
          filter: "brightness(0) blur(9px)", opacity: 0.5, transform: "translateY(6px)",
          pointerEvents: "none",
        }}
      />
      {/* Dezelfde warme gloed als onder de kaarten: de VORM van de sectie in
          goud, vervaagd, eronder. De art zelf vervagen zou de medaille en de
          paarse hemel uitsmeren; als masker over een verloop gloeit precies de
          omtrek. */}
      <span
        aria-hidden
        style={{
          // In PIXELS naar buiten en niet in procenten: de sectie is ruim twee
          // keer zo breed als hoog, dus een halo van 8% zou boven en onder maar
          // half zo dik zijn als links en rechts. Het masker vult dit hele vak,
          // dus de vorm is overal precies 8px groter dan de art.
          position: "absolute", inset: -8,
          background: `radial-gradient(55% 60% at 50% 55%, ${colors.gold}, ${colors.orange} 65%, ${colors.orange} 100%)`,
          WebkitMaskImage: "url(/ontdek/hub-sectie.webp)", maskImage: "url(/ontdek/hub-sectie.webp)",
          WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
          WebkitMaskPosition: "center", maskPosition: "center",
          WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          filter: "blur(10px)", opacity: 0.5, pointerEvents: "none",
        }}
      />
      <img src="/ontdek/hub-sectie.webp" alt="" style={{ position: "relative", width: "100%", height: "100%", display: "block" }} />

      <div style={{ position: "absolute", ...HUB.bovenop, display: "grid", placeItems: "center" }}>
        <span style={{ fontFamily: font.wide, fontSize: "clamp(8px, 2.9vw, 15px)", letterSpacing: ".08em", color: colors.gold, whiteSpace: "nowrap" }}>
          {t("ontdekkenLetterVanVandaag")}
        </span>
      </div>

      {letter && (
        <div style={{ position: "absolute", ...HUB.letter }}>
          <img
            src={`/letters/${letter}.webp`} alt={letter}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        </div>
      )}

      {/* De donkere plaat: de reeks met zijn vinkjes. */}
      <div style={{ position: "absolute", ...HUB.plaat, display: "flex", flexDirection: "column", justifyContent: "center", gap: "6%", padding: "0 5%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4%" }}>
          <Flame size={15} color={colors.orange} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(12px, 4vw, 22px)", lineHeight: 1, color: colors.ink }}>
            {streak}
          </span>
          <span style={{ fontFamily: font.wide, fontSize: "clamp(7px, 2.4vw, 13px)", letterSpacing: ".06em", color: colors.sub, whiteSpace: "nowrap" }}>
            {t("ontdekkenDagenOpRij", { n: "" }).replace(/^\s*/, "")}
          </span>
        </div>
        <Reeks dagen={streak} />
      </div>

      <div style={{ position: "absolute", ...HUB.uitleg, display: "grid", placeItems: "center" }}>
        <span style={{ fontFamily: font.ui, fontSize: "clamp(6.5px, 1.95vw, 11px)", lineHeight: 1.3, color: colors.sub, textAlign: "center", whiteSpace: "pre-line" }}>
          {t("ontdekkenHubUitleg")}
        </span>
      </div>

      {/* De gouden knop zit in de art; hier ligt alleen het opschrift erop. */}
      {/* De hele gouden knop is aan te tikken. Het play-driehoekje zit in de
          art, dus hier staat alleen het opschrift; de linkermarge houdt de
          ruimte vrij waar dat driehoekje staat. */}
      <button
        onClick={() => { sound.uiTap(); onSpeel(); }}
        className="pressable"
        style={{
          position: "absolute", ...HUB.knop,
          // Let op: procenten in padding rekenen tegen de SECTIE, niet tegen de
          // knop, want dat is het blok waarin deze knop absoluut staat. Het
          // driehoekje loopt tot 60.7% van de sectie en de knop begint op
          // 48.9%, dus 11.9% is precies tot waar het driehoekje komt.
          background: "transparent", border: "none", padding: "0 2% 0 11.9%", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(11px, 4vw, 24px)", color: "#3B2300", whiteSpace: "nowrap" }}>
          {t("ontdekkenSpeelDeLetter")}
        </span>
      </button>
    </div>
  );
}

/** Een kop met een ruitje links en rechts, zoals de secties in het ontwerp. */
function SectieKop({ children, onder }: {
  children: React.ReactNode;
  /** Wat er ONDER de kop komt, gecentreerd. Naast de kop zou het de titel uit
   *  het midden duwen, en die hoort midden boven wat eronder staat. */
  onder?: React.ReactNode;
}) {
  return (
    <div style={{ margin: "0 0 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${withAlpha(colors.gold, 0.35)})` }} />
        <span style={{ fontFamily: font.wide, fontSize: 13, letterSpacing: ".1em", color: colors.sub, whiteSpace: "nowrap" }}>
          {children}
        </span>
        <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${withAlpha(colors.gold, 0.35)}, transparent)` }} />
      </div>
      {onder && <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>{onder}</div>}
    </div>
  );
}

function Hub({ data, onCategorie, onOefenen, onQuiz, onVerzameling }: {
  data: Overview; onCategorie: (c: string) => void; onOefenen: (letter: string | null) => void;
  onQuiz: (mode: "letter" | "review", letter: string | null, category: string) => void;
  onVerzameling: () => void;
}) {
  const { t } = useT();
  // De quiz vraagt naar FEITEN, dus hij draait op de categorie waar je de
  // meeste kaarten van hebt. Heb je nog niets, dan valt er niets te vragen.
  const sterkste = [...data.categories].sort((a, b) => b.discovered - a.discovered)[0];
  const label = Object.fromEntries(data.categories.map((c) => [c.category, c.label]));

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <HubSectie letter={data.daily_letter} streak={data.streak_days} onSpeel={() => onOefenen(data.daily_letter)} />
      </div>

      <GoudKader hoek={13} kleur="violet" dik={1} gloed vulling binnenlijn padding={12} style={{ marginBottom: 16 }}>
        <SectieKop>{t("ontdekkenJouwVoortgang")}</SectieKop>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
          {data.categories.map((c) => {
            const Ico = CAT_ICON[c.category];
            const actief = c.category === sterkste?.category && c.discovered > 0;
            return (
              <button
                key={c.category}
                onClick={() => { sound.uiTap(); onCategorie(c.category); }}
                className="pressable"
                style={{ display: "block", padding: 0, background: "transparent", border: "none", cursor: "pointer" }}
              >
                {/* Dezelfde achthoek als de sectie eromheen. De schuine hoek is
                    kleiner, want een tegel is een vijfde van de breedte: op
                    dezelfde 13px zou de afsnijding het halve vlak zijn. De
                    afronding van de punten en de binnenlijn blijven gelijk.
                    Goud markeert de categorie waar je het verst in bent. */}
                <GoudKader
                  hoek={8} kleur={actief ? "goud" : "violet"} dik={1} vulling binnenlijn
                  binnenSterkte={0.4} padding="8px 2px"
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span aria-hidden style={{ color: actief ? colors.gold : colors.violet, display: "flex" }}>
                      {Ico ? <Ico size={16} /> : null}
                    </span>
                    <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 600, color: colors.ink }}>{c.label}</span>
                    <Ring percent={c.percent} size={38} />
                    <span style={{ fontFamily: font.ui, fontSize: 9, color: colors.faint, whiteSpace: "nowrap" }}>
                      {c.discovered} / {c.total}
                    </span>
                  </div>
                </GoudKader>
              </button>
            );
          })}
        </div>
      </GoudKader>

      {/* Geen kader hier: de kaarten hebben hun eigen gloed en staan daarmee al
          los van de achtergrond. Een sectie eromheen zou een tweede rand om
          vier vormen zetten die zelf al een rand hebben. */}
      <div style={{ marginBottom: 16 }}>
        <SectieKop
          onder={
            <button
              onClick={() => { sound.uiTap(); onVerzameling(); }}
              className="pressable"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
                padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                background: "transparent", border: `1px solid ${withAlpha(colors.violet, 0.5)}`,
                fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, color: colors.sub,
              }}
            >
              {t("ontdekkenBekijkAlle")}
              <ChevronRight size={12} />
            </button>
          }
        >
          {t("ontdekkenRecent")}
        </SectieKop>
        {data.recent.length === 0 ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12, color: colors.sub, textAlign: "center", padding: "14px 0" }}>
            {t("ontdekkenNogGeenKaarten")}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {data.recent.map((k) => (
              <button
                key={k.id}
                onClick={() => { sound.uiTap(); if (k.category) onCategorie(k.category); }}
                className="pressable"
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
              >
                <KaartTegel kaart={k} nu={Date.now() / 1000} chip={label[k.category || ""]} />
              </button>
            ))}
          </div>
        )}
      </div>

      <GoudKader hoek={13} kleur="violet" dik={1} gloed vulling binnenlijn padding={12} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Brain size={30} color={colors.violet} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.wide, fontSize: 14, letterSpacing: ".08em", color: colors.sub }}>
              {t("ontdekkenHerhalen")}
            </div>
            <div style={{ fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.3, color: colors.sub, marginTop: 2 }}>
              {data.review_due > 0
                ? `${t("ontdekkenHerhalenKlaar", { n: data.review_due })} ${t("ontdekkenHerhalenUitleg")}`
                : t("ontdekkenHerhalenLeeg")}
            </div>
          </div>
          <div style={{ flexShrink: 0, width: 122 }} className="ontdek-kleineknop">
            <Button
              variant="primary" full compact
              disabled={data.review_due === 0 || !sterkste?.discovered}
              onClick={() => onQuiz("review", null, sterkste?.category || "land")}
            >
              {t("ontdekkenStartHerhaling")}
            </Button>
          </div>
        </div>
      </GoudKader>

      <button
        onClick={() => { sound.uiTap(); onVerzameling(); }}
        className="pressable"
        style={{
          position: "relative", width: "100%", aspectRatio: `${ONDER_RATIO}`,
          background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "block",
        }}
      >
        {/* Schaduw als tweede kopie, zoals overal: een box-shadow werpt een
            rechthoek achter een vorm met afgeschuinde hoeken. */}
        <img
          src="/ontdek/onder-sectie.webp" alt="" aria-hidden draggable={false}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
            filter: "brightness(0) blur(7px)", opacity: 0.5, transform: "translateY(5px)",
            pointerEvents: "none",
          }}
        />
        {/* Dezelfde warme gloed als onder de bovensectie, in pixels naar buiten
            zodat hij op een balk die zes keer zo breed is als hoog boven en
            onder net zo dik is als links en rechts. */}
        <span
          aria-hidden
          style={{
            position: "absolute", inset: -7,
            background: `radial-gradient(55% 60% at 50% 55%, ${colors.gold}, ${colors.orange} 65%, ${colors.orange} 100%)`,
            WebkitMaskImage: "url(/ontdek/onder-sectie.webp)", maskImage: "url(/ontdek/onder-sectie.webp)",
            WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
            WebkitMaskPosition: "center", maskPosition: "center",
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
            filter: "blur(9px)", opacity: 0.5, pointerEvents: "none",
          }}
        />
        <img src="/ontdek/onder-sectie.webp" alt="" style={{ position: "relative", width: "100%", height: "100%", display: "block" }} />

        {/* De chevron zit in de art; hier ligt alleen het opschrift erop. De
            rechtermarge van 11% houdt die chevron vrij. */}
        <span
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: "2.5%",
            padding: "0 11% 0 4%", textAlign: "left",
          }}
        >
          <Layers size={24} color={colors.gold} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: font.display, fontWeight: 700, fontSize: "clamp(11px, 3.9vw, 20px)", lineHeight: 1.15, color: colors.gold }}>
              {t("ontdekkenNaarVerzameling")}
            </span>
            <span style={{ display: "block", fontFamily: font.ui, fontSize: "clamp(8px, 2.9vw, 14px)", lineHeight: 1.2, color: colors.sub, marginTop: 1 }}>
              {t("ontdekkenNaarVerzameling2")}
            </span>
          </span>
        </span>
      </button>
    </>
  );
}

// ---- categorie --------------------------------------------------------------

function Categorie({ data, onLetter }: { data: CategoryView; onLetter: (l: string) => void }) {
  const { t } = useT();
  return (
    <>
      <Paneel style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Ring percent={data.percent} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 18, color: colors.ink }}>
              {data.label}
            </div>
            <div style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub, marginTop: 2 }}>
              {t("ontdekkenKaartenOntdekt", { n: data.discovered, total: data.total })}
            </div>
          </div>
        </div>
      </Paneel>

      {/* Het lettergrid. Zes op een rij past op 393 punten breed zonder dat de
          tegel onder de tikmaat van 44 punten zakt. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {data.letters.map((l, i) => (
          <LetterTegel
            key={l.letter}
            letter={l.letter}
            total={l.total}
            discovered={l.discovered}
            index={i}
            onClick={() => { sound.uiTap(); onLetter(l.letter); }}
          />
        ))}
      </div>
    </>
  );
}

// ---- letter -----------------------------------------------------------------

// ---- letterpagina -----------------------------------------------------------
// De opbouw volgt het ontwerp: een sectie met de gouden letter in de medaille,
// de voortgang op een gouden plaat, een hintregel op de donkere plaat, en
// daaronder het raster met kaarten.
//
// Alle vier de onderdelen zijn art uit Oefenen/oefenen bovensectie.png, in
// stukken gesneden naar /ontdek. Het kader is een border-image, want dat is de
// enige manier om een versierde lijst mee te laten rekken zonder dat de hoeken
// vervormen: de hoeken blijven staan, alleen de rechte stukken worden opgerekt.
const KAART_RATIO = "658 / 1012";

// De sectie is EEN afbeelding: het kader, de ronde medaille links en de twee
// platen rechts zitten er al in. De inhoud gaat er als laag overheen, op de
// plekken die de art zelf aangeeft. Vandaar percentages en geen pixels: het
// hele blok schaalt mee met de schermbreedte en alles blijft op zijn plek.
//
// Opgemeten in de bron (4095x1903):
//   medaille   x 12.5..43.5%   y 11.5..77.0%   (de cirkel is verticaal
//              uitgemiddeld op het rechterblok, zie scripts)
//   plaat 1    x 47.4..93.2%   y 10.0..39.9%   -> titel en telling
//   plaat 2    x 47.4..93.2%   y 58.7..85.1%   -> de voortgangsbalk
const SECTIE_RATIO = 1400 / 415;

// Afgelezen van sectie.webp (1400x415), niet geschat:
//   ring        midden (15.4%, 46.5%)  buitendiameter 17.9%, binnenschijf 14.6%
//   hintpil     x 30.4..71.8%   y 64.6..89.2%
//   kistpaneel  x 73.6..96.1%   y  6.7..92.8%
//   kistplaat   x 78.9..92.1%   y 72.8..85.5%
//
// De vrije ruimte in het midden loopt van 30% tot 72% breed en van 6% tot 62%
// hoog, boven de hintpil. Daar passen de kop, de telling en de balk in, met
// lucht ertussen: alles wat tegen een lijn aan komt te staan leest als een
// fout, ook als het er net binnen valt.
const VLAK = {
  // De letter mag over de binnenschijf heen lopen: netjes erbinnen oogt hij
  // verloren in de ring.
  letter: { left: "7.9%",  right: "77.1%", top: "21.2%", bottom: "28.2%" },
  // De kop zakt naar beneden zodat hij tegen de balk aan staat in plaats
  // van hoog in het lege vlak te zweven.
  kop:    { left: "32.0%", right: "30.0%", top: "14.0%", bottom: "55.0%" },
  balk:   { left: "32.0%", right: "30.0%", top: "45.0%", bottom: "38.0%" },
  // Iets lager dan de bovenlijn van de pil, anders plakt de tekst eraan.
  hint:   { left: "32.5%", right: "30.3%", top: "70.5%", bottom: "12.5%" },
  // Mag een stukje over de kist vallen, dat leest beter dan een opschrift
  // dat tegen de bovenlijn van het paneel geperst staat.
  beloning:  { left: "74.0%", right: "4.0%", top: "17.0%", bottom: "64.0%" },
  // Exact de maten van de plaat, op 3x vergroting van de art afgelezen.
  // Een halve procent ernaast is op deze maat al zichtbaar scheef.
  kistplaat: { left: "78.9%", right: "8.8%", top: "74.2%", bottom: "12.3%" },
} as const;

function Sectie({ letter, discovered, total, percent, compleet }: {
  letter: string; discovered: number; total: number; percent: number; compleet: boolean;
}) {
  const { t } = useT();
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${SECTIE_RATIO}` }}>
      {/* De schaduw als tweede kopie van dezelfde art: een drop-shadow-filter
          rastert Safari apart en dan zie je de doos van de laag over de plaat. */}
      <img
        src="/ontdek/sectie.webp" alt="" aria-hidden draggable={false}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
          filter: "brightness(0) blur(9px)", opacity: 0.55, transform: "translateY(6px)",
          pointerEvents: "none",
        }}
      />
      <img src="/ontdek/sectie.webp" alt="" style={{ position: "relative", width: "100%", height: "100%", display: "block" }} />

      {/* De gouden letter in de ring. In een eigen vak, want een img met eigen
          afmetingen rekt niet mee met left/right/top/bottom. */}
      <div style={{ position: "absolute", ...VLAK.letter }}>
        <img
          src={`/letters/${letter}.webp`} alt={letter}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </div>

      {/* Kop en telling */}
      <div style={{ position: "absolute", ...VLAK.kop, display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden" }}>
        <span style={{ fontFamily: font.wide, fontSize: "clamp(9px, 3.8vw, 26px)", lineHeight: 1, letterSpacing: ".03em", color: colors.ink, whiteSpace: "nowrap" }}>
          {t("ontdekkenLetterKop", { letter })}
        </span>
        <span style={{ fontFamily: font.ui, fontSize: "clamp(6.5px, 2.2vw, 12px)", lineHeight: 1.15, color: colors.sub, marginTop: "3%", whiteSpace: "nowrap" }}>
          {t("ontdekkenKaartenOntdekt", { n: discovered, total })}
        </span>
      </div>

      {/* De voortgangsbalk met het percentage ernaast, zoals in het ontwerp. */}
      <div style={{ position: "absolute", ...VLAK.balk, display: "flex", alignItems: "center", gap: "4%" }}>
        <div style={{ flex: 1, position: "relative", height: "34%", overflow: "hidden", borderRadius: 999, background: "rgba(0,0,0,.5)", border: `1px solid ${withAlpha(colors.gold, 0.3)}` }}>
          <div style={{ position: "absolute", inset: 0, width: `${Math.max(percent, 0)}%`, overflow: "hidden", transition: "width .5s ease" }}>
            <img src="/ontdek/plaat-goud.webp" alt="" style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "auto", maxWidth: "none" }} />
          </div>
        </div>
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(7.5px, 2.6vw, 16px)", lineHeight: 1, color: compleet ? colors.gold : colors.ink, whiteSpace: "nowrap" }}>
          {percent}%
        </span>
      </div>

      {/* De hintregel in de pil die in de art zit. */}
      <div style={{ position: "absolute", ...VLAK.hint, display: "flex", alignItems: "center", gap: "3%", overflow: "hidden" }}>
        <Lightbulb size={11} color={colors.gold} style={{ flexShrink: 0 }} />
        <span style={{ fontFamily: font.ui, fontSize: "clamp(5.5px, 1.85vw, 11px)", lineHeight: 1.2, color: compleet ? colors.gold : colors.sub }}>
          {compleet ? t("ontdekkenLetterCompleet") : t("ontdekkenHint", { letter })}
        </span>
      </div>

      {/* Het kistpaneel: het opschrift erboven, de stand op de plaat eronder.
          De kist zelf zit al in de art. */}
      <div style={{ position: "absolute", ...VLAK.beloning, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
        <span style={{ fontFamily: font.ui, fontSize: "clamp(9px, 3vw, 17px)", fontWeight: 700, lineHeight: 1.05, color: colors.ink, textAlign: "center" }}>
          {t("ontdekkenBeloning")}
        </span>
      </div>
      <div style={{ position: "absolute", ...VLAK.kistplaat, display: "grid", placeItems: "center" }}>
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(6.5px, 2.1vw, 13px)", color: compleet ? colors.gold : colors.ink }}>
          {discovered} / {total}
        </span>
      </div>
    </div>
  );
}

type Sortering = "az" | "nieuw";
type Filter = "alles" | "ontdekt" | "mist";

/** Sorteer- en filterknop: dezelfde vorm als de sectie, maar als pil. Eén
 *  pil met twee of drie standen die je doorloopt, want een uitklapmenu voor
 *  drie waarden is meer tikken zonder meer overzicht. */
function Keuze({ label, onClick, icoon }: { label: string; onClick: () => void; icoon: React.ReactNode }) {
  return (
    <GoudKader hoek={9} dik={0.7} kleur="violet" gloed padding="3px 13px" style={{ display: "inline-block" }}>
      <button
        onClick={() => { sound.uiTap(); onClick(); }}
        className="pressable"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: colors.sub,
        }}
      >
        {label}
        {icoon}
      </button>
    </GoudKader>
  );
}

// Een kaart telt als NIEUW zolang je hem vandaag hebt gevonden. Dat is wat het
// lint in het ontwerp betekent: kijk, deze is er net bij gekomen.
const NIEUW_S = 24 * 60 * 60;

function KaartTegel({ kaart, nu, onOpen, groot, chip }: {
  kaart: Kaart; nu: number; onOpen?: () => void; groot?: boolean;
  /** Het categorielabel dat in het ontwerp op de rand van het paarse vlak
   *  ligt. Alleen de hub gebruikt het: op de letterpagina weet je al in welke
   *  categorie je zit en zou het op elke kaart hetzelfde woord zijn. */
  chip?: string;
}) {
  const { t } = useT();
  const nieuw = kaart.discovered && kaart.discovered_at != null && nu - kaart.discovered_at < NIEUW_S;
  if (!kaart.discovered) {
    // Eigen art voor wat je nog niet hebt: de donkere stad met het paarse
    // zwerk. Niet de achterkant, want die betekent "kaart ligt met de rug
    // omhoog", en niet gedempt, want dit hoort er als volwaardige tegel te
    // staan die je wilt omdraaien.
    return (
      // Niet aan te tikken: er valt niets te zien op een kaart die je nog niet
      // hebt, en een overlay die alleen hetzelfde vraagteken groot toont voelt
      // als een deur die op niets uitkomt.
      <div style={{ position: "relative" }}>
        <img
          src="/static/cards/niet-gehaald.webp" alt="" aria-hidden draggable={false} loading="lazy"
          style={{
            position: "absolute", inset: 0, width: "100%", aspectRatio: KAART_RATIO,
            display: "block", filter: "brightness(0) blur(5px)", opacity: 0.5,
            transform: "translateY(4px)", pointerEvents: "none",
          }}
        />
        <img
          src="/static/cards/niet-gehaald.webp"
          alt={t("ontdekkenNogNietOntdekt")}
          loading="lazy"
          style={{ position: "relative", width: "100%", aspectRatio: KAART_RATIO, display: "block" }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute", left: 0, right: 0, top: "30%", textAlign: "center",
            fontFamily: font.display, fontWeight: 800, fontSize: groot ? 78 : "clamp(34px, 11vw, 56px)",
            color: colors.gold, textShadow: `0 0 18px ${withAlpha(colors.gold, 0.55)}`,
          }}
        >
          ?
        </span>
        <span
          style={{
            position: "absolute", left: "8%", right: "8%", bottom: "9%",
            textAlign: "center", fontFamily: font.display,
            fontSize: groot ? 17 : "clamp(9px, 3vw, 13px)",
            fontWeight: 700, lineHeight: 1.15, color: colors.sub,
            // Twee regels, "Nog niet" boven "Ontdekt": op een smalle tegel
            // leest dat rustiger dan een regel die zelf afbreekt waar het uitkomt.
            whiteSpace: "pre-line",
          }}
        >
          {t("ontdekkenNogNietOntdekt")}
        </span>
      </div>
    );
  }
  return (
    <div
      className={onOpen ? "pressable" : undefined}
      style={{ position: "relative", cursor: onOpen ? "pointer" : "default" }}
      onClick={onOpen ? () => { sound.uiTap(); onOpen(); } : undefined}
    >
      {/* Zelfde truc als bij de sectie: een zwarte vervaagde kopie eronder. Een
          box-shadow zou een RECHTHOEK werpen, en de kaart heeft afgeschuinde
          hoeken, dus dan hangt er een blok achter de punten.

          Nog geen art voor deze kaart? Dan de LEGE voorkant, niet de
          achterkant: die laatste betekent "nog niet ontdekt". */}
      <img
        src={kaart.image_path || "/static/cards/voorkant-leeg.webp"}
        alt="" aria-hidden draggable={false} loading="lazy"
        style={{
          position: "absolute", inset: 0, width: "100%", aspectRatio: KAART_RATIO,
          display: "block", filter: "brightness(0) blur(5px)", opacity: 0.5,
          transform: "translateY(4px)", pointerEvents: "none",
        }}
      />
      {/* De gloed is de VORM van de kaart in warm goud, vervaagd, eronder.
          Niet de art zelf vervagen: dat is een foto, dus dan waaieren er
          groene luchten en grijze gebouwen naar buiten in plaats van goud.
          Vandaar de art als masker over een egaal warm verloop, zodat precies
          de omtrek gloeit. En geen box-shadow: die werpt een RECHTHOEK achter
          een kaart met afgeschuinde hoeken. */}
      {/* Op ELKE kaart die je hebt. Op een kaart die je nog niet ontdekt hebt
          niet: die staat in de andere tak hierboven en hoort niet te stralen. */}
      <span
        aria-hidden
        style={{
          position: "absolute", left: "-6%", right: "-6%", top: "-4%", bottom: "-4%",
          background: `radial-gradient(60% 55% at 50% 55%, ${colors.gold}, ${colors.orange} 65%, ${colors.orange} 100%)`,
          WebkitMaskImage: `url(${kaart.image_path || "/static/cards/voorkant-leeg.webp"})`,
          maskImage: `url(${kaart.image_path || "/static/cards/voorkant-leeg.webp"})`,
          WebkitMaskSize: "88% 92%", maskSize: "88% 92%",
          WebkitMaskPosition: "center", maskPosition: "center",
          WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          filter: "blur(7px)", opacity: 0.55, pointerEvents: "none",
        }}
      />
      <img
        src={kaart.image_path || "/static/cards/voorkant-leeg.webp"}
        alt={kaart.word || ""}
        loading="lazy"
        style={{ position: "relative", width: "100%", aspectRatio: KAART_RATIO, display: "block" }}
      />
      {kaart.iso && (
        <img
          src={`/vlaggen/${kaart.iso}.webp`}
          alt=""
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{
            position: "absolute", right: "9%", top: "7%", width: "22%",
            borderRadius: 3, border: `1px solid ${withAlpha(colors.gold, 0.65)}`,
            boxShadow: "0 2px 6px rgba(0,0,0,.5)",
          }}
        />
      )}
      {nieuw && (
        <span
          style={{
            position: "absolute", left: "4%", top: "5%",
            padding: "2px 7px", borderRadius: 4,
            background: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold})`,
            fontFamily: font.ui, fontSize: groot ? 11 : 7.5, fontWeight: 800, letterSpacing: ".06em",
            color: "#3B2300", boxShadow: "0 2px 6px rgba(0,0,0,.45)",
          }}
        >
          {t("ontdekkenNieuw")}
        </span>
      )}
      {chip && (
        <span
          style={{
            position: "absolute", left: "50%", bottom: "27%", transform: "translateX(-50%)",
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "1.5px 6px", borderRadius: 999, whiteSpace: "nowrap",
            background: "rgba(10,4,26,.8)", border: `1px solid ${withAlpha(colors.violet, 0.75)}`,
            fontFamily: font.wide, fontSize: groot ? 11 : 7, letterSpacing: ".06em",
            color: colors.ink, pointerEvents: "none",
          }}
        >
          {(() => {
            const Ico = CAT_ICON[kaart.category || ""];
            return Ico ? <Ico size={groot ? 11 : 7} color={colors.violet} /> : null;
          })()}
          {chip}
        </span>
      )}
      {/* Naamplaat in het paarse vlak onderin de art, waar het verloop dichtloopt. */}
      <span
        style={{
          position: "absolute", left: "9%", right: "9%", bottom: "8%",
          padding: "4px 6px", borderRadius: 6, textAlign: "center",
          background: "rgba(10,4,26,.72)",
          border: `1px solid ${withAlpha(colors.gold, 0.45)}`,
          fontFamily: font.display, fontWeight: 700,
          fontSize: groot ? 16 : "clamp(8px, 2.4vw, 12px)", lineHeight: 1.15,
          color: colors.ink, pointerEvents: "none",
        }}
      >
        {kaart.word}
      </span>
    </div>
  );
}

function Letter({ data, onVerzameling }: { data: LetterView; onVerzameling: () => void }) {
  const { t } = useT();
  const [sortering, setSortering] = useState<Sortering>("az");
  const [filter, setFilter] = useState<Filter>("alles");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const nu = Date.now() / 1000;

  const compleet = data.total > 0 && data.discovered >= data.total;
  const mist = data.total - data.discovered;
  const percent = data.total ? Math.round((data.discovered / data.total) * 100) : 0;

  const kaarten = useMemo(() => {
    let k = data.cards;
    if (filter === "ontdekt") k = k.filter((c) => c.discovered);
    if (filter === "mist") k = k.filter((c) => !c.discovered);
    if (sortering === "nieuw") {
      // Onontdekte kaarten hebben geen datum en horen achteraan, anders
      // schuiven ze op "nieuwste eerst" naar boven.
      k = [...k].sort((a, b) => (b.discovered_at ?? -1) - (a.discovered_at ?? -1));
    }
    return k;
  }, [data.cards, filter, sortering]);

  // De pager loopt langs de kaarten die je HEBT, in de volgorde die nu op het
  // scherm staat, zodat bladeren doet wat je ziet.
  const ontdekt = useMemo(() => kaarten.filter((k) => k.discovered), [kaarten]);

  const filterLabel = filter === "alles" ? t("ontdekkenFilterAlles")
    : filter === "ontdekt" ? t("ontdekkenFilterOntdekt") : t("ontdekkenFilterMist");

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Sectie letter={data.letter} discovered={data.discovered} total={data.total} percent={percent} compleet={compleet} />
      </div>

      {/* Sorteren, filteren en het raster in EEN sectie: het zijn de knoppen
          van deze verzameling, dus ze horen erbij en niet erboven te zweven.
          Dezelfde vorm als de sectie erboven, met de dunst mogelijke lijn en
          een doorzichtige vulling, zodat het decor eronder blijft staan. */}
      <GoudKader hoek={13} fade gloed padding={12} style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <Keuze
            label={`${t("ontdekkenSorteren")}: ${sortering === "az" ? t("ontdekkenSorteerAZ") : t("ontdekkenSorteerNieuw")}`}
            icoon={<ChevronDown size={14} />}
            onClick={() => setSortering((s) => (s === "az" ? "nieuw" : "az"))}
          />
          <Keuze
            label={filterLabel}
            icoon={<Filter size={13} />}
            onClick={() => setFilter((f) => (f === "alles" ? "ontdekt" : f === "ontdekt" ? "mist" : "alles"))}
          />
        </div>

        {kaarten.length === 0 ? (
          <p style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub, textAlign: "center", padding: "24px 0", margin: 0 }}>
            {data.cards.length === 0 ? t("ontdekkenGeenKaarten") : t("ontdekkenNiets")}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {kaarten.map((k) => (
              <KaartTegel key={k.id} kaart={k} nu={nu} onOpen={() => setOpenIdx(ontdekt.findIndex((c) => c.id === k.id))} />
            ))}
          </div>
        )}
      </GoudKader>

      {/* Wat er nog mist, met de weg naar de verzameling ernaast. VAST aan de
          onderkant van het scherm: het raster kan honderden kaarten lang worden,
          en dan staat de belangrijkste knop pas na eindeloos scrollen. Zo blijft
          hij in beeld en scrollt alleen de verzameling.

          De hoogte gaat als variabele naar de pagina, zodat de laatste rij
          kaarten er niet achter verdwijnt. */}
      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20,
          padding: "10px 16px calc(10px + var(--nav-h, 0px) + env(safe-area-inset-bottom))",
          background: "linear-gradient(180deg, rgba(6,2,18,0) 0%, rgba(6,2,18,.92) 38%, rgba(6,2,18,.98) 100%)",
          pointerEvents: "none",
        }}
      >
        <div
          className="panel-neon"
          style={{
            ...panelStyle, padding: "10px 16px", maxWidth: 520, margin: "0 auto",
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(10,4,26,.86)", pointerEvents: "auto",
          }}
        >
          <Layers size={20} color={colors.gold} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 13.5, color: compleet ? colors.gold : colors.ink, lineHeight: 1.15 }}>
              {compleet
                ? t("ontdekkenLetterCompleet")
                : mist === 1 ? t("ontdekkenKaartOntbreekt") : t("ontdekkenKaartenOntbreken", { n: mist })}
            </div>
            {!compleet && (
              <div style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.sub, marginTop: 1, lineHeight: 1.2 }}>
                {t("ontdekkenBlijfOefenen")}
              </div>
            )}
          </div>
          <div className="ontdek-kleineknop" style={{ flexShrink: 0, width: 132 }}>
            <Button variant="gold" full compact onClick={onVerzameling}>
              {t("ontdekkenBekijkVerzameling")}
            </Button>
          </div>
        </div>
      </div>

      {openIdx !== null && openIdx >= 0 && (
        <KaartGroot
          kaarten={ontdekt} index={openIdx} rijen={data.fact_schema} nu={nu}
          onGa={setOpenIdx} onSluit={() => setOpenIdx(null)}
        />
      )}
    </>
  );
}

/** De kaart op ware grootte, als overlay. */
/** De kaart op ware grootte: voorkant met het beeld, achterkant met de feiten.
 *
 *  Tikken draait hem om. De feiten staan op de ACHTERKANT en niet in een
 *  paneel eronder, want dat is wat een verzamelkaart is: beeld aan de ene kant,
 *  wat je erover weet aan de andere. Een lijstje eronder maakt er een
 *  productpagina van.
 *
 *  De pager loopt alleen langs kaarten die je HEBT. Bladeren naar een kaart die
 *  je niet hebt zou de spanning van het raster weghalen. */
function KaartGroot({ kaarten, index, rijen, nu, onGa, onSluit }: {
  kaarten: Kaart[]; index: number; rijen: FactRow[]; nu: number;
  onGa: (i: number) => void; onSluit: () => void;
}) {
  const { t } = useT();
  const [om, setOm] = useState(false);
  const kaart = kaarten[index];

  // Bij het bladeren altijd met de voorkant beginnen: anders zie je de feiten
  // van de volgende kaart voordat je hem gezien hebt.
  useEffect(() => { setOm(false); }, [index]);

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSluit();
      if (e.key === "ArrowLeft" && index > 0) onGa(index - 1);
      if (e.key === "ArrowRight" && index < kaarten.length - 1) onGa(index + 1);
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setOm((v) => !v); }
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [onSluit, onGa, index, kaarten.length]);

  if (!kaart) return null;
  const feiten = rijen.filter((r) => kaart.facts?.[r.key]);

  const blader = (naar: number, label: string, kant: "links" | "rechts") => {
    const kan = naar >= 0 && naar < kaarten.length;
    return (
      <button
        onClick={() => { if (kan) { sound.uiTap(); onGa(naar); } }}
        disabled={!kan}
        aria-label={label}
        style={{
          background: "transparent", border: "none", padding: 8,
          cursor: kan ? "pointer" : "default", opacity: kan ? 1 : 0.25,
          color: colors.ink, display: "flex", flexShrink: 0,
        }}
      >
        {kant === "links" ? <ChevronLeft size={26} /> : <ChevronRight size={26} />}
      </button>
    );
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label={kaart.word || ""}
      onClick={onSluit}
      style={{
        position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center",
        background: "rgba(4,1,14,.86)", padding: 18,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {blader(index - 1, t("ontdekkenVorige"), "links")}

        <div style={{ width: "min(66vw, 290px)" }}>
          <div className={`ontdek-flip${om ? " om" : ""}`}>
            <div className="ontdek-flip-binnen" style={{ aspectRatio: KAART_RATIO }}>
              <button
                onClick={() => { sound.uiTap(); setOm((v) => !v); }}
                aria-label={t("ontdekkenDraaiOm")}
                className="ontdek-flip-kant"
                style={{ position: "absolute", inset: 0, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
              >
                <KaartTegel kaart={kaart} nu={nu} groot />
              </button>

              {/* De achterkant: het pen-embleem als ondergrond, de feiten erop. */}
              <button
                onClick={() => { sound.uiTap(); setOm((v) => !v); }}
                aria-label={t("ontdekkenDraaiOm")}
                className="ontdek-flip-kant ontdek-flip-achter"
                style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
              >
                <img
                  src="/static/cards/achterkant.webp" alt=""
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
                />
                {/* Een donker vlak over het embleem. Zonder dit valt de tekst
                    midden in de gouden ring en is er geen woord te lezen: de
                    achterkant is mooi, maar hier moet hij vooral ondergrond
                    zijn. */}
                <div
                  style={{
                    position: "absolute", left: "13%", right: "13%", top: "16%", bottom: "14%",
                    display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
                    padding: "10px 12px", borderRadius: 10,
                    background: "linear-gradient(180deg, rgba(8,3,20,.86), rgba(8,3,20,.93))",
                    border: `1px solid ${withAlpha(colors.gold, 0.35)}`,
                    boxShadow: "0 8px 24px rgba(0,0,0,.5)",
                  }}
                >
                  <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(13px, 4.6vw, 19px)", color: colors.gold, textAlign: "center", marginBottom: 8, textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>
                    {kaart.word}
                  </span>
                  {feiten.length === 0 ? (
                    <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.sub, textAlign: "center", lineHeight: 1.35 }}>
                      {t("ontdekkenGeenFeiten")}
                    </span>
                  ) : feiten.map((r) => (
                    <div key={r.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", borderTop: `1px solid ${withAlpha(colors.gold, 0.18)}` }}>
                      <span style={{ fontFamily: font.ui, fontSize: "clamp(9px, 2.9vw, 12px)", color: colors.sub }}>{r.label}</span>
                      <span style={{ fontFamily: font.ui, fontSize: "clamp(9px, 2.9vw, 12px)", fontWeight: 700, color: colors.ink, textAlign: "right" }}>
                        {kaart.facts?.[r.key]}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, textAlign: "center", fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>
            {t("ontdekkenKaartVan", { n: index + 1, total: kaarten.length })} · {t("ontdekkenDraaiOm")}
          </div>
        </div>

        {blader(index + 1, t("ontdekkenVolgende"), "rechts")}
      </div>
    </div>
  );
}

// ---- shell ------------------------------------------------------------------

type Stap =
  | { soort: "hub" }
  | { soort: "categorie"; category: string }
  | { soort: "letter"; category: string; letter: string }
  | { soort: "quiz"; category: string; letter: string | null; mode: "letter" | "review" };

export function Ontdekken({ onBack, onOefenen }: { onBack: () => void; onOefenen: (letter: string | null) => void }) {
  const { t } = useT();
  const [stapel, setStapel] = useState<Stap[]>([{ soort: "hub" }]);
  const stap = stapel[stapel.length - 1];

  const [overview, setOverview] = useState<Overview | null>(null);
  const [cat, setCat] = useState<CategoryView | null>(null);
  const [letter, setLetter] = useState<LetterView | null>(null);
  const [fout, setFout] = useState(false);

  // Dezelfde achtergrond als de andere solo-schermen, zodat Ontdekken bij de
  // app hoort en niet als een losse app voelt.
  useEffect(() => {
    document.body.classList.add("winkel");
    return () => document.body.classList.remove("winkel");
  }, []);

  useEffect(() => {
    let weg = false;
    setFout(false);
    (async () => {
      try {
        if (stap.soort === "hub") setOverview(await haal<Overview>("/api/discover/overview"));
        if (stap.soort === "categorie") {
          setCat(null);
          const d = await haal<CategoryView>(`/api/discover/category/${stap.category}`);
          if (!weg) setCat(d);
        }
        if (stap.soort === "letter") {
          setLetter(null);
          const d = await haal<LetterView>(
            `/api/discover/category/${stap.category}/letter/${stap.letter}`,
          );
          if (!weg) setLetter(d);
        }
      } catch {
        if (!weg) setFout(true);
      }
    })();
    return () => { weg = true; };
  }, [stap.soort, (stap as { category?: string }).category, (stap as { letter?: string }).letter]);

  const terug = useCallback(() => {
    if (stapel.length === 1) { onBack(); return; }
    setStapel((s) => s.slice(0, -1));
  }, [stapel.length, onBack]);

  const titel =
    stap.soort === "hub" ? t("ontdekkenTitel")
      : stap.soort === "categorie" ? (cat?.label ?? t("ontdekkenLaden"))
      : stap.soort === "quiz" ? t("ontdekkenQuiz")
      : t("ontdekkenLetter", { letter: stap.letter });

  const gast = overview?.guest ?? cat?.guest ?? letter?.guest ?? false;

  return (
    <div
      style={{
        maxWidth: 520, margin: "0 auto",
        // Ruimte onderaan voor de vaste balk, anders valt de laatste rij
        // kaarten erachter.
        padding: "18px 16px calc(104px + var(--nav-h, 0px) + env(safe-area-inset-bottom))",
        // De veilige zone bovenaan, zoals elk ander scherm: zonder dit ligt de
        // terugpijl op een iPhone onder de statusbalk en is hij niet te raken.
        paddingTop: "calc(18px + env(safe-area-inset-top))",
      }}
    >
      <Kop titel={titel} onBack={terug} />

      {gast && (
        <div
          style={{
            ...panelStyle, padding: 14, marginBottom: 14,
            border: `1.5px solid ${withAlpha(colors.gold, 0.35)}`,
          }}
        >
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: colors.gold }}>
            {t("ontdekkenGastTitel")}
          </div>
          <p style={{ margin: "4px 0 0", fontFamily: font.ui, fontSize: 12.5, lineHeight: 1.4, color: colors.sub }}>
            {t("ontdekkenGastUitleg")}
          </p>
        </div>
      )}

      {fout ? (
        <p style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub, textAlign: "center", padding: "28px 0" }}>
          {t("ontdekkenLaden")}
        </p>
      ) : stap.soort === "hub" ? (
        overview && (
          <Hub
            data={overview}
            onOefenen={onOefenen}
            onQuiz={(mode, letter, category) =>
              setStapel((s) => [...s, { soort: "quiz", category, letter, mode }])}
            onVerzameling={() => setStapel((s) => [...s, { soort: "categorie", category: "land" }])}
            onCategorie={(c) => setStapel((s) => [...s, { soort: "categorie", category: c }])}
          />
        )
      ) : stap.soort === "quiz" ? (
        <OntdekQuiz
          category={stap.category} letter={stap.letter} mode={stap.mode}
          onBack={terug}
          onKlaar={() => { /* de hub haalt zichzelf opnieuw op zodra je terug bent */ }}
        />
      ) : stap.soort === "categorie" ? (
        cat && (
          <Categorie
            data={cat}
            onLetter={(l) => setStapel((s) => [...s, { soort: "letter", category: stap.category, letter: l }])}
          />
        )
      ) : (
        letter && <Letter data={letter} onVerzameling={terug} />
      )}
    </div>
  );
}
