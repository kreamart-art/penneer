// Language selection — shown once until a language is chosen (stored locally).
import { Emblem } from "../components/Emblem";
import { Screen, Card } from "../components/Layout";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, radius, withAlpha } from "../theme/tokens";

const LANGS: { code: "nl" | "en"; label: string; sub: string }[] = [
  { code: "nl", label: "Nederlands", sub: "Speel in het Nederlands" },
  { code: "en", label: "English", sub: "Play in English" },
];

export function LanguagePage() {
  const { setLang, t } = useT();
  return (
    <Screen>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Emblem size={84} />
          <h2 style={{ margin: 0, fontFamily: font.display, fontWeight: 700, fontSize: 26, color: colors.ink }}>
            {t("chooseLang")}
          </h2>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("chooseLangSub")}</p>
        </div>
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                sound.unlock();
                setLang(l.code);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: radius.button,
                background: withAlpha("#000000", 0.22),
                border: `1.5px solid ${colors.panelBorder}`,
                cursor: "pointer",
              }}
            >
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold }}>
                {l.label}
              </span>
              <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub }}>{l.sub}</span>
            </button>
          ))}
        </Card>
      </div>
    </Screen>
  );
}
