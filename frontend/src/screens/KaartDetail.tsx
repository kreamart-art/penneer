// KAART DETAIL — de pagina die je krijgt als je een kaart aantikt.
//
// EEN KAART, die zichzelf omdraait. Je komt binnen op de VOORKANT, en na een
// halve tel draait hij naar de achterkant met alles wat je erover weet. Niet
// twee kanten naast elkaar: dan valt er niets meer om te draaien en is de kaart
// een uitklapplaatje in plaats van een kaart. Tikken draait hem terug.
//
// Daaronder volgt de mockup: waar de kaart vandaan komt, de stand van zijn
// letter met de deelknop, en de weg terug naar de verzameling.
//
// TWEE STUKKEN ART, allebei even groot (659x1013), zodat de kaart bij het
// draaien niet van maat verandert. De voorkant is een compleet plaatje; de
// achterkant is een lege lijst met een BIJNA DOORZICHTIG binnenvlak (alfa 2 tot
// 30, opgemeten naast het edelsteentje), en daar zit de truc: de foto ligt
// eronder, dus de gouden lijst valt over de foto heen in plaats van ertegenaan
// te stoppen. De foto wordt bovendien op de VORM van de kaart geknipt, zodat er
// nergens een hoekje uitsteekt.
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Globe, MessageSquare, Share2, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BredeKnop } from "../components/BredeKnop";
import { GoudKader } from "../components/GoudKader";
import { KADER_LIJN_PAARS, NeonKader } from "../components/ProfileHero";
import { NeonText } from "../components/NeonText";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";
import type { Kaart } from "./Ontdekken";

/** Allebei even groot: 659 bij 1013. */
const KAART_VERH = 659 / 1013;
const VOOR = "/static/cards/voorkant-nieuw.webp";
const ACHTER = "/static/cards/achterkant-nieuw.webp";

/** Het vlak binnen de lijst van de ACHTERKANT, opgemeten: de gouden lijst loopt
 *  links tot 5,6% en rechts vanaf 94,8%, boven tot 8,0% en onder vanaf 97,0%. */
const VLAK = { l: 0.056, r: 0.052, t: 0.080, b: 0.030 };

/** ALLEEN DE FOTO UIT DE KAART, niet de kaart zelf.
 *
 *  image_path wijst naar de VOLLEDIGE kaart: de foto met zijn gouden lijst. Die
 *  zomaar in het vlak leggen geeft een kaart in een kaart. Hier knippen we het
 *  fotovenster eruit, met de maten waarmee die kaarten gezet zijn: x 38..624
 *  van 659 en y 82..982 van 1013. Dat venster is 89,1% bij 88,9%, dus de
 *  afbeelding gaat op 100/0,891 en schuift met datzelfde deel op. */
const FOTO = {
  breed: (100 / 0.8907).toFixed(3),
  hoog: (100 / 0.8894).toFixed(3),
  links: (-(0.05766 / 0.8907) * 100).toFixed(3),
  boven: (-(0.08095 / 0.8894) * 100).toFixed(3),
};

/** De achthoek van de secties, als knipvorm. Een categorieplaat is te klein
 *  voor een SVG met eigen verlopen; de vorm alleen is hier genoeg. */
const ACHTHOEK_KLEIN = "polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)";

/** De vakjes zijn DEZELFDE SECTIE als onderaan de pagina: GoudKader met zijn
 *  achthoek, zijn binnenlijn en zijn hoekaccenten. Alleen de kleur verschilt,
 *  die trekt hier naar paarsroze in plaats van naar goud.
 *
 *  Niet een nagemaakte achthoek met een verloopje: dan lijkt het erop maar mist
 *  het de dubbele lijn en de oplichtende hoeken, en dat is precies wat de
 *  secties hun diepte geeft. */
const SECTIE = {
  hoek: 7,
  rond: 1.5,
  kleur: "roze" as const,
  dik: 0.7,
  binnenlijn: true,
  binnenSterkte: 0.42,
  binnenKleur: "#F0B6FF",
  hoekAccent: "#F0B6FF",
  vulling: true as const,
} as const;

/** De drie kolommen van een feitregel. Het label krijgt een VASTE breedte,
 *  zodat elke waarde op dezelfde plek begint; met een label dat meegroeit
 *  springt de kolom per regel en dat leest als slordig. */
// 66 en niet 58: op 58 werd WERELDDEEL afgekapt tot "WERELDD...".
const KOLOM = { ico: "12px", label: "66px", gat: 5 } as const;

const FEIT_ICOON: Record<string, LucideIcon> = {
  hoofdstad: Building2,
  werelddeel: Globe,
  taal: MessageSquare,
  land: Globe,
  herkomst: Globe,
  leefgebied: Globe,
  sector: Building2,
  werkplek: Building2,
};

export interface FactRij { key: string; label: string; quiz?: boolean }

/** Een feit op de achterkant, in dezelfde sectie als onderaan de pagina. */
function FeitRij({ ico: Ico, label, waarde }: { ico: LucideIcon; label: string; waarde: string }) {
  return (
    <GoudKader {...SECTIE} padding="4px 8px">
      {/* EEN RASTER en geen flexrij: met de waarde rechts uitgelijnd begint
          elke waarde op een andere plek en leest de kolom rommelig. Nu staan
          het icoon, het label en de waarde bij elke regel op dezelfde lijn,
          ook onder het bijzondere feit. */}
      <div style={{ display: "grid", gridTemplateColumns: `${KOLOM.ico} ${KOLOM.label} 1fr`, alignItems: "center", gap: KOLOM.gat }}>
        <Ico size={11} color="#F0B6FF" />
        <span style={{ minWidth: 0, fontFamily: font.ui, fontSize: 8.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "#F0B6FF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span style={{ minWidth: 0, fontFamily: font.ui, fontSize: 9.5, fontWeight: 700, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {waarde}
        </span>
      </div>
    </GoudKader>
  );
}

function MetaVak({ kop, waarde, sub }: { kop: string; waarde: React.ReactNode; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0, textAlign: "center" }}>
      <span style={{ fontFamily: font.ui, fontSize: 9.5, color: colors.sub, whiteSpace: "nowrap" }}>{kop}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 12.5, lineHeight: 1.15, color: colors.ink }}>{waarde}</span>
      {sub && <span style={{ fontFamily: font.ui, fontSize: 9.5, lineHeight: 1.2, color: "#C9A2FF" }}>{sub}</span>}
    </div>
  );
}

export function KaartDetail({
  kaart,
  categorieLabel,
  letter,
  rijen,
  letterHave,
  letterTotal,
  onVerzameling,
  onBack,
}: {
  kaart: Kaart;
  categorieLabel: string;
  /** De letter van deze pagina. Een kaart uit discover_cards_for_letter draagt
   *  hem zelf niet, want binnen die lijst is hij voor iedereen hetzelfde. */
  letter: string;
  rijen: FactRij[];
  letterHave: number;
  letterTotal: number;
  onVerzameling: () => void;
  onBack: () => void;
}) {
  const { t } = useT();
  // Begint op de voorkant en draait vanzelf om: dat is het moment waar je voor
  // komt. Daarna draait hij met een tik heen en weer.
  const [om, setOm] = useState(false);
  const [foto, setFoto] = useState(!!kaart.image_path);

  useEffect(() => {
    const id = window.setTimeout(() => setOm(true), 620);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [onBack]);

  const feiten = rijen.filter((r) => (kaart.facts || {})[r.key]);
  const pct = letterTotal > 0 ? Math.round((letterHave / letterTotal) * 100) : 0;
  const datum = kaart.discovered_at
    ? new Date(kaart.discovered_at * 1000).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const deel = async () => {
    sound.uiTap();
    const tekst = t("kdDeelTekst", { woord: kaart.word || "", cat: categorieLabel });
    try {
      // Alleen tekst, geen link: net als bij de roomcode wil je mensen niet
      // wegsturen uit de app die ze al open hebben.
      if (navigator.share) await navigator.share({ text: tekst });
      else await navigator.clipboard?.writeText(tekst);
    } catch { /* afgebroken deelvenster is geen fout */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ---- de categoriepil ---- */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {/* Dezelfde neonpil als "Verlaat room", maar dan met de achthoek en de
            paarse lijn: lijn en licht, met een bijna dekkende vulling zodat de
            pil los van de achtergrond staat. */}
        <NeonKader
          hoek={9} radius={2} dik={0.5} vulling="zwart" animeer
          lijn={KADER_LIJN_PAARS} gloed={`0 0 12px ${withAlpha(colors.violet, 0.35)}`}
          binnen={{ padding: 0 }}
        >
          <span
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "6px 18px",
              fontFamily: font.wide, fontSize: 13, letterSpacing: 1.4, color: colors.ink,
              textTransform: "uppercase",
            }}
          >
            <Globe size={15} color="#C9A2FF" />
            {categorieLabel}
          </span>
        </NeonKader>
      </div>

      {/* ---- DE KAART, die zichzelf omdraait ---- */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: "min(66%, 240px)", perspective: 1200 }}>
          <button
            onClick={() => { sound.uiTap(); setOm((v) => !v); }}
            aria-label={kaart.word || ""}
            style={{
              position: "relative", width: "100%", aspectRatio: `${KAART_VERH}`,
              background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "block",
              transformStyle: "preserve-3d",
              transform: om ? "rotateY(180deg)" : "rotateY(0deg)",
              transition: "transform .7s cubic-bezier(.2,.8,.2,1)",
            }}
          >
            {/* VOORKANT */}
            <span
              style={{
                position: "absolute", inset: 0, display: "block",
                backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
              }}
            >
              <img
                src={VOOR} alt="" aria-hidden draggable={false}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
              />
              {/* De categorieplaat: smal, in dezelfde achthoek als de secties. */}
              <span style={{ position: "absolute", left: "50%", bottom: "15%", transform: "translateX(-50%)" }}>
                <NeonKader
                  hoek={6} radius={2} dik={0.45} vulling="zwart" animeer
                  lijn={KADER_LIJN_PAARS} gloed={`0 0 9px ${withAlpha(colors.violet, 0.35)}`}
                  binnen={{ padding: 0 }}
                >
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                      padding: "3px 9px", whiteSpace: "nowrap",
                      fontFamily: font.wide, fontSize: "clamp(6.5px, 2.2vw, 9.5px)", letterSpacing: ".08em",
                      color: colors.ink, textTransform: "uppercase",
                    }}
                  >
                    <Globe size={9} color="#C9A2FF" />
                    {categorieLabel}
                  </span>
                </NeonKader>
              </span>
            </span>

            {/* ACHTERKANT */}
            <span
              style={{
                position: "absolute", inset: 0, display: "block",
                backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              {/* De foto ligt ONDER de lijst en is op de VORM van de kaart
                  geknipt: zo loopt hij helemaal onder de dikke rand door en
                  steekt er nergens een hoekje uit. */}
              {/* GEKNIPT OP DE VORM, niet gemaskeerd met de art. De lijst
                  gebruiken als masker leek slim, maar zijn binnenvlak heeft
                  alfa 2 tot 30: dan wordt de foto binnen de kaart bijna
                  helemaal doorzichtig en zie je er niets meer van. Een
                  clip-path met dezelfde afgeschuinde hoeken doet wat de bedoeling
                  was: de foto loopt tot onder de rand en er steekt niets uit. */}
              <span
                style={{
                  position: "absolute", left: "2.5%", right: "2.5%", top: "3.2%", bottom: "1.8%",
                  display: "block", overflow: "hidden",
                  clipPath: "polygon(11% 0, 89% 0, 100% 7%, 100% 93%, 89% 100%, 11% 100%, 0 93%, 0 7%)",
                }}
              >
                {foto ? (
                  <img
                    src={kaart.image_path as string} alt="" aria-hidden draggable={false}
                    onError={() => setFoto(false)}
                    style={{
                      position: "absolute",
                      left: `${FOTO.links}%`, top: `${FOTO.boven}%`,
                      width: `${FOTO.breed}%`, height: `${FOTO.hoog}%`,
                      maxWidth: "none", display: "block",
                      // Naar boven uitvergroot: de foto hoort de BOVENKANT van
                      // de kaart te vullen, en de onderkant van de bron loopt
                      // toch al weg in het paars.
                      transform: "scale(1.14)", transformOrigin: "50% 0",
                    }}
                  />
                ) : (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute", left: 0, right: 0, top: "16%", textAlign: "center",
                      fontFamily: font.display, fontWeight: 800, fontSize: "clamp(26px, 9vw, 44px)",
                      color: withAlpha(colors.gold, 0.3),
                    }}
                  >
                    {letter}
                  </span>
                )}
                <span
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0,
                    // LICHT houden: de bronfoto vaagt zelf al weg naar paars
                    // vanaf 52%. Een tweede donkere laag daarbovenop maakte de
                    // hele foto grauw; dit is net genoeg om de feiten leesbaar
                    // te houden.
                    background: "linear-gradient(180deg, transparent 44%, rgba(20,8,44,.45) 64%, rgba(20,8,44,.85) 82%)",
                  }}
                />
              </span>

              <img
                src={ACHTER} alt="" aria-hidden draggable={false}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
              />

              <span
                style={{
                  position: "absolute",
                  left: `${VLAK.l * 100}%`, right: `${VLAK.r * 100}%`,
                  top: `${VLAK.t * 100}%`, bottom: `${VLAK.b * 100}%`,
                  display: "flex", flexDirection: "column", gap: 3,
                  padding: "4% 6%", minWidth: 0,
                }}
              >
                <NeonText
                  accent={colors.gold} blur={10} glow={0.55}
                  style={{
                    fontFamily: font.display, fontWeight: 800,
                    fontSize: "clamp(11px, 4.4vw, 17px)", lineHeight: 1.05, textAlign: "center",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                    flexShrink: 0,
                  }}
                >
                  {kaart.word}
                </NeonText>

                {kaart.iso && (
                  <img
                    src={`/vlaggen/${kaart.iso}.webp`} alt=""
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    style={{ position: "absolute", right: "6%", top: "1%", width: "22%", borderRadius: 2, display: "block" }}
                  />
                )}

                <span style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  {feiten.filter((r) => r.key !== "weetje").map((r) => (
                    <FeitRij
                      key={r.key}
                      ico={FEIT_ICOON[r.key] ?? Globe}
                      label={r.label}
                      waarde={String((kaart.facts || {})[r.key])}
                    />
                  ))}
                  {(kaart.facts || {}).weetje && (
                    <GoudKader {...SECTIE} padding="4px 8px">
                      {/* Het label op de lijn van de andere feiten, maar de ZIN
                          eronder over de volle breedte: een zin naast een label
                          in een kolom van honderd pixels wordt een strookje van
                          vier woorden hoog. */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ display: "grid", gridTemplateColumns: `${KOLOM.ico} 1fr`, gap: KOLOM.gat, alignItems: "center" }}>
                          <Star size={10} color="#F0B6FF" fill="#F0B6FF" />
                          <span style={{ fontFamily: font.ui, fontSize: 8.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "#F0B6FF" }}>
                            {t("kdWeetje")}
                          </span>
                        </span>
                        <span style={{ display: "block", fontFamily: font.ui, fontSize: 8.5, lineHeight: 1.32, color: colors.ink }}>
                          {String((kaart.facts || {}).weetje)}
                        </span>
                      </div>
                    </GoudKader>
                  )}
                </span>
              </span>
            </span>
          </button>
          <div style={{ marginTop: 7, textAlign: "center", fontFamily: font.ui, fontSize: 10.5, color: colors.faint }}>
            {om ? t("kdAchterkant") : t("kdVoorkant")} · {t("ontdekkenDraaiOm")}
          </div>
        </div>
      </div>

      {/* ---- waar de kaart vandaan komt ---- */}
      <GoudKader hoek={11} kleur="violet" dik={0.6} gloed vulling="licht" binnenlijn hoekAccent="#F3B53E" padding={11}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center", gap: 4 }}>
          <MetaVak kop={t("kdOntdektOp")} waarde={datum || "-"} />
          <span style={{ display: "flex", justifyContent: "center", borderInline: `1px solid ${withAlpha("#572D7C", 0.7)}`, width: "100%" }}>
            <MetaVak
              kop={t("kdVerzameldIn")}
              waarde={t(kaart.spoor ? "kdSpoor" : "kdOefenronde")}
              sub={`${categorieLabel} - ${t("kdLetter", { letter })}`}
            />
          </span>
          <MetaVak kop={t("kdKaartnummer")} waarde={`#${String(kaart.card_number).padStart(3, "0")}`} />
        </div>
      </GoudKader>

      {/* ---- de stand van de letter, met delen ---- */}
      <GoudKader hoek={11} kleur="violet" dik={0.6} gloed vulling="licht" binnenlijn hoekAccent="#F3B53E" padding={10}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center",
              background: "radial-gradient(circle at 35% 30%, #2A1550, #120726)",
              border: `2px solid ${withAlpha(colors.gold, 0.8)}`,
              boxShadow: `0 0 10px ${withAlpha(colors.gold, 0.35)}`,
              fontFamily: font.display, fontWeight: 800, fontSize: 20, color: colors.gold,
            }}
          >
            {letter}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontFamily: font.display, fontWeight: 800, fontSize: 13, color: colors.gold }}>
              {t("kdLetter", { letter })}
            </span>
            <span style={{ display: "block", fontFamily: font.ui, fontSize: 10.5, color: colors.sub, marginBottom: 4 }}>
              {t("kdKaartenVan", { have: letterHave, total: letterTotal })}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  flex: 1, height: 7, borderRadius: 999, overflow: "hidden",
                  background: "rgba(0,0,0,.5)", border: `1px solid ${withAlpha(colors.gold, 0.25)}`,
                }}
              >
                <span
                  style={{
                    display: "block", height: "100%", width: `${pct}%`, borderRadius: 999,
                    background: `linear-gradient(180deg, ${colors.goldHi}, ${colors.gold} 55%, #B07C17)`,
                  }}
                />
              </span>
              <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 12, color: colors.gold }}>{pct}%</span>
            </span>
          </span>
          <button
            onClick={() => void deel()}
            aria-label={t("kdDelen")}
            className="pressable"
            style={{
              flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "7px 9px", clipPath: ACHTHOEK_KLEIN, cursor: "pointer", border: "none",
              background: "linear-gradient(180deg, rgba(92,34,138,.92), rgba(52,16,88,.95))",
            }}
          >
            <Share2 size={15} color={colors.ink} />
            <span style={{ fontFamily: font.ui, fontSize: 8, fontWeight: 800, letterSpacing: ".06em", color: colors.ink, textTransform: "uppercase" }}>
              {t("kdDelen")}
            </span>
          </button>
        </div>
      </GoudKader>

      <BredeKnop onClick={onVerzameling}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {t("kdBekijkVerzameling")} <ArrowRight size={16} />
        </span>
      </BredeKnop>
    </div>
  );
}
