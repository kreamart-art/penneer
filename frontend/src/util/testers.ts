// Wie nieuw spul al te zien krijgt voordat het voor iedereen open gaat.
//
// Namen zijn uniek in de database, dus dit is een lijst van accounts en geen
// lijst van patronen. Op één plek, want anders staat dezelfde lijst straks in
// drie schermen en vergeet je er eentje bij te werken.
const TESTERS = new Set(["kream", "kreamtest"]);

/** Mag deze speler het spul zien dat nog getest wordt? Gasten nooit. */
export function isTester(naam: string | null | undefined): boolean {
  return !!naam && TESTERS.has(naam.trim().toLowerCase());
}
