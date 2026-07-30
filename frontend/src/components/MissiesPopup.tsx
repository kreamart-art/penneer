// De missies in drie lagen, als popup.
//
// Zelfde omlijsting als de dagronde-uitslag, maar dan de LEGE sectie: die art
// heeft dezelfde kaders zonder de dagronde-illustraties erin. In de kopbalk
// staan de drie schilden waarmee je wisselt tussen dagelijks, wekelijks en
// seizoen; in het vak eronder de missies met hun beloning.
//
// Waarom drie lagen en niet een lange lijst: een dagmissie moet je vandaag
// halen, een seizoensmissie duurt een maand. Door elkaar in een lijst lezen ze
// als dezelfde soort opgave, en dan voelt de seizoensmissie als een dagmissie
// die je aan het verliezen bent.
//
// De dagmissies claimen zichzelf zodra ze af zijn, zoals ze dat altijd al
// deden. Week en seizoen haal je zelf op met de knop. Daarom draagt elke rij
// een `claimed` van de server en beslist de rij zelf wat er in dat hoekje komt.
import { useCallback, useEffect, useState } from "react";
import { CloseIcon } from "./CloseIcon";
import { GOUD } from "./ProfileHero";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

// Opgemeten in de bron van sectie-leeg.webp (2430 x 4095): dezelfde kaders als
// de dagronde-sectie, alleen zonder illustraties.
const ART_B = 2430;
const ART_H = 4095;
const KOP = { l: 110 / ART_B, t: 109 / ART_H, b: 2206 / ART_B, h: 605 / ART_H };
const LIJF = { l: 0.064, t: 0.204, b: 0.872, h: 0.754 };
const HOEK = { x: 0.968, y: 0.028 };

/** Hoogte van de kopbalk als factor van de popupBREEDTE, zodat maten binnen de
 *  balk een echte lengte zijn en geen procent dat tegen zichzelf oplost. */
const KOP_F = KOP.h * (ART_H / ART_B);
const kopMaat = (deel: number) => `calc(var(--pop-b) * ${(deel * KOP_F).toFixed(5)})`;

type Laag = "dag" | "week" | "seizoen";

const TABS: { key: Laag; art: string; label: string }[] = [
  { key: "dag", art: "/ui/missie-dag.webp?v=1", label: "missiesDag" },
  { key: "week", art: "/ui/missie-week.webp?v=1", label: "missiesWeek" },
  { key: "seizoen", art: "/ui/missie-seizoen.webp?v=1", label: "missiesSeizoen" },
];

interface Missie {
  key: string;
  target: number;
  progress: number;
  done: boolean;
  claimed: boolean;
  reward: number;   // XP
  coins?: number;
  cash?: number;
}
interface Blok {
  periode: string;
  seconds_left: number;
  missions: Missie[];
}
interface Alles {
  authed: boolean;
  dag: Blok;
  week: Blok;
  seizoen: Blok;
}

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

/** Resterende tijd als grove eenheid. Op een seizoensmissie zegt een aftelling
 *  op de seconde niets; "nog 12 dagen" zegt alles. */
function resterend(s: number): string {
  if (s >= 172800) return `${Math.floor(s / 86400)}d`;
  if (s >= 7200) return `${Math.floor(s / 3600)}u`;
  return `${Math.max(1, Math.floor(s / 60))}m`;
}

function Balk({ deel }: { deel: number }) {
  return (
    <span style={{ display: "block", height: 4, borderRadius: 999, background: "rgba(0,0,0,.42)", overflow: "hidden" }}>
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.round(Math.min(1, deel) * 100)}%`,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${GOUD[1]}, ${GOUD[3]})`,
          transition: "width .35s ease",
        }}
      />
    </span>
  );
}

function Rij({ m, laag, onClaim }: { m: Missie; laag: Laag; onClaim: (key: string) => void }) {
  const { t } = useT();
  const [bezig, setBezig] = useState(false);
  const teHalen = m.done && !m.claimed && laag !== "dag";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 11px",
        borderRadius: 11,
        background: teHalen ? withAlpha(colors.gold, 0.11) : "rgba(255,255,255,.045)",
        border: `1px solid ${teHalen ? withAlpha(colors.gold, 0.45) : "rgba(255,255,255,.09)"}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, color: m.claimed ? colors.faint : colors.ink, lineHeight: 1.2 }}>
          {t(`mission_${m.key}`)}
        </span>
        <Balk deel={m.target ? m.progress / m.target : 0} />
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{m.progress}/{m.target}</span>
          {/* De beloning hoort bij de opgave, dus hij staat op dezelfde regel
              als de voortgang en niet in een eigen kolom. */}
          {m.reward > 0 && <span style={{ color: GOUD[3], fontWeight: 700 }}>+{m.reward} XP</span>}
          {!!m.coins && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: GOUD[3], fontWeight: 700 }}>
              <img src="/coins-stack.webp" alt="" aria-hidden style={{ height: 12, width: "auto", display: "block" }} />
              {m.coins}
            </span>
          )}
          {!!m.cash && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#8FE3A8", fontWeight: 700 }}>
              <img src="/ui/valuta/cash.webp?v=1" alt="" aria-hidden width={12} height={12} style={{ display: "block" }} />
              {m.cash}
            </span>
          )}
        </span>
      </div>

      {/* Rechts staat altijd iets: de knop als er wat te halen valt, anders wat
          de stand is. Een leeg hoekje op de ene rij en een knop op de andere
          leest als een fout in de lijst. */}
      {teHalen ? (
        <button
          disabled={bezig}
          onClick={() => { sound.uiTap(); setBezig(true); onClaim(m.key); }}
          className="pressable"
          style={{
            flexShrink: 0,
            border: "none",
            borderRadius: 999,
            padding: "7px 14px",
            cursor: bezig ? "default" : "pointer",
            opacity: bezig ? 0.6 : 1,
            background: `linear-gradient(180deg, ${GOUD[3]}, ${GOUD[1]})`,
            color: "#2A1A05",
            fontFamily: font.ui,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {t("missiesClaim")}
        </button>
      ) : (
        <span style={{ flexShrink: 0, fontFamily: font.ui, fontSize: 10.5, fontWeight: 700, color: m.claimed ? GOUD[3] : colors.faint }}>
          {m.claimed ? t("missiesOpgehaald") : `${Math.round((m.progress / Math.max(1, m.target)) * 100)}%`}
        </span>
      )}
    </div>
  );
}

export function MissiesPopup({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [laag, setLaag] = useState<Laag>("dag");
  const [alles, setAlles] = useState<Alles | null>(null);

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

  const blok = alles ? alles[laag] : null;
  const gast = alles ? !alles.authed : false;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 96,
        background: "rgba(6,3,18,.82)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-label={t("missiesTitel")}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          ["--pop-b" as string]: `min(356px, calc(100vw - 40px), calc(88vh * ${ART_B} / ${ART_H}))`,
          width: "var(--pop-b)",
          height: `calc(var(--pop-b) * ${ART_H} / ${ART_B})`,
          backgroundImage: "url(/ui/sectie-leeg.webp?v=1)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <button
          onClick={() => { sound.uiTap(); onClose(); }}
          aria-label={t("back")}
          className="pressable"
          style={{
            position: "absolute",
            // Vanaf RECHTS gemeten, niet met een left van 96,8%: bij een
            // left zo dicht tegen de rand houdt de krimp-naar-inhoud maar een
            // paar pixels over als beschikbare breedte, en dat knijpt het
            // kruis samen op browsers die de min-inhoud niet respecteren.
            right: `${(1 - HOEK.x) * 100}%`,
            top: `${HOEK.y * 100}%`,
            transform: "translate(50%, -50%)",
            zIndex: 4,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
          }}
        >
          <CloseIcon size={26} />
        </button>

        {/* KOPBALK: de drie schilden. Het actieve staat vol en iets groter, de
            andere twee gedempt, want anders zie je niet welke laag je bekijkt. */}
        <div
          style={{
            position: "absolute",
            left: `${KOP.l * 100}%`,
            top: `${KOP.t * 100}%`,
            width: `${KOP.b * 100}%`,
            height: `${KOP.h * 100}%`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: kopMaat(0.12),
          }}
        >
          {TABS.map((tab) => {
            const actief = laag === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { sound.uiTap(); setLaag(tab.key); }}
                aria-label={t(tab.label)}
                aria-pressed={actief}
                className="pressable"
                style={{
                  border: "none",
                  padding: 0,
                  background: "transparent",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  opacity: actief ? 1 : 0.4,
                  filter: actief ? "none" : "saturate(.4)",
                  transform: actief ? "scale(1)" : "scale(.86)",
                  transition: "opacity .18s ease, transform .18s ease, filter .18s ease",
                }}
              >
                <img src={tab.art} alt="" aria-hidden style={{ height: kopMaat(0.82), width: "auto", display: "block" }} />
              </button>
            );
          })}
        </div>

        {/* LIJF: welke laag, hoe lang hij nog loopt, en de missies. */}
        <div
          style={{
            position: "absolute",
            left: `${LIJF.l * 100}%`,
            top: `${LIJF.t * 100}%`,
            width: `${LIJF.b * 100}%`,
            height: `${LIJF.h * 100}%`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 7,
            minHeight: 0,
          }}
        >
          <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
            <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: GOUD[3] }}>
              {t(TABS.find((x) => x.key === laag)!.label)}
            </span>
            {!!blok && (
              <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>
                {t("missiesNogTeGaan", { t: resterend(blok.seconds_left) })}
              </span>
            )}
          </span>

          <span
            aria-hidden
            style={{
              height: 1,
              flexShrink: 0,
              width: "76%",
              background: `linear-gradient(90deg, transparent, ${withAlpha(colors.gold, 0.7)}, transparent)`,
            }}
          />

          <div className="zachtscroll" style={{ width: "100%", display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", minHeight: 0, paddingRight: 2, paddingBottom: 4 }}>
            {gast ? (
              <p style={{ margin: "6px 0 0", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, textAlign: "center", lineHeight: 1.4 }}>{t("missiesGast")}</p>
            ) : !blok || blok.missions.length === 0 ? (
              <p style={{ margin: "6px 0 0", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, textAlign: "center" }}>{t("missiesLeeg")}</p>
            ) : (
              blok.missions.map((m) => <Rij key={m.key} m={m} laag={laag} onClaim={claim} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
