// Pen Neer — audio. Two channels with independent volume (persisted):
//   - sfx   : short effects. Plays the studio mp3 in /public/sfx when present,
//             otherwise a synthesized Web Audio fallback so nothing is silent.
//   - music : the KREAM background beat (looped HTMLAudio), heard after the
//             intro until a game starts.
// A master mute (the speaker icon) silences both without losing the volumes.

const K_SFX = "penneer.vol.sfx";
const K_MUSIC = "penneer.vol.music";
const K_MUTE = "penneer.muted";
const K_LEGACY = "penneer.sound"; // old single on/off flag

function loadVol(key: string, def: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return def;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : def;
  } catch {
    return def;
  }
}

// Migrate the old boolean: if the user had muted, keep sfx off by default.
const legacyOff = (() => {
  try {
    return localStorage.getItem(K_LEGACY) === "0";
  } catch {
    return false;
  }
})();

let sfxVol = loadVol(K_SFX, legacyOff ? 0 : 0.8);
let musicVol = loadVol(K_MUSIC, legacyOff ? 0 : 0.5);
let muted = (() => {
  try {
    return localStorage.getItem(K_MUTE) === "1";
  } catch {
    return false;
  }
})();

const save = (key: string, v: number | string) => {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
};

// ---- Web Audio (sfx) --------------------------------------------------------

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = muted ? 0 : sfxVol;
    sfxGain.connect(ctx.destination);
    void decodeAll();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function applySfxGain() {
  if (sfxGain) sfxGain.gain.value = muted ? 0 : sfxVol;
}

// Decoded studio samples, keyed by effect name. undefined = not tried,
// null = failed (use synth fallback), AudioBuffer = ready.
const FILES: Record<string, string> = {
  // One click cut from the roulette sample; the reel plays it per letter, so it
  // ticks for exactly as long as the reel actually spins.
  spinTick: "spin-tick",
  chat: "message",
  approve: "approve",
  reject: "reject",
  dubbel: "dubbel",
  friend: "friend",
  gameStart: "game-start",
  playerJoin: "player-join",
  intro: "intro",
  tick: "tick", // the full 10s countdown — played ONCE when 10s remain
  win: "win",
  penNeer: "pen-neer",
  ready: "ready",
  badge: "badge",
  invite: "invite",
  error: "error",
  uiTap: "ui-tap",
};
const buffers: Record<string, AudioBuffer | null | undefined> = {};

async function decodeOne(name: string, file: string) {
  if (!ctx) return;
  try {
    const res = await fetch(`/sfx/${file}.mp3`);
    if (!res.ok) throw new Error("404");
    const buf = await res.arrayBuffer();
    buffers[name] = await ctx.decodeAudioData(buf);
  } catch {
    buffers[name] = null; // fall back to synth
  }
}

let decoded = false;
async function decodeAll() {
  if (decoded) return;
  decoded = true;
  await Promise.all(Object.entries(FILES).map(([name, file]) => decodeOne(name, file)));
}

function playBuffer(name: string): boolean {
  const buf = buffers[name];
  if (!buf || !ctx || !sfxGain) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(sfxGain);
  src.start();
  return true;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", peak = 0.18) {
  if (!ctx || !sfxGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(sfxGain);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

function sweep(from: number, to: number, start: number, dur: number, type: OscillatorType = "sawtooth", peak = 0.16) {
  if (!ctx || !sfxGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, ctx.currentTime + start);
  osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + start + dur);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(sfxGain);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

// Play a named effect: studio sample if decoded, else the synth fallback.
function sfx(name: string, fallback: () => void) {
  if (muted || sfxVol <= 0) return;
  if (!ensureCtx()) return;
  if (buffers[name]) {
    playBuffer(name);
  } else {
    fallback();
  }
}

// ---- Music (HTMLAudio loop) -------------------------------------------------

let musicEl: HTMLAudioElement | null = null;
let musicWanted = false;
let gesturePrimed = false;
let musicHoldUntil = 0; // don't start the beat until the intro sting is done

function nowSec(): number {
  return (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
}

function ensureMusicEl(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!musicEl) {
    musicEl = new Audio("/music/daftneo.mp3");
    musicEl.loop = true;
    musicEl.preload = "auto";
  }
  musicEl.volume = muted ? 0 : musicVol;
  return musicEl;
}

function applyMusic() {
  const el = ensureMusicEl();
  if (!el) return;
  el.volume = muted ? 0 : musicVol;
  const shouldPlay = musicWanted && !muted && musicVol > 0;
  if (shouldPlay) {
    const wait = musicHoldUntil - nowSec();
    if (wait > 0.05) {
      // The intro sting is still playing; hold the beat until it finishes.
      el.pause();
      window.setTimeout(() => {
        if (musicWanted && !muted && musicVol > 0) applyMusic();
      }, wait * 1000);
      return;
    }
    el.play().catch(() => {
      // Autoplay blocked (returning user, no gesture yet): retry on first tap.
      if (!gesturePrimed) {
        gesturePrimed = true;
        const retry = () => {
          window.removeEventListener("pointerdown", retry);
          if (musicWanted && !muted && musicVol > 0) el.play().catch(() => {});
        };
        window.addEventListener("pointerdown", retry, { once: true });
      }
    });
  } else {
    el.pause();
  }
}

// ---- public API -------------------------------------------------------------

export const sound = {
  sfxVolume: () => sfxVol,
  musicVolume: () => musicVol,
  isMuted: () => muted,

  setSfxVolume(v: number) {
    sfxVol = Math.min(1, Math.max(0, v));
    save(K_SFX, sfxVol);
    if (sfxVol > 0 && muted) this.setMuted(false);
    ensureCtx();
    applySfxGain();
  },
  setMusicVolume(v: number) {
    musicVol = Math.min(1, Math.max(0, v));
    save(K_MUSIC, musicVol);
    if (musicVol > 0 && muted) this.setMuted(false);
    applyMusic();
  },
  setMuted(v: boolean) {
    muted = v;
    save(K_MUTE, v ? "1" : "0");
    applySfxGain();
    applyMusic();
  },
  toggleMuted() {
    this.setMuted(!muted);
  },

  // Call inside a user gesture (intro tap, create/join) to unlock audio on iOS.
  unlock: () => {
    ensureCtx();
    if (musicWanted) applyMusic();
  },

  // Bless the music element within a user gesture (the intro tap) so the loop
  // can start programmatically right after, even on iOS.
  primeMusic: () => {
    const el = ensureMusicEl();
    if (!el) return;
    el.muted = true;
    el.play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.muted = false;
        el.volume = muted ? 0 : musicVol;
        if (musicWanted) applyMusic();
      })
      .catch(() => {
        el.muted = false;
      });
  },

  // Background music on/off (App drives this from the current screen/phase).
  musicActive(on: boolean) {
    musicWanted = on;
    applyMusic();
  },

  // ---- effects (studio sample or synth fallback) ----
  buzz: () => sfx("buzz", () => sweep(220, 90, 0, 0.18, "square", 0.2)),
  chat: () => sfx("chat", () => {
    tone(740, 0, 0.08, "sine", 0.12);
    tone(1040, 0.06, 0.12, "sine", 0.11);
  }),
  approve: () => sfx("approve", () => {
    tone(660, 0, 0.09, "triangle", 0.16);
    tone(990, 0.07, 0.14, "triangle", 0.15);
  }),
  reject: () => sfx("reject", () => sweep(300, 150, 0, 0.18, "sawtooth", 0.16)),
  dubbel: () => sfx("dubbel", () => {
    tone(784, 0, 0.1, "triangle", 0.15);
    tone(784, 0.14, 0.1, "triangle", 0.15);
  }),
  friend: () => sfx("friend", () => {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.22, "triangle", 0.14));
  }),
  gameStart: () => sfx("gameStart", () => sweep(200, 700, 0, 0.5, "sawtooth", 0.14)),
  playerJoin: () => sfx("playerJoin", () => {
    tone(523, 0, 0.09, "triangle", 0.14);
    tone(784, 0.08, 0.13, "triangle", 0.14);
  }),

  spinTick: () => sfx("spinTick", () => tone(880, 0, 0.03, "square", 0.06)),
  penNeer: () => sfx("penNeer", () => sweep(320, 110, 0, 0.22, "square", 0.22)),
  ready: () => sfx("ready", () => tone(880, 0, 0.08, "triangle", 0.12)),
  badge: () => sfx("badge", () => [784, 1046, 1318].forEach((f, i) => tone(f, i * 0.08, 0.24, "triangle", 0.15))),
  invite: () => sfx("invite", () => {
    tone(660, 0, 0.12, "triangle", 0.14);
    tone(880, 0.12, 0.16, "triangle", 0.14);
  }),
  error: () => sfx("error", () => sweep(220, 110, 0, 0.2, "sawtooth", 0.16)),
  uiTap: () => sfx("uiTap", () => tone(1000, 0, 0.025, "square", 0.05)),
  tick: () => sfx("tick", () => tone(1200, 0, 0.05, "square", 0.08)),
  win: () => sfx("win", () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.3, "triangle", 0.18));
    sweep(300, 900, 0.05, 0.5, "sawtooth", 0.1);
  }),
  intro: () => {
    sfx("intro", () => {
      sweep(120, 520, 0, 0.6, "sawtooth", 0.12);
      [392, 523, 659].forEach((f, i) => tone(f, 0.25 + i * 0.08, 0.4, "triangle", 0.14));
    });
    // Hold the background beat until the sting is nearly over. If the studio
    // file isn't decoded yet the synth fallback played, so hold only briefly.
    if (!muted && sfxVol > 0) {
      const dur = buffers.intro ? buffers.intro.duration : 0.9;
      musicHoldUntil = nowSec() + Math.max(0, dur - 0.8);
    }
  },

  // synth-only (no studio file yet)
  lock: () => sfx("lock", () => {
    tone(660, 0, 0.12, "triangle", 0.2);
    tone(990, 0.06, 0.18, "triangle", 0.18);
  }),
  results: () => sfx("results", () => {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.2, "triangle", 0.16));
  }),
};
