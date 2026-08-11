// De onderdelen van "samen tegen samen": de kleur van een kamp, het knopje in
// de lobby en de stand boven de resultaten.
//
// EEN kleur per kamp, en overal dezelfde. Een team is de hele wedstrijd lang
// hetzelfde ding, dus het mag nooit gebeuren dat je in de lobby geel bent en op
// het scorebord paars: dan moet je bij elk scherm opnieuw uitzoeken wie je bent.
// Vandaar dat de kleuren hier staan en niet in de schermen zelf.
//
// De kleuren komen uit het bestaande palet en niet uit een nieuwe reeks: goud
// is de huiskleur, paars het accent en groen het "goed"-signaal. Ze staan ver
// genoeg uit elkaar om ook op een klein chipje uit elkaar te houden.
import { colors, font, withAlpha } from "../theme/tokens";

export const TEAM_KLEUREN = [colors.gold, "#8B7BFF", colors.green];

export function teamKleur(n: number): string {
  return TEAM_KLEUREN[(Math.max(1, n) - 1) % TEAM_KLEUREN.length];
}

/** Het kamp als plaatje: een gekleurde punt met het nummer erin. */
export function TeamPunt({ team, maat = 20 }: { team: number; maat?: number }) {
  const k = teamKleur(team);
  return (
    <span
      style={{
        width: maat, height: maat, borderRadius: 999, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: withAlpha(k, 0.18), border: `1px solid ${withAlpha(k, 0.55)}`,
        color: k, fontFamily: font.display, fontWeight: 800, fontSize: maat * 0.55,
        lineHeight: 1,
      }}
    >
      {team}
    </span>
  );
}

/** Het knopje in de lobby: tik en je gaat naar het volgende kamp.
 *
 *  Doorstappen en geen keuzelijst: met twee kampen is een lijst van twee een
 *  omweg, en met drie is doorstappen nog steeds sneller dan een menu openen. */
export function TeamKnop({
  team, aantal, mag, onWissel,
}: { team: number; aantal: number; mag: boolean; onWissel: (next: number) => void }) {
  const nu = team || 1;
  const volgende = (nu % Math.max(1, aantal)) + 1;
  return (
    <button
      onClick={() => { if (mag) onWissel(volgende); }}
      disabled={!mag}
      aria-label={`Team ${nu}`}
      style={{
        background: "transparent", border: "none", padding: 0,
        cursor: mag ? "pointer" : "default", display: "flex", alignItems: "center",
      }}
    >
      <TeamPunt team={nu} maat={22} />
    </button>
  );
}

/** De stand per kamp, als balk. Staat boven de spelerslijst op de resultaten:
 *  in teams is DIT de uitslag en is de rij eronder de onderbouwing. */
export function TeamStand({
  stand, labelVoor,
}: { stand: Record<string, number>; labelVoor: (n: number) => string }) {
  const rijen = Object.entries(stand)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => b[1] - a[1]);
  if (!rijen.length) return null;
  const max = Math.max(1, ...rijen.map(([, v]) => v));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rijen.map(([n, v]) => {
        const k = teamKleur(n);
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TeamPunt team={n} maat={20} />
            <span style={{ fontFamily: font.ui, fontSize: 12.5, color: colors.sub, minWidth: 56 }}>
              {labelVoor(n)}
            </span>
            <div style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(0,0,0,.4)", overflow: "hidden" }}>
              <div style={{ width: `${(v / max) * 100}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${withAlpha(k, 0.55)}, ${k})` }} />
            </div>
            <span style={{ fontFamily: font.display, fontWeight: 800, fontSize: 15, color: k, minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}
