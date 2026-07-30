/** De klok van de dagronde.
 *
 *  De ronde sluit om 21:00 NEDERLANDSE tijd, niet om middernacht en niet aan de
 *  klok van jouw toestel. Die twee dingen gingen allebei mis: er stond een
 *  aftelling naar 00:00 lokaal, dus iemand in Suriname zag een andere tijd dan
 *  iemand in Amsterdam en allebei zagen ze het verkeerde moment.
 *
 *  De server stuurt `seconds_left` mee, maar dat is een momentopname en dit moet
 *  per seconde doorlopen. Vandaar zelf rekenen, maar wel op de Amsterdamse
 *  wandklok: `Intl` weet wat daar op de klok staat, inclusief zomertijd, dus we
 *  hoeven zelf niets over tijdzones te weten.
 *
 *  Op de twee dagen dat de klok verspringt duurt een etmaal geen 24 uur en zit
 *  deze berekening er dat ene uur naast. Hij loopt vanzelf weer gelijk zodra de
 *  sluiting gepasseerd is, en een uur verschil op een dag zonder uitslag is
 *  goedkoper dan een tijdzone-bibliotheek meesturen. */
export const SLUIT_UUR = 21;

const KLOK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Hoe laat het NU in Amsterdam is, in seconden sinds middernacht daar. */
export function amsterdamSeconden(nu: Date = new Date()): number {
  const [u, m, s] = KLOK.format(nu).split(":").map(Number);
  // Middernacht komt er als 24 uit bij sommige runtimes; die hoort op 0.
  return ((u % 24) * 3600 + m * 60 + s);
}

/** Seconden tot de eerstvolgende sluiting van de dagronde. */
export function secTotSluiting(nu: Date = new Date()): number {
  const over = SLUIT_UUR * 3600 - amsterdamSeconden(nu);
  return over > 0 ? over : over + 24 * 3600;
}

/** De ronde die nu loopt, als datum: de dag waarop hij SLUIT. Zelfde regel als
 *  op de server, zodat client en server dezelfde ronde bedoelen. */
export function lopendeRonde(nu: Date = new Date()): string {
  const nl = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(nu);
  if (amsterdamSeconden(nu) < SLUIT_UUR * 3600) return nl;
  const d = new Date(`${nl}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function dagKlok(s: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const u = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return u > 0 ? `${u}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
