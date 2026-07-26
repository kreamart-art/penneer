// The app's home bar, in the shape casual mobile games use: five fixed
// destinations, the middle one is Home. It replaces the tab strip that used to
// live inside the profile screen, so every section is one tap from anywhere.
//
// The icons are lucide placeholders on purpose — they get swapped for the
// studio's own art later, so each item keeps its own slot and label and the art
// only has to drop into `icon`.
import { Home, ShoppingCart, Trophy, UserRound, Users } from "lucide-react";
import { Avatar } from "./Avatar";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

export type NavKey = "shop" | "leaderboard" | "home" | "friends" | "profile";

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

  const items: { key: NavKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "shop", label: t("shopTitle"), icon: <ShoppingCart size={28} strokeWidth={2.1} /> },
    { key: "leaderboard", label: t("leaderboardTab"), icon: <Trophy size={28} strokeWidth={2.1} /> },
    { key: "home", label: t("navHome"), icon: <Home size={31} strokeWidth={2.2} /> },
    { key: "friends", label: t("friendsTab"), icon: <Users size={28} strokeWidth={2.1} /> },
    // Profile's icon IS the player's avatar, so the bar shows who you are.
    {
      key: "profile",
      label: t("profile"),
      icon: account ? (
        <Avatar name={account.name} color={account.color} size={31} userId={account.id} hasAvatar={account.has_avatar} avatarVer={account.avatar_ver} />
      ) : (
        <UserRound size={28} strokeWidth={2.1} />
      ),
    },
  ];

  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 40,
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        alignItems: "end",
        gap: 2,
        padding: "6px 8px",
        paddingBottom: "calc(6px + env(safe-area-inset-bottom))",
        background: "linear-gradient(180deg, rgba(22,13,48,.86), rgba(14,9,34,.97))",
        borderTop: `1px solid ${withAlpha(colors.gold, 0.16)}`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {items.map(({ key, label, icon, badge }) => {
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
              padding: home ? "12px 4px" : "13px 4px",
              marginTop: home ? -10 : 0,
              borderRadius: 16,
              border: home ? `1px solid ${withAlpha(colors.gold, on ? 0.6 : 0.3)}` : "none",
              background: home ? withAlpha(colors.gold, on ? 0.2 : 0.1) : "transparent",
              color: on ? colors.gold : colors.faint,
              cursor: "pointer",
            }}
          >
            {icon}
            {!!badge && (
              <span style={{ position: "absolute", top: home ? 4 : 5, right: "50%", marginRight: -20, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontSize: 10, fontWeight: 800, lineHeight: "16px", textAlign: "center" }}>
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
