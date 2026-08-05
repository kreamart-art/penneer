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

// Wie de deur naar het admin-paneel überhaupt te zien krijgt.
//
// De code blijft de sleutel: dit bepaalt alleen of het slot zichtbaar is. Een
// invulveld voor een adminwachtwoord in ieders instellingen nodigt uit tot
// proberen en zegt bovendien iets over de app dat spelers niet hoeven te weten.
const EIGENAREN = new Set(["kream", "kreamtest", "aish", "aishtest"]);

/** Is dit een van de twee eigenaars-accounts (Kream of Aish, incl. hun
 *  testaccounts)? Gasten nooit. */
export function isEigenaar(naam: string | null | undefined): boolean {
  return !!naam && EIGENAREN.has(naam.trim().toLowerCase());
}
