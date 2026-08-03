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

  const randKleur = compleet
    ? colors.gold
    : discovered > 0
    ? withAlpha(colors.violet, 0.55)
    : colors.hairline;

  return (
    <button
      onClick={onClick}
      disabled={leeg}
      aria-label={`${letter}, ${discovered} van ${total}`}
      className={leeg ? undefined : "pressable ontdek-tegel"}
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        width: "100%",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        borderRadius: 14,
        cursor: leeg ? "default" : "pointer",
        background: "rgba(255,255,255,.04)",
        border: `1.5px solid ${randKleur}`,
        boxShadow: compleet
          ? `0 0 14px ${withAlpha(colors.gold, 0.45)}, inset 0 0 12px ${withAlpha(colors.gold, 0.18)}`
          : "none",
        opacity: leeg ? 0.35 : 1,
        // Trapsgewijs opkomen, maar alleen als de speler beweging wil. De
        // animatie zelf staat in index.css achter een reduced-motion-query.
        animationDelay: `${Math.min(index, 25) * 18}ms`,
        padding: 0,
      }}
    >
      {/* De vulling. Achter de letter, zodat de letter altijd leesbaar blijft. */}
      {vulling > 0 && !compleet && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${vulling}%`,
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
      {compleet && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(colors.gold, 0.1)}, ${withAlpha(
              colors.gold,
              0.28,
            )})`,
          }}
        />
      )}
      <span
        style={{
          position: "relative",
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
      {/* Het cijfer eronder, klein. Alleen als er iets te melden is: op een lege
          tegel is "0/0" ruis. */}
      {!leeg && (
        <span
          style={{
            position: "absolute",
            bottom: 4,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: font.ui,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: ".02em",
            color: compleet ? withAlpha(colors.gold, 0.95) : colors.sub,
          }}
        >
          {discovered}/{total}
        </span>
      )}
    </button>
  );
}
