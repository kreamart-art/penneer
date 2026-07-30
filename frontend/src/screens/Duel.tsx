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
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock as ClockIcon, Hourglass, RotateCcw, Search, Swords } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { NeonText } from "../components/NeonText";
import { Button } from "../components/Button";
import { GoldButton } from "../components/GoldButton";
import { Arena, ArenaPlate, ARENA } from "../components/Arena";
import { Screen, Card } from "../components/Layout";
import type { GameApi } from "../net/socket";
import { ArtIcoon } from "../components/ArtIcoon";
import { GlasVeld } from "../components/GlasVeld";
import { GOUD, KADER_LIJN_GOUD, KADER_LIJN_PAARS, KADER_LIJN_ROOD, NeonKader, Paneel, PlekWapen, RingFoto, RingPortret, SCHILD_KLEUREN, type SchildKleur } from "../components/ProfileHero";
import { GlasRij } from "./Hub";
import { SchermTip } from "../components/SchermTip";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { rampFrom } from "../theme/neon";
import { reelFace } from "../theme/reelSkins";
import { colors, font, radius, withAlpha } from "../theme/tokens";

// `level` is met opzet los van het Account-type: daar is level een OBJECT met
// xp en rang, hier is het het kale getal dat in het schild onder de ring staat.
interface Person { id: string; name: string; color: string; has_avatar: boolean | number; avatar_ver: number; divisie?: number; level?: number }
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
  stake: number;           // inzet per persoon in coins, 0 = vriendschappelijk
  stake_accepted: boolean; // pas dan mag de tegenstander spelen
  stakes: number[];        // de ladder die de server accepteert
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

export function Duel({ game, onBack, onProfile, openId, onGeopend }: {
  game: GameApi;
  onBack: () => void;
  onProfile: () => void;
  /** Een duel dat meteen open moet, omdat een melding erheen wees. */
  openId?: string | null;
  onGeopend?: () => void;
}) {
  const { t, tCat } = useT();
  const account = game.state.account;
  const [view, setView] = useState<"list" | "stake" | "play" | "result">("list");
  const [list, setList] = useState<ListPayload | null>(null);
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [round, setRound] = useState<CurrentRound | null>(null);
  const [word, setWord] = useState("");
  const [flash, setFlash] = useState<Slot | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  // Welke inzet de UITGEDAAGDE nu bekijkt in de carrousel. Begint op de hoogste
  // die hij mag kiezen, want dat is wat de uitdager voorstelde.
  const [aanneemIdx, setAanneemIdx] = useState(0);
  const [herkansOpen, setHerkansOpen] = useState(false);
  const [herkansIdx, setHerkansIdx] = useState(0);

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

  // Hetzelfde decor als de lobby, de dagronde en het oefenen: de arena met de
  // gouden hoekstukken en de horizon die oplicht.
  useEffect(() => {
    document.body.classList.add("arena");
    return () => document.body.classList.remove("arena");
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
      // Er staat een inzet open en IK ben de uitgedaagde: eerst aannemen of
      // verlagen, dan pas spelen. De server weigert serveren toch, maar de
      // popup legt uit WAAROM in plaats van een kale fout.
      if (!fresh.stake_accepted && !fresh.i_challenged) {
        const opties = (fresh.stakes ?? DUEL_STAKES).filter((n) => n <= fresh.stake);
        setAanneemIdx(Math.max(0, opties.length - 1)); // het voorstel zelf
        setView("stake");
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

  // Een melding wees naar EEN duel: zodra de lijst binnen is dat duel openen en
  // de wens meteen wissen, anders springt hij er bij elke verversing weer heen.
  useEffect(() => {
    if (!openId || !list) return;
    const d = list.duels.find((x) => x.id === openId);
    onGeopend?.();
    if (d) void openDuel(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, list]);

  // ---- uitdagen -----------------------------------------------------------

  const challenge = async (friend: Person, stake: number) => {
    sound.uiTap();
    setBusy(true);
    setNote("");
    try {
      const r = await fetch("/api/duel/start", {
        method: "POST", headers: jsonHeaders(), body: JSON.stringify({ opponent: friend.id, stake }),
      });
      const d = await r.json();
      setPickOpen(false);
      if (!r.ok) {
        setNote(
          d.error === "already_open" ? t("duelAlreadyOpen", { name: friend.name })
          : d.error === "coins" ? t("duelStakeTekort")
          : t("duelStartFailed"),
        );
        await refresh();
        return;
      }
      await refresh();
      await openDuel(d);
    } finally {
      setBusy(false);
    }
  };

  // Een herkansing is een NIEUW duel, dus je kiest er opnieuw een inzet bij.
  // Meteen starten zou stilzwijgend zonder inzet spelen, terwijl je net om
  // coins speelde: dan is de herkansing een andere wedstrijd dan de vorige.
  const rematch = () => { sound.uiTap(); setNote(""); setHerkansIdx(0); setHerkansOpen(true); };

  const rematchStart = async (stake: number) => {
    if (!duel) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/duel/${duel.id}/rematch`, {
        method: "POST", headers: jsonHeaders(), body: JSON.stringify({ stake }),
      });
      const d = await r.json();
      setHerkansOpen(false);
      if (!r.ok) {
        setNote(
          d.error === "already_open" ? t("duelAlreadyOpen", { name: duel.opponent.name })
          : d.error === "coins" ? t("duelStakeTekort")
          : t("duelStartFailed"),
        );
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
      {/* Geen zwaardje naast de titel: die zegt het al. */}
      <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("duelTitle")}</span>
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

  // ---- inzet aannemen ------------------------------------------------------
  // De uitgedaagde bepaalt waar ECHT om gespeeld wordt: aannemen mag, verlagen
  // mag (ook naar 0), verhogen niet. Het verschil gaat meteen terug naar de
  // uitdager, en pas hierna gaat de eerste ronde open.
  if (view === "stake" && duel) {
    // Alleen aannemen of VERLAGEN: hoger zou wedden met andermans geld zijn.
    const keuzes = (duel.stakes ?? DUEL_STAKES).filter((n) => n <= duel.stake);
    return (
      <Screen top={header}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <Avatar name={duel.opponent.name} color={duel.opponent.color} size={52} userId={duel.opponent.id} hasAvatar={!!duel.opponent.has_avatar} avatarVer={duel.opponent.avatar_ver} divisie={duel.opponent.divisie} />
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink, textAlign: "center" }}>
            {t("duelStakeVoorstel", { name: duel.opponent.name, n: duel.stake })}
          </span>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5, textAlign: "center" }}>
            {t("duelStakeRecht")}
          </p>
          <InzetCarrousel
            waardes={keuzes}
            index={aanneemIdx}
            onIndex={setAanneemIdx}
            coins={account?.coins ?? 0}
            bezig={busy}
            onKies={async (n) => {
              setBusy(true);
              try {
                const r = await fetch(`/api/duel/${duel.id}/stake`, {
                  method: "POST", headers: jsonHeaders(), body: JSON.stringify({ stake: n }),
                });
                if (r.ok) {
                  const fresh: DuelState = await r.json();
                  setDuel(fresh);
                  setView("play");
                  await serve(fresh.id);
                } else {
                  const e = await r.json();
                  setNote(e.error === "insufficient" ? t("duelStakeTekort") : t("duelStartFailed"));
                  setView("list");
                  await refresh();
                }
              } finally {
                setBusy(false);
              }
            }}
          />
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 11.5, color: colors.faint, textAlign: "center" }}>
            {t("duelStakeSaldo", { n: account?.coins ?? 0 })}
          </p>
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
          {duel.stake > 0 && duel.stake_accepted && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: -8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 11px", borderRadius: 999, background: withAlpha(colors.gold, 0.14), border: `1px solid ${withAlpha(colors.gold, 0.4)}` }}>
                <img src="/coin.webp" alt="" width={13} height={13} style={{ display: "block" }} />
                <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: colors.gold }}>{t("duelPot", { n: duel.stake * 2 })}</span>
              </span>
            </div>
          )}

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
            <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, paddingInline: 6 }}>
            {done ? (
              // De portretten hangen in de BUITENSTE hoeken van het paneel en de
              // uitslag staat in het midden: dat wint de breedte die twee
              // blokken naast elkaar opaten, en het leest als twee kanten die
              // tegenover elkaar staan in plaats van als een rijtje. Ze blijven
              // van de sierlijst af (die loopt schuin door de hoek) met een
              // marge op beide assen.
              <>
                {/* De ECHTE ring uit de UI-map met het schild eronder, dezelfde
                    als op je profiel, en niet de kale rangring om een vierkant
                    portret. Dit is de uitslag van een duel: dan hoort er te
                    staan wat je bent, in de vorm waarin je dat elders ook ziet. */}
                <span
                  aria-hidden
                  style={{ position: "absolute", left: "5%", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                >
                  <RingPortret maat={72} level={account.level.level} kleur={(account.shield as SchildKleur) || "paars"}>
                    <RingFoto userId={account.id} versie={account.avatar_ver} heeftFoto={!!account.has_avatar} naam={account.name} kleur={account.color} />
                  </RingPortret>
                  <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 600, letterSpacing: 0.3, color: colors.sub, maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</span>
                </span>
                <span
                  aria-hidden
                  style={{ position: "absolute", right: "5%", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                >
                  <RingPortret maat={72} level={opp.level ?? 0} kleur={SCHILD_KLEUREN[Math.max(0, Math.min(SCHILD_KLEUREN.length - 1, opp.divisie ?? 0))]}>
                    <RingFoto userId={opp.id} versie={opp.avatar_ver} heeftFoto={!!opp.has_avatar} naam={opp.name} kleur={opp.color} />
                  </RingPortret>
                  <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 600, letterSpacing: 0.3, color: colors.sub, maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.name}</span>
                </span>

                {/* De kop in de smalle hoofdletters van de advertentie, ruim
                    gespatieerd: premium leest als LETTERRUIMTE, niet als groter. */}
                <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 17, letterSpacing: 2.6, textTransform: "uppercase", lineHeight: 1, color: duel.winner === "me" ? colors.gold : duel.winner === "them" ? colors.sub : colors.violet, textShadow: `0 0 22px ${withAlpha(duel.winner === "me" ? colors.gold : colors.violet, 0.45)}` }}>
                  {duel.winner === "me" ? t("duelWon") : duel.winner === "them" ? t("duelLost") : t("duelDraw")}
                </span>
                {/* De stand als EEN regel: 60 - 60. Twee losse blokken met naam
                    en cijfer eronder namen de hele breedte; zo blijft er ruimte
                    voor de portretten in de hoeken. */}
                <span style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
                  <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 40, lineHeight: 1, color: duel.winner === "me" ? colors.gold : colors.ink }}>{duel.my_score}</span>
                  <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, lineHeight: 1, color: colors.faint }}>-</span>
                  <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 40, lineHeight: 1, color: duel.winner === "them" ? colors.gold : colors.ink }}>{duel.their_score ?? 0}</span>
                </span>
                {duel.stake > 0 && duel.stake_accepted && (
                  // ONDERIN het paneel, niet aan de score geplakt: de uitslag
                  // is de kop en de score het middelpunt; wat er met de pot
                  // gebeurde is de voetnoot, en een voetnoot staat onderaan.
                  // Absoluut, zodat hij de gecentreerde score niet omlaag duwt.
                  // Geen pil eromheen: de art achter dit paneel is al rijk
                  // genoeg, en een omlijnd vakje binnen een omlijst paneel leest
                  // als een tweede kader. Alleen de regel, gecentreerd.
                  <span style={{ position: "absolute", left: "50%", bottom: "9%", transform: "translateX(-50%)", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                    <img src="/coin.webp" alt="" width={15} height={15} style={{ display: "block" }} />
                    <span style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 700, color: colors.gold, textShadow: "0 1px 4px rgba(0,0,0,.7)" }}>
                      {duel.winner === "draw"
                        ? t("duelPotTerug", { n: duel.stake })
                        : duel.winner === "me"
                          ? t("duelPotGewonnen", { n: duel.stake * 2 })
                          : t("duelPotVerloren", { n: duel.stake })}
                    </span>
                  </span>
                )}
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
            <Button variant="gold" full disabled={busy} onClick={rematch}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <RotateCcw size={16} /> {t("duelRematch")}
              </span>
            </Button>
          )}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button variant="ghost" onClick={() => { sound.uiTap(); setView("list"); void refresh(); }}>{t("back")}</Button>
          </div>

          {herkansOpen && (
            <InzetPopup
              titel={t("duelStakeKop")}
              uitleg={t("duelStakeUitleg", { name: duel.opponent.name })}
              waardes={DUEL_STAKES}
              index={herkansIdx}
              onIndex={setHerkansIdx}
              coins={account?.coins ?? 0}
              bezig={busy}
              onKies={(n) => void rematchStart(n)}
              onClose={() => setHerkansOpen(false)}
            />
          )}
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
        <SchermTip id="duel" tekst={t("tipDuel")} />
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.55 }}>{t("duelIntro")}</p>
          {!!rec && rec.played > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <Chip icon={<ArtIcoon naam="beker" size={15} />} label={t("duelRecord", { w: rec.wins, d: rec.draws, l: rec.losses })} />
            </div>
          )}
        </Card>

        {/* Niet over de volle breedte: een knop die het halve scherm beslaat
            schreeuwt harder dan de duels eronder, terwijl die de inhoud zijn.
            Hij blijft de enige gouden knop op dit scherm, dus hij valt genoeg
            op zonder de rij op te eten. */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: "68%", maxWidth: 250 }}>
            <Button variant="gold" full disabled={busy} onClick={() => { sound.uiTap(); setNote(""); setPickOpen(true); }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 15 }}>
                <Swords size={15} /> {t("duelNew")}
              </span>
            </Button>
          </div>
        </div>
        {!!note && <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13, color: colors.orange }}>{note}</p>}

        {mine.length > 0 && <Section title={t("duelYourTurn")} items={mine} onOpen={openDuel} t={t} mij={{ ...account, level: account.level.level }} />}
        {waiting.length > 0 && <Section title={t("duelWaitingTitle")} items={waiting} onOpen={openDuel} t={t} mij={{ ...account, level: account.level.level }} />}
        {past.length > 0 && <Section title={t("duelPastTitle")} items={past} onOpen={openDuel} t={t} mij={{ ...account, level: account.level.level }} />}
        {duels.length === 0 && list && (
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.faint }}>{t("duelEmpty")}</p>
        )}
      </div>

      {pickOpen && (
        <FriendPicker
          friends={(list?.friends ?? []).filter((f) => f.status === "accepted")}
          onPick={(f, stake) => void challenge(f, stake)}
          onClose={() => setPickOpen(false)}
          busy={busy}
          coins={game.state.account?.coins ?? 0}
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

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, color: colors.sub, background: withAlpha("#000000", 0.22), border: `1px solid ${colors.hairline}`, padding: "6px 11px", borderRadius: 999 }}>
      {icon}{label}
    </span>
  );
}

/** Een duel in de lijst, opgebouwd als een rij bij "laatste potjes": de lijn
 *  met de afgeschuinde hoek, een wapen dat aan de bovenlijn hangt, jouw portret
 *  links, de VS in het midden, de tegenstander rechts, en achter een groef wat
 *  het potje was.
 *
 *  Wat anders is: de KLEUR van de lijn zegt hoe het afliep. Violet zolang het
 *  loopt, goud als je won, rood als je verloor. Bij de laatste potjes hoefde
 *  dat niet, want daar staat een plaatsnummer op het wapen; hier is er maar één
 *  tegenstander en dus maar één uitkomst. */
function DuelRij({ d, i, eerste, onOpen, t, mij }: {
  d: DuelState;
  i: number;
  eerste: boolean;
  onOpen: (d: DuelState) => void;
  t: (k: string, v?: Record<string, string | number>) => string;
  mij: Person;
}) {
  const klaar = d.status !== "open";
  const mijnBeurt = !klaar && d.my_done < d.rounds;
  const gewonnen = klaar && d.winner === "me";
  const verloren = klaar && d.winner === "them";

  const groef = (
    <span
      aria-hidden
      style={{
        alignSelf: "stretch",
        flexShrink: 0,
        width: 2,
        marginBlock: 3,
        backgroundImage: "linear-gradient(90deg, rgba(8,3,20,.7) 0, rgba(8,3,20,.7) 1px, rgba(255,255,255,.13) 1px, rgba(255,255,255,.13) 2px)",
        WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)",
        maskImage: "linear-gradient(180deg, transparent 0%, #000 26%, #000 74%, transparent 100%)",
      }}
    />
  );
  const naam = (n: string) => (
    <span style={{ fontFamily: font.ui, fontWeight: 600, fontSize: 11, color: colors.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
      {n}
    </span>
  );
  const score = (n: number | null, kroon: boolean) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font.display, fontWeight: 800, fontSize: 15, lineHeight: 1.1, color: colors.ink }}>
      {n === null ? "?" : n}
      {kroon && <ArtIcoon naam="kroon" size={14} />}
    </span>
  );

  return (
    <NeonKader
      hoek={11}
      dik={0.3}
      vulling="geen"
      sterkte={klaar ? 0.42 : 0.3}
      eindkap
      lijn={gewonnen ? KADER_LIJN_GOUD : verloren ? KADER_LIJN_ROOD : KADER_LIJN_PAARS}
      gloed={`0 0 11px ${withAlpha(gewonnen ? colors.gold : verloren ? colors.red : colors.violet, klaar ? 0.3 : 0.22)}`}
      adem={((i * 0.618034) % 1) * 4.2}
      veeg={eerste}
      binnen={{ display: "flex", alignItems: "center", gap: 5, minHeight: 46, padding: "5px 17px 5px 45px" }}
    >
      {/* Het wapen hangt aan de bovenlijn en begint op het knikpunt van de
          schuine hoek, net als bij de laatste potjes. Gewonnen is de eerste
          plek, verloren de tweede; zolang het loopt is er nog geen plek en
          staat er dus geen wapen. */}
      {klaar && (
        <span style={{ position: "absolute", left: 11, top: 0, display: "flex" }}>
          <PlekWapen plek={gewonnen ? 1 : verloren ? 2 : 3} maat={28} />
        </span>
      )}
      <button
        onClick={() => onOpen(d)}
        className="pressable"
        style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        {groef}
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar name={mij.name} color={mij.color} size={34} userId={mij.id} hasAvatar={!!mij.has_avatar} avatarVer={mij.avatar_ver} divisie={mij.divisie} />
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            {naam(mij.name)}
            {score(d.my_score, gewonnen)}
          </div>
        </div>
        <span
          style={{
            fontFamily: font.wide,
            fontSize: 17,
            letterSpacing: 1.2,
            color: "#F0E9FF",
            textShadow: "0 0 9px rgba(200,139,255,.55)",
            flexShrink: 0,
          }}
        >
          VS
        </span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
            {naam(d.opponent.name)}
            {/* De score van de ander blijft verborgen tot het duel klaar is:
                dat is de hele spanning van om beurten spelen. */}
            {score(klaar ? d.their_score ?? 0 : null, verloren)}
          </div>
          <Avatar name={d.opponent.name} color={d.opponent.color} size={34} userId={d.opponent.id} hasAvatar={!!d.opponent.has_avatar} avatarVer={d.opponent.avatar_ver} divisie={d.opponent.divisie} />
        </div>
        {groef}
        {/* Waar de laatste potjes hun opbrengst tonen, staat hier de stand van
            het duel: hoe ver je bent, of wat het werd. */}
        <div style={{ flexShrink: 0, marginRight: -6, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 12, lineHeight: 1.15, color: gewonnen ? GOUD[3] : verloren ? colors.redHi : colors.ink }}>
            {klaar
              ? gewonnen ? t("duelWon") : verloren ? t("duelLost") : t("duelDraw")
              : `${d.my_done}/${d.rounds}`}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: font.ui, fontSize: 10, lineHeight: 1.15, color: colors.faint }}>
            {klaar ? <Check size={10} /> : mijnBeurt ? <Swords size={10} /> : <ClockIcon size={10} />}
            {klaar ? t("duelRondes", { n: d.rounds }) : mijnBeurt ? t("duelJouwBeurt") : t("duelHunBeurt")}
          </span>
        </div>
      </button>
    </NeonKader>
  );
}

function Section({ title, items, onOpen, t, mij }: { title: string; items: DuelState[]; onOpen: (d: DuelState) => void; t: (k: string, v?: Record<string, string | number>) => string; mij: Person }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint, marginLeft: 4 }}>{title}</span>
      {items.map((d, i) => (
        <DuelRij key={d.id} d={d} i={i} eerste={i === 0} onOpen={onOpen} t={t} mij={mij} />
      ))}
    </div>
  );
}

// Tegenstander kiezen: alleen vrienden. Blinde matchups (een willekeurige
// tegenstander uit de wachtrij) komen hier later bij.
const DUEL_STAKES = [0, 50, 100, 250, 500, 1000];

/* De inzetkiezer als CARROUSEL: één zaal tegelijk, met een pijl aan elke kant.
 *
 * Zes knopjes naast elkaar maakten van de keuze een rijtje cijfers; nu is elke
 * inzet een plek waar je om speelt, en dat is waar de art voor is. De zalen
 * lopen op in weelde met het bedrag, dus je ZIET waar je aan begint zonder het
 * getal te lezen.
 *
 * Zolang een zaal nog geen art heeft valt de tegel terug op het neon-vlak: het
 * bedrag blijft gewoon kiesbaar, er is alleen nog niets te zien. */
const ZAAL_ART: Record<number, string> = {
  0: "/ui/inzet/z0.webp?v=3", 50: "/ui/inzet/z50.webp?v=3", 100: "/ui/inzet/z100.webp?v=3",
  250: "/ui/inzet/z250.webp?v=3", 500: "/ui/inzet/z500.webp?v=3", 1000: "/ui/inzet/z1000.webp?v=3",
};
/* Het bedrag als GLAZEN letterwerk met een neon-omlijning.
 *
 * De letter is een RUIT waar je doorheen kijkt: de vulling is glas (een koele
 * schuine glans over een half doorzichtige bodem) en de rand is de neonlijn,
 * met de gloed van de zaal erachter. Geen goud dus, en geen afschuining: dat
 * zou er weer massief metaal van maken.
 *
 * De omlijning gaat via `-webkit-text-stroke` op een laag ONDER de vulling.
 * Een stroke op dezelfde laag tekent voor de helft OVER de letter heen en
 * halveert de vulling; eronder blijft alleen het buitenste deel staan en houd
 * je de hele glasvorm.
 *
 * De gloed MOET een vervaagde kopie zijn en geen text-shadow: `background-clip:
 * text` en `text-shadow` gaan niet samen, de schaduw tekent over het geknipte
 * verloop heen. */
function ZaalTekst({ tekst, maat, gloed, spatie = 0 }: { tekst: string; maat: number; gloed: string; spatie?: number }) {
  const basis: React.CSSProperties = {
    fontFamily: '"AngelWish", ' + font.display,
    fontWeight: 400,
    fontSize: maat,
    lineHeight: 1,
    letterSpacing: spatie + maat * 0.03,
    whiteSpace: "nowrap",
  };
  const laag: React.CSSProperties = { ...basis, position: "absolute", left: 0, top: 0, pointerEvents: "none" };
  const knip: React.CSSProperties = { WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
  // Zo dun als een omlijning kan: een halve pixel. Daaronder verdwijnt hij
  // helemaal op een scherm van 1x, en op de telefoon (3x) is dit anderhalve
  // apparaatpixel, dus precies scherp.
  const lijn = 0.5;
  return (
    <span style={{ position: "relative", display: "inline-block", ...basis }}>
      {/* 1. het licht van de zaal, ruim vervaagd, achter alles */}
      <span aria-hidden style={{ ...laag, color: gloed, filter: `blur(${Math.round(maat * 0.3)}px)`, opacity: 0.55 }}>{tekst}</span>
      {/* 2a. de DIEPTE onder de lijn: dezelfde omlijning in bijna zwart, een
             halve pixel naar beneden. Daardoor lijkt de lijn een rand met dikte
             in plaats van een geschilderd streepje. */}
      <span
        aria-hidden
        style={{
          ...laag,
          WebkitTextStrokeWidth: lijn,
          WebkitTextStrokeColor: "rgba(8,3,18,.9)",
          color: "transparent",
          transform: `translateY(${Math.max(0.5, maat * 0.014)}px)`,
        }}
      >
        {tekst}
      </span>
      {/* 2b. de neonlijn zelf, met zijn eigen halo eromheen */}
      <span
        aria-hidden
        style={{
          ...laag,
          WebkitTextStrokeWidth: lijn,
          WebkitTextStrokeColor: gloed,
          color: "transparent",
          filter: `drop-shadow(0 0 ${Math.round(maat * 0.16)}px ${withAlpha(gloed, 0.9)}) drop-shadow(0 0 ${Math.round(maat * 0.42)}px ${withAlpha(gloed, 0.45)})`,
        }}
      >
        {tekst}
      </span>
      {/* 2c. het LICHT op de lijn: dezelfde omlijning in bijna wit, een halve
             pixel naar BOVEN, en met een masker dat halverwege stopt. Zo licht
             alleen de bovenkant van de rand op, waar het licht hem raakt, en
             blijft de onderkant in de schaduw uit 2a. */}
      <span
        aria-hidden
        style={{
          ...laag,
          WebkitTextStrokeWidth: lijn,
          WebkitTextStrokeColor: "rgba(255,246,224,.85)",
          color: "transparent",
          transform: `translateY(-${Math.max(0.5, maat * 0.012)}px)`,
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 30%, transparent 52%)",
          maskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 30%, transparent 52%)",
        }}
      >
        {tekst}
      </span>
      {/* 3. het glas: donker onderin, een schuine glans erover, licht bovenaan.
             Half doorzichtig, zodat de zaal er doorheen schemert. */}
      <span
        style={{
          ...laag,
          position: "relative",
          backgroundImage: [
            "linear-gradient(118deg, transparent 34%, rgba(255,255,255,.5) 45%, rgba(255,255,255,.06) 54%, transparent 62%)",
            "linear-gradient(180deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.2) 40%, rgba(255,255,255,.07) 62%, rgba(8,4,20,.34) 100%)",
          ].join(", "),
          ...knip,
        }}
      >
        {tekst}
      </span>
      {/* 4. de dunne glans op de bovenrand, waar het glas het licht vangt */}
      <span aria-hidden style={{ ...laag, backgroundImage: "linear-gradient(180deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.18) 14%, transparent 26%)", ...knip }}>{tekst}</span>
    </span>
  );
}

/* De gloedkleur per zaal./* De gloedkleur per zaal. GEMETEN aan de art: van elke
 * zaal is de mediaan van de warme, verzadigde pixels genomen (het vuur, het
 * goud, de schat) en die tint is opgetrokken tot vol licht. Zo hoort het cijfer
 * bij de kamer waar het in staat in plaats van er als sticker op te liggen, en
 * loopt de reeks vanzelf van vurig oranje naar warm goud naarmate de zaal
 * rijker wordt. */
const ZAAL_KLEUR: Record<number, string> = {
  0: "#FFA46B", 50: "#FF9C68", 100: "#FF9961", 250: "#FF9A63", 500: "#FFBB90", 1000: "#FFC783",
};

/* De inzet-popup: dezelfde schil voor uitdagen en voor een herkansing. Twee
 * eigen vensters voor dezelfde vraag lopen na twee wijzigingen uit elkaar. */
/* Het decor van de inzet-popups: de duel-arena als achtergrond met een donkere
 * sluier erover (de popup heeft een EIGEN dichte bodem nodig, anders lees je de
 * lijst door de pagina heen), en de neon-lijn met de rondlopende animatie als
 * rand, dezelfde als om de secties op het profiel. */
const INZET_BINNEN: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "22px 18px 18px",
  backgroundColor: "#160D30",
  backgroundImage: [
    "linear-gradient(180deg, rgba(16,9,34,.88) 0%, rgba(16,9,34,.72) 40%, rgba(12,6,26,.9) 100%)",
    "url(/duel-bg.webp)",
  ].join(", "),
  backgroundSize: "auto, cover",
  backgroundPosition: "center, center 30%",
};

function InzetPopup({
  titel, uitleg, waardes, index, onIndex, coins, bezig, onKies, onClose,
}: {
  titel: string; uitleg: string; waardes: number[]; index: number;
  onIndex: (i: number) => void; coins: number; bezig?: boolean;
  onKies: (n: number) => void; onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(6,3,18,.8)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 22 }}
    >
      <NeonKader
        radius={24}
        dik={0.5}
        vulling="geen"
        animeer
        eindkap
        sterkte={0.6}
        style={{ width: "100%", maxWidth: 340, boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}
        binnen={INZET_BINNEN}
      >
       <div className="pop-in" onClick={(e) => e.stopPropagation()} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={onClose} aria-label={t("back")} style={{ position: "absolute", top: -10, right: -6, zIndex: 2, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
          <CloseIcon size={26} />
        </button>
        {/* De kop krijgt de behandeling van een kop: smalle hoofdletters, ruim
            gespatieerd, met echt licht erachter in plaats van een schaduw. Een
            vette letter met text-shadow wordt alleen wolliger. */}
        <NeonText
          accent={colors.gold}
          blur={20}
          glow={0.8}
          style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 15, letterSpacing: 2.2, lineHeight: 1.2, textTransform: "uppercase", textAlign: "center" }}
        >
          {titel}
        </NeonText>
        {/* Een dunne sierlijn eronder: hij scheidt de kop van de uitleg zonder
            een streep te trekken, en dooft naar de randen uit. */}
        <span
          aria-hidden
          style={{
            height: 1, width: "62%", alignSelf: "center", marginTop: -2,
            background: `linear-gradient(90deg, transparent, ${withAlpha(colors.gold, 0.75)}, transparent)`,
          }}
        />
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5, textAlign: "center" }}>{uitleg}</p>
        <InzetCarrousel waardes={waardes} index={index} onIndex={onIndex} coins={coins} bezig={bezig} onKies={onKies} />
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 11.5, color: colors.faint, textAlign: "center" }}>
          {t("duelStakeSaldo", { n: coins })}
        </p>
       </div>
      </NeonKader>
    </div>
  );
}

function InzetCarrousel({
  waardes, index, onIndex, coins, onKies, bezig,
}: {
  waardes: number[];
  index: number;
  onIndex: (i: number) => void;
  coins: number;
  /** De ZAAL is de knop: erop tikken kiest deze inzet. Een aparte knop eronder
   *  is een tweede plek voor dezelfde daad, en dan weet je niet welke telt. */
  onKies: (n: number) => void;
  bezig?: boolean;
}) {
  const { t } = useT();
  const n = waardes[index] ?? 0;
  const art = ZAAL_ART[n];
  const kan = n <= coins;
  // Welke kant de nieuwe zaal vandaan komt. Bewaard in een ref en niet in de
  // staat: hij stuurt alleen de klasse van de volgende weergave, en een extra
  // hertekening ervoor zou de animatie juist opnieuw starten.
  const richting = useRef<"links" | "rechts">("rechts");
  const ga = (stap: number) => {
    sound.uiTap();
    richting.current = stap > 0 ? "rechts" : "links";
    onIndex((index + stap + waardes.length) % waardes.length);
  };
  // Kale pijlen: de cirkel eromheen was een knop-vorm om iets wat al een knop
  // is, en twee omlijningen naast de zaal maken de rij rommelig. Ze houden wel
  // dezelfde RAAKVLAK-maat, zodat je ze even makkelijk raakt.
  const pijl: React.CSSProperties = {
    flexShrink: 0, width: 34, height: 34, display: "grid", placeItems: "center",
    background: "transparent", border: "none", padding: 0,
    color: colors.gold, cursor: "pointer",
    filter: `drop-shadow(0 0 8px ${withAlpha(colors.gold, 0.45)})`,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
      <button onClick={() => ga(-1)} aria-label={t("back")} className="pressable" style={pijl}>
        <ChevronLeft size={30} strokeWidth={2.4} />
      </button>

      <button
        onClick={() => { if (kan && !bezig) { sound.uiTap(); onKies(n); } }}
        disabled={!kan || bezig}
        aria-label={n === 0 ? t("duelStakeStartZonder") : t("duelStakeStartMet", { n })}
        className={kan && !bezig ? "pressable" : undefined}
        style={{
          flex: 1, minWidth: 0, position: "relative", borderRadius: 16, overflow: "hidden",
          padding: 0, border: "none", cursor: kan && !bezig ? "pointer" : "default",
          aspectRatio: `${4} / ${3}`,
          // Zonder art een leeg neon-vlak, zodat de tegel dezelfde maat en vorm
          // houdt en er niets verspringt zodra de zaal er wel is.
          background: art ? "transparent" : `linear-gradient(180deg, ${withAlpha(colors.violet, 0.18)}, ${withAlpha("#000000", 0.35)})`,
          boxShadow: art ? "none" : `inset 0 0 0 1.4px ${withAlpha(colors.gold, 0.3)}`,
          opacity: kan ? 1 : 0.45,
        }}
      >
        {art && (
          <img
            key={n}
            src={art}
            alt=""
            className={`zaal-${richting.current}`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        {/* Het bedrag staat in het HART van de zaal: elke zaal heeft daar
            bewust een rustig, leeg vlak, en dat is precies waar je oog heen
            gaat. Onderaan lag het tegen de vloer aan. De donkere voet houdt het
            leesbaar, de gloed in de zaalkleur bindt het aan de kamer. */}
        <span
          key={`b${n}`}
          className={`bedrag-${richting.current}`}
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            // Geen text-shadow meer: ZaalTekst draagt zijn eigen schaduw en
            // gloed in lagen, en een shadow hier zou over het geknipte verloop
            // heen tekenen.
          }}
        >
          {/* Geen muntje ernaast: de zaal zelf zegt al waar het over gaat, en
              het cijfer mag daardoor de ruimte nemen die het verdient. */}
          <ZaalTekst
            tekst={n === 0 ? t("duelStakeTrainen") : String(n)}
            maat={48}
            gloed={ZAAL_KLEUR[n] ?? colors.gold}
            spatie={n === 0 ? 1.6 : 0.6}
          />
        </span>
      </button>

      <button onClick={() => ga(1)} aria-label={t("next")} className="pressable" style={pijl}>
        <ChevronRight size={30} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function FriendPicker({ friends, onPick, onClose, busy, coins }: { friends: Person[]; onPick: (f: Person, stake: number) => void; onClose: () => void; busy: boolean; coins: number }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  // Eerst je vriend, dan de inzet. De inzet is de TWEEDE stap en niet een
  // rijtje naast elke naam, want zes knopjes per rij maakt van de lijst een
  // gokautomaat. 0 is een echte keuze: vriendschappelijk blijft gewoon kunnen.
  const [gekozen, setGekozen] = useState<Person | null>(null);
  const [inzetIdx, setInzetIdx] = useState(0);
  const shown = friends.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(6,3,18,.8)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 22 }}
    >
      <NeonKader
        radius={24}
        dik={0.5}
        vulling="geen"
        animeer
        eindkap
        sterkte={0.6}
        style={{ width: "100%", maxWidth: 340, boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}
        binnen={{ ...INZET_BINNEN, maxHeight: "78vh", overflowY: "auto" }}
      >
       <div className="pop-in" onClick={(e) => e.stopPropagation()} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={onClose} aria-label={t("back")} style={{ position: "absolute", top: -10, right: -6, zIndex: 2, background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 4 }}>
          <CloseIcon size={26} />
        </button>
        <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 18, color: colors.gold, textAlign: "center" }}>
          {gekozen ? t("duelStakeKop") : t("duelPickFriend")}
        </span>
        {gekozen ? (
          <>
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.sub, lineHeight: 1.5, textAlign: "center" }}>
              {t("duelStakeUitleg", { name: gekozen.name })}
            </p>
            <InzetCarrousel
              waardes={DUEL_STAKES}
              index={inzetIdx}
              onIndex={setInzetIdx}
              coins={coins}
              bezig={busy}
              onKies={(n) => onPick(gekozen, n)}
            />
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 11.5, color: colors.faint, textAlign: "center" }}>
              {t("duelStakeSaldo", { n: coins })}
            </p>
          </>
        ) : friends.length === 0 ? (
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
                  onClick={() => { sound.uiTap(); setGekozen(f); }}
                  className="pressable"
                  style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, padding: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <Avatar name={f.name} color={f.color} size={30} userId={f.id} hasAvatar={!!f.has_avatar} avatarVer={f.avatar_ver} divisie={f.divisie} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <Swords size={15} color={colors.gold} />
                </button>
              </GlasRij>
            ))}
          </>
        )}
       </div>
      </NeonKader>
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
