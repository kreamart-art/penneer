// Een invulveld in dezelfde glasrand als een rij in de lijsten.
//
// Waarom: een kale rechthoek met een randje naast de rest van de app leest als
// een formulier dat er per ongeluk in staat. Dit veld draagt de afgeschuinde
// hoek, de lijn op een derde sterkte en de gouden kappen in de hoeken, precies
// zoals de rijen op de ranglijst en de vakjes in de winkel.
//
// De lijn licht op zodra er iets in staat: dat is het enige verschil tussen een
// leeg en een gevuld veld, en het is genoeg. Een gevulde achtergrond erbij zou
// er een tweede toestand van maken.
import { forwardRef } from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";
import { NeonKader } from "./ProfileHero";
import { colors, font } from "../theme/tokens";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** Opmaak voor de lijst eromheen, niet voor het veld zelf. */
  kaderStyle?: CSSProperties;
  /** Sterker als er iets ingevuld staat. */
  gevuld?: boolean;
};

export const GlasVeld = forwardRef<HTMLInputElement, Props>(function GlasVeld(
  { kaderStyle, gevuld, style, ...rest },
  ref,
) {
  return (
    <NeonKader
      hoek={10}
      dik={0.3}
      sterkte={gevuld ? 0.6 : 0.32}
      vulling="geen"
      eindkap="kort"
      style={{ width: "100%", ...kaderStyle }}
      binnen={{ display: "flex", alignItems: "center", padding: "2px 4px" }}
    >
      <input
        ref={ref}
        {...rest}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: "10px 11px",
          fontFamily: font.ui,
          fontSize: 15,
          color: colors.ink,
          ...style,
        }}
      />
    </NeonKader>
  );
});
