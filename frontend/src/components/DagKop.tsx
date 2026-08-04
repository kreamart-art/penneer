// De kop van de dagronde, op de plaat uit de mockup.
//
// EEN PLAAT VOOR ALLES: het omlijste paneel EN de voortgangsbalk eronder zitten
// in hetzelfde bestand, want in de art lopen ze in elkaar over. Ze opsplitsen
// zou betekenen dat je twee stukken op een halve pixel na tegen elkaar aan moet
// leggen, en dat schuift bij elke schermbreedte net weer anders.
//
// ALLE MATEN ZIJN DELEN VAN DE PLAAT en niet van het scherm. De ankers in de
// art zijn opgemeten:
//
//   de ring        midden x 0,2531 van de breedte, y 0,4222 van de hoogte,
//                  buitenkant 0,2557 breed, binnenkant 0,2341
//   het prijsvak   x 0,4786 tot 0,9034, y 0,4667 tot 0,7084
//   de balk        het paneel houdt op bij y 0,7916, daaronder de strook
//
// De ring vond ik door de rij te zoeken waar de twee gouden banden het VERST
// uit elkaar liggen: dat is de evenaar van de cirkel, en dan volgen het midden
// en beide diameters uit diezelfde rij.
//
// DE TEKST STAAT WAAR HIJ IN DE MOCKUP STAAT, per blok opgemeten met een masker
// op de KLEUR van de letters (bijna-wit, creme of goud) en niet op helderheid:
// de paarse nevel in de achtergrond komt boven elke helderheidsdrempel uit die
// laag genoeg is om de letters te pakken. Uit die maskers komt per blok de
// kaphoogte, en kaphoogte gedeeld door 0,72 is de lettergrootte.
//
// TWEE LABELS HEBBEN EEN ONDERGRENS. De mockup is op ongeveer twee en een halve
// keer telefoonformaat getekend, dus de kleinste tekst erin komt op een echte
// telefoon uit op vier pixels. Die twee (de kop van het prijsvak en de
// aansporing rechts) krijgen daarom een bodem. Al het andere staat op de
// gemeten verhouding, want dat valt binnen wat leesbaar is.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArtIcoon } from "./ArtIcoon";
import { colors, font, withAlpha } from "../theme/tokens";

/** Breedte gedeeld door hoogte van het vel. */
const VERHOUDING = 1.8748;

/** De ring waar je reeks in staat. x en de diameter in delen van de BREEDTE,
 *  y in delen van de HOOGTE: `top` in css rekent met de hoogte van de ouder en
 *  `left` met de breedte, en die twee zijn hier niet gelijk. */
const RING = { x: 0.2531, binnen: 0.2341 };

/** Het vak rechtsonder waar de dagprijs in staat. */
const VAK = { l: 0.4786, r: 0.9034, t: 0.4667, b: 0.7084 };

/** Het midden van de strook onder het paneel. Opgemeten en niet afgeleid: de
 *  bovenrail van de strook licht op bij y 0,814 en de vulling loopt door tot
 *  vlak boven de onderkant van het vel, dus het hart ligt op 0,906. Alles in de
 *  strook hangt hieraan; in de mockup stond het tegen die bovenrail geplakt en
 *  dat leest als "te hoog". */
const STROOK = 0.9060;

/** De gleuf van de voortgangsbalk. Even breed als in de mockup, maar op de
 *  hoogte van het midden van de strook gezet. */
const BALK = { l: 0.3103, r: 0.5740, hoog: 0.0549 };

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

/** Van kaphoogte (in delen van de breedte) naar lettergrootte in pixels. */
const uitKap = (kap: number, b: number) => (kap / 0.72) * b;

/** Een blok tekst dat op zijn MIDDEN wordt geplaatst in plaats van op zijn
 *  bovenkant. Zo staat het waar het in de mockup stond, ongeacht hoe hoog de
 *  regel toevallig uitvalt. */
function OpMidden({
  x, y, breedte, uitlijnen = "left", children,
}: {
  x: number; y: number; breedte?: number;
  uitlijnen?: "left" | "center";
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        position: "absolute",
        left: pct(x), top: pct(y),
        width: breedte !== undefined ? pct(breedte) : undefined,
        transform: "translateY(-50%)",
        display: "flex", alignItems: "center",
        justifyContent: uitlijnen === "center" ? "center" : "flex-start",
        pointerEvents: "none",
      }}
    >
      {children}
    </span>
  );
}

export function DagKop({
  reeks, prijs, gedaan, totaal, titel, uitleg, reeksLabel, prijsLabel, voortgangLabel, aansporing, aansporingVet,
}: {
  /** Hoeveel dagen op rij je meedeed. */
  reeks: number;
  /** Wat er vandaag bovenaan te winnen valt; komt van de server. */
  prijs: { kist: string | null; coins: number; cash: number; pack?: number } | null;
  /** Hoeveel van de drie onderdelen je vandaag al deed. */
  gedaan: number;
  totaal: number;
  titel: string;
  uitleg: string;
  reeksLabel: string;
  prijsLabel: string;
  voortgangLabel: string;
  aansporing: string;
  aansporingVet: string;
}) {
  const doos = useRef<HTMLDivElement | null>(null);
  const [b, setB] = useState(0);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setB(el.clientWidth);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // De inhoud van het prijsvak voegt zich naar het vak. Meten met offsetWidth
  // en niet met getBoundingClientRect: offsetWidth geeft de opmaakbreedte en
  // telt de transform niet mee, dus de meting blijft dezelfde zodra de krimp
  // erop staat en er ontstaat geen kringetje van meten en opnieuw meten.
  const vakDoos = useRef<HTMLSpanElement | null>(null);
  const vakInhoud = useRef<HTMLSpanElement | null>(null);
  const [vakKrimp, setVakKrimp] = useState(1);
  useLayoutEffect(() => {
    const d = vakDoos.current, i = vakInhoud.current;
    if (!d || !i || !i.offsetWidth) return;
    const kist = d.querySelector("img");
    const vrij = d.clientWidth - (kist ? kist.offsetWidth : 0) - b * 0.054;
    setVakKrimp(Math.min(1, vrij / i.offsetWidth));
  }, [b, prijs?.coins, prijs?.pack, prijsLabel]);

  // Lettergroottes uit de kaphoogtes die in de mockup gemeten zijn.
  const reeksMaat = uitKap(0.0711, b);
  const reeksSub = uitKap(0.0261, b);
  const titelMaat = uitKap(0.0418, b);
  const uitlegMaat = Math.max(9.5, 0.0256 * b);
  // Het prijsvak vult de gemeten kaphoogte NIET: op de mockup komt die op een
  // echte telefoon uit rond de vier pixels, en dan is er van "te winnen" niets
  // meer te lezen. Deze twee zijn zo gekozen dat de kop en de bedragen samen de
  // hoogte van het vak vullen in plaats van er klein in te hangen.
  const prijsKop = 0.0300 * b;
  const prijsMaat = 0.0420 * b;
  const voortMaat = uitKap(0.0199, b);
  // De teller is bewust kleiner dan in de mockup: daar vult hij de halve strook
  // en dan schreeuwt "0 / 3" harder dan waar het over gaat.
  const tellerMaat = uitKap(0.0290, b);
  const aansMaat = Math.max(9, 0.0217 * b);

  return (
    <div ref={doos} style={{ position: "relative", width: "100%", aspectRatio: `${VERHOUDING}` }}>
      {/* De schaduw als tweede kopie van dezelfde art: een drop-shadow-filter
          rastert Safari apart en dan zie je de doos van de laag over de plaat. */}
      <img
        src="/ui/dag/kop.webp" alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: "brightness(0) blur(11px)", opacity: 0.55, transform: "translateY(8px)", pointerEvents: "none" }}
      />
      <img src="/ui/dag/kop.webp" alt="" aria-hidden draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

      {/* DE VLAM staat half over de bovenrand van de ring: hij hoort bij de
          reeks maar mag er niet in passen, anders leest hij als een plaatje in
          een gat in plaats van als iets dat brandt. */}
      <ArtIcoon
        naam="vlam"
        size={(0.1650 * b) / VERHOUDING}
        style={{ position: "absolute", left: pct(RING.x), top: pct(0.0960), transform: "translateX(-50%)", pointerEvents: "none" }}
      />

      {/* HET GETAL en het bijschrift, binnen de ring. Allebei op hun eigen
          gemeten hoogte, want als blok gecentreerd zouden ze meebewegen zodra
          het getal van een naar twee cijfers gaat. */}
      <OpMidden x={RING.x - RING.binnen / 2} y={0.3836} breedte={RING.binnen} uitlijnen="center">
        <span
          style={{
            fontFamily: font.wide, fontWeight: 700, fontSize: reeksMaat, lineHeight: 1,
            color: "#FFF3D0",
            textShadow: `0 0 ${reeksMaat * 0.3}px ${withAlpha(colors.gold, 0.7)}, 0 ${reeksMaat * 0.04}px ${reeksMaat * 0.09}px rgba(0,0,0,.8)`,
          }}
        >
          {reeks}
        </span>
      </OpMidden>
      <OpMidden x={RING.x - RING.binnen / 2} y={0.5150} breedte={RING.binnen} uitlijnen="center">
        <span
          style={{
            fontFamily: font.wide, fontWeight: 700, fontSize: reeksSub, lineHeight: 1,
            letterSpacing: reeksSub * 0.06, marginRight: -reeksSub * 0.06,
            textTransform: "uppercase", color: "#FFE9A8", whiteSpace: "nowrap",
            textShadow: "0 1px 2px rgba(0,0,0,.8)",
          }}
        >
          {reeksLabel}
        </span>
      </OpMidden>

      {/* DE KOP, links uitgelijnd op het prijsvak eronder. */}
      <OpMidden x={VAK.l} y={0.2006}>
        <span
          style={{
            fontFamily: font.wide, fontWeight: 700, fontSize: titelMaat, lineHeight: 1,
            letterSpacing: titelMaat * 0.035, marginRight: -titelMaat * 0.035,
            textTransform: "uppercase", color: "#FFF3D0", whiteSpace: "nowrap",
            textShadow: `0 0 ${titelMaat * 0.45}px ${withAlpha(colors.gold, 0.35)}, 0 2px 4px rgba(0,0,0,.75)`,
          }}
        >
          {titel}
        </span>
      </OpMidden>

      {/* DE UITLEG. De regelafbreking staat in de tekst zelf en niet in de
          breedte van dit vak: bij een vaste breedte breekt hij op elke taal en
          elke telefoon net ergens anders, en de mockup heeft twee regels. */}
      <OpMidden x={VAK.l} y={0.3206} breedte={0.9829 - VAK.l}>
        <span style={{ fontFamily: font.ui, fontSize: uitlegMaat, lineHeight: 1.35, color: "rgba(238,231,255,.92)", whiteSpace: "pre-line" }}>
          {uitleg}
        </span>
      </OpMidden>

      {/* HET PRIJSVAK. De omlijsting zit in de art; alleen de inhoud komt hier
          overheen, elk stuk op zijn eigen gemeten plek in plaats van in een rij
          naast elkaar: zo kan een lange prijs de kist niet wegduwen. */}
      <span
        ref={vakDoos}
        style={{
          position: "absolute",
          left: pct(VAK.l), width: pct(VAK.r - VAK.l),
          top: pct(VAK.t), height: pct(VAK.b - VAK.t),
          display: "flex", alignItems: "center", gap: b * 0.016,
          // Links wat lucht, want de kist stond tegen het randlijntje aan.
          padding: `0 ${b * 0.012}px 0 ${b * 0.026}px`,
          overflow: "hidden", pointerEvents: "none",
        }}
      >
        {prijs?.kist && (
          <img
            src={`/ui/${prijs.kist}.webp`} alt="" aria-hidden draggable={false}
            style={{ height: "84%", width: "auto", display: "block", flexShrink: 0 }}
          />
        )}
        {/* De kop en de bedragen als EEN blok, verticaal gecentreerd in het vak
            en met een krimp die aanslaat zodra het te breed wordt. Een vaste
            maat zou bij een prijs van vier cijfers over de rand lopen. */}
        <span
          ref={vakInhoud}
          style={{
            display: "flex", flexDirection: "column", justifyContent: "center",
            gap: b * 0.009, transform: `scale(${vakKrimp})`, transformOrigin: "left center",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              fontFamily: font.wide, fontWeight: 700, fontSize: prijsKop, lineHeight: 1,
              letterSpacing: prijsKop * 0.05, marginRight: -prijsKop * 0.05,
              textTransform: "uppercase", color: colors.gold,
            }}
          >
            {prijsLabel}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: b * 0.026 }}>
            <span style={{ display: "flex", alignItems: "center", gap: b * 0.008 }}>
              <ArtIcoon naam="munten" size={prijsMaat * 1.25} />
              <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: prijsMaat, lineHeight: 1, color: "#FFF3D0" }}>
                {prijs?.coins ?? 0}
              </span>
            </span>
            {!!prijs?.pack && (
              <span style={{ display: "flex", alignItems: "center", gap: b * 0.008 }}>
                <img src="/ui/dag/pack-rood.webp" alt="" aria-hidden draggable={false} style={{ height: prijsMaat * 1.25, width: "auto", display: "block" }} />
                <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: prijsMaat, lineHeight: 1, color: "#FFF3D0" }}>
                  {prijs.pack}
                </span>
              </span>
            )}
          </span>
        </span>
      </span>

      {/* DE STROOK ONDER HET PANEEL, als EEN rij: waar het over gaat, hoever je
          bent, en dat als balkjes. Naast elkaar en niet de teller boven de
          balkjes: op telefoonbreedte is de strook maar een centimeter hoog, en
          twee lagen tekst boven elkaar in die hoogte lezen als gedrang.

          Alles hangt aan het MIDDEN van de strook (y 0,906) en niet aan de plek
          waar het in de mockup stond: daar zat het tegen de bovenrail geplakt. */}
      <span
        style={{
          position: "absolute",
          left: pct(0.0420), width: pct(0.6000 - 0.0420),
          top: pct(STROOK), transform: "translateY(-50%)",
          display: "flex", alignItems: "center", gap: b * 0.022,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: font.wide, fontWeight: 700, fontSize: voortMaat, lineHeight: 1,
            letterSpacing: voortMaat * 0.06, marginRight: -voortMaat * 0.06,
            textTransform: "uppercase", color: "#EFE6FF", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {voortgangLabel}
        </span>
        <span style={{ display: "flex", alignItems: "baseline", gap: b * 0.008, flexShrink: 0 }}>
          <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: tellerMaat, lineHeight: 1, color: colors.gold }}>{gedaan}</span>
          <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: tellerMaat * 0.85, lineHeight: 1, color: "rgba(238,231,255,.55)" }}>/</span>
          <span style={{ fontFamily: font.wide, fontWeight: 700, fontSize: tellerMaat, lineHeight: 1, color: "#EFE6FF" }}>{totaal}</span>
        </span>
        {/* De balkjes: evenveel als er onderdelen zijn, en elk vol of leeg. Een
            doorlopende balk zou een half onderdeel kunnen tonen, en dat bestaat
            niet. */}
        {/* De hoogte in PIXELS en niet in procenten: deze rij is zo hoog als zijn
            tekst en een procentuele hoogte tegen een ouder die zelf meegroeit
            valt terug op nul, en dan zie je de balkjes niet meer. */}
        <span style={{ flex: 1, display: "flex", gap: b * 0.007, height: (BALK.hoog * b) / VERHOUDING }}>
          {Array.from({ length: Math.max(1, totaal) }, (_, i) => (
            <span
              key={i}
              style={{
                flex: 1, borderRadius: 999,
                background: i < gedaan
                  ? "linear-gradient(180deg, #FFE08A, #F2AC22 55%, #C97A0B)"
                  : "rgba(10,5,24,.5)",
                boxShadow: i < gedaan
                  ? `inset 0 1px 0 rgba(255,255,255,.55), 0 0 ${Math.max(2, b * 0.012)}px ${withAlpha(colors.gold, 0.65)}`
                  : `inset 0 0 0 1px ${withAlpha(colors.gold, 0.3)}`,
              }}
            />
          ))}
        </span>
      </span>

      {/* Het streepje tussen de balk en de aansporing: twee dingen naast elkaar
          in een strook lezen als een lijst zodra er niets tussen staat. */}
      <span
        aria-hidden
        style={{
          position: "absolute", left: pct(0.6270), top: pct(STROOK - 0.0700), height: pct(0.1400),
          width: Math.max(1, b * 0.0015),
          background: `linear-gradient(180deg, ${withAlpha(colors.gold, 0)}, ${withAlpha(colors.gold, 0.45)}, ${withAlpha(colors.gold, 0)})`,
          pointerEvents: "none",
        }}
      />

      <OpMidden x={0.6620} y={STROOK} breedte={0.9500 - 0.6620}>
        <span style={{ fontFamily: font.ui, fontSize: aansMaat, lineHeight: 1.3, color: "rgba(238,231,255,.86)" }}>
          {aansporing}{" "}
          <span style={{ color: colors.gold, fontWeight: 700 }}>{aansporingVet}</span>
        </span>
      </OpMidden>
    </div>
  );
}
