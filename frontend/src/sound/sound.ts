// Pen Neer — synthesized sound effects (Web Audio, no assets). All arcade-ish
// blips and chimes. Respects a global on/off flag persisted in localStorage.

const SOUND_KEY = "penneer.sound";

let ctx: AudioContext | null = null;
let enabled = (() => {
  const v = localStorage.getItem(SOUND_KEY);
  return v === null ? true : v === "1";
})();

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  peak = 0.18
) {
  const c = ctx!;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, c.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

function sweep(from: number, to: number, start: number, dur: number, type: OscillatorType = "sawtooth", peak = 0.16) {
  const c = ctx!;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, c.currentTime + start);
  osc.frequency.exponentialRampToValueAtTime(to, c.currentTime + start + dur);
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, c.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

function guard(): boolean {
  if (!enabled) return false;
  return !!ensureCtx();
}

export const sound = {
  isEnabled: () => enabled,
  setEnabled: (v: boolean) => {
    enabled = v;
    localStorage.setItem(SOUND_KEY, v ? "1" : "0");
    if (v) ensureCtx();
  },
  // call once on a user gesture to unlock audio on iOS
  unlock: () => {
    ensureCtx();
  },
  buzz: () => {
    if (!guard()) return;
    sweep(220, 90, 0, 0.18, "square", 0.2);
  },
  spinTick: () => {
    if (!guard()) return;
    tone(880, 0, 0.03, "square", 0.06);
  },
  lock: () => {
    if (!guard()) return;
    tone(660, 0, 0.12, "triangle", 0.2);
    tone(990, 0.06, 0.18, "triangle", 0.18);
  },
  tick: () => {
    if (!guard()) return;
    tone(1200, 0, 0.05, "square", 0.08);
  },
  results: () => {
    if (!guard()) return;
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.2, "triangle", 0.16));
  },
  win: () => {
    if (!guard()) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.3, "triangle", 0.18));
    sweep(300, 900, 0.05, 0.5, "sawtooth", 0.1);
  },
  intro: () => {
    if (!guard()) return;
    sweep(120, 520, 0, 0.6, "sawtooth", 0.12);
    [392, 523, 659].forEach((f, i) => tone(f, 0.25 + i * 0.08, 0.4, "triangle", 0.14));
  },
};
