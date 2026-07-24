// Reel skins — CSS themes for the letter roulette (no art files; the reel is
// drawn in code). The whole room sees the ACTIVE player's theme during their
// spelleider turn. null/unknown id = the default gold reel from tokens.
import { colors } from "./tokens";

export interface ReelTheme {
  bg: string;      // the recessed tile gradient
  border: string;  // border + halo color when locked
  glow: string;    // letter glow while spinning/locked
  letter: string;  // letter color
  fade: string;    // top/bottom fade strip base color (rgba)
}

export const DEFAULT_REEL: ReelTheme = {
  bg: "linear-gradient(180deg, #2a1c52 0%, #160d33 100%)",
  border: colors.gold,
  glow: colors.gold,
  letter: colors.gold,
  fade: "8,4,20",
};

export const REEL_SKINS: Record<string, ReelTheme> = {
  rs01: { // Neon — electric cyan on deep night blue
    bg: "linear-gradient(180deg, #101642 0%, #070b24 100%)",
    border: "#28E0FF",
    glow: "#28E0FF",
    letter: "#5FEAFF",
    fade: "3,7,26",
  },
  rs02: { // Vuur — embers on charred red
    bg: "linear-gradient(180deg, #47130a 0%, #1e0704 100%)",
    border: "#FF5A2A",
    glow: "#FF7A35",
    letter: "#FFA042",
    fade: "24,5,2",
  },
  rs03: { // IJs — frosted light blue
    bg: "linear-gradient(180deg, #11304f 0%, #081627 100%)",
    border: "#9AD8FF",
    glow: "#B5E6FF",
    letter: "#E2F6FF",
    fade: "4,13,26",
  },
  rs04: { // Casino — red felt + gold
    bg: "linear-gradient(180deg, #46101c 0%, #20050b 100%)",
    border: "#F5B437",
    glow: "#F5B437",
    letter: "#FFD66E",
    fade: "24,3,8",
  },
  rs05: { // Smaragd — emerald + mint
    bg: "linear-gradient(180deg, #0c3a26 0%, #051b11 100%)",
    border: "#2AE58D",
    glow: "#2AE58D",
    letter: "#7DF5BB",
    fade: "3,19,11",
  },
};

export const REEL_SKIN_IDS = Object.keys(REEL_SKINS);

export function reelTheme(skin?: string | null): ReelTheme {
  return (skin && REEL_SKINS[skin]) || DEFAULT_REEL;
}
