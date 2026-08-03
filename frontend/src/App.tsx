// Pen Neer — top-level flow. Pre-room: intro -> language -> landing/rules.
// In a room: render the screen for the authoritative phase.
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useGame } from "./net/socket";
import { vangWerfcode } from "./net/referral";
import { useT } from "./i18n/i18n";
import { sound } from "./sound/sound";
import { colors } from "./theme/tokens";
import { useTileSkin } from "./theme/tileSkin";
import { ontdekAan } from "./util/ontdekvlag";
import { Intro } from "./screens/Intro";
import { LanguagePage } from "./screens/LanguagePage";
const Rules = lazy(() => import("./screens/Rules").then((m) => ({ default: m.Rules })));
const Settings = lazy(() => import("./screens/Settings").then((m) => ({ default: m.Settings })));
import { Landing } from "./screens/Landing";
import { type HubSection } from "./screens/Hub";
import { DagUitslagPopup, type Uitslag } from "./components/DagUitslagPopup";
import { secTotSluiting } from "./lib/dagklok";
const Hub = lazy(() => import("./screens/Hub").then((m) => ({ default: m.Hub })));
// Profielinstellingen zijn een EIGEN scherm geworden, bereikbaar vanuit
// Instellingen op de main page. Uit dezelfde brok als de Hub, dus dit kost geen
// tweede download.
const ProfielInstellingen = lazy(() => import("./screens/Hub").then((m) => ({ default: m.ProfileSettings })));
const Shop = lazy(() => import("./screens/Shop").then((m) => ({ default: m.Shop })));
const Training = lazy(() => import("./screens/Training").then((m) => ({ default: m.Training })));
const Ontdekken = lazy(() => import("./screens/Ontdekken").then((m) => ({ default: m.Ontdekken })));
const Daily = lazy(() => import("./screens/Daily").then((m) => ({ default: m.Daily })));
const Duel = lazy(() => import("./screens/Duel").then((m) => ({ default: m.Duel })));
import { BadgeToasts } from "./components/BadgeToasts";
import { BottomNav, type NavKey } from "./components/BottomNav";
import { BuzzerRewardPopup } from "./components/BuzzerRewardPopup";
import { KistPopup } from "./components/KistPopup";
import { DivisiePopup } from "./components/Divisie";
import { KoopPopup } from "./components/KoopPopup";
import { AD_WEG } from "./components/ReferralAd";
import { MeldingBanner, useMeldingWachtrij } from "./components/Meldingen";
import { Tour, tourGezien } from "./components/Tour";
import { ChunkGrens, chunkHerlaadWissen } from "./components/ChunkGrens";
const Juridisch = lazy(() => import("./screens/Juridisch").then((m) => ({ default: m.Juridisch })));
// Ontwerpvoorbeeld van het arenaspel van vrijdag, achter ?soep in de url.
// Eigen brok, dus wie hem niet opent downloadt hem ook niet.
const PreviewLettersoep = lazy(() => import("./screens/_PreviewLettersoep"));
// En dat van zaterdag, achter ?klem.
const PreviewKleurenklem = lazy(() => import("./screens/_PreviewKleurenklem"));
const PreviewRekenladder = lazy(() => import("./screens/_PreviewRekenladder"));
// En dat van maandag, achter ?keten.
const PreviewWoordketen = lazy(() => import("./screens/_PreviewWoordketen"));
import { InviteBanner } from "./components/InviteBanner";
import { DmBanner } from "./components/DmBanner";
import { localNotify } from "./components/NotifyNudge";
import { ensurePushSubscription } from "./pwa/push";
import type { InboxItem } from "./net/socket";
const Lobby = lazy(() => import("./screens/Lobby").then((m) => ({ default: m.Lobby })));
const RulesGate = lazy(() => import("./screens/RulesGate").then((m) => ({ default: m.RulesGate })));
const Reveal = lazy(() => import("./screens/Reveal").then((m) => ({ default: m.Reveal })));
const Fill = lazy(() => import("./screens/Fill").then((m) => ({ default: m.Fill })));
const Results = lazy(() => import("./screens/Results").then((m) => ({ default: m.Results })));
const Final = lazy(() => import("./screens/Final").then((m) => ({ default: m.Final })));

// Meteen bij het laden, nog voor de eerste render: `?ref=` uit de adresbalk
// halen en vasthouden tot er echt een account gemaakt wordt.
vangWerfcode();

const INTRO_KEY = "penneer.introSeen";

export default function App() {
  const game = useGame();
  const tileSkin = useTileSkin();
  const { lang, t } = useT();
  const room = game.state.room;
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem(INTRO_KEY) === "1");
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfielInstellingen, setShowProfielInstellingen] = useState(false);
  // De dichte kist, LOKAAL vastgehouden zodra hij in het account opduikt: het
  // account-veld verdwijnt bij het openen en de popup moet de onthulling
  // afmaken. Zie de mount onderaan voor waarom dit in App staat.
  const [kistToon, setKistToon] = useState<{ id: number; kist: string } | null>(null);
  // De uitslag van de ronde die om 21:00 sloot. Op APP-niveau en niet op de
  // main page: hij moet ook komen als je op dat moment in je profiel of in de
  // winkel staat, en hij moet een schermwissel overleven.
  const [dagBon, setDagBon] = useState<Uitslag | null>(null);
  const accountKist = game.state.account?.kist ?? null;
  useEffect(() => {
    if (accountKist) setKistToon((oud) => oud ?? accountKist);
  }, [accountKist]);

  // De uitslag ophalen: bij binnenkomst, en zodra de klok over 21:00 heen gaat.
  // Dat moment herken je aan de teller die OMHOOG springt (van bijna nul naar
  // bijna een etmaal); dat is betrouwbaarder dan op een tijdstip mikken, want
  // een telefoon die in de slaapstand stond mist zo'n tijdstip gewoon.
  const account = game.state.account;
  const vorigeOver = useRef(secTotSluiting());
  useEffect(() => {
    if (!account) return;
    let levend = true;
    const haal = () => {
      const tok = localStorage.getItem("penneer.accountToken");
      fetch("/api/daily/uitslag", { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (levend && d && d.day) setDagBon(d); })
        .catch(() => {});
    };
    haal();
    const id = window.setInterval(() => {
      const over = secTotSluiting();
      if (over > vorigeOver.current) haal();
      vorigeOver.current = over;
    }, 20000);
    return () => { levend = false; window.clearInterval(id); };
  }, [account?.id]);
  // The bottom bar owns which section is open; Hub renders whichever one the
  // bar points at, so there is no in-screen tab strip any more.
  const [showHub, setShowHub] = useState<HubSection | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showOntdekken, setShowOntdekken] = useState(false);
  const [ontdekVrij, setOntdekVrij] = useState(ontdekAan());
  // De app heeft geen router; #ontdekken is het dichtste bij de route uit het
  // ontwerp en maakt het scherm deelbaar en direct te openen.
  useEffect(() => {
    const bij = () => setOntdekVrij(ontdekAan());
    window.addEventListener("penneer:ontdek", bij);
    return () => window.removeEventListener("penneer:ontdek", bij);
  }, []);
  useEffect(() => {
    // Ook de hash zit achter de schakelaar: anders is de modus alsnog te
    // openen door de link te kennen.
    const lees = () => setShowOntdekken(window.location.hash === "#ontdekken" && ontdekAan());
    lees();
    window.addEventListener("hashchange", lees);
    return () => window.removeEventListener("hashchange", lees);
  }, []);
  const [showDaily, setShowDaily] = useState(false);
  const [showDuel, setShowDuel] = useState(false);
  const [showTour, setShowTour] = useState(false);
  /** Het duel dat een melding wil openen; leeg = gewoon de lijst. */
  const [duelOpen, setDuelOpen] = useState<string | null>(null);

  // De app staat: een eerdere brok-fout is dus opgelost. De vlag mag weg, zodat
  // de volgende deploy opnieuw één herlaadpoging mag doen.
  useEffect(() => { chunkHerlaadWissen(); }, []);

  // De losse schermen alvast ophalen zodra de app rust heeft. Twee winsten: de
  // eerste tik op een scherm is direct, en ze staan al in de cache VOORDAT er
  // gedeployd wordt, dus een deploy midden in je sessie breekt ze niet meer.
  // Bewust NA de eerste weergave en met een adempauze, anders vechten ze om de
  // bandbreedte met wat je nu op je scherm wilt.
  useEffect(() => {
    const id = window.setTimeout(() => {
      void import("./screens/Hub");
      void import("./screens/Shop");
      void import("./screens/Duel");
      void import("./screens/Daily");
      void import("./screens/Training");
      void import("./screens/Lobby");
      void import("./screens/Fill");
      void import("./screens/Results");
      void import("./screens/Reveal");
      void import("./screens/Final");
      void import("./screens/RulesGate");
      void import("./screens/Rules");
      void import("./screens/Settings");
      void import("./screens/Juridisch");
    }, 3500);
    return () => window.clearTimeout(id);
  }, []);
  const [tourAf, setTourAf] = useState(tourGezien);
  const [showLegal, setShowLegal] = useState<"privacy" | "terms" | null>(null);
  const [bannerInvite, setBannerInvite] = useState<InboxItem | null>(null);
  const [paypalFlash, setPaypalFlash] = useState<"ok" | "cancel" | "fail" | "pending" | null>(null);
  // A challenge creates a room first; once its lobby is up we send the invite.
  const pendingChallenge = useRef<string | null>(null);

  // PayPal return: the buyer comes back to /?paypal=return&token=<order_id>.
  // Capture the order (server verifies + unlocks), then refresh the account so
  // the AI shows as active. Runs once on mount; the URL is cleaned either way.
  const paypalHandled = useRef(false);
  useEffect(() => {
    if (paypalHandled.current) return;
    const params = new URLSearchParams(location.search);
    const flow = params.get("paypal");
    if (!flow) return;
    paypalHandled.current = true;
    const orderId = params.get("token");
    const clean = () => {
      params.delete("paypal");
      params.delete("token");
      params.delete("PayerID");
      const qs = params.toString();
      history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
    };
    if (flow === "return" && orderId) {
      setShowShop(true);
      const token = localStorage.getItem("penneer.accountToken") || "";
      fetch("/api/shop/paypal/capture", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      })
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (ok && d.ok) {
            setPaypalFlash("ok");
            game.send({ type: "account_get" }); // pull the now-unlocked account
          } else if (d && d.error === "pending") {
            setPaypalFlash("pending"); // eCheck/on-hold: paid but not settled yet
          } else {
            setPaypalFlash("fail");
          }
        })
        .catch(() => setPaypalFlash("fail"));
    } else if (flow === "cancel") {
      setShowShop(true);
      setPaypalFlash("cancel");
    }
    clean();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background music: on after the intro, off once a game is running (reveal
  // onward). So it plays on landing / language / hub / settings / lobby.
  // The intro STING fires exactly when the main page appears (not during the
  // intro screen), and only when the user actually walked through the intro
  // this session — a plain reload goes straight to the looping track.
  // The rules gate is still pre-game: music keeps playing there, like the lobby.
  const inGame = !!(room && game.me && room.phase !== "lobby" && room.phase !== "rules");
  const introAtMount = useRef(introDone);
  const stungRef = useRef(false);
  useEffect(() => {
    if (introDone && !introAtMount.current && !stungRef.current) {
      stungRef.current = true;
      sound.intro(); // sting now; the track follows when it ends (hold)
    }
    sound.musicActive(introDone && !inGame);
  }, [introDone, inGame]);

  // Logged in with notification permission already granted: (re)register the
  // push subscription so invites/challenges/DMs arrive with the app closed.
  const accountId = game.state.account?.id ?? null;
  useEffect(() => {
    if (accountId) void ensurePushSubscription();
  }, [accountId]);

  // A game just finished: pull fresh account stats/level so the profile is
  // current without a reload.
  const phase = room?.phase;
  useEffect(() => {
    if (phase === "final" && accountId) game.send({ type: "account_get" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, accountId]);

  // A short error sound when the server rejects something (name taken, etc.).
  const errText = game.state.error;
  useEffect(() => {
    if (errText) sound.error();
  }, [errText]);

  // Round over = one unmissable moment for EVERYONE (not just whoever pressed
  // stop): the Pen neer buzzer, a vibration and a full-screen splash. Keyed on
  // the server's round_ended broadcast, so a timer expiry triggers it too. The
  // splash lives here (not in Fill) so it survives the switch to the results
  // screen instead of flashing away when scoring is fast.
  const endToken = game.state.roundEndedToken;
  const prevEndToken = useRef(endToken);
  const [penSplash, setPenSplash] = useState(false);
  useEffect(() => {
    if (endToken === prevEndToken.current) return;
    prevEndToken.current = endToken;
    sound.penNeer();
    try {
      (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.([130, 70, 130]);
    } catch {
      /* vibration not supported */
    }
    setPenSplash(true);
    const id = window.setTimeout(() => setPenSplash(false), 1700);
    return () => window.clearTimeout(id);
  }, [endToken]);

  // An accepted invite from the inbox: join that room with the account name.
  const joinCode = game.state.joinRoomCode;
  useEffect(() => {
    if (!joinCode) return;
    game.clearJoin();
    setShowHub(null);
    game.joinRoom(joinCode, game.state.account?.name ?? "Speler");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  // Meldingen: de balk toont er één tegelijk, en een tik erop brengt je naar
  // de plek waar de melding over gaat. De catalogus zegt WAAR ("naar"), dus dit
  // is een tabel en geen rij ifs per soort.
  const meldingen = useMeldingWachtrij(game.state.meldingNieuw);
  const openMelding = (naar: string | null, data: string | null) => {
    meldingen.volgende();
    let d: Record<string, string> = {};
    try { d = data ? JSON.parse(data) : {}; } catch { /* rommel in de data is geen reden om niets te doen */ }
    setShowShop(false);
    setShowRules(false);
    setShowSettings(false);
    setShowProfielInstellingen(false);
    if (naar === "duel") {
      setShowHub(null);
      // Niet alleen NAAR het duelscherm maar naar DIT duel: een melding over
      // een uitdaging die je in een lijst afzet, laat je het werk nog een keer
      // doen. Het duel-id reist mee in de data van de melding.
      setDuelOpen(d.duel_id || null);
      setShowDuel(true);
    } else if (naar === "dagronde") {
      setShowHub(null);
      setShowDaily(true);
    } else if (naar === "dm" && d.user_id) {
      setShowHub("inbox");
      game.dmOpen(d.user_id);
    } else if (naar === "vrienden") {
      setShowHub("friends");
    } else if (naar === "profiel") {
      setShowHub("profile");
    } else {
      setShowHub("inbox");
    }
  };

  // Een tik op een PUSH-melding. Twee wegen naar binnen, want een push komt in
  // twee soorten: met de app dicht (dan opent hij een venster met ?melding= in
  // de adresbalk) of met de app open (dan brengt de service worker het venster
  // naar voren en stuurt hij de bestemming als bericht). Allebei komen ze uit
  // op openMelding, zodat er maar EEN tabel is die weet waar iets heen gaat.
  const openMeldingRef = useRef(openMelding);
  openMeldingRef.current = openMelding;
  useEffect(() => {
    const uitAdres = (href: string) => {
      const u = new URL(href, location.origin);
      const naar = u.searchParams.get("melding");
      if (!naar) return false;
      const wie = u.searchParams.get("wie") || "";
      // Een duel-id en een user-id zijn allebei "wie": welke van de twee het is
      // weet de bestemming zelf, dus ze gaan er allebei in.
      openMeldingRef.current(naar, JSON.stringify({ user_id: wie, duel_id: wie }));
      return true;
    };
    // Bij het opstarten: uit de adresbalk, en daarna weg uit de adresbalk. Wie
    // deze link deelt hoort niet andermans gesprek mee te sturen, en een
    // herlaadbeurt hoort je niet opnieuw in datzelfde gesprek te zetten.
    //
    // Even wachten met openen: bij een koude start staat er nog geen account
    // en dan opent het gespreksscherm op "je hebt een profiel nodig". Een halve
    // seconde is genoeg voor de inlog, en als die er niet komt gaan we alsnog,
    // want een bestemming als de dagronde heeft geen account nodig.
    const uitUrl = new URL(location.href).searchParams.get("melding");
    if (uitUrl) {
      const href = location.href;
      history.replaceState(null, "", location.pathname);
      window.setTimeout(() => uitAdres(href), 600);
    }
    const opBericht = (e: MessageEvent) => {
      if (e.data?.type === "melding-open" && typeof e.data.url === "string") uitAdres(e.data.url);
    };
    navigator.serviceWorker?.addEventListener("message", opBericht);
    return () => navigator.serviceWorker?.removeEventListener("message", opBericht);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Meldingen ophalen zodra er een account is: het bolletje op de balk hoort te
  // kloppen voordat je de inbox opent, niet erna.
  useEffect(() => {
    if (accountId) game.meldingenLaden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // De uitslag van maandag komt NA de werf-advertentie, nooit ervoor: twee
  // vensters die tegelijk opengaan vechten om dezelfde tik, en dan klik je de
  // ene weg zonder hem gezien te hebben. Twee tellen ertussen, zodat de eerste
  // eerst weg is voor de tweede binnenkomt.
  const [uitslagKlaar, setUitslagKlaar] = useState(false);
  useEffect(() => {
    // Is de advertentie deze sessie al weggetikt, dan hoeft er niets gewacht
    // te worden: er komt vandaag geen advertentie meer.
    let alWeg = false;
    try { alWeg = sessionStorage.getItem("penneer.refAdKlein") === "1"; } catch { /* geen opslag */ }
    if (alWeg) { setUitslagKlaar(true); return; }
    const na = () => window.setTimeout(() => setUitslagKlaar(true), 2000);
    let timer: number | undefined;
    const luister = () => { timer = na(); };
    window.addEventListener(AD_WEG, luister);
    return () => { window.removeEventListener(AD_WEG, luister); window.clearTimeout(timer); };
  }, []);

  // Challenge sequencing: room lobby is live -> send the challenge invite.
  useEffect(() => {
    if (room?.phase === "lobby" && game.me && pendingChallenge.current) {
      game.inviteSend(pendingChallenge.current, "challenge");
      pendingChallenge.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, game.me?.id]);

  // Notify (sound + vibration) on a new chat message from someone else while
  // the panel is closed. Lives here (mounted for the whole session) so it fires
  // once per message and survives screen changes. Armed after a short grace so
  // the join/reconnect history burst doesn't trigger it.
  const chat = game.state.chat;
  const prevChatLen = useRef(chat.length);
  const chatArmed = useRef(false);
  useEffect(() => {
    const id = window.setTimeout(() => (chatArmed.current = true), 1500);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    const prev = prevChatLen.current;
    prevChatLen.current = chat.length;
    if (!chatArmed.current || chat.length <= prev) return;
    const last = chat[chat.length - 1];
    if (!last || last.player_id === game.state.playerId || game.state.chatOpen) return;
    sound.chat();
    try {
      (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(60);
    } catch {
      /* vibration not supported */
    }
    localNotify("Pen Neer", `${last.name}: ${last.text}`);
  }, [chat, game.state.chatOpen, game.state.playerId]);

  // Local notification for new inbox items (invite, challenge, friend request)
  // while the tab is hidden. Same armed-grace trick as the chat notify.
  const inbox = game.state.inbox;
  const prevInboxLen = useRef(inbox.length);
  const inboxArmed = useRef(false);
  useEffect(() => {
    const id = window.setTimeout(() => (inboxArmed.current = true), 2000);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    const prev = prevInboxLen.current;
    prevInboxLen.current = inbox.length;
    if (!inboxArmed.current || inbox.length <= prev) return;
    const item = inbox[0];
    if (!item) return;
    sound.invite();
    const body =
      item.type === "friend_request"
        ? `${item.from_name} ${t("pendingIn")}`
        : item.type === "challenge"
          ? `${item.from_name} ${t("challengedYou")}`
          : `${item.from_name} ${t("invitedYouTo")} ${item.room_code}`;
    localNotify("Pen Neer", body);
    // Room invites and challenges also drop a slide-down banner so you can join
    // straight away, wherever you are. Friend requests stay in the inbox.
    if (item.type === "invite" || item.type === "challenge") setBannerInvite(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox]);

  // Load friends once logged in, so an incoming DM banner can name its sender
  // (DMs only come from friends) even before you open the friends tab.
  useEffect(() => {
    if (accountId) game.refreshFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // Sound + local notification when an incoming DM flashes its slide-down banner.
  const dmBanner = game.state.dmBanner;
  useEffect(() => {
    if (!dmBanner) return;
    sound.invite();
    const sender = game.state.friends.find((f) => f.id === dmBanner.from_user);
    const name = sender?.name ?? "";
    localNotify("Pen Neer", `${name}: ${dmBanner.emote ? t("stickerOne") : dmBanner.voice_id ? t("dmVoiceNotif") : dmBanner.text}`.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmBanner?.id]);

  // Auto-dismiss the PayPal flash after a few seconds.
  useEffect(() => {
    if (!paypalFlash) return;
    const id = window.setTimeout(() => setPaypalFlash(null), 5000);
    return () => window.clearTimeout(id);
  }, [paypalFlash]);

  const inRoom = !!(room && game.me);

  // Pick the current screen (in-room phase, or the pre-room flow).
  let screen: React.ReactNode;
  if (inRoom) {
    switch (room!.phase) {
      case "rules": screen = <RulesGate game={game} />; break;
      case "reveal": screen = <Reveal game={game} />; break;
      case "fill": screen = <Fill game={game} />; break;
      case "results": screen = <Results game={game} />; break;
      case "final": screen = <Final game={game} />; break;
      default: screen = <Lobby game={game} />;
    }
  } else if (!introDone) {
    screen = (
      <Intro
        onDone={() => {
          sessionStorage.setItem(INTRO_KEY, "1");
          setIntroDone(true);
        }}
      />
    );
  } else if (!lang) {
    screen = <LanguagePage />;
  } else if (typeof location !== "undefined" && location.search.includes("soep")) {
    screen = <PreviewLettersoep />;
  } else if (typeof location !== "undefined" && location.search.includes("klem")) {
    screen = <PreviewKleurenklem />;
  } else if (typeof location !== "undefined" && location.search.includes("reken")) {
    screen = <PreviewRekenladder />;
  } else if (typeof location !== "undefined" && location.search.includes("keten")) {
    screen = <PreviewWoordketen />;
  } else if (showRules) {
    screen = <Rules onBack={() => setShowRules(false)} />;
  } else if (showDaily) {
    screen = (
      <Daily
        game={game}
        onBack={() => setShowDaily(false)}
        onProfile={() => {
          setShowDaily(false);
          setShowHub("profile");
        }}
      />
    );
  } else if (showDuel) {
    screen = (
      <Duel
        game={game}
        openId={duelOpen}
        onGeopend={() => setDuelOpen(null)}
        onBack={() => { setDuelOpen(null); setShowDuel(false); }}
        onProfile={() => {
          setShowDuel(false);
          setShowHub("profile");
        }}
      />
    );
  } else if (showOntdekken) {
    screen = (
      <Ontdekken
        onBack={() => setShowOntdekken(false)}
        onOefenen={() => { setShowOntdekken(false); setShowTraining(true); }}
      />
    );
  } else if (showTraining) {
    screen = (
      <Training
        onBack={() => setShowTraining(false)}
        lenient={!!game.state.account?.lenient_spelling}
        onOntdekken={ontdekVrij ? () => { setShowTraining(false); setShowOntdekken(true); } : undefined}
      />
    );
  } else if (showShop) {
    screen = <Shop game={game} onBack={() => setShowShop(false)} />;
  } else if (showHub) {
    screen = (
      <Hub
        game={game}
        section={showHub}
        onBack={() => setShowHub(null)}
        onShowShop={() => {
          setShowHub(null);
          setShowShop(true);
        }}
        onGaNaar={(naar) => {
          // Dezelfde sprong als vanuit de meldingsbalk, alleen komt hij nu uit
          // de lijst in de inbox.
          if (naar === "duel") { setShowHub(null); setShowDuel(true); }
          else if (naar === "dagronde") { setShowHub(null); setShowDaily(true); }
          else if (naar === "profiel") setShowHub("profile");
        }}
        onChallenge={(userId) => {
          pendingChallenge.current = userId;
          game.createRoom(game.state.account?.name ?? "Speler");
        }}
      />
    );
  } else if (showLegal) {
    screen = <Juridisch start={showLegal} onBack={() => setShowLegal(null)} />;
  } else if (showProfielInstellingen && game.state.account) {
    screen = (
      <ProfielInstellingen
        game={game}
        onBack={() => setShowProfielInstellingen(false)}
        onShowShop={() => {
          setShowProfielInstellingen(false);
          setShowSettings(false);
          setShowShop(true);
        }}
      />
    );
  } else if (showSettings) {
    screen = (
      <Settings
        game={game}
        onBack={() => setShowSettings(false)}
        onProfileSettings={() => setShowProfielInstellingen(true)}
        onShowRules={() => {
          setShowSettings(false);
          setShowRules(true);
        }}
        onShowTour={() => setShowTour(true)}
        onShowLegal={(tab) => setShowLegal(tab)}
      />
    );
  } else {
    screen = <Landing game={game} onShowRules={() => setShowRules(true)} onShowSettings={() => setShowSettings(true)} onShowShop={() => setShowShop(true)} onShowTraining={() => setShowTraining(true)} onShowDaily={() => setShowDaily(true)} onShowDuel={() => setShowDuel(true)} onShowProfile={() => setShowHub("profile")} onShowInbox={() => setShowHub("inbox")} />;
  }

  // Which bar item is lit. Sub-flows that are not bar destinations (rules,
  // dagronde, oefenen, instellingen) hide the bar entirely.
  const navKey: NavKey | null =
    inRoom || !introDone || !lang || showRules || showDaily || showDuel || showTraining || showOntdekken || showSettings || showLegal
      ? null
      : showShop
      ? "shop"
      : showHub === "inbox"
      ? "profile"       // inbox is opened from the profile, so keep it lit
      : showHub
      ? showHub
      : "home";
  useEffect(() => {
    // Met de platen-skin is de balk art met een vaste verhouding, dus zijn
    // hoogte hangt van de schermbreedte af. Hij meet zichzelf en zet `--nav-h`
    // dan zelf; wij blijven eraf zolang hij in beeld is.
    if (navKey !== null && tileSkin) return;
    document.documentElement.style.setProperty("--nav-h", navKey === null ? "0px" : "58px");
  }, [navKey, tileSkin]);
  const goNav = (key: NavKey) => {
    setShowShop(key === "shop");
    setShowHub(key === "home" || key === "shop" ? null : key);
  };

  return (
    <>
      {/* De lui geladen schermen komen als los brokje binnen. De terugval is
          BEWUST leeg: de brokjes zijn klein en de app heeft al een donkere
          achtergrond, dus een spinner van drie frames flikkert alleen maar.
          De grens eromheen vangt een brok dat na een deploy niet meer bestaat;
          zonder die grens breekt React de hele boom af en zie je wit. */}
      <ChunkGrens melding={t("herlaadMelding")} knop={t("herlaadKnop")}>
        <Suspense fallback={null}>{screen}</Suspense>
      </ChunkGrens>
      {navKey !== null && <BottomNav game={game} active={navKey} onSelect={goNav} />}
      {/* Niet over een open chat heen: daar heeft de uitzending zijn eigen,
          kleinere versie op de plek waar je op dat moment kijkt. */}
      {penSplash && !game.state.chatOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 95,
            display: "grid",
            placeItems: "center",
            background: "rgba(6,3,18,.55)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            pointerEvents: "none",
          }}
        >
          <div style={{ textAlign: "center", animation: "pen-splash 1.7s ease forwards", padding: "0 12px" }}>
            {/* Early GameBoy is a pixel font that draws small for its px size and
                has no lowercase, so it runs bigger, uppercased, and vw-clamped. */}
            <div style={{ fontFamily: "'Early GameBoy', 'Space Grotesk', sans-serif", fontWeight: 400, fontSize: "min(34px, 7.4vw)", letterSpacing: 1, lineHeight: 1.35, textTransform: "uppercase", color: "#FFC23D", textShadow: "0 0 34px rgba(255,194,61,.55), 0 3px 0 rgba(0,0,0,.35)" }}>
              {t("penDownSplash")}
            </div>
            <div style={{ marginTop: 6, fontFamily: "Inter, sans-serif", fontSize: 15, color: "#CFC6E8" }}>
              {t("penDownSub")}
            </div>
          </div>
        </div>
      )}
      {/* De rondleiding. Eén keer vanzelf zodra je op de main page staat, en
          daarna alleen als je hem uit de instellingen opent. Niet over de
          intro, niet over een potje: dan is het geen rondleiding maar een
          onderbreking. */}
      {(showTour || (introDone && !!lang && !inRoom && !showRules && !showDaily && !showDuel &&
        !showTraining && !showShop && !showHub && !showSettings && !showLegal && !tourAf)) && (
        <Tour onKlaar={() => { setShowTour(false); setTourAf(true); }} />
      )}
      {/* Wat je kocht, twee tellen nadat de winkel dicht is. `actief` gaat pas
          aan als je er weg bent, dus de teller begint niet terwijl je nog aan
          het kijken bent. */}
      <KoopPopup game={game} actief={introDone && !!lang && !showShop && !inRoom} />
      {inRoom && <BadgeToasts game={game} />}
      {/* De meldingsbalk mag overal komen behalve tijdens het invullen: daar
          zou hij precies over het toetsenbordveld vallen dat je op dat moment
          nodig hebt. */}
      {meldingen.huidig && introDone && !!lang && room?.phase !== "fill" && (
        <MeldingBanner
          melding={meldingen.huidig}
          onOpen={() => openMelding(meldingen.huidig!.naar, meldingen.huidig!.data)}
          onClose={meldingen.volgende}
        />
      )}
      {/* Reward popup ONLY on the main landing page (never over the intro, a
          sub-screen, or an active game): match the Landing's render condition. */}
      {game.state.account &&
        introDone &&
        !!lang &&
        !inRoom &&
        !showRules &&
        !showDaily &&
        !showDuel &&
        !showTraining &&
        !showShop &&
        !showHub &&
        !showSettings && <BuzzerRewardPopup game={game} />}
      {/* De kist hangt hier en niet in een scherm: een schermwissel of een
          room-reconnect remountte Landing en veegde de popup weg midden in de
          onthulling. Het account-veld wordt bij het openen leeg (push_account),
          dus de kist wordt LOKAAL vastgehouden tot de speler zelf sluit. */}
      {kistToon &&
        // Eerst de uitslag, dan pas de kist: de kist is de PRIJS voor je plek,
        // dus die plek hoort er eerst te staan. Andersom krijg je een kist uit
        // het niets en zie je daarna pas waarvoor.
        !dagBon &&
        uitslagKlaar &&
        introDone &&
        !inRoom &&
        !showRules &&
        !showDaily &&
        !showDuel &&
        !showTraining &&
        !showShop &&
        !showHub &&
        !showSettings && <KistPopup kist={kistToon} onClose={() => setKistToon(null)} />}

      {/* De uitslag van 21:00. Hij gaat VOOR de kist: eerst zie je waar je
          eindigde, daarna pas wat er in de kist zit die je ermee won. */}
      {dagBon && (
        <DagUitslagPopup
          game={game}
          uitslag={dagBon}
          onClose={() => {
            const tok = localStorage.getItem("penneer.accountToken");
            fetch("/api/daily/uitslag/gezien", { method: "POST", headers: tok ? { Authorization: `Bearer ${tok}` } : {} }).catch(() => {});
            setDagBon(null);
            game.updateAccount({});
          }}
        />
      )}
      {/* De maandag-uitslag gaat VOOR de beloningen: hij hoort bij de week die
          net eindigde, en pas daarna kijk je naar wat je nog te claimen hebt.
          Dezelfde plek-voorwaarden, want ook dit moet niet over een potje heen. */}
      {game.state.account?.divisie_change &&
        uitslagKlaar &&
        introDone &&
        !!lang &&
        !inRoom &&
        !showRules &&
        !showDaily &&
        !showDuel &&
        !showTraining &&
        !showShop &&
        !showHub &&
        !showSettings && (
          <DivisiePopup change={game.state.account.divisie_change} onSluit={() => game.divisieGezien()} />
        )}
      {paypalFlash && (
        <div
          onClick={() => setPaypalFlash(null)}
          style={{
            position: "fixed",
            top: "calc(14px + env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            maxWidth: 340,
            width: "calc(100% - 28px)",
            padding: "12px 16px",
            borderRadius: 14,
            textAlign: "center",
            fontFamily: "var(--font-ui, inherit)",
            fontSize: 13.5,
            color: paypalFlash === "ok" ? "#0B2C1A" : "#fff",
            background: paypalFlash === "ok" ? "#36E0AE" : paypalFlash === "fail" ? "#B23A48" : "#3A2E5C",
            boxShadow: "0 14px 40px rgba(0,0,0,.45)",
            cursor: "pointer",
          }}
        >
          {paypalFlash === "ok" ? t("paypalOk") : paypalFlash === "cancel" ? t("paypalCancel") : paypalFlash === "pending" ? t("paypalPending") : t("paypalFail")}
        </div>
      )}
      {bannerInvite && (
        <InviteBanner
          invite={bannerInvite}
          onAccept={() => {
            if (bannerInvite.id) game.inviteRespond(bannerInvite.id, true);
            setBannerInvite(null);
            setShowHub(null);
          }}
          onDecline={() => {
            if (bannerInvite.id) game.inviteRespond(bannerInvite.id, false);
            setBannerInvite(null);
          }}
          onClose={() => setBannerInvite(null)}
        />
      )}
      {dmBanner && (() => {
        const friend = game.state.friends.find((f) => f.id === dmBanner.from_user);
        const thread = game.state.dmThreads.find((th) => th.partner === dmBanner.from_user)?.user;
        const sender = friend
          ? { id: friend.id, name: friend.name, color: friend.color, has_avatar: friend.has_avatar, avatar_ver: friend.avatar_ver }
          : thread
            ? { id: thread.id, name: thread.name, color: thread.color, has_avatar: thread.has_avatar, avatar_ver: thread.avatar_ver }
            : { id: dmBanner.from_user, name: "?", color: colors.gold };
        return (
          <DmBanner
            dm={dmBanner}
            sender={sender}
            onReply={() => {
              game.dmOpen(dmBanner.from_user);
              setShowHub("friends");
              game.clearDmBanner();
            }}
            onClose={() => game.clearDmBanner()}
          />
        );
      })()}
    </>
  );
}
