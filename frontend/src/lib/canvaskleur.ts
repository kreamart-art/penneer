// De kleur van het DOEK onder de pagina, per scherm.
//
// Waarom dit bestaat, gemeten op een echte iPhone (iOS 18.7, 393x852):
//
//   [viewport] {'tag': 'start0', 'inner': 793, 'client': 793, 'visual': 793,
//               'screen': 852, 'dpr': 3}
//
// WebKit start de geinstalleerde app tegen een layout-viewport van 793 punten
// terwijl het scherm er 852 heeft: precies de 59 punten van de veilige zone
// bovenaan te weinig. De pagina wordt in een doek van 793 hoog geschilderd en
// staat bovenaan het scherm, dus de ONDERSTE 59 punten vallen buiten die
// pagina. Daar helpt geen enkele css: `position: fixed; inset: 0`, `100dvh`,
// `100lvh`, alles meet zich aan diezelfde viewport. Wat je daar ziet is het
// enige wat er nog overblijft, de achtergrondkleur van `html`, en dat is de
// balk waar dit bestand over gaat. (Alleen na een terugkeer uit de achtergrond
// meldt hetzelfde toestel ineens 852; vandaar dat de balk "van tijd tot tijd"
// verschijnt en niet altijd.)
//
// De oplossing is dan ook niet groter tekenen maar die ene kleur laten kloppen:
// zet `html` op de kleur van de ONDERSTE beeldrij van het decor dat op dat
// moment aan staat, en de strook loopt naadloos door met wat erboven eindigt.
// Ze zijn gemeten uit de art zelf, met de vignetlaag erover gerekend.
//
// index.css zet de standaard (het sub-decor). Een scherm met een eigen decor
// hangt deze haak op en zet hem terug zodra het weg is.
import { useEffect } from "react";

/** De onderrand van elk decor, gemeten uit de art + zijn vignet. */
export const CANVAS = {
  /** bg-sub.webp, het decor van de meeste schermen. Staat ook in index.css. */
  sub: "#050211",
  /** bg-main.webp met de ovale lichtplek erover: de main page en de intro. */
  main: "#03010B",
  /** ui/profile-bg.webp: het profiel. */
  profiel: "#03010C",
  /** game-bg.webp in de arena, met basis en vignet: de speelpagina. */
  arena: "#07012B",
  /** duel-bg.webp zonder plaat: alleen de arena-ondergrond. */
  duel: "#09002C",
  /** De invulbalk van de chat, die tot onderaan het scherm doorloopt. */
  chat: "#271A4A",
} as const;

/** Zet de doekkleur zolang dit onderdeel in beeld is. */
export function useCanvasKleur(kleur: string): void {
  useEffect(() => {
    const el = document.documentElement;
    const vorige = el.style.backgroundColor;
    el.style.backgroundColor = kleur;
    return () => {
      el.style.backgroundColor = vorige;
    };
  }, [kleur]);
}
