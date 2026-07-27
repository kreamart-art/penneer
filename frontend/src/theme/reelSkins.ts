// Reel skins — CSS themes for the letter roulette (no art files; the reel is
// drawn in code). The whole room sees the ACTIVE player's theme during their
// spelleider turn. null/unknown id = the default gold reel from tokens.
//
// Elke skin heeft dezelfde opbouw als de standaardrol: een REEKS van vier tinten,
// van donker naar fel. Daaruit tekent Reel.tsx de rand (donker in de hoeken, een
// kort fel stuk in het midden), het glyph en de gloed. Zo krijgen alle skins de
// gelaagde look in plaats van een vlakke lijn, en hoef je per skin alleen kleuren
// te kiezen, geen verlopen te schrijven.
import { colors } from "./tokens";

/** Donker, midden, licht, fel. In die volgorde. */
export type ReelRamp = [string, string, string, string];

export interface ReelTheme {
  bg: string;      // the recessed tile gradient
  border: string;  // border + halo color when locked
  glow: string;    // letter glow while spinning/locked
  letter: string;  // letter color
  fade: string;    // top/bottom fade strip base color (rgba)
  /** De reeks waarmee rand en letter worden getekend zodra de letter valt. */
  ramp: ReelRamp;
  /** Afwijkende reeks vóór het vallen. Alleen de standaardrol gebruikt dit: die
   *  wacht in violet en slaat pas om naar goud als de letter valt. */
  idleRamp?: ReelRamp;
  /** Afwijkende binnenkant vóór het vallen, om dezelfde reden. */
  idleFill?: string;
}

export const DEFAULT_REEL: ReelTheme = {
  bg: "linear-gradient(180deg, #2a1c52 0%, #160d33 100%)",
  border: colors.gold,
  glow: colors.gold,
  letter: colors.gold,
  fade: "8,4,20",
  ramp: ["#4A2E04", "#B07C17", colors.gold, "#FFEBB8"],
  // Dezelfde violette reeks als de energielijnen op dit scherm.
  idleRamp: ["#3A167E", "#6A2DFF", "#9A4DFF", "#C46BFF"],
  idleFill: "radial-gradient(120% 100% at 50% 38%, #121A35 0%, #0A1023 100%)",
};

export const REEL_SKINS: Record<string, ReelTheme> = {
  rs01: { // Neon — electric cyan on deep night blue
    bg: "linear-gradient(180deg, #101642 0%, #070b24 100%)",
    border: "#28E0FF",
    glow: "#28E0FF",
    letter: "#5FEAFF",
    fade: "3,7,26",
    ramp: ["#06304A", "#0E93C7", "#28E0FF", "#BEF6FF"],
  },
  rs02: { // Vuur — embers on charred red
    bg: "linear-gradient(180deg, #47130a 0%, #1e0704 100%)",
    border: "#FF5A2A",
    glow: "#FF7A35",
    letter: "#FFA042",
    fade: "24,5,2",
    ramp: ["#3D1004", "#C33A12", "#FF7A35", "#FFD5A6"],
  },
  rs03: { // IJs — frosted light blue
    bg: "linear-gradient(180deg, #11304f 0%, #081627 100%)",
    border: "#9AD8FF",
    glow: "#B5E6FF",
    letter: "#E2F6FF",
    fade: "4,13,26",
    ramp: ["#0B2A45", "#3E86BE", "#9AD8FF", "#EEFAFF"],
  },
  rs04: { // Casino — red felt + gold
    bg: "linear-gradient(180deg, #46101c 0%, #20050b 100%)",
    border: "#F5B437",
    glow: "#F5B437",
    letter: "#FFD66E",
    fade: "24,3,8",
    ramp: ["#3D2705", "#A8741A", "#F5B437", "#FFECBB"],
  },
  rs05: { // Smaragd — emerald + mint
    bg: "linear-gradient(180deg, #0c3a26 0%, #051b11 100%)",
    border: "#2AE58D",
    glow: "#2AE58D",
    letter: "#7DF5BB",
    fade: "3,19,11",
    ramp: ["#04331F", "#11A05F", "#2AE58D", "#C2FFE2"],
  },
  rs06: { // Royal — purple velvet with a gold letter
    bg: "linear-gradient(180deg, #2a0f5c 0%, #130630 100%)",
    border: "#A96BFF",
    glow: "#A96BFF",
    letter: "#FFD66E",
    fade: "12,4,30",
    ramp: ["#2A0F5C", "#6B33C4", "#A96BFF", "#E6D0FF"],
  },
  rs07: { // Candy — hot pink
    bg: "linear-gradient(180deg, #4a0f33 0%, #22061a 100%)",
    border: "#FF5FA8",
    glow: "#FF5FA8",
    letter: "#FFA3CE",
    fade: "26,4,18",
    ramp: ["#3E0A29", "#C13A79", "#FF5FA8", "#FFCCE4"],
  },
  rs08: { // Toxic — radioactive lime
    bg: "linear-gradient(180deg, #263a06 0%, #101c02 100%)",
    border: "#B6FF2E",
    glow: "#B6FF2E",
    letter: "#D8FF7A",
    fade: "13,20,2",
    ramp: ["#22340A", "#7FBD1B", "#B6FF2E", "#EBFFC0"],
  },
  rs09: { // Middernacht — near-black with silver-white
    bg: "linear-gradient(180deg, #1b1b26 0%, #050508 100%)",
    border: "#E8E8F2",
    glow: "#AEB6D0",
    letter: "#F5F5FB",
    fade: "4,4,7",
    ramp: ["#1B1B26", "#6E7490", "#C9CEE0", "#FFFFFF"],
  },
};

// Uit de vier tinten van een skin (donker -> fel) komen telkens dezelfde twee
// verlopen. Het felle stuk is KORT: alleen rond het midden licht de rand op, niet
// een halve rand die staat te schijnen.
export function reelEdge(r: ReelRamp): string {
  return `linear-gradient(135deg, ${r[0]} 0%, ${r[1]} 14%, ${r[2]} 36%, ${r[3]} 50%, ${r[2]} 64%, ${r[1]} 86%, ${r[0]} 100%)`;
}
export function reelFace(r: ReelRamp): string {
  return `linear-gradient(155deg, ${r[3]} 0%, ${r[2]} 42%, ${r[1]} 76%, ${r[0]} 100%)`;
}

export const REEL_SKIN_IDS = Object.keys(REEL_SKINS);

export function reelTheme(skin?: string | null): ReelTheme {
  return (skin && REEL_SKINS[skin]) || DEFAULT_REEL;
}
