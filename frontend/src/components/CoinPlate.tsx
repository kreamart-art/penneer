// Het coins-vak van de skin: de art-plaat met het muntje en het saldo erin.
//
// Uit `coins vak.svg` komen drie breedtes: dezelfde tekening, horizontaal op
// drie maten gezet, met dezelfde hoogte. We kiezen de breedte bij het aantal
// cijfers, zodat een saldo van vijf cijfers niet tegen de rand aan loopt en een
// saldo van twee cijfers niet in een leeg vak zweeft.
//
// Alles rekent met `height`, zodat hetzelfde vak op de main page en in de
// winkel op hun eigen maat kunnen staan zonder dat de verhoudingen verschuiven.
import { colors, font } from "../theme/tokens";

const SIZES = [
  { max: 3, src: "/tiles/coinbar-xs.webp", ratio: 753 / 300 },
  { max: 4, src: "/tiles/coinbar-s.webp", ratio: 958 / 300 },
  { max: 5, src: "/tiles/coinbar.webp", ratio: 1140 / 300 },
  { max: 99, src: "/tiles/coinbar-l.webp", ratio: 1301 / 300 },
];

export function CoinPlate({ coins, height = 33 }: { coins: number; height?: number }) {
  const label = String(coins);
  const size = SIZES.find((s) => label.length <= s.max) ?? SIZES[SIZES.length - 1];
  const width = Math.round(height * size.ratio);
  return (
    <span style={{ position: "relative", display: "block", width, height, lineHeight: 0 }}>
      <img alt="" src={size.src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: height * 0.16 }}>
        <img src="/coin.webp" alt="" width={Math.round(height * 0.62)} height={Math.round(height * 0.62)} style={{ display: "block" }} />
        <span
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: Math.round(height * 0.5),
            lineHeight: 1,
            color: colors.goldHi,
            textShadow: "0 1px 2px rgba(0,0,0,.65)",
          }}
        >
          {label}
        </span>
      </span>
    </span>
  );
}
