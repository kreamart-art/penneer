// De platen-skin voor de modustegels op de main page.
//
// De skin staat nu voor IEDEREEN aan; hij is de nieuwe look. De schakelaar
// blijft staan, want die is straks weer nodig als er een volgende skin komt.
//
// Daarom slaan we alleen het UIT-zetten op: geen sleutel betekent aan. Zo hoeft
// er niets gemigreerd te worden en krijgt elke bestaande speler hem meteen.
import { useEffect, useState, type CSSProperties } from "react";

const KEY = "penneer.tileSkin";
const EVENT = "penneer:tileskin";

export function tileSkinOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setTileSkin(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "0");
  } catch {
    /* opslag vol of geblokkeerd */
  }
  // Eigen gebeurtenis, want `storage` vuurt alleen in ANDERE tabbladen en de
  // schakelaar en de main page staan in hetzelfde tabblad.
  window.dispatchEvent(new Event(EVENT));
}

/** Volgt de vlag, zodat het scherm meteen omschakelt als je hem aanvinkt. */
export function useTileSkin(): boolean {
  const [on, setOn] = useState(tileSkinOn);
  useEffect(() => {
    const sync = () => setOn(tileSkinOn());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return on;
}

/** De schaduw onder een plaat is een EIGEN plaatje (`*-shadow.webp`), geen
 *  CSS-effect.
 *
 *  Twee dingen die het niet werden. `filter: drop-shadow()` tekent Safari op
 *  iOS als aparte laag met een RECHTHOEK, dus zwarte hoekjes rond elke
 *  afschuining. Daarna een zwartgemaakte, vervaagde kopie met
 *  `brightness(0) blur()`: op de desktop precies goed, op iOS een dichte zwarte
 *  rechthoek, want Safari rekent een filter over een plaatje met alfa tegen
 *  zwart af in plaats van tegen niets. Een gewoon plaatje kan niet stuk.
 *
 *  Het schaduwdoek is aan elke kant 12% ruimer dan de plaat, voor alle platen
 *  hetzelfde, zodat deze ene stijl overal past. Vraagt om een ouder met
 *  `position: relative` die door de echte plaat op maat wordt gehouden. */
const SHADOW_PAD = 12;
export const plateShadow: CSSProperties = {
  position: "absolute",
  top: `${-SHADOW_PAD}%`,
  left: `${-SHADOW_PAD}%`,
  width: `${100 + 2 * SHADOW_PAD}%`,
  height: `${100 + 2 * SHADOW_PAD}%`,
  pointerEvents: "none",
};

/** Het schaduwplaatje dat bij een plaat hoort. */
export function shadowSrc(src: string): string {
  return src.replace(/\.webp$/, "-shadow.webp");
}

/** De plaat per modus. De DUEL-plaat heeft zijn woord al in de art staan, de
 *  rest niet: daar zetten we het label zelf onder het icoon.
 *
 *  `labelY` is waar het MIDDEN van het label komt, als deel van de plaathoogte.
 *  Bewust het midden en niet de bovenkant: een label van twee regels zou vanaf
 *  een bovenkant naar beneden uitgroeien en dan lager hangen dan een label van
 *  een regel. Zo staan ze allemaal op dezelfde lijn.
 *
 *  `dark` is voor platen die zo licht zijn dat witte letters erop vervagen. Op
 *  goud leest bijna-zwart met een licht glansje beter dan wit met een schaduw.
 *
 *  `badgeX`/`badgeY` is waar het telknopje hangt: het MIDDEN ervan, op de
 *  afgeschuinde rechterbovenhoek van de plaat. Dat moet per plaat, want een
 *  percentage in `top` rekent met de HOOGTE en in `left` met de BREEDTE. Eén
 *  paar getallen voor alle platen zette het knopje op de vierkante plaat netjes
 *  in de hoek en op de brede Duel-balk ver naar binnen: 12% van 190px hoog is
 *  23px, 12% van 900px breed is 108px. */
export const TILE_ART: Record<string, { src: string; label: boolean; labelY?: string; dark?: boolean; badgeX?: string; badgeY?: string }> = {
  friends: { src: "/tiles/friends.webp", label: true, labelY: "62%", dark: true },
  bots: { src: "/tiles/bots.webp", label: true, labelY: "62%" },
  daily: { src: "/tiles/daily.webp", label: true, labelY: "68%", badgeX: "95%", badgeY: "5%" },
  train: { src: "/tiles/train.webp", label: true, labelY: "68%" },
  duel: { src: "/tiles/duel.webp", label: false, badgeX: "97%", badgeY: "14%" },
};
