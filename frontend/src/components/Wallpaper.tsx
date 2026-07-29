// Behang voor het berichtenvenster.
//
// Een gesprek is de enige plek in de app waar je LANG naar hetzelfde vlak
// kijkt, en het was een egale donkere kolom. Dat is niet lelijk, het is alleen
// niets: geen diepte, geen textuur, geen reden om er te zijn.
//
// Alles hier is in code getekend en niet als bestand: het is behang, dus het
// moet in elk formaat kloppen en niets wegen. Elk patroon is dezelfde opbouw:
// een donkere bodem uit het palet, een grote zachte lichtplek zodat er een
// lichtbron is, en daarboven een fijn herhaald motief dat je pas ziet als je
// erop let. Meer dan dat wordt een achtergrond die met de tekst concurreert,
// en een gesprek moet je kunnen LEZEN.
export type WallpaperId = "nacht" | "nevel" | "raster" | "sterren" | "goud" | "inkt";

export const WALLPAPERS: { id: WallpaperId; naam: string }[] = [
  { id: "nacht", naam: "Nacht" },
  { id: "nevel", naam: "Nevel" },
  { id: "raster", naam: "Raster" },
  { id: "sterren", naam: "Sterren" },
  { id: "goud", naam: "Goud" },
  { id: "inkt", naam: "Inkt" },
];

const SLEUTEL = "penneer.wallpaper";

export function wallpaperVan(): WallpaperId {
  try {
    const w = localStorage.getItem(SLEUTEL) as WallpaperId | null;
    return w && WALLPAPERS.some((x) => x.id === w) ? w : "nacht";
  } catch {
    return "nacht";
  }
}

export function wallpaperZet(id: WallpaperId): void {
  try {
    localStorage.setItem(SLEUTEL, id);
  } catch {
    /* geen opslag, dan geldt hij alleen deze sessie */
  }
}

/** Een fijn herhaald motief als data-URI. Als SVG en niet als afbeelding: het
 *  schaalt oneindig, het weegt niets, en de kleur zit in de string zodat een
 *  variant een parameter is in plaats van een tweede bestand. */
const motief = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}")`;

/** Het dambord van NACHT: alleen de LIJNEN, diagonaal, in twee richtingen over
 *  elkaar. Geen gevulde vakjes: gevulde ruiten worden een deken en dan lees je
 *  de tekst erop niet meer. Wat je ziet is het raster dat zo'n deken zou hebben
 *  gehad, en dat is genoeg. */
const DAMBORD = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
  <g stroke='rgba(168,104,245,.22)' stroke-width='1'>
    <path d='M-12 12 L12 -12 M0 48 L48 0 M36 60 L60 36'/>
  </g>
  <g stroke='rgba(216,180,255,.13)' stroke-width='1'>
    <path d='M-12 36 L36 -12 M12 60 L60 12'/>
  </g>
</svg>`);

const RASTER = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34'>
  <path d='M0 .5H34M.5 0V34' stroke='rgba(88,196,236,.16)' stroke-width='1'/>
</svg>`);

/* Het monogram van Pen Neer, in de opzet van een modehuis-canvas.
 *
 * Hoe zo'n patroon werkt (Gucci, Louis Vuitton, Goyard): het merkteken staat op
 * de KNOOPPUNTEN van een ruitraster, de ruiten zelf worden met dunne diagonalen
 * getekend, en alles staat toon-op-toon, dus goud op donker goud in plaats van
 * goud op zwart. Het mag NIET opvallen; het is textuur waar je overheen leest.
 *
 * Vandaar de tegel: de pen in het midden en op alle vier de hoeken, en de
 * diagonalen die van hoek naar hoek door het midden lopen. Omdat de hoekpennen
 * op de naad staan, sluiten ze bij het herhalen aan tot één pen op elk
 * kruispunt, precies zoals je het tekende: pennen boven, de lijnen die naar
 * elkaar toelopen, een pen in het hart, en weer uit elkaar naar de pennen
 * eronder.
 *
 * De pen zit op 0,45 dekking gecentreerd getekend en op de hoeken vier keer op
 * een kwart, zodat de tegel naadloos rondloopt. */
const PEN_PAD = "M0 -9 L4.6 8 q0 4.6 -4.6 4.6 q-4.6 0 -4.6 -4.6 Z";
const PEN_STEEL = "M0 -3.4 v9";
const pen = (x: number, y: number, schaal = 1) =>
  `<g transform='translate(${x} ${y}) scale(${schaal})'><path d='${PEN_PAD}'/><path d='${PEN_STEEL}'/></g>`;
const PENNEN = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'>
  <g fill='none' stroke='rgba(255,207,74,.10)' stroke-width='1' stroke-linejoin='round' stroke-linecap='round'>
    <path d='M0 0 L42 42 L84 0 M0 84 L42 42 L84 84'/>
  </g>
  <g fill='none' stroke='rgba(255,207,74,.17)' stroke-width='1.25' stroke-linejoin='round' stroke-linecap='round'>
    ${pen(42, 42)}
    ${pen(0, 0)}${pen(84, 0)}${pen(0, 84)}${pen(84, 84)}
  </g>
</svg>`);

const STERREN = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'>
  <g fill='rgba(231,216,255,.22)'>
    <circle cx='12' cy='18' r='1.1'/><circle cx='58' cy='9' r='.8'/>
    <circle cx='77' cy='44' r='1.3'/><circle cx='31' cy='63' r='.9'/>
    <circle cx='68' cy='78' r='1'/><circle cx='6' cy='84' r='.7'/>
  </g>
</svg>`);

const GOLF = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='72' height='36'>
  <path d='M0 24 q18 -14 36 0 q18 14 36 0' fill='none' stroke='rgba(255,111,188,.15)' stroke-width='1.1'/>
</svg>`);

/** Per behang: de laagopbouw, de eigen accentkleur en hoe het beweegt.
 *
 *  De BODEM is nooit één kleur. Elk behang heeft een set verlopen die elkaar
 *  aanvullen: een kleur die van boven komt, een tweede die van onderen opkomt,
 *  en een of twee flares op verschillende plekken. Zo krijgt het vlak diepte
 *  zonder dat er iets te zien is; één egale kleur leest als karton.
 *
 *  Daarboven ligt de TEXTUUR: het raster, de sterren, de pennen. Die beweegt op
 *  zijn eigen manier.
 *
 *  Alle zes leven, en alle zes anders. Maar het moet TRAAG: alles hier duurt
 *  tussen de veertien en veertig seconden, want een achtergrond die je ziet
 *  bewegen leidt af van wat erop staat.
 *
 *  De klasse `wp-<id>` hangt de animatie eraan; de keyframes staan in index.css
 *  onder "behang". */
type Behang = { lagen: string; accent: string; klasse: string };

const WALL: Record<WallpaperId, Behang> = {
  // Dambord van lijnen op een violette bodem met een warme flare linksboven en
  // een koele rechtsonder: twee kanten van hetzelfde paars.
  nacht: {
    lagen: [
      DAMBORD,
      "radial-gradient(46% 30% at 14% 10%, rgba(255,180,90,.13), transparent 70%)",
      "radial-gradient(52% 34% at 86% 88%, rgba(122,103,255,.22), transparent 72%)",
      "radial-gradient(120% 55% at 50% 0%, rgba(168,104,245,.2), transparent 62%)",
      "linear-gradient(168deg, #2A1A4C 0%, #1E1238 46%, #150C2B 74%, #0F0722 100%)",
    ].join(", "),
    accent: "168,104,245",
    klasse: "wp-nacht",
  },
  // Twee nevels die langs elkaar schuiven op een bodem die van magenta naar
  // indigo kantelt.
  nevel: {
    lagen: [
      "radial-gradient(58% 32% at 20% 24%, rgba(200,139,255,.3), transparent 70%)",
      "radial-gradient(64% 36% at 80% 72%, rgba(255,111,188,.24), transparent 72%)",
      "radial-gradient(40% 24% at 62% 12%, rgba(255,214,110,.1), transparent 74%)",
      "linear-gradient(200deg, #331A50 0%, #241344 44%, #180D33 72%, #100823 100%)",
    ].join(", "),
    accent: "200,139,255",
    klasse: "wp-nevel",
  },
  // Een vloer die onder je door loopt, met licht dat van de horizon opkomt.
  raster: {
    lagen: [
      RASTER,
      "radial-gradient(90% 42% at 50% 104%, rgba(88,196,236,.3), transparent 68%)",
      "radial-gradient(44% 26% at 12% 8%, rgba(122,103,255,.16), transparent 72%)",
      "linear-gradient(184deg, #101B33 0%, #0D1628 46%, #0A1120 74%, #060B18 100%)",
    ].join(", "),
    accent: "88,196,236",
    klasse: "wp-raster",
  },
  // Diepe nachthemel: donker naar de randen, één zachte melkweg diagonaal.
  sterren: {
    lagen: [
      STERREN,
      "radial-gradient(70% 30% at 30% 22%, rgba(120,96,235,.24), transparent 72%)",
      "radial-gradient(56% 26% at 76% 68%, rgba(88,196,236,.14), transparent 74%)",
      "linear-gradient(160deg, #1A1138 0%, #130C2B 42%, #0C0720 72%, #06030F 100%)",
    ].join(", "),
    accent: "231,216,255",
    klasse: "wp-sterren",
  },
  // Warm en donker, met goud dat van boven invalt en brons uit de bodem.
  goud: {
    lagen: [
      PENNEN,
      "radial-gradient(80% 34% at 50% -4%, rgba(255,194,61,.2), transparent 64%)",
      "radial-gradient(50% 28% at 84% 92%, rgba(196,110,40,.16), transparent 72%)",
      "linear-gradient(176deg, #2E2033 0%, #241729 46%, #1A1020 74%, #120A17 100%)",
    ].join(", "),
    accent: "255,207,74",
    klasse: "wp-goud",
  },
  // Het donkerste vlak, met golven en een enkele koele flare.
  inkt: {
    lagen: [
      GOLF,
      "radial-gradient(70% 32% at 50% 10%, rgba(54,2,135,.44), transparent 70%)",
      "radial-gradient(46% 24% at 18% 86%, rgba(255,111,188,.12), transparent 74%)",
      "linear-gradient(190deg, #150B33 0%, #0E0726 44%, #090419 74%, #05030E 100%)",
    ].join(", "),
    accent: "255,111,188",
    klasse: "wp-inkt",
  },
};

/** De stijl voor het vlak waar de berichten op staan. */
export function wallpaperStijl(id: WallpaperId): React.CSSProperties {
  const w = WALL[id] ?? WALL.nacht;
  return {
    backgroundImage: w.lagen,
    backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat",
    backgroundAttachment: "local",
    ["--wp" as string]: w.accent,
  };
}

/** De klasse die het behang laat leven. Los van de stijl, want een STILSTAANDE
 *  voorbeeldtegel in de kiezer wil de kleuren wel en de beweging niet. */
export function wallpaperKlasse(id: WallpaperId): string {
  return (WALL[id] ?? WALL.nacht).klasse;
}
