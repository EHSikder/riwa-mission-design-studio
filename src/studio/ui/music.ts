/**
 * The background music, made in the browser like the sound effects (nothing to download, works offline): a
 * slow pad that drifts through four chords over a low root, and every few seconds a soft bell from the same
 * scale, all through a long echo. Browsers keep a page quiet until its first click, tap or key press, so the
 * music starts then and plays on from screen to screen. It pauses while the tab is hidden. One switch turns it
 * off, and the choice stays in this browser.
 */
import { create } from 'zustand';
import { audio } from './sound';

const KEY = 'riwa.journey.music';

/** MIDI note number to frequency (Hz). */
const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** In D major: D maj9, B minor 9, G maj7 with a raised 11th, A sus2. Root first. */
export const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 61, 62],
  [43, 50, 54, 57, 61],
  [45, 52, 57, 59, 64],
];
/** The bells: D major pentatonic, two octaves up. */
export const BELLS = [74, 76, 78, 81, 83, 86, 88, 90];
/** Seconds each chord holds before the next one fades in over it. */
export const CHORD_S = 12;
/** How loud the music is at its fullest (the sound effects go up to about twice this). */
export const LEVEL = 0.32;

/** A long, dark echo: two channels of noise that die away. */
function echoOf(c: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const b = c.createBuffer(2, Math.floor(c.sampleRate * seconds), c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // a little low-pass on the noise, so the tail is soft rather than hissy
      last = 0.7 * last + 0.3 * (Math.random() * 2 - 1);
      d[i] = last * Math.exp(-i / (c.sampleRate * decay));
    }
  }
  return b;
}

/** The music on one audio context: it schedules its notes a few seconds ahead (an offline context works too, for tests). */
export class Score {
  readonly out: GainNode;
  private pad: BiquadFilterNode;
  private echo: ConvolverNode;
  private lfo: OscillatorNode;
  private live = new Set<AudioScheduledSourceNode>();
  private chordAt: number;
  private bellAt: number;
  private chord = 0;
  private lastBell = -1;

  constructor(private c: BaseAudioContext, dest: AudioNode, start: number, private rand: () => number = Math.random) {
    this.chordAt = start;
    this.bellAt = start + 5;
    this.out = c.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(dest);
    this.echo = c.createConvolver();
    this.echo.buffer = echoOf(c, 5, 1.5);
    const wet = c.createGain();
    wet.gain.value = 0.8;
    this.echo.connect(wet).connect(this.out);
    // the pad's filter opens and closes over about twenty seconds
    this.pad = c.createBiquadFilter();
    this.pad.type = 'lowpass';
    this.pad.frequency.value = 900;
    this.pad.Q.value = 0.6;
    this.lfo = c.createOscillator();
    this.lfo.frequency.value = 0.045;
    const depth = c.createGain();
    depth.gain.value = 420;
    this.lfo.connect(depth).connect(this.pad.frequency);
    this.lfo.start(start);
    const dry = c.createGain();
    dry.gain.value = 0.6;
    this.pad.connect(dry).connect(this.out);
    this.pad.connect(this.echo);
  }

  fadeIn(at: number, seconds = 4) {
    this.out.gain.setValueAtTime(0.0001, at);
    this.out.gain.exponentialRampToValueAtTime(LEVEL, at + seconds);
  }

  /** Schedules every note that starts before `until`. After a long pause (`now` far ahead) it picks up from now, rather than playing what it missed all at once. */
  fill(now: number, until: number) {
    if (this.chordAt < now) this.chordAt = now + 0.05;
    if (this.bellAt < now) this.bellAt = now + 1;
    while (this.chordAt < until) {
      this.playChord(this.chordAt, CHORDS[this.chord++ % CHORDS.length]);
      this.chordAt += CHORD_S;
    }
    while (this.bellAt < until) {
      this.playBell(this.bellAt);
      this.bellAt += 2.5 + this.rand() * 5.5;
    }
  }

  /** Fades out and stops everything. */
  stop(at: number, seconds = 1.2) {
    const g = this.out.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(Math.max(0.0001, g.value), at);
    g.exponentialRampToValueAtTime(0.0001, at + seconds);
    for (const n of [...this.live, this.lfo]) {
      try { n.stop(at + seconds + 0.05); } catch { /* already stopped */ }
    }
  }

  private osc(type: OscillatorType, f: number, detune: number, at: number, end: number, to: AudioNode) {
    const o = this.c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(to);
    o.start(at);
    o.stop(end);
    this.live.add(o);
    o.onended = () => this.live.delete(o);
  }

  private gain(value: number, to: AudioNode) {
    const g = this.c.createGain();
    g.gain.value = value;
    g.connect(to);
    return g;
  }

  /** Five notes on two slightly detuned saws each, swelling in over four seconds and fading under the next chord. */
  private playChord(at: number, notes: number[]) {
    const end = at + CHORD_S + 6;
    const env = this.gain(0.0001, this.pad);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(1, at + 4);
    env.gain.setValueAtTime(1, at + CHORD_S - 1);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    for (const n of notes) {
      const v = this.gain(0.02, env);
      this.osc('sawtooth', hz(n), -7, at, end, v);
      this.osc('sawtooth', hz(n), 7, at, end, v);
    }
    // the root an octave down, round and quiet
    this.osc('sine', hz(notes[0] - 12), 0, at, end, this.gain(0.08, env));
  }

  /** A soft bell somewhere left or right, mostly heard through the echo. */
  private playBell(at: number) {
    let k = Math.floor(this.rand() * BELLS.length);
    if (k === this.lastBell) k = (k + 2) % BELLS.length;
    this.lastBell = k;
    const f = hz(BELLS[k]);
    const pan = this.c.createStereoPanner();
    pan.pan.value = this.rand() * 1.2 - 0.6;
    pan.connect(this.echo);
    pan.connect(this.gain(0.35, this.out));
    const env = this.gain(0.0001, pan);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.045, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 3.5);
    this.osc('sine', f, 0, at, at + 3.6, env);
    // a bell's bright partial, not a whole octave up
    this.osc('sine', f * 2.76, 0, at, at + 3.6, this.gain(0.2, env));
  }
}

// ---------------------------------------------------------------- playing it in the page

let score: Score | null = null;
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function start() {
  const c = audio();
  if (!c) return;
  ctx = c;
  if (score) return;
  const t = c.currentTime + 0.05;
  score = new Score(c, c.destination, t);
  score.fadeIn(t);
  score.fill(t, t + 8);
  timer = setInterval(() => {
    if (score && c.state === 'running') score.fill(c.currentTime, c.currentTime + 8);
  }, 2000);
}

function stop() {
  if (!score || !ctx) return;
  clearInterval(timer);
  score.stop(ctx.currentTime);
  const old = score;
  score = null;
  setTimeout(() => old.out.disconnect(), 1500);
}

const savedOn = (() => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
})();

export const useMusic = create<{ on: boolean; toggle: () => void }>((set, get) => ({
  on: savedOn,
  toggle: () => {
    const on = !get().on;
    set({ on });
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* keep going */ }
    // the switch is a click, so the browser lets the music start right away
    if (on) start(); else stop();
  },
}));

/** Starts the music with the page's first click, tap or key press (when it is on) and pauses it while the tab is hidden. */
export function installMusic(): () => void {
  const events = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const;
  const drop = () => events.forEach((e) => window.removeEventListener(e, kick, true));
  function kick() {
    if (!useMusic.getState().on) { drop(); return; }
    try { start(); } catch { /* music is a nicety: never let it break the game */ }
    // some browsers only allow sound after the press is released: keep listening until it plays
    if (ctx?.state === 'running') drop();
  }
  const onVisible = () => {
    if (!ctx || !score) return;
    if (document.hidden) void ctx.suspend().catch(() => undefined);
    else void ctx.resume().catch(() => undefined);
  };
  events.forEach((e) => window.addEventListener(e, kick, true));
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    drop();
    document.removeEventListener('visibilitychange', onVisible);
    stop();
  };
}
