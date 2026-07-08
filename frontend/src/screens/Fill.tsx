// Fill — everyone types at once on one server clock (or open-ended in no-timer
// mode). Active player owns "Pen neer"; others can flag "Ik ben klaar"; the
// spelleider sees how many are ready. Spectators watch read-only.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Timer } from "../components/Timer";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, radius, withAlpha } from "../theme/tokens";

export function Fill({ game }: { game: GameApi }) {
  const { t, tCat } = useT();
  const room = game.state.room!;
  const cats = room.settings.categories;
  const letter = room.round?.letter ?? "";
  const active = room.players.find((p) => p.id === room.active_player_id);
  const others = room.players.filter((p) => p.id !== game.me?.id && !p.is_spectator);
  const noTimer = (room.timer.duration ?? room.settings.round_time) === 0;
  const isSpectator = game.isSpectator;
  const playingCount = room.players.filter((p) => !p.is_spectator).length;
  const readyCount = room.ready_ids.length;
  const iAmReady = !!(game.me && room.ready_ids.includes(game.me.id));

  const initial = useMemo(() => Object.fromEntries(cats.map((c) => [c, ""])), [cats]);
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const change = (cat: string, value: string) => {
    const next = { ...answers, [cat]: value };
    setAnswers(next);
    game.updateAnswers(next);
  };

  // Submit the complete final answers the moment the server ends the fill
  // phase (even untouched fields), so nothing is lost and scoring isn't delayed.
  const token = game.state.roundEndedToken;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(() => {
    if (token > 0) game.submitAnswers(answersRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // tick.mp3 is one clean beep; the Timer fires onTick exactly when the shown
  // number changes, so one beep per second stays in sync with the countdown.
  const onTick = (secs: number) => {
    if (secs <= 10 && secs > 0) sound.tick();
  };

  // Everyone playing gets a floating bottom button so it's always reachable:
  // the spelleider a "Pen neer" stop (so a timed round can be stopped without
  // scrolling past the inputs), others "Ik ben klaar".
  const showFloatingReady = !isSpectator && !game.isActive;
  const showFloatingStop = !isSpectator && game.isActive;

  return (
    <Screen top={<TopBar code={room.code} roundNo={room.round_no} totalRounds={room.settings.rounds} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: showFloatingReady || showFloatingStop ? 104 : 0 }}>
        {/* Letter + timer (or no-timer note) */}
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub }}>{t("letterIs")}</span>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 40, color: colors.gold, textShadow: `0 0 22px ${withAlpha(colors.gold, 0.5)}` }}>{letter}</span>
          </div>
          {noTimer ? (
            <div style={{ textAlign: "center", padding: "6px 0" }}>
              <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 30, color: colors.violet }}>∞</div>
              <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
                {game.isActive ? t("noLimitYou") : t("noLimitX", { name: active?.name ?? "?" })}
              </span>
            </div>
          ) : (
            <>
              <Timer endsAt={room.timer.ends_at} duration={room.timer.duration} onTick={onTick} />
              <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub, marginTop: 2 }}>
                {game.isActive ? t("youKeepTime") : t("xKeepsTime", { name: active?.name ?? "?" })}
              </span>
            </>
          )}
        </Card>

        {/* other players + ready state */}
        {others.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {others.map((p, i) => {
              const ready = room.ready_ids.includes(p.id);
              return (
                <div key={p.id} style={{ position: "relative", animation: ready ? undefined : `fill-pulse 1.8s ease-in-out ${i * 0.18}s infinite` }}>
                  <Avatar name={p.name} color={p.color} size={30} dim={!p.connected} userId={p.user_id} hasAvatar={p.has_avatar} avatarVer={p.avatar_ver} />
                  {ready && (
                    <span style={{ position: "absolute", bottom: -3, right: -3, background: colors.green, borderRadius: "50%", width: 14, height: 14, display: "grid", placeItems: "center", boxShadow: `0 0 6px ${colors.green}` }}>
                      <Check size={10} color={colors.bg0} strokeWidth={3} />
                    </span>
                  )}
                </div>
              );
            })}
            <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("fillingToo")}</span>
          </div>
        )}

        {/* inputs (players only) */}
        {!isSpectator && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cats.map((cat, i) => (
              <div key={cat}>
                <label style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: colors.faint, marginLeft: 4 }}>{tCat(cat)}</label>
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={answers[cat] ?? ""}
                  onChange={(e) => change(cat, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") inputs.current[i + 1]?.focus();
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t("fillPlaceholder", { cat: tCat(cat), letter })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 4,
                    fontFamily: font.ui,
                    fontSize: 16,
                    color: colors.ink,
                    background: withAlpha("#000000", 0.25),
                    border: `1.5px solid ${answers[cat] ? withAlpha(colors.gold, 0.5) : colors.panelBorder}`,
                    borderRadius: radius.button,
                    padding: "12px 14px",
                    transition: "border-color .12s ease",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* controls (the action itself is the floating button below) */}
        {isSpectator ? (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.sub, margin: "4px 0 0" }}>{t("spectatorNote")}</p>
        ) : game.isActive ? (
          readyCount > 0 && (
            <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint, margin: 0 }}>{t("readyCount", { n: readyCount, total: playingCount })}</p>
          )
        ) : (
          <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 13, color: colors.sub, margin: "2px 0 0", lineHeight: 1.5 }}>
            {iAmReady ? t("youReady") : t("xStopsTime", { name: active?.name ?? "?" })}
          </p>
        )}
      </div>

      {/* Floating "Pen neer" (spelleider) — always reachable, also with a timer */}
      {showFloatingStop && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
            paddingTop: 26,
            background: `linear-gradient(0deg, ${colors.bg0} 55%, transparent)`,
            pointerEvents: "none",
          }}
        >
          <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 18px", pointerEvents: "auto" }}>
            <Button variant="danger" full onClick={() => { sound.penNeer(); game.stopRound(); }}>
              {t("penNeer")}
            </Button>
          </div>
        </div>
      )}

      {/* Floating ready button (non-active players) so everyone notices it */}
      {showFloatingReady && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
            paddingTop: 26,
            background: `linear-gradient(0deg, ${colors.bg0} 55%, transparent)`,
            pointerEvents: "none",
          }}
        >
          <div style={{ maxWidth: 460, margin: "0 auto", padding: "0 18px", pointerEvents: "auto" }}>
            <Button
              variant={iAmReady ? "ghost" : "gold"}
              full
              onClick={() => { if (!iAmReady) sound.ready(); game.setReady(!iAmReady); }}
              style={iAmReady ? undefined : { animation: "fill-pulse 1.8s ease-in-out infinite" }}
            >
              {iAmReady ? t("notYet") : t("imReady")}
            </Button>
          </div>
        </div>
      )}
    </Screen>
  );
}
