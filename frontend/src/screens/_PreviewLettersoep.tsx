// PREVIEW van Lettersoep, het arenaspel van vrijdag. Nog niet aangesloten op een
// spel: een underscore ervoor, en hij hangt achter ?soep in de url als eigen
// brok. Bedoeld om over het ontwerp te praten met de echte art in beeld.
//
// Alle secties komen uit de UI-map en zijn op hun eigen inhoud gesneden. Het
// BORD en de twee letterlagen delen een doek van 4096 bij 4954, dus die gaan op
// dezelfde uitsnede: daarmee is de opmaak de uitlijning en valt er niets te
// plaatsen. De maten hieronder zijn in die art gemeten, als breuk, zodat ze
// meeschalen zodra het vak smaller wordt.
//
// Wat hier in CODE bij komt en niet in de art zit:
//  - de neonlijn om het letterraster;
//  - de letters zelf, want die wisselen per dag;
//  - het pad dat je legt, als lijn achter de letters;
//  - de vakjes van de gevonden woorden, in de vorm van de glasrijen maar met
//    een gouden lijn zoals op de mockup.
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { Screen } from "../components/Layout";
import { KADER_LIJN_LOOP, KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { VAK } from "./Arena";
import { colors, font, withAlpha } from "../theme/tokens";

// ---- de maten van de art ----------------------------------------------------
const BORD_V = 0.8349;      // verhouding van de bordsectie
const SCORE_V = 3.7805;     // van de scorebordsectie
const ONDER_V = 2.9589;     // van de ondersectie

// De vier kolommen en rijen van het letterraster, als breuk van het bord.
const KOL = [0.0561, 0.2803, 0.5051, 0.7297];
const RIJ = [0.1636, 0.359, 0.5497, 0.7451];
const VAK_B = 0.213;
const VAK_H = 0.1791;
// Waar het donkere paneel binnen de lijst begint. Boven de eerste rij letters
// zit daardoor een open vak, en daar hoort de opdracht in het midden van.
const PANEEL_TOP = 0.024;

// De twee ruiten van het scorebord, links de tijd en rechts de punten.
const SCORE_RUIT = { t: 0.2238, h: 0.6643, links: { l: 0.0407, b: 0.3213 }, rechts: { l: 0.637, b: 0.3213 } };
// De ondersectie heeft twee banden met een streep ertussen: het woord dat je
// legt boven, de woorden die je al hebt eronder.
const ONDER_RUIT = { l: 0.0148, b: 0.9704, woord: { t: 0.1315, h: 0.4192 }, lijst: { t: 0.5589, h: 0.2849 } };

const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

/** De vorm van de glasrijen: een achthoek, dus ALLE VIER de hoeken afgesneden.
 *  Twee afgeschuinde hoeken leest als een fout in plaats van als een vorm. */
const ACHT = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;

// Hoeveel de gloed buiten een vakje uitwaaiert, als deel van dat vakje. Kort
// houden: waaiert hij verder dan de kier tussen twee vakjes, dan loopt hij die
// kier vol en verdwijnt de streep die het raster maakt.
const HALO = 0.11;
const GLOED = withAlpha("#FFA524", 0.7);
// De kleur van het paneel in de ondersectie, uit de art gemeten. Zo kan een
// vakje daar 'doorzichtig' lijken zonder dat er echt een gat in zit.
const PANEEL = "#1D0C29";

// ---- de voorbeelddag --------------------------------------------------------
const BORD = [
  ["S", "T", "E", "R"],
  ["A", "K", "L", "O"],
  ["N", "I", "E", "D"],
  ["M", "B", "A", "U"],
];
// Het pad dat nu gelegd wordt: K-L-E-I-N, allemaal aangrenzend.
const PAD: [number, number][] = [[1, 1], [1, 2], [2, 2], [2, 1], [2, 0]];
// Verdubbelen per letter vanaf drie: 3 = 100, 4 = 200, 5 = 400, 6 = 800 ...
const punten = (lengte: number) => (lengte < 3 ? 0 : 100 * 2 ** (lengte - 3));
const GEVONDEN = [
  { woord: "ROL", n: 3 },
  { woord: "LEK", n: 3 },
  { woord: "STAK", n: 4 },
];

/** Een ruit in een stuk sectie-art: dezelfde rekenwijze als bij de arena-kast.
 *  Alles als breuk van de BREEDTE, want de hoogte komt uit een verhouding en
 *  een procent op een kind rekent daar niet betrouwbaar naar terug. */
function Sectie({ art, verhouding, breedte = VAK, children }: { art: string; verhouding: number; breedte?: string; children?: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: breedte, height: `calc(${breedte} / ${verhouding})`, flexShrink: 0 }}>
      {/* De schaduw waarop de sectie zweeft. Een TWEEDE kopie van dezelfde art,
          helemaal zwart gemaakt en vervaagd, en niet `filter: drop-shadow`: die
          rastert op iOS de doos van de laag mee en dan zie je zwarte hoekjes
          rond elke afschuining. `brightness(0)` maakt elke pixel zwart en laat
          het alfakanaal staan, dus de schaduw volgt de VORM. Recht naar beneden,
          want het licht komt van boven. */}
      <img
        src={art}
        alt=""
        aria-hidden
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
          filter: "brightness(0) blur(11px)", opacity: 0.55, transform: "translateY(9px)",
          pointerEvents: "none",
        }}
      />
      <img src={art} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {children}
    </div>
  );
}

/** Een waarde met zijn opschrift, zoals in de twee ruiten van het scorebord. */
function Meter({ kop, waarde, breuk }: { kop: string; waarde: string; breuk: { l: number; b: number } }) {
  return (
    <div
      style={{
        position: "absolute",
        left: pct(breuk.l), width: pct(breuk.b),
        top: pct(SCORE_RUIT.t), height: pct(SCORE_RUIT.h),
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
      }}
    >
      <span style={{ fontFamily: font.wide, fontSize: 10, letterSpacing: 1.6, color: withAlpha("#FFE7A8", 0.72) }}>{kop}</span>
      <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 22, lineHeight: 1, color: "#FFF3D0", textShadow: "0 0 12px rgba(255,190,60,.5)" }}>{waarde}</span>
    </div>
  );
}

export function PreviewLettersoep() {
  // De zaal van dit spel. Het voorportaal krijgt straks `soephal`, dezelfde
  // plek maar dan voor de poort in plaats van erin.
  useEffect(() => {
    document.body.classList.add("soepspel");
    return () => document.body.classList.remove("soepspel");
  }, []);

  const stand = GEVONDEN.reduce((t, g) => t + punten(g.n), 0);
  const woord = PAD.map(([r, k]) => BORD[r][k]).join("");
  const inPad = (r: number, k: number) => PAD.findIndex(([pr, pk]) => pr === r && pk === k);
  // Het midden van een vakje, voor de lijn die je pad verbindt.
  const midX = (k: number) => (KOL[k] + VAK_B / 2) * 100;
  const midY = (r: number) => (RIJ[r] + VAK_H / 2) * 100;

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>Arena</span>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 13, color: colors.gold, fontVariantNumeric: "tabular-nums" }}>7:41:12</span>
        </div>
      }
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, paddingBottom: 24 }}>
        {/* Tijd links, punten rechts, het wapen ertussen. Het wapen zit in de
            art, dus de twee ruiten hoeven alleen hun cijfers te dragen. */}
        <Sectie art="/ui/soep/scorebord.webp?v=1" verhouding={SCORE_V}>
          <Meter kop="TIJD" waarde="1:24" breuk={SCORE_RUIT.links} />
          <Meter kop="PUNTEN" waarde={String(stand)} breuk={SCORE_RUIT.rechts} />
        </Sectie>

        {/* Het bord: lijst, doffe vakjes, en daarbovenop wat oplicht. */}
        <Sectie art="/ui/soep/bord.webp?v=1" verhouding={BORD_V}>
          <img src="/ui/soep/letters-dof.webp?v=1" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

          {/* De opdracht, in de lucht boven het raster die de art daarvoor
              vrijhoudt. */}
          {/* Gecentreerd in het OPEN VAK, dus tussen de binnenkant van de lijst
              en de bovenste rij letters. Op een vaste afstand van boven hangt
              hij te hoog: het vak is hoger dan de tekst en dan zie je dat. */}
          <div
            style={{
              position: "absolute", left: 0, right: 0,
              top: pct(PANEEL_TOP), height: pct(RIJ[0] - PANEEL_TOP),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span style={{ fontFamily: font.wide, fontSize: 17, letterSpacing: 3, color: "#FFD98A", textShadow: "0 0 10px rgba(255,180,50,.55)" }}>
              VIND WOORDEN
            </span>
          </div>

          {/* De neonlijn OM het raster. Hij zit niet in de art, want hij hoort
              te leven: hij loopt rond zolang je zoekt. Vulling leeg, want het
              paneel eronder is de art zelf. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: pct(KOL[0] - 0.028), right: pct(1 - (KOL[3] + VAK_B) - 0.028),
              top: pct(RIJ[0] - 0.023), bottom: pct(1 - (RIJ[3] + VAK_H) - 0.023),
              pointerEvents: "none",
            }}
          >
            <NeonKader radius={16} dik={0.45} vulling="geen" lijn={KADER_LIJN_LOOP} animeer eindkap sterkte={0.5} style={{ width: "100%", height: "100%" }} binnen={{ padding: 0 }}>
              <span />
            </NeonKader>
          </div>


          {/* De gloed die een opgelicht vakje op het paneel werpt. De art houdt
              zijn licht binnen zijn eigen omranding; dit is wat er buiten valt,
              en het is wat een gekozen letter AAN laat voelen in plaats van
              alleen anders gekleurd. Als eigen vervaagde laag en niet als
              drop-shadow-filter: die rastert op iOS de doos van de laag mee en
              dan zie je een rechthoek om je letter.

              De kracht staat BUITEN het vakje: het dekkende vakje bedekt dit
              verloop tot ruim de helft, dus alles voor dat punt zie je toch
              niet. */}
          {BORD.map((rij, r) =>
            rij.map((_, k) => {
              const aan = inPad(r, k) >= 0;
              return (
                <span
                  key={`gloed-${r}${k}`}
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: pct(KOL[k] - VAK_B * HALO), top: pct(RIJ[r] - VAK_H * HALO),
                    width: pct(VAK_B * (1 + HALO * 2)), height: pct(VAK_H * (1 + HALO * 2)),
                    borderRadius: "28%",
                    background: `radial-gradient(circle, ${GLOED} 0%, ${GLOED} 46%, ${withAlpha("#FFB43C", 0.38)} 58%, ${withAlpha("#FFB43C", 0.14)} 68%, transparent 76%)`,
                    filter: "blur(6px)",
                    opacity: aan ? 1 : 0,
                    transition: aan ? "opacity .1s linear" : "opacity .25s ease-out",
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                />
              );
            })
          )}

          {/* De opgelichte vakjes als art, elk op zijn eigen plek. */}
          {BORD.map((rij, r) =>
            rij.map((_, k) => {
              const aan = inPad(r, k) >= 0;
              return (
                <img
                  key={`aan-${r}${k}`}
                  src={`/ui/soep/letter-aan-${r}${k}.webp?v=1`}
                  alt=""
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: pct(KOL[k] - 0.0015), top: pct(RIJ[r] + 0.0015),
                    width: pct(VAK_B + 0.003), height: "auto",
                    display: "block", zIndex: 2,
                    opacity: aan ? 1 : 0,
                    transition: aan ? "opacity .08s linear" : "opacity .2s ease-out",
                  }}
                />
              );
            })
          )}

          {/* De lijn die je woord verbindt, ACHTER de vakjes: hij duikt onder
              een vakje door en komt in de kier weer boven, dus je ziet precies
              dat twee vakjes aan elkaar vast zitten zonder dat er iets over de
              letters heen loopt. Fel genoeg om in de kier te winnen van de
              gloed: een brede warme onderlaag met een bijna witte kern erop. */}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
          >
            <polyline
              points={PAD.map(([r, k]) => `${midX(k)},${midY(r)}`).join(" ")}
              fill="none" stroke={withAlpha("#FFC85A", 0.95)} strokeWidth={5.6}
              strokeLinecap="round" strokeLinejoin="round"
            />
            <polyline
              points={PAD.map(([r, k]) => `${midX(k)},${midY(r)}`).join(" ")}
              fill="none" stroke="#FFFFFF" strokeWidth={2.6}
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>

          {/* De letters en de tikvlakken bovenop. */}
          {BORD.map((rij, r) =>
            rij.map((letter, k) => {
              const i = inPad(r, k);
              const aan = i >= 0;
              return (
                <button
                  key={`tik-${r}${k}`}
                  style={{
                    position: "absolute",
                    left: pct(KOL[k]), top: pct(RIJ[r]),
                    width: pct(VAK_B), height: pct(VAK_H),
                    zIndex: 4,
                    display: "grid", placeItems: "center",
                    background: "transparent", border: "none", padding: 0, cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span
                    style={{
                      fontFamily: font.wide, fontSize: 24, letterSpacing: 1,
                      color: aan ? "#FFF6DC" : "#FFD98A",
                      // Op goud heeft room een donkere zoom nodig, anders
                      // vervaagt de letter in het vlak waar hij op staat.
                      textShadow: aan ? "0 1px 2px rgba(74,38,0,.7)" : "0 0 9px rgba(255,170,40,.45)",
                    }}
                  >
                    {letter}
                  </span>
                  {/* Het volgnummer: bij een woord dat over zichzelf heen loopt
                      weet je zonder cijfer niet meer waar het begon. */}
                  {aan && (
                    <span style={{ position: "absolute", top: "8%", right: "12%", fontFamily: font.ui, fontSize: 9, fontWeight: 800, color: "#4A2C00" }}>
                      {i + 1}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </Sectie>

        {/* Het woord dat je legt met wat het NU waard is, en daaronder wat je al
            hebt. De waarde erbij is het hele spel: je ziet leven dat een letter
            erbij verdubbelt. */}
        <Sectie art="/ui/soep/onder.webp?v=1" verhouding={ONDER_V}>
          <div
            style={{
              position: "absolute",
              left: pct(ONDER_RUIT.l), width: pct(ONDER_RUIT.b),
              top: pct(ONDER_RUIT.woord.t), height: pct(ONDER_RUIT.woord.h),
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            }}
          >
            <span style={{ fontFamily: font.wide, fontSize: 23, letterSpacing: 3, color: "#FFF3D0", textShadow: "0 0 12px rgba(255,190,60,.5)" }}>{woord}</span>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, color: colors.green }}>+{punten(PAD.length)}</span>
          </div>

          {/* De gevonden woorden in de vorm van de glasrijen, maar met de gouden
              lijn van deze sectie: hetzelfde vakje, ander materiaal. De lijn is
              een tweede geknipte laag en geen border, want een border volgt de
              rechthoek en niet de afgeschuinde vorm. */}
          <div
            style={{
              position: "absolute",
              left: pct(ONDER_RUIT.l), width: pct(ONDER_RUIT.b),
              top: pct(ONDER_RUIT.lijst.t), height: pct(ONDER_RUIT.lijst.h),
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7, paddingInline: 10,
            }}
          >
            {GEVONDEN.map((g) => (
              <span
                key={g.woord}
                style={{
                  display: "inline-flex", height: "84%", padding: 1,
                  clipPath: ACHT(6),
                  // Het verloop is twee keer zo breed als het vakje, dus als het
                  // opschuift loopt er een licht de lijn rond.
                  background: `linear-gradient(100deg, ${withAlpha("#B0710E", 0.85)} 0%, ${withAlpha("#FFD98A", 0.95)} 22%, ${withAlpha("#FFF6DC", 1)} 34%, ${withAlpha("#FFD98A", 0.95)} 46%, ${withAlpha("#B0710E", 0.85)} 70%, ${withAlpha("#B0710E", 0.85)} 100%)`,
                  backgroundSize: "200% 100%",
                }}
                className="soep-lijn soep-vak"
              >
                {/* De lijn is de rand die tussen twee geknipte lagen uitsteekt.
                    Eerst probeerde ik hem als masker dat zijn eigen binnenkant
                    wegsnijdt, maar op anderhalve pixel valt zo'n masker op de
                    schuine hoeken onder een beeldpunt en dan breekt de lijn.

                    De binnenkant is dus niet doorzichtig maar heeft de kleur van
                    het paneel waar hij op ligt, gemeten in de art zelf. Op het
                    oog is dat hetzelfde: geen glas, geen tweede vlak, alleen de
                    gouden lijn. En hij blijft heel. */}
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, paddingInline: 10,
                    clipPath: ACHT(5),
                    background: PANEEL,
                    fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: withAlpha("#FFE7A8", 0.92),
                  }}
                >
                  {g.woord}
                  <span style={{ fontFamily: font.display, fontWeight: 800, color: "#FFC23D" }}>{punten(g.n)}</span>
                </span>
              </span>
            ))}
          </div>
        </Sectie>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <NeonKader radius={999} dik={0.5} vulling="geen" animeer lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
            <button
              className="pressable"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
            >
              <LogOut size={14} /> Stoppen
            </button>
          </NeonKader>
        </div>
      </div>
    </Screen>
  );
}

export default PreviewLettersoep;
