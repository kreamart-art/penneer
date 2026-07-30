// De verstuurknop van de chat: een ronde glazen tegel met een gouden rand en
// het vliegtuigje erin, ook in goud.
//
// Hij verving een dichte gouden schijf met een zwart teken erop. Dat las als
// een vlak met een gat erin: het felste ding in de balk was de knop, en het
// enige donkere erin was juist wat je moest zien. Nu is het andersom, en dan
// klopt hij ook met de rest van de app: overal is glas de bodem en goud de
// lijn, en niets is een egale kleurvlek.
//
// De opbouw is de gewone stapel: eerst het glas, dan de rand als losse laag met
// de padding-truc (een border volgt een verloop niet), dan de glans bovenaan en
// als laatste het teken. De gloed erachter is een tweede kopie met blur en niet
// een drop-shadow, want die breekt op iOS.

const GOUD_DONKER = "#8A5A12";
const GOUD = "#E8B33C";
const GOUD_LICHT = "#FFDE8A";

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
  /** Uit = niets te versturen: dezelfde vorm, alleen zachter. */
  actief?: boolean;
  /** In een form is de knop de indiener; daarbuiten een gewone knop. */
  submit?: boolean;
}) {
  const teken = Math.round(maat * 0.44);
  return (
    <button
      type={submit ? "submit" : "button"}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="pressable glowhover"
      style={{
        position: "relative",
        flexShrink: 0,
        width: maat,
        height: maat,
        borderRadius: "50%",
        border: "none",
        padding: 0,
        cursor: "pointer",
        background: "transparent",
        display: "grid",
        placeItems: "center",
        opacity: actief ? 1 : 0.55,
        transition: "opacity .15s",
      }}
    >
      {/* De rand: een gouden ring die linksboven het licht vangt. De vulling
          ligt er als tweede laag net binnen, dus wat overblijft IS de lijn. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `linear-gradient(155deg, ${GOUD_LICHT} 0%, ${GOUD} 34%, ${GOUD_DONKER} 68%, ${GOUD} 100%)`,
        }}
      />
      {/* Het glas. Donker en doorschijnend, met een lichte bovenhelft: een bol
          oppervlak vangt bovenaan meer licht dan onderaan. */}
      <span
        style={{
          position: "absolute",
          inset: 1.6,
          borderRadius: "50%",
          background:
            "radial-gradient(120% 100% at 30% 0%, rgba(255,222,138,.20) 0%, rgba(255,222,138,.05) 38%, rgba(0,0,0,0) 62%)," +
            "linear-gradient(180deg, rgba(52,34,86,.92) 0%, rgba(18,9,38,.95) 100%)",
          boxShadow: "inset 0 1px 1px rgba(255,222,138,.30), inset 0 -3px 8px rgba(0,0,0,.55)",
        }}
      />
      {/* De glans: een kort streepje bovenaan, niet een halve ring. Licht is
          kort, anders leest het als een gekleurd vlak in plaats van als glas. */}
      <span
        style={{
          position: "absolute",
          top: maat * 0.11,
          left: "50%",
          transform: "translateX(-50%)",
          width: maat * 0.44,
          height: maat * 0.16,
          borderRadius: "50%",
          background: "linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,0))",
          pointerEvents: "none",
        }}
      />
      <svg
        width={teken}
        height={teken}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{ position: "relative", marginLeft: -1 }}
      >
        <defs>
          <linearGradient id="verstuur-goud" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={GOUD_LICHT} />
            <stop offset="0.55" stopColor={GOUD} />
            <stop offset="1" stopColor={GOUD_DONKER} />
          </linearGradient>
        </defs>
        {/* Hetzelfde vliegtuigje als eerst, maar als lijn: de vouw in het
            midden maakt het papier, en zonder die lijn is het een driehoek. */}
        <path
          d="M21 3L10.5 13.5M21 3l-6.6 18-3.9-7.5L3 9.6 21 3z"
          stroke="url(#verstuur-goud)"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
