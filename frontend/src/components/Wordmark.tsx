// Het PEN NEER-woordmerk: gesmeed chroom met een violette zijkant.
//
// Opbouw van achter naar voren, want zo werkt een geslagen letter ook: eerst de
// schaduw op de grond, dan de zijkant die uit de letter steekt, dan de donkere
// omtrek, dan pas het metaal zelf. Alle maten in em, dus het klopt op elk
// formaat.
//
// Geen gloed, geen deeltjes, geen band: alleen het woordmerk.
import type { CSSProperties } from "react";

// Hoe ver de zijkant naar rechtsonder loopt, in stappen. Meer stappen van een
// kleinere maat geeft een gladde flank in plaats van een trap.
const STEPS = 16;
const STEP = 0.013; // em per stap

function hex(c: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
}
function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** De zijkant plus de schaduw eronder. De eerste stap ligt tegen de letter aan
 *  en vangt nog licht; hoe verder weg, hoe dieper het violet. */
function side(): string {
  const parts: string[] = [];
  for (let i = 1; i <= STEPS; i++) {
    const d = (STEP * i).toFixed(3);
    parts.push(`${d}em ${d}em 0 ${mix("#7E4FD6", "#2B1252", i / STEPS)}`);
  }
  const far = STEP * STEPS;
  parts.push(`${(far + 0.015).toFixed(3)}em ${(far + 0.055).toFixed(3)}em 0.085em rgba(20,7,44,.62)`);
  return parts.join(", ");
}

// Het chroom. Boven bijna wit, in het midden gepolijst zilver met de donkere
// horizon die chroom zijn chroom maakt, onderaan koel grijs met een zweem
// lavendel. De geborstelde streepjes liggen er als eerste laag overheen.
const CHROME = [
  "repeating-linear-gradient(0deg, rgba(255,255,255,.16) 0 0.6px, rgba(30,26,48,.10) 0.6px 1.4px, transparent 1.4px 3px)",
  [
    "linear-gradient(180deg",
    "#FFFFFF 0%",
    "#F7F8FC 9%",
    "#E2E5EF 26%",
    "#BCC2D6 43%",
    "#8B90AA 50%",
    "#C6CBDC 56%",
    "#E4E6F0 72%",
    "#B3AFC9 88%",
    "#918DAE 100%)",
  ].join(", "),
].join(", ");

const layer: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

/** Eén woord in alle lagen. De woorden staan los zodat de tussenruimte een
 *  eigen maat heeft in plaats van een spatie uit het font. */
function Word({ children }: { children: string }) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {/* de zijkant met de schaduw eronder */}
      <span aria-hidden style={{ ...layer, color: "#3A1C6B", textShadow: side() }}>
        {children}
      </span>
      {/* de donkere omtrek: de buitenste helft blijft staan, de rest valt
          onder het metaal */}
      <span
        aria-hidden
        style={{ ...layer, color: "transparent", WebkitTextStroke: "0.045em #241041" }}
      >
        {children}
      </span>
      {/* het metaal zelf */}
      <span
        style={{
          position: "relative",
          backgroundImage: CHROME,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {children}
      </span>
    </span>
  );
}

export function Wordmark({ style }: { style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        // De letterafstand zet ook achter de laatste letter ruimte; die halen we
        // er weer af, anders staat het woordmerk een halve letter naar links.
        gap: "0.05em",
        ...style,
      }}
    >
      <Word>PEN</Word>
      <span style={{ marginRight: "-0.14em" }}>
        <Word>NEER</Word>
      </span>
    </span>
  );
}
