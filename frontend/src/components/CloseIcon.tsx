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
      // De art is 220x232, dus width EN height op dezelfde maat drukte hem 5%
      // te breed. size is de HOOGTE en de breedte wordt hier UITGEREKEND, niet
      // op auto gezet: in een absoluut geplaatste knop tegen de rand mag een
      // auto-breedte niet breder worden dan de resterende ruimte, en dan werd
      // het kruis tot de helft samengeknepen.
      style={{ height: size, width: size * (220 / 232), display: "block", flexShrink: 0 }}
    />
  );
}
