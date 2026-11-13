/**
 * Sound effects, made in the browser with Web Audio: tones and filtered noise, nothing to download, so they
 * work offline. Every sound follows a click, which is what browsers ask for before they let a page make noise.
 * A button can name its sound with `data-sfx="add"`; any other button gets a soft tap. One switch mutes all.
 */
import { create } from 'zustand';

const KEY = 'riwa.journey.sound';

export type Sfx =
  | 'tap' | 'open' | 'close' | 'add' | 'remove' | 'good' | 'warn' | 'fail' | 'step' | 'alarm' | 'radio' | 'beep' | 'go'
  | 'liftoff' | 'stage' | 'orbit' | 'shake' | 'hiss' | 'whoosh' | 'burn' | 'fanfare' | 'lost' | 'splash' | 'none';

interface SoundState {
  muted: boolean;
  toggle: () => void;
}

const savedMuted = (() => {
  try { return localStorage.getItem(KEY) === 'off'; } catch { return false; }
})();

export const useSound = create<SoundState>((set, get) => ({
  muted: savedMuted,
  toggle: () => {
    const muted = !get().muted;
    set({ muted });
    try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch { /* keep going */ }
    if (muted) stopAll(); else sfx('good');
  },
}));

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const live = new Set<AudioScheduledSourceNode>();

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function track(n: AudioScheduledSourceNode) {
  live.add(n);
  n.onended = () => live.delete(n);
}

export function stopAll() {
  for (const n of live) { try { n.stop(); } catch { /* already stopped */ } }
  live.clear();
}

/** A tone: `f` Hz (sliding to `to`), starting `at` seconds from now, for `dur` seconds. */
function tone(f: number, at: number, dur: number, o: { type?: OscillatorType; gain?: number; to?: number; attack?: number } = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
  const peak = o.gain ?? 0.12;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
  track(osc);
}

/** Filtered noise: wind, rumble, hiss, static. */
function noise(at: number, dur: number, o: { filter?: BiquadFilterType; f?: number; to?: number; q?: number; gain?: number; attack?: number; hold?: number } = {}) {
  const c = audio();
  if (!c || !master) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    // a little low-pass in the generator makes it rounder than pure white noise
    for (let i = 0; i < d.length; i++) { last = 0.6 * last + 0.4 * (Math.random() * 2 - 1); d[i] = last * 1.8; }
  }
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = c.createBiquadFilter();
  flt.type = o.filter ?? 'lowpass';
  flt.frequency.setValueAtTime(o.f ?? 800, t);
  if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  flt.Q.value = o.q ?? 0.8;
  const g = c.createGain();
  const peak = o.gain ?? 0.15;
  const attack = o.attack ?? 0.02;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + Math.max(attack, (o.hold ?? 0.5) * dur));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
  track(src);
}

const SOUNDS: Record<Exclude<Sfx, 'none'>, () => void> = {
  tap: () => tone(760, 0, 0.05, { gain: 0.05, to: 620 }),
  open: () => { tone(420, 0, 0.07, { gain: 0.06 }); tone(640, 0.05, 0.09, { gain: 0.06 }); },
  close: () => { tone(560, 0, 0.07, { gain: 0.05 }); tone(380, 0.05, 0.09, { gain: 0.05 }); },
  // a part bolted on: a thunk, a ratchet click, a small confirming note
  add: () => { tone(150, 0, 0.09, { type: 'square', gain: 0.07, to: 70 }); noise(0, 0.05, { filter: 'highpass', f: 3000, gain: 0.08 }); noise(0.07, 0.03, { filter: 'highpass', f: 4000, gain: 0.06 }); tone(700, 0.1, 0.12, { type: 'triangle', gain: 0.07 }); },
  remove: () => { tone(360, 0, 0.12, { type: 'triangle', gain: 0.07, to: 170 }); noise(0.02, 0.06, { filter: 'highpass', f: 2500, gain: 0.05 }); },
  good: () => { tone(784, 0, 0.14, { type: 'triangle', gain: 0.09 }); tone(1175, 0.1, 0.22, { type: 'triangle', gain: 0.09 }); },
  warn: () => { tone(466, 0, 0.12, { type: 'triangle', gain: 0.09 }); tone(466, 0.17, 0.12, { type: 'triangle', gain: 0.09 }); },
  fail: () => { tone(120, 0, 0.3, { type: 'sawtooth', gain: 0.08, to: 80 }); },
  step: () => { tone(220, 0, 0.08, { type: 'square', gain: 0.06 }); tone(440, 0.07, 0.1, { type: 'triangle', gain: 0.08 }); tone(660, 0.15, 0.16, { type: 'triangle', gain: 0.08 }); },
  // a master alarm: two tones, three times
  alarm: () => { for (let k = 0; k < 3; k++) { tone(880, k * 0.36, 0.16, { type: 'square', gain: 0.06 }); tone(660, k * 0.36 + 0.17, 0.16, { type: 'square', gain: 0.06 }); } },
  // static, then the tone that opens a voice loop
  radio: () => { noise(0, 0.5, { filter: 'bandpass', f: 1800, q: 1.5, gain: 0.07 }); tone(2525, 0.45, 0.22, { gain: 0.05 }); tone(1200, 0.75, 0.08, { gain: 0.07 }); tone(1200, 0.9, 0.08, { gain: 0.07 }); tone(1600, 1.05, 0.16, { gain: 0.07 }); },
  beep: () => tone(1000, 0, 0.12, { gain: 0.09 }),
  go: () => { tone(523, 0, 0.1, { type: 'triangle', gain: 0.09 }); tone(659, 0.09, 0.1, { type: 'triangle', gain: 0.09 }); tone(784, 0.18, 0.2, { type: 'triangle', gain: 0.1 }); },
  // ignition and the climb: a rumble that opens up, with a crackle on top
  liftoff: () => {
    noise(0, 7.5, { filter: 'lowpass', f: 90, to: 520, gain: 0.5, attack: 0.9, hold: 0.55 });
    noise(0.3, 6.5, { filter: 'bandpass', f: 900, to: 2400, q: 0.7, gain: 0.1, attack: 1.2, hold: 0.5 });
    tone(46, 0, 7, { type: 'sawtooth', gain: 0.14, to: 70, attack: 1 });
  },
  stage: () => { tone(90, 0, 0.25, { type: 'square', gain: 0.12, to: 40 }); noise(0.02, 0.6, { filter: 'highpass', f: 1500, gain: 0.09 }); },
  orbit: () => { tone(392, 0, 1.4, { gain: 0.06, attack: 0.3 }); tone(587, 0.15, 1.4, { gain: 0.05, attack: 0.3 }); tone(784, 0.3, 1.6, { gain: 0.05, attack: 0.3 }); },
  // the shaker table sweeping up through its frequencies
  shake: () => { tone(28, 0, 1.6, { type: 'sawtooth', gain: 0.16, to: 150, attack: 0.1 }); noise(0, 1.6, { filter: 'bandpass', f: 300, to: 1400, q: 2, gain: 0.05 }); },
  hiss: () => noise(0, 1.6, { filter: 'highpass', f: 2200, to: 6000, gain: 0.07, attack: 0.05, hold: 0.2 }),
  whoosh: () => { noise(0, 0.7, { filter: 'bandpass', f: 300, to: 2200, q: 1.2, gain: 0.12, attack: 0.15 }); tone(180, 0.68, 0.08, { type: 'square', gain: 0.09, to: 90 }); tone(880, 0.74, 0.1, { type: 'triangle', gain: 0.06 }); },
  burn: () => { noise(0, 2.4, { filter: 'lowpass', f: 160, to: 420, gain: 0.32, attack: 0.25, hold: 0.7 }); tone(55, 0, 2.3, { type: 'sawtooth', gain: 0.09, attack: 0.2 }); },
  fanfare: () => { [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.13, 0.3, { type: 'triangle', gain: 0.09 })); tone(1319, 0.56, 0.7, { type: 'triangle', gain: 0.08, attack: 0.05 }); },
  lost: () => { tone(330, 0, 0.5, { type: 'triangle', gain: 0.08, to: 220 }); tone(247, 0.45, 0.9, { type: 'triangle', gain: 0.08, to: 147 }); },
  splash: () => { noise(0, 1.3, { filter: 'lowpass', f: 2600, to: 300, gain: 0.22, attack: 0.02, hold: 0.1 }); tone(98, 0, 0.3, { gain: 0.12, to: 50 }); },
};

/** Play a sound effect (nothing happens when muted, or if the browser has no audio). */
export function sfx(name: Sfx) {
  if (name === 'none' || useSound.getState().muted) return;
  try { SOUNDS[name](); } catch { /* audio is a nicety: never let it break the game */ }
}

/** One listener for the whole game: every button taps, unless it names its own sound with `data-sfx`. */
export function installClickSounds(root: HTMLElement): () => void {
  const onClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('button, [role="radio"], [role="checkbox"], summary');
    if (!el || (el as HTMLButtonElement).disabled) return;
    sfx((el.dataset.sfx as Sfx | undefined) ?? 'tap');
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
