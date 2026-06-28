// Final — winner with emblem + gold score pill, full scoreboard, share, replay.
import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { Logo } from "../components/Logo";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Scoreboard } from "../components/Scoreboard";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { makeShareCard, shareOrDownload } from "../util/shareCard";
import { colors, font, withAlpha } from "../theme/tokens";

export function Final({ game }: { game: GameApi }) {
  const { t } = useT();
  const room = game.state.room!;
  const players = room.players.filter((p) => !p.is_spectator);
  const top = Math.max(0, ...players.map((p) => room.scores[p.id] ?? 0));
  const winners = players.filter((p) => (room.scores[p.id] ?? 0) === top && top >= 0);
  const shared = winners.length > 1;
  const [busy, setBusy] = useState(false);

  const played = useRef(false);
  useEffect(() => {
    if (!played.current) {
      played.current = true;
      sound.win();
    }
  }, []);

  const share = async () => {
    setBusy(true);
    try {
      const ranked = [...players].sort((a, b) => (room.scores[b.id] ?? 0) - (room.scores[a.id] ?? 0));
      const blob = await makeShareCard({
        winnerLabel: shared ? t("sharedLead") : t("winner"),
        winnerNames: winners.map((w) => w.name).join(", "),
        pointsText: t("pointsN", { score: top }),
        rows: ranked.map((p) => ({ name: p.name, score: room.scores[p.id] ?? 0, color: p.color })),
        footer: t("footer"),
      });
      if (blob) await shareOrDownload(blob, "penneer-uitslag.png");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen top={<TopBar code={room.code} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Logo size={120} />
          <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: colors.faint }}>
            {shared ? t("sharedLead") : t("winner")}
          </span>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {winners.map((w) => (
              <div key={w.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Avatar name={w.name} color={w.color} size={66} crown />
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: colors.ink }}>{w.name}</span>
              </div>
            ))}
          </div>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: "#2A1B05", background: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold})`, padding: "6px 18px", borderRadius: 999, boxShadow: `0 0 26px ${withAlpha(colors.gold, 0.5)}` }}>
            {t("pointsN", { score: top })}
          </span>
        </div>

        <Card>
          <Scoreboard players={room.players} scores={room.scores} meId={game.me?.id ?? null} />
        </Card>

        <Button variant="primary" full disabled={busy} onClick={share}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Share2 size={18} /> {t("shareResult")}
          </span>
        </Button>

        {game.isHost ? (
          <Button variant="gold" full onClick={game.playAgain}>
            {t("playAgain")}
          </Button>
        ) : (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 14, color: colors.sub, margin: 0 }}>{t("hostRestart")}</p>
        )}
        <Button variant="ghost" full onClick={game.leaveRoom}>
          {t("quit")}
        </Button>
      </div>
    </Screen>
  );
}
