// De tv: de plaat waar een letter of een roomcode op staat.
//
// EEN apparaat voor allebei, want dat is het ook: in de lobby staat de roomcode
// erop, in een ronde de letter waar je woorden bij zoekt, en in Oefenen de
// letter van vandaag. Overal hetzelfde ding betekent dat een speler het na een
// keer herkent, en dat de art maar een keer over de lijn hoeft.
//
// DE LETTERS ZIJN ART, geen lettertype: /letters/<X>.webp. Daar hangt de
// schaduw aan die in deze app op elke gouden letter zit: dezelfde vorm nog een
// keer, vol zwart, vervaagd en een paar pixel omlaag. Een `text-shadow` kan dat
// niet (die kent alleen tekst) en een `drop-shadow` breekt op iOS: Safari
// rastert die laag apart en dan zie je de rechthoek van de laag over de art.
//
// DE MATEN ZIJN OPGEMETEN OP DE ART en staan als delen van de plaat, zodat de
// inhoud meeschaalt met welke breedte de plaat ook krijgt. Het scherm is de
// donkere binnenkant; gevonden door kandidaat-omtrekken op de art te tekenen en
// te kijken welke precies op de neonlijn viel:
//
//   links 0,082   rechts 0,916   boven 0,104   onder 0,834
import { useEffect, useRef, useState } from "react";
import { colors, font } from "../theme/tokens";

/** Breedte gedeeld door hoogte van de plaat (1200x764, uit de bron gesneden). */
const VERHOUDING = 1200 / 764;

/** Het donkere vlak binnen de lijst, als delen van de plaat. */
const SCHERM = { l: 0.082, r: 0.916, t: 0.104, b: 0.834 };

/** Hoe zwaar de schaduw onder een letter is, als deel van de lettermaat.
 *
 *  Overgenomen van de sectie in Oefenen: daar is het vierkant van de letter
 *  26,4% van de sectiebreedte, wat op een telefoon rond de 95px uitkomt, en
 *  ligt er een schaduw van 4px onder met 4px verschuiving. Als VERHOUDING en
 *  niet als vast getal, want op de tv is de letter twee keer zo groot en dan
 *  zou 4px verschrompelen tot een streepje. */
const SCHADUW = 4 / 95;

/** De gloed om de letters: kleur, hoe ver hij reikt (deel van de lettermaat) en
 *  hoe hard hij staat.
 *
 *  DE KLEUR IS UIT DE ART GEHAALD en niet gekozen: het gemiddelde goudgeel van
 *  de onderste vijfde van de inkt, over alle 26 letters, is rgb(189,127,31).
 *  Dat is de tint die de gebruiker aanwees.
 *
 *  KLEIN EN ZACHT. Een gloed die ver reikt maakt van vier letters een lichtvlek
 *  en dan lees je de code niet meer; dit is net genoeg dat het goud van het
 *  donkere scherm loskomt. */
const GLOED = { kleur: "#BD7F1F", reik: 7 / 95, sterkte: 0.5 };

/** Hoe breed de INKT van elke letter is binnen zijn vierkante vel, opgemeten op
 *  de art in /letters. Die vellen hebben heel ongelijke marges: een I heeft aan
 *  elke kant 37% lucht en een W maar 4%. Zet je die vierkanten naast elkaar,
 *  dan staat een code met een smalle letter erin ver uit elkaar en een met
 *  brede letters juist tegen elkaar aan.
 *
 *  Elke letter krijgt daarom een vak zo breed als zijn eigen inkt; de art zelf
 *  blijft vierkant en steekt links en rechts buiten dat vak uit. Dan is de
 *  ruimte tussen twee letters echte ruimte en niet toevallig lege art. */
const INKT: Record<string, number> = {
  A: 0.641, B: 0.523, C: 0.547, D: 0.590, E: 0.504, F: 0.480, G: 0.578,
  H: 0.629, I: 0.262, J: 0.402, K: 0.602, L: 0.480, M: 0.707, N: 0.566,
  O: 0.613, P: 0.512, Q: 0.664, R: 0.590, S: 0.449, T: 0.516, U: 0.590,
  V: 0.664, W: 0.918, X: 0.629, Y: 0.613, Z: 0.496,
};

/** De lucht tussen twee letters, als deel van de LETTERHOOGTE.
 *
 *  Klein, want de code hoort als EEN woord te lezen en niet als vier losse
 *  tegels. Omdat elk vak precies zo breed is als zijn eigen inkt, is dit ook
 *  echt de ruimte die je ziet; met vierkante vellen zat er per letter nog een
 *  verschillende hoeveelheid lege art bij en stond een I mijlenver van zijn
 *  buren. */
const KIER = 0.06;

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

/** Een letter als art met zijn schaduw eronder.
 *
 *  Meet zijn eigen vak, want de schaduw hoort met de letter mee te groeien en
 *  CSS kan niet rekenen met de hoogte van het element zelf. */
function Letter({ teken }: { teken: string }) {
  const doos = useRef<HTMLSpanElement | null>(null);
  const [maat, setMaat] = useState(0);
  useEffect(() => {
    const el = doos.current;
    if (!el) return;
    const meet = () => setMaat(el.clientHeight);
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const src = `/letters/${teken}.webp`;
  const zacht = Math.max(1.5, maat * SCHADUW);
  // Het VAK is zo breed als de inkt; de vierkante art ligt eroverheen en steekt
  // links en rechts een stuk uit. `overflow` blijft dus zichtbaar, anders knipt
  // het vak de letter door de helft.
  const inkt = INKT[teken] ?? 0.6;
  return (
    <span
      ref={doos}
      style={{
        position: "relative", height: "100%", display: "block", flexShrink: 0,
        width: maat > 0 ? maat * inkt : undefined,
        // De kier staat HIER en niet als `gap` op de rij: de rij weet niet hoe
        // groot een letter is en een `gap` in procenten rekent tegen de breedte
        // van de rij, die zichzelf naar zijn inhoud voegt. Half aan elke kant,
        // dan is het tussen twee letters een hele.
        marginInline: maat > 0 ? (maat * KIER) / 2 : undefined,
      }}
    >
      {maat > 0 && (
        <span style={{ position: "absolute", top: 0, left: "50%", width: maat, height: maat, transform: "translateX(-50%)", display: "block" }}>
          <img
            src={src} alt="" aria-hidden draggable={false}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "contain", display: "block",
              filter: `brightness(0) blur(${zacht}px)`,
              transform: `translateY(${zacht}px)`, pointerEvents: "none",
            }}
          />
          {/* DE GLOED ALS GEMASKEERD VLAK en niet als tweede plaatje: een kopie
              van de art zou zijn eigen verloop meebrengen (donkere randen,
              lichte kern) en dat vervaagt tot een vlek in twee kleuren. Hier is
              het een egaal goudgeel vlak dat door de vorm van de letter wordt
              geknipt, en dat vervaagt tot precies die ene tint.
              Boven de schaduw, want licht valt over een schaduw heen. */}
          <span
            aria-hidden
            style={{
              position: "absolute", inset: 0, display: "block", pointerEvents: "none",
              background: GLOED.kleur, opacity: GLOED.sterkte,
              filter: `blur(${Math.max(1, maat * GLOED.reik)}px)`,
              WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
              WebkitMaskSize: "contain", maskSize: "contain",
              WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
              WebkitMaskPosition: "center", maskPosition: "center",
            }}
          />
          <img
            src={src} alt={teken} draggable={false}
            style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        </span>
      )}
    </span>
  );
}

export function Tv({
  letter,
  code,
  label,
  onClick,
  knopLabel,
  naast,
  onder,
  style,
}: {
  /** Een enkele letter, voor een ronde of voor Oefenen. */
  letter?: string;
  /** Of een roomcode. Een van de twee, niet allebei. */
  code?: string;
  /** Een klein opschrift bovenin het scherm ("ROOMCODE", "DE LETTER IS"). */
  label?: string;
  /** Is de tv aantikbaar (de roomcode delen), dan wordt hij een knop. */
  onClick?: () => void;
  knopLabel?: string;
  /** Een teken NAAST de letters, zoals het deel-teken bij de roomcode.
   *
   *  Hij hangt buiten de rij: absoluut vanaf de rechterkant ervan, dus hij kost
   *  geen breedte. In de rij zelf zou hij de code uit het midden van het scherm
   *  duwen, en daar staat hij precies goed. */
  naast?: React.ReactNode;
  /** Een regeltje ONDER de letters, binnen het scherm. Kort houden: het scherm
   *  is niet breed en een zin die afbreekt duwt de code uit het midden. */
  onder?: string;
  style?: React.CSSProperties;
}) {
  const tekens = (code ?? letter ?? "").toUpperCase().split("").filter((c) => c >= "A" && c <= "Z");
  const n = Math.max(1, tekens.length);

  // Hoe hoog een letter mag zijn, in delen van de SCHERMHOOGTE.
  //
  // Twee grenzen, en de kleinste wint. De BREEDTE-grens rekent met de echte
  // inkt van deze letters bij elkaar opgeteld, niet met vierkante vellen: de
  // vakken zijn immers zo breed als de inkt. "WWWW" is daardoor vanzelf kleiner
  // dan "IIII", precies zoals een woord dat zou zijn.
  const schermB = SCHERM.r - SCHERM.l;                  // in plaatbreedtes
  const schermH = SCHERM.b - SCHERM.t;                  // in plaathoogtes
  // De schermbreedte uitgedrukt in SCHERMHOOGTES, zodat beide grenzen dezelfde
  // eenheid hebben.
  const breedInHoog = (schermB * VERHOUDING) / schermH;
  // DE MAAT REKENT MET VIERKANTE VELLEN, ook al staan de letters in vakken zo
  // breed als hun inkt. Dat lijkt omslachtig, maar het is met opzet: het gaf de
  // maat die goed was, en nu de vakken smaller zijn zou dezelfde som met de
  // echte inkt de letters bijna twee keer zo groot maken. De inkt bepaalt hoe
  // ze STAAN, dit bepaalt hoe GROOT ze zijn.
  //
  // Een enkele letter mag groter dan een code: die heeft het scherm alleen.
  // Staat er een opschrift boven, dan moet dat er ook nog bij; op een telefoon
  // is het scherm zo'n 168px hoog en het opschrift kost er met marge zo'n 15.
  const naarBreedte = (breedInHoog - 0.02 * (n - 1)) / n;
  const hoog = Math.min(n === 1 ? (label ? 0.74 : 0.84) : 0.58, naarBreedte * 0.90);

  const plaat = (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${VERHOUDING}`, ...style }}>
      <img
        src="/ui/tv.webp" alt="" aria-hidden draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />
      <span
        style={{
          position: "absolute",
          left: pct(SCHERM.l), width: pct(schermB),
          top: pct(SCHERM.t), height: pct(schermH),
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {!!label && (
          <span
            style={{
              fontFamily: font.ui, fontSize: "clamp(8.5px, 2.7vw, 12px)", fontWeight: 600,
              letterSpacing: 1.4, marginRight: -1.4, textTransform: "uppercase",
              color: colors.faint, marginBottom: "2.5%",
            }}
          >
            {label}
          </span>
        )}
        <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: pct(hoog), flexShrink: 0 }}>
          {tekens.map((c, i) => (
            <Letter key={`${c}${i}`} teken={c} />
          ))}
          {!!naast && (
            <span style={{ position: "absolute", left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 8, display: "flex" }}>
              {naast}
            </span>
          )}
          {!!onder && (
            // Vanaf de ONDERKANT VAN DE LETTERS en niet vanaf de onderrand van
            // het scherm: zo blijft hij tegen de code aan staan, wat de letters
            // ook voor maat krijgen. En absoluut, want in de kolom zou hij
            // meetellen voor het midden en de code omhoog duwen.
            <span
              style={{
                // Niet op 100%: in de letter-art zit onder de glyph nog een
                // vijfde lucht binnen het vierkant (de inkt houdt op bij 79%),
                // dus op 100% hangt de regel onder die lucht en niet onder de
                // code. Op 82% raakte hij de letters juist aan; hier zit er een
                // regel tussen. Een percentage in `top` rekent tegen de HOOGTE
                // van de rij, dus dit klopt bij elke maat.
                position: "absolute", top: "92%", left: "50%", transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                fontFamily: font.ui, fontSize: "clamp(9px, 2.9vw, 12.5px)", lineHeight: 1.3,
                color: colors.sub,
              }}
            >
              {onder}
            </span>
          )}
        </span>
      </span>
    </div>
  );

  if (!onClick) return plaat;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={knopLabel}
      className="pressable"
      style={{ display: "block", width: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
    >
      {plaat}
    </button>
  );
}
