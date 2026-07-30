// De getekende chatbel uit de UI-map.
//
// Een eigen bestandje en niet een constante in Chat.tsx: het profiel gebruikt
// hetzelfde icoon, en importeren uit Chat.tsx trok de hele chatmodule (emotes,
// microfoon, spraakberichten) de Hub-brok in. Zeven kilobyte voor een plaatje.
//
// VRIJSTAAND, zonder de paarse knopplaat eronder. Art op een plaat is twee
// voorwerpen op elkaar: deze bel heeft zijn eigen rand, zijn eigen glans en
// zijn eigen schaduw, en heeft geen bord nodig om op te liggen.

/** Omhoog bij nieuwe art: de service worker bewaart alles onder /ui/ op naam,
 *  dus zonder deze sleutel blijft de vorige tekening hangen. */
export const CHAT_ART = 1;

export function ChatIcoon({ maat = 30, licht = false }: { maat?: number; licht?: boolean }) {
  return (
    <img
      src={`/ui/chat.webp?v=${CHAT_ART}`}
      alt=""
      aria-hidden
      style={{
        width: maat,
        height: maat,
        display: "block",
        // Oplichten als er iets ongelezen is, zodat je aan de KNOP ziet dat er
        // iets wacht en niet alleen aan de badge ernaast.
        filter: licht
          ? "drop-shadow(0 0 7px rgba(255,214,90,.75)) brightness(1.08)"
          : "brightness(.9) saturate(.9)",
        transition: "filter .18s ease-out",
      }}
    />
  );
}
