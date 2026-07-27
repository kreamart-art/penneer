// iOS-only launch-glitch fix voor de geïnstalleerde PWA.
//
// WebKit lanceert een standalone web-app soms tegen een VEROUDERDE, te korte
// layout-viewport (alsof er nog browser-chrome onder de pagina zit). Alles wat
// aan de viewport hangt, de vaste navigatiebalk, de fixed achtergrondlaag en
// 100dvh, wordt dan te hoog gelegd en onderaan blijft een onbeschilderde
// strook staan, tot de EERSTE swipe WebKit de echte hoogte laat herberekenen.
// Dit is een WebKit-bug en geen CSS van ons: exact dezelfde paint staat na
// een swipe wel goed.
//
// De genezing is dus die swipe zelf geven. Maak het document heel even 2px
// scrollbaar (onzichtbare spacer), scroll 1px heen en terug (echte
// scroll-events, dus een viewport-herberekening) en ruim de spacer weer op.
import { isIos, isStandalone } from "./install";

const stale = (): boolean => {
  // Alleen staand relevant (het spel is portrait); liggend en iPad-split-view
  // hebben legitiem kleinere hoogtes en blijven erbuiten.
  if (window.innerWidth > window.innerHeight) return false;
  // screen.width/height staan op iOS vast in portret-orientatie, dus de lange
  // kant is de hoogte die een standalone app (viewport-fit=cover) moet krijgen.
  const expected = Math.max(screen.width, screen.height);
  return window.innerHeight + 1 < expected;
};

const nudge = (): void => {
  const spacer = document.createElement("div");
  spacer.style.cssText = "position:absolute;top:0;left:0;width:1px;pointer-events:none;visibility:hidden;";
  spacer.style.height = `${window.innerHeight + 2}px`;
  document.body.appendChild(spacer);
  window.scrollTo(0, 1);
  window.scrollTo(0, 0);
  requestAnimationFrame(() => spacer.remove());
};

/** Waak bij het opstarten en bij terugkeer uit de achtergrond; duw de viewport
 *  recht zodra hij te kort blijkt. Doet niets wanneer alles al klopt. */
export function armViewportHealer(): void {
  if (!isIos() || !isStandalone()) return;
  const heal = () => {
    // Een paar pogingen kort na elkaar: de verkeerde hoogte verschijnt soms
    // pas na de splash-overgang. Elke poging checkt eerst; nooit een lus.
    for (const ms of [0, 250, 900]) {
      window.setTimeout(() => {
        if (stale()) nudge();
      }, ms);
    }
  };
  heal();
  window.addEventListener("pageshow", heal);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") heal();
  });
}
