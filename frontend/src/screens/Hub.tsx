// Hub — profile, friends, inbox and leaderboard in one tabbed screen.
// Reached from the Landing. A profile is optional: guests see the create form.
import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, Award, Bell, Camera, Check, MessageCircle, MoreVertical, Settings as SettingsIcon, Share2, Smile, Star, Swords, Trash2, Trophy, UserPlus, Users, X, ZoomIn, ZoomOut } from "lucide-react";
import { Avatar, RANK_RING } from "../components/Avatar";
import { Button } from "../components/Button";
import { MusicToggle } from "../components/MusicToggle";
import { Screen, Card } from "../components/Layout";
import type { AccountStats, Friend, GameApi, InboxItem, LevelInfo } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { makeProfileCard, shareOrDownload } from "../util/shareCard";
import { colors, font, playerColors, radius, withAlpha } from "../theme/tokens";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: font.ui,
  fontSize: 15,
  color: colors.ink,
  background: withAlpha("#000000", 0.25),
  border: `1.5px solid ${colors.panelBorder}`,
  borderRadius: radius.button,
  padding: "11px 13px",
};

type Tab = "profile" | "friends" | "inbox" | "leaderboard";

// Built-in illustrated avatars, mirrored server-side (backend/app/avatars).
const AVATAR_PRESETS = Array.from({ length: 18 }, (_, i) => `av${String(i + 1).padStart(2, "0")}`);
// Bump whenever the preset artwork changes (matches db.PRESET_ART_VERSION) so the
// picker's static images cache-bust instead of serving the stale ones.
const AVATAR_ART_VERSION = 8;

export function Hub({ game, onBack, onChallenge }: { game: GameApi; onBack: () => void; onChallenge: (userId: string) => void }) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("profile");
  const account = game.state.account;

  useEffect(() => {
    if (!account) return;
    if (tab === "profile") game.refreshBlocked();
    if (tab === "friends") game.refreshFriends();
    if (tab === "inbox") game.refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, !!account]);
  useEffect(() => {
    if (tab === "leaderboard") game.loadLeaderboard("week");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "profile", label: t("profile"), icon: <Award size={15} /> },
    { key: "friends", label: t("friendsTab"), icon: <Users size={15} /> },
    { key: "inbox", label: t("inboxTab"), icon: <Bell size={15} />, badge: (game.state.inbox.length || account?.inbox_count || 0) + (account?.dm_unread || 0) },
    { key: "leaderboard", label: t("leaderboardTab"), icon: <Trophy size={15} /> },
  ];

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
            <ArrowLeft size={20} />
          </button>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("profile")}</span>
          <div style={{ marginLeft: "auto" }}>
            <MusicToggle />
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {tabs.map(({ key, label, icon, badge }) => (
            <button
              key={key}
              onClick={() => { sound.uiTap(); setTab(key); }}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                position: "relative",
                padding: "9px 4px",
                borderRadius: radius.button,
                border: `1px solid ${tab === key ? withAlpha(colors.gold, 0.5) : colors.panelBorder}`,
                background: tab === key ? withAlpha(colors.gold, 0.12) : "transparent",
                color: tab === key ? colors.gold : colors.sub,
                fontFamily: font.ui,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {icon} {label}
              {!!badge && (
                <span style={{ position: "absolute", top: -6, right: -2, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: colors.gold, color: colors.bg0, fontSize: 10, fontWeight: 800, lineHeight: "16px" }}>
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "profile" && <ProfileTab game={game} />}
        {tab === "friends" && <FriendsTab game={game} onChallenge={onChallenge} />}
        {tab === "inbox" && <InboxTab game={game} />}
        {tab === "leaderboard" && <LeaderboardTab game={game} />}
      </div>

      {/* Open DM conversation (profile-to-profile, outside any room). */}
      {game.state.dmOpenWith && <DmThreadOverlay game={game} />}
    </Screen>
  );
}

// ---- Level / rang -------------------------------------------------------------

// 8 Ball Pool-style level strip: level chip + rank title + xp progress bar.
function LevelBar({ level, compact }: { level: LevelInfo; compact?: boolean }) {
  const { t } = useT();
  const span = Math.max(1, level.next_level - level.level_start);
  const frac = Math.min(1, Math.max(0, (level.xp - level.level_start) / span));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative", width: compact ? 40 : 48, height: compact ? 40 : 48, flexShrink: 0 }}>
        <Star size={compact ? 40 : 48} color={colors.gold} fill={withAlpha(colors.gold, 0.25)} strokeWidth={1.4} />
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: font.display, fontWeight: 700, fontSize: compact ? 15 : 18, color: colors.ink, paddingTop: 2 }}>
          {level.level}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
          <span style={{ fontFamily: font.ui, fontWeight: 700, fontSize: compact ? 12.5 : 13.5, color: colors.gold }}>{t(`rank_${level.rank}`)}</span>
          <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint }}>
            {level.xp - level.level_start}/{span} XP
          </span>
        </div>
        <div style={{ height: compact ? 8 : 10, borderRadius: 999, background: withAlpha("#000000", 0.35), border: `1px solid ${colors.hairline}`, overflow: "hidden" }}>
          <div style={{ width: `${Math.round(frac * 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${colors.gold}, ${colors.goldHi})`, boxShadow: `0 0 10px ${withAlpha(colors.gold, 0.6)}`, transition: "width .4s ease" }} />
        </div>
      </div>
    </div>
  );
}

function statGrid(t: (k: string) => string, stats: AccountStats): [string, string | number][] {
  const winPct = stats.games > 0 ? `${Math.round((stats.wins / stats.games) * 100)}%` : "0%";
  return [
    [t("statGames"), stats.games],
    [t("statWins"), stats.wins],
    [t("statWinPct"), winPct],
    [t("statPoints"), stats.points],
    [t("statBest"), stats.best],
    [t("statUniques"), stats.uniques],
    [t("statDubbels"), stats.dubbels],
    [t("statStreak"), stats.streak],
  ];
}

function StatGrid({ stats }: { stats: AccountStats }) {
  const { t } = useT();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
      {statGrid(t, stats).map(([label, value]) => (
        <div key={label} style={{ textAlign: "center", padding: "8px 2px", borderRadius: 12, background: withAlpha("#000000", 0.18) }}>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.gold }}>{value}</div>
          <div style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ---- Laatste potjes -------------------------------------------------------------

function HistoryCard({ game, meId }: { game: GameApi; meId: string }) {
  const { t } = useT();
  const games = game.state.history;

  useEffect(() => {
    game.historyGet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  const fmtDate = (ts: number) => {
    const d = new Date(ts * 1000);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return t("historyToday");
    const yesterday = new Date(today.getTime() - 86400000);
    if (d.toDateString() === yesterday.toDateString()) return t("historyYesterday");
    return `${d.getDate()}-${d.getMonth() + 1}`;
  };

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
        {t("historyTitle")}
      </span>
      {games.length === 0 ? (
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("noHistory")}</p>
      ) : (
        games.map((g, i) => (
          <div key={`${g.finished_at}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 10, background: withAlpha("#000000", 0.18), border: `1px solid ${g.is_winner ? withAlpha(colors.gold, 0.35) : colors.hairline}` }}>
            <span style={{ width: 34, textAlign: "center", flexShrink: 0, fontFamily: font.display, fontWeight: 700, fontSize: 14, color: g.is_winner ? colors.gold : colors.sub }}>
              {t("placeN", { p: g.place })}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {g.players.slice(0, 6).map((pl) => (
                  <span key={pl.user_id} style={{ opacity: pl.user_id === meId ? 1 : 0.85 }}>
                    <Avatar name={pl.name} color={pl.color} size={20} userId={pl.user_id} hasAvatar={pl.has_avatar} avatarVer={pl.avatar_ver} />
                  </span>
                ))}
                {g.player_count > 6 && (
                  <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint }}>+{g.player_count - 6}</span>
                )}
              </div>
              <div style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint, marginTop: 3 }}>
                {fmtDate(g.finished_at)} · {g.rounds === 1 ? t("historyRound1") : t("historyRounds", { n: g.rounds })}
              </div>
            </div>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: g.is_winner ? colors.gold : colors.ink, flexShrink: 0 }}>
              {g.score}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}

// ---- DM-gesprek ----------------------------------------------------------------

function DmThreadOverlay({ game }: { game: GameApi }) {
  const { t } = useT();
  const partnerId = game.state.dmOpenWith!;
  const messages = game.state.dmMessages;
  const me = game.state.account?.id;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  // Partner identity: from threads, friends, or the viewed profile.
  const partner =
    game.state.dmThreads.find((th) => th.partner === partnerId)?.user ??
    game.state.friends.find((f) => f.id === partnerId) ??
    (game.state.viewedProfile?.id === partnerId ? game.state.viewedProfile : null);

  useEffect(() => {
    // Opening marks the thread read server-side; sync badge + thread list.
    game.dmRefreshThreads();
    game.send({ type: "account_get" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const sendNow = () => {
    if (!text.trim()) return;
    game.dmSend(partnerId, text);
    setText("");
  };

  const fmt = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(6,3,18,.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, height: "78dvh", display: "flex", flexDirection: "column", borderRadius: "22px 22px 0 0", background: "linear-gradient(180deg, #241738, #160D30)", border: `1px solid ${withAlpha(colors.gold, 0.3)}`, borderBottom: "none", boxShadow: "0 -18px 60px rgba(0,0,0,.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${colors.hairline}` }}>
          {partner ? (
            <Avatar name={partner.name} color={partner.color} size={34} userId={partner.id} hasAvatar={partner.has_avatar} avatarVer={partner.avatar_ver} />
          ) : null}
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {partner?.name ?? "..."}
          </span>
          <button onClick={game.dmClose} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px", display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.length === 0 && (
            <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 13, color: colors.faint, marginTop: 20 }}>{t("dmNoMessages")}</p>
          )}
          {messages.map((m) => {
            const mine = m.from_user === me;
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                <div style={{ padding: "9px 12px", borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: mine ? withAlpha(colors.gold, 0.18) : withAlpha("#000000", 0.3), border: `1px solid ${mine ? withAlpha(colors.gold, 0.4) : colors.hairline}`, fontFamily: font.ui, fontSize: 14, color: colors.ink, lineHeight: 1.45, wordBreak: "break-word" }}>
                  {m.text}
                </div>
                <div style={{ fontFamily: font.ui, fontSize: 10, color: colors.faint, marginTop: 2, textAlign: mine ? "right" : "left" }}>{fmt(m.created_at)}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "10px 14px calc(12px + env(safe-area-inset-bottom))" }}>
          <input
            value={text}
            maxLength={500}
            placeholder={t("chatPlaceholder")}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendNow(); }}
            style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 15, color: colors.ink, background: withAlpha("#000000", 0.3), border: `1.5px solid ${colors.panelBorder}`, borderRadius: 12, padding: "11px 13px" }}
          />
          <Button variant="gold" disabled={!text.trim()} onClick={sendNow}>{t("chatSend")}</Button>
        </div>
      </div>
    </div>
  );
}

// ---- Profiel ----------------------------------------------------------------

function ProfileTab({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const colorDebounce = useRef<number | undefined>(undefined);
  const [sharing, setSharing] = useState(false);

  useEffect(() => setName(account?.name ?? ""), [account?.name]);
  useEffect(() => {
    if (settingsOpen && account) game.refreshBlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  async function uploadBlob(blob: Blob) {
    setBusy(true);
    try {
      const token = localStorage.getItem("penneer.accountToken");
      await fetch("/api/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
        body: blob,
      });
      game.send({ type: "account_get" }); // refresh avatar_ver
    } finally {
      setBusy(false);
    }
  }

  async function pickPreset(id: string) {
    setBusy(true);
    try {
      const token = localStorage.getItem("penneer.accountToken");
      await fetch("/api/avatar/preset", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      game.send({ type: "account_get" }); // refresh avatar_ver + avatar_preset
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <Fragment key="guest">
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("makeProfile")}</span>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t("makeProfileHint")}</p>
          <input style={inputStyle} placeholder={t("yourName")} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          <Button variant="gold" full disabled={name.trim().length < 2} onClick={() => game.createAccount(name)}>
            {t("makeProfile")}
          </Button>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("loginOtherTitle")}</span>
          {game.state.loginLinkSent ? (
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.green, lineHeight: 1.5 }}>{t("linkSent")}</p>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder={t("emailPlaceholder")} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
              <Button variant="ghost" disabled={!loginEmail.includes("@")} onClick={() => game.requestLogin(loginEmail)}>
                {t("sendLink")}
              </Button>
            </div>
          )}
        </Card>
      </Fragment>
    );
  }

  if (settingsOpen) {
    return <ProfileSettings game={game} email={email} setEmail={setEmail} onBack={() => setSettingsOpen(false)} />;
  }

  if (avatarPickerOpen) {
    return (
      <AvatarPickerScreen
        current={account.avatar_preset}
        busy={busy}
        onBack={() => setAvatarPickerOpen(false)}
        onPick={async (id) => {
          await pickPreset(id);
          setAvatarPickerOpen(false);
        }}
      />
    );
  }

  const shareCard = async () => {
    setSharing(true);
    try {
      const lvl = account.level;
      const winPct = account.stats.games > 0 ? `${Math.round((account.stats.wins / account.stats.games) * 100)}%` : "0%";
      const blob = await makeProfileCard({
        name: account.name,
        color: account.color,
        avatarUrl: account.has_avatar ? `/api/avatar/${account.id}?v=${account.avatar_ver}` : null,
        ringColor: RANK_RING[lvl.rank] ?? null,
        rankTitle: t(`rank_${lvl.rank}`),
        levelText: t("profileCardLevel", { n: lvl.level }),
        stats: [
          [t("statGames"), String(account.stats.games)],
          [t("statWins"), String(account.stats.wins)],
          [t("statWinPct"), winPct],
          [t("statPoints"), String(account.stats.points)],
        ],
        badgesLine: t("profileCardBadges", { n: account.badges.length }),
        footer: t("footer"),
      });
      if (blob) await shareOrDownload(blob, "penneer-profiel.png");
    } finally {
      setSharing(false);
    }
  };

  const iconBtn: React.CSSProperties = {
    background: "transparent",
    border: `1px solid ${colors.hairline}`,
    borderRadius: 10,
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    color: colors.sub,
  };

  return (
    <Fragment key="mine">
      {/* acties rechtsboven: delen + profielinstellingen als icoontjes */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, margin: "-6px 0 -8px" }}>
        <button onClick={shareCard} disabled={sharing} aria-label={t("shareProfile")} title={t("shareProfile")} style={{ ...iconBtn, opacity: sharing ? 0.5 : 1 }}>
          <Share2 size={17} />
        </button>
        <button onClick={() => setSettingsOpen(true)} aria-label={t("profileSettings")} title={t("profileSettings")} style={iconBtn}>
          <SettingsIcon size={17} />
        </button>
      </div>

      {/* identiteit */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={account.name} color={account.color} size={64} userId={account.id} hasAvatar={account.has_avatar} avatarVer={account.avatar_ver} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1, padding: "8px 11px" }} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
              {name.trim() !== account.name && (
                <Button variant="primary" onClick={() => game.updateAccount({ name })}>{t("save")}</Button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {playerColors.map((c) => (
                <button
                  key={c}
                  onClick={() => game.updateAccount({ color: c })}
                  aria-label={c}
                  style={{ width: 22, height: 22, borderRadius: 7, background: c, border: account.color === c ? `2px solid ${colors.ink}` : "2px solid transparent", cursor: "pointer" }}
                />
              ))}
              {/* Free choice: the REAL color input sits invisibly on top of the
                  rainbow wheel, so the tap lands on the picker itself. (A
                  scripted .click() on a hidden input is ignored on iOS.) */}
              <div
                title={t("customColor")}
                style={{
                  position: "relative",
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: "conic-gradient(#ff3b30, #ff9500, #ffd60a, #34c759, #32ade6, #5856d6, #ff2d92, #ff3b30)",
                  border: !playerColors.includes(account.color) ? `2px solid ${colors.ink}` : "2px solid transparent",
                  boxShadow: !playerColors.includes(account.color) ? `0 0 8px ${withAlpha(account.color, 0.7)}` : "none",
                }}
              >
                <input
                  ref={colorInputRef}
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(account.color) ? account.color : "#FFC23D"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (colorDebounce.current) window.clearTimeout(colorDebounce.current);
                    colorDebounce.current = window.setTimeout(() => game.updateAccount({ color: v }), 350);
                  }}
                  aria-label={t("customColor")}
                  style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
                />
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) setEditFile(e.target.files[0]);
              e.target.value = ""; // same file re-selectable
            }}
          />
          <Button variant="ghost" full onClick={() => fileRef.current?.click()} disabled={busy}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Camera size={15} /> {busy ? t("photoBusy") : t("uploadPhoto")}
            </span>
          </Button>
        </div>

        {/* Preset avatars live on their own page (keeps the profile short). */}
        <Button variant="ghost" full onClick={() => setAvatarPickerOpen(true)}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Smile size={15} /> {t("chooseAvatar")}
          </span>
        </Button>
      </Card>

      {editFile && (
        <AvatarEditor
          file={editFile}
          onDone={(blob) => {
            setEditFile(null);
            if (blob) uploadBlob(blob);
          }}
        />
      )}

      {/* level + rang + stats */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <LevelBar level={account.level} />
        <StatGrid stats={account.stats} />
      </Card>

      {/* laatste potjes */}
      <HistoryCard game={game} meId={account.id} />

      {/* prestaties */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{t("badgesTitle")}</span>
        {account.badges.length === 0 ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("noBadges")}</p>
        ) : (
          account.badges.map((b) => (
            <div key={b.badge} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: withAlpha(colors.gold, 0.08), border: `1px solid ${withAlpha(colors.gold, 0.25)}` }}>
              <Award size={16} color={colors.gold} />
              <span style={{ fontFamily: font.ui, fontSize: 13.5, color: colors.ink }}>{t(`badge_${b.badge}`)}</span>
            </div>
          ))
        )}
      </Card>

    </Fragment>
  );
}

// Avatar picker — its own page so the profile tab stays short.
function AvatarPickerScreen({
  current,
  busy,
  onBack,
  onPick,
}: {
  current: string | null;
  busy: boolean;
  onBack: () => void;
  onPick: (id: string) => void;
}) {
  const { t } = useT();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("chooseAvatarTitle")}</span>
      </div>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {AVATAR_PRESETS.map((id) => {
            const active = current === id;
            return (
              <button
                key={id}
                onClick={() => onPick(id)}
                disabled={busy}
                aria-label={id}
                style={{
                  padding: 0,
                  border: `2px solid ${active ? colors.gold : "transparent"}`,
                  borderRadius: 16,
                  overflow: "hidden",
                  cursor: "pointer",
                  aspectRatio: "1 / 1",
                  background: "transparent",
                  opacity: busy ? 0.6 : 1,
                  boxShadow: active ? `0 0 12px ${withAlpha(colors.gold, 0.55)}` : "none",
                }}
              >
                <img src={`/avatars/${id}.jpg?v=${AVATAR_ART_VERSION}`} alt={id} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}

// Profile settings: email linking, blocked players and account management,
// grouped in one sub-screen behind the "Profielinstellingen" button.
function ProfileSettings({
  game,
  email,
  setEmail,
  onBack,
}: {
  game: GameApi;
  email: string;
  setEmail: (v: string) => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const account = game.state.account!;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("profileSettings")}</span>
      </div>

      {/* e-mail koppelen */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("emailTitle")}</span>
        {account.email ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
            {t("emailLinked")} <span style={{ color: colors.green }}>{account.email}</span>
          </p>
        ) : (
          <>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("emailHint")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button variant="ghost" disabled={!email.includes("@")} onClick={() => game.linkEmail(email)}>
                {t("linkEmailBtn")}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* geblokkeerd */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{t("blockedTitle")}</span>
        {game.state.blocked.length === 0 ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("noBlocked")}</p>
        ) : (
          game.state.blocked.map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={u.name} color={u.color} size={32} userId={u.id} hasAvatar={u.has_avatar} avatarVer={u.avatar_ver} />
              <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
              <button
                onClick={() => game.friendBlock(u.id, true)}
                style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, padding: "7px 11px", borderRadius: 9, cursor: "pointer", color: colors.sub, background: "transparent", border: `1px solid ${colors.hairline}` }}
              >
                {t("unblockBtn")}
              </button>
            </div>
          ))
        )}
      </Card>

      {/* beheer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="ghost" full onClick={game.logoutAccount}>{t("logoutProfile")}</Button>
        <button
          onClick={() => window.confirm(t("deleteConfirm")) && game.deleteAccount()}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.red, fontFamily: font.ui, fontSize: 13, padding: 6 }}
        >
          {t("deleteAccount")}
        </button>
      </div>
    </>
  );
}

// Crop editor: square viewport, pinch-free zoom slider + drag to position.
// Renders the visible square to a 256px JPEG.
function AvatarEditor({ file, onDone }: { file: File; onDone: (blob: Blob | null) => void }) {
  const { t } = useT();
  const V = 260; // viewport size in css px
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => onDone(null);
    i.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const base = img ? V / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : V;
  const h = img ? img.naturalHeight * scale : V;
  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(V - w, x)),
    y: Math.min(0, Math.max(V - h, y)),
  });
  const pos = clamp(off.x, off.y);

  // Keep the viewport center anchored while zooming.
  function changeZoom(z: number) {
    if (!img) return;
    const oldScale = scale;
    const newScale = base * z;
    const cx = (V / 2 - pos.x) / oldScale;
    const cy = (V / 2 - pos.y) / oldScale;
    setZoom(z);
    setOff({ x: V / 2 - cx * newScale, y: V / 2 - cy * newScale });
  }

  function save() {
    if (!img) return onDone(null);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return onDone(null);
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, V / scale, V / scale, 0, 0, 256, 256);
    canvas.toBlob((b) => onDone(b), "image/jpeg", 0.85);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,3,18,.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ borderRadius: 20, background: "linear-gradient(180deg, #241738, #180F30)", border: `1px solid ${colors.panelBorder}`, boxShadow: "0 24px 70px rgba(0,0,0,.55)", padding: 18, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("avatarEditTitle")}</span>
        <div
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOff(clamp(drag.current.ox + (e.clientX - drag.current.x), drag.current.oy + (e.clientY - drag.current.y)));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          style={{ position: "relative", width: V, height: V, borderRadius: 24, overflow: "hidden", border: `2px solid ${withAlpha(colors.gold, 0.55)}`, cursor: "grab", touchAction: "none", background: "#000" }}
        >
          {img && (
            <img
              src={url}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: pos.x, top: pos.y, width: w, height: h, maxWidth: "none", userSelect: "none", pointerEvents: "none" }}
            />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: V }}>
          <ZoomOut size={16} color={colors.faint} />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: colors.gold }}
          />
          <ZoomIn size={16} color={colors.faint} />
        </div>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("dragHint")}</p>
        <div style={{ display: "flex", gap: 8, width: V }}>
          <Button variant="gold" full onClick={save}>{t("save")}</Button>
          <Button variant="ghost" onClick={() => onDone(null)}>{t("cancelCorrection")}</Button>
        </div>
      </div>
    </div>
  );
}

// ---- Vrienden -----------------------------------------------------------------

function FriendsTab({ game, onChallenge }: { game: GameApi; onChallenge: (userId: string) => void }) {
  const { t } = useT();
  const account = game.state.account;
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (query.trim().length >= 2) game.searchUsers(query);
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!account) {
    return <Card><p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("profileNeeded")}</p></Card>;
  }

  const friends = game.state.friends;
  const accepted = friends.filter((f) => f.status === "accepted");
  const pendingIn = friends.filter((f) => f.status === "pending" && f.requested_by !== account.id);
  const pendingOut = friends.filter((f) => f.status === "pending" && f.requested_by === account.id);
  const friendIds = new Set(friends.map((f) => f.id));
  const results = game.state.searchResults.filter((u) => !friendIds.has(u.id));

  // Tap a friend's avatar or name to open their score card.
  const openProfile = (id: string) => {
    game.viewProfile(id);
    setViewing(id);
  };

  const row = (u: Friend | (typeof results)[number], right: React.ReactNode, clickable = false) => (
    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <button
        onClick={clickable ? () => openProfile(u.id) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, cursor: clickable ? "pointer" : "default", textAlign: "left" }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar name={u.name} color={u.color} size={36} userId={u.id} hasAvatar={u.has_avatar} avatarVer={u.avatar_ver} />
          <span style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: u.online ? colors.green : colors.faint, border: `2px solid ${colors.bg1}` }} />
        </div>
        <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14.5, color: colors.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
      </button>
      {right}
    </div>
  );

  const smallBtn = (label: React.ReactNode, onClick: () => void, tone: "gold" | "ghost" | "red" = "ghost") => (
    <button
      onClick={onClick}
      style={{
        fontFamily: font.ui, fontSize: 12, fontWeight: 600, padding: "7px 10px", borderRadius: 9, cursor: "pointer",
        color: tone === "gold" ? colors.bg0 : tone === "red" ? colors.redHi : colors.sub,
        background: tone === "gold" ? colors.gold : tone === "red" ? withAlpha(colors.red, 0.14) : "transparent",
        border: tone === "ghost" ? `1px solid ${colors.hairline}` : "none",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input style={inputStyle} placeholder={t("searchName")} value={query} maxLength={20} onChange={(e) => setQuery(e.target.value)} />
        {results.map((u) =>
          row(u, sent[u.id]
            ? <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.green }}>{t("pendingOut")}</span>
            : smallBtn(<><UserPlus size={13} /> {t("addFriendBtn")}</>, () => { game.friendRequest(u.id); setSent((s) => ({ ...s, [u.id]: true })); }, "gold"))
        )}
      </Card>

      {pendingIn.length > 0 && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {pendingIn.map((f) =>
            row(f, (
              <div style={{ display: "flex", gap: 6 }}>
                {smallBtn(<Check size={14} />, () => { sound.friend(); game.friendRespond(f.id, true); }, "gold")}
                {smallBtn(<X size={14} />, () => game.friendRespond(f.id, false))}
              </div>
            ))
          )}
        </Card>
      )}

      <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {accepted.length === 0 && pendingOut.length === 0 ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint, lineHeight: 1.5 }}>{t("noFriends")}</p>
        ) : (
          <>
            {accepted.map((f) => (
              <div key={f.id} style={{ display: "flex", flexDirection: "column" }}>
                {row(f, (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {smallBtn(<><Swords size={13} /> {t("challengeBtn")}</>, () => onChallenge(f.id), "gold")}
                    <button
                      onClick={() => setMenuFor(menuFor === f.id ? null : f.id)}
                      aria-label={t("friendOptions")}
                      style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 9, border: `1px solid ${menuFor === f.id ? withAlpha(colors.gold, 0.5) : colors.hairline}`, background: menuFor === f.id ? withAlpha(colors.gold, 0.1) : "transparent", color: colors.sub, cursor: "pointer" }}
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>
                ), true)}
                {menuFor === f.id && (
                  <div style={{ display: "flex", gap: 8, padding: "0 0 8px", justifyContent: "flex-end" }}>
                    {smallBtn(<><Trash2 size={13} /> {t("removeFriend")}</>, () => { game.friendRemove(f.id); setMenuFor(null); })}
                    {smallBtn(t("blockUser"), () => { game.friendBlock(f.id); setMenuFor(null); }, "red")}
                  </div>
                )}
              </div>
            ))}
            {pendingOut.map((f) => row(f, <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("pendingOut")}</span>))}
          </>
        )}
      </Card>

      {viewing && <ProfileViewModal game={game} userId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

// Score card of another player: stats + achievements in a small overlay.
function ProfileViewModal({ game, userId, onClose }: { game: GameApi; userId: string; onClose: () => void }) {
  const { t } = useT();
  const p = game.state.viewedProfile;
  const loaded = p && p.id === userId;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,3,18,.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 380, maxHeight: "82vh", overflowY: "auto", borderRadius: 22, background: "linear-gradient(180deg, #241738, #160D30)", border: `1px solid ${withAlpha(colors.gold, 0.35)}`, boxShadow: "0 24px 70px rgba(0,0,0,.6)", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        {!loaded ? (
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 14, color: colors.faint }}>...</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={p.name} color={p.color} size={54} userId={p.id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontFamily: font.ui, fontSize: 12, color: p.online ? colors.green : colors.faint }}>{p.online ? "online" : "offline"}</div>
              </div>
              {p.is_friend && (
                <button
                  onClick={() => {
                    game.dmOpen(p.id);
                    onClose();
                  }}
                  aria-label={t("sendMessage")}
                  title={t("sendMessage")}
                  style={{ background: withAlpha(colors.gold, 0.14), border: `1px solid ${withAlpha(colors.gold, 0.45)}`, borderRadius: 10, width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer", color: colors.gold, flexShrink: 0 }}
                >
                  <MessageCircle size={17} />
                </button>
              )}
              <button onClick={onClose} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
                <X size={20} />
              </button>
            </div>
            <LevelBar level={p.level} compact />
            <StatGrid stats={p.stats} />
            {p.h2h && p.h2h.games > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 12, background: withAlpha(colors.violet, 0.12), border: `1px solid ${withAlpha(colors.violet, 0.35)}` }}>
                <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
                  {t("h2hTitle")}
                </span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12 }}>
                  <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>{t("you")}</span>
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 24, color: p.h2h.my_wins >= p.h2h.their_wins ? colors.gold : colors.ink }}>{p.h2h.my_wins}</span>
                  <span style={{ fontFamily: font.ui, fontSize: 14, color: colors.faint }}>·</span>
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 24, color: p.h2h.their_wins >= p.h2h.my_wins ? colors.gold : colors.ink }}>{p.h2h.their_wins}</span>
                  <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>{p.name}</span>
                </div>
                <span style={{ textAlign: "center", fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>
                  {t("h2hGames", { n: p.h2h.games })}
                </span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{t("badgesTitle")}</span>
              {p.badges.length === 0 ? (
                <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("noBadges")}</p>
              ) : (
                p.badges.map((b) => (
                  <div key={b.badge} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: withAlpha(colors.gold, 0.08), border: `1px solid ${withAlpha(colors.gold, 0.25)}` }}>
                    <Award size={16} color={colors.gold} />
                    <span style={{ fontFamily: font.ui, fontSize: 13.5, color: colors.ink }}>{t(`badge_${b.badge}`)}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Inbox ---------------------------------------------------------------------

function InboxTab({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  const threads = game.state.dmThreads;

  // Load the DM thread list alongside the invites.
  useEffect(() => {
    if (account) game.dmRefreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!account]);

  if (!account) {
    return <Card><p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("profileNeeded")}</p></Card>;
  }
  const items = game.state.inbox;
  return (
    <>
    {threads.length > 0 && (
      <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 4 }}>
          {t("dmTitle")}
        </span>
        {threads.map((th) => (
          <button
            key={th.partner}
            onClick={() => game.dmOpen(th.partner)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
          >
            <Avatar name={th.user.name} color={th.user.color} size={36} userId={th.user.id} hasAvatar={th.user.has_avatar} avatarVer={th.user.avatar_ver} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{th.user.name}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: th.unread > 0 ? colors.ink : colors.faint, fontWeight: th.unread > 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {th.last_from_me ? `${t("chatYou")}: ` : ""}{th.last_text}
              </div>
            </div>
            {th.unread > 0 && (
              <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontSize: 11, fontWeight: 800, lineHeight: "18px", textAlign: "center", flexShrink: 0 }}>
                {th.unread > 9 ? "9+" : th.unread}
              </span>
            )}
          </button>
        ))}
      </Card>
    )}
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint, lineHeight: 1.5 }}>{t("inboxEmpty")}</p>
      ) : (
        items.map((item: InboxItem, i) => (
          <div key={item.id ?? `fr-${item.from_id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, background: withAlpha("#000000", 0.18), border: `1px solid ${colors.hairline}` }}>
            <Avatar name={item.from_name} color={item.from_color} size={36} userId={item.from_id} hasAvatar={item.has_avatar} avatarVer={item.avatar_ver} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 13.5, color: colors.ink }}>{item.from_name}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>
                {item.type === "friend_request" ? t("pendingIn") : item.type === "challenge" ? t("challengedYou") : `${t("invitedYouTo")} ${item.room_code}`}
              </div>
            </div>
            {item.type === "friend_request" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { sound.friend(); game.friendRespond(item.from_id, true); }} style={{ padding: "7px 12px", borderRadius: 9, border: "none", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("acceptBtn")}</button>
                <button onClick={() => game.friendRespond(item.from_id, false)} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${colors.hairline}`, background: "transparent", color: colors.sub, fontFamily: font.ui, fontSize: 12, cursor: "pointer" }}>{t("declineBtn")}</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => item.id && game.inviteRespond(item.id, true)} style={{ padding: "7px 12px", borderRadius: 9, border: "none", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("joinBtn")}</button>
                <button onClick={() => item.id && game.inviteRespond(item.id, false)} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${colors.hairline}`, background: "transparent", color: colors.sub, fontFamily: font.ui, fontSize: 12, cursor: "pointer" }}>{t("declineBtn")}</button>
              </div>
            )}
          </div>
        ))
      )}
    </Card>
    </>
  );
}

// ---- Ranglijst ------------------------------------------------------------------

function LeaderboardTab({ game }: { game: GameApi }) {
  const { t } = useT();
  const lb = game.state.leaderboard;
  const period = lb?.period ?? "week";
  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        {(["week", "month", "all"] as const).map((p) => (
          <button
            key={p}
            onClick={() => game.loadLeaderboard(p)}
            style={{
              flex: 1, padding: "9px 4px", borderRadius: radius.button, cursor: "pointer",
              border: `1px solid ${period === p ? withAlpha(colors.violet, 0.6) : colors.panelBorder}`,
              background: period === p ? withAlpha(colors.violet, 0.18) : "transparent",
              color: period === p ? colors.ink : colors.sub, fontFamily: font.ui, fontSize: 12.5, fontWeight: 600,
            }}
          >
            {p === "week" ? t("thisWeek") : p === "month" ? t("seasonChip") : t("allTime")}
          </button>
        ))}
      </div>
      <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {!lb || lb.rows.length === 0 ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("lbEmpty")}</p>
        ) : (
          lb.rows.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
              <span style={{ width: 24, textAlign: "center", fontFamily: font.display, fontWeight: 700, fontSize: 15, color: i === 0 ? colors.gold : colors.faint }}>{i + 1}</span>
              <Avatar name={r.name} color={r.color} size={32} userId={r.id} hasAvatar={r.has_avatar} avatarVer={r.avatar_ver} />
              <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>{r.wins}W</span>
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: i === 0 ? colors.gold : colors.ink, width: 48, textAlign: "right" }}>{r.points}</span>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
