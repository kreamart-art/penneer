// De kaart waar alles op staat wat je VERDIENT of KOOPT.
//
// Er waren drie eigen vensters voor drie momenten die hetzelfde zijn: je hebt
// iets gekregen, kijk. Nu is er één kaart, met de sierlijst uit de UI-map als
// omhulsel: gouden hoeken, een edelsteen bovenin en een paars binnenvlak.
//
// De art heeft een VASTE verhouding, dus de inhoud voegt zich naar de kaart en
// niet andersom. De binnenmarges hieronder zijn aan het bestand gemeten (waar
// het goud ophoudt en het paarse vlak begint), en ze staan in procenten zodat
// ze op elk formaat kloppen. `top` en `bottom` rekenen met de HOOGTE en
// `left`/`right` met de BREEDTE, dus het zijn twee verschillende getallenparen
// en niet één padding.
import type { ReactNode } from "react";
import { colors, font } from "../theme/tokens";

/** Ophogen zodra de art overschreven wordt; de bestandsnaam blijft gelijk. */
export const VICTORY_ART = 1;

/** De verhouding van het bestand: 780 op 1025. */
const VERH = 780 / 1025;

export function VictoryKaart({
  kop,
  children,
  onClose,
  closeLabel,
  breed = 340,
}: {
  /** De wimpel bovenaan. Laat weg als het moment geen overwinning is (een
   *  degradatie hoort niet met VICTORY! aangekondigd te worden). */
  kop?: boolean;
  children: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  breed?: number;
}) {
  return (
    <div
      className="reward-card"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: breed,
        aspectRatio: `${780} / ${1025}`,
        backgroundImage: `url(/ui/victory-frame.webp?v=${VICTORY_ART})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        // Een echte schaduw ONDER de vorm kan geen drop-shadow zijn: iOS rastert
        // die laag apart en dan zie je zijn rechthoek over de gouden hoeken.
        filter: "drop-shadow(0 18px 44px rgba(0,0,0,.6))",
      }}
    >
      {/* De wimpel hangt OVER de bovenrand heen, want zo hoort een wimpel: hij
          is ergens aan opgehangen en ligt niet in het vlak. */}
      {kop && (
        <img
          src={`/ui/victory-band.webp?v=${VICTORY_ART}`}
          alt=""
          aria-hidden
          className="reward-art"
          style={{
            position: "absolute",
            left: "50%",
            top: "-7%",
            width: "88%",
            transform: "translateX(-50%)",
            maxWidth: "none",
            pointerEvents: "none",
          }}
        />
      )}

      {onClose && (
        <button
          onClick={onClose}
          aria-label={closeLabel}
          style={{
            position: "absolute",
            top: "6%",
            right: "7%",
            zIndex: 3,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: colors.faint,
            display: "flex",
            padding: 4,
            fontFamily: font.ui,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}

      {/* De inhoud, binnen het gemeten binnenveld. Onder de wimpel begint hij
          lager, anders staat de eerste regel eronder verstopt. */}
      <div
        style={{
          position: "absolute",
          top: kop ? "17%" : "8%",
          bottom: "7%",
          left: "10%",
          right: "10%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          textAlign: "center",
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export { VERH as VICTORY_VERHOUDING };
