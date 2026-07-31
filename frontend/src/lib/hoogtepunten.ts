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

/** Prestaties van spelers in deze ronde: het soort regel dat een commentator
 *  eruit pikt. Anders dan de categorieregels gaan deze over een PERSOON, en dat
 *  is precies wat een uitzending wil laten zien.
 *
 *  Op volgorde van zeldzaamheid, want de bovenste krijgt de meeste aandacht:
 *  een vlekkeloze ronde is het hoogste, daarna de ronde-oogst, dan wie er als
 *  enige overal iets had, en tot slot wie er met lege handen stond.
 */
export function prestaties(
  room: RoomState,
  spelers: Player[],
  t: (k: string, v?: Record<string, string | number>) => string,
): Hoogtepunt[] {
  const cats = room.settings.categories;
  if (cats.length === 0 || spelers.length === 0) return [];
  const uit: Hoogtepunt[] = [];

  const uniek = (id: string) => cats.filter((c) => (room.round?.points[id]?.[c] ?? 0) === 10).length;
  const oogst = (id: string) => cats.reduce((n, c) => n + (room.round?.points[id]?.[c] ?? 0), 0);
  const ingevuld = (id: string) => cats.filter((c) => !!room.round?.answers[id]?.[c]?.text).length;

  // Vlekkeloos: overal een uniek antwoord. Het zeldzaamste wat er is.
  for (const p of spelers) {
    if (uniek(p.id) === cats.length) uit.push({ cat: `perfect-${p.id}`, text: t("streamPerfect", { naam: p.name }), tone: "gold" });
  }

  // De dikste oogst van de ronde, alleen als er echt iets te oogsten viel en
  // niet iedereen gelijk staat: "de beste van allemaal gelijk" is geen nieuws.
  const beste = Math.max(0, ...spelers.map((p) => oogst(p.id)));
  const kopstukken = spelers.filter((p) => oogst(p.id) === beste);
  if (beste > 0 && kopstukken.length === 1 && spelers.length > 1) {
    uit.push({ cat: `oogst-${kopstukken[0].id}`, text: t("streamRondeOogst", { naam: kopstukken[0].name, n: beste }), tone: "gold" });
  }

  // Als enige overal iets ingevuld: doorzetten telt ook als je niet scoort.
  const compleet = spelers.filter((p) => ingevuld(p.id) === cats.length);
  if (compleet.length === 1 && spelers.length > 1) {
    uit.push({ cat: `vol-${compleet[0].id}`, text: t("streamAllesIn", { naam: compleet[0].name }), tone: "ink" });
  }

  // En wie er met lege handen stond. Hoort erbij: een uitzending verzwijgt de
  // pijnlijke momenten ook niet.
  for (const p of spelers) {
    if (ingevuld(p.id) === 0) uit.push({ cat: `niets-${p.id}`, text: t("streamNiets", { naam: p.name }), tone: "faint" });
  }

  return uit;
}
