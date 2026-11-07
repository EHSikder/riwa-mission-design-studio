/** The link-budget basics: decibels, Boltzmann's constant, the required Eb/N0 and free-space path loss. */
import { C_LIGHT } from '../core/constants';

export const dB = (x: number) => 10 * Math.log10(x);
export const BOLTZMANN_DB = 228.6;
/** Eb/N0 for a turbo/LDPC code at BER 1e-6 (2.5 dB) plus 3 dB link margin. */
export const REQUIRED_EBN0_DB = 5.5;
export const pathLossDb = (distanceM: number, freqHz: number) => 20 * Math.log10((4 * Math.PI * distanceM * freqHz) / C_LIGHT);
