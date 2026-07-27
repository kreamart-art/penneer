// De platen-skin voor de modustegels op de main page.
//
// Dit is een PROEF. Hij staat bewust alleen aan als de admin hem aanvinkt in
// Instellingen, en hij wordt lokaal bewaard, niet op het account: er is nog
// niets besloten, dus er hoeft ook niets naar de server en niets te migreren.
// Wordt hij de nieuwe standaard, dan verhuist deze vlag naar het account.
import { useEffect, useState } from "react";

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

/** De plaat per modus. De DUEL-plaat heeft zijn woord al in de art staan, de
 *  rest niet: daar zetten we het label zelf onder het icoon. */
export const TILE_ART: Record<string, { src: string; label: boolean }> = {
  friends: { src: "/tiles/friends.webp", label: true },
  bots: { src: "/tiles/bots.webp", label: true },
  daily: { src: "/tiles/daily.webp", label: true },
  train: { src: "/tiles/train.webp", label: true },
  duel: { src: "/tiles/duel.webp", label: false },
};
