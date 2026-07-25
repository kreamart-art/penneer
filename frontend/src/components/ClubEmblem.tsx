// The club badge: one of the gold emblem coins (public/emblems/emNN.webp), or
// the default pen mark when the club has not picked one. Every member wears
// the emblem their owner chose.
import { Emblem } from "./Emblem";

// 27 badges, in three themed sheets of nine: heraldry (01-09), casino (10-18)
// and luck/prizes (19-27).
export const CLUB_EMBLEM_IDS = Array.from({ length: 27 }, (_, i) => `em${String(i + 1).padStart(2, "0")}`);

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
