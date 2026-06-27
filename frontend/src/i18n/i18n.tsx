// Pen Neer — i18n (NL/EN). All UI copy lives here so the rest of the app stays
// language-clean. Category keys are language-neutral on the server; tCat() maps
// them to localized labels (custom deelcode categories pass through unchanged).
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "nl" | "en";

const LANG_KEY = "penneer.lang";

type Dict = Record<string, string>;

const nl: Dict = {
  // generic
  you: "jij",
  host: "host",
  watching: "kijkt",
  back: "Terug",
  footer: "penneer.artnomad.nl · een spel van Artnomad",
  // settings + about
  settingsTitle: "Instellingen",
  settings: "Instellingen",
  language: "Taal",
  installApp: "Installeer de app",
  appInstalled: "App is geïnstalleerd",
  installHint: "Zet Pen Neer op je beginscherm voor snelle toegang.",
  about: "Over",
  versionLabel: "Versie",
  madeBy: "Een spel van Artnomad",
  // landing
  tagline:
    "Draai de letter, ren tegen de klok. Jongen, meisje, dier, vrucht, land. Ieder op zijn eigen telefoon.",
  yourName: "Jouw naam",
  createRoom: "Maak een room",
  joinCta: "Doe mee met code",
  join: "Doe mee",
  code: "CODE",
  howItWorks: "Hoe werkt het",
  // language page
  chooseLang: "Kies je taal",
  chooseLangSub: "Je kunt dit later in de lobby wijzigen.",
  // intro
  tapToBegin: "Tik om te beginnen",
  skip: "Overslaan",
  // lobby
  roomcode: "Roomcode",
  codeHint: "De anderen vullen deze code in op hun eigen telefoon.",
  inRoom: "In de room",
  startGame: "Start het spel",
  waitHost: "Wachten tot de host start.",
  timePerRound: "Tijd per ronde",
  noTimer: "Geen tijd",
  roundsLabel: "Aantal rondes",
  categoriesLabel: "Categorieën · kies 3 tot 6",
  hardLetters: "Moeilijke letters (Q/X/Y)",
  maxPlayers: "Max spelers",
  allowSpectators: "Kijkers toelaten",
  sound: "Geluid",
  on: "aan",
  off: "uit",
  testbots: "Testbots",
  addBot: "Bot erbij",
  customCats: "Eigen categorieën",
  pasteCode: "Plak een deelcode",
  load: "Laden",
  shareCats: "Deel categorieën",
  copied: "Gekopieerd",
  badCode: "Ongeldige deelcode.",
  spectatorNote: "Je kijkt mee. Je vult niet in.",
  // reveal
  youSpin: "Jij draait deze ronde",
  xSpinsRound: "{name} draait deze ronde",
  pressToSpin: "Druk op de knop, de rol gaat lopen.",
  pressStop: "Druk op stop. Daar valt de letter voor iedereen.",
  everyoneFills: "Iedereen begint nu in te vullen.",
  xSpinning: "{name} draait de letter",
  spin: "Draai",
  // fill
  letterIs: "De letter is",
  youKeepTime: "Jij bewaakt de tijd",
  xKeepsTime: "{name} bewaakt de tijd",
  noLimitYou: "Geen tijdslimiet, jij zegt wanneer",
  noLimitX: "Geen tijdslimiet, {name} zegt wanneer",
  fillingToo: "vullen mee in...",
  penNeer: "Pen neer · stop voor iedereen",
  xStopsTime: "{name} stopt de tijd als die klaar is. Vul snel zoveel mogelijk in.",
  imReady: "Ik ben klaar",
  notYet: "Toch nog niet",
  youReady: "Je bent klaar. Wachten op de rest.",
  readyCount: "{n} van {total} klaar",
  fillPlaceholder: "{cat} met {letter}...",
  // results
  scoreboard: "Scorebord",
  dubbel: "dubbel",
  resultsHint: "Uniek is 10, dubbel is 5. Geen echt dier of land? Tik het aan om af te keuren.",
  nextRound: "Volgende ronde",
  toFinal: "Naar de eindstand",
  waitNext: "Wachten op de volgende ronde.",
  readyForNext: "Klaar voor de volgende ronde",
  readyForFinal: "Klaar voor de eindstand",
  waitingEveryone: "Wachten tot iedereen klaar is.",
  forceNext: "Nu doorgaan",
  empty: "leeg",
  // final
  winner: "Winnaar",
  sharedLead: "Gedeelde koppositie",
  pointsN: "{score} punten",
  playAgain: "Nog een keer",
  quit: "Stoppen",
  hostRestart: "De host kan een nieuw spel starten.",
  shareResult: "Deel de uitslag",
  saved: "Opgeslagen",
  // topbar
  roundN: "Ronde {n}/{total}",
  connected: "Verbonden",
  searching: "Verbinding zoeken",
  // rules
  rulesTitle: "Hoe werkt het",
  rulesIntro: "Pen Neer speel je samen in een room, ieder op zijn eigen telefoon.",
  rulesStep1Title: "Maak of join een room",
  rulesStep1Body: "Eén persoon maakt een room en deelt de code. De rest vult de code in.",
  rulesStep2Title: "Draai de letter",
  rulesStep2Body: "De speler die aan de beurt is, draait aan de rol en drukt op stop. De letter valt voor iedereen tegelijk.",
  rulesStep3Title: "Vul snel in",
  rulesStep3Body: "Iedereen vult een woord per categorie in dat met die letter begint, op dezelfde klok.",
  rulesStep4Title: "Pen neer en punten",
  rulesStep4Body: "Uniek antwoord is 10 punten, dubbel is 5. De hoogste score na alle rondes wint.",
  gotIt: "Snap ik",
};

const en: Dict = {
  you: "you",
  host: "host",
  watching: "watching",
  back: "Back",
  footer: "penneer.artnomad.nl · a game by Artnomad",
  settingsTitle: "Settings",
  settings: "Settings",
  language: "Language",
  installApp: "Install the app",
  appInstalled: "App is installed",
  installHint: "Add Pen Neer to your home screen for quick access.",
  about: "About",
  versionLabel: "Version",
  madeBy: "A game by Artnomad",
  tagline:
    "Spin the letter, race the clock. Boy, girl, animal, fruit, country. Everyone on their own phone.",
  yourName: "Your name",
  createRoom: "Create a room",
  joinCta: "Join with a code",
  join: "Join",
  code: "CODE",
  howItWorks: "How it works",
  chooseLang: "Choose your language",
  chooseLangSub: "You can change this later in the lobby.",
  tapToBegin: "Tap to begin",
  skip: "Skip",
  roomcode: "Room code",
  codeHint: "The others enter this code on their own phone.",
  inRoom: "In the room",
  startGame: "Start the game",
  waitHost: "Waiting for the host to start.",
  timePerRound: "Time per round",
  noTimer: "No timer",
  roundsLabel: "Rounds",
  categoriesLabel: "Categories · pick 3 to 6",
  hardLetters: "Hard letters (Q/X/Y)",
  maxPlayers: "Max players",
  allowSpectators: "Allow spectators",
  sound: "Sound",
  on: "on",
  off: "off",
  testbots: "Test bots",
  addBot: "Add bot",
  customCats: "Custom categories",
  pasteCode: "Paste a share code",
  load: "Load",
  shareCats: "Share categories",
  copied: "Copied",
  badCode: "Invalid share code.",
  spectatorNote: "You're watching. You don't fill in.",
  youSpin: "You spin this round",
  xSpinsRound: "{name} spins this round",
  pressToSpin: "Press the button, the reel starts rolling.",
  pressStop: "Press stop. The letter drops for everyone.",
  everyoneFills: "Everyone starts filling in now.",
  xSpinning: "{name} is spinning the letter",
  spin: "Spin",
  letterIs: "The letter is",
  youKeepTime: "You keep the time",
  xKeepsTime: "{name} keeps the time",
  noLimitYou: "No time limit, you say when",
  noLimitX: "No time limit, {name} says when",
  fillingToo: "filling in too...",
  penNeer: "Pens down · stop for everyone",
  xStopsTime: "{name} stops the time when ready. Fill in as much as you can, fast.",
  imReady: "I'm done",
  notYet: "Not yet",
  youReady: "You're done. Waiting for the others.",
  readyCount: "{n} of {total} ready",
  fillPlaceholder: "{cat} with {letter}...",
  scoreboard: "Scoreboard",
  dubbel: "shared",
  resultsHint: "Unique is 10, shared is 5. Not a real animal or country? Tap it to reject.",
  nextRound: "Next round",
  toFinal: "To the final score",
  waitNext: "Waiting for the next round.",
  readyForNext: "Ready for the next round",
  readyForFinal: "Ready for the final score",
  waitingEveryone: "Waiting for everyone to be ready.",
  forceNext: "Continue now",
  empty: "empty",
  winner: "Winner",
  sharedLead: "Shared lead",
  pointsN: "{score} points",
  playAgain: "Play again",
  quit: "Quit",
  hostRestart: "The host can start a new game.",
  shareResult: "Share the result",
  saved: "Saved",
  roundN: "Round {n}/{total}",
  connected: "Connected",
  searching: "Reconnecting",
  rulesTitle: "How it works",
  rulesIntro: "Play Pen Neer together in one room, everyone on their own phone.",
  rulesStep1Title: "Create or join a room",
  rulesStep1Body: "One person creates a room and shares the code. Everyone else enters it.",
  rulesStep2Title: "Spin the letter",
  rulesStep2Body: "The active player spins the reel and presses stop. The letter drops for everyone at once.",
  rulesStep3Title: "Fill in fast",
  rulesStep3Body: "Everyone fills in one word per category starting with that letter, on the same clock.",
  rulesStep4Title: "Pens down and points",
  rulesStep4Body: "A unique answer is 10 points, a shared one is 5. The highest score after all rounds wins.",
  gotIt: "Got it",
};

const dict: Record<Lang, Dict> = { nl, en };

// Category key -> localized label. Unknown (custom) keys pass through.
const catLabels: Record<string, { nl: string; en: string }> = {
  Jongen: { nl: "Jongen", en: "Boy" },
  Meisje: { nl: "Meisje", en: "Girl" },
  Dier: { nl: "Dier", en: "Animal" },
  Vrucht: { nl: "Vrucht", en: "Fruit" },
  Land: { nl: "Land", en: "Country" },
  Stad: { nl: "Stad", en: "City" },
  Beroep: { nl: "Beroep", en: "Profession" },
  Ding: { nl: "Ding", en: "Thing" },
};

export const ALL_CATEGORY_KEYS = Object.keys(catLabels);

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

interface LangApi {
  lang: Lang | null; // null until the user picks (shows the language page)
  setLang: (l: Lang) => void;
  t: (key: keyof typeof nl, vars?: Record<string, string | number>) => string;
  tCat: (key: string) => string;
}

const LangContext = createContext<LangApi | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(() => {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === "nl" || saved === "en" ? saved : null;
  });

  useEffect(() => {
    if (lang) {
      localStorage.setItem(LANG_KEY, lang);
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const api = useMemo<LangApi>(() => {
    const active: Lang = lang ?? "nl";
    return {
      lang,
      setLang: setLangState,
      t: (key, vars) => interpolate(dict[active][key as string] ?? (key as string), vars),
      tCat: (key) => {
        const m = catLabels[key];
        return m ? m[active] : key;
      },
    };
  }, [lang]);

  return <LangContext.Provider value={api}>{children}</LangContext.Provider>;
}

export function useT(): LangApi {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useT must be used within LangProvider");
  return ctx;
}
