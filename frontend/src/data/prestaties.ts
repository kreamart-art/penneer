// De medaillekast, zoals de app hem laat zien.
//
// WAT ER TE HALEN VALT STAAT OP DE SERVER (backend/app/prestaties.py). Die
// bepaalt de grenzen en telt hoe ver je bent; deze module haalt dat op en weet
// verder alleen wat er op het scherm hoort: de volgorde en het teken.
//
// De volgorde staat hier OOK, als terugval. Zo staat de kast er meteen als je
// hem opent, ook voordat het antwoord van de server binnen is; klopt hij ooit
// niet meer met de server, dan wint de server zodra zijn lijst er is.
import { useEffect, useState } from "react";
import {
  Award, BookOpen, Check, Crown, Flame, MessageCircle, Rocket, Shield, Sparkles,
  Star, Swords, Trophy, UserPlus, Zap,
} from "lucide-react";

export interface Kast {
  authed: boolean;
  volgorde: string[];
  doelen: Record<string, { teller: string; doel: number }>;
  stand: Record<string, number>;
  behaald: string[];
}

/** De veertien klassiekers, daarna het nieuwe vel van dertig. */
export const VOLGORDE: string[] = [
  "eerste_game", "eerste_winst", "tien_games", "vijf_winsten", "hattrick", "woordenaar",
  "vijfentwintig_games", "tien_winsten", "perfecte_ronde", "comeback", "durfal",
  "eerste_vriend", "eerste_bericht", "seizoenswinnaar",
  "vijftig_games", "flitser", "dobbelaar", "raak", "sneldenker", "divisie_klim",
  "divisie_top", "maandvol", "komeet", "schatkist", "duellist", "gezelschap",
  "clublid", "prater", "student", "vijfentwintig_winsten", "vijftig_winsten", "tien_dagen",
  "allrounder", "verzamelaar", "pakjesdag", "eigenzinnig", "ontdekker", "volhouder",
  "dagkoning", "tien_vrienden", "stem", "honderd_winsten", "zeven_dagen", "aangesloten",
];

/** Het getekende teken onder de art. Elke penning HEEFT art, dus dit is de
 *  terugval voor als een bestand ontbreekt; daarom is een enkel algemeen teken
 *  genoeg voor alles waar geen duidelijker teken voor is. */
const TEKENS: Record<string, typeof Swords> = {
  eerste_game: Swords, eerste_winst: Crown, tien_games: Swords, vijf_winsten: Trophy,
  hattrick: Flame, woordenaar: BookOpen, vijfentwintig_games: Shield, tien_winsten: Trophy,
  perfecte_ronde: Sparkles, comeback: Rocket, durfal: Zap, eerste_vriend: UserPlus,
  eerste_bericht: MessageCircle, seizoenswinnaar: Star,
  vijftig_games: Swords, volhouder: Swords, vijfentwintig_winsten: Trophy,
  vijftig_winsten: Crown, honderd_winsten: Crown, flitser: Zap, komeet: Rocket,
  duellist: Swords, tien_vrienden: UserPlus, prater: MessageCircle, stem: MessageCircle,
  zeven_dagen: Flame, tien_dagen: Check, dagkoning: Trophy, student: BookOpen,
  verzamelaar: BookOpen, ontdekker: Star, divisie_klim: Shield, divisie_top: Shield,
};

export const teken = (sleutel: string) => TEKENS[sleutel] ?? Award;
export const badgeArt = (sleutel: string) => `/ui/badges/${sleutel}.webp`;

const authHeaders = (): Record<string, string> => {
  const tok = localStorage.getItem("penneer.accountToken");
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

/** De kast van de server: wat je hebt, waar het aan hangt en hoe ver je staat. */
export function usePrestaties(open: boolean): Kast | null {
  const [kast, setKast] = useState<Kast | null>(null);
  useEffect(() => {
    if (!open) return;
    let levend = true;
    fetch("/api/prestaties", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (levend && d) setKast(d); })
      .catch(() => {});
    return () => { levend = false; };
  }, [open]);
  return kast;
}

/** Hoe ver je staat op deze penning: `nu` en `doel`, of niets als hij aan een
 *  gebeurtenis hangt (een comeback tel je niet, die doe je). */
export function voortgang(kast: Kast | null, sleutel: string): { nu?: number; doel?: number } {
  const doel = kast?.doelen?.[sleutel];
  if (!kast || !doel) return {};
  return { nu: kast.stand[doel.teller] ?? 0, doel: doel.doel };
}
