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

const PENNEN = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='58' height='58'>
  <g fill='none' stroke='rgba(255,207,74,.14)' stroke-width='1.2' stroke-linejoin='round'>
    <path d='M29 16 L34 34 q0 5 -5 5 q-5 0 -5 -5 Z'/><path d='M29 22 v10'/>
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
 *  Alle zes leven, en alle zes anders. Een gesprek is de enige plek in de app
 *  waar je lang naar hetzelfde vlak kijkt, en stilstaand glas is dood glas.
 *  Maar het moet TRAAG: alles hier duurt tussen de veertien en veertig seconden,
 *  want een achtergrond die je ziet bewegen leidt af van wat erop staat.
 *
 *  De klasse `wp-<id>` hangt de animatie eraan; de keyframes staan in index.css
 *  onder "behang". */
type Behang = { lagen: string; accent: string; klasse: string };

const WALL: Record<WallpaperId, Behang> = {
  // Het dambord, met een lichtveeg die er schuin overheen trekt: alsof er een
  // spot langs het raster strijkt.
  nacht: {
    lagen: [
      DAMBORD,
      "radial-gradient(120% 55% at 50% 0%, rgba(122,103,255,.18), transparent 62%)",
      "linear-gradient(180deg, #241740 0%, #1A1035 55%, #120A28 100%)",
    ].join(", "),
    accent: "168,104,245",
    klasse: "wp-nacht",
  },
  // Twee gekleurde nevels die langs elkaar schuiven; ze staan nooit twee keer
  // hetzelfde omdat hun perioden niet op elkaar delen.
  nevel: {
    lagen: [
      "radial-gradient(60% 34% at 20% 24%, rgba(200,139,255,.26), transparent 70%)",
      "radial-gradient(66% 38% at 80% 72%, rgba(255,111,188,.2), transparent 72%)",
      "linear-gradient(180deg, #2A1748 0%, #1B1038 55%, #100826 100%)",
    ].join(", "),
    accent: "200,139,255",
    klasse: "wp-nevel",
  },
  // Het raster schuift langzaam omhoog, als een vloer die onder je door loopt.
  raster: {
    lagen: [
      RASTER,
      "radial-gradient(100% 50% at 50% 100%, rgba(88,196,236,.22), transparent 66%)",
      "linear-gradient(180deg, #0E1A2E 0%, #0C1526 60%, #070E1A 100%)",
    ].join(", "),
    accent: "88,196,236",
    klasse: "wp-raster",
  },
  // De sterren fonkelen: het motief zelf staat stil, de dekking ademt.
  sterren: {
    lagen: [
      STERREN,
      "radial-gradient(110% 50% at 50% 8%, rgba(90,70,200,.28), transparent 68%)",
      "linear-gradient(180deg, #150E30 0%, #100A26 55%, #08041A 100%)",
    ].join(", "),
    accent: "231,216,255",
    klasse: "wp-sterren",
  },
  // De pennen drijven traag naar boven, en er glijdt een gouden glans overheen.
  goud: {
    lagen: [
      PENNEN,
      "radial-gradient(110% 50% at 50% 0%, rgba(255,194,61,.16), transparent 60%)",
      "linear-gradient(180deg, #2A1E2C 0%, #1E1424 55%, #140C1A 100%)",
    ].join(", "),
    accent: "255,207,74",
    klasse: "wp-goud",
  },
  // Golven die van links naar rechts lopen, op het donkerste vlak van allemaal.
  inkt: {
    lagen: [
      GOLF,
      "radial-gradient(85% 40% at 50% 12%, rgba(54,2,135,.38), transparent 70%)",
      "linear-gradient(180deg, #0E0726 0%, #0A0520 60%, #06030F 100%)",
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
    backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat",
    backgroundAttachment: "local",
    ["--wp" as string]: w.accent,
  };
}

/** De klasse die het behang laat leven. Los van de stijl, want een STILSTAANDE
 *  voorbeeldtegel in de kiezer wil de kleuren wel en de beweging niet. */
export function wallpaperKlasse(id: WallpaperId): string {
  return (WALL[id] ?? WALL.nacht).klasse;
}
