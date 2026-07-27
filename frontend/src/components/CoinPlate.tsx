// Het coins-vak van de skin: de art-plaat met het muntje en het saldo erin.
//
// Alles rekent met `width`, zodat hetzelfde vak op de main page klein en in de
// winkel groter kan staan zonder dat de verhoudingen verschuiven.
import { colors, font } from "../theme/tokens";

const RATIO = "760 / 200";

export function CoinPlate({ coins, width = 124 }: { coins: number; width?: number }) {
  return (
    <span style={{ position: "relative", display: "block", width, lineHeight: 0 }}>
      {/* De schaduw is een eigen plaatje op een 12% ruimer doek, net als bij de
          andere platen: geen CSS-filter, dus overal hetzelfde. */}
      <img
        aria-hidden
        alt=""
        src="/tiles/coinbar-shadow.webp"
        style={{ position: "absolute", top: "-12%", left: "-12%", width: "124%", height: "124%", pointerEvents: "none" }}
      />
      <img alt="" src="/tiles/coinbar.webp" style={{ position: "relative", width: "100%", aspectRatio: RATIO, display: "block" }} />
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: width * 0.05,
        }}
      >
        <img src="/coin.webp" alt="" width={Math.round(width * 0.17)} height={Math.round(width * 0.17)} style={{ display: "block" }} />
        <span
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: Math.round(width * 0.135),
            lineHeight: 1,
            color: colors.goldHi,
            textShadow: "0 1px 2px rgba(0,0,0,.65)",
          }}
        >
          {coins}
        </span>
      </span>
    </span>
  );
}
