// De platen-skin voor de modustegels op de main page.
//
// Dit is een PROEF. Hij staat bewust alleen aan als de admin hem aanvinkt in
// Instellingen, en hij wordt lokaal bewaard, niet op het account: er is nog
// niets besloten, dus er hoeft ook niets naar de server en niets te migreren.
// Wordt hij de nieuwe standaard, dan verhuist deze vlag naar het account.
import { useEffect, useState, type CSSProperties } from "react";

const KEY = "penneer.tileSkin";
const EVENT = "penneer:tileskin";

export function tileSkinOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setTileSkin(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
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

/** De schaduw onder een plaat: dezelfde art nog een keer, zwartgemaakt en
 *  vervaagd, absoluut achter het origineel.
 *
 *  Waarom niet gewoon `filter: drop-shadow()`? Dat is korter en het klopt op de
 *  desktop, maar Safari op iOS rastert zo'n laag apart en tekent hem als
 *  RECHTHOEK. Dan staan er zwarte hoekjes rond elke plek waar de plaat is
 *  afgeschuind. `brightness(0)` maakt elke pixel zwart en laat het alfakanaal
 *  staan, dus deze schaduw volgt de vorm en werkt overal hetzelfde.
 *
 *  Vraagt om een ouder met `position: relative` die door de echte plaat op maat
 *  wordt gehouden. */
export const plateShadow: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  filter: "brightness(0) blur(7px)",
  opacity: 0.55,
  transform: "translateY(5px)",
  pointerEvents: "none",
};

/** De plaat per modus. De DUEL-plaat heeft zijn woord al in de art staan, de
 *  rest niet: daar zetten we het label zelf onder het icoon.
 *
 *  `labelY` is waar het MIDDEN van het label komt, als deel van de plaathoogte.
 *  Bewust het midden en niet de bovenkant: een label van twee regels zou vanaf
 *  een bovenkant naar beneden uitgroeien en dan lager hangen dan een label van
 *  een regel. Zo staan ze allemaal op dezelfde lijn.
 *
 *  `dark` is voor platen die zo licht zijn dat witte letters erop vervagen. Op
 *  goud leest bijna-zwart met een licht glansje beter dan wit met een schaduw. */
export const TILE_ART: Record<string, { src: string; label: boolean; labelY?: string; dark?: boolean }> = {
  friends: { src: "/tiles/friends.webp", label: true, labelY: "62%", dark: true },
  bots: { src: "/tiles/bots.webp", label: true, labelY: "62%" },
  daily: { src: "/tiles/daily.webp", label: true, labelY: "68%" },
  train: { src: "/tiles/train.webp", label: true, labelY: "68%" },
  duel: { src: "/tiles/duel.webp", label: false },
};
