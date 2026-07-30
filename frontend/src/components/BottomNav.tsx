// The app's home bar, in the shape casual mobile games use: five fixed
// destinations, the middle one is Home. It replaces the tab strip that used to
// live inside the profile screen, so every section is one tap from anywhere.
//
// The icons are lucide placeholders on purpose — they get swapped for the
// studio's own art later, so each item keeps its own slot and label and the art
// only has to drop into `icon`.
import { useEffect, useRef, useState } from "react";
import { Home, ShoppingCart, Trophy, UserRound, Users } from "lucide-react";
import { Avatar } from "./Avatar";
import { HexArt } from "./HexArt";
import type { GameApi } from "../net/socket";
import { NeonLine } from "./NeonLine";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { useTileSkin } from "../theme/tileSkin";
import { colors, font, withAlpha } from "../theme/tokens";

// De felle goudtint van de cijfers, dezelfde als in de profiel-zeshoeken.
const GOUD_HI = "#FFEBB8";
// Dezelfde ladder als SCHILD_KLEUREN in ProfileHero; hier los om geen zware
// import de balk in te trekken.
const SCHILDEN = ["paars", "blauw", "lichtblauw", "groen", "rood", "zilver", "zwart"];

export type NavKey = "shop" | "leaderboard" | "home" | "friends" | "profile";

// De maten van de plaat-art (`/tiles/navbar.webp`), uitgemeten op het bestand
// zelf en daarom in procenten: dan blijven ze kloppen op elk formaat.
//
// De art heeft twee verzonken vakken en in het midden een gouden penning met
// het huisje er al in getekend. Elk vak krijgt twee pictogrammen, het huisje
// komt uit de art. Vandaar vijf posities waarvan er maar vier iets tekenen.
// Opnieuw uitgemeten op de nieuwe art: het linkervak loopt van 1,9 tot 40,7
// procent, het rechter van 59,4 tot 98,1, en beide hebben hun hartlijn op 50,3.
// Twee pictogrammen per vak, dus op een kwart en driekwart van elk vak.
// De versie van de pictogram-art. Bump dit zodra je een bestand op DEZELFDE
// naam vervangt. De service worker bewaart plaatjes cache-first en ruimt pas op
// bij zijn volgende activatie, dus alleen zijn versie ophogen laat er nog een
// laadbeurt de oude bytes doorheen. Een andere URL kan dat niet gebeuren.
const NAV_ART = 4; // 4: wit met een lichtpaarse zweem i.p.v. goud
const SLOTS = [11.6, 31.0, 50, 69.1, 88.4];
// De scheiding staat MIDDEN tussen de twee pictogrammen van een vak, dus op het
// gemiddelde van hun posities. Twee vakken, twee groeven; over het gouden
// middenstuk hoort er geen, dat scheidt zichzelf al.
const GROEVEN = [(SLOTS[0] + SLOTS[1]) / 2, (SLOTS[3] + SLOTS[4]) / 2];
const WELL_Y = 50.3; // verticale hartlijn van de vakken
const PLATE_RATIO = "3955 / 578";
// De "nieuw in de winkel"-teller: hoog dit op bij elke echte drop. De balk
// toont dan een 1 op de winkelwagen tot je de winkel opent.
export const SHOP_DROP = 1; // 1: cash-bundels
const GAP = 8; // hoe hoog de plaat boven de onderrand zweeft

export function BottomNav({
  game,
  active,
  onSelect,
}: {
  game: GameApi;
  active: NavKey;
  onSelect: (key: NavKey) => void;
}) {
  const { t } = useT();
  const account = game.state.account;
  const skin = useTileSkin();

  // Wat er per bestemming op je wacht. Elke teller komt uit iets wat de app al
  // bijhoudt; de balk verzint niets zelf.
  //  - vrienden: uitnodigingen/verzoeken in de inbox plus ongelezen DM's
  //  - winkel: een nieuwe drop die je nog niet gezien hebt (lokaal vinkje)
  //  - ranglijst: een divisie-uitslag die je nog niet hebt bekeken
  //  - home: verdiende beloningen waar hun victory-popup nog van wacht
  // Mijn ring volgt mijn schild, ook hier op de balk.
  const eigenDivisie = account ? Math.max(0, SCHILDEN.indexOf(account.shield || "paars")) : undefined;
  // De vriendenbadge is een GEZIEN-teller, geen openstaand-teller. De ruwe som
  // telt uitnodigingen en ongelezen DM's, maar die staan niet op de
  // vriendenpagina zelf (de inbox is een eigen scherm achter het icoon
  // bovenin), dus een openstaand verzoek van iemand die nooit reageert liet de
  // badge EEUWIG branden: je kwam kijken, zag niets nieuws, en de stip bleef.
  // Nu onthoudt de balk hoeveel je er zag toen je er voor het laatst was, en
  // brandt hij alleen voor wat er sindsdien bij kwam. Zakt de som (afgehandeld
  // verzoek), dan zakt het anker mee, anders zou de eerstvolgende nieuwe
  // uitnodiging onzichtbaar zijn.
  const ruweVrienden = account ? (game.state.inbox.length || account.inbox_count || 0) + (account.dm_unread || 0) : 0;
  let vriendenTeller = 0;
  try {
    const sleutel = "penneer.vriendenGezien";
    const gezien = Number(localStorage.getItem(sleutel) || 0);
    if (active === "friends" || ruweVrienden < gezien) {
      localStorage.setItem(sleutel, String(ruweVrienden));
      vriendenTeller = 0;
    } else {
      vriendenTeller = Math.max(0, ruweVrienden - gezien);
    }
  } catch {
    vriendenTeller = ruweVrienden;
  }
  const shopTeller = account && Number(localStorage.getItem("penneer.shopDrop") || 0) < SHOP_DROP ? 1 : 0;
  const rangTeller = account?.divisie_change ? 1 : 0;
  const homeTeller = account
    ? (account.pending_rewards?.length ?? 0) + (account.buzzer_rewards ?? []).filter((r) => r.unlocked && !r.claimed).length
    : 0;
  const badges: Partial<Record<NavKey, number>> = {
    friends: vriendenTeller,
    shop: shopTeller,
    leaderboard: rangTeller,
    home: homeTeller,
  };

  // De plaat is art met een vaste verhouding, dus zijn hoogte hangt van de
  // schermbreedte af. Hij meet zichzelf: de pictogrammen schalen mee en de
  // pagina weet hoeveel ruimte ze onderaan moet vrijhouden.
  const plate = useRef<HTMLDivElement | null>(null);
  const [plateH, setPlateH] = useState(0);
  const [plateW, setPlateW] = useState(0);
  useEffect(() => {
    const el = plate.current;
    if (!skin || !el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      setPlateH(h);
      setPlateW(el.getBoundingClientRect().width);
      document.documentElement.style.setProperty("--nav-h", `${Math.round(h + GAP + 6)}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [skin]);

  // Een haarlijn van twee pixels, waarvan de ene helft donker is en de andere
  // licht, moet op het APPARAATRASTER beginnen. Landt hij er half overheen, dan
  // middelt de browser die twee helften met elkaar en met de achtergrond, en dan
  // blijft er een vage grijze veeg over in plaats van een groef. Op procenten
  // valt elke groef op een andere subpixel, en precies daarom was de ene scherp
  // en de andere niet.
  const opRaster = (x: number) => {
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    return Math.round(x * dpr) / dpr;
  };

  // `s` is de pictogrammaat, `av` die van de avatar. De kale balk heeft een
  // vaste hoogte en dus vaste maten; de plaat-skin schaalt mee met de breedte
  // van het scherm en zet de avatar bewust groter dan de pictogrammen: een
  // gezichtje moet je kunnen herkennen, een winkelwagentje alleen herkennen.
  const items = (s: number, av = Math.round(s * 1.1)): { key: NavKey; label: string; icon: React.ReactNode; badge?: number }[] => [
    { key: "shop", label: t("shopTitle"), icon: <ShoppingCart size={s} strokeWidth={2.1} />, badge: badges.shop },
    { key: "leaderboard", label: t("leaderboardTab"), icon: <Trophy size={s} strokeWidth={2.1} />, badge: badges.leaderboard },
    { key: "home", label: t("navHome"), icon: <Home size={Math.round(s * 1.1)} strokeWidth={2.2} />, badge: badges.home },
    { key: "friends", label: t("friendsTab"), icon: <Users size={s} strokeWidth={2.1} />, badge: badges.friends },
    // Profile's icon IS the player's avatar, so the bar shows who you are.
    {
      key: "profile",
      label: t("profile"),
      badge: badges.profile,
      icon: account ? (
        <Avatar name={account.name} color={account.color} size={av} userId={account.id} hasAvatar={account.has_avatar} avatarVer={account.avatar_ver} divisie={eigenDivisie} />
      ) : (
        <UserRound size={s} strokeWidth={2.1} />
      ),
    },
  ];

  if (skin) {
    // Het vak is twee derde van de plaathoogte. Op 0,5 vult het pictogram dat
    // vak goed zonder de rand te raken; op 0,4 stond het er verloren in. Tot de
    // plaat is gemeten tekenen we nog niets, anders springen ze een frame later.
    const s = Math.round(plateH * 0.5);
    // De skin krijgt de art uit de UI-map, omgezet naar het goud van de app: de
    // vorm en het licht van de tekening blijven staan, alleen het materiaal is
    // anders. Parelwit stond er los bij op een plaat die zelf al goud omrand is.
    //
    // De art draagt zijn eigen warme halo, dus die hoeft er niet omheen; het
    // verschil tussen gekozen en niet gekozen is alleen belichting.
    const maat = Math.round(s * 1.12);
    const art: Partial<Record<NavKey, (on: boolean) => React.ReactNode>> = {
      shop: (on) => <NavArt naam="shop" on={on} size={maat} />,
      leaderboard: (on) => <NavArt naam="trophy" on={on} size={maat} />,
      friends: (on) => <NavArt naam="friends" on={on} size={maat} />,
    };
    return (
      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          // Zweeft: onder de plaat blijft lucht staan, boven de home-indicator.
          bottom: `calc(${GAP}px + env(safe-area-inset-bottom))`,
          zIndex: 40,
          padding: "0 10px",
          // De marges naast en onder de plaat horen bij het scherm erachter,
          // niet bij de balk. Zonder dit zou die lucht taps opeten.
          pointerEvents: "none",
        }}
      >
        <div ref={plate} style={{ position: "relative", width: "100%", maxWidth: 460, margin: "0 auto", pointerEvents: "auto" }}>
          <img
            src={`/tiles/navbar${active === "home" ? "" : "-uit"}.webp?v=${NAV_ART}`}
            alt=""
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: PLATE_RATIO,
              display: "block",
            }}
          />
          {/* Dezelfde groef als tussen de vakken van een potjesrij: donkere
              linkerwand, lichte rechter, want het licht komt van linksboven en
              valt dus op de rechterkant van een gleuf. Boven en onder vervaagd,
              zodat hij vrij in het vak hangt in plaats van de randen te raken. */}
          {plateH > 0 && plateW > 0 &&
            GROEVEN.map((x) => (
              <span
                key={x}
                aria-hidden
                style={{
                  position: "absolute",
                  left: opRaster((plateW * x) / 100 - 1),
                  top: `${WELL_Y}%`,
                  transform: "translateY(-50%)",
                  width: 2,
                  height: plateH * 0.46,
                  backgroundImage: "linear-gradient(90deg, rgba(8,3,20,.75) 0, rgba(8,3,20,.75) 1px, rgba(255,255,255,.14) 1px, rgba(255,255,255,.14) 2px)",
                  WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)",
                  maskImage: "linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)",
                  pointerEvents: "none",
                }}
              />
            ))}
          {plateH > 0 &&
            items(s, Math.round(plateH * 0.6)).map(({ key, label, icon, badge }, i) => {
              const on = active === key;
              const home = key === "home";
              return (
                <button
                  key={key}
                  onClick={() => { sound.uiTap(); onSelect(key); }}
                  aria-label={label}
                  aria-current={on ? "page" : undefined}
                  className="pressable"
                  style={{
                    position: "absolute",
                    left: `${SLOTS[i]}%`,
                    top: `${WELL_Y}%`,
                    transform: "translate(-50%, -50%)",
                    display: "grid",
                    placeItems: "center",
                    width: home ? plateH * 0.9 : plateH * 0.72,
                    height: home ? plateH : plateH * 0.72,
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    // Goud als je er bent, gedempt paarswit als je er niet bent.
                    // Het huisje in het midden zit al in de art, dus die knop
                    // tekent niets: hij vangt alleen de tap.
                    color: on ? colors.gold : withAlpha("#E7DAFF", 0.6),
                    cursor: "pointer",
                  }}
                >
                  {!home && (art[key] ? art[key]!(on) : icon)}
                  {!!badge && (
                    // De ZWARTE zeshoek met gouden rand, dezelfde als bij de
                    // inbox-pil: één taal voor "hier wacht iets".
                    <span style={{ position: "absolute", top: -3, right: -3, pointerEvents: "none" }}>
                      <HexArt maat={17}>
                        <span style={{ fontFamily: font.ui, fontSize: 9, fontWeight: 800, lineHeight: 1, color: GOUD_HI }}>{badge > 9 ? "9+" : badge}</span>
                      </HexArt>
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </nav>
    );
  }

  return (
    // Anchored to the VIEWPORT, the way SMPL does it. A sticky bar inside a
    // 100dvh shell floats above the real bottom on iOS, because that shell ends
    // where the browser thinks the viewport ends, which is above the home
    // indicator. `position: fixed` + `bottom: 0` sits on the physical edge, and
    // the safe-area inset becomes padding so the icons still clear the
    // indicator while the bar's background fills the strip.
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        alignItems: "center",
        gap: 2,
        padding: "6px 8px",
        paddingBottom: "calc(6px + env(safe-area-inset-bottom))",
        background: "linear-gradient(180deg, rgba(22,13,48,.9), rgba(14,9,34,.98))",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {/* De bovenrand is geen streep maar een sierlijn in het goud van de balk:
          donker aan de uiteinden, oplichtend in het midden, met een klein glansje
          erop. Een `border` kan dat niet, die is overal even sterk. */}
      <NeonLine accent={colors.gold} side="top" />
      {items(28).map(({ key, label, icon, badge }) => {
        const on = active === key;
        const home = key === "home";
        return (
          <button
            key={key}
            onClick={() => { sound.uiTap(); onSelect(key); }}
            aria-label={label}
            aria-current={on ? "page" : undefined}
            className="pressable"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              // Home sits a touch higher and keeps a filled plate, the way the
              // middle action does in this genre.
              padding: home ? "10px 4px" : "11px 4px",
              borderRadius: 16,
              border: home ? `1px solid ${withAlpha(colors.gold, on ? 0.6 : 0.3)}` : "none",
              background: home ? withAlpha(colors.gold, on ? 0.2 : 0.1) : "transparent",
              color: on ? colors.gold : colors.faint,
              cursor: "pointer",
            }}
          >
            {icon}
            {!!badge && (
              <span style={{ position: "absolute", top: 1, right: "50%", marginRight: -20, pointerEvents: "none" }}>
                <HexArt maat={17}>
                  <span style={{ fontFamily: font.ui, fontSize: 9, fontWeight: 800, lineHeight: 1, color: GOUD_HI }}>{badge > 9 ? "9+" : badge}</span>
                </HexArt>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/** Een pictogram uit de UI-map in de onderbalk.
 *
 *  Alles is goud, dus de gekozen plek is geen kleurwissel maar LICHT: de rest
 *  zakt weg in de schaduw en de gekozen staat vol aan. Hetzelfde materiaal,
 *  andere belichting. De halo zit al in de art getekend, dus er hoeft er geen
 *  omheen; dat zou de gloed verdubbelen. */
function NavArt({ naam, on, size }: { naam: string; on: boolean; size: number }) {
  return (
    <img
      src={`/ui/nav/${naam}${on ? "-goud" : ""}.webp?v=${NAV_ART}`}
      alt=""
      style={{
        width: size,
        height: size,
        display: "block",
        // Niet te ver terug: deze art heeft zelf al een gloed en diepe kleur, en
        // die knijp je er zo uit.
        filter: on ? "brightness(1.1) saturate(1.08)" : "brightness(.92)",
      }}
    />
  );
}

/** The profile entry: the player's own avatar, so it reads as "you". */
export function ProfileButton({ game, onClick }: { game: GameApi; onClick: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  return (
    <button
      onClick={() => { sound.uiTap(); onClick(); }}
      aria-label={t("profile")}
      className="pressable avatar-glow"
      style={{ display: "flex", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
    >
      {account ? (
        <Avatar name={account.name} color={account.color} size={30} userId={account.id} hasAvatar={account.has_avatar} avatarVer={account.avatar_ver} divisie={account ? SCHILDEN.indexOf(account.shield || "paars") : undefined} />
      ) : (
        <span style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", background: withAlpha(colors.gold, 0.14), border: `1px solid ${withAlpha(colors.gold, 0.4)}`, color: colors.gold }}>
          <UserRound size={17} />
        </span>
      )}
    </button>
  );
}
