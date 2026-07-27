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
            avatar={active ? <Avatar name={active.name} color={active.color} size={52} userId={active.user_id} hasAvatar={active.has_avatar} avatarVer={active.avatar_ver} frame={active.frame} /> : null}
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

/** Wie er draait: de spelerbanner. Vormgegeven naar de aangeleverde specs
 *  (AAA-mobielspel, donker paars, ingehouden neon): afgeschuinde hoeken links en
 *  rechts, dunne verloopsrand, avatar die over de linkerrand heen valt met een
 *  gloeiende rode ring en een kroontje erboven, en een lichtveeg die er elke zes
 *  seconden overheen trekt.
 *
 *  De specs kwamen als React Native met Reanimated en LinearGradient; die
 *  bestaan hier niet, dus dit is dezelfde vormgeving in de webstack van de app:
 *  clip-path voor de schuine hoeken, een tweede geknipte laag eronder voor de
 *  verloopsrand (een `border` volgt geen clip-path), en CSS-keyframes voor de
 *  beweging.
 */
const BANNER_CUT =
  "polygon(20px 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 20px 100%, 0 calc(100% - 20px), 0 20px)";

function TurnBanner({ label, avatar }: { name: string | null; label: string; avatar: React.ReactNode }) {
  const corner = (pos: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    width: 12,
    height: 12,
    opacity: 0.5,
    pointerEvents: "none",
    ...pos,
  });
  return (
    // Buitenlaag = de verloopsrand; de binnenlaag laat er 1.5px van vrij.
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 360,
        padding: 1.5,
        clipPath: BANNER_CUT,
        background: "linear-gradient(135deg, #8B5CF6, #5B21B6)",
        filter: "drop-shadow(0 8px 18px rgba(0,0,0,.45))",
        marginTop: 8,
      }}
    >
      <div
        style={{
          position: "relative",
          height: 74,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 18px 0 40px",
          overflow: "hidden",
          clipPath: BANNER_CUT,
          background: "linear-gradient(180deg, #37206D 0%, #2A124F 55%, #180C35 100%)",
          boxShadow: "inset 0 0 26px rgba(168,85,247,.18)",
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
        {/* Gloed die over de bovenrand schuift. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: 1.5,
            background: "linear-gradient(90deg, transparent, rgba(168,85,247,.9), transparent)",
            animation: "banner-edge 7s ease-in-out infinite",
          }}
        />
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
        {/* Kleine hoekjes linksboven en rechtsonder. */}
        <span aria-hidden style={{ ...corner({ top: 6, left: 26, borderTop: `1px solid ${withAlpha("#A855F7", 0.8)}`, borderLeft: `1px solid ${withAlpha("#A855F7", 0.8)}` }) }} />
        <span aria-hidden style={{ ...corner({ bottom: 6, right: 10, borderBottom: `1px solid ${withAlpha("#A855F7", 0.8)}`, borderRight: `1px solid ${withAlpha("#A855F7", 0.8)}` }) }} />

        {/* De avatar valt over de linkerrand heen, met een dikke gloeiende ring. */}
        <span
          style={{
            position: "absolute",
            left: -14,
            top: "50%",
            transform: "translateY(-50%)",
            width: 60,
            height: 60,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "#180C35",
            border: "3px solid #FF3B3B",
            boxShadow: "0 0 16px rgba(255,59,59,.55)",
          }}
        >
          <span style={{ borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center" }}>{avatar}</span>
          {/* Kroontje zweeft rechtsboven de avatar, met een zachte gouden gloed. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -11,
              right: -6,
              color: colors.gold,
              filter: `drop-shadow(0 0 6px ${withAlpha(colors.gold, 0.85)})`,
              display: "flex",
            }}
          >
            <Crown size={20} strokeWidth={2.4} fill="currentColor" />
          </span>
        </span>

        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: 0.6,
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
