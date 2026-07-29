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
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CloseIcon } from "../components/CloseIcon";
import { ArrowLeft, Check, Clock as ClockIcon, Hourglass, RotateCcw, Search, Swords } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { NeonText } from "../components/NeonText";
import { Button } from "../components/Button";
import { GoldButton } from "../components/GoldButton";
import { Arena, ArenaPlate, ARENA } from "../components/Arena";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { ArtIcoon } from "../components/ArtIcoon";
import { GlasVeld } from "../components/GlasVeld";
import { Paneel } from "../components/ProfileHero";
import { GlasRij } from "./Hub";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { rampFrom } from "../theme/neon";
import { reelFace } from "../theme/reelSkins";
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
    <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
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
    const tint = clockColor(frac);
    return (
      <Screen top={header}>
        <Arena src="/duel-bg.webp" podium={PODIUM_Y} at="46%" width="205%" plate={false} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <RoundDots total={total} idx={idx} />

          {flash ? (
            <TierFlash slot={flash} />
          ) : round ? (
            <>
              <TimeBar frac={frac} tint={tint} />
              <Clock left={left} tint={tint} />
              <LetterStage letter={round.letter} category={tCat(round.category)} hint={t("duelRarityHint")} />

              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: withAlpha("#000000", 0.3),
                  border: `1.5px solid ${withAlpha(word ? colors.gold : colors.violet, word ? 0.55 : 0.45)}`,
                  boxShadow: `0 0 20px ${withAlpha(word ? colors.gold : colors.violet, 0.2)}`,
                  transition: "border-color .2s ease, box-shadow .2s ease",
                }}
              >
                <span style={{ display: "grid", placeItems: "center", width: 52, flexShrink: 0, borderRight: `1.5px solid ${withAlpha(colors.violet, 0.35)}` }}>
                  <Bolt accent={word ? colors.gold : colors.violet} />
                </span>
                <input
                  ref={input}
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                  maxLength={40}
                  placeholder={t("duelPlaceholder", { cat: tCat(round.category), letter: round.letter })}
                  style={{ ...inputStyle, border: "none", background: "transparent", borderRadius: 0 }}
                />
              </div>

              <GoldButton disabled={busy} onClick={() => void submit()} label={t("duelLock")} />
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
          {/* De uitslag is waar het duel om draait, dus die krijgt de sierlijst
              van het profiel. De art heeft een vaste verhouding: de inhoud
              voegt zich ernaar. */}
          <Paneel>
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, paddingInline: 6 }}>
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
            </div>
          </Paneel>

          {/* De rondes als glasrijen, net als de lijsten elders in de app. */}
          <Card style={{ display: "flex", flexDirection: "column", gap: 3, padding: "13px 7px 14px" }}>
            {duel.detail.map((row) => (
              <GlasRij key={row.idx}>
                <span style={{ width: 30, flexShrink: 0, fontFamily: font.display, fontWeight: 700, fontSize: 20, color: colors.gold, textAlign: "center" }}>{row.letter}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: font.ui, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: colors.faint }}>{tCat(row.category)}</div>
                  <WordLine slot={row.mine} mine />
                  {done && <WordLine slot={row.theirs} mine={false} />}
                </div>
              </GlasRij>
            ))}
          </Card>

          {done && (
            <Button variant="gold" full disabled={busy} onClick={() => void rematch()}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <RotateCcw size={16} /> {t("duelRematch")}
              </span>
            </Button>
          )}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button variant="ghost" onClick={() => { sound.uiTap(); setView("list"); void refresh(); }}>{t("back")}</Button>
          </div>
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
              <Chip icon={<ArtIcoon naam="beker" size={15} />} label={t("duelRecord", { w: rec.wins, d: rec.draws, l: rec.losses })} />
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

// ---- arena-onderdelen -------------------------------------------------------
// Het duel-scherm is de enige plek in de app met een eigen decor: een donkere
// arena met neon-randen, in plaats van de gewone glazen kaarten. Alles hier is
// puur CSS zodat er niets te laden valt; een eigen achtergrondplaat mag er
// later overheen (zie components/Arena.tsx).

/** Mengt twee hex-kleuren. t=0 geeft a, t=1 geeft b.
 *
 *  Geeft bewust weer #RRGGBB terug en geen rgb(): de uitkomst gaat door
 *  `withAlpha`, en die verwacht hex. Een rgb()-string maakte daar stilzwijgend
 *  onzin van, waardoor de hele gradient ongeldig werd en de tijdbalk leeg bleef. */
function mix(a: string, b: string, t: number): string {
  const channels = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  const k = Math.max(0, Math.min(1, t));
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${lerp(r1, r2)}${lerp(g1, g2)}${lerp(b1, b2)}`;
}

/** De klokkleur verloopt met de tijd mee: goud zolang je rustig kan denken, via
 *  oranje naar rood als het menens wordt. Een harde omslag op 5 seconden voelde
 *  als een storing; een verloop leest als spanning die oploopt. */
function clockColor(frac: number): string {
  return frac > 0.5
    ? mix(colors.orange, colors.gold, (frac - 0.5) * 2)
    : mix(colors.red, colors.orange, frac * 2);
}

// Het gloeiende podium zit op 68.8% van de hoogte van de arena-plaat (gemeten:
// dat is de helderste beeldrij), en op 46% van het scherm landt het onder de
// letter. Het decor zelf zit in components/Arena.tsx, gedeeld met het gewone
// potje, zodat beide schermen op hetzelfde toneel spelen.
const PODIUM_Y = 0.688;

/** Voortgang door het duel: gedane rondes als volle stippen, de huidige als een
 *  bredere pil, de rest gedoofd. */
function RoundDots({ total, idx }: { total: number; idx: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < idx;
        const now = i === idx;
        return (
          <span
            key={i}
            style={{
              width: now ? 24 : 9,
              height: 9,
              borderRadius: 999,
              background: done ? colors.gold : now ? colors.goldHi : withAlpha(colors.violet, 0.45),
              boxShadow: now ? `0 0 12px ${withAlpha(colors.gold, 0.75)}` : done ? `0 0 7px ${withAlpha(colors.gold, 0.4)}` : "none",
              transition: "width .25s ease, background .25s ease",
            }}
          />
        );
      })}
    </div>
  );
}

/** De tijdbalk. Verloopt van kleur mee met de resterende tijd en gloeit in die
 *  kleur, zodat je met je ooghoek al ziet hoe laat het is. */
function TimeBar({ frac, tint }: { frac: number; tint: string }) {
  return (
    <div
      style={{
        position: "relative",
        height: 12,
        borderRadius: 999,
        padding: 2,
        background: withAlpha("#000000", 0.45),
        border: `1px solid ${withAlpha(colors.violet, 0.4)}`,
        boxShadow: `inset 0 1px 3px rgba(0,0,0,.6)`,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${frac * 100}%`,
          minWidth: frac > 0 ? 8 : 0,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${withAlpha(tint, 0.75)}, ${tint})`,
          boxShadow: `0 0 14px ${withAlpha(tint, 0.8)}, inset 0 1px 0 ${withAlpha("#FFFFFF", 0.45)}`,
          transition: "width .2s linear, background .4s linear, box-shadow .4s linear",
        }}
      />
    </div>
  );
}

/** De seconden, geflankeerd door dunne lijntjes, met het klokje eronder. */
function Clock({ left, tint }: { left: number; tint: string }) {
  const rule = (dir: string): React.CSSProperties => ({
    width: 62,
    height: 1,
    background: `linear-gradient(${dir}, transparent, ${withAlpha(tint, 0.7)})`,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span aria-hidden style={rule("90deg")} />
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 34, lineHeight: 1, color: colors.ink, textShadow: `0 0 22px ${withAlpha(tint, 0.75)}` }}>
          {Math.ceil(left)}<span style={{ fontSize: 20, color: colors.sub }}>s</span>
        </span>
        <span aria-hidden style={rule("270deg")} />
      </div>
      <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 999, border: `1.5px solid ${withAlpha(tint, 0.6)}`, color: tint, boxShadow: `0 0 12px ${withAlpha(tint, 0.35)}` }}>
        <ClockIcon size={15} strokeWidth={2.2} />
      </span>
    </div>
  );
}

// De kleur van de omlijning: exact dezelfde als de rand van de letterkaart,
// zodat de tab en het vak één doorlopend frame zijn.
const FRAME_LINE = withAlpha(colors.violet, 0.65);

/** De categorie-tab: een zeshoek die met zijn PUNTEN precies op de bovenlijn van
 *  de letterkaart rust, met een doorzichtig binnenvak zodat je de arena erdoor
 *  ziet lopen.
 *
 *  Getekend als SVG-lijn en niet als geknipt blokje: een clip-path kan alleen
 *  een vorm VULLEN, dus met die aanpak was het binnenvak altijd dicht. Een
 *  polygon met `fill: none` geeft wel een echte omlijning. De breedte hangt van
 *  de tekst af en wordt daarom gemeten; de zeshoek wordt daarna exact op die
 *  maat getekend, zodat de punten links en rechts scherp blijven in plaats van
 *  uitgerekt. */
function CategoryTab({ label, onWidth }: { label: string; onWidth?: (w: number) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(150);
  useLayoutEffect(() => {
    if (!box.current) return;
    const next = box.current.offsetWidth;
    setW(next);
    onWidth?.(next);
  }, [label, onWidth]);

  const H = 30;      // hoogte van de tab
  const C = 13;      // hoe ver de punt naar binnen loopt
  const pts = `${C},1.5 ${w - C},1.5 ${w - 1},${H / 2} ${w - C},${H - 1.5} ${C},${H - 1.5} 1,${H / 2}`;
  return (
    <div
      ref={box}
      style={{
        position: "absolute",
        // De punten zitten op halve hoogte, dus het MIDDEN van de tab moet op
        // de bovenlijn van de kaart liggen: die lijn is hier top 0.
        top: 0,
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 2,
        height: H,
        padding: "0 24px",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden>
        {/* dikke, doorzichtige lijn eronder = de gloed, zonder filter */}
        <polygon points={pts} fill="none" stroke={FRAME_LINE} strokeWidth={5} opacity={0.3} />
        <polygon points={pts} fill="none" stroke={FRAME_LINE} strokeWidth={1.5} />
      </svg>
      <span
        style={{
          position: "relative",
          fontFamily: font.ui,
          fontSize: 12.5,
          fontWeight: 800,
          letterSpacing: 2.4,
          textTransform: "uppercase",
          color: "#FFFFFF",
          textShadow: `0 0 8px ${withAlpha(colors.violet, 0.95)}, 0 0 18px ${withAlpha(colors.violet, 0.7)}`,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** De letter op zijn voetstuk: neon-omlijsting, hexagonale categorie-tab die op
 *  de rand rust, opstijgende stralen en een gloeiende schijf onder de letter. */
function LetterStage({ letter, category, hint }: { letter: string; category: string; hint: string }) {
  // De omlijning van de kaart is een SVG-pad met een GAT bovenin, precies zo
  // breed als de tab. Met een gewone `border` liep die lijn dwars door de tab
  // heen; nu houdt hij op waar de tab begint en pakt hij erna weer op, zodat
  // tab en vak als een doorlopende vorm lezen.
  const card = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [tabW, setTabW] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      if (card.current) setBox({ w: card.current.offsetWidth, h: card.current.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [letter, category, hint]);

  const R = 22;
  const gap = tabW + 6;                       // beetje lucht naast de punten
  const { w, h } = box;
  const outline =
    w && h
      ? `M ${w / 2 + gap / 2} 0 H ${w - R} A ${R} ${R} 0 0 1 ${w} ${R} V ${h - R} ` +
        `A ${R} ${R} 0 0 1 ${w - R} ${h} H ${R} A ${R} ${R} 0 0 1 0 ${h - R} ` +
        `V ${R} A ${R} ${R} 0 0 1 ${R} 0 H ${w / 2 - gap / 2}`
      : "";

  return (
    <div style={{ position: "relative", marginTop: 12 }}>
      <CategoryTab label={category} onWidth={setTabW} />

      <div
        ref={card}
        style={{
          position: "relative",
          borderRadius: R,
          padding: "46px 18px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          // Bewust bijna doorzichtig: het podium en de stralen van de arena
          // moeten er dwars doorheen te zien zijn, anders staat de letter op een
          // dichte kaart in plaats van op het toneel.
          background: `linear-gradient(180deg, ${withAlpha(colors.violet, 0.1)}, ${withAlpha(ARENA.base, 0.22)})`,
          boxShadow: `0 0 26px ${withAlpha(colors.violet, 0.35)}, inset 0 0 34px ${withAlpha(colors.violet, 0.12)}`,
        }}
      >
        {/* De plaat hangt aan de KAART, niet aan het scherm: het podium hoort
            onder de letter en dat is een verhouding van de kaart. Aan het scherm
            opgehangen schoof hij zodra het toetsenbord opengaat. Hij is breder
            dan de kaart en steekt er dus buiten, zoals bedoeld. */}
        <ArenaPlate src="/duel-bg.webp" podium={PODIUM_Y} at="58%" width="215%" />
        {!!outline && (
          <svg
            aria-hidden
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", zIndex: 1 }}
          >
            <path d={outline} fill="none" stroke={FRAME_LINE} strokeWidth={1.5} />
          </svg>
        )}
        <div style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center", width: "100%" }}>
          {/* Zelfde behandeling als de letter op de rol: een verloop over het
              glyph met de gloed als vervaagde kopie erachter, in het goud dat de
              letter al had. */}
          <NeonText
            accent={colors.gold}
            blur={26}
            glow={0.7}
            style={{ fontFamily: font.display, fontWeight: 700, fontSize: 86, lineHeight: 1 }}
          >
            {letter}
          </NeonText>
        </div>
        <span style={{ position: "relative", zIndex: 1, marginTop: 46, fontFamily: font.ui, fontSize: 13, color: withAlpha(colors.violet, 0.95), textAlign: "center", filter: "brightness(1.5)" }}>
          {hint}
        </span>
      </div>
    </div>
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
                {done ? <Check size={12} /> : yourTurn ? <Swords size={12} /> : <ClockIcon size={12} />}
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
          <CloseIcon size={26} />
        </button>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.gold, textAlign: "center" }}>{t("duelPickFriend")}</span>
        {friends.length === 0 ? (
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55, textAlign: "center" }}>{t("duelNoFriends")}</p>
        ) : (
          <>
            {friends.length > 5 && (
              <div style={{ position: "relative" }}>
                <Search size={15} color={colors.faint} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 1, pointerEvents: "none" }} />
                <GlasVeld
                  gevuld={!!q}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("searchName")}
                  style={{ fontSize: 14, padding: "9px 11px 9px 32px" }}
                />
              </div>
            )}
            {shown.map((f) => (
              <GlasRij key={f.id} dun>
                <button
                  disabled={busy}
                  onClick={() => onPick(f)}
                  className="pressable"
                  style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <Avatar name={f.name} color={f.color} size={30} userId={f.id} hasAvatar={!!f.has_avatar} avatarVer={f.avatar_ver} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <Swords size={15} color={colors.gold} />
                </button>
              </GlasRij>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** De bliksem in de invoerbalk, in dezelfde taal als de levelster op je profiel.
 *
 *  Een lucide-icoon krijgt een KLEUR mee en kan dus geen verloop dragen. Daarom
 *  knippen we het verloop uit op de vorm van de bolt met een masker, met een
 *  tikje grotere kopie eronder als stroke, en de gloed als vervaagde kopie
 *  erachter. Precies de drie lagen van de ster. */
const BOLT_MASK =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M13 1.4 2.6 14.2h8.2l-1 8.4 10.6-12.8h-8.2z'/></svg>\")";

function Bolt({ accent, size = 22 }: { accent: string; size?: number }) {
  const r = rampFrom(accent);
  const shape: React.CSSProperties = {
    position: "absolute",
    WebkitMaskImage: BOLT_MASK,
    maskImage: BOLT_MASK,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };
  return (
    <span style={{ position: "relative", width: size, height: size, display: "block", transition: "opacity .2s ease" }}>
      {/* Gloed: dezelfde vorm, op DEZELFDE MAAT, in een ruimere doos zodat de
          vervaging niet wordt afgeknipt. Het masker eerst groter maken werkt
          niet: `mask-size: contain` schaalt de vorm mee met zijn doos, en dan
          steken de punten van een veel grotere bliksem naast de echte uit. */}
      <span aria-hidden style={{ position: "absolute", inset: -10, display: "grid", placeItems: "center", filter: "blur(5px)", opacity: 0.55, pointerEvents: "none" }}>
        <span style={{ ...shape, position: "relative", width: size, height: size, background: r[2] }} />
      </span>
      {/* Stroke: fel bovenaan, donker onderaan, want het licht komt van linksboven. */}
      <span aria-hidden style={{ ...shape, inset: 0, background: `linear-gradient(170deg, ${r[3]} 0%, ${r[2]} 42%, ${r[0]} 100%)` }} />
      {/* Het vlak zelf, een tikje kleiner zodat de stroke eronderuit steekt. */}
      <span aria-hidden style={{ ...shape, inset: 1.2, background: reelFace(r) }} />
    </span>
  );
}
