// Pen Neer "arcade" theme — the single source of truth (§8).
// Dark, glowing arcade / game-show look. Drive every component from these.

export const colors = {
  bg0: "#09002C",   // donkerste achtergrond (Duel-palet)
  bg1: "#170150",   // donker paars
  glow: "#360287",  // midden paars
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
  orange: "#FF9F45",
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
  // Smalle hoofdletters, voor korte kreten: de tagline, de spelernaam, koppen.
  wide: '"Bebas Neue", "Space Grotesk", system-ui, sans-serif',
  // Puntmatrix, voor uitlezingen achter glas: de LED-balk van de Flitsreeks. De
  // reserve is een monospace, want een puntletter is per definitie op een raster
  // getekend en cijfers die van breedte wisselen laten de stand dansen.
  dot: '"Dotfont", ui-monospace, "SFMono-Regular", monospace',
} as const;

// Reusable surface for translucent panels / cards.
export const panelStyle: React.CSSProperties = {
  // DOORZICHTIG: de achtergrond loopt er helemaal doorheen en de lijst doet het
  // werk. Boven de veertig procent dekking is het geen lijst meer maar een
  // kaart, en dan verdwijnt het decor waar het spel op staat.
  //
  // Geen `backdrop-filter` meer: vervagen zonder vulling geeft geen glas maar
  // MIST, een vlek zonder vorm. Wat een paneel zijn plek geeft is de lijn plus
  // de gloed eromheen, niet een waas erachter.
  background: "transparent",
  // Geen `border`: de rand van een paneel is de verloopring uit `.panel-neon`.
  borderRadius: 18,
  // De buitengloed hoort bij de lijst en volgt dus dezelfde variabele: strak om
  // de vorm, met daaronder een gewone donkere schaduw zodat het paneel ergens op
  // ligt. Groter maken is de meest gemaakte fout: een brede gloed maakt de lijn
  // niet verlicht maar wazig.
  boxShadow: "var(--ng-gloed, 0 0 10px rgba(139,83,255,.20)), 0 18px 50px rgba(0,0,0,.35)",
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

/* De kleurenreeks van cash. GEMETEN uit de art (`ui/valuta/cash.webp`), niet
 * gekozen: de mediane groene pixel is H=0.244 S=0.71 V=0.63, en de vier tinten
 * lopen daar met vaste tint vanaf, alleen de helderheid schuift. Zo hoort de
 * cash-pil bij het biljet dat erin staat, in plaats van er toevallig naast.
 * Donker -> fel, net als GOUD. */
export const GROEN = ["#1D2D0C", "#4D7322", "#84BD42", "#BAD898"] as const;

/* Het goud van de arena, GEMETEN uit de art en niet gekozen. Bemonsterd op de
 * gouden pixels van de ladderstijlen (ui/reken) en de scoreplaat (ui/soep):
 *
 *   ladder     p99 #FFD88B   p90 #CABC77   p70 #927246   p25 #5A3811   p6 #41250F
 *   scoreplaat p99 #FFE2BD   p90 #FFD158   p70 #C9903D   p25 #703A00   p6 #4B2408
 *
 * Deze vijf tinten liggen daartussen, met de scoreplaat als hoofdtoon omdat dat
 * de rijkste is. Elke gouden lijn in de arena tekent hieruit, zodat een lijn die
 * naast de art ligt uit hetzelfde metaal lijkt te komen in plaats van er
 * toevallig naast te vallen. Licht naar donker, want het licht komt van boven. */
export const ARENA_GOUD = ["#FFE6B4", "#FFD158", "#C9903D", "#8C5A18", "#4B2408"] as const;
