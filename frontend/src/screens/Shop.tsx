// Shop — reached via the cart icon on the Landing. Coin-driven:
//   - buy COINS with PayPal, in bundles (10 / 30 / 50 / 100)
//   - spend coins on single Draai-knoppen (bz01..bz05) and on avatar packs
//   - the AI referee is still bought with PayPal
// Coins are also earned by levelling (1/level + 5 per 10 levels). A code the
// owner handed out still unlocks the AI. A profile is required to own anything.
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, Check, ListChecks, ShoppingCart, Ticket } from "lucide-react";
import { Screen, Card } from "../components/Layout";
import { Button } from "../components/Button";
import { MusicToggle } from "../components/MusicToggle";
import { sound } from "../sound/sound";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { EMOTE_PACKS_FOR_SALE, EMOTE_SRC } from "../components/emotes";
import { reelClip, reelEdge, reelFace, reelTheme } from "../theme/reelSkins";
import { colors, font, withAlpha } from "../theme/tokens";
import { useTileSkin } from "../theme/tileSkin";
import { PilKeuze } from "./Hub";
import { KADER_LIJN_GROEN, NeonKader, Paneel } from "../components/ProfileHero";
import { CoinPlate } from "../components/CoinPlate";

const AVATAR_ART_VERSION = 9;
// The five single Draai-knoppen for sale, with their country-name i18n keys.
const BUZZERS_FOR_SALE = [
  { id: "bz01", name: "shopBuzzNl" },
  { id: "bz02", name: "shopBuzzIt" },
  { id: "bz03", name: "shopBuzzSu" },
  { id: "bz04", name: "shopBuzzJm" },
  { id: "bz05", name: "shopBuzzBr" },
  { id: "bz13", name: "shopBuzzEs" },
  { id: "bz14", name: "shopBuzzCw" },
  { id: "bz15", name: "shopBuzzDe" },
  { id: "bz16", name: "shopBuzzBe" },
  { id: "bz17", name: "shopBuzzFr" },
];
// Reel themes (the letter roulette): drawn in code, so the tile IS the preview.
const REELS_FOR_SALE = [
  { id: "rs01", name: "reelNeon" },
  { id: "rs02", name: "reelVuur" },
  { id: "rs03", name: "reelIjs" },
  { id: "rs04", name: "reelCasino" },
  { id: "rs05", name: "reelSmaragd" },
  { id: "rs06", name: "reelRoyal" },
  { id: "rs07", name: "reelCandy" },
  { id: "rs08", name: "reelToxic" },
  { id: "rs09", name: "reelMiddernacht" },
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
function CoinItem({ title, owned, price, coins, index, veeg, onBuy, children }: {
  title: string; owned: boolean; price: number; coins: number; index?: number; veeg?: boolean; onBuy: () => void; children: React.ReactNode;
}) {
  const { t } = useT();
  const affordable = coins >= price;
  return (
    <GlasVak groen={owned} index={index} veeg={veeg}>
      <div style={{ width: "100%", aspectRatio: "1 / 1", display: "grid", placeItems: "center", overflow: "hidden" }}>{children}</div>
      <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, color: colors.ink, textAlign: "center", lineHeight: 1.15 }}>{title}</span>
      {owned ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: colors.green }}>
          <Check size={13} /> {t("shopItemOwned")}
        </span>
      ) : (
        <button
          onClick={() => { if (affordable) { sound.uiTap(); onBuy(); } }}
          disabled={!affordable}
          aria-label={`${t("shopItemBuy")} ${title}`}
          className={affordable ? "pressable" : undefined}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 999,
            background: affordable ? withAlpha(colors.gold, 0.16) : withAlpha("#000000", 0.3),
            border: `1px solid ${affordable ? withAlpha(colors.gold, 0.5) : colors.panelBorder}`,
            cursor: affordable ? "pointer" : "default",
          }}
        >
          <Coins n={price} color={affordable ? colors.gold : colors.faint} size={14} />
        </button>
      )}
    </GlasVak>
  );
}

/** Een productvakje in glas. Dezelfde behandeling als een rij in de
 *  vriendenlijst, alleen dan rechthoekig: de afgeschuinde hoek, de lijn op een
 *  derde sterkte en de gouden kappen op de schuine kanten. De neonlijn hoort om
 *  de SECTIE en niet ook nog om elk vakje erin, want dan zie je een raster van
 *  kaders in plaats van een sectie met inhoud. */
function GlasVak({ groen, index = 0, veeg, children }: { groen?: boolean; index?: number; veeg?: boolean; children: React.ReactNode }) {
  return (
    <NeonKader
      hoek={11}
      dik={0.3}
      sterkte={groen ? 0.6 : 0.3}
      vulling="geen"
      eindkap="kort"
      // Ademen doet elk vakje, maar elk met een EIGEN fase en een eigen tempo.
      // Een fase van `index % n` valt in een raster van drie kolommen precies
      // samen met de kolom eronder, en dan pulseert de hele kolom in de maat.
      // De gulden snede (0,618) verdeelt elk aantal zo gelijkmatig mogelijk
      // zonder ooit te herhalen, dus daarmee ligt geen enkel vakje op hetzelfde
      // punt als zijn buurman.
      adem={((index * 0.618034) % 1) * 4.2}
      ademDuur={3.3 + ((index * 0.381966) % 1) * 2.2}
      veeg={veeg}
      lijn={groen ? KADER_LIJN_GROEN : undefined}
      gloed={groen ? `0 0 10px ${withAlpha(colors.green, 0.25)}` : undefined}
      binnen={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "7px 6px 8px", height: "100%", boxSizing: "border-box" }}
      style={{ height: "100%" }}
    >
      {children}
    </NeonKader>
  );
}

/** Om de paar tellen springt de lichtveeg naar een ander vakje. Hij hoort bij
 *  een item omdat het even aan de beurt is, niet omdat je het aanraakt: een
 *  effect dat op je tik reageert leest als een bevestiging, en dat is het niet.
 *  `n` is hoeveel vakjes er in beeld staan; de teller loopt daarlangs rond. */
function useVeegBeurt(n: number): number {
  const [beurt, setBeurt] = useState(0);
  useEffect(() => {
    if (n < 2) return;
    const id = window.setInterval(() => setBeurt((b) => (b + 1) % n), 5200);
    return () => window.clearInterval(id);
  }, [n]);
  return n > 0 ? beurt % n : 0;
}

// A mini reel in the given theme — the shop preview for a rol-skin (the real
// reel is code-drawn, so the preview is too).
// Vaste maat: de vorm van de rol is een `path()` en die schaalt niet mee.
const SWATCH = { w: 68, h: 79, ...reelClip(68, 79) };

function ReelSwatch({ id }: { id: string }) {
  const th = reelTheme(id);
  // Zelfde opbouw als de echte rol: de rand is een laag met het verloop eronder,
  // en de letter draagt hetzelfde verloop. Een egale rand met een egale letter
  // laat de skin er in de winkel anders uitzien dan in het spel.
  return (
    <div
      style={{
        width: SWATCH.w, height: SWATCH.h, padding: 2,
        clipPath: SWATCH.outer,
        background: reelEdge(th.ramp),
        boxShadow: `0 0 14px ${withAlpha(th.glow, 0.45)}`,
      }}
    >
      <div
        style={{
          width: "100%", height: "100%", clipPath: SWATCH.inner, background: th.bg,
          boxShadow: `inset 0 0 22px ${withAlpha(th.ramp[2], 0.28)}, inset 0 4px 12px rgba(0,0,0,.6)`,
          display: "grid", placeItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: font.display, fontWeight: 700, fontSize: 34, lineHeight: 1,
            backgroundImage: reelFace(th.ramp),
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            textShadow: "-1px -1px 0 rgba(255,255,255,.3)",
          }}
        >
          A
        </span>
      </div>
    </div>
  );
}

export function Shop({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const aiActive = !!account?.ai_unlocked || !!game.state.room?.ai_referee || !!game.state.adminAi?.enabled;
  const owned = new Set(account?.owned_items ?? []);
  const coins = account?.coins ?? 0;
  const skin = useTileSkin();
  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [code, setCode] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const shopResult = game.state.shopResult;
  const prices = status?.coin_prices ?? {};
  // Welk vak van de winkel je open hebt. De AI staat erbuiten, want die staat
  // altijd bovenaan.
  const [vak, setVak] = useState<"coins" | "cats" | "buzzers" | "reels" | "emotes" | "avatars">("coins");
  // Wie de AI al heeft ziet hem niet meer in de winkel. Op het testaccount
  // blijft hij staan, want daar wordt het uiterlijk gecontroleerd.
  const testAccount = (account?.name ?? "").toLowerCase().startsWith("kream");
  const toonAi = !aiActive || testAccount;

  useEffect(() => {
    let alive = true;
    fetch("/api/shop/status").then((r) => r.json()).then((s) => alive && setStatus(s)).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Eigen categorieen komen van de server: de admin maakt ze, dus ze kunnen niet
  // in een lijst in de code staan. Alleen de betaalde verschijnen in de winkel;
  // gratis categorieen heeft iedereen al.
  const [cats, setCats] = useState<{ id: string; name: string; price: number; checked: boolean; owned: boolean }[]>([]);
  const reloadCats = () => {
    const tok = localStorage.getItem("penneer.accountToken");
    fetch("/api/categories", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => r.json())
      .then((d) => setCats(d.categories ?? []))
      .catch(() => {});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reloadCats, [account?.id, account?.owned_items?.length]);
  const catsForSale = cats.filter((c) => c.price > 0);

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

  // Hoeveel vakjes er in het geopende vak staan; daarlangs loopt de veeg rond.
  const aantal =
    vak === "coins" ? (status?.bundles ?? []).length
    : vak === "cats" ? catsForSale.length
    : vak === "buzzers" ? BUZZERS_FOR_SALE.length
    : vak === "reels" ? REELS_FOR_SALE.length
    : vak === "emotes" ? EMOTE_PACKS_FOR_SALE.length
    : AVATAR_PACKS.length;
  const beurt = useVeegBeurt(aantal);

  const tabs = [
    { key: "coins" as const, label: t("shopTabCoins") },
    { key: "buzzers" as const, label: t("shopTabBuzzers") },
    { key: "reels" as const, label: t("shopTabReels") },
    { key: "emotes" as const, label: t("shopTabEmotes") },
    { key: "avatars" as const, label: t("shopTabAvatars") },
    ...(catsForSale.length > 0 ? [{ key: "cats" as const, label: t("shopTabCats") }] : []),
  ];

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
          {account &&
            (skin ? (
              <span style={{ marginLeft: "auto" }}>
                <CoinPlate coins={coins} height={32} />
              </span>
            ) : (
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px 4px 8px", borderRadius: 999, background: withAlpha(colors.gold, 0.12), border: `1px solid ${withAlpha(colors.gold, 0.4)}` }}>
                <img src="/coin.webp" alt="" width={20} height={20} style={{ display: "block" }} />
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: colors.gold }}>{coins}</span>
              </span>
            ))}
          <div style={{ marginLeft: account ? 6 : "auto" }}><MusicToggle /></div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {!account && (
          <Card><p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopNeedProfile")}</p></Card>
        )}

        {/* De AI-scheidsrechter staat BOVEN de tabjes. Hij is het enige in de
            winkel dat het spel zelf verandert, de rest is uiterlijk. En wie hem
            al heeft ziet hem niet meer: iets wat je bezit hoort niet in een
            winkel te blijven staan. */}
        {toonAi && (
          <Paneel>
            <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, padding: "6px 10px 2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: withAlpha(colors.gold, 0.14), border: `1px solid ${withAlpha(colors.gold, 0.45)}`, color: colors.gold, flexShrink: 0 }}>
                  <Bot size={19} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15.5, lineHeight: 1.15, color: colors.ink }}>{t("shopAiTitle")}</div>
                  <div style={{ fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.25, color: colors.faint }}>{t("shopAiTag")}</div>
                </div>
              </div>
              {/* De opsomming van drie punten is weg: die zegt hetzelfde als de
                  regel eronder, en het paneel heeft een vaste hoogte. */}
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12, color: colors.sub, lineHeight: 1.4 }}>{t("shopAiBody")}</p>
              {aiActive ? (
                <div style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.green }}>{t("shopAiActive")}</div>
              ) : !account ? null : (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Button variant="gold" full compact style={{ padding: "4px 10px", fontSize: 12, width: "min(100%, 150px)" }} disabled={buying !== null || !status?.enabled} onClick={() => startPaypal("ai")}>
                    {buying === "ai" ? t("shopOpeningPaypal") : money(status?.ai_price ?? status?.price, status?.currency ?? "EUR")}
                  </Button>
                </div>
              )}
              {!aiActive && status && !status.enabled && (
                <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 10, color: colors.faint, lineHeight: 1.25 }}>{t("shopPaypalSoon")}</p>
              )}
            </div>
          </Paneel>
        )}

        {/* De winkel was zes secties onder elkaar en dus een rol van een halve
            meter. Nu kies je er een met de pil en is de pagina zo lang als die
            ene sectie. */}
        <PilKeuze schuif actief={vak} onKies={setVak} opties={tabs} />

        {vak === "coins" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopCoinsHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopCoinsLead")}</div>
            </div>
            {/* De vakjes staan er ALTIJD, ook zolang betalen nog niet aanstaat.
                Je moet kunnen zien wat er te koop komt; de melding erboven zegt
                dat het nog niet kan en de knoppen staan dan uit. */}
            {status && !status.enabled && (
              <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 11.5, color: colors.faint, lineHeight: 1.35 }}>{t("shopPaypalSoon")}</p>
            )}
            <Card style={{ padding: "9px 8px 10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {(status?.bundles ?? []).map((b, i) => (
                  <GlasVak key={b.product} index={i} veeg={i === beurt}>
                    {i === 3 && <span style={{ position: "absolute", top: 5, right: 10, fontFamily: font.ui, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: colors.gold }}>{t("shopBestValue")}</span>}
                    <img src="/coins-stack.webp" alt="" style={{ width: 44, height: 44, objectFit: "contain", display: "block" }} />
                    <Coins n={b.coins} size={16} />
                    <Button variant="gold" full compact style={{ padding: "5px 8px", fontSize: 12 }} disabled={!account || buying !== null || !status?.enabled} onClick={() => startPaypal(b.product)}>
                      {buying === b.product ? t("shopOpeningPaypal") : money(b.price, status?.currency ?? "EUR")}
                    </Button>
                  </GlasVak>
                ))}
              </div>
            </Card>
          </div>
        )}

        {vak === "cats" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopCatsHeader")}</div>
                <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopCatsLead")}</div>
              </div>
              <Card style={{ padding: "9px 8px 10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {catsForSale.map((c, i) => (
                    <CoinItem
                      key={c.id}
                      title={c.name}
                      owned={c.owned || owned.has(`cat:${c.id}`)}
                      price={c.price}
                      coins={coins}
                      index={i}
                    veeg={i === beurt}
                    onBuy={() => game.buyItemCoins(`cat:${c.id}`)}
                    >
                      <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", gap: 3 }}>
                        <ListChecks size={26} color={colors.gold} />
                        <span style={{ fontFamily: font.ui, fontSize: 10, color: colors.faint }}>
                          {c.checked ? t("catChecked") : t("catOpenList")}
                        </span>
                      </div>
                    </CoinItem>
                  ))}
                </div>
              </Card>
            </div>
        )}

        {vak === "buzzers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopBuzzHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopBuzzLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {BUZZERS_FOR_SALE.map((bz, i) => (
                  <CoinItem key={bz.id} title={t(bz.name)} owned={owned.has(bz.id)} price={prices[bz.id] ?? buzzPrice} coins={coins} index={i} veeg={i === beurt} onBuy={() => game.buyItemCoins(bz.id)}>
                    <img src={`/buzzers/${bz.id}.webp`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  </CoinItem>
                ))}
              </div>
            </Card>
          </div>
        )}

        {vak === "reels" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopReelsHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopReelsLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {REELS_FOR_SALE.map((rs, i) => (
                  <CoinItem key={rs.id} title={t(rs.name)} owned={owned.has(rs.id)} price={prices[rs.id] ?? 100} coins={coins} index={i} veeg={i === beurt} onBuy={() => game.buyItemCoins(rs.id)}>
                    <ReelSwatch id={rs.id} />
                  </CoinItem>
                ))}
              </div>
            </Card>
          </div>
        )}

        {vak === "emotes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopEmotesHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopEmotesLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {EMOTE_PACKS_FOR_SALE.map((pk, i) => (
                  <CoinItem key={pk.id} title={t(pk.name)} owned={owned.has(pk.id)} price={prices[pk.id] ?? 200} coins={coins} index={i} veeg={i === beurt} onBuy={() => game.buyItemCoins(pk.id)}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, width: "100%" }}>
                      {pk.emotes.slice(0, 6).map((id) => (
                        <img key={id} src={EMOTE_SRC(id)} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "contain", display: "block" }} />
                      ))}
                    </div>
                  </CoinItem>
                ))}
              </div>
            </Card>
          </div>
        )}

        {vak === "avatars" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopAvatarsHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopAvatarsLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {AVATAR_PACKS.map((pk, i) => (
                  <CoinItem key={pk.id} title={t(pk.name)} owned={owned.has(pk.id)} price={prices[pk.id] ?? packPrice} coins={coins} index={i} veeg={i === beurt} onBuy={() => game.buyItemCoins(pk.id)}>
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
            </Card>
          </div>
        )}

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
