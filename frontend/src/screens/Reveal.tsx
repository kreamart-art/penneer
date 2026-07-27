// Reveal — de roulette, in de arena. De speler die aan de beurt is bedient de
// Draai-knop (Draai -> STOP); de rest kijkt toe. Bij het vallen ziet iedereen
// de letter, met een klik erbij.
//
// De arena-plaat staat er met zijn podium precies onder de Draai-knop, zodat de
// knop op het toneel staat in plaats van op een lege achtergrond.
import { useEffect, useRef } from "react";
import { Crown, Hand } from "lucide-react";
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

// De achtergrond is een STAANDE uitsnede uit het midden van de brede arena-plaat
// (620x887 uit 1774x887, op ware grootte bewaard). Dat is de hele truc: de brede
// plaat over een hoog telefoonscherm trekken kostte ruim 4x opblazen en dus
// zichtbare waas, terwijl de zijkanten toch werden weggesneden. Door meteen te
// snijden wat je nooit ziet, houden we alle pixels over voor wat wel in beeld
// komt en vult hij het scherm zonder waas.
//
// Het podium zit op 77.7% van de hoogte; met object-fit: cover is de hoogte de
// krappe kant, dus het landt vanzelf daar, netjes onder de Draai-knop.
const PODIUM = 0.777;

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
      <Arena src="/game-bg.webp" podium={PODIUM} at="79%" fill glowAt="70%" />
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
        <AlphabetStrip used={room.used_letters} hard={room.settings.hard_letters} lockedLetter={letter} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <TurnBanner
            name={game.isActive ? null : active?.name ?? "?"}
            label={game.isActive ? t("youSpin") : t("xSpinsRound", { name: active?.name ?? "?" })}
            avatar={active ? <Avatar name={active.name} color={active.color} size={40} userId={active.user_id} hasAvatar={active.has_avatar} avatarVer={active.avatar_ver} frame={active.frame} /> : null}
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

/** Wie er draait: de spelerbanner. Aan elke kant twee pijltjes, en de boven- en
 *  onderrand zijn twee lijntjes die naar de uiteinden toe uitfaden met een witte
 *  highlight in het midden.
 *
 *  Die twee lijntjes kunnen geen `border` zijn: een border is overal even sterk
 *  en volgt bovendien geen clip-path. Het zijn losse laagjes met een horizontaal
 *  verloop, zodat ze in het midden oplichten en aan de punten oplossen.
 *
 *  De afwerking komt uit de aangeleverde art-specs (donkerpaarse vulling met
 *  ruis, ingehouden binnengloed, gouden kroontje, lichtveeg elke zes seconden).
 *  Die kwamen als React Native; dit is dezelfde vormgeving in de webstack.
 */
const BANNER_CUT =
  "polygon(16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0 50%)";

/** Twee pijltjes naast elkaar, spiegelbaar. */
function Chevrons({ dir }: { dir: 1 | -1 }) {
  return (
    <svg
      aria-hidden
      width={22}
      height={26}
      viewBox="0 0 22 26"
      style={{ flexShrink: 0, transform: dir === -1 ? "scaleX(-1)" : undefined }}
    >
      {[0, 9].map((x, i) => (
        <path
          key={x}
          d={`M ${x + 1} 3 L ${x + 9} 13 L ${x + 1} 23`}
          fill="none"
          stroke="#A855F7"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          // De buitenste is zwakker, zodat ze naar buiten toe wegvallen.
          opacity={i === 0 ? 0.45 : 0.95}
        />
      ))}
    </svg>
  );
}

function TurnBanner({ label, avatar }: { name: string | null; label: string; avatar: React.ReactNode }) {
  // Boven- en onderrand: wit in het midden, paars ernaast, weg bij de punten.
  const edge: React.CSSProperties = {
    position: "absolute",
    left: 12,
    right: 12,
    height: 1.5,
    background:
      "linear-gradient(90deg, transparent 0%, rgba(168,85,247,.55) 18%, rgba(255,255,255,.95) 50%, rgba(168,85,247,.55) 82%, transparent 100%)",
    pointerEvents: "none",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", maxWidth: 360 }}>
      <Chevrons dir={-1} />
      <div
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          height: 58,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 24px 0 20px",
          overflow: "hidden",
          clipPath: BANNER_CUT,
          background: "linear-gradient(180deg, #37206D 0%, #2A124F 55%, #180C35 100%)",
          boxShadow: "inset 0 0 26px rgba(168,85,247,.18)",
          filter: "drop-shadow(0 8px 18px rgba(0,0,0,.45))",
        }}
      >
        {/* Ruis: heel licht, tegen het vlakke plastic-gevoel van een egaal verloop. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E\")",
          }}
        />
        <span aria-hidden style={{ ...edge, top: 0 }} />
        <span aria-hidden style={{ ...edge, bottom: 0 }} />
        {/* De lichtveeg, elke 6 seconden een keer. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 70,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,.1), transparent)",
            animation: "banner-sweep 6s ease-in-out infinite",
          }}
        />

        {/* Avatar met kroontje, binnen de balk. */}
        <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
          {avatar}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -12,
              right: -5,
              color: colors.gold,
              filter: `drop-shadow(0 0 6px ${withAlpha(colors.gold, 0.85)})`,
              display: "flex",
            }}
          >
            <Crown size={18} strokeWidth={2.4} fill="currentColor" />
          </span>
        </span>

        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 16.5,
            letterSpacing: 0.5,
            color: "#FFFFFF",
            textShadow: "0 2px 6px rgba(0,0,0,.55)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>
      <Chevrons dir={1} />
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
