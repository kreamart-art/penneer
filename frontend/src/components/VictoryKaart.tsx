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
export const VICTORY_ART = 3;

/** De verhouding van de nieuwe plaat: 3118 op 4194. */
const VERH = 3118 / 4194;
// De wimpel zit nu IN de plaat, onderaan, en begint op 83,5% van de hoogte
// (gemeten aan de warme pixels in de middenkolom). De inhoud moet daar dus
// boven blijven, anders loopt de laatste regel over VICTORY! heen.
const WIMPEL_TOP = 0.835;

export function VictoryKaart({
  kop,
  children,
  onClose,
  closeLabel,
  breed = 340,
}: {
  /** Overwinning of niet. De wimpel VICTORY! is in de plaat gebakken, dus dit
   *  kiest de PLAAT: met wimpel voor iets wat je wint of krijgt, zonder voor
   *  een degradatie (die hoort niet met VICTORY! aangekondigd te worden). */
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
        // Twee platen, twee verhoudingen: de wimpel maakt de victory-plaat
        // hoger. Eén vaste verhouding zou de andere uitrekken.
        aspectRatio: kop ? `${3118} / ${4194}` : `${780} / ${1025}`,
        backgroundImage: `url(/ui/${kop ? "victory-frame" : "frame-plain"}.webp?v=${VICTORY_ART})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        // Een echte schaduw ONDER de vorm kan geen drop-shadow zijn: iOS rastert
        // die laag apart en dan zie je zijn rechthoek over de gouden hoeken.
        filter: "drop-shadow(0 18px 44px rgba(0,0,0,.6))",
      }}
    >
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

      {/* De inhoud, binnen het gemeten binnenveld. De wimpel zit onderaan IN de
          plaat, dus de inhoud stopt daar netjes boven; zonder wimpel mag hij
          door tot vlak boven de onderrand. */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          bottom: kop ? `${Math.round((1 - WIMPEL_TOP) * 100) + 2}%` : "7%",
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
