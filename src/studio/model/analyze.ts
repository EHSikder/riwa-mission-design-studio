/**
 * The studio's consequence engine (docs/03 §5). From a design and its scenario it works out everything that
 * follows from the decisions:
 * - the orbit's facts, where it can look and when it can talk;
 * - the Δv and the propellant;
 * - the mass, power, cost, data, comms and time budgets;
 * - the launcher check;
 * - the predicted value of every requirement;
 * - the six resources with their margins;
 * - plain-language issues that say what is wrong, why, and what would fix it.
 * Pure and deterministic: the UI runs it on every change, the mission simulation starts from it, the tests pin it.
 */
import {
  ADCS, AIT_COST_FRACTION, ANTENNAS, ARRAY_MOUNTS, BANDS, BATTERY_COST_PER_WH_M, BATTERY_WH_PER_KG, CELLS, COMPUTERS, CUBESAT_MAX_TX_W,
  INTEGRATION_MASS_FRACTION, LAUNCHERS, ORBIT_TYPES, PANEL_FACTOR, PLATFORMS, PROPULSION, STATIONS, batteryCycleLife,
  pcduCostM, pcduKg, storageCostM, storageKg, storageW, transmitterCostM, transmitterKg, type LauncherId, type StationId,
} from './catalog';
import { computeAccess, earthMarsGeometry, geoService, lunarRelayGeometry, reachAngle, type AccessResult, type LunarRelayGeometry } from './access';
import { ABORTS, CREW_KG, CREW_POWER_W, CREW_TRIPS, ECLSS, EVA_SUITS, GCR_MSV_PER_DAY, SEAT_AND_SUIT_KG, SHELTERS, SHIELDS, habNeedM3, type CrewOrbitId, type CrewPlan } from './crew';
import { DIFFICULTY, type Level, type StudioDesign } from './design';
import { INSTRUMENTS, groundSpeed, imagerAt, instrumentRateMbps, massGrowth, type Instrument, type InstrumentId } from './instruments';
import { availabilityPct, beamwidthDeg, dishGainDbi, linkRate, type LinkEnds } from './link';
import {
  ELECTRIC_CLIMB_FACTOR, LUNAR_DV, MARS_CAPTURE_APO_KM, decayYears, deorbitDv, dragDvPerYear, dvFor, gtoToGeoDv, marsCaptureDv,
  orbitFacts, propellantFor, type OrbitFacts,
} from './orbit';
import { LUNAR_SITES, REGIONS, regionArea, type RegionId } from './regions';
import { SCENARIOS, activeRequirements, type Objective, type Requirement, type Scenario } from './scenarios';
import { TESTS, applicableTests, type TestId } from './tests';
import { CLEAR_DRY, CLEAR_RAINY } from './sky';
import { DEG, RESOURCES, type Difficulty, type ResourceId, type RoleId } from './types';

export type Status = 'good' | 'warn' | 'fail' | 'over';

export interface Line {
  name: string;
  value: number;
  note?: string;
  /** The desk (role) whose decisions drive this line: team allocations count it there. */
  desk?: RoleId;
}

export interface Issue {
  level: 'fail' | 'warn' | 'info';
  role: RoleId;
  resource?: ResourceId;
  text: string;
  fix?: string;
}

export interface ResourceSummary {
  id: ResourceId;
  name: string;
  /** What is used or needed, and what is available. */
  value: number;
  limit: number;
  unit: string;
  marginPct: number;
  status: Status;
  headline: string;
  why: string;
  critical: boolean;
  /** Where the value sits between too little and more than needed. */
  gauge?: Gauge;
  /** What is wrong, each in a few words and why it matters; empty when it fits. */
  problems: Problem[];
}

/** One thing wrong with a resource, as the dashboard says it when the resource is clicked. */
export interface Problem {
  title: string;
  why: string;
  /** A word or two for the value slot ("No launcher"), for problems the gauge cannot show. */
  tag?: string;
}

/**
 * A sweet spot. Most engineering numbers are not "more is better": too little fails, and too much is mass and
 * money carried for nothing. The bar's first third is too little, the middle just right, the last third more
 * than needed.
 */
export interface Gauge {
  /** What is measured, and its value in words ("Power to spare", "+34%"). */
  label: string;
  value: string;
  /** The range engineers aim for ("10–40%"). */
  ideal: string;
  /** 0–1 along the bar. */
  pos: number;
  zone: 'under' | 'right' | 'over';
  /** Why too little is a problem, and why too much is. */
  under: string;
  over: string;
  /** Where the range comes from: a published rule, or a rule of this game. */
  source?: string;
}

/** Place `x` on a sweet-spot bar whose just-right range is lo…hi; `min` and `max` are the ends of the bar. */
export function gaugeOf(x: number, lo: number, hi: number, min: number, max: number, text: Pick<Gauge, 'label' | 'value' | 'ideal' | 'under' | 'over' | 'source'>): Gauge {
  const c = (v: number) => Math.min(1, Math.max(0, v));
  const v = Number.isFinite(x) ? x : x > 0 ? max : min;
  const pos = v < lo ? c((v - min) / (lo - min)) / 3 : v <= hi ? (1 + c((v - lo) / Math.max(1e-9, hi - lo))) / 3 : (2 + c((v - hi) / (max - hi))) / 3;
  return { ...text, pos, zone: v < lo ? 'under' : v <= hi ? 'right' : 'over' };
}

export interface ReqResult {
  req: Requirement;
  objective: Objective | null;
  level: Level;
  value: number;
  met: 'goal' | 'threshold' | 'fail';
  display: string;
  why: string;
}

export interface InstrumentUse {
  id: InstrumentId;
  name: string;
  duty: number;
  rateMbps: number;
  gbitPerDay: number;
  deliveredGbitPerDay: number;
}

/** One line of the build list: a part of the mission that has to be chosen before it can fly. */
export interface BuildItem {
  id: string;
  label: string;
  role: RoleId;
  done: boolean;
  /** Worth doing, but the mission can fly without it. */
  optional?: boolean;
  hint: string;
}

export interface Analysis {
  scenario: Scenario;
  design: StudioDesign;
  difficulty: Difficulty;
  orbit: OrbitFacts;
  access: AccessResult | null;
  lunar: LunarRelayGeometry | null;
  dv: { lines: Line[]; totalMs: number; perYearMs: number; capabilityMs: number };
  mass: { lines: Line[]; dryKg: number; propellantKg: number; wetKg: number; payloadKg: number; limitKg: number; limitBy: 'platform' | 'launcher'; marginPct: number };
  power: {
    bolW: number; eolW: number; requiredW: number; loadW: number; lines: Line[]; marginPct: number; pointing: number;
    /** Watts per square metre of array in sunlight, and the share left after ageing. */
    perM2W: number; ageing: number;
    eclipseWh: number; batteryNeedWh: number; dod: number; dodAllowed: number; batteryLifeYears: number; maxArrayM2: number;
  };
  cost: { lines: Line[]; developmentM: number; launchM: number; operationsM: number; reserveM: number; totalM: number; budgetM: number; marginPct: number };
  data: {
    instruments: InstrumentUse[]; generatedGbitDay: number; capacityGbitDay: number; deliveredGbitDay: number; lossPct: number;
    storageNeedGbit: number; latencyH: number; missionTbit: number; dataLimited: boolean;
  };
  comms: { rateMbps: number; worstMbps: number; marginDb: number; contactMinPerDay: number; passesPerDay: number; rangeKm: number; lightTimeS: number; station: string };
  time: { devMonths: number; longest: string; launchMonth: number; deadlineMonth: number; serviceMonth: number; lifetimeYears: number; limits: Line[]; raiseDays: number };
  launch: { ok: boolean; capacityKg: number; priceM: number; reasons: string[]; options: { id: LauncherId; cap: number; price: number; why: string[] }[] };
  requirements: ReqResult[];
  resources: Record<ResourceId, ResourceSummary>;
  issues: Issue[];
  /** Predicted value (0–1) of each chosen objective, before anything goes wrong in flight. */
  value: Record<string, number>;
  /** The build list: what is on the assembly stand, and what is still missing. */
  build: BuildItem[];
  /** The ground tests planned, the ones left out, and what the plan costs. */
  tests: { planned: TestId[]; skipped: TestId[]; weeks: number; costM: number };
  /** People on board: the trip, the supplies, the dose (crewed missions). */
  crew: CrewPlan | null;
  /** End of life in low Earth orbit: years the spacecraft would stay up with no engine, and the 25-year rule. */
  debris: { lowEarth: boolean; reentryYears: number; ruleOk: boolean };
}

const f0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '∞');
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '∞');
const f2 = (x: number) => (Number.isFinite(x) ? (Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2)) : '∞');
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

/** Swath of any instrument that sweeps the ground (km), at an altitude. */
function swathKmAt(i: Instrument, altKm: number): number {
  if (!i.swathKm) return 0;
  return i.kind === 'sar' || !i.refAltKm ? i.swathKm : (i.swathKm * altKm) / i.refAltKm;
}

export function analyze(d: StudioDesign, difficulty: Difficulty = 'engineer'): Analysis {
  const s = SCENARIOS[d.scenario];
  const diff = DIFFICULTY[difficulty];
  const issues: Issue[] = [];
  const issue = (level: Issue['level'], role: RoleId, text: string, fix?: string, resource?: ResourceId) => issues.push({ level, role, text, fix, resource });

  const facts = orbitFacts(d.orbit);
  const body = facts.body;
  const p = PLATFORMS[d.platform];
  const prop = PROPULSION[d.propulsion];
  const adcs = ADCS[d.adcs];
  const comp = COMPUTERS[d.computer];
  const cell = CELLS[d.cells];
  const mount = ARRAY_MOUNTS[d.mount];
  const band = BANDS[d.band];
  const ant = ANTENNAS[d.antenna];
  const lv = LAUNCHERS[d.launcher];
  const ins: (Instrument & { id: InstrumentId })[] = d.instruments.filter((id) => INSTRUMENTS[id]).map((id) => ({ ...INSTRUMENTS[id], id }));
  // a crewed flight lasts as long as its trajectory
  const trip = s.crew ? CREW_TRIPS[d.orbit.type as CrewOrbitId] : undefined;
  const crewSel = trip ? d.crew ?? { size: 2, eclss: 'open' as const, marginDays: 0, shelter: 'none' as const, suits: 'iva' as const, abort: 'none' as const, shield: 'leo' as const } : undefined;
  const years = trip ? trip.days / 365.25 : Math.max(0.25, d.plannedYears);
  const transferYears = facts.transferDays / 365.25;
  const geo = d.orbit.type === 'geo';
  const lowEarth = s.body === 'earth' && !geo;
  const reqs = activeRequirements(s, d);
  const relays = ins.filter((i) => i.kind === 'relay');
  const transponders = ins.filter((i) => i.kind === 'transponder');
  // what is on the assembly stand so far: every mission starts with nothing
  const has = {
    structure: d.platform !== 'none', arrays: d.arrayM2 > 0, battery: d.batteryWh > 0, computer: d.computer !== 'none',
    adcs: d.adcs !== 'none', radio: d.antenna !== 'none', storage: d.storageGbit > 0, launcher: d.launcher !== 'none',
  };
  if (!has.structure) issue('fail', 'spacecraft', 'No structure yet: there is nothing to bolt the parts to.', 'Pick a platform on the Spacecraft desk.', 'mass');
  if (!has.computer) issue('fail', 'spacecraft', 'No onboard computer yet: nothing runs the spacecraft.', 'Pick a computer on the Spacecraft desk.');
  if (!has.adcs) issue('fail', 'spacecraft', 'No attitude control yet: the spacecraft would tumble.', 'Pick a way to point it on the Spacecraft desk.');
  if (!has.radio) issue('fail', 'comms', 'No antenna or radio yet: the spacecraft cannot talk to the ground.', 'Pick an antenna on the Comms desk.', 'comms');
  if (!has.storage) issue('fail', 'comms', 'No onboard storage yet: nothing holds the data between contacts.', 'Pick a storage size on the Comms desk.', 'data');

  if (!s.orbitTypes.includes(d.orbit.type)) issue('fail', 'director', `${ORBIT_TYPES[d.orbit.type].name} is not part of this mission.`);
  for (const i of ins) if (!i.bodies.includes(s.body)) issue('fail', 'science', `${i.name} is not built for this mission.`);

  // ---------------------------------------------------------------- antenna and the link ends
  let txGain = ant.gainDbi ?? dishGainDbi(d.dishM, band.freqHz);
  if (d.antenna === 'dish' && d.band === 'UHF') {
    issue('fail', 'comms', 'A UHF dish would have to be tens of metres across.', 'Use a patch or shaped-beam antenna on UHF, or move to S- or X-band for a dish.', 'comms');
    txGain = 5;
  }
  if (d.antenna === 'dish' && has.structure && d.dishM > p.maxDishM + 1e-9) issue('fail', 'comms', `A ${f1(d.dishM)} m dish does not fit the ${p.short} platform (largest ${f1(p.maxDishM)} m).`, 'Pick a smaller dish or a bigger platform.', 'comms');
  if (d.antenna === 'dish') {
    const bw = beamwidthDeg(d.dishM, band.freqHz);
    if (has.adcs && adcs.accuracyDeg > bw / 4) issue('fail', 'spacecraft', `The ${f1(d.dishM)} m dish's beam is only ${f1(bw)}° wide, but ${adcs.name.toLowerCase()} point to ±${adcs.accuracyDeg}°: the beam would miss Earth.`, 'Fly reaction wheels and a star tracker, or use a wider-beam antenna.', 'comms');
  }
  const stationGt = (id: StationId) => STATIONS[id].gt[d.band];
  const ends = (gt: number): LinkEnds => ({ txW: d.txW, txGainDbi: txGain, freqHz: band.freqHz, rxGtDbK: gt, capMbps: band.capMbps, lossDb: band.atmLossDb });
  const deepStations = d.stations.filter((id) => STATIONS[id].deepSpace && stationGt(id) !== undefined);
  const earthStations = d.stations.filter((id) => !STATIONS[id].deepSpace);
  if (d.stations.length === 0) issue('fail', 'comms', 'No ground station: nobody on Earth can hear the spacecraft.', 'Choose at least one ground station.', 'comms');
  for (const id of d.stations) if (stationGt(id) === undefined) issue('fail', 'comms', `${STATIONS[id].short} has no ${d.band}-band receiver.`, 'Pick a band this station supports, or another station.', 'comms');
  if (s.body !== 'earth' && earthStations.length) issue('warn', 'comms', `${earthStations.map((id) => STATIONS[id].short).join(', ')} cannot hear a spacecraft that far away: only deep-space antennas count.`);

  // ---------------------------------------------------------------- where it looks and when it talks
  const altImg = facts.imagingAltKm;
  const regionsNeeded = [...new Set(reqs.map((r) => r.req.region).filter((x): x is RegionId => !!x && REGIONS[x].body === 'earth'))];
  if (lowEarth && !regionsNeeded.includes('angola')) regionsNeeded.push('angola');
  const sweepers = ins.filter((i) => i.swathKm);
  let access: AccessResult | null = null;
  if (lowEarth) {
    const sensors = sweepers.map((i) => {
      const half = (swathKmAt(i, altImg) * 500) / body.radius;
      const off = i.kind === 'sar' ? Math.max(i.reachDeg ?? 0, adcs.offNadirDeg) : adcs.offNadirDeg;
      return { id: i.id, halfSwathRad: half, reachRad: half + reachAngle(body, altImg, off), daylight: i.daylight };
    });
    const days = Math.max(30, ...reqs.map((r) => r.req.days ?? 0));
    access = computeAccess({
      body, altKm: facts.altKm, incDeg: facts.incDeg, raanDeg: facts.raanDeg, days, stepS: 30, sensors,
      regions: regionsNeeded,
      stations: earthStations.map((id) => ({ id, lat: STATIONS[id].lat, lon: STATIONS[id].lon, minElDeg: STATIONS[id].minElDeg })),
    });
  }
  const lunar = s.body === 'moon' && (d.orbit.type === 'llo' || d.orbit.type === 'elfo' || d.orbit.type === 'halo') ? lunarRelayGeometry(d.orbit.type) : null;

  // ---------------------------------------------------------------- instruments: how long they work, how much data
  const clearSky = s.clearSky ?? 1;
  const uses: InstrumentUse[] = ins.map((i) => {
    let duty = i.dutyMax;
    if (lowEarth && i.swathKm) {
      // a national mission images its own country: time over the targets, plus margin to start and stop
      const over = Math.max(0, ...regionsNeeded.map((r) => (i.daylight ? access!.regions[r]!.overLitSecondsPerDay : access!.regions[r]!.overSecondsPerDay)));
      duty = Math.min(i.dutyMax, (over * 1.3) / 86_400);
    } else if (i.swathKm) duty = i.dutyMax * facts.imagingShare;
    const rate = i.kind === 'transponder' || i.kind === 'relay' ? 0 : instrumentRateMbps(i, body, altImg);
    const reduce = i.kind === 'imager' || i.kind === 'spectrometer' ? 1 - comp.dataReduction : 1;
    return { id: i.id, name: i.short, duty, rateMbps: rate, gbitPerDay: (rate * duty * 86_400 * reduce) / 1000, deliveredGbitPerDay: 0 };
  });
  const generated = sum(uses.map((u) => u.gbitPerDay));

  // ---------------------------------------------------------------- downlink
  let capacityDay = 0, rateTyp = 0, rateWorst = 0, marginDb = -Infinity, contactMin = 0, passes = 0, rangeKm = 0, lightTime = 0, stationName = '—';
  let missionTbitCapacity = 0;
  const trackShare = Math.min(1, d.trackHoursPerDay / 24);
  const earthGts = earthStations.map(stationGt).filter((x): x is number => x !== undefined);
  const earthNames = earthStations.map((id) => STATIONS[id].short).join(' + ');
  if (access) {
    // each contact's rate, worked out once
    const rates = access.contacts.map((c) => {
      const gt = stationGt(earthStations[c.station]);
      return gt === undefined ? 0 : linkRate(ends(gt), c.rangeM).mbps;
    });
    const step = access.stepS;
    capacityDay = sum(rates.map((r) => r * step)) / 1000 / access.days;
    rates.sort((a, b) => a - b);
    rateTyp = rates.length ? rates[Math.floor(rates.length / 2)] : 0;
    rateWorst = rates.length ? rates[0] : 0;
    const far = access.contacts.length ? Math.max(...access.contacts.map((c) => c.rangeM)) : 0;
    marginDb = earthGts.length && far ? linkRate(ends(Math.max(...earthGts)), far).marginDb : -Infinity;
    contactMin = sum(access.contactMinPerDay);
    passes = sum(access.passesPerDay);
    rangeKm = far / 1000;
    lightTime = far / 3e8;
    stationName = earthNames;
    missionTbitCapacity = (capacityDay * 365.25 * years) / 1000;
  } else if (geo) {
    const r = linkRate(ends(earthGts.length ? Math.max(...earthGts) : -Infinity), 38_600_000);
    rateTyp = rateWorst = earthGts.length ? r.mbps : 0;
    marginDb = r.marginDb;
    contactMin = earthGts.length ? 1440 : 0;
    rangeKm = 38_600;
    lightTime = 0.129;
    stationName = earthNames || '—';
    capacityDay = (rateTyp * 86_400) / 1000;
  } else {
    // deep space: the best antenna listening for the hours bought each day
    const gt = deepStations.length ? Math.max(...deepStations.map((id) => stationGt(id)!)) : -Infinity;
    stationName = deepStations.length ? STATIONS[deepStations.reduce((a, b) => (stationGt(a)! >= stationGt(b)! ? a : b))].short : '—';
    const [typ, worst] = lunar ? lunar.earthRangeM : facts.earthRangeM;
    const rt = linkRate(ends(gt), typ);
    rateTyp = deepStations.length ? rt.mbps : 0;
    rateWorst = deepStations.length ? linkRate(ends(gt), worst).mbps : 0;
    marginDb = linkRate(ends(gt), worst).marginDb;
    contactMin = d.trackHoursPerDay * 60;
    passes = 1;
    rangeKm = worst / 1000;
    lightTime = worst / 3e8;
    if (s.body === 'mars') {
      // day by day through the synodic cycle; no contact near solar conjunction
      let bits = 0;
      const n = Math.round(years * 365.25);
      for (let k = 0; k < n; k++) {
        const g = earthMarsGeometry(k);
        if (g.sepDeg < 3 || !deepStations.length) continue;
        bits += linkRate(ends(gt), g.distM).mbps * d.trackHoursPerDay * 3600;
      }
      missionTbitCapacity = bits / 1e6;
      capacityDay = (bits / 1000) / Math.max(1, n);
    } else {
      capacityDay = (rateTyp * d.trackHoursPerDay * 3600) / 1000;
      missionTbitCapacity = (capacityDay * 365.25 * years) / 1000;
    }
  }
  if (comp.dataReduction > 0 && lowEarth) issue('info', 'science', `The AI processor drops cloudy scenes and compresses on board: ${f0(comp.dataReduction * 100)}% less to send.`);

  // data actually delivered: low orbit loses what does not fit; deep space plans imaging to fit the link
  const deep = s.body !== 'earth';
  const storageNeed = access
    ? (generated * Math.min(24, access.maxGapH)) / 24 * 1.25
    : deep ? (Math.min(generated, capacityDay) * (1 - trackShare)) * 1.5 : 0;
  const storageFactor = storageNeed > 0 ? Math.min(1, d.storageGbit / storageNeed) : 1;
  const deliveredDay = Math.min(generated, capacityDay) * (access ? storageFactor : 1);
  const deliveredShare = generated > 0 ? deliveredDay / generated : 1;
  for (const u of uses) u.deliveredGbitPerDay = u.gbitPerDay * deliveredShare;
  const missionTbit = s.body === 'mars' ? Math.min(missionTbitCapacity, (generated * 365.25 * years) / 1000) : (deliveredDay * 365.25 * years) / 1000;
  const lossPct = deep ? 0 : (1 - deliveredShare) * 100;
  const dataLimited = deep && generated > capacityDay * 1.001;

  // ---------------------------------------------------------------- transmitter and payload duty for power
  const txDuty = access ? Math.min(1, contactMin / 1440) : geo ? 1 : trackShare;

  // ---------------------------------------------------------------- mass, Δv and propellant (solved together)
  const arrayKg = d.arrayM2 * (cell.kgPerM2 + mount.extraKgPerM2) + mount.driveKg(d.arrayM2);
  const batteryKg = d.batteryWh / BATTERY_WH_PER_KG;
  const env = s.body === 'mars' ? 1.25 : s.body === 'moon' ? 1.15 : 1;
  const bodyArea = (p.size[0] + p.size[1]) * p.size[2];
  const maxArrayM2 = mount.bodyOnly ? Math.min(p.maxArrayM2, bodyArea) : p.maxArrayM2;
  let pointing = Infinity;
  for (let b = facts.betaRangeDeg[0]; b <= facts.betaRangeDeg[1] + 1e-9; b += 1) pointing = Math.min(pointing, mount.pointing(b * DEG));
  const perM2 = cell.efficiency * 1361 * facts.sunFactor * PANEL_FACTOR * pointing;
  const bolW = d.arrayM2 * perM2;
  const payloadKg = sum(ins.map((i) => i.massKg));
  const dragArea = p.size[0] * p.size[2] + (mount.bodyOnly ? 0 : 0.5 * d.arrayM2);

  // people and what keeps them alive
  const crewMass: Line[] = [], crewPower: Line[] = [], crewCost: Line[] = [];
  if (trip && crewSel) {
    const c = crewSel, e = ECLSS[c.eclss];
    crewMass.push(
      { name: `Crew of ${c.size}, with seats and suits`, value: c.size * (CREW_KG + SEAT_AND_SUIT_KG), desk: 'science' },
      { name: `Life support (${e.name.toLowerCase()})`, value: e.hardwareKg, desk: 'science' },
      { name: `Air, water and food (${trip.days} + ${c.marginDays} days)`, value: e.kgPerCrewDay * c.size * (trip.days + c.marginDays), desk: 'science' },
      { name: SHELTERS[c.shelter].name, value: SHELTERS[c.shelter].massKg, desk: 'spacecraft' },
      { name: ABORTS[c.abort].name, value: ABORTS[c.abort].massKg, desk: 'spacecraft' },
      { name: SHIELDS[c.shield].name, value: SHIELDS[c.shield].massShare * p.structureKg, desk: 'spacecraft' },
      ...(c.suits === 'eva' ? [{ name: 'Spacewalk suits and airlock', value: c.size * EVA_SUITS.perCrewKg + EVA_SUITS.airlockKg, desk: 'science' as RoleId }] : []),
    );
    crewPower.push(
      { name: 'Life support', value: e.baseW + e.perCrewW * c.size, desk: 'science' },
      { name: 'Crew equipment and lights', value: CREW_POWER_W * c.size, desk: 'science' },
    );
    crewCost.push(
      { name: `Life support (${e.name.toLowerCase()})`, value: e.costM, desk: 'science' },
      { name: SHELTERS[c.shelter].name, value: SHELTERS[c.shelter].costM, desk: 'spacecraft' },
      { name: ABORTS[c.abort].name, value: ABORTS[c.abort].costM, desk: 'spacecraft' },
      { name: SHIELDS[c.shield].name, value: SHIELDS[c.shield].costM, desk: 'spacecraft' },
      ...(c.suits === 'eva' ? [{ name: 'Spacewalk suits and airlock', value: EVA_SUITS.costM, desk: 'science' as RoleId }] : []),
    );
  }
  let dryKg = p.structureKg + payloadKg;
  let propKg = 0;
  let dvLines: Line[] = [];
  let perYear = 0;
  let massLines: Line[] = [];
  let raiseDays = 0;
  const electric = d.propulsion === 'electric';
  for (let it = 0; it < 12; it++) {
    const ballistic = (2.2 * dragArea) / Math.max(1, dryKg + propKg / 2);
    // Δv budget
    dvLines = [];
    perYear = 0;
    if (lowEarth) {
      if (prop.isp > 0) {
        const drag = dragDvPerYear(facts.altKm, ballistic);
        dvLines.push({ name: 'Orbit trim after launch', value: 10 });
        dvLines.push({ name: `Hold altitude against drag (${f1(drag)} m/s a year)`, value: drag * years });
        dvLines.push({ name: 'Dodge debris (1 m/s a year)', value: years });
        perYear = drag + 1;
        if (decayYears(facts.altKm, ballistic) > 25) dvLines.push({ name: 'De-orbit at end of life (25-year rule)', value: deorbitDv(facts.altKm) });
      }
    } else if (geo) {
      const climb = gtoToGeoDv(lv.gtoIncDeg ?? 27) * (electric ? ELECTRIC_CLIMB_FACTOR : 1);
      dvLines.push({ name: `Climb from the transfer orbit (${f0(lv.gtoIncDeg ?? 27)}° tilt)${electric ? ', spiralling' : ''}`, value: climb });
      dvLines.push({ name: 'North–south station keeping (46 m/s a year)', value: 46 * years });
      dvLines.push({ name: 'East–west station keeping (2 m/s a year)', value: 2 * years });
      dvLines.push({ name: 'Graveyard orbit at end of life', value: 11 });
      perYear = 48;
    } else if (trip) {
      dvLines.push({ name: 'Course corrections, out and back', value: trip.trimMs });
      if (trip.orbit) {
        dvLines.push({ name: 'Braking into lunar orbit', value: trip.inMs });
        dvLines.push({ name: 'Leaving for home', value: trip.outMs });
      }
    } else if (s.body === 'moon') {
      const t = LUNAR_DV[d.orbit.type as 'llo' | 'elfo' | 'halo'];
      const ins0 = d.orbit.type === 'halo' && d.orbit.transfer === 'lowEnergy' ? t.lowEnergy! : t.insertion;
      dvLines.push({ name: 'Course corrections', value: 30 });
      dvLines.push({ name: d.orbit.type === 'halo' ? 'Halo orbit insertion' : 'Lunar orbit insertion', value: ins0 });
      dvLines.push({ name: `Station keeping (${t.keepPerYear} m/s a year)`, value: t.keepPerYear * years });
      if (t.disposal) dvLines.push({ name: 'Disposal at end of life', value: t.disposal });
      perYear = t.keepPerYear;
    } else {
      const aero = d.orbit.type === 'marsLow' && d.orbit.capture === 'aerobrake';
      const capture = d.orbit.type === 'marsLow' && !aero ? marsCaptureDv(d.orbit.altKm, null) : marsCaptureDv(d.orbit.altKm, MARS_CAPTURE_APO_KM);
      dvLines.push({ name: 'Course corrections on the way', value: 50 });
      dvLines.push({ name: aero ? 'Mars orbit insertion (into a 1-sol ellipse)' : 'Mars orbit insertion', value: capture });
      if (aero) dvLines.push({ name: 'Aerobraking trims and raising the low point', value: 80 });
      dvLines.push({ name: 'Station keeping (5 m/s a year)', value: 5 * years });
      perYear = 5;
    }
    const totalDv = sum(dvLines.map((l) => l.value));
    const tankKg = prop.tankFraction * propKg;
    const busPower = p.housekeepingW * env + comp.powerW + storageW(d.storageGbit) + adcs.powerW(dryKg) + prop.powerW;
    const parts: Line[] = [
      { name: 'Structure, mounts and thermal', value: p.structureKg, desk: 'spacecraft' },
      { name: 'Solar arrays', value: arrayKg, desk: 'spacecraft' },
      { name: 'Battery', value: batteryKg, desk: 'spacecraft' },
      { name: 'Power electronics', value: has.arrays ? pcduKg(bolW) : 0, desk: 'spacecraft' },
      { name: d.redundant ? 'Computers (2, one spare)' : 'Computer', value: comp.massKg * (d.redundant ? 2 : 1), desk: 'spacecraft' },
      { name: 'Data storage', value: storageKg(d.storageGbit), desk: 'comms' },
      { name: 'Attitude control', value: adcs.massKg(dryKg), desk: 'spacecraft' },
      { name: 'Propulsion (engines and tanks)', value: prop.dryKg + tankKg, desk: 'spacecraft' },
      { name: d.antenna === 'dish' ? `Antenna (${f1(d.dishM)} m dish)` : 'Antenna', value: ant.massKg(d.dishM), desk: 'comms' },
      { name: 'Transmitter', value: has.radio ? transmitterKg(d.txW) : 0, desk: 'comms' },
      ...ins.map((i) => ({ name: i.short, value: i.massKg, desk: 'science' as RoleId })),
      ...crewMass.filter((l) => l.value > 0),
    ];
    const carried = sum(parts.map((l) => l.value)) - p.structureKg;
    const growth = sum(ins.map((i) => i.massKg * massGrowth(i.trl))) + 0.05 * (carried - payloadKg);
    massLines = [...parts, { name: 'Harness, brackets and blankets', value: INTEGRATION_MASS_FRACTION * carried, desk: 'spacecraft' }, { name: 'Growth allowance (maturity)', value: growth, desk: 'spacecraft' }];
    dryKg = sum(massLines.map((l) => l.value));
    const need = totalDv > 0 ? propellantFor(dryKg, totalDv, prop.isp) : 0;
    propKg = Number.isFinite(need) ? need * (1 + d.propellantMarginPct / 100) : 0;
    if (electric && geo) {
      // payload off during the climb: the arrays feed the thrusters
      const thrustW = Math.min(prop.maxPowerW!, Math.max(0, bolW - busPower));
      const thrust = prop.thrustPerW! * thrustW;
      raiseDays = thrust > 0 ? (dvLines[0].value * (dryKg + propKg)) / thrust / 86_400 : Infinity;
    }
  }
  const totalDv = sum(dvLines.map((l) => l.value));
  if (totalDv > 0 && prop.isp === 0 && !lowEarth) issue('fail', 'spacecraft', `This mission needs ${f0(totalDv)} m/s of Δv, and the spacecraft has no engine.`, 'Add propulsion: bipropellant for big burns, electric to save mass.', 'mass');
  if (electric && (s.body === 'moon' || s.body === 'mars')) issue('fail', 'spacecraft', 'Electric thrusters are far too gentle to brake into orbit on arrival: the spacecraft would fly past.', 'Use chemical propulsion (monopropellant or bipropellant) for the insertion burn.', 'mass');
  if (p.cubesat && (d.propulsion === 'biprop' || d.propulsion === 'mono')) issue('warn', 'spacecraft', 'The CubeSat Design Specification allows propulsion only behind three independent safety switches, and launch providers rarely accept toxic propellants on a CubeSat.', 'Cold gas or electric propulsion is CubeSat-friendly.');
  const wetKg = dryKg + propKg;
  const capability = dvFor(dryKg, propKg, prop.isp);
  const dvFixed = totalDv - perYear * years;

  // ---------------------------------------------------------------- power
  const loadLines: Line[] = ([
    { name: 'Housekeeping and heaters', value: p.housekeepingW * env, desk: 'spacecraft' },
    { name: 'Computer', value: comp.powerW, desk: 'spacecraft' },
    { name: 'Data storage', value: storageW(d.storageGbit), desk: 'comms' },
    { name: 'Attitude control', value: adcs.powerW(dryKg), desk: 'spacecraft' },
    { name: 'Propulsion heaters and valves', value: prop.powerW, desk: 'spacecraft' },
    { name: `Transmitter (${f0(txDuty * 100)}% of the time)`, value: has.radio ? (d.txW / band.ampEfficiency) * txDuty : 0, desk: 'comms' },
    ...ins.map((i, k): Line => ({ name: `${i.short} (${f1(uses[k].duty * 100)}% of the time)`, value: i.powerW * uses[k].duty, desk: 'science' })),
    ...crewPower,
  ] as Line[]).filter((l) => l.value > 0);
  const subtotal = sum(loadLines.map((l) => l.value));
  loadLines.push({ name: 'Power conversion losses', value: 0.05 * subtotal, desk: 'spacecraft' });
  const loadW = subtotal * 1.05;
  const eolW = bolW * (1 - cell.degradationPerYear) ** (years + transferYears);
  const te = facts.eclipseMin, td = facts.periodMin - te;
  const requiredW = te > 0 ? (loadW * (te / 0.65) + loadW * (td / 0.85)) / td : loadW / 0.85;
  const powerMargin = requiredW > 0 ? eolW / requiredW - 1 : 0;
  const eclipseWh = (loadW * te) / 60;
  const cycles = facts.eclipsesPerYear;
  const dodAllowed = Math.min(0.8, 0.2 * Math.sqrt(50_000 / Math.max(1, cycles * years)));
  const safeModeWh = (p.housekeepingW * env + comp.powerW + adcs.powerW(dryKg)) * (te > 0 ? 1 : 2);
  const batteryNeedWh = Math.max(eclipseWh / (dodAllowed * 0.9), safeModeWh);
  const dod = d.batteryWh > 0 ? eclipseWh / (d.batteryWh * 0.9) : eclipseWh > 0 ? Infinity : 0;
  const batteryLifeYears = cycles > 0 && dod > 0 ? batteryCycleLife(dod) / cycles : Infinity;
  if (has.structure && d.arrayM2 > maxArrayM2 + 1e-9) issue('fail', 'spacecraft', `${f1(d.arrayM2)} m² of ${mount.bodyOnly ? 'body-mounted cells does not fit on the box' : 'arrays is more than the platform can carry'} (largest ${f1(maxArrayM2)} m²).`, mount.bodyOnly ? 'Deploy wings, or choose a bigger platform.' : 'Choose a bigger platform or more efficient cells.', 'power');
  if (!has.battery) issue('fail', 'spacecraft', te > 0 ? `No battery yet: the spacecraft dies in its first ${f0(te)}-minute eclipse.` : 'No battery yet: nothing keeps the spacecraft alive if it loses the Sun.', `Fly at least ${f0(batteryNeedWh)} Wh.`, 'power');
  else if (dod > 1) issue('fail', 'spacecraft', `The battery runs flat in every ${f0(te)}-minute eclipse (it would need ${f0(eclipseWh / 0.9)} Wh).`, `Fly at least ${f0(batteryNeedWh)} Wh.`, 'power');
  else if (d.batteryWh < safeModeWh) issue('warn', 'spacecraft', `The battery cannot keep the spacecraft alive for an hour in safe mode (${f0(safeModeWh)} Wh needed).`, undefined, 'power');
  else if (dod > dodAllowed + 1e-9) issue('warn', 'spacecraft', `Each eclipse drains ${f0(dod * 100)}% of the battery: it will wear out after ${f1(batteryLifeYears)} years (${f0(cycles)} eclipses a year).`, `${f0(batteryNeedWh)} Wh keeps it under ${f0(dodAllowed * 100)}% per eclipse for ${f1(years)} years.`, 'power');

  // ---------------------------------------------------------------- attitude control and pointing
  const magneticOk = body.magneticField && !geo;
  if (adcs.needsMagneticField && !magneticOk) issue('fail', 'spacecraft', `Magnetorquers push against a magnetic field, and ${geo ? 'Earth\'s field is too weak at 36 000 km' : `${body.name} has none to speak of`}.`, 'Fly reaction wheels (with thrusters to unload them).', 'power');
  if (has.adcs) for (const i of ins) if (i.pointingDeg < adcs.accuracyDeg) issue('warn', 'science', `${i.short} needs pointing to ${i.pointingDeg}°, ${adcs.name.toLowerCase()} give ±${adcs.accuracyDeg}°: its images will smear (pixels ~3× worse).`, 'Reaction wheels and a star tracker point to 0.05°.');
  if (d.adcs === 'wheels' && !magneticOk && prop.isp === 0) issue('warn', 'spacecraft', 'Reaction wheels slowly fill up with momentum; far from Earth only thrusters can unload them.', 'Add propulsion.');

  // ---------------------------------------------------------------- payload accommodation
  if (has.structure && ins.length > p.slots) issue('fail', 'science', `${ins.length} instruments, but the ${p.short} platform has room for ${p.slots}.`, 'Remove an instrument or choose a bigger platform.', 'mass');
  if (has.structure && payloadKg > p.maxPayloadKg) issue('fail', 'science', `The payload weighs ${f0(payloadKg)} kg; the ${p.short} platform carries at most ${f0(p.maxPayloadKg)} kg.`, 'Lighter instruments, or a bigger platform.', 'mass');
  if (ins.length === 0) issue('fail', 'science', 'No instruments on board: the customer pays for a payload.', 'Pick at least one instrument that serves your objective.');

  // ---------------------------------------------------------------- people on board: human rating
  let crewPlan: CrewPlan | null = null;
  if (trip && crewSel) {
    const c = crewSel;
    const seats = p.crew?.seats ?? 0, cabin = p.crew?.habM3 ?? 0;
    const need = habNeedM3(trip.days) * c.size;
    if (has.structure && c.size > seats) issue('fail', 'science', `${c.size} astronauts, but the ${p.short.toLowerCase()} has ${seats} seats.`, 'A bigger capsule or a smaller crew.');
    if (has.structure && cabin < 0.75 * need) issue('fail', 'science', `${f1(cabin / c.size)} m³ each for ${trip.days} days: people need about ${f1(need / c.size)} m³ each to live and work that long.`, 'A capsule with a habitat module, a smaller crew or a shorter trip.');
    else if (has.structure && cabin < need) issue('warn', 'science', `The cabin is cramped for ${trip.days} days: ${f1(cabin / c.size)} m³ each, about ${f1(need / c.size)} m³ would be comfortable.`, 'A habitat module, a smaller crew or a shorter trip.');
    if (c.abort === 'none') issue('fail', 'spacecraft', 'No launch escape system: if the rocket fails, the crew goes with it.', 'Fit an escape tower or built-in abort engines (Spacecraft desk).');
    if (c.shield === 'leo') issue('fail', 'spacecraft', 'The heat shield is built for 8 km/s. Coming home from the Moon the capsule hits the air at 11 km/s.', 'Fit the lunar-return heat shield (Spacecraft desk).');
    if (has.launcher && !lv.crewRated) issue('fail', 'director', `${lv.name} is not certified to carry people.`, 'Choose a crew-rated launcher.');
    if (has.computer && !d.redundant) issue('fail', 'spacecraft', 'One computer and no spare: a crewed ship must survive any single failure.', 'Add the spare computer (Spacecraft desk).');
    if (c.shelter === 'none') issue('warn', 'science', `No storm shelter: one large solar storm would give each astronaut about ${SHELTERS.none.stormMsv} mSv through the cabin wall.`, 'Plan at least a stowage shelter (Payload desk).');
    if (c.marginDays < 1) issue('warn', 'science', 'No spare days of air, water and food: any delay on the way home is an emergency.', 'Carry at least two days of margin (Payload desk).');
    crewPlan = {
      callSign: s.crew!.callSign, size: c.size, days: trip.days, moonDays: trip.moonDays, outboundDays: trip.outboundDays, orbit: trip.orbit,
      inMs: trip.inMs, outMs: trip.outMs, supplyDays: trip.days + c.marginDays, marginDays: c.marginDays,
      doseMsv: GCR_MSV_PER_DAY * trip.days + SHELTERS[c.shelter].stormMsv, cabinM3: cabin, cabinNeedM3: need,
      abortSaves: ABORTS[c.abort].saves, shieldOk: c.shield === 'lunar',
    };
  }

  // ---------------------------------------------------------------- launcher
  const destination = { leo: 'low Earth orbit', sso: 'sun-synchronous orbit', gto: 'geostationary transfer orbit', tli: 'the Moon', mars: 'Mars' }[facts.target];
  const fit = (id: LauncherId) => {
    const l = LAUNCHERS[id];
    const why: string[] = [];
    let cap = l.capacityKg[facts.target] ?? 0;
    if ((facts.target === 'leo' || facts.target === 'sso') && cap) cap *= Math.max(0, 1 - (l.altLossPer100Km * (facts.altKm - 500)) / 100);
    if (!s.launchers.includes(id)) why.push(`${l.name} is not offered for this mission.`);
    if (!cap) why.push(`${l.name} cannot send a spacecraft to ${destination}.`);
    let price = l.costM;
    if (l.rideshare) {
      const r = l.rideshare;
      price = Math.max(r.minPriceM, r.pricePerKgM * wetKg);
      if (d.orbit.type !== 'sso' || facts.altKm < r.altKm[0] || facts.altKm > r.altKm[1]) why.push(`A rideshare drops you in a sun-synchronous orbit at ${r.altKm[0]}–${r.altKm[1]} km, not where you planned.`);
      else if (d.orbit.ltanH < r.ltanH[0] || d.orbit.ltanH > r.ltanH[1]) why.push(`Rideshares fly to a late-morning orbit (${r.ltanH[0]}–${r.ltanH[1]} h), not ${f1(d.orbit.ltanH)} h.`);
      if (d.platform === 'medium' || d.platform === 'large') why.push('A spacecraft this big cannot ride as a secondary payload.');
    }
    if (cap && wetKg > cap) why.push(`Too heavy: ${f0(wetKg)} kg, but ${l.name} lifts ${f0(cap)} kg to ${destination}${facts.target === 'sso' || facts.target === 'leo' ? ` at ${f0(facts.altKm)} km` : ''}.`);
    if (Math.max(p.size[0], p.size[1]) > l.fairingM) why.push(`The ${p.short} platform is wider than ${l.name}'s fairing (${f1(l.fairingM)} m).`);
    return { cap, price, why };
  };
  const { cap: capacityKg, price: priceM, why: reasons } = has.launcher ? fit(d.launcher) : { cap: 0, price: 0, why: ['No launcher yet: nothing takes the spacecraft to its orbit.'] };
  for (const r of reasons) issue('fail', 'director', r, has.launcher ? 'Choose another launcher, or make the spacecraft lighter.' : 'Pick a rocket on the Mission desk.', 'mass');
  // a cheaper rocket that could do the same job is money left on the table
  const launchOptions = s.launchers.map((id) => ({ id, ...fit(id) }));
  const cheaper = launchOptions
    .filter((x) => x.id !== d.launcher && x.why.length === 0 && x.price < priceM - 0.05)
    .sort((a, b) => a.price - b.price)[0];
  if (cheaper && reasons.length === 0) issue('info', 'director', `${LAUNCHERS[cheaper.id].name} could launch this spacecraft for $${f1(cheaper.price)}M instead of $${f1(priceM)}M.`);

  // ---------------------------------------------------------------- cost
  const hw: Line[] = [
    { name: 'Platform (structure and integration design)', value: p.costM, desk: 'spacecraft' },
    { name: 'Solar arrays', value: d.arrayM2 * cell.costPerM2M + mount.costM(d.arrayM2), desk: 'spacecraft' },
    { name: 'Battery', value: d.batteryWh * BATTERY_COST_PER_WH_M, desk: 'spacecraft' },
    { name: 'Power electronics', value: has.arrays ? pcduCostM(bolW) : 0, desk: 'spacecraft' },
    { name: d.redundant ? 'Computers (with a spare)' : 'Computer', value: comp.costM * (d.redundant ? 1.6 : 1), desk: 'spacecraft' },
    { name: 'Data storage', value: storageCostM(d.storageGbit), desk: 'comms' },
    { name: 'Attitude control', value: adcs.costM(dryKg), desk: 'spacecraft' },
    { name: 'Propulsion', value: prop.costM, desk: 'spacecraft' },
    { name: 'Antenna and transmitter', value: has.radio ? ant.costM(d.dishM) + transmitterCostM(d.txW) : 0, desk: 'comms' },
    ...ins.map((i): Line => ({ name: i.short, value: i.costM, desk: 'science' })),
    ...crewCost.filter((l) => l.value > 0),
  ];
  const hardware = sum(hw.map((l) => l.value));
  const ait = hardware > 0 ? Math.max(0.1, AIT_COST_FRACTION * hardware) : 0;
  // the test campaign: each test costs a share of the hardware and some weeks
  const plannedTests = applicableTests(d).filter((t) => d.tests.includes(t));
  const skippedTests = applicableTests(d).filter((t) => !d.tests.includes(t));
  const testsM = sum(plannedTests.map((t) => TESTS[t].costShare * hardware));
  const testWeeks = sum(plannedTests.map((t) => TESTS[t].weeks));
  const opsYears = years + transferYears;
  const groundM = deep
    ? (deepStations.length ? Math.max(...deepStations.map((id) => STATIONS[id].costPerHourM ?? 0)) : 0) * d.trackHoursPerDay * 365.25 * opsYears
    : sum(earthStations.map((id) => STATIONS[id].costPerYearM ?? 0)) * opsYears;
  const opsM = s.opsPerYearM * opsYears + (s.opsPerMissionM ?? 0);
  const developmentM = hardware + ait + testsM;
  const reserveM = (d.reservePct / 100) * developmentM;
  const insuranceM = d.insurance ? 0.08 * (developmentM + priceM) : 0;
  const costLines: Line[] = [
    ...hw,
    { name: 'Assembly and integration', value: ait, desk: 'spacecraft' },
    { name: `Test campaign (${plannedTests.length} test${plannedTests.length === 1 ? '' : 's'}, ${f0(testWeeks)} weeks)`, value: testsM, desk: 'director' },
    { name: `Launch (${lv.name})`, value: priceM, desk: 'director' },
    { name: `Ground stations (${f1(opsYears)} years)`, value: groundM, desk: 'comms' },
    { name: trip ? `Mission control, training and recovery (${trip.days} days)` : `Operations team (${f1(opsYears)} years)`, value: opsM, desk: 'director' },
    { name: `Reserve (${f0(d.reservePct)}% of development)`, value: reserveM, desk: 'resources' },
    ...(d.insurance ? [{ name: 'Launch + first-year insurance', value: insuranceM, desk: 'resources' as RoleId }] : []),
  ];
  const totalM = sum(costLines.map((l) => l.value));
  const budgetM = s.budgetM * diff.budget;
  if (d.reservePct < 10 && difficulty !== 'sandbox') issue('warn', 'resources', `A ${f0(d.reservePct)}% reserve is thin: one surprise in development and the mission is over budget.`, 'NASA\'s CubeSat 101 guide asks even a CubeSat team for at least 10%; bigger projects size theirs from their risks (JPL).', 'budget');

  // ---------------------------------------------------------------- time
  const devParts: Line[] = [
    { name: p.name, value: p.devMonths },
    ...ins.map((i) => ({ name: i.short, value: i.devMonths + (i.trl < 7 ? 6 : 0) })),
    { name: comp.name, value: comp.devMonths },
    { name: adcs.name, value: adcs.devMonths },
    { name: prop.name, value: prop.devMonths },
    ...(crewSel ? [{ name: `Life support (${ECLSS[crewSel.eclss].name.toLowerCase()})`, value: ECLSS[crewSel.eclss].devMonths }] : []),
  ];
  const longest = devParts.reduce((a, b) => (b.value > a.value ? b : a));
  const devMonths = longest.value + p.aitMonths + (d.redundant ? 1 : 0) + testWeeks / 4.345;
  let launchMonth = devMonths;
  if (lv.rideshare) launchMonth = Math.ceil(devMonths / 4) * 4;
  if (s.windows) launchMonth = s.windows.find((w) => w >= devMonths) ?? Infinity;
  const deadlineMonth = difficulty === 'sandbox' ? Infinity : s.windows ? s.deadlineMonths : s.deadlineMonths * diff.deadline;
  const aeroDays = d.orbit.type === 'marsLow' && d.orbit.capture === 'aerobrake' ? 180 : 0;
  const serviceMonth = launchMonth + (facts.transferDays + raiseDays + aeroDays) / 30.44 + 1;
  if (launchMonth > deadlineMonth) issue('fail', 'director', s.windows
    ? `Ready after ${f0(devMonths)} months: that misses the launch window at month ${s.deadlineMonths}.`
    : `Ready to launch at month ${f0(launchMonth)}, after the deadline (month ${f0(deadlineMonth)}).`, `The slowest item is ${longest.name} (${f0(longest.value)} months): pick a more mature one.`, 'time');
  if (raiseDays > 0) issue('info', 'spacecraft', `The electric climb to GEO takes ${f0(raiseDays)} days before service can start.`);

  // lifetime: whichever runs out first
  const ballisticEnd = (2.2 * dragArea) / Math.max(1, dryKg + propKg / 2);
  const decayEnd = decayYears(facts.altKm, ballisticEnd);
  const limits: Line[] = [{ name: 'Planned operations', value: years }];
  if (lowEarth && prop.isp === 0) limits.push({ name: 'Orbit decay (no engine to hold altitude)', value: decayEnd });
  if (perYear > 0 && prop.isp > 0) limits.push({ name: 'Propellant', value: Math.max(0, capability - dvFixed) / perYear });
  if (Number.isFinite(batteryLifeYears)) limits.push({ name: 'Battery wear', value: batteryLifeYears });
  // low-orbit instruments by maturity; deep-space and GEO payloads are built for their radiation
  const tolerance = Math.min(has.computer ? comp.toleranceKrad : Infinity, ...ins.map((i) => i.toleranceKrad ?? (i.bodies.includes('earth') ? (i.trl >= 8 ? 60 : 30) : 100)));
  if (Number.isFinite(tolerance)) limits.push({ name: `Radiation (${f1(facts.radKradPerYear)} krad a year)`, value: tolerance / (2 * facts.radKradPerYear) });
  if (bolW > requiredW && cell.degradationPerYear > 0) limits.push({ name: 'Solar cell ageing', value: Math.log(requiredW / bolW) / Math.log(1 - cell.degradationPerYear) - transferYears });
  const lifetimeYears = Math.max(0, Math.min(...limits.map((l) => l.value)));
  const lifeLimiter = limits.reduce((a, b) => (b.value < a.value ? b : a));
  const debrisOk = !(lowEarth && prop.isp === 0 && decayEnd > years + 25);
  if (!debrisOk) issue('warn', 'director', `At ${f0(facts.altKm)} km with no engine the satellite stays in orbit ~${f0(decayEnd)} years: NASA's debris standard asks for re-entry within 25 years of the end of the mission, and without a passing debris assessment there is no radio licence.`, 'Fly lower, or carry propulsion to de-orbit.');
  if (p.cubesat && has.radio && d.txW > CUBESAT_MAX_TX_W) issue('warn', 'comms', `${f0(d.txW)} W is more than CubeSat radios transmit: NASA's small-spacecraft survey finds 0.5–5 W.`, `A CubeSat cannot supply or shed the heat of a bigger amplifier: stay at ${CUBESAT_MAX_TX_W} W or less, and win the rest with the antenna or the ground station.`, 'comms');
  if (lifeLimiter.name.startsWith('Radiation') && lifetimeYears < years) issue('warn', 'spacecraft', `Radiation will wear out the electronics after ~${f1(lifetimeYears)} years.`, 'A radiation-hardened computer lasts much longer.');

  // ---------------------------------------------------------------- requirements
  const candidates = (o: Objective | null) => ins.filter((i) => (o ? (o.value[i.id] ?? 0) >= 0.5 : true));
  const powerFactor = Math.min(1, eolW / requiredW);
  const shortDb = powerFactor < 1 ? -10 * Math.log10(Math.max(powerFactor, 1e-3)) : 0;
  /** Lander → relay data rate at the farthest point of the orbit from a site, through the best relay payload. */
  const proxRate = (site: string, from: Instrument[]) => {
    const g = lunar?.sites[site];
    let best = 0, who = '';
    for (const i of from.filter((x) => x.kind === 'relay')) {
      const lander = s.landers![i.proxBand!];
      const f = BANDS[i.proxBand!].freqHz;
      const gt = dishGainDbi(i.proxDishM!, f) - 10 * Math.log10(300);
      const r = g && Number.isFinite(g.maxRangeM) ? linkRate({ txW: lander.txW, txGainDbi: lander.gainDbi, freqHz: f, rxGtDbK: gt, capMbps: BANDS[i.proxBand!].capMbps, lossDb: 0 }, g.maxRangeM).mbps : 0;
      if (r > best) { best = r; who = i.short; }
    }
    return { best, who, rangeM: g?.maxRangeM ?? 0 };
  };
  const relaySite = reqs.find((r) => r.req.site)?.req.site ?? 'vonKarman';
  const geoCapacity = sum(transponders.map((i) => i.throughputGbps ?? 0)) * powerFactor;
  const geoDemand = Math.max(0, ...reqs.filter((r) => r.req.metric === 'capacity').map((r) => ((d.levels[r.req.id] ?? 'threshold') === 'goal' ? r.req.goal : r.req.threshold)));
  const results: ReqResult[] = reqs.map(({ req, objective: o }) => {
    let value = NaN;
    let why = '';
    const cand = candidates(o);
    switch (req.metric) {
      case 'gsd': {
        let best = Infinity, who = '';
        for (const i of cand) {
          const im = imagerAt(i, altImg);
          if (!im) continue;
          const g = im.gsdM * (adcs.accuracyDeg > i.pointingDeg ? 3 : 1);
          if (g < best) { best = g; who = i.short; }
        }
        value = best;
        why = who ? `${who} from ${f0(altImg)} km gives ${f2(best)} m pixels${adcs.accuracyDeg > (INSTRUMENTS[cand.find((c) => c.short === who)!.id].pointingDeg) ? ' (smeared ×3 by coarse pointing)' : ''}. Lower orbits give sharper pixels.` : 'No instrument on board can make images for this objective.';
        break;
      }
      case 'revisit': {
        const ra = access?.regions[req.region!];
        let best = Infinity, who = '', raw = 0;
        for (const i of cand) {
          const sa = ra?.sensors[i.id];
          if (!sa) continue;
          const eff = sa.revisitDays / (i.cloudLimited ? clearSky : 1);
          if (eff < best) { best = eff; who = i.short; raw = sa.revisitDays; }
        }
        value = best;
        const inst = ins.find((i) => i.short === who);
        // measured skies (Landsat over Angola) also tell the seasons apart
        const seasons = s.clearSkyByMonth ? `: ${f1(raw / CLEAR_RAINY)} in the rainy months (November to March), ${f1(raw / CLEAR_DRY)} in the dry ones (May to August)` : '';
        const clouds = s.clearSkyByMonth ? `Landsat 8 and 9 found ${REGIONS[req.region!].name} clear on ${f0(clearSky * 100)}% of passes over a year (2021 to 2025)` : `clouds clear only ${f0(clearSky * 100)}% of passes`;
        why = who
          ? `${who} can look at a point of ${REGIONS[req.region!].name} every ${f1(raw)} days on average${inst?.cloudLimited ? `; ${clouds}, so a clear look every ${f1(best)} days${seasons}` : ' (radar sees through clouds)'}. A wider swath, agile pointing or an orbit tilted to the target shortens it.`
          : 'No instrument on board can look at this region.';
        break;
      }
      case 'mapped': {
        const ra = access?.regions[req.region!];
        let best = 0, who = '';
        for (const i of cand) {
          const sa = ra?.sensors[i.id];
          if (!sa) continue;
          const c = i.cloudLimited ? clearSky : 1;
          const scale = (req.days ?? access!.days) / access!.days;
          const share = sum(sa.mapPasses.map((m) => 1 - (1 - c) ** (m * scale))) / Math.max(1, sa.mapPasses.length);
          if (share * 100 > best) { best = share * 100; who = i.short; }
        }
        value = best;
        why = who ? `${who}'s ${f0(swathKmAt(ins.find((i) => i.short === who)!, altImg))} km swath, straight down, covers ${f0(best)}% of ${REGIONS[req.region!].name} cloud-free in ${req.days} days.` : 'No instrument on board can map this region.';
        break;
      }
      case 'latency': {
        const ra = access?.regions[req.region!];
        const backlog = generated > capacityDay && capacityDay > 0 ? generated / capacityDay : 1;
        value = ra ? ra.latencyH * backlog : Infinity;
        why = earthStations.length
          ? `After passing over ${REGIONS[req.region!].name}, the next contact with ${stationName} comes ${f1(value)} hours later on average${backlog > 1 ? ' (slowed by a data backlog)' : ''}. A station near the target cuts this.`
          : 'No ground station to send the data to.';
        break;
      }
      case 'lifetime':
        value = lifetimeYears;
        why = `Limited by ${lifeLimiter.name.toLowerCase()}: ${f1(lifetimeYears)} years.`;
        break;
      case 'capacity': {
        value = geoCapacity;
        why = `${transponders.map((i) => `${i.short} ${f2(i.throughputGbps!)} Gbps`).join(' + ') || 'No transponders'}${powerFactor < 1 ? `, but only ${f0(powerFactor * 100)}% can be powered` : ''}.`;
        break;
      }
      case 'availability': {
        let best = 0, who = '';
        for (const i of cand.filter((x) => x.commsBand)) {
          const a = availabilityPct(i.commsBand!, (i.marginDb ?? 0) - shortDb);
          if (a > best) { best = a; who = i.short; }
        }
        value = best;
        why = who ? `${who} has ${f1(ins.find((i) => i.short === who)!.marginDb! - shortDb)} dB to spare against rain: the link drops ${f2((100 - best) * 87.66)} hours a year in tropical storms.` : 'No transponder for this service.';
        break;
      }
      case 'service': {
        let best = 0, who = '';
        for (const i of cand.filter((x) => x.beamCover)) {
          const v = geoService(d.orbit.lonDeg, req.region!) * (i.beamCover![req.region!] ?? 0);
          if (v > best) { best = v; who = i.short; }
        }
        value = best * 100;
        why = who ? `From ${f0(d.orbit.lonDeg)}° E, ${who}'s beams reach ${f0(value)}% of ${REGIONS[req.region!].name} at least 20° above the horizon.` : 'No transponder covers this region.';
        break;
      }
      case 'relayCoverage': {
        const g = lunar?.sites[req.site!];
        value = g && relays.length ? g.relayed * trackShare * 100 : 0;
        why = !relays.length ? 'No relay payload on board.' : g ? `${LUNAR_SITES[req.site!].name} sees the relay ${f0(g.seen * 100)}% of the time, with Earth in view too ${f0(g.relayed * 100)}%; ground antennas listen ${f0(d.trackHoursPerDay)} h a day.` : 'Not in a lunar orbit.';
        break;
      }
      case 'relayRate': {
        const { best, who, rangeM } = proxRate(req.site!, cand);
        value = Math.min(best, rateWorst);
        why = who ? `Lander → relay ${f2(best)} Mbps at ${f0(rangeM / 1000)} km (${who}), relay → Earth ${f2(rateWorst)} Mbps: the chain runs at the slower.` : 'No relay payload for this objective.';
        break;
      }
      case 'quiet':
        value = lunar ? lunar.quiet * 100 : 0;
        why = lunar ? `Earth is hidden behind the Moon ${f0(value)}% of the time in this orbit.` : 'Not in a lunar orbit.';
        break;
      case 'marsMapped': {
        let best = 0, who = '';
        const area = regionArea(REGIONS.mars, body.radius);
        for (const i of cand.filter((x) => x.swathKm)) {
          const u = uses.find((x) => x.id === i.id)!;
          const rate = u.rateMbps * 1e6;
          if (!rate) continue;
          const seconds = (Math.min(missionTbit, missionTbitCapacity) * 1e12 * (u.gbitPerDay / Math.max(generated, 1e-9))) / rate;
          const covered = 1 - Math.exp(-(seconds * groundSpeed(body, altImg) * swathKmAt(i, altImg) * 1000) / area);
          if (covered * 100 > best) { best = covered * 100; who = i.short; }
        }
        value = best;
        why = who ? `${who} can map ${f1(best)}% of Mars with the data the link brings home (${f1(missionTbit)} Tbit over the mission). More downlink means more map.` : 'No mapping instrument for this objective.';
        break;
      }
      case 'dataReturn':
        value = missionTbit;
        why = `${f1(missionTbit)} Tbit over ${f1(years)} years: ${f2(rateTyp)} Mbps at typical distance, ${f0(d.trackHoursPerDay)} h of antenna time a day${s.body === 'mars' ? ', none around solar conjunction' : ''}.`;
        break;
      case 'launchMonth':
        value = launchMonth;
        why = `Development takes ${f0(devMonths)} months (slowest: ${longest.name}); the first window after that is month ${f0(launchMonth)}.`;
        break;
      case 'altitude':
        value = facts.altKm;
        why = `The orbit's low point is ${f0(facts.altKm)} km.`;
        break;
      case 'crewDose':
        value = crewPlan ? crewPlan.doseMsv : NaN;
        why = crewPlan && crewSel ? `${f0(GCR_MSV_PER_DAY * crewPlan.days)} mSv of cosmic rays in ${crewPlan.days} days, plus ${SHELTERS[crewSel.shelter].stormMsv} mSv if a large solar storm hits (${SHELTERS[crewSel.shelter].name.toLowerCase()}). A shorter trip or a better shelter lowers it.` : 'Nobody on board.';
        break;
      case 'supplies':
        value = crewPlan ? crewPlan.marginDays : NaN;
        why = crewPlan ? `Supplies for ${crewPlan.supplyDays} days on a ${crewPlan.days}-day trip. Each spare day weighs ${f0(ECLSS[crewSel!.eclss].kgPerCrewDay * crewPlan.size)} kg.` : 'Nobody on board.';
        break;
      case 'moonDays':
        value = trip ? trip.moonDays : NaN;
        why = trip ? `${ORBIT_TYPES[d.orbit.type].name}: ${trip.moonDays} day${trip.moonDays === 1 ? '' : 's'} near the Moon in a ${trip.days}-day flight.` : '';
        break;
      case 'downlink': {
        const laser = d.instruments.includes('o2o');
        value = Math.max(rateWorst, laser ? 80 : 0);
        why = laser ? `The laser terminal sends 80 Mbps when the sky over the ground telescope is clear; the radio carries ${f2(rateWorst)} Mbps the rest of the time.` : `The radio carries ${f2(rateWorst)} Mbps from the Moon. A bigger dish, more power or a laser terminal raises it.`;
        break;
      }
      case 'crewSize':
        value = crewPlan ? crewPlan.size : NaN;
        why = crewPlan ? `${crewPlan.size} astronauts on board.` : '';
        break;
    }
    const ok = (v: number, x: number) => (req.better === 'lower' ? v <= x : v >= x);
    const met: ReqResult['met'] = Number.isNaN(value) ? 'fail' : ok(value, req.goal) ? 'goal' : ok(value, req.threshold) ? 'threshold' : 'fail';
    const shown = req.unit === '%' && value >= 99 && value < 100 ? value.toFixed(2) : f2(value);
    const display = Number.isFinite(value) ? `${shown} ${req.unit}` : req.better === 'lower' ? `> ${req.threshold} ${req.unit}` : `0 ${req.unit}`;
    return { req, objective: o, level: d.levels[req.id] ?? 'threshold', value, met, display, why };
  });

  // ---------------------------------------------------------------- predicted value of each objective
  const value: Record<string, number> = {};
  for (const id of [d.primary, ...d.secondary]) {
    const o = s.objectives.find((x) => x.id === id);
    if (!o) continue;
    const vals = ins.map((i) => o.value[i.id] ?? 0).sort((a, b) => b - a);
    const usefulness = Math.min(1, (vals[0] ?? 0) + 0.25 * (vals[1] ?? 0) + 0.1 * (vals[2] ?? 0));
    const rs = results.filter((r) => r.objective === o);
    const reqScore = rs.length ? sum(rs.map((r) => (r.met === 'goal' ? 1 : r.met === 'threshold' ? 0.7 : 0))) / rs.length : 1;
    // deep-space missions plan their imaging to fit the link; low orbit loses what does not fit
    const delivered = transponders.length ? powerFactor : deep ? 1 : deliveredShare;
    value[id] = usefulness * (0.3 + 0.7 * reqScore) * delivered;
  }

  // ---------------------------------------------------------------- the six resources
  const massLimit = Math.min(p.maxMassKg, capacityKg || Infinity);
  const limitBy: 'platform' | 'launcher' = capacityKg && capacityKg < p.maxMassKg ? 'launcher' : 'platform';
  const massMargin = massLimit > 0 ? (massLimit - wetKg) / massLimit : 0;
  const critical = new Set(s.critical);
  const res = (id: ResourceId, v: number, limit: number, marginPct: number, status: Status, headline: string, why: string): ResourceSummary => ({
    id, name: RESOURCES[id].name, value: v, limit, unit: RESOURCES[id].unit, marginPct, status, headline, why, critical: critical.has(id), problems: [],
  });
  const thin = difficulty === 'expert' ? 10 : 5;
  const relayProx = relays.length ? proxRate(relaySite, relays).best : 0;
  const resources: Record<ResourceId, ResourceSummary> = {
    mass: !has.structure ? res('mass', wetKg, 0, 0, 'fail', 'Nothing built yet', 'The platform you pick sets how much the spacecraft may weigh, and the launcher how much can be lifted.') : res('mass', wetKg, massLimit, massMargin * 100,
      massMargin < 0 || reasons.length ? 'fail' : massMargin * 100 < thin ? 'warn' : cheaper ? 'over' : 'good',
      `${f0(wetKg)} / ${f0(massLimit)} kg`,
      `Dry ${f0(dryKg)} kg (payload ${f0(payloadKg)} kg) + ${f0(propKg)} kg of propellant for ${f0(totalDv)} m/s. The limit is set by the ${limitBy === 'launcher' ? `${lv.name}'s lift to this orbit` : `${p.short} platform`}.${cheaper ? ` ${LAUNCHERS[cheaper.id].name} could launch it for $${f1(cheaper.price)}M.` : ''}`),
    power: !has.arrays ? res('power', requiredW, 0, -100, 'fail', `No solar arrays yet · ${f0(requiredW)} W needed`, 'Nothing makes electricity yet. The arrays must cover what the spacecraft uses and recharge the battery after every shadow.') : res('power', requiredW, eolW, powerMargin * 100,
      powerMargin < 0 || dod > 1 ? 'fail' : powerMargin < 0.1 || dod > dodAllowed + 1e-9 ? 'warn' : powerMargin > 0.8 ? 'over' : 'good',
      `${f0(eolW)} W made · ${f0(requiredW)} W needed`,
      `${f1(d.arrayM2)} m² of ${cell.name.toLowerCase()} cells (${mount.name.toLowerCase()}) make ${f0(bolW)} W in sunlight, ${f0(eolW)} W after ${f1(years + transferYears)} years of ageing${facts.sunFactor < 0.9 ? `, with only ${f0(facts.sunFactor * 100)}% of Earth's sunlight` : ''}. The spacecraft uses ${f0(loadW)} W on average${te > 0 ? ` and must also recharge the battery after up to ${f0(te)} minutes of shadow each orbit` : ''}. Battery: ${f0(d.batteryWh)} Wh, ${f0(dod * 100)}% used per eclipse.`),
    budget: res('budget', totalM, budgetM, ((budgetM - totalM) / budgetM) * 100,
      totalM > budgetM ? 'fail' : (budgetM - totalM) / budgetM * 100 < thin ? 'warn' : 'good',
      `$${f1(totalM)}M / $${f0(budgetM)}M`,
      `Development $${f1(developmentM)}M (hardware $${f1(hardware)}M + integration and test), launch $${f1(priceM)}M, ground and operations $${f1(groundM + opsM)}M over ${f1(opsYears)} years, reserve $${f1(reserveM)}M${d.insurance ? `, insurance $${f1(insuranceM)}M` : ''}.`),
    data: transponders.length
      ? res('data', geoDemand, geoCapacity, geoDemand > 0 ? ((geoCapacity - geoDemand) / geoDemand) * 100 : 100,
        geoCapacity < geoDemand ? 'fail' : powerFactor < 1 ? 'warn' : 'good',
        `${f2(geoCapacity)} Gbps of capacity`,
        `A communications satellite relays its customers' data straight through: its "data" is the capacity of its transponders (${f2(geoDemand)} Gbps asked for), if the arrays can power them all.`)
      : generated === 0 && relays.length
      ? res('data', relayProx, rateWorst, relayProx > 0 ? ((rateWorst - relayProx) / relayProx) * 100 : -100,
        relayProx <= 0 ? 'fail' : rateWorst < relayProx ? 'warn' : 'good',
        `${f2(relayProx)} Mbps from landers · ${f2(rateWorst)} Mbps to Earth`,
        `A relay passes landers' data on: they reach it at ${f2(relayProx)} Mbps at the farthest point, and it sends to Earth at ${f2(rateWorst)} Mbps. The slower link sets the pace.`)
      : res('data', generated, capacityDay, capacityDay > 0 ? ((capacityDay - generated) / Math.max(generated, 1e-9)) * 100 : -100,
        generated === 0 && !relays.length ? 'warn' : deep ? (capacityDay <= 0 ? 'fail' : dataLimited ? 'warn' : 'good') : lossPct > 10 ? 'fail' : lossPct > 0.5 || storageFactor < 1 ? 'warn' : 'good',
        `${f1(generated)} Gbit/day made · ${f1(capacityDay)} Gbit/day sent`,
        `The instruments make ${f1(generated)} Gbit a day; the link can send ${f1(capacityDay)} Gbit a day${access ? ` in ${f0(contactMin)} minutes of passes` : ''}.${lossPct > 0.5 ? ` ${f0(lossPct)}% is lost.` : ''}${dataLimited ? ' The instruments could take more than the link can send: they image only what fits.' : ''} Storage ${f0(d.storageGbit)} Gbit (${f0(storageNeed)} Gbit needed between contacts).`),
    comms: res('comms', rateTyp, band.capMbps, Number.isFinite(marginDb) ? marginDb : -100,
      rateTyp <= 0 || d.stations.length === 0 ? 'fail' : marginDb < 0 ? 'warn' : 'good',
      `${f2(rateTyp)} Mbps · ${f0(contactMin)} min/day`,
      `${band.name} with ${d.antenna === 'dish' ? `a ${f1(d.dishM)} m dish (${f1(txGain)} dBi)` : `a ${ant.name.toLowerCase()} (${f0(txGain)} dBi)`} and ${f0(d.txW)} W, heard by ${stationName}: ${f2(rateTyp)} Mbps typical, ${f2(rateWorst)} Mbps at ${f0(rangeKm)} km.${lightTime > 1 ? ` Signals take ${f1(lightTime / 60)} minutes each way.` : ''}`),
    time: !has.structure ? res('time', 0, deadlineMonth, 100, 'warn', Number.isFinite(deadlineMonth) ? `Nothing to build yet · launch by month ${f0(deadlineMonth)}` : 'Nothing to build yet', 'The slowest part to build sets the schedule, then assembly and the tests you plan.') : res('time', launchMonth, deadlineMonth, Number.isFinite(deadlineMonth) ? ((deadlineMonth - launchMonth) / deadlineMonth) * 100 : 100,
      launchMonth > deadlineMonth ? 'fail' : lifetimeYears < years * 0.999 ? 'warn' : deadlineMonth - launchMonth < 2 ? 'warn' : 'good',
      trip ? `Launch month ${f0(launchMonth)} / ${f0(deadlineMonth)} · ${trip.days}-day flight` : `Launch month ${f0(launchMonth)} / ${f0(deadlineMonth)} · ${f1(lifetimeYears)} yr life`,
      `Build ${f0(devMonths)} months (slowest: ${longest.name}), launch at month ${f0(launchMonth)}${s.windows ? ' (launch window)' : ''}, in service from month ${f0(serviceMonth)}. Lifetime ${f1(lifetimeYears)} years, limited by ${lifeLimiter.name.toLowerCase()}.`),
  };
  // tests left out: a risk the team chooses, said once per test
  if (has.structure && difficulty !== 'sandbox') for (const t of skippedTests) issue('warn', TESTS[t].role, `No ${TESTS[t].name.toLowerCase()} planned. It would catch: ${TESTS[t].catches.charAt(0).toLowerCase()}${TESTS[t].catches.slice(1)}`, `Add it to the test campaign on the Mission desk (${TESTS[t].weeks} week${TESTS[t].weeks === 1 ? '' : 's'}).`);
  const needsEngine = totalDv > 0 && !lowEarth;
  const build: BuildItem[] = [
    { id: 'structure', label: 'Structure', role: 'spacecraft', done: has.structure, hint: 'Pick a platform: the body every other part bolts to.' },
    { id: 'power', label: 'Solar arrays', role: 'spacecraft', done: has.arrays, hint: 'Add solar arrays: they make the electricity.' },
    { id: 'battery', label: 'Battery', role: 'spacecraft', done: has.battery, hint: 'Add a battery: it carries the spacecraft through every shadow.' },
    { id: 'computer', label: 'Computer', role: 'spacecraft', done: has.computer, hint: 'Pick the onboard computer.' },
    { id: 'pointing', label: 'Pointing', role: 'spacecraft', done: has.adcs, hint: 'Pick how the spacecraft points itself.' },
    ...(needsEngine ? [{ id: 'engine', label: 'Engine', role: 'spacecraft' as RoleId, done: prop.isp > 0, hint: 'This mission needs an engine to brake into its orbit.' }] : []),
    { id: 'payload', label: 'Payload', role: 'science', done: ins.length > 0, hint: 'Pick the instruments that do the customer\'s job.' },
    { id: 'radio', label: 'Radio', role: 'comms', done: has.radio && has.storage, hint: 'Pick an antenna and the onboard storage.' },
    { id: 'station', label: 'Ground station', role: 'comms', done: d.stations.length > 0, hint: 'Pick who listens on the ground.' },
    { id: 'launcher', label: 'Launcher', role: 'director', done: has.launcher, hint: 'Pick the rocket.' },
    ...(crewSel ? [
      { id: 'escape', label: 'Escape system', role: 'spacecraft' as RoleId, done: crewSel.abort !== 'none', optional: true, hint: 'A way off a failing rocket.' },
      { id: 'shield', label: 'Lunar heat shield', role: 'spacecraft' as RoleId, done: crewSel.shield === 'lunar', optional: true, hint: 'The return from the Moon is at 11 km/s.' },
    ] : []),
    { id: 'tests', label: 'Test plan', role: 'director', done: plannedTests.length > 0, optional: true, hint: 'Decide which ground tests to run before launch.' },
  ];
  // ---------------------------------------------------------------- sweet spots: too little, just right, more than needed
  const pct = (x: number) => `${x >= 0 ? '+' : ''}${f0(x)}%`;
  const spareData = generated > 0 ? ((capacityDay - generated) / generated) * 100 : 0;
  const slack = deadlineMonth - launchMonth;
  if (has.structure) resources.mass.gauge = gaugeOf(massMargin * 100, thin, 40, -30, 100, {
    label: 'Lift to spare', value: pct(massMargin * 100), ideal: `${thin}–40%`,
    under: 'Too heavy: the rocket or the platform cannot carry it, or there is no room left for the mass that every project gains while it is built.',
    over: 'You are paying for lift you do not use. A smaller rocket or platform would be cheaper, or the spare kilograms could carry another instrument.',
    source: "JPL keeps at least 35% of the dry mass as growth allowance and margin when a concept becomes a point design (Concept Maturity Level 4), because every spacecraft gains mass while it is built. NASA's handbook says margins are allocated early and used up on the way to launch. The lower end here is this game's rule.",
  });
  if (has.arrays) resources.power.gauge = gaugeOf(powerMargin * 100, 10, 50, -50, 150, {
    label: 'Power to spare', value: pct(powerMargin * 100), ideal: '10–50%',
    source: "JPL asks a point design for at least 35% power and 35% energy margin (Concept Maturity Level 4); the arrays and battery also lose capacity as they age, which this game already counts. The 10% floor is this game's rule for the end of the mission.",
    under: 'Not enough power: instruments switch off and the battery never fully recharges after a shadow.',
    over: 'Extra power is not free. Every square metre of array is mass the rocket lifts and money not spent on instruments; big wings also catch more air drag in low orbit and are harder to hold steady. Engineers aim for a modest margin, not the biggest array.',
  });
  if (Number.isFinite(budgetM)) resources.budget.gauge = gaugeOf(((budgetM - totalM) / budgetM) * 100, 0, 15, -40, 60, {
    label: 'Budget left', value: pct(((budgetM - totalM) / budgetM) * 100), ideal: '0–15%',
    source: "This is money left after the reserve, which is already in the cost. NASA's CubeSat 101 asks even a CubeSat team to hold a reserve of at least 10%; bigger projects set theirs from their risks (JPL). The range itself is this game's rule.",
    under: 'Over budget: the customer cannot pay for this design.',
    over: 'Money left over is mission you did not buy: a better instrument, a goal-level requirement, more tests or a bigger reserve.',
  });
  if (!transponders.length && !(generated === 0 && relays.length) && generated > 0 && capacityDay > 0) resources.data.gauge = gaugeOf(spareData, 0, 100, -100, 500, {
    label: 'Downlink to spare', value: spareData >= 1000 ? `${f0(capacityDay / generated)}× needed` : pct(spareData), ideal: '0–100%',
    source: "This game's rule. JPL sizes the data system at the point-design stage from the quantity, quality, continuity and latency the science needs.",
    under: 'The instruments make more than the link can send: the rest is lost, or never taken.',
    over: 'The link is far bigger than the instruments need. Transmitter power, antenna size and ground-station time are being paid for and not used.',
  });
  if (rateTyp > 0 && Number.isFinite(marginDb)) resources.comms.gauge = gaugeOf(marginDb, 3, 10, -10, 30, {
    label: 'Signal to spare', value: `${marginDb >= 0 ? '+' : ''}${f1(marginDb)} dB`, ideal: '3–10 dB',
    source: "JPL asks for at least 3 dB of link margin on deep-space links and 6 dB on short proximity links (Concept Maturity Level 4). The 10 dB upper end is this game's rule.",
    under: 'The signal arrives too weak at the farthest point: errors, or no link at all when it rains.',
    over: 'More signal than needed. A smaller transmitter or antenna would save power and mass, or the same link could carry a faster data rate.',
  });
  if (has.structure && Number.isFinite(deadlineMonth)) resources.time.gauge = gaugeOf(slack, 2, 8, -12, 24, {
    label: 'Schedule to spare', value: `${slack >= 0 ? '+' : ''}${f0(slack)} months`, ideal: '2–8 months',
    source: "This game's rule. NASA's CubeSat 101 says to pad the build schedule generously: the launcher never waits for a late CubeSat, and a typical one takes 18–24 months.",
    under: slack < 0 ? 'Late: the launch comes after the deadline.' : 'No room for a late part or a failed test.',
    over: 'A lot of slack: there was time for a more capable instrument, or for more tests.',
  });
  // ---------------------------------------------------------------- each resource in a few words: what is wrong, and why it matters (the dashboard's notes)
  const P = (title: string, why: string, tag?: string): Problem => ({ title, why, tag });
  const zone = (r: ResourceSummary, under: Problem, over: Problem): Problem[] => (r.gauge?.zone === 'under' ? [under] : r.gauge?.zone === 'over' ? [over] : []);
  resources.mass.problems = !has.structure
    ? [P('No structure added', 'Every part bolts onto it, and it sets how much the spacecraft may weigh.', 'Not built')]
    : [
      // a missing or wrong rocket fails the mass check even when the platform could carry it
      ...(!has.launcher
        ? [P('No launcher chosen', 'Nothing can take the spacecraft to orbit yet, so its mass cannot be checked against a rocket.', 'No launcher')]
        : reasons.filter((x) => !x.startsWith('Too heavy')).map((x) => P('The launcher does not fit', x, 'Launcher'))),
      ...(!has.launcher && massMargin >= 0 ? [] : zone(resources.mass,
        massMargin < 0 ? P('Too heavy', `${f0(wetKg)} kg is more than the ${limitBy === 'launcher' ? `${lv.name} can lift to this orbit` : `${p.short} platform can carry`} (${f0(massLimit)} kg).`) : P('Too little mass to spare', 'Every spacecraft gains weight while it is built: with this little to spare it will end up too heavy.'),
        P('Too much spare lift', 'The spare kilograms could carry another instrument, or a smaller platform or rocket would cost less.'))),
      ...(cheaper && !reasons.length && resources.mass.gauge?.zone !== 'over' ? [P('A cheaper rocket would do', `${LAUNCHERS[cheaper.id].name} could launch it for $${f1(cheaper.price)}M instead of $${f1(priceM)}M.`)] : []),
    ];
  resources.power.problems = !has.arrays
    ? [P('No solar arrays added', 'Nothing makes electricity.', 'Not built')]
    : [
      ...(!has.battery ? [P('No battery added', te > 0 ? `Nothing keeps the spacecraft alive in each ${f0(te)}-minute shadow.` : 'Nothing keeps it alive if it loses the Sun.', 'No battery')]
        : dod > 1 ? [P('Battery too small', `It runs flat in every ${f0(te)}-minute shadow.`, 'Battery')]
        : dod > dodAllowed + 1e-9 ? [P('Battery drains too deep', `Each shadow uses ${f0(dod * 100)}% of it, so it wears out after ${f1(batteryLifeYears)} years.`, 'Battery')] : []),
      ...zone(resources.power,
        powerMargin < 0 ? P('Too little power', 'The arrays cannot cover what the spacecraft uses: instruments switch off.') : P('Too little power to spare', 'The arrays wear out: with this little to spare it runs short before the end.'),
        P('Too much power', 'The extra array is mass, cost and drag that nothing uses.')),
    ];
  resources.budget.problems = zone(resources.budget,
    P('Over budget', `It costs $${f1(totalM)}M; the customer has $${f0(budgetM)}M.`),
    P('Too much money left', 'Unspent money is mission you did not buy: a better instrument, a goal or more tests.'))
    .filter((x) => has.structure || x.title !== 'Too much money left');
  if (!resources.budget.problems.length && resources.budget.status === 'warn') resources.budget.problems = [P('Little money to spare', 'One surprise and the mission is over budget.')];
  const lost = !deep && lossPct > 0.5;
  resources.data.problems = transponders.length
    ? [
      ...(geoCapacity < geoDemand ? [P('Too little capacity', `The transponders carry ${f2(geoCapacity)} Gbps; customers want ${f2(geoDemand)} Gbps.`, 'Capacity')] : []),
      ...(powerFactor < 1 ? [P('Not enough power for every transponder', 'Some of them have to stay off.', 'Power')] : []),
    ]
    : generated === 0 && relays.length
    ? relayProx <= 0 ? [P('Cannot hear the landers', "The relay's radio does not reach them.", 'No link')]
      : rateWorst < relayProx ? [P('Link to Earth too slow', 'The landers send faster than the relay can pass on.', 'Slow link')] : []
    : generated === 0
    ? [P('No instruments added', 'Nothing makes data yet.', 'None')]
    : !has.storage
    ? [P('No storage added', 'Nothing holds the data between passes.', 'No storage')]
    : [
      ...(deep && capacityDay <= 0 ? [P('No link home', 'Nothing can send the data back to Earth.', 'No link')] : []),
      ...(dataLimited ? [P('The link limits the science', 'The instruments could take more than the link can send.', 'Link')] : []),
      ...(lost ? [P(`${f0(lossPct)}% of the data is lost`, capacityDay < generated ? 'The link cannot send it all.' : 'Storage fills up between passes and older data is overwritten.', `${f0(lossPct)}% lost`)]
        : zone(resources.data, P('Too little downlink', 'The instruments make more than the link can send.'), P('Too much downlink', 'Transmitter power, antenna and station time are paid for and not used.'))),
      ...(!lost && storageFactor < 1 ? [P('Storage too small', 'Some data is overwritten before it can be sent.', 'Storage')] : []),
    ];
  resources.comms.problems = !has.radio
    ? [P('No radio added', 'Nothing can talk to the ground.', 'No radio')]
    : d.stations.length === 0
    ? [P(deep ? 'No deep-space antenna' : 'No ground station', 'Nobody on the ground is listening.', 'No station')]
    : rateTyp <= 0
    ? [P('No link', 'The signal is too weak to carry any data.', 'No link')]
    : zone(resources.comms,
      marginDb < 0 ? P('Signal too weak', 'At the farthest point the link drops out, more often in rain.') : P('Too little signal to spare', 'Rain or a low pass can break the link.'),
      P('Too much signal', 'A smaller transmitter or antenna would save power and mass.'));
  resources.time.problems = !has.structure
    ? [P('Nothing to build yet', 'The slowest part sets when you can launch.', 'Not built')]
    : [
      ...(launchMonth > deadlineMonth ? [P('Too late', `Launch at month ${f0(launchMonth)}, after the deadline at month ${f0(deadlineMonth)}.`, 'Late')]
        : zone(resources.time, P('Too little time to spare', 'A late part or a failed test would miss the launch.'), P('Too much time to spare', 'There was time for a better instrument or more tests.'))),
      ...(lifetimeYears < years * 0.999 ? [P('Does not last the planned years', `It lasts ${f1(lifetimeYears)} years, limited by ${lifeLimiter.name.toLowerCase()}.`, 'Lifetime')] : []),
    ];
  // a warning or a failure always says what it is
  for (const r of Object.values(resources)) if (!r.problems.length && (r.status === 'warn' || r.status === 'fail')) r.problems = [P(r.headline, r.why)];

  if (totalM > budgetM) issue('fail', 'resources', `$${f1(totalM)}M is over the $${f0(budgetM)}M budget.`, 'Cheaper parts, a smaller launcher, fewer years of operations, or a smaller reserve.', 'budget');
  if (!transponders.length && !deep && lossPct > 0.5 && has.radio && has.storage && d.stations.length > 0) issue(lossPct > 10 ? 'fail' : 'warn', 'comms', `${f0(lossPct)}% of the data never reaches the ground.`, capacityDay < generated ? 'A faster band, more transmitter power, a better antenna or more ground stations.' : 'More onboard storage to hold data between passes.', 'data');
  if (!has.arrays) issue('fail', 'spacecraft', 'No solar arrays yet: nothing makes electricity.', 'Add solar arrays on the Spacecraft desk.', 'power');
  else if (powerMargin < 0) issue('fail', 'spacecraft', `The arrays make ${f0(eolW)} W by the end of the mission; the spacecraft needs ${f0(requiredW)} W.`, `About ${f2(requiredW / perM2 / Math.pow(1 - cell.degradationPerYear, years + transferYears))} m² of arrays would just do; add 10–40% for margin ("Size it for me").`, 'power');

  return {
    scenario: s, design: d, difficulty, orbit: facts, access, lunar,
    dv: { lines: dvLines, totalMs: totalDv, perYearMs: perYear, capabilityMs: capability },
    mass: { lines: [...massLines, { name: 'Propellant', value: propKg, desk: 'director' as RoleId }], dryKg, propellantKg: propKg, wetKg, payloadKg, limitKg: massLimit, limitBy, marginPct: massMargin * 100 },
    power: { bolW, eolW, requiredW, loadW, lines: loadLines, marginPct: powerMargin * 100, pointing, perM2W: perM2, ageing: (1 - cell.degradationPerYear) ** (years + transferYears), eclipseWh, batteryNeedWh, dod, dodAllowed, batteryLifeYears, maxArrayM2 },
    cost: { lines: costLines, developmentM, launchM: priceM, operationsM: groundM + opsM, reserveM, totalM, budgetM, marginPct: ((budgetM - totalM) / budgetM) * 100 },
    data: { instruments: uses, generatedGbitDay: generated, capacityGbitDay: capacityDay, deliveredGbitDay: deliveredDay, lossPct, storageNeedGbit: storageNeed, latencyH: access ? Math.min(...regionsNeeded.map((r) => access!.regions[r]!.latencyH)) : (24 - d.trackHoursPerDay) / 2 + lightTime / 3600, missionTbit, dataLimited },
    comms: { rateMbps: rateTyp, worstMbps: rateWorst, marginDb, contactMinPerDay: contactMin, passesPerDay: passes, rangeKm, lightTimeS: lightTime, station: stationName },
    debris: { lowEarth, reentryYears: lowEarth && prop.isp === 0 ? decayEnd : 0, ruleOk: debrisOk },
    time: { devMonths, longest: longest.name, launchMonth, deadlineMonth, serviceMonth, lifetimeYears, limits, raiseDays },
    launch: { ok: reasons.length === 0, capacityKg, priceM, reasons, options: launchOptions },
    requirements: results,
    resources,
    issues,
    value,
    build,
    tests: { planned: plannedTests, skipped: skippedTests, weeks: testWeeks, costM: testsM },
    crew: crewPlan,
  };
}
