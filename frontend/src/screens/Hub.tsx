// Hub — profile, friends, inbox and leaderboard in one tabbed screen.
// Reached from the Landing. A profile is optional: guests see the create form.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Award, Bell, Camera, Check, Swords, Trash2, Trophy, UserPlus, Users, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Screen, Card } from "../components/Layout";
import type { Friend, GameApi, InboxItem } from "../net/socket";
import { useT } from "../i18n/i18n";
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

export function Hub({ game, onBack, onChallenge }: { game: GameApi; onBack: () => void; onChallenge: (userId: string) => void }) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("profile");
  const account = game.state.account;

  useEffect(() => {
    if (!account) return;
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
    { key: "inbox", label: t("inboxTab"), icon: <Bell size={15} />, badge: game.state.inbox.length || account?.inbox_count || 0 },
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
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {tabs.map(({ key, label, icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
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
    </Screen>
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
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setName(account?.name ?? ""), [account?.name]);

  async function uploadPhoto(file: File) {
    setBusy(true);
    try {
      const blob = await squareJpeg(file, 256);
      if (!blob) return;
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

  async function removePhoto() {
    const token = localStorage.getItem("penneer.accountToken");
    await fetch("/api/avatar", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    game.send({ type: "account_get" });
  }

  if (!account) {
    return (
      <>
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
      </>
    );
  }

  const stats = account.stats;
  const statRows: [string, number][] = [
    [t("statGames"), stats.games],
    [t("statWins"), stats.wins],
    [t("statPoints"), stats.points],
    [t("statBest"), stats.best],
    [t("statUniques"), stats.uniques],
    [t("statStreak"), stats.streak],
  ];

  return (
    <>
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
            <div style={{ display: "flex", gap: 6 }}>
              {playerColors.map((c) => (
                <button
                  key={c}
                  onClick={() => game.updateAccount({ color: c })}
                  aria-label={c}
                  style={{ width: 22, height: 22, borderRadius: 7, background: c, border: account.color === c ? `2px solid ${colors.ink}` : "2px solid transparent", cursor: "pointer" }}
                />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          <Button variant="ghost" full onClick={() => fileRef.current?.click()} disabled={busy}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Camera size={15} /> {busy ? t("photoBusy") : t("uploadPhoto")}
            </span>
          </Button>
          {account.has_avatar && (
            <Button variant="ghost" onClick={removePhoto}>{t("removePhoto")}</Button>
          )}
        </div>
      </Card>

      {/* stats */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {statRows.map(([label, value]) => (
            <div key={label} style={{ textAlign: "center", padding: "8px 4px", borderRadius: 12, background: withAlpha("#000000", 0.18) }}>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold }}>{value}</div>
              <div style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint }}>{label}</div>
            </div>
          ))}
        </div>
      </Card>

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

// Crop-center + resize a picked image to a square JPEG blob.
async function squareJpeg(file: File, size: number): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- Vrienden -----------------------------------------------------------------

function FriendsTab({ game, onChallenge }: { game: GameApi; onChallenge: (userId: string) => void }) {
  const { t } = useT();
  const account = game.state.account;
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});

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

  const row = (u: Friend | (typeof results)[number], right: React.ReactNode) => (
    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <div style={{ position: "relative" }}>
        <Avatar name={u.name} color={u.color} size={36} userId={u.id} hasAvatar={u.has_avatar} avatarVer={u.avatar_ver} />
        <span style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: u.online ? colors.green : colors.faint, border: `2px solid ${colors.bg1}` }} />
      </div>
      <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14.5, color: colors.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
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
                {smallBtn(<Check size={14} />, () => game.friendRespond(f.id, true), "gold")}
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
            {accepted.map((f) =>
              row(f, (
                <div style={{ display: "flex", gap: 6 }}>
                  {smallBtn(<><Swords size={13} /> {t("challengeBtn")}</>, () => onChallenge(f.id), "gold")}
                  {smallBtn(<Trash2 size={13} />, () => game.friendRemove(f.id))}
                  {smallBtn(t("blockUser"), () => game.friendBlock(f.id), "red")}
                </div>
              ))
            )}
            {pendingOut.map((f) => row(f, <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("pendingOut")}</span>))}
          </>
        )}
      </Card>
    </>
  );
}

// ---- Inbox ---------------------------------------------------------------------

function InboxTab({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  if (!account) {
    return <Card><p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("profileNeeded")}</p></Card>;
  }
  const items = game.state.inbox;
  return (
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
                <button onClick={() => game.friendRespond(item.from_id, true)} style={{ padding: "7px 12px", borderRadius: 9, border: "none", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("acceptBtn")}</button>
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
        {(["week", "all"] as const).map((p) => (
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
            {p === "week" ? t("thisWeek") : t("allTime")}
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
