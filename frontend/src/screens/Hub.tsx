// Hub — profile, friends, inbox and leaderboard in one tabbed screen.
// Reached from the Landing. A profile is optional: guests see the create form.
import { Fragment, useEffect, useRef, useState } from "react";
import { ArtIcoon, STAT_ART } from "../components/ArtIcoon";
import { CloseIcon } from "../components/CloseIcon";
import { KnopPlaat } from "../components/KnopPlaat";
import { ReferralAd } from "../components/ReferralAd";
import { ArrowLeft, BookOpen, CalendarDays, Camera, Check, ChevronDown, Copy, Crown, Flame, Gem, Lock, LogOut, Medal, MessageCircle, MoreVertical, Pencil, Percent, Plus, Rocket, Search, Settings as SettingsIcon, Share2, Shield, ShoppingCart, Smile, Sparkles, Star, Swords, Target, Trash2, Trophy, UserPlus, Users, X, Zap, ZoomIn, ZoomOut } from "lucide-react";
import { Avatar, SCHILD_RAND } from "../components/Avatar";
import { Plek } from "../components/ProfileShowcase";
import { HexArt } from "../components/HexArt";
import { ChatIcoon } from "../components/ChatIcoon";
import { TelHex } from "../components/TelHex";
import { SchermTip } from "../components/SchermTip";
import { DIVISIE_ACCENT, GOUD, KADER_LIJN_GOUD, KADER_LIJN_LOOP, KADER_LIJN_PAARS, KADER_LIJN_ROOD, KADER_LIJN_XP, NeonKader, Paneel, PlekWapen, Prestatie, RingFoto, RingPortret, SCHILD_KLEUREN, SectieKop, SierKop, StatKaart, divisieKleur, type SchildKleur } from "../components/ProfileHero";
import { DivisieLadder, Schild, divisieNaam } from "../components/Divisie";
import { MeldingRij } from "../components/Meldingen";
import { WALLPAPERS, wallpaperKlasse, wallpaperStijl, wallpaperVan, wallpaperZet, type WallpaperId } from "../components/Wallpaper";
import { ensurePushSubscription } from "../pwa/push";
import { AvatarZoom } from "../components/AvatarZoom";
import { Button } from "../components/Button";
import { MicButton } from "../components/MicButton";
import { BeeldKnop } from "../components/BeeldKnop";
import { goudHaarlijn } from "../components/GlasKnop";
import { useZichtbaarVak } from "../lib/zichtbaarvak";
import { VerstuurKnop } from "../components/VerstuurKnop";
import { VoiceNote } from "../components/VoiceNote";
import { EmotePicker } from "../components/EmotePicker";
import { EMOTE_SRC, FREE_EMOTE_PACKS } from "../components/emotes";
import { HexPlate } from "../components/HexPlate";
import { Toggle } from "../components/Toggle";
import { Screen, Card } from "../components/Layout";
import type { AccountStats, Friend, GameApi, InboxItem, LeaderboardRow, LevelInfo } from "../net/socket";
import { LANDEN, landNaam } from "../util/landen";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { makeClubCard, makeProfileCard, shareOrDownload } from "../util/shareCard";
import { ClubEmblem, CLUB_EMBLEM_IDS } from "../components/ClubEmblem";
import { neonSkin, rampFrom } from "../theme/neon";
import { reelClip, reelEdge, reelFace, reelTheme } from "../theme/reelSkins";
import { colors, font, playerColors, radius, withAlpha } from "../theme/tokens";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: font.ui,
  fontSize: 15,
  color: colors.ink,
  background: withAlpha("#000000", 0.25),
  border: `1.5px solid ${colors.panelBorder}`,
  borderRadius: radius.button,
  padding: "11px 13px",
};

// The Hub no longer picks its own section: the bottom bar does, and Titel moved
// into Profielinstellingen, so the in-screen tab strip is gone.
export type HubSection = "profile" | "friends" | "inbox" | "leaderboard";
type Tab = HubSection;

// Built-in illustrated avatars, mirrored server-side (backend/app/avatars).
const AVATAR_PRESETS = Array.from({ length: 18 }, (_, i) => `av${String(i + 1).padStart(2, "0")}`);
// Premium pack (av19..av36), shown locked in the picker until bought in the shop.
const PREMIUM_AVATAR_PRESETS = Array.from({ length: 18 }, (_, i) => `av${String(i + 19).padStart(2, "0")}`);
// Which coin pack each premium preset belongs to (av19..27 = pack 1, av28..36 = pack 2).
const PACK_OF_PRESET: Record<string, string> = Object.fromEntries(
  PREMIUM_AVATAR_PRESETS.map((id, i) => [id, i < 9 ? "avpack1" : "avpack2"]),
);
// Bump whenever the preset artwork changes (matches db.PRESET_ART_VERSION) so the
// picker's static images cache-bust instead of serving the stale ones.
const AVATAR_ART_VERSION = 10;

export function Hub({ game, section, onBack, onShowShop, onChallenge, onGaNaar }: { game: GameApi; section: HubSection; onBack: () => void; onShowShop: () => void; onChallenge: (userId: string) => void; onGaNaar: (naar: string) => void }) {
  const { t } = useT();
  const tab: Tab = section;
  const account = game.state.account;
  // Het tandwiel in de bovenbalk gaat alleen nog over de CLUB. Profielinstellingen
  // hangen nu onder Instellingen op de main page: dat is de plek waar je naar
  // instellingen zoekt, en dan hoeft hetzelfde tandwiel niet op drie pagina's te
  // staan met op elke pagina een andere betekenis.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Vrienden en clubs stonden onder elkaar, dus je scrollde altijd langs het
  // ene om bij het andere te komen. Als twee knopjes in EEN pil zie je meteen
  // dat het twee kanten van hetzelfde scherm zijn.
  const [sociaal, setSociaal] = useState<"friends" | "club">("friends");
  // Het tandwiel hoort bij de club, dus het verdwijnt zodra je op vrienden
  // staat. Wie de pil omzet terwijl de clubinstellingen open staan zou anders
  // in een scherm blijven hangen dat bij de andere kant hoort.
  const clubTandwiel = tab === "friends" && sociaal === "club";

  useEffect(() => {
    if (!account) return;
    if (tab === "friends") game.refreshFriends();
    if (tab === "inbox") game.refreshInbox();
    if (tab === "friends") game.loadClub("month");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, !!account]);
  useEffect(() => {
    if (tab === "leaderboard") game.loadLeaderboard("week");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // De ranglijst en de vrienden delen hun eigen decor. Net als bij het profiel
  // gaat de klasse op de BODY en niet op een laag hierbinnen: de achtergrond
  // moet ook onder de bovenbalk en de tabbalk door lopen, en die staan buiten
  // dit onderdeel.
  useEffect(() => {
    const aan = tab === "leaderboard" || tab === "friends";
    if (!aan) return;
    document.body.classList.add("lijst");
    return () => document.body.classList.remove("lijst");
  }, [tab]);

  // De knoppen in de bovenbalk staan op de paarse zeshoek van de main page, net
  // als de knoppen naast het logo. Losse pictogrammen op een lege balk hoorden
  // nergens bij; op een plaat zijn het knoppen.
  const topIconBtn: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", color: colors.sub, display: "flex", padding: 0 };
  const HEX = 38;

  if (settingsOpen && account && clubTandwiel) {
    return <SocialSettings game={game} onBack={() => setSettingsOpen(false)} />;
  }

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 14px 14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
            <ArrowLeft size={20} />
          </button>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t(section === "friends" ? "friendsTab" : section === "inbox" ? "inboxTab" : section === "leaderboard" ? "leaderboardTab" : "profile")}</span>
          {account && (
            <>
              {/* Alleen de club heeft hier nog iets in te stellen: wie mag
                  uitnodigen, wie mag hernoemen, en het ledenbeheer. Op je
                  profiel, de ranglijst en de inbox is dit tandwiel weg, want
                  daar wees hij naar profielinstellingen en die staan nu onder
                  Instellingen op de main page. */}
              {clubTandwiel && (
                <button onClick={() => { sound.uiTap(); setSettingsOpen(true); }} aria-label={t("clubSettings")} title={t("clubSettings")} className="pressable" style={topIconBtn}>
                  <HexPlate on size={HEX}>
                    <SettingsIcon size={16} />
                  </HexPlate>
                </button>
              )}
            </>
          )}
          {/* De muziekknop alleen waar hij iets toevoegt: op de inbox en bij
              vrienden/club is hij chroom dat de balk vult zonder reden. */}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {tab === "profile" && <ProfileTab game={game} onShowShop={onShowShop} />}
        {tab === "friends" && (
          <>
            <PilKeuze
              actief={sociaal}
              onKies={setSociaal}
              opties={[
                { key: "friends" as const, label: t("friendsTab") },
                { key: "club" as const, label: t("clubTab") },
              ]}
            />
            {sociaal === "friends" ? <FriendsTab game={game} onChallenge={onChallenge} /> : <ClubTab game={game} />}
            {sociaal === "friends" && account && <ReferralAd sectie />}
          </>
        )}
        {tab === "inbox" && <InboxTab game={game} onGaNaar={onGaNaar} />}
        {tab === "leaderboard" && <LeaderboardTab game={game} />}
      </div>

      {/* Open DM conversation (profile-to-profile, outside any room). */}
      {game.state.dmOpenWith && <DmThreadOverlay game={game} />}
    </Screen>
  );
}

// ---- Level / rang -------------------------------------------------------------

// De reeks van de levelster en de XP-balk: goud, van donker naar fel.
const LEVEL_RAMP = rampFrom(colors.gold);
// De stervorm als masker. Een lucide-ster kan geen verloop dragen (die krijgt
// een kleur mee), dus we knippen het verloop uit op deze vorm.
const STAR_MASK =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 1.6l3.2 6.5 7.2 1-5.2 5.1 1.2 7.2L12 18l-6.4 3.4 1.2-7.2L1.6 9.1l7.2-1z'/></svg>\")";

// Het masker dat een laag tot stervorm knipt. Gedeeld door de vulling en de
// stroke eronder, zodat die twee gegarandeerd dezelfde vorm hebben.
const starMask: React.CSSProperties = {
  position: "absolute",
  WebkitMaskImage: STAR_MASK,
  maskImage: STAR_MASK,
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
};

// 8 Ball Pool-style level strip: level chip + rank title + xp progress bar.
function LevelBar({ level, compact }: { level: LevelInfo; compact?: boolean }) {
  const { t } = useT();
  const span = Math.max(1, level.next_level - level.level_start);
  const frac = Math.min(1, Math.max(0, (level.xp - level.level_start) / span));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* De ster is een vlakke vorm, dus het verloop moet ERIN. Een SVG-vulling
          kan een verloop dragen; de lucide-ster niet, want die krijgt een kleur
          mee. Daarom een eigen verloop-definitie eronder en de ster als vorm
          erbovenop, met de gloed als vervaagde kopie erachter. */}
      <div style={{ position: "relative", width: compact ? 40 : 48, height: compact ? 40 : 48, flexShrink: 0 }}>
        <span aria-hidden style={{ position: "absolute", inset: -14, display: "grid", placeItems: "center", filter: "blur(9px)", opacity: 0.55, pointerEvents: "none" }}>
          <Star size={compact ? 40 : 48} color={LEVEL_RAMP[2]} fill={LEVEL_RAMP[2]} strokeWidth={1.4} />
        </span>
        {/* De stroke is een tweede ster ERONDER, een tikje groter. Een masker kan
            geen rand dragen, dus wat er onderuit steekt IS de lijn: dezelfde
            truc als de verlooprand om een paneel. Hij loopt van fel goud bovenaan
            naar donker onderaan, zodat de ster belicht lijkt in plaats van
            omlijnd. */}
        <span style={{ ...starMask, inset: 0, background: `linear-gradient(170deg, ${LEVEL_RAMP[3]} 0%, ${LEVEL_RAMP[2]} 42%, ${LEVEL_RAMP[0]} 100%)` }} />
        <span style={{ ...starMask, inset: 1.5, background: reelFace(LEVEL_RAMP) }} />
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: font.display, fontWeight: 700, fontSize: compact ? 15 : 18, color: "#3A2500", paddingTop: 2, textShadow: "0 1px 0 rgba(255,240,190,.5)" }}>
          {level.level}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
          {/* Gewoon goud. Op tekst van dertien pixels voegt een verloop met een
              gloed niets toe: je ziet het verloop niet en de gloed maakt de
              letters juist onscherp. */}
          <span style={{ fontFamily: font.ui, fontWeight: 700, fontSize: compact ? 12.5 : 13.5, color: colors.gold }}>
            {t(`rank_${level.rank}`)}
          </span>
          <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint }}>
            {level.xp - level.level_start}/{span} XP
          </span>
        </div>
        {/* De balk is een GROEF: de gouden staaf ligt erin, niet erop. Twee
            dingen maken dat verschil. De schaduw valt binnenin en van bovenaf,
            zodat je in een holte kijkt. En de ring eromheen is omgedraaid: bij
            licht van boven is de bovenrand van iets dat uitsteekt verlicht, maar
            de bovenrand van een gat ligt juist in de schaduw. */}
        <div
          className="neon-ring"
          style={{
            height: compact ? 10 : 12,
            borderRadius: 999,
            background: withAlpha("#000000", 0.55),
            boxShadow: "inset 0 2px 4px rgba(0,0,0,.8), inset 0 -1px 0 rgba(255,255,255,.07)",
            overflow: "hidden",
            ...neonSkin(colors.gold, true),
            ["--ng-w" as string]: "1px",
          } as React.CSSProperties}
        >
          <div
            style={{
              position: "relative",
              width: `${Math.round(frac * 100)}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(180deg, ${LEVEL_RAMP[3]} 0%, ${LEVEL_RAMP[2]} 42%, ${LEVEL_RAMP[1]} 100%)`,
              // De staaf zelf blijft bol: glans bovenop, donkere onderkant, plus
              // de schaduw die de groef erop werpt.
              boxShadow: "inset 0 1px 0 rgba(255,243,181,.75), inset 0 -2px 3px rgba(107,52,0,.5), inset 2px 0 3px rgba(0,0,0,.35)",
              transition: "width .4s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function statGrid(t: (k: string) => string, stats: AccountStats): [string, string | number][] {
  const winPct = stats.games > 0 ? `${Math.round((stats.wins / stats.games) * 100)}%` : "0%";
  return [
    [t("statGames"), stats.games],
    [t("statWins"), stats.wins],
    [t("statWinPct"), winPct],
    [t("statPoints"), stats.points],
    [t("statBest"), stats.best],
    [t("statUniques"), stats.uniques],
    [t("statDubbels"), stats.dubbels],
    [t("statStreak"), stats.streak],
  ];
}

// Bij elke statistiek een teken. Een raster van acht getallen zonder iconen
// leest als een tabel; met een teken erboven wordt elk vakje een kaartje dat je
// los kunt herkennen, ook als je het label niet leest.
const STAT_ICONEN = [Swords, Crown, Percent, Sparkles, Target, Gem, Users, Flame];

// De echte art uit de UI-map, in dezelfde volgorde als `statGrid`. De getekende
// tekens hierboven blijven als terugval staan voor het geval er een bestand
// ontbreekt.
const STAT_PADEN = [
  `/ui/stat/games.webp?v=${STAT_ART}`,    // Games: de controller
  `/ui/stat/winsten.webp?v=${STAT_ART}`,  // Winsten: de beker
  `/ui/stat/kroon.webp?v=${STAT_ART}`,    // Win %: de kroon
  `/ui/stat/punten.webp?v=${STAT_ART}`,   // Punten: de stapel munten
  `/ui/stat/sterren.webp?v=${STAT_ART}`,  // Beste game: de sterren
  `/ui/stat/woorden.webp?v=${STAT_ART}`,  // Unieke woorden: het boek
  `/ui/stat/dubbel.webp?v=${STAT_ART}`,   // Dubbels: de twee pijlen
  `/ui/stat/vlam.webp?v=${STAT_ART}`,     // Winstreeks: de vlam
];

function StatGrid({ stats }: { stats: AccountStats }) {
  const { t } = useT();
  const rijen = statGrid(t, stats);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
      {rijen.map(([label, value], i) => {
        const Icoon = STAT_ICONEN[i] ?? Sparkles;
        return <StatKaart key={label} icoon={<Icoon size={15} />} art={STAT_PADEN[i]} waarde={value} label={label} />;
      })}
    </div>
  );
}

/** Het raster zoals het live staat, voor iedereen die de vitrine nog niet ziet. */
function StatGridKlassiek({ stats }: { stats: AccountStats }) {
  const { t } = useT();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
      {statGrid(t, stats).map(([label, value]) => (
        <div key={label} style={{ textAlign: "center", padding: "8px 2px", borderRadius: 12, background: withAlpha("#000000", 0.18) }}>
          <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.gold }}>{value}</div>
          <div style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// De voortgangsregel onderin de heldenkaart: een zeshoekige XP-penning, de
// groef met de gouden staaf, en het getal ernaast. Eronder in het midden wat er
// nog te gaan is, want dat is het enige getal dat je aanzet om nog een potje te
// spelen.
function XpRij({ level }: { level: LevelInfo }) {
  const { t } = useT();
  const span = Math.max(1, level.next_level - level.level_start);
  const nu = Math.max(0, level.xp - level.level_start);
  const deel = Math.min(1, nu / span);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, marginLeft: 34, marginRight: 16, marginBottom: 1 }}>
      {/* Het totaal staat BOVEN de balk en niet ernaast, anders eet het een hap
          uit de breedte en houdt de balk halverwege de sectie op. Regelhoogte 1
          zodat de tekst TEGEN de balk staat: de lucht die een gewone regel
          eromheen zet, telt hier als losse ruimte. */}
      <span style={{ textAlign: "right", lineHeight: 1, marginBottom: -5, fontFamily: font.display, fontWeight: 700, fontSize: 13, color: "#FFFFFF" }}>
        {/* Alleen het GETAL waar je naartoe werkt is goud. De schuine streep en
            de eenheid zijn leesteken, geen informatie, dus die horen bij de rest
            van de regel. */}
        {nu} / <span style={{ color: GOUD[2] }}>{span}</span> XP
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* De zeshoek draagt een dikke gouden lijst, dus het VAK binnenin is
            een stuk kleiner dan de doos. Vandaar een grotere plaat dan de oude
            getekende zeshoek: anders is er geen plek voor de letters. */}
        <HexArt maat={30} style={{ flexShrink: 0, marginLeft: -2 }}>
          <span style={{ fontFamily: font.wide, fontSize: 13, letterSpacing: 0, color: GOUD[3], textShadow: "0 1px 2px rgba(8,3,20,.85)" }}>
            XP
          </span>
        </HexArt>
        {/* De balk is een GROEF: de staaf ligt erin, niet erop. De schaduw valt
            binnenin en van bovenaf, en de ring is omgedraaid, want de bovenrand
            van een gat ligt juist in de schaduw. */}
        {/* De balk is een GROEF met een neon-lijst eromheen: de staaf ligt erin,
            niet erop. De lijst loopt van rood via roze en violet naar goud, en
            dat is horizontaal, want op een lange smalle vorm zie je van een
            verticaal verloop niets. De balk vult de rij bovendien zo goed als
            helemaal: is hij veel dunner dan de penning ernaast, dan valt er
            lucht boven en onder die je als een gat naar de tekst ziet. */}
        <NeonKader
          radius={999}
          dik={0.5}
          lijn={KADER_LIJN_XP}
          // De gloed draagt de kleuren van de balk zelf, want hij IS de balk:
          // een vervaagde kopie, met rook eroverheen zodat hij ongelijkmatig
          // walmt in plaats van overal even hard te schijnen.
          gloed="verloop"
          vulling="geen"
          style={{ flex: 1 }}
          binnen={{
            height: 17,
            background: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.3) 100%)",
            boxShadow: "inset 0 2px 5px rgba(0,0,0,.7), inset 0 -1px 0 rgba(255,255,255,.09)",
          }}
        >
          <div
            style={{
              width: `${deel * 100}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(180deg, ${GOUD[3]} 0%, ${GOUD[2]} 42%, ${GOUD[1]} 100%)`,
              boxShadow: `0 0 10px ${withAlpha(GOUD[2], 0.5)}`,
              transition: "width .4s ease",
            }}
          />
        </NeonKader>
      </div>
      {/* Alleen de tekst omhoog: een negatieve marge op de tekst zelf laat de
          balk staan waar hij staat. Zou de rij omhoog gaan, dan schuift alles
          mee en raakt de balk de lijst van de sectie. */}
      <span style={{ textAlign: "center", lineHeight: 1, marginTop: -4, fontFamily: font.ui, fontSize: 11, color: colors.faint }}>
        {t("xpToNext", { n: Math.max(0, span - nu) })}
      </span>
    </div>
  );
}

// ---- Prestaties ----------------------------------------------------------------
// De volledige kast, niet alleen wat je al hebt. Een lege plek in een
// verzameling is precies wat je wilt opvullen, dus de nog niet behaalde
// penningen staan er grijs bij, met een teller als er iets te tellen valt.
//
// `nu` rekent hier in de frontend, uit dezelfde statistieken die de server ook
// gebruikt om de badge toe te kennen. Prestaties die aan een gebeurtenis hangen
// (een comeback, een perfecte ronde) hebben geen teller: die krijgen een slot.
//
// Elke penning heeft eigen art in `public/ui/badges/<sleutel>.webp`, uit het
// vel dat in de UI-map staat. Staat er ooit een sleutel bij zonder art, dan
// haal je hem hier weg en valt hij terug op het getekende teken.
const BADGE_ART = new Set<string>([
  "eerste_game", "eerste_winst", "tien_games", "vijf_winsten", "hattrick", "woordenaar",
  "vijfentwintig_games", "tien_winsten", "perfecte_ronde", "comeback", "durfal",
  "eerste_vriend", "eerste_bericht", "seizoenswinnaar",
]);

const PRESTATIES: { key: string; icoon: typeof Crown; nu?: (s: AccountStats) => number; doel?: number }[] = [
  { key: "eerste_game", icoon: Swords },
  { key: "eerste_winst", icoon: Crown },
  { key: "tien_games", icoon: Swords, nu: (s) => s.games, doel: 10 },
  { key: "vijf_winsten", icoon: Trophy, nu: (s) => s.wins, doel: 5 },
  { key: "hattrick", icoon: Flame, nu: (s) => s.streak, doel: 3 },
  { key: "woordenaar", icoon: BookOpen, nu: (s) => s.uniques, doel: 50 },
  { key: "vijfentwintig_games", icoon: Shield, nu: (s) => s.games, doel: 25 },
  { key: "tien_winsten", icoon: Medal, nu: (s) => s.wins, doel: 10 },
  { key: "perfecte_ronde", icoon: Sparkles },
  { key: "comeback", icoon: Rocket },
  { key: "durfal", icoon: Zap },
  { key: "eerste_vriend", icoon: UserPlus },
  { key: "eerste_bericht", icoon: MessageCircle },
  { key: "seizoenswinnaar", icoon: Star },
];

// ---- Inklapbare profielsectie ----------------------------------------------
// Prestaties en Laatste potjes groeien mee met hoe lang je speelt en duwden het
// profiel daardoor eindeloos lang. Ingeklapt blijft het eerste item staan als
// voorproefje (een lege kop zegt niks), met een chevron rechtsboven om de rest
// erbij te halen. Zelfde gebaar als de secties in Profielinstellingen.
function CollapsibleCard({
  title,
  items,
  emptyText,
  vitrine,
}: {
  title: string;
  items: React.ReactNode[];
  emptyText: string;
  /** De vitrine-opmaak: sectiekop met "Alles bekijken" en drie items als
   *  voorproefje. Zonder deze vlag blijft het de kaart die nu live staat. */
  vitrine?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const voorproef = vitrine ? 3 : 1;
  const hidden = Math.max(0, items.length - voorproef);
  const shown = open ? items : items.slice(0, voorproef);

  if (vitrine) {
    // Een lijst OM de rijen heen: de kop hoort erbij, dus die staat er ook in.
    // De binnenste lijsten krijgen een kleinere ronding, anders botsen de twee
    // hoeken op elkaar in plaats van in elkaar te vallen.
    return (
      <NeonKader
        radius={18}
        vulling="geen"
        dik={0.35}
        lijn={KADER_LIJN_LOOP}
        gloed="none"
        animeer
        // De lijst om een sectie mag er nauwelijks zijn: hij bakent af en houdt
        // verder zijn mond. Wat erin staat is het onderwerp.
        sterkte={0.32}
        // De statistiekkaartjes zijn 74 breed in kolommen van 84, dus ze staan
        // vijf pixels van de kolomrand af. Zet je deze lijst tegen die rand, dan
        // steekt hij precies die vijf pixels uit ten opzichte van wat je erboven
        // ziet staan.
        style={{ marginInline: 5 }}
        // De zijranden zijn hier smaller dan bij de andere secties: de rijen
        // hebben elke pixel breedte nodig. De kop compenseert dat zelf, zodat
        // het opschrift op dezelfde lijn blijft staan als bij de buren.
        binnen={{ padding: "10px 7px 11px", display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ paddingInline: 4 }}>
          <SectieKop
            label={title}
            actie={hidden > 0 ? (open ? t("showLess") : t("showAll")) : undefined}
            onActie={() => { sound.uiTap(); setOpen((v) => !v); }}
          />
        </div>
        {items.length === 0 ? (
          <p style={{ margin: 0, paddingInline: 4, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{emptyText}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{shown}</div>
        )}
      </NeonKader>
    );
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={() => { sound.uiTap(); setOpen((v) => !v); }}
        disabled={hidden === 0}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: 0, cursor: hidden === 0 ? "default" : "pointer", textAlign: "left" }}
      >
        <span style={{ flex: 1, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
          {title}
        </span>
        {hidden > 0 && (
          <>
            {!open && (
              <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: colors.gold }}>+{hidden}</span>
            )}
            <ChevronDown size={16} color={colors.faint} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }} />
          </>
        )}
      </button>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{emptyText}</p>
      ) : (
        shown
      )}
      {!open && hidden > 0 && (
        <button
          onClick={() => { sound.uiTap(); setOpen(true); }}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 0 0", fontFamily: font.ui, fontSize: 12, color: colors.sub }}
        >
          {t("showAllN", { n: items.length })}
        </button>
      )}
    </Card>
  );
}

// ---- Laatste potjes -------------------------------------------------------------

function HistoryCard({ game, meId, vitrine }: { game: GameApi; meId: string; vitrine?: boolean }) {
  const { t } = useT();
  const games = game.state.history;
  // Mijn ring is mijn RANG, niet mijn kleur: hij volgt het schild van mijn
  // divisie. Van oude tegenstanders kennen we de divisie niet, dus die houden
  // hun spelerkleur; liever eerlijk de kleur dan een verzonnen rang.
  const account = game.state.account;
  const mijnDivisie = account ? Math.max(0, SCHILD_KLEUREN.indexOf((account.shield as SchildKleur) || "paars")) : undefined;

  useEffect(() => {
    game.historyGet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  const fmtDate = (ts: number) => {
    const d = new Date(ts * 1000);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return t("historyToday");
    const yesterday = new Date(today.getTime() - 86400000);
    if (d.toDateString() === yesterday.toDateString()) return t("historyYesterday");
    return `${d.getDate()}-${d.getMonth() + 1}`;
  };

  // Een potje is een DUEL, ook als er zes mensen meededen: jij tegen degene die
  // je het meest voor de voeten liep. Zes even grote avatars op een rij zeggen
  // niets over hoe het ging; "jij 235 tegen Lisa 198" zegt het in één blik. De
  // rest van de tafel staat als "+3" achter de tegenstander, zodat je niet
  // vergeet dat het een groepspotje was.
  if (!vitrine) {
    return (
      <CollapsibleCard
        title={t("historyTitle")}
        emptyText={t("noHistory")}
        items={games.map((g, i) => (
          <div
            key={`${g.finished_at}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 12,
              backgroundImage: g.is_winner
                ? "linear-gradient(180deg, rgba(255,194,61,.14) 0%, rgba(0,0,0,.24) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,.045) 0%, rgba(0,0,0,.24) 100%)",
              border: `1px solid ${g.is_winner ? withAlpha(colors.gold, 0.45) : colors.hairline}`,
              boxShadow: g.is_winner ? `0 0 12px ${withAlpha(colors.gold, 0.14)}` : "none",
            }}
          >
            <Plek plek={g.place} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {g.players.slice(0, 6).map((pl) => (
                  <span key={pl.user_id} style={{ opacity: pl.user_id === meId ? 1 : 0.85 }}>
                    <Avatar name={pl.name} color={pl.color} size={20} userId={pl.user_id} hasAvatar={pl.has_avatar} avatarVer={pl.avatar_ver} divisie={pl.user_id === meId ? mijnDivisie : undefined} />
                  </span>
                ))}
                {g.player_count > 6 && (
                  <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint }}>+{g.player_count - 6}</span>
                )}
              </div>
              <div style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint, marginTop: 3 }}>
                {fmtDate(g.finished_at)} · {g.rounds === 1 ? t("historyRound1") : t("historyRounds", { n: g.rounds })}
              </div>
            </div>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: g.is_winner ? colors.gold : colors.ink, flexShrink: 0 }}>
              {g.score}
            </span>
          </div>
        ))}
      />
    );
  }

  return (
    <CollapsibleCard
      vitrine
      title={t("historyTitle")}
      emptyText={t("noHistory")}
      items={games.map((g, i) => {
        const ik = g.players.find((p) => p.user_id === meId);
        const anderen = g.players.filter((p) => p.user_id !== meId).sort((a, b) => b.score - a.score);
        const tegen = anderen[0];
        const rest = Math.max(0, g.player_count - 2);
        // De kroon staat bij de score van wie WON. De spelers komen gesorteerd
        // binnen, dus als ik niet won, is de beste ander de winnaar.
        const naam = (p: { name: string }) => (
          <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 11, color: colors.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
            {p.name}
          </span>
        );
        // De groef die de vakken scheidt: donkere linkerwand, lichte rechter,
        // boven en onder vervaagd zodat hij vrij in het vlak hangt. Staat
        // tussen wapen en portret EN voor de opbrengst-kolom.
        const groef = (
          <span
            aria-hidden
            style={{
              alignSelf: "stretch",
              flexShrink: 0,
              width: 2,
              marginBlock: 3,
              backgroundImage: "linear-gradient(90deg, rgba(8,3,20,.7) 0, rgba(8,3,20,.7) 1px, rgba(255,255,255,.13) 1px, rgba(255,255,255,.13) 2px)",
              WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)",
              maskImage: "linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)",
            }}
          />
        );
        const score = (n: number, won: boolean) => (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.display, fontWeight: 800, fontSize: 15, lineHeight: 1.1, color: colors.ink }}>
            {n}
            {won && <ArtIcoon naam="kroon" size={14} />}
          </span>
        );
        return (
          <NeonKader
            key={`${g.finished_at}-${i}`}
            hoek={11}
            dik={0.3}
            // Puur lijn. De afsnijding en de kern doen het werk; een glasplaat
            // eronder maakt er weer een kaart van.
            vulling="geen"
            // De lijn zelf staat bijna uit; wat je ziet is de kern in het midden
            // met zijn hoogsel, zoals de lijn boven "jij draait deze ronde".
            sterkte={0.3}
            eindkap
            adem={i * 1.3}
            veeg={i === 0}
            // Rechts staat MEER lucht dan links: daar snijdt de hoek van de lijst
            // een driehoek uit het vlak, en op acht pixels viel het portret van
            // de tegenstander daar precies overheen. Dan zie je het uiteinde van
            // de balk niet meer. Links zit het wapen al buiten die driehoek.
            binnen={{ display: "flex", alignItems: "center", gap: 5, minHeight: 46, padding: "5px 17px 5px 45px" }}
          >
            {/* Het wapen hangt AAN de bovenlijn en begint op het knikpunt van de
                schuine hoek: los in de rij zwevend leek hij nergens bij te
                horen. Vandaar absoluut, op de hoekmaat van de lijst. */}
            <span style={{ position: "absolute", left: 11, top: 0, display: "flex" }}>
              <PlekWapen plek={g.place} maat={28} />
            </span>
            {groef}
            {/* Mijn hoek: portret, met naam boven en score onder. De twee
                spelersblokken zijn elkaars spiegelbeeld en allebei even breed,
                zodat de VS vanzelf in het MIDDEN van de lijst hangt. */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
              {ik && (
                <Avatar name={ik.name} color={ik.color} size={34} userId={ik.user_id} hasAvatar={ik.has_avatar} avatarVer={ik.avatar_ver} divisie={mijnDivisie} />
              )}
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                {ik && naam(ik)}
                {score(g.score, g.is_winner)}
              </div>
            </div>
            {tegen && (
              <span
                style={{
                  fontFamily: font.wide,
                  fontSize: 17,
                  letterSpacing: 1.2,
                  color: "#F0E9FF",
                  textShadow: "0 0 9px rgba(200,139,255,.55)",
                  flexShrink: 0,
                }}
              >
                VS
              </span>
            )}
            {tegen ? (
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                  {naam(tegen)}
                  {score(tegen.score, !g.is_winner)}
                </div>
                <span style={{ position: "relative", flexShrink: 0, display: "flex" }}>
                  <Avatar name={tegen.name} color={tegen.color} size={34} userId={tegen.user_id} hasAvatar={tegen.has_avatar} avatarVer={tegen.avatar_ver} divisie={tegen.divisie} />
                  {rest > 0 && (
                    // Meer tegenstanders dan er passen: de beste staat er, de
                    // teller hangt als een muntje aan diens portret.
                    <span style={{ position: "absolute", right: -3, bottom: -1, minWidth: 13, height: 13, padding: "0 2px", borderRadius: 7, background: "rgba(10,4,26,.92)", border: `1px solid ${withAlpha(GOUD[2], 0.5)}`, display: "grid", placeItems: "center", fontFamily: font.ui, fontWeight: 700, fontSize: 8, color: GOUD[3] }}>
                      +{rest}
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div style={{ flex: 1 }} />
            )}
            {/* Wat het potje opleverde. Voor oude potjes is dat niet meer te
                achterhalen (allebei nul): dan valt de kolom weg in plaats van
                nullen te tonen. */}
            {(g.xp > 0 || g.coins > 0) && groef}
            {(g.xp > 0 || g.coins > 0) && (
              // De tekst mag verder naar rechts dan de rest van de rij: hij is
              // laag en staat in het midden, dus hij raakt de schuine hoek niet.
              // Zijn rechterrand komt zo op elf uit, precies de inzet waarmee
              // het wapen aan de andere kant begint.
              <div style={{ flexShrink: 0, marginRight: -6, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 12, lineHeight: 1.15, color: colors.ink }}>
                  +{g.xp} <span style={{ color: GOUD[2] }}>XP</span>
                </span>
                {g.coins > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: font.display, fontWeight: 800, fontSize: 12, lineHeight: 1.15, color: GOUD[3] }}>
                    <img src="/coin.webp" alt="" width={13} height={13} style={{ display: "block" }} />
                    +{g.coins}
                  </span>
                )}
              </div>
            )}
          </NeonKader>
        );
      })}
    />
  );
}

// ---- DM-gesprek ----------------------------------------------------------------

/** De vulling van de kop- en de invulbalk. EIGEN kleur en niet die van de
 *  pagina eronder: het paginaverloop loopt van boven naar beneden, dus zodra
 *  het toetsenbord de invulbalk omhoog duwt zou hij in een andere kleur komen
 *  te staan dan de kop. Twee balken die bij elkaar horen kleuren dan uit
 *  elkaar precies op het moment dat je ze naast elkaar ziet. */
const BALK_VULLING = "#271A4A";

function DmThreadOverlay({ game }: { game: GameApi }) {
  const { t } = useT();
  const partnerId = game.state.dmOpenWith!;
  const messages = game.state.dmMessages;
  const me = game.state.account?.id;
  const [text, setText] = useState("");
  const [dmEmotesOpen, setDmEmotesOpen] = useState(false);
  // Het behang staat op dit TOESTEL en niet op je account: het is hoe JIJ je
  // gesprekken wilt zien, niet iets wat de ander hoort te merken.
  const [behang, setBehang] = useState<WallpaperId>(wallpaperVan);
  const [behangOpen, setBehangOpen] = useState(false);
  const vak = useZichtbaarVak();
  const listRef = useRef<HTMLDivElement | null>(null);
  // Partner identity: from threads, friends, or the viewed profile.
  const partner =
    game.state.dmThreads.find((th) => th.partner === partnerId)?.user ??
    game.state.friends.find((f) => f.id === partnerId) ??
    (game.state.viewedProfile?.id === partnerId ? game.state.viewedProfile : null);

  useEffect(() => {
    // Opening marks the thread read server-side; sync badge + thread list.
    game.dmRefreshThreads();
    game.send({ type: "account_get" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const sendNow = () => {
    if (!text.trim()) return;
    game.dmSend(partnerId, text);
    setText("");
  };

  // Upload a memo (Bearer-authed), then send it as a DM.
  const uploadVoice = async (blob: Blob, mime: string): Promise<string | null> => {
    try {
      const token = localStorage.getItem("penneer.accountToken") || "";
      const res = await fetch("/api/dm/voice", {
        method: "POST",
        headers: { "Content-Type": mime, Authorization: `Bearer ${token}` },
        body: blob,
      });
      if (!res.ok) return null;
      return (await res.json()).id as string;
    } catch {
      return null;
    }
  };

  // En hetzelfde voor een foto of sticker. Anders dan in de room blijft dit
  // staan: een privégesprek loop je later terug, een potje niet.
  const uploadBeeld = async (blob: Blob, mime: string): Promise<string | null> => {
    try {
      const token = localStorage.getItem("penneer.accountToken") || "";
      const res = await fetch("/api/dm/image", {
        method: "POST",
        headers: { "Content-Type": mime, Authorization: `Bearer ${token}` },
        body: blob,
      });
      if (!res.ok) return null;
      return (await res.json()).id as string;
    } catch {
      return null;
    }
  };

  const fmt = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    // Een VOLLEDIGE pagina, geen lade. Een gesprek in de room is een popup
    // omdat je het spel erachter in de gaten wilt houden; een privégesprek uit
    // de inbox heeft geen achtergrond die ertoe doet, dus dat verdient het
    // hele scherm. Geen gouden rand eromheen (er is geen rand meer om te
    // markeren), alleen de gouden haarlijnen tussen de stroken.
    //
    // Aan het ZICHTBARE vak en niet aan de pagina: komt het toetsenbord op,
    // dan krimpt dit vak mee. De kop met de avatar blijft bovenaan staan en de
    // berichtenlijst (flex: 1) is wat er kleiner van wordt.
    <div
      style={{
        // De doos zelf staat ALTIJD in de hoeken van het scherm, zodat er nooit
        // een streepje app-achtergrond onder je gesprek doorschemert. Wat het
        // toetsenbord afdekt gaat er als OPVULLING af, en dat is een lengte,
        // dus die kan bewegen: de kop groeit naar de bredere balk terwijl de
        // berichtenlijst eronder krimpt, in plaats van dat het springt.
        position: "fixed",
        inset: 0,
        paddingTop: vak.top,
        paddingBottom: vak.bedekt,
        transition: "padding-bottom .2s cubic-bezier(.2,1,.3,1)",
        zIndex: 85,
        display: "flex",
        flexDirection: "column",
        backgroundImage: [
          "linear-gradient(180deg, rgba(255,243,181,.07) 0%, transparent 12%)",
          "linear-gradient(180deg, #241740 0%, #1A1035 55%, #120A28 100%)",
        ].join(", "),
      }}
    >
        {/* De kop draagt ALTIJD de veilige zone: de pagina begint bovenaan het
            scherm, dus de statusbalk van de telefoon ligt er altijd overheen. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "calc(10px + env(safe-area-inset-top)) 16px 10px", backgroundColor: BALK_VULLING, ...goudHaarlijn("bottom") }}>
          {partner ? (
            <Avatar name={partner.name} color={partner.color} size={34} userId={partner.id} hasAvatar={partner.has_avatar} avatarVer={partner.avatar_ver} divisie={partner.divisie} />
          ) : null}
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {partner?.name ?? "..."}
          </span>
          <button
            onClick={() => { sound.uiTap(); setBehangOpen((v) => !v); }}
            aria-label={t("wallpaperTitle")}
            title={t("wallpaperTitle")}
            className="pressable"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: behangOpen ? GOUD[2] : colors.faint, display: "flex", padding: 4 }}
          >
            <img src="/ui/wallpaper.webp" alt="" aria-hidden style={{ width: 26, height: 26, objectFit: "contain", display: "block" }} />
          </button>
          <button onClick={game.dmClose} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
            <CloseIcon size={26} />
          </button>
        </div>

        {behangOpen && (
          // Een KLEURENBALK, zoals de stiftkleuren in de foto-editor: één rij
          // ronde staaltjes die opzij schuift, met een ring om degene die aan
          // staat. Het raster van zes benoemde tegels duwde de hele chat naar
          // beneden en klapte bij het openen over de berichten heen; deze balk
          // is één regel hoog en blijft binnen zijn eigen strook.
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", overflowX: "auto", overflowY: "hidden",
              WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
              flexShrink: 0,
              ...goudHaarlijn("bottom"),
            }}
          >
            {WALLPAPERS.map((w) => {
              const aan = behang === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => { sound.uiTap(); setBehang(w.id); wallpaperZet(w.id); }}
                  aria-label={w.naam}
                  title={w.naam}
                  aria-pressed={aan}
                  className="pressable"
                  style={{
                    flexShrink: 0, width: 34, height: 34, borderRadius: 11,
                    border: "none", padding: 0, cursor: "pointer",
                    // De witte ring van de kleurenbalk, hier in goud: hij ligt
                    // OM het staaltje heen en niet erop, dus de wallpaper zelf
                    // blijft helemaal zichtbaar.
                    boxShadow: aan
                      ? `0 0 0 2px #160D30, 0 0 0 4px ${GOUD[2]}, 0 0 14px ${withAlpha(GOUD[2], 0.5)}`
                      : `0 0 0 1.5px ${withAlpha("#C8A0FF", 0.28)}`,
                    ...wallpaperStijl(w.id),
                    backgroundAttachment: "scroll",
                  }}
                />
              );
            })}
          </div>
        )}

        <div ref={listRef} className={`zachtscroll ${wallpaperKlasse(behang)}`} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px", display: "flex", flexDirection: "column", gap: 8, ...wallpaperStijl(behang) }}>
          {messages.length === 0 && (
            <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 13, color: colors.faint, marginTop: 20 }}>{t("dmNoMessages")}</p>
          )}
          {messages.map((m) => {
            const mine = m.from_user === me;
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                {/* De bel heeft de afgeschuinde hoek van een glasrij, met de
                    punt aan de kant waar hij vandaan komt. Een gewone bubbel
                    met een randje hoort bij een chat-app; deze app is van glas
                    en goud. */}
                {/* Een PIL. De afgeschuinde glastegel is de vorm van een rij in
                    een lijst, en een bericht is geen rij: het is een blaadje dat
                    iemand je toeschuift. Rond dus, met een kortere hoek aan de
                    kant waar hij vandaan komt, en met een lijn die je ziet:
                    tegen behang verdwijnt een fluistering. */}
                <div style={{
                  padding: m.emote || m.image_id ? 4 : m.voice_id ? "8px 12px" : "10px 15px",
                  borderRadius: m.emote || m.image_id ? 14 : 20,
                  borderBottomRightRadius: m.emote || m.image_id ? 14 : mine ? 6 : 20,
                  borderBottomLeftRadius: m.emote || m.image_id ? 14 : mine ? 20 : 6,
                  background: m.emote || m.image_id
                    ? "transparent"
                    : mine
                      ? `linear-gradient(180deg, ${withAlpha(colors.gold, 0.22)}, ${withAlpha(colors.gold, 0.12)})`
                      : "linear-gradient(180deg, rgba(24,12,50,.88), rgba(14,7,34,.88))",
                  boxShadow: m.emote || m.image_id
                    ? undefined
                    : mine
                      ? `inset 0 0 0 1.4px ${withAlpha(GOUD[2], 0.75)}, 0 0 12px ${withAlpha(GOUD[2], 0.24)}`
                      : `inset 0 0 0 1.4px ${withAlpha("#A868F5", 0.65)}, 0 0 12px ${withAlpha("#8B45E8", 0.22)}`,
                  fontFamily: font.ui, fontSize: 14, color: colors.ink, lineHeight: 1.45, wordBreak: "break-word",
                }}>
                  {m.emote ? (
                    <img src={EMOTE_SRC(m.emote)} alt="" width={84} height={84} style={{ width: 84, height: 84, display: "block", objectFit: "contain" }} />
                  ) : m.image_id ? (
                    <img
                      src={`/api/dm/image/${m.image_id}`}
                      alt=""
                      style={{ maxWidth: "100%", maxHeight: 260, width: "auto", height: "auto", display: "block", borderRadius: 12 }}
                    />
                  ) : m.voice_id ? (
                    <VoiceNote src={`/api/dm/voice/${m.voice_id}`} duration={m.voice_dur ?? 0} mine={mine} />
                  ) : (
                    m.text
                  )}
                </div>
                <div style={{ fontFamily: font.ui, fontSize: 10, color: colors.faint, marginTop: 2, textAlign: mine ? "right" : "left" }}>{fmt(m.created_at)}</div>
              </div>
            );
          })}
        </div>

        {dmEmotesOpen && (
          <EmotePicker
            unlocked={new Set(game.state.account?.emote_packs ?? FREE_EMOTE_PACKS)}
            onPick={(id) => { game.dmSend(partnerId, "", undefined, id); setDmEmotesOpen(false); }}
            onClose={() => setDmEmotesOpen(false)}
          />
        )}

        {/* De onderrand van de telefoon hoeft alleen vrijgehouden te worden als
            je hem ziet. Ligt het toetsenbord eroverheen, dan is die marge een
            lege strook onder je invulveld. */}
        <div style={{ display: "flex", gap: 8, padding: vak.gekrompen ? "8px 14px 8px" : "8px 14px calc(8px + env(safe-area-inset-bottom))", backgroundColor: BALK_VULLING, ...goudHaarlijn("top") }}>
          <button
            type="button"
            onClick={() => { sound.uiTap(); setDmEmotesOpen((v) => !v); }}
            aria-label={t("emoteTitle")}
            style={{ flexShrink: 0, width: 44, height: 44, cursor: "pointer", border: "none", background: "transparent", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center", opacity: dmEmotesOpen ? 1 : 0.82 }}
          >
            {/* De eerste sticker uit het Blij-pak in plaats van een lijnicoon.
                Kaal, zonder vakje: de sticker IS de knop, en een kader eromheen
                maakt er een knop met een plaatje in van. */}
            <img src={EMOTE_SRC("ce01")} alt="" aria-hidden style={{ width: 38, height: 38, objectFit: "contain", display: "block" }} />
          </button>
          {/* Een PIL, en een die je ziet. Een neonlijst op halve sterkte
              verdwijnt tegen behang; hier is de lijn vol en helemaal rond, want
              dit is het enige waar je op tikt om iets te zeggen. */}
          <NeonKader
            radius={999}
            dik={0.9}
            sterkte={text.trim() ? 0.55 : 0.42}
            lijn={KADER_LIJN_PAARS}
            gloed="0 0 4px rgba(139,69,232,.25)"
            vulling="geen"
            style={{ flex: 1, minWidth: 0 }}
            binnen={{ display: "flex", alignItems: "center", padding: 0, background: "rgba(6,3,18,.55)" }}
          >
            <input
              value={text}
              maxLength={500}
              placeholder={t("chatPlaceholder")}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendNow(); }}
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", padding: "12px 16px", fontFamily: font.ui, fontSize: 15, color: colors.ink }}
            />
          </NeonKader>
          {text.trim() ? (
            <VerstuurKnop onClick={sendNow} label={t("chatSend")} />
          ) : (
            <>
              <BeeldKnop upload={uploadBeeld} onSent={(id) => game.dmSend(partnerId, "", undefined, undefined, id)} />
              <MicButton upload={uploadVoice} onSent={(id, dur) => game.dmSend(partnerId, "", { id, dur })} />
            </>
          )}
        </div>
    </div>
  );
}

// ---- Profiel ----------------------------------------------------------------

function ProfileTab({ game, onShowShop }: { game: GameApi; onShowShop: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const [sharing, setSharing] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [prestatiesUit, setPrestatiesUit] = useState(false);
  const [schildOpen, setSchildOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const colorDebounce = useRef<number | undefined>(undefined);

  // De vitrine: het nieuwe profiel. Staat sinds v2.12.0 voor IEDEREEN open.
  // De oude weergave staat er nog onder (de `vitrine`-vertakkingen), zodat
  // terugvallen een wijziging van deze ene regel is en geen herbouw.
  const vitrine = true;


  // De deelkaart van je profiel. Stond in de bovenbalk op een zeshoekige plaat;
  // hij hoort bij de SECTIE die hij deelt, dus hij staat nu in de hoek van de
  // profielkaart zelf.
  const shareCard = async () => {
    if (!account || sharing) return;
    setSharing(true);
    try {
      const lvl = account.level;
      const winPct = account.stats.games > 0 ? `${Math.round((account.stats.wins / account.stats.games) * 100)}%` : "0%";
      const divisie = Math.max(0, SCHILD_KLEUREN.indexOf((account.shield as SchildKleur) || "paars"));
      const blob = await makeProfileCard({
        name: account.name,
        color: account.color,
        avatarUrl: account.has_avatar ? `/api/avatar/${account.id}?v=${account.avatar_ver}` : null,
        // De ring op de kaart is dezelfde als om je avatar in de app: je
        // SCHILD, niet je rang. Eén ring-taal, en hij vernieuwt elke maandag
        // vanzelf mee met de divisie-uitslag.
        ringColor: SCHILD_RAND[Math.max(0, Math.min(SCHILD_RAND.length - 1, divisie))] ?? null,
        rankTitle: t(`rank_${lvl.rank}`),
        levelText: t("profileCardLevel", { n: lvl.level }),
        level: lvl.level,
        divisie,
        divisieNaam: divisieNaam(divisie),
        divisieAccent: DIVISIE_ACCENT[divisie],
        xpNow: Math.max(0, lvl.xp - lvl.level_start),
        xpSpan: Math.max(1, lvl.next_level - lvl.level_start),
        xpLabel: `${Math.max(0, lvl.xp - lvl.level_start)} / ${Math.max(1, lvl.next_level - lvl.level_start)} XP`,
        stats: [
          [t("statGames"), String(account.stats.games)],
          [t("statWins"), String(account.stats.wins)],
          [t("statWinPct"), winPct],
          [t("statPoints"), String(account.stats.points)],
        ],
        badgesLine: t("profileCardBadges", { n: account.badges.length }),
        footer: t("footer"),
      });
      if (blob) await shareOrDownload(blob, "penneer-profiel.png");
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => setName(account?.name ?? ""), [account?.name]);

  // Het profiel heeft eigen art. De klasse gaat op de body en niet op een laag
  // hierbinnen, want de achtergrond moet ook onder de bovenbalk en de tabbalk
  // door lopen, en die staan buiten dit onderdeel.
  useEffect(() => {
    if (!vitrine) return;
    document.body.classList.add("profiel");
    return () => document.body.classList.remove("profiel");
  }, [vitrine]);

  async function uploadBlob(blob: Blob) {
    setBusy(true);
    try {
      const token = localStorage.getItem("penneer.accountToken");
      await fetch("/api/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
        body: blob,
      });
      game.send({ type: "account_get" }); // refresh avatar_ver
    } finally {
      setBusy(false);
    }
  }

  async function pickPreset(id: string) {
    setBusy(true);
    try {
      const token = localStorage.getItem("penneer.accountToken");
      await fetch("/api/avatar/preset", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      game.send({ type: "account_get" }); // refresh avatar_ver + avatar_preset
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    try {
      const token = localStorage.getItem("penneer.accountToken");
      await fetch("/api/avatar", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      game.send({ type: "account_get" }); // server fell back to the default preset
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <Fragment key="guest">
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("makeProfile")}</span>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t("makeProfileHint")}</p>
          <input style={inputStyle} placeholder={t("yourName")} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          <Button variant="gold" full disabled={name.trim().length < 2} onClick={() => game.createAccount(name)}>
            {t("makeProfile")}
          </Button>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("loginTitle")}</span>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("loginHint")}</p>
          <input style={inputStyle} type="email" autoComplete="email" placeholder={t("emailPlaceholder")} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
          <input style={inputStyle} type="password" autoComplete="current-password" placeholder={t("passwordPlaceholder")} value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
          <Button variant="gold" full disabled={!loginEmail.includes("@") || loginPass.length < 1} onClick={() => game.passwordLogin(loginEmail, loginPass)}>
            {t("login")}
          </Button>
          {game.state.loginLinkSent ? (
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.green, textAlign: "center" }}>{t("linkSent")}</p>
          ) : (
            <button
              onClick={() => loginEmail.includes("@") && game.requestLogin(loginEmail)}
              disabled={!loginEmail.includes("@")}
              style={{ background: "transparent", border: "none", cursor: loginEmail.includes("@") ? "pointer" : "default", color: colors.faint, fontFamily: font.ui, fontSize: 12.5, padding: 4, textDecoration: "underline", opacity: loginEmail.includes("@") ? 1 : 0.5 }}
            >
              {t("forgotPassword")}
            </button>
          )}
        </Card>
      </Fragment>
    );
  }

  if (avatarPickerOpen) {
    return (
      <AvatarPickerScreen
        current={account.avatar_preset}
        ownedItems={account.owned_items ?? []}
        busy={busy}
        onBack={() => setAvatarPickerOpen(false)}
        onShowShop={onShowShop}
        onPick={async (id) => {
          await pickPreset(id);
          setAvatarPickerOpen(false);
        }}
      />
    );
  }

  // Het formulier: naam en kleur. In de vitrine zit het achter het potloodje,
  // in het huidige profiel staat het gewoon naast je portret. Eén keer
  // opgeschreven, want de knoppen doen in beide gevallen hetzelfde.
  //
  // `klaar` is de weg terug: geef je die mee, dan staat de opslaanknop er ALTIJD
  // en klapt het paneel zichzelf dicht zodra je hem gebruikt. Zonder die functie
  // is het het oude gedrag: de knop verschijnt pas als de naam is veranderd,
  // want daar staat het formulier gewoon open en is er niets om te sluiten.
  const maakNaamEnKleur = (klaar?: () => void) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1, padding: "8px 11px" }} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        {(klaar || name.trim() !== account.name) && (
          // Een vinkje en geen woord: de knop staat naast het veld dat hij
          // afsluit, dus wat hij doet is uit zijn plek al duidelijk. Even hoog
          // als dat veld, want anders staat er een blok naast een regel. Zelfde
          // gouden lijst als het potlood waarmee je dit paneel opendeed.
          <button
            onClick={() => {
              sound.uiTap();
              if (name.trim() && name.trim() !== account.name) game.updateAccount({ name });
              klaar?.();
            }}
            aria-label={t("save")}
            className="pressable"
            style={{
              width: 36,
              flexShrink: 0,
              alignSelf: "stretch",
              display: "grid",
              placeItems: "center",
              borderRadius: 10,
              border: `1px solid ${withAlpha(GOUD[2], 0.55)}`,
              background: `linear-gradient(180deg, ${withAlpha(GOUD[2], 0.26)} 0%, ${withAlpha(GOUD[1], 0.12)} 100%)`,
              boxShadow: `inset 0 1px 0 ${withAlpha("#FFFFFF", 0.16)}, 0 2px 6px rgba(0,0,0,.35)`,
              color: GOUD[3],
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Check size={16} strokeWidth={3} />
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {playerColors.map((c) => (
          <button
            key={c}
            onClick={() => game.updateAccount({ color: c })}
            aria-label={c}
            style={{ width: 22, height: 22, borderRadius: 7, background: c, border: account.color === c ? `2px solid ${colors.ink}` : "2px solid transparent", cursor: "pointer" }}
          />
        ))}
        {/* Free choice: the REAL color input sits invisibly on top of the
            rainbow wheel, so the tap lands on the picker itself. (A
            scripted .click() on a hidden input is ignored on iOS.) */}
        <div
          title={t("customColor")}
          style={{
            position: "relative",
            width: 22,
            height: 22,
            flexShrink: 0,
            borderRadius: "50%",
            background: "conic-gradient(#ff3b30, #ff9500, #ffd60a, #34c759, #32ade6, #5856d6, #ff2d92, #ff3b30)",
            border: !playerColors.includes(account.color) ? `2px solid ${colors.ink}` : "2px solid transparent",
            boxShadow: !playerColors.includes(account.color) ? `0 0 8px ${withAlpha(account.color, 0.7)}` : "none",
          }}
        >
          <input
            ref={colorInputRef}
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(account.color) ? account.color : "#FFC23D"}
            onChange={(e) => {
              const v = e.target.value;
              if (colorDebounce.current) window.clearTimeout(colorDebounce.current);
              colorDebounce.current = window.setTimeout(() => game.updateAccount({ color: v }), 350);
            }}
            aria-label={t("customColor")}
            style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", opacity: 0, cursor: "pointer", border: "none", padding: 0 }}
          />
        </div>
      </div>
    </div>
  );

  // Het verborgen bestandsveld waar het fotomenu op mikt. Staat buiten de
  // opmaak-keuze, zodat de knop in beide gevallen dezelfde kiezer opent.
  const fotoVeld = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={(e) => {
        if (e.target.files?.[0]) setEditFile(e.target.files[0]);
        e.target.value = ""; // same file re-selectable
      }}
    />
  );

  const overlays = (
    <>
      {editFile && (
        <AvatarEditor
          file={editFile}
          onDone={(blob) => {
            setEditFile(null);
            if (blob) uploadBlob(blob);
          }}
        />
      )}
      {schildOpen && (
        <DivisieLadder
          divisie={SCHILD_KLEUREN.indexOf((account.shield as SchildKleur) || "paars")}
          stand={game.state.divisieStand}
          onClose={() => setSchildOpen(false)}
        />
      )}
      {avatarMenuOpen && (
        <AvatarMenu
          hasCustomPhoto={!!account.has_avatar && !account.avatar_preset}
          onPhoto={() => { setAvatarMenuOpen(false); fileRef.current?.click(); }}
          onPreset={() => { setAvatarMenuOpen(false); setAvatarPickerOpen(true); }}
          onRemove={() => { setAvatarMenuOpen(false); removeAvatar(); }}
          onClose={() => setAvatarMenuOpen(false)}
        />
      )}
    </>
  );

  if (!vitrine) {
    return (
      <Fragment key="mine">
        {/* identiteit + level: one section. The avatar itself is the edit entry:
            tapping it opens the change/remove menu (pencil badge as affordance). */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => { sound.uiTap(); setAvatarMenuOpen(true); }}
              disabled={busy}
              aria-label={t("avatarMenuTitle")}
              className="pressable"
              style={{ position: "relative", background: "transparent", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}
            >
              <Avatar name={account.name} color={account.color} size={64} userId={account.id} hasAvatar={account.has_avatar} avatarVer={account.avatar_ver} frame={account.avatar_frame} divisie={Math.max(0, SCHILD_KLEUREN.indexOf((account.shield as SchildKleur) || "paars"))} glow />
              <span style={{ position: "absolute", right: -3, bottom: -3, width: 22, height: 22, borderRadius: 8, display: "grid", placeItems: "center", background: colors.gold, color: colors.bg0, boxShadow: "0 2px 8px rgba(0,0,0,.4)" }}>
                <Pencil size={12} />
              </span>
            </button>
            {maakNaamEnKleur()}
          </div>
          {fotoVeld}
          <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <LevelBar level={account.level} />
            <StatGridKlassiek stats={account.stats} />
          </div>
        </Card>

        {overlays}

        {/* club en titel zijn nu eigen tabs; laatste potjes + prestaties blijven hier */}
        <HistoryCard game={game} meId={account.id} />

        <CollapsibleCard
          title={t("badgesTitle")}
          emptyText={t("noBadges")}
          items={account.badges.map((b) => (
            <div key={b.badge} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: withAlpha(colors.gold, 0.08), border: `1px solid ${withAlpha(colors.gold, 0.25)}` }}>
              <ArtIcoon naam="krans" size={18} />
              <span style={{ fontFamily: font.ui, fontSize: 13.5, color: colors.ink }}>{t(`badge_${b.badge}`)}</span>
            </div>
          ))}
        />
      </Fragment>
    );
  }

  return (
    <Fragment key="mine">

      {/* De heldenkaart. Eén paneel dat in één blik zegt wie je bent en hoe ver
          je bent: kroon, portret, level, naam, rang, en de balk naar het
          volgende level. Dat is de volgorde waarin je ernaar kijkt, dus ook de
          volgorde waarin het staat.
          Bewerken zit niet meer in de weg: de naam staat als naam en het
          potloodje ernaast klapt het formulier pas open. De avatar zelf blijft
          de ingang naar het foto-menu. */}
      <div style={{ position: "relative", paddingTop: 14 }}>
        <Paneel>
          {/* Delen zit in de HOEK van de sectie die hij deelt. In de bovenbalk
              stond hij op een zeshoekige plaat, ver van waar hij over gaat en
              met een tweede kader eromheen. */}
          <DeelKnop
            label={t("shareProfile")}
            bezig={sharing}
            onClick={() => { sound.uiTap(); shareCard(); }}
            style={{ position: "absolute", right: 2, top: -2, zIndex: 2 }}
          />
          {/* Een breed vlak vraagt om een brede indeling: bovenin het portret
              links met rechts alles wat je over jezelf leest, en onderin de
              voortgangsbalk over de VOLLE breedte. Onder elkaar zou het niet
              passen zonder de art uit te rekken. */}
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minHeight: 0 }}>
          <button
            onClick={() => { sound.uiTap(); setAvatarMenuOpen(true); }}
            disabled={busy}
            aria-label={t("avatarMenuTitle")}
            className="pressable"
            // De ring hoort IN de hoek en niet ergens in het midden te zweven:
            // hij gaat naar boven EN naar links tot tegen de sierlijst aan, net
            // als de kruisknop op de advertentie. Vandaar `flex-start` plus
            // negatieve marges in beide richtingen.
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, alignSelf: "flex-start", marginLeft: 3, marginTop: 2, marginRight: -2 }}
          >
            {/* De ring en het schild komen uit de UI-map; het portret zit in het
                gat van de ring. Een eigen frame zou hier een tweede ring om
                hetzelfde portret zijn, dus dat blijft voor de lobby en de
                lijsten. */}
            <RingPortret
              maat={134}
              level={account.level.level}
              kleur={(account.shield as SchildKleur) || "paars"}
              onSchild={() => { sound.uiTap(); game.divisieStand(); setSchildOpen(true); }}
            >
              <RingFoto userId={account.id} versie={account.avatar_ver} heeftFoto={account.has_avatar} naam={account.name} kleur={account.color} />
            </RingPortret>
          </button>

          {/* De kolom hangt niet aan de bovenkant van de ring maar zakt mee naar
              het midden ervan: naam, rang en titel horen op OOGHOOGTE van het
              portret te staan, niet erboven. */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 5, paddingTop: 20 }}>

          {/* naam + potlood */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.sub }}>{account.name}</span>
            <button
              onClick={() => { sound.uiTap(); setEditOpen((v) => !v); }}
              aria-label={t("save")}
              aria-expanded={editOpen}
              // Even hoog als de regel ernaast. Een knop die boven en onder de
              // tekst uitsteekt maakt van de naam een bijschrift bij de knop, en
              // het is andersom.
              style={{
                width: 18,
                height: 18,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 6,
                border: `1px solid ${withAlpha(GOUD[2], editOpen ? 0.9 : 0.4)}`,
                background: editOpen ? withAlpha(GOUD[2], 0.22) : "rgba(0,0,0,.3)",
                color: GOUD[2],
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Pencil size={10} />
            </button>
          </div>

          {/* De rang, groot. Dit is de regel waar je profiel om draait, dus hij
              krijgt de ruimte en het goud. */}
          <div
            style={{
              fontFamily: font.display,
              fontWeight: 800,
              fontSize: "clamp(16px, 5.2vw, 22px)",
              lineHeight: 1.02,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              backgroundImage: `linear-gradient(172deg, ${GOUD[3]} 0%, ${GOUD[2]} 46%, ${GOUD[1]} 78%, ${GOUD[2]} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {t(`rank_${account.level.rank}`)}
          </div>

          {/* De pil eronder: je gekozen titel als je er een hebt, anders hoe ver
              je medaillekast is. Iets dat over JOU gaat en niet over het spel. */}
          <div style={{ display: "flex" }}>
            {/* De pil houdt zijn eigen vorm: helemaal rond, geen afsnijding en
                geen glas. Alleen de opbouw van de lijst komt uit de skill. */}
            <NeonKader
              radius={999}
              dik={0.4}
              vulling="geen"
              binnen={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "3px 12px 3px 4px" }}
            >
              <HexArt maat={19}>
                <Crown size={9} color={GOUD[3]} />
              </HexArt>
              <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.ink, whiteSpace: "nowrap" }}>
                {account.title
                  ? t(`title_${account.title}`)
                  : t("badgesOf", { n: account.badges.length, m: PRESTATIES.length })}
              </span>
            </NeonKader>
          </div>

          {/* De vlag hoort hieronder, in dezelfde zeshoek als het kroontje. Hij
              verschijnt PAS als de art er is: zolang er geen bestand voor je
              land bestaat blijft dit leeg, want er hoeft niets van je gegevens
              op je profiel te staan. De <img> verbergt zichzelf bij een 404,
              dus er is geen lijst te onderhouden. */}
          <Vlag code={account.land} />

          </div>
          </div>

          {/* De balk loopt van onder de ring tot de andere kant van de sectie:
              hij hangt aan de sectie en niet aan de tekstkolom, dus hij staat
              buiten de rij hierboven. */}
          <XpRij level={account.level} />
          </div>
        </Paneel>

      </div>

      {/* Het formulier is er alleen als je erom vraagt. Zo blijft de kaart een
          vitrine en wordt hij geen instellingenscherm. */}
      {editOpen && (
        // Dezelfde lijst als om de secties, met de kleuren die rondlopen: het
        // paneel hoort bij de vitrine en niet bij een instellingenscherm.
        <NeonKader
          radius={16}
          vulling="geen"
          dik={0.35}
          lijn={KADER_LIJN_LOOP}
          gloed="none"
          animeer
          sterkte={0.55}
          style={{ marginInline: 5 }}
          binnen={{ display: "flex", flexDirection: "column", gap: 10, padding: 12 }}
        >
          {maakNaamEnKleur(() => setEditOpen(false))}
        </NeonKader>
      )}

      {fotoVeld}

      {/* statistieken */}
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <SierKop label={t("statsHeading").toUpperCase()} />
        <StatGrid stats={account.stats} />
      </div>

      {overlays}

      {/* club en titel zijn nu eigen tabs; laatste potjes + prestaties blijven hier */}

      {/* laatste potjes */}
      <HistoryCard game={game} meId={account.id} vitrine />

      {/* prestaties */}
      {/* De hele kast, niet alleen wat je al hebt: verdiend goud met een vinkje,
          de rest grijs met een teller. Ze staan naast elkaar en niet onder
          elkaar, want een verzameling toon je op een plank. Verdiend eerst,
          zodat je medailles leiden en het volgende doel er meteen achter staat. */}
      <NeonKader
        radius={18}
        vulling="geen"
        dik={0.35}
        lijn={KADER_LIJN_LOOP}
        gloed="none"
        animeer
        // De lijst om een sectie mag er nauwelijks zijn: hij bakent af en houdt
        // verder zijn mond. Wat erin staat is het onderwerp.
        sterkte={0.32}
        style={{ marginInline: 5 }}
        binnen={{ padding: "10px 11px 11px", display: "flex", flexDirection: "column", gap: 9 }}
      >
        <SectieKop
          label={t("badgesTitle").toUpperCase()}
          actie={prestatiesUit ? t("showLess") : t("showAll")}
          onActie={() => { sound.uiTap(); setPrestatiesUit((v) => !v); }}
        />
        {(() => {
          const behaald = new Set(account.badges.map((b) => b.badge));
          const lijst = [...PRESTATIES].sort((a, b) => Number(behaald.has(b.key)) - Number(behaald.has(a.key)));
          const zicht = prestatiesUit ? lijst : lijst.slice(0, 5);
          return (
            <div
              className="no-scrollbar"
              style={
                prestatiesUit
                  ? { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px 4px" }
                  : { display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }
              }
            >
              {zicht.map((p) => (
                <Prestatie
                  key={p.key}
                  icoon={<p.icoon size={24} />}
                  art={BADGE_ART.has(p.key) ? `/ui/badges/${p.key}.webp` : undefined}
                  naam={t(`badgeshort_${p.key}`)}
                  behaald={behaald.has(p.key)}
                  nu={p.nu ? p.nu(account.stats) : undefined}
                  doel={p.doel}
                />
              ))}
            </div>
          );
        })()}
      </NeonKader>

    </Fragment>
  );
}

// Title picker — the earnable cosmetic shown under your name. Unlocked titles
// are selectable (the chosen one is highlighted, tap again to clear back to the
// rank); locked ones show their requirement and can't be picked.
/** Pick your Draai-buzzer skin (bought in the shop). The default red one is
 *  always free; the pack skins are locked behind the 'buzzers' unlock. */
/** One selectable buzzer tile. `lockLabel` shows instead of the shop-lock icon
 *  for level rewards ("Level 30"); `caption` shows a reward name under it. */
function BuzzerTile({
  id,
  active,
  locked,
  lockLabel,
  caption,
  onClick,
  label,
}: {
  id: string | null;
  active: boolean;
  locked: boolean;
  lockLabel?: string;
  caption?: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <button
        onClick={() => { sound.uiTap(); onClick(); }}
        aria-label={label}
        className="pressable"
        style={{
          position: "relative",
          width: "100%",
          minWidth: 0,
          aspectRatio: "1 / 1",
          overflow: "hidden",
          borderRadius: 14,
          border: `2px solid ${active ? colors.gold : colors.panelBorder}`,
          background: withAlpha("#000000", 0.22),
          cursor: "pointer",
          padding: 6,
          boxSizing: "border-box",
          boxShadow: active ? `0 0 12px ${withAlpha(colors.gold, 0.5)}` : "none",
        }}
      >
        <img
          src={id ? `/buzzers/${id}.webp` : "/buzzer.webp"}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", opacity: locked ? 0.32 : 1, filter: locked ? "grayscale(0.55)" : "none" }}
        />
        {locked && (
          lockLabel ? (
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 5, textAlign: "center", fontFamily: font.ui, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, color: colors.gold, textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>
              {lockLabel}
            </span>
          ) : (
            <span style={{ position: "absolute", right: 5, bottom: 5, width: 20, height: 20, borderRadius: 7, display: "grid", placeItems: "center", background: withAlpha("#000000", 0.55), color: colors.gold }}>
              <Lock size={12} />
            </span>
          )
        )}
      </button>
      {caption && (
        <span style={{ fontFamily: font.ui, fontSize: 9.5, fontWeight: 600, color: locked ? colors.faint : colors.sub, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {caption}
        </span>
      )}
    </div>
  );
}

// Profielinstellingen used to be one very long scroll because every picker
// showed its whole grid at once. Each is a header you open when you actually
// want to change that thing.
function PickerCard({
  icon,
  title,
  children,
  defaultOpen,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: open ? 10 : 0, padding: 14 }}>
      <button
        onClick={() => { sound.uiTap(); setOpen((o) => !o); }}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left" }}
      >
        {icon}
        <span style={{ flex: 1, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{title}</span>
        <ChevronDown size={16} color={colors.faint} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }} />
      </button>
      {open && children}
    </Card>
  );
}

function BuzzerPicker({ game, onShowShop }: { game: GameApi; onShowShop: () => void }) {
  const { t } = useT();
  const account = game.state.account!;
  const ownedItems = new Set(account.owned_items ?? []);
  const anyOwned = ["bz01", "bz02", "bz03", "bz04", "bz05", "bz13", "bz14", "bz15", "bz16", "bz17"].some((id) => ownedItems.has(id));
  const active = account.buzzer_skin ?? null;
  const packSkins = ["bz01", "bz02", "bz03", "bz04", "bz05", "bz13", "bz14", "bz15", "bz16", "bz17"];
  const rewards = account.buzzer_rewards ?? [];

  return (
    <>
      {/* bought single skins */}
      <PickerCard icon={<KopArt src="/buzzer.webp" maat={22} gloed="226,64,52" />} title={t("buzzPickTitle")}>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5 }}>{anyOwned ? t("buzzPickHint") : t("buzzLockedHint")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <BuzzerTile id={null} active={active === null} locked={false} label={t("buzzDefault")} onClick={() => game.setBuzzerSkin(null)} />
          {packSkins.map((id) => {
            const has = ownedItems.has(id);
            return <BuzzerTile key={id} id={id} active={active === id} locked={!has} label={id} onClick={() => (has ? game.setBuzzerSkin(id) : onShowShop())} />;
          })}
        </div>
      </PickerCard>

      {/* level rewards */}
      <PickerCard icon={<KopArt src="/buzzers/bz06.webp" maat={22} />} title={t("buzzRewardsTitle")}>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5 }}>{t("buzzRewardsHint")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {rewards.map((r) => (
            <BuzzerTile
              key={r.skin}
              id={r.skin}
              active={active === r.skin}
              locked={!r.unlocked}
              lockLabel={t("buzzLevelLocked", { n: r.level })}
              caption={t(r.name)}
              label={t(r.name)}
              onClick={() => r.unlocked && game.setBuzzerSkin(r.skin)}
            />
          ))}
        </div>
      </PickerCard>
    </>
  );
}

// One reel-theme choice: a mini themed reel with the letter A (the real reel is
// code-drawn, so the preview is too).
// De voorbeelden hebben een VASTE maat, want de vorm van de rol is een `path()`
// en die rekent in echte pixels. Zonder vaste maat zou het voorbeeld een andere
// vorm tonen dan het spel.
/** Een klein plaatje als kopje boven een keuzesectie. */
function KopArt({ src, maat = 22, gloed = "232,168,23" }: { src: string; maat?: number; gloed?: string }) {
  return (
    <span aria-hidden style={{ position: "relative", width: maat, height: maat, flexShrink: 0, display: "inline-grid", placeItems: "center" }}>
      <span
        style={{
          position: "absolute", inset: "6%", borderRadius: "50%",
          background: `radial-gradient(closest-side, rgba(${gloed},.5) 0%, rgba(${gloed},.16) 58%, transparent 100%)`,
          filter: `blur(${Math.max(2, Math.round(maat / 5))}px)`,
        }}
      />
      <img src={src} alt="" style={{ position: "relative", width: maat, height: maat, objectFit: "contain", display: "block" }} />
    </span>
  );
}

/** Een rolletje van een letter als kopje: dezelfde opbouw als de echte rol,
 *  alleen dan zo klein dat er net een letter in past. */
function KopRol({ maat = 20 }: { maat?: number }) {
  const th = reelTheme(null);
  const knip = reelClip(maat, Math.round(maat * 1.16), 1.5);
  return (
    <span
      aria-hidden
      style={{
        width: maat, height: Math.round(maat * 1.16), padding: 1.5, flexShrink: 0,
        clipPath: knip.outer, background: reelEdge(th.ramp),
        boxShadow: `0 0 8px ${withAlpha(th.glow, 0.45)}`, display: "block",
      }}
    >
      <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", clipPath: knip.inner, background: th.bg, boxShadow: "inset 0 2px 6px rgba(0,0,0,.6)" }}>
        <span
          style={{
            fontFamily: font.display, fontWeight: 700, fontSize: Math.round(maat * 0.62), lineHeight: 1,
            backgroundImage: reelFace(th.ramp), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}
        >
          A
        </span>
      </span>
    </span>
  );
}

const TILE_REEL = { w: 62, h: 72, ...reelClip(62, 72) };

function ReelTile({ id, active, locked, label, onClick }: {
  id: string | null; active: boolean; locked: boolean; label: string; onClick: () => void;
}) {
  const th = reelTheme(id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <button
        onClick={() => { sound.uiTap(); onClick(); }}
        aria-label={label}
        className="pressable"
        style={{
          position: "relative", width: "100%", minWidth: 0, aspectRatio: "1 / 1",
          overflow: "hidden", borderRadius: 14,
          border: `2px solid ${active ? colors.gold : colors.panelBorder}`,
          background: withAlpha("#000000", 0.22), cursor: "pointer",
          display: "grid", placeItems: "center", boxSizing: "border-box",
          boxShadow: active ? `0 0 12px ${withAlpha(colors.gold, 0.5)}` : "none",
        }}
      >
        {/* Zelfde opbouw als de echte rol: de rand is een laag met het verloop
            eronder, en de letter draagt hetzelfde verloop. Anders belooft het
            keuzevakje iets anders dan je in het spel krijgt. */}
        <div
          style={{
            width: TILE_REEL.w, height: TILE_REEL.h, padding: 2,
            clipPath: TILE_REEL.outer,
            background: reelEdge(th.ramp),
            boxShadow: `0 0 10px ${withAlpha(th.glow, 0.4)}`,
            opacity: locked ? 0.35 : 1, filter: locked ? "grayscale(0.5)" : "none",
          }}
        >
          <div style={{ width: "100%", height: "100%", clipPath: TILE_REEL.inner, background: th.bg, boxShadow: "inset 0 3px 9px rgba(0,0,0,.6)", display: "grid", placeItems: "center" }}>
            <span
              style={{
                fontFamily: font.display, fontWeight: 700, fontSize: 26, lineHeight: 1,
                backgroundImage: reelFace(th.ramp),
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                textShadow: "-1px -1px 0 rgba(255,255,255,.3)",
              }}
            >
              A
            </span>
          </div>
        </div>
        {locked && (
          <span style={{ position: "absolute", right: 5, bottom: 5, width: 20, height: 20, borderRadius: 7, display: "grid", placeItems: "center", background: withAlpha("#000000", 0.55), color: colors.gold }}>
            <Lock size={12} />
          </span>
        )}
      </button>
      <span style={{ fontFamily: font.ui, fontSize: 9.5, fontWeight: 600, color: locked ? colors.faint : colors.sub, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
}

const REEL_PICKER_IDS = ["rs01", "rs02", "rs03", "rs04", "rs05", "rs06", "rs07", "rs08", "rs09"];
const REEL_NAME_KEYS: Record<string, string> = {
  rs01: "reelNeon", rs02: "reelVuur", rs03: "reelIjs", rs04: "reelCasino", rs05: "reelSmaragd",
  rs06: "reelRoyal", rs07: "reelCandy", rs08: "reelToxic", rs09: "reelMiddernacht",
};

function ReelPicker({ game, onShowShop }: { game: GameApi; onShowShop: () => void }) {
  const { t } = useT();
  const account = game.state.account!;
  const ownedItems = new Set(account.owned_items ?? []);
  const anyOwned = REEL_PICKER_IDS.some((id) => ownedItems.has(id));
  const active = account.reel_skin ?? null;

  return (
    <PickerCard icon={<KopRol maat={19} />} title={t("reelPickTitle")}>
      <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5 }}>{anyOwned ? t("reelPickHint") : t("reelLockedHint")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <ReelTile id={null} active={active === null} locked={false} label={t("reelDefault")} onClick={() => game.setReelSkin(null)} />
        {REEL_PICKER_IDS.map((id) => {
          const has = ownedItems.has(id);
          return <ReelTile key={id} id={id} active={active === id} locked={!has} label={t(REEL_NAME_KEYS[id])} onClick={() => (has ? game.setReelSkin(id) : onShowShop())} />;
        })}
      </div>
    </PickerCard>
  );
}

// One avatar-frame choice: previews the actual avatar inside the frame.
function FrameTile({
  active, locked, lockLabel, caption, label, onClick, children,
}: {
  active: boolean; locked: boolean; lockLabel?: string; caption?: string; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <button
        onClick={() => { sound.uiTap(); onClick(); }}
        aria-label={label}
        className="pressable"
        style={{
          position: "relative", width: "100%", minWidth: 0, aspectRatio: "1 / 1",
          overflow: "hidden", borderRadius: 14,
          border: `2px solid ${active ? colors.gold : colors.panelBorder}`,
          background: withAlpha("#000000", 0.22), cursor: "pointer",
          display: "grid", placeItems: "center", boxSizing: "border-box",
          boxShadow: active ? `0 0 12px ${withAlpha(colors.gold, 0.5)}` : "none",
        }}
      >
        <div style={{ opacity: locked ? 0.4 : 1, filter: locked ? "grayscale(0.5)" : "none" }}>{children}</div>
        {locked && (
          lockLabel ? (
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 5, textAlign: "center", fontFamily: font.ui, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, color: colors.gold, textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>{lockLabel}</span>
          ) : (
            <span style={{ position: "absolute", right: 5, bottom: 5, width: 20, height: 20, borderRadius: 7, display: "grid", placeItems: "center", background: withAlpha("#000000", 0.55), color: colors.gold }}><Lock size={12} /></span>
          )
        )}
      </button>
      {caption && (
        <span style={{ fontFamily: font.ui, fontSize: 9.5, fontWeight: 600, color: locked ? colors.faint : colors.sub, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{caption}</span>
      )}
    </div>
  );
}

// Avatar-frame picker (level rewards) — lives in Profielinstellingen.
function FramePicker({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account!;
  const active = account.avatar_frame ?? null;
  const rewards = account.frame_rewards ?? [];
  const av = { name: account.name, color: account.color, userId: account.id, hasAvatar: account.has_avatar, avatarVer: account.avatar_ver };
  return (
    <PickerCard icon={<KopArt src="/frames/fr01.webp" maat={23} gloed="240,190,60" />} title={t("framePickTitle")}>
      <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5 }}>{t("framePickHint")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <FrameTile active={active === null} locked={false} caption={t("frameNone")} label={t("frameNone")} onClick={() => game.setAvatarFrame(null)}>
          <Avatar {...av} size={52} />
        </FrameTile>
        {rewards.map((r) => (
          <FrameTile
            key={r.frame}
            active={active === r.frame}
            locked={!r.unlocked}
            lockLabel={t("frameLevelLocked", { n: r.level })}
            caption={t(r.name)}
            label={t(r.name)}
            onClick={() => r.unlocked && game.setAvatarFrame(r.frame)}
          >
            <Avatar {...av} size={52} frame={r.frame} />
          </FrameTile>
        ))}
      </div>
    </PickerCard>
  );
}

function TitlePicker({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  if (!account) return null;
  return (
    <PickerCard icon={<ArtIcoon naam="krans" size={20} />} title={t("titlesTitle")}>
      <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>{t("titlesHint")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {account.titles.map((tt) => {
          const active = account.title === tt.key;
          const locked = !tt.unlocked;
          return (
            <button
              key={tt.key}
              disabled={locked}
              onClick={() => {
                sound.uiTap();
                game.updateAccount({ title: active ? "" : tt.key });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 10,
                textAlign: "left",
                cursor: locked ? "default" : "pointer",
                background: active ? withAlpha(colors.gold, 0.14) : withAlpha("#000000", 0.2),
                border: `1px solid ${active ? withAlpha(colors.gold, 0.6) : colors.hairline}`,
                opacity: locked ? 0.5 : 1,
              }}
            >
              <span style={{ flex: 1, fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: active ? colors.gold : colors.ink }}>
                {t(`title_${tt.key}`)}
              </span>
              {locked ? (
                <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>{t(`titlereq_${tt.key}`)}</span>
              ) : active ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: colors.gold }}>
                  <Check size={13} strokeWidth={3} /> {t("titleActive")}
                </span>
              ) : (
                <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, color: colors.sub }}>{t("titleChoose")}</span>
              )}
            </button>
          );
        })}
      </div>
    </PickerCard>
  );
}

// Club screen — a friend group with its own leaderboard. Its own page (like the
// avatar picker) so the profile tab stays short. Two states: in a club (name,
// share code, season/all-time ranked members, leave) or not (create / join).
function ClubScreen({ game, onBack, embedded }: { game: GameApi; onBack?: () => void; embedded?: boolean }) {
  const { t } = useT();
  const account = game.state.account;
  const board = game.state.club;
  const club = account?.club ?? null;
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Het embleem kiezen is een LOSSE handeling die je een keer doet, dus dat
  // hoort niet als raster van zevenentwintig vakjes permanent op het scherm te
  // staan. Het gaat achter het potlood bij het embleem.
  const [emblemOpen, setEmblemOpen] = useState(false);
  const [naamOpen, setNaamOpen] = useState(false);
  const [nieuweNaam, setNieuweNaam] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    game.loadClub(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, club?.id]);

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
        <ArrowLeft size={20} />
      </button>
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("clubTitle")}
      </span>
    </div>
  );
  // Embedded (as the Club tab) skips its own Screen/header; the Hub provides those.
  const wrap = (body: React.ReactNode) => (embedded ? <Fragment key="club">{body}</Fragment> : <Screen top={header}>{body}</Screen>);

  // ---- not in a club: create or join ----
  if (!club) {
    return wrap(
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("clubIntroLong")}</p>
          </Card>
          {/* De twee keuzes staan in de sierlijst van het profiel. Die art heeft
              een VASTE verhouding, dus de inhoud voegt zich naar het paneel en
              niet andersom: de knoppen zijn een slag kleiner zodat opschrift,
              veld en knop samen binnen de lijst passen. Rekken zou de gouden
              hoeken vervormen, en dat zijn juist de stukken die je herkent. */}
          <Paneel>
            <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 9, paddingInline: 4 }}>
              <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>{t("clubCreateTitle")}</span>
              {/* Even breed als de knop eronder: een veld dat breder is dan wat
                  het bedient, leest als twee losse dingen in plaats van een paar. */}
              <input style={{ ...inputStyle, padding: "9px 12px", width: "min(100%, 232px)" }} placeholder={t("clubNamePlaceholder")} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
              <Button variant="gold" full compact disabled={name.trim().length < 2} onClick={() => { sound.uiTap(); game.createClub(name.trim()); }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={15} /> {t("clubCreateBtn")}</span>
              </Button>
            </div>
          </Paneel>
          <Paneel>
            <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 9, paddingInline: 4 }}>
              <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>{t("clubJoinTitle")}</span>
              <input
                style={{ ...inputStyle, padding: "9px 12px", width: "min(100%, 232px)", fontFamily: font.display, letterSpacing: 4, textAlign: "center", textTransform: "uppercase" }}
                placeholder={t("clubCodePlaceholder")}
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
              <Button variant="primary" full compact disabled={code.length < 6} onClick={() => { sound.uiTap(); game.joinClub(code); }}>{t("clubJoinBtn")}</Button>
            </div>
          </Paneel>
        </div>
    );
  }

  // ---- in a club: header + ranked members + leave ----
  const members = board?.members ?? [];

  // De deelkaart van de club. Waar de deelcode-pil de code naar je klembord
  // kopieert, maakt dit er een PLAATJE van: embleem, naam, code en de stand.
  // Dat is wat je in een groepsapp plakt, en dan hoeft niemand een losse regel
  // tekst te ontcijferen.
  const shareClub = async () => {
    if (!club || sharing) return;
    setSharing(true);
    try {
      const blob = await makeClubCard({
        name: club.name,
        emblemSrc: club.emblem ? `/emblems/${club.emblem}.webp` : "/logo-klein.webp",
        code: club.code,
        membersText: (club.member_count === 1 ? t("clubMembersOne") : t("clubMembersN", { n: club.member_count })),
        periodText: period === "month" ? t("seasonChip") : t("allTime"),
        joinText: t("clubShareJoin"),
        rows: members.slice(0, 5).map((m) => ({
          name: m.name,
          points: m.points,
          games: m.games,
          color: m.color,
          avatarUrl: m.has_avatar ? `/api/avatar/${m.id}?v=${m.avatar_ver}` : null,
        })),
        footer: t("footer"),
      });
      if (blob) await shareOrDownload(blob, "penneer-club.png");
    } finally {
      setSharing(false);
    }
  };

  const shareCode = () => {
    try { navigator.clipboard?.writeText(club.code); } catch { /* ignore */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Paneel>
          {/* Delen zit in de hoek van de sectie die hij deelt, net als op je
              profiel. Kaal, want de sierlijst is hier de omlijsting. */}
          <DeelKnop
            label={t("clubShare")}
            bezig={sharing}
            onClick={() => { sound.uiTap(); shareClub(); }}
            style={{ position: "absolute", right: 2, top: -2, zIndex: 2 }}
          />
          <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 6, paddingInline: 4 }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <ClubEmblem id={club.emblem} size={58} />
            {club.is_owner && (
              <PotloodKnop
                aan={emblemOpen}
                label={t("clubEmblemTitle")}
                onClick={() => { sound.uiTap(); setEmblemOpen(true); }}
                style={{ position: "absolute", right: -6, bottom: -2 }}
              />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: "100%" }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, color: colors.ink, textAlign: "center", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{club.name}</span>
            {club.is_owner && (
              <PotloodKnop
                aan={naamOpen}
                label={t("clubNamePlaceholder")}
                onClick={() => { sound.uiTap(); setNieuweNaam(club.name); setNaamOpen((v) => !v); }}
              />
            )}
          </div>
          {naamOpen ? (
            // Dezelfde balk als bij je eigen naam: een neonkader met een klein
            // vinkje dat zichzelf sluit zodra je bewaart.
            <NeonKader
              radius={999}
              dik={0.45}
              vulling="geen"
              animeer
              binnen={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 4px 3px 12px" }}
            >
              <input
                autoFocus
                value={nieuweNaam}
                maxLength={24}
                onChange={(e) => setNieuweNaam(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && nieuweNaam.trim().length >= 2) { game.renameClub(nieuweNaam.trim()); setNaamOpen(false); } }}
                style={{ flex: 1, minWidth: 0, width: 150, background: "transparent", border: "none", outline: "none", color: colors.ink, fontFamily: font.ui, fontSize: 13.5 }}
              />
              <button
                onClick={() => { sound.uiTap(); if (nieuweNaam.trim().length >= 2) game.renameClub(nieuweNaam.trim()); setNaamOpen(false); }}
                aria-label={t("save")}
                disabled={nieuweNaam.trim().length < 2}
                style={{ width: 22, height: 22, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", border: "none", background: withAlpha(GOUD[2], 0.9), color: colors.bg0, cursor: "pointer", padding: 0 }}
              >
                <Check size={13} strokeWidth={3} />
              </button>
            </NeonKader>
          ) : (
            <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.sub }}>{(club.member_count === 1 ? t("clubMembersOne") : t("clubMembersN", { n: club.member_count }))}</span>
          )}
          {/* De deelcode in dezelfde pil als de prestatieteller op je profiel:
              helemaal rond, geen glas, alleen de neonlijn. */}
          <NeonKader
            radius={999}
            dik={0.4}
            vulling="geen"
            binnen={{ display: "inline-flex", alignItems: "center", padding: 0 }}
          >
            <button
              onClick={shareCode}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 13px", background: "transparent", border: "none", cursor: "pointer" }}
            >
              <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>{t("clubCodeLabel")}</span>
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, letterSpacing: 3, color: colors.gold }}>{club.code}</span>
              {copied ? <Check size={14} color={colors.green} /> : <Copy size={14} color={colors.sub} />}
            </button>
          </NeonKader>
          </div>
        </Paneel>

        <PeriodeKnoppen
          actief={period}
          onKies={setPeriod}
          opties={[
            { key: "month" as const, label: t("seasonChip") },
            { key: "all" as const, label: t("allTime") },
          ]}
        />

        <Card style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 7px 14px" }}>
          {members.length === 0 && <p style={{ margin: 0, paddingInline: 6, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("clubEmptyBoard")}</p>}
          <Lijst n={members.length} toon={5}>
            {members.map((m, i) => {
              const mine = account && m.id === account.id;
              return (
                <GlasRij key={m.id}>
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, color: i === 0 ? colors.gold : colors.faint, width: 18, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                  <Avatar name={m.name} color={m.color} size={30} crown={m.is_owner} userId={m.id} hasAvatar={!!m.has_avatar} avatarVer={m.avatar_ver} divisie={m.divisie} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name}{mine && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
                  </span>
                  <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint, flexShrink: 0 }}>{t("clubGamesN", { n: m.games })}</span>
                  <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 16, color: i === 0 ? colors.gold : colors.ink, minWidth: 38, textAlign: "right" }}>{m.points}</span>
                </GlasRij>
              );
            })}
          </Lijst>
        </Card>

        {/* nodig vrienden uit voor de club (echte inbox-uitnodiging) */}
        <InviteToClub game={game} memberIds={new Set(members.map((m) => m.id))} />

        {confirmLeave ? (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{club.is_owner ? t("clubLeaveOwnerWarn") : t("clubLeaveWarn")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" full onClick={() => setConfirmLeave(false)}>{t("cancelCorrection")}</Button>
              <Button variant="danger" full onClick={() => { sound.uiTap(); game.leaveClub(); setConfirmLeave(false); }}>{t("clubLeaveBtn")}</Button>
            </div>
          </Card>
        ) : (
          // Zo breed als zijn eigen tekst en niet zo breed als de sectie: een
          // knop die iets ongedaan maakt hoort niet net zo groot te zijn als de
          // knoppen waarmee je iets doet.
          <div style={{ display: "flex", justifyContent: "center" }}>
            <NeonKader radius={999} dik={0.5} vulling="zwart" animeer lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
              <button
                onClick={() => setConfirmLeave(true)}
                className="pressable"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
              >
                <LogOut size={14} /> {t("clubLeaveBtn")}
              </button>
            </NeonKader>
          </div>
        )}

        {emblemOpen && (
          <div
            onClick={() => setEmblemOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,3,18,.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 18 }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360 }}>
            <Card style={{ maxHeight: "78vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{t("clubEmblemTitle")}</span>
                <button onClick={() => setEmblemOpen(false)} aria-label={t("close")} style={{ background: "transparent", border: "none", color: colors.faint, cursor: "pointer", display: "flex", padding: 2 }}>
                  <X size={17} />
                </button>
              </div>
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5 }}>{t("clubEmblemHint")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {CLUB_EMBLEM_IDS.map((id) => {
                  const active = (club.emblem ?? CLUB_EMBLEM_IDS[0]) === id;
                  return (
                    <button
                      key={id}
                      onClick={() => { sound.uiTap(); game.setClubEmblem(id); setEmblemOpen(false); }}
                      aria-label={id}
                      className="pressable"
                      style={{
                        aspectRatio: "1 / 1", minWidth: 0, padding: 4, borderRadius: 12, cursor: "pointer",
                        display: "grid", placeItems: "center", boxSizing: "border-box",
                        border: `2px solid ${active ? colors.gold : colors.panelBorder}`,
                        background: withAlpha("#000000", 0.22),
                        boxShadow: active ? `0 0 12px ${withAlpha(colors.gold, 0.5)}` : "none",
                      }}
                    >
                      <ClubEmblem id={id} size={40} />
                    </button>
                  );
                })}
              </div>
            </Card>
            </div>
          </div>
        )}
      </div>
  );
}

/** Het potloodje dat naast iets staat wat je mag aanpassen. Klein: even hoog
 *  als de regel ernaast, want een knop die boven en onder de tekst uitsteekt
 *  maakt van die tekst een bijschrift bij de knop, en het is andersom. */
/** Het deel-icoon, kaal. Geen zeshoekige plaat eronder.
 *
 *  Waarom kaal: dit knopje staat IN een sectie, boven op de sierlijst, en die
 *  lijst is zelf al de omlijsting. Een plaat erbij is een tweede kader om
 *  hetzelfde ding. De platen blijven voor de bovenbalk, waar niets omheen zit.
 *
 *  Wel een halo eronder, want een goudkleurig lijnicoon op donker paars valt
 *  weg: alle vorm zit in de lijn, en die is daar bijna even donker. */
function DeelKnop({ label, bezig, onClick, style }: { label: string; bezig?: boolean; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      disabled={bezig}
      aria-label={label}
      title={label}
      className={bezig ? undefined : "pressable"}
      style={{
        position: "relative",
        width: 30,
        height: 30,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        border: "none",
        background: "transparent",
        color: GOUD[2],
        cursor: bezig ? "default" : "pointer",
        opacity: bezig ? 0.45 : 1,
        padding: 0,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 3,
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${withAlpha(GOUD[2], 0.34)}, transparent 72%)`,
          filter: "blur(5px)",
        }}
      />
      <Share2 size={16} style={{ position: "relative" }} />
    </button>
  );
}

function PotloodKnop({ aan, label, onClick, style }: { aan?: boolean; label: string; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-expanded={aan}
      className="pressable"
      style={{
        width: 19, height: 19, flexShrink: 0, display: "grid", placeItems: "center",
        borderRadius: 6, border: `1px solid ${withAlpha(GOUD[2], aan ? 0.9 : 0.45)}`,
        background: aan ? withAlpha(GOUD[2], 0.22) : "rgba(0,0,0,.42)",
        color: GOUD[2], cursor: "pointer", padding: 0, ...style,
      }}
    >
      <Pencil size={11} />
    </button>
  );
}

// Tab wrapper: the club content without its own Screen/header.
function ClubTab({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account;
  if (!account) return <Card><p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.faint, lineHeight: 1.5 }}>{t("makeProfileHint")}</p></Card>;
  return <ClubScreen game={game} embedded />;
}

// Invite accepted friends who are not already in the club — a real inbox invite.
function InviteToClub({ game, memberIds }: { game: GameApi; memberIds: Set<string> }) {
  const { t } = useT();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  useEffect(() => { game.refreshFriends(); /* eslint-disable-next-line */ }, []);
  const candidates = game.state.friends.filter((f) => f.status === "accepted" && !memberIds.has(f.id));
  if (candidates.length === 0) return null;
  const searchable = candidates.length > 3;
  const shown = q.trim() ? candidates.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())) : candidates;
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 6, padding: "11px 7px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 30, paddingInline: 6 }}>
        <span style={{ flex: 1, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>
          <UserPlus size={14} /> {t("clubInviteTitle")}
        </span>
        {searchable && <ZoekKnop waarde={q} onWaarde={setQ} />}
      </div>
      <Lijst n={shown.length} rij={38} toon={3}>
        {shown.map((f) => (
          <GlasRij key={f.id} dun>
            <Avatar name={f.name} color={f.color} size={28} userId={f.id} hasAvatar={f.has_avatar} avatarVer={f.avatar_ver} divisie={f.divisie} />
            <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 13.5, color: colors.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            {sent[f.id] ? (
              <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.green }}>{t("inviteSentShort")}</span>
            ) : (
              <KnopPlaat breed={88} onClick={() => { game.clubInvite(f.id); setSent((s) => ({ ...s, [f.id]: true })); }} label={t("clubInviteBtn")} />
            )}
          </GlasRij>
        ))}
      </Lijst>
    </Card>
  );
}

// Avatar picker — its own page so the profile tab stays short.
function AvatarGrid({
  ids,
  current,
  busy,
  isLocked,
  onPick,
}: {
  ids: string[];
  current: string | null;
  busy: boolean;
  isLocked?: (id: string) => boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {ids.map((id) => {
        const active = current === id;
        const locked = isLocked?.(id) ?? false;
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            disabled={busy}
            aria-label={id}
            style={{
              position: "relative",
              padding: 0,
              border: `2px solid ${active ? colors.gold : "transparent"}`,
              borderRadius: 16,
              overflow: "hidden",
              cursor: "pointer",
              aspectRatio: "1 / 1",
              background: "transparent",
              opacity: busy ? 0.6 : 1,
              boxShadow: active ? `0 0 12px ${withAlpha(colors.gold, 0.55)}` : "none",
            }}
          >
            <img
              src={`/avatars/${id}.jpg?v=${AVATAR_ART_VERSION}`}
              alt={id}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: locked ? "grayscale(0.7) brightness(0.62)" : "none" }}
            />
            {locked && (
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff" }}>
                <Lock size={18} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.7))" }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Tap-your-avatar menu: change it (photo or preset) or remove a custom photo.
 *  The question lives on the avatar itself; options mirror the old buttons. */
function AvatarMenu({
  hasCustomPhoto,
  onPhoto,
  onPreset,
  onRemove,
  onClose,
}: {
  hasCustomPhoto: boolean;
  onPhoto: () => void;
  onPreset: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: `1px solid ${colors.panelBorder}`,
    background: withAlpha("#000000", 0.22),
    color: colors.ink,
    fontFamily: font.ui,
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left" as const,
  };
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(6,3,18,.72)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 22 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-in"
        style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 10, padding: "22px 18px 16px", borderRadius: 22, background: "linear-gradient(180deg, #241738, #160D30)", border: `1px solid ${withAlpha(colors.gold, 0.4)}`, boxShadow: "0 24px 70px rgba(0,0,0,.6)", textAlign: "center" }}
      >
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.ink }}>{t("avatarMenuTitle")}</span>
        <p style={{ margin: "0 0 4px", fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t("avatarMenuQuestion")}</p>
        <button onClick={onPhoto} className="pressable" style={row}>
          <Camera size={17} color={colors.gold} /> {t("uploadPhoto")}
        </button>
        <button onClick={onPreset} className="pressable" style={row}>
          <Smile size={17} color={colors.gold} /> {t("chooseAvatar")}
        </button>
        {hasCustomPhoto && (
          <button onClick={onRemove} className="pressable" style={{ ...row, color: colors.red, border: `1px solid ${withAlpha(colors.red, 0.4)}` }}>
            <Trash2 size={17} /> {t("removePhoto")}
          </button>
        )}
        <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 13.5, padding: "6px 4px 2px" }}>
          {t("avatarMenuCancel")}
        </button>
      </div>
    </div>
  );
}


function AvatarPickerScreen({
  current,
  ownedItems,
  busy,
  onBack,
  onShowShop,
  onPick,
}: {
  current: string | null;
  ownedItems: string[];
  busy: boolean;
  onBack: () => void;
  onShowShop: () => void;
  onPick: (id: string) => void;
}) {
  const { t } = useT();
  const ownedPacks = new Set(ownedItems);
  const canPick = (id: string) => ownedPacks.has(PACK_OF_PRESET[id]);
  const allPremiumOwned = ownedPacks.has("avpack1") && ownedPacks.has("avpack2");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("chooseAvatarTitle")}</span>
      </div>
      <Card>
        <AvatarGrid ids={AVATAR_PRESETS} current={current} busy={busy} onPick={onPick} />
      </Card>

      {/* Premium pack: unlocked -> pickable; locked -> greyed with a shop nudge. */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ArtIcoon naam="sterren" size={19} />
          <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>{t("pickerPremiumLabel")}</span>
        </div>
        <AvatarGrid
          ids={PREMIUM_AVATAR_PRESETS}
          current={current}
          busy={busy}
          isLocked={(id) => !canPick(id)}
          onPick={(id) => (canPick(id) ? onPick(id) : onShowShop())}
        />
        {!allPremiumOwned && (
          <>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("pickerPremiumLocked")}</p>
            <Button variant="gold" full onClick={onShowShop}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <ShoppingCart size={16} /> {t("pickerToShop")}
              </span>
            </Button>
          </>
        )}
      </Card>
    </>
  );
}

// Profile settings: email linking, blocked players and account management,
// grouped in one sub-screen behind the "Profielinstellingen" button.
/** Instellingen voor vrienden en club.
 *
 *  Het tandwiel op de vriendenpagina bracht je naar je PROFIEL-instellingen, en
 *  dat is een ander onderwerp: daar staat je avatar en je wachtwoord. Wat je
 *  hier zoekt gaat over de mensen om je heen, dus dat heeft nu een eigen
 *  scherm.
 *
 *  De twee schakelaars zijn wat een club echt nodig heeft: een club groeit door
 *  zijn leden, dus uitnodigen staat standaard open; de naam en het embleem zijn
 *  de identiteit, dus die staan standaard dicht. Alleen de eigenaar kan eraan
 *  draaien, en wie dat niet is ziet ze grijs met de reden erbij. */
function SocialSettings({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const club = account?.club ?? null;
  const eigenaar = !!club?.is_owner;
  // De ledenlijst komt uit de clubranglijst; die is er toch al en bevat precies
  // wie erin zit. Jezelf eruit: je kunt jezelf niet wegsturen.
  const leden = (game.state.club?.members ?? []).filter((m) => m.id !== account?.id);

  useEffect(() => {
    if (account) game.loadClub("month");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zet = (invite: boolean, rename: boolean) => {
    sound.uiTap();
    game.clubRegels(invite, rename);
  };

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
            <ArrowLeft size={20} />
          </button>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("clubSettings")}</span>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>
        {club ? (
          <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SierKop label={club.name} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: eigenaar ? 1 : 0.6 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("clubOpenInvite")}</span>
                <span style={{ display: "block", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.45 }}>{t("clubOpenInviteHint")}</span>
              </span>
              <Toggle on={!!club.open_invite} onChange={(v) => eigenaar && zet(v, !!club.open_rename)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: eigenaar ? 1 : 0.6 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("clubOpenRename")}</span>
                <span style={{ display: "block", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.45 }}>{t("clubOpenRenameHint")}</span>
              </span>
              <Toggle on={!!club.open_rename} onChange={(v) => eigenaar && zet(!!club.open_invite, v)} />
            </div>
            {!eigenaar && (
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.orange, lineHeight: 1.45 }}>{t("clubOwnerOnly")}</p>
            )}
          </Card>
        ) : null}

        {/* Ledenbeheer, alleen voor de eigenaar. Iemand wegsturen en de club
            overdragen zijn de twee dingen die je nergens anders kon: zonder het
            tweede kun je er zelf niet uit zonder de club op te heffen. */}
        {club && eigenaar && leden.length > 0 && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 7px 14px" }}>
            <SierKop label={t("clubMembersTitle")} />
            <Lijst n={leden.length} rij={46} toon={5}>
              {leden.map((m) => (
                <GlasRij key={m.id} dun>
                  <Avatar name={m.name} color={m.color} size={28} crown={m.is_owner} userId={m.id} hasAvatar={!!m.has_avatar} avatarVer={m.avatar_ver} divisie={m.divisie} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  <button
                    onClick={() => { if (window.confirm(t("clubTransferConfirm", { naam: m.name }))) { sound.uiTap(); game.clubOverdragen(m.id); } }}
                    aria-label={t("clubTransfer")}
                    title={t("clubTransfer")}
                    className="pressable"
                    style={{ width: 26, height: 26, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 8, border: `1px solid ${withAlpha(GOUD[2], 0.45)}`, background: "rgba(0,0,0,.34)", color: GOUD[2], cursor: "pointer", padding: 0 }}
                  >
                    <Crown size={13} />
                  </button>
                  <button
                    onClick={() => { if (window.confirm(t("clubKickConfirm", { naam: m.name }))) { sound.uiTap(); game.clubKick(m.id); } }}
                    aria-label={t("clubKick")}
                    title={t("clubKick")}
                    className="pressable"
                    style={{ width: 26, height: 26, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 8, border: `1px solid ${withAlpha(colors.red, 0.5)}`, background: "rgba(0,0,0,.34)", color: colors.red, cursor: "pointer", padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                </GlasRij>
              ))}
            </Lijst>
          </Card>
        )}

        {!club && (
          <Card>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.5 }}>{t("clubNoneHint")}</p>
          </Card>
        )}

      </div>
    </Screen>
  );
}

/** Wie je hebt geblokkeerd, met de knop om dat terug te draaien.
 *
 *  Stond hier bij vrienden en club, maar dit gaat over JOU en niet over de
 *  groep: het is de enige lijst op dit scherm die niemand anders aangaat. Nu
 *  staat hij bij de rest van je eigen instellingen. */
function BlokkeerKaart({ game }: { game: GameApi }) {
  const { t } = useT();
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8, padding: "13px 7px 14px" }}>
      <SierKop label={t("blockedTitle")} />
      {game.state.blocked.length === 0 ? (
        <p style={{ margin: "6px 0 0", paddingInline: 8, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("noBlocked")}</p>
      ) : (
        <Lijst n={game.state.blocked.length} rij={44} toon={5}>
          {game.state.blocked.map((b) => (
            <GlasRij key={b.id} dun>
              <Avatar name={b.name} color={b.color} size={28} userId={b.id} hasAvatar={b.has_avatar} avatarVer={b.avatar_ver} divisie={b.divisie} />
              <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
              <KnopPlaat breed={86} onClick={() => { sound.uiTap(); game.friendBlock(b.id, true); }} label={t("unblockBtn")} />
            </GlasRij>
          ))}
        </Lijst>
      )}
    </Card>
  );
}

/** Meldingen aan- of uitzetten. De browser laat toestemming niet intrekken via
 *  code, dus zodra iemand ze uit heeft staan kunnen wij alleen nog uitleggen
 *  waar hij ze terug aanzet. Een schakelaar die doet alsof hij dat wel kan is
 *  erger dan geen schakelaar. */
function MeldingenKaart() {
  const { t } = useT();
  const kan = typeof window !== "undefined" && "Notification" in window;
  const [staat, setStaat] = useState<NotificationPermission | "none">(kan ? Notification.permission : "none");
  const aan = staat === "granted";

  const zetAan = () => {
    if (!kan) return;
    sound.uiTap();
    Notification.requestPermission().then((perm) => {
      setStaat(perm);
      if (perm === "granted") void ensurePushSubscription();
    });
  };

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("notifTitle")}</span>
        {aan ? (
          <span style={{ fontFamily: font.ui, fontSize: 12.5, fontWeight: 700, color: colors.green }}>{t("notifOn")}</span>
        ) : staat === "denied" ? (
          <span style={{ fontFamily: font.ui, fontSize: 12.5, fontWeight: 700, color: colors.faint }}>{t("notifBlocked")}</span>
        ) : (
          <KnopPlaat breed={92} onClick={zetAan} label={t("notifEnable")} />
        )}
      </div>
      <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>
        {staat === "denied" ? t("notifBlockedHint") : t("notifSettingsHint")}
      </p>
    </Card>
  );
}

/** Je divisie in het klein, met de ladder een tik verderop. */
function DivisieKaart({ game }: { game: GameApi }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const divisie = Math.max(0, SCHILD_KLEUREN.indexOf((game.state.account?.shield as SchildKleur) || "paars"));
  return (
    <>
      <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Schild divisie={divisie} maat={34} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("divisieTitle")}</span>
          <span style={{ display: "block", fontFamily: font.ui, fontSize: 12.5, color: `rgb(${DIVISIE_ACCENT[divisie]})` }}>{divisieNaam(divisie)}</span>
        </span>
        <KnopPlaat breed={86} onClick={() => { sound.uiTap(); game.divisieStand(); setOpen(true); }} label={t("divisieBekijk")} />
      </Card>
      {open && <DivisieLadder divisie={divisie} stand={game.state.divisieStand} onClose={() => setOpen(false)} />}
    </>
  );
}

/* De vlag van je land, in dezelfde zeshoek als het kroontje erboven.
 *
 * Hij tekent zichzelf alleen als `/vlaggen/<code>.webp` echt bestaat. Faalt het
 * laden, dan haalt hij zichzelf weg. Zo staat er niets op je profiel zolang de
 * art er niet is, en verschijnt de vlag vanzelf zodra hij wordt toegevoegd. */
/** De landcode als vlag-emoji: twee regionale-indicatortekens. Het systeem
 *  tekent hem zelf, dus dit werkt voor ELK land, ook de paar die niet in het
 *  vlaggenvel zitten (Aruba, Curaçao). Op deze maat zie je het verschil met de
 *  art niet, en dat is precies waarom dit een prima terugval is. */
function vlagEmoji(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((l) => 0x1f1e6 + l.charCodeAt(0) - 65));
}

function VlagIcoon({ code, maat = 18 }: { code: string; maat?: number }) {
  const [er, setEr] = useState(false);
  if (er) {
    return <span style={{ fontSize: Math.round(maat * 0.95), lineHeight: 1, display: "block" }}>{vlagEmoji(code)}</span>;
  }
  return (
    <img
      src={`/vlaggen/${code}.webp`}
      alt=""
      onError={() => setEr(true)}
      style={{ width: maat, height: Math.round(maat * 0.78), objectFit: "contain", display: "block" }}
    />
  );
}

function Vlag({ code }: { code?: string | null }) {
  // Geen eigen foutstaat meer: VlagIcoon valt zelf terug op het vlag-emoji, dus
  // hier hoeft alleen bepaald te worden OF er een land is.
  const c = (code || "").toUpperCase();
  if (!c) return null;
  return (
    // Geen zeshoek: de vlag is zelf al een vorm. Hij ligt TEGEN de titelpil aan,
    // op dezelfde verticale lijn als de kroontjes-zeshoek erboven: de pil heeft
    // links 4px lucht en de zeshoek is 19 breed, dus met deze marge valt het
    // hart van de vlag op het hart van de zeshoek. Geen ruimte ertussen, anders
    // zweeft hij los onder de balk in plaats van eraan te hangen.
    <div style={{ display: "flex", marginTop: 1, marginLeft: 4 }}>
      <VlagIcoon code={c} maat={22} />
    </div>
  );
}

/* De landknop. Hij staat standaard op Nederland, want daar begon de app en een
 * leeg vakje is geen keuze. Tikken opent een lijst met alle landen, met een
 * zoekveld erboven omdat honderdzestig rijen scrollen geen menu is.
 *
 * Wat je kiest gaat naar de server, en die doet er twee dingen mee: de
 * advertenties worden persoonlijker, en de draaiknop van JOUW land gaat open om
 * met coins te kopen in plaats van met cash. */
function LandKnop({ game }: { game: GameApi }) {
  const { t } = useT();
  const account = game.state.account!;
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  const huidig = (account.land || "NL").toUpperCase();

  const lijst = zoek.trim()
    ? LANDEN.filter((l) => l.naam.toLowerCase().includes(zoek.trim().toLowerCase()))
    : LANDEN;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("landTitel")}</span>
        <button
          onClick={() => { sound.uiTap(); setZoek(""); setOpen(true); }}
          className="pressable"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: withAlpha(colors.gold, 0.12),
            border: `1px solid ${withAlpha(colors.gold, 0.42)}`,
            borderRadius: 999, cursor: "pointer", padding: "6px 12px",
            fontFamily: font.display, fontWeight: 700, fontSize: 13.5, color: colors.gold,
          }}
        >
          <VlagIcoon code={huidig} maat={20} />
          {landNaam(huidig)}
        </button>
      </div>
      <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("landUitleg")}</p>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(6,3,18,.72)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 18 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 360, maxHeight: "78vh", display: "flex", flexDirection: "column",
              // Een popup heeft zijn EIGEN dichte bodem nodig: de sectie-stijl is
              // doorzichtig, en dan lees je de lijst door de pagina heen.
              background: "linear-gradient(180deg, #1B1230 0%, #120B22 100%)",
              border: `1px solid ${withAlpha(colors.gold, 0.32)}`,
              boxShadow: `0 24px 60px rgba(0,0,0,.6), inset 0 1px 0 ${withAlpha(colors.gold, 0.18)}`,
              borderRadius: 20, padding: 16,
            }}
          >
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink, marginBottom: 10 }}>{t("landTitel")}</span>
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder={t("landZoek")}
            style={{
              width: "100%", boxSizing: "border-box", marginBottom: 10,
              background: withAlpha(colors.ink, 0.06),
              border: `1px solid ${withAlpha(colors.gold, 0.3)}`,
              borderRadius: 999, padding: "10px 14px",
              fontFamily: font.ui, fontSize: 14, color: colors.ink, outline: "none",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "58vh", overflowY: "auto" }}>
            {lijst.map((l) => {
              const gekozen = l.code === huidig;
              return (
                <button
                  key={l.code}
                  onClick={() => { sound.uiTap(); game.setLand(l.code); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    background: gekozen ? withAlpha(colors.gold, 0.14) : "transparent",
                    border: `1px solid ${gekozen ? withAlpha(colors.gold, 0.4) : "transparent"}`,
                    borderRadius: 12, padding: "10px 12px", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ minWidth: 24, display: "flex", justifyContent: "center" }}><VlagIcoon code={l.code} maat={22} /></span>
                  <span style={{ flex: 1, fontFamily: font.ui, fontSize: 14, color: gekozen ? colors.gold : colors.ink }}>{l.naam}</span>
                  {gekozen && <Check size={16} color={colors.gold} />}
                </button>
              );
            })}
          </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Profielinstellingen: alles wat over JOU gaat en niet op je profiel hoort te
 *  staan omdat anderen het toch niet zien.
 *
 *  Hij hangt niet meer onder een tandwiel op het profiel maar onder Instellingen
 *  op de main page. Dat is waar iemand instellingen zoekt, en het scheelt drie
 *  tandwielen die op elke pagina iets anders betekenden. Daarom staat hij ook op
 *  eigen benen: eigen e-mailveld, eigen ophaalronde voor de blokkeerlijst.
 *
 *  Eigen `Screen` (veilige zone, marge, scrollen), want hij wordt op het hoogste
 *  niveau getekend en niet binnen een ander scherm. */
export function ProfileSettings({
  game,
  onShowShop,
  onBack,
}: {
  game: GameApi;
  onShowShop: () => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const account = game.state.account!;
  const [pw, setPw] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    game.refreshBlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
        <ArrowLeft size={20} />
      </button>
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("profileSettings")}</span>
    </div>
  );
  return (
    <Screen top={header}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Waar je vandaan speelt. Het staat NERGENS op je profiel: het is een
          instelling, geen persoonsgegeven dat je aan anderen laat zien. */}
      <LandKnop game={game} />

      {/* soepele spelling (dyslexie-hulp) voor Oefenen + Dagronde */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("lenientTitle")}</span>
          <Toggle on={!!account.lenient_spelling} onChange={(v) => { sound.uiTap(); game.setLenient(v); }} />
        </div>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("lenientHint")}</p>
      </Card>

      {/* Draai-knop-skin (shop 'buzzers' pack) */}
      <BuzzerPicker game={game} onShowShop={onShowShop} />

      <ReelPicker game={game} onShowShop={onShowShop} />

      {/* Avatar-frame (level-beloning) */}
      <FramePicker game={game} />

      {/* Titel: hoorde bij de tabs, die zijn weg, dus hij staat nu hier */}
      <TitlePicker game={game} />

      {/* Meldingen. Stond alleen in de balk die één keer langskwam; wie hem
          toen wegtikte kon ze nergens meer aanzetten. */}
      <MeldingenKaart />

      {/* Je divisie: hier staat wat het schild om je portret betekent, met de
          hele ladder erachter. Het is geen keuze meer, dus het is geen kiezer. */}
      <DivisieKaart game={game} />

      {/* e-mail koppelen */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("emailTitle")}</span>
        {account.email ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
            {t("emailLinked")} <span style={{ color: colors.green }}>{account.email}</span>
          </p>
        ) : (
          <>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>{t("emailHint")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button variant="ghost" disabled={!email.includes("@")} onClick={() => game.linkEmail(email)}>
                {t("linkEmailBtn")}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* wachtwoord instellen / wijzigen */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{t("passwordTitle")}</span>
        {account.has_password ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
            {t("passwordActive")} <span style={{ color: colors.green }}>&#10003;</span>
          </p>
        ) : (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint, lineHeight: 1.5 }}>
            {account.email ? t("passwordSetHint") : t("passwordNeedEmailHint")}
          </p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} type="password" autoComplete="new-password" placeholder={t("passwordPlaceholder")} value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button variant="ghost" disabled={pw.length < 6} onClick={() => { game.setPassword(pw); setPw(""); }}>
            {account.has_password ? t("passwordChangeBtn") : t("passwordSetBtn")}
          </Button>
        </div>
      </Card>

      {/* Wie je hebt geblokkeerd. Stond bij vrienden en club, maar dat is een
          lijst over jou en niet over de groep. */}
      <BlokkeerKaart game={game} />

      {/* beheer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="ghost" full onClick={game.logoutAccount}>{t("logoutProfile")}</Button>
        <button
          onClick={() => window.confirm(t("deleteConfirm")) && game.deleteAccount()}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.red, fontFamily: font.ui, fontSize: 13, padding: 6 }}
        >
          {t("deleteAccount")}
        </button>
      </div>
      </div>
    </Screen>
  );
}

// Crop editor: square viewport, pinch-free zoom slider + drag to position.
// Renders the visible square to a 256px JPEG.
function AvatarEditor({ file, onDone }: { file: File; onDone: (blob: Blob | null) => void }) {
  const { t } = useT();
  const V = 260; // viewport size in css px
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => onDone(null);
    i.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const base = img ? V / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : V;
  const h = img ? img.naturalHeight * scale : V;
  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(V - w, x)),
    y: Math.min(0, Math.max(V - h, y)),
  });
  const pos = clamp(off.x, off.y);

  // Keep the viewport center anchored while zooming.
  function changeZoom(z: number) {
    if (!img) return;
    const oldScale = scale;
    const newScale = base * z;
    const cx = (V / 2 - pos.x) / oldScale;
    const cy = (V / 2 - pos.y) / oldScale;
    setZoom(z);
    setOff({ x: V / 2 - cx * newScale, y: V / 2 - cy * newScale });
  }

  function save() {
    if (!img) return onDone(null);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return onDone(null);
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, V / scale, V / scale, 0, 0, 256, 256);
    canvas.toBlob((b) => onDone(b), "image/jpeg", 0.85);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,3,18,.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ borderRadius: 20, background: "linear-gradient(180deg, #241738, #180F30)", border: `1px solid ${colors.panelBorder}`, boxShadow: "0 24px 70px rgba(0,0,0,.55)", padding: 18, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("avatarEditTitle")}</span>
        <div
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOff(clamp(drag.current.ox + (e.clientX - drag.current.x), drag.current.oy + (e.clientY - drag.current.y)));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          style={{ position: "relative", width: V, height: V, borderRadius: 24, overflow: "hidden", border: `2px solid ${withAlpha(colors.gold, 0.55)}`, cursor: "grab", touchAction: "none", background: "#000" }}
        >
          {img && (
            <img
              src={url}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: pos.x, top: pos.y, width: w, height: h, maxWidth: "none", userSelect: "none", pointerEvents: "none" }}
            />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: V }}>
          <ZoomOut size={16} color={colors.faint} />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: colors.gold }}
          />
          <ZoomIn size={16} color={colors.faint} />
        </div>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("dragHint")}</p>
        <div style={{ display: "flex", gap: 8, width: V }}>
          <KnopPlaat breed={104} onClick={save} label={t("save")} />
          <Button variant="ghost" onClick={() => onDone(null)}>{t("cancelCorrection")}</Button>
        </div>
      </div>
    </div>
  );
}

// ---- Vrienden -----------------------------------------------------------------

function FriendsTab({ game, onChallenge }: { game: GameApi; onChallenge: (userId: string) => void }) {
  const { t } = useT();
  const account = game.state.account;
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (query.trim().length >= 2) game.searchUsers(query);
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!account) {
    return <Card><p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("profileNeeded")}</p></Card>;
  }

  const friends = game.state.friends;
  const zoek = query.trim().toLowerCase();
  const past = (f: Friend) => !zoek || f.name.toLowerCase().includes(zoek);
  const accepted = friends.filter((f) => f.status === "accepted" && past(f)).slice(0, 20);
  const pendingIn = friends.filter((f) => f.status === "pending" && f.requested_by !== account.id);
  const pendingOut = friends.filter((f) => f.status === "pending" && f.requested_by === account.id && past(f));
  const friendIds = new Set(friends.map((f) => f.id));
  const results = game.state.searchResults.filter((u) => !friendIds.has(u.id));

  // Tap a friend's avatar or name to open their score card.
  const openProfile = (id: string) => {
    game.viewProfile(id);
    setViewing(id);
  };

  // Alle vriendenlijsten lopen hier langs: verzoeken, vrienden en zoekresultaten.
  // Dus de glazen lijst hoeft maar op EEN plek te staan.
  const row = (u: Friend | (typeof results)[number], right: React.ReactNode, clickable = false) => (
    <GlasRij key={u.id}>
      <button
        onClick={clickable ? () => openProfile(u.id) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, cursor: clickable ? "pointer" : "default", textAlign: "left" }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar name={u.name} color={u.color} size={32} userId={u.id} hasAvatar={u.has_avatar} avatarVer={u.avatar_ver} divisie={u.divisie} />
          <span style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: u.online ? colors.green : colors.faint, border: `2px solid ${colors.bg1}` }} />
        </div>
        <span style={{ flex: 1, fontFamily: font.ui, fontWeight: 600, fontSize: 14.5, color: colors.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
      </button>
      {right}
    </GlasRij>
  );

  const smallBtn = (label: React.ReactNode, onClick: () => void, tone: "gold" | "ghost" | "red" = "ghost") => (
    <button
      onClick={onClick}
      style={{
        fontFamily: font.ui, fontSize: 12, fontWeight: 600, padding: "7px 10px", borderRadius: 9, cursor: "pointer",
        color: tone === "gold" ? colors.bg0 : tone === "red" ? colors.redHi : colors.sub,
        background: tone === "gold" ? colors.gold : tone === "red" ? withAlpha(colors.red, 0.14) : "transparent",
        border: tone === "ghost" ? `1px solid ${colors.hairline}` : "none",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <SchermTip id="vrienden" tekst={t("tipVrienden")} />
      {pendingIn.length > 0 && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 7px 14px" }}>
          <Lijst n={pendingIn.length} toon={10}>
            {pendingIn.map((f) =>
              row(f, (
                <div style={{ display: "flex", gap: 6 }}>
                  {smallBtn(<Check size={14} />, () => { sound.friend(); game.friendRespond(f.id, true); }, "gold")}
                  {smallBtn(<X size={14} />, () => game.friendRespond(f.id, false))}
                </div>
              ))
            )}
          </Lijst>
        </Card>
      )}

      <Card style={{ display: "flex", flexDirection: "column", gap: 3, padding: "9px 7px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: 30, marginBottom: 2 }}>
          <ZoekKnop waarde={query} onWaarde={setQuery} />
        </div>
        {accepted.length === 0 && pendingOut.length === 0 ? (
          <p style={{ margin: 0, paddingInline: 6, fontFamily: font.ui, fontSize: 13, color: colors.faint, lineHeight: 1.5 }}>{zoek ? t("searchNoMatch") : t("noFriends")}</p>
        ) : (
          <Lijst n={accepted.length + pendingOut.length} toon={10}>
            {accepted.map((f) => (
              <div key={f.id} style={{ display: "flex", flexDirection: "column" }}>
                {row(f, (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <KnopPlaat breed={86} onClick={() => onChallenge(f.id)} label={t("challengeBtn")} />
                    <button
                      onClick={() => setMenuFor(menuFor === f.id ? null : f.id)}
                      aria-label={t("friendOptions")}
                      style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 9, border: `1px solid ${menuFor === f.id ? withAlpha(colors.gold, 0.5) : colors.hairline}`, background: menuFor === f.id ? withAlpha(colors.gold, 0.1) : "transparent", color: colors.sub, cursor: "pointer" }}
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>
                ), true)}
                {menuFor === f.id && (
                  <div style={{ display: "flex", gap: 8, padding: "0 0 8px", justifyContent: "flex-end" }}>
                    {smallBtn(<><Trash2 size={13} /> {t("removeFriend")}</>, () => { game.friendRemove(f.id); setMenuFor(null); })}
                    {smallBtn(t("blockUser"), () => { game.friendBlock(f.id); setMenuFor(null); }, "red")}
                  </div>
                )}
              </div>
            ))}
            {pendingOut.map((f) => row(f, (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("pendingOut")}</span>
                {smallBtn(t("withdrawRequest"), () => game.friendRemove(f.id))}
              </div>
            )))}
          </Lijst>
        )}
        {results.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "11px 6px 6px" }}>
              <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <UserPlus size={13} /> {t("addFriendBtn")}
              </span>
              <span style={{ flex: 1, height: 1, background: colors.hairline }} />
            </div>
            <Lijst n={results.length} toon={10}>
              {results.map((u) =>
                row(u, sent[u.id]
                  ? <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.green }}>{t("pendingOut")}</span>
                  : <KnopPlaat breed={86} onClick={() => { game.friendRequest(u.id); setSent((s) => ({ ...s, [u.id]: true })); }} label={t("addFriendBtn")} />)
              )}
            </Lijst>
          </>
        )}
      </Card>



      {viewing && <ProfileViewModal game={game} userId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

// Score card of another player: stats + achievements in a small overlay.
/** Het korte profiel als popup: avatar, level, statistieken, onderling
 *  resultaat en prestaties. Ook buiten de hub bruikbaar (de lobby laat hem
 *  zien als je op een medespeler tikt), dus hij staat hier geexporteerd. */
export function ProfileViewModal({ game, userId, onClose }: { game: GameApi; userId: string; onClose: () => void }) {
  const { t } = useT();
  const p = game.state.viewedProfile;
  const loaded = p && p.id === userId;
  const [zoom, setZoom] = useState(false);
  return (
    <div
      onClick={onClose}
      className="reward-veil"
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,3,18,.72)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 20 }}
    >
      {/* De lijst om het profiel is dezelfde als om elke sectie in de app: een
          gouden verlooplijn die rondloopt, met kappen op de schuine uiteinden.
          Vroeger was dit een eigen gouden ring met een eigen vulling; dat was
          een tweede stijl voor hetzelfde ding. Achter de inhoud ligt de
          profiel-art, zodat een profiel er ook binnen een popup als een profiel
          uitziet en niet als een dialoogvenster. */}
      <NeonKader
        radius={22}
        dik={0.85}
        lijn={KADER_LIJN_GOUD}
        gloed="verloop"
        animeer
        eindkap
        vulling="geen"
        // De entree zit op de LIJST en niet op de inhoud erin: schaalt de inhoud
        // binnen een lijst met `overflow: hidden`, dan zie je tijdens die halve
        // seconde de lijst zelf langs de randen doorschemeren.
        className="reward-card"
        style={{ width: "100%", maxWidth: 380 }}
        binnen={{ padding: 0, overflow: "hidden" }}
      >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "80vh", overflowY: "auto",
          padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14,
          backgroundImage: [
            "linear-gradient(180deg, rgba(255,243,181,.09) 0%, transparent 14%)",
            "radial-gradient(120% 80% at 50% 6%, transparent 34%, rgba(6,3,18,.72) 100%)",
            'url("/ui/profile-bg.webp")',
            "linear-gradient(180deg, #2C1E4C 0%, #201340 48%, #130B2A 100%)",
          ].join(", "),
          backgroundSize: "100% 100%, 100% 100%, cover, 100% 100%",
          backgroundPosition: "top, top, center top, top",
          backgroundRepeat: "no-repeat",
        } as React.CSSProperties}
        className="zachtscroll"
      >
        {zoom && loaded && (
          <AvatarZoom name={p.name} color={p.color} userId={p.id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} onClose={() => setZoom(false)} />
        )}
        {!loaded ? (
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 14, color: colors.faint }}>...</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Tik op de foto om hem uitvergroot te zien. Alleen als er een
                  echte foto is: bij een letter valt er niets te bekijken. De
                  ring en het schild komen uit dezelfde art als op je eigen
                  profiel, want dit IS een profiel, alleen dan van een ander. */}
              <button
                onClick={() => p.has_avatar && setZoom(true)}
                aria-label={p.name}
                style={{ background: "transparent", border: "none", padding: 0, cursor: p.has_avatar ? "zoom-in" : "default", lineHeight: 0, flexShrink: 0 }}
              >
                <RingPortret maat={78} level={p.level.level} kleur={divisieKleur(p.divisie)}>
                  <RingFoto userId={p.id} versie={p.avatar_ver} heeftFoto={p.has_avatar} naam={p.name} kleur={p.color} />
                </RingPortret>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div
                  style={{
                    fontFamily: font.display,
                    fontWeight: 800,
                    fontSize: 15,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    backgroundImage: `linear-gradient(172deg, ${GOUD[3]} 0%, ${GOUD[2]} 46%, ${GOUD[1]} 78%, ${GOUD[2]} 100%)`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {t(`rank_${p.level.rank}`)}
                </div>
                {/* De divisie staat er als tekst NAAST het schild op de ring:
                    het schild zegt welke kleur, dit zegt wat die kleur waard
                    is. Zonder de naam blijft het versiering. */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                  <Schild divisie={p.divisie ?? 0} maat={13} gloed={false} />
                  <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, color: `rgb(${DIVISIE_ACCENT[Math.max(0, Math.min(DIVISIE_ACCENT.length - 1, p.divisie ?? 0))]})` }}>
                    {divisieNaam(p.divisie ?? 0)}
                  </span>
                  <span style={{ fontFamily: font.ui, fontSize: 11.5, color: p.online ? colors.green : colors.faint }}>{p.online ? "online" : "offline"}</span>
                </div>
              </div>
              {p.is_friend && (
                <button
                  onClick={() => {
                    game.dmOpen(p.id);
                    onClose();
                  }}
                  aria-label={t("sendMessage")}
                  title={t("sendMessage")}
                  className="pressable"
                  style={{ background: "transparent", border: "none", padding: 0, width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, lineHeight: 0 }}
                >
                  <ChatIcoon />
                </button>
              )}
              <button onClick={onClose} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
                <CloseIcon size={26} />
              </button>
            </div>
            <LevelBar level={p.level} compact />
            <StatGrid stats={p.stats} />
            {p.h2h && p.h2h.games > 0 && (
              <NeonKader hoek={12} dik={0.4} sterkte={0.5} vulling="geen" eindkap animeer binnen={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px" }}>
                <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, textAlign: "center" }}>
                  {t("h2hTitle")}
                </span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12 }}>
                  <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>{t("you")}</span>
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 24, color: p.h2h.my_wins >= p.h2h.their_wins ? colors.gold : colors.ink }}>{p.h2h.my_wins}</span>
                  <span style={{ fontFamily: font.ui, fontSize: 14, color: colors.faint }}>·</span>
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 24, color: p.h2h.their_wins >= p.h2h.my_wins ? colors.gold : colors.ink }}>{p.h2h.their_wins}</span>
                  <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>{p.name}</span>
                </div>
                <span style={{ textAlign: "center", fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>
                  {t("h2hGames", { n: p.h2h.games })}
                </span>
              </NeonKader>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{t("badgesTitle")}</span>
              {p.badges.length === 0 ? (
                <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("noBadges")}</p>
              ) : (
                p.badges.map((b) => (
                  <GlasRij key={b.badge} dun>
                    <ArtIcoon naam="krans" size={18} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(`badge_${b.badge}`)}</span>
                  </GlasRij>
                ))
              )}
            </div>
          </>
        )}
      </div>
      </NeonKader>
    </div>
  );
}

// ---- Inbox ---------------------------------------------------------------------

/** Het getal op een zeshoekige plaat, voor in de keuzepil.
 *
 *  Een gewone ronde badge zou de derde vorm zijn in een balk die al zeshoeken
 *  en pillen heeft. De plaat is dezelfde als in de bovenbalk, alleen klein
 *  genoeg om in een knop te passen. */
function InboxTab({ game, onGaNaar }: { game: GameApi; onGaNaar: (naar: string) => void }) {
  const { t } = useT();
  const [viewing, setViewing] = useState<string | null>(null);
  const [vak, setVak] = useState<"inbox" | "meld">("inbox");
  const [zoekOpen, setZoekOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  // Een tik op een melding brengt je naar waar hij over gaat, voor zover dat
  // binnen deze lijst ligt: een gesprek of het profiel van wie hem stuurde. De
  // rest (duel, dagronde) hangt aan de banner in App, want daar zitten die
  // schermen; hier zou je alsnog moeten terugtikken.
  const onMelding = (m: { naar: string | null; data: string | null }) => {
    sound.uiTap();
    let d: Record<string, string> = {};
    try { d = m.data ? JSON.parse(m.data) : {}; } catch { /* rommel is geen reden om niets te doen */ }
    // Een gesprek en een profiel kunnen hier open; alles wat een EIGEN SCHERM
    // is (duel, dagronde, je profiel) gaat via App, want die kent de schermen.
    if (m.naar === "dm" && d.user_id) game.dmOpen(d.user_id);
    else if (m.naar === "duel" || m.naar === "dagronde" || m.naar === "profiel") onGaNaar(m.naar);
    else if (d.user_id) { game.viewProfile(d.user_id); setViewing(d.user_id); }
  };
  const account = game.state.account;
  const threads = game.state.dmThreads;

  // Load the DM thread list alongside the invites, plus the notifications.
  useEffect(() => {
    if (account) {
      game.dmRefreshThreads();
      game.meldingenLaden();
      // De zoeker zoekt in je VRIENDEN: je kunt alleen vrienden een bericht
      // sturen, dus zoeken in alle spelers zou je bij mensen brengen waar de
      // server je bericht toch weigert.
      game.refreshFriends();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!account]);

  if (!account) {
    return <Card><p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("profileNeeded")}</p></Card>;
  }
  const items = game.state.inbox;
  // Berichten horen bij de INBOX, niet bij de meldingen: in de inbox staat het
  // gesprek zelf, en dan is een tweede regel "je hebt een bericht" naast dat
  // gesprek dubbelop. Alles wat GEEN bericht is hoort wel bij de meldingen.
  const meldingen = game.state.meldingen.filter((m) => m.soort !== "bericht" && m.soort !== "herinnering_bericht");
  const ongelezenMeld = meldingen.filter((m) => !m.gelezen).length;
  const inboxTeller = (items.length || account.inbox_count || 0) + (account.dm_unread || 0);

  return (
    <>
    <SchermTip id="inbox" tekst={t("tipInbox")} />
    {/* Dezelfde pil als bij vrienden en club: twee kanten van hetzelfde scherm,
        met per kant het getal dat er nu op wacht. */}
    <PilKeuze
      actief={vak}
      onKies={setVak}
      opties={[
        { key: "inbox" as const, label: t("inboxTab"), icoon: inboxTeller > 0 ? <TelHex n={inboxTeller} /> : undefined },
        { key: "meld" as const, label: t("meldingenTitle"), icoon: ongelezenMeld > 0 ? <TelHex n={ongelezenMeld} /> : undefined },
      ]}
    />

    {vak === "meld" && (
      <Card style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 7px 14px" }}>
        <SectieKop
          style={{ paddingInline: 6 }}
          label={t("meldingenTitle")}
          actie={ongelezenMeld > 0 ? t("meldingenLees") : undefined}
          onActie={ongelezenMeld > 0 ? () => { sound.uiTap(); game.meldingenLezen(); } : undefined}
        />
        {meldingen.length === 0 ? (
          <p style={{ margin: "8px 0 0", paddingInline: 8, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("meldingenLeeg")}</p>
        ) : (
          // Geen vaste hoogte van zes rijen: dit IS de meldingenpagina, dus de
          // lijst loopt door tot de onderbalk. Een venstertje van zes met een
          // half scherm lucht eronder liet je scrollen in iets waar de ruimte
          // al was. De kaart zelf scrollt mee met de pagina.
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {meldingen.map((m) => (
              <MeldingRij key={m.id} melding={m} onOpen={() => onMelding(m)} onWeg={() => game.meldingWeg(m.id)} />
            ))}
          </div>
        )}
      </Card>
    )}
    {vak === "inbox" && (
    <>
    {/* De kaart staat er ALTIJD, ook zonder gesprekken: de zoekknop erin is de
        enige plek waar je een gesprek BEGINT met iemand met wie je er nog geen
        hebt. Stond hij alleen bij bestaande gesprekken, dan kwam je er nooit. */}
    <Card style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 14px 14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ flex: 1, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
            {t("dmTitle")}
          </span>
          <button
            onClick={() => { sound.uiTap(); setZoekOpen((v) => !v); setZoek(""); }}
            aria-label={t("dmZoek")}
            title={t("dmZoek")}
            className="pressable"
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: zoekOpen ? colors.gold : colors.faint, display: "flex", lineHeight: 0 }}
          >
            <Search size={18} />
          </button>
        </div>
        {zoekOpen && (
          <>
            <input
              autoFocus
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder={t("dmZoek")}
              style={{
                margin: "2px 0 6px", background: "rgba(6,3,18,.55)", border: "none",
                boxShadow: `inset 0 0 0 1.4px ${withAlpha("#A868F5", 0.55)}`, borderRadius: 999,
                padding: "9px 14px", color: colors.ink, fontFamily: font.ui, fontSize: 14, outline: "none",
              }}
            />
            {(() => {
              const q = zoek.trim().toLowerCase();
              const gevonden = game.state.friends
                .filter((f) => f.status === "accepted" && (!q || f.name.toLowerCase().includes(q)))
                .slice(0, 8);
              if (gevonden.length === 0) {
                return <p style={{ margin: "2px 0 4px", paddingInline: 4, fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("dmZoekLeeg")}</p>;
              }
              return gevonden.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { sound.uiTap(); setZoekOpen(false); setZoek(""); game.dmOpen(f.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
                >
                  <Avatar name={f.name} color={f.color} size={32} userId={f.id} hasAvatar={f.has_avatar} avatarVer={f.avatar_ver} divisie={f.divisie} />
                  <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{f.name}</span>
                </button>
              ));
            })()}
          </>
        )}
        {!zoekOpen && threads.map((th) => (
          <button
            key={th.partner}
            onClick={() => game.dmOpen(th.partner)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
          >
            <Avatar name={th.user.name} color={th.user.color} size={36} userId={th.user.id} hasAvatar={th.user.has_avatar} avatarVer={th.user.avatar_ver} divisie={th.user.divisie} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 14, color: colors.ink }}>{th.user.name}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: th.unread > 0 ? colors.ink : colors.faint, fontWeight: th.unread > 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {th.last_from_me ? `${t("chatYou")}: ` : ""}{th.last_emote ? t("stickerOne") : th.last_image ? t("beeldEen") : th.last_voice ? t("voiceMemo") : th.last_text}
              </div>
            </div>
            {/* Zelfde badge als overal: de zwarte zeshoek met het gouden
                cijfer. De gele schijf die hier stond was de enige plek waar
                nog een andere taal gesproken werd. */}
            {th.unread > 0 && (
              <span style={{ flexShrink: 0, lineHeight: 0 }}>
                <TelHex n={th.unread} maat={20} />
              </span>
            )}
          </button>
        ))}
        {!zoekOpen && threads.length === 0 && (
          <p style={{ margin: "2px 0 0", paddingInline: 4, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("dmLeeg")}</p>
        )}
      </Card>
    {items.length > 0 && (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item: InboxItem, i) => (
          <div key={item.id ?? `fr-${item.from_id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, background: withAlpha("#000000", 0.18), border: `1px solid ${colors.hairline}` }}>
            <Avatar name={item.from_name} color={item.from_color} size={36} userId={item.from_id} hasAvatar={item.has_avatar} avatarVer={item.avatar_ver} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font.ui, fontWeight: 700, fontSize: 13.5, color: colors.ink }}>{item.from_name}</div>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>
                {item.type === "friend_request" ? t("pendingIn") : item.type === "challenge" ? t("challengedYou") : item.type === "club_invite" ? t("clubInvitedYou") : `${t("invitedYouTo")} ${item.room_code}`}
              </div>
            </div>
            {item.type === "friend_request" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { sound.friend(); game.friendRespond(item.from_id, true); }} style={{ padding: "7px 12px", borderRadius: 9, border: "none", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("acceptBtn")}</button>
                <button onClick={() => game.friendRespond(item.from_id, false)} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${colors.hairline}`, background: "transparent", color: colors.sub, fontFamily: font.ui, fontSize: 12, cursor: "pointer" }}>{t("declineBtn")}</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => item.id && game.inviteRespond(item.id, true)} style={{ padding: "7px 12px", borderRadius: 9, border: "none", background: colors.gold, color: colors.bg0, fontFamily: font.ui, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t("joinBtn")}</button>
                <button onClick={() => item.id && game.inviteRespond(item.id, false)} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${colors.hairline}`, background: "transparent", color: colors.sub, fontFamily: font.ui, fontSize: 12, cursor: "pointer" }}>{t("declineBtn")}</button>
              </div>
            )}
          </div>
        ))}
    </Card>
    )}
    </>
    )}
    {viewing && <ProfileViewModal game={game} userId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

// ---- Ranglijst ------------------------------------------------------------------

/** De glazen rij: dezelfde lijst als bij de laatste potjes. Eén plek, zodat de
 *  historie, de ranglijst en de vriendenlijst er gegarandeerd hetzelfde uitzien
 *  in plaats van "ongeveer". */
export function GlasRij({ wapen, dun, children, binnen }: { wapen?: React.ReactNode; dun?: boolean; children: React.ReactNode; binnen?: React.CSSProperties }) {
  return (
    <NeonKader
      hoek={dun ? 9 : 11}
      dik={0.3}
      vulling="geen"
      sterkte={0.3}
      eindkap
      // Lucht tot de wand van de sectie eromheen. Twee lijsten die elkaar bijna
      // raken lezen als een fout: je ziet dan twee randen met een kier ertussen
      // in plaats van een rij BINNEN een sectie.
      style={{ marginInline: dun ? 6 : 7 }}
      binnen={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        minHeight: dun ? 38 : 44,
        // Rechts meer lucht dan links: daar snijdt de hoek van de lijst een
        // driehoek uit het vlak, en een portret valt daar zo overheen.
        padding: wapen ? "5px 17px 5px 45px" : dun ? "3px 12px 3px 10px" : "5px 17px 5px 13px",
        ...binnen,
      }}
    >
      {/* Het wapen hangt AAN de bovenlijn en begint op het knikpunt van de
          schuine hoek, net als bij de laatste potjes. Zet je hem gewoon in de
          rij, dan zweeft hij in het midden en hoort hij nergens bij. */}
      {wapen && <span style={{ position: "absolute", left: 11, top: 0, display: "flex" }}>{wapen}</span>}
      {children}
    </NeonKader>
  );
}

/** Een lijst die pas gaat schuiven als hij te lang wordt.
 *
 *  Drie regels passen altijd; daarboven krijgt de lijst een vaste hoogte en
 *  scrollt hij binnen zijn eigen sectie. Zo blijft de PAGINA kort en hoef je niet
 *  langs een vriendenlijst van dertig te scrollen om te zien wat eronder staat. */
export function Lijst({ n, gap = 3, rij = 44, toon = 3.5, children }: { n: number; gap?: number; rij?: number; toon?: number; children: React.ReactNode }) {
  const schuift = n > toon;
  return (
    <div
      className={schuift ? "zachtscroll" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        maxHeight: schuift ? Math.round(toon * (rij + gap) - gap) : undefined,
        overflowY: schuift ? "auto" : undefined,
        paddingRight: schuift ? 3 : 0,
      }}
    >
      {children}
    </div>
  );
}

/** Een zoekknopje dat het invulveld pas TOONT als je erop tikt.
 *
 *  Een veld dat er altijd staat neemt een hele regel in beslag voor iets dat je
 *  zelden gebruikt. Als knopje in de hoek kost het niets, en zodra je tikt staat
 *  de cursor er meteen in. */
export function ZoekKnop({ waarde, onWaarde }: { waarde: string; onWaarde: (v: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const veld = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) veld.current?.focus();
  }, [open]);
  if (!open) {
    return (
      <button
        onClick={() => { sound.uiTap(); setOpen(true); }}
        aria-label={t("searchName")}
        className="pressable"
        style={{ width: 30, height: 30, display: "grid", placeItems: "center", border: "none", background: "transparent", color: colors.sub, cursor: "pointer", padding: 0, flexShrink: 0 }}
      >
        <Search size={16} />
      </button>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 1 190px", background: withAlpha("#000000", 0.3), border: `1px solid ${colors.panelBorder}`, borderRadius: 999, padding: "5px 10px" }}>
      <Search size={13} color={colors.faint} style={{ flexShrink: 0 }} />
      <input
        ref={veld}
        value={waarde}
        onChange={(e) => onWaarde(e.target.value)}
        placeholder={t("searchName")}
        style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: colors.ink, fontFamily: font.ui, fontSize: 12.5 }}
      />
      <button
        onClick={() => { onWaarde(""); setOpen(false); }}
        aria-label={t("close")}
        style={{ background: "transparent", border: "none", color: colors.faint, cursor: "pointer", padding: 0, display: "flex" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

/** De periodeknoppen, in dezelfde stijl als op de ranglijst: doorzichtig, met
 *  het verschil in de LIJN en de gloed. Een gevulde knop naast lege leest als
 *  een ander soort knop in plaats van dezelfde knop in een andere stand. */
export function PeriodeKnoppen<T extends string>({ opties, actief, onKies }: { opties: { key: T; label: string }[]; actief: T; onKies: (k: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {opties.map((o) => {
        const aan = actief === o.key;
        return (
          <button
            key={o.key}
            onClick={() => { sound.uiTap(); onKies(o.key); }}
            className="pressable"
            style={{
              flex: 1, padding: "9px 4px", borderRadius: radius.button, cursor: "pointer",
              background: "transparent",
              border: `1px solid ${aan ? withAlpha("#C46BFF", 0.75) : colors.panelBorder}`,
              boxShadow: aan ? `0 0 12px ${withAlpha("#9A4BF0", 0.5)}, inset 0 0 10px ${withAlpha("#9A4BF0", 0.22)}` : "none",
              color: aan ? colors.ink : colors.sub, fontFamily: font.ui, fontSize: 12.5, fontWeight: 600,
              transition: "box-shadow .2s ease, border-color .2s ease",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Twee keuzes in EEN pil met de neon-lijst, zoals de prestatieteller op het
 *  profiel. Twee losse knoppen naast elkaar lezen als twee dingen; in één pil
 *  lees je het als één schakelaar met twee standen. */
export function PilKeuze<T extends string>({ opties, actief, onKies, schuif }: { opties: { key: T; label: string; icoon?: React.ReactNode }[]; actief: T; onKies: (k: T) => void; schuif?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", maxWidth: "100%" }}>
      {/* Buitenring en binnenknop delen dezelfde neonlijn als de periodeknoppen
          op de ranglijst: doorzichtig, een violette lijn en een gloed binnen en
          buiten. De ring om de pil staat altijd aan, de knop erin licht op als
          hij gekozen is. Zo is het verschil de LIJN, niet een gevuld vlak. */}
      <div
        className={schuif ? "zachtscroll" : undefined}
        style={{
          display: schuif ? "flex" : "inline-flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 999,
          background: "transparent",
          border: `1px solid ${withAlpha("#C46BFF", 0.55)}`,
          boxShadow: `0 0 14px ${withAlpha("#9A4BF0", 0.4)}, inset 0 0 12px ${withAlpha("#9A4BF0", 0.16)}`,
          maxWidth: schuif ? "100%" : undefined,
          overflowX: schuif ? "auto" : undefined,
        }}
      >
        {opties.map((o) => {
          const aan = actief === o.key;
          return (
            <button
              key={o.key}
              onClick={() => { sound.uiTap(); onKies(o.key); }}
              className="pressable"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: schuif ? "7px 14px" : "7px 20px", borderRadius: 999, cursor: "pointer",
                flexShrink: 0, whiteSpace: "nowrap",
                background: "transparent",
                border: `1px solid ${aan ? withAlpha("#C46BFF", 0.75) : "transparent"}`,
                boxShadow: aan ? `0 0 12px ${withAlpha("#9A4BF0", 0.5)}, inset 0 0 10px ${withAlpha("#9A4BF0", 0.22)}` : "none",
                color: aan ? colors.ink : colors.sub,
                fontFamily: font.ui, fontWeight: 700, fontSize: 13,
                transition: "box-shadow .2s ease, border-color .2s ease, color .2s ease",
              }}
            >
              {o.icoon}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LeaderboardTab({ game }: { game: GameApi }) {
  const { t } = useT();
  const lb = game.state.leaderboard;
  const account = game.state.account;
  const period = lb?.period ?? "week";
  const rows = lb?.rows ?? [];
  const top = Math.max(1, rows[0]?.points ?? 1);
  const mijnPlek = rows.findIndex((r) => r.id === account?.id);
  const ik = mijnPlek >= 0 ? rows[mijnPlek] : null;
  // Het doel is de speler BOVEN je, en als je eerste staat je voorsprong op de
  // tweede. Dat is echt en het zegt bovendien iets: een los rond getal als doel
  // vertelt je niets over waar je staat.
  const boven = mijnPlek > 0 ? rows[mijnPlek - 1] : null;
  const tweede = rows[1] ?? null;
  return (
    <>
      <SchermTip id="ranglijst" tekst={t("tipRanglijst")} />
      <PeriodeKnoppen
        actief={period}
        onKies={(p) => game.loadLeaderboard(p)}
        opties={[
          { key: "week" as const, label: t("thisWeek") },
          { key: "month" as const, label: t("seasonChip") },
          { key: "all" as const, label: t("allTime") },
        ]}
      />

      <Card style={{ display: "flex", flexDirection: "column", gap: 5, padding: "13px 7px 14px" }}>
        {rows.length === 0 ? (
          <p style={{ margin: 0, paddingInline: 6, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("lbEmpty")}</p>
        ) : (
          <Lijst n={rows.length} gap={5} toon={5}>
            {rows.map((r, i) => <RangRij key={r.id} r={r} plek={i + 1} deel={r.points / top} />)}
          </Lijst>
        )}
      </Card>

      {/* Jouw cijfers over DEZE periode, niet over al je potjes: de lijst gaat
          over een week of een maand, dus de samenvatting eronder ook. */}
      {ik && (
        <Card style={{ display: "flex", alignItems: "stretch", padding: "13px 4px" }}>
          {/* Je stijging van de laatste 24 uur. Heb je nog geen dag historie op
              deze lijst, dan is er niets te vergelijken en staat er hoeveel
              potjes je speelde: liever iets dat klopt dan een nul die suggereert
              dat je stil stond. */}
          {(() => {
            // JOUW klim, uit je EIGEN rij. Niet uit het losse `climb`-veld: dat
            // hangt eraan wie de server op dat moment aan de socket gekoppeld
            // had, en vlak na een herverbinding is dat nog niemand; dan was de
            // klim stil null en viel dit kaartje terug op het aantal potjes.
            // Dat is de "niet gelinkt aan mijn account" die je zag. De rij komt
            // uit dezelfde berekening maar hangt aan je id, niet aan de socket.
            const klim = ik.climb ?? lb?.climb ?? null;
            return klim != null ? (
              <Cijfer
                // Zak je, dan hoort er ook een DALENDE pijl te staan: het
                // pictogram zie je eerder dan het minteken.
                art={klim < 0 ? "daling" : "stijging"}
                waarde={`${klim > 0 ? "+" : ""}${klim}`}
                label={t("lbClimb")}
              />
            ) : (
              <Cijfer art="games" waarde={`${ik.games}`} label={t("lbGames")} />
            );
          })()}
          <Scheiding />
          <Cijfer art="vlam" waarde={`${account?.stats.streak ?? 0}`} label={t("statStreak")} />
          <Scheiding />
          <Cijfer art="krans" waarde={`${ik.points}`} label={t("lbYourScore")} />
        </Card>
      )}

      {/* De aanmoediging. Het doel is de speler boven je; sta je eerste, dan is
          het je voorsprong die je moet vasthouden. */}
      {ik && (boven || tweede) && (
        <Card
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            padding: "14px 15px",
            position: "relative",
            overflow: "hidden",
            // Licht uit de LINKERBOVENHOEK, net als overal in deze stijl, en het
            // reikt tot over de helft: houdt het te vroeg op, dan leest het als
            // een vlek in de hoek in plaats van als belichting.
            backgroundImage: "radial-gradient(125% 155% at 0% 0%, rgba(255,196,90,.1) 0%, rgba(196,107,255,.06) 36%, rgba(154,75,240,.025) 64%, transparent 88%)",
          }}
        >
          <HexArt maat={54} style={{ flexShrink: 0 }}>
            <img src={`/ui/stat/ster.webp?v=${STAT_ART}`} alt="" aria-hidden style={{ width: 27, height: 27, display: "block" }} />
          </HexArt>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15.5, color: colors.ink }}>
              {boven ? t("lbChaseTitle") : t("lbLeadTitle")}
            </span>
            <span style={{ fontFamily: font.ui, fontSize: 12.5, lineHeight: 1.45, color: colors.sub }}>
              {boven
                ? t("lbChaseBody", { n: boven.points - ik.points, name: boven.name })
                : t("lbLeadBody", { n: ik.points - (tweede?.points ?? 0) })}
            </span>
            {/* Jaag je iemand na, dan is de balk hoe ver je al bent van zijn
                totaal. Sta je eerste, dan is het je VOORSPRONG, en dan zegt
                "235 / 235" niets: dan hoort er te staan hoeveel je voorstaat. */}
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <NeonKader radius={999} dik={0.4} vulling="geen" gloed="none" style={{ flex: 1 }} binnen={{ height: 9, background: "rgba(0,0,0,.45)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.6)" }}>
                <div
                  style={{
                    width: `${Math.round(Math.min(1, Math.max(0.04, boven ? ik.points / Math.max(1, boven.points) : (ik.points - (tweede?.points ?? 0)) / Math.max(1, ik.points))) * 100)}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${GOUD[1]}, ${GOUD[2]} 60%, ${GOUD[3]})`,
                    transition: "width .4s ease",
                  }}
                />
              </NeonKader>
              <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 12.5, color: colors.sub, flexShrink: 0 }}>
                {boven ? (
                  <>{ik.points} <span style={{ color: colors.faint }}>/ {boven.points}</span></>
                ) : (
                  <span style={{ color: GOUD[2] }}>+{ik.points - (tweede?.points ?? 0)}</span>
                )}
              </span>
            </div>
          </div>
          {/* De kist staat er als BELOFTE, niet als knop: hij zegt waar je het
              voor doet zonder iets te beweren wat er nog niet is. */}
          <img src="/ui/kist.webp" alt="" aria-hidden style={{ width: 52, flexShrink: 0, alignSelf: "flex-end", marginBottom: -2 }} />
        </Card>
      )}

      {/* Altijd zichtbaar. Ik had hem eerst aan de seizoentab gehangen, maar de
          aftelling gaat niet over het VENSTER waar je naar kijkt: het seizoen
          loopt door welke tab je ook openhebt, en dat is precies iets wat je
          wilt weten zonder ernaar te zoeken. */}
      <SeizoenRij />
    </>
  );
}

/** Een regel in de ranglijst: wimpel, portret, naam met een scorebalk, winsten,
 *  punten en de beker. De nummer EEN krijgt goud en een gloed; de rest staat in
 *  dezelfde lijst maar dan uit. */
function RangRij({ r, plek, deel }: { r: LeaderboardRow; plek: number; deel: number }) {
  const eerste = plek === 1;
  const metaal = plek === 1 ? "goud" : plek === 2 ? "zilver" : plek === 3 ? "brons" : "overig";
  return (
    <NeonKader
      hoek={11}
      dik={eerste ? 0.55 : 0.3}
      vulling="geen"
      sterkte={eerste ? 0.9 : 0.3}
      // Alleen de koploper krijgt de gouden kappen. Geeft iedereen ze, dan zijn
      // ze geen onderscheiding meer maar lijstwerk.
      eindkap={eerste}
      lijn={eerste ? `linear-gradient(115deg, ${GOUD[3]} 0%, ${GOUD[2]} 34%, ${GOUD[1]} 72%, ${GOUD[2]} 100%)` : undefined}
      gloed={eerste ? `0 0 14px ${withAlpha(GOUD[2], 0.3)}` : "none"}
      style={{ marginInline: 7 }}
      binnen={{ display: "flex", alignItems: "center", gap: 6, minHeight: eerste ? 66 : 60, padding: "6px 7px 6px 44px" }}
    >
      {/* Alleen het plaatsnummer. De klim per rij heeft hier gestaan en is er
          bewust weer uit: zestien pijltjes maken de lijst druk, en wat de
          speler wil weten is zijn EIGEN beweging; die staat in het kaartje
          onder de lijst. De data reist wel mee in de rij (r.climb), zodat dat
          kaartje hem uit de eigen rij kan lezen. */}
      <span style={{ position: "absolute", left: 11, top: 0, display: "flex" }}>
        <PlekWapen plek={plek} maat={26} />
      </span>
      {/* Streepjes scheiden wat NIET bij elkaar hoort. Portret, naam en balk
          gaan samen: dat is een speler. Daarna elk cijfer op zichzelf. */}
      <Scheiding />
      <Avatar name={r.name} color={r.color} size={eerste ? 44 : 40} userId={r.id} hasAvatar={r.has_avatar} avatarVer={r.avatar_ver} divisie={r.divisie} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        {/* Het schild voor de naam: hier zie je in een oogopslag in welke
            divisie iemand zit. Klein en zonder gloed, want in een rij van vijf
            wordt licht per regel al gauw een lichtkrans over de hele lijst. */}
        <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <Schild divisie={r.divisie ?? 0} maat={11} gloed={false} />
          <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontWeight: 700, fontSize: 14.5, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
        </span>
        {/* De balk zegt in EEN blik hoe ver iemand van de koploper af staat.
            Zonder die balk zijn het losse getallen die je met elkaar moet
            vergelijken, en dat doet niemand. */}
        <span style={{ height: 4, borderRadius: 999, background: "rgba(0,0,0,.42)", overflow: "hidden" }}>
          <span
            style={{
              display: "block",
              width: `${Math.round(Math.max(0.06, deel) * 100)}%`,
              height: "100%",
              borderRadius: 999,
              background: eerste
                ? `linear-gradient(90deg, ${GOUD[1]}, ${GOUD[2]} 55%, ${GOUD[3]})`
                : `linear-gradient(90deg, ${colors.violet}, #C46BFF)`,
              boxShadow: eerste ? `0 0 7px ${withAlpha(GOUD[2], 0.55)}` : `0 0 6px ${withAlpha("#C46BFF", 0.45)}`,
            }}
          />
        </span>
      </div>
      <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint, flexShrink: 0 }}>{r.wins}W</span>
      <Scheiding />
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: eerste ? 18 : 16, color: eerste ? GOUD[2] : colors.ink, minWidth: 34, textAlign: "right" }}>{r.points}</span>
      <Scheiding />
      {/* De DOOS is voor iedereen even breed en alleen het plaatje erin verschilt.
          Zou de doos meekrimpen, dan schuift het streepje ervoor mee en lopen de
          kolommen niet meer door; en juist omdat die streepjes een verticale
          lijn vormen, valt een verschuiving van een paar pixels op. */}
      <span style={{ width: 32, flexShrink: 0, marginRight: -1, display: "grid", placeItems: "center" }}>
        <img
          src={`/ui/beker/${metaal}.webp?v=${BEKER_ART}`}
          alt=""
          aria-hidden
          style={{ width: eerste ? 32 : 26, display: "block", filter: eerste ? "brightness(1.06)" : "brightness(.86) saturate(.9)" }}
        />
      </span>
    </NeonKader>
  );
}

const BEKER_ART = 2;

/** De kleur van elk pictogram, GEMETEN aan de art zelf en niet gekozen.
 *
 *  Wat je als "de kleur" van een tekening ziet is niet het gemiddelde (dat trekt
 *  naar de donkere randen) en ook niet het lichtste punt (dat is bijna wit), maar
 *  het verzadigde deel op middelhoge helderheid: het vlak, zonder de schaduw en
 *  zonder de glans. `tekst` is het midden tussen dat vlak en zijn felste tint,
 *  want een getal op een donkere achtergrond mag een slag lichter zijn dan het
 *  voorwerp; `gloed` is het vlak zelf, want daar gloeit het voorwerp mee. */
const ART_KLEUR: Record<string, { tekst: string; gloed: string }> = {
  stijging: { tekst: "#95DC0E", gloed: "#7CCB0A" },
  // Gemeten aan daling.webp op dezelfde manier als de andere: het verzadigde
  // vlak van de pijl, en de gloed een slag dieper.
  daling:   { tekst: "#E4173A", gloed: "#C40D26" },
  vlam:     { tekst: "#E8A317", gloed: "#D68011" },
  krans:    { tekst: "#AC7BE9", gloed: "#9969DE" },
  games:    { tekst: "#E7A821", gloed: "#D58B17" },
};

/** Een cijfer in de samenvattingsbalk. */
function Cijfer({ art, icoon, waarde, label, kleur }: { art?: string; icoon?: React.ReactNode; waarde: string; label: string; kleur?: string }) {
  const uitArt = art ? ART_KLEUR[art] : undefined;
  const tekst = kleur ?? uitArt?.tekst ?? colors.ink;
  const gloed = uitArt?.gloed;
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {/* De getekende penningen uit de statistieken. Naast art van goud leest
            een lijnpictogram als een tekening naast een voorwerp; die staat er
            dus alleen zolang de art voor dat cijfer nog niet bestaat.
            De gloed is een HALO erachter en geen drop-shadow: die laat iOS de
            laag apart rasteren en dan zie je zijn rechthoek over het pictogram
            heen. Hij draagt de kleur van het pictogram zelf, anders gloeit er
            iets anders dan er staat. */}
        {art ? (
          <span style={{ position: "relative", width: 34, height: 34, display: "grid", placeItems: "center" }}>
            {gloed && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: "8%",
                  borderRadius: "50%",
                  background: `radial-gradient(closest-side, ${withAlpha(gloed, 0.55)} 0%, ${withAlpha(gloed, 0.18)} 58%, transparent 100%)`,
                  filter: "blur(4px)",
                }}
              />
            )}
            <img src={`/ui/stat/${art}.webp?v=${STAT_ART}`} alt="" aria-hidden style={{ position: "relative", width: 34, height: 34, display: "block" }} />
          </span>
        ) : (
          icoon
        )}
        <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 20, lineHeight: 1, color: tekst }}>{waarde}</span>
      </span>
      <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{label}</span>
    </div>
  );
}

/** De scheiding tussen twee cijfers: dezelfde groef als in de potjesrijen. */
function Scheiding() {
  return (
    <span
      aria-hidden
      style={{
        alignSelf: "stretch",
        flexShrink: 0,
        width: 2,
        marginBlock: 2,
        backgroundImage: "linear-gradient(90deg, rgba(8,3,20,.7) 0, rgba(8,3,20,.7) 1px, rgba(255,255,255,.13) 1px, rgba(255,255,255,.13) 2px)",
        WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)",
        maskImage: "linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)",
      }}
    />
  );
}

/** Hoe lang het seizoen nog duurt. Het seizoen is een kalendermaand, dus dat is
 *  gewoon te rekenen: geen extra veld van de server nodig. */
function SeizoenRij() {
  const { t } = useT();
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const d = new Date(nu);
  const eind = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const over = Math.max(0, eind - nu);
  const dagen = Math.floor(over / 86_400_000);
  const uren = Math.floor((over % 86_400_000) / 3_600_000);
  const min = Math.floor((over % 3_600_000) / 60_000);
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 15px", borderRadius: 12 }}>
      <CalendarDays size={18} color={colors.violet} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
        {t("lbSeasonEnds", { d: dagen, h: uren, m: min })}
      </span>
    </Card>
  );
}
