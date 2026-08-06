// Het veld waar je in typt blijft BOVEN het toetsenbord staan.
//
// De chat deed dit al met de hand: de invulbalk hangt daar aan het zichtbare
// vak (zie lib/zichtbaarvak.ts) in plaats van aan de pagina. Overal elders
// stond het aan de browser, en die doet het per toestel anders: iOS schuift de
// hele pagina omhoog tot het veld nog nét zichtbaar is (met je woord tegen de
// bovenrand van het toetsenbord aan), en soms schuift hij helemaal niet omdat
// het veld volgens de LAYOUT-viewport al in beeld staat, terwijl het
// toetsenbord er in werkelijkheid overheen ligt.
//
// Deze haak zet dat recht voor elk invoerveld in de app tegelijk. Hij hangt op
// het document, dus een scherm hoeft er niets voor te doen: krijgt een veld de
// aandacht, dan kijkt hij of de onderkant ervan onder de zichtbare rand valt en
// schuift precies zoveel als nodig. Niet meer: een pagina die verspringt terwijl
// je aan het typen bent is erger dan een veld dat een paar punten lager staat.
//
// Waarom `visualViewport` en niet `scrollIntoView`: die laatste rekent met de
// layout-viewport, en die weet niet dat er een toetsenbord staat. Op iOS levert
// hij daarom precies de bug op die we willen weghalen.
import { useEffect } from "react";

/** Lucht tussen de onderkant van het veld en de onderkant van het vak dat iOS
 *  zelf als zichtbaar opgeeft.
 *
 *  KLEIN, en dat is gemeten op het toestel zelf. Op een iPhone 16 met iOS 18.7
 *  meldt Safari met het toetsenbord open een vak van 449 punten hoog, terwijl de
 *  toetsen pas op 564 beginnen en de AutoFill-balk op 501. Wat iOS "verborgen"
 *  noemt is dus ruim vijftig punten meer dan er werkelijk voor staat: op zijn
 *  eigen onderrand zit je al boven die balken. Honderd punten marge duwde het
 *  veld daarom tot bijna buiten beeld (gemeten: onderkant op 24). Zestien is een
 *  haartje lucht en verder niets. */
const MARGE = 16;
/** Onder deze inkorting is er geen toetsenbord maar een adresbalk die wegrolt. */
const DREMPEL = 80;

function isVeld(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

/** De dichtstbijzijnde voorouder die zelf kan scrollen, of null voor de pagina. */
function scroller(el: HTMLElement): HTMLElement | null {
  let p: HTMLElement | null = el.parentElement;
  while (p) {
    const st = getComputedStyle(p);
    const kan = /(auto|scroll)/.test(st.overflowY);
    if (kan && p.scrollHeight > p.clientHeight + 4) return p;
    p = p.parentElement;
  }
  return null;
}

/** Ruimte onderaan de pagina zolang het toetsenbord staat.
 *
 *  Zonder die ruimte KAN de pagina niet ver genoeg scrollen voor de onderste
 *  vakjes: de browser schuift dan het hele beeld op in plaats van de pagina, en
 *  dat is het zweven waarbij de kop half onder de statusbalk verdwijnt en je
 *  alsnog niets ziet. Met een strook ter grootte van het toetsenbord is er
 *  altijd genoeg om te scrollen en blijft de pagina staan waar hij hoort.
 *  Hij staat op #root, dus hij is weg zodra het toetsenbord dat is. */
function zetRuimte(px: number): void {
  document.documentElement.style.setProperty("--toetsenbordruimte", `${Math.round(px)}px`);
}

/** Tot wanneer we onze EIGEN beweging niet als aanleiding zien. Zonder deze rem
 *  schudt het scherm: het zetje is vloeiend, dus een meting halverwege die rit
 *  zegt dat het veld nog niet goed staat, dat levert een nieuw zetje op, en zo
 *  blijven ze elkaar aanjagen. */
let rust = 0;
/** Onder deze afwijking laten we het staan. Een paar punten scheef ziet niemand,
 *  en er nog een rit voor maken voelt als een scherm dat niet stil kan zitten. */
const SPELING = 8;

/** Meetlijn naar de server. Een echte iPhone is van hier niet te debuggen, en
 *  dit raadsel is drie keer op een gok afgeketst; nu eerst kijken wat het
 *  toestel zelf zegt. Maximaal een handvol regels per sessie, en hij mag weg
 *  zodra de oorzaak vaststaat. */
let meldingen = 0;
function meld(data: Record<string, unknown>): void {
  if (meldingen >= 10) return;
  meldingen += 1;
  try {
    void fetch("/api/debug/viewport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      keepalive: true,
    }).catch(() => {});
  } catch { /* meten mag nooit iets breken */ }
}

function zorgInBeeld(poging = 0): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const layout = document.documentElement.clientHeight || window.innerHeight;
  const toetsenbord = layout - vv.height;
  // Geen toetsenbord? Dan doet de browser het prima zelf.
  if (toetsenbord < DREMPEL) {
    zetRuimte(0);
    meld({ tag: "veld-geen-tb", layout, vv: Math.round(vv.height), off: Math.round(vv.offsetTop) });
    return;
  }
  zetRuimte(toetsenbord);

  if (poging === 0 && Date.now() < rust) return;
  const el = document.activeElement as HTMLElement | null;
  if (!isVeld(el)) return;

  const r = el.getBoundingClientRect();
  const onder = vv.offsetTop + vv.height;
  // ALLEEN als het veld te LAAG staat. Het terugtrekken van een veld dat al
  // hoog genoeg staat was de bron van de ellende: iOS schuift zelf ook (het zet
  // het veld boven de toetsen) en verplaatst daarbij zijn eigen kijkvenster, dus
  // een correctie in twee richtingen loopt achter iOS aan en telt zijn zetje er
  // bovenop. Op het toestel gemeten: gevraagd om 237 punten, uitgekomen op 562,
  // waarna het veld aan de bovenkant het beeld uit lag en de volgende meting hem
  // weer terugtrok. Eén richting kan niet pendelen: elke correctie brengt het
  // veld omhoog, en zodra het boven de lijn staat gebeurt er niets meer.
  const teveel = r.bottom + MARGE - onder;
  if (teveel <= SPELING) {
    meld({ tag: "veld-staat-goed", teveel: Math.round(teveel), bottom: Math.round(r.bottom), onder: Math.round(onder) });
    return;
  }

  rust = Date.now() + 650;
  const doos = scroller(el);
  if (doos) {
    doos.scrollBy({ top: teveel, behavior: "auto" });
    if (poging < 2) window.setTimeout(() => zorgInBeeld(poging + 1), 260);
    return;
  }

  // De pagina moet het zetje ook KUNNEN maken. Is er te weinig te scrollen, dan
  // schuift de browser niets en blijft het veld staan waar het stond: dat is
  // waarom het onderste vakje toch onder de balk bleef hangen. Dus eerst de
  // strook onderaan zo groot maken dat het zetje past.
  //
  // En daarna de layout FORCEREN, want zonder die aanraking rekent het scrollen
  // nog met de oude paginahoogte en wordt het zetje alsnog afgekapt.
  const doc = document.documentElement;
  const beschikbaar = doc.scrollHeight - doc.clientHeight - window.scrollY;
  if (teveel > beschikbaar) {
    zetRuimte(toetsenbord + (teveel - beschikbaar) + 8);
    void doc.offsetHeight;
  }
  const voorY = window.scrollY;
  // Niet vloeiend: een rit van een paar honderd milliseconden loopt door
  // terwijl iOS zelf ook schuift, en dan meet de volgende gebeurtenis halverwege
  // twee bewegingen. In één keer zetten is lelijker en veel voorspelbaarder.
  window.scrollBy({ top: teveel, behavior: "auto" });
  meld({
    tag: "veld-zet", teveel: Math.round(teveel), tb: Math.round(toetsenbord),
    bottom: Math.round(r.bottom), onder: Math.round(onder),
    y: Math.round(voorY), sh: doc.scrollHeight, ch: doc.clientHeight, besch: Math.round(beschikbaar),
  });
  window.setTimeout(() => {
    const na = (document.activeElement as HTMLElement | null)?.getBoundingClientRect();
    meld({ tag: "veld-na", p: poging, y: Math.round(window.scrollY), bottom: na ? Math.round(na.bottom) : -1, sh: doc.scrollHeight });
  }, 500);

  // NAKIJKEN. Het zetje komt niet altijd helemaal aan: op het toestel gemeten
  // ging er 389 in terwijl er 418 gevraagd was, en dat verschil is precies
  // genoeg om de balk weer op het vakje te laten liggen. Dus meteen daarna nog
  // een keer meten en het restje bijleggen. Twee keer, meer niet, en alleen
  // omhoog, dus dit kan niet aan het pendelen slaan.
  if (poging < 2) window.setTimeout(() => zorgInBeeld(poging + 1), 260);
}

/** Roep dit ÉÉN keer aan, op het hoogste niveau van de app. */
export function useVeldInBeeld(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Twee aanleidingen, en niet meer dan dat: je tikt een veld aan (focusin) of
    // het toetsenbord komt of gaat (resize). NIET op scroll: dat was de derde,
    // en die maakte er een schudpartij van. Elk zetje is zelf een scroll, dus
    // die luisteraar hoorde vooral zichzelf, en wie tijdens het typen even
    // wegschoof werd meteen teruggetrokken.
    //
    // De vertraging is RUIM, want iOS schuift zelf ook: hij zet het veld boven
    // de toetsen zodra het toetsenbord er is. Meten we daar middenin, dan
    // corrigeren we een beeld dat nog beweegt. Pas als iOS klaar is heeft onze
    // meting betekenis.
    let timer = 0;
    const straks = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(zorgInBeeld, 350);
    };
    document.addEventListener("focusin", straks, true);
    vv.addEventListener("resize", straks);
    return () => {
      zetRuimte(0);
      window.clearTimeout(timer);
      document.removeEventListener("focusin", straks, true);
      vv.removeEventListener("resize", straks);
    };
  }, []);
}
