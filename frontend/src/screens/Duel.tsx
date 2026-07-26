// Duel — 1 tegen 1, om beurten, gescoord op zeldzaamheid.
//
// Vijf rondes van categorie + gedraaide letter ("een dier met een B"), één
// woord per ronde. Goed telt altijd, maar hoe minder anderen jouw woord gaven,
// hoe meer punten: beer levert weinig op, bever veel. Om beurten spelen
// betekent dat je tegenstander niet online hoeft te zijn; hij speelt dezelfde
// vijf rondes wanneer het uitkomt en dan valt pas de uitslag.
//
// De server is de baas over de klok: elke ronde wordt apart OPGEHAALD en dan
// pas begint zijn 15 seconden, dus de app herladen koopt geen denktijd.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Hourglass, RotateCcw, Search, Swords, Trophy, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, radius, withAlpha } from "../theme/tokens";

interface Person { id: string; name: string; color: string; has_avatar: boolean | number; avatar_ver: number }
interface Slot { word: string; tier: string; points: number }
interface DetailRow { idx: number; letter: string; category: string; mine: Slot | null; theirs: Slot | null }
interface CurrentRound { idx: number; letter: string; category: string; seconds: number; seconds_left: number; served: boolean }
interface DuelState {
  id: string;
  status: "open" | "done" | "expired";
  i_challenged: boolean;
  opponent: Person;
  rounds: number;
  my_done: number;
  their_done: number;
  my_score: number;
  their_score: number | null;
  current: CurrentRound | null;
  detail: DetailRow[];
  winner: "me" | "them" | "draw" | null;
  created_at: number;
  expires_at: number;
}
interface ListPayload {
  duels: DuelState[];
  friends: (Person & { status: string })[];
  pending: number;
  record: { played: number; wins: number; draws: number; losses: number };
  rounds: number;
  round_seconds: number;
}

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};
const jsonHeaders = () => ({ "Content-Type": "application/json", ...authHeaders() });

// Elke trede krijgt zijn eigen kleur, zodat je in één blik ziet of je iets
// zeldzaams te pakken had of het voor de hand liggende woord typte.
const TIER_COLOR: Record<string, string> = {
  uniek: colors.gold,
  zeldzaam: colors.violet,
  gewoon: colors.green,
  populair: colors.sub,
  mis: colors.red,
  te_laat: colors.red,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: font.ui,
  fontSize: 17,
  color: colors.ink,
  background: withAlpha("#000000", 0.25),
  border: `1.5px solid ${colors.panelBorder}`,
  borderRadius: radius.button,
  padding: "14px 15px",
};

export function Duel({ game, onBack, onProfile }: { game: GameApi; onBack: () => void; onProfile: () => void }) {
  const { t, tCat } = useT();
  const account = game.state.account;
  const [view, setView] = useState<"list" | "play" | "result">("list");
  const [list, setList] = useState<ListPayload | null>(null);
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [round, setRound] = useState<CurrentRound | null>(null);
  const [word, setWord] = useState("");
  const [flash, setFlash] = useState<Slot | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [note, setNote] = useState("");
  const deadline = useRef(0);
  const wordRef = useRef("");
  const input = useRef<HTMLInputElement | null>(null);
  wordRef.current = word;

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/duel/list", { headers: authHeaders() });
      if (r.ok) setList(await r.json());
    } catch {
      /* offline: houd wat we hadden */
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // ---- spelen -------------------------------------------------------------

  const serve = useCallback(async (id: string) => {
    const r = await fetch(`/api/duel/${id}/serve`, { method: "POST", headers: authHeaders() });
    if (!r.ok) return null;
    const rnd = await r.json();
    setRound({ ...rnd, served: true });
    setWord("");
    deadline.current = Date.now() + rnd.seconds_left * 1000;
    setLeft(rnd.seconds_left);
    return rnd;
  }, []);

  const openDuel = async (d: DuelState) => {
    sound.uiTap();
    setBusy(true);
    try {
      const r = await fetch(`/api/duel/${d.id}`, { headers: authHeaders() });
      const fresh: DuelState = r.ok ? await r.json() : d;
      setDuel(fresh);
      setFlash(null);
      if (fresh.status !== "open" || !fresh.current) {
        setView("result");
        return;
      }
      setView("play");
      await serve(fresh.id);
    } finally {
      setBusy(false);
    }
  };

  const submit = useCallback(async () => {
    if (!duel || !round || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/duel/${duel.id}/answer`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ idx: round.idx, word: wordRef.current.trim() }),
      });
      if (!r.ok) return;
      const res = await r.json();
      setRound(null);
      setFlash({ word: res.word, tier: res.tier, points: res.points });
      res.points > 0 ? sound.approve() : sound.reject();
      const next: DuelState = res.duel;
      setDuel(next);
      window.setTimeout(() => {
        setFlash(null);
        if (next.status !== "open" || !next.current) {
          if (res.finished) sound.results();
          setView("result");
          void refresh();
        } else {
          void serve(next.id);
        }
      }, 1500);
    } finally {
      setBusy(false);
    }
  }, [duel, round, busy, serve, refresh]);

  // De klok. Op nul gaat in wat er staat; de server houdt nog wat marge aan
  // voor een trage verbinding.
  useEffect(() => {
    if (view !== "play" || !round) return;
    const id = window.setInterval(() => {
      const s = Math.max(0, (deadline.current - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) {
        window.clearInterval(id);
        void submit();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [view, round, submit]);

  useEffect(() => { if (view === "play" && round) input.current?.focus(); }, [view, round]);

  // ---- uitdagen -----------------------------------------------------------

  const challenge = async (friend: Person) => {
    sound.uiTap();
    setBusy(true);
    setNote("");
    try {
      const r = await fetch("/api/duel/start", {
        method: "POST", headers: jsonHeaders(), body: JSON.stringify({ opponent: friend.id }),
      });
      const d = await r.json();
      setPickOpen(false);
      if (!r.ok) {
        setNote(d.error === "already_open" ? t("duelAlreadyOpen", { name: friend.name }) : t("duelStartFailed"));
        await refresh();
        return;
      }
      await refresh();
      await openDuel(d);
    } finally {
      setBusy(false);
    }
  };

  const rematch = async () => {
    if (!duel) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/duel/${duel.id}/rematch`, { method: "POST", headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) {
        setNote(d.error === "already_open" ? t("duelAlreadyOpen", { name: duel.opponent.name }) : t("duelStartFailed"));
        setView("list");
        await refresh();
        return;
      }
      await refresh();
      await openDuel(d);
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button
        onClick={() => { sound.uiTap(); view === "list" ? onBack() : (setView("list"), void refresh()); }}
        aria-label={t("back")}
        style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}
      >
        <ArrowLeft size={20} />
      </button>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>
        <Swords size={18} color={colors.gold} /> {t("duelTitle")}
      </span>
    </div>
  );

  // ---- geen profiel: duels hangen aan accounts -----------------------------
  if (!account) {
    return (
      <Screen top={header}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("duelGuest")}</p>
          <Button variant="primary" full onClick={onProfile}>{t("profile")}</Button>
        </Card>
      </Screen>
    );
  }

  // ---- spelen -------------------------------------------------------------
  if (view === "play" && duel) {
    const total = duel.rounds;
    const idx = round?.idx ?? duel.my_done;
    const frac = round ? Math.max(0, Math.min(1, left / round.seconds)) : 0;
    const urgent = left <= 5;
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* vijf bolletjes: waar je bent in het duel */}
          <div style={{ display: "flex", justifyContent: "center", gap: 7 }}>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                style={{
                  width: i === idx ? 22 : 8, height: 8, borderRadius: 999,
                  background: i < idx ? colors.gold : i === idx ? colors.goldHi : withAlpha("#FFFFFF", 0.16),
                  transition: "width .25s ease",
                }}
              />
            ))}
          </div>

          {flash ? (
            <TierFlash slot={flash} />
          ) : round ? (
            <>
              <div style={{ height: 8, borderRadius: 999, background: withAlpha("#000000", 0.3), overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${frac * 100}%`, borderRadius: 999, background: urgent ? colors.red : colors.gold, transition: "width .2s linear" }} />
              </div>
              <div style={{ textAlign: "center", fontFamily: font.display, fontWeight: 700, fontSize: 20, color: urgent ? colors.redHi : colors.sub }}>
                {Math.ceil(left)}s
              </div>

              <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 18 }}>
                <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint }}>
                  {tCat(round.category)}
                </span>
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 62, lineHeight: 1.1, color: colors.gold, textShadow: `0 0 28px ${withAlpha(colors.gold, 0.5)}` }}>
                  {round.letter}
                </span>
                <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, textAlign: "center" }}>
                  {t("duelRarityHint")}
                </span>
              </Card>

              <input
                ref={input}
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
                autoComplete="off" autoCorrect="off" spellCheck={false}
                maxLength={40}
                placeholder={t("duelPlaceholder", { cat: tCat(round.category), letter: round.letter })}
                style={{ ...inputStyle, border: `1.5px solid ${word ? withAlpha(colors.gold, 0.5) : colors.panelBorder}` }}
              />
              <Button variant="gold" full disabled={busy} onClick={() => void submit()}>{t("duelLock")}</Button>
            </>
          ) : (
            <p style={{ textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.faint }}>…</p>
          )}
        </div>
      </Screen>
    );
  }

  // ---- uitslag / wachten ---------------------------------------------------
  if (view === "result" && duel) {
    const done = duel.status !== "open";
    const opp = duel.opponent;
    return (
      <Screen top={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {done ? (
              <>
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: duel.winner === "me" ? colors.gold : duel.winner === "them" ? colors.sub : colors.violet }}>
                  {duel.winner === "me" ? t("duelWon") : duel.winner === "them" ? t("duelLost") : t("duelDraw")}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <ScoreSide name={account.name} color={account.color} id={account.id} hasAvatar={account.has_avatar} ver={account.avatar_ver} score={duel.my_score} win={duel.winner === "me"} />
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: colors.faint }}>—</span>
                  <ScoreSide name={opp.name} color={opp.color} id={opp.id} hasAvatar={!!opp.has_avatar} ver={opp.avatar_ver} score={duel.their_score ?? 0} win={duel.winner === "them"} />
                </div>
              </>
            ) : (
              <>
                <Hourglass size={26} color={colors.violet} />
                <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink, textAlign: "center" }}>
                  {t("duelWaitingResult", { name: opp.name })}
                </span>
                <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
                  {t("duelYourScoreHidden", { score: duel.my_score })}
                </span>
              </>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {duel.detail.map((row) => (
              <Card key={row.idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px" }}>
                <span style={{ width: 34, flexShrink: 0, fontFamily: font.display, fontWeight: 700, fontSize: 21, color: colors.gold, textAlign: "center" }}>{row.letter}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>{tCat(row.category)}</div>
                  <WordLine slot={row.mine} mine />
                  {done && <WordLine slot={row.theirs} mine={false} />}
                </div>
              </Card>
            ))}
          </div>

          {done && (
            <Button variant="gold" full disabled={busy} onClick={() => void rematch()}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <RotateCcw size={16} /> {t("duelRematch")}
              </span>
            </Button>
          )}
          <Button variant="ghost" full onClick={() => { sound.uiTap(); setView("list"); void refresh(); }}>{t("back")}</Button>
        </div>
      </Screen>
    );
  }

  // ---- lijst ---------------------------------------------------------------
  const duels = list?.duels ?? [];
  const mine = duels.filter((d) => d.status === "open" && (d.current || d.my_done < d.rounds));
  const waiting = duels.filter((d) => d.status === "open" && !mine.includes(d));
  const past = duels.filter((d) => d.status !== "open");
  const rec = list?.record;

  return (
    <Screen top={header}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("duelIntro")}</p>
          {!!rec && rec.played > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <Chip icon={<Trophy size={13} color={colors.gold} />} label={t("duelRecord", { w: rec.wins, d: rec.draws, l: rec.losses })} />
            </div>
          )}
        </Card>

        <Button variant="gold" full disabled={busy} onClick={() => { sound.uiTap(); setNote(""); setPickOpen(true); }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Swords size={17} /> {t("duelNew")}
          </span>
        </Button>
        {!!note && <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13, color: colors.orange }}>{note}</p>}

        {mine.length > 0 && <Section title={t("duelYourTurn")} items={mine} onOpen={openDuel} t={t} />}
        {waiting.length > 0 && <Section title={t("duelWaitingTitle")} items={waiting} onOpen={openDuel} t={t} />}
        {past.length > 0 && <Section title={t("duelPastTitle")} items={past} onOpen={openDuel} t={t} />}
        {duels.length === 0 && list && (
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.faint }}>{t("duelEmpty")}</p>
        )}
      </div>

      {pickOpen && (
        <FriendPicker
          friends={(list?.friends ?? []).filter((f) => f.status === "accepted")}
          onPick={(f) => void challenge(f)}
          onClose={() => setPickOpen(false)}
          busy={busy}
        />
      )}
    </Screen>
  );
}

// Grote trede-kaart direct na je antwoord: dit is het moment waarop je ziet of
// je iets zeldzaams te pakken had.
function TierFlash({ slot }: { slot: Slot }) {
  const { t } = useT();
  const col = TIER_COLOR[slot.tier] ?? colors.sub;
  return (
    <Card className="pop-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 26, border: `1.5px solid ${withAlpha(col, 0.55)}`, background: `linear-gradient(180deg, ${withAlpha(col, 0.16)}, ${withAlpha("#000000", 0.24)})` }}>
      <span style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 600, color: colors.ink }}>{slot.word || t("empty")}</span>
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, color: col, textShadow: `0 0 22px ${withAlpha(col, 0.5)}` }}>
        {t(`tier_${slot.tier}`)}
      </span>
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 34, color: slot.points > 0 ? colors.gold : colors.faint }}>+{slot.points}</span>
    </Card>
  );
}

function WordLine({ slot, mine }: { slot: Slot | null; mine: boolean }) {
  const { t } = useT();
  const col = slot ? TIER_COLOR[slot.tier] ?? colors.sub : colors.faint;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: mine ? colors.gold : colors.violet, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13.5, fontWeight: mine ? 600 : 500, color: slot?.word ? colors.ink : colors.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {slot?.word || t("empty")}
      </span>
      {slot && (
        <span style={{ fontFamily: font.ui, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: col }}>
          {t(`tier_${slot.tier}`)}
        </span>
      )}
      <span style={{ width: 28, textAlign: "right", fontFamily: font.display, fontWeight: 700, fontSize: 14, color: slot && slot.points > 0 ? colors.gold : colors.faint }}>
        +{slot?.points ?? 0}
      </span>
    </div>
  );
}

function ScoreSide({ name, color, id, hasAvatar, ver, score, win }: { name: string; color: string; id: string; hasAvatar: boolean; ver: number; score: number; win: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 78 }}>
      <Avatar name={name} color={color} size={40} userId={id} hasAvatar={hasAvatar} avatarVer={ver} />
      <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.sub, maxWidth: 84, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, color: win ? colors.gold : colors.ink }}>{score}</span>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, color: colors.sub, background: withAlpha("#000000", 0.22), border: `1px solid ${colors.hairline}`, padding: "6px 11px", borderRadius: 999 }}>
      {icon}{label}
    </span>
  );
}

function Section({ title, items, onOpen, t }: { title: string; items: DuelState[]; onOpen: (d: DuelState) => void; t: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginLeft: 4 }}>{title}</span>
      {items.map((d) => {
        const done = d.status !== "open";
        const yourTurn = !done && d.my_done < d.rounds;
        const accent = done ? (d.winner === "me" ? colors.gold : d.winner === "them" ? colors.red : colors.violet) : yourTurn ? colors.gold : colors.violet;
        return (
          <button
            key={d.id}
            onClick={() => onOpen(d)}
            className="pressable"
            style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: radius.card, cursor: "pointer", textAlign: "left", background: withAlpha("#000000", 0.2), border: `1px solid ${withAlpha(accent, 0.4)}` }}
          >
            <Avatar name={d.opponent.name} color={d.opponent.color} size={38} userId={d.opponent.id} hasAvatar={!!d.opponent.has_avatar} avatarVer={d.opponent.avatar_ver} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font.ui, fontSize: 14.5, fontWeight: 700, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.opponent.name}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: font.ui, fontSize: 12, color: accent }}>
                {done ? <Check size={12} /> : yourTurn ? <Swords size={12} /> : <Clock size={12} />}
                {done
                  ? d.winner === "me" ? t("duelWon") : d.winner === "them" ? t("duelLost") : t("duelDraw")
                  : yourTurn
                    ? t("duelRoundOf", { n: d.my_done + 1, total: d.rounds })
                    : t("duelWaiting", { name: d.opponent.name })}
              </div>
            </div>
            {done && (
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: colors.ink, flexShrink: 0 }}>
                {d.my_score}-{d.their_score ?? 0}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Tegenstander kiezen: alleen vrienden. Blinde matchups (een willekeurige
// tegenstander uit de wachtrij) komen hier later bij.
function FriendPicker({ friends, onPick, onClose, busy }: { friends: Person[]; onPick: (f: Person) => void; onClose: () => void; busy: boolean }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const shown = friends.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(6,3,18,.8)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 22 }}
    >
      <div
        className="pop-in"
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 340, maxHeight: "70vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "22px 18px 18px", borderRadius: 24, background: "linear-gradient(180deg, #2a1c48, #160D30)", border: `1px solid ${withAlpha(colors.gold, 0.45)}`, boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}
      >
        <button onClick={onClose} aria-label={t("back")} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
          <X size={19} />
        </button>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.gold, textAlign: "center" }}>{t("duelPickFriend")}</span>
        {friends.length === 0 ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55, textAlign: "center" }}>{t("duelNoFriends")}</p>
        ) : (
          <>
            {friends.length > 5 && (
              <div style={{ position: "relative" }}>
                <Search size={15} color={colors.faint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("searchName")}
                  style={{ ...inputStyle, fontSize: 14, padding: "10px 12px 10px 34px" }}
                />
              </div>
            )}
            {shown.map((f) => (
              <button
                key={f.id}
                disabled={busy}
                onClick={() => onPick(f)}
                className="pressable"
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 14, cursor: "pointer", textAlign: "left", background: withAlpha("#000000", 0.25), border: `1px solid ${colors.hairline}` }}
              >
                <Avatar name={f.name} color={f.color} size={32} userId={f.id} hasAvatar={!!f.has_avatar} avatarVer={f.avatar_ver} />
                <span style={{ flex: 1, fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: colors.ink }}>{f.name}</span>
                <Swords size={15} color={colors.gold} />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
