/**
 * Flying people. A crewed spacecraft is an ordinary spacecraft plus everything that keeps a crew alive and
 * brings it home: air, water and food for every day (and some days to spare), a cabin to live in, a place to
 * hide from a solar storm, a way off a failing rocket and a heat shield for the speed of the return.
 *
 * Numbers follow NASA's Orion and the Artemis flights where they are public, and NASA's life-support planning
 * values (BVAD); the rest are our estimates (`estimate: true`, shown with ⚠). Sources: REFERENCES.md.
 */
import type { Sourced } from './types';

export type EclssId = 'open' | 'regen';
export type ShelterId = 'none' | 'stowage' | 'shielded';
export type AbortId = 'none' | 'tower' | 'pusher';
export type ShieldId = 'leo' | 'lunar';
export type SuitId = 'iva' | 'eva';

/** The crew systems the team chooses (crewed missions only). */
export interface CrewChoice {
  size: number;
  eclss: EclssId;
  /** Days of air, water and food carried beyond the plan. */
  marginDays: number;
  shelter: ShelterId;
  suits: SuitId;
  abort: AbortId;
  shield: ShieldId;
}

/** One astronaut with clothes and personal kit, plus a seat and a launch-and-entry suit (kg; estimate). */
export const CREW_KG = 100;
export const SEAT_AND_SUIT_KG = 45;
/** Sleeping, waking and working: metabolic heat and equipment per person (W; estimate). */
export const CREW_POWER_W = 90;

export const ECLSS: Record<EclssId, Sourced & { name: string; explain: string; hardwareKg: number; baseW: number; perCrewW: number; kgPerCrewDay: number; costM: number; devMonths: number; faultChance: number }> = {
  open: {
    name: 'Stored air and canisters',
    explain: 'Oxygen comes from tanks and carbon dioxide is soaked up by canisters the crew swaps by hand. Simple and reliable, but every extra day needs more tanks and canisters.',
    hardwareKg: 260, baseW: 150, perCrewW: 60, kgPerCrewDay: 7.5, costM: 40, devMonths: 18, faultChance: 0.15,
    source: 'Apollo and Shuttle used lithium hydroxide canisters; per-day mass from NASA BVAD values (oxygen 0.82, water ~3, food ~1.8, canisters ~1.9 kg per person)', estimate: true,
  },
  regen: {
    name: 'Regenerating scrubber',
    explain: 'A bed of amine beads soaks up carbon dioxide and moisture, then vents them to space and starts again (Orion flies one). Less to carry per day, but more machinery, more power and more to go wrong.',
    hardwareKg: 430, baseW: 500, perCrewW: 90, kgPerCrewDay: 5.6, costM: 120, devMonths: 26, faultChance: 0.3,
    source: 'Orion\'s amine swing-bed system; masses and power are estimates', estimate: true,
  },
};

export const SHELTERS: Record<ShelterId, Sourced & { name: string; explain: string; massKg: number; costM: number; stormMsv: number }> = {
  none: {
    name: 'No shelter',
    explain: 'Nothing planned: in a solar storm the crew has only the cabin wall between them and the radiation.',
    massKg: 0, costM: 0, stormMsv: 500,
    source: 'Dose behind a thin cabin wall in a very large solar particle event: order of magnitude from published estimates for the August 1972 event', estimate: true,
  },
  stowage: {
    name: 'Stowage shelter',
    explain: 'The crew packs supply bags and water around the stowage bays and climbs inside (Orion\'s plan). Almost free, but the crew is out of action for the storm.',
    massKg: 60, costM: 5, stormMsv: 120,
    source: 'Orion limits a large storm to 150 mSv in its stowage shelter (Artemis I measurements, Nature 2024); our value assumes a slightly smaller event', estimate: true,
  },
  shielded: {
    name: 'Shielded shelter',
    explain: 'A small compartment lined with polyethylene: the best protection, at the price of nearly a tonne.',
    massKg: 900, costM: 60, stormMsv: 45,
    source: 'Hydrogen-rich shielding concepts for deep-space habitats; mass and dose are estimates', estimate: true,
  },
};

export const ABORTS: Record<AbortId, Sourced & { name: string; explain: string; massKg: number; costM: number; saves: number }> = {
  none: {
    name: 'No escape system',
    explain: 'Lighter and cheaper. If the rocket fails, the crew goes with it.',
    massKg: 0, costM: 0, saves: 0,
    source: '—', estimate: false,
  },
  tower: {
    name: 'Escape tower',
    explain: 'A solid rocket on top pulls the capsule off a failing launcher in milliseconds, and is thrown away on the way up so it costs the spacecraft no mass (Apollo, Orion, Soyuz).',
    massKg: 0, costM: 180, saves: 0.97,
    source: 'Orion Launch Abort System (about 7 t, jettisoned during ascent); cost and success rate are estimates', estimate: true,
  },
  pusher: {
    name: 'Built-in abort engines',
    explain: 'Engines in the capsule\'s walls push it away (Crew Dragon, Starliner). Nothing to throw away, but the engines and their propellant ride the whole mission.',
    massKg: 1_800, costM: 240, saves: 0.95,
    source: 'Crew Dragon SuperDraco / Starliner pusher abort; mass, cost and success rate are estimates', estimate: true,
  },
};

export const SHIELDS: Record<ShieldId, Sourced & { name: string; explain: string; massShare: number; costM: number; maxEntryKms: number }> = {
  leo: {
    name: 'Low-orbit heat shield',
    explain: 'Built for coming home from Earth orbit at 7.8 km/s.',
    massShare: 0, costM: 0, maxEntryKms: 8,
    source: 'Entry speed from low Earth orbit', estimate: false,
  },
  lunar: {
    name: 'Lunar-return heat shield',
    explain: 'Coming back from the Moon the capsule hits the air at 11 km/s. Heating grows roughly with the cube of the speed, so the shield must be thicker.',
    massShare: 0.05, costM: 45, maxEntryKms: 11.2,
    source: 'Orion re-enters at about 11 km/s (NASA); the extra mass is an estimate', estimate: true,
  },
};

export const EVA_SUITS = { perCrewKg: 80, airlockKg: 150, costM: 90 } as const;

/** Galactic cosmic rays through a capsule wall, beyond Earth's magnetic field (mSv per day). */
// Artemis I: 26.7–35.4 mSv in 25.5 days (two instrumented mannequins)
export const GCR_MSV_PER_DAY = 1.2;
/** NASA's career limit for an astronaut (mSv), for scale. */
export const CAREER_LIMIT_MSV = 600;

/** Living room each person needs, growing with the days spent in it (m³; estimate fitted to Orion's 21-day design). */
export const habNeedM3 = (days: number) => 1.6 + 0.03 * days;

/** Mission-control call signs, for the flight log of a crewed mission. */
export const CALL_SIGNS = { director: 'FLIGHT', spacecraft: 'EECOM', science: 'SURGEON', comms: 'CAPCOM', resources: 'PROGRAM' } as const;

// ------------------------------------------------------------------ the trip
export type CrewOrbitId = 'freeReturn' | 'crewDro' | 'crewNrho' | 'crewLlo';

/** How long each trajectory takes, how long it stays at the Moon, and what its burns cost (m/s). */
export const CREW_TRIPS: Record<CrewOrbitId, Sourced & { days: number; moonDays: number; outboundDays: number; orbit: boolean; closestKm: number; inMs: number; outMs: number; trimMs: number }> = {
  freeReturn: {
    days: 10, moonDays: 1, outboundDays: 5, orbit: false, closestKm: 6_500, inMs: 0, outMs: 0, trimMs: 60,
    source: 'Artemis II (April 2026): about 10 days, passing some 6 500 km beyond the far side', estimate: false,
  },
  crewDro: {
    days: 22, moonDays: 6, outboundDays: 8, orbit: true, closestKm: 64_000, inMs: 330, outMs: 470, trimMs: 60,
    source: 'Artemis I (2022): 25.5 days, 6 of them in a distant retrograde orbit, about 850 m/s of burns in all', estimate: true,
  },
  crewNrho: {
    days: 30, moonDays: 12, outboundDays: 9, orbit: true, closestKm: 3_000, inMs: 430, outMs: 430, trimMs: 60,
    source: 'NASA Gateway orbit studies: roughly 840–900 m/s for Orion to enter and leave the near-rectilinear halo orbit', estimate: true,
  },
  crewLlo: {
    days: 12, moonDays: 3, outboundDays: 4, orbit: true, closestKm: 100, inMs: 900, outMs: 950, trimMs: 60,
    source: 'Apollo: about 890 m/s into a 110 km orbit and 1 000 m/s back out', estimate: true,
  },
};

/** What the analysis works out for a crewed design; the flight starts from it. */
export interface CrewPlan {
  callSign: string;
  size: number;
  days: number;
  moonDays: number;
  outboundDays: number;
  /** Stops at the Moon (two big burns) rather than swinging past. */
  orbit: boolean;
  inMs: number;
  outMs: number;
  /** Days of air, water and food on board. */
  supplyDays: number;
  marginDays: number;
  /** Planning dose: cosmic rays for the whole trip plus one large solar storm in the shelter (mSv). */
  doseMsv: number;
  cabinM3: number;
  cabinNeedM3: number;
  /** Chance the escape system saves the crew from a failing rocket. */
  abortSaves: number;
  shieldOk: boolean;
}
