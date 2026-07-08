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
import { BadgeToasts } from "./components/BadgeToasts";
import { localNotify } from "./components/NotifyNudge";
import { Lobby } from "./screens/Lobby";
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
  // A challenge creates a room first; once its lobby is up we send the invite.
  const pendingChallenge = useRef<string | null>(null);

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
    sound.chat();
    const body =
      item.type === "friend_request"
        ? `${item.from_name} ${t("pendingIn")}`
        : item.type === "challenge"
          ? `${item.from_name} ${t("challengedYou")}`
          : `${item.from_name} ${t("invitedYouTo")} ${item.room_code}`;
    localNotify("Pen Neer", body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox]);

  // In a room: phase-driven screens (skip the whole pre-room flow).
  if (room && game.me) {
    const screen = (() => {
      switch (room.phase) {
        case "reveal":
          return <Reveal game={game} />;
        case "fill":
          return <Fill game={game} />;
        case "results":
          return <Results game={game} />;
        case "final":
          return <Final game={game} />;
        default:
          return <Lobby game={game} />;
      }
    })();
    return (
      <>
        {screen}
        <BadgeToasts game={game} />
      </>
    );
  }

  // Pre-room flow.
  if (!introDone) {
    return (
      <Intro
        onDone={() => {
          sessionStorage.setItem(INTRO_KEY, "1");
          setIntroDone(true);
        }}
      />
    );
  }
  if (!lang) return <LanguagePage />;
  if (showRules) return <Rules onBack={() => setShowRules(false)} />;
  if (showHub)
    return (
      <Hub
        game={game}
        onBack={() => setShowHub(false)}
        onChallenge={(userId) => {
          pendingChallenge.current = userId;
          game.createRoom(game.state.account?.name ?? "Speler");
        }}
      />
    );
  if (showSettings)
    return (
      <Settings
        game={game}
        onBack={() => setShowSettings(false)}
        onShowRules={() => {
          setShowSettings(false);
          setShowRules(true);
        }}
      />
    );
  return <Landing game={game} onShowRules={() => setShowRules(true)} onShowSettings={() => setShowSettings(true)} onShowHub={() => setShowHub(true)} />;
}
