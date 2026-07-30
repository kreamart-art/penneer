// De tellerbadge: hoeveel er op je wacht, in een zeshoek.
//
// Hij stond eerst als ronde gouden pil op de chatknop en als zeshoek in de
// inbox, en dat waren dus twee talen voor hetzelfde bericht. De zeshoek wint:
// het is de vorm van deze app, en een felgele schijf op donker paars is zo
// hard dat hij het pictogram eronder wegdrukt.
//
// De ZWARTE zeshoek met de gouden rand (HexArt), niet de paarse knopplaat: dit
// is een teller en geen knop, en een knopplaat op iets waar je niet apart op
// kunt drukken belooft een tik die er niet is.
import { HexArt } from "./HexArt";
import { font } from "../theme/tokens";

/** De felste tint uit de goudreeks: het cijfer ligt op donkere art en moet daar
 *  bovenop liggen, niet erin zakken. */
const GOUD_FEL = "#FFC23D";

export function TelHex({ n, maat = 19 }: { n: number; maat?: number }) {
  return (
    <HexArt maat={maat}>
      <span
        style={{
          fontFamily: font.ui,
          fontSize: Math.round(maat * 0.53),
          fontWeight: 800,
          lineHeight: 1,
          color: GOUD_FEL,
        }}
      >
        {n > 9 ? "9+" : n}
      </span>
    </HexArt>
  );
}
