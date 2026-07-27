// De pictogrammen voor de platen-balk.
//
// Lijnpictogrammen (lucide) staan naast art van gepolijst goud als tekeningen
// naast een voorwerp: even dik, geen materiaal, geen licht. Deze zijn gevulde
// vormen met een verloop, een kort glansje aan de bovenkant en een donkere
// onderrand, dus ze zijn ergens VAN gemaakt en ze staan in hetzelfde licht als
// de plaat: van linksboven.
//
// Ze horen bij de skin. De kale balk houdt zijn lucide-pictogrammen.
import { useId } from "react";

/** Vier tinten van fel naar donker. `on` is verlicht goud, `off` hetzelfde
 *  materiaal in de schaduw: nog steeds metaal, alleen niet aangelicht. Zo
 *  springt de gekozen plek eruit zonder dat de rest plat wordt. */
const RAMP = {
  on: ["#FFF6D2", "#FFD35C", "#E08A0B", "#8A4400"],
  off: ["#CFC2EC", "#9B8CC9", "#665894", "#3A3059"],
};

function Gold({
  on,
  size,
  children,
}: {
  on: boolean;
  size: number;
  children: (fill: string, shine: string, edge: string) => React.ReactNode;
}) {
  const id = useId();
  const r = on ? RAMP.on : RAMP.off;
  const face = `url(#f${id})`;
  const shine = `url(#s${id})`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor={r[0]} />
          <stop offset="0.32" stopColor={r[1]} />
          <stop offset="0.74" stopColor={r[2]} />
          <stop offset="1" stopColor={r[3]} />
        </linearGradient>
        {/* Het glansje is kort: alleen het bovenste stukje licht op. Een verloop
            dat over de halve vorm licht is, leest niet als licht maar als een
            lichter vlak. */}
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="0.28" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {children(face, shine, r[3])}
    </svg>
  );
}

/** Winkel: een karretje, gevuld, met een dieper mandje en twee wielen. */
export function ShopIcon({ on, size }: { on: boolean; size: number }) {
  return (
    <Gold on={on} size={size}>
      {(face, shine, edge) => (
        <>
          <path d="M2 3.4h2.1a1 1 0 0 1 .96.73L5.5 5.6" stroke={face} strokeWidth="1.9" strokeLinecap="round" />
          <path d="M5.9 6.1h15.3l-2.05 6.9a1 1 0 0 1-.96.72H8.6a1 1 0 0 1-.96-.7L5.9 6.1Z" fill={face} />
          <path d="M5.9 6.1h15.3l-.5 1.7H6.4l-.5-1.7Z" fill={shine} />
          <path d="M7.7 13.9h10.6" stroke={edge} strokeOpacity="0.45" strokeWidth="1" strokeLinecap="round" />
          <path d="M7.9 14.5h10.4" stroke={face} strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="9.6" cy="19" r="2.05" fill={face} />
          <circle cx="17.2" cy="19" r="2.05" fill={face} />
          <circle cx="9.6" cy="17.9" r="1.5" fill={shine} />
          <circle cx="17.2" cy="17.9" r="1.5" fill={shine} />
        </>
      )}
    </Gold>
  );
}

/** Ranglijst: een beker met oren, steel en voet. */
export function TrophyIcon({ on, size }: { on: boolean; size: number }) {
  return (
    <Gold on={on} size={size}>
      {(face, shine, edge) => (
        <>
          <path d="M6.6 5.3C4.3 5.3 3 6.6 3 8.3c0 2.2 1.8 3.7 4.2 4" stroke={face} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M17.4 5.3c2.3 0 3.6 1.3 3.6 3 0 2.2-1.8 3.7-4.2 4" stroke={face} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M6.4 3.2h11.2v5.4c0 3.5-2.3 5.9-5.6 5.9s-5.6-2.4-5.6-5.9V3.2Z" fill={face} />
          <path d="M6.4 3.2h11.2v2.1H6.4V3.2Z" fill={shine} />
          <path d="M10.9 14.2h2.2v3.1h-2.2z" fill={face} />
          <path d="M8.1 17.2h7.8l1 3.6H7.1l1-3.6Z" fill={face} />
          <path d="M8.1 17.2h7.8l.35 1.25H7.75l.35-1.25Z" fill={shine} />
          <path d="M7.1 20.8h9.8" stroke={edge} strokeOpacity="0.5" strokeWidth="0.9" strokeLinecap="round" />
        </>
      )}
    </Gold>
  );
}

/** Vrienden: twee figuren, de achterste met een donkere rand zodat ze niet
 *  aan elkaar vastplakken. */
export function FriendsIcon({ on, size }: { on: boolean; size: number }) {
  return (
    <Gold on={on} size={size}>
      {(face, shine, edge) => (
        <>
          <g opacity="0.82">
            <circle cx="16.4" cy="7.4" r="2.9" fill={face} stroke={edge} strokeWidth="1.1" />
            <path
              d="M11.2 18.6c0-3.4 2.3-5.6 5.2-5.6s5.2 2.2 5.2 5.6a.9.9 0 0 1-.9.9h-8.6a.9.9 0 0 1-.9-.9Z"
              fill={face}
              stroke={edge}
              strokeWidth="1.1"
            />
          </g>
          <circle cx="9.1" cy="8.1" r="3.6" fill={face} />
          <path d="M9.1 4.5a3.6 3.6 0 0 1 3.4 2.4H5.7A3.6 3.6 0 0 1 9.1 4.5Z" fill={shine} />
          <path d="M2.7 19.9c0-4 2.7-6.5 6.4-6.5s6.4 2.5 6.4 6.5a1 1 0 0 1-1 1H3.7a1 1 0 0 1-1-1Z" fill={face} />
          <path d="M9.1 13.4c1.9 0 3.5.65 4.6 1.8H4.5c1.1-1.15 2.7-1.8 4.6-1.8Z" fill={shine} />
        </>
      )}
    </Gold>
  );
}
