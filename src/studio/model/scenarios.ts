/**
 * The studio's missions, as data (docs/03 §4). Each scenario names its customer and brief, the objectives
 * the team can choose, each objective's requirements (a threshold the customer must have and a goal they would
 * love), the parts and orbits on offer, the budget, the deadline, and a reference design known to work.
 * The GGPEN data sets (13 November) slot in here: regions, stations, catalogs and reference missions.
 */
import type { LauncherId, OrbitTypeId, PlatformId, StationId } from './catalog';
import type { StudioDesign } from './design';
import type { InstrumentId } from './instruments';
import type { RegionId } from './regions';
import type { TestId } from './tests';
import type { BodyId, ResourceId, ScenarioId } from './types';

export type MetricId =
  | 'gsd' | 'revisit' | 'mapped' | 'latency' | 'lifetime' | 'capacity' | 'availability' | 'service'
  | 'relayCoverage' | 'relayRate' | 'quiet' | 'marsMapped' | 'dataReturn' | 'launchMonth' | 'altitude'
  | 'crewDose' | 'supplies' | 'moonDays' | 'downlink' | 'crewSize';

export interface Requirement {
  id: string;
  label: string;
  metric: MetricId;
  region?: RegionId;
  /** Lunar site id (LUNAR_SITES). */
  site?: string;
  /** Time window for 'mapped' (days). */
  days?: number;
  threshold: number;
  goal: number;
  unit: string;
  better: 'lower' | 'higher';
  explain: string;
}

export interface Objective {
  id: string;
  name: string;
  explain: string;
  /** How useful each instrument is for this objective (0–1). */
  value: Partial<Record<InstrumentId, number>>;
  requirements: Requirement[];
}

export interface Scenario {
  id: ScenarioId;
  name: string;
  tagline: string;
  customer: string;
  brief: string;
  body: BodyId;
  /** Requirements of the whole mission, whatever the objectives. */
  requirements: Requirement[];
  objectives: Objective[];
  maxSecondary: number;
  orbitTypes: OrbitTypeId[];
  launchers: LauncherId[];
  platforms: PlatformId[];
  instruments: InstrumentId[];
  stations: StationId[];
  budgetM: number;
  /** Launch no later than this many months after the project starts. */
  deadlineMonths: number;
  /** Operations team and facilities per year ($M). */
  opsPerYearM: number;
  /** Crewed flights: mission control, training and the recovery fleet, per flight ($M). */
  opsPerMissionM?: number;
  /** People on board: the capsule's call sign. */
  crew?: { callSign: string };
  /** Months from the project start when the launch windows open (Mars). */
  windows?: number[];
  startLabel: string;
  /** The two or three resources that decide this mission. */
  critical: ResourceId[];
  /** Fraction of passes with a clear sky over the target (optical imaging). */
  clearSky?: number;
  /** Lander radios on the lunar surface the relay must hear. */
  landers?: { S: { txW: number; gainDbi: number }; X: { txW: number; gainDbi: number } };
  /** Cadet-only tutorial. */
  tutorial?: boolean;
  lessons: string[];
  example: StudioDesign;
  starter: StudioDesign;
}

const life = (id: string, threshold: number, goal: number, why: string): Requirement => ({
  id, label: 'Working lifetime', metric: 'lifetime', threshold, goal, unit: 'years', better: 'higher', explain: why,
});

// ------------------------------------------------------------------ shared design defaults
const base = {
  version: 1 as const,
  secondary: [] as string[],
  levels: {} as Record<string, 'threshold' | 'goal'>,
  cells: 'gaas3j' as const,
  redundant: false,
  propellantMarginPct: 10,
  trackHoursPerDay: 8,
  insurance: false,
  tests: [] as TestId[],
};
/** Every mission starts with an empty assembly stand: no structure, no power, no radio, no rocket. */
const empty = {
  ...base,
  launcher: 'none' as const, platform: 'none' as const, mount: 'deployed' as const, arrayM2: 0, batteryWh: 0,
  computer: 'none' as const, adcs: 'none' as const, propulsion: 'none' as const, instruments: [] as InstrumentId[],
  band: 'S' as const, antenna: 'none' as const, dishM: 0.5, txW: 2, storageGbit: 0, stations: [] as StationId[],
  reservePct: 20,
};
/** The reference designs run the usual campaign. */
const tested: TestId[] = ['vibration', 'tvac', 'deploy', 'compat', 'rehearsal'];
const orbitDefaults = { altKm: 600, incDeg: 20, ltanH: 10.5, lonDeg: 23, transfer: 'direct' as const, capture: 'aerobrake' as const };

// ------------------------------------------------------------------ tutorial
const TUTORIAL: Scenario = {
  id: 'tutorial',
  name: 'First Light',
  tagline: 'Your first satellite: a 12U CubeSat that photographs Angola.',
  customer: 'A university space club in Luanda',
  brief: 'Build a shoebox-sized satellite, ride to orbit with other satellites, and send home colour pictures of Angola. Each step introduces one idea: orbits, power, data, money.',
  body: 'earth',
  tutorial: true,
  requirements: [life('tut.life', 1, 2, 'The club wants pictures for at least a year of classes.')],
  objectives: [
    {
      id: 'firstLight',
      name: 'Photograph Angola',
      explain: 'Take colour pictures of Angola and bring them home.',
      value: { cubecam: 1 },
      requirements: [
        { id: 'tut.gsd', label: 'Picture sharpness (pixel size)', metric: 'gsd', threshold: 30, goal: 15, unit: 'm', better: 'lower', explain: 'Fields and rivers show up with 30 m pixels; 15 m shows villages.' },
        { id: 'tut.map', label: 'Share of Angola photographed in 60 days', metric: 'mapped', region: 'angola', days: 60, threshold: 30, goal: 60, unit: '%', better: 'higher', explain: 'Clouds hide the ground on many passes, so this counts clear pictures only.' },
      ],
    },
  ],
  maxSecondary: 0,
  orbitTypes: ['sso'],
  launchers: ['rideshare'],
  platforms: ['cube6u', 'cube12u'],
  instruments: ['cubecam'],
  stations: ['luanda'],
  budgetM: 4,
  deadlineMonths: 18,
  opsPerYearM: 0.1,
  startLabel: 'January 2027',
  critical: ['power', 'data', 'budget'],
  clearSky: 0.55,
  lessons: [
    'A camera is useless without a way to send its pictures home: data rate decides what you get.',
    'Solar panels only work in sunlight; the battery carries the satellite through every eclipse.',
    'Riding along with other satellites is cheap, but you go where the rocket goes.',
  ],
  example: {
    ...base, scenario: 'tutorial', name: 'First Light (example)', primary: 'firstLight',
    orbit: { ...orbitDefaults, type: 'sso', altKm: 575, ltanH: 10.5 }, launcher: 'rideshare', plannedYears: 2,
    platform: 'cube12u', mount: 'deployed', arrayM2: 0.3, batteryWh: 60, computer: 'cots', adcs: 'wheels', propulsion: 'none',
    instruments: ['cubecam'], band: 'S', antenna: 'patch', dishM: 0.3, txW: 2, storageGbit: 32, stations: ['luanda'],
    reservePct: 15, tests: tested,
  },
  starter: {
    ...empty, scenario: 'tutorial', name: 'My first satellite', primary: 'firstLight',
    orbit: { ...orbitDefaults, type: 'sso', altKm: 525, ltanH: 10.5 }, plannedYears: 2,
  },
};

// ------------------------------------------------------------------ Angola Earth observation
const ANGOLA_EO: Scenario = {
  id: 'angola-eo',
  name: 'Angola from Above',
  tagline: 'An Earth-observation satellite for Angola\'s farms, rivers, coast and cities.',
  customer: 'Angola\'s national space office (inspired by GGPEN)',
  brief: 'Angola wants its own eyes in orbit: to watch crops and drought, respond to floods, guard the coast and its oil fields, map forests and plan cities. You cannot do everything with one satellite: choose what matters most, and design for it.',
  body: 'earth',
  requirements: [life('eo.life', 3, 5, 'A national programme needs years of consistent images to see change.')],
  objectives: [
    {
      id: 'agri', name: 'Crops and drought',
      explain: 'Watch crop health and drought across the country every growing season.',
      value: { ms10: 1, msWide: 0.9, hsi: 0.9, tir: 0.6, hr3: 0.5, cubecam: 0.5 },
      requirements: [
        { id: 'agri.gsd', label: 'Pixel size', metric: 'gsd', threshold: 30, goal: 10, unit: 'm', better: 'lower', explain: 'A 30 m pixel resolves a large field; 10 m resolves small family farms.' },
        { id: 'agri.revisit', label: 'Clear look at any farm every', metric: 'revisit', region: 'angola', threshold: 10, goal: 5, unit: 'days', better: 'lower', explain: 'Crops change week to week; clouds hide many passes, so the clear-sky revisit counts.' },
      ],
    },
    {
      id: 'flood', name: 'Floods and disasters',
      explain: 'See floods and damage quickly, whatever the weather, and get the images to rescuers fast.',
      value: { sar: 1, msWide: 0.5, ms10: 0.4, tir: 0.3 },
      requirements: [
        { id: 'flood.revisit', label: 'Look at any place every', metric: 'revisit', region: 'angola', threshold: 4, goal: 2, unit: 'days', better: 'lower', explain: 'A flood moves in days. Storms bring clouds, so radar (which sees through them) counts in full.' },
        { id: 'flood.latency', label: 'Images on the ground within', metric: 'latency', region: 'angola', threshold: 24, goal: 6, unit: 'hours', better: 'lower', explain: 'Rescue teams need the picture today, not next week.' },
        { id: 'flood.gsd', label: 'Pixel size', metric: 'gsd', threshold: 20, goal: 5, unit: 'm', better: 'lower', explain: 'To see flooded roads and houses, not just rivers.' },
      ],
    },
    {
      id: 'coast', name: 'Coast and oil spills',
      explain: 'Watch the 1 600 km Atlantic coast and the offshore oil fields: spills, illegal fishing, ships.',
      value: { sar: 1, ais: 0.8, ms10: 0.5, msWide: 0.4, tir: 0.3 },
      requirements: [
        { id: 'coast.revisit', label: 'Look at the coast every', metric: 'revisit', region: 'coast', threshold: 4, goal: 2, unit: 'days', better: 'lower', explain: 'An oil slick spreads in hours to days; radar sees slicks as dark smooth patches.' },
        { id: 'coast.latency', label: 'Alert on the ground within', metric: 'latency', region: 'coast', threshold: 12, goal: 3, unit: 'hours', better: 'lower', explain: 'A patrol boat can only catch a polluter quickly.' },
      ],
    },
    {
      id: 'land', name: 'Forests and land cover',
      explain: 'Map the whole country\'s land cover and track deforestation.',
      value: { ms10: 1, hr3: 0.8, hsi: 0.7, msWide: 0.6, sar: 0.6 },
      requirements: [
        { id: 'land.gsd', label: 'Pixel size', metric: 'gsd', threshold: 15, goal: 5, unit: 'm', better: 'lower', explain: 'Forest loss starts with small clearings.' },
        { id: 'land.map', label: 'Share of Angola mapped (clear) in 60 days', metric: 'mapped', region: 'angola', days: 60, threshold: 70, goal: 95, unit: '%', better: 'higher', explain: 'A national map needs almost every corner, cloud-free.' },
      ],
    },
    {
      id: 'cities', name: 'Cities and infrastructure',
      explain: 'Follow how Luanda grows: new roads, buildings and informal settlements.',
      value: { vhr1: 1, hr3: 0.8, sar: 0.5 },
      requirements: [
        { id: 'cities.gsd', label: 'Pixel size', metric: 'gsd', threshold: 3, goal: 1, unit: 'm', better: 'lower', explain: 'Houses and streets need metre-class pixels.' },
        { id: 'cities.revisit', label: 'Clear look at Luanda every', metric: 'revisit', region: 'luanda', threshold: 10, goal: 3, unit: 'days', better: 'lower', explain: 'City planners want a fresh picture every week or so.' },
      ],
    },
  ],
  maxSecondary: 2,
  orbitTypes: ['sso', 'leo'],
  launchers: ['rideshare', 'electron', 'pslv', 'vegac', 'falcon9'],
  platforms: ['cube12u', 'micro', 'small', 'medium'],
  instruments: ['cubecam', 'msWide', 'ms10', 'hr3', 'vhr1', 'sar', 'tir', 'hsi', 'ais'],
  stations: ['luanda', 'hartebeesthoek', 'svalbard', 'maspalomas'],
  budgetM: 45,
  deadlineMonths: 30,
  opsPerYearM: 1.2,
  startLabel: 'January 2027',
  critical: ['data', 'budget', 'power'],
  clearSky: 0.55,
  lessons: [
    'Resolution, swath and revisit fight each other: a sharper camera sees a narrower strip, so it comes back less often.',
    'Clouds cover Angola for much of the rainy season: radar sees through them, but costs power and money.',
    'A ground station at home gets the data down while the satellite is still overhead.',
    'A sun-synchronous orbit gives the same light every day; a low tilted orbit passes over Angola far more often.',
  ],
  example: {
    ...base, scenario: 'angola-eo', name: 'Agri-Watch (example)', primary: 'agri', secondary: ['land'],
    orbit: { ...orbitDefaults, type: 'sso', altKm: 600, ltanH: 10.5 }, launcher: 'rideshare', plannedYears: 5,
    platform: 'micro', mount: 'deployed', arrayM2: 0.6, batteryWh: 120, computer: 'radTolerant', adcs: 'wheels', propulsion: 'none',
    instruments: ['msWide', 'ms10'], band: 'X', antenna: 'helix', dishM: 0.5, txW: 5, storageGbit: 128, stations: ['luanda', 'hartebeesthoek'],
    reservePct: 20, tests: tested,
  },
  starter: {
    ...empty, scenario: 'angola-eo', name: 'Angola EO satellite', primary: 'agri',
    orbit: { ...orbitDefaults, type: 'sso', altKm: 600, ltanH: 10.5 }, plannedYears: 5,
  },
};

// ------------------------------------------------------------------ GEO communications
const GEO_COMMS: Scenario = {
  id: 'geo-comms',
  name: 'Connecting Angola',
  tagline: 'A geostationary communications satellite, ANGOSAT-style.',
  customer: 'Angola\'s national space office and its telecom partners',
  brief: 'Bring television, internet and telephone service to every village in Angola, and sell capacity to the neighbours. The satellite must hang over Africa for fifteen years. Angola\'s first satellite was lost soon after launch in 2017; its second has served since 2023. Make the next one count.',
  body: 'earth',
  requirements: [life('geo.life', 12, 15, 'A GEO satellite pays for itself over 15 years of service.')],
  objectives: [
    {
      id: 'tv', name: 'Television and broadband for Angola',
      explain: 'Direct-to-home TV and internet to small dishes everywhere in the country.',
      value: { kuband: 1, cband: 0.5, kaHts: 0.4 },
      requirements: [
        { id: 'tv.capacity', label: 'Capacity', metric: 'capacity', threshold: 1, goal: 2, unit: 'Gbps', better: 'higher', explain: 'Hundreds of TV channels plus internet for schools and clinics.' },
        { id: 'tv.avail', label: 'Service availability', metric: 'availability', threshold: 99.5, goal: 99.9, unit: '%', better: 'higher', explain: 'Tropical downpours fade high-frequency signals; viewers hate a frozen picture.' },
        { id: 'tv.service', label: 'Share of Angola served', metric: 'service', region: 'angola', threshold: 95, goal: 100, unit: '%', better: 'higher', explain: 'Every province, including the far east.' },
      ],
    },
    {
      id: 'rural', name: 'Connect southern Africa',
      explain: 'Sell internet and phone capacity across the SADC region.',
      value: { kaHts: 1, kuband: 0.7, cband: 0.6 },
      requirements: [
        { id: 'rural.capacity', label: 'Capacity', metric: 'capacity', threshold: 3, goal: 10, unit: 'Gbps', better: 'higher', explain: 'Millions of people in sixteen countries.' },
        { id: 'rural.service', label: 'Share of SADC served', metric: 'service', region: 'sadc', threshold: 60, goal: 90, unit: '%', better: 'higher', explain: 'More coverage, more customers.' },
      ],
    },
    {
      id: 'gov', name: 'Government and emergencies',
      explain: 'Links for hospitals, the army and disaster teams that must work in any storm.',
      value: { cband: 1, kuband: 0.6, kaHts: 0.3 },
      requirements: [
        { id: 'gov.avail', label: 'Service availability', metric: 'availability', threshold: 99.7, goal: 99.95, unit: '%', better: 'higher', explain: 'An emergency link must not drop in a storm: the storm is the emergency.' },
        { id: 'gov.service', label: 'Share of Angola served', metric: 'service', region: 'angola', threshold: 99, goal: 100, unit: '%', better: 'higher', explain: 'Every border post and hospital.' },
      ],
    },
  ],
  maxSecondary: 2,
  orbitTypes: ['geo'],
  launchers: ['falcon9', 'falcon9x', 'ariane62', 'ariane64', 'falconHeavy'],
  platforms: ['medium', 'large'],
  instruments: ['cband', 'kuband', 'kaHts'],
  stations: ['luanda', 'hartebeesthoek'],
  budgetM: 420,
  deadlineMonths: 52,
  opsPerYearM: 2.5,
  startLabel: 'January 2027',
  critical: ['power', 'mass', 'time'],
  lessons: [
    'Transponders eat power: a GEO satellite\'s wings are as big as a tennis court.',
    'Higher frequency carries more data but tropical rain absorbs it: availability falls.',
    'Most of a GEO satellite\'s launch mass is propellant: to climb from the transfer orbit and to hold its slot for 15 years.',
    'Electric propulsion halves the mass, but the climb to GEO then takes months.',
  ],
  example: {
    ...base, scenario: 'geo-comms', name: 'AngoLink (example)', primary: 'tv', secondary: ['gov'],
    orbit: { ...orbitDefaults, type: 'geo', lonDeg: 23 }, launcher: 'falcon9', plannedYears: 15,
    platform: 'large', mount: 'tracking', arrayM2: 48, batteryWh: 13_500, computer: 'radHard', redundant: true, adcs: 'wheels', propulsion: 'biprop',
    instruments: ['kuband', 'cband'], band: 'S', antenna: 'helix', dishM: 1, txW: 10, storageGbit: 8, stations: ['luanda', 'hartebeesthoek'],
    reservePct: 15, insurance: true, tests: tested,
  },
  starter: {
    ...empty, scenario: 'geo-comms', name: 'Angola GEO satellite', primary: 'tv',
    orbit: { ...orbitDefaults, type: 'geo', lonDeg: 23 }, plannedYears: 15,
  },
};

// ------------------------------------------------------------------ lunar far-side relay
const LUNAR_RELAY: Scenario = {
  id: 'lunar-relay',
  name: 'Far Side Relay',
  tagline: 'A relay satellite that links landers on the far side of the Moon to Earth.',
  customer: 'An international lunar exploration programme (Artemis Accords partners)',
  brief: 'Landers on the far side of the Moon can never see Earth. Put a relay where it sees both, and keep the data flowing for years. The best place for landers is the worst place for radio astronomers, who want Earth hidden: choose your objectives carefully.',
  body: 'moon',
  requirements: [life('relay.life', 3, 5, 'Several lander missions are planned over five years.')],
  objectives: [
    {
      id: 'landers', name: 'Relay for far-side landers',
      explain: 'Talk to landers in the Von Kármán crater, deep on the far side.',
      value: { proxX: 1, proxS: 0.7 },
      requirements: [
        { id: 'landers.cov', label: 'Time the lander can reach Earth', metric: 'relayCoverage', site: 'vonKarman', threshold: 50, goal: 90, unit: '%', better: 'higher', explain: 'The relay must see the lander and Earth at once, and a ground antenna must be listening.' },
        { id: 'landers.rate', label: 'Lander data rate', metric: 'relayRate', site: 'vonKarman', threshold: 0.5, goal: 5, unit: 'Mbps', better: 'higher', explain: 'Pictures and science from the lander; a rover\'s video needs megabits.' },
      ],
    },
    {
      id: 'polar', name: 'South pole support',
      explain: 'Relay for the south-pole region where Artemis crews will land, often out of Earth\'s view.',
      value: { proxX: 1, proxS: 0.8 },
      requirements: [
        { id: 'polar.cov', label: 'Time the pole can reach Earth', metric: 'relayCoverage', site: 'southPole', threshold: 50, goal: 90, unit: '%', better: 'higher', explain: 'Astronauts in craters must always be able to call home.' },
        { id: 'polar.rate', label: 'Pole data rate', metric: 'relayRate', site: 'southPole', threshold: 1, goal: 10, unit: 'Mbps', better: 'higher', explain: 'Voice, video and science for crews.' },
      ],
    },
    {
      id: 'radio', name: 'Far-side radio astronomy',
      explain: 'Listen to the faint radio signals of the early Universe, which Earth\'s radio noise drowns out.',
      value: { lfr: 1 },
      requirements: [
        { id: 'radio.quiet', label: 'Time with Earth hidden behind the Moon', metric: 'quiet', threshold: 20, goal: 35, unit: '%', better: 'higher', explain: 'Only with the Moon between the antenna and Earth is the sky radio-quiet.' },
      ],
    },
  ],
  maxSecondary: 1,
  orbitTypes: ['halo', 'elfo', 'llo'],
  launchers: ['electron', 'falcon9', 'ariane62'],
  platforms: ['micro', 'small', 'medium'],
  instruments: ['proxS', 'proxX', 'lfr', 'lunarCam', 'mag'],
  stations: ['dsn', 'deepCommercial'],
  budgetM: 180,
  deadlineMonths: 36,
  opsPerYearM: 4,
  startLabel: 'January 2027',
  critical: ['comms', 'mass', 'budget'],
  landers: { S: { txW: 5, gainDbi: 10 }, X: { txW: 10, gainDbi: 30 } },
  lessons: [
    'Distance costs data rate: every doubling of distance quarters the signal.',
    'Where you can see both the far side and Earth is far from both: you pay for it with antenna size.',
    'A relay is only as good as the ground antennas listening to it, hour by hour.',
  ],
  example: {
    ...base, scenario: 'lunar-relay', name: 'Bridge-1 (example)', primary: 'landers',
    orbit: { ...orbitDefaults, type: 'halo', transfer: 'direct' }, launcher: 'falcon9', plannedYears: 5,
    platform: 'micro', mount: 'tracking', arrayM2: 1.5, batteryWh: 300, computer: 'radTolerant', adcs: 'wheels', propulsion: 'mono',
    instruments: ['proxX'], band: 'X', antenna: 'dish', dishM: 0.8, txW: 20, storageGbit: 512, stations: ['deepCommercial'], trackHoursPerDay: 16,
    reservePct: 20, tests: tested,
  },
  starter: {
    ...empty, scenario: 'lunar-relay', name: 'Lunar relay', primary: 'landers',
    orbit: { ...orbitDefaults, type: 'halo', transfer: 'direct' }, plannedYears: 5,
  },
};

// ------------------------------------------------------------------ Mars science orbiter
const MARS_ORBITER: Scenario = {
  id: 'mars-orbiter',
  name: 'Red Planet Orbiter',
  tagline: 'A science orbiter to map Mars\'s minerals, climate and buried ice.',
  customer: 'A space agency science programme',
  brief: 'Mars is only reachable once every 26 months, and every bit of data must cross up to 400 million km. Choose your science, get to the launch window on time, and decide how to brake into orbit.',
  body: 'mars',
  requirements: [
    { id: 'mars.window', label: 'Launch window (months after start)', metric: 'launchMonth', threshold: 50, goal: 24, unit: 'months', better: 'lower', explain: 'Planets line up for a launch every 26 months: the 2029 window (month 24) or the 2031 one (month 50). Miss it and wait two more years.' },
    life('mars.life', 1.9, 3.8, 'One Mars year (687 days) shows all the seasons; two show how they change.'),
  ],
  objectives: [
    {
      id: 'minerals', name: 'Minerals and ancient water',
      explain: 'Find the clays and salts that formed in water billions of years ago.',
      value: { crism: 1, ctx: 0.6, hirise: 0.4 },
      requirements: [
        { id: 'minerals.gsd', label: 'Pixel size', metric: 'gsd', threshold: 50, goal: 20, unit: 'm', better: 'lower', explain: 'Mineral deposits in old lake beds are tens of metres across.' },
        { id: 'minerals.map', label: 'Share of Mars mapped', metric: 'marsMapped', threshold: 10, goal: 40, unit: '%', better: 'higher', explain: 'The more ground covered, the better the chance of finding them.' },
      ],
    },
    {
      id: 'climate', name: 'Climate and dust storms',
      explain: 'Follow the weather, the dust storms and the water vapour, season by season.',
      value: { mcs: 1, uvs: 0.6, ctx: 0.4 },
      requirements: [
        { id: 'climate.data', label: 'Data returned over the mission', metric: 'dataReturn', threshold: 5, goal: 20, unit: 'Tbit', better: 'higher', explain: 'Daily global weather maps add up over two Mars years.' },
      ],
    },
    {
      id: 'ice', name: 'Buried ice',
      explain: 'Find ice under the surface: water for future astronauts.',
      value: { sharad: 1, hirise: 0.3, ctx: 0.3 },
      requirements: [
        { id: 'ice.alt', label: 'Orbit low point', metric: 'altitude', threshold: 400, goal: 300, unit: 'km', better: 'lower', explain: 'The radar echo weakens with distance.' },
        { id: 'ice.map', label: 'Share of Mars sounded', metric: 'marsMapped', threshold: 20, goal: 50, unit: '%', better: 'higher', explain: 'Ice hides under the mid-latitudes; you need many tracks.' },
      ],
    },
    {
      id: 'landing', name: 'Landing-site scouting',
      explain: 'Inspect future landing sites rock by rock.',
      value: { hirise: 1, ctx: 0.6 },
      requirements: [
        { id: 'landing.gsd', label: 'Pixel size', metric: 'gsd', threshold: 1, goal: 0.3, unit: 'm', better: 'lower', explain: 'A rock big enough to tip over a lander is about a metre.' },
        { id: 'landing.data', label: 'Data returned over the mission', metric: 'dataReturn', threshold: 20, goal: 60, unit: 'Tbit', better: 'higher', explain: 'Every high-resolution image is gigabits.' },
      ],
    },
  ],
  maxSecondary: 2,
  orbitTypes: ['marsLow', 'marsHigh'],
  launchers: ['falcon9x', 'ariane64', 'falconHeavy'],
  platforms: ['small', 'medium'],
  instruments: ['hirise', 'ctx', 'crism', 'sharad', 'mcs', 'uvs', 'mag'],
  stations: ['dsn', 'deepCommercial'],
  budgetM: 350,
  deadlineMonths: 50,
  opsPerYearM: 10,
  windows: [24, 50, 76],
  startLabel: 'January 2027',
  critical: ['data', 'time', 'power'],
  lessons: [
    'At Mars the Sun gives less than half the power it does at Earth.',
    'The downlink, not the cameras, decides how much of Mars you can map.',
    'Aerobraking saves a tonne of propellant but costs half a year of skimming the atmosphere.',
    'Planetary missions live by launch windows: late means two years late.',
  ],
  example: {
    ...base, scenario: 'mars-orbiter', name: 'Ares Mapper (example)', primary: 'minerals', secondary: ['climate'],
    orbit: { ...orbitDefaults, type: 'marsLow', altKm: 300, ltanH: 15, capture: 'aerobrake' }, launcher: 'falcon9x', plannedYears: 2,
    platform: 'medium', mount: 'tracking', arrayM2: 12, batteryWh: 900, computer: 'radHard', redundant: true, adcs: 'wheels', propulsion: 'biprop',
    instruments: ['ctx', 'crism', 'mcs'], band: 'X', antenna: 'dish', dishM: 3, txW: 100, storageGbit: 2_048, stations: ['dsn'], trackHoursPerDay: 8,
    reservePct: 25, tests: tested,
  },
  starter: {
    ...empty, scenario: 'mars-orbiter', name: 'Mars orbiter', primary: 'minerals',
    orbit: { ...orbitDefaults, type: 'marsLow', altKm: 300, ltanH: 15, capture: 'propulsive' }, plannedYears: 2,
  },
};

// ------------------------------------------------------------------ crew around the Moon
const CREW_MOON: Scenario = {
  id: 'crew-moon',
  name: 'Crew Around the Moon',
  tagline: 'Fly astronauts around the Moon and bring every one of them home.',
  customer: 'An Artemis Accords partnership (Angola signed in 2023)',
  brief: 'In April 2026 Artemis II carried four people around the Moon, the first in more than fifty years. Your capsule, call sign Palanca after Angola\'s giant sable antelope, flies next. With people on board everything changes: air, water and food for every day, a shelter from solar storms, a way off a failing rocket and a heat shield for an 11 km/s return. The first requirement is not science. It is that the crew comes home.',
  body: 'moon',
  crew: { callSign: 'Palanca' },
  requirements: [
    { id: 'crew.dose', label: 'Radiation dose per astronaut, with one solar storm', metric: 'crewDose', threshold: 150, goal: 80, unit: 'mSv', better: 'lower', explain: 'NASA limits an astronaut\'s whole career to 600 mSv. A flight plans for one large solar storm and still stays far below that.' },
    { id: 'crew.margin', label: 'Spare days of air, water and food', metric: 'supplies', threshold: 2, goal: 4, unit: 'days', better: 'higher', explain: 'A delay on the way home must not become an emergency: Apollo 13 lived on its margins.' },
  ],
  objectives: [
    {
      id: 'shakedown', name: 'Prove the ship',
      explain: 'A test flight with people: check every system and fly the capsule by hand, as Artemis II did.',
      value: { pilotKit: 1, radSensors: 0.6, crewCam: 0.3 },
      requirements: [
        { id: 'shakedown.crew', label: 'Astronauts on board', metric: 'crewSize', threshold: 3, goal: 4, unit: 'crew', better: 'higher', explain: 'A full crew tests every seat, every console and every procedure.' },
      ],
    },
    {
      id: 'moonSci', name: 'Science at the Moon',
      explain: 'Stay in lunar orbit long enough to study the surface and what deep space does to the human body.',
      value: { lunarCam: 1, bioLab: 0.6, radSensors: 0.5 },
      requirements: [
        { id: 'moonSci.days', label: 'Days at the Moon', metric: 'moonDays', threshold: 3, goal: 6, unit: 'days', better: 'higher', explain: 'A flyby is over in a day. Mapping landing sites and running experiments takes days in orbit.' },
      ],
    },
    {
      id: 'outreach', name: 'Bring the world along',
      explain: 'Live video from the Moon to classrooms in Luanda and everywhere else.',
      value: { o2o: 1, crewCam: 0.7 },
      requirements: [
        { id: 'outreach.rate', label: 'Downlink from the Moon', metric: 'downlink', threshold: 2, goal: 20, unit: 'Mbps', better: 'higher', explain: '2 Mbps carries ordinary video; 20 Mbps carries it live in 4K.' },
      ],
    },
  ],
  maxSecondary: 1,
  orbitTypes: ['freeReturn', 'crewDro', 'crewNrho', 'crewLlo'],
  launchers: ['sls', 'falconHeavy'],
  platforms: ['capsule3', 'capsule4', 'capsuleHab'],
  instruments: ['pilotKit', 'radSensors', 'crewCam', 'o2o', 'bioLab', 'lunarCam'],
  stations: ['dsn', 'deepCommercial'],
  budgetM: 5_600,
  deadlineMonths: 66,
  opsPerYearM: 0,
  opsPerMissionM: 260,
  startLabel: 'January 2027',
  critical: ['mass', 'time', 'budget'],
  lessons: [
    'People need about 7 kg of air, water and food each a day, and somewhere to live: a crewed ship is mostly life support.',
    'Stopping at the Moon costs propellant twice, to arrive and to leave. A flyby is nearly free and comes home by itself.',
    'Beyond Earth\'s magnetic field the crew is exposed to radiation every day, and a solar storm can deliver months of it in hours.',
    'Human rating means surviving any single failure: a spare computer, an escape system, tested life support.',
  ],
  example: {
    ...base, scenario: 'crew-moon', name: 'Palanca (example)', primary: 'shakedown', secondary: ['outreach'],
    orbit: { ...orbitDefaults, type: 'freeReturn' }, launcher: 'sls', plannedYears: 10 / 365.25,
    platform: 'capsule4', mount: 'tracking', arrayM2: 29, batteryWh: 7_000, computer: 'radHard', redundant: true, adcs: 'wheels', propulsion: 'biprop',
    instruments: ['pilotKit', 'radSensors', 'o2o'], band: 'S', antenna: 'dish', dishM: 1, txW: 20, storageGbit: 512, stations: ['dsn'], trackHoursPerDay: 24,
    reservePct: 15, tests: [...tested, 'abort', 'eclss'],
    crew: { size: 4, eclss: 'regen', marginDays: 4, shelter: 'stowage', suits: 'iva', abort: 'tower', shield: 'lunar' },
  },
  starter: {
    ...empty, scenario: 'crew-moon', name: 'Palanca', primary: 'shakedown',
    orbit: { ...orbitDefaults, type: 'freeReturn' }, plannedYears: 10 / 365.25, trackHoursPerDay: 12,
    crew: { size: 2, eclss: 'open', marginDays: 0, shelter: 'none', suits: 'iva', abort: 'none', shield: 'leo' },
  },
};

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  tutorial: TUTORIAL,
  'angola-eo': ANGOLA_EO,
  'geo-comms': GEO_COMMS,
  'lunar-relay': LUNAR_RELAY,
  'mars-orbiter': MARS_ORBITER,
  'crew-moon': CREW_MOON,
};

/** Every requirement that applies to a design: the mission's, then the chosen objectives'. */
export function activeRequirements(s: Scenario, d: StudioDesign): { req: Requirement; objective: Objective | null }[] {
  const out: { req: Requirement; objective: Objective | null }[] = s.requirements.map((req) => ({ req, objective: null }));
  for (const id of [d.primary, ...d.secondary]) {
    const o = s.objectives.find((x) => x.id === id);
    if (o) for (const req of o.requirements) out.push({ req, objective: o });
  }
  return out;
}
