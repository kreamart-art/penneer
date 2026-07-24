// Shop — reached via the cart icon on the Landing. Coin-driven:
//   - buy COINS with PayPal, in bundles (10 / 30 / 50 / 100)
//   - spend coins on single Draai-knoppen (bz01..bz05) and on avatar packs
//   - the AI referee is still bought with PayPal
// Coins are also earned by levelling (1/level + 5 per 10 levels). A code the
// owner handed out still unlocks the AI. A profile is required to own anything.
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, Check, ShoppingCart, Ticket } from "lucide-react";
import { Screen, Card } from "../components/Layout";
import { Button } from "../components/Button";
import { MusicToggle } from "../components/MusicToggle";
import { sound } from "../sound/sound";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

const AVATAR_ART_VERSION = 9;
// The five single Draai-knoppen for sale, with their country-name i18n keys.
const BUZZERS_FOR_SALE = [
  { id: "bz01", name: "shopBuzzNl" },
  { id: "bz02", name: "shopBuzzIt" },
  { id: "bz03", name: "shopBuzzSu" },
  { id: "bz04", name: "shopBuzzJm" },
  { id: "bz05", name: "shopBuzzBr" },
  { id: "bz13", name: "shopBuzzEs" },
];
// The two avatar packs (nine each), with three preview thumbnails apiece.
const AVATAR_PACKS = [
  { id: "avpack1", name: "shopAvPack1", preview: [19, 22, 25] },
  { id: "avpack2", name: "shopAvPack2", preview: [28, 31, 34] },
];

interface Bundle { product: string; coins: number; price: string }
interface ShopStatus {
  enabled: boolean;
  currency: string;
  ai_price?: string;
  price?: string; // legacy (= ai_price)
  bundles?: Bundle[];
  coin_prices?: Record<string, number>;
}

function money(value: string | undefined, currency: string): string {
  if (!value) return "";
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return `${sym}${value.replace(".", ",")}`;
}

// A coin amount with the coin icon, e.g. "8 [coin]".
function Coins({ n, color = colors.gold, size = 16 }: { n: number; color?: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.display, fontWeight: 700, fontSize: size - 1, color }}>
      {n}<img src="/coin.webp" alt="" width={size} height={size} style={{ display: "block" }} />
    </span>
  );
}

// One coin-bought item (a buzzer or an avatar pack): art, title, and a price
// pill you tap to buy (dimmed when you can't afford it; green when owned).
function CoinItem({ title, owned, price, coins, onBuy, children }: {
  title: string; owned: boolean; price: number; coins: number; onBuy: () => void; children: React.ReactNode;
}) {
  const { t } = useT();
  const affordable = coins >= price;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 10, borderRadius: 16, background: withAlpha("#000000", 0.22), border: `1px solid ${owned ? withAlpha(colors.green, 0.5) : colors.panelBorder}` }}>
      <div style={{ width: "100%", aspectRatio: "1 / 1", display: "grid", placeItems: "center", overflow: "hidden" }}>{children}</div>
      <span style={{ fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, color: colors.ink, textAlign: "center", lineHeight: 1.2 }}>{title}</span>
      {owned ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: font.ui, fontSize: 12.5, fontWeight: 700, color: colors.green }}>
          <Check size={14} /> {t("shopItemOwned")}
        </span>
      ) : (
        <button
          onClick={() => { if (affordable) { sound.uiTap(); onBuy(); } }}
          disabled={!affordable}
          aria-label={`${t("shopItemBuy")} ${title}`}
          className={affordable ? "pressable" : undefined}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 999,
            background: affordable ? withAlpha(colors.gold, 0.16) : withAlpha("#000000", 0.3),
            border: `1px solid ${affordable ? withAlpha(colors.gold, 0.5) : colors.panelBorder}`,
            cursor: affordable ? "pointer" : "default",
          }}
        >
          <Coins n={price} color={affordable ? colors.gold : colors.faint} size={15} />
        </button>
      )}
    </div>
  );
}

export function Shop({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const aiActive = !!account?.ai_unlocked || !!game.state.room?.ai_referee || !!game.state.adminAi?.enabled;
  const owned = new Set(account?.owned_items ?? []);
  const coins = account?.coins ?? 0;
  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [code, setCode] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const shopResult = game.state.shopResult;
  const prices = status?.coin_prices ?? {};

  useEffect(() => {
    let alive = true;
    fetch("/api/shop/status").then((r) => r.json()).then((s) => alive && setStatus(s)).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Clear a stale redeem result when leaving the screen.
  useEffect(() => () => game.clearShopResult(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const startPaypal = async (product: string) => {
    setBuying(product);
    try {
      const token = localStorage.getItem("penneer.accountToken") || "";
      const res = await fetch("/api/shop/paypal/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const data = await res.json();
      if (res.ok && data.approve_url) { window.location.href = data.approve_url; return; }
    } catch { /* fall through */ }
    setBuying(null);
  };

  const redeem = () => { game.redeemAiCode(code); setCode(""); };

  const resultMsg = shopResult
    ? shopResult.ok
      ? shopResult.reason === "already" ? t("shopAlready") : t("shopRedeemDone")
      : shopResult.reason === "used" ? t("shopCodeUsed")
        : shopResult.reason === "auth" ? t("shopNeedProfile") : t("shopCodeInvalid")
    : null;

  const buzzPrice = prices.bz01 ?? 8;
  const packPrice = prices.avpack1 ?? 40;

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
          {account && (
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px 4px 8px", borderRadius: 999, background: withAlpha(colors.gold, 0.12), border: `1px solid ${withAlpha(colors.gold, 0.4)}` }}>
              <img src="/coin.webp" alt="" width={20} height={20} style={{ display: "block" }} />
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: colors.gold }}>{coins}</span>
            </span>
          )}
          <div style={{ marginLeft: account ? 6 : "auto" }}><MusicToggle /></div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!account && (
          <Card><p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopNeedProfile")}</p></Card>
        )}

        {/* ---- Coins kopen (PayPal bundles) ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("shopCoinsHeader")}</div>
            <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("shopCoinsLead")}</div>
          </div>
          {status && !status.enabled ? (
            <Card><p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopPaypalSoon")}</p></Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {(status?.bundles ?? []).map((b, i) => (
                <div key={b.product} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px", borderRadius: 16, background: withAlpha("#000000", 0.22), border: `1px solid ${i === 3 ? withAlpha(colors.gold, 0.55) : colors.panelBorder}`, position: "relative" }}>
                  {i === 3 && <span style={{ position: "absolute", top: 8, right: 8, fontFamily: font.ui, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: colors.gold }}>{t("shopBestValue")}</span>}
                  <img src="/coins-stack.webp" alt="" style={{ width: 66, height: 66, objectFit: "contain", display: "block" }} />
                  <Coins n={b.coins} size={19} />
                  <Button variant="gold" full disabled={!account || buying !== null} onClick={() => startPaypal(b.product)}>
                    {buying === b.product ? t("shopOpeningPaypal") : money(b.price, status?.currency ?? "EUR")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Draai-knoppen (coins, single) ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("shopBuzzHeader")}</div>
            <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("shopBuzzLead")}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {BUZZERS_FOR_SALE.map((bz) => (
              <CoinItem key={bz.id} title={t(bz.name)} owned={owned.has(bz.id)} price={prices[bz.id] ?? buzzPrice} coins={coins} onBuy={() => game.buyItemCoins(bz.id)}>
                <img src={`/buzzers/${bz.id}.webp`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
              </CoinItem>
            ))}
          </div>
        </div>

        {/* ---- Avatar-packs (coins) ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("shopAvatarsHeader")}</div>
            <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("shopAvatarsLead")}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {AVATAR_PACKS.map((pk) => (
              <CoinItem key={pk.id} title={t(pk.name)} owned={owned.has(pk.id)} price={prices[pk.id] ?? packPrice} coins={coins} onBuy={() => game.buyItemCoins(pk.id)}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, width: "100%" }}>
                  {pk.preview.map((n) => (
                    <div key={n} style={{ aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", border: `1px solid ${colors.panelBorder}` }}>
                      <img src={`/avatars/av${n}.jpg?v=${AVATAR_ART_VERSION}`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                  ))}
                </div>
              </CoinItem>
            ))}
          </div>
        </div>

        {/* ---- AI referee (PayPal) ---- */}
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
          ) : !account ? null : status?.enabled ? (
            <Button variant="gold" full disabled={buying !== null} onClick={() => startPaypal("ai")}>
              {buying === "ai" ? t("shopOpeningPaypal") : `${t("shopBuyPaypal")} · ${money(status.ai_price ?? status.price, status.currency)}`}
            </Button>
          ) : (
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopPaypalSoon")}</div>
          )}
        </Card>

        {/* Redeem an AI code. */}
        {!!account && (
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
            {resultMsg && <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: shopResult?.ok ? colors.green : colors.red }}>{resultMsg}</p>}
          </Card>
        )}

        <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopFootnotePaid")}</p>
      </div>
    </Screen>
  );
}
