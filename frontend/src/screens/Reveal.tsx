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
import { ArtIcoon } from "../components/ArtIcoon";
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
          {/* De banner hoort los boven de rol te hangen, niet erop te leunen. De
              negatieve marge boven en de gelijke marge onder heffen elkaar op,
              dus alleen de banner schuift omhoog; de rol blijft staan. */}
          <div style={{ marginTop: -26, marginBottom: 26, display: "flex", justifyContent: "center", width: "100%" }}>
            <TurnBanner
              name={game.isActive ? null : active?.name ?? "?"}
              label={game.isActive ? t("youSpin") : t("xSpinsRound", { name: active?.name ?? "?" })}
              avatar={active ? <Avatar name={active.name} color={active.color} size={40} userId={active.user_id} hasAvatar={active.has_avatar} avatarVer={active.avatar_ver} frame={active.frame} /> : null}
            />
          </div>

          <Reel state={reelState} letter={letter} exclude={room.used_letters} hard={room.settings.hard_letters} skin={active?.reel_skin ?? null} />

          <div style={{ minHeight: 170, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            {locked ? (
              <HintBar text={t("everyoneFills")} tone={colors.green} />
            ) : game.isActive ? (
              <>
                <Buzzer label={spinning ? "STOP" : t("spin")} size={104} skin={game.state.account?.buzzer_skin ?? null} onPress={() => (spinning ? game.spinStop() : game.spinStart())} />
                {/* De draai-hint hoort op een regel te staan, met het handje ervoor.
                    De stop-hint is een zin langer en mag wel afbreken. */}
                <HintBar text={spinning ? t("pressStop") : t("pressToSpin")} icon={<Hand size={16} />} nowrap={!spinning} />
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

/** Wie er draait: geen dichte balk maar TWEE LIJNEN met er niets tussen, zodat
 *  de arena er dwars doorheen te zien is. Aan elke kant staat een pijl, precies
 *  zo hoog als de afstand tussen de twee lijnen.
 */
const BANNER_H = 54;

// De lijn is geen streep maar een laagje licht. Een `border` of een enkele
// achtergrond kan dat niet: dan is hij overal even sterk en even hard. Daarom
// een stapeling die samen als gloeiende energie leest:
//
//  1. het verloop: donker marineblauw aan de uiteinden, via elektrisch blauw en
//     indigo naar fel paars in het midden;
//  2. een dun bijna-wit randje bovenop, MAAR alleen in het midden. Bijna-wit op
//     de bijna-zwarte flanken mengt tot grijs, en op een lijn van 1,5px is dat
//     randje bijna de halve lijn, dus dan wordt de hele lijn grijs. Het randje is
//     een glans, en glans hoort alleen te zitten waar de lijn oplicht;
//  3. een kleine bloom eronder, net genoeg om te gloeien zonder wazig te worden.
//
// Het uitfaden aan de uiteinden doet EEN masker over die hele stapel. Zou elke
// laag zijn eigen fade krijgen, dan lopen ze niet gelijk uit en zie je de laagjes
// los van elkaar eindigen.
// Het blauw ligt vlak bij de achtergrondkleur van de arena, dus de flanken van
// de lijn zakken erin weg en alleen het midden licht op.
const LINE_RAMP =
  "linear-gradient(90deg, #0A0724 0%, #0A1440 16%, #1A1470 32%, #6A3DF5 44%, #A86BFF 50%, #6A3DF5 56%, #1A1470 68%, #0A1440 84%, #0A0724 100%)";
const LINE_FADE = "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)";
// Voor de hintbalk: de lijn loopt van rand tot rand en is overal te zien; het is
// de HIGHLIGHT die in het midden zit. De grondkleur blijft dus zichtbaar blauw in
// plaats van weg te zakken, en alleen de lichte kern verschilt van lengte, onder
// wat langer dan boven.
const LINE_BASE = "#241C7A";
const rampWithCore = (half: number) =>
  `linear-gradient(90deg, ${LINE_BASE} 0%, ${LINE_BASE} ${50 - half}%, #6A3DF5 ${50 - half * 0.45}%, #A86BFF 50%, #6A3DF5 ${50 + half * 0.45}%, ${LINE_BASE} ${50 + half}%, ${LINE_BASE} 100%)`;
const RAMP_CORE_SHORT = rampWithCore(14);
const RAMP_CORE_LONG = rampWithCore(28);
// De ring om de hintbalk: dikte en verloop.
const RING = 1.5;
const RING_RAMP = rampWithCore(26);
const glans = (half: number) =>
  `linear-gradient(90deg, transparent ${50 - half}%, rgba(231,216,255,.55) 50%, transparent ${50 + half}%)`;
const LINE_H = 1.5;

function EnergyLine({ side, core }: { side: "top" | "bottom"; core?: "short" | "long" }) {
  // Zonder `core` is het de banner-variant: die zakt juist wel weg naar de
  // uiteinden. Met `core` loopt de lijn door tot de rand en verschilt alleen de
  // lengte van de lichtkern.
  const ramp = core === "short" ? RAMP_CORE_SHORT : core === "long" ? RAMP_CORE_LONG : LINE_RAMP;
  const shine = glans(core === "long" ? 22 : core === "short" ? 12 : 18);
  const fade = (core
    ? {}
    : { WebkitMaskImage: LINE_FADE, maskImage: LINE_FADE }) as React.CSSProperties;
  return (
    <>
      {/* De bloom ligt eronder en is bewust klein: een brede gloed maakt de lijn
          juist vaag in plaats van verlicht. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          [side]: -2,
          left: 0,
          right: 0,
          height: LINE_H + 4,
          background: ramp,
          opacity: 0.45,
          filter: "blur(3px)",
          pointerEvents: "none",
          ...fade,
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          [side]: 0,
          left: 0,
          right: 0,
          height: LINE_H,
          background: ramp,
          pointerEvents: "none",
          ...fade,
        }}
      />
      {/* 2: de glans bovenop. Eigen laag, want hij heeft zijn eigen horizontale
          begrenzing: alleen daar waar de lijn oplicht. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          [side]: 0,
          left: 0,
          right: 0,
          height: 0.6,
          background: shine,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

// De pijl hoort bij de lijnen, dus hij krijgt hetzelfde verloop en dezelfde
// bloom: fel violet aan de kant van de balk, donkerder naar de punt toe. Het
// verloop staat per pijl onder een eigen id; twee keer hetzelfde id in de DOM
// gaat op termijn mis zodra er een uit beeld verdwijnt.
function Chevron({ id }: { id: string }) {
  const path = `M 2 2 L 11 ${BANNER_H / 2} L 2 ${BANNER_H - 2}`;
  const svg = (extra?: React.CSSProperties) => (
    <svg aria-hidden width={13} height={BANNER_H} viewBox={`0 0 13 ${BANNER_H}`} style={{ display: "block", ...extra }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C46BFF" />
          <stop offset="45%" stopColor="#9A4DFF" />
          <stop offset="100%" stopColor="#6A2DFF" />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  return (
    <span style={{ position: "relative", display: "flex", flexShrink: 0, width: 13, height: BANNER_H }}>
      {/* De gloed is een vervaagde kopie erachter, geen drop-shadow: die laat iOS
          de laag apart rasteren en dan zie je zijn rechthoek. */}
      <span aria-hidden style={{ position: "absolute", inset: 0, filter: "blur(3.5px)", opacity: 0.6 }}>{svg()}</span>
      {svg({ position: "relative" })}
    </span>
  );
}

function TurnBanner({ label, avatar }: { name: string | null; label: string; avatar: React.ReactNode }) {
  return (
    // De balk is zo breed als wat erin staat: rekt hij op tot volle breedte, dan
    // duwt de gecentreerde tekst zichzelf van de avatar af.
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, maxWidth: "100%" }}>
      <span style={{ transform: "scaleX(-1)", display: "flex" }}>
        <Chevron id="chev-left" />
      </span>
      <div
        style={{
          position: "relative",
          minWidth: 0,
          maxWidth: 300,
          height: BANNER_H,
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingRight: 14,
          // Bewust geen achtergrond: tussen de twee lijnen hoort de arena door
          // te lopen.
          background: "transparent",
        }}
      >
        <EnergyLine side="top" />
        <EnergyLine side="bottom" />

        {/* Avatar met kroontje. */}
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
            <ArtIcoon naam="kroon" size={20} />
          </span>
        </span>

        <span
          style={{
            minWidth: 0,
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 16.5,
            letterSpacing: 0.5,
            color: "#FFFFFF",
            textShadow: "0 2px 8px rgba(0,0,0,.7)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </div>
      <Chevron id="chev-right" />
    </div>
  );
}

/** De regel onder de knop: een omlijnd balkje in plaats van losse tekst, zodat
 *  hij bij de rest van het toneel hoort. */
function HintBar({ text, icon, tone = colors.sub, nowrap = false }: { text: string; icon?: React.ReactNode; tone?: string; nowrap?: boolean }) {
  return (
    // De omlijning loopt met de ronde hoeken mee, dus het is een RING en geen
    // losse lijnen: een laag met het verloop erop, met daarbinnen de balk zelf.
    // Wat er tussenuit steekt is de lijn. Een `border` kan geen verloop dragen,
    // vandaar deze twee lagen.
    <div style={{ position: "relative", maxWidth: 320, borderRadius: 14, padding: RING, background: RING_RAMP }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          padding: "10px 17px",
          borderRadius: 14 - RING,
          background: withAlpha(ARENA.base, 0.72),
          color: tone,
          fontFamily: font.ui,
          fontSize: 13.5,
          textAlign: "center",
          whiteSpace: nowrap ? "nowrap" : undefined,
        }}
      >
        {icon && <span style={{ color: colors.gold, display: "flex", flexShrink: 0 }}>{icon}</span>}
        <span>{text}</span>
      </div>
      {/* De glans op de ring: boven kort, onder langer. Hij zit alleen in het
          midden, dus hij raakt de ronde hoeken nooit. */}
      <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: RING, background: glans(12), pointerEvents: "none" }} />
      <span aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: RING, background: glans(24), pointerEvents: "none" }} />
    </div>
  );
}
