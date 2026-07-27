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

// Brede bundels en fijne spiesen, twee waaiers die tegen elkaar in draaien.
const BREED = fan([[7, 19], [3, 11], [11, 24], [5, 14], [2.5, 9], [9, 21], [4, 12], [6.5, 17], [3, 15], [10, 20], [3.5, 10], [7.5, 16]]);
const FIJN = fan([[1.6, 7], [1, 5], [2.4, 9], [1.2, 6], [0.8, 4], [2, 8], [1.1, 5], [1.8, 7], [0.9, 6], [2.2, 8], [1, 5], [1.5, 6], [0.8, 4], [2.6, 9]], 0.35);

export function EmblemLight() {
  return (
    <>
      {/* 5. Magische rook. Drie verschoven wolken in plaats van een cirkel, want
             nevel heeft geen rand. Het traagst van alles. */}
      <div
        aria-hidden
        className="breath-glow"
        style={{
          ...laag,
          width: "calc(var(--em) * 3.4)",
          height: "calc(var(--em) * 2.6)",
          borderRadius: "50%",
          background: [
            "radial-gradient(52% 44% at 34% 40%, rgba(78,40,150,.16), transparent 72%)",
            "radial-gradient(46% 52% at 68% 58%, rgba(52,26,110,.15), transparent 74%)",
            "radial-gradient(64% 40% at 52% 30%, rgba(96,48,168,.11), transparent 76%)",
          ].join(", "),
          animationDuration: "13s",
        }}
      />

      {/* 3. Koninklijk paars. De grootste laag, dooft uit in donker indigo. */}
      <div
        aria-hidden
        style={{
          ...laag,
          width: "calc(var(--em) * 2.7)",
          height: "calc(var(--em) * 2.7)",
          background:
            "radial-gradient(circle, rgba(146,74,224,.34) 0%, rgba(128,62,210,.28) 16%, rgba(112,54,196,.22) 30%, rgba(98,46,176,.165) 42%, rgba(88,40,158,.12) 52%, rgba(72,32,136,.08) 62%, rgba(58,26,116,.05) 72%, rgba(42,20,90,.026) 81%, rgba(30,14,68,.012) 90%, transparent 98%)",
        }}
      />

      {/* 4. De stralen. Goud bij de kern, paars naar buiten: de conic is het
             masker, het radiale verloop is de verf, want een conic kan zijn
             kleur niet met de straal laten meelopen. */}
      <div
        aria-hidden
        className="hero-rays"
        style={{
          ...laag,
          width: "calc(var(--em) * 2.9)",
          height: "calc(var(--em) * 2.9)",
          background:
            "radial-gradient(circle, rgba(255,238,190,.62) 0%, rgba(255,186,74,.44) 18%, rgba(226,132,80,.26) 32%, rgba(158,84,200,.19) 46%, rgba(112,54,196,.11) 60%, rgba(70,32,140,.045) 74%, transparent 90%)",
          WebkitMaskImage: BREED,
          maskImage: BREED,
          animationDuration: "120s",
        }}
      />
      <div
        aria-hidden
        className="hero-rays"
        style={{
          ...laag,
          width: "calc(var(--em) * 2.4)",
          height: "calc(var(--em) * 2.4)",
          background:
            "radial-gradient(circle, rgba(255,246,214,.55) 0%, rgba(255,198,96,.36) 20%, rgba(198,110,168,.18) 40%, rgba(120,58,200,.08) 58%, transparent 82%)",
          WebkitMaskImage: FIJN,
          maskImage: FIJN,
          animationDuration: "170s",
          animationDirection: "reverse",
        }}
      />

      {/* 2. Gesmeed goud. Amber en oranje, niet geel: het geel gaat eruit door de
             rode kant hoger te houden dan de groene. */}
      <div
        aria-hidden
        style={{
          ...laag,
          width: "calc(var(--em) * 2.0)",
          height: "calc(var(--em) * 2.0)",
          background:
            "radial-gradient(circle, rgba(255,214,140,.46) 0%, rgba(255,196,104,.36) 14%, rgba(255,176,66,.27) 26%, rgba(246,150,52,.19) 38%, rgba(238,132,42,.13) 48%, rgba(216,110,48,.085) 58%, rgba(196,92,58,.05) 68%, rgba(168,76,76,.026) 78%, rgba(140,62,90,.012) 87%, transparent 97%)",
        }}
      />

      {/* 1. De kern. Klein, wit met een warme zweem, het felste punt. */}
      <div
        aria-hidden
        className="breath-glow"
        style={{
          ...laag,
          width: "calc(var(--em) * 1.04)",
          height: "calc(var(--em) * 1.04)",
          background:
            "radial-gradient(circle, rgba(255,253,246,.9) 0%, rgba(255,249,232,.72) 12%, rgba(255,242,206,.52) 24%, rgba(255,232,178,.34) 36%, rgba(255,218,144,.2) 48%, rgba(255,204,116,.11) 60%, rgba(255,192,100,.05) 72%, rgba(255,184,92,.02) 84%, transparent 96%)",
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
