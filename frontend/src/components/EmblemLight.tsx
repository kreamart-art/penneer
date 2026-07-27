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
const SPIES = fan([[0.9, 4], [0.6, 3], [1.3, 5], [0.7, 3.5], [0.5, 2.5], [1.1, 4.5], [0.6, 3], [1, 4], [0.5, 3], [1.4, 5], [0.6, 3], [0.8, 3.5], [0.5, 2.5], [1.2, 4.5], [0.7, 3], [0.9, 4], [0.5, 3], [1.1, 4]], 0.3);

export function EmblemLight() {
  return (
    <>
      {/* 3. Koninklijk paars. De grootste laag, dooft uit in donker indigo. */}
      <div
        aria-hidden
        style={{
          ...laag,
          width: "calc(var(--em) * 1.9)",
          height: "calc(var(--em) * 1.9)",
          background:
            "radial-gradient(circle, rgba(146,74,224,.34) 0%, rgba(128,62,210,.28) 16%, rgba(112,54,196,.22) 30%, rgba(98,46,176,.165) 42%, rgba(88,40,158,.12) 52%, rgba(72,32,136,.08) 62%, rgba(58,26,116,.05) 72%, rgba(42,20,90,.026) 81%, rgba(30,14,68,.012) 90%, transparent 98%)",
        }}
      />

      {/* 4. De stralen. Drie waaiers om het hart van de pen, van breed naar
             spiesdun, elk lichter dan de vorige en op zijn eigen tempo.
             De draaiing zit op een BINNENSTE laag: de draai-animatie schrijft
             transform, en dat wist de translate waarmee de laag gecentreerd
             staat. Vandaar de wikkel: die doet de plaatsing, de kern de draai. */}
      {[
        { masker: BREED, maat: 1.7, sterk: 1, sec: 120, terug: false },
        { masker: MIDDEL, maat: 2.0, sterk: 0.62, sec: 190, terug: true },
        { masker: SPIES, maat: 2.3, sterk: 0.4, sec: 260, terug: false },
      ].map((w, i) => (
        <div
          key={`fan${i}`}
          aria-hidden
          style={{ ...laag, width: `calc(var(--em) * ${w.maat})`, height: `calc(var(--em) * ${w.maat})` }}
        >
          <div
            className="hero-rays"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(255,235,184,${0.6 * w.sterk}) 0%, rgba(255,194,61,${0.44 * w.sterk}) 16%, rgba(226,158,36,${0.28 * w.sterk}) 30%, rgba(176,124,23,${0.18 * w.sterk}) 42%, rgba(140,84,120,${0.12 * w.sterk}) 54%, rgba(112,54,196,${0.065 * w.sterk}) 66%, rgba(70,32,140,${0.025 * w.sterk}) 78%, transparent 92%)`,
              WebkitMaskImage: w.masker,
              maskImage: w.masker,
              animationDuration: `${w.sec}s`,
              animationDirection: w.terug ? "reverse" : undefined,
            }}
          />
        </div>
      ))}

      {/* 2. Gesmeed goud. Amber en oranje, niet geel: het geel gaat eruit door de
             rode kant hoger te houden dan de groene. */}
      <div
        aria-hidden
        style={{
          ...laag,
          width: "calc(var(--em) * 1.15)",
          height: "calc(var(--em) * 1.15)",
          background:
            "radial-gradient(circle, rgba(255,194,61,.34) 0%, rgba(246,178,48,.27) 12%, rgba(226,158,36,.2) 24%, rgba(200,138,28,.14) 36%, rgba(176,124,23,.093) 47%, rgba(146,100,18,.058) 58%, rgba(112,74,12,.032) 69%, rgba(82,52,8,.015) 80%, rgba(74,46,4,.006) 89%, transparent 97%)",
        }}
      />

      {/* 1. De kern. Klein, wit met een warme zweem, het felste punt. */}
      <div
        aria-hidden
        className="breath-glow"
        style={{
          ...laag,
          width: "calc(var(--em) * 0.62)",
          height: "calc(var(--em) * 0.62)",
          background:
            "radial-gradient(circle, rgba(255,235,184,.88) 0%, rgba(255,222,140,.7) 10%, rgba(255,194,61,.52) 22%, rgba(255,194,61,.33) 34%, rgba(232,163,32,.19) 46%, rgba(190,132,24,.1) 58%, rgba(150,104,18,.048) 70%, rgba(110,74,12,.018) 82%, transparent 96%)",
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
    </>
  );
}
