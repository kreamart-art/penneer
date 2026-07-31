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
import { useEffect, useState } from "react";

export type ZichtbaarVak = {
  /** Hoever het zichtbare deel onder de bovenkant van de pagina begint. */
  top: number;
  /** De hoogte van dat zichtbare deel. */
  hoogte: number;
  /** Staat er een toetsenbord (of iets anders groots) voor het scherm? */
  toetsen: boolean;
};

/** Onder deze inkorting is het geen toetsenbord maar de adresbalk die wegvalt. */
const TOETSENBORD_DREMPEL = 120;

function meet(): ZichtbaarVak {
  const vv = window.visualViewport;
  if (!vv) return { top: 0, hoogte: window.innerHeight, toetsen: false };
  return {
    top: vv.offsetTop,
    hoogte: vv.height,
    toetsen: window.innerHeight - vv.height > TOETSENBORD_DREMPEL,
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
