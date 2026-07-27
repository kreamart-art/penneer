// Topografie — het tweede deel van de Dagronde. Acht aardrijkskundevragen, elke
// dag dezelfde voor iedereen, EEN VOOR EEN met vijftien seconden per vraag, net
// als een duelronde. Een poging per account.
//
// Bewust een eigen scherm en een eigen ranglijst naast het woordendeel: de twee
// scoren op een andere schaal (80 tegen 50 punten) en meten iets anders, dus in
// een lijst door elkaar zou geen van beide iets zeggen.
//
// Elke vraag wordt apart bij de server opgehaald en daar gestempeld. Dat is het
// hele punt van vraag voor vraag: je kunt niet vooruit lezen, en de app sluiten
// en heropenen levert geen bedenktijd op, want de klok loopt bij de server.
//
// Antwoorden worden getypt. De server laat een paar letters speling toe, want
// eigennamen zijn lastig te spellen en dit is geen dictee.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Flame, Globe2, Trophy, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { NeonText } from "../components/NeonText";
import { neonSkin, rampFrom } from "../theme/neon";
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
  const [q, setQ] = useState<{ idx: number; id: string; q: string } | null>(null);
  const [total, setTotal] = useState(8);
  const [word, setWord] = useState("");
  const [duration, setDuration] = useState(15);
  const [remaining, setRemaining] = useState(15);
  const [result, setResult] = useState<TopoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const deadline = useRef(0);
  const submitted = useRef(false);
  // Wat je typt, buiten de render om. De klok kan elk moment aflopen en dan moet
  // het antwoord dat er OP DAT MOMENT staat mee, niet dat van een render eerder.
  const wordRef = useRef("");
  wordRef.current = word;
  // Voor gasten houden we de antwoorden zelf bij: die hebben geen account, dus de
  // server heeft niets om ze aan te hangen.
  const guestAnswers = useRef<Record<string, string>>({});

  const openResult = (data: TopoResult) => {
    sound.results();
    setResult(data);
    setPhase("result");
  };

  const viewStored = async () => {
    const res = await fetch(`/api/daily/topo/result?lang=${lang}`, { headers: authHeaders() });
    if (res.ok) {
      setResult(await res.json());
      setPhase("result");
      return true;
    }
    return false;
  };

  /** Haal vraag `i` op en zet de klok op wat de server nog overlaat. */
  const serve = async (i: number) => {
    const res = await fetch("/api/daily/topo/serve", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ idx: i, lang }),
    });
    const data = await res.json();
    setQ({ idx: data.idx, id: data.id, q: data.q });
    setTotal(data.total);
    setDuration(data.seconds);
    setRemaining(data.seconds_left);
    deadline.current = Date.now() + data.seconds_left * 1000;
    setWord("");
    window.setTimeout(() => input.current?.focus(), 30);
  };

  useEffect(() => {
    let alive = true;
    const go = async () => {
      setBusy(true);
      try {
        if (played && (await viewStored())) return;
        const res = await fetch("/api/daily/topo/start", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ lang }),
        });
        const data = await res.json();
        if (!alive) return;
        if (data.played) {
          await viewStored();
          return;
        }
        setTotal(data.total);
        setDuration(data.seconds);
        submitted.current = false;
        await serve(0);
        setPhase("play");
      } finally {
        if (alive) setBusy(false);
      }
    };
    void go();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Antwoord vastleggen en door naar de volgende vraag, of inleveren. */
  const next = async () => {
    if (busy || !q) return;
    setBusy(true);
    try {
      const answer = wordRef.current.trim();
      guestAnswers.current[q.id] = answer;
      await fetch("/api/daily/topo/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ idx: q.idx, answer }),
      });
      if (q.idx + 1 < total) {
        await serve(q.idx + 1);
      } else {
        await submit();
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    try {
      const res = await fetch("/api/daily/topo/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ answers: guestAnswers.current, lang }),
      });
      openResult(await res.json());
    } catch {
      submitted.current = false; // netwerkhikje: laat ze nog een keer drukken
    }
  };

  // De klok van de HUIDIGE vraag. Bij nul gaat hij vanzelf door: dat is de
  // afspraak, vijftien seconden en dan de volgende.
  useEffect(() => {
    if (phase !== "play" || !q) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline.current - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        void next();
      }
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q?.idx]);

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

  // ---- spelen: EEN vraag tegelijk ----
  if (phase === "play") {
    const frac = Math.max(0, Math.min(1, remaining / duration));
    const urgent = remaining <= 5;
    const tint = urgent ? colors.red : colors.gold;
    const ramp = rampFrom(tint);
    const last = !!q && q.idx + 1 >= total;
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* De stapjes: waar je bent in de acht. */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                style={{
                  width: i === (q?.idx ?? 0) ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: i < (q?.idx ?? 0) ? withAlpha(colors.gold, 0.55) : i === (q?.idx ?? 0) ? colors.gold : withAlpha("#FFFFFF", 0.12),
                  transition: "width .2s ease, background .2s ease",
                }}
              />
            ))}
          </div>

          {/* De tijdbalk als groef, zelfde taal als de XP-balk en de ronde-timer. */}
          <div
            className="neon-ring"
            style={{
              height: 10,
              borderRadius: 999,
              background: withAlpha("#000000", 0.55),
              boxShadow: "inset 0 2px 4px rgba(0,0,0,.8), inset 0 -1px 0 rgba(255,255,255,.07)",
              overflow: "hidden",
              ...neonSkin(tint, true),
              ["--ng-w" as string]: "1px",
            } as React.CSSProperties}
          >
            <div
              style={{
                height: "100%",
                width: `${frac * 100}%`,
                borderRadius: 999,
                background: `linear-gradient(180deg, ${ramp[3]} 0%, ${ramp[2]} 42%, ${ramp[1]} 100%)`,
                boxShadow: `inset 0 1px 0 ${withAlpha(ramp[3], 0.8)}, inset 0 -2px 3px rgba(0,0,0,.45)`,
                transition: "width .12s linear",
              }}
            />
          </div>

          <div style={{ textAlign: "center" }}>
            <NeonText accent={tint} blur={14} glow={0.75} style={{ fontFamily: font.display, fontWeight: 700, fontSize: 40, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {Math.ceil(remaining)}
            </NeonText>
          </div>

          <Card key={q?.idx} className="pop-in" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18 }}>
            <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
              {t("topoQuestionOf", { i: (q?.idx ?? 0) + 1, n: total })}
            </span>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 19, color: colors.ink, lineHeight: 1.3 }}>{q?.q ?? ""}</span>
            <input
              ref={input}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void next(); }}
              autoComplete="off" autoCorrect="off" spellCheck={false}
              placeholder={t("topoPlaceholder")}
              style={{ ...inputStyle, border: `1.5px solid ${word ? withAlpha(colors.gold, 0.5) : colors.panelBorder}` }}
            />
          </Card>

          <Button variant="gold" full disabled={busy || !q} onClick={() => void next()}>
            {last ? t("topoDone") : t("topoNext")}
          </Button>
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
