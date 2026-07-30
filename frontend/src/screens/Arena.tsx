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
import { GOUD, KADER_LIJN_LOOP, NeonKader, Paneel, PlekWapen } from "../components/ProfileHero";
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

// De vier pads. De art heeft twee standen (dof en aan) die exact op elkaar
// liggen, dus wisselen is een kwestie van de bovenste laag laten opkomen; de
// vorm blijft staan. De kleur staat hier los bij, want de gloed en de kern
// worden in code getekend zodat ze kunnen PULSEREN zonder in de art te zitten.
const PADS = [
  { kleur: colors.gold, art: "goud" },
  { kleur: colors.violet, art: "violet" },
  { kleur: colors.green, art: "groen" },
  { kleur: colors.red, art: "rood" },
] as const;

function Pad({ kleur, art, aan, onTik, uit }: { kleur: string; art: string; aan: boolean; onTik: () => void; uit: boolean }) {
  return (
    <button
      onClick={onTik}
      disabled={uit}
      className="pressable"
      style={{
        position: "relative",
        aspectRatio: "1",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: uit ? "default" : "pointer",
        // De halo mag buiten de knop uitkomen; overflow visible is daarvoor nodig.
        overflow: "visible",
        // De opgelichte pad komt BOVEN zijn buren te liggen, anders wordt zijn
        // halo overschilderd door de pads die later in de rij staan.
        zIndex: aan ? 2 : 1,
      }}
    >
      {/* De HALO achter de pad, als eigen vervaagde laag en niet als
          drop-shadow-filter: die rastert op iOS de doos van de laag mee en dan
          zie je een rechthoek om je flits. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: "-16%",
          borderRadius: "30%",
          // Zelfde MAAT als eerst, alleen feller. De truc zit in WAAR de kracht
          // staat: de dekkende pad bedekt dit verloop tot ongeveer 54%, dus
          // alles voor dat punt zie je niet. Vandaar vol kracht tot 46% en pas
          // daarna de afval, in plaats van een verloop dat al binnen de pad is
          // uitgedoofd. Hij straalt dus harder zonder verder te reiken.
          background: `radial-gradient(circle, ${kleur} 0%, ${kleur} 46%, ${withAlpha(kleur, 0.82)} 57%, ${withAlpha(kleur, 0.42)} 65%, ${withAlpha(kleur, 0.14)} 71%, transparent 76%)`,
          filter: "blur(12px)",
          opacity: aan ? 1 : 0,
          // Snel AAN, langzamer uit: zo tikt de flits en dooft hij na.
          transition: aan ? "opacity .05s linear" : "opacity .22s ease-out",
          pointerEvents: "none",
        }}
      />
      {/* De dove pad staat er altijd; de opgelichte komt eroverheen. Twee lagen
          in plaats van een bronwissel, want een src-wissel geeft een frame wit. */}
      <img src={`/ui/flits/${art}-dof.webp?v=1`} alt="" aria-hidden style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      <img
        src={`/ui/flits/${art}.webp?v=1`}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: aan ? 1 : 0,
          transition: aan ? "opacity .05s linear" : "opacity .2s ease-out",
          pointerEvents: "none",
        }}
      />
      {/* De KERN: een witte kern met vier lichtarmen die opkomt in het midden,
          zoals op de eerste art. Alleen gemonteerd terwijl de pad aan staat, dus
          elke flits start de animatie opnieuw. */}
      {aan && (
        <>
          <span
            aria-hidden
            className="flits-kern"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "52%",
              height: "52%",
              marginLeft: "-26%",
              marginTop: "-26%",
              borderRadius: "50%",
              background: `radial-gradient(circle, #fff 0%, ${withAlpha(kleur, 0.9)} 26%, ${withAlpha(kleur, 0.35)} 52%, transparent 72%)`,
              pointerEvents: "none",
            }}
          />
          {/* De vier armen: twee balken die naar hun uiteinden uitdoven. Samen
              lezen ze als een ster zonder dat er art voor nodig is. */}
          <span aria-hidden className="flits-ster" style={{ position: "absolute", left: "6%", right: "6%", top: "50%", height: 3, marginTop: -1.5, borderRadius: 999, background: `linear-gradient(90deg, transparent, #fff 50%, transparent)`, pointerEvents: "none" }} />
          <span aria-hidden className="flits-ster" style={{ position: "absolute", top: "6%", bottom: "6%", left: "50%", width: 3, marginLeft: -1.5, borderRadius: 999, background: `linear-gradient(180deg, transparent, #fff 50%, transparent)`, pointerEvents: "none" }} />
        </>
      )}
    </button>
  );
}

function Flitsreeks({ seed, onKlaar }: { seed: string; onKlaar: (score: number, level: number, timeMs: number) => void }) {
  const { t } = useT();
  // De hele dagreeks ligt vast zodra de seed er is; levels zijn er een prefix
  // van. Elke ronde is dus DEZELFDE reeks, één element langer: zo bouw je een
  // pad op in je hoofd in plaats van elke ronde iets nieuws te moeten leren.
  const reeks = useRef<number[]>([]);
  if (reeks.current.length === 0) {
    const rng = maakRng(seed);
    let vorige = -1;
    for (let i = 0; i < 64; i++) {
      let p = Math.floor(rng() * 4);
      if (p === vorige) p = (p + 1 + Math.floor(rng() * 3)) % 4;
      reeks.current.push(p);
      vorige = p;
    }
  }

  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [fase, setFase] = useState<"kijk" | "doe" | "goed">("kijk");
  // TWEE lampjes, bewust gescheiden: `lit` is de reeks die voorspeelt, `tik` is
  // je eigen aanraking. In de eerste versie deelden ze één toestand, en dan
  // doofde de na-oplichting van je laatste tik de EERSTE flits van de nieuwe
  // ronde. Dat is precies wat er in de opname te zien was.
  const [lit, setLit] = useState<number | null>(null);
  const [tik, setTik] = useState<number | null>(null);
  const [stap, setStap] = useState(0);
  const stapRef = useRef(0);
  const start = useRef(0);
  const invoerStart = useRef(0);
  const timers = useRef<number[]>([]);

  const stopTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  // ELKE timer loopt hierlangs, ook de korte na-oplichting van een tik. Eén
  // losse timer die aan deze lijst ontsnapt overleeft de rondewissel en gaat
  // daar iets doven wat net was aangegaan.
  const na = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const speel = useCallback((lvl: number) => {
    stopTimers();
    setLit(null);
    setTik(null);
    setStap(0);
    stapRef.current = 0;
    setFase("kijk");
    // Leesbaar blijven is belangrijker dan snel worden: de moeilijkheid zit in
    // de LENGTE van de reeks, niet in onzichtbaar korte flitsen. Daarom een
    // bodem van 300ms aan en 180ms stilte.
    const AAN = Math.max(300, 420 - lvl * 8);
    const UIT = Math.max(180, 240 - lvl * 4);
    let i = 0;
    // Zelf-plannend: de volgende stap wordt pas gezet NADAT de vorige echt
    // gelopen heeft. De eerste versie plande de hele reeks vooruit met vaste
    // deadlines, en dan eet een haperende telefoon de eerste flitsen op omdat
    // hun aan-timer te laat komt terwijl de uit-timer op tijd is.
    const stapje = () => {
      if (i >= lvl) {
        na(120, () => {
          setFase("doe");
          invoerStart.current = performance.now();
        });
        return;
      }
      const pad = reeks.current[i];
      i += 1;
      setLit(pad);
      sound.uiTap();
      na(AAN, () => {
        setLit(null);
        na(UIT, stapje);
      });
    };
    // Aanloop voordat de eerste flits komt. Zonder die stilte valt hij samen
    // met de rondewissel en zie je hem niet.
    na(380, stapje);
  }, []);

  useEffect(() => {
    start.current = performance.now();
    speel(1);
    return stopTimers;
  }, [speel]);

  const tikPad = (pad: number) => {
    if (fase !== "doe") return;
    if (pad !== reeks.current[stapRef.current]) {
      stopTimers();
      // Het level dat je HAALDE is er een minder dan waar je in zat.
      onKlaar(score, level - 1, Math.round(performance.now() - start.current));
      return;
    }
    sound.uiTap();
    setTik(pad);
    na(160, () => setTik(null));
    const volgendeStap = stapRef.current + 1;
    stapRef.current = volgendeStap;
    setStap(volgendeStap);
    if (volgendeStap < level) return;

    // Reeks compleet: punten, en dan een korte bevestiging voordat de volgende
    // reeks begint. Die pauze is niet cosmetisch: hij houdt jouw tik en de
    // eerste nieuwe flits uit elkaar.
    const invoerMs = performance.now() - invoerStart.current;
    const bonus = Math.max(0, Math.min(99, Math.round(99 * (1 - invoerMs / (level * 1000)))));
    setScore((s) => s + level * 100 + bonus);
    const volgend = level + 1;
    setLevel(volgend);
    setFase("goed");
    na(520, () => speel(volgend));
  };

  const aanNu = lit ?? tik;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: font.ui, fontSize: 12, color: colors.sub }}>{t("arenaRonde", { n: level })}</span>
        <NeonText accent={colors.gold} blur={14} glow={0.7} style={{ fontFamily: font.display, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>
          {String(score)}
        </NeonText>
      </div>
      <span style={{ fontFamily: font.ui, fontSize: 12.5, fontWeight: 600, minHeight: 18, color: fase === "goed" ? colors.green : fase === "kijk" ? colors.gold : colors.sub }}>
        {fase === "goed" ? t("arenaGoed") : fase === "kijk" ? t("arenaKijk") : t("arenaDoe")}
      </span>
      {/* Een neon-lijst om het speelvak: dat maakt van vier losse knoppen EEN
          bord, en het geeft de flitsen een rand om tegen af te zetten. De
          vulling blijft leeg, want de achtergrond van het scherm hoort door te
          lopen; overflow zichtbaar, anders knipt de lijst de halo's af. */}
      <NeonKader
        radius={22}
        dik={0.5}
        vulling="geen"
        lijn={KADER_LIJN_LOOP}
        animeer
        eindkap
        sterkte={0.55}
        style={{ width: "min(320px, 86vw)" }}
        binnen={{ padding: 14, overflow: "visible" }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {PADS.map((p, i) => (
            <Pad key={p.art} kleur={p.kleur} art={p.art} aan={aanNu === i} uit={fase !== "doe"} onTik={() => tikPad(i)} />
          ))}
        </div>
      </NeonKader>
      {/* Hoe ver je in de reeks bent. Vanaf een reeks van zes weet je zonder
          deze stipjes niet meer of je bij de vierde of de vijfde zit, en dan
          verlies je op tellen in plaats van op onthouden. */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 8 }}>
        {fase === "doe" && Array.from({ length: level }, (_, i) => (
          <span
            key={i}
            style={{
              width: i < stap ? 8 : 6,
              height: i < stap ? 8 : 6,
              borderRadius: "50%",
              background: i < stap ? colors.gold : "rgba(255,255,255,.22)",
              transition: "width .15s ease, height .15s ease, background .15s ease",
            }}
          />
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
