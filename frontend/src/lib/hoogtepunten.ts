// Het verhaal van een ronde: het woord van de ronde en één regel per categorie.
//
// Stond in screens/Results.tsx, en is hierheen gehaald toen de uitzending in de
// chat dezelfde sectie moest tonen. Twee plekken die hetzelfde verhaal vertellen
// horen het uit dezelfde bron te halen; anders lopen ze op een dag uit elkaar en
// leest de kijker iets anders dan de speler.
import type { Player, RoomState } from "../net/socket";

export type HoogtepuntToon = "gold" | "ink" | "faint";
export type Hoogtepunt = { cat: string; text: string; tone: HoogtepuntToon };
export type WoordVanDeRonde = { word: string; name: string; len: number };

/** Spiegel van de normalize() op de server: herkent een handmatig gekoppeld
 *  antwoord (de canon wijkt af van het woord zelf). */
export function normWoord(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Het langste geldige woord dat iemand deze ronde speelde, als het echt lang
 *  is (zes letters of meer). Anders niets: een schijnwerper op "kat" is geen
 *  schijnwerper. */
export function woordVanDeRonde(room: RoomState, spelers: Player[]): WoordVanDeRonde | null {
  let beste: WoordVanDeRonde | null = null;
  for (const p of spelers) {
    for (const cat of room.settings.categories) {
      const a = room.round?.answers[p.id]?.[cat];
      if (a && a.valid && a.text) {
        const len = normWoord(a.text).length;
        if (!beste || len > beste.len) beste = { word: a.text, name: p.name, len };
      }
    }
  }
  return beste && beste.len >= 6 ? beste : null;
}

/** Eén regel per categorie: "iedereen had ZEBRA", "alleen Karim had iets". Met
 *  minder dan twee spelers valt er niets te vergelijken, dus dan geen regels. */
export function hoogtepunten(
  room: RoomState,
  spelers: Player[],
  t: (k: string, v?: Record<string, string | number>) => string,
): Hoogtepunt[] {
  return room.settings.categories
    .map((cat): Hoogtepunt | null => {
      const inzendingen = spelers
        .map((p) => ({ p, a: room.round?.answers[p.id]?.[cat] }))
        .filter((x) => x.a && x.a.valid && x.a.text);
      if (spelers.length < 2) return null;
      if (inzendingen.length === 0) return { cat, text: t("revealNobody"), tone: "faint" };

      const groepen = new Map<string, { word: string; names: string[] }>();
      for (const { p, a } of inzendingen) {
        const k = a!.canon || normWoord(a!.text);
        const g = groepen.get(k) || { word: a!.text, names: [] };
        g.names.push(p.name);
        groepen.set(k, g);
      }
      if (groepen.size === 1 && inzendingen.length === spelers.length) {
        const g = [...groepen.values()][0];
        return { cat, text: t("revealAllSame", { word: g.word.toUpperCase() }), tone: "gold" };
      }
      if (inzendingen.length === 1) {
        const enige = inzendingen[0];
        return { cat, text: t("revealOnlyOne", { name: enige.p.name, word: enige.a!.text.toUpperCase() }), tone: "gold" };
      }
      const grootste = [...groepen.values()].sort((x, y) => y.names.length - x.names.length)[0];
      if (grootste.names.length >= 2) {
        return { cat, text: t("revealNSame", { n: grootste.names.length, word: grootste.word.toUpperCase() }), tone: "ink" };
      }
      return { cat, text: t("revealAllUnique", { n: groepen.size }), tone: "faint" };
    })
    .filter((h): h is Hoogtepunt => h !== null);
}
