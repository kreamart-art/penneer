// Divisies: het schild om je portret, en wat er maandag mee gebeurt.
//
// Het schild was een kleur die je zelf koos. Nu is het een RANG. Je klimt door
// een week lang te spelen en bij de eerste drie van de weekranglijst te
// eindigen; blijf je ver onderaan hangen, dan zak je er weer een. Elke maandag
// wordt de balans opgemaakt, en dat moment krijgt zijn eigen animatie.
//
// Waarom een moment en niet een doorlopende teller: iets wat per potje
// verspringt is een score. Iets wat één keer per week verspringt is een uitslag,
// en die kun je vieren.
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./CloseIcon";
import { NeonText } from "./NeonText";
import { KnopPlaat } from "./KnopPlaat";
import { VictoryKaart } from "./VictoryKaart";
import {
  DIVISIE_ACCENT,
  DIVISIE_NAMEN,
  KADER_LIJN_GOUD,
  SCHILD_HART_X,
  SCHILD_HART_Y,
  NeonKader,
  SCHILD_KLEUREN,
  divisieKleur,
} from "./ProfileHero";
import type { DivisieChange, DivisieStand } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

const SCHILD_VERH = 972 / 821;

/** Het schild als losse art, met of zonder cijfer erop.
 *
 *  Het draagt zijn eigen licht mee: op een donkere kaart valt de art anders
 *  weg, want alle diepte erin zit in schaduwen die daar net zo donker zijn.
 *  Een echte laag eronder en geen `drop-shadow`, want die rastert iOS apart en
 *  dan zie je zijn rechthoek over het schild heen. */
export function Schild({
  divisie,
  maat = 44,
  cijfer,
  gloed = true,
  dof = false,
}: {
  divisie: number;
  maat?: number;
  cijfer?: number;
  gloed?: boolean;
  /** Nog niet bereikt: grijs en zonder licht, zodat je ziet dat er meer is. */
  dof?: boolean;
}) {
  const accent = DIVISIE_ACCENT[Math.max(0, Math.min(DIVISIE_ACCENT.length - 1, divisie))];
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        width: maat,
        height: maat * SCHILD_VERH,
        flexShrink: 0,
        display: "inline-grid",
        placeItems: "center",
      }}
    >
      {gloed && !dof && (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: "46%",
            width: maat * 1.05,
            height: maat * 1.05,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: `radial-gradient(closest-side, rgba(${accent},.55) 0%, rgba(${accent},.18) 56%, transparent 100%)`,
            filter: `blur(${Math.max(3, Math.round(maat / 4))}px)`,
          }}
        />
      )}
      <img
        src={`/ui/shield/${divisieKleur(divisie)}.webp`}
        alt=""
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "block",
          filter: dof ? "grayscale(1) brightness(.5)" : undefined,
          opacity: dof ? 0.5 : 1,
        }}
      />
      {cijfer !== undefined && (
        <span
          style={{
            position: "absolute",
            // Het zwaartepunt van de vorm, gemeten op de art. Zie SCHILD_HART_*
            // in ProfileHero: het midden van de DOOS klopt niet, want een schild
            // loopt onderin in een punt.
            left: `${SCHILD_HART_X * 100}%`,
            top: `${SCHILD_HART_Y * 100}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: maat * 0.5,
            lineHeight: 1,
            color: "#FFFFFF",
            textShadow: "0 1px 3px rgba(20,4,40,.8)",
          }}
        >
          {cijfer}
        </span>
      )}
    </span>
  );
}

/** De naam van een divisie. Buiten de component omdat de deelkaart hem ook
 *  gebruikt en die tekent op canvas, niet in React. */
export function divisieNaam(divisie: number): string {
  return DIVISIE_NAMEN[Math.max(0, Math.min(DIVISIE_NAMEN.length - 1, Math.round(divisie || 0)))];
}

/** De ladder: waar je staat, wat eronder ligt en wat er nog boven je is.
 *
 *  Alle zeven tegelijk in beeld en niet één voor één afgeschermd: je moet
 *  KUNNEN zien waar je naartoe speelt. Wat je nog niet hebt is grijs, wat je
 *  had is gewoon zichtbaar, en waar je nu staat licht op. */
export function DivisieLadder({
  divisie,
  stand,
  onClose,
}: {
  divisie: number;
  stand: DivisieStand | null;
  onClose: () => void;
}) {
  const { t } = useT();
  const accent = DIVISIE_ACCENT[Math.max(0, Math.min(DIVISIE_ACCENT.length - 1, divisie))];
  const dagen = stand ? Math.max(0, Math.ceil((stand.maandag * 1000 - Date.now()) / 86400000)) : null;

  // Waar sta je nu op weg naar maandag: promotie, veilig of gevaar. Dit is de
  // enige regel die iets voorspelt, dus hij hoort bovenaan en niet in de lijst.
  const koers =
    !stand || stand.gespeeld === 0 ? "rust"
    : stand.plek !== null && stand.plek <= 3 ? "op"
    : stand.plek === null || stand.plek >= 10 ? "neer"
    : "blijft";

  return (
    <div
      className="reward-veil"
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
      onClick={onClose}
    >
      <NeonKader
        radius={20}
        dik={0.85}
        lijn={KADER_LIJN_GOUD}
        gloed="verloop"
        animeer
        eindkap
        vulling="geen"
        style={{ width: "100%", maxWidth: 350 }}
        binnen={{
          padding: "20px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
          // Een eigen donkere bodem, want de standaardvulling van de lijst is
          // licht: met een gouden lijn eromheen wordt dat een amberkleurige
          // waas waar de tekst in wegvalt. Dit is een venster met een LIJST
          // erin, dus het moet donker zijn zoals de rest van de app.
          backgroundImage: [
            "linear-gradient(180deg, rgba(255,243,181,.08) 0%, transparent 14%)",
            "linear-gradient(180deg, #241740 0%, #1A1035 52%, #100926 100%)",
          ].join(", "),
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ display: "contents" }}>
          <button
            onClick={onClose}
            aria-label={t("close")}
            style={{ position: "absolute", top: 10, right: 10, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}
          >
            <CloseIcon size={24} />
          </button>

          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, color: colors.gold, textShadow: `0 0 22px ${withAlpha(colors.gold, 0.5)}` }}>
            {t("divisieTitle")}
          </span>
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, lineHeight: 1.5, color: colors.sub }}>
            {t("divisieUitleg")}
          </p>

          {/* Je koers naar maandag toe. */}
          <NeonKader
            radius={12}
            dik={0.45}
            sterkte={0.6}
            hoek={10}
            eindkap="kort"
            vulling="geen"
            lijn={`linear-gradient(115deg, rgba(${accent},.95) 0%, rgba(${accent},.35) 50%, rgba(${accent},.95) 100%)`}
            gloed={`0 0 12px rgba(${accent},.3)`}
            style={{ width: "100%" }}
            binnen={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}
          >
            <Schild divisie={divisie} maat={26} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: font.display, fontWeight: 700, fontSize: 14.5, color: colors.ink }}>
                {divisieNaam(divisie)}
              </span>
              <span style={{ display: "block", fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>
                {koers === "rust" ? t("divisieRust")
                  : koers === "op" ? t("divisieKoersOp", { n: stand!.plek! })
                  : koers === "neer" ? t("divisieKoersNeer")
                  : t("divisieKoersVeilig", { n: stand!.plek! })}
              </span>
            </span>
            {dagen !== null && (
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ display: "block", fontFamily: font.display, fontWeight: 800, fontSize: 18, color: colors.gold, lineHeight: 1 }}>{dagen}</span>
                <span style={{ display: "block", fontFamily: font.ui, fontSize: 10, color: colors.faint }}>{dagen === 1 ? t("divisieDag") : t("divisieDagen")}</span>
              </span>
            )}
          </NeonKader>

          {/* De ladder, hoogste bovenaan: je klimt omhoog, dus de top hoort
              boven te staan en niet onderaan de lijst. */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 3 }}>
            {SCHILD_KLEUREN.map((_, i) => SCHILD_KLEUREN.length - 1 - i).map((d) => {
              const hier = d === divisie;
              return (
                <div
                  key={d}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "5px 9px",
                    borderRadius: 10,
                    background: hier ? `linear-gradient(90deg, rgba(${DIVISIE_ACCENT[d]},.18), transparent 78%)` : "transparent",
                    boxShadow: hier ? `inset 0 0 0 1px rgba(${DIVISIE_ACCENT[d]},.35)` : undefined,
                  }}
                >
                  <Schild divisie={d} maat={hier ? 24 : 20} dof={d > divisie} gloed={hier} />
                  <span style={{ flex: 1, fontFamily: font.display, fontWeight: hier ? 700 : 600, fontSize: 13.5, color: d > divisie ? colors.faint : hier ? colors.ink : colors.sub }}>
                    {divisieNaam(d)}
                  </span>
                  {hier && (
                    <span style={{ fontFamily: font.ui, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: `rgb(${DIVISIE_ACCENT[d]})` }}>
                      {t("divisieJij")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </NeonKader>
    </div>
  );
}

/** De maandag-uitslag: het schild wisselt van kleur, voor je ogen.
 *
 *  De animatie doet één ding: het oude schild vervaagt, het nieuwe komt in
 *  beeld en er slaat licht af. Geen confetti bij een daling; dan wordt het
 *  spot in plaats van een uitslag. */
export function DivisiePopup({ change, onSluit }: { change: DivisieChange; onSluit: () => void }) {
  const { t } = useT();
  const op = change.richting === "op";
  const [fase, setFase] = useState<0 | 1 | 2>(0);
  const gevierd = useRef(false);

  useEffect(() => {
    if (!gevierd.current) {
      gevierd.current = true;
      sound.badge();
      sound.haptic?.(op ? [20, 40, 20] : [30]);
    }
    // Twee tikken: eerst het oude schild laten staan, dan het nieuwe erin.
    // Meteen wisselen leest als een fout in de app, niet als een uitslag.
    const a = setTimeout(() => setFase(1), 620);
    const b = setTimeout(() => setFase(2), 1180);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [op]);

  const toon = fase === 0 ? change.van : change.naar;
  const accent = DIVISIE_ACCENT[Math.max(0, Math.min(DIVISIE_ACCENT.length - 1, toon))];

  return (
    <div
      className="reward-veil"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 97,
        background: "rgba(6,3,18,.86)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 22,
      }}
    >
      {/* Dezelfde sierlijst als bij elke beloning. De wimpel VICTORY! hangt er
          alleen boven bij een promotie: een degradatie met "victory" erboven is
          spot, geen uitslag. */}
      <VictoryKaart kop={op} breed={330}>
        <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: colors.faint }}>
          {t("divisieMaandag")}
        </span>
        {/* Het WOORD is de kop van deze kaart, dus het krijgt de behandeling van
            een kop en niet van een regel tekst: de smalle hoofdletters van de
            advertentie, ruim gespatieerd, met echt licht erachter in plaats van
            een schaduw. Een `text-shadow` op een vette letter maakt hem alleen
            wolliger; een vervaagde kopie erachter geeft hem gloed. */}
        <NeonText
          accent={op ? colors.gold : colors.red}
          blur={22}
          glow={0.85}
          style={{ fontFamily: font.wide, fontSize: 30, lineHeight: 1, letterSpacing: 2.5, textTransform: "uppercase" }}
        >
          {op ? t("divisiePromotie") : t("divisieDegradatie")}
        </NeonText>

        {/* Het schild zelf. De sleutel wisselt mee, zodat React hem opnieuw
            opbouwt en de pop-in-animatie echt opnieuw speelt. */}
        <div style={{ position: "relative", display: "grid", placeItems: "center", width: 118, height: 118 }}>
          <span
            style={{
              position: "absolute",
              width: 104,
              height: 104,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(${accent},.4), transparent 68%)`,
              animation: "breath-glow 3s ease-in-out infinite",
            }}
          />
          {/* De lichtslag op het moment van wisselen: één ring die uitdijt en
              verdwijnt. Alleen bij promotie, want bij een daling hoort er niets
              te knallen. */}
          {op && fase >= 1 && (
            <span
              key={`slag-${fase}`}
              style={{
                position: "absolute",
                width: 90,
                height: 90,
                borderRadius: "50%",
                border: `2px solid rgba(${accent},.9)`,
                animation: "divisie-slag .85s cubic-bezier(.2,.7,.3,1) forwards",
              }}
            />
          )}
          <span key={`schild-${toon}`} className="reward-art" style={{ position: "relative" }}>
            <Schild divisie={toon} maat={76} />
          </span>
        </div>

        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>
          {divisieNaam(change.naar)}
        </span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.45, color: colors.sub }}>
          {op
            ? t("divisiePromotieBody", { plek: change.plek ?? 1, naam: divisieNaam(change.naar) })
            : t("divisieDegradatieBody", { naam: divisieNaam(change.naar) })}
        </p>
        <KnopPlaat breed={100} onClick={onSluit} label={t("coinsOk")} />
      </VictoryKaart>
    </div>
  );
}
