// Pen Neer — top-level flow. Pre-room: intro -> language -> landing/rules.
// In a room: render the screen for the authoritative phase.
import { useEffect, useRef, useState } from "react";
import { useGame } from "./net/socket";
import { useT } from "./i18n/i18n";
import { sound } from "./sound/sound";
import { Intro } from "./screens/Intro";
import { LanguagePage } from "./screens/LanguagePage";
import { Rules } from "./screens/Rules";
import { Settings } from "./screens/Settings";
import { Landing } from "./screens/Landing";
import { Hub } from "./screens/Hub";
import { Shop } from "./screens/Shop";
import { BadgeToasts } from "./components/BadgeToasts";
import { InviteBanner } from "./components/InviteBanner";
import { localNotify } from "./components/NotifyNudge";
import type { InboxItem } from "./net/socket";
import { Lobby } from "./screens/Lobby";
import { RulesGate } from "./screens/RulesGate";
import { Reveal } from "./screens/Reveal";
import { Fill } from "./screens/Fill";
import { Results } from "./screens/Results";
import { Final } from "./screens/Final";

const INTRO_KEY = "penneer.introSeen";

export default function App() {
  const game = useGame();
  const { lang, t } = useT();
  const room = game.state.room;
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem(INTRO_KEY) === "1");
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHub, setShowHub] = useState(false);
  const [showShop, setShowShop] = useState(false);
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

  // A short error sound when the server rejects something (name taken, etc.).
  const errText = game.state.error;
  useEffect(() => {
    if (errText) sound.error();
  }, [errText]);

  // An accepted invite from the inbox: join that room with the account name.
  const joinCode = game.state.joinRoomCode;
  useEffect(() => {
    if (!joinCode) return;
    game.clearJoin();
    setShowHub(false);
    game.joinRoom(joinCode, game.state.account?.name ?? "Speler");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

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
  } else if (showRules) {
    screen = <Rules onBack={() => setShowRules(false)} />;
  } else if (showShop) {
    screen = <Shop game={game} onBack={() => setShowShop(false)} />;
  } else if (showHub) {
    screen = (
      <Hub
        game={game}
        onBack={() => setShowHub(false)}
        onChallenge={(userId) => {
          pendingChallenge.current = userId;
          game.createRoom(game.state.account?.name ?? "Speler");
        }}
      />
    );
  } else if (showSettings) {
    screen = (
      <Settings
        game={game}
        onBack={() => setShowSettings(false)}
        onShowRules={() => {
          setShowSettings(false);
          setShowRules(true);
        }}
      />
    );
  } else {
    screen = <Landing game={game} onShowRules={() => setShowRules(true)} onShowSettings={() => setShowSettings(true)} onShowHub={() => setShowHub(true)} onShowShop={() => setShowShop(true)} />;
  }

  return (
    <>
      {screen}
      {inRoom && <BadgeToasts game={game} />}
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
            setShowHub(false);
          }}
          onDecline={() => {
            if (bannerInvite.id) game.inviteRespond(bannerInvite.id, false);
            setBannerInvite(null);
          }}
          onClose={() => setBannerInvite(null)}
        />
      )}
    </>
  );
}
