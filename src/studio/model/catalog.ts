/**
 * The studio's parts catalog: platforms (the structure), power, computers and storage, attitude control,
 * propulsion, radios and antennas, ground stations, launchers and orbit types. Masses kg, power W, cost $M
 * (US dollars, approximate recent prices), development time in months. Every entry carries a source note;
 * `estimate: true` marks engineering estimates and calibrations (shown with ⚠).
 */
import type { BodyId, Sourced } from './types';

// ------------------------------------------------------------------ platforms (structure)
export type PlatformId = 'none' | 'cube6u' | 'cube12u' | 'micro' | 'small' | 'medium' | 'large' | 'capsule3' | 'capsule4' | 'capsuleHab';

export interface Platform extends Sourced {
  name: string;
  short: string;
  explain: string;
  /** Primary structure, mounts and thermal hardware (kg). */
  structureKg: number;
  /** Heaviest spacecraft the structure is qualified to carry at launch (kg). */
  maxMassKg: number;
  /** Instrument accommodation: slots and the payload mass they can hold. */
  slots: number;
  maxPayloadKg: number;
  /** Largest solar array and antenna dish the structure can stow and deploy. */
  maxArrayM2: number;
  maxDishM: number;
  /** Always-on housekeeping load: thermal control, sensors, power conversion idle (W). */
  housekeepingW: number;
  costM: number;
  devMonths: number;
  /** Assembly, integration and test after the last part arrives (months). */
  aitMonths: number;
  /** Body size (m): width, depth, height. For drag, body-mounted cells and the 3D model. */
  size: [number, number, number];
  cubesat: boolean;
  /** Crew capsules: seats and the room to live in (m³). */
  crew?: { seats: number; habM3: number };
}

export const PLATFORMS: Record<PlatformId, Platform> = {
  // nothing on the assembly stand yet: every design starts here
  none: {
    name: 'No structure yet', short: 'no', cubesat: false, explain: '',
    structureKg: 0, maxMassKg: 0, slots: 0, maxPayloadKg: 0, maxArrayM2: 0, maxDishM: 0, housekeepingW: 0,
    costM: 0, devMonths: 0, aitMonths: 0, size: [0.6, 0.6, 0.6],
    source: '—', estimate: false,
  },
  cube6u: {
    name: '6U CubeSat', short: '6U', cubesat: true,
    explain: 'A standard box the size of a cereal packet. Very cheap and quick, but there is little room for instruments, power or antennas.',
    structureKg: 1.5, maxMassKg: 12, slots: 1, maxPayloadKg: 4, maxArrayM2: 0.3, maxDishM: 0.3, housekeepingW: 2,
    costM: 0.15, devMonths: 9, aitMonths: 3, size: [0.1, 0.226, 0.366],
    source: 'CubeSat Design Specification Rev 14.1 (2022), Table 1: a 6U may weigh at most 12 kg. NASA CubeSat 101: a CubeSat takes 9 months at the fastest, 18–24 months typically. Structure mass and cost are typical values', estimate: true,
  },
  cube12u: {
    name: '12U CubeSat', short: '12U', cubesat: true,
    explain: 'Two 6U boxes side by side. Room for a real camera and deployable solar panels, still on a small budget.',
    structureKg: 3, maxMassKg: 24, slots: 2, maxPayloadKg: 10, maxArrayM2: 0.6, maxDishM: 0.5, housekeepingW: 4,
    costM: 0.3, devMonths: 10, aitMonths: 4, size: [0.226, 0.226, 0.366],
    source: 'CubeSat Design Specification Rev 14.1 (2022), Table 1: a 12U may weigh at most 24 kg. NASA CubeSat 101: 9 months at the fastest, 18–24 months typically. Structure mass and cost are typical values', estimate: true,
  },
  micro: {
    name: 'Microsatellite (≤ 180 kg)', short: 'Micro', cubesat: false,
    explain: 'A small satellite the size of a fridge, fits on rideshare rings. A good balance of capability and cost.',
    structureKg: 22, maxMassKg: 180, slots: 3, maxPayloadKg: 60, maxArrayM2: 2.5, maxDishM: 0.8, housekeepingW: 20,
    costM: 3, devMonths: 18, aitMonths: 6, size: [0.6, 0.7, 0.8],
    source: 'ESPA-class limits (≤ 180 kg); structure ~12–15% of launch mass (SMAD); cost is an estimate', estimate: true,
  },
  small: {
    name: 'Small satellite (≤ 700 kg)', short: 'Small', cubesat: false,
    explain: 'The workhorse class for Earth observation and science: several instruments, big solar wings, a real dish.',
    structureKg: 80, maxMassKg: 700, slots: 4, maxPayloadKg: 250, maxArrayM2: 8, maxDishM: 1.5, housekeepingW: 50,
    costM: 9, devMonths: 22, aitMonths: 8, size: [1.1, 1.1, 1.5],
    source: 'Typical small platforms (SSTL-300 / ESPA Grande class); estimates', estimate: true,
  },
  medium: {
    name: 'Medium satellite (≤ 2 500 kg)', short: 'Medium', cubesat: false,
    explain: 'A large science or lunar spacecraft: many instruments, big tanks for long trips, a 3 m dish.',
    structureKg: 240, maxMassKg: 2_500, slots: 6, maxPayloadKg: 700, maxArrayM2: 25, maxDishM: 3, housekeepingW: 120,
    costM: 25, devMonths: 28, aitMonths: 10, size: [1.7, 1.7, 2.4],
    source: 'Mars Reconnaissance Orbiter class (2.2 t at launch, 3 m HGA, 20 m² arrays); estimates', estimate: true,
  },
  large: {
    name: 'Large GEO bus (≤ 6 500 kg)', short: 'Large', cubesat: false,
    explain: 'A communications-satellite bus: huge solar wings for 10+ kW, room for dozens of transponders and big tanks for 15 years.',
    structureKg: 550, maxMassKg: 6_500, slots: 8, maxPayloadKg: 1_400, maxArrayM2: 80, maxDishM: 3.5, housekeepingW: 350,
    costM: 45, devMonths: 34, aitMonths: 12, size: [2.4, 2.9, 5],
    source: 'Typical GEO buses (Eurostar / SSL-1300 class, 3–6.5 t); estimates', estimate: true,
  },
  // crew capsules: the pressure cabin, heat shield and parachutes, on a service module with the engine and tanks
  capsule3: {
    name: 'Compact capsule (3 seats)', short: 'Compact capsule', cubesat: false, crew: { seats: 3, habM3: 5.5 },
    explain: 'A small cabin on a small service module, in the spirit of Apollo: light enough for big manoeuvres, but three people share the space of a family car.',
    structureKg: 8_600, maxMassKg: 22_000, slots: 2, maxPayloadKg: 250, maxArrayM2: 30, maxDishM: 1.2, housekeepingW: 1_300,
    costM: 780, devMonths: 36, aitMonths: 10, size: [3.9, 3.9, 6.4],
    source: 'Apollo command module (6.2 m³ habitable, 3 crew) on a modern service module; masses and cost are estimates', estimate: true,
  },
  capsule4: {
    name: 'Deep-space capsule (4 seats)', short: 'Deep-space capsule', cubesat: false, crew: { seats: 4, habM3: 9 },
    explain: 'Orion\'s class: four seats, about 9 m³ to live in, and a service module with four solar wings and a 26 kN engine.',
    structureKg: 14_300, maxMassKg: 28_000, slots: 3, maxPayloadKg: 450, maxArrayM2: 45, maxDishM: 1.5, housekeepingW: 2_200,
    costM: 1_300, devMonths: 40, aitMonths: 12, size: [5, 5, 7.3],
    source: 'NASA Orion: crew module ~10.4 t, 8.9–9.3 m³ habitable, 4 crew for 21 days; with the European Service Module ~26.5 t at launch. Cost from NASA OIG ($1B Orion + $0.3B service module); the split of dry masses is an estimate', estimate: true,
  },
  capsuleHab: {
    name: 'Capsule with a habitat module (4 seats)', short: 'Capsule + habitat', cubesat: false, crew: { seats: 4, habM3: 24 },
    explain: 'The same capsule with an extra room bolted on: space to stand up, exercise and work for a month. It weighs as much as it sounds.',
    structureKg: 19_500, maxMassKg: 36_000, slots: 5, maxPayloadKg: 900, maxArrayM2: 60, maxDishM: 2, housekeepingW: 3_000,
    costM: 1_900, devMonths: 48, aitMonths: 14, size: [5, 5, 10.5],
    source: 'A capsule plus a small logistics-and-habitation module (Gateway HALO class, scaled down); estimates', estimate: true,
  },
};

/** Harness, brackets and blankets: a fraction of everything else carried. */
export const INTEGRATION_MASS_FRACTION = 0.06;
/** Assembly, integration and test cost as a fraction of the hardware. */
export const AIT_COST_FRACTION = 0.15;

// ------------------------------------------------------------------ power
export type CellId = 'gaas3j' | 'si';
export type ArrayMountId = 'body' | 'deployed' | 'tracking';

// ageing: SMAD 3rd ed. Table 11-34 (Si 3.75%/yr); multi-junction ≈ 0.5%/yr (estimate).
// NASA Small Spacecraft Technology State of the Art (power chapter): deployed panels give 40–75 W per kg and
// body-mounted cells about 2.3–2.4 W on each 10 cm CubeSat face. With these areal masses a deployed wing lands
// inside that range (silicon ~50 W/kg, triple-junction ~74 W/kg).
export const CELLS: Record<CellId, Sourced & { name: string; efficiency: number; kgPerM2: number; costPerM2M: number; degradationPerYear: number; explain: string }> = {
  si: {
    name: 'Silicon', efficiency: 0.16, kgPerM2: 2.2, costPerM2M: 0.12, degradationPerYear: 0.0375,
    explain: 'Cheaper cells, but they turn only ~16% of sunlight into electricity and wear out faster in radiation.',
    source: 'Space-grade Si cells ~14–17%; areal mass and cost are estimates', estimate: true,
  },
  gaas3j: {
    name: 'Triple-junction GaAs', efficiency: 0.3, kgPerM2: 3.0, costPerM2M: 0.35, degradationPerYear: 0.005,
    explain: 'Triple-junction gallium-arsenide cells: about twice as efficient as silicon and they age slowly, but they cost more.',
    source: 'NASA Small Spacecraft SOA, power chapter (multi-junction III-V cells > 30%; panels 40–75 W/kg); cost is an estimate', estimate: true,
  },
};

/** Cells cover 85% of a panel; wiring, temperature and mismatch losses leave 77% of the rest (SMAD inherent degradation). */
export const PANEL_FACTOR = 0.85 * 0.77;

export interface ArrayMount {
  name: string;
  explain: string;
  /** Extra panel mass per m² (hinges, hold-downs) and the drive (kg). */
  extraKgPerM2: number;
  driveKg: (m2: number) => number;
  costM: (m2: number) => number;
  /** Average fraction of full sun the panels see, from the angle β between the orbit plane and the Sun. */
  pointing: (beta: number) => number;
  /** Panels limited to the body's own faces. */
  bodyOnly: boolean;
}

export const ARRAY_MOUNTS: Record<ArrayMountId, ArrayMount> = {
  body: {
    name: 'Body-mounted',
    explain: 'Cells glued on the sides of the box. Nothing to deploy, but small, and each face only sees the Sun part of the time.',
    extraKgPerM2: 0, driveKg: () => 0, costM: () => 0,
    pointing: (beta) => 0.25 + 0.1 * Math.abs(Math.sin(beta)),
    bodyOnly: true,
  },
  deployed: {
    name: 'Deployed fixed wings',
    explain: 'Wings that unfold after launch and stay fixed. Big area; how well they face the Sun depends on the orbit.',
    extraKgPerM2: 0.6, driveKg: () => 0, costM: (m2) => 0.05 + 0.02 * m2,
    pointing: (beta) => 0.55 + 0.4 * Math.abs(Math.sin(beta)),
    bodyOnly: false,
  },
  tracking: {
    name: 'Sun-tracking wings',
    explain: 'Wings on a motor that turns them to face the Sun all orbit long: the most power per m², with an extra motor to fail.',
    extraKgPerM2: 0.6, driveKg: (m2) => 1 + 0.4 * m2, costM: (m2) => 0.5 + 0.03 * m2,
    pointing: (beta) => Math.max(Math.cos(beta), 0.55 + 0.4 * Math.abs(Math.sin(beta))),
    bodyOnly: false,
  },
};

/** Li-ion at pack level: NASA Small Spacecraft SOA gives 110–250 Wh/kg for packs; the game uses 150. $0.5M per kWh is an estimate. */
export const BATTERY_WH_PER_KG = 150;
export const BATTERY_COST_PER_WH_M = 0.5 / 1000;
/** Battery cycles to failure at depth of discharge `dod` (Li-ion, trend of published test data; estimate). */
export const batteryCycleLife = (dod: number) => Math.min(100_000, 50_000 * (0.2 / Math.max(dod, 0.01)) ** 2);
/** Power control and distribution unit, scaled with the array's output. */
export const pcduKg = (arrayW: number) => 0.2 + 0.012 * arrayW;
export const pcduCostM = (arrayW: number) => 0.05 + 0.0012 * arrayW;

// ------------------------------------------------------------------ onboard computer and storage
export type ComputerId = 'none' | 'cots' | 'radTolerant' | 'radHard' | 'edge';

export interface Computer extends Sourced {
  name: string;
  explain: string;
  massKg: number;
  powerW: number;
  costM: number;
  /** Total ionising dose it survives (krad). */
  toleranceKrad: number;
  failPerYear: number;
  devMonths: number;
  /** Fraction of instrument data removed by processing on board. */
  dataReduction: number;
}

export const COMPUTERS: Record<ComputerId, Computer> = {
  none: {
    name: 'No computer yet', explain: '',
    massKg: 0, powerW: 0, costM: 0, toleranceKrad: 0, failPerYear: 0, devMonths: 0, dataReduction: 0,
    source: '—', estimate: false,
  },
  cots: {
    name: 'Commercial computer', explain: 'A phone-class processor: cheap, light and fast, but radiation can upset or kill it. Fine for short missions in low orbit.',
    massKg: 0.5, powerW: 4, costM: 0.1, toleranceKrad: 10, failPerYear: 0.05, devMonths: 4, dataReduction: 0,
    source: 'CubeSat OBCs (NASA Small Spacecraft SOA); tolerance and failure rate are estimates', estimate: true,
  },
  radTolerant: {
    name: 'Radiation-tolerant computer', explain: 'Parts screened and shielded for radiation. The usual choice for small satellites flying several years.',
    massKg: 3, powerW: 10, costM: 1.2, toleranceKrad: 50, failPerYear: 0.015, devMonths: 8, dataReduction: 0,
    source: 'Typical small-satellite OBCs; estimates', estimate: true,
  },
  radHard: {
    name: 'Radiation-hardened computer', explain: 'Built to survive the radiation belts and deep space for 15+ years. Heavy, slow and expensive.',
    massKg: 6, powerW: 18, costM: 4, toleranceKrad: 300, failPerYear: 0.005, devMonths: 12, dataReduction: 0,
    source: 'RAD750-class flight computers (≥ 100 krad); mass and cost are estimates', estimate: true,
  },
  edge: {
    name: 'AI edge processor', explain: 'Processes images on board (drops cloudy scenes, sends results instead of raw pixels), cutting the data to send by ~40%. Uses more power, less radiation-tolerant.',
    massKg: 2, powerW: 25, costM: 1.5, toleranceKrad: 20, failPerYear: 0.03, devMonths: 8, dataReduction: 0.4,
    source: 'Onboard cloud screening (e.g. Φ-sat-1); data reduction and values are estimates', estimate: true,
  },
};

export const STORAGE_STEPS_GBIT = [8, 32, 128, 512, 2_048, 8_192] as const;
// zero storage is "not fitted yet": it weighs and costs nothing
export const storageKg = (gbit: number) => (gbit > 0 ? 0.1 + 0.0004 * gbit : 0);
export const storageW = (gbit: number) => (gbit > 0 ? 1 + 0.0015 * gbit : 0);
export const storageCostM = (gbit: number) => (gbit > 0 ? 0.03 + 0.000_25 * gbit : 0);

// ------------------------------------------------------------------ attitude control
export type AdcsId = 'none' | 'magnetorquer' | 'wheels' | 'agile';

export interface Adcs extends Sourced {
  name: string;
  explain: string;
  /** How precisely it points (deg). */
  accuracyDeg: number;
  /** How far off straight-down it can aim the instruments (deg). */
  offNadirDeg: number;
  needsMagneticField: boolean;
  massKg: (dryKg: number) => number;
  powerW: (dryKg: number) => number;
  costM: (dryKg: number) => number;
  failPerYear: number;
  devMonths: number;
}

export const ADCS: Record<AdcsId, Adcs> = {
  none: {
    name: 'No attitude control yet', explain: '',
    accuracyDeg: 180, offNadirDeg: 0, needsMagneticField: false,
    massKg: () => 0, powerW: () => 0, costM: () => 0, failPerYear: 0, devMonths: 0,
    source: '—', estimate: false,
  },
  magnetorquer: {
    name: 'Magnetorquers + sun sensors', explain: 'Electromagnets push against Earth\'s magnetic field. Cheap and simple, but only points to ~5°, and does not work far from Earth.',
    accuracyDeg: 5, offNadirDeg: 0, needsMagneticField: true,
    massKg: (m) => 0.3 + 0.004 * m, powerW: (m) => 1 + 0.004 * m, costM: (m) => 0.05 + 0.0008 * m, failPerYear: 0.01, devMonths: 4,
    source: 'Typical CubeSat ADCS (NASA Small Spacecraft SOA); scaling is an estimate', estimate: true,
  },
  wheels: {
    name: 'Reaction wheels + star tracker', explain: 'Spinning wheels turn the spacecraft; a star camera tells it where it points. Precise to ~0.05°: needed for sharp images and dishes.',
    accuracyDeg: 0.05, offNadirDeg: 10, needsMagneticField: false,
    massKg: (m) => 1 + 0.025 * m, powerW: (m) => 5 + 0.03 * m, costM: (m) => 0.5 + 0.004 * m, failPerYear: 0.03, devMonths: 8,
    source: 'Typical small-satellite wheel + star-tracker suites; reaction wheels are a common failure (estimate)', estimate: true,
  },
  agile: {
    name: 'Control moment gyros (agile)', explain: 'Powerful gyros swing the spacecraft quickly to look up to 30° to the side: revisit a target far more often. Heavy and costly.',
    accuracyDeg: 0.02, offNadirDeg: 30, needsMagneticField: false,
    massKg: (m) => 8 + 0.05 * m, powerW: (m) => 20 + 0.05 * m, costM: (m) => 4 + 0.012 * m, failPerYear: 0.03, devMonths: 12,
    source: 'Agile imagers (Pléiades-class CMGs); scaling is an estimate', estimate: true,
  },
};

// ------------------------------------------------------------------ propulsion
export type PropulsionId = 'none' | 'coldGas' | 'mono' | 'biprop' | 'electric';

export interface Propulsion extends Sourced {
  name: string;
  explain: string;
  /** Specific impulse (s): how far each kilogram of propellant pushes. */
  isp: number;
  /** Thrusters, valves and lines (kg), and tank mass per kg of propellant. */
  dryKg: number;
  tankFraction: number;
  costM: number;
  /** Thrust (N); for electric, thrust per watt of power fed to it. */
  thrustN: number;
  thrustPerW?: number;
  /** Most power the electric thrusters can use (W). */
  maxPowerW?: number;
  /** Heaters and valves, always on (W). */
  powerW: number;
  failPerYear: number;
  devMonths: number;
}

export const PROPULSION: Record<PropulsionId, Propulsion> = {
  none: {
    name: 'No propulsion', explain: 'No engine at all. Light and simple, but the orbit can never be corrected, raised or lowered.',
    isp: 0, dryKg: 0, tankFraction: 0, costM: 0, thrustN: 0, powerW: 0, failPerYear: 0, devMonths: 0,
    source: '—', estimate: false,
  },
  coldGas: {
    name: 'Cold gas (nitrogen)', explain: 'Squirts compressed gas. Safe and CubeSat-friendly, but very weak: only small corrections.',
    isp: 65, dryKg: 0.8, tankFraction: 0.25, costM: 0.2, thrustN: 0.1, powerW: 1, failPerYear: 0.01, devMonths: 4,
    source: 'Cold-gas Isp 60–70 s (NASA Small Spacecraft SOA); masses are estimates', estimate: true,
  },
  mono: {
    name: 'Monopropellant (hydrazine)', explain: 'One propellant decomposed over a catalyst. The standard for keeping an orbit and de-orbiting at the end.',
    isp: 225, dryKg: 4, tankFraction: 0.12, costM: 1.5, thrustN: 22, powerW: 12, failPerYear: 0.005, devMonths: 8,
    source: 'Hydrazine thrusters Isp ~220–230 s (SMAD); masses are estimates', estimate: true,
  },
  biprop: {
    name: 'Bipropellant (MMH/MON)', explain: 'Fuel and oxidiser burn in an engine: strong and efficient. Needed for big burns: reaching GEO, entering lunar or Mars orbit.',
    isp: 318, dryKg: 30, tankFraction: 0.08, costM: 6, thrustN: 450, powerW: 40, failPerYear: 0.005, devMonths: 12,
    source: '400 N apogee engines Isp ~318–321 s (Ariane Group S400); masses are estimates', estimate: true,
  },
  electric: {
    name: 'Electric (Hall thruster)', explain: 'Accelerates xenon with electricity: uses 7× less propellant, but pushes gently, so big manoeuvres take months and lots of power.',
    isp: 1_600, dryKg: 20, tankFraction: 0.12, costM: 6, thrustN: 0.08, thrustPerW: 6e-5, maxPowerW: 4_500, powerW: 10, failPerYear: 0.01, devMonths: 12,
    source: 'SPT-100 class: 83 mN at 1.35 kW, Isp ~1 600 s; masses are estimates', estimate: true,
  },
};

// ------------------------------------------------------------------ communications
export type BandId = 'UHF' | 'S' | 'X' | 'Ka';

export interface Band {
  name: string;
  explain: string;
  freqHz: number;
  /** Fastest the radios and ground modems handle (Mbps). */
  capMbps: number;
  /** Clear-sky atmospheric loss (dB). */
  atmLossDb: number;
  /** Transmitter DC → RF efficiency. */
  ampEfficiency: number;
}

// Data rates: NASA Small Spacecraft State of the Art, communications chapter: UHF 0.1–38.4 kbps (9.6 typical),
// S-band 64 kbps–4 Mbps (up to 20), X-band up to 1.5 Gbps, Ka-band 25 Mbps–1 Gbps on small spacecraft, with
// significant rain fade at Ka. The caps below sit inside those ranges; bigger spacecraft reach more at Ka.
export const BANDS: Record<BandId, Band> = {
  UHF: { name: 'UHF (437 MHz)', explain: 'Amateur-style radio: simple antennas, but a trickle of data (kilobits per second).', freqHz: 437e6, capMbps: 0.0192, atmLossDb: 0.5, ampEfficiency: 0.3 },
  S: { name: 'S-band (2.2 GHz)', explain: 'The classic command-and-telemetry band: robust, a few megabits per second.', freqHz: 2.25e9, capMbps: 8, atmLossDb: 0.3, ampEfficiency: 0.35 },
  X: { name: 'X-band (8.4 GHz)', explain: 'The data band of Earth observation and deep space: hundreds of megabits per second from low orbit.', freqHz: 8.4e9, capMbps: 800, atmLossDb: 0.4, ampEfficiency: 0.35 },
  Ka: { name: 'Ka-band (27 GHz)', explain: 'Very high rates and small antennas, but rain absorbs it: tropical storms can cut the link.', freqHz: 27e9, capMbps: 3_000, atmLossDb: 1.5, ampEfficiency: 0.25 },
};

export type AntennaId = 'none' | 'patch' | 'helix' | 'dish';

export const ANTENNAS: Record<AntennaId, { name: string; explain: string; gainDbi?: number; massKg: (d: number) => number; costM: (d: number) => number }> = {
  // no radio fitted: a gain so low that no link closes
  none: { name: 'No antenna yet', explain: 'Without an antenna and a radio the spacecraft is mute.', gainDbi: -300, massKg: () => 0, costM: () => 0 },
  patch: { name: 'Patch (low gain)', explain: 'A small flat antenna with a wide beam: no pointing needed, but weak.', gainDbi: 5, massKg: () => 0.1, costM: () => 0.02 },
  helix: { name: 'Shaped beam (medium gain)', explain: 'A helix or isoflux antenna that focuses the beam toward Earth without having to aim it precisely.', gainDbi: 12, massKg: () => 0.6, costM: () => 0.1 },
  dish: { name: 'Dish (high gain)', explain: 'A parabolic dish: the bigger it is, the narrower and stronger the beam, but the spacecraft must point it precisely.', massKg: (d) => 1.5 + 3 * d * d, costM: (d) => 0.3 + 1.5 * d * d },
};

export const DISH_EFFICIENCY = 0.55;
/** Transmitter (amplifier and power supply), by radiated power. CubeSat radios radiate 0.5–5 W (27–37 dBm, NASA SOA). */
export const CUBESAT_MAX_TX_W = 5;
export const transmitterKg = (rfW: number) => 0.3 + 0.05 * rfW;
export const transmitterCostM = (rfW: number) => 0.1 + 0.015 * rfW;

// ------------------------------------------------------------------ ground stations
export type StationId = 'luanda' | 'hartebeesthoek' | 'svalbard' | 'maspalomas' | 'dsn' | 'deepCommercial';

export interface Station extends Sourced {
  name: string;
  short: string;
  explain: string;
  lat: number;
  lon: number;
  /** Figure of merit G/T (dB/K) per band it supports. */
  gt: Partial<Record<BandId, number>>;
  minElDeg: number;
  /** Earth-orbit stations: yearly service cost. Deep-space antennas: cost per tracking hour. */
  costPerYearM?: number;
  costPerHourM?: number;
  deepSpace: boolean;
}

export const STATIONS: Record<StationId, Station> = {
  luanda: {
    name: 'Luanda (GGPEN mission control)', short: 'Luanda', lat: -8.92, lon: 13.42, minElDeg: 5, deepSpace: false,
    explain: 'Angola\'s own station. Cheap to use and right under your target, so data can come down minutes after it is taken.',
    gt: { UHF: -15, S: 21, X: 32 }, costPerYearM: 0.2,
    source: 'Location approximate (Funda, Luanda) and the 9 m antenna assumed: to be replaced with GGPEN data', estimate: true,
  },
  hartebeesthoek: {
    name: 'Hartebeesthoek, South Africa', short: 'Hartebeesthoek', lat: -25.89, lon: 27.69, minElDeg: 5, deepSpace: false,
    explain: 'SANSA\'s station near Pretoria: a regional neighbour that also sees southern Africa passes.',
    gt: { S: 22, X: 33 }, costPerYearM: 0.6,
    source: 'SANSA Hartebeesthoek; G/T and service price are estimates', estimate: true,
  },
  svalbard: {
    name: 'Svalbard, Norway (78° N)', short: 'Svalbard', lat: 78.23, lon: 15.39, minElDeg: 5, deepSpace: false,
    explain: 'Near the North Pole, so a polar-orbiting satellite passes overhead on almost every orbit. Expensive.',
    gt: { S: 23, X: 34, Ka: 38 }, costPerYearM: 1.2,
    source: 'KSAT SvalSat; G/T and service price are estimates', estimate: true,
  },
  maspalomas: {
    name: 'Maspalomas, Canary Islands', short: 'Maspalomas', lat: 27.76, lon: -15.63, minElDeg: 5, deepSpace: false,
    explain: 'An ESA network station off West Africa.',
    gt: { S: 22, X: 33 }, costPerYearM: 0.6,
    source: 'INTA/ESA Maspalomas; G/T and service price are estimates', estimate: true,
  },
  dsn: {
    name: 'NASA Deep Space Network (34 m)', short: 'DSN', lat: 0, lon: 0, minElDeg: 10, deepSpace: true,
    explain: 'Giant 34 m dishes in California, Spain and Australia: one always faces your spacecraft. The best receivers on Earth, billed by the hour.',
    gt: { S: 41.8, X: 54.3, Ka: 64 }, costPerHourM: 0.003,
    source: 'DSN 810-005 class G/T for 34 m BWG; hourly price is an estimate', estimate: true,
  },
  deepCommercial: {
    name: 'Commercial deep-space antennas (18 m)', short: 'Commercial 18 m', lat: 0, lon: 0, minElDeg: 10, deepSpace: true,
    explain: 'Smaller commercial dishes around the world: a third of the price of the DSN, about 9 dB less sensitive.',
    gt: { S: 33, X: 45, Ka: 52 }, costPerHourM: 0.0012,
    source: 'Commercial lunar/deep-space networks (KSAT, SSC, Goonhilly class); estimates', estimate: true,
  },
};

// ------------------------------------------------------------------ launchers
export type LaunchTarget = 'leo' | 'sso' | 'gto' | 'tli' | 'mars';
export type LauncherId = 'none' | 'rideshare' | 'electron' | 'pslv' | 'vegac' | 'falcon9' | 'falcon9x' | 'ariane62' | 'ariane64' | 'falconHeavy' | 'sls';

export interface Launcher extends Sourced {
  name: string;
  provider: string;
  explain: string;
  costM: number;
  reliability: number;
  /** Payload (kg) to each destination: LEO and SSO at 500 km, GTO, trans-lunar injection, Mars departure. */
  capacityKg: Partial<Record<LaunchTarget, number>>;
  /** Capacity lost per 100 km of altitude above 500 km (LEO/SSO). */
  altLossPer100Km: number;
  /** Inclination of the GTO it delivers (deg): sets the climb to GEO. */
  gtoIncDeg?: number;
  /** Usable fairing diameter (m). */
  fairingM: number;
  /** A shared ride: price per kg, a minimum, and the only orbit it goes to. */
  rideshare?: { pricePerKgM: number; minPriceM: number; maxKg: number; altKm: [number, number]; ltanH: [number, number] };
  /** Certified to carry people. */
  crewRated?: boolean;
}

export const LAUNCHERS: Record<LauncherId, Launcher> = {
  none: {
    name: 'No launcher yet', provider: '—', explain: '',
    costM: 0, reliability: 0, capacityKg: {}, altLossPer100Km: 0, fairingM: 99,
    source: '—', estimate: false,
  },
  rideshare: {
    name: 'Rideshare (shared SSO launch)', provider: 'SpaceX Transporter class',
    explain: 'Buy a seat on a rocket carrying dozens of small satellites. Very cheap, but it goes where it goes: about 525 km, late-morning sun-synchronous.',
    costM: 0, reliability: 0.99, capacityKg: { sso: 830 }, altLossPer100Km: 0, fairingM: 1,
    rideshare: { pricePerKgM: 0.0065, minPriceM: 0.33, maxKg: 830, altKm: [500, 600], ltanH: [9.5, 11.5] },
    source: 'SpaceX rideshare price list (~$6.5k/kg, 2024–25); orbit range typical of Transporter missions. NASA CubeSat 101: NASA\'s CubeSat Launch Initiative pays up to $300 000 per launch, usually a 3U to low orbit; the team pays for everything else', estimate: true,
  },
  electron: {
    name: 'Electron', provider: 'Rocket Lab',
    explain: 'A small dedicated rocket: your satellite alone, to the exact orbit you want, but only ~200 kg.',
    costM: 8.5, reliability: 0.92, capacityKg: { leo: 300, sso: 200, tli: 30 }, altLossPer100Km: 0.08, fairingM: 1.1,
    source: 'Rocket Lab (≤ 300 kg LEO; CAPSTONE ~25 kg to the Moon); price and SSO value are estimates', estimate: true,
  },
  pslv: {
    name: 'PSLV-XL', provider: 'ISRO / NSIL',
    explain: 'India\'s reliable medium rocket, a favourite for Earth-observation satellites.',
    costM: 31, reliability: 0.94, capacityKg: { leo: 3_800, sso: 1_750, gto: 1_425 }, altLossPer100Km: 0.05, gtoIncDeg: 19, fairingM: 3.2,
    source: 'ISRO (1 750 kg to 600 km SSO, 1 425 kg sub-GTO); price is an estimate', estimate: true,
  },
  vegac: {
    name: 'Vega-C', provider: 'Avio / Arianespace',
    explain: 'A European small-to-medium launcher from French Guiana, sized for Earth-observation missions.',
    costM: 50, reliability: 0.85, capacityKg: { leo: 3_300, sso: 2_300 }, altLossPer100Km: 0.05, fairingM: 3.3,
    source: 'Arianespace (~2 300 kg to 700 km polar); price and reliability are estimates', estimate: true,
  },
  falcon9: {
    name: 'Falcon 9 (reusable)', provider: 'SpaceX',
    explain: 'The most-flown rocket today: cheap per kilogram, very reliable. Landing the booster costs some performance.',
    costM: 70, reliability: 0.99, capacityKg: { leo: 17_400, sso: 12_000, gto: 5_500, tli: 3_500 }, altLossPer100Km: 0.03, gtoIncDeg: 27, fairingM: 4.6,
    source: 'SpaceX (5.5 t GTO reusable, $70M list); LEO/SSO/TLI values are estimates', estimate: true,
  },
  falcon9x: {
    name: 'Falcon 9 (expendable)', provider: 'SpaceX',
    explain: 'The same rocket thrown away after one flight: more lift for heavy GEO or Mars spacecraft, at a higher price.',
    costM: 95, reliability: 0.99, capacityKg: { leo: 22_800, sso: 15_000, gto: 8_300, tli: 5_500, mars: 4_020 }, altLossPer100Km: 0.03, gtoIncDeg: 27, fairingM: 4.6,
    source: 'SpaceX (22.8 t LEO, 8.3 t GTO, 4.02 t Mars); price, SSO and TLI are estimates', estimate: true,
  },
  ariane62: {
    name: 'Ariane 62', provider: 'Arianespace',
    explain: 'Europe\'s new medium launcher with two boosters, from French Guiana near the equator (a cheaper climb to GEO).',
    costM: 85, reliability: 0.95, capacityKg: { leo: 10_350, sso: 7_000, gto: 4_500, tli: 3_500 }, altLossPer100Km: 0.03, gtoIncDeg: 6, fairingM: 4.6,
    source: 'Arianespace (10.35 t LEO, 4.5 t GTO); price, SSO and TLI are estimates', estimate: true,
  },
  ariane64: {
    name: 'Ariane 64', provider: 'Arianespace',
    explain: 'Four boosters: heavy GEO satellites, lunar and Mars missions.',
    costM: 125, reliability: 0.95, capacityKg: { leo: 21_650, sso: 14_000, gto: 11_500, tli: 8_600, mars: 7_000 }, altLossPer100Km: 0.03, gtoIncDeg: 6, fairingM: 4.6,
    source: 'Arianespace (21.65 t LEO, 11.5 t GTO); price, TLI and Mars are estimates', estimate: true,
  },
  falconHeavy: {
    name: 'Falcon Heavy (expendable)', provider: 'SpaceX',
    explain: 'Three Falcon 9 cores together: the heaviest commercial lift, for big interplanetary or GEO missions.',
    costM: 150, reliability: 0.98, capacityKg: { leo: 63_800, gto: 26_700, tli: 16_000, mars: 16_800 }, altLossPer100Km: 0.02, gtoIncDeg: 27, fairingM: 4.6,
    source: 'SpaceX (63.8 t LEO, 26.7 t GTO, 16.8 t Mars); price and TLI are estimates', estimate: true,
  },
  sls: {
    name: 'Space Launch System (Block 1)', provider: 'NASA', crewRated: true,
    explain: 'NASA\'s Moon rocket, the one that flew Artemis II: the only launcher certified to send a crew to the Moon. It throws 27 t toward the Moon, at a price to match.',
    costM: 2_200, reliability: 0.98, capacityKg: { tli: 27_000 }, altLossPer100Km: 0, fairingM: 8.4,
    source: 'NASA: more than 27 t to the Moon (Block 1). Price: NASA OIG puts one Artemis launch at $4.1B, about $2.2B of it the rocket; reliability is an estimate', estimate: true,
  },
};

// ------------------------------------------------------------------ orbit types
export type OrbitTypeId = 'sso' | 'leo' | 'geo' | 'llo' | 'elfo' | 'halo' | 'marsLow' | 'marsHigh' | 'freeReturn' | 'crewDro' | 'crewNrho' | 'crewLlo';

export interface OrbitType {
  name: string;
  short: string;
  body: BodyId;
  target: LaunchTarget;
  explain: string;
  goodFor: string;
  badFor: string;
  /** Adjustable parameters and their ranges. */
  altKm?: [number, number];
  incDeg?: [number, number];
  ltanH?: number[];
  lonDeg?: [number, number];
}

export const ORBIT_TYPES: Record<OrbitTypeId, OrbitType> = {
  sso: {
    name: 'Sun-synchronous orbit', short: 'SSO', body: 'earth', target: 'sso', altKm: [400, 900], ltanH: [6, 9, 10.5, 12, 13.5, 18],
    explain: 'A near-polar orbit tilted just enough that Earth\'s bulge turns it once a year: the satellite crosses each place at the same local time every day.',
    goodFor: 'Imaging the whole planet under the same lighting; polar ground stations see every orbit.',
    badFor: 'Low latitudes like Angola get a pass only every few days with a narrow camera.',
  },
  leo: {
    name: 'Low inclined orbit', short: 'LEO', body: 'earth', target: 'leo', altKm: [350, 900], incDeg: [0, 60],
    explain: 'A low orbit tilted to match your target\'s latitude: it flies over the same band of the Earth again and again.',
    goodFor: 'Frequent revisits of tropical countries such as Angola (tilt ~20°).',
    badFor: 'Never sees the poles, and the lighting changes from pass to pass.',
  },
  geo: {
    name: 'Geostationary orbit', short: 'GEO', body: 'earth', target: 'gto', lonDeg: [-30, 60],
    explain: 'At 35 786 km the satellite circles once a day, so it hangs still over one longitude of the equator.',
    goodFor: 'TV and communications: fixed dishes on the ground, a third of the Earth in view all the time.',
    badFor: 'Far away (weak signals, 0.25 s round trip); the climb from the launcher\'s transfer orbit costs ~1.5 km/s.',
  },
  llo: {
    name: 'Low lunar orbit (100 km, polar)', short: 'LLO', body: 'moon', target: 'tli',
    explain: 'Skimming 100 km above the surface every 2 hours, passing over the poles.',
    goodFor: 'Sharp images and short, strong links to landers.',
    badFor: 'Behind the Moon from Earth 40% of the time; expensive to enter; a site sees it only for minutes at a time.',
  },
  elfo: {
    name: 'Elliptical lunar frozen orbit (12 h)', short: 'ELFO', body: 'moon', target: 'tli',
    explain: 'A stretched orbit that hangs slowly over the south pole for hours each 12-hour lap, and stays stable for years.',
    goodFor: 'Long coverage of the south pole and far side at moderate distance.',
    badFor: 'Part of every lap is spent racing low over the north.',
  },
  halo: {
    name: 'Earth–Moon L2 halo orbit', short: 'L2 halo', body: 'moon', target: 'tli',
    explain: 'A loop around the balance point 64 500 km beyond the far side, where the relay sees both the far side and the Earth.',
    goodFor: 'Continuous view of the far side and of Earth at the same time (China\'s Queqiao relay flies here).',
    badFor: '65 000–80 000 km from the landers: their small antennas need a big dish on the relay.',
  },
  marsLow: {
    name: 'Low Mars mapping orbit (polar)', short: 'Low Mars', body: 'mars', target: 'mars', altKm: [250, 500],
    explain: 'A low, near-polar, sun-synchronous orbit: the whole planet passes underneath, always at the same afternoon local time.',
    goodFor: 'The sharpest images and global maps (Mars Reconnaissance Orbiter flies at ~300 km).',
    badFor: 'Getting there needs either a big braking burn (~2 km/s) or months of aerobraking.',
  },
  marsHigh: {
    name: 'High elliptical Mars orbit', short: 'High Mars', body: 'mars', target: 'mars', altKm: [250, 500],
    explain: 'A long ellipse, ~300 km at the low point and 33 000 km at the high point, one lap per Mars day.',
    goodFor: 'Cheap to enter (~0.9 km/s); whole-disc views of the weather.',
    badFor: 'Only close to the planet for minutes per lap: little high-resolution mapping.',
  },
  // crewed trips around the Moon: the launcher's upper stage does the push out of Earth orbit
  freeReturn: {
    name: 'Lunar flyby (free return)', short: 'Flyby', body: 'moon', target: 'tli',
    explain: 'A figure of eight around the far side and straight home in about ten days. The Moon\'s gravity bends the path back to Earth, so even with a dead engine the crew comes home. Artemis II flew this.',
    goodFor: 'Safety: the engine only has to make small corrections.',
    badFor: 'A single day near the Moon, most of it thousands of kilometres up.',
  },
  crewDro: {
    name: 'High lunar orbit (6 days at the Moon)', short: 'High orbit', body: 'moon', target: 'tli',
    explain: 'A wide, stable orbit tens of thousands of kilometres above the Moon, the one Artemis I tested. Getting in and out takes two engine burns each way.',
    goodFor: 'Days of lunar science for less than half the propellant of a low orbit.',
    badFor: 'The engine must work to come home, and the trip lasts three weeks.',
  },
  crewNrho: {
    name: 'Gateway orbit (12 days at the Moon)', short: 'Gateway orbit', body: 'moon', target: 'tli',
    explain: 'A week-long loop over the lunar poles (a near-rectilinear halo orbit) that always sees Earth: where the Gateway station is meant to fly.',
    goodFor: 'Long stays with an unbroken link to Earth.',
    badFor: 'A month away from home: a lot of air, water and food, and a lot of radiation.',
  },
  crewLlo: {
    name: 'Low lunar orbit (3 days at 100 km)', short: 'Low orbit', body: 'moon', target: 'tli',
    explain: 'Skimming 100 km above the surface, as Apollo did. Braking into it and climbing back out costs nearly 2 km/s.',
    goodFor: 'The closest look at the Moon a crew can get without landing.',
    badFor: 'Propellant: the tanks may weigh more than the launcher can lift.',
  },
};
