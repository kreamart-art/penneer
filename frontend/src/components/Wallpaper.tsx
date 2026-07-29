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

const RUIT = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'>
  <path d='M20 4 L36 20 L20 36 L4 20 Z' fill='none' stroke='rgba(200,160,255,.09)' stroke-width='1'/>
</svg>`);

const RASTER = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>
  <path d='M0 .5H32M.5 0V32' stroke='rgba(200,160,255,.08)' stroke-width='1'/>
</svg>`);

const PENNEN = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='58' height='58'>
  <g fill='none' stroke='rgba(255,207,74,.10)' stroke-width='1.2' stroke-linejoin='round'>
    <path d='M29 16 L34 34 q0 5 -5 5 q-5 0 -5 -5 Z'/>
    <path d='M29 22 v10'/>
  </g>
</svg>`);

const STERREN = motief(`<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'>
  <g fill='rgba(231,216,255,.16)'>
    <circle cx='12' cy='18' r='1.1'/><circle cx='58' cy='9' r='.8'/>
    <circle cx='77' cy='44' r='1.3'/><circle cx='31' cy='63' r='.9'/>
    <circle cx='68' cy='78' r='1'/><circle cx='6' cy='84' r='.7'/>
  </g>
</svg>`);

/** De laagopbouw per behang: motief bovenop, dan de lichtplek, dan de bodem. */
const LAGEN: Record<WallpaperId, string> = {
  nacht: [
    RUIT,
    "radial-gradient(120% 60% at 50% 0%, rgba(122,103,255,.16), transparent 62%)",
    "linear-gradient(180deg, #241740 0%, #1A1035 55%, #120A28 100%)",
  ].join(", "),
  nevel: [
    "radial-gradient(70% 40% at 18% 22%, rgba(200,139,255,.16), transparent 70%)",
    "radial-gradient(80% 45% at 82% 70%, rgba(255,111,188,.12), transparent 72%)",
    "linear-gradient(180deg, #2A1748 0%, #1B1038 55%, #100826 100%)",
  ].join(", "),
  raster: [
    RASTER,
    "radial-gradient(100% 55% at 50% 100%, rgba(122,103,255,.2), transparent 66%)",
    "linear-gradient(180deg, #170F30 0%, #140C2B 60%, #0D0620 100%)",
  ].join(", "),
  sterren: [
    STERREN,
    "radial-gradient(110% 55% at 50% 8%, rgba(90,70,200,.24), transparent 68%)",
    "linear-gradient(180deg, #150E30 0%, #100A26 55%, #08041A 100%)",
  ].join(", "),
  goud: [
    PENNEN,
    "radial-gradient(110% 55% at 50% 0%, rgba(255,194,61,.12), transparent 60%)",
    "linear-gradient(180deg, #261B3C 0%, #1B1230 55%, #120B24 100%)",
  ].join(", "),
  inkt: [
    "radial-gradient(85% 45% at 50% 12%, rgba(54,2,135,.34), transparent 70%)",
    "linear-gradient(180deg, #0E0726 0%, #0A0520 60%, #06030F 100%)",
  ].join(", "),
};

/** De stijl voor het vlak waar de berichten op staan. */
export function wallpaperStijl(id: WallpaperId): React.CSSProperties {
  return {
    backgroundImage: LAGEN[id] ?? LAGEN.nacht,
    backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat",
    backgroundAttachment: "local",
  };
}
