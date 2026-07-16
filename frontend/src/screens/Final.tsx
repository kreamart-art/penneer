// Final — winner with emblem + gold score pill, post-match ceremony (confetti,
// XP count-up with level bar, level-up, rank-up, badges, missions), full
// scoreboard, share, replay.
import { useEffect, useMemo, useRef, useState } from "react";
import { Award, Share2, Star, Target } from "lucide-react";
import { Logo } from "../components/Logo";
import { Avatar, RANK_RING } from "../components/Avatar";
import { Button } from "../components/Button";
import { Scoreboard } from "../components/Scoreboard";
import { Screen, Card } from "../components/Layout";
import { TopBar } from "../components/TopBar";
import type { GameApi, MatchSummary } from "../net/socket";
import { subLabelKey, useT } from "../i18n/i18n";
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

  const iWon = !!(game.me && winners.some((w) => w.id === game.me!.id));
  const summary = game.state.matchSummary;

  return (
    <Screen top={<TopBar code={room.code} connected={game.state.status === "open"} onLeave={game.leaveRoom} game={game} />}>
      {iWon && <Confetti />}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Logo size={120} />
          <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: colors.faint }}>
            {shared ? t("sharedLead") : t("winner")}
          </span>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {winners.map((w) => (
              <div key={w.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Avatar name={w.name} color={w.color} size={66} crown userId={w.user_id} hasAvatar={w.has_avatar} avatarVer={w.avatar_ver} rank={w.rank} />
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: colors.ink }}>{w.name}</span>
                {(() => {
                  const sub = subLabelKey(w.title, w.rank);
                  return sub ? <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: colors.gold }}>{t(sub)}</span> : null;
                })()}
              </div>
            ))}
          </div>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: "#2A1B05", background: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold})`, padding: "6px 18px", borderRadius: 999, boxShadow: `0 0 26px ${withAlpha(colors.gold, 0.5)}` }}>
            {t("pointsN", { score: top })}
          </span>
        </div>

        {summary && <Ceremony summary={summary} />}

        <Card>
          <Scoreboard players={room.players} scores={room.scores} meId={game.me?.id ?? null} />
        </Card>

        <Button variant="primary" full disabled={busy} onClick={share}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Share2 size={18} /> {t("shareResult")}
          </span>
        </Button>

        {game.isHost ? (
          <>
            <Button variant="gold" full onClick={game.rematch}>
              {t("rematchBtn")}
            </Button>
            <Button variant="ghost" full onClick={game.playAgain}>
              {t("playAgain")}
            </Button>
          </>
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

// ---- winner confetti ---------------------------------------------------------

const CONFETTI_COLORS = [colors.gold, colors.goldHi, colors.violet, colors.green, colors.red, "#FF7AC2"];

function Confetti() {
  // One burst, generated once; unmounts itself after the fall.
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: Math.random() * 100,
        w: 6 + Math.random() * 5,
        h: 10 + Math.random() * 7,
        delay: Math.random() * 1.1,
        dur: 2.6 + Math.random() * 1.6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        tilt: Math.random() * 360,
      })),
    []
  );
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setGone(true), 5200);
    return () => window.clearTimeout(id);
  }, []);
  if (gone) return null;
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 60, overflow: "hidden", pointerEvents: "none" }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: 2,
            rotate: `${p.tilt}deg`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---- post-match ceremony -------------------------------------------------------

// Timeline: XP counts up while the level bar fills; a level-up flashes the new
// level and refills from zero; then rank-up, badges and completed missions pop
// in one after another. Pure timeouts + CSS transitions.
function Ceremony({ summary }: { summary: MatchSummary }) {
  const { t } = useT();
  const before = summary.level_before;
  const after = summary.level_after;
  const leveledUp = after.level > before.level;
  const rankedUp = after.rank !== before.rank;

  const frac = (lvl: typeof before) =>
    Math.min(1, Math.max(0, (lvl.xp - lvl.level_start) / Math.max(1, lvl.next_level - lvl.level_start)));

  const [xpShown, setXpShown] = useState(0);
  const [barPct, setBarPct] = useState(frac(before) * 100);
  const [level, setLevel] = useState(before.level);
  const [stage, setStage] = useState(0); // 1 levelup-flash, 2 rank, 3 badges, 4 missions

  // Runs once per mount ([]); the cleanup cancels everything so StrictMode's
  // dev double-invoke simply replays the ceremony instead of killing it.
  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    // XP count-up (ease-out over 1.2s).
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 1200);
      setXpShown(Math.round(summary.xp_gained * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Bar: fill to 100% on level-up, else straight to the after fraction.
    at(150, () => setBarPct(leveledUp ? 100 : frac(after) * 100));
    if (leveledUp) {
      at(1000, () => {
        setStage(1);
        setLevel(after.level);
        sound.badge();
        setBarPct(0);
      });
      at(1250, () => setBarPct(frac(after) * 100));
    }
    const base = leveledUp ? 1600 : 1100;
    if (rankedUp) at(base, () => { setStage(2); sound.badge(); });
    if (summary.badges.length > 0) at(base + (rankedUp ? 400 : 0), () => setStage(3));
    if (summary.missions_done.length > 0) at(base + (rankedUp ? 400 : 0) + (summary.badges.length ? 350 : 0), () => setStage(4));
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringColor = RANK_RING[after.rank] ?? colors.gold;
  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: font.ui,
    fontSize: 12.5,
    fontWeight: 700,
    padding: "6px 12px",
    borderRadius: 999,
  };

  return (
    <Card className="reveal-rise" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: 46, height: 46, flexShrink: 0 }}>
          <Star size={46} color={colors.gold} fill={withAlpha(colors.gold, stage >= 1 ? 0.5 : 0.25)} strokeWidth={1.4} />
          <span key={level} className={stage >= 1 ? "pop-in" : undefined} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink, paddingTop: 2 }}>
            {level}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold }}>+{xpShown} XP</span>
            {stage >= 1 && (
              <span className="pop-in" style={{ fontFamily: font.ui, fontSize: 12.5, fontWeight: 800, color: colors.bg0, background: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold})`, padding: "3px 10px", borderRadius: 999 }}>
                {t("ceremonyLevelUp", { n: after.level })}
              </span>
            )}
          </div>
          <div style={{ height: 10, borderRadius: 999, background: withAlpha("#000000", 0.35), border: `1px solid ${colors.hairline}`, overflow: "hidden" }}>
            <div
              style={{
                width: `${barPct}%`,
                height: "100%",
                borderRadius: 999,
                background: `linear-gradient(90deg, ${colors.gold}, ${colors.goldHi})`,
                boxShadow: `0 0 10px ${withAlpha(colors.gold, 0.6)}`,
                transition: "width .85s cubic-bezier(.22,.9,.35,1)",
              }}
            />
          </div>
        </div>
      </div>

      {stage >= 2 && rankedUp && (
        <div className="pop-in" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: "4px 0" }}>
          <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>{t("ceremonyNewRank")}</span>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: ringColor, textShadow: `0 0 14px ${withAlpha(ringColor, 0.6)}` }}>
            {t(`rank_${after.rank}`)}
          </span>
        </div>
      )}

      {stage >= 3 && summary.badges.length > 0 && (
        <div className="pop-in" style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {summary.badges.map((b) => (
            <span key={b} style={{ ...chip, color: colors.gold, background: withAlpha(colors.gold, 0.12), border: `1px solid ${withAlpha(colors.gold, 0.45)}` }}>
              <Award size={13} /> {t(`badge_${b}`)}
            </span>
          ))}
        </div>
      )}

      {stage >= 4 && summary.missions_done.length > 0 && (
        <div className="pop-in" style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          {summary.missions_done.map((m) => (
            <span key={m.key} style={{ ...chip, color: colors.green, background: withAlpha(colors.green, 0.12), border: `1px solid ${withAlpha(colors.green, 0.45)}` }}>
              <Target size={13} /> {t(`mission_${m.key}`)} · +{m.reward} XP
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
