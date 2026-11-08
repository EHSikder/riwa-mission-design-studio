/**
 * Seeded pseudo-random numbers (sfc32). The same seed always produces the same sequence, which makes
 * every flight (including random failures) exactly replayable for training and fair comparisons.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  const next = (): number => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) next(); // warm-up
  return { next, seed: seed >>> 0 };
}
