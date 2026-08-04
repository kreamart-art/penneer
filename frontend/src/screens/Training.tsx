// Oefenen — solo practice to learn more words. Pick which categories to train
// (only the ones with a curated list), get a RANDOM letter each round (so
// everyone gets a different sequence), fill in what you know, then the app
// reveals the words from the list you did not name yet. Stateless: no account
// needed, nothing stored (the progress/collection layer is a later step).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Apple, Brain, Briefcase, Building2, Check, Globe, HelpCircle, Info, Layers, PawPrint, RotateCw, Shuffle, Target, X } from "lucide-react";
import { GoudKader } from "../components/GoudKader";
import { Tv } from "../components/Tv";
import { HubSectie, VerzamelBalk } from "./Ontdekken";
import { Chip } from "../components/Chip";
import { GlasVeld } from "../components/GlasVeld";
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

// Dezelfde iconen als in Ontdekken, zodat een categorie er overal hetzelfde
// uitziet. Lijntekeningen en geen emoji: emoji ziet er op elk toestel anders uit.
const CAT_ICOON = {
  Land: Globe, Stad: Building2, Vrucht: Apple, Dier: PawPrint, Beroep: Briefcase,
} as const;

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


export function Training({ onBack, lenient = false, onOntdekken, startLetter, ontdekStijl = false, onVerzameling }: {
  onBack: () => void; lenient?: boolean;
  /** Alleen gezet als de admin-schakelaar aanstaat; anders bestaat de knop niet. */
  onOntdekken?: () => void;
  /** De letter van vandaag, als je vanaf Ontdekken komt. Die staat dan op de
   *  knop ("Begin met B") en is de letter waarmee de eerste ronde begint. */
  startLetter?: string | null;
  /** Het instelscherm in de opzet van Ontdekken. Alleen als de schakelaar
   *  aanstaat; anders blijft het oude scherm precies zoals het was. */
  ontdekStijl?: boolean;
  onVerzameling?: () => void;
}) {
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

  /** `willekeurig` slaat de letter van vandaag over. Dat is het verschil tussen
   *  "Begin met B" en "Willekeurige letter": dezelfde ronde, andere letter. */
  const startRound = async (willekeurig = false) => {
    setBusy(true);
    try {
      const res = await fetch("/api/train/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Alleen de eerste ronde krijgt de dagletter mee; daarna is het weer
        // gewoon oefenen met een willekeurige letter.
        body: JSON.stringify({
          used, hard,
          // Alleen de EERSTE ronde krijgt de dagletter mee; daarna is het weer
          // gewoon oefenen met een willekeurige letter.
          letter: !willekeurig && rounds === 0 ? startLetter || undefined : undefined,
        }),
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

  // De reeks voor de kop van het instelscherm. Alleen ophalen als dat scherm
  // ook getoond wordt; anders is het een verzoek voor niets.
  const [reeks, setReeks] = useState(0);
  useEffect(() => {
    if (!ontdekStijl) return;
    let weg = false;
    const token = localStorage.getItem("penneer.accountToken") || "";
    fetch("/api/discover/overview", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!weg && d) setReeks(d.streak_days ?? 0); })
      .catch(() => { /* zonder reeks staat er gewoon 0 */ });
    return () => { weg = true; };
  }, [ontdekStijl]);

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
      {/* Zit je in een ronde, dan brengt terug je naar het instelscherm en niet
          meteen het scherm uit: daar heb je net je categorieen gekozen, en dat
          is de stap waar je op terug wilt kunnen. */}
      <button
        onClick={() => { if (phase === "setup") onBack(); else { setResult(null); setPhase("setup"); } }}
        aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
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

  // ---- het instelscherm in de opzet van Ontdekken ----------------------------
  // Zelfde bouwstenen als de hub: de sectie-art bovenaan, de achthoek-vakken
  // eronder en de verzamelbalk als afsluiting. Wat je hier kiest bepaalt de
  // ronde; de letter van vandaag staat op de bovenste knop, en de grote knop
  // eronder start met een willekeurige letter.
  if (phase === "setup" && ontdekStijl) {
    const kies = (c: string) => { sound.uiTap(); toggle(c); };
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 8 }}>
          <HubSectie
            letter={startLetter || null}
            streak={reeks}
            uitleg={t("trainDagUitleg")}
            knopTekst={startLetter ? t("trainBeginMet", { letter: startLetter }) : t("trainStart")}
            onSpeel={() => { if (cats.length && !busy) void startRound(); }}
          />

          <GoudKader hoek={13} kleur="violet" dik={0.6} gloed vulling binnenlijn hoekAccent="#F3B53E" puntjes padding={12}>
            <SierKop label={t("trainPickCats")} />
            {/* Drie op de eerste rij en twee op de tweede, zoals in het ontwerp.
                Een gekozen categorie is gevuld violet, een niet-gekozen is een
                omtrek: dat verschil moet je zonder kleurenzicht ook zien, dus
                het vinkje-icoon links verandert mee van kleur en helderheid. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 4 }}>
              {TRAIN_CATS.map((c) => {
                const aan = selected.has(c);
                const Ico = CAT_ICOON[c];
                return (
                  <button
                    key={c}
                    onClick={() => kies(c)}
                    aria-pressed={aan}
                    className="pressable"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 6px", borderRadius: 999, cursor: "pointer",
                      background: aan
                        ? `linear-gradient(180deg, ${withAlpha(colors.violet, 0.95)}, ${withAlpha(colors.violetDeep, 0.95)})`
                        : "rgba(255,255,255,.03)",
                      border: `1px solid ${aan ? withAlpha("#D9A6DF", 0.75) : withAlpha("#572D7C", 0.85)}`,
                      boxShadow: aan ? `0 0 10px ${withAlpha(colors.violet, 0.45)}` : "none",
                      fontFamily: font.ui, fontSize: 13, fontWeight: 700,
                      color: aan ? "#FFFFFF" : colors.sub,
                    }}
                  >
                    <Ico size={15} style={{ flexShrink: 0, opacity: aan ? 1 : 0.75 }} />
                    {tCat(c)}
                  </button>
                );
              })}
            </div>

            {/* Moeilijke letters: een eigen vak, want het hoort bij de keuze
                maar het is een andere soort keuze dan een categorie. */}
            <label
              style={{
                display: "flex", alignItems: "center", gap: 10, marginTop: 10, cursor: "pointer",
                padding: "9px 11px", borderRadius: 12,
                background: "rgba(255,255,255,.03)", border: `1px solid ${withAlpha("#572D7C", 0.7)}`,
              }}
            >
              <input
                type="checkbox" checked={hard} onChange={(e) => { sound.uiTap(); setHard(e.target.checked); }}
                style={{ accentColor: colors.gold, width: 17, height: 17, flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontFamily: font.ui, fontSize: 13, color: colors.sub }}>{t("hardLetters")}</span>
              <Info size={15} color={colors.faint} style={{ flexShrink: 0 }} />
            </label>
          </GoudKader>

          <GoudKader hoek={13} kleur="violet" dik={0.6} gloed vulling binnenlijn hoekAccent="#F3B53E" puntjes padding={12}>
            <SierKop label={t("trainOpbrengstKop")} />
            {/* Drie kolommen met een haarlijn ertussen. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, marginTop: 6 }}>
              {[
                { Ico: Layers, kop: t("trainOpbrengst1"), sub: t("trainOpbrengst1Sub") },
                { Ico: Target, kop: t("trainOpbrengst2"), sub: t("trainOpbrengst2Sub") },
                { Ico: Brain, kop: t("trainOpbrengst3"), sub: t("trainOpbrengst3Sub") },
              ].map((k, i) => (
                <div
                  key={k.kop}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    padding: "2px 5px", textAlign: "center",
                    borderLeft: i === 0 ? "none" : `1px solid ${withAlpha("#572D7C", 0.55)}`,
                  }}
                >
                  <k.Ico
                    size={26} color="#D986FC"
                    style={{ filter: "drop-shadow(0 0 9px rgba(223,146,255,.3)) drop-shadow(0 0 20px rgba(196,95,250,.2))" }}
                  />
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: "clamp(9px, 2.85vw, 13px)", lineHeight: 1.15, color: colors.gold }}>
                    {k.kop}
                  </span>
                  <span style={{ fontFamily: font.ui, fontSize: "clamp(8px, 2.35vw, 11px)", lineHeight: 1.28, color: colors.sub }}>
                    {k.sub}
                  </span>
                </div>
              ))}
            </div>
          </GoudKader>

          <Button variant="gold" full disabled={cats.length === 0 || busy} onClick={() => void startRound()}>
            {t("trainStart")}
          </Button>

          {/* Twee kleinere ingangen naast elkaar. De quizronde loopt via
              Ontdekken, want daar zitten de feiten waarover gevraagd wordt. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { Ico: Target, kop: t("trainQuizronde"), sub: t("trainQuizrondeSub"), doe: onOntdekken },
              { Ico: Shuffle, kop: t("trainWillekeurig"), sub: t("trainWillekeurigSub"), doe: () => { if (cats.length && !busy) void startRound(true); } },
            ].map((k) => (
              <GoudKader key={k.kop} hoek={11} kleur="violet" dik={0.6} gloed vulling padding={0}>
                <button
                  onClick={() => { if (!k.doe) return; sound.uiTap(); k.doe(); }}
                  disabled={!k.doe}
                  className={k.doe ? "pressable" : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "10px 10px", background: "transparent", border: "none",
                    cursor: k.doe ? "pointer" : "default", textAlign: "left", opacity: k.doe ? 1 : 0.45,
                  }}
                >
                  <k.Ico size={20} color={colors.gold} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: font.display, fontWeight: 700, fontSize: 12.5, color: colors.ink }}>
                      {k.kop}
                    </span>
                    <span style={{ display: "block", fontFamily: font.ui, fontSize: 10, lineHeight: 1.25, color: colors.sub, marginTop: 1 }}>
                      {k.sub}
                    </span>
                  </span>
                </button>
              </GoudKader>
            ))}
          </div>

          {onVerzameling && <VerzamelBalk onClick={onVerzameling} />}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "2px 0 6px" }}>
            <Info size={13} color={colors.faint} style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint, textAlign: "center" }}>
              {t("trainVoetnoot")}
            </span>
          </div>
        </div>
      </Screen>
    );
  }

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

          <Button variant="gold" full disabled={cats.length === 0 || busy} onClick={() => void startRound()}>
            {t("trainStart")}
          </Button>

          {/* Ontdekken hangt onder Oefenen, want daar komen de kaarten vandaan.
              Staat er alleen als de admin-schakelaar in Instellingen aanstaat. */}
          {onOntdekken && !startLetter && (
            <Button variant="ghost" full onClick={onOntdekken}>
              {t("ontdekkenOpenen")}
            </Button>
          )}
        </div>
      </Screen>
    );
  }

  // ---- round (fill in) ----
  if (phase === "round") {
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Dezelfde tv als in een potje: de letter is hier hetzelfde ding als
              daar, dus hij hoort er hetzelfde uit te zien. */}
          <Tv letter={letter} label={t("letterIs")} />

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
        {/* Ook op de uitslag de tv, want je loopt hier de woorden na die met
            deze letter beginnen. Een regeltje "de letter was B" deed hetzelfde
            werk, maar dan als voetnoot. */}
        <Tv letter={letter} label={t("trainLetterWas")} />

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

        <Button variant="gold" full disabled={busy} onClick={() => void startRound()}>
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
