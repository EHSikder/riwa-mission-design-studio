/**
 * The Mission Design Studio's shared vocabulary (docs/03). The models work in SI units (m, s, kg, W); catalog
 * fields carry their unit in the name (altKm, costM in US$ millions, dataMbps, powerW, devMonths).
 */
import { AU, J2_EARTH, MU_EARTH, MU_MOON, OMEGA_EARTH, R_EARTH, R_MOON } from '../../sim/core/constants';

export type { Sourced } from '../../sim/design/catalog';

export type Difficulty = 'cadet' | 'engineer' | 'expert' | 'sandbox';
export type RoleId = 'director' | 'spacecraft' | 'science' | 'comms' | 'resources';
export type ResourceId = 'mass' | 'power' | 'budget' | 'data' | 'comms' | 'time';
export type BodyId = 'earth' | 'moon' | 'mars';
export type ScenarioId = 'tutorial' | 'angola-eo' | 'geo-comms' | 'lunar-relay' | 'mars-orbiter';

export const ROLES: Record<RoleId, { name: string; short: string; desk: string; explain: string }> = {
  director: {
    name: 'Mission Director',
    short: 'Director',
    desk: 'Mission',
    explain: 'Chooses the objectives and how ambitious the requirements are, the orbit, the launcher and the schedule.',
  },
  spacecraft: {
    name: 'Spacecraft Engineer',
    short: 'Spacecraft',
    desk: 'Spacecraft',
    explain: 'Builds the bus: structure, solar arrays, battery, computer, attitude control and propulsion.',
  },
  science: {
    name: 'Science Lead',
    short: 'Science',
    desk: 'Payload',
    explain: 'Picks the instruments (or the communications payload) that do the job the customer pays for.',
  },
  comms: {
    name: 'Communications Lead',
    short: 'Comms',
    desk: 'Comms',
    explain: 'Designs the radio link home: band, antenna, transmitter, onboard storage and ground stations.',
  },
  resources: {
    name: 'Resource Manager',
    short: 'Resources',
    desk: 'Resources',
    explain: 'Holds the money: splits the budget, keeps a reserve, and approves or rejects change requests.',
  },
};

export const RESOURCES: Record<ResourceId, { name: string; unit: string; explain: string }> = {
  mass: { name: 'Mass', unit: 'kg', explain: 'Everything the rocket must lift: the spacecraft, its instruments and its propellant.' },
  power: { name: 'Power', unit: 'W', explain: 'Electricity from the solar arrays, stored in the battery for the time spent in shadow.' },
  budget: { name: 'Budget', unit: '$M', explain: 'Money to build, launch and operate the mission, plus a reserve for surprises.' },
  data: { name: 'Data', unit: 'Gbit/day', explain: 'What the instruments produce each day, and how much of it actually reaches the ground.' },
  comms: { name: 'Comms', unit: 'Mbps', explain: 'How fast the spacecraft can talk to the ground, and for how long each day it can.' },
  time: { name: 'Time', unit: 'months', explain: 'How long it takes to build and launch, and how many years the spacecraft will work.' },
};

/** A place on a body: latitude and longitude in degrees (east positive). */
export interface LatLon {
  lat: number;
  lon: number;
}

export interface Body {
  id: BodyId;
  name: string;
  mu: number;
  radius: number;
  j2: number;
  /** Sidereal rotation rate (rad/s). */
  rotation: number;
  /** Mean distance from the Sun (m): sets the solar power. */
  sunDistance: number;
  /** Mean motion of the Sun around the body (rad/s): one year, or one Mars year. */
  sunRate: number;
  /** Tilt of the equator to the orbit around the Sun (rad): the seasons. */
  obliquity: number;
  /** A magnetic field strong enough for magnetorquers to push against. */
  magneticField: boolean;
  /** An atmosphere: drag in low orbit, and aerobraking. */
  atmosphere: boolean;
}

const YEAR_S = 365.2422 * 86_400;

export const BODIES: Record<BodyId, Body> = {
  earth: {
    id: 'earth', name: 'Earth', mu: MU_EARTH, radius: R_EARTH, j2: J2_EARTH, rotation: OMEGA_EARTH,
    sunDistance: AU, sunRate: (2 * Math.PI) / YEAR_S, obliquity: 23.44 * (Math.PI / 180), magneticField: true, atmosphere: true,
  },
  moon: {
    id: 'moon', name: 'Moon', mu: MU_MOON, radius: R_MOON, j2: 2.033e-4, rotation: (2 * Math.PI) / (27.3217 * 86_400),
    sunDistance: AU, sunRate: (2 * Math.PI) / YEAR_S, obliquity: 1.54 * (Math.PI / 180), magneticField: false, atmosphere: false,
  },
  // NASA Mars Fact Sheet: GM 42 828 km³/s², mean radius 3 389.5 km, J2 1960.45e-6, day 24.6229 h, year 686.98 d
  mars: {
    id: 'mars', name: 'Mars', mu: 4.282_837e13, radius: 3_389_500, j2: 1.960_45e-3, rotation: (2 * Math.PI) / (24.6229 * 3600),
    sunDistance: 1.523_7 * AU, sunRate: (2 * Math.PI) / (686.98 * 86_400), obliquity: 25.19 * (Math.PI / 180), magneticField: false, atmosphere: true,
  },
};

export const YEAR = YEAR_S;
export const MARS_YEAR_DAYS = 686.98;
