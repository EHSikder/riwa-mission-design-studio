/**
 * Shared power parts. Every number has a source note; "estimate: true" marks values that are engineering
 * estimates or calibrations rather than published figures (shown with ⚠ in the UI).
 * Masses kg, cost $M (US dollars, then-year).
 */

export interface Sourced {
  source: string;
  estimate: boolean;
}

export type CellId = 'gaas3j' | 'si';

export const SOLAR_CELLS: Record<CellId, Sourced & { name: string; efficiency: number; kgPerM2: number; costPerM2M: number }> = {
  gaas3j: {
    name: 'Triple-junction GaAs',
    efficiency: 0.3,
    kgPerM2: 2.6,
    costPerM2M: 0.35,
    source: 'NASA Small Spacecraft SOA (multi-junction III-V > 30%); areal mass and cost are estimates',
    estimate: true,
  },
  si: {
    name: 'Silicon',
    efficiency: 0.16,
    kgPerM2: 2.2,
    costPerM2M: 0.12,
    source: 'Space-grade Si cells ~14–17%; areal mass and cost are estimates',
    estimate: true,
  },
};

export const BATTERY = { whPerKg: 150, costPerKwhM: 0.5, source: 'Li-ion pack level ~100–150 Wh/kg (cells up to 265 Wh/kg, NASA SOA)' };
