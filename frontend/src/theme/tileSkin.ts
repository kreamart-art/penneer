// De look-schakelaar: de nieuwe platen-look (standaard) of de KLASSIEKE
// indeling van voor de art. Elke plek die de platen tekent heeft zijn oude tak
// bewaard (`skin ? ... : ...`), en nieuwe onderdelen zijn steeds in BEIDE
// stijlen gebouwd, dus klassiek is geen bevroren versie maar dezelfde app in
// het oude jasje: cash-pil, badges en alles erbij, alleen zonder platen.
//
// We slaan alleen het UIT-zetten op: geen sleutel betekent nieuw. Zo hoeft er
// niets gemigreerd te worden.
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
  zetKlassiekeKlasse();
}

/** De CSS-kant van de klassieke look: één klasse op <html> zet de
 *  pagina-achtergrond-art uit (zie index.css). Bij het opstarten aanroepen en
 *  bij elke omschakeling. */
export function zetKlassiekeKlasse(): void {
  try {
    document.documentElement.classList.toggle("klassiek", !tileSkinOn());
  } catch {
    /* geen document (test) */
  }
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
 *  `badgeX`/`badgeY` is waar het telknopje hangt: het MIDDEN ervan, in de
 *  rechterbovenhoek BINNEN de lijst, tegen de afschuining aan maar er niet
 *  overheen.
 *
 *  De plek is per plaat gemeten en niet geschat. Uit de art is het binnenvlak
 *  gehaald (de aaneengesloten kleurvlek waar het icoon op staat) en daarin is
 *  de plek gezocht die het dichtst bij de hoek ligt en waar het hele knopje nog
 *  net vrij ligt. Daar is het met de hand vanaf geschoven, zeven pixels naar
 *  links en drie en een halve naar beneden op het scherm: precies passen leest
 *  als klem zitten, en een knopje dat tegen de lijst aan plakt hoort er niet
 *  bij. Die verschuiving is in SCHERMpixels op beide platen gelijk en niet in
 *  procenten, anders schuift de brede balk vier keer zo ver op als de vierkante
 *  plaat. Een gedeeld paar getallen kan niet: een percentage in `top`
 *  rekent met de HOOGTE en in `left` met de BREEDTE, dus wat op de vierkante
 *  plaat in de hoek staat, staat op de brede Duel-balk 108px naar binnen. */
export const TILE_ART: Record<string, { src: string; label: boolean; labelY?: string; dark?: boolean; badgeX?: string; badgeY?: string }> = {
  friends: { src: "/tiles/friends.webp", label: true, labelY: "62%", dark: true },
  bots: { src: "/tiles/bots.webp", label: true, labelY: "62%" },
  daily: { src: "/tiles/daily.webp", label: true, labelY: "68%", badgeX: "81.8%", badgeY: "21.8%" },
  train: { src: "/tiles/train.webp", label: true, labelY: "68%" },
  duel: { src: "/tiles/duel.webp", label: false, badgeX: "91%", badgeY: "38.1%" },
};
