// Pre-game rules gate (Kingsen-style): after the host presses start, everyone
// sees the rules and must tap "Ik ben er klaar voor". Only when every connected
// player has confirmed can the host actually begin round 1.
import { Check } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Screen } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import { RulesContent } from "./Rules";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font } from "../theme/tokens";

export function RulesGate({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room!;
  const players = room.players.filter((p) => !p.is_spectator);
  const connected = players.filter((p) => p.connected);
  const iAmReady = !!(game.me && room.ready_ids.includes(game.me.id));
  const allReady = connected.length > 0 && connected.every((p) => room.ready_ids.includes(p.id));
  const readyCount = connected.filter((p) => room.ready_ids.includes(p.id)).length;

  return (
    <Screen top={<TopBar code={room.code} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <h2 style={{ margin: 0, fontFamily: font.display, fontWeight: 700, fontSize: 24, color: colors.ink }}>
            {t("rulesGateTitle")}
          </h2>
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.sub, maxWidth: 330, lineHeight: 1.5 }}>
            {t("rulesGateHint")}
          </p>
        </div>

        <RulesContent />

        {/* who has confirmed */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {players.map((p) => {
            const ready = room.ready_ids.includes(p.id);
            return (
              <div key={p.id} style={{ position: "relative" }}>
                <Avatar name={p.name} color={p.color} size={32} dim={!p.connected} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} />
                {ready && (
                  <span style={{ position: "absolute", bottom: -3, right: -3, background: colors.green, borderRadius: "50%", width: 14, height: 14, display: "grid", placeItems: "center", boxShadow: `0 0 6px ${colors.green}` }}>
                    <Check size={10} color={colors.bg0} strokeWidth={3} />
                  </span>
                )}
              </div>
            );
          })}
          <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>
            {t("readyCount", { n: readyCount, total: connected.length })}
          </span>
        </div>

        {game.isSpectator ? (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 14, color: colors.sub, margin: 0 }}>{t("waitNext")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button
              variant={iAmReady ? "ghost" : "gold"}
              full
              disabled={iAmReady}
              onClick={() => {
                sound.ready();
                game.setReady(true);
              }}
            >
              {iAmReady ? t("youReady") : t("rulesReadyBtn")}
            </Button>

            {game.isHost && (
              <>
                <Button variant="primary" full disabled={!allReady} onClick={game.startGame}>
                  {t("startGame")}
                </Button>
                {!allReady && (
                  <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, margin: 0, lineHeight: 1.5 }}>
                    {t("rulesWaitAll")}
                  </p>
                )}
                <button
                  onClick={game.rulesCancel}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.sub, fontFamily: font.ui, fontSize: 13, textDecoration: "underline", padding: 4 }}
                >
                  {t("rulesBackLobby")}
                </button>
              </>
            )}
            {!game.isHost && iAmReady && !allReady && (
              <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, margin: 0 }}>
                {t("rulesWaitOthers")}
              </p>
            )}
            {!game.isHost && allReady && (
              <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, margin: 0 }}>
                {t("waitHost")}
              </p>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
