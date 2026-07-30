// Landing — emblem, wordmark, tagline, name input, create / join, rules link.
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "../components/CloseIcon";
import { Bot, CalendarDays, Check, GraduationCap, Hash, HelpCircle, Play, Settings as SettingsIcon, Sparkles, Swords } from "lucide-react";
import { Logo } from "../components/Logo";
import { Button } from "../components/Button";
import { NotifyNudge } from "../components/NotifyNudge";
import { DagUitslagPopup } from "../components/DagUitslagPopup";
import { MissiesPopup } from "../components/MissiesPopup";
import { ProfilePrompt, profilePromptSeen } from "../components/ProfilePrompt";
import { InstallPrompt, installPromptSeen, type InstallVariant } from "../components/InstallPrompt";
import { canInstall, isIos, isIosChrome, isIosInAppBrowser, isStandalone, onInstallChange } from "../pwa/install";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { NeonText } from "../components/NeonText";
import { neonSkin } from "../theme/neon";
import { TILE_ART, plateShadow, shadowSrc, useTileSkin } from "../theme/tileSkin";
import { CashPlate, CoinPlate } from "../components/CoinPlate";
import { HexPlate } from "../components/HexPlate";
import { HexArt } from "../components/HexArt";
import { EmblemLight, EmblemLightFront } from "../components/EmblemLight";
import { ReferralAd } from "../components/ReferralAd";
import { colors, font, radius, withAlpha, GROEN } from "../theme/tokens";

// De lijst-art van de skin, in de drie maten uit `section main page.svg`:
// dezelfde tekening, op drie hoogtes gezet. Er wordt niets geknipt, alleen
// geschaald. We nemen de maat waarvan de verhouding het dichtst bij de kaart
// ligt, zodat er hooguit een paar procent na te rekken valt. Komt er later meer
// op de main page, dan schuift hij vanzelf naar de volgende maat op.
const FRAMES = [
  { src: "/tiles/frame-1.webp", ratio: 1192 / 1273 },
  { src: "/tiles/frame-2.webp", ratio: 1205 / 1468 },
  { src: "/tiles/frame-3.webp", ratio: 1205 / 1577 },
];

// De maat van het embleem. Het licht erachter (EmblemLight) rekent in
// percentages van deze maat via --em, dus alles schaalt als één geheel.
const EMBLEM_SIZE = "clamp(112px, calc(64vh - 315px), 215px)";

// De goudreeks: donker, midden, licht, fel. Rand, cijfer en gloed komen hier
// allemaal uit, en daarom horen ze bij elkaar.
const GOUD = ["#4A2E04", "#B07C17", "#FFC23D", "#FFEBB8"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: font.ui,
  fontSize: 16,
  color: colors.ink,
  background: withAlpha("#000000", 0.25),
  border: `1.5px solid ${colors.panelBorder}`,
  borderRadius: radius.button,
  padding: "13px 15px",
};

/** Seconden tot middernacht: de dagronde loopt tot de dagwissel. */
function secTotMiddernacht(): number {
  const nu = new Date();
  const morgen = new Date(nu);
  morgen.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((morgen.getTime() - nu.getTime()) / 1000));
}

/** Alleen cijfers, u:mm:ss. Onder een icoon is er geen ruimte voor woorden en
 *  is een klok ook zonder uitleg duidelijk. */
function dagKlok(s: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const u = Math.floor(s / 3600);
  return `${u}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function Landing({
  game,
  onShowRules,
  onShowSettings,
  onShowShop,
  onShowTraining,
  onShowDaily,
  onShowDuel,
  onShowProfile,
}: {
  game: GameApi;
  onShowRules: () => void;
  onShowSettings: () => void;
  onShowShop: () => void;
  onShowTraining: () => void;
  onShowDaily: () => void;
  onShowProfile: () => void;
  onShowDuel: () => void;
}) {
  const { t } = useT();
  const skin = useTileSkin();
  // De lijst meet zichzelf, en omdat hij de kaart precies vult is dat meteen de
  // maat van de kaart. Daar kiezen we de passende maat art bij.
  const card = useRef<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState(FRAMES[0].src);
  useEffect(() => {
    const el = card.current;
    if (!skin || !el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (!r.height) return;
      const want = r.width / r.height;
      let best = FRAMES[0];
      for (const f of FRAMES) if (Math.abs(f.ratio - want) < Math.abs(best.ratio - want)) best = f;
      setFrame(best.src);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [skin]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"none" | "join">("none");
  const [showFriends, setShowFriends] = useState(false);
  const account = game.state.account;

  // First-visit guests (no account, no stored token) get a prominent prompt to
  // make a profile. Returning users with a token skip it (avoids a flash).
  const [toonGids, setToonGids] = useState(false);
  const [uitslagOpen, setUitslagOpen] = useState(false);
  // De aftelling onder het uitslagicoon. Opnieuw UITREKENEN per tik en niet
  // aftrekken: een telefoon in de slaapstand bevriest zijn timers, en dan zou
  // een aftrekker na het ontwaken achterlopen.
  const [dagOver, setDagOver] = useState(secTotMiddernacht);
  useEffect(() => {
    const id = window.setInterval(() => setDagOver(secTotMiddernacht()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // De uitleg-knop verdwijnt een week na aanmelden. Twee toestanden, want een
  // knop die zomaar weg is voelt als een fout: eerst speelt hij de implosie
  // (een halve seconde), daarna is hij er niet meer en schuift de
  // dagronde-uitslag op zijn plek. Zonder account blijft hij staan: een gast
  // heeft de uitleg juist nodig.
  const WEEK = 7 * 24 * 3600;
  const oudGenoeg = !!account?.created_at && Date.now() / 1000 - account.created_at > WEEK;
  const [hulpImplodeert, setHulpImplodeert] = useState(false);
  const [hulpWeg, setHulpWeg] = useState(() => {
    try { return localStorage.getItem("penneer.hulpWeg") === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (!oudGenoeg || hulpWeg || hulpImplodeert) return;
    // Even wachten tot de main page staat: een implosie tijdens het opbouwen
    // van het scherm zie je niet.
    const start = window.setTimeout(() => setHulpImplodeert(true), 1400);
    return () => window.clearTimeout(start);
  }, [oudGenoeg, hulpWeg, hulpImplodeert]);
  useEffect(() => {
    if (!hulpImplodeert) return;
    const klaar = window.setTimeout(() => {
      setHulpWeg(true);
      try { localStorage.setItem("penneer.hulpWeg", "1"); } catch { /* prima */ }
    }, 520);
    return () => window.clearTimeout(klaar);
  }, [hulpImplodeert]);
  const [showPrompt, setShowPrompt] = useState(() => {
    try {
      return !localStorage.getItem("penneer.accountToken") && !profilePromptSeen();
    } catch {
      return false;
    }
  });

  // Install prompt: after the profile prompt is out of the way, first-time
  // visitors who can actually install get one nudge (iPhone: the share-route
  // steps; Android/desktop: the real install button). Dismiss once = never
  // auto-shown again (Settings keeps the install path). ?installdemo=ios|
  // chromeios|inapp|android previews a variant.
  const [installVariant, setInstallVariant] = useState<InstallVariant | null>(() => {
    try {
      const demo = new URLSearchParams(window.location.search).get("installdemo");
      if (demo === "ios" || demo === "chromeios" || demo === "inapp" || demo === "android") return demo;
    } catch {
      /* ignore */
    }
    return null;
  });
  useEffect(() => {
    if (installVariant || showPrompt) return;
    if (isStandalone() || installPromptSeen()) return;
    const resolve = (): InstallVariant | null => {
      if (isIosInAppBrowser()) return "inapp";
      if (isIosChrome()) return "chromeios";
      if (isIos()) return "ios";
      if (canInstall()) return "android";
      return null;
    };
    const id = setTimeout(() => setInstallVariant(resolve()), 900);
    // beforeinstallprompt can fire after our timeout; catch late arrivals.
    const off = onInstallChange(() => {
      if (!installPromptSeen() && !isStandalone()) setInstallVariant((v) => v ?? resolve());
    });
    return () => {
      clearTimeout(id);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPrompt]);

  // With a profile the server uses the account name; guests type one.
  const effectiveName = account ? account.name : name.trim();
  const canCreate = effectiveName.length > 0;
  const canJoin = effectiveName.length > 0 && code.trim().length === 4;

  // Het telknopje op de Dagronde-tegel: hoeveel onderdelen je vandaag nog te
  // gaan hebt. De dagronde bestaat uit twee losse potjes, woorden en topografie,
  // dus dat zijn er twee, een of geen. Accounts halen het bij de server; een
  // gast heeft alleen zijn eigen kopie in de opslag. Bij een fout geen knopje.
  const [dailyLeft, setDailyLeft] = useState(0);
  useEffect(() => {
    const tok = localStorage.getItem("penneer.accountToken");
    const lokaal = (sleutel: string, dag: string) => {
      try {
        const saved = JSON.parse(localStorage.getItem(sleutel) || "null");
        return !!saved && saved.day === dag;
      } catch {
        return false;
      }
    };
    fetch("/api/daily/info", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => r.json())
      .then((d) => {
        const woorden = !!d.played || lokaal("penneer.dailyResult", d.day);
        const topo = !!d.topo_played || lokaal("penneer.topoResult", d.day);
        // Drie onderdelen sinds de arena erbij kwam. De arena kent geen
        // "af": één afgeronde poging is genoeg om hem niet meer te tellen.
        const arena = !!d.arena_played;
        setDailyLeft((woorden ? 0 : 1) + (topo ? 0 : 1) + (arena ? 0 : 1));
      })
      .catch(() => {});
  }, []);

  // Hetzelfde knopje op de Duel-tegel: hoeveel duels op jouw beurt wachten.
  const [duelLeft, setDuelLeft] = useState(0);
  useEffect(() => {
    if (!account) {
      setDuelLeft(0);
      return;
    }
    const tok = localStorage.getItem("penneer.accountToken");
    fetch("/api/duel/info", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => r.json())
      .then((d) => setDuelLeft(Number(d.pending) || 0))
      .catch(() => {});
  }, [account?.id]);

  // Today's missions (progress for accounts; guests see them with a nudge).
  // Lives behind the Target icon in the top bar; the badge counts what's open.
  const [missions, setMissions] = useState<{ key: string; target: number; reward: number; coins: number; cash?: number; progress: number; done: boolean }[] | null>(null);
  const [showMissions, setShowMissions] = useState(false);
  const fetchMissions = () => {
    const tok = localStorage.getItem("penneer.accountToken");
    fetch("/api/missions", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => r.json())
      .then((d) => {
        setMissions(d.missions);
      })
      .catch(() => {});
  };
  // Refetch when the account state flips (login/creation while on Landing).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchMissions, [account?.id]);
  const missionsOpen = account && missions ? missions.filter((m) => !m.done).length : 0;

  // One entry point for both tiles: friends go through the choice sheet, the
  // CPU tile creates straight away and flags the room so the lobby offers
  // computer players there and nowhere else.
  const createRoom = (cpu: boolean) => {
    sound.unlock();
    sound.uiTap();
    setShowFriends(false);
    game.createRoom(effectiveName, cpu);
  };
  const join = () => {
    sound.unlock();
    sound.uiTap();
    game.joinRoom(code.trim().toUpperCase(), effectiveName);
  };

  return (
    <Screen>
      {/* The icon column on the right is absolutely placed: it is three rows tall
          and would otherwise push the whole hero down by ~80px, which is the
          difference between fitting on a small phone and not. It is a narrow
          strip at the edge, so it never collides with the centred logo. */}
      {/* zIndex 6: de voorste stralen van het logo staan op 5 en zijn een
          laag met inset 0, dus zonder eigen hoogte zakken de pillen daaronder
          weg en worden ze wazig overstraald. */}
      <div style={{ position: "relative", zIndex: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 4 }}>
        {/* Coins sit where the profile chip used to: the profile moved to the
            avatar on the right, and the shop is in the bottom bar now. */}
        {/* Twee munten, twee pillen naast elkaar. Cash is de zeldzame, dus hij
            staat rechts van coins en is smaller: je hebt er altijd minder van,
            en dat mag je aan de pil zien. Allebei brengen ze je naar de winkel. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => { sound.uiTap(); onShowShop(); }}
            aria-label={t("coinsTitle")}
            className="pressable"
            style={
              skin
                ? { position: "relative", border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "block", lineHeight: 0 }
                : { display: "inline-flex", alignItems: "center", gap: 6, background: withAlpha(colors.gold, 0.12), border: `1px solid ${withAlpha(colors.gold, 0.4)}`, borderRadius: 999, cursor: "pointer", padding: "4px 12px 4px 5px" }
            }
          >
            {skin ? (
              <CoinPlate coins={account?.coins ?? 0} height={34} />
            ) : (
              <>
                <img src="/coin.webp" alt="" width={24} height={24} style={{ display: "block" }} />
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: colors.gold }}>{account?.coins ?? 0}</span>
              </>
            )}
          </button>
          {account && (
            <button
              onClick={() => { sound.uiTap(); onShowShop(); }}
              aria-label={t("cashTitle")}
              className="pressable"
              style={
                skin
                  ? { position: "relative", border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "block", lineHeight: 0 }
                  : { display: "inline-flex", alignItems: "center", gap: 5, background: withAlpha(GROEN[1], 0.14), border: `1px solid ${withAlpha(GROEN[2], 0.45)}`, borderRadius: 999, cursor: "pointer", padding: "4px 11px 4px 4px" }
              }
            >
              {skin ? (
                <CashPlate cash={account.cash ?? 0} height={34} />
              ) : (
                <>
                  <img src="/ui/valuta/cash.webp?v=1" alt="" width={22} height={22} style={{ display: "block" }} />
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: GROEN[3] }}>{account.cash ?? 0}</span>
                </>
              )}
            </button>
          )}
        </div>
        {/* De uitslag aan de LINKERkant, gespiegeld: de spiegel laat de art
            het scherm in kijken in plaats van eruit. Alleen het plaatje is
            gespiegeld; de cijfers eronder natuurlijk niet. */}
        {/* Strak onder de kleine ad (die eindigt rond y 113) en tegen de
            schermrand: het Screen-vak heeft 16px padding, dus -12 zet de art
            op 4px van de rand in plaats van tegen het logo aan. */}
        <div style={{ position: "absolute", top: 118, left: -12, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <button
            onClick={() => { sound.uiTap(); setUitslagOpen(true); }}
            aria-label={t("dagUitslagTitel")}
            className="pressable glowhover"
            style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: 0, lineHeight: 0 }}
          >
            <img
              src="/ui/dagronde-uitslag.webp?v=2"
              alt=""
              style={{ width: 58, height: 58, objectFit: "contain", display: "block", transform: "scaleX(-1)", filter: "drop-shadow(0 3px 8px rgba(0,0,0,.5))" }}
            />
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 11, lineHeight: 1, letterSpacing: 0.3, color: colors.gold, fontVariantNumeric: "tabular-nums", textShadow: "0 1px 3px rgba(0,0,0,.75)" }}>
              {dagKlok(dagOver)}
            </span>
          </button>
        </div>
        {/* right cluster is a column so the music mute note sits UNDER the gear */}
        <div style={{ position: "absolute", top: 4, right: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={onShowSettings}
            aria-label={t("settings")}
            className="pressable glowhover"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: skin ? colors.ink : colors.sub, display: "flex", padding: skin ? 0 : 9, lineHeight: 0 }}
          >
            <HexPlate on={skin}>
              <SettingsIcon size={24} />
            </HexPlate>
          </button>
          </div>
          {/* De muziekknop is van de main page af: hij staat in Instellingen,
              en vier knoppen in een kolom naast het logo is er een te veel. Het
              vraagteken schuift op naar zijn plek en de dagronde-uitslag neemt
              de onderste over.

              Het vraagteken IMPLODEERT een week na aanmelden: wie er dan nog
              zit heeft de uitleg niet meer nodig, en dan schuift de uitslag
              vanzelf een plek op. */}
          {!hulpWeg && (
            <button
              onClick={() => { sound.uiTap(); onShowRules(); }}
              aria-label={t("howItWorks")}
              className={`pressable glowhover${hulpImplodeert ? " hex-implode" : ""}`}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: skin ? colors.ink : colors.sub, display: "flex", padding: skin ? 0 : 9, lineHeight: 0 }}
            >
              <HexPlate on={skin}>
                <HelpCircle size={24} />
              </HexPlate>
            </button>
          )}
          {/* De dagronde-uitslag: vrijstaande art, dus geen plaat eronder. Hij
              schuift omhoog zodra het vraagteken weg is. */}
          {/* Het missieschild op de onderste plek van de kolom: naast het
              tandwiel stond eigen art er gedrongen bij. Hij schuift omhoog
              zodra het vraagteken implodeert, zoals de uitslag eerst deed. */}
          <button
            onClick={() => {
              sound.uiTap();
              if (!missions) fetchMissions(); // first fetch may have failed offline
              setShowMissions(true);
            }}
            aria-label={t("missionsTitle")}
            className={`pressable glowhover${hulpWeg ? " uitslag-omhoog" : ""}`}
            style={{ position: "relative", background: "transparent", border: "none", cursor: "pointer", display: "flex", padding: 0, lineHeight: 0 }}
          >
            <img
              src="/ui/missie-dag.webp?v=1"
              alt=""
              style={{ height: 48, width: "auto", display: "block", filter: "drop-shadow(0 3px 8px rgba(0,0,0,.5))" }}
            />
            {missionsOpen > 0 && (
              <CountBadge n={missionsOpen} x="calc(100% - 6px)" y="2px" size={16} />
            )}
          </button>
        </div>
      </div>
      <LandingFX />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, paddingTop: 0 }}>
        <div className="reveal-rise" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0" }}>
          {/* Hero light: breathing radial glow + slow rays + rising dust, all
              behind the logo/title (zIndex layering, transform-only motion). */}
          {/* overflow hidden keeps the dust inside the hero box (and any wide
              decor from ever widening the page). */}
          <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 0, overflow: "hidden" }}>
            {/* Warm goudstof, alleen aan de randen: het midden blijft leeg. */}
            {[
              { l: "16%", t: "64%", s: 3, c: colors.gold, d: 0, dur: 7 },
              { l: "84%", t: "60%", s: 2.5, c: colors.goldHi, d: 1.8, dur: 8 },
              { l: "11%", t: "34%", s: 2.5, c: colors.gold, d: 3.2, dur: 9 },
              { l: "88%", t: "30%", s: 3, c: colors.gold, d: 4.4, dur: 7.5 },
              { l: "26%", t: "76%", s: 2, c: colors.goldHi, d: 2.4, dur: 8.5 },
              { l: "74%", t: "80%", s: 2, c: colors.gold, d: 5.4, dur: 7 },
            ].map((p, i) => (
              <span
                key={i}
                className="hero-particle"
                style={{
                  left: p.l,
                  top: p.t,
                  width: p.s,
                  height: p.s,
                  background: p.c,
                  boxShadow: `0 0 ${p.s * 2.4}px ${withAlpha(p.c, 0.85)}`,
                  animationDelay: `${p.d}s`,
                  animationDuration: `${p.dur}s`,
                }}
              />
            ))}
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            {/* The logo IS the light source: breathing glow + slowly rotating
                rays centered on the coin, logo floating on top of them. */}
            {/* Het licht zit BINNEN de zwevende laag, niet ernaast: het gat in de
                gloed valt samen met de binnenring van de munt, en als de munt
                deint en het licht niet, dan schuift dat gat van de ring af. Nu
                deinen ze samen. */}
            <div style={{ position: "relative", display: "grid", placeItems: "center", ["--em" as string]: EMBLEM_SIZE }}>
              <div style={{ position: "relative", isolation: "isolate", animation: "float-soft 4s ease-in-out infinite" }}>
                <EmblemLight />
                <Logo glow={false} size={EMBLEM_SIZE} />
              </div>
              {/* De voorste stralen. Die kunnen NIET in de zwevende doos hierboven
                  staan: die is een eigen stapelcontext (`isolation: isolate`), dus
                  alles erin blijft eronder gevangen en zou nooit over het
                  woordmerk komen. Als eigen laag met een z-index erbovenop wel:
                  de woorden zijn positioned met z-index auto, dus die verliezen
                  hiervan wat er ook in de HTML-volgorde staat.
                  Zelfde animatie en zelfde duur als de munt, en ze beginnen op
                  hetzelfde moment, dus ze deinen samen. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 5,
                  pointerEvents: "none",
                  animation: "float-soft 4s ease-in-out infinite",
                }}
              >
                <EmblemLightFront />
              </div>
            </div>
            <h1
              style={{
                // Negatief, zodat het woordmerk tegen het embleem aan kruipt en
                // de twee als één merk lezen in plaats van als twee dingen.
                margin: "-64px 0 0",
                // Cybergame (the studio face, already italic-shaped) is only
                // this wordmark; vw-clamped so it never clips small phones.
                // Cybergame is a very condensed face: it needs a much larger
                // px size than Space Grotesk did to span the same hero width.
                fontFamily: "'Cybergame', 'Space Grotesk', sans-serif",
                fontWeight: 400,
                fontSize: "min(76px, 18vw, 8.8vh)",
                letterSpacing: "0.14em",
                whiteSpace: "nowrap",
              }}
            >
              {/* Zelfde behandeling als de letter op de rol, maar met de LICHTE
                  variant van het verloop: het loopt van bijna wit naar licht
                  violet en niet door naar donker paars. Losse letters op een
                  donkere achtergrond hebben geen verlicht vlak onder zich, dus
                  een donker uiteinde valt daar gewoon weg. De gloed blijft wel de
                  volle violet, die zit erachter en hoeft niet leesbaar te zijn. */}
              {/* Twee woorden, twee lagen: de spatie uit het font is veel te
                  breed voor een woordmerk. Zo bepaalt `gap` de tussenruimte, en
                  de letterafstand zet ook achter de laatste letter ruimte, dus
                  die halen we er rechts weer af. Anders staat het merk een halve
                  letter naar links. */}
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: "0.03em" }}>
                <NeonText accent="#C3B4FF" depth="light" flat drop={0.13}>
                  PEN
                </NeonText>
                <NeonText accent="#C3B4FF" depth="light" flat drop={0.13} style={{ marginRight: "-0.14em" }}>
                  NEER
                </NeonText>
              </span>
            </h1>
            <p
              style={{
                // Negatief, zodat de tagline dichter onder het woordmerk komt.
                margin: "-12px 0 0",
                textAlign: "center",
                // Bebas Neue: smalle hoofdletters, dus meer letterafstand en een
                // grotere maat, anders leest het als een blokje.
                fontFamily: font.wide,
                fontWeight: 400,
                fontSize: 16.5,
                lineHeight: 1.2,
                letterSpacing: 0.9,
                color: "#CFC6E8",
                maxWidth: 320,
              }}
            >
              {t("tagline")}
            </p>
          </div>
        </div>

        <Card
          className="reveal-rise"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            animationDelay: "0.1s",
            // Met de skin is de kaart de lijst-art: één plaatje, in zijn geheel,
            // alleen geschaald. Niets geknipt, dus ook niets dat op een naad kan
            // gaan lijken.
            ...(skin
              ? {
                  position: "relative",
                  isolation: "isolate",
                  // Iets breder dan de kolom en wat meer lucht boven en onder,
                  // zodat de lijst niet strak om de tegels heen zit.
                  marginInline: -4,
                  padding: "clamp(8px, calc(12.4vh - 74.8px), 26px) 18px clamp(10px, calc(13.8vh - 82.1px), 30px)",
                  background: "none",
                  backdropFilter: "none",
                  WebkitBackdropFilter: "none",
                  // Recht van onderen, zonder zijwaartse verschuiving.
                  boxShadow: "0 12px 22px rgba(0,0,0,.5), 0 3px 6px rgba(0,0,0,.35)",
                  borderRadius: 22,
                  border: "none",
                }
              : {
                  padding: 16,
                  background: "linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.028))",
                  border: "1px solid rgba(255,255,255,.15)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.17), 0 30px 70px rgba(0,0,0,.45), 0 8px 24px rgba(0,0,0,.3)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                }),
          }}
        >
          {/* De lijst, in zijn geheel. `zIndex: -1` houdt hem boven de
              achtergrond van de kaart maar onder de inhoud. */}
          {skin && (
            <img
              ref={card}
              aria-hidden
              alt=""
              src={frame}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: -1, pointerEvents: "none" }}
            />
          )}
          {account ? (
            <p style={{ margin: 0, fontFamily: font.wide, fontSize: 16, letterSpacing: 0.8, color: colors.sub, textAlign: "center" }}>
              {t("playingAs")} <span style={{ color: colors.gold, fontWeight: 700 }}>{account.name}</span>
            </p>
          ) : (
            <input style={inputStyle} placeholder={t("yourName")} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          )}

          {mode === "none" ? (
            // 8 Ball Pool-style square action tiles, in the Pen Neer arcade skin:
            // the hero action is the filled gold tile, the rest each get their
            // own accent. The Dagronde tile carries a gold dot until today's
            // round is played.
            // gridAutoRows stays auto so the wide Duel row sizes to its own
            // content instead of matching the square rows (which would leave a
            // big empty band inside it).
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "auto", gap: 10 }}>
              <Tile
                primary
                disabled={!canCreate}
                onClick={() => {
                  sound.uiTap();
                  setShowFriends(true);
                }}
                art="friends"
                icon={<Play size={30} strokeWidth={2.2} fill="currentColor" />}
                label={t("playFriends")}
              />
              <Tile
                accent={colors.violet}
                disabled={!canCreate}
                onClick={() => createRoom(true)}
                art="bots"
                icon={<Bot size={30} strokeWidth={2.2} />}
                label={t("playCpu")}
              />
              <Tile
                accent={colors.orange}
                onClick={() => {
                  sound.uiTap();
                  onShowDaily();
                }}
                art="daily"
                icon={<CalendarDays size={30} strokeWidth={2.2} />}
                label={t("dailyTitle")}
                badge={dailyLeft}
              />
              <Tile
                accent={colors.green}
                onClick={() => {
                  sound.uiTap();
                  onShowTraining();
                }}
                art="train"
                icon={<GraduationCap size={30} strokeWidth={2.2} />}
                label={t("trainTitle")}
              />
              {/* Duel is (nog) een oneven vijfde: hij loopt over beide kolommen
                  tot Toernooi de zesde slot vult, en dan wordt dit vanzelf een
                  net 2x3-raster. */}
              <Tile
                wide
                accent={colors.red}
                art="duel"
                onClick={() => {
                  sound.uiTap();
                  onShowDuel();
                }}
                icon={<Swords size={26} strokeWidth={2.2} />}
                label={t("duelTitle")}
                badge={duelLeft}
              />
            </div>
          ) : (
            <>
              <input
                style={{ ...inputStyle, fontFamily: font.display, letterSpacing: 6, textAlign: "center", textTransform: "uppercase" }}
                placeholder={t("code")}
                value={code}
                maxLength={4}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              />
              <Button variant="primary" full disabled={!canJoin} onClick={join}>
                {t("join")}
              </Button>
              <Button variant="ghost" full onClick={() => setMode("none")}>
                {t("back")}
              </Button>
            </>
          )}
        </Card>

        {/* De werf-advertentie. Voorlopig ALLEEN op het account waarmee getest
          wordt: hij is af, maar hij gaat pas voor iedereen aan als hij op een
          echt toestel goed staat. Een naam-vergelijking is genoeg, want er kan
          maar een account met die naam bestaan. */}
      {/* De werf-advertentie staat open voor iedereen met een profiel: gasten
          hebben geen werfcode om te delen. */}
      {account && <ReferralAd />}

      {game.state.error && (
          <p style={{ textAlign: "center", color: colors.red, fontFamily: font.ui, fontSize: 14, margin: 0 }}>{game.state.error}</p>
        )}

        <NotifyNudge />
      </div>

      {showFriends && (
        <FriendsSheet
          onCreate={() => createRoom(false)}
          onJoin={() => { sound.uiTap(); setShowFriends(false); setMode("join"); }}
          onClose={() => setShowFriends(false)}
        />
      )}
      {showPrompt && !account && <ProfilePrompt game={game} onClose={(aangemaakt) => { setShowPrompt(false); if (aangemaakt) setToonGids(true); }} />}
      {uitslagOpen && <DagUitslagPopup game={game} onClose={() => setUitslagOpen(false)} />}
      {toonGids && account && <ProfielGids account={account} onNaarProfiel={() => { setToonGids(false); onShowProfile(); }} onLater={() => setToonGids(false)} />}
      {installVariant && !showPrompt && <InstallPrompt variant={installVariant} onClose={() => setInstallVariant(null)} />}
      {/* De missies hebben nu drie lagen (dag, week, seizoen) en een eigen
          popup met de sectie-art. MissionsSheet toonde alleen de dag. */}
      {showMissions && <MissiesPopup onClose={() => { setShowMissions(false); fetchMissions(); }} />}
    </Screen>
  );
}

// "Speel met vrienden" asks the one question that tile leaves open: are you the
// one starting the room, or joining someone else's? Both paths already existed;
// this only puts the choice in front of them instead of on two separate tiles.
function FriendsSheet({
  onCreate,
  onJoin,
  onClose,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const skin = useTileSkin();
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(6,3,18,.78)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 22 }}
    >
      <div
        className="pop-in"
        onClick={(e) => e.stopPropagation()}
        style={
          skin
            ? { position: "relative", isolation: "isolate", width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12, padding: "30px 26px 24px", textAlign: "center" }
            : { position: "relative", width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12, padding: "24px 20px 18px", borderRadius: 24, background: "linear-gradient(180deg, #2a1c48, #160D30)", border: `1px solid ${withAlpha(colors.gold, 0.45)}`, boxShadow: "0 24px 80px rgba(0,0,0,.6)", textAlign: "center" }
        }
      >
        {skin && (
          <img aria-hidden alt="" src="/tiles/frame-popup.webp" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: -1, pointerEvents: "none", filter: "drop-shadow(0 18px 40px rgba(0,0,0,.55))" }} />
        )}
        {/* De lijst-art heeft zijn eigen hoekbeslag, dus het kruis moet net wat
            verder naar binnen dan de doosrand om in de hoek te vallen in plaats
            van erop. */}
        <button onClick={onClose} aria-label={t("back")} style={{ position: "absolute", top: 12, right: 19, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
          <CloseIcon size={26} />
        </button>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, color: colors.gold }}>{t("friendsSheetTitle")}</span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.5 }}>{t("friendsSheetBody")}</p>
        <Button variant="primary" full onClick={onCreate}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Play size={17} strokeWidth={2.4} fill="currentColor" /> {t("createRoom")}
          </span>
        </Button>
        <Button variant="ghost" full onClick={onJoin}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Hash size={17} strokeWidth={2.4} /> {t("joinCta")}
          </span>
        </Button>
      </div>
    </div>
  );
}

// Square 8BP-style action tile: big glowing icon + label. `primary` renders the
// filled gold hero tile (gloss, shimmer sweep, occasional sparkle); the rest
// get a glassy panel with their own ambient accent glow. Fixed icon/label
// slots keep all four tiles pixel-identical in height and alignment.
/** Het gouden telknopje op een tegel: hoeveel er nog te doen is.
 *
 *  Een muntje, geen gekleurd rondje. De reeks is dezelfde als overal: donker
 *  goud voor de rand, middengoud voor de bodem, licht en fel voor de kant waar
 *  het licht op valt. Het cijfer is bijna-zwart met een glansje aan de
 *  bovenkant, want dat leest op goud beter dan wit met een schaduw.
 *
 *  `x` en `y` zijn waar het MIDDEN komt te liggen, in de doos van de tegel. Ze
 *  worden van buiten meegegeven omdat elke plaat zijn eigen afschuining heeft
 *  (zie TILE_ART). */
function CountBadge({ n, x, y, size = 23 }: { n: number; x: string; y: string; size?: number }) {
  // Het cijferknopje is de gouden zeshoek uit de UI-map. De knoppen hierboven
  // (instellingen, muziek, uitleg) houden hun eigen paarse plaat: die zijn
  // knoppen om op te drukken, dit is een melding, en dat verschil mag je zien.
  return (
    <span
      aria-hidden
      style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", pointerEvents: "none" }}
    >
      <HexArt maat={size}>
        <span
          style={{
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: Math.round(size * 0.52),
            lineHeight: 1,
            // Een cijfer staat op de basislijn en laat onder zich ruimte voor
            // staartletters. Centreer je de REGEL, dan hangt het cijfer net te
            // hoog; dit zet het optisch in het midden.
            marginTop: Math.max(1, Math.round(size * 0.05)),
            color: GOUD[3],
            textShadow: "0 1px 2px rgba(8,3,20,.85)",
          }}
        >
          {n}
        </span>
      </HexArt>
    </span>
  );
}

function Tile({
  icon,
  label,
  onClick,
  accent = colors.gold,
  primary = false,
  disabled = false,
  badge = 0,
  wide = false,
  art,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: string;
  primary?: boolean;
  disabled?: boolean;
  /** Hoeveel er nog te doen is. 0 is geen knopje. */
  badge?: number;
  wide?: boolean;
  /** Welke plaat deze tegel krijgt als de platen-skin aanstaat. */
  art?: string;
}) {
  const skin = useTileSkin();
  const base: React.CSSProperties = {
    position: "relative",
    // Flatter than square. The grid is two columns wide, so a narrower tile
    // buys nothing: what costs a small phone its bottom row is HEIGHT. A wide
    // tile spans both columns and lies down instead, so a fifth mode fits
    // without pushing anything off screen.
    aspectRatio: wide ? undefined : "1 / 0.72",
    width: "100%",
    height: "100%",
    gridColumn: wide ? "1 / -1" : undefined,
    borderRadius: radius.card,
    display: "flex",
    flexDirection: wide ? "row" : "column",
    alignItems: "center",
    justifyContent: "center",
    gap: wide ? 10 : 6,
    padding: wide ? "13px 12px" : 10,
    cursor: disabled ? "default" : "pointer",
    fontFamily: font.display,
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 1.22,
    letterSpacing: 0.2,
    textAlign: "center",
    opacity: disabled ? 0.45 : 1,
    overflow: "hidden",
  };
  const iconSlot: React.CSSProperties = wide
    ? { display: "grid", placeItems: "center", flexShrink: 0 }
    : { height: 38, display: "grid", placeItems: "center", flexShrink: 0 };
  const labelSlot: React.CSSProperties = wide
    ? { display: "flex", alignItems: "center" }
    : { minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center" };
  // ---- de platen-skin ----
  // Een proef die alleen de admin aanzet. De plaat IS de knop: rand, vulling,
  // licht en icoon zitten al in de art, dus er wordt niets omheen getekend. Het
  // label komt er alleen op als het niet al in de plaat staat (de Duel-plaat
  // heeft zijn woord al).
  const tile = art ? TILE_ART[art] : undefined;
  if (skin && tile) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="pressable"
        style={{
          position: "relative",
          width: "100%",
          gridColumn: wide ? "1 / -1" : undefined,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.45 : 1,
          display: "block",
          lineHeight: 0,
        }}
      >
        {/* De schaduw is een eigen plaatje, geen CSS-effect. Zie `plateShadow`. */}
        <img aria-hidden src={shadowSrc(tile.src)} alt="" style={plateShadow} />
        {/* Vaste verhouding, zodat alle tegels even groot zijn ook voordat de
            plaat geladen is. De vier vierkante platen staan op een gedeeld doek
            (zie public/tiles); de Duel-balk heeft zijn eigen, bredere maat. */}
        <img
          src={tile.src}
          alt=""
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: wide ? "900 / 190" : "720 / 520",
            display: "block",
          }}
        />
        {tile.label && (
          <span
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              // Het icoon staat in de bovenhelft; het label hoort in de lege
              // ruimte eronder, met zijn MIDDEN op de lijn uit TILE_ART.
              top: tile.labelY ?? "66%",
              transform: "translateY(-50%)",
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: "clamp(13px, 4vw, 17px)",
              lineHeight: 1.15,
              letterSpacing: 0.2,
              textAlign: "center",
              color: tile.dark ? "#171006" : "#FFF6E2",
              textShadow: tile.dark
                ? "0 1px 0 rgba(255,240,190,.5)"
                : "0 2px 6px rgba(0,0,0,.65), 0 0 14px rgba(0,0,0,.5)",
            }}
          >
            {label}
          </span>
        )}
        {badge > 0 && (
          <CountBadge n={badge} x={tile.badgeX ?? "94%"} y={tile.badgeY ?? "7%"} />
        )}
      </button>
    );
  }

  if (primary) {
  // De hoofdknop is gepolijst goud, geen geel vlak. Dat is een STAPELING, want
    // een enkel verloop kan geen metaal zijn: metaal heeft een lichte bovenrand,
    // een felle kern, een donkere onderkant en een harde glans vlak onder de
    // rand. Van onder naar boven:
    //   1. de basisreeks, van licht goud bovenaan naar donker brons onderaan;
    //   2. randverdonkering, zodat het vlak bol lijkt in plaats van vlak;
    //   3. een zachte oplichting in het bovenste midden, waar het licht valt;
    //   4. een dun glansstreepje over de bovenrand.
    // De randen zijn geen `border` maar een laag eronder met een eigen verloop en
    // vier kleine glanspunten in de hoeken, want een border kan geen verloop.
    // Bewust GEEN gloed om de knop: al het licht blijft binnen de knop zelf.
    const face = [
      "linear-gradient(180deg, rgba(255,243,181,.62) 0%, rgba(255,243,181,.14) 7%, transparent 20%)",
      "radial-gradient(66% 44% at 50% 14%, rgba(255,243,181,.42) 0%, transparent 68%)",
      "radial-gradient(125% 105% at 50% 46%, transparent 52%, rgba(107,52,0,.38) 100%)",
      "linear-gradient(180deg, #FFD95A 0%, #FFC72C 20%, #F6A800 50%, #C97700 80%, #8F4B00 100%)",
    ].join(", ");
    const rim = [
      "radial-gradient(58% 58% at 4% 5%, rgba(255,243,181,.95) 0%, transparent 62%)",
      "radial-gradient(58% 58% at 96% 5%, rgba(255,243,181,.82) 0%, transparent 62%)",
      "radial-gradient(58% 58% at 4% 95%, rgba(255,243,181,.32) 0%, transparent 62%)",
      "radial-gradient(58% 58% at 96% 95%, rgba(255,243,181,.32) 0%, transparent 62%)",
      "linear-gradient(180deg, #FFE9A8 0%, #F6A800 40%, #C97700 72%, #6B3400 100%)",
    ].join(", ");
    const { borderRadius, aspectRatio, width, height, gridColumn, ...faceBox } = base;
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="pressable"
        style={{
          position: "relative",
          aspectRatio,
          width,
          height,
          gridColumn,
          borderRadius,
          padding: 2,
          border: "none",
          backgroundImage: rim,
          cursor: disabled ? "default" : "pointer",
          // Alleen een zachte slagschaduw en een donkere onderlip. Geen gloed.
          boxShadow: "0 5px 12px rgba(0,0,0,.45), 0 2px 0 rgba(107,52,0,.9)",
        }}
      >
        <span
          style={{
            ...faceBox,
            width: "100%",
            height: "100%",
            borderRadius: (borderRadius as number) - 2,
            color: "#2A1B05",
            backgroundImage: face,
            // De afschuining: lichte bovenrand, donkere onderrand, en zacht licht
            // dat naar binnen wegvalt.
            boxShadow:
              "inset 0 1.5px 0 rgba(255,243,181,.9), inset 0 -3px 0 rgba(107,52,0,.6), inset 0 10px 16px rgba(255,199,44,.22), inset 0 -12px 18px rgba(107,52,0,.32)",
          }}
        >
          <span aria-hidden className="shimmer-bar" />
          <Sparkles aria-hidden className="twinkle" size={14} color="#FFF8E0" style={{ position: "absolute", top: 10, right: 10 }} />
          <span style={{ ...iconSlot, filter: "drop-shadow(0 1px 0 rgba(255,243,181,.55))" }}>{icon}</span>
          <span style={labelSlot}>{label}</span>
        </span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="pressable panel-neon"
      style={{
        ...base,
        // Dezelfde ring en belichting als de panelen, maar in de kleur van deze
        // tegel. De reeks wordt uit het accent afgeleid, dus dit werkt net zo
        // goed in goud, groen of rood.
        ...neonSkin(accent),
        color: colors.ink,
        background: `linear-gradient(160deg, ${withAlpha(accent, 0.22)} 0%, ${withAlpha("#000000", 0.26)} 58%, ${withAlpha("#000000", 0.34)} 100%)`,
        boxShadow: `inset 0 -14px 24px rgba(0,0,0,.2), 0 14px 32px rgba(0,0,0,.32), 0 6px 22px ${withAlpha(accent, 0.16)}`,
      }}
    >

      <span style={{ ...iconSlot, color: accent, filter: `drop-shadow(0 0 11px ${withAlpha(accent, 0.6)})` }}>{icon}</span>
      <span style={labelSlot}>{label}</span>
      {badge > 0 && <CountBadge n={badge} x="calc(100% - 14px)" y="14px" />}
    </button>
  );
}

// Fixed full-screen decor behind the landing content: two layers drifting in
// opposite directions (cheap parallax depth) carrying barely-visible alphabet
// letters and a few static dust specks. zIndex -1 keeps it above the body
// gradient but under everything interactive; pointer-events stay off.
/** Het decor achter de main page: de achtergrond-art, met daarboven letters die
 *  zweven.
 *
 *  De art loopt van de bovenkant tot de onderkant van het scherm. Hij is liggend
 *  (3:2) en het scherm staat rechtop, dus `cover` schaalt hem op hoogte en
 *  snijdt links en rechts bij; niets wordt uitgerekt.
 *
 *  Stof en stralen zitten al in de art, dus die tekenen we er niet nog eens
 *  overheen. */
// De zwevende letters. Ze horen zich te gedragen als wolken: langzaam van de
// ene kant naar de andere, en onderweg groter of kleiner alsof ze naar je toe
// komen of van je weg drijven.
//
// Twee dingen maken dat het werkt, en allebei gingen ze eerst mis.
//
// EEN REIS EN GEEN SLINGER. Heen en weer binnen dezelfde cyclus leest niet als
// drijven maar als wiebelen: je ziet de omkeer, en dan weet je dat het een
// animatie is. Nu gaat elke letter een KANT op, van buiten beeld naar buiten
// beeld, en begint dan opnieuw aan de andere kant.
//
// GELIJKMATIG EN NIET VERSNELD. Met `ease-in-out` staat een letter het grootste
// deel van de tijd bijna stil bij zijn uiteinden. Een wolk doet dat niet, dus
// de tijdsfunctie is lineair.
//
// `van`/`naar` is de reis in schermbreedtes, `s0`/`s1` de maat aan begin en
// eind (groter = dichterbij), `op` de dekking op zijn hoogtepunt, en `fase` zet
// ze uit de pas zodat ze niet als een rij langskomen.
const LETTERS: {
  c: string;
  size: number;
  op: number;
  pos: React.CSSProperties;
  rot: number;
  van: string;
  naar: string;
  s0: number;
  s1: number;
  duur: number;
  fase: number;
}[] = [
  // naar rechts, en naar je toe
  { c: "K", size: 250, op: 0.06, pos: { top: "2%", left: "-30%" }, rot: -11, van: "-30vw", naar: "95vw", s0: 0.55, s1: 1.35, duur: 150, fase: -18 },
  { c: "P", size: 130, op: 0.045, pos: { top: "26%", left: "-25%" }, rot: -6, van: "-25vw", naar: "100vw", s0: 0.7, s1: 1.15, duur: 118, fase: -74 },
  { c: "E", size: 190, op: 0.055, pos: { bottom: "6%", left: "-30%" }, rot: -7, van: "-28vw", naar: "98vw", s0: 0.6, s1: 1.4, duur: 176, fase: -40 },
  { c: "S", size: 96, op: 0.04, pos: { top: "62%", left: "-20%" }, rot: -9, van: "-22vw", naar: "104vw", s0: 0.9, s1: 0.6, duur: 132, fase: -108 },
  // naar links, en van je weg
  { c: "N", size: 230, op: 0.055, pos: { top: "38%", right: "-30%" }, rot: 12, van: "30vw", naar: "-100vw", s0: 1.3, s1: 0.6, duur: 164, fase: -60 },
  { c: "M", size: 120, op: 0.04, pos: { top: "9%", right: "-22%" }, rot: 10, van: "24vw", naar: "-102vw", s0: 1.15, s1: 0.7, duur: 126, fase: -12 },
  { c: "R", size: 210, op: 0.06, pos: { bottom: "-2%", right: "-28%" }, rot: 8, van: "28vw", naar: "-98vw", s0: 0.65, s1: 1.3, duur: 190, fase: -132 },
  { c: "A", size: 110, op: 0.038, pos: { bottom: "30%", right: "-20%" }, rot: 5, van: "22vw", naar: "-104vw", s0: 1.2, s1: 0.75, duur: 142, fase: -96 },
];


function LandingFX() {
  const letter = (_op: number): React.CSSProperties => ({
    position: "absolute",
    fontFamily: font.display,
    fontWeight: 700,
    // Een paar procent: net genoeg om te vermoeden, te weinig om te lezen.
    // De dekking komt uit de animatie (hij komt op en gaat weer weg), dus de
    // kleur zelf blijft vol; anders vermenigvuldig je twee keer.
    color: "rgb(206,192,240)",
    opacity: 0,
    userSelect: "none",
    lineHeight: 1,
  });
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
        backgroundImage: "url(/bg-main.webp?v=2)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#06040e",
      }}
    >
      {/* De ovale lichtplek. Binnen de ovaal blijft de art zoals hij is; daar
          waar de ovaal ophoudt begint de fade naar zwart. Hij ligt over de art
          maar onder de letters, zodat die niet mee wegzakken. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(128% 30.8% at 50% 21%, rgba(3,1,10,0) 0%, rgba(3,1,10,0) 30%, rgba(3,1,10,.12) 38%, rgba(3,1,10,.30) 46%, rgba(3,1,10,.52) 55%, rgba(3,1,10,.68) 65%, rgba(3,1,10,.78) 80%, rgba(3,1,10,.82) 100%)",
        }}
      />
      {LETTERS.map((l, i) => (
        <span
          key={i}
          className="letter-drift"
          style={
            {
              ...letter(l.op),
              ...l.pos,
              fontSize: l.size,
              "--van": l.van,
              "--naar": l.naar,
              "--s0": l.s0,
              "--s1": l.s1,
              "--op": l.op,
              "--draai": `${l.rot}deg`,
              animationDuration: `${l.duur}s`,
              animationDelay: `${l.fase}s`,
            } as React.CSSProperties
          }
        >
          {l.c}
        </span>
      ))}
    </div>
  );
}

/* De gids meteen na het aanmaken van je profiel: één kaart, drie stappen, alles
 * overslaanbaar. Hij duwt je nergens doorheen; hij laat zien wat er nog open
 * staat en brengt je met één tik naar de plek waar je het regelt. De vinkjes
 * zijn echt: een foto die er al is, staat aangevinkt. */
function ProfielGids({ account, onNaarProfiel, onLater }: {
  account: NonNullable<GameApi["state"]["account"]>;
  onNaarProfiel: () => void;
  onLater: () => void;
}) {
  const { t } = useT();
  const stappen: { key: string; label: string; af: boolean }[] = [
    { key: "foto", label: t("gidsFoto"), af: !!account.has_avatar || !!account.avatar_preset },
    { key: "kleur", label: t("gidsKleur"), af: false },
    { key: "land", label: t("gidsLand"), af: false },
  ];
  const klaar = stappen.filter((st) => st.af).length;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(6,3,18,.78)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 22 }}>
      <div
        className="pop-in"
        style={{ width: "100%", maxWidth: 330, display: "flex", flexDirection: "column", gap: 12, padding: "22px 18px 16px", borderRadius: 24, background: "linear-gradient(180deg, #2a1c48, #160D30)", border: `1px solid ${withAlpha(colors.gold, 0.45)}`, boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}
      >
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, color: colors.gold, textAlign: "center" }}>{t("gidsKop", { name: account.name })}</span>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5, textAlign: "center" }}>{t("gidsSub")}</p>
        {/* De voortgang: een dunne balk, gevuld naar hoeveel er al staat. */}
        <div style={{ height: 5, borderRadius: 999, background: withAlpha("#000000", 0.4), overflow: "hidden" }}>
          <div style={{ width: `${Math.max(8, (klaar / stappen.length) * 100)}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${withAlpha(colors.gold, 0.7)}, ${colors.gold})`, transition: "width .3s ease" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {stappen.map((st) => (
            <div key={st.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, background: withAlpha("#000000", 0.24), border: `1px solid ${st.af ? withAlpha(colors.green, 0.45) : "rgba(255,255,255,.09)"}` }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", background: st.af ? withAlpha(colors.green, 0.2) : withAlpha("#FFFFFF", 0.06), border: `1px solid ${st.af ? colors.green : "rgba(255,255,255,.18)"}`, color: colors.green }}>
                {st.af && <Check size={11} />}
              </span>
              <span style={{ flex: 1, fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: st.af ? colors.sub : colors.ink }}>{st.label}</span>
            </div>
          ))}
        </div>
        <Button variant="gold" full onClick={() => { sound.uiTap(); onNaarProfiel(); }}>{t("gidsNaarProfiel")}</Button>
        <button onClick={() => { sound.uiTap(); onLater(); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, fontFamily: font.ui, fontSize: 13, padding: 2 }}>
          {t("gidsLater")}
        </button>
      </div>
    </div>
  );
}
