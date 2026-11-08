/**
 * Radio links. The link budget: radiated power and antenna gain on one end, the receiver's figure of merit
 * G/T on the other, the free-space loss of the distance between them, and the energy per bit a good code
 * needs (plus 3 dB of margin). The result is the data rate the link can carry.
 * Tropical rain fades the high bands: availability is the share of the time the margin beats the fade.
 */
import { DISH_EFFICIENCY } from './catalog';
import type { CommsBand } from './instruments';
import { C_LIGHT } from './types';

const dB = (x: number) => 10 * Math.log10(x);
const BOLTZMANN_DB = 228.6;
/** Eb/N0 for a turbo/LDPC code at BER 1e-6 (2.5 dB) plus 3 dB link margin. */
const REQUIRED_EBN0_DB = 5.5;
const pathLossDb = (distanceM: number, freqHz: number) => 20 * Math.log10((4 * Math.PI * distanceM * freqHz) / C_LIGHT);

export const dishGainDbi = (diameterM: number, freqHz: number) => dB(DISH_EFFICIENCY * ((Math.PI * diameterM * freqHz) / C_LIGHT) ** 2);
/** Half-power beamwidth of a dish (deg). */
export const beamwidthDeg = (diameterM: number, freqHz: number) => (70 * C_LIGHT) / (freqHz * diameterM);

export interface LinkEnds {
  txW: number;
  txGainDbi: number;
  freqHz: number;
  rxGtDbK: number;
  capMbps: number;
  /** Atmosphere and other losses (dB). */
  lossDb: number;
}

/** Feed, cable and pointing losses on the transmit side (dB). */
const TX_LOSSES_DB = 2;

export function linkRate(l: LinkEnds, rangeM: number): { mbps: number; marginDb: number; cn0: number } {
  const eirp = dB(l.txW) + l.txGainDbi - TX_LOSSES_DB;
  const cn0 = eirp - pathLossDb(rangeM, l.freqHz) - l.lossDb + l.rxGtDbK + BOLTZMANN_DB;
  const bps = 10 ** ((cn0 - REQUIRED_EBN0_DB) / 10);
  const mbps = Math.min(l.capMbps, bps / 1e6);
  // REQUIRED_EBN0_DB already holds 3 dB of margin; a rate capped by the radios leaves more
  const marginDb = mbps > 0 ? cn0 - (REQUIRED_EBN0_DB - 3) - dB(mbps * 1e6) : -Infinity;
  return { mbps, marginDb, cn0 };
}

/**
 * Rain fade exceeded for a share of the year (%) in a tropical climate like Angola's (ITU-R rain zones N–P),
 * for the downlink of each band (dB). Estimates in the shape of ITU-R P.618.
 */
const RAIN_FADE: Record<CommsBand, [number, number][]> = {
  C: [[1, 0.05], [0.3, 0.1], [0.1, 0.3], [0.05, 0.5], [0.01, 1.2]],
  Ku: [[1, 0.8], [0.3, 2], [0.1, 4.5], [0.05, 7], [0.01, 15]],
  Ka: [[1, 2.5], [0.3, 6], [0.1, 12], [0.05, 18], [0.01, 35]],
};

/** Share of the time (%) a link with `marginDb` of rain margin stays up. */
export function availabilityPct(band: CommsBand, marginDb: number): number {
  const rows = RAIN_FADE[band];
  if (marginDb >= rows[rows.length - 1][1]) return 99.99;
  if (marginDb <= rows[0][1]) return Math.max(95, 100 - rows[0][0] * (rows[0][1] / Math.max(marginDb, 0.01)));
  for (let i = 0; i < rows.length - 1; i++) {
    const [p1, a1] = rows[i];
    const [p2, a2] = rows[i + 1];
    if (marginDb >= a1 && marginDb <= a2) {
      // log-linear in the exceeded percentage
      const f = (marginDb - a1) / (a2 - a1);
      return 100 - Math.exp(Math.log(p1) + f * (Math.log(p2) - Math.log(p1)));
    }
  }
  return 99.99;
}
