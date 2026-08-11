// Het admin-dashboard: de cijfers van het spel, geteld op het moment van kijken.
//
// Alles komt uit EEN ws-verzoek (admin_stats) en de server telt live uit de
// bestaande tabellen, dus er is geen aparte administratie die kan achterlopen.
// De vragen die het beantwoordt, in volgorde van belangrijkheid:
//   hoe gaat het NU (vandaag), hoe ging de week, WANNEER komen mensen (het
//   uurprofiel), en WAT spelen ze (de modusverdeling).
//
// De staafjes zijn kale divs. Een grafiekbibliotheek zou hier 100kB meebrengen
// voor vier balkjes die een admin twee keer per week bekijkt.
import { useEffect } from "react";
import { GOUD } from "./ProfileHero";
import type { AdminStats, GameApi } from "../net/socket";
import { colors, font, withAlpha } from "../theme/tokens";

function Cijfer({ label, waarde }: { label: string; waarde: number | string }) {
  return (
    <div style={{ flex: "1 1 30%", minWidth: 88, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontFamily: font.display, fontWeight: 800, fontSize: 20, color: GOUD[3], lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{waarde}</div>
      <div style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Kop({ children }: { children: string }) {
  return (
    <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: colors.sub }}>
      {children}
    </span>
  );
}

/** Staafjes met de hoogste als maat. Elke reeks krijgt zijn eigen schaal: het
 *  uurprofiel gaat over de VORM van de dag, niet over absolute aantallen. */
function Staafjes({ waarden, labels, hoog }: { waarden: number[]; labels: (i: number) => string; hoog?: number }) {
  const max = Math.max(1, ...waarden);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: hoog ?? 46 }}>
      {waarden.map((v, i) => (
        <div key={i} title={`${labels(i)}: ${v}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
          <div
            style={{
              height: `${Math.max(v > 0 ? 6 : 2, (v / max) * 100)}%`,
              borderRadius: 2,
              background: v > 0 ? `linear-gradient(180deg, ${GOUD[3]}, ${GOUD[1]})` : "rgba(255,255,255,.12)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard({ game }: { game: GameApi }) {
  const stats: AdminStats | null = game.state.adminStats;

  // Een keer vragen bij het openen; de Ververs-knop doet dezelfde vraag opnieuw.
  useEffect(() => {
    game.adminStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) {
    return <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, color: colors.faint }}>Dashboard laden...</p>;
  }

  const modi = Object.entries(stats.modi_30d).sort((a, b) => b[1] - a[1]);
  const modiMax = Math.max(1, ...modi.map(([, n]) => n));
  const modiNaam: Record<string, string> = { potjes: "Potjes", dagronde: "Dagronde", topo: "Topografie", duels: "Duels" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, background: withAlpha("#000000", 0.22), border: `1px solid ${colors.panelBorder}`, borderRadius: 14, padding: 13 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Kop>Dashboard</Kop>
        <button
          onClick={() => game.adminStats()}
          className="pressable"
          style={{ background: "transparent", border: `1px solid ${colors.panelBorder}`, borderRadius: 999, padding: "4px 12px", cursor: "pointer", fontFamily: font.ui, fontSize: 11, color: colors.sub }}
        >
          Ververs
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <Cijfer label="spelers vandaag" waarde={stats.spelers_vandaag} />
        <Cijfer label="potjes vandaag" waarde={stats.potjes_vandaag} />
        <Cijfer label="spelers 7 dagen" waarde={stats.spelers_7d} />
        <Cijfer label="potjes 7 dagen" waarde={stats.potjes_7d} />
        <Cijfer label="accounts" waarde={stats.accounts} />
        <Cijfer label="nieuw deze week" waarde={stats.accounts_nieuw_7d} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Kop>Wanneer wordt er gespeeld (14 dagen, NL-tijd)</Kop>
        <Staafjes waarden={stats.per_uur_14d} labels={(i) => `${String(i).padStart(2, "0")}:00`} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: font.ui, fontSize: 9, color: colors.faint }}>
          <span>0u</span><span>6u</span><span>12u</span><span>18u</span><span>23u</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Kop>Spelers per dag (14 dagen)</Kop>
        <Staafjes waarden={stats.per_dag_14d.map((d) => d.spelers)} labels={(i) => stats.per_dag_14d[i].dag} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Kop>Meest gespeeld (30 dagen)</Kop>
        {modi.map(([key, n]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 78, flexShrink: 0, fontFamily: font.ui, fontSize: 11.5, color: colors.ink }}>{modiNaam[key] ?? key}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(0,0,0,.4)", overflow: "hidden" }}>
              <div style={{ width: `${(n / modiMax) * 100}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${GOUD[1]}, ${GOUD[3]})` }} />
            </div>
            <span style={{ width: 40, textAlign: "right", fontFamily: font.ui, fontSize: 11.5, fontWeight: 700, color: GOUD[3], fontVariantNumeric: "tabular-nums" }}>{n}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <Cijfer label="potjes ooit" waarde={stats.potjes_totaal} />
        <Cijfer label="munten in omloop" waarde={stats.economie.coins.toLocaleString("nl-NL")} />
        <Cijfer label="cash in omloop" waarde={stats.economie.cash.toLocaleString("nl-NL")} />
      </div>

      <Rapporten game={game} />
      <Systeem game={game} />
    </div>
  );
}

/** De meterkast: hoe de MACHINE erbij staat, niet het spel.
 *
 *  De bewaaklus op de server meldt zichzelf als er iets mis is, dus dit blok is
 *  voor als je toch wilt kijken: staat de kopie van vannacht er, hoeveel schijf
 *  is er nog, gaan er fouten om, en heeft de rem iets geweigerd. Een rode stip
 *  bij een regel betekent dat de bewaker daar ook op zou aanslaan. */
function Systeem({ game }: { game: GameApi }) {
  const t = game.state.toezicht;
  useEffect(() => { game.adminToezicht(); }, []);

  if (!t) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Kop>Server</Kop>
        <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>Meterkast laden...</span>
      </div>
    );
  }

  const mb = (n: number) => `${Math.round(n / 1_000_000)} MB`;
  const duur = (s: number) => {
    const d = Math.floor(s / 86400), u = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d}d ${u}u` : u ? `${u}u ${m}m` : `${m}m`;
  };
  const vrijDeel = t.schijf.vrij_deel ?? 1;
  const kopieUren = t.kopie.uren_oud;

  const regels: { label: string; waarde: string; slecht: boolean }[] = [
    { label: "versie", waarde: t.versie, slecht: false },
    { label: "draait", waarde: duur(t.op), slecht: false },
    { label: "database", waarde: t.db_leeft ? "leest" : "ANTWOORDT NIET", slecht: !t.db_leeft },
    { label: "schijf vrij", waarde: t.schijf.vrij ? `${mb(t.schijf.vrij)} (${Math.round(vrijDeel * 100)}%)` : "?", slecht: vrijDeel < 0.1 },
    { label: "geheugen", waarde: t.geheugen ? mb(t.geheugen) : "?", slecht: false },
    { label: "database groot", waarde: mb(t.db_maat.db + t.db_maat.wal), slecht: false },
    {
      label: "laatste kopie",
      waarde: t.kopie.aantal === 0 ? "GEEN" : `${kopieUren ?? "?"} uur oud (${t.kopie.aantal} bewaard)`,
      slecht: t.kopie.aantal === 0 || (kopieUren ?? 0) > 30,
    },
    { label: "nu binnen", waarde: `${t.spelers} in ${t.rooms} rooms, ${t.verbindingen} verbindingen`, slecht: false },
    { label: "fouten", waarde: `${t.fouten_kwartier} dit kwartier, ${t.fouten_totaal} sinds de start`, slecht: t.fouten_kwartier >= 25 },
    { label: "rem", waarde: t.rem_aan ? "aan" : "UIT", slecht: !t.rem_aan },
  ];

  const geweigerd = Object.entries(t.geweigerd);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Kop>Server</Kop>
        <button
          onClick={() => game.adminToezicht()}
          className="pressable"
          style={{ background: "transparent", border: `1px solid ${colors.panelBorder}`, borderRadius: 999, padding: "3px 10px", cursor: "pointer", fontFamily: font.ui, fontSize: 10.5, color: colors.sub }}
        >
          Ververs
        </button>
      </div>

      <div style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
        {regels.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: font.ui, fontSize: 11.5 }}>
            <span style={{ width: 96, flexShrink: 0, color: colors.faint }}>{r.label}</span>
            <span style={{ flex: 1, color: r.slecht ? "#FF7B6B" : colors.ink, fontWeight: r.slecht ? 700 : 400, overflowWrap: "anywhere" }}>
              {r.waarde}
            </span>
          </div>
        ))}
      </div>

      {geweigerd.length > 0 && (
        <div style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>Geweigerd door de rem</span>
          {geweigerd.map(([naam, n]) => (
            <div key={naam} style={{ display: "flex", justifyContent: "space-between", fontFamily: font.ui, fontSize: 11.5, color: colors.ink }}>
              <span>{naam}</span>
              <span style={{ fontWeight: 700, color: GOUD[3], fontVariantNumeric: "tabular-nums" }}>{n}</span>
            </div>
          ))}
        </div>
      )}

      {t.fouten.length > 0 && (
        <div style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>Laatste fouten</span>
          {t.fouten.map((f, i) => (
            <div key={i} style={{ fontFamily: font.ui, fontSize: 11, color: colors.sub, overflowWrap: "anywhere" }}>
              <span style={{ color: colors.faint }}>
                {new Date(f.t * 1000).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>{" "}
              <b style={{ color: "#FF9E90" }}>{f.bron}</b> {f.soort}: {f.tekst}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** De wachtrij met meldingen van spelers over spelers.
 *
 *  Dit is de enige plek waar je ziet wat er gemeld wordt, dus hij staat in het
 *  dashboard en niet ergens achter een extra knop. Afhandelen haalt de regel uit
 *  de wachtrij maar niet uit de tabel: wie er drie keer in staat is een patroon,
 *  en dat wil je later terug kunnen zien. */
function Rapporten({ game }: { game: GameApi }) {
  const items = game.state.rapporten;
  useEffect(() => { game.adminRapporten(); }, []);
  const REDEN: Record<string, string> = {
    foto: "ongepaste foto",
    beledigend: "beledigend of bedreigend",
    spam: "spam of oplichting",
    anders: "iets anders",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Kop>{`Meldingen${items.length ? ` (${items.length})` : ""}`}</Kop>
      {items.length === 0 ? (
        <span style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>Geen openstaande meldingen.</span>
      ) : (
        items.map((r) => (
          <div
            key={r.id}
            style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 10, padding: "8px 10px" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.ink }}>
                <b>{r.doel_naam}</b> gemeld door {r.melder_naam}
              </div>
              <div style={{ fontFamily: font.ui, fontSize: 11, color: colors.sub, marginTop: 1 }}>
                {REDEN[r.reden] ?? r.reden} · {new Date(r.created_at * 1000).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
              {r.tekst && (
                <div style={{ fontFamily: font.ui, fontSize: 11.5, color: colors.faint, marginTop: 4, fontStyle: "italic", overflowWrap: "anywhere" }}>
                  {r.tekst}
                </div>
              )}
            </div>
            <button
              onClick={() => game.adminRapportSluit(r.id)}
              style={{ flexShrink: 0, background: withAlpha(GOUD[3], 0.16), border: `1px solid ${withAlpha(GOUD[3], 0.4)}`, borderRadius: 999, padding: "4px 10px", cursor: "pointer", fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: GOUD[3] }}
            >
              Afgehandeld
            </button>
          </div>
        ))
      )}
    </div>
  );
}
