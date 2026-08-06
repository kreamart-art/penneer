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
import { LogOut } from "lucide-react";
import { KADER_LIJN_ROOD, NeonKader } from "../components/ProfileHero";
import { Scorebord } from "../components/Scorebord";
import { Hulpbalk } from "../components/Hulpbalk";
import { KeuzeMachine } from "../components/KeuzeMachine";
import { HULPEN, Klokbalk, Ladder, LADDER_BREED, LADDER_VERH, SECTIE, SomVenster, TabKader } from "./_PreviewRekenladder";
import { VAK } from "./Arena";
import { Screen } from "../components/Layout";
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

/** De moeilijkheidsladder.
 *
 *  De pot verdubbelt vanzelf, dus de inzet loopt hard op; de VRAAG moet dan mee
 *  omhoog, anders is ronde twaalf net zo makkelijk als ronde een en wordt de
 *  score een kwestie van geduld. Twee knoppen, en ze lopen expres niet gelijk
 *  op: eerst krimpt de klok, daarna draait de vraag om.
 *
 *    ronde 1..3    12s   welke IS een X          — kennismaken
 *    ronde 4..6    10s   welke IS een X          — dezelfde vraag, minder tijd
 *    ronde 7..9     9s   om en om omgekeerd      — nu moet je alle vier lezen
 *    ronde 10+      8s   altijd omgekeerd        — lezen onder druk
 *
 *  De OMGEKEERDE vraag ("welke hoort hier niet") is het echte scharnier: bij de
 *  gewone vraag scan je tot je de goede ziet en tik je, bij de omgekeerde moet
 *  je alle vier de woorden wegen. Dat is een ander soort werk en niet alleen
 *  sneller hetzelfde werk, en dat is precies wat een moeilijkheidsgraad hoort te
 *  doen. */
export function trapVoor(ronde: number): { venster: number; omgekeerd: boolean } {
  if (ronde <= 3) return { venster: 12, omgekeerd: false };
  if (ronde <= 6) return { venster: 10, omgekeerd: false };
  if (ronde <= 9) return { venster: 9, omgekeerd: ronde % 2 === 1 };
  return { venster: 8, omgekeerd: true };
}

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

export type Vraag = { cat: string; opties: string[]; goed: string; omgekeerd: boolean };

/** Vraag `i` van deze poging. Puur uit de seed, dus twee spelers met dezelfde
 *  seed krijgen dezelfde reeks.
 *
 *  Gewoon: drie afleiders uit DRIE andere categorieën, want twee woorden uit
 *  dezelfde hoek naast elkaar maken de goede te makkelijk te vinden.
 *  Omgekeerd: drie woorden uit ÉÉN categorie plus één buitenstaander, en de
 *  buitenstaander is dan het goede antwoord. */
export function vraagVoor(seed: string, i: number, en: boolean, omgekeerd: boolean): Vraag {
  const r = rollen(`${seed}:${i}`);
  const kies = <T,>(rij: readonly T[]): T => rij[Math.floor(r() * rij.length)];
  const woord = (p: Paar) => (en ? p[1] : p[0]);
  const cat = CATS[Math.floor(r() * CATS.length)];
  const anders = CATS.filter((c) => c !== cat);
  const gebruikt = new Set<string>();
  const uniek = (c: string): string => {
    for (let poging = 0; poging < 40; poging++) {
      const w = woord(kies(BANK[c]));
      if (!gebruikt.has(w)) { gebruikt.add(w); return w; }
    }
    return woord(BANK[c][0]);
  };

  if (omgekeerd) {
    // Drie uit dezelfde categorie, één van buiten. Die ene is het antwoord.
    const drie = [uniek(cat), uniek(cat), uniek(cat)];
    const buiten = uniek(kies(anders));
    const opties = [...drie];
    opties.splice(Math.floor(r() * 4), 0, buiten);
    return { cat, opties, goed: buiten, omgekeerd: true };
  }
  const goed = uniek(cat);
  const fout = [uniek(anders[0]), uniek(anders[1]), uniek(anders[2 % anders.length])];
  const opties = [...fout];
  opties.splice(Math.floor(r() * 4), 0, goed);
  return { cat, opties, goed, omgekeerd: false };
}

/** De machine staat breder dan de ladder (84,9vw), want tijdens de keuze is hij
 *  het enige dat er staat: scorebord, vraagpaneel en hulpbalk zijn dan mee uit
 *  beeld gevallen. Breder dan dit kan niet zonder de pagina zijwaarts te laten
 *  schuiven. */
const MACHINE_BREED = "96vw";

// ---- het spel ---------------------------------------------------------------

export function Waaghet({ seed, onKlaar }: {
  seed: string;
  /** (score, level, ms) — score is de geïncasseerde pot, level het aantal goede
   *  antwoorden. */
  onKlaar?: (score: number, level: number, timeMs: number) => void;
}) {
  const { t, tCat, lang } = useT();
  const en = lang === "en";
  // De zaal om het spel heen. Elk arenaspel zet zijn eigen decor zodra het
  // begint (de arena haalt de hal van het voorportaal juist weg), en Waag het
  // was de enige die dat niet deed: dan zie je tijdens het spel de gewone
  // achtergrond van de app, en die is veel lichter dan een zaal.
  useEffect(() => {
    document.body.classList.add("waagspel");
    return () => document.body.classList.remove("waagspel");
  }, []);
  const [ronde, setRonde] = useState(1);
  const [goed, setGoed] = useState(0);
  const [fase, setFase] = useState<"vraag" | "keuze" | "klaar">("vraag");
  const [oordeel, setOordeel] = useState<{ gekozen: string | null; goed: boolean } | null>(null);
  const [rest, setRest] = useState(1);         // deel van het venster dat over is
  const [seconden, setSeconden] = useState(12);
  // De hulpen. Elk EEN keer per poging, net als bij de Rekenladder: dat is de
  // rem op een pot die zichzelf verdubbelt.
  const [voorraad] = useState<Record<string, number>>({ vriend: 1, ververs: 1, vijftig: 1 });
  const [gebruikt, setGebruikt] = useState<string[]>([]);
  const [vers, setVers] = useState(0);          // ververs-teller, zit in de seed
  const [weg, setWeg] = useState<string[]>([]); // door 50/50 weggehaald
  const [tip, setTip] = useState<string | null>(null);
  const [uitslag, setUitslag] = useState<{ score: number; verloren: boolean } | null>(null);
  // De ladder valt uit beeld zodra je het goed hebt; op zijn plek zakt de
  // machine naar binnen. Twee losse stappen, want ze delen dezelfde ruimte.
  const [valt, setValt] = useState(false);

  const trap = useMemo(() => trapVoor(ronde), [ronde]);
  const vraag = useMemo(
    () => vraagVoor(`${seed}:${vers}`, ronde, en, trap.omgekeerd),
    [seed, vers, ronde, en, trap.omgekeerd],
  );
  const pot = potNa(goed);
  const volgendePot = potNa(goed + 1);

  const begon = useRef(performance.now());
  const deadline = useRef(performance.now());
  const afgerond = useRef(false);

  const eindig = useCallback((score: number, verloren: boolean) => {
    if (afgerond.current) return;
    afgerond.current = true;
    setUitslag({ score, verloren });
    setFase("klaar");
    if (verloren) sound.reject(); else sound.munten();
    onKlaar?.(score, goed, Math.round(performance.now() - begon.current));
  }, [goed, onKlaar]);

  // De klok van DEZE vraag. Op nul ben je alles kwijt: een vraag laten lopen is
  // hetzelfde als hem fout hebben, anders zou wachten gratis zijn.
  useEffect(() => {
    if (fase !== "vraag") return;
    const duur = trap.venster * 1000;
    deadline.current = performance.now() + duur;
    setRest(1);
    setSeconden(trap.venster);
    const id = window.setInterval(() => {
      const over = deadline.current - performance.now();
      setRest(Math.max(0, over / duur));
      setSeconden(Math.max(0, Math.ceil(over / 1000)));
      if (over <= 0) {
        window.clearInterval(id);
        setOordeel({ gekozen: null, goed: false });
        window.setTimeout(() => eindig(0, true), 900);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [fase, ronde, vers, trap.venster, eindig]);

  const kies = (w: string) => {
    if (fase !== "vraag" || oordeel || weg.includes(w)) return;
    const juist = w === vraag.goed;
    setOordeel({ gekozen: w, goed: juist });
    if (juist) {
      sound.approve();
      // 420 ms groen zien, dan valt de ladder (340 ms), dan staat de machine er.
      window.setTimeout(() => setValt(true), 420);
      window.setTimeout(() => {
        setGoed((g) => g + 1);
        setOordeel(null);
        setValt(false);
        setFase("keuze");
      }, 760);
    } else {
      window.setTimeout(() => eindig(0, true), 900);
    }
  };

  const doorgaan = () => {
    sound.uiTap();
    setWeg([]);
    setTip(null);
    setVers(0);
    setRonde((n) => n + 1);
    setFase("vraag");
  };

  /** Een hulp inzetten. Alleen tijdens een vraag en alleen als hij nog ligt. */
  const hulp = (sleutel: string) => {
    if (fase !== "vraag" || oordeel || gebruikt.includes(sleutel) || !(voorraad[sleutel] ?? 0)) return;
    sound.uiTap();
    setGebruikt((g) => [...g, sleutel]);
    if (sleutel === "vijftig") {
      // Twee foute keuzes weg. De klok loopt door: een hulp koopt geen tijd.
      const fout = vraag.opties.filter((w) => w !== vraag.goed);
      setWeg(fout.slice(0, 2));
    } else if (sleutel === "vriend") {
      setTip(vraag.goed);
    } else if (sleutel === "ververs") {
      // Een andere vraag van dezelfde zwaarte, en de klok begint opnieuw. Dat
      // laatste is het punt: verversen redt je als je vastzit, niet als je te
      // laat bent.
      setWeg([]);
      setTip(null);
      setVers((v) => v + 1);
    }
  };

  const stop = () => {
    if (fase === "keuze") { sound.munten(); eindig(pot, false); return; }
    // Tijdens een vraag stoppen kost je de pot niet: je hebt hem al verdiend,
    // je waagt hem alleen niet nog een keer.
    eindig(pot, false);
  };

  const kopregel =
    fase === "klaar"
      ? (uitslag?.verloren ? t("waagKwijt") : t("waagBinnen", { n: uitslag?.score ?? 0 }))
      : vraag.omgekeerd
      ? t("waagVraagOm", { cat: tCat(vraag.cat).toUpperCase() })
      : t("waagVraag", { cat: tCat(vraag.cat).toUpperCase() });

  // Tijdens de keuze blijft ALLEEN de machine staan. Scorebord, vraagpaneel en
  // hulpbalk vallen mee uit beeld met de ladder, maar ze houden hun plek in de
  // kolom: zo staat de machine precies daar waar de ladder stond, en niet
  // ergens hogerop omdat de rest is weggehaald.
  const wegvallen = valt || fase === "keuze";
  const kolom = wegvallen ? "waag-val" : ronde > 1 || fase === "klaar" ? "waag-terug" : undefined;

  return (
    // De kolom maakt een eigen stapellaag, zodat de sluier hieronder op -1 kan
    // staan: dan dekt hij wel de zaal af maar niets van het spel zelf.
    <div style={{ position: "relative", zIndex: 0, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      {/* De zaal gaat op zwart zodra de ladder valt, en weer aan als de machine
          weg is. Hij begint al tijdens de VAL: de zaal dooft terwijl de ladder
          eruit zakt, en de machine komt in het donker aan. */}
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, background: "#000", zIndex: -1,
          opacity: valt || fase === "keuze" ? 1 : 0,
          transition: "opacity .42s ease",
          pointerEvents: "none",
        }}
      />

      <div className={kolom} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Scorebord
          breedte={VAK}
          links={{ kop: t("waagRonde"), waarde: String(ronde) }}
          rechts={{ kop: t("waagPot"), waarde: String(pot) }}
        />
      </div>

      {/* Zelfde vraagpaneel als de Rekenladder: de gouden lijst met de naam op
          een tab, het venster erin en de klok eronder. */}
      <div className={kolom} style={{ width: SECTIE, marginTop: 12 }}>
        <TabKader titel="WAAG HET">
          <span
            style={{
              height: 20, display: "grid", placeItems: "center",
              whiteSpace: "nowrap", lineHeight: 1,
              fontFamily: font.display, fontWeight: 800, fontSize: 15.5, letterSpacing: 0.4,
              color: "#FFFFFF", textShadow: "0 2px 6px rgba(0,0,0,.6)",
            }}
          >
            {kopregel}
          </span>

          <SomVenster>
            <span
              key={`${ronde}:${vers}:${fase}`}
              className="klem-kom"
              style={{
                lineHeight: 1,
                fontFamily: font.display, fontWeight: 800,
                fontSize: 40, letterSpacing: 1,
                color: "#FFFFFF",
                textShadow: "0 0 18px rgba(255,210,120,.4), 0 2px 4px rgba(0,0,0,.8)",
              }}
            >
              {fase === "klaar" ? (uitslag?.score ?? 0) : tCat(vraag.cat).toUpperCase()}
            </span>
          </SomVenster>

          {fase === "vraag" ? (
            <Klokbalk rest={rest} seconden={seconden} />
          ) : (
            <span style={{ height: 38 }} />
          )}
        </TabKader>
      </div>

      {/* DE PLEK VAN DE LADDER. Die plek blijft gereserveerd, ook als de ladder
          er niet meer is: tijdens de keuze staat de machine op het hart van
          dezelfde ruimte. Vandaar de vaste hoogte uit de eigen verhouding van de
          ladder, en de machine er absoluut in gecentreerd. */}
      <div
        style={{
          position: "relative",
          width: "100%", height: `${(LADDER_BREED / LADDER_VERH).toFixed(2)}vw`,
          display: "flex", justifyContent: "center",
        }}
      >
        {fase === "keuze" ? (
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: MACHINE_BREED }}>
            <KeuzeMachine
              titel={t("waagKiesTitel")}
              potKop={t("waagPot")}
              pot={pot}
              volgende={volgendePot}
              pakLabel={t("waagIncasseer", { n: pot })}
              doorLabel={t("waagDoorgaan")}
              onPak={() => { sound.munten(); eindig(pot, false); }}
              onDoor={doorgaan}
            />
          </div>
        ) : (
          <div className={kolom} style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <Ladder
              keuzes={vraag.opties}
              antwoord={vraag.goed}
              oordeel={oordeel}
              onKies={kies}
              slapend={false}
              klaar={fase === "klaar"}
              weg={weg}
              tip={tip}
            />
          </div>
        )}
      </div>

      {/* De hulpbalk onder de ladder, met dezelfde drie hulpen. */}
      <div className={kolom} style={{ marginTop: 10 }}>
        <Hulpbalk
          hulpen={HULPEN.map((h) => ({ ...h, aantal: voorraad[h.sleutel] ?? 0 }))}
          breedte={`${LADDER_BREED}vw`}
          onKies={hulp}
          op={gebruikt}
        />
      </div>

      {/* Incasseren of doorgaan. Tijdens een vraag staat hier de stopknop, want
          ook dan mag je met je pot naar huis. */}
      <div className={kolom} style={{ marginTop: 12, width: SECTIE, display: "flex", flexDirection: "column", gap: 12 }}>
        {fase === "vraag" && pot > 0 && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <NeonKader radius={999} dik={0.5} vulling="zwart" lijn={KADER_LIJN_ROOD} gloed={`0 0 12px ${withAlpha(colors.red, 0.35)}`} binnen={{ padding: 0 }}>
              <button
                onClick={stop}
                className="pressable"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: colors.redHi, fontFamily: font.ui, fontSize: 13, fontWeight: 600, padding: "7px 16px" }}
              >
                <LogOut size={14} /> {t("waagIncasseer", { n: pot })}
              </button>
            </NeonKader>
          </div>
        )}
        {fase === "klaar" && (
          <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 13, color: colors.sub }}>
            {t("waagGoedeAntwoorden", { n: goed })}
          </p>
        )}
      </div>
    </div>
  );
}

/** De testversie achter `?waag`: eigen kop, eigen sleutel, levert niets in.
 *  Dezelfde opzet als de andere vier arenaspellen, zodat je de machine kunt
 *  nakijken zonder een dagronde op te maken. */
export function PreviewWaaghet() {
  const [potje, setPotje] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  return (
    <Screen
      top={
        <div style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>Arena</span>
          <button
            onClick={() => setPotje(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: font.ui, fontSize: 11.5, fontWeight: 600, color: colors.redHi }}
          >
            testversie, telt niet mee
          </button>
        </div>
      }
    >
      <Waaghet key={potje} seed={potje} />
    </Screen>
  );
}

export default PreviewWaaghet;
