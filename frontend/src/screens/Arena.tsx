// De Arena: het derde deel van de dagronde, met elke weekdag een eigen spel.
//
// De drie regels van elke arenadag:
//   ceilingloos scoren, 24 uur open met onbeperkte gratis pogingen waarvan de
//   beste telt, en de verdringingspush zodra iemand je van plek 1 stoot (die
//   verstuurt de server bij het inleveren).
//
// Dit scherm is de schil voor alle zeven spellen: intro met het bord, het spel
// zelf, en de uitslag met "nog een poging". Vandaag is alleen de Flitsreeks
// gebouwd; de andere dagen tonen hun naam met "binnenkort", zodat de kalender
// vanaf dag een klopt.
//
// FLITSREEKS: een geseede reeks pads flitst op en jij tikt hem na. Elke ronde
// wordt DEZELFDE reeks een element langer (zo werkt het onthouden: je bouwt
// een pad op, je leert niet elke ronde een nieuw). Score-contract met de
// server: per voltooide reeks van lengte k komt er k*100 bij plus een
// snelheidsbonus van hoogstens 99. De server controleert dat bij het
// inleveren, samen met de minimaal benodigde tijd.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Screen } from "../components/Layout";
import { NeonText } from "../components/NeonText";
import { GOUD, Paneel, PlekWapen } from "../components/ProfileHero";
import { GlasRij, Lijst } from "./Hub";
import type { GameApi } from "../net/socket";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

interface BordRij {
  id: string;
  name: string;
  color: string;
  has_avatar?: boolean | number;
  avatar_ver: number;
  divisie?: number;
  score: number;
  time_ms: number;
}
interface Info {
  day: string;
  game: string;
  af: boolean;
  seconds_left: number;
  players: number;
  board: BordRij[];
  rank: number;
  beste: number;
  pogingen: number;
}

/** Seeded RNG (mulberry32) uit de dag-seed van de server: elke speler krijgt
 *  exact dezelfde reeks, anders is het bord een loterij. */
function maakRng(seedHex: string): () => number {
  let a = parseInt(seedHex.slice(0, 8), 16) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function klok(s: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const u = Math.floor(s / 3600);
  return `${u}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// De vier pads. Kleuren uit het eigen palet, want op een flits moet je in een
// oogopslag zien WELKE pad het was.
const PADS = [colors.gold, colors.violet, colors.green, colors.red];

function Pad({ kleur, aan, onTik, uit }: { kleur: string; aan: boolean; onTik: () => void; uit: boolean }) {
  return (
    <button
      onClick={onTik}
      disabled={uit}
      className="pressable"
      style={{
        aspectRatio: "1",
        borderRadius: 18,
        border: `1.5px solid ${withAlpha(kleur, aan ? 0.95 : 0.4)}`,
        cursor: uit ? "default" : "pointer",
        // Aan = het licht staat AAN in het glas; uit is hetzelfde materiaal in
        // rust. Geen tweede vormtaal, alleen meer licht.
        background: aan
          ? `radial-gradient(circle at 50% 38%, ${withAlpha(kleur, 0.85)} 0%, ${withAlpha(kleur, 0.3)} 62%, rgba(0,0,0,.35) 100%)`
          : `radial-gradient(circle at 50% 38%, ${withAlpha(kleur, 0.2)} 0%, rgba(0,0,0,.3) 70%)`,
        boxShadow: aan ? `0 0 22px ${withAlpha(kleur, 0.55)}, inset 0 0 14px ${withAlpha(kleur, 0.5)}` : "inset 0 2px 8px rgba(0,0,0,.45)",
        transition: "background .12s ease, box-shadow .12s ease, border-color .12s ease",
        padding: 0,
      }}
    />
  );
}

function Flitsreeks({ seed, onKlaar }: { seed: string; onKlaar: (score: number, level: number, timeMs: number) => void }) {
  const { t } = useT();
  // De hele dagreeks ligt vast zodra de seed er is; levels zijn er een prefix van.
  const reeks = useRef<number[]>([]);
  if (reeks.current.length === 0) {
    const rng = maakRng(seed);
    // Nooit twee keer dezelfde pad achter elkaar: dat leest als een haperende
    // flits en test niets extra's.
    let vorige = -1;
    for (let i = 0; i < 64; i++) {
      let p = Math.floor(rng() * 4);
      if (p === vorige) p = (p + 1 + Math.floor(rng() * 3)) % 4;
      reeks.current.push(p);
      vorige = p;
    }
  }

  const [level, setLevel] = useState(1);
  const [fase, setFase] = useState<"kijk" | "doe">("kijk");
  const [lit, setLit] = useState<number | null>(null);
  const [stap, setStap] = useState(0);
  const score = useRef(0);
  const start = useRef(0);
  const invoerStart = useRef(0);
  const timers = useRef<number[]>([]);

  const speelFlits = useCallback((lvl: number) => {
    setFase("kijk");
    setStap(0);
    const duur = Math.max(260, 520 - lvl * 15);
    const gat = 150;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    for (let i = 0; i < lvl; i++) {
      timers.current.push(window.setTimeout(() => { setLit(reeks.current[i]); sound.uiTap(); }, i * (duur + gat)));
      timers.current.push(window.setTimeout(() => setLit(null), i * (duur + gat) + duur));
    }
    timers.current.push(window.setTimeout(() => {
      setFase("doe");
      invoerStart.current = performance.now();
    }, lvl * (duur + gat) + 80));
  }, []);

  useEffect(() => {
    start.current = performance.now();
    speelFlits(1);
    return () => timers.current.forEach((id) => window.clearTimeout(id));
  }, [speelFlits]);

  const tik = (pad: number) => {
    if (fase !== "doe") return;
    if (pad !== reeks.current[stap]) {
      // Fout: de poging is voorbij. Het level dat je HAALDE is level - 1.
      onKlaar(score.current, level - 1, Math.round(performance.now() - start.current));
      return;
    }
    sound.uiTap();
    // Even oplichten als bevestiging van je eigen tik.
    setLit(pad);
    window.setTimeout(() => setLit(null), 130);
    if (stap + 1 < level) {
      setStap(stap + 1);
      return;
    }
    // Reeks compleet: k*100 plus de snelheidsbonus (sneller dan een seconde
    // per element = bonus), en dan dezelfde reeks een element langer.
    const invoerMs = performance.now() - invoerStart.current;
    const bonus = Math.max(0, Math.min(99, Math.round(99 * (1 - invoerMs / (level * 1000)))));
    score.current += level * 100 + bonus;
    const volgend = level + 1;
    setLevel(volgend);
    speelFlits(volgend);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.sub }}>{t("arenaRonde", { n: level })}</span>
        <NeonText accent={colors.gold} blur={14} glow={0.7} style={{ fontFamily: font.display, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>
          {String(score.current)}
        </NeonText>
      </div>
      <span style={{ fontFamily: font.ui, fontSize: 12.5, color: fase === "kijk" ? colors.gold : colors.sub, minHeight: 18 }}>
        {fase === "kijk" ? t("arenaKijk") : t("arenaDoe")}
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "min(300px, 82vw)" }}>
        {PADS.map((kleur, i) => (
          <Pad key={kleur} kleur={kleur} aan={lit === i} uit={fase !== "doe"} onTik={() => tik(i)} />
        ))}
      </div>
    </div>
  );
}

export function ArenaDeel({ game, onBack }: { game: GameApi; onBack: () => void }) {
  const { t } = useT();
  const account = game.state.account;
  const [info, setInfo] = useState<Info | null>(null);
  const [fase, setFase] = useState<"intro" | "spel" | "klaar">("intro");
  const [poging, setPoging] = useState<{ attempt_id: number; seed: string } | null>(null);
  const [uitslag, setUitslag] = useState<{ score: number; level: number; rank: number } | null>(null);
  const [over, setOver] = useState(0);

  const haal = useCallback(() => {
    fetch("/api/arena/info", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setInfo(d); setOver(d.seconds_left); } })
      .catch(() => {});
  }, []);
  useEffect(haal, [haal]);
  useEffect(() => {
    const id = window.setInterval(() => setOver((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const start = () => {
    sound.uiTap();
    fetch("/api/arena/start", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: "{}" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.attempt_id) { setPoging(d); setUitslag(null); setFase("spel"); }
      })
      .catch(() => {});
  };

  const klaar = (score: number, level: number, timeMs: number) => {
    if (!poging) return;
    fetch("/api/arena/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ attempt_id: poging.attempt_id, score, level, time_ms: timeMs }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setUitslag({ score, level, rank: d?.rank ?? 0 });
        if (d) setInfo((oud) => (oud ? { ...oud, board: d.board, rank: d.rank, beste: d.beste, pogingen: d.pogingen, players: d.players } : oud));
        setFase("klaar");
        sound.win();
      })
      .catch(() => { setUitslag({ score, level, rank: 0 }); setFase("klaar"); });
  };

  const spelNaam = info ? t(`arenaSpel_${info.game}`) : "";

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
      <button onClick={() => (fase === "intro" ? onBack() : setFase("intro"))} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
        <ArrowLeft size={20} />
      </button>
      <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>{t("arenaTitel")}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 13, color: colors.gold, fontVariantNumeric: "tabular-nums" }}>{klok(over)}</span>
    </div>
  );

  // Het bord met de dunne glasrijen: zelfde taal als de dagronde-uitslag.
  const bord = info && (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ paddingInline: 6, fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>
        {t("arenaSpelers", { n: info.players })}
      </span>
      {info.board.length === 0 ? (
        <p style={{ margin: 0, paddingInline: 6, fontFamily: font.ui, fontSize: 13, color: colors.faint }}>{t("dailyEmptyBoard")}</p>
      ) : (
        <Lijst n={info.board.length} gap={5} rij={38} toon={5.5}>
          {info.board.map((row, i) => {
            const ik = !!account && row.id === account.id;
            return (
              <GlasRij key={row.id} dun wapen={<PlekWapen plek={i + 1} maat={24} />}>
                <Avatar name={row.name} color={row.color} size={26} userId={row.id} hasAvatar={!!row.has_avatar} avatarVer={row.avatar_ver} divisie={row.divisie} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: ik ? GOUD[3] : colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.name}{ik && <span style={{ color: colors.faint, fontWeight: 500 }}> · {t("you")}</span>}
                </span>
                <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, color: i === 0 ? colors.gold : colors.ink, textAlign: "right" }}>{row.score}</span>
              </GlasRij>
            );
          })}
        </Lijst>
      )}
      {!!info.rank && info.rank > 0 && !info.board.some((r) => r.id === account?.id) && (
        <span style={{ paddingInline: 6, fontFamily: font.ui, fontSize: 12, color: GOUD[3] }}>{t("arenaJouwPlek", { n: info.rank })}</span>
      )}
    </div>
  );

  if (fase === "spel" && poging) {
    return (
      <Screen top={header}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
          <Flitsreeks seed={poging.seed} onKlaar={klaar} />
        </div>
      </Screen>
    );
  }

  return (
    <Screen top={header}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Paneel>
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, paddingInline: 14 }}>
            <img src="/ui/arena.webp?v=1" alt="" aria-hidden style={{ height: 74, width: "auto", display: "block" }} />
            <span style={{ fontFamily: font.wide, fontSize: 14, letterSpacing: 1.6, textTransform: "uppercase", color: colors.ink }}>
              {fase === "klaar" && uitslag ? t("arenaKlaarTitel") : spelNaam || t("arenaTitel")}
            </span>
            {fase === "klaar" && uitslag ? (
              <NeonText accent={colors.gold} blur={16} glow={0.75} style={{ fontFamily: font.display, fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
                {String(uitslag.score)}
              </NeonText>
            ) : (
              <span style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12, color: colors.sub, lineHeight: 1.4 }}>
                {info?.af ? t(`arenaUitleg_${info.game}`) : t("arenaBinnenkort")}
              </span>
            )}
          </div>
        </Paneel>

        {/* Jouw dag in een regel: beste, pogingen, plek. */}
        {!!account && !!info && (info.pogingen > 0 || fase === "klaar") && (
          <span style={{ textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>
            {t("arenaMijnRegel", { beste: info.beste, n: info.pogingen })}
            {info.rank > 0 && <span style={{ color: GOUD[3] }}> · {t("arenaJouwPlek", { n: info.rank })}</span>}
          </span>
        )}

        {!account ? (
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>{t("arenaGast")}</p>
        ) : info?.af ? (
          // Onbeperkt en gratis: elke knoptekst die naar kosten riekt hoort
          // hier niet. De 24 uur zijn de grens, de beste poging telt.
          <Button variant="primary" onClick={start}>{fase === "klaar" ? t("arenaOpnieuw") : t("arenaStart")}</Button>
        ) : null}

        {bord}
      </div>
    </Screen>
  );
}
