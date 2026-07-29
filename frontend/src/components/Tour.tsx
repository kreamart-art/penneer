// De rondleiding: wat het spel is, en wat er sinds de vorige versie bij kwam.
//
// Waarom een rondleiding en geen langere uitlegpagina: de regels staan al onder
// "Hoe werkt het". Dit gaat niet over de regels maar over de APP. Wat kun je
// hier allemaal, en waar zit het. Dat leest niemand als lopende tekst, en het
// zijn precies de dingen die je één keer moet zien.
//
// Elke stap is één ding met één plaatje. Geen opsommingen in een stap: dan is
// het een handleiding met een volgende-knop eronder.
//
// De rondleiding wordt één keer vanzelf getoond, en daarna alleen als je hem
// zelf opent uit de instellingen. Het versienummer in de sleutel zorgt ervoor
// dat een volgende rondleiding opnieuw langskomt, zonder dat we die van nu nog
// een keer laten zien.
import { useEffect, useState } from "react";
import { Button } from "./Button";
import { CloseIcon } from "./CloseIcon";
import { KADER_LIJN_GOUD, NeonKader } from "./ProfileHero";
import { KnopPlaat } from "./KnopPlaat";
import { STAT_ART } from "./ArtIcoon";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

/** Bump dit nummer als er een nieuwe rondleiding is: dan komt hij weer langs. */
export const TOUR_VERSIE = 2;
const SLEUTEL = "penneer.tour";

export function tourGezien(): boolean {
  try {
    return Number(localStorage.getItem(SLEUTEL) || 0) >= TOUR_VERSIE;
  } catch {
    return true; // geen opslag: dan liever niets tonen dan elke keer opnieuw
  }
}

export function tourAfvinken(): void {
  try {
    localStorage.setItem(SLEUTEL, String(TOUR_VERSIE));
  } catch {
    /* niets aan te doen */
  }
}

/** De stappen. `nieuw` zet er een gouden vlaggetje bij: dat is wat er nieuw is
 *  in deze versie, en dat is voor wie de app al kent het enige interessante. */
const STAPPEN: { key: string; art: string; artMaat?: number; nieuw?: boolean }[] = [
  { key: "welkom", art: "/logo.png", artMaat: 132 },
  { key: "spelen", art: "/buzzer.webp", artMaat: 150 },
  { key: "woorden", art: "/ui/letter.webp", artMaat: 130 },
  { key: "dagronde", art: `/ui/stat/vlam.webp?v=${STAT_ART}`, artMaat: 120 },
  { key: "duel", art: `/ui/stat/dubbel.webp?v=${STAT_ART}`, artMaat: 120 },
  { key: "divisies", art: "/ui/shield/zilver.webp", artMaat: 118, nieuw: true },
  { key: "meldingen", art: `/ui/stat/sterren.webp?v=${STAT_ART}`, artMaat: 120, nieuw: true },
  { key: "vrienden", art: `/ui/stat/kroon.webp?v=${STAT_ART}`, artMaat: 122 },
  { key: "winkel", art: "/coins-stack.webp", artMaat: 130 },
];

export function Tour({ onKlaar }: { onKlaar: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const stap = STAPPEN[i];
  const laatste = i === STAPPEN.length - 1;

  useEffect(() => {
    sound.uiTap();
  }, [i]);

  const sluit = () => {
    tourAfvinken();
    onKlaar();
  };

  return (
    <div
      className="reward-veil"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 98,
        background: "rgba(6,3,18,.88)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <NeonKader
        radius={22}
        dik={0.85}
        lijn={KADER_LIJN_GOUD}
        gloed="verloop"
        animeer
        eindkap
        vulling="geen"
        className="reward-card"
        style={{ width: "100%", maxWidth: 360 }}
        binnen={{ padding: 0, overflow: "hidden" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "22px 20px 18px",
            textAlign: "center",
            // Het decor van de arena erachter: de rondleiding gaat over het
            // spel, dus hij hoort in het spel te staan en niet in een venster.
            backgroundImage: [
              "linear-gradient(180deg, rgba(255,243,181,.09) 0%, transparent 14%)",
              "radial-gradient(120% 78% at 50% 8%, transparent 32%, rgba(6,3,18,.74) 100%)",
              'url("/ui/lobby-bg.webp")',
              "linear-gradient(180deg, #2C1E4C 0%, #201340 48%, #130B2A 100%)",
            ].join(", "),
            backgroundSize: "100% 100%, 100% 100%, cover, 100% 100%",
            backgroundPosition: "top, top, center bottom, top",
            backgroundRepeat: "no-repeat",
          }}
        >
          <button
            onClick={sluit}
            aria-label={t("close")}
            style={{ position: "absolute", top: 10, right: 10, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4, zIndex: 2 }}
          >
            <CloseIcon size={24} />
          </button>

          {stap.nieuw && (
            <span
              style={{
                fontFamily: font.ui,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: colors.gold,
                textShadow: `0 0 14px ${withAlpha(colors.gold, 0.6)}`,
              }}
            >
              {t("tourNieuw")}
            </span>
          )}

          {/* De art met licht erachter, net als bij een beloning. De sleutel
              wisselt mee zodat de pop-in bij elke stap opnieuw speelt. */}
          <div key={stap.key} style={{ position: "relative", display: "grid", placeItems: "center", width: "100%", height: 156 }}>
            <span
              style={{
                position: "absolute",
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${withAlpha(colors.gold, 0.28)}, transparent 68%)`,
                animation: "breath-glow 3.4s ease-in-out infinite",
              }}
            />
            <img
              className="reward-art"
              src={stap.art}
              alt=""
              style={{ position: "relative", width: stap.artMaat ?? 130, height: stap.artMaat ?? 130, objectFit: "contain", maxWidth: "none" }}
            />
          </div>

          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 20, color: colors.ink }}>
            {t(`tour_${stap.key}_t`)}
          </span>
          <p style={{ margin: 0, minHeight: 62, fontFamily: font.ui, fontSize: 13.5, lineHeight: 1.55, color: colors.sub }}>
            {t(`tour_${stap.key}_b`)}
          </p>

          {/* De rail: waar je bent en hoeveel er nog komt. Tikbaar, want een
              rondleiding waarin je niet terug kunt is een dwangbuis. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "2px 0 4px" }}>
            {STAPPEN.map((s, n) => (
              <button
                key={s.key}
                onClick={() => setI(n)}
                aria-label={String(n + 1)}
                style={{
                  width: n === i ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background: n === i ? colors.gold : n < i ? withAlpha(colors.gold, 0.4) : "rgba(255,255,255,.18)",
                  boxShadow: n === i ? `0 0 8px ${withAlpha(colors.gold, 0.7)}` : undefined,
                  transition: "width .2s ease, background .2s ease",
                }}
              />
            ))}
          </div>

          {laatste ? (
            <Button variant="gold" full onClick={sluit}>{t("tourKlaar")}</Button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <button
                onClick={() => setI((n) => Math.max(0, n - 1))}
                disabled={i === 0}
                style={{ background: "transparent", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, color: colors.faint, fontFamily: font.ui, fontSize: 13, padding: "6px 8px" }}
              >
                {t("tourTerug")}
              </button>
              <KnopPlaat breed={104} onClick={() => setI((n) => Math.min(STAPPEN.length - 1, n + 1))} label={t("tourVerder")} />
            </div>
          )}
        </div>
      </NeonKader>
    </div>
  );
}
