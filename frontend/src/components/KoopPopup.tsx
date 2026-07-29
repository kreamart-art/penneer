// Wat je zojuist gekocht hebt, gevierd zodra je de winkel uit loopt.
//
// Waarom niet meteen: een venster boven de winkel valt over het volgende
// product waar je net naar keek, en je bent daar om te KIJKEN. Twee tellen
// nadat je weg bent is het moment voorbij en de aandacht vrij.
//
// Dezelfde keuze als bij de verdiende draaiknoppen: nu opzetten of straks. Wie
// drie dingen achter elkaar koopt wil niet drie keer naar zijn profiel.
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { KnopPlaat } from "./KnopPlaat";
import { VictoryKaart } from "./VictoryKaart";
import { EMOTE_PACKS, EMOTE_SRC } from "./emotes";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

/** Wat het gekochte ding IS, zodat de kaart weet wat hij moet laten zien en of
 *  er iets op te zetten valt. Een muntenbundel heb je niet aan te trekken. */
function watIsHet(item: string): { art: string | null; soort: "buzzer" | "reel" | "emotes" | "avatars" | "anders" } {
  if (item.startsWith("bz")) return { art: `/buzzers/${item}.webp`, soort: "buzzer" };
  if (item.startsWith("rs")) return { art: null, soort: "reel" };
  if (item.startsWith("empack")) {
    const pack = EMOTE_PACKS.find((p) => p.id === item);
    return { art: pack ? EMOTE_SRC(pack.emotes[0]) : null, soort: "emotes" };
  }
  if (item.startsWith("avpack")) return { art: null, soort: "avatars" };
  return { art: null, soort: "anders" };
}

export function KoopPopup({ game, actief }: { game: GameApi; actief: boolean }) {
  const { t } = useT();
  const item = game.state.gekocht;
  const [toon, setToon] = useState(false);
  const gevierd = useRef(false);

  // Twee tellen NADAT de winkel dicht is. Staat hij nog open, dan wacht de
  // teller: `actief` gaat pas aan zodra je er weg bent.
  useEffect(() => {
    if (!item || !actief) { setToon(false); return; }
    const id = window.setTimeout(() => {
      setToon(true);
      if (!gevierd.current) {
        gevierd.current = true;
        sound.badge();
        sound.haptic?.([20, 40, 20]);
      }
    }, 2000);
    return () => window.clearTimeout(id);
  }, [item, actief]);

  if (!item || !toon) return null;

  const { art, soort } = watIsHet(item);
  const klaar = (nu: boolean) => {
    gevierd.current = false;
    if (nu) {
      if (soort === "buzzer") game.setBuzzerSkin(item);
      else if (soort === "reel") game.setReelSkin(item);
    }
    game.gekochtGezien();
  };
  // Alleen wat je ergens op kunt ZETTEN krijgt een "nu opzetten". Een pak
  // avatars of stickers is een lade die opengaat, geen ding dat aan staat.
  const opTeZetten = soort === "buzzer" || soort === "reel";

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
        padding: 22,
      }}
    >
      <VictoryKaart kop onClose={() => klaar(false)} closeLabel={t("claimLater")} breed={330}>
        <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: colors.faint }}>
          {t("koopTitel")}
        </span>

        <div style={{ position: "relative", display: "grid", placeItems: "center", width: 128, height: 128 }}>
          <span
            style={{
              position: "absolute",
              inset: 6,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${withAlpha(colors.gold, 0.32)}, transparent 68%)`,
              animation: "breath-glow 3s ease-in-out infinite",
            }}
          />
          <img
            className="reward-art"
            src={art ?? "/coin.webp"}
            alt=""
            style={{ position: "relative", width: 112, height: 112, objectFit: "contain", maxWidth: "none" }}
          />
        </div>

        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>
          {t(`shopItem_${item}`) !== `shopItem_${item}` ? t(`shopItem_${item}`) : t("koopGeneriek")}
        </span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.45, color: colors.sub }}>
          {opTeZetten ? t("koopBodyOpzetten") : t("koopBody")}
        </p>

        {opTeZetten ? (
          <>
            <Button variant="gold" full onClick={() => klaar(true)}>{t("koopNu")}</Button>
            <button
              onClick={() => klaar(false)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 12.5, padding: "2px 4px 0" }}
            >
              {t("claimLater")}
            </button>
          </>
        ) : (
          <KnopPlaat breed={100} onClick={() => klaar(false)} label={t("coinsOk")} />
        )}
      </VictoryKaart>
    </div>
  );
}
