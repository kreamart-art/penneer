// iOS-only launch-glitch fix voor de geinstalleerde PWA.
//
// WebKit lanceert een standalone web-app soms tegen een VEROUDERDE, te korte
// layout-viewport (alsof er nog browser-chrome onder de pagina zit). Alles wat
// aan de viewport hangt, de vaste navigatiebalk, de fixed achtergrondlaag en
// 100dvh, wordt dan te hoog gelegd en onderaan blijft een onbeschilderde
// strook staan, tot de EERSTE swipe WebKit de echte hoogte laat herberekenen.
// Dit is een WebKit-bug en geen CSS van ons: exact dezelfde paint staat na een
// swipe wel goed.
//
// v1.52.1 probeerde alleen een scroll-zetje en dat was niet genoeg. Nu drie
// hamers achter elkaar, van hard naar zacht, want welke aanslaat verschilt per
// iOS-versie:
//   1. de viewport-meta hertekenen (dwingt WebKit tot een echte herberekening)
//   2. het document even hoger maken en 1px scrollen (de swipe nabootsen)
//   3. een geforceerde reflow, zodat de nieuwe hoogte ook echt geschilderd wordt
// Alle drie zijn onzichtbaar en veranderen niets aan de layout die overblijft.
//
// Er hangt ook een meetlijn aan: standalone iOS stuurt zijn viewport-cijfers
// naar de server (0/400/1200ms na de start, en nog eens na de eerste aanraking),
// zodat we in de logs zien of de hamer werkte in plaats van het te moeten raden.
//
// En die meetlijn heeft geleverd. Op een iPhone met iOS 18.7 (393x852):
//
//   {'tag': 'start0-kort',   'inner': 793, 'client': 793, 'visual': 793, 'screen': 852}
//   {'tag': 'start1200-kort','inner': 793, 'client': 793, 'visual': 793, 'screen': 852}
//   {'tag': 'terug-ok',      'inner': 852, 'client': 852, 'visual': 852, 'screen': 852}
//
// Precies 59 punten te kort, de veilige zone bovenaan, elke start opnieuw, en
// alleen na een terugkeer uit de achtergrond klopt het. De hamers sloegen dus
// mis, en waarom bleek uit hamer 1: die zette een hoogte in de meta en HAALDE
// HEM ER IN HET VOLGENDE BEELDJE WEER AF. Sinds die hoogte blijft staan is dit
// een echte reparatie in plaats van drie pogingen. Wat er onverhoopt toch
// buiten de pagina valt, vangt lib/canvaskleur.ts op.
import { isIos, isStandalone } from "./install";

const MAX_REPORTS = 6;
let sent = 0;

interface Snapshot {
  tag: string;
  inner: number;
  client: number;
  visual: number;
  screen: number;
  dpr: number;
  scrollY: number;
  ua: string;
}

function snapshot(tag: string): Snapshot {
  const vv = window.visualViewport;
  return {
    tag,
    inner: Math.round(window.innerHeight),
    client: document.documentElement.clientHeight,
    visual: vv ? Math.round(vv.height) : -1,
    // screen.width/height staan op iOS vast in portret-orientatie, dus de lange
    // kant is de hoogte die een standalone app (viewport-fit=cover) moet krijgen.
    screen: Math.max(screen.width, screen.height),
    dpr: window.devicePixelRatio,
    scrollY: Math.round(window.scrollY),
    ua: navigator.userAgent.slice(0, 120),
  };
}

function report(tag: string): void {
  if (sent >= MAX_REPORTS) return;
  sent += 1;
  try {
    void fetch("/api/debug/viewport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot(tag)),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* diagnose mag nooit iets breken */
  }
}

/** Is de viewport korter dan het scherm? Alleen zinvol in portret. */
function tooShort(): boolean {
  if (window.innerWidth > window.innerHeight) return false;
  return window.innerHeight + 1 < Math.max(screen.width, screen.height);
}

/** De meta zoals hij in index.html staat, zonder onze toevoeging. */
let metaOrigineel: string | null = null;
/** Staat de opgelegde hoogte erin? Zie de waarschuwing hieronder. */
let opgelegd = false;

/** Zet `height=<scherm>` in de viewport-meta.
 *
 *  Dit is de kern van de reparatie en niet een van de drie hamers. De vorige
 *  versie zette hem er ook in, maar haalde hem er in het volgende beeldje
 *  meteen weer af; de meting daarna las dus altijd de oude, te korte viewport
 *  en de logs stonden vol met "kort".
 *
 *  Eenmaal opgelegd blijft hij staan, en dat is met opzet. Hij WERKT namelijk
 *  als hij werkt: dan meldt de viewport ineens de volle hoogte, en zou een
 *  regel als "haal hem eraf zodra het klopt" hem meteen weer weghalen, waarna
 *  de viewport terugvalt en hij er weer op moet. Dat pendelt door, en elke slag
 *  is een herberekening van de layout. Alleen bij DRAAIEN gaat hij eraf: de
 *  hoogte die we opleggen is de lange kant van het scherm, en in liggend is dat
 *  de verkeerde maat. */
function forceerHoogte(): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  if (metaOrigineel === null) metaOrigineel = meta.getAttribute("content");
  if (!metaOrigineel) return;
  const liggend = window.innerWidth > window.innerHeight;
  const aan = !liggend && (opgelegd || tooShort());
  opgelegd = aan;
  const doel = aan ? `${metaOrigineel}, height=${Math.max(screen.width, screen.height)}` : metaOrigineel;
  if (meta.getAttribute("content") !== doel) meta.setAttribute("content", doel);
}

function hammer(): void {
  // 1. de viewport-meta een hoogte geven. Zolang WebKit een te korte viewport
  //    volhoudt blijft die erin staan; hij verdwijnt vanzelf zodra de hoogte
  //    klopt.
  forceerHoogte();

  // 2. de swipe nabootsen: heel even scrollbaar maken, 1px heen en terug.
  const spacer = document.createElement("div");
  spacer.style.cssText = "position:absolute;top:0;left:0;width:1px;pointer-events:none;visibility:hidden;";
  spacer.style.height = `${window.innerHeight + 2}px`;
  document.body.appendChild(spacer);
  window.scrollTo(0, 1);
  window.scrollTo(0, 0);

  // 3. geforceerde reflow, zodat de herberekende hoogte ook geschilderd wordt.
  void document.documentElement.offsetHeight;
  requestAnimationFrame(() => spacer.remove());
}

/** Waak bij het opstarten en bij terugkeer uit de achtergrond; duw de viewport
 *  recht en meet of het hielp. Doet niets buiten de iOS-app. */
export function armViewportHealer(): void {
  if (!isIos() || !isStandalone()) return;

  const beat = (tag: string) => {
    const before = tooShort();
    // Onvoorwaardelijk slaan: de hamers zijn onzichtbaar en gratis, en de
    // hoogte-check zelf kan net zo goed op verouderde cijfers zitten als de
    // layout die we proberen te repareren.
    hammer();
    window.setTimeout(() => report(`${tag}${before ? "-kort" : "-ok"}`), 60);
  };

  for (const ms of [0, 400, 1200]) window.setTimeout(() => beat(`start${ms}`), ms);

  // En blijven kijken: verandert de viewport (draaien, terugkomen, WebKit die
  // zich alsnog bedenkt), dan gaat de opgelegde hoogte er meteen op of af.
  window.visualViewport?.addEventListener("resize", () => forceerHoogte());
  window.addEventListener("orientationchange", () => window.setTimeout(() => { opgelegd = false; forceerHoogte(); }, 120));

  // De eerste echte aanraking is precies het moment waarop het vanzelf goed
  // ging; die meting vertelt ons de "juiste" hoogte om tegen af te zetten.
  window.addEventListener("touchend", () => report("na-aanraking"), { once: true, passive: true });

  window.addEventListener("pageshow", () => beat("pageshow"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") beat("terug");
  });
}
