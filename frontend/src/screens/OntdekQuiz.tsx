// Ontdekken — de kennisquiz.
//
// Vijf vragen uit de feiten op je kaarten. Twee standen: een letterronde (de
// dagletter of een letter die je zelf koos) en een herhaalronde, die de kaarten
// pakt waarvan de Leitner-termijn verstreken is.
//
// De server houdt bij welk antwoord goed is en geeft dat pas na je keuze. Dus
// geen aftelklok die de client bewaakt en geen antwoord dat in de payload
// meeluistert: wie de netwerkinspecteur openzet ziet vier opties en verder
// niets.
import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "../components/Button";
import { GoudKader } from "../components/GoudKader";
import { Tv } from "../components/Tv";
import { useT } from "../i18n/i18n";
import { colors, font, withAlpha } from "../theme/tokens";
import { sound } from "../sound/sound";

interface Vraag {
  index: number;
  card_id: number;
  word: string;
  veld: string;
  label: string;
  opties: string[];
}
interface Sessie {
  session_id: string;
  mode: "letter" | "review";
  category: string;
  letter: string | null;
  vragen: Vraag[];
}
interface Uitslag {
  goed: number;
  totaal: number;
  xp: number;
  munten: number;
  streak_days: number | null;
  review_due: number;
}

async function post<T>(pad: string, body: unknown): Promise<T> {
  const token = localStorage.getItem("penneer.accountToken") || "";
  const res = await fetch(pad, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || String(res.status));
  return data as T;
}

export function OntdekQuiz({ category, letter, mode, onKlaar, onBack }: {
  category: string;
  letter?: string | null;
  mode: "letter" | "review";
  /** Aangeroepen na afloop, zodat de hub zijn tellers kan verversen. */
  onKlaar: (uitslag: Uitslag) => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const [sessie, setSessie] = useState<Sessie | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bij, setBij] = useState(0);
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [juist, setJuist] = useState<string | null>(null);
  const [goed, setGoed] = useState(0);
  const [uitslag, setUitslag] = useState<Uitslag | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    let weg = false;
    post<Sessie>("/api/discover/quiz/start", { category, letter, mode })
      .then((s) => { if (!weg) setSessie(s); })
      .catch((e) => { if (!weg) setFout(String(e.message || e)); });
    return () => { weg = true; };
  }, [category, letter, mode]);

  const vraag = sessie?.vragen[bij];

  const kies = useCallback(async (optie: string) => {
    if (!sessie || !vraag || gekozen) return;
    setGekozen(optie);
    setBezig(true);
    try {
      const uit = await post<{ goed: boolean; juist: string }>("/api/discover/quiz/answer", {
        session_id: sessie.session_id, question_index: vraag.index, answer: optie,
      });
      setJuist(uit.juist);
      if (uit.goed) { setGoed((g) => g + 1); sound.uiTap(); }
    } finally {
      setBezig(false);
    }
  }, [sessie, vraag, gekozen]);

  const verder = useCallback(async () => {
    if (!sessie) return;
    if (bij + 1 < sessie.vragen.length) {
      setBij((i) => i + 1);
      setGekozen(null);
      setJuist(null);
      return;
    }
    setBezig(true);
    try {
      const u = await post<Uitslag>("/api/discover/quiz/finish", { session_id: sessie.session_id });
      setUitslag(u);
      onKlaar(u);
    } finally {
      setBezig(false);
    }
  }, [sessie, bij, onKlaar]);

  // Geen eigen kop: de shell van Ontdekken tekent de titel en de terugpijl al,
  // en twee koppen boven elkaar leest als twee schermen over elkaar heen.
  const kop = null;
  const doos: React.CSSProperties = {};

  if (fout) {
    return (
      <div style={doos}>
        {kop}
        <p style={{ fontFamily: font.ui, fontSize: 13.5, lineHeight: 1.45, color: colors.sub, textAlign: "center", padding: "28px 0" }}>
          {t("ontdekkenQuizNiets")}
        </p>
        <Button variant="ghost" full onClick={onBack}>{t("back")}</Button>
      </div>
    );
  }

  if (uitslag) {
    return (
      <div style={doos}>
        {kop}
        {/* De tv met je score erop, zoals op elke andere uitslag in de app. Het
            opschrift en de telling staan op het scherm zelf, dus dit is een
            sectie en niet een kop met een kaart eronder. */}
        <Tv
          tekst={`${uitslag.goed}/${uitslag.totaal}`}
          label={t("ontdekkenQuizKlaar")}
          onder={t("ontdekkenQuizScore", { goed: uitslag.goed, total: uitslag.totaal })}
          style={{ marginBottom: 12 }}
        />
        <GoudKader hoek={13} fade gloed padding={18}>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
              <span>+{uitslag.xp} XP</span>
              <span>+{uitslag.munten} munten</span>
            </div>
            {uitslag.streak_days != null && (
              <div style={{ marginTop: 8, fontFamily: font.ui, fontSize: 13, color: colors.gold }}>
                {t("ontdekkenReeks", { n: uitslag.streak_days })}
              </div>
            )}
          </div>
        </GoudKader>
        <div style={{ marginTop: 14 }}>
          <Button variant="gold" full onClick={onBack}>{t("ontdekkenSluiten")}</Button>
        </div>
      </div>
    );
  }

  if (!sessie || !vraag) {
    return (
      <div style={doos}>
        {kop}
        <p style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub, textAlign: "center", padding: "28px 0" }}>
          {t("ontdekkenLaden")}
        </p>
      </div>
    );
  }

  return (
    <div style={doos}>
      {kop}

      {/* Waar je bent in de ronde. Een balk en geen klok: dit is oefenen, en
          een aftelklok maakt van nadenken een handicap. */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: font.ui, fontSize: 12, color: colors.sub, marginBottom: 6 }}>
          {t("ontdekkenQuizVraag", { n: bij + 1, total: sessie.vragen.length })}
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%", width: `${((bij + (gekozen ? 1 : 0)) / sessie.vragen.length) * 100}%`,
              background: `linear-gradient(90deg, ${colors.violet}, ${colors.gold})`,
              transition: "width .3s ease",
            }}
          />
        </div>
      </div>

      <GoudKader hoek={13} fade gloed padding={16} style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, lineHeight: 1.3, color: colors.ink, textAlign: "center" }}>
          {t("ontdekkenQuizWatIs", { label: vraag.label, word: vraag.word })}
        </div>
      </GoudKader>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {vraag.opties.map((o) => {
          const isGekozen = gekozen === o;
          const isJuist = juist != null && o === juist;
          // Pas na je keuze kleuren: daarvoor weet de client niets, en dat is
          // precies de bedoeling.
          const rand = juist == null
            ? colors.hairline
            : isJuist ? colors.green
            : isGekozen ? colors.red
            : colors.hairline;
          return (
            <button
              key={o}
              onClick={() => kies(o)}
              disabled={!!gekozen || bezig}
              className={gekozen ? undefined : "pressable"}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "12px 14px", borderRadius: 12, textAlign: "left",
                cursor: gekozen ? "default" : "pointer",
                background: juist != null && (isJuist || isGekozen)
                  ? withAlpha(isJuist ? colors.green : colors.red, 0.12)
                  : "rgba(255,255,255,.04)",
                border: `1.5px solid ${rand}`,
                fontFamily: font.ui, fontSize: 14.5, fontWeight: 600, color: colors.ink,
                opacity: juist != null && !isJuist && !isGekozen ? 0.5 : 1,
                transition: "all .15s ease",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{o}</span>
              {juist != null && isJuist && <Check size={17} color={colors.green} />}
              {juist != null && isGekozen && !isJuist && <X size={17} color={colors.red} />}
            </button>
          );
        })}
      </div>

      {juist != null && (
        <>
          <p
            role="status"
            style={{
              margin: "14px 0 0", textAlign: "center", fontFamily: font.display, fontWeight: 700,
              fontSize: 14, color: gekozen === juist ? colors.green : colors.red,
            }}
          >
            {gekozen === juist ? t("ontdekkenQuizGoed") : t("ontdekkenQuizFout", { juist })}
          </p>
          <div style={{ marginTop: 12 }}>
            <Button variant="gold" full disabled={bezig} onClick={verder}>
              {bij + 1 < sessie.vragen.length ? t("ontdekkenQuizVolgende") : t("ontdekkenQuizKlaar")}
            </Button>
          </div>
        </>
      )}

      <div style={{ marginTop: 14, textAlign: "center", fontFamily: font.ui, fontSize: 12, color: colors.faint }}>
        {t("ontdekkenQuizScore", { goed, total: sessie.vragen.length })}
      </div>
    </div>
  );
}
