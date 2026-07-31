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
import { useEffect, useRef, useState } from "react";
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
/** Tijdens het invullen staat de letter naast de stroom, dus iets kleiner dan
 *  bij het rollen, maar wel groot genoeg om DE letter te zijn. */
const ROL_KLEIN = 0.62;

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

/** Eén regel die zichzelf typt. Geen geluid: het is een ondertitel, geen
 *  gebeurtenis. Het typen begint zodra de regel bestaat, en omdat de lijst op
 *  speler-id is gesleuteld gebeurt dat precies één keer, bij wie er NIEUW bij
 *  komt. */
function TypRegel({ naam, kleur, staart, avatar }: { naam: string; kleur: string; staart: string; avatar: React.ReactNode }) {
  const vol = `${naam} ${staart}`;
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= vol.length) {
          window.clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 26);
    return () => window.clearInterval(id);
  }, [vol]);

  // De naam eerst, in zijn eigen kleur; wat daarna komt is gewone tekst. Door
  // op dezelfde teller te knippen loopt het typen dwars door die kleurgrens
  // heen, als één zin.
  const naamDeel = vol.slice(0, Math.min(n, naam.length));
  const staartDeel = n > naam.length ? vol.slice(naam.length, n) : "";

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span className="pop-in" style={{ display: "flex", flexShrink: 0 }}>{avatar}</span>
      <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 4px rgba(0,0,0,.9)" }}>
        <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 800, color: kleur }}>{naamDeel}</span>
        <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.ink }}>{staartDeel}</span>
      </span>
    </span>
  );
}

/** De hoogtepunten van de ronde: per categorie het antwoord dat de meeste
 *  punten pakte. Dat is wat een uitzending na een ronde laat zien, en het is
 *  ook het enige uit de uitslag dat je in vier regels kwijt kunt: de hele
 *  scorelijst staat toch al op de pagina eronder. */
function Hoogtepunten({ game, max = 4 }: { game: GameApi; max?: number }) {
  const { t } = useT();
  const room = game.state.room;
  const ronde = room?.round;
  if (!room || !ronde) return null;

  const beste: { cat: string; speler: (typeof room.players)[number]; woord: string; punten: number }[] = [];
  for (const cat of room.settings.categories) {
    let top: { speler: (typeof room.players)[number]; woord: string; punten: number } | null = null;
    for (const speler of room.players) {
      const punten = ronde.points[speler.id]?.[cat] ?? 0;
      const woord = ronde.answers[speler.id]?.[cat]?.text ?? "";
      if (!woord || punten <= 0) continue;
      if (!top || punten > top.punten) top = { speler, woord, punten };
    }
    if (top) beste.push({ cat, ...top });
  }
  // De dikste vangst bovenaan, en niet meer dan er past.
  beste.sort((a, b) => b.punten - a.punten);

  if (beste.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        padding: "7px 10px 8px",
        borderRadius: 12,
        background: "linear-gradient(180deg, rgba(10,4,20,.72) 0%, rgba(6,3,14,.78) 100%)",
        boxShadow: `inset 0 0 0 1px ${withAlpha(colors.gold, 0.45)}`,
      }}
    >
      <span style={{ fontFamily: font.ui, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: withAlpha(colors.gold, 0.85) }}>
        {t("streamHoogtepunten")}
      </span>
      {beste.slice(0, max).map((h) => (
        <TypRegel
          key={h.cat}
          naam={h.speler.name}
          kleur={h.speler.color}
          staart={`${h.woord} +${h.punten}`}
          avatar={<Avatar name={h.speler.name} color={h.speler.color} size={20} userId={h.speler.user_id} hasAvatar={h.speler.has_avatar} avatarVer={h.speler.avatar_ver} />}
        />
      ))}
    </div>
  );
}

/** Wie klaar is, als een stroom regels naast de letter. De laatste onderaan,
 *  zoals in een chat: wat er net gebeurde staat het dichtst bij je oog. */
function KlaarStroom({ game, max = 5 }: { game: GameApi; max?: number }) {
  const { t } = useT();
  const room = game.state.room;
  if (!room) return null;
  const klaar = room.ready_ids
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p && !p.is_spectator)
    .slice(-max);

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 5 }}>
      {klaar.map((p) => (
        <TypRegel
          key={p.id}
          naam={p.name}
          kleur={p.color}
          staart={t("streamIsKlaar")}
          avatar={<Avatar name={p.name} color={p.color} size={20} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} />}
        />
      ))}
    </div>
  );
}

/** De lichtkrant rechtsonder: wie er aan kop gaat. Reist heen en weer, zoals de
 *  regel boven een podium, want een stilstaande regel leest als een label en
 *  een reizende als een omroep. */
function LedBalk({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room;
  if (!room) return null;
  const meedoen = room.players.filter((p) => !p.is_spectator);
  const hoogste = Math.max(0, ...meedoen.map((p) => room.scores[p.id] ?? 0));
  const kop = meedoen.filter((p) => (room.scores[p.id] ?? 0) === hoogste);
  const tekst =
    hoogste <= 0
      ? t("streamNogNiks")
      : kop.length === 1
        ? t("streamKop", { naam: kop[0].name, n: String(hoogste) })
        : t("streamGelijk", { namen: kop.slice(0, 3).map((p) => p.name).join(", "), n: String(hoogste) });

  return (
    <span
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 8,
        height: 18,
        overflow: "hidden",
        display: "block",
      }}
    >
      <span
        className="led-reis"
        style={{
          top: 2,
          fontFamily: font.ui,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: colors.gold,
          textShadow: `0 0 8px ${withAlpha(colors.gold, 0.55)}`,
        }}
      >
        {tekst}
      </span>
    </span>
  );
}

export function Livestream({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room;
  const klok = useKlok(room?.timer.ends_at ? room.timer.ends_at * 1000 : null);

  // "Pennen neer!" hoort bij het einde van de ronde, en wie in de chat zit ziet
  // die over het hele scherm niet: App houdt hem dan tegen, want een schreeuw
  // over je gesprek heen is geen uitzending maar een onderbreking. Hier komt
  // hij terug op de plek waar je toch al kijkt. Zelfde bron als daar (het
  // round_ended-teken van de server), dus hij valt op precies hetzelfde moment.
  const eindeTeken = game.state.roundEndedToken;
  const vorigTeken = useRef(eindeTeken);
  const [pennenNeer, setPennenNeer] = useState(false);
  useEffect(() => {
    if (eindeTeken === vorigTeken.current) return;
    vorigTeken.current = eindeTeken;
    setPennenNeer(true);
    const id = window.setTimeout(() => setPennenNeer(false), 1700);
    return () => window.clearTimeout(id);
  }, [eindeTeken]);

  if (!room) return null;

  const leider = room.players.find((p) => p.id === room.active_player_id);
  const letter = room.round?.letter ?? "";
  const rolStand = letter ? "locked" : game.state.spinning ? "spinning" : "idle";
  const rolt = room.phase === "reveal";
  const vult = room.phase === "fill";
  // De uitslag deelt het beeld met het invullen: dezelfde letter op dezelfde
  // plek, alleen staat er rechts nu wat het ODLEVERDE in plaats van wie klaar
  // is. Zo blijft de rol staan waar hij stond en verspringt er niets.
  const uitslag = room.phase === "results";
  const naast = vult || uitslag;

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
      {uitslag && (
        // De uitslag heeft geen rol nodig: die is gevallen. Links wat de ronde
        // opleverde, rechts wie er klaar staat voor de volgende.
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "0 12px", minHeight: 0 }}>
          <div style={{ flex: 1.15, minWidth: 0 }}>
            <Hoogtepunten game={game} max={3} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignSelf: "stretch" }}>
            <KlaarStroom game={game} max={3} />
          </div>
        </div>
      )}

      {(rolt || vult) && (
        // EEN rol voor allebei de momenten, niet twee. Bij het omslaan van
        // rollen naar invullen verandert alleen zijn maat en groeit de kolom
        // ernaast open; omdat het dezelfde doos blijft schuift hij zelf naar
        // zijn nieuwe plek in plaats van te verspringen. Twee losse rollen
        // zouden hier onvermijdelijk knipperen.
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: vult ? 12 : 0, width: "100%", padding: "0 12px", minHeight: 0, transition: "gap .42s cubic-bezier(.2,1,.3,1)" }}>
          <div
            style={{
              ...rolVak(vult ? ROL_KLEIN : ROL_GROOT),
              transition: "transform .42s cubic-bezier(.2,1,.3,1), margin .42s cubic-bezier(.2,1,.3,1)",
            }}
          >
            <Reel state={rolStand} letter={letter} exclude={room.used_letters} hard={room.settings.hard_letters} skin={leider?.reel_skin ?? null} />
          </div>
          {/* De kolom groeit open vanaf nul breed. Een maximum is wel te
              animeren, `flex-grow` niet, dus dat is waar de beweging in zit. */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: vult ? 230 : 0,
              opacity: vult ? 1 : 0,
              overflow: "hidden",
              transition: "max-width .42s cubic-bezier(.2,1,.3,1), opacity .3s ease",
            }}
          >
            <KlaarStroom game={game} />
          </div>
        </div>
      )}

      {!rolt && !naast && (
        <>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 34, letterSpacing: 3, color: colors.gold, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>
            {room.code}
          </span>
          <SpelerRij game={game} klaarIds={room.phase === "rules" ? room.ready_ids : []} />
        </>
      )}

      {pennenNeer && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(6,3,18,.55)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <div style={{ textAlign: "center", animation: "pen-splash 1.7s ease forwards", padding: "0 12px" }}>
            {/* Early GameBoy tekent klein voor zijn puntgrootte en heeft geen
                onderkast, dus groter en in kapitalen. Kleiner dan de versie op
                het volle scherm: dit vak is een derde daarvan. */}
            <div style={{ fontFamily: "'Early GameBoy', 'Space Grotesk', sans-serif", fontWeight: 400, fontSize: "min(22px, 5.4vw)", letterSpacing: 1, lineHeight: 1.35, textTransform: "uppercase", color: "#FFC23D", textShadow: "0 0 26px rgba(255,194,61,.55), 0 3px 0 rgba(0,0,0,.35)" }}>
              {t("penDownSplash")}
            </div>
            <div style={{ marginTop: 5, fontFamily: "Inter, sans-serif", fontSize: 12, color: "#CFC6E8" }}>
              {t("penDownSub")}
            </div>
          </div>
        </div>
      )}

      {/* Het merkje linksonder: dit is geen plaatje van het spel maar het spel
          zelf, live. Een knipperend stipje zegt dat in één oogopslag. De lijn is
          een inset-schaduw en geen laag eromheen, want op een merkje van zestien
          pixels hoog loopt zo'n losse laag net niet meer om de vulling heen. */}
      <span
        style={{
          position: "absolute",
          left: 12,
          bottom: 30,
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
            bottom: 31,
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

      {uitslag && <LedBalk game={game} />}

      {/* De klok rechtsonder, tegenover het merkje. Alleen als er echt een klok
          loopt: een room zonder tijd heeft niets af te tellen. */}
      {!!klok && (
        <span
          className="zacht-in"
          style={{
            position: "absolute",
            right: 12,
            bottom: 30,
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
