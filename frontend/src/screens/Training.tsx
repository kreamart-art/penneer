// Oefenen — solo practice to learn more words. Pick which categories to train
// (only the ones with a curated list), get a RANDOM letter each round (so
// everyone gets a different sequence), fill in what you know, then the app
// reveals the words from the list you did not name yet. Stateless: no account
// needed, nothing stored (the progress/collection layer is a later step).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, HelpCircle, RotateCw, X } from "lucide-react";
import { Chip } from "../components/Chip";
import { GlasVeld } from "../components/GlasVeld";
import { NeonText } from "../components/NeonText";
import { Paneel } from "../components/ProfileHero";
import { Button } from "../components/Button";
import { Screen, Card } from "../components/Layout";
import { SierKop } from "../components/ProfileHero";
import { SchermTip } from "../components/SchermTip";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

// The trainable categories (server: game.TRAINABLE_CATEGORIES). Land/Stad/Vrucht
// are pre-selected (what the request centered on); Dier/Beroep are opt-in.
const TRAIN_CATS = ["Land", "Stad", "Vrucht", "Dier", "Beroep"] as const;
const DEFAULT_ON = new Set(["Land", "Stad", "Vrucht"]);

interface CheckCat {
  your: string;
  valid: boolean;
  in_list: boolean;
  missed: string[];
  missed_total: number;
  list_total: number;
}
interface CheckResult {
  letter: string;
  categories: Record<string, CheckCat>;
  correct: number;
  learned: number;
}


export function Training({ onBack, lenient = false }: { onBack: () => void; lenient?: boolean }) {
  const { t, tCat } = useT();
  const [phase, setPhase] = useState<"setup" | "round" | "result">("setup");
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_ON));
  const [hard, setHard] = useState(false);
  const [letter, setLetter] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  const [rounds, setRounds] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionSeen, setSessionSeen] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const cats = useMemo(() => TRAIN_CATS.filter((c) => selected.has(c)), [selected]);

  const startRound = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/train/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ used, hard }),
      });
      const data = await res.json();
      setLetter(data.letter);
      setUsed((u) => [...u, data.letter]);
      setAnswers(Object.fromEntries(cats.map((c) => [c, ""])));
      setResult(null);
      setPhase("round");
    } finally {
      setBusy(false);
    }
  };

  // Hetzelfde decor als de lobby: de arena met de gouden hoekstukken en de
  // horizon die oplicht. Het hoort bij de schermen waar je een potje begint.
  useEffect(() => {
    document.body.classList.add("arena");
    return () => document.body.classList.remove("arena");
  }, []);

  useEffect(() => {
    if (phase === "round") inputs.current[0]?.focus();
  }, [phase, letter]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/train/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter, categories: cats, answers, lenient }),
      });
      const data: CheckResult = await res.json();
      setResult(data);
      setRounds((r) => r + 1);
      setSessionCorrect((c) => c + data.correct);
      setSessionSeen((s) => s + data.learned);
      sound.results();
      setPhase("result");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (c: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
        <ArrowLeft size={20} />
      </button>
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("trainTitle")}
      </span>
      {rounds > 0 && (
        <span style={{ marginLeft: "auto", fontFamily: font.ui, fontSize: 12, color: colors.faint }}>
          {t("trainSession", { correct: sessionCorrect, seen: sessionSeen })}
        </span>
      )}
    </div>
  );

  // ---- setup ----
  if (phase === "setup") {
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("trainIntro")}</p>
          </Card>

          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SierKop label={t("trainPickCats")} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TRAIN_CATS.map((c) => {
                const on = selected.has(c);
                return (
                  <Chip key={c} active={on} onClick={() => toggle(c)}>{tCat(c)}</Chip>
                );
              })}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} style={{ accentColor: colors.gold, width: 17, height: 17 }} />
              <span style={{ fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("hardLetters")}</span>
            </label>
          </Card>

          <Button variant="gold" full disabled={cats.length === 0 || busy} onClick={startRound}>
            {t("trainStart")}
          </Button>
        </div>
      </Screen>
    );
  }

  // ---- round (fill in) ----
  if (phase === "round") {
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Paneel>
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
              <span style={{ fontFamily: font.ui, fontSize: 11.5, letterSpacing: 0.6, color: colors.sub }}>{t("letterIs")}</span>
              {/* Zelfde behandeling als de letter op de rol: een gouden verloop
                  met de gloed als vervaagde kopie erachter, niet een gekleurde
                  letter met een schaduw eromheen. */}
              <NeonText accent={colors.gold} blur={18} glow={0.72} style={{ fontFamily: font.display, fontWeight: 700, fontSize: "clamp(52px, 17vw, 74px)", lineHeight: 1 }}>{letter}</NeonText>
            </div>
          </Paneel>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cats.map((cat, i) => (
              <div key={cat}>
                <label style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: colors.faint, marginLeft: 4 }}>{tCat(cat)}</label>
                <GlasVeld
                  ref={(el) => { inputs.current[i] = el; }}
                  gevuld={!!answers[cat]}
                  value={answers[cat] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [cat]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (i < cats.length - 1) inputs.current[i + 1]?.focus();
                    else submit();
                  }}
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                  placeholder={t("fillPlaceholder", { cat: tCat(cat), letter })}
                  kaderStyle={{ marginTop: 4 }}
                />
              </div>
            ))}
          </div>

          <Button variant="gold" full disabled={busy} onClick={submit}>{t("trainCheck")}</Button>
        </div>
      </Screen>
    );
  }

  // ---- result (reveal what you missed) ----
  return (
    <Screen top={header}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SchermTip id="oefenen" tekst={t("tipOefenen")} />
        <div style={{ textAlign: "center", fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
          {t("trainLetterWas")} <span style={{ fontFamily: font.display, fontWeight: 700, color: colors.gold, fontSize: 16 }}>{letter}</span>
        </div>

        {cats.map((cat) => {
          const r = result!.categories[cat];
          if (!r) return null;
          const mark = r.in_list ? "check" : r.valid ? "question" : "cross";
          const col = mark === "check" ? colors.green : mark === "question" ? colors.orange : colors.red;
          return (
            <Card key={cat} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint, flex: 1 }}>{tCat(cat)}</span>
                {r.your ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: col }}>
                    {mark === "check" ? <Check size={15} /> : mark === "question" ? <HelpCircle size={15} /> : <X size={15} />}
                    {r.your}
                  </span>
                ) : (
                  <span style={{ fontFamily: font.ui, fontSize: 13, fontStyle: "italic", color: colors.faint }}>{t("empty")}</span>
                )}
              </div>

              {r.missed.length > 0 ? (
                <>
                  <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>{t("trainMissedTitle")}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {r.missed.map((w) => (
                      <span key={w} style={{ fontFamily: font.ui, fontSize: 13, color: colors.ink, background: withAlpha(colors.gold, 0.1), border: `1px solid ${withAlpha(colors.gold, 0.28)}`, padding: "5px 10px", borderRadius: 999 }}>{w}</span>
                    ))}
                    {r.missed_total > r.missed.length && (
                      <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.faint, alignSelf: "center" }}>{t("trainMore", { n: r.missed_total - r.missed.length })}</span>
                    )}
                  </div>
                </>
              ) : (
                <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.green }}>{t("trainKnewAll")}</span>
              )}
            </Card>
          );
        })}

        <Button variant="gold" full disabled={busy} onClick={startRound}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <RotateCw size={16} /> {t("trainNext")}
          </span>
        </Button>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button variant="ghost" onClick={() => setPhase("setup")}>{t("trainStop")}</Button>
        </div>
      </div>
    </Screen>
  );
}
