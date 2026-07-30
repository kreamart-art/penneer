// Het woordenboek dat Lettersoep gebruikt, gekozen op de taal van de speler.
//
// Lettersoep is het enige spel in de app dat een echte woordenlijst nodig heeft.
// De rest werkt met categorieën (die zijn vertaald) en met de scheidsrechter
// (die beoordeelt in de taal waarin je speelt). Een woordenboek kun je niet
// vertalen; dat moet je ernaast bouwen. Vandaar twee lijsten en dit luikje
// ertussen.
//
// De vier stukken die het spel nodig heeft horen bij elkaar en komen daarom als
// EEN geheel terug. Zou de bordgenerator zijn woorden uit de ene lijst halen en
// de controle uit de andere, dan legt hij woorden op het bord die hij zelf
// afkeurt.
import { NL_MAX_LENGTE, NL_PER_LENGTE, NL_PREFIX, NL_WOORDEN } from "./nlwoorden";
import { EN_MAX_LENGTE, EN_PER_LENGTE, EN_PREFIX, EN_WOORDEN } from "./enwoorden";

export type Woordenboek = {
  WOORDEN: ReadonlySet<string>;
  PER_LENGTE: ReadonlyMap<number, string[]>;
  PREFIX: ReadonlySet<string>;
  MAX_LENGTE: number;
};

const NL: Woordenboek = { WOORDEN: NL_WOORDEN, PER_LENGTE: NL_PER_LENGTE, PREFIX: NL_PREFIX, MAX_LENGTE: NL_MAX_LENGTE };
const EN: Woordenboek = { WOORDEN: EN_WOORDEN, PER_LENGTE: EN_PER_LENGTE, PREFIX: EN_PREFIX, MAX_LENGTE: EN_MAX_LENGTE };

/** Het woordenboek voor deze taal. Alles wat geen "en" is krijgt Nederlands:
 *  dat is de taal van het spel, en een onbekende code hoort niet in een leeg
 *  bord te eindigen. */
export function woordenboek(taal: string | null | undefined): Woordenboek {
  return taal === "en" ? EN : NL;
}
