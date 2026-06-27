// Pen Neer — top-level flow. Pre-room: intro -> language -> landing/rules.
// In a room: render the screen for the authoritative phase.
import { useState } from "react";
import { useGame } from "./net/socket";
import { useT } from "./i18n/i18n";
import { Intro } from "./screens/Intro";
import { LanguagePage } from "./screens/LanguagePage";
import { Rules } from "./screens/Rules";
import { Landing } from "./screens/Landing";
import { Lobby } from "./screens/Lobby";
import { Reveal } from "./screens/Reveal";
import { Fill } from "./screens/Fill";
import { Results } from "./screens/Results";
import { Final } from "./screens/Final";

const INTRO_KEY = "penneer.introSeen";

export default function App() {
  const game = useGame();
  const { lang } = useT();
  const room = game.state.room;
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem(INTRO_KEY) === "1");
  const [showRules, setShowRules] = useState(false);

  // In a room: phase-driven screens (skip the whole pre-room flow).
  if (room && game.me) {
    switch (room.phase) {
      case "lobby":
        return <Lobby game={game} />;
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
  return <Landing game={game} onShowRules={() => setShowRules(true)} />;
}
