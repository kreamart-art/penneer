// The room-lifetime alphabet above the reel. Every drawn letter drops out and
// stays out across rounds AND potjes in this room; once the whole pool has
// been drawn the server clears used_letters and the strip fills back up.
import { colors, font, withAlpha } from "../theme/tokens";
import { useT } from "../i18n/i18n";

const STD_POOL = "ABCDEFGHIJKLMNOPRSTUVWZ".split("");
const FULL_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface Props {
  used: string[];
  hard: boolean;
  /** The letter locked this round: it animates out the moment it is drawn. */
  lockedLetter?: string;
}

export function AlphabetStrip({ used, hard, lockedLetter }: Props) {
  const { t } = useT();
  const pool = hard ? FULL_POOL : STD_POOL;
  const usedSet = new Set(used.map((c) => c.toUpperCase()));
  const locked = (lockedLetter ?? "").toUpperCase();

  return (
    <div
      role="img"
      aria-label={t("alphabetAria")}
      style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 5, padding: "4px 0 0" }}
    >
      {pool.map((c) => {
        const isLocked = c === locked;
        const out = usedSet.has(c) || isLocked;
        return (
          <span
            key={c}
            className={isLocked ? "letter-out" : undefined}
            style={{
              width: 23,
              height: 25,
              display: "grid",
              placeItems: "center",
              fontFamily: font.display,
              fontWeight: 700,
              fontSize: 12,
              color: out ? colors.faint : colors.sub,
              opacity: out ? 0.28 : 0.92,
              background: out ? "transparent" : withAlpha("#000000", 0.22),
              border: `1px solid ${out ? "transparent" : colors.panelBorder}`,
              borderRadius: 7,
              transition: "opacity .35s ease, background .35s ease, border-color .35s ease",
            }}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
}
