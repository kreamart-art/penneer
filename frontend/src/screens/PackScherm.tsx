// Een kaartpack kopen en openen.
//
// De opbouw volgt de mockup: de pack-sectie bovenaan, dan wat eruit kwam, dan
// een regel die het samenvat en tot slot de telling. Voor het openen staat er
// alleen de sectie met de knop eronder; de rest verschijnt pas als er iets te
// tonen valt, want een leeg raster met vier nullen erin is geen belofte maar
// een lege etalage.
//
// DE KAARTEN ZIJN DE ECHTE KAARTEN uit de verzameling en geen eigen tekening
// voor deze pagina: dezelfde art, dezelfde vlag, dezelfde naamplaat. Wat je
// hier ziet is precies wat er straks in je verzameling staat, en dat is het hele
// punt van een pack.
//
// ALLES WAT ERTOE DOET GEBEURT OP DE SERVER: de trekking, het afrekenen en het
// wisselgeld voor een dubbele. Een client die opnieuw kon trekken tot er iets
// moois uitkwam, maakt van een pack een gokautomaat met een herstartknop.
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Coins, Copy, Layers, Sparkles } from "lucide-react";
import { Button } from "../components/Button";
import { CoinPlate } from "../components/CoinPlate";
import { GoudKader } from "../components/GoudKader";
import { NeonText } from "../components/NeonText";
import { SierKop } from "../components/ProfileHero";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

/** De verhouding van de kaart-art, zoals in de verzameling. */
const KAART_RATIO = "658 / 1012";

/** De pack-art, bijgesneden op zijn zichtbare pixels (484 x 618). */
const PACK_RATIO = 484 / 618;

interface PackKaart {
  id: number;
  category: string;
  letter: string;
  word: string;
  iso?: string | null;
  image_path?: string | null;
  nieuw: boolean;
  munten: number;
}

interface Uitslag {
  kaarten: PackKaart[];
  nieuw: number;
  dubbel: number;
  munten: number;
  xp: number;
  kosten: number;
  saldo: number;
  scherven: number;
}

interface Info {
  kosten: number;
  kaarten: number;
  saldo: number;
  scherven: number;
  scherf_prijs: number;
  guest: boolean;
}

const kop = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

/** Een kaart uit het pack, met zijn lint en wat hij opleverde. */
function Kaart({ kaart }: { kaart: PackKaart }) {
  const { t } = useT();
  const nieuw = kaart.nieuw;
  const rand = nieuw ? colors.gold : "#6FA8FF";
  // Nog niet elke kaart heeft art. Zonder deze schakelaar houdt de tegel een
  // kapot plaatje met alt-tekst over, en dan zakt de hele rij in elkaar.
  const [art, setArt] = useState(true);
  const bron = kaart.image_path || "/static/cards/voorkant-leeg.webp";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
      {/* DE DOOS DRAAGT DE VERHOUDING en niet de afbeelding erin: laadt de art
          niet, dan zou de tegel hoogte nul krijgen en vallen de naamplaat en het
          lint op de tegel eronder. */}
      <div style={{ position: "relative", width: "100%", aspectRatio: KAART_RATIO }}>
        {art ? (
          <>
            {/* Schaduw als tweede kopie: een box-shadow werpt een rechthoek
                achter een vorm met afgeschuinde hoeken. */}
            <img
              src={bron} alt="" aria-hidden draggable={false} loading="lazy"
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
                filter: "brightness(0) blur(5px)", opacity: 0.5, transform: "translateY(4px)", pointerEvents: "none",
              }}
            />
            <img
              src={bron} alt={kaart.word} loading="lazy"
              onError={() => setArt(false)}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
                filter: `drop-shadow(0 0 2px ${withAlpha(rand, 0.55)}) drop-shadow(0 0 6px ${withAlpha(rand, 0.28)})`,
              }}
            />
          </>
        ) : (
          // Geen art: de letter van de kaart als gezicht, in dezelfde vorm.
          <span
            aria-hidden
            style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center", borderRadius: 6,
              background: "linear-gradient(180deg, #2A1550, #150A2E)",
              border: `1px solid ${withAlpha(rand, 0.6)}`,
              boxShadow: `0 0 8px ${withAlpha(rand, 0.25)}`,
              fontFamily: font.display, fontWeight: 800, fontSize: "clamp(24px, 8vw, 40px)",
              lineHeight: 1, color: withAlpha(colors.gold, 0.34), transform: "translateY(-8%)",
            }}
          >
            {kaart.letter}
          </span>
        )}
        {kaart.iso && (
          <img
            src={`/vlaggen/${kaart.iso}.webp`} alt="" loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{
              position: "absolute", right: "9%", top: "7%", width: "22%", borderRadius: 3,
              border: `1px solid ${withAlpha(colors.gold, 0.65)}`, boxShadow: "0 2px 6px rgba(0,0,0,.5)",
            }}
          />
        )}
        {/* Het lint linksboven. Nieuw is goud, dubbel is blauw: twee kleuren die
            je zonder de tekst al uit elkaar houdt. */}
        <span
          style={{
            position: "absolute", left: "3%", top: "4%", padding: "2px 6px", borderRadius: 4,
            background: nieuw
              ? `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold})`
              : "linear-gradient(180deg, #8FC0FF, #3C7BE0)",
            fontFamily: font.ui, fontSize: "clamp(6.5px, 2vw, 8.5px)", fontWeight: 800, letterSpacing: ".06em",
            color: nieuw ? "#3B2300" : "#04122C", boxShadow: "0 2px 6px rgba(0,0,0,.45)",
            textTransform: "uppercase",
          }}
        >
          {nieuw ? t("packNieuw") : t("packDubbel")}
        </span>
        {/* De naamplaat in het paarse vlak onderin de art, net als in de
            verzameling. */}
        <span
          style={{
            position: "absolute", left: "9%", right: "9%", bottom: "8%",
            padding: "3px 4px", borderRadius: 5, textAlign: "center",
            background: "rgba(10,4,26,.72)", border: `1px solid ${withAlpha(colors.gold, 0.45)}`,
            fontFamily: font.display, fontWeight: 700, fontSize: "clamp(7px, 2.2vw, 10px)",
            lineHeight: 1.15, color: colors.ink, pointerEvents: "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {kaart.word}
        </span>
        {/* Wat een dubbele opbracht, BINNEN de kaart en net boven de naamplaat.
            Onder de kaart zou hij de rij ongelijk hoog maken en dan lijkt hij
            bij de kaart eronder te horen. Een nieuwe kaart krijgt niets: die is
            zelf de opbrengst. */}
        {!nieuw && kaart.munten > 0 && (
          <span
            style={{
              position: "absolute", left: "50%", bottom: "26%", transform: "translateX(-50%)",
              display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 999,
              whiteSpace: "nowrap", background: "rgba(10,4,26,.85)",
              border: `1px solid ${withAlpha(colors.gold, 0.6)}`,
              fontFamily: font.display, fontWeight: 800, fontSize: "clamp(9px, 2.7vw, 12px)", color: colors.gold,
            }}
          >
            +{kaart.munten}
            <img src="/coin.webp" alt="" width={11} height={11} style={{ display: "block" }} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Een vakje in de samenvatting. */
function TelVak({ teken, waarde, label }: { teken: React.ReactNode; waarde: string; label: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        padding: "9px 4px", borderRadius: 9,
        background: "rgba(0,0,0,.3)", border: `1px solid ${withAlpha(colors.violet, 0.4)}`,
        textAlign: "center", minWidth: 0,
      }}
    >
      <span style={{ display: "flex", marginBottom: 1 }}>{teken}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(16px, 5.4vw, 21px)", lineHeight: 1, color: colors.gold }}>
        {waarde}
      </span>
      <span style={{ fontFamily: font.ui, fontSize: 9, lineHeight: 1.2, color: colors.sub }}>{label}</span>
    </div>
  );
}

export function PackScherm({ onVerzameling }: { onVerzameling: () => void }) {
  const { t } = useT();
  const [info, setInfo] = useState<Info | null>(null);
  const [uit, setUit] = useState<Uitslag | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const haal = useCallback(() => {
    fetch("/api/discover/pack", { headers: kop() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setInfo(d); })
      .catch(() => { /* dan staat de prijs er even niet */ });
  }, []);

  useEffect(haal, [haal]);

  const openen = async (met: "munten" | "scherven" = "munten") => {
    if (bezig) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/discover/pack/open", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...kop() },
        body: JSON.stringify({ met }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data as { error?: string; scherven?: number; nodig?: number };
        setFout(
          d.error === "te_weinig_scherven"
            ? t("packTeWeinigScherven", { n: d.scherven ?? 0, nodig: d.nodig ?? 3 })
            : res.status === 402 ? t("packTeWeinig")
            : res.status === 401 ? t("packGast")
            : t("packMislukt"),
        );
        return;
      }
      sound.results();
      navigator.vibrate?.([8, 60, 14]);
      setUit(data as Uitslag);
      setInfo((i) => (i ? { ...i, saldo: (data as Uitslag).saldo, scherven: (data as Uitslag).scherven } : i));
    } catch {
      setFout(t("packMislukt"));
    } finally {
      setBezig(false);
    }
  };

  const kosten = info?.kosten ?? 0;
  const saldo = uit ? uit.saldo : info?.saldo ?? 0;
  const scherven = uit ? uit.scherven : info?.scherven ?? 0;
  const scherfPrijs = info?.scherf_prijs ?? 3;
  // Drie op een rij, en de vijfde kaart komt vanzelf op de tweede rij te staan.
  // Vijf naast elkaar zou op een telefoon zeventig pixel per kaart geven en dan
  // is de naam onleesbaar.
  const kolommen = 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Het saldo hoort HIER in beeld: dit is het enige scherm van Ontdekken
          waar je munten uitgeeft. */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 7 }}>
        {/* De scherven staan naast de munten, want het zijn twee manieren om
            hetzelfde pack te betalen. */}
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999,
            background: "rgba(0,0,0,.32)", border: `1px solid ${withAlpha("#8B93B5", 0.5)}`,
            fontFamily: font.display, fontWeight: 800, fontSize: 13, color: "#C7CEE9",
          }}
        >
          <img src="/ui/scherf.webp" alt="" width={15} height={15}
               onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
               style={{ display: "block" }} />
          {scherven}
        </span>
        <CoinPlate coins={saldo} height={30} />
      </div>

      {/* ---- de pack-sectie ---- */}
      <GoudKader hoek={14} dik={0.8} gloed vulling binnenlijn hoekAccent="#F3B53E" puntjes padding={12}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NeonText
              accent={colors.gold} blur={14} glow={0.6}
              style={{ fontFamily: font.display, fontWeight: 800, fontSize: "clamp(22px, 7.4vw, 30px)", lineHeight: 1.05, letterSpacing: 0.5 }}
            >
              {t("packTitel")}
            </NeonText>
            <p style={{ margin: "6px 0 0", fontFamily: font.ui, fontSize: 12.5, lineHeight: 1.45, color: colors.sub }}>
              {t("packBevat", { n: info?.kaarten ?? 5 })}
              <br />
              {t("packGarantie")}
            </p>
          </div>
          {/* De art staat rechts en steekt bewust buiten het vak uit: zo ligt
              hij OP de sectie in plaats van erin, net als in het ontwerp. */}
          <div style={{ position: "relative", width: "38%", flexShrink: 0, aspectRatio: `${PACK_RATIO}`, marginRight: -4 }}>
            <img
              src={uit ? "/ui/pack-kaart-open.webp" : "/ui/pack-dicht.webp"}
              alt="" aria-hidden draggable={false}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
                filter: `drop-shadow(0 0 10px ${withAlpha(colors.gold, uit ? 0.55 : 0.3)})`,
                transition: "filter .4s ease",
              }}
            />
          </div>
        </div>
      </GoudKader>

      {/* ---- voor het openen: de knop ---- */}
      {!uit && (
        <>
          <Button variant="gold" full disabled={bezig || !!info?.guest} onClick={() => { sound.uiTap(); void openen("munten"); }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {t("packOpenen")} {kosten}
              <img src="/coin.webp" alt="" width={15} height={15} style={{ display: "block" }} />
            </span>
          </Button>
          {/* Alleen als je ze hebt: een knop die je niet kunt indrukken is een
              mededeling, en die staat al in de uitleg eronder. */}
          {scherven >= scherfPrijs && !info?.guest && (
            <Button variant="primary" full disabled={bezig} onClick={() => { sound.uiTap(); void openen("scherven"); }}>
              {t("packMetScherven", { n: scherfPrijs })}
            </Button>
          )}
          {(fout || info?.guest) && (
            <p style={{ margin: 0, fontFamily: font.ui, fontSize: 12.5, lineHeight: 1.4, color: colors.orange, textAlign: "center" }}>
              {fout ?? t("packGast")}
            </p>
          )}
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.45, color: colors.faint, textAlign: "center" }}>
            {t("packUitleg")}
          </p>
          <p style={{ margin: 0, fontFamily: font.ui, fontSize: 11.5, lineHeight: 1.45, color: colors.faint, textAlign: "center" }}>
            {t("packScherfUitleg")}
          </p>
        </>
      )}

      {/* ---- na het openen ---- */}
      {uit && (
        <>
          <GoudKader hoek={11} kleur="violet" dik={0.6} gloed vulling="licht" binnenlijn hoekAccent="#F3B53E" padding={11}>
            <SierKop label={t("packJouwKaarten")} />
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${kolommen}, 1fr)`, gap: 8, marginTop: 9 }}>
              {uit.kaarten.map((k, i) => <Kaart key={`${k.id}-${i}`} kaart={k} />)}
            </div>
          </GoudKader>

          {/* De regel die het samenvat. Op nul nieuwe kaarten staat er iets
              anders: "geweldig" bij vijf dubbele is een leugen. */}
          <GoudKader hoek={11} kleur="violet" dik={0.6} gloed vulling="licht" padding={11}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span
                style={{
                  flexShrink: 0, width: 42, height: 42, borderRadius: 10, display: "grid", placeItems: "center",
                  background: `linear-gradient(180deg, ${withAlpha(colors.violet, 0.9)}, ${withAlpha(colors.violetDeep, 0.9)})`,
                  border: `1px solid ${withAlpha(colors.gold, 0.5)}`,
                }}
              >
                <Layers size={21} color={colors.gold} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: font.display, fontWeight: 800, fontSize: 19, lineHeight: 1.1, color: colors.gold }}>
                  {uit.nieuw > 0 ? t("packGeweldig") : t("packGeenNieuw")}
                </span>
                <span style={{ display: "block", marginTop: 2, fontFamily: font.ui, fontSize: 12.5, lineHeight: 1.35, color: colors.ink }}>
                  {uit.nieuw > 0
                    ? t(uit.nieuw === 1 ? "packToegevoegdEen" : "packToegevoegd", { n: uit.nieuw })
                    : t("packAlleenWissel", { n: uit.munten })}
                </span>
              </span>
            </div>
          </GoudKader>

          <GoudKader hoek={11} kleur="violet" dik={0.6} gloed vulling="licht" binnenlijn hoekAccent="#F3B53E" padding={11}>
            <SierKop label={t("packSamenvatting")} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 9 }}>
              <TelVak teken={<Sparkles size={16} color={colors.gold} />} waarde={String(uit.nieuw)} label={t("packNieuweKaarten")} />
              <TelVak teken={<Copy size={16} color="#6FA8FF" />} waarde={String(uit.dubbel)} label={t("packDubbeleKaarten")} />
              <TelVak teken={<Coins size={16} color={colors.gold} />} waarde={`+${uit.munten}`} label={t("packMuntenVerdiend")} />
              <TelVak
                teken={<span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 11, color: "#C9B6FF" }}>XP</span>}
                waarde={`+${uit.xp}`} label={t("packXpVerdiend")}
              />
            </div>
          </GoudKader>

          <Button variant="gold" full onClick={() => { sound.uiTap(); onVerzameling(); }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {t("packNaarCollectie")} <ArrowRight size={15} />
            </span>
          </Button>
          {/* Nog een keer, zolang je het kunt betalen. Dezelfde knop als
              hierboven zou de pagina van boven af opnieuw moeten opbouwen; deze
              staat onderaan waar je toch al bent. */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button
              variant="ghost"
              disabled={bezig || saldo < kosten}
              onClick={() => { sound.uiTap(); setUit(null); void openen(); }}
            >
              {saldo < kosten ? t("packTeWeinigKort") : t("packNogEen", { n: kosten })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
