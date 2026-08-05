// Dagronde — one letter per day, the SAME for everyone (that is what makes the
// day board comparable; Oefenen stays random per person). 60 seconds, five
// list categories, list-only scoring, one ranked attempt per account. Guests
// play the identical round unranked and get a profile nudge.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, HelpCircle, Share2, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Tv } from "../components/Tv";
import { Button } from "../components/Button";
import { BredeKnop } from "../components/BredeKnop";
import { KnopPlaat } from "../components/KnopPlaat";
import { DagKaart } from "../components/DagKaart";
import { UitlegRaster } from "../components/UitlegRaster";
import { Screen, Card } from "../components/Layout";
import { Topo } from "./Topo";
import { ArenaDeel } from "./Arena";
import type { GameApi } from "../net/socket";
import { ArtIcoon } from "../components/ArtIcoon";
import { GlasVeld } from "../components/GlasVeld";
import { GOUD, PlekWapen } from "../components/ProfileHero";
import { GlasRij, Lijst } from "./Hub";
import { DagSectie } from "../components/DagSectie";
import { DagKop } from "../components/DagKop";
import { SchermTip } from "../components/SchermTip";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { makeDailyCard, shareOrDownload } from "../util/shareCard";
import { colors, font, withAlpha } from "../theme/tokens";

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
  avatar_ver: number; divisie?: number;
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
  missions_done?: { key: string; reward: number; coins: number }[];
  // When present, the score is withheld: offer one paid retry before the reveal.
  retry_available?: boolean;
  retry_cost?: number;
}

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
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
  const [info, setInfo] = useState<{
    players: number; played: boolean; streak: number; day: string; seconds_left: number;
    topo_played: boolean; topo_players: number; arena_played?: boolean;
    prijs_top?: { kist: string | null; coins: number; cash: number };
  } | null>(null);
  // De Dagronde bestaat uit twee losse onderdelen. Null = de keuze staat open.
  const [part, setPart] = useState<"words" | "topo" | "arena" | null>(null);
  const [letter, setLetter] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(60);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [retryOffer, setRetryOffer] = useState<{ cost: number } | null>(null);
  // Het herkansingsvenster reageert pas als het even heeft gestaan. Anders landt
  // de tik waarmee je inleverde nog op de knop die eronder verschijnt.
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [nextIn, setNextIn] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const deadline = useRef(0);
  const submitted = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;

  const refreshInfo = () =>
    fetch("/api/daily/info", { headers: authHeaders() })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});

  // Hetzelfde decor als de lobby: de arena met de gouden hoekstukken en de
  // horizon die oplicht. Het hoort bij de schermen waar je een potje begint.
  useEffect(() => {
    document.body.classList.add("arena");
    return () => document.body.classList.remove("arena");
  }, []);

  useEffect(() => {
    void refreshInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Anti-cheat: if a paid retry is on offer, the server withheld the score.
      // Ask BEFORE revealing anything, so the choice is made blind.
      if (data.retry_available) {
        setArmed(false);
        setRetryOffer({ cost: data.retry_cost ?? 50 });
        window.setTimeout(() => setArmed(true), 550);
        return;
      }
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

  // Paid daily-round retry (once/day). Shown after submit, before the reveal.
  const doRetry = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/daily/retry", { method: "POST", headers: authHeaders() });
      if (!res.ok) return; // insufficient / already: leave the offer up
      setRetryOffer(null);
      game.send({ type: "account_get" }); // refresh the coin balance
      sound.uiTap();
      await start(); // wiped server-side -> replays the same letter, fresh clock
    } finally {
      setBusy(false);
    }
  };
  const declineRetry = async () => {
    setRetryOffer(null);
    sound.results();
    await viewResult(); // now reveal the (already recorded) score
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
        footer: t("footer"),
      });
      if (blob) await shareOrDownload(blob, "penneer-dagronde.png");
    } finally {
      setSharing(false);
    }
  };

  if (part === "topo") {
    return <Topo game={game} onProfile={onProfile} played={!!info?.topo_played} spelers={info?.topo_players ?? 0} onBack={() => { setPart(null); void refreshInfo(); }} />;
  }
  if (part === "arena") {
    return <ArenaDeel game={game} onBack={() => { setPart(null); void refreshInfo(); }} />;
  }

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button onClick={() => (part && phase === "intro" ? setPart(null) : onBack())} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
        <ArrowLeft size={20} />
      </button>
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("dailyTitle")}
      </span>
    </div>
  );

  const chip = (icon: React.ReactNode, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, color: colors.sub, background: withAlpha("#000000", 0.22), border: `1px solid ${colors.hairline}`, padding: "6px 11px", borderRadius: 999 }}>
      {icon}
      {label}
    </span>
  );

  // ---- keuze tussen de twee onderdelen ----
  if (phase === "intro" && part === null) {
    const wordsPlayed = !!info?.played || (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
        return !account && saved && saved.day === info?.day;
      } catch {
        return false;
      }
    })();
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SchermTip id="dagronde" tekst={t("tipDagronde")} />
          {/* Geen of-of: de twee onderdelen staan los van elkaar, met elk een
              eigen ranglijst, en je mag ze allebei op dezelfde dag doen. */}
          {/* De kop op de sierlijst van het profiel: dit is de voordeur van de
              dagronde, en die mag er als een sectie uitzien in plaats van als
              twee losse regels boven een lijst. */}
          {/* De kop op zijn eigen plaat. Zie components/DagKop.tsx: de ring,
              het prijsvak en de voortgangsbalk zitten in de art, de tekst wordt
              er alleen overheen gezet. */}
          <DagKop
            reeks={info?.streak ?? 0}
            prijs={info?.prijs_top ?? null}
            gedaan={[wordsPlayed, !!info?.topo_played, !!info?.arena_played].filter(Boolean).length}
            totaal={3}
            titel={t("partPickTitle")}
            uitleg={t("partPickHint")}
            reeksLabel={t("dagKopReeks")}
            prijsLabel={t("dagKopPrijs")}
            voortgangLabel={t("dagKopVoortgang")}
            aansporing={t("dagKopAansporing")}
            aansporingVet={t("dagKopAansporingVet")}
          />
          {/* De drie spelsecties op hun eigen plaat. Zie components/DagSectie.tsx:
              de illustratie, de spelerspil en het standvak zitten in de art, de
              tekst wordt er alleen overheen gezet. */}
          <DagSectie
            soort="woorden"
            titel={t("partWords")}
            omschrijving={t("partWordsDesc")}
            spelers={info ? t("dailyPlayers", { n: info.players }) : ""}
            klaar={wordsPlayed}
            klaarLabel={t("partVoltooid")}
            speelLabel={t("partSpeel")}
            onClick={() => { sound.uiTap(); setPart("words"); }}
          />
          <DagSectie
            soort="topo"
            titel={t("partTopo")}
            omschrijving={t("partTopoDesc")}
            spelers={info ? t("topoPlayers", { n: info.topo_players ?? 0 }) : ""}
            klaar={!!info?.topo_played}
            klaarLabel={t("partVoltooid")}
            speelLabel={t("partSpeel")}
            onClick={() => { sound.uiTap(); setPart("topo"); }}
          />
          {/* Het derde deel: elke weekdag een ander spel, ceilingloos scoren en
              zoveel pogingen als je wil binnen de dag. Daarom nooit "voltooid":
              hier ben je nooit klaar. */}
          <DagSectie
            soort="arena"
            titel={t("arenaTitel")}
            omschrijving={t("arenaDagDesc")}
            spelers={t("partOnbeperkt")}
            klaar={false}
            klaarLabel=""
            speelLabel={t("partSpeel")}
            onClick={() => { sound.uiTap(); setPart("arena"); }}
          />
        </div>
      </Screen>
    );
  }

  // ---- intro van het woordendeel ----
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 4 }}>
          {/* De sierlijst uit de mockup, met de tekst er live overheen. */}
          <DagKaart
            titel={t("partWords")}
            tekst={t("dailyIntro")}
            pil={info ? t("dailyPlayers", { n: info.players }) : ""}
          />

          {/* Vier punten, geen vijf: "goede woorden" staat al in de uitleg
              hierboven en vier kolommen laten de tekst ademen. */}
          <UitlegRaster
            kop={t("dagUitlegKop")}
            punten={[
              { titel: t("dagPunt1Kop"), tekst: t("dagPunt1") },
              { titel: t("dagPunt2Kop"), tekst: t("dagPunt2") },
              { titel: t("dagPunt3Kop"), tekst: t("dagPunt3") },
              { titel: t("dagPunt5Kop"), tekst: t("dagPunt5") },
            ]}
          />

          {played ? (
            <>
              <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.sub }}>{t("dailyPlayed")}</p>
              <BredeKnop disabled={busy} onClick={viewResult}>{t("dailyViewResult").toUpperCase()}</BredeKnop>
            </>
          ) : (
            <BredeKnop disabled={busy || !info} onClick={start}>
              {/* De TEKST staat in het midden van de knop; het pijltje hangt
                  ernaast en telt niet mee. Zet je ze samen in het midden, dan
                  staat het opschrift altijd een pijlbreedte naar links. */}
              <span style={{ position: "relative", display: "inline-block" }}>
                {t("dailyStart").toUpperCase()}
                <ChevronRight
                  size={17}
                  strokeWidth={3}
                  style={{ position: "absolute", left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 8 }}
                />
              </span>
            </BredeKnop>
          )}
          {/* Terug is de paarse plaat en geen doorzichtige pil: onder een gouden
              plaat leest een omlijnde pil als een halve knop. */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            {/* Zelfde opschrift als op de gouden knop erboven: dezelfde letter,
                dezelfde maat, dezelfde spatiering. De plaat rekent zijn
                lettergrootte normaal uit zijn breedte, en op 150 breed werd
                "Terug" 23px terwijl de knop erboven 16px draagt. Twee maten in
                twee knoppen onder elkaar lezen als twee lettertypes. */}
            <KnopPlaat
              kleur="paars"
              breed={150}
              onClick={() => setPart(null)}
              label={<span style={{ fontSize: 16, letterSpacing: 0.3 }}>{t("back").toUpperCase()}</span>}
            />
          </div>
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

          {/* Dezelfde tv als in een potje en in Oefenen. */}
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
                    else void submit();
                  }}
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                  placeholder={t("fillPlaceholder", { cat: tCat(cat), letter })}
                  kaderStyle={{ marginTop: 4 }}
                />
              </div>
            ))}
          </div>

          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12, color: colors.faint }}>{t("dailyListOnly")}</p>
          <Button variant="gold" full disabled={busy} onClick={() => void submit()}>{t("dailyDone")}</Button>
        </div>
        {retryOffer && (
          <div style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(6,3,18,.82)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 22 }}>
            <div className="pop-in" style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "26px 22px 20px", borderRadius: 24, background: "linear-gradient(180deg, #2a1c48, #160D30)", border: `1px solid ${withAlpha(colors.gold, 0.5)}`, boxShadow: `0 24px 80px rgba(0,0,0,.65)`, textAlign: "center" }}>
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold }}>{t("dailyRetryTitle")}</span>
              <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("dailyRetryBody")}</p>
              {/* Twee volwaardige knoppen. Eerder was "nee" een klein tekstlinkje
                  onder een grote gouden knop, en dan tikt iemand die net op
                  "Ik ben klaar" drukte er zo overheen: dat kostte per ongeluk
                  coins. Nu kosten beide keuzes evenveel moeite.
                  De knoppen doen bovendien de eerste halve seconde niets, want
                  het venster verschijnt precies onder de duim die net inleverde. */}
              <Button variant="gold" full disabled={busy || !armed} onClick={() => void doRetry()}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{t("dailyRetryYes", { n: retryOffer.cost })}<img src="/coin.webp" alt="" width={17} height={17} /></span>
              </Button>
              <Button variant="primary" full disabled={busy || !armed} onClick={() => void declineRetry()}>
                {t("dailyRetryNo")}
              </Button>
            </div>
          </div>
        )}
      </Screen>
    );
  }

  // ---- result ----
  if (!result) return <Screen top={header}><div /></Screen>;
  const r = result;
  return (
    <Screen top={header}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* EEN sectie en niet twee. Hier stonden de letter op de tv en je score
            in een eigen paneel onder elkaar, en dat zijn twee koppen boven
            hetzelfde verhaal. Op de uitslag gaat het om je score, dus die staat
            op de tv; de letter zie je terug bij elk woord eronder. */}
        <Tv
          tekst={String(r.score)}
          label={t("dailyYourScore")}
          onder={t("dailyScoreOf", { score: r.score, max: MAX_SCORE })}
        />

        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {r.ranked && r.rank > 0 && chip(<ArtIcoon naam="beker" size={15} />, t("dailyRankLine", { rank: r.rank, total: r.total }))}
            {r.streak > 1 && chip(<ArtIcoon naam="vlam" size={15} />, t("dailyStreakLine", { n: r.streak }))}
          </div>
          {account && !r.ranked && (
            <p style={{ margin: "4px 0 0", fontFamily: font.ui, fontSize: 12.5, color: colors.orange, textAlign: "center" }}>{t("dailyUnranked")}</p>
          )}
          {!!r.missions_done?.length && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 4 }}>
              {r.missions_done.map((m) => (
                <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999, color: colors.green, background: withAlpha(colors.green, 0.12), border: `1px solid ${withAlpha(colors.green, 0.45)}` }}>
                  {t("missionDoneChip")}: {t(`mission_${m.key}`)} · +{m.coins}<img src="/coin.webp" alt="" width={13} height={13} style={{ display: "inline-block", verticalAlign: "-2px", marginLeft: 2 }} />
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

        <Card style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 7px 14px" }}>
          <span style={{ paddingInline: 6, marginBottom: 4, fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>{t("dailyBoardTitle")}</span>
          {r.board.length === 0 && <p style={{ margin: 0, paddingInline: 6, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("dailyEmptyBoard")}</p>}
          <Lijst n={r.board.length} gap={5} toon={5}>
            {r.board.map((row, i) => {
              const mine = !!account && row.id === account.id;
              return (
                // Dezelfde rij als op de ranglijst: het wapen hangt aan de
                // bovenlijn op het knikpunt van de schuine hoek, en de eerste
                // plek krijgt de gouden kappen.
                <GlasRij key={row.id} wapen={<PlekWapen plek={i + 1} maat={26} />}>
                  <Avatar name={row.name} color={row.color} size={30} userId={row.id} hasAvatar={!!row.has_avatar} avatarVer={row.avatar_ver} divisie={row.divisie} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13.5, fontWeight: 600, color: mine ? GOUD[3] : colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.name}{mine && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
                  </span>
                  <span style={{ fontFamily: font.ui, fontSize: 11, color: colors.faint, flexShrink: 0 }}>{Math.max(1, Math.round(row.time_ms / 1000))}s</span>
                  <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 16, color: i === 0 ? colors.gold : colors.ink, minWidth: 30, textAlign: "right" }}>{row.score}</span>
                </GlasRij>
              );
            })}
          </Lijst>
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

/** Een van de twee onderdelen van de Dagronde. Bewust een grote aanraakbare
 *  tegel en geen lijstregel: dit is de eerste keuze van het scherm. */
