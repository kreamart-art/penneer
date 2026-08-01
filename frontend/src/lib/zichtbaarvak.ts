// Het stuk scherm dat je NU echt ziet, en of het toetsenbord open staat.
//
// Op iOS maakt het toetsenbord de pagina niet kleiner: Safari schuift hem
// omhoog zodat het invoerveld in beeld komt. `position: fixed` hangt aan de
// PAGINA, dus een lade die onderaan het scherm zit schuift mee omhoog en zijn
// kop verdwijnt boven de rand. `visualViewport` vertelt precies welk rechthoekje
// nog zichtbaar is; daar hangen we de lade aan op.
//
// Hetzelfde trucje staat in [components/Arena.tsx] voor de decorlaag. Daar is
// het een effect op een ref, hier een hook, want een lade moet ook zijn HOOGTE
// laten afhangen van het antwoord en niet alleen zijn positie.
import { useEffect, useRef, useState } from "react";

export type ZichtbaarVak = {
  /** Hoever het zichtbare deel onder de bovenkant van de pagina begint. */
  top: number;
  /** De hoogte van dat zichtbare deel. */
  hoogte: number;
  /** Hoeveel er ONDERAAN wordt afgedekt. Vrijwel altijd de toetsenbordhoogte. */
  bedekt: number;
  /** Is er een flink stuk scherm afgedekt? Vrijwel altijd het toetsenbord. */
  gekrompen: boolean;
};

// Bewust GEEN "staat het toetsenbord open"-vlag. De eerste versie had er een,
// afgeleid uit window.innerHeight min de zichtbare hoogte, en die klopte niet:
// in de geinstalleerde app op iOS krimpt window.innerHeight MEE met het
// toetsenbord, dus het verschil bleef nul. Wie deze hoogte als MAXIMUM gebruikt
// heeft die vlag ook niet nodig, en dat is meteen een maat minder om fout te
// hebben.

/** Onder deze inkorting is het geen toetsenbord maar een adresbalk die wegrolt. */
const DREMPEL = 80;

function meet(): ZichtbaarVak {
  const vv = window.visualViewport;
  if (!vv) return { top: 0, hoogte: window.innerHeight, bedekt: 0, gekrompen: false };
  // De maat om tegen af te zetten is `clientHeight` van het document: dat IS de
  // layout-viewport en die blijft staan als het toetsenbord opkomt. De eerste
  // versie gebruikte hiervoor window.innerHeight, en die krimpt in de
  // geinstalleerde app op iOS wel degelijk mee; toen was het verschil altijd
  // nul. Wat hiervan afhangt blijft daarom klein (een marge, geen layout): gaat
  // het ooit toch mis op een toestel, dan kost het een randje en geen scherm.
  const layout = document.documentElement.clientHeight || window.innerHeight;
  return {
    top: Math.round(vv.offsetTop),
    hoogte: vv.height,
    bedekt: Math.max(0, Math.round(layout - vv.height - vv.offsetTop)),
    gekrompen: layout - vv.height > DREMPEL,
  };
}

export function useZichtbaarVak(): ZichtbaarVak {
  const [vak, setVak] = useState<ZichtbaarVak>(meet);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => setVak(meet());
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
  return vak;
}

/** Hangt een laag aan het zichtbare vak: even hoog, en meegeschoven met de
 *  pagina. Zet hem op een element met `position: fixed` en `inset: 0`.
 *
 *  Rechtstreeks op het element en niet via React-staat: dit moet gebeuren in
 *  hetzelfde beeldje waarin het toetsenbord beweegt, en een omweg langs een
 *  hertekening loopt daar een paar beeldjes achteraan.
 *
 *  Geef deze laag GEEN css-overgang. iOS animeert het toetsenbord zelf en
 *  stuurt onderweg tientallen meldingen; een eigen overgang rent daar achteraan
 *  en dat zie je als flikkering. En zet er een DEKKENDE laag onder die het hele
 *  scherm vult: deze laag is per definitie kleiner dan het scherm, en zonder
 *  bodem eronder kijk je in dat verschil naar de pagina die eronder ligt.
 */
export function useVakLaag(): {
  laag: React.RefObject<HTMLDivElement | null>;
  onder: React.RefObject<HTMLDivElement | null>;
} {
  const laag = useRef<HTMLDivElement | null>(null);
  // De strook ONDER het zichtbare vak: precies het stuk dat het toetsenbord
  // afdekt. Nodig omdat het toetsenbord van iOS doorschijnend is: je kijkt er
  // dwars doorheen naar wat eronder ligt, en dat was het scherm achter de chat.
  // Vul je die strook met de kleur van de invulbalk, dan loopt de balk optisch
  // door tot onderaan de telefoon en zie je door het toetsenbord heen niets
  // anders meer dan de chat zelf.
  const onder = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = laag.current;
    if (!vv || !el) return;
    const sync = () => {
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
      const strook = onder.current;
      if (strook) {
        // Alleen de ONDERKANT van het zichtbare vak, en verder geen enkele
        // meting: de strook hangt met `bottom: 0` aan de onderrand van zijn
        // ouder en begint waar het zichtbare vak ophoudt. Wat ertussen zit is
        // per definitie precies wat er afgedekt wordt.
        //
        // De eerste versie rekende met documentElement.clientHeight, en die
        // krimpt in de geinstalleerde app op iOS MEE met het toetsenbord (net
        // als window.innerHeight). Het verschil was daar altijd nul en de
        // strook dus onzichtbaar. Deze vorm heeft dat probleem niet: hij vraagt
        // nooit hoe hoog het scherm is.
        strook.style.top = `${vv.offsetTop + vv.height}px`;
      }
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
  return { laag, onder };
}

/** Houdt een lijst op zijn ONDERSTE bericht zodra het toetsenbord opkomt.
 *
 *  Zonder dit springt de chat naar het midden. De lijst hangt aan het zichtbare
 *  vak, dus als het toetsenbord opkomt wordt hij korter, maar de browser laat
 *  `scrollTop` staan waar hij stond. Dat getal telt vanaf de BOVENKANT, dus een
 *  lijst die onderaan stond staat na het krimpen ineens een halve pagina te
 *  hoog. Precies wat je niet wil op het moment dat je gaat typen: dan hoor je
 *  het laatste bericht te zien.
 *
 *  Alleen bij een echte hoogtewijziging, niet bij elk voorval. iOS stuurt ook
 *  `scroll` als je de pagina meesleept, en dan zou de lijst je omlaag trekken
 *  terwijl je juist iets terugleest.
 *
 *  Drie keer pinnen per wijziging, en dat is geen slordigheid: iOS meldt de
 *  nieuwe hoogte VOORDAT hij de bladzijde opnieuw heeft opgemaakt, dus de eerste
 *  keer reken je nog met de oude `scrollHeight`. Een beeldje later klopt hij
 *  meestal, en de late derde vangt de toestellen waar het toetsenbord eroverheen
 *  schuift in plaats van meteen open te klappen.
 */
export function useBlijfOnderaan(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let hoogte = vv.height;
    let beeldje = 0;
    let laat = 0;
    const pin = () => {
      const el = ref.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    const sync = () => {
      if (Math.abs(vv.height - hoogte) < 1) return;
      hoogte = vv.height;
      pin();
      cancelAnimationFrame(beeldje);
      beeldje = requestAnimationFrame(pin);
      window.clearTimeout(laat);
      laat = window.setTimeout(pin, 180);
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      cancelAnimationFrame(beeldje);
      window.clearTimeout(laat);
    };
  }, [ref]);
}
