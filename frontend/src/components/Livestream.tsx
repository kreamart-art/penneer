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
import { ArtIcoon } from "./ArtIcoon";
import { Avatar } from "./Avatar";
import { Reel } from "./Reel";
import type { GameApi } from "../net/socket";
import { hoogtepunten, prestaties, woordVanDeRonde } from "../lib/hoogtepunten";
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

/** Een regel waarin de woorden IN KAPITALEN goud zijn en de rest wit. De
 *  teksten zetten hun kern zelf al in kapitalen ("KreamTest had ALLES uniek",
 *  "Alleen Robbie had iets: SCHILDPAD"), dus dit hoeft niets te weten van welke
 *  regel het is: het volgt gewoon de nadruk die er al in zit. */
function Nadruk({ tekst, basis }: { tekst: string; basis: string }) {
  const delen = tekst.split(/([A-ZÀ-Þ]{2,}[A-ZÀ-Þ0-9]*)/g);
  return (
    <>
      {delen.map((d, i) =>
        /^[A-ZÀ-Þ]{2,}/.test(d)
          ? <span key={i} style={{ color: colors.gold }}>{d}</span>
          : <span key={i} style={{ color: basis }}>{d}</span>,
      )}
    </>
  );
}

/** Dezelfde hoogtepuntensectie als op de uitslagpagina: het woord van de ronde
 *  in zijn gouden lijst, en daaronder één regel per categorie. Uit dezelfde
 *  bron (lib/hoogtepunten.ts), zodat de kijker en de speler hetzelfde verhaal
 *  lezen. Compacter gezet, want dit vak is een derde van een pagina. */
function Hoogtepunten({ game }: { game: GameApi }) {
  const { t, tCat } = useT();
  const room = game.state.room;
  if (!room) return null;
  const spelers = room.players.filter((p) => !p.is_spectator);
  const woord = woordVanDeRonde(room, spelers);
  // Prestaties eerst: die gaan over een PERSOON en dat is wat een commentator
  // eruit pikt. Daarna de categorieregels. En binnen dat geheel de
  // OVERWINNINGEN bovenaan, want die krijgen de gouden lijst en dus de
  // aandacht; een vaststelling vult de rij alleen aan als er te weinig te
  // vieren valt. Drie regels, want meer past er niet in dit vak.
  const rang = { gold: 0, ink: 1, faint: 2 } as const;
  const regels = [...prestaties(room, spelers, t), ...hoogtepunten(room, spelers, t)]
    .map((h, i) => ({ h, i }))
    .sort((a, b) => rang[a.h.tone] - rang[b.h.tone] || a.i - b.i)
    .map((x) => x.h)
    .slice(0, 3);
  if (!woord && regels.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span style={{ fontFamily: font.ui, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: withAlpha(colors.gold, 0.85) }}>
        {t("revealHighlights")}
      </span>
      {woord && (
        <div
          className="stream-links-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 8px",
            borderRadius: 9,
            background: "linear-gradient(180deg, rgba(10,4,20,.7) 0%, rgba(6,3,14,.78) 100%)",
            boxShadow: `inset 0 0 0 1px ${withAlpha(colors.gold, 0.5)}`,
            minWidth: 0,
          }}
        >
          <ArtIcoon naam="sterren" size={13} />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontFamily: font.ui, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>
              {t("wordOfRound")}
            </span>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 11.5, color: colors.gold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {woord.word.toUpperCase()}
              <span style={{ fontFamily: font.ui, fontWeight: 500, fontSize: 9.5, color: colors.sub }}> · {woord.name}</span>
            </span>
          </div>
        </div>
      )}
      {regels.map((h, i) => (
        <div
          key={h.cat}
          className="stream-links-in"
          // Een, twee, drie: ze komen na elkaar binnen zoals ze na elkaar
          // uitgesproken zouden worden.
          //
          // Alles wat een overwinning MELDT krijgt dezelfde gouden lijst als het
          // woord van de ronde: een vlekkeloze ronde, de dikste oogst. Een
          // vaststelling ("twee verschillende woorden") krijgt hem niet, anders
          // is een lijst geen onderscheiding meer maar een opmaakstijl.
          style={{
            animationDelay: `${0.12 + i * 0.16}s`,
            display: "flex",
            alignItems: "baseline",
            gap: 7,
            minWidth: 0,
            ...(h.tone === "gold"
              ? {
                  alignItems: "center",
                  padding: "4px 8px",
                  borderRadius: 9,
                  background: "linear-gradient(180deg, rgba(10,4,20,.7) 0%, rgba(6,3,14,.78) 100%)",
                  boxShadow: `inset 0 0 0 1px ${withAlpha(colors.gold, 0.5)}`,
                }
              : null),
          }}
        >
          {/* Alleen een categorieregel krijgt zijn categorie ervoor. Een
              prestatie gaat over een speler en heeft geen kop nodig; die
              draagt een verzonnen sleutel en zou hier zijn eigen id tonen. */}
          {room.settings.categories.includes(h.cat) && (
            <span style={{ fontFamily: font.ui, fontSize: 8.5, color: colors.faint, width: 38, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tCat(h.cat)}
            </span>
          )}
          <span
            style={{
              fontFamily: font.ui,
              fontSize: 10,
              fontWeight: 600,
              textShadow: "0 1px 4px rgba(0,0,0,.85)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            <Nadruk tekst={h.text} basis={h.tone === "faint" ? colors.faint : colors.ink} />
          </span>
        </div>
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

/** De eindstand: de kampioen groot, met de rest eronder. Het slotbeeld van een
 *  uitzending, dus hier mag het wel een lijstje zijn. */
function Eindstand({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room;
  if (!room) return null;
  const rangen = room.players
    .filter((p) => !p.is_spectator)
    .map((p) => ({ p, punten: room.scores[p.id] ?? 0 }))
    .sort((a, b) => b.punten - a.punten);
  if (rangen.length === 0) return null;
  const kampioen = rangen[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", padding: "0 16px", minWidth: 0 }}>
      <div className="stream-links-in" style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <Avatar name={kampioen.p.name} color={kampioen.p.color} size={34} userId={kampioen.p.user_id} hasAvatar={kampioen.p.has_avatar} avatarVer={kampioen.p.avatar_ver} divisie={kampioen.p.divisie} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontFamily: font.ui, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: withAlpha(colors.gold, 0.85) }}>
            {t("streamKampioen")}
          </span>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 17, color: colors.gold, textShadow: "0 2px 10px rgba(0,0,0,.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {kampioen.p.name} <span style={{ fontSize: 13, color: colors.ink }}>{kampioen.punten}</span>
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", maxWidth: 240 }}>
        {rangen.slice(1, 4).map((r, i) => (
          <div
            key={r.p.id}
            className="stream-links-in"
            style={{ animationDelay: `${0.16 + i * 0.14}s`, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}
          >
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 10, color: colors.faint, width: 12, flexShrink: 0 }}>{i + 2}</span>
            <Avatar name={r.p.name} color={r.p.color} size={18} userId={r.p.user_id} hasAvatar={r.p.has_avatar} avatarVer={r.p.avatar_ver} />
            <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, color: colors.ink, textShadow: "0 1px 4px rgba(0,0,0,.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.p.name}
            </span>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 11, color: colors.gold }}>{r.punten}</span>
          </div>
        ))}
      </div>
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
          // Wit: een lichtkrant onder in beeld is een omroep, geen prijs. Goud
          // zou hem laten wedijveren met het merkje en de letter.
          color: colors.ink,
          textShadow: "0 1px 5px rgba(0,0,0,.9)",
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

  // Elke pagina komt op met een infade en gaat weg met een uitfade. De ROL en
  // het INVULLEN delen hun beeld (daar schuift de rol van plek), dus die twee
  // gelden als één pagina; anders zou die beweging worden onderbroken door een
  // fade. Het merkje en de achtergrond doen niet mee: die zijn de zender en
  // blijven staan.
  const nu = room?.phase ?? "lobby";
  const groep = nu === "reveal" || nu === "fill" ? "spel" : nu;
  const [getoond, setGetoond] = useState(nu);
  const [dof, setDof] = useState(false);
  const vorigeGroep = useRef(groep);
  useEffect(() => {
    if (groep === vorigeGroep.current) {
      // Binnen dezelfde pagina (rollen -> invullen) meteen door.
      setGetoond(nu);
      return;
    }
    vorigeGroep.current = groep;
    setDof(true);
    const id = window.setTimeout(() => {
      setGetoond(nu);
      setDof(false);
    }, 200);
    return () => window.clearTimeout(id);
  }, [groep, nu]);

  if (!room) return null;

  const leider = room.players.find((p) => p.id === room.active_player_id);
  const letter = room.round?.letter ?? "";
  const rolStand = letter ? "locked" : game.state.spinning ? "spinning" : "idle";
  const rolt = getoond === "reveal";
  const vult = getoond === "fill";
  // De uitslag deelt het beeld met het invullen: dezelfde letter op dezelfde
  // plek, alleen staat er rechts nu wat het ODLEVERDE in plaats van wie klaar
  // is. Zo blijft de rol staan waar hij stond en verspringt er niets.
  const uitslag = getoond === "results";
  const eind = getoond === "final";

  // Het merkje draagt ook de ronde: hetzelfde plekje, meer te zeggen.
  const merk = eind
    ? `${t("streamLive")} · ${t("streamEindstand")}`
    : getoond === "lobby" || getoond === "rules"
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
      <div
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: dof ? 0 : 1,
          transition: "opacity .2s ease",
        }}
      >
      {uitslag && (
        // De uitslag heeft geen rol nodig: die is gevallen. Links wat de ronde
        // opleverde, rechts wie er klaar staat voor de volgende.
        // De hoogtepunten staan niet tegen de linkerrand: een uitzending laat
        // links wat lucht, anders plakt de tekst aan de kader.
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "0 12px 0 26px", minHeight: 0 }}>
          <div style={{ flex: 1.15, minWidth: 0 }}>
            <Hoogtepunten game={game} />
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

      {eind && <Eindstand game={game} />}

      {!rolt && !vult && !uitslag && !eind && (
        <>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 34, letterSpacing: 3, color: colors.gold, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>
            {room.code}
          </span>
          <SpelerRij game={game} klaarIds={getoond === "rules" ? room.ready_ids : []} />
        </>
      )}
      </div>

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
          bottom: uitslag || eind ? 30 : 10,
          transition: "bottom .34s cubic-bezier(.2,1,.3,1)",
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

      {(uitslag || eind) && <LedBalk game={game} />}

      {/* De klok rechtsonder, tegenover het merkje. Alleen als er echt een klok
          loopt: een room zonder tijd heeft niets af te tellen. */}
      {!!klok && (
        <span
          className="zacht-in"
          style={{
            position: "absolute",
            right: 12,
            bottom: uitslag || eind ? 30 : 10,
            transition: "bottom .34s cubic-bezier(.2,1,.3,1)",
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
