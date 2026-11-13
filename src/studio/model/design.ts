/**
 * A studio mission design: every decision the team makes, grouped by the desk (role) that owns it. Plain data,
 * so it can be saved, shared as a code, sent over the LAN and compared.
 */
import type { AntennaId, AdcsId, ArrayMountId, BandId, CellId, ComputerId, LauncherId, OrbitTypeId, PlatformId, PropulsionId, StationId } from './catalog';
import type { CrewChoice } from './crew';
import type { InstrumentId } from './instruments';
import type { TestId } from './tests';
import type { Difficulty, ScenarioId } from './types';

export type Level = 'threshold' | 'goal';

export interface OrbitChoice {
  type: OrbitTypeId;
  /** Altitude (circular orbits) or low point (elliptical Mars orbit), km. */
  altKm: number;
  /** Inclination for the low inclined Earth orbit (deg). */
  incDeg: number;
  /** Sun-synchronous local time of the ascending node (hours). */
  ltanH: number;
  /** GEO slot longitude (deg east). */
  lonDeg: number;
  /** Lunar halo: a fast transfer with a lunar flyby, or a slow low-energy one. */
  transfer: 'direct' | 'lowEnergy';
  /** Mars: brake into orbit with the engine, or skim the atmosphere for months (aerobraking). */
  capture: 'propulsive' | 'aerobrake';
}

export interface StudioDesign {
  version: 1;
  scenario: ScenarioId;
  name: string;
  // ---------------------------------------------------------- Mission Director
  primary: string;
  secondary: string[];
  /** Ambition chosen for each requirement (by requirement id). */
  levels: Record<string, Level>;
  orbit: OrbitChoice;
  launcher: LauncherId;
  /** Years of operations the team plans (and pays) for. A crewed flight lasts as long as its trajectory. */
  plannedYears: number;
  /** The ground tests the team plans before launch (model/tests.ts). */
  tests: TestId[];
  // ---------------------------------------------------------- Spacecraft Engineer
  platform: PlatformId;
  cells: CellId;
  mount: ArrayMountId;
  arrayM2: number;
  batteryWh: number;
  computer: ComputerId;
  /** A spare computer that takes over if the first fails. */
  redundant: boolean;
  adcs: AdcsId;
  propulsion: PropulsionId;
  /** Extra propellant beyond the Δv budget (%). */
  propellantMarginPct: number;
  // ---------------------------------------------------------- Science Lead
  instruments: InstrumentId[];
  // ---------------------------------------------------------- Communications Lead
  band: BandId;
  antenna: AntennaId;
  dishM: number;
  /** Transmitter radiated power (W). */
  txW: number;
  storageGbit: number;
  stations: StationId[];
  /** Deep-space missions: tracking hours bought per day. */
  trackHoursPerDay: number;
  // ---------------------------------------------------------- Resource Manager
  /** Management reserve as a share of the development cost (%). */
  reservePct: number;
  /** Launch-plus-first-year insurance (GEO). */
  insurance: boolean;
  // ---------------------------------------------------------- crewed missions only
  crew?: CrewChoice;
}

/** How the difficulty scales the scenario's budget and schedule, and what it switches on. */
export const DIFFICULTY: Record<Difficulty, { name: string; explain: string; budget: number; deadline: number; events: boolean; advanced: boolean }> = {
  guided: { name: 'Guided', explain: 'No space knowledge needed. A mission guide lights up the next thing to click and suggests a choice that works. Lots of money and time, no surprises.', budget: 1.6, deadline: 1.5, events: false, advanced: false },
  cadet: { name: 'Cadet', explain: 'More money and time, simpler parts, a coach that guides you, no random failures.', budget: 1.3, deadline: 1.25, events: false, advanced: false },
  engineer: { name: 'Engineer', explain: 'The real numbers: the full catalog, realistic budget and schedule, random events in flight.', budget: 1, deadline: 1, events: true, advanced: false },
  expert: { name: 'Expert', explain: 'A tight budget, advanced options (cell types, sun tracking, redundancy, agile pointing) and more surprises.', budget: 0.85, deadline: 0.9, events: true, advanced: true },
  sandbox: { name: 'Sandbox', explain: 'No limits on money, time or parts: experiment and see what each choice does.', budget: Infinity, deadline: Infinity, events: false, advanced: true },
};

export const cloneDesign = (d: StudioDesign): StudioDesign => JSON.parse(JSON.stringify(d)) as StudioDesign;

/** A design saved or shared by an older version of the game: fill in what it did not have. */
export const normalizeDesign = (d: StudioDesign): StudioDesign => ({ ...d, tests: Array.isArray(d.tests) ? d.tests : [] });
