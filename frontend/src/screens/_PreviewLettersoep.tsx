// PREVIEW van Lettersoep, het arenaspel van vrijdag. Niet aangesloten op de app:
// een underscore ervoor en geen import vanuit App, dus hij staat in het project
// maar niet in de bundel. Bedoeld om over het ontwerp te praten voordat er een
// spel achter zit.
//
// HET IDEE: de kast is het CHASSIS van de arena, niet van de Flitsreeks. Zijn
// ruit is vierkant, dus wat er in past is een raster; welk raster hangt van de
// dag af. Donderdag zijn dat vier flitspads, vrijdag zestien letters. Dezelfde
// LED-balk erboven, dezelfde uitstapknop eronder, hetzelfde decor erachter. Dat
// scheelt niet alleen werk: het maakt de arena één plek in plaats van zeven
// losse spelletjes achter dezelfde tegel.
//
// DE REGELS die al vastlagen: zestien letters, twee minuten, langere woorden
// leveren veel meer op. Plus de drie arenaregels (ceilingloos, onbeperkt
// herkansen met de beste poging, verdringingspush op plek 1).
//
// WAT DIT VOORSTEL TOEVOEGT:
//  - Woorden worden gelegd door aangrenzende letters te verbinden (Boggle), niet
//    door letters los te tikken. Dat is de reden dat het raster zestien vakjes
//    heeft en niet een rij van zestien: de PLEK van een letter doet dan mee.
//  - De punten verdubbelen per letter vanaf drie. Zo is de score ceilingloos
//    zonder dat er een bonus-systeem bij hoeft, en is één zevenletterwoord meer
//    waard dan tien drieletterwoorden. Dat is precies het gedrag dat je wil:
//    zoeken in plaats van harken.
//  - De LED-balk draagt de KLOK links en de stand rechts. Bij de Flitsreeks
//    staat daar de ronde; een spel met een klok zet daar zijn klok.
import { LogOut } from "lucide-react";
import { Screen } from "../components/Layout";
import { KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { BALK, KAST, KAST_SCHEEF, LED, Led, Ruit, VAK } from "./Arena";
import { colors, font, withAlpha } from "../theme/tokens";

// Het bord van deze voorbeelddag. Vier bij vier, en zo gezet dat er echte
// Nederlandse woorden in aangrenzende paden te vinden zijn: ROL, LEK, STAK, KIN,
// ELK, KLEIN. Een generator zal hier straks op letterfrequentie moeten letten,
// anders krijg je een bord waar niets in zit.
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

const GAT = 0.028; // deel van de rasterbreedte

export function PreviewLettersoep() {
  const stand = GEVONDEN.reduce((t, g) => t + punten(g.n), 0);
  const woord = PAD.map(([r, k]) => BORD[r][k]).join("");
  const inPad = (r: number, k: number) => PAD.findIndex(([pr, pk]) => pr === r && pk === k);

  // De middens van de vakjes als percentage van het raster, voor de lijn die het
  // pad tekent. Vier kolommen met drie gaten ertussen.
  const stap = (i: number) => ((i + 0.5) * (1 - 3 * GAT) / 4 + i * GAT) * 100;

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>Arena</span>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 13, color: colors.gold, fontVariantNumeric: "tabular-nums" }}>7:41:12</span>
        </div>
      }
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 30 }}>
        {/* De balk: KLOK links, stand rechts. Bij de Flitsreeks staat links de
            ronde; een spel met een klok zet daar zijn klok. */}
        <Ruit
          art="/ui/flits/ledbalk.webp?v=4"
          maat={LED}
          breedte={BALK}
          style={{ marginRight: `calc(${VAK} * ${KAST_SCHEEF * 2})` }}
          binnen={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 22, gap: 12, overflow: "hidden" }}
        >
          <Led maat={22} kleur="#FFC23D">1:24</Led>
          <Led maat={30} kleur="#FF921F">{String(stand)}</Led>
        </Ruit>

        {/* Dezelfde kast, ander raster in de ruit. */}
        <div style={{ position: "relative", width: VAK, height: `calc(${VAK} / ${KAST})`, flexShrink: 0 }}>
          <img src="/ui/flits/machine.webp?v=5" alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
          <div style={{ position: "absolute", left: "9.38%", right: "10.42%", top: "13.86%", bottom: "12.13%", display: "grid", placeItems: "center" }}>
            <div style={{ position: "relative", width: "94%", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: `${GAT * 100}%` }}>
              {/* Het pad als lijn ACHTER de letters: hij verbindt de middens, dus
                  je ziet in één oogopslag welke route je legt. Een reeks losse
                  opgelichte vakjes laat de ORDE niet zien, en juist die orde is
                  het woord. */}
              <svg
                aria-hidden
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
              >
                <polyline
                  points={PAD.map(([r, k]) => `${stap(k)},${stap(r)}`).join(" ")}
                  fill="none"
                  stroke={withAlpha("#FFC23D", 0.85)}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: "blur(0.6px)" }}
                />
              </svg>
              {BORD.map((rij, r) =>
                rij.map((letter, k) => {
                  const i = inPad(r, k);
                  const aan = i >= 0;
                  return (
                    <div
                      key={`${r}-${k}`}
                      style={{
                        position: "relative",
                        zIndex: aan ? 2 : 0,
                        aspectRatio: "1",
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "22%",
                        // Materiaal: hetzelfde donkere metaal als de kast, met een
                        // verlichte bovenrand. Een opgelicht vakje is geen andere
                        // KLEUR maar hetzelfde vakje met licht erin.
                        background: aan
                          ? "linear-gradient(168deg, #6B3A05 0%, #3E1F02 52%, #2A1401 100%)"
                          : "linear-gradient(168deg, #241A16 0%, #171010 52%, #0F0A0A 100%)",
                        boxShadow: aan
                          ? `inset 0 1px 0 ${withAlpha("#FFE7A8", 0.5)}, inset 0 -2px 4px rgba(0,0,0,.6), 0 0 14px ${withAlpha("#FFA524", 0.55)}`
                          : "inset 0 1px 0 rgba(255,225,180,.09), inset 0 -2px 4px rgba(0,0,0,.55)",
                        border: `1px solid ${aan ? withAlpha("#FFC23D", 0.75) : "rgba(255,200,150,.13)"}`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: font.wide,
                          fontSize: 21,
                          letterSpacing: 1,
                          color: aan ? "#FFF0C8" : withAlpha("#FFD79A", 0.62),
                          textShadow: aan ? `0 0 10px ${withAlpha("#FFA524", 0.9)}` : "none",
                        }}
                      >
                        {letter}
                      </span>
                      {/* De volgorde in het pad. Zonder cijfer weet je bij een
                          woord dat over zichzelf heen loopt niet meer waar het
                          begon. */}
                      {aan && (
                        <span style={{ position: "absolute", top: 2, right: 4, fontFamily: font.ui, fontSize: 8.5, fontWeight: 700, color: withAlpha("#FFE7A8", 0.75) }}>
                          {i + 1}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Het woord dat je legt, met wat het NU waard is. De waarde erbij is het
            hele spel: je ziet leven dat een letter erbij verdubbelt. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 26 }}>
          <span style={{ fontFamily: font.wide, fontSize: 22, letterSpacing: 3, color: colors.ink }}>{woord}</span>
          <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, color: colors.green }}>+{punten(PAD.length)}</span>
        </div>

        {/* Wat je al hebt. Kort en op één regel: een lange lijst hoort bij de
            uitslag, niet bij het spelen. */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, maxWidth: VAK }}>
          {GEVONDEN.map((g) => (
            <span
              key={g.woord}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 9px", borderRadius: 999,
                background: withAlpha("#000000", 0.34),
                border: `1px solid ${withAlpha("#FFC23D", 0.28)}`,
                fontFamily: font.ui, fontSize: 12, color: colors.sub,
              }}
            >
              {g.woord}
              <span style={{ fontFamily: font.display, fontWeight: 800, color: withAlpha("#FFC23D", 0.9) }}>{punten(g.n)}</span>
            </span>
          ))}
        </div>

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
