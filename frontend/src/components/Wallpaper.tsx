// Behang voor het berichtenvenster.
//
// Een gesprek is de enige plek in de app waar je LANG naar hetzelfde vlak
// kijkt, en het was een egale donkere kolom. Dat is niet lelijk, het is alleen
// niets: geen diepte, geen textuur, geen reden om er te zijn.
//
// Het was eerst in code getekend, met verlopen en herhaalde SVG-motieven. Nu is
// het echte art: zijde, een nevel, marmer, een paneel, een kosmos en het
// pennenmonogram. Wat code niet kan is materiaal met een geschiedenis, en dat is
// precies waar je een half uur naar wil kijken.
//
// Twee dingen die daarbij horen. Er ligt altijd een SLUIER over de art, want
// berichten moeten leesbaar blijven en een foto is nooit egaal genoeg om dat
// vanzelf te doen. En er beweegt NIETS: de lichtveeg die er eerst overheen
// liep is er in v2.81 afgehaald, want boven een gesprek is elke beweging
// afleiding. Achtergrond hoort achtergrond te zijn.
export type WallpaperId = "zijde" | "heelal" | "marmer" | "paneel" | "kosmos" | "goud";

export const WALLPAPERS: { id: WallpaperId; naam: string }[] = [
  { id: "kosmos", naam: "Kosmos" },
  { id: "goud", naam: "Goud" },
  { id: "heelal", naam: "Heelal" },
  { id: "zijde", naam: "Zijde" },
  { id: "marmer", naam: "Marmer" },
  { id: "paneel", naam: "Paneel" },
];

const STANDAARD: WallpaperId = "kosmos";
const SLEUTEL = "penneer.wallpaper";

export function wallpaperVan(): WallpaperId {
  try {
    const w = localStorage.getItem(SLEUTEL) as WallpaperId | null;
    // Een onbekende naam betekent meestal een keuze uit de oude, in code
    // getekende reeks. Die bestaat niet meer, dus dan de standaard.
    return w && WALLPAPERS.some((x) => x.id === w) ? w : STANDAARD;
  } catch {
    return STANDAARD;
  }
}

export function wallpaperZet(id: WallpaperId): void {
  try {
    localStorage.setItem(SLEUTEL, id);
  } catch {
    /* geen opslag, dan geldt hij alleen deze sessie */
  }
}

/** Per behang: het accent dat de lichtveeg en de kleine glans erven, en hoe
 *  zwaar de sluier moet zijn. Een lichte art heeft meer sluier nodig dan een
 *  bijna zwarte, anders leest de tekst er niet op. */
type Behang = { accent: string; sluier: number };

const WALL: Record<WallpaperId, Behang> = {
  kosmos: { accent: "168,104,245", sluier: 0.3 },
  goud: { accent: "255,207,74", sluier: 0.3 },
  heelal: { accent: "160,120,255", sluier: 0.34 },
  zijde: { accent: "255,194,61", sluier: 0.26 },
  marmer: { accent: "200,139,255", sluier: 0.36 },
  paneel: { accent: "196,150,255", sluier: 0.3 },
};

/** De stijl voor het vlak waar de berichten op staan. */
export function wallpaperStijl(id: WallpaperId): React.CSSProperties {
  const w = WALL[id] ?? WALL[STANDAARD];
  const s = w.sluier;
  return {
    backgroundImage: [
      // De sluier ligt BOVEN de art, dus hij staat als eerste in de lijst.
      // Onderaan iets zwaarder: daar staat het invoerveld en daar mag de art
      // wegzakken.
      `linear-gradient(180deg, rgba(6,4,14,${s.toFixed(2)}) 0%, rgba(6,4,14,${(s * 0.86).toFixed(2)}) 40%, rgba(6,4,14,${(s + 0.16).toFixed(2)}) 100%)`,
      `url("/wallpapers/${id}.webp?v=1")`,
    ].join(", "),
    backgroundRepeat: "no-repeat, no-repeat",
    backgroundSize: "cover, cover",
    // De art staat op `cover` in een smalle, hoge kolom, dus er valt links en
    // rechts iets weg. Gecentreerd sneed dat precies het onderwerp eruit: de
    // maan in de kosmos zit rechts in het beeld en verdween half buiten de
    // rand. Rechts uitlijnen houdt hem heel; wat er dan wegvalt is de lege
    // linkerhelft, en dat is nou juist het stuk waar niets gebeurt.
    backgroundPosition: "center, right center",
    // Geen `local`: dan zou de art meeschalen met de HOOGTE van het gesprek en
    // bij een lange thread tot een uitgerekte vlek worden. Nu blijft hij staan
    // en schuiven de berichten eroverheen.
    ["--wp" as string]: w.accent,
  };
}

/** Ooit de klasse met de lichtveeg-animatie; het behang staat nu stil. De
 *  functie blijft zodat de aanroepplekken niet hoeven te weten dat er niets
 *  meer te doen valt. */
export function wallpaperKlasse(_id: WallpaperId): string {
  return "";
}
