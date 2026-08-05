// Eén regel in een instellingenlijst.
//
// Rechts staat wat de regel DOET: een schakelaar als je hem hier meteen om kunt
// zetten, een pijl als er een pagina achter zit, niets als hij meteen iets in
// gang zet. Twee soorten regels in één lijst werken alleen als dat verschil aan
// de rechterkant meteen te zien is.
//
// De hele regel is de knop, niet alleen het opschrift: een raakvlak van 44
// punten hoog is het minimum waar een duim betrouwbaar op mikt.
import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { sound } from "../sound/sound";
import { colors, font } from "../theme/tokens";

export function InstelRij({ icoon, label, onder, rechts, pijl, onClick, eerste }: {
  icoon: ReactNode;
  label: string;
  /** Kleine tweede regel onder het opschrift. Voor een regel die iets opent
   *  waarvan de naam alleen niet verklapt wat erin zit. */
  onder?: string;
  rechts?: ReactNode;
  /** Uit als de regel meteen iets doet in plaats van een pagina te openen. */
  pijl?: boolean;
  onClick?: () => void;
  eerste?: boolean;
}) {
  const toonPijl = pijl !== false && !rechts;
  const inhoud = (
    <>
      <span style={{ display: "flex", color: colors.gold, flexShrink: 0 }}>{icoon}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={{ display: "block", fontFamily: font.ui, fontWeight: 600, fontSize: 14.5, color: colors.ink }}>{label}</span>
        {onder && (
          <span style={{ display: "block", marginTop: 2, fontFamily: font.ui, fontSize: 12, color: colors.faint, lineHeight: 1.35 }}>{onder}</span>
        )}
      </span>
      {rechts}
      {toonPijl && <ChevronRight size={17} color={colors.faint} />}
    </>
  );
  const stijl: CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, width: "100%",
    minHeight: 44, padding: "10px 0",
    borderTop: eerste ? "none" : `1px solid ${colors.hairline}`,
    background: "transparent", border: "none", borderRadius: 0,
  };
  // Een schakelaar vangt zijn eigen tik; die regel is dus geen knop, anders
  // krijg je een knop in een knop en zet één tik het ding twee keer om.
  if (!onClick) return <div style={stijl}>{inhoud}</div>;
  return (
    <button onClick={() => { sound.uiTap(); onClick(); }} className="pressable" style={{ ...stijl, cursor: "pointer" }}>
      {inhoud}
    </button>
  );
}
