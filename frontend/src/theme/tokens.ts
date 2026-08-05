// Pen Neer "arcade" theme — the single source of truth (§8).
// Dark, glowing arcade / game-show look. Drive every component from these.

export const colors = {
  bg0: "#09002C",   // donkerste achtergrond (Duel-palet)
  bg1: "#170150",   // donker paars
  glow: "#360287",  // midden paars
  panel: "rgba(255,255,255,.055)",
  panelBorder: "rgba(255,255,255,.12)",
  ink: "#F4EFFF",
  // Lopende tekst en bijschriften stonden in lila (#B6ABDA en #8076A8). Op een
  // donkerpaarse achtergrond is lila geen grijs maar een KLEUR die dicht bij de
  // ondergrond ligt, en dan lees je hem half. Ze zijn nu bijna wit met een
  // koele zweem: het verschil tussen de drie is nog steeds duidelijk, maar het
  // komt van helderheid en niet meer van kleur.
  sub: "#EDE8FA",
  faint: "#C7C0DA",
  // Het oude lila. Alleen nog voor UIT-standen: de niet-gekozen kant van een
  // pil of schakelaar hoort juist NIET te schreeuwen.
  lila: "#B6ABDA",
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

/* Het goud van de arena, GEMETEN uit de art en niet gekozen.
 *
 * De bron is nu de gouden lijn van de sectie (`ui/reken/sectie-lijn.webp`), want
 * dat is de lijn waar de hulpbalk pal onder hangt. Bemonsterd op de 32.098
 * pixels die goud zijn (ondoorzichtig en rood ruim boven blauw), naar helderheid
 * gesorteerd:
 *
 *   p99 #FEFDC5   p92 #FEFA9D   p80 #FEEB81   p60 #F3B53E   p38 #974E14
 *
 * Onder p38 loopt het naar #471304, maar dat is de rand waar de streek in de
 * achtergrond zakt en niet meer het metaal zelf.
 *
 * Dit goud is GELER en feller dan de vorige reeks, die uit de ladderstijlen en
 * de scoreplaat kwam (#FFE6B4 / #FFD158 / #C9903D / #8C5A18 / #4B2408). Die
 * waren cremer en warmer, en naast de nieuwe sectie ging de hulpbalk daardoor
 * dof staan. Twee gouden lijnen die elkaar raken moeten uit hetzelfde metaal
 * komen, dus de sectie wint.
 *
 * Licht naar donker, want het licht komt van linksboven. */
export const ARENA_GOUD = ["#FEFDC5", "#FEEB81", "#F3B53E", "#974E14", "#471304"] as const;
