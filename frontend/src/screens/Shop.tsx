// Shop — reached via the cart icon on the Landing. Sells ONE thing: the AI
// referee for your own rooms, unlocked per account (never admin). Two ways to
// unlock: pay with PayPal, or redeem a code the owner handed out. The unlock is
// tied to your profile, so a profile is required.
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, Check, ShoppingCart, Ticket } from "lucide-react";
import { Screen, Card } from "../components/Layout";
import { Button } from "../components/Button";
import { MusicToggle } from "../components/MusicToggle";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

interface ShopStatus {
  enabled: boolean;
  price: string;
  currency: string;
}

function priceLabel(s: ShopStatus | null): string {
  if (!s) return "";
  const sym = s.currency === "EUR" ? "€" : s.currency === "USD" ? "$" : s.currency + " ";
  return `${sym}${s.price.replace(".", ",")}`;
}

export function Shop({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const aiActive = !!account?.ai_unlocked || !!game.state.room?.ai_referee || !!game.state.adminAi?.enabled;
  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [code, setCode] = useState("");
  const [buying, setBuying] = useState(false);
  const shopResult = game.state.shopResult;

  useEffect(() => {
    let alive = true;
    fetch("/api/shop/status")
      .then((r) => r.json())
      .then((s) => alive && setStatus(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Clear a stale redeem result when leaving the screen.
  useEffect(() => () => game.clearShopResult(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const startPaypal = async () => {
    setBuying(true);
    try {
      const token = localStorage.getItem("penneer.accountToken") || "";
      const res = await fetch("/api/shop/paypal/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.approve_url) {
        window.location.href = data.approve_url; // off to PayPal, back via ?paypal=return
        return;
      }
    } catch {
      /* fall through to re-enable the button */
    }
    setBuying(false);
  };

  const redeem = () => {
    game.redeemAiCode(code);
    setCode("");
  };

  const resultMsg = shopResult
    ? shopResult.ok
      ? shopResult.reason === "already"
        ? t("shopAlready")
        : t("shopRedeemOk")
      : shopResult.reason === "used"
        ? t("shopCodeUsed")
        : shopResult.reason === "auth"
          ? t("shopNeedProfile")
          : t("shopCodeInvalid")
    : null;

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
            {status?.enabled && !aiActive && (
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.gold }}>{priceLabel(status)}</div>
            )}
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
          ) : !account ? (
            <div style={{ textAlign: "center", padding: "8px 0 2px", fontFamily: font.ui, fontSize: 13, color: colors.faint, lineHeight: 1.5 }}>
              {t("shopNeedProfile")}
            </div>
          ) : status?.enabled ? (
            <Button variant="gold" full disabled={buying} onClick={startPaypal}>
              {buying ? t("shopOpeningPaypal") : `${t("shopBuyPaypal")} · ${priceLabel(status)}`}
            </Button>
          ) : (
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>
              {t("shopPaypalSoon")}
            </div>
          )}
        </Card>

        {/* Redeem a code — always available to a logged-in account. */}
        {account && !aiActive && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.ui, fontSize: 13, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: colors.faint }}>
              <Ticket size={15} /> {t("shopHaveCode")}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); if (shopResult) game.clearShopResult(); }}
                placeholder={t("shopCodePlaceholder")}
                onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) redeem(); }}
                style={{ flex: 1, minWidth: 0, fontFamily: font.display, letterSpacing: 1.5, fontSize: 14, color: colors.ink, background: withAlpha("#000000", 0.25), border: `1.5px solid ${colors.panelBorder}`, borderRadius: 10, padding: "11px 12px", textTransform: "uppercase" }}
              />
              <Button variant="primary" disabled={!code.trim()} onClick={redeem}>
                {t("shopRedeem")}
              </Button>
            </div>
            {resultMsg && (
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: shopResult?.ok ? colors.green : colors.red }}>{resultMsg}</p>
            )}
          </Card>
        )}

        <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>
          {t("shopFootnotePaid")}
        </p>
      </div>
    </Screen>
  );
}
