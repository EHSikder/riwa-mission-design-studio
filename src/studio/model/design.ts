/**
 * A studio mission design: every decision the team makes, grouped by the desk (role) that owns it. Plain data,
 * so it can be saved, shared as a code, sent over the LAN and compared.
 */
import type { AntennaId, AdcsId, ArrayMountId, BandId, CellId, ComputerId, LauncherId, OrbitTypeId, PlatformId, PropulsionId, StationId } from './catalog';
import type { InstrumentId } from './instruments';
import type { Difficulty, RoleId, ScenarioId } from './types';

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
  /** Years of operations the team plans (and pays) for. */
  plannedYears: number;
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
}

/** Which desk owns each design field: the hot-seat and LAN games lock the others' fields. */
export const FIELD_OWNER: Record<keyof Omit<StudioDesign, 'version' | 'scenario' | 'name'>, RoleId> = {
  primary: 'director', secondary: 'director', levels: 'director', orbit: 'director', launcher: 'director', plannedYears: 'director',
  platform: 'spacecraft', cells: 'spacecraft', mount: 'spacecraft', arrayM2: 'spacecraft', batteryWh: 'spacecraft', computer: 'spacecraft',
  redundant: 'spacecraft', adcs: 'spacecraft', propulsion: 'spacecraft', propellantMarginPct: 'spacecraft',
  instruments: 'science',
  band: 'comms', antenna: 'comms', dishM: 'comms', txW: 'comms', storageGbit: 'comms', stations: 'comms', trackHoursPerDay: 'comms',
  reservePct: 'resources', insurance: 'resources',
};

/** How the difficulty scales the scenario's budget and schedule, and what it switches on. */
export const DIFFICULTY: Record<Difficulty, { name: string; explain: string; budget: number; deadline: number; events: boolean; advanced: boolean }> = {
  cadet: { name: 'Cadet', explain: 'More money and time, simpler parts, a coach that guides you, no random failures.', budget: 1.3, deadline: 1.25, events: false, advanced: false },
  engineer: { name: 'Engineer', explain: 'The real numbers: the full catalog, realistic budget and schedule, random events in flight.', budget: 1, deadline: 1, events: true, advanced: false },
  expert: { name: 'Expert', explain: 'A tight budget, advanced options (cell types, sun tracking, redundancy, agile pointing) and more surprises.', budget: 0.85, deadline: 0.9, events: true, advanced: true },
  sandbox: { name: 'Sandbox', explain: 'No limits on money, time or parts: experiment and see what each choice does.', budget: Infinity, deadline: Infinity, events: false, advanced: true },
};

export const cloneDesign = (d: StudioDesign): StudioDesign => JSON.parse(JSON.stringify(d)) as StudioDesign;
