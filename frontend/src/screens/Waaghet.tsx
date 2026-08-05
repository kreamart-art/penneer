// WAAG HET, het arenaspel dat de zaterdag overneemt.
//
// HET SPEL is een pot die verdubbelt. Elke vraag die je goed hebt verdubbelt
// wat er ligt, en na elke goede vraag mag je kiezen: incasseren en stoppen, of
// doorgaan. Eén fout en alles is weg. De spanning zit niet in de vraag maar in
// de keuze erna, en die keuze wordt met elke ronde duurder.
//
// Waarom dit spel naast de andere vier past: Rekenladder en Flitsreeks straffen
// een fout meteen af en Lettersoep en Woordketen belonen doorzetten. Hier
// beslis JIJ wanneer het genoeg is, en dat is een ander soort zenuw.
//
// DE VRAGEN komen uit de wereld van het spel zelf: de vijf categorieën.
// "Welke van deze vier is een DIER?" met drie afleiders uit andere categorieën.
// Geen nieuwe kennisbank dus, en er komen er nooit twee dezelfde achter elkaar:
// de vraagvolgorde wordt uit de seed gerold, zodat iedereen op een dag dezelfde
// reeks krijgt en de ranglijst vergelijkbaar blijft.
//
// CEILINGLOOS: de pot verdubbelt en houdt nooit op. Tien goede antwoorden is
// 5120, vijftien is 163840. Zo lopen de scores ver uiteen, precies wat de
// arenaregel vraagt.
//
// Het puntencontract met de server staat in backend/app/arena.py onder
// "waaghet": score is 0 (verloren) of 10 * 2^(level-1) (geïncasseerd). Wijkt de
// een af van de ander, dan keurt de server een eerlijke poging af.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { Screen } from "../components/Layout";
import { KADER_LIJN_GOUD, KADER_LIJN_PAARS, NeonKader } from "../components/ProfileHero";
import { useT } from "../i18n/i18n";
import { sound } from "../sound/sound";
import { colors, font, withAlpha } from "../theme/tokens";

// ---- de vraagbank -----------------------------------------------------------
//
// Vijf categorieën, per categorie vierentwintig woorden, elk in twee talen. Met
// vier keuzes uit vijf categorieën zijn dat duizenden verschillende vragen, dus
// een lijst van deze omvang is genoeg voor een spel dat je per dag hooguit een
// paar keer speelt.
type Paar = readonly [string, string]; // [nl, en]

const BANK: Record<string, readonly Paar[]> = {
  dier: [
    ["Olifant", "Elephant"], ["Tijger", "Tiger"], ["Havik", "Hawk"], ["Zeehond", "Seal"],
    ["Kameel", "Camel"], ["Egel", "Hedgehog"], ["Otter", "Otter"], ["Panter", "Panther"],
    ["Flamingo", "Flamingo"], ["Bever", "Beaver"], ["Kwal", "Jellyfish"], ["Vos", "Fox"],
    ["Struisvogel", "Ostrich"], ["Wolf", "Wolf"], ["Krokodil", "Crocodile"], ["Mier", "Ant"],
    ["Pinguïn", "Penguin"], ["Zebra", "Zebra"], ["Haai", "Shark"], ["Uil", "Owl"],
    ["Buffel", "Buffalo"], ["Slak", "Snail"], ["Lynx", "Lynx"], ["Nijlpaard", "Hippo"],
  ],
  vrucht: [
    ["Appel", "Apple"], ["Peer", "Pear"], ["Mango", "Mango"], ["Kiwi", "Kiwi"],
    ["Ananas", "Pineapple"], ["Banaan", "Banana"], ["Meloen", "Melon"], ["Druif", "Grape"],
    ["Perzik", "Peach"], ["Pruim", "Plum"], ["Kers", "Cherry"], ["Framboos", "Raspberry"],
    ["Papaja", "Papaya"], ["Granaatappel", "Pomegranate"], ["Vijg", "Fig"], ["Dadel", "Date"],
    ["Nectarine", "Nectarine"], ["Abrikoos", "Apricot"], ["Lychee", "Lychee"], ["Guave", "Guava"],
    ["Braam", "Blackberry"], ["Citroen", "Lemon"], ["Mandarijn", "Tangerine"], ["Kokosnoot", "Coconut"],
  ],
  land: [
    ["Brazilië", "Brazil"], ["Japan", "Japan"], ["Kenia", "Kenya"], ["Noorwegen", "Norway"],
    ["Peru", "Peru"], ["Marokko", "Morocco"], ["Suriname", "Suriname"], ["Portugal", "Portugal"],
    ["Vietnam", "Vietnam"], ["Ghana", "Ghana"], ["Chili", "Chile"], ["Kroatië", "Croatia"],
    ["Nepal", "Nepal"], ["IJsland", "Iceland"], ["Cuba", "Cuba"], ["Oeganda", "Uganda"],
    ["Argentinië", "Argentina"], ["Thailand", "Thailand"], ["Polen", "Poland"], ["Senegal", "Senegal"],
    ["Ierland", "Ireland"], ["Bolivia", "Bolivia"], ["Servië", "Serbia"], ["Tunesië", "Tunisia"],
  ],
  beroep: [
    ["Bakker", "Baker"], ["Loodgieter", "Plumber"], ["Tandarts", "Dentist"], ["Piloot", "Pilot"],
    ["Timmerman", "Carpenter"], ["Kapper", "Barber"], ["Slager", "Butcher"], ["Advocaat", "Lawyer"],
    ["Verpleegster", "Nurse"], ["Boer", "Farmer"], ["Schilder", "Painter"], ["Chauffeur", "Driver"],
    ["Architect", "Architect"], ["Visser", "Fisherman"], ["Journalist", "Journalist"], ["Monteur", "Mechanic"],
    ["Kok", "Cook"], ["Brandweerman", "Firefighter"], ["Rechter", "Judge"], ["Fotograaf", "Photographer"],
    ["Apotheker", "Pharmacist"], ["Dirigent", "Conductor"], ["Metselaar", "Bricklayer"], ["Rapper", "Rapper"],
  ],
  stad: [
    ["Amsterdam", "Amsterdam"], ["Praag", "Prague"], ["Napels", "Naples"], ["Lima", "Lima"],
    ["Kaapstad", "Cape Town"], ["Boedapest", "Budapest"], ["Osaka", "Osaka"], ["Sevilla", "Seville"],
    ["Antwerpen", "Antwerp"], ["Nairobi", "Nairobi"], ["Toronto", "Toronto"], ["Lissabon", "Lisbon"],
    ["Istanbul", "Istanbul"], ["Boekarest", "Bucharest"], ["Bogota", "Bogota"], ["Riga", "Riga"],
    ["Dakar", "Dakar"], ["Hanoi", "Hanoi"], ["Bern", "Bern"], ["Casablanca", "Casablanca"],
    ["Manilla", "Manila"], ["Oslo", "Oslo"], ["Quito", "Quito"], ["Tbilisi", "Tbilisi"],
  ],
};
const CATS = Object.keys(BANK);

/** De pot na `n` goede antwoorden. Nul goed is nul pot: pas je eerste goede
 *  antwoord legt er iets op tafel. Moet gelijk lopen met arena.py. */
export function potNa(n: number): number {
  return n <= 0 ? 0 : 10 * 2 ** (n - 1);
}

/** Seconden per vraag. Ruim genoeg om te lezen en te kiezen; de spanning zit in
 *  de keuze erna, niet in de klok. */
const VENSTER = 12;

// ---- de reeks uit de seed ---------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Een teller die uit dezelfde seed altijd dezelfde reeks geeft. */
function rollen(seed: string) {
  let x = hash(seed) || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

export type Vraag = { cat: string; opties: string[]; goed: number };

/** Vraag `i` van deze poging: welke categorie gevraagd wordt, vier woorden en
 *  welk woord het goede is. Puur uit de seed, dus twee spelers met dezelfde
 *  seed krijgen dezelfde vragen in dezelfde volgorde. */
export function vraagVoor(seed: string, i: number, en: boolean): Vraag {
  const r = rollen(`${seed}:${i}`);
  const kies = <T,>(rij: readonly T[]): T => rij[Math.floor(r() * rij.length)];
  const cat = CATS[Math.floor(r() * CATS.length)];
  const woord = (p: Paar) => (en ? p[1] : p[0]);

  const goedWoord = woord(kies(BANK[cat]));
  const anders = CATS.filter((c) => c !== cat);
  const fout: string[] = [];
  // Drie afleiders uit DRIE verschillende categorieën: twee woorden uit dezelfde
  // hoek naast elkaar maken de goede te makkelijk te vinden.
  const gebruikt = new Set<string>([goedWoord]);
  while (fout.length < 3) {
    const c = anders[(fout.length + Math.floor(r() * anders.length)) % anders.length];
    const w = woord(kies(BANK[c]));
    if (gebruikt.has(w)) continue;
    gebruikt.add(w);
    fout.push(w);
  }
  const opties = [...fout];
  const plek = Math.floor(r() * 4);
  opties.splice(plek, 0, goedWoord);
  return { cat, opties, goed: plek };
}

// ---- het spel ---------------------------------------------------------------

export function Waaghet({ seed, onKlaar }: {
  seed: string;
  /** (score, level, ms) — score is de geïncasseerde pot, level het aantal goede
   *  antwoorden. */
  onKlaar?: (score: number, level: number, timeMs: number) => void;
}) {
  const { t, tCat, lang } = useT();
  const en = lang === "en";
  const [nr, setNr] = useState(0);            // welke vraag we tonen
  const [goed, setGoed] = useState(0);        // hoeveel er goed waren
  const [fase, setFase] = useState<"vraag" | "keuze" | "klaar">("vraag");
  const [gekozen, setGekozen] = useState<number | null>(null);
  const [rest, setRest] = useState(VENSTER);
  const [uitslag, setUitslag] = useState<{ score: number; verloren: boolean } | null>(null);
  const begon = useRef(performance.now());
  const deadline = useRef(performance.now() + VENSTER * 1000);
  const afgerond = useRef(false);

  const vraag = useMemo(() => vraagVoor(seed, nr, en), [seed, nr, en]);
  const pot = potNa(goed);
  const volgendePot = potNa(goed + 1);

  const eindig = useCallback((score: number, verloren: boolean) => {
    if (afgerond.current) return;
    afgerond.current = true;
    setUitslag({ score, verloren });
    setFase("klaar");
    if (verloren) sound.reject(); else sound.win();
    onKlaar?.(score, goed, Math.round(performance.now() - begon.current));
  }, [goed, onKlaar]);

  // De klok van DEZE vraag. Bij nul ben je alles kwijt: een vraag laten lopen is
  // hetzelfde als hem fout hebben, anders zou wachten gratis zijn.
  useEffect(() => {
    if (fase !== "vraag") return;
    deadline.current = performance.now() + VENSTER * 1000;
    setRest(VENSTER);
    const id = window.setInterval(() => {
      const over = Math.max(0, (deadline.current - performance.now()) / 1000);
      setRest(over);
      if (over <= 0) {
        window.clearInterval(id);
        setGekozen(-1);
        window.setTimeout(() => eindig(0, true), 700);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [fase, nr, eindig]);

  const antwoord = (i: number) => {
    if (fase !== "vraag" || gekozen !== null) return;
    setGekozen(i);
    if (i === vraag.goed) {
      sound.approve();
      window.setTimeout(() => {
        setGoed((g) => g + 1);
        setGekozen(null);
        setFase("keuze");
      }, 450);
    } else {
      window.setTimeout(() => eindig(0, true), 700);
    }
  };

  const doorgaan = () => {
    sound.uiTap();
    setNr((n) => n + 1);
    setFase("vraag");
  };

  const incasseren = () => {
    sound.munten();
    eindig(pot, false);
  };

  const frac = Math.max(0, Math.min(1, rest / VENSTER));
  const haast = rest <= 4;

  return (
    <Screen>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
        {/* De pot: het enige getal dat telt. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontFamily: font.wide, fontSize: 13, letterSpacing: 1.6, color: colors.faint, textTransform: "uppercase" }}>
            {t("waagPot")}
          </span>
          <span
            style={{
              fontFamily: font.display, fontWeight: 800, fontSize: 40, lineHeight: 1,
              backgroundImage: "linear-gradient(180deg, #FFF3C4 0%, #FFD873 38%, #F2AE33 68%, #C97C16 100%)",
              WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            }}
          >
            {pot}
          </span>
          {fase === "vraag" && (
            <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub }}>
              {t("waagGoedIs", { n: volgendePot })}
            </span>
          )}
        </div>

        {fase !== "klaar" && (
          <>
            {/* De klok. Loopt hij af, dan ben je alles kwijt. */}
            <div style={{ height: 8, borderRadius: 999, background: withAlpha("#000000", 0.32), overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${frac * 100}%`, borderRadius: 999, background: haast ? colors.red : colors.gold, transition: "width .12s linear" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Timer size={15} color={haast ? colors.redHi : colors.faint} />
              <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 15, color: haast ? colors.redHi : colors.sub }}>
                {Math.ceil(rest)}s
              </span>
            </div>

            <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 15.5, color: colors.ink, lineHeight: 1.5 }}>
              {t("waagVraag", { cat: tCat(vraag.cat).toUpperCase() })}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {vraag.opties.map((woord, i) => {
                const fout = gekozen !== null && gekozen === i && i !== vraag.goed;
                const juist = gekozen !== null && i === vraag.goed;
                return (
                  <NeonKader
                    key={woord}
                    radius={16}
                    dik={0.5}
                    vulling="zwart"
                    lijn={juist ? KADER_LIJN_GOUD : KADER_LIJN_PAARS}
                    gloed={fout ? `0 0 14px ${withAlpha(colors.red, 0.5)}` : undefined}
                    binnen={{ padding: 0 }}
                  >
                    <button
                      onClick={() => antwoord(i)}
                      disabled={fase !== "vraag" || gekozen !== null}
                      className={gekozen === null ? "pressable" : undefined}
                      style={{
                        width: "100%", minHeight: 52, border: "none", background: "transparent",
                        cursor: gekozen === null ? "pointer" : "default",
                        fontFamily: font.display, fontWeight: 700, fontSize: 16,
                        color: fout ? colors.redHi : juist ? colors.gold : colors.ink,
                        padding: "12px 16px",
                      }}
                    >
                      {woord}
                    </button>
                  </NeonKader>
                );
              })}
            </div>
          </>
        )}

        {fase === "keuze" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
            <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13.5, color: colors.sub, lineHeight: 1.5 }}>
              {t("waagKeuze", { pot, volgende: volgendePot })}
            </p>
            <NeonKader radius={999} dik={0.5} vulling="zwart" lijn={KADER_LIJN_GOUD} binnen={{ padding: 0 }}>
              <button
                onClick={incasseren}
                className="pressable"
                style={{ width: "100%", minHeight: 50, border: "none", background: "transparent", cursor: "pointer", fontFamily: font.display, fontWeight: 800, fontSize: 16, color: colors.gold }}
              >
                {t("waagIncasseer", { n: pot })}
              </button>
            </NeonKader>
            <NeonKader radius={999} dik={0.5} vulling="zwart" lijn={KADER_LIJN_PAARS} binnen={{ padding: 0 }}>
              <button
                onClick={doorgaan}
                className="pressable"
                style={{ width: "100%", minHeight: 50, border: "none", background: "transparent", cursor: "pointer", fontFamily: font.display, fontWeight: 800, fontSize: 16, color: colors.ink }}
              >
                {t("waagDoorgaan")}
              </button>
            </NeonKader>
          </div>
        )}

        {fase === "klaar" && uitslag && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 6 }}>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 20, color: uitslag.verloren ? colors.redHi : colors.gold }}>
              {uitslag.verloren ? t("waagKwijt") : t("waagBinnen", { n: uitslag.score })}
            </span>
            <span style={{ fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
              {t("waagGoedeAntwoorden", { n: goed })}
            </span>
          </div>
        )}
      </div>
    </Screen>
  );
}
