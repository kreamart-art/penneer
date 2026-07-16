// Dagronde — one letter per day, the SAME for everyone (that is what makes the
// day board comparable; Oefenen stays random per person). 60 seconds, five
// list categories, list-only scoring, one ranked attempt per account. Guests
// play the identical round unranked and get a profile nudge.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Flame, HelpCircle, Share2, Trophy, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { makeDailyCard, shareOrDownload } from "../util/shareCard";
import { colors, font, radius, withAlpha } from "../theme/tokens";

const MAX_SCORE = 50;
const LOCAL_KEY = "penneer.dailyResult"; // {day, payload} so a reload can re-open

interface DailyCat {
  your: string;
  valid: boolean;
  in_list: boolean;
  points: number;
  missed: string[];
  missed_total: number;
  list_total: number;
}
interface BoardRow {
  id: string;
  name: string;
  color: string;
  avatar_ver: number;
  has_avatar: number;
  score: number;
  time_ms: number;
}
interface DailyResult {
  day: string;
  letter: string;
  score: number;
  categories: Record<string, DailyCat>;
  ranked: boolean;
  rank: number;
  total: number;
  streak: number;
  time_ms: number;
  board: BoardRow[];
  seconds_left: number;
  missions_done?: { key: string; reward: number }[];
}

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: font.ui,
  fontSize: 16,
  color: colors.ink,
  background: withAlpha("#000000", 0.25),
  border: `1.5px solid ${colors.panelBorder}`,
  borderRadius: radius.button,
  padding: "12px 14px",
};

function fmtCountdown(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export function Daily({ game, onBack, onProfile }: { game: GameApi; onBack: () => void; onProfile: () => void }) {
  const { t, tCat, lang } = useT();
  const account = game.state.account;
  const [phase, setPhase] = useState<"intro" | "play" | "result">("intro");
  const [info, setInfo] = useState<{ players: number; played: boolean; streak: number; day: string; seconds_left: number } | null>(null);
  const [letter, setLetter] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(60);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [nextIn, setNextIn] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const deadline = useRef(0);
  const submitted = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;

  useEffect(() => {
    fetch("/api/daily/info", { headers: authHeaders() })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  // Countdown to the next letter, shown on the result (and played-intro).
  useEffect(() => {
    if (nextIn <= 0) return;
    const id = window.setInterval(() => setNextIn((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [nextIn > 0]);

  const openResult = (payload: DailyResult) => {
    setResult(payload);
    setNextIn(payload.seconds_left);
    setPhase("result");
  };

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/daily/start", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (data.played) {
        await viewResult();
        return;
      }
      setLetter(data.letter);
      setCats(data.categories);
      setDuration(data.duration);
      setAnswers(Object.fromEntries((data.categories as string[]).map((c) => [c, ""])));
      submitted.current = false;
      deadline.current = Date.now() + data.duration * 1000;
      setRemaining(data.duration);
      sound.uiTap();
      setPhase("play");
    } finally {
      setBusy(false);
    }
  };

  const viewResult = async () => {
    setBusy(true);
    try {
      // Accounts re-open from the server; guests from their local copy.
      const res = await fetch("/api/daily/result", { headers: authHeaders() });
      if (res.ok) {
        openResult(await res.json());
        return;
      }
      try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
        if (saved && saved.day === info?.day) openResult(saved.payload);
      } catch {
        /* no local copy */
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/daily/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ answers: answersRef.current }),
      });
      const data: DailyResult = await res.json();
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify({ day: data.day, payload: data }));
      } catch {
        /* storage full/blocked */
      }
      sound.results();
      openResult(data);
    } catch {
      submitted.current = false; // network hiccup: let them press again
    } finally {
      setBusy(false);
    }
  };

  // The play clock. Ticks every 200ms; auto-submits at zero.
  useEffect(() => {
    if (phase !== "play") return;
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline.current - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        void submit();
      }
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === "play") inputs.current[0]?.focus();
  }, [phase]);

  const share = async () => {
    if (!result) return;
    setSharing(true);
    try {
      const dayLabel = new Date(result.day + "T12:00:00").toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { day: "numeric", month: "long" });
      const blob = await makeDailyCard({
        dayLabel: t("dailyCardDay", { day: dayLabel }),
        letter: result.letter,
        scoreText: t("dailyPointsPill", { score: result.score }),
        rankText: result.ranked && result.rank > 0 ? t("dailyRankLine", { rank: result.rank, total: result.total }) : "",
        streakText: result.streak > 1 ? t("dailyStreakLine", { n: result.streak }) : "",
        footer: "penneer.artnomad.nl",
      });
      if (blob) await shareOrDownload(blob, "penneer-dagronde.png");
    } finally {
      setSharing(false);
    }
  };

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
        <ArrowLeft size={20} />
      </button>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>
        <CalendarDays size={18} color={colors.gold} /> {t("dailyTitle")}
      </span>
    </div>
  );

  const chip = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, color: colors.sub, background: withAlpha("#000000", 0.22), border: `1px solid ${colors.hairline}`, padding: "6px 11px", borderRadius: 999 }}>
      {icon}
      {label}
    </span>
  );

  // ---- intro ----
  if (phase === "intro") {
    const played = !!info?.played || (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
        return !account && saved && saved.day === info?.day;
      } catch {
        return false;
      }
    })();
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("dailyIntro")}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {info && chip(<Trophy size={13} color={colors.gold} />, t("dailyPlayers", { n: info.players }))}
              {!!info?.streak && info.streak > 0 && chip(<Flame size={13} color={colors.orange} />, t("dailyStreakLine", { n: info.streak }))}
            </div>
          </Card>

          {played ? (
            <>
              <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("dailyPlayed")}</p>
              <Button variant="gold" full disabled={busy} onClick={viewResult}>
                {t("dailyViewResult")}
              </Button>
            </>
          ) : (
            <Button variant="gold" full disabled={busy || !info} onClick={start}>
              {t("dailyStart")}
            </Button>
          )}
        </div>
      </Screen>
    );
  }

  // ---- play ----
  if (phase === "play") {
    const frac = Math.max(0, Math.min(1, remaining / duration));
    const urgent = remaining <= 10;
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ height: 8, borderRadius: 999, background: withAlpha("#000000", 0.3), overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${frac * 100}%`, borderRadius: 999, background: urgent ? colors.red : colors.gold, transition: "width .2s linear" }} />
          </div>
          <div style={{ textAlign: "center", fontFamily: font.display, fontWeight: 700, fontSize: 22, color: urgent ? colors.redHi : colors.sub }}>
            {Math.ceil(remaining)}s
          </div>

          <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 14 }}>
            <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>{t("letterIs")}</span>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 46, color: colors.gold, textShadow: `0 0 24px ${withAlpha(colors.gold, 0.5)}` }}>{letter}</span>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cats.map((cat, i) => (
              <div key={cat}>
                <label style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: colors.faint, marginLeft: 4 }}>{tCat(cat)}</label>
                <input
                  ref={(el) => { inputs.current[i] = el; }}
                  value={answers[cat] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [cat]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (i < cats.length - 1) inputs.current[i + 1]?.focus();
                    else void submit();
                  }}
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                  placeholder={t("fillPlaceholder", { cat: tCat(cat), letter })}
                  style={{ ...inputStyle, marginTop: 4, border: `1.5px solid ${answers[cat] ? withAlpha(colors.gold, 0.5) : colors.panelBorder}` }}
                />
              </div>
            ))}
          </div>

          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("dailyListOnly")}</p>
          <Button variant="gold" full disabled={busy} onClick={() => void submit()}>{t("dailyDone")}</Button>
        </div>
      </Screen>
    );
  }

  // ---- result ----
  if (!result) return <Screen top={header}><div /></Screen>;
  const r = result;
  return (
    <Screen top={header}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>{t("dailyYourScore")}</span>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 54, color: colors.gold, textShadow: `0 0 26px ${withAlpha(colors.gold, 0.5)}`, lineHeight: 1 }}>{r.score}</span>
          <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("dailyScoreOf", { score: r.score, max: MAX_SCORE })}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 }}>
            {r.ranked && r.rank > 0 && chip(<Trophy size={13} color={colors.gold} />, t("dailyRankLine", { rank: r.rank, total: r.total }))}
            {r.streak > 1 && chip(<Flame size={13} color={colors.orange} />, t("dailyStreakLine", { n: r.streak }))}
          </div>
          {account && !r.ranked && (
            <p style={{ margin: "4px 0 0", fontFamily: font.ui, fontSize: 12.5, color: colors.orange, textAlign: "center" }}>{t("dailyUnranked")}</p>
          )}
          {!!r.missions_done?.length && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 4 }}>
              {r.missions_done.map((m) => (
                <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999, color: colors.green, background: withAlpha(colors.green, 0.12), border: `1px solid ${withAlpha(colors.green, 0.45)}` }}>
                  {t("missionDoneChip")}: {t(`mission_${m.key}`)} · +{m.reward} XP
                </span>
              ))}
            </div>
          )}
        </Card>

        {!account && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t("dailyGuestCta")}</p>
            <Button variant="primary" full onClick={onProfile}>{t("profile")}</Button>
          </Card>
        )}

        {cats.length > 0 || Object.keys(r.categories).length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(r.categories).map(([cat, cr]) => {
              const mark = cr.in_list ? "check" : cr.valid ? "question" : "cross";
              const col = mark === "check" ? colors.green : mark === "question" ? colors.orange : colors.red;
              return (
                <Card key={cat} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint, flex: 1 }}>{tCat(cat)}</span>
                    {cr.your ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: col }}>
                        {mark === "check" ? <Check size={15} /> : mark === "question" ? <HelpCircle size={15} /> : <X size={15} />}
                        {cr.your}
                      </span>
                    ) : (
                      <span style={{ fontFamily: font.ui, fontSize: 13, fontStyle: "italic", color: colors.faint }}>{t("empty")}</span>
                    )}
                    <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: cr.points > 0 ? colors.gold : colors.faint }}>+{cr.points}</span>
                  </div>
                  {cr.missed.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {cr.missed.map((w) => (
                        <span key={w} style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.ink, background: withAlpha(colors.gold, 0.1), border: `1px solid ${withAlpha(colors.gold, 0.28)}`, padding: "4px 9px", borderRadius: 999 }}>{w}</span>
                      ))}
                      {cr.missed_total > cr.missed.length && (
                        <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.faint, alignSelf: "center" }}>{t("trainMore", { n: cr.missed_total - cr.missed.length })}</span>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : null}

        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{t("dailyBoardTitle")}</span>
          {r.board.length === 0 && <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("dailyEmptyBoard")}</p>}
          {r.board.map((row, i) => {
            const mine = account && row.id === account.id;
            return (
              <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 10, background: mine ? withAlpha(colors.gold, 0.1) : withAlpha("#000000", 0.18), border: `1px solid ${mine ? withAlpha(colors.gold, 0.45) : colors.hairline}` }}>
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14, color: i === 0 ? colors.gold : colors.faint, width: 22 }}>{i + 1}</span>
                <Avatar name={row.name} color={row.color} size={26} userId={row.id} hasAvatar={!!row.has_avatar} avatarVer={row.avatar_ver} />
                <span style={{ flex: 1, fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>{Math.max(1, Math.round(row.time_ms / 1000))}s</span>
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: i === 0 ? colors.gold : colors.ink, width: 30, textAlign: "right" }}>{row.score}</span>
              </div>
            );
          })}
        </Card>

        <Button variant="primary" full disabled={sharing} onClick={share}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Share2 size={16} /> {t("dailyShare")}
          </span>
        </Button>
        <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>
          {t("dailyNextIn", { t: fmtCountdown(nextIn) })}
        </p>
        <Button variant="ghost" full onClick={onBack}>{t("back")}</Button>
      </div>
    </Screen>
  );
}
