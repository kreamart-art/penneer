// De verstuurknop van de chat: de glazen tegel met het vliegtuigje erin, in
// dezelfde gouden lijn als de rand.
//
// Hij verving een dichte gouden schijf met een zwart teken erop. Dat las als
// een vlak met een gat erin: het felste ding in de balk was de knop, en het
// enige donkere erin was juist wat je moest zien. Nu is het andersom, en dan
// klopt hij ook met de rest van de app: overal is glas de bodem en goud de
// lijn, en niets is een egale kleurvlek.
//
// De tegel zelf staat in [GlasKnop], want de foto- en microfoonknop ernaast
// gebruiken hem ook.
import { GlasKnop, GoudLijnDefs } from "./GlasKnop";

export function VerstuurKnop({
  onClick,
  label,
  maat = 44,
  actief = true,
  submit = false,
}: {
  onClick?: () => void;
  label: string;
  maat?: number;
  actief?: boolean;
  submit?: boolean;
}) {
  const teken = Math.round(maat * 0.44);
  return (
    <GlasKnop onClick={onClick} label={label} maat={maat} actief={actief} submit={submit}>
      <svg
        width={teken}
        height={teken}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{ position: "relative", marginLeft: -1 }}
      >
        <GoudLijnDefs id="verstuur-goud" />
        {/* Hetzelfde vliegtuigje als eerst, maar als lijn: de vouw in het
            midden maakt het papier, en zonder die lijn is het een driehoek.
            Dun getekend, net als de rand: twee lijndiktes op een knop van
            veertig pixels vechten met elkaar. */}
        <path
          d="M21 3L10.5 13.5M21 3l-6.6 18-3.9-7.5L3 9.6 21 3z"
          stroke="url(#verstuur-goud)"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </GlasKnop>
  );
}
