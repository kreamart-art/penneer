// De uitzending boven de chat.
//
// Wie in de room-chat zit kijkt weg van het spel, en dat was vroeger reden om de
// chat op slot te zetten tijdens het rollen. Deze sectie draait dat om: de
// ruimte boven de lade is toch al niets, dus daar komt het spel te staan. Geen
// doorkijkje naar het scherm eronder maar een EIGEN laag met dezelfde plaat als
// de speelpagina; zo kan er niets van het spel over de chat heen vallen en valt
// er ook niets te repareren aan wat voor of achter hoort.
//
// Er is op elk moment iets te zien, want elk moment in een potje heeft zijn
// eigen beeld: wie er binnen is, de rol die draait, de klok die loopt terwijl de
// anderen invullen. Wat een uitzending daarbij hoort te hebben staat er ook: een
// merkje dat zegt dat het live is, een klok, en een onderregel die zegt naar wie
// je kijkt.
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ARENA } from "./Arena";
import { Avatar } from "./Avatar";
import { Reel } from "./Reel";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

/** De rol is 172x200. Kleiner dan op de speelpagina: dit is een venster, geen
 *  hoofdzaak. */
const ROL_GROOT = 0.68;
/** Tijdens het invullen is de letter bijzaak naast de klok en de spelers. */
const ROL_KLEIN = 0.5;

/** De doos van een geschaalde rol blijft 200 hoog; alleen het BEELD krimpt.
 *  Zonder deze correctie staat er boven en onder de rol lucht die meetelt bij
 *  het uitmiddelen, en dan hangt hij te laag in het vak. */
const rolVak = (schaal: number) => ({
  transform: `scale(${schaal})`,
  transformOrigin: "center",
  lineHeight: 0,
  margin: `${-(200 * (1 - schaal)) / 2}px 0`,
});

/** mm:ss uit een tijdstip in de toekomst. Leeg als er geen klok loopt. */
function useKlok(eindeMs: number | null): string {
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    if (!eindeMs) return;
    const id = window.setInterval(() => setNu(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [eindeMs]);
  if (!eindeMs) return "";
  const over = Math.max(0, Math.round((eindeMs - nu) / 1000));
  return `${Math.floor(over / 60)}:${String(over % 60).padStart(2, "0")}`;
}

/** Een rij kleine avatars. Wie klaar is krijgt een vinkje op zijn schouder. */
function SpelerRij({ game, klaarIds }: { game: GameApi; klaarIds: string[] }) {
  const spelers = (game.state.room?.players ?? []).filter((p) => !p.is_spectator);
  const klaar = new Set(klaarIds);
  return (
    <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, padding: "0 14px" }}>
      {spelers.slice(0, 8).map((p) => (
        <span key={p.id} style={{ position: "relative", display: "flex", opacity: klaar.has(p.id) ? 1 : 0.55 }}>
          <Avatar name={p.name} color={p.color} size={26} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} divisie={p.divisie} />
          {klaar.has(p.id) && (
            <span
              style={{
                position: "absolute",
                right: -3,
                bottom: -3,
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: colors.green,
                display: "grid",
                placeItems: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,.6)",
              }}
            >
              <Check size={9} strokeWidth={3.4} color="#04180B" />
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function Livestream({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room;
  const klok = useKlok(room?.timer.ends_at ? room.timer.ends_at * 1000 : null);
  if (!room) return null;

  const leider = room.players.find((p) => p.id === room.active_player_id);
  const letter = room.round?.letter ?? "";
  const rolStand = letter ? "locked" : game.state.spinning ? "spinning" : "idle";
  const rolt = room.phase === "reveal";
  const vult = room.phase === "fill";

  // Het merkje draagt ook de ronde: hetzelfde plekje, meer te zeggen.
  const merk = room.phase === "lobby" || room.phase === "rules"
    ? t("streamLive")
    : `${t("streamLive")} · ${t("streamRonde", { n: String(room.round_no), van: String(room.settings.rounds) })}`;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "14px 0 34px",
        pointerEvents: "none",
        // Precies de achtergrond van de speelpagina.
        backgroundColor: ARENA.base,
        backgroundImage: "url(/game-bg.webp)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
      }}
    >
      {rolt && (
        <>
          <div style={rolVak(ROL_GROOT)}>
            <Reel state={rolStand} letter={letter} exclude={room.used_letters} hard={room.settings.hard_letters} skin={leider?.reel_skin ?? null} />
          </div>
        </>
      )}

      {vult && (
        <>
          <div style={rolVak(ROL_KLEIN)}>
            <Reel state="locked" letter={letter} exclude={room.used_letters} hard={room.settings.hard_letters} skin={leider?.reel_skin ?? null} />
          </div>
          <SpelerRij game={game} klaarIds={room.ready_ids} />
        </>
      )}

      {!rolt && !vult && (
        <>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 34, letterSpacing: 3, color: colors.gold, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>
            {room.code}
          </span>
          <SpelerRij game={game} klaarIds={room.phase === "rules" ? room.ready_ids : []} />
        </>
      )}

      {/* Het merkje linksonder: dit is geen plaatje van het spel maar het spel
          zelf, live. Een knipperend stipje zegt dat in één oogopslag. De lijn is
          een inset-schaduw en geen laag eromheen, want op een merkje van zestien
          pixels hoog loopt zo'n losse laag net niet meer om de vulling heen. */}
      <span
        style={{
          position: "absolute",
          left: 12,
          bottom: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 9px 3px 7px",
          borderRadius: 999,
          background: "linear-gradient(180deg, rgba(10,4,20,.92) 0%, rgba(6,3,14,.95) 100%)",
          boxShadow: `inset 0 0 0 1px ${withAlpha(colors.red, 0.85)}, 0 0 10px ${withAlpha(colors.red, 0.3)}`,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: colors.red,
            boxShadow: `0 0 6px ${colors.red}`,
            animation: "fill-pulse 1.1s ease-in-out infinite",
          }}
        />
        <span style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 9, letterSpacing: 0.7, color: colors.redHi, textTransform: "uppercase" }}>
          {merk}
        </span>
      </span>

      {/* Wie er draait, rechtsonder als kale tekst. Tijdens het rollen loopt er
          geen klok, dus die hoek is vrij; en een tweede pil naast het merkje
          zou lezen als een tweede knop. */}
      {rolt && (
        <span
          style={{
            position: "absolute",
            right: 12,
            bottom: 11,
            maxWidth: "62%",
            fontFamily: font.ui,
            fontSize: 11,
            fontWeight: 600,
            color: colors.ink,
            textShadow: "0 1px 4px rgba(0,0,0,.8)",
            textAlign: "right",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {game.isActive ? t("youSpin") : t("xSpinsRound", { name: leider?.name ?? "?" })}
        </span>
      )}

      {/* De klok rechtsonder, tegenover het merkje. Alleen als er echt een klok
          loopt: een room zonder tijd heeft niets af te tellen. */}
      {!!klok && (
        <span
          style={{
            position: "absolute",
            right: 12,
            bottom: 10,
            padding: "3px 10px",
            borderRadius: 999,
            background: "linear-gradient(180deg, rgba(10,4,20,.92) 0%, rgba(6,3,14,.95) 100%)",
            boxShadow: `inset 0 0 0 1px ${withAlpha(colors.gold, 0.5)}`,
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 12,
            color: colors.gold,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {klok}
        </span>
      )}
    </div>
  );
}
