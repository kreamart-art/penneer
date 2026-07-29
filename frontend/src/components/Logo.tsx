// The Pen Neer logo (raster art by the studio). Used for the prominent brand
// moments (intro, landing, final). The SVG Emblem stays for small inline spots.
import { colors, withAlpha } from "../theme/tokens";

export function Logo({ size = 120, glow = true }: { size?: number | string; glow?: boolean }) {
  // The raster art has a baked-in backdrop; a radial mask fades it out so the
  // glow melts into the page instead of stopping at a square edge.
    // De art heeft een ingebakken ondergrond. Het masker doezelt die uit, en dat
  // gebeurt over een lange weg: één harde overgang leest als een rondje om de
  // pen heen.
  const mask =
    "radial-gradient(circle at 50% 50%, #000 44%, rgba(0,0,0,.85) 56%, rgba(0,0,0,.45) 68%, rgba(0,0,0,.15) 80%, transparent 94%)";
  return (
    <img
      // De kleine webp (384px, ~40KB) en niet de bron-PNG van 2MB: dit logo staat
      // op 128px op het beginscherm en was in zijn eentje de zwaarste download
      // van de hele eerste laadbeurt.
      src="/logo-klein.webp"
      alt="Pen Neer"
      width={typeof size === "number" ? size : undefined}
      height={typeof size === "number" ? size : undefined}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        WebkitMaskImage: mask,
        maskImage: mask,
        filter: glow ? `drop-shadow(0 0 22px ${withAlpha(colors.gold, 0.45)})` : undefined,
      }}
    />
  );
}
