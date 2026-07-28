// Wie heeft deze speler binnengehaald?
//
// De werflink is `penneer.artnomad.nl/?ref=ABC123`. Die code moet blijven staan
// tot het moment dat er echt een account wordt gemaakt, en dat kan een paar
// schermen later zijn: eerst de intro, dan de taal, dan pas een naam. Vandaar
// de opslag en niet gewoon de URL uitlezen op het moment zelf.
//
// De code gaat er ook weer UIT zodra hij gebruikt is. Anders blijft hij op dat
// toestel staan en zou een tweede account later opnieuw voor dezelfde persoon
// meetellen.

const SLEUTEL = "penneer.ref";

/** Haal `?ref=` uit de URL en leg hem vast. Eenmaal bij binnenkomst aanroepen. */
export function vangWerfcode(): void {
  try {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get("ref") || "").trim().toUpperCase();
    if (code && /^[A-Z0-9]{4,12}$/.test(code)) {
      localStorage.setItem(SLEUTEL, code);
    }
    // De code uit de adresbalk halen, anders staat hij in elke screenshot en
    // in elke link die iemand daarna weer doorstuurt.
    if (url.searchParams.has("ref")) {
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch {
    /* rare URL of geen opslag: dan gewoon geen werving */
  }
}

/** De opgeslagen code, en meteen opgeruimd: hij mag maar een keer tellen. */
export function geworvenDoor(): string {
  try {
    const code = localStorage.getItem(SLEUTEL) || "";
    if (code) localStorage.removeItem(SLEUTEL);
    return code;
  } catch {
    return "";
  }
}
