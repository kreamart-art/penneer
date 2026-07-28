// Het kruisje van het spel: een geslagen gouden knop en geen lijntekening.
//
// Hij vervangt overal het lucide-kruisje waar iets GESLOTEN of WEGGETIKT wordt.
// Niet waar een kruisje iets anders betekent: een fout antwoord in de uitslag,
// een bot die je uit de room haalt, een vriendschapsverzoek dat je afwijst. Daar
// is het geen sluitknop maar een teken, en een dikke gouden knop zou dan zeggen
// dat er iets dicht gaat.
export function CloseIcon({ size = 24 }: { size?: number }) {
  return (
    <img
      src="/ui/close.webp"
      alt=""
      aria-hidden
      style={{ width: size, height: size, display: "block", flexShrink: 0 }}
    />
  );
}
