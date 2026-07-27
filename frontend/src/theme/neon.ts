// De neon-game-stijl, losgemaakt van paars.
//
// De hele look hangt aan EEN ding: een reeks van vier tinten, van donker naar
// fel. Zolang je die uit de accentkleur kunt afleiden, werkt de stijl net zo goed
// in goud, groen, rood of grijs. Dus dat doen we hier, in HSL: de tint blijft
// staan, alleen de helderheid loopt.
//
// De valkuil zit bij de donkere tinten. Iets donkerder maken door het naar
// neutraal te trekken levert een kleur op die meteen grijs wordt zodra er wit
// doorheen mengt, en dan leest de rand als vuil in plaats van als licht. Daarom
// blijft de verzadiging staan en gaat alleen de helderheid omlaag.
import type React from "react";

/** Donker, midden, licht, fel. In die volgorde. */
export type Ramp = [string, string, string, string];

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };   // grijs: geen tint, en dat mag
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const css = (c: Hsl) => `hsl(${c.h.toFixed(1)} ${(c.s * 100).toFixed(1)}% ${(c.l * 100).toFixed(1)}%)`;

/** Vier tinten uit een accentkleur. Werkt ook op grijs: dan blijft s nul en loopt
 *  alleen de helderheid, van bijna zwart naar bijna wit. */
export function rampFrom(accent: string): Ramp {
  const c = hexToHsl(accent);
  const dark = { h: c.h, s: c.s * 0.9, l: clamp(c.l * 0.3, 0.05, 0.22) };
  const mid = { h: c.h, s: Math.min(1, c.s * 1.05), l: clamp(c.l * 0.62, 0.14, 0.55) };
  const light = { h: c.h, s: c.s, l: clamp(c.l, 0.3, 0.72) };
  // De felle tint is bewust NIET zuiver wit: dat mag alleen als piepklein
  // glanslichtje. Er blijft dus altijd wat kleur in zitten.
  const bright = { h: c.h, s: c.s * 0.6, l: clamp(c.l * 1.35 + 0.2, 0.7, 0.93) };
  return [css(dark), css(mid), css(light), css(bright)];
}

/** De rand: licht aan de bovenkant, donker naar onderen. Een rand die overal even
 *  sterk is leest als een lijn, deze leest als een belicht voorwerp. */
export function ringGradient(r: Ramp): string {
  return `linear-gradient(170deg, ${r[3]} 0%, ${r[2]} 20%, ${r[1]} 52%, ${r[0]} 100%)`;
}

/** De belichting van bovenaf, over het vlak heen. Heel laag van dekking: hij mag
 *  de inhoud tinten, niet bedekken. */
export function litGradient(accent: string): string {
  const c = hexToHsl(accent);
  return `radial-gradient(115% 65% at 50% -12%, hsl(${c.h.toFixed(1)} ${(c.s * 100).toFixed(1)}% ${(clamp(c.l, 0.35, 0.7) * 100).toFixed(1)}% / .16), transparent 62%)`;
}

/** Een sierlijn in deze kleur: donker aan de uiteinden, fel in het midden. */
export function lineGradient(accent: string): string {
  const r = rampFrom(accent);
  return `linear-gradient(90deg, ${r[0]} 0%, ${r[1]} 28%, ${r[2]} 44%, ${r[3]} 50%, ${r[2]} 56%, ${r[1]} 72%, ${r[0]} 100%)`;
}

/** Wat je op een element zet om het in deze kleur te laten oplichten.
 *
 *  Het zijn custom properties, geen gewone stijl: de rand en de belichting zijn
 *  pseudo-elementen (`.panel-neon::before/::after`) en die kun je niet inline
 *  aansturen. Via een variabele wel. */
export function neonSkin(accent: string): React.CSSProperties {
  const r = rampFrom(accent);
  return {
    ["--ng-ring" as string]: ringGradient(r),
    ["--ng-lit" as string]: litGradient(accent),
  } as React.CSSProperties;
}
