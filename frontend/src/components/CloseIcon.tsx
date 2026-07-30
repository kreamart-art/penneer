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
      // Een VIERKANTE doos met object-fit: contain. Dat is de enige vorm die
      // niet kan uitrekken, wat er ook met de doos gebeurt: contain schaalt de
      // art altijd gelijkmatig en zet hem in het midden.
      //
      // De twee eerdere pogingen leunden allebei op de doos: width en height
      // gelijk (drukte de 220x232-art 5% te breed) en daarna een uitgerekende
      // breedte (klopt alleen zolang niemand aan die breedte komt). In een
      // absoluut geplaatste knop tegen de rand IS er iets dat eraan komt: de
      // krimp-naar-inhoud rekent met de ruimte tot de rand, en dat is daar
      // maar een paar pixels. Met contain doet die ruimte niet meer mee.
      style={{ width: size, height: size, objectFit: "contain", display: "block", flexShrink: 0 }}
    />
  );
}
