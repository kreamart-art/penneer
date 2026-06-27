// Pen Neer "arcade" theme — the single source of truth (§8).
// Dark, glowing arcade / game-show look. Drive every component from these.

export const colors = {
  bg0: "#0E0922",
  bg1: "#1A1140",
  glow: "#41216F",
  panel: "rgba(255,255,255,.055)",
  panelBorder: "rgba(255,255,255,.12)",
  ink: "#F4EFFF",
  sub: "#B6ABDA",
  faint: "#8076A8",
  red: "#FF564A",
  redDeep: "#D63A2F",
  redHi: "#FF7064",
  gold: "#FFC23D",
  goldHi: "#FFD66E",
  violet: "#7A67FF",
  violetDeep: "#5946DC",
  green: "#36E0AE",
  greenDeep: "#1FB78C",
  hairline: "rgba(255,255,255,.10)",
} as const;

// Round-robin player colors. The local player gets re-tinted to gold.
export const playerColors = [
  "#FFC23D",
  "#36E0AE",
  "#FF7AC2",
  "#7A67FF",
  "#FF8A4C",
  "#8BE36A",
];

export const appBackground =
  "radial-gradient(120% 80% at 50% -8%, #41216F 0%, #1A1140 42%, #0E0922 100%)";

export const font = {
  display: '"Space Grotesk", system-ui, sans-serif',
  ui: '"Inter", system-ui, sans-serif',
} as const;

// Reusable surface for translucent panels / cards.
export const panelStyle: React.CSSProperties = {
  background: colors.panel,
  border: `1px solid ${colors.panelBorder}`,
  borderRadius: 18,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  boxShadow: "0 18px 50px rgba(0,0,0,.35)",
};

export const radius = {
  card: 18,
  button: 14,
  chip: 999,
} as const;

// Convert #RRGGBB to rgba() with the given alpha. Used for tints / glows.
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
