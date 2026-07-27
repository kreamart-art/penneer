// Het licht achter de pen. Geen buitengloed maar zes lagen, want één radiale
// gloed leest als een sticker en een gelaagde leest als licht.
//
// De volgorde van de kleuren staat vast en is wat het duur maakt: WIT in het
// hart, daaromheen GOUD, daaromheen KONINKLIJK PAARS, en dat dooft uit in
// DONKER INDIGO. Elke laag begint waar de vorige nog niet op is, zodat de
// overgangen niet te zien zijn.
//
// Alles is een percentage van `--em`, de maat van het embleem, dus het licht
// schaalt mee met de pen op elk scherm.
import type { CSSProperties } from "react";

const laag: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  borderRadius: "50%",
  pointerEvents: "none",
};

/** Een waaier stralen met ONGELIJKE dikte. Een `repeating-conic-gradient` geeft
 *  overal dezelfde breedte en dat leest als een zonnetje; hier heeft elke straal
 *  zijn eigen breedte en zachte flanken, dus ze overlappen als licht. */
function fan(steps: number[][], soft = 0.5): string {
  const total = steps.reduce((s, [w, g]) => s + w + g, 0);
  const k = 360 / total;
  const parts: string[] = [];
  let at = 0;
  for (const [w, g] of steps) {
    const a = at * k;
    const b = (at + w) * k;
    const mid = (a + b) / 2;
    const core = (b - a) * soft * 0.5;
    parts.push(
      `transparent ${a.toFixed(2)}deg`,
      `#000 ${(mid - core).toFixed(2)}deg`,
      `#000 ${(mid + core).toFixed(2)}deg`,
      `transparent ${b.toFixed(2)}deg`,
    );
    at += w + g;
  }
  return `conic-gradient(${parts.join(", ")})`;
}

// Drie waaiers over elkaar, elk met een eigen patroon, eigen dekking en een
// eigen draaisnelheid. Eén waaier geeft elke straal dezelfde sterkte, want ze
// delen dan één verflaag; met drie lagen krijg je stralen die van elkaar
// verschillen en die elkaar langzaam kruisen.
const BREED = fan([[7, 19], [3, 11], [11, 24], [5, 14], [2.5, 9], [9, 21], [4, 12], [6.5, 17], [3, 15], [10, 20], [3.5, 10], [7.5, 16]]);
const MIDDEL = fan([[2.4, 8], [1.3, 5], [3.6, 11], [1.8, 6], [1, 4], [2.8, 9], [1.5, 5], [2.2, 7], [1.1, 6], [3.2, 10], [1.4, 5], [2, 7], [1.2, 4], [2.6, 8], [1.6, 6]], 0.4);
const UIT = fan([[4, 62], [2.6, 78], [3.2, 70], [2, 84], [3.6, 54]], 0.45);
const SPIES = fan([[0.9, 4], [0.6, 3], [1.3, 5], [0.7, 3.5], [0.5, 2.5], [1.1, 4.5], [0.6, 3], [1, 4], [0.5, 3], [1.4, 5], [0.6, 3], [0.8, 3.5], [0.5, 2.5], [1.2, 4.5], [0.7, 3], [0.9, 4], [0.5, 3], [1.1, 4]], 0.3);

/** De verf van een straal. `reik` schaalt alle stops op, dus daarmee bepaal je
 *  hoe ver een laag komt: het masker geeft de vorm, de verf de lengte. */
function straal(sterk: number, reik: number): string {
  const st = (p: number) => (p * reik).toFixed(1) + "%";
  return `radial-gradient(circle closest-side, transparent 0%, rgba(255,198,40,${0.12 * sterk}) ${st(15)}, rgba(255,190,16,${0.58 * sterk}) ${st(24)}, rgba(255,158,18,${0.42 * sterk}) ${st(35)}, rgba(240,118,28,${0.24 * sterk}) ${st(47)}, rgba(186,82,146,${0.13 * sterk}) ${st(60)}, rgba(112,54,196,${0.055 * sterk}) ${st(74)}, transparent ${st(90)})`;
}

/** Dezelfde straal in de felle tint, voor de highlight-laag. */
function highlight(sterk: number, reik: number): string {
  const st = (p: number) => (p * reik).toFixed(1) + "%";
  return `radial-gradient(circle closest-side, transparent 0%, rgba(255,220,80,${0.22 * sterk}) ${st(16)}, rgba(255,206,24,${0.82 * sterk}) ${st(25)}, rgba(255,172,14,${0.56 * sterk}) ${st(36)}, rgba(255,132,26,${0.3 * sterk}) ${st(50)}, rgba(214,92,60,${0.12 * sterk}) ${st(64)}, transparent ${st(82)})`;
}

const HOLE =
  "radial-gradient(circle closest-side at 50% 50%, transparent 0%, transparent 10.6%, #000 12.6%, #000 100%)";

export function EmblemLight() {
  return (
    // Al het licht in één laag met een GAT erin, precies zo groot als de
    // binnenring van de munt. Daardoor houdt de gloed op bij die ring en zie je
    // binnen het logo gewoon de achtergrond.
    //
    // De munt vult iets meer dan de helft van zijn doos: het goud loopt van 40
    // tot 52 procent van de halve breedte, dus de binnenrand van de ring zit op
    // 0,20 keer de embleemmaat. Deze doos is 3,4 keer zo groot, dus het gat is
    // 0,20 / (0,5 x 3,4) = 11,8 procent van de straal.
    //
    // Het masker moet de hele doos van de kinderen dekken; daarom is deze laag
    // net iets ruimer dan de grootste waaier, en staat `mask-repeat` op geen,
    // anders tegelt het gat zich verder naar buiten als extra ringen.
    <div
      aria-hidden
      style={{
        ...laag,
        width: "calc(var(--em) * 3.4)",
        height: "calc(var(--em) * 3.4)",
        // Onder de munt maar boven de achtergrond van de zwevende laag.
        zIndex: -1,
        WebkitMaskImage: HOLE,
        maskImage: HOLE,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
    >
      {/* 3. Koninklijk paars. De grootste laag, dooft uit in donker indigo. */}
      <div
        aria-hidden
        style={{
          ...laag,
          width: "calc(var(--em) * 2.69)",
          height: "calc(var(--em) * 2.69)",
          background:
            "radial-gradient(circle closest-side, rgba(146,74,224,.34) 0%, rgba(128,62,210,.28) 16%, rgba(112,54,196,.22) 30%, rgba(98,46,176,.165) 42%, rgba(88,40,158,.12) 52%, rgba(72,32,136,.08) 62%, rgba(58,26,116,.05) 72%, rgba(42,20,90,.026) 81%, rgba(30,14,68,.012) 90%, transparent 98%)",
        }}
      />

      {/* 4. De stralen. Drie waaiers om het hart van de pen, van breed naar
             spiesdun, elk lichter dan de vorige en op zijn eigen tempo.
             De draaiing zit op een BINNENSTE laag: de draai-animatie schrijft
             transform, en dat wist de translate waarmee de laag gecentreerd
             staat. Vandaar de wikkel: die doet de plaatsing, de kern de draai. */}
      {[
        { masker: BREED, maat: 2.4, sterk: 1, reik: 0.6, sec: 120, terug: false, min: 0.82, adem: 9, wacht: 0 },
        { masker: MIDDEL, maat: 2.83, sterk: 0.62, reik: 0.72, sec: 190, terug: true, min: 0.88, adem: 13, wacht: 2.5 },
        { masker: SPIES, maat: 3.25, sterk: 0.4, reik: 0.5, sec: 260, terug: false, min: 0.8, adem: 7, wacht: 4 },
        { masker: UIT, maat: 3.25, sterk: 0.8, reik: 0.85, sec: 165, terug: true, min: 0.68, adem: 17, wacht: 1.2 },
      ].map((w, i) => (
        <div
          key={`fan${i}`}
          aria-hidden
          className="ray-breathe"
          style={{
            ...laag,
            width: `calc(var(--em) * ${w.maat})`,
            height: `calc(var(--em) * ${w.maat})`,
            ["--ray-min" as string]: w.min,
            animationDuration: `${w.adem}s`,
            animationDelay: `${w.wacht}s`,
          }}
        >
          <div
            className="hero-rays"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: straal(w.sterk, w.reik),
              WebkitMaskImage: w.masker,
              maskImage: w.masker,
              animationDuration: `${w.sec}s`,
              animationDirection: w.terug ? "reverse" : undefined,
            }}
          />
        </div>
      ))}

      {/* 4b. De highlights. Dezelfde waaiers nog een keer, maar in de felle tint
              van de reeks en alleen BOVEN het embleem: de wikkel draagt een
              masker dat naar onderen wegvalt, en de draaiing zit op de kern
              eronder. Dus de zone blijft staan en de stralen draaien erdoorheen,
              zoals licht dat door een fellere plek trekt. */}
      {[
        { masker: BREED, maat: 2.4, sterk: 1, reik: 0.6, sec: 120, terug: false, min: 0.82, adem: 9, wacht: 0 },
        { masker: UIT, maat: 3.25, sterk: 0.75, reik: 0.85, sec: 165, terug: true, min: 0.68, adem: 17, wacht: 1.2 },
      ].map((w, i) => (
        <div
          key={`hi${i}`}
          aria-hidden
          className="ray-breathe"
          style={{
            ...laag,
            width: `calc(var(--em) * ${w.maat})`,
            height: `calc(var(--em) * ${w.maat})`,
            ["--ray-min" as string]: w.min,
            animationDuration: `${w.adem}s`,
            animationDelay: `${w.wacht}s`,
            WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 20%, rgba(0,0,0,.55) 40%, rgba(0,0,0,.18) 58%, transparent 76%)",
            maskImage: "linear-gradient(180deg, #000 0%, #000 20%, rgba(0,0,0,.55) 40%, rgba(0,0,0,.18) 58%, transparent 76%)",
          }}
        >
          <div
            className="hero-rays"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: highlight(w.sterk, w.reik),
              WebkitMaskImage: w.masker,
              maskImage: w.masker,
              animationDuration: `${w.sec}s`,
              animationDirection: w.terug ? "reverse" : undefined,
            }}
          />
        </div>
      ))}

      {/* 4c. Het puntje. Boven de punt van de pen staat een klein wit vlekje dat
              alleen oplicht als er net een straal langskomt, en weer weg is
              zodra die voorbij is.
              Drie lagen in elkaar: de buitenste draait, de middelste draagt het
              waaiermasker en draait dus mee, en de binnenste draait even hard
              terug zodat het vlekje blijft staan waar het staat. Wat je ziet is
              dus de straal die over een vast punt schuift. */}
      {[
        { masker: BREED, maat: 2.4, sec: 120, terug: false, min: 0.82, adem: 9, wacht: 0 },
        { masker: UIT, maat: 3.25, sec: 165, terug: true, min: 0.68, adem: 17, wacht: 1.2 },
      ].map((w, i) => (
        <div
          key={`tip${i}`}
          aria-hidden
          className="ray-breathe"
          style={{
            ...laag,
            width: `calc(var(--em) * ${w.maat})`,
            height: `calc(var(--em) * ${w.maat})`,
            ["--ray-min" as string]: w.min,
            animationDuration: `${w.adem}s`,
            animationDelay: `${w.wacht}s`,
          }}
        >
          <div
            className="hero-rays"
            style={{
              width: "100%",
              height: "100%",
              animationDuration: `${w.sec}s`,
              animationDirection: w.terug ? "reverse" : undefined,
            }}
          >
            <div style={{ width: "100%", height: "100%", WebkitMaskImage: w.masker, maskImage: w.masker }}>
              <div
                className="hero-rays"
                style={{
                  width: "100%",
                  height: "100%",
                  animationDuration: `${w.sec}s`,
                  animationDirection: w.terug ? undefined : "reverse",
                  background:
                    "radial-gradient(4.6% 4.6% at 50% 36%, rgba(255,255,255,.95) 0%, rgba(255,248,220,.66) 26%, rgba(255,210,80,.28) 52%, transparent 78%)",
                }}
              />
            </div>
          </div>
        </div>
      ))}

      {/* 2. Gesmeed goud. Amber en oranje, niet geel: het geel gaat eruit door de
             rode kant hoger te houden dan de groene. */}
      <div
        aria-hidden
        style={{
          ...laag,
          width: "calc(var(--em) * 1.63)",
          height: "calc(var(--em) * 1.63)",
          background:
            "radial-gradient(circle closest-side, rgba(255,206,24,.4) 0%, rgba(255,190,16,.32) 12%, rgba(252,168,14,.24) 24%, rgba(240,140,16,.17) 36%, rgba(214,116,18,.11) 47%, rgba(180,92,20,.068) 58%, rgba(140,68,20,.037) 69%, rgba(100,48,16,.017) 80%, rgba(74,46,4,.007) 89%, transparent 97%)",
        }}
      />

      {/* 1. De kern. Klein, wit met een warme zweem, het felste punt. */}
      <div
        aria-hidden
        className="breath-glow"
        style={{
          ...laag,
          width: "calc(var(--em) * 0.88)",
          height: "calc(var(--em) * 0.88)",
          background:
            "radial-gradient(circle closest-side, rgba(255,251,236,.9) 0%, rgba(255,232,128,.76) 9%, rgba(255,212,32,.58) 20%, rgba(255,196,16,.4) 32%, rgba(255,168,14,.24) 44%, rgba(238,128,18,.13) 56%, rgba(196,96,16,.06) 68%, rgba(150,70,12,.022) 81%, transparent 95%)",
          animationDuration: "5.5s",
        }}
      />

      {/* 6. Vonken. Verschillende maten en helderheden, een paar als gloeiende
             sintel met een eigen halo. */}
      {[
        { x: 18, y: 30, s: 2.6, o: 0.85, d: 0 },
        { x: 78, y: 22, s: 1.6, o: 0.6, d: 1.7 },
        { x: 88, y: 62, s: 2.1, o: 0.7, d: 3.1 },
        { x: 10, y: 68, s: 1.4, o: 0.5, d: 4.6 },
        { x: 62, y: 86, s: 2.9, o: 0.8, d: 2.3 },
        { x: 34, y: 90, s: 1.2, o: 0.45, d: 5.4 },
        { x: 50, y: 8, s: 1.8, o: 0.65, d: 3.8 },
      ].map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="hero-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            background: "#FFE9B4",
            opacity: p.o,
            boxShadow: `0 0 ${p.s * 3.2}px rgba(255,190,86,.9)`,
            animationDelay: `${p.d}s`,
            animationDuration: `${7 + i}s`,
          }}
        />
      ))}
    </div>
  );
}
