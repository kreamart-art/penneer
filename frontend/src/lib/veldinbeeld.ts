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

/** Lucht tussen de onderkant van het veld en de bovenkant van het toetsenbord. */
const MARGE = 14;
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

function zorgInBeeld(): void {
  const el = document.activeElement as HTMLElement | null;
  if (!isVeld(el)) return;
  const vv = window.visualViewport;
  if (!vv) return;
  const layout = document.documentElement.clientHeight || window.innerHeight;
  // Geen toetsenbord? Dan doet de browser het prima zelf.
  if (layout - vv.height < DREMPEL) return;

  const r = el.getBoundingClientRect();
  const onder = vv.offsetTop + vv.height;
  const teveel = r.bottom + MARGE - onder;
  if (teveel <= 1) return;

  const doos = scroller(el);
  if (doos) doos.scrollBy({ top: teveel, behavior: "smooth" });
  else window.scrollBy({ top: teveel, behavior: "smooth" });
}

/** Roep dit ÉÉN keer aan, op het hoogste niveau van de app. */
export function useVeldInBeeld(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Bij het openen van het toetsenbord komt de resize een paar beeldjes na de
    // focus, en op iOS soms in twee stappen. Vandaar beide gebeurtenissen, elk
    // met een kleine vertraging zodat we meten als alles staat.
    let timer = 0;
    const straks = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(zorgInBeeld, 120);
    };
    document.addEventListener("focusin", straks, true);
    vv.addEventListener("resize", straks);
    vv.addEventListener("scroll", straks);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", straks, true);
      vv.removeEventListener("resize", straks);
      vv.removeEventListener("scroll", straks);
    };
  }, []);
}
