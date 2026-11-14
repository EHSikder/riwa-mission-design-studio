/**
 * Building and flying the mission (docs/03 §6). From the design's analysis, a seeded run goes through:
 * - development: late parts and cost growth, then the test campaign, one test at a time, run by its owner;
 * - launch: the countdown, the ascent (the rocket's track record), and whatever the tests did not catch;
 * - commissioning: unfold, first signal, the braking burn far from Earth, first light;
 * - operations, day by day: power from ageing cells, a battery worn by every eclipse, data made, sent, stored
 *   or lost, radiation dose, propellant, orbit decay, random events and anomalies to diagnose;
 * - for a crew: flight days, air and food, radiation dose, the burns to and from the Moon, splashdown.
 * Steps and decisions pause the run; every choice is remembered and judged in the report. Same seed + same
 * choices = the same mission, so a team can replay and compare.
 */
import { createRng, type Rng } from './rng';
import type { Analysis } from './analyze';
import { CELLS, COMPUTERS, LAUNCHERS, PROPULSION, batteryCycleLife } from './catalog';
import { GCR_MSV_PER_DAY } from './crew';
import { DIFFICULTY } from './design';
import {
  ANOMALIES, COMMISSIONED, CREW_ANOMALIES, CREW_ORBIT, CREW_STEPS, DEPLOY, EVENTS, FIRSTLIGHT, FLAW_ECLSS, FLAW_SOFTWARE, FLAW_THERMAL,
  INSERTION, LAUNCH, LICENCE, SIGNAL, WEATHER, testStep, type Scored, type Spec,
} from './events';
import { INSTRUMENTS, type InstrumentId } from './instruments';
import { earthMarsGeometry } from './access';
import { TESTS, latentDefects, type DefectId } from './tests';
import type { RoleId } from './types';

export type SimPhase = 'development' | 'cruise' | 'operations' | 'ended';
/** Where the project is, for the progress strip: build, test, launch, commission, cruise, operate, ended. */
export type Stage = 'build' | 'test' | 'launch' | 'commission' | 'cruise' | 'operate' | 'ended';

export interface EventOption {
  id: string;
  label: string;
  explain: string;
}

/** One channel of telemetry: what a sensor says, and whether that is inside its limits. */
export interface Reading {
  label: string;
  value: string;
  state: 'ok' | 'warn' | 'bad';
}

export interface SimEvent {
  id: string;
  /** Project month (development), day of operations, or flight day (crew). */
  when: string;
  t: number;
  title: string;
  text: string;
  kind: 'decision' | 'action' | 'failure' | 'info' | 'milestone' | 'good';
  /** The desk that owns the step or speaks first on the decision. */
  role?: RoleId;
  telemetry?: Reading[];
  art?: string;
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

export interface CrewState {
  alive: boolean;
  doseMsv: number;
  /** Days of air, water and food left. */
  supplyDays: number;
  /** 0–1: a tired, uncomfortable crew does less and shares less. */
  morale: number;
  moonDays: number;
}

export interface SimState {
  phase: SimPhase;
  stage: Stage;
  month: number;
  /** When the spacecraft is ready, and when it can actually launch (windows, shared rides). */
  readyMonth: number;
  launchMonth: number;
  day: number;
  /** Days since launch (cruise included): operations are paid from launch on. */
  elapsedDays: number;
  alive: boolean;
  endReason: string | null;
  arrived: boolean;
  safeDays: number;
  outageDays: number;
  outageShare: number;
  arrayFactor: number;
  batteryHealth: number;
  batteryWear: number;
  linkFactor: number;
  /** Share of the time the spacecraft can work (a hot battery, a tired crew), and lost to restarts. */
  workCap: number;
  resetLoss: number;
  launchRisk: number;
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
  batteryWarned: boolean;
  radiationWarned: boolean;
  /** The hidden cause of each anomaly met so far. */
  cause: Record<string, string>;
  leased?: boolean;
  dustDays?: number;
  dustMode?: 'climate' | 'map';
  crew?: CrewState;
  inLunarOrbit?: boolean;
  skipMoon?: boolean;
  suppliesWarned?: boolean;
  /** Mass the parts gained beyond their estimates while being built (kg). */
  growthKg?: number;
}

type Pending = SimEvent & { spec: Spec; scored: Scored[]; index: number };

export class MissionRun {
  readonly a: Analysis;
  readonly rng: Rng;
  readonly seed: number;
  st: SimState;
  events: SimEvent[] = [];
  samples: SimSample[] = [];
  /** The step or decision waiting for the team; `index` numbers them in order, the same on every screen. */
  pending: Pending | null = null;
  /** Flaws hidden in the build that have not been fixed: they fly. */
  flaws: Set<DefectId>;
  /** Steps that follow at once (a test's finding, the next commissioning step). */
  next: Spec[] = [];
  /** Standing flight rules: event → the option the team chose twice in a row. */
  standing: Record<string, string> = {};
  /** Days of operations planned (a crewed flight: the length of its trajectory). */
  plannedDays: number;
  private asked = 0;
  private devQueue: { month: number; spec: Spec }[] = [];
  private opsQueue: { day: number; spec: Spec }[] = [];
  private answers: Record<string, string[]> = {};
  private opsCostPerDay: number;
  private launchStep = 0;

  constructor(a: Analysis, seed: number) {
    this.a = a;
    this.seed = seed;
    this.rng = createRng(seed);
    const d = a.design;
    const diff = DIFFICULTY[a.difficulty];
    this.plannedDays = a.crew ? a.crew.days : Math.round(d.plannedYears * 365.25);
    this.opsCostPerDay = a.cost.operationsM / Math.max(1, this.plannedDays + a.orbit.transferDays);
    this.flaws = new Set(diff.events ? latentDefects(seed, d) : []);
    this.st = {
      phase: 'development', stage: 'build', month: 0, readyMonth: a.time.devMonths, launchMonth: a.time.launchMonth, day: 0, elapsedDays: 0,
      alive: true, endReason: null, arrived: false,
      safeDays: 0, outageDays: 0, outageShare: 0, arrayFactor: 1, batteryHealth: 1, batteryWear: 1, linkFactor: 1, workCap: 1, resetLoss: 0,
      launchRisk: 0, smear: 1, agility: true,
      spareComputer: d.redundant, health: Object.fromEntries(d.instruments.map((id) => [id, 1])),
      dvLeft: a.dv.capabilityMs, backlogGbit: 0, deliveredGbit: 0, lostGbit: 0, expectedGbit: 0,
      value: Object.fromEntries(Object.keys(a.value).map((k) => [k, 0])), bonus: {},
      extraM: 0, revenueM: 0, doseKrad: 0, scienceDays: 0, downDays: 0, batteryWarned: false, radiationWarned: false, cause: {},
    };
    if (a.crew) this.st.crew = { alive: true, doseMsv: 0, supplyDays: a.crew.supplyDays, morale: 1, moonDays: 0 };

    // development surprises (none for Cadet and Sandbox)
    if (diff.events) {
      const boost = a.difficulty === 'expert' ? 1.4 : 1;
      for (const spec of EVENTS.filter((e) => e.phase === 'development' && e.applies(a))) {
        if (this.rng.next() < Math.min(0.95, spec.rate(a, this.st) * boost)) this.devQueue.push({ month: Math.max(1, Math.floor(this.rng.next() * a.time.devMonths * 0.7)), spec });
      }
      this.devQueue.sort((x, y) => x.month - y.month);
    }
    // the paperwork opens it: radio, imaging and debris licences, filed as soon as the launch is booked (CubeSat 101)
    if (!a.crew) this.devQueue.push({ month: Math.max(0.5, Math.min(2, 0.15 * a.time.devMonths)), spec: LICENCE });
    // the test campaign closes the development: each planned test in turn
    let weeksLeft = a.tests.weeks;
    for (const t of a.tests.planned) {
      this.devQueue.push({ month: Math.max(0.5, a.time.devMonths - weeksLeft / 4.345), spec: testStep(t) });
      weeksLeft -= TESTS[t].weeks;
    }
    this.devQueue.sort((x, y) => x.month - y.month);

    // what the flight will meet, drawn from its own sequence so that the rest of the luck does not shift
    const luck = createRng((seed ^ 0x0a11_0c8e) >>> 0);
    const draw = <T,>(xs: T[]): T => xs.splice(Math.floor(luck.next() * xs.length) % xs.length, 1)[0];
    if (a.crew) {
      const c = a.crew;
      const q = (day: number, spec: Spec) => this.opsQueue.push({ day, spec });
      q(1, CREW_STEPS.checkout);
      q(2, CREW_STEPS.tli);
      q(c.outboundDays, c.orbit ? CREW_STEPS.loi : CREW_STEPS.flyby);
      if (c.orbit) q(c.outboundDays + c.moonDays, CREW_STEPS.tei);
      if (diff.events) {
        q(c.days - 1, CREW_STEPS.entry);
        const pool = CREW_ANOMALIES.filter((s) => s.applies(a));
        for (let k = 0; k < (a.difficulty === 'expert' ? 3 : 2) && pool.length; k++) q(3 + Math.floor(luck.next() * Math.max(1, c.days - 4)), draw(pool));
        if (this.flaws.has('eclss')) q(Math.max(3, Math.round(0.4 * c.days)), FLAW_ECLSS);
      }
    } else if (diff.events) {
      const pool = ANOMALIES.filter((s) => s.applies(a));
      const n = (a.difficulty === 'expert' ? 3 : 2) + (d.plannedYears >= 8 ? 1 : 0);
      for (let k = 0; k < n && pool.length; k++) this.opsQueue.push({ day: Math.max(8, Math.round((0.06 + 0.8 * luck.next()) * this.plannedDays)), spec: draw(pool) });
      if (this.flaws.has('software')) this.opsQueue.push({ day: 4, spec: FLAW_SOFTWARE });
    }
    this.opsQueue.sort((x, y) => x.day - y.day);
    this.log({ id: 'start', when: 'Month 0', t: 0, title: 'Project start', text: `${a.scenario.startLabel}: the team starts building ${d.name}.`, kind: 'milestone' });
  }

  get ended() { return this.st.phase === 'ended'; }

  /** Money beyond the plan: from the reserve first, then over budget. */
  spend(m: number) { this.st.extraM += m; }

  /** The spacecraft is ready `months` later; returns how far the launch itself moved (windows, shared rides). */
  slip(months: number): number {
    const before = this.st.launchMonth;
    this.st.readyMonth += months;
    this.st.launchMonth = Math.max(before, this.launchFor(this.st.readyMonth));
    return this.st.launchMonth - before;
  }

  private launchFor(ready: number): number {
    const s = this.a.scenario;
    if (s.windows) return s.windows.find((w) => w >= ready) ?? Infinity;
    if (LAUNCHERS[this.a.design.launcher].rideshare) return Math.ceil(ready / 4 - 1e-9) * 4;
    return ready;
  }

  /** A crewed flight that lasts longer than planned. */
  addDays(n: number) { this.plannedDays += n; }

  /** The mission stops; a completed one leaves a healthy spacecraft behind. */
  end(reason: string, lost = true) {
    this.st.alive = !lost;
    this.st.endReason = reason;
    this.st.phase = 'ended';
    this.st.stage = 'ended';
    this.next = [];
  }

  /** Record something that went wrong, with what it teaches. */
  fail(id: string, title: string, text: string, lesson?: string) {
    this.log({ id, when: this.when(), t: this.t(), title, text, kind: 'failure', lesson });
  }

  /** Commissioning is over: the mission proper begins. */
  operate() {
    this.st.phase = 'operations';
    this.st.stage = 'operate';
  }

  private log(e: SimEvent) { this.events.push(e); }
  private t() { return this.st.phase === 'development' ? this.st.month : this.st.day; }

  private when() {
    const st = this.st;
    if (st.phase === 'development') return `Month ${Math.floor(st.month)}`;
    if (this.a.crew) return `Flight day ${Math.max(1, Math.floor(st.day))}`;
    return st.day <= 0 && st.elapsedDays > 0 ? `Cruise day ${st.elapsedDays}` : st.day <= 0 ? 'Launch day' : `Day ${Math.floor(st.day)}`;
  }

  private fire(spec: Spec) {
    spec.prepare?.(this);
    const a = this.a, st = this.st;
    const opts = spec.options?.(a, st);
    const ev: SimEvent = {
      id: spec.id, when: this.when(), t: this.t(), title: spec.title, text: spec.text(a, st), role: spec.role, art: spec.art,
      kind: spec.kind ?? (spec.action ? 'action' : opts && opts.length > 1 ? 'decision' : 'info'), lesson: spec.lesson || undefined, telemetry: spec.telemetry?.(a, st),
    };
    if (spec.id.startsWith('test:')) st.stage = 'test';
    if (opts && (opts.length > 1 || spec.action)) {
      ev.options = opts.map(({ id, label, explain }) => ({ id, label, explain }));
      // the same answer twice becomes a standing flight rule, applied without asking again
      const rule = spec.noRule || spec.action ? undefined : this.standing[spec.id];
      const o = rule ? opts.find((x) => x.id === rule) : undefined;
      if (o) {
        const entry: SimEvent = { ...ev, chosen: o.id, quality: o.quality };
        this.log(entry);
        entry.outcome = `Flight rule: ${o.label.toLowerCase()}. ${spec.resolve(this, o.id)}`;
        return;
      }
      this.pending = { ...ev, spec, scored: opts, index: this.asked++ };
      return;
    }
    this.log(ev);
    ev.outcome = spec.resolve(this, opts?.[0]?.id) || undefined;
    // a single option is no choice: it is not judged
    if (opts?.length === 1) ev.chosen = opts[0].id;
  }

  /** The team's answer to the pending step or decision. */
  choose(optionId: string) {
    const p = this.pending;
    if (!p) return;
    const o = p.scored.find((x) => x.id === optionId) ?? p.scored[0];
    this.pending = null;
    const { spec, scored: _s, index: _i, ...ev } = p;
    void _s; void _i;
    if (!spec.action) {
      const before = this.answers[p.id] ?? [];
      this.answers[p.id] = [...before, o.id];
      if (!spec.noRule && before[before.length - 1] === o.id) this.standing[p.id] = o.id;
    }
    const entry: SimEvent = { ...ev, chosen: o.id, quality: spec.action ? undefined : o.quality };
    this.log(entry);
    entry.outcome = spec.resolve(this, o.id);
    this.drain();
  }

  /** Whatever follows at once. */
  private drain() {
    while (this.next.length && !this.pending && !this.ended) this.fire(this.next.shift()!);
  }

  /** Advance up to `days` days (or the development months); stops at a step, a decision or the end. */
  advance(days: number) {
    let budget = days;
    this.drain();
    while (budget > 0 && !this.pending && !this.ended) {
      const st = this.st;
      if (st.phase === 'development') {
        const due = this.devQueue[0];
        const step = Math.min(1, budget / 30);
        if (due && due.month <= st.month + step) {
          st.month = Math.max(st.month, due.month);
          this.devQueue.shift();
          this.fire(due.spec);
          this.drain();
          continue;
        }
        if (st.month + step >= st.launchMonth && !this.devQueue.length) { this.countdown(); this.drain(); continue; }
        st.month += step;
        budget -= step * 30;
        continue;
      }
      if (st.phase === 'cruise' && st.day >= 0 && !st.arrived) { this.arrive(); this.drain(); continue; }
      if (st.phase === 'operations' && st.day >= this.plannedDays) { this.complete(); continue; }
      this.day();
      this.drain();
      budget -= 1;
    }
  }

  /** Launch day: can it fly at all, is the weather good, and then the button. */
  private countdown() {
    const a = this.a, st = this.st;
    st.stage = 'launch';
    if (this.launchStep === 0) {
      st.month = Number.isFinite(st.launchMonth) ? st.launchMonth : st.month;
      const missing = a.build.filter((b) => !b.done && !b.optional);
      if (missing.length) {
        this.fail('notready', 'Not ready to launch', `The spacecraft is not finished: ${missing.map((b) => b.label.toLowerCase()).join(', ')} still missing.`, 'A spacecraft is a set of systems that each need the others: none of them is optional.');
        this.end('Could not be launched');
        return;
      }
      if (!Number.isFinite(st.launchMonth)) { this.fail('nolaunch', 'No launch', 'There is no launch opportunity the spacecraft can make.'); this.end('Never launched'); return; }
      if (!a.launch.ok) {
        this.fail('launch-impossible', 'Launch impossible', a.launch.reasons[0] ?? 'The launcher cannot fly this spacecraft.', 'Mass and orbit must fit the launcher before anything else matters.');
        this.end('Could not be launched');
        return;
      }
      this.launchStep = 1;
      if (DIFFICULTY[a.difficulty].events && this.rng.next() < 0.3) { this.fire(WEATHER); return; }
    }
    if (this.launchStep === 1) { this.launchStep = 2; this.fire(LAUNCH); }
  }

  /** The ride to orbit; returns what the launch log says. */
  ascent(): string {
    const a = this.a, st = this.st, d = a.design;
    const calm = !DIFFICULTY[a.difficulty].events;
    const pFail = calm ? 0 : 1 - LAUNCHERS[d.launcher].reliability + st.launchRisk;
    if (this.rng.next() < pFail) {
      if (st.crew) {
        const saved = this.rng.next() < a.crew!.abortSaves * (this.flaws.has('abort') ? 0.5 : 1);
        st.crew.alive = saved;
        this.fail('launch-failure', 'Launch failure', saved
          ? 'Ninety seconds into the flight a booster failed. The escape system fired and pulled the capsule clear; the crew came down under parachutes, shaken and alive.'
          : a.crew!.abortSaves > 0 ? 'A booster failed. The escape system fired late and the capsule tumbled. The crew was lost.' : 'A booster failed, and there was no escape system. The crew was lost.',
        saved ? 'A launch escape system is dead weight on every flight but one.' : 'No agency flies people on a rocket without a way off it that has been tested.');
        this.end(saved ? 'Launch failure (crew escaped)' : 'Loss of crew');
        return saved ? 'Abort. The crew is safe.' : 'The rocket failed.';
      }
      const payout = d.insurance ? 0.85 * (a.cost.developmentM + a.launch.priceM) : 0;
      st.revenueM += payout;
      this.fail('launch-failure', 'Launch failure', `The ${d.launcher === 'rideshare' ? 'rideshare rocket' : 'rocket'} failed on the way to orbit.${payout ? ` Insurance pays back $${payout.toFixed(0)}M.` : ' There was no insurance.'}`, 'Every rocket has a track record; insurance turns a lost satellite into a second chance.');
      this.end('Launch failure');
      return 'The rocket failed.';
    }
    st.phase = 'cruise';
    st.day = -Math.round(a.orbit.transferDays + a.time.raiseDays + (d.orbit.capture === 'aerobrake' && d.orbit.type === 'marsLow' ? 180 : 0));
    if (this.flaws.has('structure')) {
      const ids = Object.keys(st.health) as InstrumentId[];
      if (ids.length) st.health[ids[0]] = 0.6; else st.arrayFactor *= 0.8;
      this.fail('flaw:structure', 'Something broke loose during launch', ids.length
        ? `Three minutes of the rocket's shaking finished the crack that a vibration test would have found. A bracket gave way and the ${INSTRUMENTS[ids[0]].short} shifted on its mount: it will work at 60% of its quality.`
        : 'Three minutes of the rocket\'s shaking finished the crack that a vibration test would have found: an array hinge is bent and a fifth of the power is gone.',
      'The launch is the hardest shaking a spacecraft ever gets. What survives it on the shaker table survives it on the rocket.');
    }
    if ((d.mount !== 'body' && d.arrayM2 > 0) || d.antenna === 'dish') this.next.push(DEPLOY);
    if (d.antenna !== 'none' && d.stations.length) this.next.push(SIGNAL);
    return `Liftoff at month ${st.launchMonth.toFixed(0)}. ${a.crew ? 'Eight minutes later the engines cut off and the cabin goes quiet: orbit.' : 'The rocket did its job: the spacecraft is on its way.'}`;
  }

  /** At the destination: brake, switch on, and start work. */
  private arrive() {
    const a = this.a, st = this.st;
    st.arrived = true;
    st.stage = 'commission';
    if (a.crew) { this.next.push(CREW_ORBIT); return; }
    if (a.scenario.body !== 'earth') this.next.push(INSERTION);
    if (a.design.instruments.length) this.next.push(FIRSTLIGHT);
    if (this.flaws.has('thermal')) this.next.push(FLAW_THERMAL);
    this.next.push(COMMISSIONED);
  }

  /** One day after launch: cruise days count negative up to the operating orbit. */
  private day() {
    const a = this.a, st = this.st, d = a.design;
    st.day += 1;
    st.elapsedDays += 1;
    if (st.phase === 'cruise') { st.stage = 'cruise'; this.sample(); return; }
    const year = st.day / 365.25;
    // random operations events (Cadet and Sandbox fly without them; a crew's flight is too short for them)
    if (DIFFICULTY[a.difficulty].events && !a.crew) {
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
    if (decay && year > decay.value) { this.fail('reentry', 'Re-entry', 'Air drag has pulled the orbit down: the spacecraft burns up in the atmosphere.', 'Without propulsion a low orbit decays; lower orbits decay faster.'); this.end('Orbit decayed'); return; }
    st.dvLeft -= a.dv.perYearMs / 365.25;
    if (a.dv.perYearMs > 0 && st.dvLeft < 0 && PROPULSION[d.propulsion].isp > 0) { this.fail('fuel', 'Out of propellant', 'The tanks are dry: the spacecraft can no longer hold its orbit.', 'Propellant is a lifetime budget.'); this.end('Out of propellant'); return; }

    // power: ageing cells, a battery worn by every eclipse
    const eol = a.power.bolW * st.arrayFactor * (1 - CELLS[d.cells].degradationPerYear) ** (year + a.orbit.transferDays / 365.25);
    const pf = a.power.requiredW > 0 ? Math.min(1, eol / a.power.requiredW) : 1;
    const dod = a.power.eclipseWh > 0 ? a.power.eclipseWh / Math.max(1e-6, d.batteryWh * st.batteryHealth * 0.9) : 0;
    if (a.orbit.eclipsesPerYear > 0 && dod > 0) st.batteryHealth = Math.max(0.05, st.batteryHealth - (st.batteryWear * 0.2 * a.orbit.eclipsesPerYear) / 365.25 / batteryCycleLife(Math.min(1, dod)));
    if (!st.batteryWarned && st.batteryHealth < 0.75) { st.batteryWarned = true; this.log({ id: 'battery', when: this.when(), t: st.day, title: 'The battery is wearing out', text: `It now holds ${(st.batteryHealth * 100).toFixed(0)}% of its charge.`, kind: 'info', lesson: 'Deep discharges wear batteries out: a bigger battery used gently lasts longer.' }); }
    const eclipseCut = dod > 1 ? 1 - a.orbit.eclipseFrac : 1;
    const dust = st.dustDays && st.dustDays > 0;
    if (dust) st.dustDays! -= 1;
    const safe = st.safeDays > 0;
    const safeShare = Math.min(1, st.safeDays);
    if (safe) { st.safeDays = Math.max(0, st.safeDays - 1); st.downDays += safeShare; }
    const work = (1 - safeShare) * pf * eclipseCut * st.workCap * (1 - st.resetLoss);
    st.scienceDays += 1 - safeShare;

    // data: made, sent, stored or lost
    let generated = 0;
    for (const u of a.data.instruments) {
      const h = st.health[u.id] ?? 1;
      const dustCut = dust && st.dustMode === 'map' && INSTRUMENTS[u.id].kind === 'imager' ? 0 : 1;
      generated += u.gbitPerDay * h * work * dustCut;
    }
    let capacity = a.data.capacityGbitDay * st.linkFactor;
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
    const morale = st.crew ? 0.6 + 0.4 * Math.max(0, st.crew.morale) : 1;
    const q = (expected > 0 ? Math.min(1, send / expected) : work * st.linkFactor * (st.leased ? 0.85 : 1)) * morale;
    for (const id of Object.keys(st.value)) {
      const o = a.scenario.objectives.find((x) => x.id === id)!;
      const useful = d.instruments.filter((i) => (o.value[i] ?? 0) >= 0.5);
      const health = useful.length ? Math.max(...useful.map((i) => st.health[i] ?? 1)) : 1;
      const sharp = useful.some((i) => INSTRUMENTS[i].kind === 'imager') ? 1 / Math.sqrt(st.smear) : 1;
      st.value[id] += (a.value[id] * q * health * sharp) / Math.max(1, this.plannedDays);
    }
    this.sample(dod, eol);
    if (st.crew && !this.crewDay()) return;
    // what was scheduled for today, once the day's work is done: anomalies, flaws that surface, a crew's milestones
    while (this.opsQueue.length && this.opsQueue[0].day <= st.day) {
      this.fire(this.opsQueue.shift()!.spec);
      if (this.pending || this.ended) return;
    }
    if (st.day >= this.plannedDays) this.complete();
  }

  /** A crew's day: air and food, radiation, and where they are. Returns false if the flight ended. */
  private crewDay(): boolean {
    const st = this.st, c = st.crew!, plan = this.a.crew!;
    c.supplyDays -= 1;
    c.doseMsv += GCR_MSV_PER_DAY;
    const atMoon = plan.orbit ? !!st.inLunarOrbit : st.day === plan.outboundDays && !st.skipMoon;
    if (atMoon) c.moonDays += 1;
    const left = this.plannedDays - st.day;
    if (!st.suppliesWarned && c.supplyDays < left) {
      st.suppliesWarned = true;
      this.log({ id: 'supplies', when: this.when(), t: st.day, title: 'Supplies will not last', text: `${c.supplyDays.toFixed(1)} days of air, water and food for ${left} more days of flight.`, kind: 'info', lesson: 'Consumables are counted in crew-days, and every problem on the way eats into them.' });
    }
    if (c.supplyDays < -0.5) {
      c.alive = false;
      this.fail('air', 'Out of air', 'The last canister is used up with the Earth still a day away.', 'Apollo 13 came home because of margins nobody expected to need. Days of air, water and food beyond the plan are what a crew lives on when the plan fails.');
      this.end('Loss of crew');
      return false;
    }
    return true;
  }

  private complete() {
    const a = this.a, st = this.st;
    if (st.crew) {
      if (!a.crew!.shieldOk) {
        st.crew.alive = false;
        this.fail('entry', 'Burn-through', 'The capsule hit the air at 11 km/s behind a heat shield built for 8. It did not reach the sea.', 'Heating on entry grows with about the cube of the speed: coming home from the Moon is nearly three times as hot as from low orbit.');
        this.end('Loss of crew');
        return;
      }
      this.log({ id: 'end', when: this.when(), t: st.day, title: 'Splashdown', text: `Three parachutes, then the sea. ${a.crew!.callSign} is home after ${this.plannedDays} days, and so is everyone who left in it.`, kind: 'milestone', art: 'splash' });
      this.end('Mission complete', false);
      return;
    }
    this.log({ id: 'end', when: this.when(), t: st.day, title: 'Mission complete', text: `${a.design.plannedYears} years of operations completed.`, kind: 'milestone' });
    this.end('Mission complete', false);
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
    // the rocket is paid for once it is on the pad
    const launched = this.launchStep === 2;
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
