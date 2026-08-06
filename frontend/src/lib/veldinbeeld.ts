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

/** Lucht tussen de onderkant van het veld en wat iOS als onderkant van het
 *  zichtbare vak opgeeft.
 *
 *  RUIM, en dat is meetwerk en geen smaak. `visualViewport` trekt op iOS alleen
 *  de TOETSEN af. Wat daar bovenop zweeft telt hij mee als zichtbaar, terwijl
 *  het je veld gewoon afdekt:
 *
 *    de balk met de pijltjes en "Gereed"   ~44 punten
 *    de suggestierij erboven (AutoFill)    ~45 punten
 *
 *  Op 54 punten lag het veld daarom nog precies onder "AutoFill Contact". Honderd
 *  is die twee balken plus een vinger lucht. Staat er geen suggestierij, dan
 *  hangt het veld een stukje hoger, en dat is precies goed: boven de balk in
 *  plaats van ertegenaan. */
const MARGE = 100;
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

function zorgInBeeld(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const layout = document.documentElement.clientHeight || window.innerHeight;
  const toetsenbord = layout - vv.height;
  // Geen toetsenbord? Dan doet de browser het prima zelf.
  if (toetsenbord < DREMPEL) { zetRuimte(0); return; }
  zetRuimte(toetsenbord);

  if (Date.now() < rust) return;
  const el = document.activeElement as HTMLElement | null;
  if (!isVeld(el)) return;

  const r = el.getBoundingClientRect();
  const onder = vv.offsetTop + vv.height;
  // ALTIJD op dezelfde lijn, niet alleen als het veld eronder valt. Anders
  // landt het eerste veld net boven het toetsenbord en staat het tweede
  // halverwege het scherm: dan springt de pagina bij elk veld een ander eind.
  // Vandaar ook omhoog schuiven als het veld te hoog staat, zolang dat kan.
  const teveel = r.bottom + MARGE - onder;
  if (Math.abs(teveel) <= SPELING) return;

  rust = Date.now() + 650;
  const doos = scroller(el);
  if (doos) { doos.scrollBy({ top: teveel, behavior: "smooth" }); return; }

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
  window.scrollBy({ top: teveel, behavior: "smooth" });
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
    // De vertraging staat er omdat de resize op iOS een paar beeldjes na de
    // focus komt, soms in twee stappen: zo meten we als alles staat.
    let timer = 0;
    const straks = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(zorgInBeeld, 140);
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
