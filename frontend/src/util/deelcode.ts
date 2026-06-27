// Pen Neer — custom category "deelcode" packs (Artnomad convention, mirrors
// KINGSEN): "PNR1." + base64(encodeURIComponent(JSON.stringify(pack))).
const PREFIX = "PNR1.";

export function encodeDeelcode(categories: string[]): string {
  const json = JSON.stringify(categories);
  return PREFIX + btoa(encodeURIComponent(json));
}

export function decodeDeelcode(code: string): string[] | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return null;
  try {
    const json = decodeURIComponent(atob(trimmed.slice(PREFIX.length)));
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const cats = parsed
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim().slice(0, 24))
      .filter(Boolean);
    // De-dupe case-insensitively, keep order.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of cats) {
      const k = c.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(c);
      }
    }
    return out.length >= 3 && out.length <= 6 ? out : null;
  } catch {
    return null;
  }
}
