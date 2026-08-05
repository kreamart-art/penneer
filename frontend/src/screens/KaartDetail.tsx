// KAART DETAIL — de pagina die je krijgt als je een kaart aantikt.
//
// Nagebouwd naar de mockup, van boven naar beneden:
//   1. de categoriepil
//   2. de VOORKANT en de ACHTERKANT naast elkaar, met een pijl ertussen
//   3. wanneer je hem ontdekte, waarmee, en zijn kaartnummer
//   4. de stand van zijn letter, met delen en favoriet
//   5. de weg terug naar de verzameling
//
// TWEE STUKKEN ART en de rest is code. De voorkant is een compleet plaatje: het
// penembleem, de lauwertak en de gouden lijst zitten er al in, dus daar hoeft
// alleen de categoriepil overheen. De achterkant is een LEGE lijst met een paars
// binnenvlak; de naam, de foto en de feiten worden erin getekend.
//
// Waarom niet de kaart-art zoals hij in de verzameling ligt: die is een foto MET
// een lijst eromheen, en de mockup wil de foto binnen het paarse vlak met de
// feiten eronder. Dezelfde foto, andere opmaak.
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Globe, MessageSquare, Share2, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BredeKnop } from "../components/BredeKnop";
import { GoudKader } from "../components/GoudKader";
import { NeonText } from "../components/NeonText";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";
import type { Kaart } from "./Ontdekken";

/** De twee stukken art, met hun eigen verhouding. De voorkant is smaller dan de
 *  achterkant omdat de hoekkrullen anders liggen; elk krijgt dus zijn eigen
 *  aspect-ratio en niet een gedeelde. */
const VOOR = { src: "/static/cards/voorkant-nieuw.webp", verh: 635 / 1003 };
const ACHTER = { src: "/static/cards/achterkant-nieuw.webp", verh: 659 / 1013 };

/** Het paarse binnenvlak van de ACHTERKANT, opgemeten op de art: de gouden lijst
 *  loopt links tot 5,6% en rechts vanaf 94,8%, boven tot 8,0% en onder vanaf
 *  97,0%. Daarbinnen komt alles te staan. */
const VLAK = { l: 0.056, r: 0.052, t: 0.080, b: 0.030 };

/** ALLEEN DE FOTO UIT DE KAART, niet de kaart zelf.
 *
 *  image_path wijst naar de VOLLEDIGE kaart: de foto MET zijn gouden lijst. Die
 *  zomaar in het vlak leggen geeft een kaart in een kaart. Daarom knippen we
 *  hier het fotovenster eruit, met de maten waarmee die kaarten gezet zijn:
 *  x 38..624 van 659 en y 82..982 van 1013.
 *
 *  Het venster beslaat 89,1% van de breedte en 88,9% van de hoogte, dus de
 *  afbeelding gaat op 100/0,891 en schuift met datzelfde deel naar links en
 *  omhoog. Dan valt precies het venster over de doos. */
const FOTO = {
  breed: (100 / 0.8907).toFixed(3),
  hoog: (100 / 0.8894).toFixed(3),
  links: (-(0.05766 / 0.8907) * 100).toFixed(3),
  boven: (-(0.08095 / 0.8894) * 100).toFixed(3),
};

/** Een icoon per feit, zoals in het ontwerp. Valt terug op de bol, want een
 *  categorie kan velden hebben die hier nog niet in staan. */
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

/** Een regel op de achterkant: icoon, label, waarde. */
function FeitRij({ ico: Ico, label, waarde }: { ico: LucideIcon; label: string; waarde: string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "6px 9px", borderRadius: 8,
        background: "rgba(10,3,26,.55)",
        border: `1px solid ${withAlpha(colors.gold, 0.32)}`,
      }}
    >
      <Ico size={13} color={colors.gold} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: colors.gold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ flexShrink: 0, maxWidth: "52%", fontFamily: font.ui, fontSize: 10.5, fontWeight: 700, color: colors.ink, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {waarde}
      </span>
    </div>
  );
}

/** Een blokje in de balk met de herkomst van de kaart. */
function MetaVak({ kop, waarde, sub }: { kop: string; waarde: React.ReactNode; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0, textAlign: "center" }}>
      <span style={{ fontFamily: font.ui, fontSize: 9.5, color: colors.sub, whiteSpace: "nowrap" }}>{kop}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 12.5, lineHeight: 1.15, color: colors.ink }}>{waarde}</span>
      {sub && (
        <span style={{ fontFamily: font.ui, fontSize: 9.5, lineHeight: 1.2, color: "#C9A2FF" }}>{sub}</span>
      )}
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
  /** De stand van de letter waar deze kaart bij hoort. */
  letterHave: number;
  letterTotal: number;
  onVerzameling: () => void;
  onBack: () => void;
}) {
  const { t } = useT();
  const [gedraaid, setGedraaid] = useState(false);
  const [foto, setFoto] = useState(!!kaart.image_path);

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
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "6px 18px", borderRadius: 10,
            background: `linear-gradient(180deg, ${withAlpha(colors.violet, 0.5)}, ${withAlpha(colors.violetDeep, 0.6)})`,
            border: `1.5px solid ${withAlpha("#D9A6DF", 0.7)}`,
            boxShadow: `0 0 14px ${withAlpha(colors.violet, 0.35)}`,
            fontFamily: font.wide, fontSize: 13, letterSpacing: 1.4, color: colors.ink,
            textTransform: "uppercase",
          }}
        >
          <Globe size={15} color="#C9A2FF" />
          {categorieLabel}
        </span>
      </div>

      {/* ---- de twee kanten ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6 }}>
        {/* VOORKANT: compleet plaatje, alleen de categoriepil komt erover. */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.wide, fontSize: 9.5, letterSpacing: 1.2, color: "#C9A2FF", textAlign: "center", marginBottom: 5 }}>
            {t("kdVoorkant")}
          </div>
          <button
            onClick={() => { sound.uiTap(); setGedraaid(false); }}
            aria-label={t("kdVoorkant")}
            className="pressable"
            style={{
              position: "relative", width: "100%", aspectRatio: `${VOOR.verh}`,
              background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "block",
              opacity: gedraaid ? 0.55 : 1, transition: "opacity .25s ease",
            }}
          >
            <img
              src={VOOR.src} alt="" aria-hidden draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
            />
            {/* De plaat met de categorie, op de plek die de art vrijlaat. */}
            <span
              style={{
                position: "absolute", left: "14%", right: "14%", bottom: "16%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "3px 0", borderRadius: 6,
                background: "rgba(10,4,26,.82)", border: `1px solid ${withAlpha("#D9A6DF", 0.6)}`,
                fontFamily: font.wide, fontSize: "clamp(7px, 2.4vw, 11px)", letterSpacing: ".08em",
                color: colors.ink, textTransform: "uppercase",
              }}
            >
              <Globe size={10} color="#C9A2FF" />
              {categorieLabel}
            </span>
          </button>
        </div>

        <ArrowRight size={22} color={colors.gold} style={{ marginTop: 16, flexShrink: 0 }} />

        {/* ACHTERKANT: lege lijst, inhoud erin getekend. */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.wide, fontSize: 9.5, letterSpacing: 1.2, color: "#C9A2FF", textAlign: "center", marginBottom: 5 }}>
            {t("kdAchterkant")}
          </div>
          <button
            onClick={() => { sound.uiTap(); setGedraaid(true); }}
            aria-label={kaart.word || t("kdAchterkant")}
            className="pressable"
            style={{
              position: "relative", width: "100%", aspectRatio: `${ACHTER.verh}`,
              background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "block",
              opacity: gedraaid ? 1 : 0.85, transition: "opacity .25s ease",
            }}
          >
            {/* DE FOTO LIGT ONDER DE LIJST. Het binnenvlak van de art is bijna
                doorzichtig (alfa 2 tot 30 gemeten), dus de gouden lijn valt
                gewoon over de foto heen in plaats van ertegenaan te stoppen.
                Vandaar deze volgorde: eerst de foto, dan de lijst, dan de tekst.

                De doos loopt tot ONDER de lijst door (2,5% aan de zijkanten,
                3,5% bovenin, tegen de 5,6% en 8,0% van het vlak zelf), zodat er
                nergens een naad te zien is. */}
            <div
              style={{
                position: "absolute", left: "2.5%", right: "2.5%", top: "3.5%", bottom: "2%",
                overflow: "hidden", borderRadius: 6,
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
                    // Naar boven toe uitvergroot: de foto hoort de BOVENKANT van
                    // de kaart te vullen, en het onderste deel van de bron loopt
                    // toch al weg in het paars.
                    transform: "scale(1.16)", transformOrigin: "50% 0",
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
              {/* De uitloop naar paars, zodat de feiten leesbaar op de foto
                  liggen en de foto niet met een harde rand ophoudt. */}
              <span
                aria-hidden
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(180deg, transparent 34%, rgba(24,10,52,.7) 50%, rgba(20,8,44,.96) 64%)",
                }}
              />
            </div>

            <img
              src={ACHTER.src} alt="" aria-hidden draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
            />

            <div
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
                  fontSize: "clamp(11px, 3.9vw, 18px)", lineHeight: 1.05, textAlign: "center",
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
                  style={{
                    position: "absolute", right: "6%", top: "1%", width: "22%",
                    borderRadius: 2, boxShadow: "0 2px 7px rgba(0,0,0,.7)",
                  }}
                />
              )}

              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                {feiten.filter((r) => r.key !== "weetje").map((r) => (
                  <FeitRij
                    key={r.key}
                    ico={FEIT_ICOON[r.key] ?? Globe}
                    label={r.label}
                    waarde={String((kaart.facts || {})[r.key])}
                  />
                ))}
                {(kaart.facts || {}).weetje && (
                  <div
                    style={{
                      padding: "6px 9px", borderRadius: 8,
                      background: "rgba(10,3,26,.62)", border: `1px solid ${withAlpha(colors.gold, 0.32)}`,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <Star size={12} color={colors.gold} fill={colors.gold} style={{ flexShrink: 0 }} />
                      <span style={{ fontFamily: font.ui, fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: colors.gold }}>
                        {t("kdWeetje")}
                      </span>
                    </span>
                    <span style={{ display: "block", fontFamily: font.ui, fontSize: 9.5, lineHeight: 1.35, color: colors.ink }}>
                      {String((kaart.facts || {}).weetje)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ---- waar de kaart vandaan komt ---- */}
      <GoudKader hoek={11} kleur="violet" dik={0.6} gloed vulling="licht" binnenlijn hoekAccent="#F3B53E" padding={11}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center", gap: 4 }}>
          <MetaVak kop={t("kdOntdektOp")} waarde={datum || "-"} />
          <span style={{ display: "flex", justifyContent: "center", borderInline: `1px solid ${withAlpha("#572D7C", 0.7)}` , width: "100%" }}>
            <MetaVak
              kop={t("kdVerzameldIn")}
              waarde={t(kaart.spoor ? "kdSpoor" : "kdOefenronde")}
              sub={`${categorieLabel} - ${t("kdLetter", { letter })}`}
            />
          </span>
          <MetaVak kop={t("kdKaartnummer")} waarde={`#${String(kaart.card_number).padStart(3, "0")}`} />
        </div>
      </GoudKader>

      {/* ---- de stand van de letter, met delen en favoriet ---- */}
      <GoudKader hoek={11} kleur="violet" dik={0.6} gloed vulling="licht" binnenlijn hoekAccent="#F3B53E" padding={10}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {/* De letter als munt, zoals in het ontwerp. */}
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
          {/* Delen en favoriet als twee vierkante knoppen, zoals in het ontwerp.
              Favoriet is nog niet aan te zetten: er is geen endpoint voor, dus
              hij zou een knop zijn die niets onthoudt. */}
          <button
            onClick={() => void deel()}
            aria-label={t("kdDelen")}
            className="pressable"
            style={{
              flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "7px 9px", borderRadius: 9, cursor: "pointer",
              background: `linear-gradient(180deg, ${withAlpha(colors.violet, 0.55)}, ${withAlpha(colors.violetDeep, 0.65)})`,
              border: `1px solid ${withAlpha("#D9A6DF", 0.6)}`,
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
