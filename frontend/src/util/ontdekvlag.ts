/* Ontdekken staat nog in aanbouw en hoort dus niet zomaar in beeld.
 *
 * De schakelaar staat in Instellingen en is alleen zichtbaar voor een admin.
 * Hij bewaart niets op de server: het is geen recht dat je verdient maar een
 * kijkje achter het gordijn op DIT toestel, zodat de modus mee kan met een
 * gewone deploy zonder dat spelers hem tegenkomen.
 *
 * Bewust geen deel van het account: dan zou uitloggen of een tweede toestel de
 * stand veranderen, en dat is verwarrend bij iets wat je alleen aanzet om te
 * kijken of het werkt. */
const SLEUTEL = "penneer.ontdekken";

export function ontdekAan(): boolean {
  try {
    return localStorage.getItem(SLEUTEL) === "1";
  } catch {
    return false;
  }
}

export function zetOntdek(aan: boolean): void {
  try {
    if (aan) localStorage.setItem(SLEUTEL, "1");
    else localStorage.removeItem(SLEUTEL);
  } catch {
    /* privémodus: dan blijft hij gewoon uit */
  }
  // Zodat schermen die al open staan meteen meebewegen, zonder dat er een
  // store bij hoeft voor één vlaggetje.
  window.dispatchEvent(new Event("penneer:ontdek"));
}
