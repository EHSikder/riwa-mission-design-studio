/**
 * Flying the mission (docs/03 §6). From the design's analysis, a seeded run goes through development (late
 * parts, test failures, cost growth), the launch (the rocket's track record), deployment (wings and dish), and
 * operations day by day: power from ageing cells, a battery worn by every eclipse, data made, sent, stored
 * or lost, radiation dose, propellant, orbit decay and component failures. Events pause the run for a decision
 * with honest trade-offs; every choice is remembered and judged in the report. Same seed + same choices =
 * the same mission, so a team can replay and compare.
 */
import { createRng, type Rng } from './rng';
import type { Analysis } from './analyze';
import { ADCS, CELLS, COMPUTERS, LAUNCHERS, PROPULSION, STATIONS, batteryCycleLife } from './catalog';
import { DIFFICULTY } from './design';
import { INSTRUMENTS, type InstrumentId } from './instruments';
import { earthMarsGeometry } from './access';
import { MARS_YEAR_DAYS } from './types';

export type SimPhase = 'development' | 'cruise' | 'operations' | 'ended';

export interface EventOption {
  id: string;
  label: string;
  explain: string;
}

export interface SimEvent {
  id: string;
  /** Project month (development) or day of operations. */
  when: string;
  t: number;
  title: string;
  text: string;
  kind: 'decision' | 'failure' | 'info' | 'milestone' | 'good';
  options?: EventOption[];
  chosen?: string;
  outcome?: string;
  /** How sound the choice was, 0–1 (for the decision score); judged with what the team knew. */
  quality?: number;
  lesson?: string;
}

export interface SimSample {
  day: number;
  /** Battery charge left at the end of the worst eclipse (%), array power (W), data waiting on board (Gbit). */
  soc: number;
  powerW: number;
  backlogGbit: number;
  deliveredGbit: number;
  value: number;
  spentM: number;
}

export interface SimState {
  phase: SimPhase;
  month: number;
  day: number;
  /** Days since launch (cruise included): operations are paid from launch on. */
  elapsedDays: number;
  launchMonth: number;
  alive: boolean;
  endReason: string | null;
  safeDays: number;
  outageDays: number;
  outageShare: number;
  arrayFactor: number;
  batteryHealth: number;
  dishOk: boolean;
  smear: number;
  agility: boolean;
  spareComputer: boolean;
  health: Partial<Record<InstrumentId, number>>;
  dvLeft: number;
  backlogGbit: number;
  deliveredGbit: number;
  lostGbit: number;
  expectedGbit: number;
  value: Record<string, number>;
  bonus: Record<string, number>;
  extraM: number;
  revenueM: number;
  doseKrad: number;
  scienceDays: number;
  downDays: number;
  hiddenRisk: number;
  batteryWarned: boolean;
  radiationWarned: boolean;
}

interface Spec {
  id: string;
  title: string;
  phase: 'development' | 'operations';
  applies: (a: Analysis) => boolean;
  /** Development: chance it happens at all. Operations: expected number a year. */
  rate: (a: Analysis, st: SimState) => number;
  text: (a: Analysis, st: SimState) => string;
  options?: (a: Analysis, st: SimState) => (EventOption & { quality: number })[];
  resolve: (r: MissionRun, option: string | undefined) => string;
  lesson: string;
  kind?: SimEvent['kind'];
}

const pick = <T,>(rng: Rng, xs: T[]): T => xs[Math.floor(rng.next() * xs.length) % xs.length];
const lowEarthOf = (a: Analysis) => a.scenario.body === 'earth' && a.design.orbit.type !== 'geo';

const EVENTS: Spec[] = [
  // ------------------------------------------------------------------ development
  {
    id: 'late-part', title: 'A supplier is late', phase: 'development',
    applies: () => true,
    rate: () => 0.55,
    text: (a) => `The ${a.time.longest} will arrive about 3 months late. The rest of the spacecraft is waiting for it.`,
    options: (a) => {
      const rush = 0.06 * a.cost.developmentM;
      const mars = !!a.scenario.windows;
      const wouldMiss = mars && (a.scenario.windows!.find((w) => w >= a.time.devMonths + 3) ?? Infinity) > a.time.launchMonth;
      return [
        { id: 'wait', label: 'Wait for it (launch 3 months later)', explain: wouldMiss ? 'Three months late misses the launch window: the next one is 26 months later.' : 'The team waits; every month of delay costs salaries.', quality: wouldMiss ? 0.1 : 0.55 },
        { id: 'rush', label: `Pay overtime ($${rush.toFixed(1)}M from the reserve)`, explain: 'Money buys back the time, if the reserve can cover it.', quality: a.cost.reserveM >= rush ? 0.85 : 0.35 },
      ];
    },
    resolve: (r, o) => {
      const a = r.a;
      if (o === 'rush') {
        const cost = 0.06 * a.cost.developmentM;
        r.spend(cost);
        return `Overtime paid: $${cost.toFixed(1)}M. The schedule holds.`;
      }
      const before = r.st.launchMonth;
      let next = before + 3;
      if (a.scenario.windows) next = a.scenario.windows.find((w) => w >= a.time.devMonths + 3) ?? Infinity;
      r.st.launchMonth = Math.max(before, next);
      const months = r.st.launchMonth - before;
      r.spend(0.02 * a.cost.developmentM * months);
      return months > 0 ? `Launch moves from month ${before} to month ${r.st.launchMonth}; the team's salaries cost $${(0.02 * a.cost.developmentM * months).toFixed(1)}M more.` : 'The delay was absorbed by the wait for the launch.';
    },
    lesson: 'Schedule margin and a money reserve are two ways to absorb the same surprise.',
  },
  {
    id: 'vibe-test', title: 'The shaker test finds a crack', phase: 'development',
    applies: () => true,
    rate: () => 0.45,
    text: () => 'During the vibration test that imitates the launch, a bracket cracked. Engineers can redesign it, or argue it will hold.',
    options: (a) => [
      { id: 'fix', label: `Fix and re-test (+6 weeks, $${(0.03 * a.cost.developmentM).toFixed(1)}M)`, explain: 'The safe choice: tests exist to find exactly this.', quality: 0.9 },
      { id: 'fly', label: 'Fly as it is', explain: 'No delay, no cost, but a hidden weakness rides along.', quality: 0.15 },
    ],
    resolve: (r, o) => {
      if (o === 'fix') {
        r.spend(0.03 * r.a.cost.developmentM);
        if (!r.a.scenario.windows) r.st.launchMonth += 1.5;
        return 'Bracket redesigned, test passed.';
      }
      r.st.hiddenRisk += 0.08;
      return 'The bracket flies as it is. Nobody knows if it will hold.';
    },
    lesson: 'Tests are cheaper than failures in orbit: the vibration test exists to find what launch would break.',
  },
  {
    id: 'cost-growth', title: 'Costs grow', phase: 'development', kind: 'info',
    applies: () => true,
    rate: () => 0.4,
    text: () => 'Parts and labour cost more than planned.',
    resolve: (r) => {
      const c = 0.05 * r.a.cost.developmentM;
      r.spend(c);
      return `$${c.toFixed(1)}M more, taken from the reserve.`;
    },
    lesson: 'Almost every space project grows in cost: that is what the reserve is for.',
  },
  // ------------------------------------------------------------------ operations
  {
    id: 'solar-storm', title: 'Solar storm warning', phase: 'operations',
    applies: () => true,
    rate: () => 0.5,
    text: () => 'The Sun just threw out a burst of charged particles. It arrives in about 12 hours.',
    options: (a) => {
      const tough = COMPUTERS[a.design.computer].toleranceKrad >= 100;
      return [
        { id: 'safe', label: 'Safe mode for 2 days', explain: 'Instruments off, the spacecraft waits it out. Two days of data lost, no risk.', quality: 0.85 },
        { id: 'go', label: 'Keep working', explain: tough ? 'The radiation-hardened computer should ride it out.' : 'Commercial electronics may get upset, or damaged.', quality: tough ? 0.65 : 0.25 },
      ];
    },
    resolve: (r, o) => {
      if (o === 'safe') { r.st.safeDays += 2; return 'Safe mode for two days; the storm passed harmlessly.'; }
      const tough = COMPUTERS[r.a.design.computer].toleranceKrad >= 100;
      const x = r.rng.next();
      if (x < (tough ? 0.02 : 0.08)) {
        const ids = Object.keys(r.st.health) as InstrumentId[];
        if (ids.length) {
          const id = pick(r.rng, ids);
          r.st.health[id] = Math.max(0, (r.st.health[id] ?? 1) - 0.5);
          return `A particle hit damaged the ${INSTRUMENTS[id].short}: it works at half its quality now.`;
        }
      }
      if (x < (tough ? 0.06 : 0.3)) { r.st.safeDays += 5; return 'The computer rebooted in the storm: five days to recover.'; }
      return 'The spacecraft kept working through the storm.';
    },
    lesson: 'Space weather is real: protecting the spacecraft costs a little data; not protecting it can cost the mission.',
  },
  {
    id: 'debris', title: 'Collision warning', phase: 'operations',
    applies: lowEarthOf,
    rate: (a) => (a.orbit.altKm > 450 ? 1 : 0.4),
    text: () => 'Tracking shows a piece of debris passing within 200 m in 30 hours. The chance of a hit is about 1 in 2 000.',
    options: (a) => PROPULSION[a.design.propulsion].isp > 0
      ? [
        { id: 'dodge', label: 'Dodge (a small burn)', explain: 'A few grams of propellant and half a day of imaging.', quality: 0.9 },
        { id: 'stay', label: 'Accept the risk', explain: '1 in 2 000 is small, but it is the whole mission.', quality: 0.35 },
      ]
      : [{ id: 'stay', label: 'Hope (no engine to move)', explain: 'Without propulsion there is nothing to do.', quality: 0.5 }],
    resolve: (r, o) => {
      if (o === 'dodge') { r.st.dvLeft -= 0.5; r.st.safeDays += 0.5; return 'Dodged. The debris passed 2 km away.'; }
      if (r.rng.next() < 1 / 2000) { r.end('Hit by debris'); return 'Impact. The spacecraft broke apart.'; }
      return 'The debris passed by. Lucky.';
    },
    lesson: 'Low orbit is crowded: an engine lets you dodge, and lets you leave at the end so you do not become debris yourself.',
  },
  {
    id: 'wheel', title: 'A reaction wheel failed', phase: 'operations',
    applies: (a) => a.design.adcs !== 'magnetorquer',
    rate: (a) => ADCS[a.design.adcs].failPerYear,
    text: () => 'One of the reaction wheels stopped spinning. Three are left.',
    options: (a) => [
      { id: 'three', label: 'Fly on three wheels', explain: 'Pointing stays precise, but slews are slower: no more sideways looks.', quality: 0.85 },
      ...(a.scenario.body === 'earth' && a.design.orbit.type !== 'geo'
        ? [{ id: 'mtq', label: 'Hand over to the magnetorquers', explain: 'Saves the wheels, but pointing drops to ~5°: blurred images.', quality: 0.3 }]
        : []),
    ],
    resolve: (r, o) => {
      if (o === 'mtq') { r.st.smear = 3; return 'Pointing handed to the magnetorquers: images are now blurred.'; }
      if (!r.st.agility) { r.st.smear = Math.max(r.st.smear, 2); return 'A second wheel lost: pointing is degraded.'; }
      r.st.agility = false;
      return 'Flying on three wheels; no more sideways looks.';
    },
    lesson: 'Reaction wheels are one of the parts that fail most often in orbit: real spacecraft carry a fourth.',
  },
  {
    id: 'computer', title: 'Computer failure', phase: 'operations', kind: 'failure',
    applies: () => true,
    rate: (a) => COMPUTERS[a.design.computer].failPerYear,
    text: (_, st) => (st.spareComputer ? 'The main computer failed. The spare takes over.' : 'The onboard computer failed and the spacecraft is not answering.'),
    resolve: (r) => {
      if (r.st.spareComputer) { r.st.spareComputer = false; r.st.safeDays += 2; return 'Switched to the spare computer: two days of checks and back to work.'; }
      if (r.rng.next() < 0.45) { r.st.safeDays += 10; return 'After ten days of commands from the ground, it rebooted. Lucky.'; }
      r.end('Computer failure (no spare)');
      return 'The spacecraft never answered again.';
    },
    lesson: 'A spare computer (redundancy) turns a mission-ending failure into a two-day interruption.',
  },
  {
    id: 'station', title: 'Ground station outage', phase: 'operations',
    applies: (a) => lowEarthOf(a) && a.design.stations.length > 0,
    rate: () => 0.35,
    text: (a) => `${STATIONS[a.design.stations[0]].short} is down for 10 days of repairs.`,
    options: () => [
      { id: 'rent', label: `Rent a commercial station ($0.15M)`, explain: 'Data keeps flowing.', quality: 0.7 },
      { id: 'wait', label: 'Wait it out', explain: 'Data piles up on board; if the storage fills, it is lost.', quality: 0.45 },
    ],
    resolve: (r, o) => {
      if (o === 'rent') { r.spend(0.15); return 'A commercial station filled in for ten days.'; }
      r.st.outageDays = 10;
      r.st.outageShare = 1 / Math.max(1, r.a.design.stations.length);
      return 'Ten days with less contact time.';
    },
    lesson: 'More than one ground station is insurance for your data.',
  },
  {
    id: 'flood', title: 'Floods in the Cuanza valley', phase: 'operations',
    applies: (a) => a.scenario.id === 'angola-eo',
    rate: () => 0.5,
    text: () => 'Heavy rain has flooded villages along the Cuanza river. The civil protection service asks for images within 24 hours.',
    options: (a) => {
      const capable = a.design.instruments.some((id) => id === 'sar') || a.design.adcs === 'agile' || a.design.instruments.includes('msWide');
      return [
        { id: 'retask', label: 'Re-task and image the floods', explain: capable ? 'Your spacecraft can reach the valley in time.' : 'The next pass over the valley may be days away, and clouds may hide it.', quality: capable ? 0.9 : 0.35 },
        { id: 'decline', label: 'Stay on the plan', explain: 'The routine imaging continues.', quality: 0.45 },
      ];
    },
    resolve: (r, o) => {
      if (o !== 'retask') return 'The request went to another satellite operator.';
      const sar = r.a.design.instruments.includes('sar') && (r.st.health.sar ?? 0) > 0.3;
      const ok = sar || r.rng.next() < (r.a.design.adcs === 'agile' ? 0.7 : r.a.design.instruments.includes('msWide') ? 0.5 : 0.15) * (r.a.scenario.clearSky ?? 1) * 1.6;
      r.st.safeDays += 0.3;
      if (ok) { r.st.bonus[r.a.design.primary] = (r.st.bonus[r.a.design.primary] ?? 0) + 0.05; return 'Images delivered in time: rescue teams used them to reach three cut-off villages.'; }
      return sar ? 'Re-tasked, but the radar could not reach the valley in time.' : 'Clouds hid the valley on the only pass: no usable image.';
    },
    lesson: 'Radar sees through the storm clouds that come with floods; a camera often cannot.',
  },
  {
    id: 'degrade', title: 'An instrument is ageing', phase: 'operations', kind: 'failure',
    applies: (a) => a.design.instruments.length > 0,
    rate: (a) => 0.04 * a.design.instruments.length,
    text: () => 'An instrument\'s detector is wearing out faster than expected.',
    resolve: (r) => {
      const ids = (Object.keys(r.st.health) as InstrumentId[]).filter((id) => (r.st.health[id] ?? 0) > 0);
      if (!ids.length) return 'Nothing left to degrade.';
      const id = pick(r.rng, ids);
      r.st.health[id] = Math.max(0, (r.st.health[id] ?? 1) - 0.3);
      return `The ${INSTRUMENTS[id].short} lost 30% of its quality.`;
    },
    lesson: 'Instruments age in space; flying more than one gives the mission a fallback.',
  },
  {
    id: 'lease', title: 'A neighbour wants capacity', phase: 'operations',
    applies: (a) => a.scenario.id === 'geo-comms',
    rate: () => 0.5,
    text: () => 'A neighbouring country offers to lease 15% of your transponder capacity for the rest of the mission.',
    options: () => [
      { id: 'lease', label: 'Lease it (revenue, less capacity for Angola)', explain: 'Money back for the programme; Angola gets 15% less.', quality: 0.6 },
      { id: 'keep', label: 'Keep it all for Angola', explain: 'Full service at home, no revenue.', quality: 0.6 },
    ],
    resolve: (r, o) => {
      if (o !== 'lease') return 'All capacity stays with Angola.';
      const years = Math.max(0, r.a.design.plannedYears - r.st.day / 365.25);
      r.st.revenueM += 4 * years;
      r.st.leased = true;
      return `Leased: $${(4 * years).toFixed(0)}M of revenue over the remaining ${years.toFixed(1)} years.`;
    },
    lesson: 'Commercial satellites pay for themselves by selling capacity; there is no single right answer between service and revenue.',
  },
  {
    id: 'eclipse', title: 'A lunar eclipse', phase: 'operations',
    applies: (a) => a.scenario.body === 'moon',
    rate: () => 1.5,
    text: () => 'The Moon passes through Earth\'s shadow: the relay will be in darkness for about 3 hours.',
    options: (a) => {
      const enough = a.design.batteryWh * 0.8 >= a.power.loadW * 3;
      return [
        { id: 'down', label: 'Switch the relay payload off for the shadow', explain: 'A few hours without relay; the battery is safe.', quality: enough ? 0.6 : 0.9 },
        { id: 'on', label: 'Keep everything on', explain: enough ? 'The battery should carry 3 hours.' : 'The battery may not last 3 hours.', quality: enough ? 0.8 : 0.15 },
      ];
    },
    resolve: (r, o) => {
      if (o === 'down') return 'Relay paused for three hours; all fine.';
      if (r.a.design.batteryWh * 0.8 * r.st.batteryHealth >= r.a.power.loadW * 3) return 'The battery carried the spacecraft through the eclipse.';
      r.st.safeDays += 4;
      return 'The battery ran flat in the dark: the spacecraft fell into safe mode for four days.';
    },
    lesson: 'Eclipses decide battery size, even the rare ones.',
  },
  {
    id: 'lander', title: 'A lander needs an extra pass', phase: 'operations',
    applies: (a) => a.scenario.id === 'lunar-relay',
    rate: () => 2,
    text: () => 'A far-side lander has found something interesting and asks for an extra 8-hour relay session.',
    options: (a) => {
      const st = a.design.stations.find((id) => STATIONS[id].deepSpace);
      const cost = st ? (STATIONS[st].costPerHourM ?? 0) * 8 : 0;
      return [
        { id: 'buy', label: `Buy 8 extra antenna hours ($${(cost * 1000).toFixed(0)}k)`, explain: 'More science from the lander.', quality: 0.75 },
        { id: 'no', label: 'Decline', explain: 'Stay within the plan and the budget.', quality: 0.45 },
      ];
    },
    resolve: (r, o) => {
      if (o !== 'buy') return 'The lander waits for its next scheduled pass.';
      const st = r.a.design.stations.find((id) => STATIONS[id].deepSpace);
      r.spend(st ? (STATIONS[st].costPerHourM ?? 0) * 8 : 0);
      r.st.bonus[r.a.design.primary] = (r.st.bonus[r.a.design.primary] ?? 0) + 0.015;
      return 'The extra session brought down a panorama of the far side.';
    },
    lesson: 'A relay is a service: its value is the science of the missions it serves.',
  },
  {
    id: 'dust', title: 'A global dust storm', phase: 'operations',
    applies: (a) => a.scenario.body === 'mars',
    rate: () => 365.25 / MARS_YEAR_DAYS * 0.35,
    text: () => 'A dust storm is spreading over the whole planet. The surface will be hidden for about two months.',
    options: () => [
      { id: 'climate', label: 'Switch to studying the storm', explain: 'Weather science gains; surface mapping pauses.', quality: 0.85 },
      { id: 'map', label: 'Keep mapping', explain: 'Images of the ground will show only dust.', quality: 0.25 },
    ],
    resolve: (r, o) => {
      if (o === 'climate') {
        if (r.a.value.climate !== undefined) r.st.bonus.climate = (r.st.bonus.climate ?? 0) + 0.08;
        r.st.dustDays = 60;
        r.st.dustMode = 'climate';
        return 'Two months of storm science: how dust heats the atmosphere.';
      }
      r.st.dustDays = 60;
      r.st.dustMode = 'map';
      return 'Two months of mapping a yellow haze.';
    },
    lesson: 'Plans change with nature: a flexible team turns a problem into a discovery.',
  },
];

interface Extra { leased?: boolean; dustDays?: number; dustMode?: 'climate' | 'map' }

export class MissionRun {
  readonly a: Analysis;
  readonly rng: Rng;
  readonly seed: number;
  st: SimState & Extra;
  events: SimEvent[] = [];
  samples: SimSample[] = [];
  /** The decision waiting for the team; `index` numbers decisions in order, the same on every screen. */
  pending: (SimEvent & { spec: Spec; scored: (EventOption & { quality: number })[]; index: number }) | null = null;
  private decisions = 0;
  private devQueue: { month: number; spec: Spec }[] = [];
  private answers: Record<string, string[]> = {};
  /** Standing flight rules: event → the option the team chose twice in a row. */
  standing: Record<string, string> = {};
  private plannedDays: number;
  private opsCostPerDay: number;

  constructor(a: Analysis, seed: number) {
    this.a = a;
    this.seed = seed;
    this.rng = createRng(seed);
    const d = a.design;
    this.plannedDays = Math.round(d.plannedYears * 365.25);
    this.opsCostPerDay = a.cost.operationsM / Math.max(1, (d.plannedYears + a.orbit.transferDays / 365.25) * 365.25);
    this.st = {
      phase: 'development', month: 0, day: 0, elapsedDays: 0, launchMonth: a.time.launchMonth, alive: true, endReason: null,
      safeDays: 0, outageDays: 0, outageShare: 0, arrayFactor: 1, batteryHealth: 1, dishOk: true, smear: 1, agility: true,
      spareComputer: d.redundant, health: Object.fromEntries(d.instruments.map((id) => [id, 1])),
      dvLeft: a.dv.capabilityMs, backlogGbit: 0, deliveredGbit: 0, lostGbit: 0, expectedGbit: 0,
      value: Object.fromEntries(Object.keys(a.value).map((k) => [k, 0])), bonus: {},
      extraM: 0, revenueM: 0, doseKrad: 0, scienceDays: 0, downDays: 0, hiddenRisk: 0, batteryWarned: false, radiationWarned: false,
    };
    // development surprises (none for Cadet and Sandbox)
    const diff = DIFFICULTY[a.difficulty];
    if (diff.events) {
      const boost = a.difficulty === 'expert' ? 1.4 : 1;
      for (const spec of EVENTS.filter((e) => e.phase === 'development' && e.applies(a))) {
        if (this.rng.next() < Math.min(0.95, spec.rate(a, this.st) * boost)) this.devQueue.push({ month: Math.max(1, Math.floor(this.rng.next() * a.time.devMonths * 0.8)), spec });
      }
      this.devQueue.sort((x, y) => x.month - y.month);
    }
    this.log({ id: 'start', when: 'Month 0', t: 0, title: 'Project start', text: `${a.scenario.startLabel}: the team starts building ${d.name}.`, kind: 'milestone' });
  }

  get ended() { return this.st.phase === 'ended'; }

  /** Money beyond the plan: from the reserve first, then over budget. */
  spend(m: number) { this.st.extraM += m; }

  /** The mission stops; a completed one leaves a healthy spacecraft behind. */
  end(reason: string, lost = true) {
    this.st.alive = !lost;
    this.st.endReason = reason;
    this.st.phase = 'ended';
  }

  private log(e: SimEvent) { this.events.push(e); }

  private when() {
    return this.st.phase === 'development' ? `Month ${Math.floor(this.st.month)}` : `Day ${Math.floor(this.st.day)}`;
  }

  private fire(spec: Spec) {
    const ev: SimEvent = { id: spec.id, when: this.when(), t: this.st.phase === 'development' ? this.st.month : this.st.day, title: spec.title, text: spec.text(this.a, this.st), kind: spec.kind ?? (spec.options ? 'decision' : 'info'), lesson: spec.lesson };
    const opts = spec.options?.(this.a, this.st);
    if (opts && opts.length > 1) {
      ev.options = opts.map(({ id, label, explain }) => ({ id, label, explain }));
      // the same answer twice becomes a standing flight rule, applied without asking again
      const rule = this.standing[spec.id];
      const o = rule ? opts.find((x) => x.id === rule) : undefined;
      if (o) {
        this.log({ ...ev, chosen: o.id, quality: o.quality, outcome: `Flight rule: ${o.label.toLowerCase()}. ${spec.resolve(this, o.id)}` });
        return;
      }
      this.pending = { ...ev, spec, scored: opts, index: this.decisions++ };
      return;
    }
    ev.outcome = spec.resolve(this, opts?.[0]?.id);
    // a single option is no choice: it is not judged
    if (opts?.length === 1) ev.chosen = opts[0].id;
    this.log(ev);
  }

  /** The team's choice for the pending event. */
  choose(optionId: string) {
    const p = this.pending;
    if (!p) return;
    const o = p.scored.find((x) => x.id === optionId) ?? p.scored[0];
    this.pending = null;
    const ev: SimEvent = { id: p.id, when: p.when, t: p.t, title: p.title, text: p.text, kind: p.kind, options: p.options, lesson: p.lesson };
    const before = this.answers[p.id] ?? [];
    this.answers[p.id] = [...before, o.id];
    if (before[before.length - 1] === o.id) this.standing[p.id] = o.id;
    this.log({ ...ev, chosen: o.id, quality: o.quality, outcome: p.spec.resolve(this, o.id) });
  }

  /** Advance up to `days` days of operations (or the development months); stops at a decision or the end. */
  advance(days: number) {
    let budget = days;
    while (budget > 0 && !this.pending && !this.ended) {
      if (this.st.phase === 'development') {
        const next = this.devQueue[0];
        const step = Math.min(1, budget / 30);
        if (next && next.month <= this.st.month + step) {
          this.st.month = next.month;
          this.devQueue.shift();
          this.fire(next.spec);
          continue;
        }
        this.st.month += step * 1;
        budget -= step * 30;
        if (this.st.month >= this.st.launchMonth) this.launch();
        continue;
      }
      if (this.st.phase === 'cruise' || this.st.phase === 'operations') { this.day(); budget -= 1; continue; }
      break;
    }
  }

  private launch() {
    const a = this.a;
    this.st.month = this.st.launchMonth;
    if (!Number.isFinite(this.st.launchMonth)) { this.log({ id: 'nolaunch', when: this.when(), t: this.st.month, title: 'No launch', text: 'There is no launch opportunity the spacecraft can make.', kind: 'failure' }); this.end('Never launched'); return; }
    if (!a.launch.ok) {
      this.log({ id: 'launch', when: this.when(), t: this.st.month, title: 'Launch impossible', text: a.launch.reasons[0] ?? 'The launcher cannot fly this spacecraft.', kind: 'failure', lesson: 'Mass and orbit must fit the launcher before anything else matters.' });
      this.end('Could not be launched');
      return;
    }
    const pFail = 1 - (a.difficulty === 'sandbox' || a.difficulty === 'cadet' ? 1 : LAUNCHERS[a.design.launcher].reliability) + this.st.hiddenRisk / 2;
    if (this.rng.next() < pFail) {
      const payout = a.design.insurance ? 0.85 * (a.cost.developmentM + a.launch.priceM) : 0;
      this.st.revenueM += payout;
      this.log({ id: 'launch', when: this.when(), t: this.st.month, title: 'Launch failure', text: `The ${a.design.launcher === 'rideshare' ? 'rideshare rocket' : 'rocket'} failed on the way to orbit.${payout ? ` Insurance pays back $${payout.toFixed(0)}M.` : ' There was no insurance.'}`, kind: 'failure', lesson: 'Every rocket has a track record; insurance turns a lost satellite into a second chance.' });
      this.end('Launch failure');
      return;
    }
    this.log({ id: 'launch', when: this.when(), t: this.st.month, title: 'Liftoff', text: `${a.design.name} launched at month ${this.st.launchMonth.toFixed(0)}.`, kind: 'milestone' });
    // deployments
    if (a.design.mount !== 'body' && this.rng.next() < 0.01 + this.st.hiddenRisk / 2) {
      this.st.arrayFactor = 0.5;
      this.log({ id: 'wing', when: 'Day 0', t: 0, title: 'A solar wing is stuck', text: 'One solar wing did not unfold: half the power.', kind: 'failure', lesson: 'Every mechanism that must move in space is a risk.' });
    }
    if (a.design.antenna === 'dish' && this.rng.next() < 0.01) {
      this.st.dishOk = false;
      this.log({ id: 'dish', when: 'Day 0', t: 0, title: 'The dish did not deploy', text: 'The antenna is jammed: only a backup antenna works, with a trickle of data.', kind: 'failure' });
    }
    this.st.phase = 'cruise';
    this.st.day = -Math.round(this.a.orbit.transferDays + this.a.time.raiseDays + (this.a.design.orbit.capture === 'aerobrake' && this.a.design.orbit.type === 'marsLow' ? 180 : 0));
  }

  /** One day after launch: cruise days count negative up to the operating orbit. */
  private day() {
    const a = this.a, st = this.st, d = a.design;
    st.day += 1;
    st.elapsedDays += 1;
    if (st.day <= 0) { this.sample(); return; }
    if (st.phase === 'cruise') {
      st.phase = 'operations';
      this.log({ id: 'arrive', when: 'Day 0', t: 0, title: 'In the operating orbit', text: 'Commissioning complete: the mission begins.', kind: 'milestone' });
    }
    const year = st.day / 365.25;
    // random operations events (Cadet and Sandbox fly without them)
    if (DIFFICULTY[a.difficulty].events) {
      const boost = a.difficulty === 'expert' ? 1.3 : 1;
      for (const spec of EVENTS) {
        if (spec.phase !== 'operations' || !spec.applies(a)) continue;
        if (this.rng.next() < (spec.rate(a, st) * boost) / 365.25) {
          this.fire(spec);
          if (this.pending || this.ended) return;
        }
      }
    }
    // radiation: beyond half its tolerance the electronics start to fail
    st.doseKrad += a.orbit.radKradPerYear / 365.25;
    const tol = COMPUTERS[d.computer].toleranceKrad;
    if (st.doseKrad > tol / 2) {
      if (!st.radiationWarned) { st.radiationWarned = true; this.log({ id: 'rad', when: this.when(), t: st.day, title: 'Radiation dose past the design limit', text: `${st.doseKrad.toFixed(0)} krad so far: the electronics are on borrowed time.`, kind: 'info', lesson: 'The total dose a spacecraft can take is a lifetime limit, set by its parts.' }); }
      if (this.rng.next() < 0.0015) { this.fire(EVENTS.find((e) => e.id === 'computer')!); if (this.ended) return; }
    }
    // orbit decay without an engine, propellant for station keeping
    const decay = a.time.limits.find((l) => l.name.startsWith('Orbit decay'));
    if (decay && year > decay.value) { this.log({ id: 'reentry', when: this.when(), t: st.day, title: 'Re-entry', text: 'Air drag has pulled the orbit down: the spacecraft burns up in the atmosphere.', kind: 'failure', lesson: 'Without propulsion a low orbit decays; lower orbits decay faster.' }); this.end('Orbit decayed'); return; }
    st.dvLeft -= a.dv.perYearMs / 365.25;
    if (a.dv.perYearMs > 0 && st.dvLeft < 0 && PROPULSION[d.propulsion].isp > 0) { this.log({ id: 'fuel', when: this.when(), t: st.day, title: 'Out of propellant', text: 'The tanks are dry: the spacecraft can no longer hold its orbit.', kind: 'failure', lesson: 'Propellant is a lifetime budget.' }); this.end('Out of propellant'); return; }

    // power: ageing cells, a battery worn by every eclipse
    const eol = a.power.bolW * st.arrayFactor * (1 - CELLS[d.cells].degradationPerYear) ** (year + a.orbit.transferDays / 365.25);
    const pf = Math.min(1, eol / a.power.requiredW);
    const dod = a.power.eclipseWh > 0 ? a.power.eclipseWh / Math.max(1e-6, d.batteryWh * st.batteryHealth * 0.9) : 0;
    if (a.orbit.eclipsesPerYear > 0 && dod > 0) st.batteryHealth = Math.max(0.05, st.batteryHealth - (0.2 * a.orbit.eclipsesPerYear) / 365.25 / batteryCycleLife(Math.min(1, dod)));
    if (!st.batteryWarned && st.batteryHealth < 0.75) { st.batteryWarned = true; this.log({ id: 'battery', when: this.when(), t: st.day, title: 'The battery is wearing out', text: `It now holds ${(st.batteryHealth * 100).toFixed(0)}% of its charge.`, kind: 'info', lesson: 'Deep discharges wear batteries out: a bigger battery used gently lasts longer.' }); }
    const eclipseCut = dod > 1 ? 1 - a.orbit.eclipseFrac : 1;
    const dust = st.dustDays && st.dustDays > 0;
    if (dust) st.dustDays! -= 1;
    const safe = st.safeDays > 0;
    if (safe) { st.safeDays = Math.max(0, st.safeDays - 1); st.downDays += 1; }
    const work = safe ? 0 : pf * eclipseCut;
    if (!safe) st.scienceDays += 1;

    // data: made, sent, stored or lost
    let generated = 0;
    for (const u of a.data.instruments) {
      const h = st.health[u.id] ?? 1;
      const dustCut = dust && st.dustMode === 'map' && INSTRUMENTS[u.id].kind === 'imager' ? 0 : 1;
      generated += u.gbitPerDay * h * work * dustCut;
    }
    let capacity = a.data.capacityGbitDay * (st.dishOk ? 1 : 0.05);
    if (st.outageDays > 0) { st.outageDays -= 1; capacity *= 1 - st.outageShare; }
    if (a.scenario.body === 'mars') {
      const g = earthMarsGeometry(st.day);
      const typ = earthMarsGeometry(0).distM;
      capacity = g.sepDeg < 3 ? 0 : Math.min(capacity * (typ / g.distM) ** 2, a.comms.rateMbps > 0 ? capacity * 4 : 0);
    }
    // far from Earth the team images only what the link can bring home
    if (a.scenario.body !== 'earth') generated = Math.min(generated, capacity);
    const send = Math.min(capacity, st.backlogGbit + generated);
    st.backlogGbit += generated - send;
    if (st.backlogGbit > d.storageGbit) { st.lostGbit += st.backlogGbit - d.storageGbit; st.backlogGbit = d.storageGbit; }
    st.deliveredGbit += send;
    const expected = a.data.deliveredGbitDay;
    st.expectedGbit += expected;

    // value of each objective: its predicted worth, as far as today's operations delivered it
    const q = expected > 0 ? Math.min(1, send / expected) : work * (st.dishOk ? 1 : 0.05) * (st.leased ? 0.85 : 1);
    for (const id of Object.keys(st.value)) {
      const o = a.scenario.objectives.find((x) => x.id === id)!;
      const useful = d.instruments.filter((i) => (o.value[i] ?? 0) >= 0.5);
      const health = useful.length ? Math.max(...useful.map((i) => st.health[i] ?? 1)) : 1;
      const sharp = useful.some((i) => INSTRUMENTS[i].kind === 'imager') ? 1 / Math.sqrt(st.smear) : 1;
      st.value[id] += (a.value[id] * q * health * sharp) / Math.max(1, this.plannedDays);
    }
    this.sample(dod, eol);
    if (st.day >= this.plannedDays) {
      this.log({ id: 'end', when: this.when(), t: st.day, title: 'Mission complete', text: `${d.plannedYears} years of operations completed.`, kind: 'milestone' });
      this.end('Mission complete', false);
    }
  }

  private sample(dod = 0, powerW = this.a.power.eolW) {
    const st = this.st;
    const every = Math.max(1, Math.round(this.plannedDays / 400));
    if (st.day % every !== 0 && st.day > 0) return;
    this.samples.push({
      day: st.day,
      soc: Math.max(0, 100 - dod * 100),
      powerW,
      backlogGbit: st.backlogGbit,
      deliveredGbit: st.deliveredGbit,
      // the value the score counts: the primary objective plus a share of the secondary ones
      value: Math.min(1, Object.entries(st.value).reduce((s, [k, x]) => s + (k === this.a.design.primary ? 1 : 0.35) * x, 0)),
      spentM: this.spentM(),
    });
  }

  /** Money spent so far (development, launch, operations to date, surprises). */
  spentM(): number {
    const a = this.a, st = this.st;
    const devShare = st.phase === 'development' ? Math.min(1, st.month / Math.max(1, a.time.devMonths)) : 1;
    const launched = st.phase !== 'development' && st.endReason !== 'Could not be launched' && st.endReason !== 'Never launched';
    const insurance = a.design.insurance ? 0.08 * (a.cost.developmentM + a.launch.priceM) : 0;
    return a.cost.developmentM * devShare + (launched ? a.launch.priceM + insurance : 0) + this.opsCostPerDay * st.elapsedDays + st.extraM;
  }

  /** Fly to the end, choosing for the team with `choose` (tests, quick simulation). */
  runToEnd(choose: (e: SimEvent) => string = (e) => e.options![0].id, maxSteps = 100_000) {
    for (let k = 0; k < maxSteps && !this.ended; k++) {
      if (this.pending) this.choose(choose(this.pending));
      else this.advance(30);
    }
    return this;
  }
}

export const randomSeed = () => (Math.random() * 2 ** 32) >>> 0;
