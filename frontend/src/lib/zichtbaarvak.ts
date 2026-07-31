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
 */
export function useVakLaag(): React.RefObject<HTMLDivElement | null> {
  const laag = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = laag.current;
    if (!vv || !el) return;
    const sync = () => {
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);
  return laag;
}
