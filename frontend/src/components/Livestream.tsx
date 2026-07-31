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
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { ARENA } from "./Arena";
import { ArtIcoon } from "./ArtIcoon";
import { Avatar } from "./Avatar";
import { RingFoto, RingPortret, divisieKleur } from "./ProfileHero";
import { Reel } from "./Reel";
import type { GameApi } from "../net/socket";
import { KREET_KEUZE, kreetSleutel } from "./Kreten";
import { hoogtepunten, prestaties, woordVanDeRonde } from "../lib/hoogtepunten";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";

/** De rol is 172x200. Kleiner dan op de speelpagina: dit is een venster, geen
 *  hoofdzaak. */
const ROL_GROOT = 0.68;
/** Tijdens het invullen staat de letter naast de stroom, dus iets kleiner dan
 *  bij het rollen, maar wel groot genoeg om DE letter te zijn. */
const ROL_KLEIN = 0.62;

/** Hoe lang het beeld wegvalt voordat de volgende pagina komt.
 *
 *  Stond op 200ms, en dat was te kort om als overgang te lezen: de rol was weg
 *  en meteen weer terug op zijn nieuwe plek, en dat ziet je oog als knipperen
 *  in plaats van als wisselen. Uitfaden mag rustig, infaden mag iets langer
 *  duren dan uitfaden: zo voelt het als een beeld dat KOMT en niet als een
 *  beeld dat er ineens is. */
const WISSEL_MS = 300;
const UIT_MS = 260;
const IN_MS = 420;

/** De doos van een geschaalde rol blijft 200 hoog; alleen het BEELD krimpt.
 *  Zonder deze correctie staat er boven en onder de rol lucht die meetelt bij
 *  het uitmiddelen, en dan hangt hij te laag in het vak. */
const rolVak = (schaal: number) => ({
  transform: `scale(${schaal})`,
  transformOrigin: "center",
  lineHeight: 0,
  margin: `${-(200 * (1 - schaal)) / 2}px 0`,
});

/** Confetti op de EINDSTAND: het beeld waar een hele uitzending naartoe werkt.
 *
 *  TWEE lagen, en dat is de hele truc. De voorste valt vlug en tuimelt, precies
 *  zoals de confetti van de ceremonie na een potje; de achterste valt traag,
 *  kleiner en met zijwaartse drift. Omdat de voorste vóór de tekst hangt en de
 *  achterste erachter, kijk je door de regen heen naar het scherm in plaats van
 *  ernaar. Eén laag is een effect, twee lagen is diepte.
 *
 *  En het is geen gelijkmatige regen maar een UITBARSTING die uitdunt. Het
 *  grootste deel van de snippers valt precies één keer, vlak na het moment dat
 *  de kampioen in beeld komt; wat overblijft is een kleinere groep die blijft
 *  doorvallen zolang de eindstand staat. Zo hoort het ook te gaan: op het
 *  moment zelf regent het, daarna dwarrelt het na. Een regen die van begin tot
 *  eind even dicht is heeft geen moment, en een regen die helemaal ophoudt
 *  leest als een storing.
 *
 *  Alles wordt geloot, en dat was eerst niet zo. De vorige versie rekende de
 *  maten uit met een vaste formule op de index, en dat zag je: gelijke
 *  tussenruimtes en kleuren die om de beurt terugkwamen, dus een patroon in
 *  plaats van een regen.
 *
 *  De blijvers hebben een NEGATIEVE vertraging: die zitten bij het eerste
 *  beeldje al midden in hun val, zodat het scherm meteen vol staat.
 */
const SNIPPER_KLEUREN = [colors.gold, colors.goldHi, colors.violet, colors.green, colors.red, "#FF7AC2"];

/** Hoeveel er blijft vallen, en hoeveel er in de eerste golf meekomt. */
const BLIJVERS = { snel: 28, traag: 20 } as const;
const GOLF = { snel: 48, traag: 34 } as const;

function loot(n: number, traag: boolean, golf: boolean) {
  return Array.from({ length: n }, () => ({
    links: Math.random() * 100,
    breed: (traag ? 3.5 : 5) + Math.random() * (traag ? 3 : 4.5),
    hoog: (traag ? 6 : 9) + Math.random() * (traag ? 5 : 7),
    duur: (traag ? 4.4 : 2.6) + Math.random() * (traag ? 3.2 : 1.8),
    // De golf begint bovenaan (en een deel is al onderweg); de blijvers staan
    // altijd midden in hun val.
    wacht: golf ? -1.4 + Math.random() * 2.3 : -Math.random() * (traag ? 7 : 4.4),
    herhaal: golf ? "1" : "infinite",
    drift: (Math.random() - 0.5) * (traag ? 60 : 26),
    draai: (Math.random() < 0.5 ? -1 : 1) * (traag ? 420 : 700),
    kantel: Math.random() * 360,
    kleur: SNIPPER_KLEUREN[Math.floor(Math.random() * SNIPPER_KLEUREN.length)],
  }));
}

function Confetti({ traag }: { traag: boolean }) {
  const snippers = useMemo(
    () => [
      ...loot(traag ? BLIJVERS.traag : BLIJVERS.snel, traag, false),
      ...loot(traag ? GOLF.traag : GOLF.snel, traag, true),
    ],
    [traag],
  );

  // De valafstand wordt GEMETEN en niet in procenten gezet.
  //
  // Met `top` in procenten viel hij ook wel, maar `top` is een layout-maat: bij
  // honderd snippers rekent de browser dan elk beeldje honderd keer de layout
  // opnieuw uit, op de hoofddraad, naast een spel dat óók draait. Als `transform`
  // gebeurt de val op de compositor en kost het niets. Een percentage in
  // `translateY` slaat op de snipper ZELF en niet op zijn vak, dus de afstand
  // moet in pixels, en dus moet het vak zichzelf opmeten.
  const vak = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = vak.current;
    if (!el) return;
    const meet = () => setVal(el.clientHeight + 28);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <span ref={vak} aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {val > 0 &&
        snippers.map((s, i) => (
          <span
            key={i}
            className="stream-snipper"
            style={{
              position: "absolute",
              top: -14,
              left: `${s.links}%`,
              width: s.breed,
              height: s.hoog,
              borderRadius: 1.5,
              background: s.kleur,
              opacity: 0,
              animationDuration: `${s.duur}s`,
              animationDelay: `${s.wacht}s`,
              animationIterationCount: s.herhaal,
              ["--val" as string]: `${val}px`,
              ["--drift" as string]: `${s.drift}px`,
              ["--draai" as string]: `${s.draai}deg`,
              ["--kantel" as string]: `${s.kantel}deg`,
            }}
          />
        ))}
    </span>
  );
}

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
      {/* Tot twee regels, en dan pas afkappen. Met een enkele regel viel de
          helft van een kreet weg ("KreamTest is klaar, jullie zij..."), en juist
          die staart is waar het om gaat: een kreet die je niet uitleest is geen
          kreet. */}
      <span
        style={{
          minWidth: 0,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textShadow: "0 1px 4px rgba(0,0,0,.9)",
        }}
      >
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
  // vieren valt. Twee regels: met drie eronder werd het woord van de ronde het
  // vierde blok op een rij en las de kolom als een lijst in plaats van als een
  // uitgelicht moment.
  const rang = { gold: 0, ink: 1, faint: 2 } as const;
  const regels = [...prestaties(room, spelers, t), ...hoogtepunten(room, spelers, t)]
    .map((h, i) => ({ h, i }))
    .sort((a, b) => rang[a.h.tone] - rang[b.h.tone] || a.i - b.i)
    .map((x) => x.h)
    .slice(0, 2);
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
            animationDelay: `${0.18 + i * 0.26}s`,
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
 *  zoals in een chat: wat er net gebeurde staat het dichtst bij je oog.
 *
 *  De staart is "is klaar", tenzij iemand met een KREET klaar ging; dan staat
 *  zijn zin er ("is klaar om te winnen"). De sleutel komt van de server en
 *  wordt hier tegen de eigen lijst gehouden: een sleutel die deze app niet kent
 *  valt terug op de gewone regel in plaats van zijn eigen naam te tonen.
 */
function KlaarStroom({ game, max = 5, rechts = false }: { game: GameApi; max?: number; rechts?: boolean }) {
  const { t } = useT();
  const room = game.state.room;
  if (!room) return null;
  const klaar = room.ready_ids
    .map((id) => room.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p && !p.is_spectator)
    .slice(-max);

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: rechts ? "flex-end" : "stretch", gap: 5 }}>
      {klaar.map((p) => {
        const kreet = room.ready_kreten?.[p.id];
        return (
          <TypRegel
            key={p.id}
            naam={p.name}
            kleur={p.color}
            staart={kreet && KREET_KEUZE.has(kreet) ? t(kreetSleutel(kreet)) : t("streamIsKlaar")}
            avatar={<Avatar name={p.name} color={p.color} size={20} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} />}
          />
        );
      })}
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
    // De kampioen boven, de achtervolgers eronder. De kolom is precies zo breed
    // als de kampioensrij (inline-flex met stretch), dus de rijen eronder lijnen
    // links uit met de ring en rechts met zijn score: één blok in plaats van
    // twee losse dingen.
    <div style={{ display: "flex", justifyContent: "center", width: "100%", padding: "0 14px", minWidth: 0 }}>
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", gap: 3, minWidth: 0, maxWidth: "100%" }}>
        <div className="stream-links-in" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {/* Precies het portret van het profiel: de gouden lauwerring met het
              rangschild dat er onderop hangt, half over de foto en half over de
              band. Binnen de ring altijd RingFoto, ook zonder foto: die vult het
              ronde gat en heeft zelf geen rand. De gewone Avatar zou zijn eigen
              rangring meebrengen, en dan zie je een vierkant kadertje binnen de
              gouden ring. */}
          <RingPortret maat={72} level={kampioen.p.level ?? 0} kleur={divisieKleur(kampioen.p.divisie)}>
            <RingFoto
              userId={kampioen.p.user_id ?? ""}
              versie={kampioen.p.avatar_ver}
              heeftFoto={!!kampioen.p.user_id && kampioen.p.has_avatar}
              naam={kampioen.p.name}
              kleur={kampioen.p.color}
            />
          </RingPortret>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontFamily: font.ui, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: withAlpha(colors.gold, 0.85) }}>
              {t("streamKampioen")}
            </span>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 22, lineHeight: 1.15, color: colors.gold, textShadow: "0 2px 10px rgba(0,0,0,.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {kampioen.p.name} <span style={{ fontSize: 17, color: colors.ink }}>{kampioen.punten}</span>
            </span>
          </div>
        </div>

        {rangen.slice(1, 3).map((r, i) => (
          <div
            key={r.p.id}
            className="stream-links-in"
            style={{ animationDelay: `${0.22 + i * 0.2}s`, display: "flex", alignItems: "center", gap: 6, minWidth: 0, marginTop: i === 0 ? 10 : 0 }}
          >
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 10, color: colors.faint, width: 10, flexShrink: 0 }}>{i + 2}</span>
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

/** De lichtkrant onderlangs: een rij koppen over IEDEREEN, aan elkaar geregen
 *  tot één lange regel die het beeld in komt en er weer uit loopt.
 *
 *  Aan elkaar en niet om de beurt: een ticker die per kop wisselt vraagt een
 *  klok en een keuze wanneer hij mag wisselen, en dan mis je er een als je net
 *  wegkijkt. Zo komt alles vanzelf een keer langs.
 *
 *  De koppen zijn geschreven zoals een verslaggever ze zou uitspreken, niet
 *  zoals een scorebord ze zou afdrukken. "Pixel staat op 70" is een meting;
 *  "Pixel heeft 40 voorsprong en deelt geen cadeaus uit" is een uitzending. De
 *  stand staat er nog steeds bij, maar achterin: eerst het verhaal, dan de
 *  cijfers.
 *
 *  Welke kleurregels er langskomen wisselt per ronde, met het rondenummer als
 *  startpunt in de pool. Vast genoeg om binnen een ronde niet te springen,
 *  wisselend genoeg om drie rondes lang niet dezelfde grap te horen.
 *
 *  De reistijd groeit mee met de lengte, anders raast een lange regel voorbij en
 *  sukkelt een korte.
 */
function LedBalk({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room;
  if (!room) return null;
  const meedoen = room.players.filter((p) => !p.is_spectator);
  const stand = [...meedoen]
    .map((p) => ({ p, punten: room.scores[p.id] ?? 0 }))
    .sort((a, b) => b.punten - a.punten);
  const hoogste = stand[0]?.punten ?? 0;
  const kop = stand.filter((x) => x.punten === hoogste);
  const eind = room.phase === "final";
  const cats = room.settings.categories;

  const koppen: string[] = [];
  if (eind && stand.length > 0) {
    koppen.push(t("streamTitel", { naam: stand[0].p.name }));
    koppen.push(t("streamWint", { naam: stand[0].p.name, n: String(stand[0].punten) }));
    koppen.push(t("streamStudioLeeg", { naam: stand[0].p.name }));
  } else if (hoogste <= 0) {
    koppen.push(t("streamNogNiks"));
  } else if (kop.length === 1) {
    koppen.push(t("streamKop", { naam: kop[0].p.name, n: String(hoogste) }));
  } else {
    koppen.push(t("streamGelijk", { namen: kop.slice(0, 3).map((x) => x.p.name).join(", "), n: String(hoogste) }));
  }

  // De pool waar de kleur uit komt. Alles hier hangt aan iets dat ECHT gebeurd
  // is; een kop die net zo goed over een ander potje kon gaan is geen kop maar
  // opvulling.
  const pool: string[] = [];

  const woord = woordVanDeRonde(room, meedoen);
  if (woord) pool.push(t("streamWoordKop", { woord: woord.word.toUpperCase(), naam: woord.name }));

  const letter = room.round?.letter;
  if (letter) pool.push(t("streamLetterKop", { letter: letter.toUpperCase() }));

  if (stand.length >= 2) {
    const gat = stand[0].punten - stand[1].punten;
    if (gat === 0 && hoogste > 0) pool.push(t("streamNekAanNek", { a: stand[0].p.name, b: stand[1].p.name }));
    else if (gat > 0 && gat <= 10) pool.push(t("streamKrap", { a: stand[0].p.name, b: stand[1].p.name, n: String(gat) }));
    else if (gat > 10) {
      pool.push(t("streamVoorsprong", { naam: stand[0].p.name, n: String(gat) }));
      pool.push(t("streamJachtOpen", { naam: stand[0].p.name }));
    }
    const achteraan = stand[stand.length - 1];
    if (achteraan.punten === 0) pool.push(t("streamZoektPunt", { naam: achteraan.p.name }));
  }

  // Wat de ronde die net gespeeld is opleverde: de dikste oogst, en een
  // vlekkeloze ronde als iemand die had.
  if (!eind && cats.length > 0) {
    const oogst = (id: string) => cats.reduce((n, c) => n + (room.round?.points[id]?.[c] ?? 0), 0);
    const uniek = (id: string) => cats.filter((c) => (room.round?.points[id]?.[c] ?? 0) === 10).length;
    const beste = Math.max(0, ...meedoen.map((p) => oogst(p.id)));
    const kopstuk = meedoen.filter((p) => oogst(p.id) === beste);
    if (beste > 0 && kopstuk.length === 1) pool.push(t("streamOogstKop", { naam: kopstuk[0].name, n: String(beste) }));
    for (const p of meedoen) {
      if (uniek(p.id) === cats.length) pool.push(t("streamPerfectKop", { naam: p.name }));
    }
  }

  pool.push(t("streamPennenRoken"));
  if (!eind && stand.length >= 2) pool.push(t("streamNiemandVeilig"));

  // Drie kleurregels per ronde, vanaf een startpunt dat met de ronde meeschuift.
  const hoeveel = Math.min(3, pool.length);
  const start = pool.length > 0 ? room.round_no % pool.length : 0;
  for (let i = 0; i < hoeveel; i++) koppen.push(pool[(start + i) % pool.length]);

  // En dan pas de kale stand, zodat wie op de cijfers wacht ze ook krijgt.
  for (const x of stand) koppen.push(t("streamStaatOp", { naam: x.p.name, n: String(x.punten) }));

  if (!eind) {
    const over = Math.max(0, room.settings.rounds - room.round_no);
    if (over === 0) koppen.push(t("streamLaatsteRonde"));
    else koppen.push(t("streamRondesTeGaan", { n: String(over) }));
  }

  const regel = koppen.join("   ·   ");
  const duur = Math.max(9, Math.round(regel.length * 0.32));

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
          animationDuration: `${duur}s`,
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
        {regel}
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

  // Elke pagina komt op met een infade en gaat weg met een uitfade, ook de rol
  // naar het invullen: de letter verdwijnt op zijn oude plek en komt op zijn
  // nieuwe terug. Het merkje en de achtergrond doen niet mee, dat is de zender
  // en die blijft staan.
  const nu = room?.phase ?? "lobby";
  const groep = nu;
  const [getoond, setGetoond] = useState(nu);
  const [dof, setDof] = useState(false);
  const vorigeGroep = useRef(groep);
  useEffect(() => {
    if (groep === vorigeGroep.current) {
      setGetoond(nu);
      return;
    }
    vorigeGroep.current = groep;
    setDof(true);
    const id = window.setTimeout(() => {
      setGetoond(nu);
      setDof(false);
    }, WISSEL_MS);
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
    ? t("streamEinde")
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
        // De bovenmarge is de veilige zone MIN een tikje: de klok en de batterij
        // van de telefoon staan bovenin, dus daaronder blijven, maar de volle
        // zone plus een marge duwde alles zichtbaar naar beneden. Wat er
        // overblijft is nog altijd ruim genoeg, want de inhoud is korter dan het
        // vak en staat uitgemiddeld.
        padding: "max(6px, calc(env(safe-area-inset-top) - 10px)) 0 34px",
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
      {/* De TRAGE laag ligt achter de tekst: hij komt vóór de kolom hieronder in
          de rij, en die kolom is `position: relative` en dus een geschilderde
          laag die er later overheen komt. Alleen de achtergrond ligt er nog
          onder.

          Alleen op de EINDSTAND. Op de uitslag van een losse ronde was het geen
          feest maar een tussenstand met slingers: confetti bij elke ronde maakt
          confetti aan het eind betekenisloos. */}
      {eind && <Confetti traag />}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: dof ? 0 : 1,
          transition: `opacity ${dof ? UIT_MS : IN_MS}ms ease`,
        }}
      >
      {uitslag && (
        // De uitslag heeft geen rol nodig: die is gevallen. De hoogtepunten
        // staan links en krijgen de ruimte; de klaar-regels zijn geen tweede
        // kolom maar een onderschrift, en dat hoort rechtsonder.
        //
        // Als kolom NAAST de hoogtepunten stonden ze er bovenop te leunen: twee
        // blokken tekst met tien pixels ertussen leest als één rommelig blok.
        // Nu zit er een halve pagina tussen en weet je meteen dat het twee
        // verschillende dingen zijn.
        <div style={{ position: "relative", width: "100%", flex: 1, minHeight: 0, display: "flex", alignItems: "center", padding: "0 12px 0 26px" }}>
          <div style={{ maxWidth: "74%", minWidth: 0 }}>
            <Hoogtepunten game={game} />
          </div>
          {/* Vlak boven de lichtkrant: dit vak eindigt precies waar de balk
              begint, dus `bottom: 0` zet ze er netjes bovenop zonder een maat
              te hoeven kennen. */}
          <div style={{ position: "absolute", right: 12, bottom: 0, maxWidth: "48%" }}>
            <KlaarStroom game={game} max={3} rechts />
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
            style={rolVak(vult ? ROL_KLEIN : ROL_GROOT)}
          >
            <Reel state={rolStand} letter={letter} exclude={room.used_letters} hard={room.settings.hard_letters} skin={leider?.reel_skin ?? null} />
          </div>
          {/* De kolom groeit open vanaf nul breed. Een maximum is wel te
              animeren, `flex-grow` niet, dus dat is waar de beweging in zit.

              `flex: 0 1 auto` en niet `flex: 1`: een kolom die alle overgebleven
              ruimte opeist duwt de rol naar links, en dan staat het paar niet
              in het midden maar de rol linksuit. Zo blijft de kolom precies zo
              breed als zijn tekst en zwaait het geheel, rol plus regels, om het
              midden van het beeld. */}
          <div
            style={{
              flex: "0 1 auto",
              minWidth: 0,
              maxWidth: vult ? 236 : 0,
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

      {/* En de SNELLE laag ervoor: dezelfde val als de confetti van de
          ceremonie, groter en tuimelend. Hij staat hier, ná de kolom en vóór
          het merkje en de lichtkrant, en dus valt hij over de tekst heen maar
          nooit over de twee dingen die altijd leesbaar moeten blijven: wat er
          live is en wat de omroep zegt. */}
      {eind && <Confetti traag={false} />}

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
            // Alleen zolang er iets te zien is. Een knipperend lampje onder een
            // afgelopen uitzending spreekt zichzelf tegen.
            animation: eind ? undefined : "fill-pulse 1.1s ease-in-out infinite",
            opacity: eind ? 0.55 : 1,
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
