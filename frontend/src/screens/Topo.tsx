// Topografie — het tweede deel van de Dagronde. Acht aardrijkskundevragen, elke
// dag dezelfde voor iedereen, 90 seconden, een poging per account.
//
// Bewust een eigen scherm en een eigen ranglijst naast het woordendeel: de twee
// scoren op een andere schaal (80 tegen 50 punten) en meten iets anders, dus in
// een lijst door elkaar zou geen van beide iets zeggen.
//
// Antwoorden worden getypt. De server laat een paar letters speling toe, want
// eigennamen zijn lastig te spellen en dit is geen dictee.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Flame, Globe2, Trophy, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Screen, Card } from "../components/Layout";
import { NeonText } from "../components/NeonText";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, radius, withAlpha } from "../theme/tokens";

interface Question {
  id: string;
  q: string;
}
interface ResultRow extends Question {
  your: string;
  ok: boolean;
  points: number;
  answer: string;
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
interface TopoResult {
  day: string;
  score: number;
  max_score: number;
  questions: ResultRow[];
  ranked: boolean;
  rank: number;
  total: number;
  streak: number;
  time_ms: number;
  board: BoardRow[];
  seconds_left: number;
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

export function Topo({ game, onBack, onProfile, played }: { game: GameApi; onBack: () => void; onProfile: () => void; played: boolean }) {
  const { t, lang } = useT();
  const account = game.state.account;
  const [phase, setPhase] = useState<"play" | "result">("play");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [result, setResult] = useState<TopoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const deadline = useRef(0);
  const submitted = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;

  // Binnenkomen: al gespeeld -> meteen de uitslag, anders de vragen halen. De
  // klok begint bij de server op de EERSTE start van de dag, dus de app sluiten
  // en heropenen levert geen extra bedenktijd op.
  useEffect(() => {
    let alive = true;
    const go = async () => {
      setBusy(true);
      try {
        if (played) {
          const res = await fetch(`/api/daily/topo/result?lang=${lang}`, { headers: authHeaders() });
          if (res.ok && alive) {
            setResult(await res.json());
            setPhase("result");
            return;
          }
        }
        const res = await fetch("/api/daily/topo/start", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ lang }),
        });
        const data = await res.json();
        if (!alive) return;
        if (data.played) {
          const r2 = await fetch(`/api/daily/topo/result?lang=${lang}`, { headers: authHeaders() });
          if (r2.ok && alive) {
            setResult(await r2.json());
            setPhase("result");
          }
          return;
        }
        setQuestions(data.questions);
        setDuration(data.duration);
        setAnswers(Object.fromEntries((data.questions as Question[]).map((q) => [q.id, ""])));
        submitted.current = false;
        deadline.current = Date.now() + data.duration * 1000;
        setRemaining(data.duration);
        setPhase("play");
      } finally {
        if (alive) setBusy(false);
      }
    };
    void go();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/daily/topo/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ answers: answersRef.current, lang }),
      });
      const data: TopoResult = await res.json();
      sound.results();
      setResult(data);
      setPhase("result");
    } catch {
      submitted.current = false; // netwerkhikje: laat ze nog een keer drukken
    } finally {
      setBusy(false);
    }
  };

  // De speelklok. Tikt elke 200ms en levert bij nul vanzelf in.
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

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
        <ArrowLeft size={20} />
      </button>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>
        <Globe2 size={18} color={colors.gold} /> {t("topoTitle")}
      </span>
    </div>
  );

  const chip = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, color: colors.sub, background: withAlpha("#000000", 0.22), border: `1px solid ${colors.hairline}`, padding: "6px 11px", borderRadius: 999 }}>
      {icon}
      {label}
    </span>
  );

  // ---- spelen ----
  if (phase === "play") {
    const frac = Math.max(0, Math.min(1, remaining / duration));
    const urgent = remaining <= 15;
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ height: 8, borderRadius: 999, background: withAlpha("#000000", 0.3), overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${frac * 100}%`, borderRadius: 999, background: urgent ? colors.red : colors.gold, transition: "width .2s linear" }} />
          </div>
          <div style={{ textAlign: "center", fontFamily: font.display, fontWeight: 700, fontSize: 22, color: urgent ? colors.redHi : colors.sub }}>
            {Math.ceil(remaining)}s
          </div>

          {questions.map((q, i) => (
            <Card key={q.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
              <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
                {t("topoQuestionOf", { i: i + 1, n: questions.length })}
              </span>
              <span style={{ fontFamily: font.ui, fontSize: 14.5, color: colors.ink, lineHeight: 1.4 }}>{q.q}</span>
              <input
                ref={(el) => { inputs.current[i] = el; }}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (i < questions.length - 1) inputs.current[i + 1]?.focus();
                  else void submit();
                }}
                autoComplete="off" autoCorrect="off" spellCheck={false}
                placeholder={t("topoPlaceholder")}
                style={{ ...inputStyle, border: `1.5px solid ${answers[q.id] ? withAlpha(colors.gold, 0.5) : colors.panelBorder}` }}
              />
            </Card>
          ))}

          <Button variant="gold" full disabled={busy || !questions.length} onClick={() => void submit()}>{t("topoDone")}</Button>
        </div>
      </Screen>
    );
  }

  // ---- uitslag ----
  if (!result) return <Screen top={header}><div /></Screen>;
  const r = result;
  return (
    <Screen top={header}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>{t("topoYourScore")}</span>
          <NeonText accent={colors.gold} blur={18} glow={0.7} style={{ fontFamily: font.display, fontWeight: 700, fontSize: 54, lineHeight: 1 }}>{r.score}</NeonText>
          <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("dailyScoreOf", { score: r.score, max: r.max_score })}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 }}>
            {r.ranked && r.rank > 0 && chip(<Trophy size={13} color={colors.gold} />, t("dailyRankLine", { rank: r.rank, total: r.total }))}
            {r.streak > 1 && chip(<Flame size={13} color={colors.orange} />, t("dailyStreakLine", { n: r.streak }))}
          </div>
          {account && !r.ranked && (
            <p style={{ margin: "4px 0 0", fontFamily: font.ui, fontSize: 12.5, color: colors.orange, textAlign: "center" }}>{t("dailyUnranked")}</p>
          )}
        </Card>

        {!account && (
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.sub, lineHeight: 1.5 }}>{t("dailyGuestCta")}</p>
            <Button variant="primary" full onClick={onProfile}>{t("profile")}</Button>
          </Card>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {r.questions.map((row) => (
            <Card key={row.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14 }}>
              <span style={{ fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.4 }}>{row.q}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: 1, fontFamily: font.ui, fontSize: 14.5, fontWeight: 600, color: row.ok ? colors.green : colors.red }}>
                  {row.ok ? <Check size={15} /> : <X size={15} />}
                  {row.your || <span style={{ fontStyle: "italic", fontWeight: 400, color: colors.faint }}>{t("empty")}</span>}
                </span>
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: row.points > 0 ? colors.gold : colors.faint }}>+{row.points}</span>
              </div>
              {!row.ok && (
                <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.ink, background: withAlpha(colors.gold, 0.1), border: `1px solid ${withAlpha(colors.gold, 0.28)}`, padding: "4px 9px", borderRadius: 999, alignSelf: "flex-start" }}>
                  {t("topoAnswerWas", { a: row.answer })}
                </span>
              )}
            </Card>
          ))}
        </div>

        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{t("topoBoardTitle")}</span>
          {r.board.length === 0 && <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("topoEmptyBoard")}</p>}
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

        <Button variant="ghost" full onClick={onBack}>{t("back")}</Button>
      </div>
    </Screen>
  );
}
