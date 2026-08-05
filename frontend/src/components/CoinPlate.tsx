// Het coins-vak van de skin: de art-plaat met het muntje en het saldo erin.
//
// Uit `coins vak.svg` komen drie breedtes: dezelfde tekening, horizontaal op
// drie maten gezet, met dezelfde hoogte. We kiezen de breedte bij het aantal
// cijfers, zodat een saldo van vijf cijfers niet tegen de rand aan loopt en een
// saldo van twee cijfers niet in een leeg vak zweeft.
//
// Alles rekent met `height`, zodat hetzelfde vak op de main page en in de
// winkel op hun eigen maat kunnen staan zonder dat de verhoudingen verschuiven.
import { useEffect, useRef, useState } from "react";
import { font } from "../theme/tokens";

/** Het saldo TELT naar zijn nieuwe waarde in plaats van te verspringen.
 *
 *  Bij de eerste render staat het getal er meteen: het oplopen is er om een
 *  VERANDERING te laten voelen, en het openen van de pagina is geen verandering.
 *  Daarna telt elke wijziging in ~0,9s naar de nieuwe stand, met een uitloop
 *  (snel eerst, traag op het eind), want dat is hoe een teller "tot rust komt".
 *  Omlaag telt hij ook, na een uitgave; een teller die alleen omhoog kan lijkt
 *  op een teller die stuk is. */
/** De laatst GETOONDE stand per munt, over schermwissels heen.
 *
 *  Zonder dit telt de teller alleen op als hij al in beeld staat: claim je een
 *  beloning in een popup op een ander scherm, dan is het saldo bij het monteren
 *  van de main page al de nieuwe waarde en zie je niets bewegen. Nu begint hij
 *  waar je hem achterliet en telt hij alsnog op. Een module-variabele en geen
 *  opslag: na een herlaadbeurt heb je niets geclaimd en hoort er ook niets te
 *  lopen. */
const ONTHOUDEN: Record<string, number> = {};

export function useTelOp(doel: number, sleutel?: string): number {
  const begin = sleutel !== undefined && ONTHOUDEN[sleutel] !== undefined ? ONTHOUDEN[sleutel] : doel;
  const [toon, setToon] = useState(begin);
  const van = useRef(begin);
  useEffect(() => {
    const start = van.current;
    if (start === doel) { if (sleutel !== undefined) ONTHOUDEN[sleutel] = doel; return; }
    const t0 = performance.now();
    const duur = 900;
    let raf = 0;
    const stap = () => {
      const t = Math.min(1, (performance.now() - t0) / duur);
      const e = 1 - (1 - t) ** 3;
      const nu = Math.round(start + (doel - start) * e);
      setToon(nu);
      if (sleutel !== undefined) ONTHOUDEN[sleutel] = nu;
      if (t < 1) raf = requestAnimationFrame(stap);
      else { van.current = doel; if (sleutel !== undefined) ONTHOUDEN[sleutel] = doel; }
    };
    raf = requestAnimationFrame(stap);
    return () => {
      cancelAnimationFrame(raf);
      van.current = doel;
      if (sleutel !== undefined) ONTHOUDEN[sleutel] = doel;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doel]);
  return toon;
}

const SIZES = [
  { max: 3, src: "/tiles/coinbar-xs.webp", ratio: 753 / 300 },
  { max: 4, src: "/tiles/coinbar-s.webp", ratio: 958 / 300 },
  { max: 5, src: "/tiles/coinbar.webp", ratio: 1140 / 300 },
  { max: 99, src: "/tiles/coinbar-l.webp", ratio: 1301 / 300 },
];

/* Cash krijgt HETZELFDE vak. Het is dezelfde plaat uit `coins vak.svg`, alleen
 * met het biljet in plaats van het muntje en de groene reeks in plaats van de
 * gouden. Twee verschillende vakvormen naast elkaar op dezelfde regel lezen als
 * twee losse dingen; hetzelfde vak twee keer leest als twee munten. */
export function CashPlate({ cash, height = 33 }: { cash: number; height?: number }) {
  return <CoinPlate coins={cash} height={height} munt="cash" />;
}

export function CoinPlate({ coins, height = 33, munt = "coin" }: { coins: number; height?: number; munt?: "coin" | "cash" }) {
  const label = String(useTelOp(coins, munt));
  const size = SIZES.find((s) => label.length <= s.max) ?? SIZES[SIZES.length - 1];
  const width = Math.round(height * size.ratio);
  return (
    <span style={{ position: "relative", display: "block", width, height, lineHeight: 0 }}>
      <img alt="" src={size.src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: height * 0.16 }}>
        <img
          src={munt === "cash" ? "/ui/valuta/cash.webp?v=1" : "/coin.webp"}
          alt=""
          width={Math.round(height * 0.62)}
          height={Math.round(height * 0.62)}
          style={{ display: "block" }}
        />
        <span
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: Math.round(height * 0.5),
            lineHeight: 1,
            // De felste tint van de reeks, niet de gewone: het cijfer staat op
            // donkere art en moet daar bovenop LIGGEN. De donkere rand eronder
            // is wat hem scherp houdt; een gloed zou hem juist wazig maken.
            color: munt === "cash" ? "#D9F0BE" : "#FFF3CE",
            textShadow: "0 1px 0 rgba(0,0,0,.85), 0 0 10px rgba(0,0,0,.4)",
          }}
        >
          {label}
        </span>
      </span>
    </span>
  );
}
