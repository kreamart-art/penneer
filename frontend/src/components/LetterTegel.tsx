// Ontdekken — één lettertegel uit het raster van de categoriepagina.
//
// Dit is het hart van de modus: 26 tegels waarvan je in één oogopslag ziet hoe
// ver je bent. Drie toestanden, en ze moeten ook zonder de tekst uit elkaar te
// houden zijn, want je scant dit raster en leest het niet.
//
//   leeg      alleen de letter, gedempt, geen vulling
//   deels     vulling van ONDEREN tot het percentage, violet
//   compleet  gouden rand met gloed, en de letter in het goud
//
// Van onderaf vullen en niet van links, omdat een verticale vulling als een
// peilglas leest: hoe voller hoe hoger. Horizontaal zou het een voortgangsbalk
// zijn en die staat al boven de pagina.
import { colors, font, withAlpha } from "../theme/tokens";

/** De tegel is art: een staand paars vlak met afgeschuinde hoeken. */
const TEGEL_ART = "/ontdek/letter-tegel.webp";
const TEGEL_RATIO = 320 / 383;

/** De vulling en het goud worden op de VORM van de tegel geknipt. Een masker en
 *  geen `overflow: hidden`, want dat knipt op de rechthoek van de doos en dan
 *  loopt het peil dwars over de afgeschuinde hoeken. */
const OP_DE_VORM = {
  WebkitMaskImage: `url(${TEGEL_ART})`,
  maskImage: `url(${TEGEL_ART})`,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
} as const;

interface Props {
  letter: string;
  total: number;
  discovered: number;
  onClick: () => void;
  /** Positie in het raster, alleen voor de opkomst-animatie. */
  index?: number;
}

export function LetterTegel({ letter, total, discovered, onClick, index = 0 }: Props) {
  const leeg = total === 0;
  const compleet = total > 0 && discovered >= total;
  const pct = total > 0 ? Math.round((discovered / total) * 100) : 0;
  // Een aangeraakte tegel moet zichtbaar aangeraakt zijn. Onder de vier procent
  // is de vulling een streepje dat je aanziet voor een rand, dus daar tillen we
  // hem naar een minimum: "je bent begonnen" is de boodschap, niet het getal.
  const vulling = discovered > 0 ? Math.max(pct, 6) : 0;

  return (
    <button
      onClick={onClick}
      disabled={leeg}
      aria-label={`${letter}, ${discovered} van ${total}`}
      className={leeg ? undefined : "pressable ontdek-tegel"}
      style={{
        position: "relative",
        // De verhouding van de ART en niet vierkant: de tegel is een staand
        // vlak met afgeschuinde hoeken, en die vorm uitrekken naar een vierkant
        // maakt de hoeken ongelijk.
        aspectRatio: `${TEGEL_RATIO}`,
        width: "100%",
        display: "grid",
        placeItems: "center",
        cursor: leeg ? "default" : "pointer",
        background: "transparent",
        border: "none",
        // De gloed hoort om de VORM en niet om een rechthoek, dus hij ligt als
        // vervaagde kopie van de art achter de tegel (zie hieronder) in plaats
        // van als box-shadow.
        opacity: leeg ? 0.35 : 1,
        // Trapsgewijs opkomen, maar alleen als de speler beweging wil. De
        // animatie zelf staat in index.css achter een reduced-motion-query.
        animationDelay: `${Math.min(index, 25) * 18}ms`,
        padding: 0,
      }}
    >
      {/* DE PLAAT. Compleet krijgt hem in goud getint; dat is een filter op
          dezelfde art en geen tweede bestand, want het is dezelfde vorm. */}
      <img
        src={TEGEL_ART} alt="" aria-hidden draggable={false}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", display: "block",
          filter: compleet ? "hue-rotate(-58deg) saturate(1.5) brightness(1.22)" : undefined,
          pointerEvents: "none",
        }}
      />

      {/* De vulling. Achter de letter, zodat de letter altijd leesbaar blijft.
          Geknipt op de VORM van de tegel: zonder dat loopt het peil over de
          afgeschuinde hoeken heen. */}
      {vulling > 0 && !compleet && (
        <span
          aria-hidden
          style={{
            ...OP_DE_VORM,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${vulling}%`,
            maskPosition: `bottom`,
            WebkitMaskPosition: `bottom`,
            maskSize: `100% ${(100 / Math.max(vulling, 1)) * 100}%`,
            WebkitMaskSize: `100% ${(100 / Math.max(vulling, 1)) * 100}%`,
            background: `linear-gradient(180deg, ${withAlpha(colors.violet, 0.55)}, ${withAlpha(
              colors.violetDeep,
              0.75,
            )})`,
            // De bovenrand van het peil krijgt een lichtstreep, anders leest de
            // vulling als een blok in plaats van als een niveau.
            borderTop: `1.5px solid ${withAlpha(colors.violet, 0.9)}`,
          }}
        />
      )}
      {/* DE LETTER EN HET CIJFER ALS EEN BLOK, samen gecentreerd. Ze stonden
          los: de letter in het hart van de tegel en het cijfer absoluut tegen
          de onderrand. Dan is de letter wel gecentreerd maar het PAAR niet, en
          leest de tegel als een letter met een voetnoot eronder. */}
      <span
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          // Een tikje omhoog: de art heeft onderaan een dikkere lip dan
          // bovenaan, dus het midden van de DOOS ligt lager dan het midden van
          // het vlak waar je naar kijkt.
          transform: "translateY(-4%)",
        }}
      >
        <span
          style={{
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 20,
            lineHeight: 1,
            // Compleet is goud, bezig is vol wit, leeg is gedempt. Alle drie
            // ruim boven AA op de achtergrond waar ze op liggen.
            color: compleet ? colors.gold : discovered > 0 ? colors.ink : colors.faint,
            textShadow: compleet ? `0 0 10px ${withAlpha(colors.gold, 0.6)}` : "none",
          }}
        >
          {letter}
        </span>
        {/* Het cijfer eronder, klein. Alleen als er iets te melden is: op een
            lege tegel is "0/0" ruis. */}
        {!leeg && (
          <span
            style={{
              fontFamily: font.ui,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".02em",
              lineHeight: 1,
              color: compleet ? withAlpha(colors.gold, 0.95) : colors.sub,
            }}
          >
            {discovered}/{total}
          </span>
        )}
      </span>
    </button>
  );
}
