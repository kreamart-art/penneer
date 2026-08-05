// De kop van een scherm: terugpijl plus titel, overal hetzelfde.
//
// Elk scherm had zijn eigen kopje. Het duel stond op 17 punten vet-700 met de
// pijl in `faint`, Ontdekken op 21 vet-800 in een h1, instellingen op 24, en de
// een had wel de veilige zone bovenaan en de ander niet. Naast elkaar leest dat
// als drie apps.
//
// Het DUEL is de maat: die staat er het langst zo en past bij de rest van het
// spel. Alle andere schermen zijn hierheen getrokken.
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { sound } from "../sound/sound";
import { colors, font } from "../theme/tokens";

export function SchermKop({
  titel,
  onBack,
  rechts,
  style,
}: {
  titel: string;
  onBack: () => void;
  /** Wat er rechts naast de titel hangt (een teller, een knopje). */
  rechts?: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 18px",
        paddingTop: "calc(14px + env(safe-area-inset-top))",
        ...style,
      }}
    >
      <button
        onClick={() => { sound.uiTap(); onBack(); }}
        aria-label="Terug"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}
      >
        <ArrowLeft size={20} />
      </button>
      <span style={{ flex: 1, minWidth: 0, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>
        {titel}
      </span>
      {rechts}
    </div>
  );
}
