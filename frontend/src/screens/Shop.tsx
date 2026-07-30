// Shop — reached via the cart icon on the Landing. Coin-driven:
//   - buy COINS with PayPal, in bundles (10 / 30 / 50 / 100)
//   - spend coins on single Draai-knoppen (bz01..bz05) and on avatar packs
//   - the AI referee is still bought with PayPal
// Coins are also earned by levelling (1/level + 5 per 10 levels). A code the
// owner handed out still unlocks the AI. A profile is required to own anything.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ListChecks, Lock } from "lucide-react";
import { Screen, Card } from "../components/Layout";
import { sound } from "../sound/sound";
import type { GameApi } from "../net/socket";
import { SchermTip } from "../components/SchermTip";
import { useT } from "../i18n/i18n";
import { EMOTE_PACKS_FOR_SALE, EMOTE_SRC } from "../components/emotes";
import { reelClip, reelEdge, reelFace, reelTheme } from "../theme/reelSkins";
import { colors, font, withAlpha, GROEN } from "../theme/tokens";
import { useTileSkin } from "../theme/tileSkin";
import { NeonKader, Paneel } from "../components/ProfileHero";
import { GlasVeld } from "../components/GlasVeld";
import { KnopPlaat } from "../components/KnopPlaat";
import { CashPlate, CoinPlate } from "../components/CoinPlate";
import { SHOP_DROP } from "../components/BottomNav";

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
  // Alle negen, niet drie: een pack van negen waarvan je er drie ziet, verkoopt
  // een derde. Het raster is 3x3, net als bij de stickers.
  { id: "avpack1", name: "shopAvPack1", preview: [19, 20, 21, 22, 23, 24, 25, 26, 27] },
  { id: "avpack2", name: "shopAvPack2", preview: [28, 29, 30, 31, 32, 33, 34, 35, 36] },
];

interface Bundle { product: string; coins: number; price: string }
/* De negen producten: vier coin-bundels, vier cash-bundels en het startpakket
 * dat allebei geeft. Elk product weet zelf hoeveel van welke munt het uitkeert,
 * zodat de tegel de juiste zak kan tonen zonder de naam te hoeven raden. */
interface Product { product: string; coins: number; cash: number; price: string }
interface CashBundle { product: string; cash: number; price: string }
interface ShopStatus {
  enabled: boolean;
  currency: string;
  ai_price?: string;
  price?: string; // legacy (= ai_price)
  bundles?: Bundle[];
  producten?: Product[];
  coin_bundles?: Bundle[];
  cash_bundles?: CashBundle[];
  coin_prices?: Record<string, number>;
  cash_prices?: Record<string, number>;
  land_buzzers?: Record<string, string>;
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
function CoinItem({ title, owned, price, coins, cashPrice, cash, slot, index, veeg, onBuy, onBuyCash, children }: {
  title: string; owned: boolean; price: number; coins: number;
  cashPrice?: number; cash?: number;
  // `slot` = wel te zien, maar niet met COINS te koop: de landenknoppen van
  // andere landen. Die koop je met cash, of je zet je land om.
  slot?: boolean;
  index?: number; veeg?: boolean; onBuy: () => void; onBuyCash?: () => void; children: React.ReactNode;
}) {
  const { t } = useT();
  const affordable = !slot && coins >= price;
  const cashAf = cashPrice != null && (cash ?? 0) >= cashPrice;
  return (
    <GlasVak index={index} veeg={veeg}>
      <div style={{ width: "100%", aspectRatio: "1 / 1", display: "grid", placeItems: "center", overflow: "hidden" }}>{children}</div>
      <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, color: colors.ink, textAlign: "center", lineHeight: 1.15 }}>{title}</span>
      {owned ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: colors.green }}>
          <Check size={13} /> {t("shopItemOwned")}
        </span>
      ) : (
        // Twee prijzen naast elkaar: coins links, cash rechts. Bijna alles is
        // met allebei te betalen. Wat NIET met coins kan (een landenknop van
        // een ander land) laat zijn coin-prijs zien met een slotje, zodat je
        // ziet dat hij bestaat en hoe je hem opent.
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => { if (affordable) { sound.uiTap(); onBuy(); } }}
            disabled={!affordable}
            aria-label={`${t("shopItemBuy")} ${title}`}
            className={affordable ? "pressable" : undefined}
            title={slot ? t("landBuzzerSlot") : undefined}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 999,
              background: affordable ? withAlpha(colors.gold, 0.16) : withAlpha("#000000", 0.3),
              border: `1px solid ${affordable ? withAlpha(colors.gold, 0.5) : colors.panelBorder}`,
              cursor: affordable ? "pointer" : "default",
            }}
          >
            {slot && <Lock size={10} color={colors.faint} />}
            <Coins n={price} color={affordable ? colors.gold : colors.faint} size={13} />
          </button>
          {cashPrice != null && onBuyCash && (
            <button
              onClick={() => { if (cashAf) { sound.uiTap(); onBuyCash(); } }}
              disabled={!cashAf}
              aria-label={`${t("shopItemBuy")} ${title}`}
              className={cashAf ? "pressable" : undefined}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 999,
                background: cashAf ? withAlpha(GROEN[2], 0.16) : withAlpha("#000000", 0.3),
                border: `1px solid ${cashAf ? withAlpha(GROEN[2], 0.5) : colors.panelBorder}`,
                cursor: cashAf ? "pointer" : "default",
              }}
            >
              <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 12.5, color: cashAf ? GROEN[3] : colors.faint }}>{cashPrice}</span>
              <img src="/ui/valuta/cash.webp?v=1" alt="" width={13} height={13} style={{ display: "block", opacity: cashAf ? 1 : 0.45 }} />
            </button>
          )}
        </div>
      )}
    </GlasVak>
  );
}

/** Een productvakje in glas. Dezelfde behandeling als een rij in de
 *  vriendenlijst, alleen dan rechthoekig: de afgeschuinde hoek, de lijn op een
 *  derde sterkte en de gouden kappen op de schuine kanten. De neonlijn hoort om
 *  de SECTIE en niet ook nog om elk vakje erin, want dan zie je een raster van
 *  kaders in plaats van een sectie met inhoud. */
function GlasVak({ index = 0, veeg, children }: { index?: number; veeg?: boolean; children: React.ReactNode }) {
  return (
    <NeonKader
      hoek={11}
      dik={0.3}
      sterkte={0.3}
      vulling="geen"
      eindkap="kort"
      // Ademen doet elk vakje, maar elk met een EIGEN fase, een eigen tempo en
      // een eigen plek voor het lichtpunt. Een fase van `index % n` valt in een
      // raster van drie kolommen precies samen met de kolom eronder, en dan
      // pulseert de hele kolom in de maat; een piek die overal op vijftig staat
      // maakt er bovendien een patroon van. De gulden snede (0,618) verdeelt
      // elk aantal zo gelijkmatig mogelijk zonder ooit te herhalen, dus daarmee
      // ligt geen enkel vakje op hetzelfde punt als zijn buurman.
      adem={((index * 0.618034) % 1) * 4.2}
      ademDuur={3.3 + ((index * 0.381966) % 1) * 2.2}
      kernPlek={30 + ((index * 0.7548777) % 1) * 40}
      veeg={veeg}
      // Lucht tot de wand van de sectie: een vakje dat tegen de rand aan zit
      // leest als een vlak dat tegen een lijn botst in plaats van als iets dat
      // erin ligt.
      binnen={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "7px 6px 8px", height: "100%", boxSizing: "border-box" }}
      style={{ height: "100%", marginInline: 2 }}
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

/** De baan waar de vakken naast elkaar in liggen. Echt SWIPEN, met een
 *  scroll-snap zodat elk vak precies invalt: een pil met tabjes vertelt je dat
 *  je moet TIKKEN, en dan probeert niemand te vegen.
 *
 *  De teller komt uit de scrollpositie zelf en niet uit een klik, want anders
 *  zou de wegwijzer achterlopen zodra je met je duim schuift. */
function Baan({ index, children }: { index: number; onIndex?: (i: number) => void; children: React.ReactNode }) {
  // Alleen de PIJLTJES bladeren, je vinger niet meer.
  //
  // Waarom: elk vak is een raster van negen producten dat verder kan lopen dan
  // het scherm, dus je scrolt er verticaal doorheen. Een baan die ook zijwaarts
  // meegeeft betekent dat elke schuine veeg iets doet wat je niet bedoelde: je
  // wilde omlaag en je staat ineens bij de draaiknoppen. Verticaal scrollen
  // blijft dus van de pagina, horizontaal gaat via de wegwijzer.
  //
  // Vandaar `transform` en geen `scrollLeft`: zonder scrollcontainer is er ook
  // niets om per ongeluk te verschuiven.
  return (
    <div style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          transform: `translateX(-${index * 100}%)`,
          transition: "transform .34s cubic-bezier(.2,.8,.3,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Een vak in de baan: precies zo breed als de baan, en het valt in. */
function Vak({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: "0 0 100%", minWidth: 0, boxSizing: "border-box", scrollSnapAlign: "start", scrollSnapStop: "always", paddingInline: 2 }}>
      {children}
    </div>
  );
}

/** De wegwijzer boven de baan: pijltje, naam, pijltje, met stipjes eronder.
 *  De pijltjes zijn er om te LATEN ZIEN dat er links en rechts nog meer staat;
 *  dat ze ook werken is meegenomen. */
function Wegwijzer({ namen, index, onIndex }: { namen: string[]; index: number; onIndex: (i: number) => void }) {
  const { t } = useT();
  const ga = (d: number) => {
    const i = (index + d + namen.length) % namen.length;
    sound.uiTap();
    onIndex(i);
  };
  const pijl = (d: -1 | 1) => (
    <button
      onClick={() => ga(d)}
      aria-label={d < 0 ? t("back") : t("next")}
      className="pressable"
      style={{ width: 26, height: 26, display: "grid", placeItems: "center", border: "none", background: "transparent", color: withAlpha("#C46BFF", 0.85), cursor: "pointer", padding: 0, flexShrink: 0 }}
    >
      {d < 0 ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {pijl(-1)}
        <span style={{ minWidth: 110, textAlign: "center", fontFamily: font.wide, fontSize: 14, letterSpacing: 1.2, textTransform: "uppercase", color: colors.ink, textShadow: `0 0 12px ${withAlpha("#9A4BF0", 0.55)}` }}>
          {namen[index]}
        </span>
        {pijl(1)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {namen.map((n, i) => (
          <button
            key={n}
            onClick={() => { sound.uiTap(); onIndex(i); }}
            aria-label={n}
            style={{
              width: i === index ? 16 : 6, height: 6, borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
              background: i === index ? withAlpha("#C46BFF", 0.95) : withAlpha("#C46BFF", 0.3),
              boxShadow: i === index ? `0 0 8px ${withAlpha("#9A4BF0", 0.7)}` : "none",
              transition: "width .2s ease, background .2s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Een raster dat na negen producten gaat schuiven. Negen is drie volle rijen
 *  in een raster van drie; bij twee kolommen zijn het er vier en een halve, en
 *  die halve rij vertelt meteen dat er meer onder staat. */
function Raster({ kolommen, aantal, children }: { kolommen: number; aantal: number; children: React.ReactNode }) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [hoog, setHoog] = useState<number | undefined>(undefined);
  const schuift = aantal > 9;
  useLayoutEffect(() => {
    const el = doos.current;
    if (!el || !schuift) { setHoog(undefined); return; }
    const eerste = el.firstElementChild as HTMLElement | null;
    if (!eerste) return;
    const meet = () => {
      const h = eerste.offsetHeight;
      if (!h) return;
      const rijen = 9 / kolommen;
      setHoog(Math.round(rijen * h + (Math.ceil(rijen) - 1) * 8));
    };
    meet();
    // Het vakje zelf in de gaten houden, niet de doos: de doos heeft straks een
    // vaste hoogte en verandert dus niet meer, terwijl het vakje pas zijn maat
    // krijgt als het plaatje binnen is.
    const ro = new ResizeObserver(meet);
    ro.observe(eerste);
    return () => ro.disconnect();
  }, [schuift, kolommen, aantal]);
  return (
    <div
      ref={doos}
      className={schuift ? "zachtscroll" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${kolommen}, 1fr)`,
        gap: 8,
        maxHeight: hoog,
        overflowY: schuift ? "auto" : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function Shop({ game, onBack }: { game: GameApi; onBack: () => void }) {
  // De winkel openen = de drop gezien: het hexagon-cijfer op de winkelwagen in
  // de onderbalk gaat uit tot de volgende echte drop (SHOP_DROP in BottomNav).
  useEffect(() => { localStorage.setItem("penneer.shopDrop", String(SHOP_DROP)); }, []);
  const { t } = useT();
  // De winkel hoort bij de main page: dezelfde achtergrond, zodat het voelt als
  // een lade die daar opengaat en niet als een andere app.
  useEffect(() => {
    document.body.classList.add("winkel");
    return () => document.body.classList.remove("winkel");
  }, []);
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
  const cashPrices = status?.cash_prices ?? {};
  const cash = account?.cash ?? 0;
  // De draaiknop die voor JOU met coins te koop is: die van je eigen land.
  const eigenBuzzer = (status?.land_buzzers ?? {})[(account?.land || "NL").toUpperCase()] ?? null;
  // Oudere servers sturen alleen `bundles`; dan tonen we die, zodat de winkel
  // niet leeg is terwijl de backend nog aan het uitrollen is.
  // Twee ladders van negen. Oudere servers sturen alleen `bundles`; dan valt de
  // coin-ladder daarop terug en blijft de cash-ladder leeg, zodat de winkel niet
  // stukgaat terwijl de backend nog aan het uitrollen is.
  const coinBundels: Bundle[] = status?.coin_bundles ?? status?.bundles ?? [];
  const cashBundels: CashBundle[] = status?.cash_bundles ?? [];
  // Welk vak van de winkel je open hebt. De AI staat erbuiten, want die staat
  // altijd bovenaan.
  const [vak, setVak] = useState(0);
  // Wie de scheidsrechter al heeft ziet hem niet meer in de winkel. Op het testaccount
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

  // De vakken in de volgorde waarin je erlangs veegt.
  const vakken = [
    t("shopTabCoins"),
    t("shopTabBuzzers"),
    t("shopTabReels"),
    t("shopTabEmotes"),
    t("shopTabAvatars"),
    ...(catsForSale.length > 0 ? [t("shopTabCats")] : []),
  ];
  const tellingen = [
    coinBundels.length + cashBundels.length,
    BUZZERS_FOR_SALE.length,
    REELS_FOR_SALE.length,
    EMOTE_PACKS_FOR_SALE.length,
    AVATAR_PACKS.length,
    catsForSale.length,
  ];
  // Hoeveel vakjes er in het zichtbare vak staan; daarlangs loopt de veeg rond.
  const beurt = useVeegBeurt(tellingen[vak] ?? 0);

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
            <ArrowLeft size={20} />
          </button>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("shopTitle")}</span>
          {/* Allebei je saldi in de kop, want je koopt hier met allebei. Ze
              staan naast elkaar in hetzelfde vak, net als op de main page: één
              vorm, twee munten. */}
          {account && (
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5 }}>
              {skin ? (
                <>
                  <CoinPlate coins={coins} height={30} />
                  <CashPlate cash={cash} height={30} />
                </>
              ) : (
                <>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px 4px 7px", borderRadius: 999, background: withAlpha(colors.gold, 0.12), border: `1px solid ${withAlpha(colors.gold, 0.4)}` }}>
                    <img src="/coin.webp" alt="" width={18} height={18} style={{ display: "block" }} />
                    <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, color: colors.gold }}>{coins}</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px 4px 7px", borderRadius: 999, background: withAlpha(GROEN[1], 0.14), border: `1px solid ${withAlpha(GROEN[2], 0.45)}` }}>
                    <img src="/ui/valuta/cash.webp?v=1" alt="" width={18} height={18} style={{ display: "block" }} />
                    <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, color: GROEN[3] }}>{cash}</span>
                  </span>
                </>
              )}
            </span>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <SchermTip id="shop" tekst={t("tipShop")} />
        {!account && (
          <Card><p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopNeedProfile")}</p></Card>
        )}

        {/* De scheidsrechter staat BOVEN de tabjes. Hij is het enige in de
            winkel dat het spel zelf verandert, de rest is uiterlijk. En wie hem
            al heeft ziet hem niet meer: iets wat je bezit hoort niet in een
            winkel te blijven staan. */}
        {toonAi && (
          <Paneel>
            {/* Iets boven het midden. De sierlijst heeft onderaan een dikkere
                rail dan bovenaan, dus wat GEOMETRISCH gecentreerd staat leest
                als te laag. Een negatieve marge op het blok zelf, niet op de
                doos: die verschuiven maakt de art scheef. */}
            <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, padding: "6px 10px 2px", marginTop: "-5%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Een zachte witte halo ERACHTER, geen drop-shadow: die laat iOS
                    de laag apart rasteren en dan zie je zijn rechthoek. */}
                <span aria-hidden style={{ position: "relative", width: 42, height: 42, flexShrink: 0, display: "inline-grid", placeItems: "center" }}>
                  <span
                    style={{
                      position: "absolute", inset: "4%", borderRadius: "50%",
                      background: "radial-gradient(closest-side, rgba(255,255,255,.42) 0%, rgba(226,214,255,.18) 55%, transparent 100%)",
                      filter: "blur(7px)",
                    }}
                  />
                  <img src="/ui/ai-scheids.webp" alt="" style={{ position: "relative", width: 42, height: 42, objectFit: "contain", display: "block" }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15.5, lineHeight: 1.15, color: colors.ink }}>{t("shopAiTitle")}</div>
                  <div style={{ fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.25, color: colors.faint }}>{t("shopAiTag")}</div>
                </div>
              </div>
              {/* De opsomming van drie punten is weg: die zegt hetzelfde als de
                  regel eronder, en het paneel heeft een vaste hoogte. */}
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: 11.5, color: colors.sub, lineHeight: 1.35 }}>{t("shopAiBody")}</p>
              {aiActive ? (
                <div style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.green }}>{t("shopAiActive")}</div>
              ) : !account ? null : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                  <KnopPlaat
                    breed={100}
                    uit={buying !== null || !status?.enabled}
                    onClick={() => startPaypal("ai")}
                    label={buying === "ai" ? "..." : money(status?.ai_price ?? status?.price, status?.currency ?? "EUR")}
                  />
                  {/* Of je speelt hem bij elkaar. 250 cash is precies wat je op
                      level 45 verdiend hebt, dus dit is een echt alternatief en
                      geen fopprijs. */}
                  {cashPrices.referee != null && (
                    <button
                      onClick={() => { if (cash >= cashPrices.referee) { sound.uiTap(); game.buyItemCash("referee"); } }}
                      disabled={cash < cashPrices.referee}
                      className={cash >= cashPrices.referee ? "pressable" : undefined}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999,
                        background: cash >= cashPrices.referee ? withAlpha(GROEN[2], 0.16) : withAlpha("#000000", 0.3),
                        border: `1px solid ${cash >= cashPrices.referee ? withAlpha(GROEN[2], 0.5) : colors.panelBorder}`,
                        cursor: cash >= cashPrices.referee ? "pointer" : "default",
                      }}
                    >
                      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 14, color: cash >= cashPrices.referee ? GROEN[3] : colors.faint }}>{cashPrices.referee}</span>
                      <img src="/ui/valuta/cash.webp?v=1" alt="" width={15} height={15} style={{ display: "block", opacity: cash >= cashPrices.referee ? 1 : 0.45 }} />
                    </button>
                  )}
                </div>
              )}
              {!aiActive && status && !status.enabled && (
                <p style={{ margin: "-9px 0 0", textAlign: "center", fontFamily: font.ui, fontSize: 10.5, color: colors.faint, lineHeight: 1.15 }}>{t("shopPaypalSoonShort")}</p>
              )}
            </div>
          </Paneel>
        )}

        {/* De winkel was zes secties onder elkaar en dus een rol van een halve
            meter. Nu liggen ze NAAST elkaar en veeg je erlangs; de wegwijzer
            erboven laat met pijltjes en stipjes zien dat er meer staat. */}
        <Wegwijzer namen={vakken} index={vak} onIndex={setVak} />
        <Baan index={vak} onIndex={setVak}>

        <Vak>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopCoinsHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopCoinsLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              {/* Drie kolommen, want het zijn er negen: een net vierkant van
                  3x3 in plaats van vier rijen met een wees. De eerste ZES
                  dragen de stapel en de laatste DRIE de zak: de zak is de grote
                  koop, en dat verschil moet je aan de tegel zien zonder de
                  cijfers te lezen. */}
              <Raster kolommen={3} aantal={coinBundels.length}>
                {coinBundels.map((b, i) => (
                  <GlasVak key={b.product} index={i} veeg={i === beurt}>
                    <img
                      src={i >= 6 ? "/ui/valuta/coinbag.webp?v=1" : "/coins-stack.webp"}
                      alt=""
                      style={{ width: 54, height: 54, objectFit: "contain", display: "block" }}
                    />
                    <Coins n={b.coins} size={14} />
                    <KnopPlaat
                      breed={80}
                      uit={!account || buying !== null || !status?.enabled}
                      onClick={() => startPaypal(b.product)}
                      label={buying === b.product ? "..." : money(b.price, status?.currency ?? "EUR")}
                    />
                  </GlasVak>
                ))}
              </Raster>
            </Card>

            {/* Cash heeft zijn EIGEN ladder van negen, met dezelfde vorm en de
                eigen art. Twee munten door elkaar in een raster laat je raden
                wat je koopt; twee rasters onder elkaar niet. */}
            {cashBundels.length > 0 && (
              <>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, color: colors.ink, marginTop: 2 }}>{t("cashKopen")}</div>
                <Card style={{ padding: "9px 8px 10px" }}>
                  <Raster kolommen={3} aantal={cashBundels.length}>
                    {cashBundels.map((b, i) => (
                      <GlasVak key={b.product} index={i} veeg={i === beurt}>
                        <img
                          src={i >= 6 ? "/ui/valuta/cashbag.webp?v=1" : "/ui/valuta/cash-stack.webp?v=2"}
                          alt=""
                          style={{ width: 54, height: 54, objectFit: "contain", display: "block" }}
                        />
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 14, color: GROEN[3] }}>{b.cash}</span>
                          <img src="/ui/valuta/cash.webp?v=1" alt="" width={14} height={14} style={{ display: "block" }} />
                        </span>
                        <KnopPlaat
                          breed={80}
                          uit={!account || buying !== null || !status?.enabled}
                          onClick={() => startPaypal(b.product)}
                          label={buying === b.product ? "..." : money(b.price, status?.currency ?? "EUR")}
                        />
                      </GlasVak>
                    ))}
                  </Raster>
                </Card>
              </>
            )}
            {/* De vakjes staan er ALTIJD, ook zolang betalen nog niet aanstaat.
                Je moet kunnen zien wat er te koop komt. De melding staat er
                ONDER: eerst zie je wat het is, dan lees je dat het nog even
                duurt. Andersom lees je een excuus voor iets wat je nog niet
                gezien hebt. */}
            {status && !status.enabled && (
              <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 11.5, color: colors.faint, lineHeight: 1.35 }}>{t("shopPaypalSoon")}</p>
            )}
          </div>
        </Vak>


        <Vak>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopBuzzHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopBuzzLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              <Raster kolommen={3} aantal={BUZZERS_FOR_SALE.length}>
                {BUZZERS_FOR_SALE.map((bz, i) => (
                  <CoinItem key={bz.id} title={t(bz.name)} owned={owned.has(bz.id)} price={prices[bz.id] ?? buzzPrice} coins={coins} cashPrice={cashPrices[bz.id]} cash={cash} slot={eigenBuzzer !== bz.id} index={i} veeg={i === beurt} onBuy={() => game.buyItemCoins(bz.id)} onBuyCash={() => game.buyItemCash(bz.id)}>
                    <img src={`/buzzers/${bz.id}.webp`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  </CoinItem>
                ))}
              </Raster>
            </Card>
          </div>
        </Vak>

        <Vak>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopReelsHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopReelsLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              <Raster kolommen={3} aantal={REELS_FOR_SALE.length}>
                {REELS_FOR_SALE.map((rs, i) => (
                  <CoinItem key={rs.id} title={t(rs.name)} owned={owned.has(rs.id)} price={prices[rs.id] ?? 100} coins={coins} cashPrice={cashPrices[rs.id]} cash={cash} index={i} veeg={i === beurt} onBuy={() => game.buyItemCoins(rs.id)} onBuyCash={() => game.buyItemCash(rs.id)}>
                    <ReelSwatch id={rs.id} />
                  </CoinItem>
                ))}
              </Raster>
            </Card>
          </div>
        </Vak>

        <Vak>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopEmotesHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopEmotesLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              <Raster kolommen={2} aantal={EMOTE_PACKS_FOR_SALE.length}>
                {EMOTE_PACKS_FOR_SALE.map((pk, i) => (
                  <CoinItem key={pk.id} title={t(pk.name)} owned={owned.has(pk.id)} price={prices[pk.id] ?? 200} coins={coins} cashPrice={cashPrices[pk.id]} cash={cash} index={i} veeg={i === beurt} onBuy={() => game.buyItemCoins(pk.id)} onBuyCash={() => game.buyItemCash(pk.id)}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, width: "100%" }}>
                      {pk.emotes.map((id) => (
                        <img key={id} src={EMOTE_SRC(id)} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "contain", display: "block" }} />
                      ))}
                    </div>
                  </CoinItem>
                ))}
              </Raster>
            </Card>
          </div>
        </Vak>

        <Vak>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopAvatarsHeader")}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopAvatarsLead")}</div>
            </div>
            <Card style={{ padding: "9px 8px 10px" }}>
              <Raster kolommen={2} aantal={AVATAR_PACKS.length}>
                {AVATAR_PACKS.map((pk, i) => (
                  <CoinItem key={pk.id} title={t(pk.name)} owned={owned.has(pk.id)} price={prices[pk.id] ?? packPrice} coins={coins} cashPrice={cashPrices[pk.id]} cash={cash} index={i} veeg={i === beurt} onBuy={() => game.buyItemCoins(pk.id)} onBuyCash={() => game.buyItemCash(pk.id)}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, width: "100%" }}>
                      {pk.preview.map((n) => (
                        <div key={n} style={{ aspectRatio: "1 / 1", borderRadius: 6, overflow: "hidden", border: `1px solid ${colors.panelBorder}` }}>
                          <img src={`/avatars/av${n}.jpg?v=${AVATAR_ART_VERSION}`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                      ))}
                    </div>
                  </CoinItem>
                ))}
              </Raster>
            </Card>
          </div>
        </Vak>

        {catsForSale.length > 0 && (
        <Vak>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: colors.ink }}>{t("shopCatsHeader")}</div>
                <div style={{ fontFamily: font.ui, fontSize: 12, lineHeight: 1.3, color: colors.faint }}>{t("shopCatsLead")}</div>
              </div>
              <Card style={{ padding: "9px 8px 10px" }}>
                <Raster kolommen={3} aantal={catsForSale.length}>
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
                </Raster>
              </Card>
            </div>
        </Vak>
        )}
        </Baan>
        {/* Redeem an AI code. */}
        {!!account && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.ui, fontSize: 13, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: colors.faint }}>
              <img src="/ui/ticket.webp" alt="" aria-hidden style={{ width: 22, height: 22, objectFit: "contain", display: "block" }} /> {t("shopHaveCode")}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Het veld in dezelfde glasrand als een rij in de lijsten, met
                  de afgeschuinde hoek en de lijn op een derde sterkte. Een kale
                  rechthoek naast de rest van de winkel leest als een formulier
                  dat er per ongeluk in staat. */}
              <GlasVeld
                gevuld={!!code.trim()}
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); if (shopResult) game.clearShopResult(); }}
                placeholder={t("shopCodePlaceholder")}
                onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) redeem(); }}
                kaderStyle={{ flex: 1, minWidth: 0 }}
                style={{ fontFamily: font.display, letterSpacing: 1.5, fontSize: 14, textTransform: "uppercase" }}
              />
              <KnopPlaat breed={104} kleur="paars" uit={!code.trim()} onClick={redeem} label={t("shopRedeem")} />
            </div>
            {resultMsg && <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: shopResult?.ok ? colors.green : colors.red }}>{resultMsg}</p>}
          </Card>
        )}

        <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("shopFootnotePaid")}</p>
      </div>
    </Screen>
  );
}
