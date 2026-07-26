// Chat emotes: gold mascot stickers (public/emotes/ceNN.webp).
// One pack is FREE for everyone (so emotes actually show up in rooms), three are
// earned with a milestone, two are bought with coins. Keep ids + unlock rules in
// step with EMOTE_PACKS / EMOTE_PACK_UNLOCK in backend/app/db.py.
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `ce${String(from + i).padStart(2, "0")}`);

export interface EmotePack {
  id: string;       // shop/unlock item id
  name: string;     // i18n key
  how: string;      // i18n key: how you unlock it (shown when locked)
  emotes: string[];
}

export const EMOTE_PACKS: EmotePack[] = [
  { id: "empack1", name: "emotePackHappy", how: "emoteHowFree", emotes: range(1, 9) },
  { id: "empack2", name: "emotePackFeest", how: "emoteHowWins", emotes: range(10, 18) },
  { id: "empack3", name: "emotePackVerdriet", how: "emoteHowStreak", emotes: range(19, 27) },
  { id: "empack4", name: "emotePackSociaal", how: "emoteHowShop", emotes: range(28, 36) },
  { id: "empack5", name: "emotePackBoos", how: "emoteHowShop", emotes: range(37, 45) },
  { id: "empack6", name: "emotePackPlagen", how: "emoteHowGames", emotes: range(46, 54) },
];

// The packs you buy; the rest is free or earned.
export const EMOTE_PACKS_FOR_SALE = EMOTE_PACKS.filter((p) => p.how === "emoteHowShop");
// Free for everyone, so guests without an account can emote too.
export const FREE_EMOTE_PACKS = EMOTE_PACKS.filter((p) => p.how === "emoteHowFree").map((p) => p.id);

export const EMOTE_SRC = (id: string) => `/emotes/${id}.webp`;
