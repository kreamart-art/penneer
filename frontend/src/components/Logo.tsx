// The Pen Neer logo (raster art by the studio). Used for the prominent brand
// moments (intro, landing, final). The SVG Emblem stays for small inline spots.
import { colors, withAlpha } from "../theme/tokens";

export function Logo({ size = 120, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <img
      src="/logo.png"
      alt="Pen Neer"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: glow ? `drop-shadow(0 0 22px ${withAlpha(colors.gold, 0.45)})` : undefined,
      }}
    />
  );
}
