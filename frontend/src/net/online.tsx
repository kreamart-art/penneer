// Is er verbinding? Als state, en niet als een losse luisteraar per scherm.
//
// `navigator.onLine` alleen is te goedgelovig: hij zegt alleen of er een
// netwerkkaart aanstaat. Een wifi zonder internet, een hotelportaal, een mast
// met een streepje: dat leest allemaal als online terwijl er niets doorkomt.
// Vandaar een hartslag naar de server erbij (/healthz, die bestond al voor de
// wachter). Andersom vertrouwen we `navigator.onLine` wel als hij OFFLINE zegt:
// dan is er zeker niets, en hoeven we niet te wachten op een mislukte hartslag.
//
// GEDEMPT, want anders knippert het scherm. Offline mag pas staan na twee
// mislukte hartslagen achter elkaar, en online is meteen goed: een speler die
// weer verbinding heeft hoort dat niet vijf tellen later te merken.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** Hoe vaak we kloppen. Goed: rustig. Stuk: sneller, want dan zit iemand te
 *  wachten tot het weer werkt. TWIJFEL: meteen, want zolang we niet zeker zijn
 *  staat de app nog aan en kan iemand op een tegel drukken die niets kan doen.
 *  Die eerste hertest binnen anderhalve tel is precies het verschil tussen "de
 *  knop doet niets" en "de knop legt uit waarom". */
const KLOP_GOED_MS = 15_000;
const KLOP_STUK_MS = 5_000;
const KLOP_TWIJFEL_MS = 1_200;
/** Zoveel mislukte kloppen achter elkaar voordat we het offline noemen. */
const NODIG_VOOR_OFFLINE = 2;
/** Een hartslag die blijft hangen is ook een mislukte hartslag. */
const KLOP_TIMEOUT_MS = 4_000;

const OnlineCtx = createContext(true);

/** True zolang de app de server kan bereiken. */
export const useOnline = () => useContext(OnlineCtx);

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const missers = useRef(0);
  const bezig = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const klop = useCallback(async () => {
    if (bezig.current) return;
    // De browser weet het soms zeker: geen netwerkkaart, dus niet kloppen.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      missers.current = NODIG_VOOR_OFFLINE;
      setOnline(false);
      return;
    }
    bezig.current = true;
    const stop = new AbortController();
    const kap = window.setTimeout(() => stop.abort(), KLOP_TIMEOUT_MS);
    try {
      // `no-store` zodat een gecacht antwoord nooit doorgaat voor een levende
      // server, en de teller in de URL zodat geen enkele tussenlaag hem bewaart.
      const r = await fetch(`/healthz?t=${Date.now()}`, { cache: "no-store", signal: stop.signal });
      if (!r.ok) throw new Error(String(r.status));
      missers.current = 0;
      setOnline(true);
    } catch {
      missers.current += 1;
      if (missers.current >= NODIG_VOOR_OFFLINE) setOnline(false);
    } finally {
      window.clearTimeout(kap);
      bezig.current = false;
    }
  }, []);

  useEffect(() => {
    let leeft = true;
    const plan = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        if (!leeft) return;
        await klop();
        plan();
      }, missers.current === 0
        ? KLOP_GOED_MS
        : missers.current < NODIG_VOOR_OFFLINE
          ? KLOP_TWIJFEL_MS
          : KLOP_STUK_MS);
    };
    // EERST KLOPPEN, DAN PLANNEN. Andersom leest `plan` de teller terwijl de
    // eerste klop nog onderweg is: die staat dan op nul, en dus stond de
    // hertest na een mislukte start dertig tellen weg. De app bleef daardoor
    // "online" denken terwijl er niets was.
    const rondje = async () => { await klop(); plan(); };
    void rondje();

    // De browsermeldingen zijn een SEIN, geen waarheid: ze zetten de hartslag
    // aan het werk in plaats van de stand.
    const aan = () => { missers.current = 0; void rondje(); };
    const uit = () => { missers.current = NODIG_VOOR_OFFLINE; setOnline(false); plan(); };
    // Terug uit de achtergrond hoort meteen een controle te geven: een telefoon
    // in je zak heeft geen timers gedraaid en de stand kan uren oud zijn.
    const zichtbaar = () => { if (document.visibilityState === "visible") void rondje(); };
    window.addEventListener("online", aan);
    window.addEventListener("offline", uit);
    document.addEventListener("visibilitychange", zichtbaar);
    return () => {
      leeft = false;
      window.clearTimeout(timer.current);
      window.removeEventListener("online", aan);
      window.removeEventListener("offline", uit);
      document.removeEventListener("visibilitychange", zichtbaar);
    };
  }, [klop]);

  return <OnlineCtx.Provider value={online}>{children}</OnlineCtx.Provider>;
}
