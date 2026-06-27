// Pen Neer emblem — inline SVG fountain-pen nib in gold inside a dashed ring,
// with a gold drop-shadow glow. No external assets (§8).
import { colors } from "../theme/tokens";

export function Emblem({ size = 96 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        filter: `drop-shadow(0 0 18px ${colors.gold}66)`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
        {/* dashed ring */}
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke={colors.gold}
          strokeWidth="2"
          strokeDasharray="4 7"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* fountain-pen nib */}
        <g transform="translate(50 50)">
          <path
            d="M0 -26 L13 14 C13 22 7 27 0 27 C-7 27 -13 22 -13 14 Z"
            fill={colors.gold}
          />
          {/* center slit + breather hole */}
          <line x1="0" y1="-6" x2="0" y2="20" stroke={colors.bg0} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="0" cy="-2" r="3.4" fill={colors.bg0} />
          {/* tip highlight */}
          <circle cx="0" cy="24" r="2.2" fill={colors.goldHi} />
        </g>
      </svg>
    </div>
  );
}
