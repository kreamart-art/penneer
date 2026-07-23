// Shop — reached via the cart icon on the Landing. Sells two things, each
// unlocked per account (never admin), tied to your profile:
//   1. the AI referee for your own rooms
//   2. the premium avatar pack (av19..av36)
//   3. the buzzer-skin pack (bz01..bz05, more skins coming)
// Two ways to unlock either: pay with PayPal, or redeem a code the owner handed
// out (the code carries which product it unlocks). A profile is required.
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, Check, CircleDot, ShoppingCart, Sparkles, Ticket } from "lucide-react";
import { Screen, Card } from "../components/Layout";
import { Button } from "../components/Button";
import { MusicToggle } from "../components/MusicToggle";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

// Preview thumbnails for the premium pack (first six of av19..av36).
const AVATAR_PREVIEW = [19, 20, 24, 27, 28, 34].map((n) => `av${n}`);
const AVATAR_ART_VERSION = 9;
// Preview thumbnails for the buzzer-skin pack.
const BUZZER_PREVIEW = ["bz01", "bz02", "bz03", "bz04", "bz05"];

interface ShopStatus {
  enabled: boolean;
  currency: string;
  ai_price?: string;
  avatars_price?: string;
  buzzers_price?: string;
  coins_price?: string;
  price?: string; // legacy (= ai_price)
}

function money(value: string | undefined, currency: string): string {
  if (!value) return "";
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return `${sym}${value.replace(".", ",")}`;
}

export function Shop({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const aiActive = !!account?.ai_unlocked || !!game.state.room?.ai_referee || !!game.state.adminAi?.enabled;
  const avatarsOwned = !!account?.premium_avatars;
  const buzzersOwned = !!account?.buzzer_skins;
  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [code, setCode] = useState("");
  const [buying, setBuying] = useState<"ai" | "avatars" | "buzzers" | "coins" | null>(null);
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

  const startPaypal = async (product: "ai" | "avatars" | "buzzers" | "coins") => {
    setBuying(product);
    try {
      const token = localStorage.getItem("penneer.accountToken") || "";
      const res = await fetch("/api/shop/paypal/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const data = await res.json();
      if (res.ok && data.approve_url) {
        window.location.href = data.approve_url; // off to PayPal, back via ?paypal=return
        return;
      }
    } catch {
      /* fall through to re-enable the button */
    }
    setBuying(null);
  };

  const redeem = () => {
    game.redeemAiCode(code);
    setCode("");
  };

  const resultMsg = shopResult
    ? shopResult.ok
      ? shopResult.reason === "already"
        ? t("shopAlready")
        : t("shopRedeemDone")
      : shopResult.reason === "used"
        ? t("shopCodeUsed")
        : shopResult.reason === "auth"
          ? t("shopNeedProfile")
          : t("shopCodeInvalid")
    : null;

  // The redeem box is useful as long as at least one product is still locked.
  const showRedeem = !!account && (!aiActive || !avatarsOwned || !buzzersOwned);

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
        {/* ---- Coins (the currency) ---- */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/coin.webp" alt="" width={46} height={46} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("shopCoinsTitle")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("shopCoinsTag")}</div>
            </div>
            {account && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.gold }}>
                {account.coins ?? 0}<img src="/coin.webp" alt="" width={18} height={18} />
              </div>
            )}
          </div>
          <img src="/coins-stack.webp" alt="" style={{ width: "62%", maxWidth: 220, alignSelf: "center", display: "block" }} />
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("shopCoinsBody")}</p>
          {!account ? (
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontFamily: font.ui, fontSize: 13, color: colors.faint, lineHeight: 1.5 }}>{t("shopNeedProfile")}</div>
          ) : status?.enabled ? (
            <Button variant="gold" full disabled={buying !== null} onClick={() => startPaypal("coins")}>
              {buying === "coins" ? t("shopOpeningPaypal") : `${t("shopCoinsBuy")} · ${money(status.coins_price, status.currency)}`}
            </Button>
          ) : (
            <div style={{ textAlign: "center", padding: "4px 0 2px", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopPaypalSoon")}</div>
          )}
        </Card>

        {/* ---- AI referee ---- */}
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
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.gold }}>{money(status.ai_price ?? status.price, status.currency)}</div>
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
            <div style={{ textAlign: "center", padding: "10px 0 2px", fontFamily: font.ui, fontSize: 13.5, color: colors.green }}>{t("shopAiActive")}</div>
          ) : !account ? (
            <div style={{ textAlign: "center", padding: "8px 0 2px", fontFamily: font.ui, fontSize: 13, color: colors.faint, lineHeight: 1.5 }}>{t("shopNeedProfile")}</div>
          ) : status?.enabled ? (
            <Button variant="gold" full disabled={buying !== null} onClick={() => startPaypal("ai")}>
              {buying === "ai" ? t("shopOpeningPaypal") : `${t("shopBuyPaypal")} · ${money(status.ai_price ?? status.price, status.currency)}`}
            </Button>
          ) : (
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopPaypalSoon")}</div>
          )}
        </Card>

        {/* ---- Premium avatars ---- */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: withAlpha(colors.violet, 0.16), border: `1px solid ${withAlpha(colors.violet, 0.5)}`, color: colors.violet }}>
              <Sparkles size={24} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("shopAvatarsTitle")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("shopAvatarsTag")}</div>
            </div>
            {status?.enabled && !avatarsOwned && (
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.gold }}>{money(status.avatars_price, status.currency)}</div>
            )}
          </div>

          {/* preview strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
            {AVATAR_PREVIEW.map((id) => (
              <div key={id} style={{ aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", border: `1px solid ${colors.panelBorder}` }}>
                <img src={`/avatars/${id}.jpg?v=${AVATAR_ART_VERSION}`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>

          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("shopAvatarsBody")}</p>

          {avatarsOwned ? (
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontFamily: font.ui, fontSize: 13.5, color: colors.green }}>{t("shopAvatarsActive")}</div>
          ) : !account ? (
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontFamily: font.ui, fontSize: 13, color: colors.faint, lineHeight: 1.5 }}>{t("shopNeedProfile")}</div>
          ) : status?.enabled ? (
            <Button variant="gold" full disabled={buying !== null} onClick={() => startPaypal("avatars")}>
              {buying === "avatars" ? t("shopOpeningPaypal") : `${t("shopBuyPaypal")} · ${money(status.avatars_price, status.currency)}`}
            </Button>
          ) : (
            <div style={{ textAlign: "center", padding: "4px 0 2px", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopPaypalSoon")}</div>
          )}
        </Card>

        {/* ---- Buzzer skins ---- */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: withAlpha(colors.red, 0.14), border: `1px solid ${withAlpha(colors.red, 0.45)}`, color: colors.red }}>
              <CircleDot size={24} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("shopBuzzTitle")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("shopBuzzTag")}</div>
            </div>
            {!buzzersOwned && account && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.gold }}>
                {account.coins_pack_price ?? 25}<img src="/coin.webp" alt="" width={18} height={18} />
              </div>
            )}
          </div>

          {/* preview strip: the five skins */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {BUZZER_PREVIEW.map((id) => (
              <div key={id} style={{ aspectRatio: "1 / 1", display: "grid", placeItems: "center" }}>
                <img src={`/buzzers/${id}.webp`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
              </div>
            ))}
          </div>

          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("shopBuzzBody")}</p>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, fontStyle: "italic", color: colors.gold }}>{t("shopBuzzMore")}</p>

          {buzzersOwned ? (
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontFamily: font.ui, fontSize: 13.5, color: colors.green }}>{t("shopBuzzActive")}</div>
          ) : !account ? (
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontFamily: font.ui, fontSize: 13, color: colors.faint, lineHeight: 1.5 }}>{t("shopNeedProfile")}</div>
          ) : (account.coins ?? 0) >= (account.coins_pack_price ?? 25) ? (
            <Button variant="gold" full onClick={() => { game.buyPackCoins(); }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {t("shopBuzzBuyCoins", { n: account.coins_pack_price ?? 25 })}<img src="/coin.webp" alt="" width={17} height={17} />
              </span>
            </Button>
          ) : (
            <div style={{ textAlign: "center", padding: "4px 0 2px", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>
              {t("shopBuzzNeedCoins", { n: account.coins_pack_price ?? 25, have: account.coins ?? 0 })}
            </div>
          )}
        </Card>

        {/* Redeem a code — works for either product (the code carries which). */}
        {showRedeem && (
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
              <Button variant="primary" disabled={!code.trim()} onClick={redeem}>{t("shopRedeem")}</Button>
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
