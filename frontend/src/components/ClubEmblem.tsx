// The club badge: one of the gold emblem coins (public/emblems/emNN.webp), or
// the default pen mark when the club has not picked one. Every member wears
// the emblem their owner chose.
import { Emblem } from "./Emblem";

export const CLUB_EMBLEM_IDS = ["em01", "em02", "em03", "em04", "em05", "em06", "em07", "em08", "em09"];

export function ClubEmblem({ id, size = 64 }: { id?: string | null; size?: number }) {
  if (!id) return <Emblem size={size} />;
  return (
    <img
      src={`/emblems/${id}.webp`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size, display: "block", objectFit: "contain" }}
    />
  );
}
