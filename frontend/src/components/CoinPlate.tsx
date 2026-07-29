// Het coins-vak van de skin: de art-plaat met het muntje en het saldo erin.
//
// Uit `coins vak.svg` komen drie breedtes: dezelfde tekening, horizontaal op
// drie maten gezet, met dezelfde hoogte. We kiezen de breedte bij het aantal
// cijfers, zodat een saldo van vijf cijfers niet tegen de rand aan loopt en een
// saldo van twee cijfers niet in een leeg vak zweeft.
//
// Alles rekent met `height`, zodat hetzelfde vak op de main page en in de
// winkel op hun eigen maat kunnen staan zonder dat de verhoudingen verschuiven.
import { font } from "../theme/tokens";

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
  const label = String(coins);
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
