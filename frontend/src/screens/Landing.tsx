// Landing — emblem, wordmark, tagline, name input, create / join, rules link.
import { useEffect, useState } from "react";
import { CalendarDays, Check, GraduationCap, Hash, HelpCircle, Play, Settings as SettingsIcon, ShoppingCart, Sparkles, Target, UserRound, X } from "lucide-react";
import { Logo } from "../components/Logo";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { NotifyNudge } from "../components/NotifyNudge";
import { MusicToggle } from "../components/MusicToggle";
import { ProfilePrompt, profilePromptSeen } from "../components/ProfilePrompt";
import { InstallPrompt, installPromptSeen, type InstallVariant } from "../components/InstallPrompt";
import { canInstall, isIos, isIosChrome, isIosInAppBrowser, isStandalone, onInstallChange } from "../pwa/install";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, radius, withAlpha } from "../theme/tokens";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: font.ui,
  fontSize: 16,
  color: colors.ink,
  background: withAlpha("#000000", 0.25),
  border: `1.5px solid ${colors.panelBorder}`,
  borderRadius: radius.button,
  padding: "13px 15px",
};

export function Landing({
  game,
  onShowRules,
  onShowSettings,
  onShowHub,
  onShowShop,
  onShowTraining,
  onShowDaily,
}: {
  game: GameApi;
  onShowRules: () => void;
  onShowSettings: () => void;
  onShowHub: () => void;
  onShowShop: () => void;
  onShowTraining: () => void;
  onShowDaily: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"none" | "join">("none");
  const account = game.state.account;
  const inboxCount = game.state.inbox.length || account?.inbox_count || 0;

  // First-visit guests (no account, no stored token) get a prominent prompt to
  // make a profile. Returning users with a token skip it (avoids a flash).
  const [showPrompt, setShowPrompt] = useState(() => {
    try {
      return !localStorage.getItem("penneer.accountToken") && !profilePromptSeen();
    } catch {
      return false;
    }
  });

  // Install prompt: after the profile prompt is out of the way, first-time
  // visitors who can actually install get one nudge (iPhone: the share-route
  // steps; Android/desktop: the real install button). Dismiss once = never
  // auto-shown again (Settings keeps the install path). ?installdemo=ios|
  // chromeios|inapp|android previews a variant.
  const [installVariant, setInstallVariant] = useState<InstallVariant | null>(() => {
    try {
      const demo = new URLSearchParams(window.location.search).get("installdemo");
      if (demo === "ios" || demo === "chromeios" || demo === "inapp" || demo === "android") return demo;
    } catch {
      /* ignore */
    }
    return null;
  });
  useEffect(() => {
    if (installVariant || showPrompt) return;
    if (isStandalone() || installPromptSeen()) return;
    const resolve = (): InstallVariant | null => {
      if (isIosInAppBrowser()) return "inapp";
      if (isIosChrome()) return "chromeios";
      if (isIos()) return "ios";
      if (canInstall()) return "android";
      return null;
    };
    const id = setTimeout(() => setInstallVariant(resolve()), 900);
    // beforeinstallprompt can fire after our timeout; catch late arrivals.
    const off = onInstallChange(() => {
      if (!installPromptSeen() && !isStandalone()) setInstallVariant((v) => v ?? resolve());
    });
    return () => {
      clearTimeout(id);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPrompt]);

  // With a profile the server uses the account name; guests type one.
  const effectiveName = account ? account.name : name.trim();
  const canCreate = effectiveName.length > 0;
  const canJoin = effectiveName.length > 0 && code.trim().length === 4;

  // Gold dot on the Dagronde tile until today's round is played (accounts via
  // the server, guests via their local copy). Best-effort: no dot on failure.
  const [dailyPending, setDailyPending] = useState(false);
  useEffect(() => {
    const tok = localStorage.getItem("penneer.accountToken");
    fetch("/api/daily/info", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => r.json())
      .then((d) => {
        let played = !!d.played;
        if (!played) {
          try {
            const saved = JSON.parse(localStorage.getItem("penneer.dailyResult") || "null");
            if (saved && saved.day === d.day) played = true;
          } catch {
            /* no local copy */
          }
        }
        setDailyPending(!played);
      })
      .catch(() => {});
  }, []);

  // Today's missions (progress for accounts; guests see them with a nudge).
  // Lives behind the Target icon in the top bar; the badge counts what's open.
  const [missions, setMissions] = useState<{ key: string; target: number; reward: number; progress: number; done: boolean }[] | null>(null);
  const [missionsLeft, setMissionsLeft] = useState(0);
  const [showMissions, setShowMissions] = useState(false);
  const fetchMissions = () => {
    const tok = localStorage.getItem("penneer.accountToken");
    fetch("/api/missions", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => r.json())
      .then((d) => {
        setMissions(d.missions);
        setMissionsLeft(d.seconds_left || 0);
      })
      .catch(() => {});
  };
  // Refetch when the account state flips (login/creation while on Landing).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchMissions, [account?.id]);
  const missionsOpen = account && missions ? missions.filter((m) => !m.done).length : 0;

  const create = () => {
    sound.unlock();
    sound.uiTap();
    game.createRoom(effectiveName);
  };
  const join = () => {
    sound.unlock();
    sound.uiTap();
    game.joinRoom(code.trim().toUpperCase(), effectiveName);
  };

  return (
    <Screen>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
        <button
          onClick={onShowHub}
          aria-label={t("profile")}
          className="pressable avatar-glow"
          style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, background: withAlpha("#000000", 0.26), border: `1px solid ${withAlpha(colors.gold, 0.32)}`, borderRadius: 999, cursor: "pointer", padding: "5px 13px 5px 5px" }}
        >
          {account ? (
            <>
              <Avatar name={account.name} color={account.color} size={26} userId={account.id} hasAvatar={account.has_avatar} avatarVer={account.avatar_ver} />
              <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: colors.ink, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</span>
            </>
          ) : (
            <>
              <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: withAlpha(colors.gold, 0.14), border: `1px solid ${withAlpha(colors.gold, 0.4)}`, color: colors.gold }}>
                <UserRound size={15} />
              </span>
              <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: colors.sub }}>{t("profile")}</span>
            </>
          )}
          {inboxCount > 0 && (
            <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 5px", borderRadius: 999, background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontSize: 10.5, fontWeight: 800, lineHeight: "17px", textAlign: "center", boxShadow: `0 0 8px ${withAlpha(colors.gold, 0.6)}` }}>
              {inboxCount > 9 ? "9+" : inboxCount}
            </span>
          )}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <MusicToggle />
          <button
            onClick={() => {
              sound.uiTap();
              if (!missions) fetchMissions(); // first fetch may have failed offline
              setShowMissions(true);
            }}
            aria-label={t("missionsTitle")}
            className="pressable glowhover"
            style={{ position: "relative", background: "transparent", border: "none", cursor: "pointer", color: colors.sub, display: "flex", padding: 9 }}
          >
            <Target size={23} />
            {missionsOpen > 0 && (
              <span style={{ position: "absolute", top: 3, right: 3, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 999, background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontSize: 9.5, fontWeight: 800, lineHeight: "15px", textAlign: "center", boxShadow: `0 0 8px ${withAlpha(colors.gold, 0.6)}` }}>
                {missionsOpen}
              </span>
            )}
          </button>
          <button
            onClick={onShowShop}
            aria-label={t("shopTitle")}
            className="pressable glowhover"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.sub, display: "flex", padding: 9 }}
          >
            <ShoppingCart size={23} />
          </button>
          <button
            onClick={onShowSettings}
            aria-label={t("settings")}
            className="pressable glowhover"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.sub, display: "flex", padding: 9 }}
          >
            <SettingsIcon size={24} />
          </button>
        </div>
      </div>
      <LandingFX />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 26 }}>
        <div className="reveal-rise" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "6px 0" }}>
          {/* Hero light: breathing radial glow + slow rays + rising dust, all
              behind the logo/title (zIndex layering, transform-only motion). */}
          {/* overflow hidden keeps the dust inside the hero box (and any wide
              decor from ever widening the page). */}
          <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 0, overflow: "hidden" }}>
            {[
              { l: "30%", t: "62%", s: 4, c: colors.gold, d: 0, dur: 7 },
              { l: "68%", t: "58%", s: 3, c: colors.goldHi, d: 1.8, dur: 8 },
              { l: "22%", t: "38%", s: 3, c: colors.violet, d: 3.2, dur: 9 },
              { l: "76%", t: "34%", s: 4, c: colors.gold, d: 4.4, dur: 7.5 },
              { l: "52%", t: "70%", s: 2.5, c: colors.ink, d: 2.4, dur: 8.5 },
              { l: "42%", t: "30%", s: 2.5, c: colors.goldHi, d: 5.4, dur: 7 },
            ].map((p, i) => (
              <span
                key={i}
                className="hero-particle"
                style={{
                  left: p.l,
                  top: p.t,
                  width: p.s,
                  height: p.s,
                  background: p.c,
                  boxShadow: `0 0 ${p.s * 2.4}px ${withAlpha(p.c === colors.ink ? colors.violet : p.c, 0.9)}`,
                  animationDelay: `${p.d}s`,
                  animationDuration: `${p.dur}s`,
                }}
              />
            ))}
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            {/* The logo IS the light source: breathing glow + slowly rotating
                rays centered on the coin, logo floating on top of them. */}
            <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
              <div
                aria-hidden
                className="breath-glow"
                style={{
                  position: "absolute",
                  width: 340,
                  height: 340,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${withAlpha(colors.gold, 0.15)} 0%, ${withAlpha(colors.violet, 0.12)} 38%, transparent 68%)`,
                }}
              />
              <div
                aria-hidden
                className="hero-rays"
                style={{
                  position: "absolute",
                  width: 300,
                  height: 300,
                  borderRadius: "50%",
                  background: `repeating-conic-gradient(${withAlpha(colors.gold, 0.045)} 0deg 7deg, transparent 7deg 27deg)`,
                  WebkitMaskImage: "radial-gradient(circle, black 20%, transparent 62%)",
                  maskImage: "radial-gradient(circle, black 20%, transparent 62%)",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, animation: "float-soft 4s ease-in-out infinite" }}>
                <Logo size={150} />
              </div>
            </div>
            <h1
              style={{
                margin: 0,
                // Cybergame (the studio face, already italic-shaped) is only
                // this wordmark; vw-clamped so it never clips small phones.
                // Cybergame is a very condensed face: it needs a much larger
                // px size than Space Grotesk did to span the same hero width.
                fontFamily: "'Cybergame', 'Space Grotesk', sans-serif",
                fontWeight: 400,
                fontSize: "min(72px, 17.5vw)",
                letterSpacing: "0.14em",
                whiteSpace: "nowrap",
                color: colors.ink,
                textShadow: `0 0 44px ${withAlpha(colors.violet, 0.85)}, 0 0 16px ${withAlpha(colors.gold, 0.4)}, 0 2px 0 rgba(0,0,0,.28)`,
              }}
            >
              PEN NEER
            </h1>
            <p
              style={{
                margin: 0,
                textAlign: "center",
                fontFamily: font.ui,
                fontWeight: 500,
                fontSize: 15,
                lineHeight: 1.65,
                letterSpacing: 0.3,
                color: "#CFC6E8",
                maxWidth: 300,
              }}
            >
              {t("tagline")}
            </p>
          </div>
        </div>

        <Card
          className="reveal-rise"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 24,
            animationDelay: "0.1s",
            background: "linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.028))",
            border: "1px solid rgba(255,255,255,.15)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.17), 0 30px 70px rgba(0,0,0,.45), 0 8px 24px rgba(0,0,0,.3)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          {account ? (
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, textAlign: "center" }}>
              {t("playingAs")} <span style={{ color: colors.gold, fontWeight: 700 }}>{account.name}</span>
            </p>
          ) : (
            <input style={inputStyle} placeholder={t("yourName")} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          )}

          {mode === "none" ? (
            // 8 Ball Pool-style square action tiles, in the Pen Neer arcade skin:
            // the hero action is the filled gold tile, the rest each get their
            // own accent. The Dagronde tile carries a gold dot until today's
            // round is played.
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: 12 }}>
              <Tile
                primary
                disabled={!canCreate}
                onClick={create}
                icon={<Play size={34} strokeWidth={2.2} fill="currentColor" />}
                label={t("createRoom")}
              />
              <Tile
                accent={colors.violet}
                onClick={() => {
                  sound.uiTap();
                  setMode("join");
                }}
                icon={<Hash size={34} strokeWidth={2.2} />}
                label={t("joinCta")}
              />
              <Tile
                accent={colors.orange}
                onClick={() => {
                  sound.uiTap();
                  onShowDaily();
                }}
                icon={<CalendarDays size={34} strokeWidth={2.2} />}
                label={t("dailyTitle")}
                badge={dailyPending}
              />
              <Tile
                accent={colors.green}
                onClick={() => {
                  sound.uiTap();
                  onShowTraining();
                }}
                icon={<GraduationCap size={34} strokeWidth={2.2} />}
                label={t("trainTitle")}
              />
            </div>
          ) : (
            <>
              <input
                style={{ ...inputStyle, fontFamily: font.display, letterSpacing: 6, textAlign: "center", textTransform: "uppercase" }}
                placeholder={t("code")}
                value={code}
                maxLength={4}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              />
              <Button variant="primary" full disabled={!canJoin} onClick={join}>
                {t("join")}
              </Button>
              <Button variant="ghost" full onClick={() => setMode("none")}>
                {t("back")}
              </Button>
            </>
          )}
        </Card>

        {game.state.error && (
          <p style={{ textAlign: "center", color: colors.red, fontFamily: font.ui, fontSize: 14, margin: 0 }}>{game.state.error}</p>
        )}

        <button
          onClick={onShowRules}
          className="pressable reveal-rise"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: colors.sub,
            fontFamily: font.ui,
            fontSize: 13.5,
            padding: 6,
            animationDelay: "0.2s",
          }}
        >
          <HelpCircle size={16} />
          {t("howItWorks")}
        </button>

        <NotifyNudge />
      </div>

      {showPrompt && !account && <ProfilePrompt game={game} onClose={() => setShowPrompt(false)} />}
      {installVariant && !showPrompt && <InstallPrompt variant={installVariant} onClose={() => setInstallVariant(null)} />}
      {showMissions && (
        <MissionsSheet
          missions={missions ?? []}
          secondsLeft={missionsLeft}
          isAccount={!!account}
          onClose={() => setShowMissions(false)}
        />
      )}
    </Screen>
  );
}

// Missions overlay behind the Target icon: today's three with progress, the
// reward, and when the next set drops. Tap the backdrop or X to close.
function MissionsSheet({
  missions,
  secondsLeft,
  isAccount,
  onClose,
}: {
  missions: { key: string; target: number; reward: number; progress: number; done: boolean }[];
  secondsLeft: number;
  isAccount: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const [left, setLeft] = useState(secondsLeft);
  useEffect(() => {
    const id = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  const countdown = `${p(Math.floor(left / 3600))}:${p(Math.floor((left % 3600) / 60))}:${p(Math.floor(left % 60))}`;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", padding: 22, background: "rgba(6,3,18,.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      <Card
        className="pop-in"
        style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12, padding: 20 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <Target size={17} color={colors.gold} />
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("missionsTitle")}</span>
          <button onClick={onClose} aria-label={t("back")} className="pressable" style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }} onClick={(e) => e.stopPropagation()}>
          {missions.map((m) => (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 10, opacity: isAccount ? 1 : 0.55 }}>
              <span
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  background: m.done ? colors.green : withAlpha("#000000", 0.3),
                  border: `1px solid ${m.done ? colors.green : colors.hairline}`,
                  color: colors.bg0,
                }}
              >
                {m.done && <Check size={13} strokeWidth={3} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: m.done ? colors.sub : colors.ink, textDecoration: m.done ? "line-through" : "none" }}>
                    {t(`mission_${m.key}`)}
                  </span>
                  <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: colors.gold, flexShrink: 0 }}>
                    {t("missionReward", { n: m.reward })}
                  </span>
                </div>
                {m.target > 1 && !m.done && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 999, background: withAlpha("#000000", 0.32), overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((m.progress / m.target) * 100)}%`, height: "100%", borderRadius: 999, background: colors.gold }} />
                    </div>
                    <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>
                      {m.progress}/{m.target}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {!isAccount && (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint }} onClick={(e) => e.stopPropagation()}>{t("missionsGuest")}</p>
        )}
        <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12, color: colors.faint }} onClick={(e) => e.stopPropagation()}>
          {t("missionsNewIn", { t: countdown })}
        </p>
      </Card>
    </div>
  );
}

// Square 8BP-style action tile: big glowing icon + label. `primary` renders the
// filled gold hero tile (gloss, shimmer sweep, occasional sparkle); the rest
// get a glassy panel with their own ambient accent glow. Fixed icon/label
// slots keep all four tiles pixel-identical in height and alignment.
function Tile({
  icon,
  label,
  onClick,
  accent = colors.gold,
  primary = false,
  disabled = false,
  badge = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: string;
  primary?: boolean;
  disabled?: boolean;
  badge?: boolean;
}) {
  const base: React.CSSProperties = {
    position: "relative",
    aspectRatio: "1 / 1",
    width: "100%",
    height: "100%",
    borderRadius: radius.card,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    cursor: disabled ? "default" : "pointer",
    fontFamily: font.display,
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 1.22,
    letterSpacing: 0.2,
    textAlign: "center",
    opacity: disabled ? 0.45 : 1,
    overflow: "hidden",
  };
  const iconSlot: React.CSSProperties = { height: 46, display: "grid", placeItems: "center", flexShrink: 0 };
  const labelSlot: React.CSSProperties = { minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center" };
  if (primary) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="pressable"
        style={{
          ...base,
          color: "#2A1B05",
          background: `linear-gradient(165deg, #FFE9A8 0%, ${colors.goldHi} 30%, ${colors.gold} 64%, #E8A62A 100%)`,
          border: "none",
          boxShadow: `0 16px 38px ${withAlpha(colors.gold, 0.36)}, 0 4px 12px rgba(0,0,0,.35), inset 0 2px 0 rgba(255,255,255,.55), inset 0 -4px 0 rgba(0,0,0,.16)`,
        }}
      >
        <span aria-hidden className="shimmer-bar" />
        <Sparkles aria-hidden className="twinkle" size={14} color="#FFF8E0" style={{ position: "absolute", top: 10, right: 10 }} />
        <span style={{ ...iconSlot, filter: "drop-shadow(0 1px 0 rgba(255,255,255,.4))" }}>{icon}</span>
        <span style={labelSlot}>{label}</span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="pressable"
      style={{
        ...base,
        color: colors.ink,
        background: `linear-gradient(160deg, ${withAlpha(accent, 0.22)} 0%, ${withAlpha("#000000", 0.26)} 58%, ${withAlpha("#000000", 0.34)} 100%)`,
        border: `1.5px solid ${withAlpha(accent, 0.5)}`,
        boxShadow: `inset 0 1px 0 ${withAlpha("#FFFFFF", 0.1)}, inset 0 -14px 24px rgba(0,0,0,.2), 0 14px 32px rgba(0,0,0,.32), 0 6px 22px ${withAlpha(accent, 0.16)}`,
      }}
    >
      {/* top edge light reflection */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: "12%",
          right: "12%",
          height: 1,
          background: `linear-gradient(90deg, transparent, ${withAlpha(accent, 0.65)}, transparent)`,
        }}
      />
      <span style={{ ...iconSlot, color: accent, filter: `drop-shadow(0 0 11px ${withAlpha(accent, 0.6)})` }}>{icon}</span>
      <span style={labelSlot}>{label}</span>
      {badge && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 11,
            height: 11,
            borderRadius: 999,
            background: colors.gold,
            boxShadow: `0 0 10px ${withAlpha(colors.gold, 0.8)}`,
          }}
        />
      )}
    </button>
  );
}

// Fixed full-screen decor behind the landing content: two layers drifting in
// opposite directions (cheap parallax depth) carrying barely-visible alphabet
// letters and a few static dust specks. zIndex -1 keeps it above the body
// gradient but under everything interactive; pointer-events stay off.
function LandingFX() {
  const letter: React.CSSProperties = {
    position: "absolute",
    fontFamily: font.display,
    fontWeight: 700,
    color: "rgba(202,190,235,.032)",
    userSelect: "none",
    lineHeight: 1,
  };
  const speck = (l: string, t: string, s: number, c: string, o: number): React.CSSProperties => ({
    position: "absolute",
    left: l,
    top: t,
    width: s,
    height: s,
    borderRadius: 999,
    background: c,
    opacity: o,
    boxShadow: `0 0 ${s * 3}px ${c}`,
  });
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, overflow: "hidden", pointerEvents: "none" }}>
      <div className="drift-a" style={{ position: "absolute", inset: "-30px" }}>
        <span style={{ ...letter, fontSize: 150, top: "7%", left: "-3%", transform: "rotate(-12deg)" }}>P</span>
        <span style={{ ...letter, fontSize: 96, top: "55%", right: "-2%", transform: "rotate(9deg)" }}>R</span>
        <span style={{ ...letter, fontSize: 80, bottom: "6%", left: "10%", transform: "rotate(6deg)" }}>A</span>
        <span style={speck("22%", "24%", 3, colors.violet, 0.16)} />
        <span style={speck("80%", "14%", 2.5, colors.gold, 0.14)} />
      </div>
      <div className="drift-b" style={{ position: "absolute", inset: "-30px" }}>
        <span style={{ ...letter, fontSize: 120, top: "30%", right: "4%", transform: "rotate(14deg)" }}>N</span>
        <span style={{ ...letter, fontSize: 88, bottom: "18%", right: "26%", transform: "rotate(-8deg)" }}>E</span>
        <span style={{ ...letter, fontSize: 104, top: "12%", left: "30%", transform: "rotate(-5deg)" }}>K</span>
        <span style={speck("12%", "66%", 3, colors.gold, 0.13)} />
        <span style={speck("64%", "80%", 2.5, colors.violet, 0.15)} />
        <span style={speck("38%", "10%", 2, colors.ink, 0.12)} />
      </div>
    </div>
  );
}
