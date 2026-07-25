// Chat emotes: gold mascot stickers (public/emotes/ceNN.webp), sold per pack.
// Keep the ids in step with EMOTE_PACKS in backend/app/db.py.
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `ce${String(from + i).padStart(2, "0")}`);

export interface EmotePack {
  id: string;       // shop item id (coins)
  name: string;     // i18n key
  emotes: string[];
}

export const EMOTE_PACKS: EmotePack[] = [
  { id: "empack1", name: "emotePackHappy", emotes: range(1, 9) },
  { id: "empack2", name: "emotePackFeest", emotes: range(10, 18) },
  { id: "empack3", name: "emotePackVerdriet", emotes: range(19, 27) },
  { id: "empack4", name: "emotePackSociaal", emotes: range(28, 36) },
];

export const EMOTE_SRC = (id: string) => `/emotes/${id}.webp`;
