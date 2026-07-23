// Reveal — the roulette. Active player drives the Buzzer (Spin -> STOP); others
// watch. On lock everyone sees the big letter, with a satisfying lock sound.
import { useEffect, useRef } from "react";
import { AlphabetStrip } from "../components/AlphabetStrip";
import { Avatar } from "../components/Avatar";
import { Buzzer } from "../components/Buzzer";
import { Reel } from "../components/Reel";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font } from "../theme/tokens";

export function Reveal({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room!;
  const active = room.players.find((p) => p.id === room.active_player_id);
  const spinning = game.state.spinning;
  const letter = room.round?.letter ?? "";
  const locked = letter.length > 0;
  const reelState = locked ? "locked" : spinning ? "spinning" : "idle";

  // A round-1 reveal means the game (or a rematch) just kicked off.
  const startPlayed = useRef(false);
  useEffect(() => {
    if (room.round_no === 1 && !startPlayed.current) {
      startPlayed.current = true;
      sound.gameStart();
    }
  }, [room.round_no]);

  // Sound: the reel itself ticks per letter (Reel.tsx); we just ding on lock.
  const wasLocked = useRef(false);
  useEffect(() => {
    if (locked && !wasLocked.current) sound.lock();
    wasLocked.current = locked;
  }, [locked]);

  return (
    <Screen top={<TopBar code={room.code} roundNo={room.round_no} totalRounds={room.settings.rounds} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
      <AlphabetStrip used={room.used_letters} hard={room.settings.hard_letters} lockedLetter={letter} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {active && <Avatar name={active.name} color={active.color} size={40} crown userId={active.user_id} hasAvatar={active.has_avatar} avatarVer={active.avatar_ver} frame={active.frame} />}
          <span style={{ fontFamily: font.display, fontWeight: 600, fontSize: 20, color: colors.ink }}>
            {game.isActive ? t("youSpin") : t("xSpinsRound", { name: active?.name ?? "?" })}
          </span>
        </div>

        <Reel state={reelState} letter={letter} exclude={room.used_letters} hard={room.settings.hard_letters} />

        <div style={{ minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          {locked ? (
            <p style={{ fontFamily: font.ui, fontSize: 15, color: colors.green, textAlign: "center", margin: 0 }}>{t("everyoneFills")}</p>
          ) : game.isActive ? (
            <>
              <Buzzer label={spinning ? "STOP" : t("spin")} size={104} skin={game.state.account?.buzzer_skin ?? null} onPress={() => (spinning ? game.spinStop() : game.spinStart())} />
              <p style={{ fontFamily: font.ui, fontSize: 13.5, color: colors.sub, textAlign: "center", maxWidth: 280, margin: 0 }}>
                {spinning ? t("pressStop") : t("pressToSpin")}
              </p>
            </>
          ) : (
            <Card style={{ textAlign: "center", padding: "16px 22px" }}>
              <p style={{ fontFamily: font.ui, fontSize: 15, color: colors.sub, margin: 0 }}>
                {t("xSpinning", { name: active?.name ?? "?" })}
                <span style={{ color: colors.faint }}>...</span>
              </p>
            </Card>
          )}
        </div>
      </div>
    </Screen>
  );
}
