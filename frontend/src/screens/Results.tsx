// Results — running scoreboard, then a card per player with answers (check /
// cross / strike, "dubbel" tags) and round points. Tap an answer to challenge.
import { useEffect, useRef, useState } from "react";
import { Check, HelpCircle, X } from "lucide-react";
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
  const players = room.players.filter((p) => !p.is_spectator);
  const iAmReady = !!(game.me && room.ready_ids.includes(game.me.id));
  const readyCount = room.ready_ids.length;
  const playingCount = players.length;

  const played = useRef(false);
  useEffect(() => {
    if (!played.current) {
      played.current = true;
      sound.results();
    }
  }, []);

  // Correcting an answer is a two-step, scroll-safe action: a tap selects the
  // row (only if the finger didn't move — so scrolling never corrects), then an
  // explicit Afkeuren/Goedkeuren confirms. Prevents accidental flips.
  const [selected, setSelected] = useState<string | null>(null);
  // Second step of "Zelfde woord als...": pick the partner word.
  const [pairing, setPairing] = useState(false);
  const moved = useRef(false);
  const startPt = useRef({ x: 0, y: 0 });
  const onRowDown = (e: React.PointerEvent) => {
    startPt.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };
  const onRowMove = (e: React.PointerEvent) => {
    if (Math.hypot(e.clientX - startPt.current.x, e.clientY - startPt.current.y) > 8) moved.current = true;
  };

  const roundTotal = (pid: string) => cats.reduce((sum, c) => sum + (round?.points[pid]?.[c] ?? 0), 0);

  // Mirror of the server's normalize(): detects a manually paired answer
  // (canon differs from the word itself).
  const norm = (s: string) =>
    s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  return (
    <Screen top={<TopBar code={room.code} roundNo={room.round_no} totalRounds={room.settings.rounds} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
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
                <Avatar name={p.name} color={p.color} size={34} dim={!p.connected} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} />
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
                  const inList = ans?.in_list !== false;
                  // green check = valid + in list; orange ? = valid but not found; red cross = rejected/empty
                  const mark = !valid ? "cross" : inList ? "check" : "question";
                  const markColor = mark === "check" ? colors.green : mark === "question" ? colors.orange : colors.red;
                  const dubbel = valid && pts === 5;
                  const rowKey = `${p.id}|${cat}`;
                  const isSel = selected === rowKey;
                  return (
                    <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        onPointerDown={onRowDown}
                        onPointerMove={onRowMove}
                        onClick={() => {
                          if (moved.current || !text) return; // a scroll, not a tap
                          setSelected(isSel ? null : rowKey);
                          setPairing(false);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: isSel ? withAlpha(colors.gold, 0.1) : withAlpha("#000000", 0.18), border: `1px solid ${isSel ? withAlpha(colors.gold, 0.6) : mark === "question" ? withAlpha(colors.orange, 0.4) : colors.hairline}`, cursor: text ? "pointer" : "default", textAlign: "left", width: "100%", touchAction: "pan-y" }}
                      >
                        <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint, width: 58, flexShrink: 0 }}>{tCat(cat)}</span>
                        <span style={{ color: markColor, display: "flex", flexShrink: 0 }}>
                          {mark === "check" ? <Check size={16} /> : mark === "question" ? <HelpCircle size={16} /> : <X size={16} />}
                        </span>
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
                      {isSel && text && (() => {
                        // Partner candidates: other players' valid words in
                        // this category, deduped by canon.
                        const seen = new Set<string>();
                        const candidates = players
                          .filter((pl) => pl.id !== p.id)
                          .map((pl) => ({ pl, a: round?.answers[pl.id]?.[cat] }))
                          .filter((x) => x.a && x.a.valid && x.a.text)
                          .filter((x) => {
                            const k = x.a!.canon || norm(x.a!.text);
                            if (seen.has(k)) return false;
                            seen.add(k);
                            return true;
                          })
                          .slice(0, 6);
                        const isPaired = !!ans?.canon && ans.canon !== norm(text);
                        const btn: React.CSSProperties = { fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "9px 12px", borderRadius: 10, cursor: "pointer" };
                        if (pairing) {
                          return (
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "0 2px 2px" }}>
                              <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("pickSame")}</span>
                              {candidates.map(({ pl, a }) => (
                                <button
                                  key={pl.id}
                                  onClick={() => {
                                    sound.dubbel();
                                    game.markSame(p.id, cat, pl.id);
                                    setSelected(null);
                                    setPairing(false);
                                  }}
                                  style={{ ...btn, color: colors.gold, background: withAlpha(colors.gold, 0.14), border: `1px solid ${withAlpha(colors.gold, 0.5)}` }}
                                >
                                  {a!.text} <span style={{ color: colors.faint, fontWeight: 500 }}>({pl.name})</span>
                                </button>
                              ))}
                              <button onClick={() => setPairing(false)} style={{ ...btn, fontWeight: 500, color: colors.sub, background: "transparent", border: `1px solid ${colors.hairline}` }}>
                                {t("cancelCorrection")}
                              </button>
                            </div>
                          );
                        }
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "0 2px 2px" }}>
                            <button
                              onClick={() => {
                                if (valid) sound.reject();
                                else sound.approve();
                                game.challenge(p.id, cat);
                                setSelected(null);
                              }}
                              style={{ ...btn, flex: 1, color: valid ? colors.redHi : colors.green, background: valid ? withAlpha(colors.red, 0.16) : withAlpha(colors.green, 0.16), border: `1px solid ${valid ? withAlpha(colors.red, 0.5) : withAlpha(colors.green, 0.5)}` }}
                            >
                              {valid ? t("markWrong") : t("markGood")}
                            </button>
                            {isPaired ? (
                              <button
                                onClick={() => {
                                  game.markSame(p.id, cat, null);
                                  setSelected(null);
                                }}
                                style={{ ...btn, color: colors.gold, background: withAlpha(colors.gold, 0.12), border: `1px solid ${withAlpha(colors.gold, 0.45)}` }}
                              >
                                {t("notSame")}
                              </button>
                            ) : (
                              candidates.length > 0 && (
                                <button onClick={() => setPairing(true)} style={{ ...btn, color: colors.gold, background: withAlpha(colors.gold, 0.12), border: `1px solid ${withAlpha(colors.gold, 0.45)}` }}>
                                  {t("sameAs")}
                                </button>
                              )
                            )}
                            <button onClick={() => setSelected(null)} style={{ ...btn, fontWeight: 500, color: colors.sub, background: "transparent", border: `1px solid ${colors.hairline}` }}>
                              {t("cancelCorrection")}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {game.isSpectator ? (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 14, color: colors.sub, margin: 0 }}>{t("waitNext")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button
              variant={iAmReady ? "ghost" : isLast ? "gold" : "primary"}
              full
              disabled={iAmReady}
              onClick={game.readyNext}
            >
              {iAmReady ? t("youReady") : isLast ? t("readyForFinal") : t("readyForNext")}
            </Button>
            <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, margin: 0 }}>
              {t("readyCount", { n: readyCount, total: playingCount })}
            </p>
            {game.isHost && readyCount < playingCount && (
              <button
                onClick={game.nextRound}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.sub, fontFamily: font.ui, fontSize: 13, textDecoration: "underline", padding: 4 }}
              >
                {t("forceNext")}
              </button>
            )}
            {game.isHost && !isLast && (
              <button
                onClick={game.endGame}
                style={{ marginTop: 2, background: "transparent", border: `1px solid ${withAlpha(colors.red, 0.4)}`, cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "8px 12px" }}
              >
                {t("endGame")}
              </button>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
