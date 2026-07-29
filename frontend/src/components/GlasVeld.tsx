// Een invulveld in de NEONKADER-stijl: een ronde lijst met een verlopende
// haarlijn, geen glasrij.
//
// Het verschil is opzettelijk. De glasrij met zijn afgeschuinde hoek en gouden
// kappen is de vorm van een RIJ IN EEN LIJST: iets waar je op tikt om ergens
// heen te gaan. Een invulveld is geen rij, dus het hoort er ook niet als een
// te lezen; anders tik je erop in de verwachting dat er iets opengaat.
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
      radius={13}
      dik={gevuld ? 0.6 : 0.42}
      sterkte={gevuld ? 0.85 : 0.5}
      vulling="geen"
      style={{ width: "100%", ...kaderStyle }}
      binnen={{ display: "flex", alignItems: "center", padding: 0 }}
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
          padding: "11px 13px",
          fontFamily: font.ui,
          fontSize: 15,
          color: colors.ink,
          ...style,
        }}
      />
    </NeonKader>
  );
});
