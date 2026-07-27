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
import { FriendsIcon, ShopIcon, TrophyIcon } from "./NavIcons";
import type { GameApi } from "../net/socket";
import { NeonLine } from "./NeonLine";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { useTileSkin } from "../theme/tileSkin";
import { colors, font, withAlpha } from "../theme/tokens";

export type NavKey = "shop" | "leaderboard" | "home" | "friends" | "profile";

// De maten van de plaat-art (`/tiles/navbar.webp`), uitgemeten op het bestand
// zelf en daarom in procenten: dan blijven ze kloppen op elk formaat.
//
// De art heeft twee verzonken vakken en in het midden een gouden penning met
// het huisje er al in getekend. Elk vak krijgt twee pictogrammen, het huisje
// komt uit de art. Vandaar vijf posities waarvan er maar vier iets tekenen.
const SLOTS = [11.8, 31.7, 50, 68.3, 88.2];
const WELL_Y = 50.5; // verticale hartlijn van de vakken
const PLATE_RATIO = "1200 / 174";
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

  // De plaat is art met een vaste verhouding, dus zijn hoogte hangt van de
  // schermbreedte af. Hij meet zichzelf: de pictogrammen schalen mee en de
  // pagina weet hoeveel ruimte ze onderaan moet vrijhouden.
  const plate = useRef<HTMLDivElement | null>(null);
  const [plateH, setPlateH] = useState(0);
  useEffect(() => {
    const el = plate.current;
    if (!skin || !el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      setPlateH(h);
      document.documentElement.style.setProperty("--nav-h", `${Math.round(h + GAP + 6)}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [skin]);

  // `s` is de pictogrammaat, `av` die van de avatar. De kale balk heeft een
  // vaste hoogte en dus vaste maten; de plaat-skin schaalt mee met de breedte
  // van het scherm en zet de avatar bewust groter dan de pictogrammen: een
  // gezichtje moet je kunnen herkennen, een winkelwagentje alleen herkennen.
  const items = (s: number, av = Math.round(s * 1.1)): { key: NavKey; label: string; icon: React.ReactNode; badge?: number }[] => [
    { key: "shop", label: t("shopTitle"), icon: <ShoppingCart size={s} strokeWidth={2.1} /> },
    { key: "leaderboard", label: t("leaderboardTab"), icon: <Trophy size={s} strokeWidth={2.1} /> },
    { key: "home", label: t("navHome"), icon: <Home size={Math.round(s * 1.1)} strokeWidth={2.2} /> },
    { key: "friends", label: t("friendsTab"), icon: <Users size={s} strokeWidth={2.1} /> },
    // Profile's icon IS the player's avatar, so the bar shows who you are.
    {
      key: "profile",
      label: t("profile"),
      icon: account ? (
        <Avatar name={account.name} color={account.color} size={av} userId={account.id} hasAvatar={account.has_avatar} avatarVer={account.avatar_ver} />
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
    // De skin krijgt getekende, gevulde pictogrammen in plaats van lijntjes.
    // Zie NavIcons: naast art van goud leest een lijnpictogram als een tekening.
    const art: Partial<Record<NavKey, (on: boolean) => React.ReactNode>> = {
      shop: (on) => <ShopIcon on={on} size={Math.round(s * 1.18)} />,
      leaderboard: (on) => <TrophyIcon on={on} size={Math.round(s * 1.18)} />,
      friends: (on) => <FriendsIcon on={on} size={Math.round(s * 1.18)} />,
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
            src="/tiles/navbar.webp"
            alt=""
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: PLATE_RATIO,
              display: "block",
            }}
          />
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
                    <span style={{ position: "absolute", top: 0, right: 0, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 999, background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontSize: 9, fontWeight: 800, lineHeight: "15px", textAlign: "center" }}>
                      {badge > 9 ? "9+" : badge}
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
              <span style={{ position: "absolute", top: 2, right: "50%", marginRight: -18, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontSize: 10, fontWeight: 800, lineHeight: "16px", textAlign: "center" }}>
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
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
        <Avatar name={account.name} color={account.color} size={30} userId={account.id} hasAvatar={account.has_avatar} avatarVer={account.avatar_ver} />
      ) : (
        <span style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", background: withAlpha(colors.gold, 0.14), border: `1px solid ${withAlpha(colors.gold, 0.4)}`, color: colors.gold }}>
          <UserRound size={17} />
        </span>
      )}
    </button>
  );
}
