// Reveal — de roulette, in de arena. De speler die aan de beurt is bedient de
// Draai-knop (Draai -> STOP); de rest kijkt toe. Bij het vallen ziet iedereen
// de letter, met een klik erbij.
//
// De arena-plaat staat er met zijn podium precies onder de Draai-knop, zodat de
// knop op het toneel staat in plaats van op een lege achtergrond.
import { useEffect, useRef } from "react";
import { Hand } from "lucide-react";
import { AlphabetStrip } from "../components/AlphabetStrip";
import { Arena, ARENA } from "../components/Arena";
import { Avatar } from "../components/Avatar";
import { Buzzer } from "../components/Buzzer";
import { Reel } from "../components/Reel";
import { Screen } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

// Het gloeiende podium zit op 77.1% van de hoogte van de plaat (gemeten: de
// helderste beeldrij). Op 76% van het scherm landt het onder de Draai-knop.
const PODIUM = 0.771;

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
    <Screen top={<div style={{ position: "relative", zIndex: 1 }}><TopBar code={room.code} roundNo={room.round_no} totalRounds={room.settings.rounds} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} /></div>}>
      <Arena src="/game-bg.webp" podium={PODIUM} at="76%" fill glowAt="70%" />
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
        <AlphabetStrip used={room.used_letters} hard={room.settings.hard_letters} lockedLetter={letter} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <TurnBanner
            name={game.isActive ? null : active?.name ?? "?"}
            label={game.isActive ? t("youSpin") : t("xSpinsRound", { name: active?.name ?? "?" })}
            avatar={active ? <Avatar name={active.name} color={active.color} size={38} crown userId={active.user_id} hasAvatar={active.has_avatar} avatarVer={active.avatar_ver} frame={active.frame} /> : null}
          />

          <Reel state={reelState} letter={letter} exclude={room.used_letters} hard={room.settings.hard_letters} skin={active?.reel_skin ?? null} />

          <div style={{ minHeight: 170, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            {locked ? (
              <HintBar text={t("everyoneFills")} tone={colors.green} />
            ) : game.isActive ? (
              <>
                <Buzzer label={spinning ? "STOP" : t("spin")} size={104} skin={game.state.account?.buzzer_skin ?? null} onPress={() => (spinning ? game.spinStop() : game.spinStart())} />
                <HintBar text={spinning ? t("pressStop") : t("pressToSpin")} icon={<Hand size={16} />} />
              </>
            ) : (
              <HintBar text={`${t("xSpinning", { name: active?.name ?? "?" })}...`} />
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}

/** Wie er draait: een afgeschuinde balk met een pijl aan weerszijden, zodat het
 *  leest als een aankondiging in plaats van als een regel tekst. */
function TurnBanner({ label, avatar }: { name: string | null; label: string; avatar: React.ReactNode }) {
  const chevron = (dir: 1 | -1) => (
    <span
      aria-hidden
      style={{
        width: 13,
        height: 30,
        flexShrink: 0,
        borderTop: `2px solid ${withAlpha(colors.violet, 0.7)}`,
        borderRight: `2px solid ${withAlpha(colors.violet, 0.7)}`,
        transform: `skewX(${dir * -18}deg) scaleX(${dir})`,
        clipPath: "polygon(0 0, 100% 50%, 0 100%)",
        background: withAlpha(colors.violet, 0.7),
      }}
    />
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
      {chevron(1)}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
          padding: "6px 18px 6px 6px",
          clipPath: "polygon(16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0 50%)",
          background: `linear-gradient(180deg, ${withAlpha(colors.violet, 0.16)}, ${withAlpha(ARENA.base, 0.5)})`,
          border: `1px solid ${withAlpha(colors.violet, 0.5)}`,
          boxShadow: `0 0 22px ${withAlpha(colors.violet, 0.3)}`,
        }}
      >
        {avatar}
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </div>
      {chevron(-1)}
    </div>
  );
}

/** De regel onder de knop: een omlijnd balkje in plaats van losse tekst, zodat
 *  hij bij de rest van het toneel hoort. */
function HintBar({ text, icon, tone = colors.sub }: { text: string; icon?: React.ReactNode; tone?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        maxWidth: 320,
        padding: "11px 18px",
        borderRadius: 14,
        background: withAlpha(ARENA.base, 0.55),
        border: `1px solid ${withAlpha(colors.violet, 0.4)}`,
        color: tone,
        fontFamily: font.ui,
        fontSize: 13.5,
        textAlign: "center",
      }}
    >
      {icon && <span style={{ color: colors.gold, display: "flex", flexShrink: 0 }}>{icon}</span>}
      <span>{text}</span>
    </div>
  );
}
