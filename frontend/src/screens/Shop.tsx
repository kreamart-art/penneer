// Shop — reached via the cart icon on the Landing. First product: the AI
// referee for your own rooms. Payments are not wired yet, so the buy button
// is a "coming soon" state; the layout is ready for a real checkout.
import { ArrowLeft, Bot, Check, ShoppingCart } from "lucide-react";
import { Screen, Card } from "../components/Layout";
import { Button } from "../components/Button";
import { MusicToggle } from "../components/MusicToggle";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

export function Shop({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t } = useT();
  const aiActive = !!game.state.room?.ai_referee || !!game.state.adminAi?.enabled;

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
            <ArrowLeft size={20} />
          </button>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>
            <ShoppingCart size={17} color={colors.gold} /> {t("shopTitle")}
          </span>
          <div style={{ marginLeft: "auto" }}>
            <MusicToggle />
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: withAlpha(colors.gold, 0.14), border: `1px solid ${withAlpha(colors.gold, 0.45)}`, color: colors.gold }}>
              <Bot size={26} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("shopAiTitle")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("shopAiTag")}</div>
            </div>
          </div>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("shopAiBody")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[t("shopAiPoint1"), t("shopAiPoint2"), t("shopAiPoint3")].map((p) => (
              <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.ui, fontSize: 13, color: colors.ink }}>
                <Check size={14} color={colors.green} /> {p}
              </span>
            ))}
          </div>
          {aiActive ? (
            <div style={{ textAlign: "center", padding: "10px 0 2px", fontFamily: font.ui, fontSize: 13.5, color: colors.green }}>
              {t("shopAiActive")}
            </div>
          ) : (
            <Button variant="gold" full disabled>
              {t("shopSoon")}
            </Button>
          )}
        </Card>

        <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>
          {t("shopFootnote")}
        </p>
      </div>
    </Screen>
  );
}
