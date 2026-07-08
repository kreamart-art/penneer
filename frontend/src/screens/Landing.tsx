// Landing — emblem, wordmark, tagline, name input, create / join, rules link.
import { useState } from "react";
import { HelpCircle, Settings as SettingsIcon, UserRound } from "lucide-react";
import { Logo } from "../components/Logo";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
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
}: {
  game: GameApi;
  onShowRules: () => void;
  onShowSettings: () => void;
  onShowHub: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"none" | "join">("none");
  const account = game.state.account;
  const inboxCount = game.state.inbox.length || account?.inbox_count || 0;

  // With a profile the server uses the account name; guests type one.
  const effectiveName = account ? account.name : name.trim();
  const canCreate = effectiveName.length > 0;
  const canJoin = effectiveName.length > 0 && code.trim().length === 4;

  const create = () => {
    sound.unlock();
    game.createRoom(effectiveName);
  };
  const join = () => {
    sound.unlock();
    game.joinRoom(code.trim().toUpperCase(), effectiveName);
  };

  return (
    <Screen>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
        <button
          onClick={onShowHub}
          aria-label={t("profile")}
          style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, background: withAlpha("#000000", 0.22), border: `1px solid ${colors.panelBorder}`, borderRadius: 999, cursor: "pointer", padding: "5px 12px 5px 5px" }}
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
        <button
          onClick={onShowSettings}
          aria-label={t("settings")}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.sub, display: "flex", padding: 6 }}
        >
          <SettingsIcon size={22} />
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ animation: "float-soft 4s ease-in-out infinite" }}>
            <Logo size={150} />
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 52,
              letterSpacing: 2,
              color: colors.ink,
              textShadow: `0 0 30px ${withAlpha(colors.violet, 0.7)}, 0 0 10px ${withAlpha(colors.gold, 0.3)}`,
            }}
          >
            PEN NEER
          </h1>
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontFamily: font.ui,
              fontSize: 14.5,
              lineHeight: 1.5,
              color: colors.sub,
              maxWidth: 320,
            }}
          >
            {t("tagline")}
          </p>
        </div>

        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {account ? (
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, textAlign: "center" }}>
              {t("playingAs")} <span style={{ color: colors.gold, fontWeight: 700 }}>{account.name}</span>
            </p>
          ) : (
            <input style={inputStyle} placeholder={t("yourName")} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          )}

          {mode === "none" ? (
            <>
              <Button variant="gold" full disabled={!canCreate} onClick={create}>
                {t("createRoom")}
              </Button>
              <Button variant="ghost" full onClick={() => setMode("join")}>
                {t("joinCta")}
              </Button>
            </>
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
          }}
        >
          <HelpCircle size={16} />
          {t("howItWorks")}
        </button>
      </div>
    </Screen>
  );
}
