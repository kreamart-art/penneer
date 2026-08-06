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

/** Lucht tussen de onderkant van het veld en de bovenkant van het toetsenbord.
 *
 *  RUIM, en dat is geen smaak. Boven het toetsenbord zweeft op iOS nog een balk
 *  (de pijltjes met "Gereed", en soms een suggestiebalk of AutoFill eroverheen)
 *  die NIET in `visualViewport` zit. Op achttien punten lag het veld daar precies
 *  onder en kon je niet zien wat je typte. Vierenvijftig is die balk plus een
 *  vinger lucht, zodat het veld erboven staat en niet ertegenaan. */
const MARGE = 54;
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

function zorgInBeeld(): void {
  const el = document.activeElement as HTMLElement | null;
  const vv = window.visualViewport;
  if (!vv) return;
  const layout = document.documentElement.clientHeight || window.innerHeight;
  const toetsenbord = layout - vv.height;
  // Geen toetsenbord? Dan doet de browser het prima zelf.
  if (toetsenbord < DREMPEL) { zetRuimte(0); return; }
  zetRuimte(toetsenbord);
  if (!isVeld(el)) return;

  const r = el.getBoundingClientRect();
  const onder = vv.offsetTop + vv.height;
  // ALTIJD op dezelfde lijn, niet alleen als het veld eronder valt. Anders
  // landt het eerste veld net boven het toetsenbord en staat het tweede
  // halverwege het scherm: dan springt de pagina bij elk veld een ander eind.
  // Vandaar ook omhoog schuiven als het veld te hoog staat, zolang dat kan.
  const teveel = r.bottom + MARGE - onder;
  if (Math.abs(teveel) <= 2) return;

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
      zetRuimte(0);
      window.clearTimeout(timer);
      document.removeEventListener("focusin", straks, true);
      vv.removeEventListener("resize", straks);
      vv.removeEventListener("scroll", straks);
    };
  }, []);
}
