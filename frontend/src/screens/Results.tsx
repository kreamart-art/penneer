// Results — running scoreboard, then a card per player with answers (check /
// cross / strike, "dubbel" tags) and round points. Tap an answer to challenge.
import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Scoreboard } from "../components/Scoreboard";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

export function Results({ game }: { game: GameApi }) {
  const { t, tCat } = useT();
  const room = game.state.room!;
  const round = room.round;
  const cats = room.settings.categories;
  const isLast = room.round_no >= room.settings.rounds;
  const canAdvance = game.isHost || game.isActive;
  const players = room.players.filter((p) => !p.is_spectator);

  const played = useRef(false);
  useEffect(() => {
    if (!played.current) {
      played.current = true;
      sound.results();
    }
  }, []);

  const roundTotal = (pid: string) => cats.reduce((sum, c) => sum + (round?.points[pid]?.[c] ?? 0), 0);

  return (
    <Screen top={<TopBar code={room.code} roundNo={room.round_no} totalRounds={room.settings.rounds} connected={game.state.status === "open"} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <div style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginBottom: 12 }}>
            {t("scoreboard")}
          </div>
          <Scoreboard players={room.players} scores={room.scores} meId={game.me?.id ?? null} />
        </Card>

        <p style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub, textAlign: "center", margin: 0, lineHeight: 1.5 }}>{t("resultsHint")}</p>

        {players.map((p) => {
          const answers = round?.answers[p.id] ?? {};
          return (
            <Card key={p.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={p.name} color={p.color} size={34} dim={!p.connected} />
                <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 15, color: colors.ink, flex: 1 }}>
                  {p.name}
                  {p.id === game.me?.id && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
                </span>
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold }}>+{roundTotal(p.id)}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {cats.map((cat) => {
                  const ans = answers[cat];
                  const pts = round?.points[p.id]?.[cat] ?? 0;
                  const text = ans?.text ?? "";
                  const valid = !!ans?.valid && !!text;
                  const dubbel = valid && pts === 5;
                  return (
                    <button
                      key={cat}
                      onClick={() => text && game.challenge(p.id, cat)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: withAlpha("#000000", 0.18), border: `1px solid ${colors.hairline}`, cursor: text ? "pointer" : "default", textAlign: "left", width: "100%" }}
                    >
                      <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint, width: 58, flexShrink: 0 }}>{tCat(cat)}</span>
                      <span style={{ color: valid ? colors.green : colors.red, display: "flex", flexShrink: 0 }}>{valid ? <Check size={16} /> : <X size={16} />}</span>
                      <span
                        style={{
                          flex: 1,
                          fontFamily: font.ui,
                          fontSize: 15,
                          fontWeight: 500,
                          color: valid ? colors.ink : colors.faint,
                          textDecoration: valid ? "none" : "line-through",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {text || <span style={{ fontStyle: "italic", opacity: 0.6 }}>{t("empty")}</span>}
                      </span>
                      {dubbel && (
                        <span style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 700, color: "#2A1B05", background: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold})`, padding: "2px 8px", borderRadius: 999, flexShrink: 0 }}>
                          {t("dubbel")}
                        </span>
                      )}
                      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: pts > 0 ? colors.ink : colors.faint, width: 22, textAlign: "right", flexShrink: 0 }}>{pts}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {canAdvance ? (
          <Button variant={isLast ? "gold" : "primary"} full onClick={game.nextRound}>
            {isLast ? t("toFinal") : t("nextRound")}
          </Button>
        ) : (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 14, color: colors.sub, margin: 0 }}>{t("waitNext")}</p>
        )}
      </div>
    </Screen>
  );
}
