// Landing — emblem, wordmark, tagline, name input, create / join, rules link.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bot, CalendarDays, Check, GraduationCap, Hash, HelpCircle, Play, Settings as SettingsIcon, Sparkles, Swords, Target, X } from "lucide-react";
import { Logo } from "../components/Logo";
import { Button } from "../components/Button";
import { NotifyNudge } from "../components/NotifyNudge";
import { MusicToggle } from "../components/MusicToggle";
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
import { CoinPlate } from "../components/CoinPlate";
import { HexPlate } from "../components/HexPlate";
import { EmblemLight, EmblemLightFront } from "../components/EmblemLight";
import { colors, font, radius, withAlpha } from "../theme/tokens";

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
// De maat van het embleem. Steiler dan een gewone clamp: op een hoog scherm
// blijft hij op zijn volle 215, en zodra het scherm korter wordt krimpt hij snel
// mee. Dat is precies waar de ruimte vandaan moet komen, want de kaart eronder
// heeft een vaste verhouding en kan niet lager zonder ook smaller te worden.
const EMBLEM_SIZE = "clamp(100px, calc(80vh - 452px), 215px)";


// De zeshoek van de knopjes, met de punt naar boven, net als de knopplaten.
const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
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

export function Landing({
  game,
  onShowRules,
  onShowSettings,
  onShowShop,
  onShowTraining,
  onShowDaily,
  onShowDuel,
}: {
  game: GameApi;
  onShowRules: () => void;
  onShowSettings: () => void;
  onShowShop: () => void;
  onShowTraining: () => void;
  onShowDaily: () => void;
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
  // De kaart mag nooit lager staan dan wat er in beeld past: de main page hoort
  // op een scherm te passen zonder te scrollen.
  //
  // Dat is GEMETEN en niet uitgerekend. Een formule zou moeten weten hoe hoog
  // het embleem is, hoe groot het woordmerk uitvalt, of "Speel met vrienden" op
  // een of twee regels komt, welke van de drie maten lijst-art gekozen wordt en
  // hoe hoog de balk onderaan is. Dat zijn vijf dingen die elk hun eigen kant op
  // schalen, en elke constante die je daarvoor kiest klopt op precies een
  // toestel. De ruimte onder de kaart aflezen en de kaart daarnaar breed maken
  // klopt op alle.
  //
  // De bovenkant van de kaart hangt niet af van de kaart zelf (die staat onder
  // het logo in een kolom), dus dit draait niet in zichzelf rond. Wat wel kan
  // veranderen is de VERHOUDING zodra een label anders afbreekt; daarom kijkt
  // een ResizeObserver mee en corrigeert hij na. De drempel van drie pixels
  // voorkomt dat hij tussen twee bijna gelijke maten blijft heen en weer gaan.
  const kaartVak = useRef<HTMLDivElement | null>(null);
  const vorige = useRef<{ w: number; h: number } | null>(null);
  const straf = useRef(0);
  const scherm = useRef("");
  const [kaartMax, setKaartMax] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const meet = () => {
      const vak = kaartVak.current;
      if (!vak) return;
      const kolom = vak.closest("[data-schermkolom]") as HTMLElement | null;
      if (!kolom) return;
      // De ONDERKANT VAN HET SCHERM min de strook die de balk al opeist, niet
      // de onderkant van de kolom: die is precies zo hoog als de inhoud, dus
      // als het niet past staat hij al buiten beeld en meet je je eigen fout.
      //
      // En het KLEINSTE venster van de drie die de browser aanbiedt. Op iOS
      // geeft `innerHeight` de hoogte ZONDER de adresbalk, ook terwijl die er
      // gewoon staat: reken je daarmee, dan maak je de kaart net zo veel te
      // groot als die balk hoog is en moet je alsnog scrollen. `clientHeight`
      // is het venster met de balk erbij, en dat is de maat waarop het moet
      // passen.
      const zicht = Math.min(
        document.documentElement.clientHeight || Infinity,
        window.innerHeight || Infinity,
        window.visualViewport?.height ?? Infinity,
      );
      const onder = zicht - parseFloat(getComputedStyle(kolom).paddingBottom || "0");
      const r = vak.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // Wat de pagina ECHT te veel is. Alle rekenwerk hierboven gaat uit van
      // wat de browser zegt dat er in beeld past, en op een telefoon klopt dat
      // niet altijd: een zwevende balk, een veiligheidsstrook, een adresbalk
      // die er half is. Dit is het enige getal dat niet liegt, want het is het
      // verschijnsel zelf. Het telt op en gaat er nooit meer af binnen hetzelfde
      // scherm, anders krijg je een slinger: krimpen tot het past, dan weer
      // groeien omdat het past, en weer krimpen.
      const teveel = Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight);
      // Pas meetellen als de pagina KLAAR is. Tijdens het laden schuift er van
      // alles: een plaatje dat binnenkomt duwt de boel even te ver door, en die
      // ene tel zou dan voorgoed van de breedte af gaan. En met een dak erop,
      // want een correctie van meer dan zestig pixels betekent dat er iets
      // anders aan de hand is dan een balkje dat niet meegeteld werd.
      if (teveel > 0 && document.readyState === "complete") {
        straf.current = Math.min(60, straf.current + teveel);
      }
      // Zes pixels lucht, zodat de sectie tegen de balk aan komt en er niet op.
      const ruimte = onder - r.top - straf.current - 6;
      if (ruimte <= 0) return;
      // Hoe breed mag de kaart zijn om precies in `ruimte` te passen?
      //
      // Niet "ruimte gedeeld door de huidige verhouding". De hoogte van de kaart
      // is namelijk niet EVENREDIG met de breedte: de tegels schalen mee, maar
      // de regel "je speelt als", de tussenruimtes en de padding niet. In een
      // formule: hoogte = helling x breedte + een vaste voet. Reken je met de
      // verhouding, dan tel je die voet als het ware nog een keer mee en kom je
      // stelselmatig tientallen pixels te smal uit. Dat is precies wat de kaart
      // te klein maakte.
      //
      // Dus: uit twee metingen de HELLING afleiden en daarmee een stap zetten.
      // Na de eerste correctie klopt hij, en verder blijft hij staan. De eerste
      // keer is er nog niets om mee te vergelijken; dan de oude schatting als
      // vertrekpunt.
      const w = r.width;
      const h = r.height;
      const v = vorige.current;
      let wil: number;
      if (v && Math.abs(v.w - w) > 4 && Math.abs(v.h - h) > 1) {
        // Begrensd, want een bijna vlakke helling zou een sprong van duizenden
        // pixels opleveren op een meetfoutje van een halve pixel.
        const helling = Math.min(1.5, Math.max(0.3, (h - v.h) / (w - v.w)));
        wil = w + (ruimte - h) / helling;
      } else {
        wil = (ruimte * w) / h;
      }
      vorige.current = { w, h };
      // GEEN percentage op de uitkomst. Dat lijkt een onschuldige marge, maar
      // het is er een die zichzelf opeet: zodra de kaart precies past is de
      // correctie hierboven nul, en dan houd je elke meting `breedte x 0,98`
      // over. Twee procent, nog eens twee procent, en zo krimpt hij door tot de
      // ondergrens. De lucht die we willen zit al in `ruimte`, en die wordt er
      // maar EEN keer af gehaald.
      wil = Math.min(460, Math.max(220, Math.floor(wil)));
      setKaartMax((oud) => (oud !== undefined && Math.abs(oud - wil) <= 3 ? oud : wil));
    };
    // Een nieuw scherm is een nieuwe rekensom: de opgebouwde correctie hoort
    // bij de maat waarop hij gemeten is.
    const opnieuw = () => {
      const maat = `${window.innerWidth}x${window.innerHeight}`;
      if (maat !== scherm.current) {
        scherm.current = maat;
        straf.current = 0;
        vorige.current = null;
      }
      meet();
    };
    opnieuw();
    const ro = new ResizeObserver(meet);
    if (kaartVak.current) ro.observe(kaartVak.current);
    window.addEventListener("resize", opnieuw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", opnieuw);
    };
  }, []);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"none" | "join">("none");
  const [showFriends, setShowFriends] = useState(false);
  const account = game.state.account;

  // First-visit guests (no account, no stored token) get a prominent prompt to
  // make a profile. Returning users with a token skip it (avoids a flash).
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
        setDailyLeft((woorden ? 0 : 1) + (topo ? 0 : 1));
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
  const [missions, setMissions] = useState<{ key: string; target: number; reward: number; coins: number; progress: number; done: boolean }[] | null>(null);
  const [missionsLeft, setMissionsLeft] = useState(0);
  const [showMissions, setShowMissions] = useState(false);
  const fetchMissions = () => {
    const tok = localStorage.getItem("penneer.accountToken");
    fetch("/api/missions", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
      .then((r) => r.json())
      .then((d) => {
        setMissions(d.missions);
        setMissionsLeft(d.seconds_left || 0);
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
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 4 }}>
        {/* Coins sit where the profile chip used to: the profile moved to the
            avatar on the right, and the shop is in the bottom bar now. */}
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
        {/* right cluster is a column so the music mute note sits UNDER the gear */}
        <div style={{ position: "absolute", top: 4, right: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => {
              sound.uiTap();
              if (!missions) fetchMissions(); // first fetch may have failed offline
              setShowMissions(true);
            }}
            aria-label={t("missionsTitle")}
            className="pressable glowhover"
            style={{ position: "relative", background: "transparent", border: "none", cursor: "pointer", color: skin ? colors.ink : colors.sub, display: "flex", padding: skin ? 0 : 9, lineHeight: 0 }}
          >
            <HexPlate on={skin}>
              <Target size={23} />
            </HexPlate>
            {missionsOpen > 0 && (
              // Hetzelfde knopje als op de tegels. Twee soorten telknopjes op
              // een scherm is er een te veel.
              <CountBadge n={missionsOpen} x={skin ? "80%" : "calc(100% - 4px)"} y={skin ? "20%" : "4px"} size={16} />
            )}
          </button>
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
          <MusicToggle size={24} padding={skin ? 0 : 9} plate={skin} />
          {/* Icon-only: the rules live one tap away here and in Instellingen,
              so the main page needs no explaining line at the bottom. */}
          <button
            onClick={() => { sound.uiTap(); onShowRules(); }}
            aria-label={t("howItWorks")}
            className="pressable glowhover"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: skin ? colors.ink : colors.sub, display: "flex", padding: skin ? 0 : 9, lineHeight: 0 }}
          >
            <HexPlate on={skin}>
              <HelpCircle size={24} />
            </HexPlate>
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
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, ["--em" as string]: EMBLEM_SIZE }}>
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
                // In verhouding tot het embleem en niet in vaste pixels: krimpt
                // de munt op een laag scherm, dan schuift het woordmerk anders
                // even ver door en staat de pen erachter.
                margin: "calc(var(--em) * -0.3) 0 0",
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
                fontSize: 15.5,
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

        <div ref={kaartVak} style={{ width: "100%", maxWidth: kaartMax, marginInline: "auto" }}>
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
            <p style={{ margin: 0, fontFamily: font.wide, fontSize: 14.5, letterSpacing: 0.8, color: colors.sub, textAlign: "center" }}>
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
        </div>

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
      {showPrompt && !account && <ProfilePrompt game={game} onClose={() => setShowPrompt(false)} />}
      {installVariant && !showPrompt && <InstallPrompt variant={installVariant} onClose={() => setInstallVariant(null)} />}
      {showMissions && (
        <MissionsSheet
          missions={missions ?? []}
          secondsLeft={missionsLeft}
          isAccount={!!account}
          onClose={() => setShowMissions(false)}
        />
      )}
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
        <button onClick={onClose} aria-label={t("back")} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
          <X size={19} />
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

// Missions overlay behind the Target icon: today's three with progress, the
// reward, and when the next set drops. Tap the backdrop or X to close.
function MissionsSheet({
  missions,
  secondsLeft,
  isAccount,
  onClose,
}: {
  missions: { key: string; target: number; reward: number; coins: number; progress: number; done: boolean }[];
  secondsLeft: number;
  isAccount: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const [left, setLeft] = useState(secondsLeft);
  useEffect(() => {
    const id = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  const countdown = `${p(Math.floor(left / 3600))}:${p(Math.floor((left % 3600) / 60))}:${p(Math.floor(left % 60))}`;
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", padding: 22, background: "rgba(6,3,18,.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      <Card
        className="pop-in"
        style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12, padding: 20 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <Target size={17} color={colors.gold} />
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 16, color: colors.ink }}>{t("missionsTitle")}</span>
          <button onClick={onClose} aria-label={t("back")} className="pressable" style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }} onClick={(e) => e.stopPropagation()}>
          {missions.map((m) => (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 10, opacity: isAccount ? 1 : 0.55 }}>
              <span
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  background: m.done ? colors.green : withAlpha("#000000", 0.3),
                  border: `1px solid ${m.done ? colors.green : colors.hairline}`,
                  color: colors.bg0,
                }}
              >
                {m.done && <Check size={13} strokeWidth={3} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: m.done ? colors.sub : colors.ink, textDecoration: m.done ? "line-through" : "none" }}>
                    {t(`mission_${m.key}`)}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: colors.gold, flexShrink: 0 }}>
                    +{m.coins}<img src="/coin.webp" alt="" width={13} height={13} style={{ display: "block" }} />
                  </span>
                </div>
                {m.target > 1 && !m.done && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 999, background: withAlpha("#000000", 0.32), overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((m.progress / m.target) * 100)}%`, height: "100%", borderRadius: 999, background: colors.gold }} />
                    </div>
                    <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>
                      {m.progress}/{m.target}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {!isAccount && (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint }} onClick={(e) => e.stopPropagation()}>{t("missionsGuest")}</p>
        )}
        <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12, color: colors.faint }} onClick={(e) => e.stopPropagation()}>
          {t("missionsNewIn", { t: countdown })}
        </p>
      </Card>
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
  // Een zeshoek, want die staat al op deze pagina: de knopjes voor instellingen,
  // muziek en uitleg zijn zeshoekig. Een rondje was een melding uit een website,
  // dit is een plaatje uit hetzelfde spel.
  const h = Math.round(size * 1.115);
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        width: size,
        height: h,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      {/* De gloed is een EIGEN laag. Een box-shadow kan hier niet: `clip-path`
          knipt alles weg wat een element tekent, dus ook zijn schaduw. */}
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: size * 2.2,
          height: h * 2.2,
          borderRadius: "50%",
          background: `radial-gradient(circle closest-side, ${withAlpha(colors.gold, 0.4)} 0%, ${withAlpha(colors.gold, 0.14)} 44%, transparent 74%)`,
        }}
      />
      {/* Rand en vulling zijn twee geknipte lagen over elkaar: een `border` kan
          geen verloop, en zou bovendien de rechthoek volgen en niet de zeshoek.
          Wat er onderuit steekt IS de lijn. Licht boven, donker onder, want het
          licht komt van boven. */}
      <span style={{ position: "absolute", inset: 0, clipPath: HEX, background: `linear-gradient(168deg, ${GOUD[3]} 0%, ${GOUD[2]} 17%, ${GOUD[1]} 45%, ${GOUD[0]} 86%, #2A1A02 100%)` }} />
      <span
        style={{
          position: "absolute",
          inset: Math.max(1.2, size * 0.055),
          clipPath: HEX,
          // Donker van binnen. Op een gouden lijst zou een gouden muntje
          // verdwijnen; zo staat het knopje ergens IN en niet erop geplakt.
          // Drie lagen: randverdonkering zodat het verzonken leest, daarboven
          // een KORTE oplichting waar het licht valt (een verloop dat over de
          // halve vorm licht is leest als een vlak, niet als licht), en
          // daaronder de bodem.
          backgroundImage: [
            "radial-gradient(118% 118% at 50% 38%, transparent 42%, rgba(5,2,14,.72) 100%)",
            "radial-gradient(58% 34% at 50% 6%, rgba(255,235,184,.5), transparent 72%)",
            "linear-gradient(180deg, #37245F 0%, #23153F 48%, #120922 100%)",
          ].join(", "),
        }}
      />
      {/* De glans op de bovenrand. Kort en alleen bovenaan: dat is waar het
          metaal het licht vangt. Als eigen laag, want binnen dezelfde
          `background-image` delen alle lagen dezelfde begrenzing. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          clipPath: HEX,
          background: "radial-gradient(46% 16% at 50% 3%, rgba(255,252,236,.85), rgba(255,240,190,.35) 52%, transparent 78%)",
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: font.display,
          fontWeight: 800,
          fontSize: Math.round(size * 0.56),
          lineHeight: 1,
          color: GOUD[3],
          textShadow: "0 1px 1px rgba(8,3,20,.75)",
        }}
      >
        {n}
      </span>
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
              fontSize: "clamp(12px, 3.6vw, 15.5px)",
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
// De zwevende letters. Twee dingen bepalen of het mooi wordt.
//
// SPREIDING. Ze staan over het hele doek, links en rechts even zwaar en van
// boven tot onder. Eerder hingen ze bijna allemaal links; dan leest het als een
// fout in plaats van als decor.
//
// TEGENWICHT. Het vignet maakt de randen en de onderkant donker, dus dezelfde
// dekking leest daar veel zwakker. Een letter onderaan krijgt daarom meer mee
// dan dezelfde letter bovenin, anders verdwijnt de helft van de compositie.
// De zwevende letters. Elke letter loopt van de ene kant naar de andere en
// wordt onderweg groter en kleiner, alsof hij wegloopt en weer terugkomt.
//
// `reis` is hoe ver hij naar weerszijden gaat (negatief = de andere kant op),
// `klein`/`groot` is het bereik waarin hij ademt, `duur` en `fase` zetten ze uit
// de pas zodat het nooit als één beweging leest. De draaiing hoort bij de
// animatie en niet bij de stijl: een keyframe die `transform` schrijft veegt een
// inline transform weg.
const LETTERS: { c: string; size: number; op: number; pos: React.CSSProperties; rot: number; reis: string; klein: number; groot: number; duur: number; fase: number }[] = [
  { c: "K", size: 300, op: 0.055, pos: { top: "1%", left: "-14%" }, rot: -11, reis: "9vw", klein: 0.72, groot: 1.14, duur: 74, fase: -6 },
  { c: "R", size: 240, op: 0.045, pos: { bottom: "-2%", right: "-10%" }, rot: 8, reis: "-8vw", klein: 0.78, groot: 1.2, duur: 88, fase: -31 },
  { c: "P", size: 150, op: 0.03, pos: { top: "24%", left: "6%" }, rot: -6, reis: "12vw", klein: 0.66, groot: 1.24, duur: 61, fase: -18 },
  { c: "M", size: 120, op: 0.025, pos: { top: "8%", right: "12%" }, rot: 10, reis: "-11vw", klein: 0.7, groot: 1.3, duur: 55, fase: -44 },
  { c: "N", size: 285, op: 0.05, pos: { top: "40%", right: "-13%" }, rot: 12, reis: "-7vw", klein: 0.8, groot: 1.12, duur: 96, fase: -12 },
  { c: "E", size: 215, op: 0.04, pos: { bottom: "2%", left: "-9%" }, rot: -7, reis: "8vw", klein: 0.75, groot: 1.18, duur: 82, fase: -57 },
  { c: "A", size: 132, op: 0.028, pos: { bottom: "24%", left: "34%" }, rot: 5, reis: "-13vw", klein: 0.62, groot: 1.28, duur: 67, fase: -25 },
  { c: "S", size: 96, op: 0.022, pos: { top: "58%", left: "14%" }, rot: -9, reis: "14vw", klein: 0.6, groot: 1.34, duur: 49, fase: -38 },
];

function LandingFX() {
  const letter = (op: number): React.CSSProperties => ({
    position: "absolute",
    fontFamily: font.display,
    fontWeight: 700,
    // Een paar procent: net genoeg om te vermoeden, te weinig om te lezen.
    color: `rgba(206,192,240,${op})`,
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
        backgroundImage: "url(/bg-main.webp)",
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
              "--reis": l.reis,
              "--klein": l.klein,
              "--groot": l.groot,
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
