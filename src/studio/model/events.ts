/**
 * Everything that can ask the team for a decision or a hands-on step while the mission is built and flown.
 * - Random events: late parts, cost growth, storms, debris, failures (docs/03 §6).
 * - The test campaign: each planned test is a step somebody runs; a flaw it finds is a decision.
 * - Launch and commissioning: countdown, unfolding, first signal, the braking burn, first light.
 * - Flaws that flew: what an untested or waived flaw does in orbit.
 * - Anomalies: a problem shown as telemetry. One hidden cause explains the readings; the fix that matches it
 *   works within the day, a wrong guess costs days and leaves a scar, and "safe mode and investigate" is slow
 *   but sure. This is how flight controllers really work: compare channels until one explanation fits.
 * - Crewed flights: the checkout, the go/no-go for the Moon, the burns, the storm shelter, the splashdown.
 */
import type { Analysis } from './analyze';
import { ADCS, COMPUTERS, LAUNCHERS, PLATFORMS, PROPULSION, STATIONS } from './catalog';
import { SHELTERS } from './crew';
import { INSTRUMENTS, type InstrumentId } from './instruments';
import type { EventOption, MissionRun, Reading, SimEvent, SimState } from './simulate';
import { CLEAR_RAINY, MONTHS, monthOf, pct } from './sky';
import { DEFECTS, TESTS, foundText, type DefectId, type TestId } from './tests';
import { G0, MARS_YEAR_DAYS, type RoleId } from './types';

export type Scored = EventOption & { quality: number };

export interface Spec {
  id: string;
  title: string;
  phase: 'development' | 'operations' | 'scripted';
  /** The desk that owns it: in a team game its player runs the step, or speaks first on the decision. */
  role?: RoleId;
  applies: (a: Analysis) => boolean;
  /** Development: chance it happens at all. Operations: expected number a year. Scripted: unused. */
  rate: (a: Analysis, st: SimState) => number;
  /** Draws whatever is hidden (an anomaly's cause) before the text is written. */
  prepare?: (r: MissionRun) => void;
  text: (a: Analysis, st: SimState) => string;
  telemetry?: (a: Analysis, st: SimState) => Reading[];
  options?: (a: Analysis, st: SimState) => Scored[];
  resolve: (r: MissionRun, option: string | undefined) => string;
  lesson: string;
  kind?: SimEvent['kind'];
  /** A hands-on step: it waits for its one button, and is not judged. */
  action?: boolean;
  /** Never becomes a standing flight rule (each time is different). */
  noRule?: boolean;
  /** The picture the screen shows with it. */
  art?: string;
}

const pick = <T,>(r: MissionRun, xs: T[]): T => xs[Math.floor(r.rng.next() * xs.length) % xs.length];
const lowEarthOf = (a: Analysis) => a.scenario.body === 'earth' && a.design.orbit.type !== 'geo';
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const f1 = (x: number) => (Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1));
const scripted = { phase: 'scripted' as const, applies: () => true, rate: () => 0 };

export const EVENTS: Spec[] = [
  // ------------------------------------------------------------------ development
  {
    id: 'late-part', title: 'A supplier is late', phase: 'development', role: 'resources',
    applies: () => true,
    rate: () => 0.55,
    text: (a) => `The ${a.time.longest} will arrive about 3 months late. The rest of the spacecraft is waiting for it.`,
    options: (a, st) => {
      const rush = 0.06 * a.cost.developmentM;
      const wouldMiss = !!a.scenario.windows && (a.scenario.windows.find((w) => w >= st.readyMonth + 3) ?? Infinity) > st.launchMonth;
      return [
        { id: 'wait', label: 'Wait for it (ready 3 months later)', explain: wouldMiss ? 'Three months late misses the launch window: the next one is 26 months later.' : 'The team waits; every month of delay costs salaries.', quality: wouldMiss ? 0.1 : 0.55 },
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
      const moved = r.slip(3);
      r.spend(0.02 * a.cost.developmentM * moved);
      return moved > 0 ? `Launch moves to month ${f1(r.st.launchMonth)}; the team's salaries cost $${(0.02 * a.cost.developmentM * moved).toFixed(1)}M more.` : 'The delay was absorbed by the wait for the launch.';
    },
    lesson: 'Schedule margin and a money reserve are two ways to absorb the same surprise.',
  },
  {
    id: 'cost-growth', title: 'Costs grow', phase: 'development', kind: 'info', role: 'resources',
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
  {
    // JPL keeps >= 35% growth allowance and margin at the point-design stage (Concept Maturity Levels paper);
    // NASA's handbook: margins are allocated early and used up on the way to launch. The size is our estimate.
    id: 'mass-growth', title: 'Parts arrive heavier', phase: 'development', role: 'spacecraft',
    applies: (a) => a.mass.dryKg > 0 && a.mass.limitKg > 0,
    rate: () => 0.45,
    prepare: (r) => { r.st.growthKg = r.a.mass.dryKg * (0.04 + 0.08 * r.rng.next()); },
    text: (a, st) => {
      const g = st.growthKg ?? 0, spare = a.mass.limitKg - a.mass.wetKg;
      return `Weighed at last, the parts come in ${f1(g)} kg over their estimates, beyond the growth allowance (${f1((g / a.mass.dryKg) * 100)}% of the dry mass). ${spare >= g ? `${f1(spare)} kg of lift were spare.` : `Only ${f1(Math.max(0, spare))} kg of lift were spare.`}`;
    },
    options: (a, st) => {
      const g = st.growthKg ?? 0, spare = a.mass.limitKg - a.mass.wetKg;
      if (spare >= g) return [];
      const cube = PLATFORMS[a.design.platform].cubesat;
      const fixM = (cube ? 0.02 : 0.04) * a.cost.developmentM;
      const out: Scored[] = [{ id: 'lighten', label: `Lighten the design (+2 months, $${fixM.toFixed(1)}M)`, explain: cube ? 'The CubeSat Design Specification\'s mass limit is hard: the dispenser will not take a heavier CubeSat.' : 'Thinner panels, lighter brackets, a smaller harness: slow and costly, but nothing is lost.', quality: 0.75 }];
      const prop = PROPULSION[a.design.propulsion];
      if (!cube && prop.isp > 0 && a.mass.propellantKg > g) {
        const loss = prop.isp * G0 * Math.log((a.mass.dryKg + g) / a.mass.dryKg);
        out.push({ id: 'offload', label: `Load ${f1(g)} kg less propellant (−${loss.toFixed(0)} m/s)`, explain: 'No delay, but every m/s you give up is orbit-keeping or a burn you cannot do later.', quality: a.dv.capabilityMs - loss >= a.dv.totalMs ? 0.6 : 0.15 });
      }
      return out;
    },
    resolve: (r, o) => {
      const a = r.a, g = r.st.growthKg ?? 0;
      if (a.mass.limitKg - a.mass.wetKg >= g) return 'The mass margin absorbed it: that is what it is for.';
      if (o === 'offload') {
        const prop = PROPULSION[a.design.propulsion];
        const loss = prop.isp * G0 * Math.log((a.mass.dryKg + g) / a.mass.dryKg);
        r.st.dvLeft -= loss;
        return `${f1(g)} kg less propellant: ${loss.toFixed(0)} m/s less to spend in flight.`;
      }
      const fixM = (PLATFORMS[a.design.platform].cubesat ? 0.02 : 0.04) * a.cost.developmentM;
      r.spend(fixM);
      const moved = r.slip(2);
      return `Two months of redesign and $${fixM.toFixed(1)}M later the spacecraft fits again.${moved > 0.01 ? ` Launch moves to month ${f1(r.st.launchMonth)}.` : ''}`;
    },
    lesson: 'Every spacecraft gains weight while it is built. JPL keeps at least 35% of the mass as growth allowance and margin at the concept stage for exactly this.',
  },
  // ------------------------------------------------------------------ operations
  {
    id: 'solar-storm', title: 'Solar storm warning', phase: 'operations', role: 'director',
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
          const id = pick(r, ids);
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
    id: 'debris', title: 'Collision warning', phase: 'operations', role: 'spacecraft',
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
    id: 'wheel', title: 'A reaction wheel failed', phase: 'operations', role: 'spacecraft',
    applies: (a) => a.design.adcs === 'wheels' || a.design.adcs === 'agile',
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
    id: 'computer', title: 'Computer failure', phase: 'operations', kind: 'failure', role: 'spacecraft',
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
    id: 'station', title: 'Ground station outage', phase: 'operations', role: 'comms',
    applies: (a) => lowEarthOf(a) && a.design.stations.length > 0,
    rate: () => 0.35,
    text: (a) => `${STATIONS[a.design.stations[0]].short} is down for 10 days of repairs.`,
    options: () => [
      { id: 'rent', label: 'Rent a commercial station ($0.15M)', explain: 'Data keeps flowing.', quality: 0.7 },
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
    id: 'flood', title: 'Floods in the Cuanza valley', phase: 'operations', role: 'science',
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
      // floods come in the rainy months, when Landsat finds Angola clear far less often than over a year
      const measured = !!r.a.scenario.clearSkyByMonth;
      const sky = measured ? CLEAR_RAINY : (r.a.scenario.clearSky ?? 1);
      const ok = sar || r.rng.next() < (r.a.design.adcs === 'agile' ? 0.7 : r.a.design.instruments.includes('msWide') ? 0.5 : 0.15) * sky * 1.6;
      r.st.safeDays += 0.3;
      if (ok) { r.st.bonus[r.a.design.primary] = (r.st.bonus[r.a.design.primary] ?? 0) + 0.05; return 'Images delivered in time: rescue teams used them to reach three cut-off villages.'; }
      return sar ? 'Re-tasked, but the radar could not reach the valley in time.' : `Clouds hid the valley on the only pass: no usable image.${measured ? ` In the rainy months Landsat 8 and 9 find Angola clear on only ${pct(CLEAR_RAINY)} of passes.` : ''}`;
    },
    lesson: 'Radar sees through the storm clouds that come with floods; a camera often cannot.',
  },
  {
    id: 'degrade', title: 'An instrument is ageing', phase: 'operations', kind: 'failure', role: 'science',
    applies: (a) => a.design.instruments.length > 0,
    rate: (a) => 0.04 * a.design.instruments.length,
    text: () => 'An instrument\'s detector is wearing out faster than expected.',
    resolve: (r) => {
      const ids = (Object.keys(r.st.health) as InstrumentId[]).filter((id) => (r.st.health[id] ?? 0) > 0);
      if (!ids.length) return 'Nothing left to degrade.';
      const id = pick(r, ids);
      r.st.health[id] = Math.max(0, (r.st.health[id] ?? 1) - 0.3);
      return `The ${INSTRUMENTS[id].short} lost 30% of its quality.`;
    },
    lesson: 'Instruments age in space; flying more than one gives the mission a fallback.',
  },
  {
    id: 'lease', title: 'A neighbour wants capacity', phase: 'operations', role: 'resources',
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
    id: 'eclipse', title: 'A lunar eclipse', phase: 'operations', role: 'spacecraft',
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
    id: 'lander', title: 'A lander needs an extra pass', phase: 'operations', role: 'comms',
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
    id: 'dust', title: 'A global dust storm', phase: 'operations', role: 'science',
    applies: (a) => a.scenario.body === 'mars',
    rate: () => 365.25 / MARS_YEAR_DAYS * 0.35,
    text: () => 'A dust storm is spreading over the whole planet. The surface will be hidden for about two months.',
    options: () => [
      { id: 'climate', label: 'Switch to studying the storm', explain: 'Weather science gains; surface mapping pauses.', quality: 0.85 },
      { id: 'map', label: 'Keep mapping', explain: 'Images of the ground will show only dust.', quality: 0.25 },
    ],
    resolve: (r, o) => {
      r.st.dustDays = 60;
      if (o === 'climate') {
        if (r.a.value.climate !== undefined) r.st.bonus.climate = (r.st.bonus.climate ?? 0) + 0.08;
        r.st.dustMode = 'climate';
        return 'Two months of storm science: how dust heats the atmosphere.';
      }
      r.st.dustMode = 'map';
      return 'Two months of mapping a yellow haze.';
    },
    lesson: 'Plans change with nature: a flexible team turns a problem into a discovery.',
  },
];

// ====================================================================== the test campaign
/** One planned ground test: a step its owner runs. It passes, or it finds the flaw of its kind. */
export const testStep = (t: TestId): Spec => ({
  ...scripted, id: `test:${t}`, title: TESTS[t].name, role: TESTS[t].role, action: true, art: t,
  text: () => `${TESTS[t].explain} It is looking for: ${lower(TESTS[t].catches)}`,
  options: () => [{ id: 'run', label: `Run the ${TESTS[t].name.toLowerCase()}`, explain: `${TESTS[t].weeks} week${TESTS[t].weeks === 1 ? '' : 's'} in the test hall.`, quality: 1 }],
  resolve: (r) => {
    const flaw = TESTS[t].finds;
    if (!r.flaws.has(flaw)) return 'Passed. This kind of flaw is not in the build.';
    r.next.unshift(found(flaw));
    return `Failed. ${foundText(flaw, PLATFORMS[r.a.design.platform].cubesat)}`;
  },
  lesson: DEFECTS[TESTS[t].finds].lesson,
});

/** A flaw found on the ground: fix it (weeks and money) or fly with it. */
const found = (f: DefectId): Spec => {
  const test = (Object.keys(TESTS) as TestId[]).find((t) => TESTS[t].finds === f)!;
  const misses = (a: Analysis, st: SimState) => !!a.scenario.windows && (a.scenario.windows.find((w) => w >= st.readyMonth + DEFECTS[f].fixWeeks / 4.345) ?? Infinity) > st.launchMonth;
  return {
    ...scripted, id: `found:${f}`, title: `The ${TESTS[test].name.toLowerCase()} found a flaw`, role: TESTS[test].role, noRule: true, art: test,
    text: (a) => foundText(f, PLATFORMS[a.design.platform].cubesat),
    options: (a, st) => {
      const miss = misses(a, st);
      return [
        { id: 'fix', label: `Fix it and test again (+${DEFECTS[f].fixWeeks} weeks, $${(DEFECTS[f].fixShare * a.cost.developmentM).toFixed(1)}M)`, explain: miss ? 'The fix misses the launch window: the next one is 26 months later.' : 'The safe choice: this is what tests are for.', quality: miss ? 0.6 : 0.9 },
        { id: 'fly', label: 'Fly as it is', explain: 'No delay and no cost, but the flaw rides along.', quality: miss ? 0.35 : 0.15 },
      ];
    },
    resolve: (r, o) => {
      if (o !== 'fix') return 'Accepted as it is. Nobody knows what it will do in flight.';
      r.spend(DEFECTS[f].fixShare * r.a.cost.developmentM);
      const moved = r.slip(DEFECTS[f].fixWeeks / 4.345);
      r.flaws.delete(f);
      return `Fixed, and the test passed the second time. ${moved > 0.01 ? `Launch moves to month ${f1(r.st.launchMonth)}.` : 'The wait for the launch absorbed the delay.'}`;
    },
    lesson: DEFECTS[f].lesson,
  };
};

// ====================================================================== the licences
/** NASA CubeSat 101: file within 30 days of getting a launch; no licence at integration, no flight. */
const IMAGING = new Set(['imager', 'sar', 'spectrometer', 'sounder']);
const imagesEarth = (a: Analysis) => a.scenario.body === 'earth' && a.design.instruments.some((i) => IMAGING.has(INSTRUMENTS[i].kind));
export const LICENCE: Spec = {
  ...scripted, id: 'licence', title: 'File the licences', role: 'comms', action: true, art: 'signal',
  text: (a) => {
    const papers = [
      'a radio licence (the frequencies are coordinated through the ITU by your national regulator; in the US the FCC wants at least 90 days)',
      ...(imagesEarth(a) ? ['an Earth-imaging licence (in the US, NOAA takes about 120 days, and any change restarts the clock)'] : []),
      ...(a.debris.lowEarth ? ['an orbital debris assessment: proof that the spacecraft comes down within 25 years and burns up on the way'] : []),
    ];
    return `The launch is booked. NASA's CubeSat 101 says to file the paperwork within 30 days: ${papers.join('; ')}. A spacecraft without its licences at integration stays on the ground.`;
  },
  options: () => [{ id: 'file', label: 'File the paperwork', explain: 'Licences take 4–6 months. Filed now, they arrive before the spacecraft ships.', quality: 1 }],
  resolve: (r) => {
    const a = r.a;
    if (!a.debris.ruleOk) {
      const c = PLATFORMS[a.design.platform].cubesat ? 0.05 : 0.4;
      r.spend(c);
      const moved = r.slip(2);
      return `The debris assessment fails: with no engine the spacecraft would stay up about ${a.debris.reentryYears.toFixed(0)} years. The regulator will not license the radio until a drag sail is added to bring it down in time: $${c.toFixed(2)}M and two months.${moved > 0.01 ? ` Launch moves to month ${f1(r.st.launchMonth)}.` : ''}`;
    }
    return `Filed. ${imagesEarth(a) ? 'The radio and imaging licences' : 'The radio licence'}${a.debris.lowEarth ? ' and the debris assessment' : ''} come back approved a few months later, well before the spacecraft ships.`;
  },
  lesson: 'Late licences are one of the classic reasons CubeSats miss their ride: the paperwork is part of the engineering.',
};

// ====================================================================== launch and commissioning
export const WEATHER: Spec = {
  ...scripted, id: 'weather', title: 'Launch day: the winds are high', role: 'director', noRule: true, art: 'launch',
  text: () => 'The countdown is at T−2 hours. High-altitude winds are just inside the rocket\'s limit, and rising.',
  telemetry: () => [
    { label: 'Winds at 12 km', value: '94% of the limit', state: 'warn' },
    { label: 'Rocket', value: 'Fuelled, all green', state: 'ok' },
    { label: 'Spacecraft', value: 'On internal power, all green', state: 'ok' },
    { label: 'Next opportunity', value: 'In 2 days', state: 'ok' },
  ],
  options: (a) => [
    { id: 'scrub', label: `Scrub and try again in two days ($${(0.004 * a.launch.priceM + 0.02).toFixed(2)}M)`, explain: 'Draining the rocket and keeping the teams on site costs money. The rules exist because rockets have been lost to wind.', quality: 0.9 },
    { id: 'go', label: 'Go: it is inside the limit', explain: 'Legal, but with no margin left if the wind rises during the count.', quality: 0.3 },
  ],
  resolve: (r, o) => {
    if (o === 'scrub') { r.spend(0.004 * r.a.launch.priceM + 0.02); return 'Scrubbed. Two days later the sky is calm.'; }
    r.st.launchRisk += 0.03;
    return 'The count continues.';
  },
  lesson: 'Launch rules are written from past failures: "inside the limit with no margin" is how most of them started.',
};

export const LAUNCH: Spec = {
  ...scripted, id: 'launch', title: 'Launch', role: 'director', action: true, art: 'launch',
  text: (a) => `${a.design.name} is on top of the ${LAUNCHERS[a.design.launcher].name}, fuelled and counting down. ${a.crew ? `${a.crew.size} astronaut${a.crew.size === 1 ? ' is' : 's are'} strapped in. ` : ''}The flight readiness review is closed and every desk has said go.`,
  options: () => [{ id: 'go', label: 'Launch', explain: 'There is no way to call a rocket back.', quality: 1 }],
  resolve: (r) => r.ascent(),
  lesson: 'Every rocket has a track record; insurance turns a lost satellite into a second chance.',
};

export const DEPLOY: Spec = {
  ...scripted, id: 'deploy', title: 'Unfold the spacecraft', role: 'spacecraft', action: true, art: 'deploy',
  text: (a) => PLATFORMS[a.design.platform].cubesat
    ? `${a.design.name} has left its dispenser. CubeSat rules kept it switched off until that moment, and keep everything folded for 30 minutes so nothing can snag the rocket or its neighbours. The 30 minutes are up: ${a.design.antenna === 'dish' ? 'the wings and the dish' : 'the wings'} must open before the battery runs down.`
    : `The rocket has let go. ${a.design.name} is tumbling slowly on battery power, folded as it was for launch. ${a.design.antenna === 'dish' ? 'The solar wings and the dish' : 'The solar wings'} must open before the battery runs down.`,
  options: () => [{ id: 'go', label: 'Fire the release bolts', explain: 'Each hinge has moved exactly once before: in the test hall, if you tested it.', quality: 1 }],
  resolve: (r) => {
    if (r.flaws.has('deploy')) { r.next.unshift(FLAW_DEPLOY); return 'One wing latched. The other stopped halfway.'; }
    return 'Everything latched. The arrays are turned to the Sun and making power.';
  },
  lesson: DEFECTS.deploy.lesson,
};

export const SIGNAL: Spec = {
  ...scripted, id: 'signal', title: 'Listen for the first signal', role: 'comms', action: true, art: 'signal',
  text: (a) => {
    const where = `${STATIONS[a.design.stations[0]]?.short ?? 'The ground station'} is pointed at the place in the sky where the spacecraft should rise.`;
    if (PLATFORMS[a.design.platform].cubesat) return `${where} The radio had to stay silent for its first 45 minutes. ${LAUNCHERS[a.design.launcher].rideshare ? 'Dozens of satellites left the same rocket: tracking data take two days to a week, and working out which object is yours can take weeks. ' : ''}Until it answers, nobody knows if it is alive.`;
    return `${where} Until it answers, nobody knows if it is alive.`;
  },
  options: () => [{ id: 'go', label: 'Send the first command', explain: 'A short "are you there?" and a wait for the reply.', quality: 1 }],
  resolve: (r) => {
    if (r.flaws.has('rf')) { r.next.unshift(FLAW_RF); return 'A carrier, but no words: the station cannot read what the spacecraft is saying.'; }
    return 'Acquisition of signal. Telemetry is flowing: temperatures, voltages, attitude, all inside their limits.';
  },
  lesson: DEFECTS.rf.lesson,
};

export const INSERTION: Spec = {
  ...scripted, id: 'insertion', title: 'The braking burn', role: 'director', action: true, art: 'burn',
  text: (a) => `${a.design.name} is falling toward ${a.orbit.body.name} too fast to stay. The critical event readiness review has signed off the ${a.scenario.body === 'mars' ? 'Mars' : 'lunar'} orbit insertion: the engine must slow the spacecraft by ${(a.dv.lines.find((l) => /insertion/i.test(l.name))?.value ?? 0).toFixed(0)} m/s at exactly the right moment${a.scenario.body === 'mars' ? ', behind the planet, with no contact' : ''}.`,
  telemetry: (a, st) => [
    { label: 'Δv needed for the burn', value: `${(a.dv.lines.find((l) => /insertion/i.test(l.name))?.value ?? 0).toFixed(0)} m/s`, state: 'ok' },
    { label: 'Δv in the tanks', value: `${Math.max(0, st.dvLeft).toFixed(0)} m/s`, state: st.dvLeft >= (a.dv.lines.find((l) => /insertion/i.test(l.name))?.value ?? 0) ? 'ok' : 'bad' },
    { label: 'Engine', value: PROPULSION[a.design.propulsion].isp > 0 ? 'Armed' : 'None on board', state: PROPULSION[a.design.propulsion].isp > 0 ? 'ok' : 'bad' },
  ],
  options: () => [{ id: 'go', label: 'Commit the burn', explain: 'The commands are loaded; the spacecraft does the rest alone.', quality: 1 }],
  resolve: (r) => {
    const need = r.a.dv.lines.find((l) => /insertion/i.test(l.name))?.value ?? 0;
    if (r.st.dvLeft + 1e-6 < need) {
      r.fail('missed', 'Flew past', `The tanks held ${Math.max(0, r.st.dvLeft).toFixed(0)} m/s and the burn needed ${need.toFixed(0)}: ${r.a.orbit.body.name} bent the path and the spacecraft sailed on into orbit around the Sun.`, 'Arriving is not staying: the braking burn is the biggest single use of propellant on a planetary mission.');
      r.end('Missed the orbit');
      return 'The engine ran dry before the spacecraft was captured.';
    }
    r.st.dvLeft -= need;
    return `Burn complete: captured into orbit around ${r.a.orbit.body.name}.`;
  },
  lesson: 'Arriving is not staying: the braking burn is the biggest single use of propellant on a planetary mission.',
};

export const FIRSTLIGHT: Spec = {
  ...scripted, id: 'firstlight', title: 'First light', role: 'science', action: true, art: 'light',
  text: (a) => `The spacecraft is stable and talking. Time to switch on what the customer paid for: ${a.design.instruments.map((i) => INSTRUMENTS[i].short).join(', ')}.`,
  options: () => [{ id: 'go', label: 'Switch on the payload', explain: 'One instrument at a time, checking each against its ground test data.', quality: 1 }],
  resolve: (r) => {
    const hurt = (Object.keys(r.st.health) as InstrumentId[]).filter((id) => (r.st.health[id] ?? 1) < 1);
    return (hurt.length ? `The payload is on. ${hurt.map((id) => INSTRUMENTS[id].short).join(', ')} is not what it was on the ground: ${hurt.map((id) => `${Math.round((r.st.health[id] ?? 1) * 100)}%`).join(', ')} of its quality.` : 'The payload is on and its first data match the ground tests.') + firstPicture(r);
  },
  lesson: 'Commissioning compares the spacecraft in orbit with the one that was tested: any difference is a clue.',
};

/** A camera's first look at Angola meets the season: how clear Landsat 8 and 9 usually find Angola in that month. */
function firstPicture(r: MissionRun): string {
  const sky = r.a.scenario.clearSkyByMonth;
  if (!sky || !r.a.design.instruments.some((id) => INSTRUMENTS[id].cloudLimited)) return '';
  const m = monthOf(r.st.launchMonth + Math.max(0, r.st.day) / 30.44);
  return sky[m] < 0.6
    ? ` It is ${MONTHS[m]}, the rainy season: Landsat 8 and 9 find only ${pct(sky[m])} of Angola clear in ${MONTHS[m]}, so the first pictures are mostly cloud. Radar would not care.`
    : ` It is ${MONTHS[m]}: Landsat 8 and 9 find ${pct(sky[m])} of Angola clear in ${MONTHS[m]}, so the first pictures show the ground.`;
}

export const COMMISSIONED: Spec = {
  ...scripted, id: 'arrive', title: 'In the operating orbit', kind: 'milestone',
  text: () => 'Commissioning complete. At the post-launch assessment review the team hands the spacecraft over to routine operations: the mission begins.',
  resolve: (r) => { r.operate(); return ''; },
  lesson: '',
};

// ====================================================================== flaws that flew
const FLAW_DEPLOY: Spec = {
  ...scripted, id: 'flaw:deploy', title: 'A solar wing is stuck', role: 'spacecraft', noRule: true, art: 'deploy',
  text: () => 'One wing stopped at 60° and will not move. The spacecraft has half its power.',
  telemetry: () => [
    { label: 'Wing 1', value: 'Latched', state: 'ok' },
    { label: 'Wing 2', value: 'Stopped at 60°', state: 'bad' },
    { label: 'Wing 2 hinge temperature', value: '−45 °C (it is in shadow)', state: 'warn' },
    { label: 'Array power', value: '50% of expected', state: 'bad' },
  ],
  options: (a) => [
    { id: 'warm', label: 'Turn the hinge to the Sun, then fire the release again', explain: 'A cold hinge is a stiff hinge. Costs a day, and works more often than not.', quality: 0.9 },
    { id: 'shake', label: 'Shake it loose with a quick turn', explain: 'Fast, but a jolt can bend a hinge for good.', quality: 0.4 },
    { id: 'accept', label: 'Fly on half power', explain: a.power.marginPct >= 100 ? 'The arrays were sized with room to spare: half may be enough.' : 'Half the power is half the work.', quality: a.power.marginPct >= 100 ? 0.7 : 0.3 },
  ],
  resolve: (r, o) => {
    if (o === 'accept') { r.st.arrayFactor = 0.5; return 'The wing stays where it is: half power for the whole mission.'; }
    const x = r.rng.next();
    if (o === 'warm') {
      r.st.safeDays += 1;
      if (x < 0.7) return 'After six hours in sunlight the hinge let go. The wing is latched: full power.';
      r.st.arrayFactor = 0.5;
      return 'Warm, and still stuck. The wing stays at 60°: half power.';
    }
    if (x < 0.4) return 'The jolt freed it: the wing is latched.';
    if (x < 0.65) { r.st.arrayFactor = 0.35; return 'The jolt bent the hinge. The wing swung back and now shades the body: 35% power.'; }
    r.st.arrayFactor = 0.5;
    return 'Still stuck: half power.';
  },
  lesson: DEFECTS.deploy.lesson,
};

const FLAW_RF: Spec = {
  ...scripted, id: 'flaw:rf', title: 'The ground cannot read the spacecraft', role: 'comms', noRule: true, art: 'signal',
  text: () => 'The station hears the spacecraft loud and clear, and cannot decode a word. The two radios were never tested together.',
  telemetry: () => [
    { label: 'Carrier signal', value: 'Strong', state: 'ok' },
    { label: 'Frame lock', value: 'None: data format not recognised', state: 'bad' },
    { label: 'Spacecraft beacon tone', value: 'Healthy', state: 'ok' },
  ],
  options: () => [
    { id: 'ground', label: 'Rewrite the station software to match (10 days)', explain: 'The spacecraft cannot be changed now; the ground can. Ten days with no data.', quality: 0.9 },
    { id: 'slow', label: 'Switch to the simple backup format', explain: 'Works today, at half the data rate for the whole mission.', quality: 0.35 },
  ],
  resolve: (r, o) => {
    if (o === 'ground') { r.st.safeDays += 10; r.spend(0.01 * r.a.cost.developmentM); return 'Ten days later the screens fill with telemetry.'; }
    r.st.linkFactor *= 0.5;
    return 'The backup format works. Every pass now carries half the data.';
  },
  lesson: DEFECTS.rf.lesson,
};

export const FLAW_THERMAL: Spec = {
  ...scripted, id: 'flaw:thermal', title: 'The battery runs hot', role: 'spacecraft', noRule: true, art: 'tvac',
  text: () => 'In full sunlight the battery sits 15 °C above what the thermal model promised. Heat ages a battery fast.',
  telemetry: () => [
    { label: 'Battery temperature', value: '41 °C (limit 30 °C)', state: 'bad' },
    { label: 'Radiator', value: 'Working, at its limit', state: 'warn' },
    { label: 'Battery heaters', value: 'Off', state: 'ok' },
  ],
  options: (a) => {
    const cycles = a.orbit.eclipsesPerYear > 0;
    return [
      { id: 'turn', label: 'Turn the hot side away from the Sun between jobs', explain: 'Costs about 15% of the working time.', quality: cycles ? 0.8 : 0.5 },
      { id: 'accept', label: 'Let it run hot', explain: cycles ? 'Nothing lost today; the battery wears out three times faster.' : 'This orbit almost never uses the battery, so wear matters little.', quality: cycles ? 0.3 : 0.8 },
    ];
  },
  resolve: (r, o) => {
    if (o === 'turn') { r.st.workCap = 0.85; return 'The battery is back under its limit; the spacecraft spends part of each orbit turned away from its work.'; }
    r.st.batteryWear = 3;
    return 'The battery stays hot.';
  },
  lesson: DEFECTS.thermal.lesson,
};

export const FLAW_SOFTWARE: Spec = {
  ...scripted, id: 'flaw:software', title: 'The computer keeps restarting', role: 'director', noRule: true, art: 'rehearsal',
  text: () => 'For the third time the computer has reset itself and dropped the spacecraft into safe mode. Each time it had been running for about three days.',
  telemetry: () => [
    { label: 'Memory in use', value: 'Climbs 30% a day, reset at 100%', state: 'bad' },
    { label: 'Time between resets', value: '3 days, like clockwork', state: 'bad' },
    { label: 'Radiation monitor', value: 'Quiet', state: 'ok' },
  ],
  options: () => [
    { id: 'patch', label: 'Write, test and upload a fix (14 days in safe mode)', explain: 'Two weeks lost now, and the problem is gone.', quality: 0.9 },
    { id: 'live', label: 'Restart it by hand each time', explain: 'About one working day in ten is lost, for the rest of the mission.', quality: 0.3 },
  ],
  resolve: (r, o) => {
    if (o === 'patch') { r.st.safeDays += 14; return 'The patched software has now run for a month without a reset.'; }
    r.st.resetLoss = 0.1;
    return 'The team restarts it every three days.';
  },
  lesson: DEFECTS.software.lesson,
};

export const FLAW_ECLSS: Spec = {
  ...scripted, id: 'flaw:eclss', title: 'The air scrubber is losing capacity', role: 'science', noRule: true, art: 'eclss',
  text: () => 'Carbon dioxide in the cabin is creeping up. The scrubber removes a third less than it did on launch day: exactly what an endurance test on the ground would have shown.',
  telemetry: () => [
    { label: 'CO₂ in the cabin', value: '5.1 mmHg and rising (limit 7.6)', state: 'warn' },
    { label: 'Scrubber capacity', value: '67% of launch day', state: 'bad' },
    { label: 'Crew', value: 'Mild headaches reported', state: 'warn' },
  ],
  options: () => [
    { id: 'canisters', label: 'Break out the emergency canisters', explain: 'Clean air at once. Uses supplies that were the margin for a late return: about two days of it.', quality: 0.85 },
    { id: 'rest', label: 'Cut exercise and work to breathe less', explain: 'Saves the canisters; the crew gets less done and feels worse.', quality: 0.45 },
  ],
  resolve: (r, o) => {
    if (o === 'canisters') { if (r.st.crew) r.st.crew.supplyDays -= 2; return 'CO₂ falls back to normal within the hour. Two days of margin are gone.'; }
    r.st.workCap = Math.min(r.st.workCap, 0.7);
    return 'The crew moves slowly for the rest of the flight; a third of the planned work is dropped.';
  },
  lesson: DEFECTS.eclss.lesson,
};

// ====================================================================== anomalies: read the telemetry
type V = [string, Reading['state']];
interface AnomalyDef {
  id: string;
  title: string;
  role: RoleId;
  art?: string;
  applies: (a: Analysis) => boolean;
  text: (a: Analysis) => string;
  channels: string[];
  /** Each cause, the readings it produces (one per channel) and the fix that cures it. */
  causes: { id: string; fix: string; values: V[]; truth: string }[];
  fixes: { id: string; label: string; explain: string }[];
  /** What a wrong guess leaves behind. */
  scar: (r: MissionRun) => string;
  lesson: string;
}

const ok = (s = 'Normal'): V => [s, 'ok'];
const anomaly = (x: AnomalyDef): Spec => {
  const cause = (st: SimState) => x.causes.find((c) => c.id === st.cause[x.id]) ?? x.causes[0];
  return {
    ...scripted, id: `anomaly:${x.id}`, title: x.title, role: x.role, noRule: true, art: x.art ?? 'anomaly', applies: x.applies,
    prepare: (r) => { r.st.cause[x.id] = pick(r, x.causes).id; },
    text: (a) => x.text(a),
    telemetry: (_, st) => x.channels.map((label, i) => ({ label, value: cause(st).values[i][0], state: cause(st).values[i][1] })),
    options: (_, st) => [
      ...x.fixes.map((f) => ({ ...f, quality: f.id === cause(st).fix ? 0.95 : 0.25 })),
      { id: 'ask', label: 'Safe mode, and a week to investigate', explain: 'Everything off but the essentials while engineers work through the data. Slow, and it always finds the cause.', quality: 0.6 },
    ],
    resolve: (r, o) => {
      const c = cause(r.st);
      if (o === c.fix) { r.st.safeDays += 1; return `${c.truth} Fixed within the day.`; }
      if (o === 'ask') { r.st.safeDays += 8; return `Eight days in safe mode. ${c.truth} Fixed.`; }
      r.st.safeDays += 5;
      return `That was not it. ${c.truth} ${x.scar(r)}`;
    },
    lesson: x.lesson,
  };
};

const hasOptics = (a: Analysis) => a.design.instruments.some((i) => ['imager', 'spectrometer'].includes(INSTRUMENTS[i].kind));

export const ANOMALIES: Spec[] = [
  anomaly({
    id: 'power', title: 'Array power has dropped', role: 'spacecraft',
    applies: (a) => a.design.arrayM2 > 0,
    text: () => 'Between two passes the solar arrays lost about a third of their power. The battery is covering the gap, for now.',
    channels: ['Array current', 'Sun angle on the arrays', 'Array temperature', 'Power controller'],
    causes: [
      { id: 'string', fix: 'isolate', truth: 'A string of cells had shorted.', values: [['One string reads zero, the others are normal', 'bad'], ok('2° off the Sun (normal)'), ok(), ok('Answering')] },
      { id: 'pointing', fix: 'repoint', truth: 'The array drive had lost its reference and turned the wings away from the Sun.', values: [['Every string low by the same share', 'warn'], ['34° off the Sun', 'bad'], ['Colder than usual', 'warn'], ok('Answering')] },
      { id: 'controller', fix: 'reboot', truth: 'The power controller had frozen and was no longer tracking the arrays\' best working point.', values: [['Frozen at one value since 02:14', 'bad'], ok('2° off the Sun (normal)'), ok(), ['Not answering', 'bad']] },
    ],
    fixes: [
      { id: 'isolate', label: 'Switch the dead string out', explain: 'Lose a little of the array for good and protect the rest.' },
      { id: 'repoint', label: 'Re-point the arrays at the Sun', explain: 'Re-find the Sun with the coarse sensors and reset the drive.' },
      { id: 'reboot', label: 'Restart the power controller', explain: 'A few minutes on the battery alone while it starts again.' },
    ],
    scar: (r) => { r.st.arrayFactor *= 0.9; return 'By the time the team found it, the overloaded strings had cooked: a tenth of the array is gone for good.'; },
    lesson: 'When every string drops together, look at what they share (the Sun, the controller). When one drops alone, look at that one.',
  }),
  anomaly({
    id: 'pointing', title: 'The pointing is drifting', role: 'spacecraft',
    applies: (a) => a.design.adcs === 'wheels' || a.design.adcs === 'agile',
    text: () => 'The spacecraft is slowly swinging off target and correcting itself, again and again.',
    channels: ['Star tracker', 'Wheel currents', 'Gyroscopes against the stars', 'Wheel temperatures'],
    causes: [
      { id: 'tracker', fix: 'wait', truth: 'The Moon was crossing the star tracker\'s view and blinding it.', values: [['No stars found: something bright is in view', 'bad'], ok(), ['No star data to compare with', 'warn'], ok()] },
      { id: 'friction', fix: 'slow', truth: 'One wheel\'s bearing was running dry.', values: [ok('Tracking 14 stars'), ['One wheel draws twice the current of the others', 'bad'], ok('They agree'), ['That wheel is 12 °C warmer', 'warn']] },
      { id: 'gyro', fix: 'calibrate', truth: 'A gyroscope had drifted and was feeding the controller a turn that was not happening.', values: [ok('Tracking 14 stars'), ok(), ['They disagree by a steady 0.3° an hour', 'bad'], ok()] },
    ],
    fixes: [
      { id: 'wait', label: 'Fly on gyroscopes for a few hours', explain: 'Ignore the star tracker until its view is clear again.' },
      { id: 'slow', label: 'Slow the hot wheel and share its work', explain: 'The other wheels carry more; the bad bearing gets a rest.' },
      { id: 'calibrate', label: 'Re-calibrate the gyroscopes against the stars', explain: 'An hour of slow turns while the software re-learns their errors.' },
    ],
    scar: (r) => { r.st.smear = Math.max(r.st.smear, 1.5); return 'The wrong fix made the swinging worse for days: one wheel is damaged and the pointing is 50% less steady from now on.'; },
    lesson: 'Three ways of knowing where you point (stars, gyroscopes, wheels): the one that disagrees with the other two is the suspect.',
  }),
  anomaly({
    id: 'comms', title: 'Two passes without data', role: 'comms', art: 'signal',
    applies: (a) => a.design.stations.length > 0 && a.design.antenna !== 'none',
    text: (a) => `${STATIONS[a.design.stations[0]].short} has had two scheduled contacts in a row with nothing received.`,
    channels: ['Signal at your station', 'Signal at a partner station', 'Weather at your station', 'Transmitter (last telemetry)'],
    causes: [
      { id: 'ground', fix: 'ground', truth: 'The station\'s antenna drive had a fault and was pointing a degree off.', values: [['Nothing', 'bad'], ok('Strong and clear'), ok('Clear sky'), ok('On, normal temperature')] },
      { id: 'rain', fix: 'rate', truth: 'A thunderstorm over the station was soaking up the signal.', values: [['Weak, breaking up', 'warn'], ok('Strong and clear'), ['Thunderstorm overhead', 'bad'], ok('On, normal temperature')] },
      { id: 'amp', fix: 'reset', truth: 'The transmitter\'s amplifier had overheated and switched itself off.', values: [['Nothing', 'bad'], ['Nothing', 'bad'], ok('Clear sky'), ['Off: over-temperature trip', 'bad']] },
    ],
    fixes: [
      { id: 'ground', label: 'Ask the station to check its antenna', explain: 'If the spacecraft is fine, the fault is on the ground.' },
      { id: 'rate', label: 'Halve the data rate until it clears', explain: 'A slower signal gets through more rain.' },
      { id: 'reset', label: 'Command the amplifier back on at low power', explain: 'Through the backup antenna, then step the power up.' },
    ],
    scar: (r) => { r.st.linkFactor *= 0.85; return 'Days of blind commanding stressed the transmitter: the data rate is 15% lower from now on.'; },
    lesson: 'A link has two ends and the sky between them: a second station tells you which of the three has failed.',
  }),
  anomaly({
    id: 'optics', title: 'The images are getting hazy', role: 'science', art: 'light',
    applies: hasOptics,
    text: () => 'The science team reports that the data have been getting worse, slowly, for weeks.',
    channels: ['Sharpness over the last month', 'Detector temperature', 'Sharpness along one orbit', 'Brightness in blue light'],
    causes: [
      { id: 'ice', fix: 'bake', truth: 'Water that boiled out of the structure had frozen onto the cold optics.', values: [['Falling a little every week', 'warn'], ok(), ok('The same all the way round'), ['Down 30%: something is absorbing it', 'bad']] },
      { id: 'focus', fix: 'refocus', truth: 'The structure had shrunk as it dried out, moving the focus.', values: [['Up and down from day to day', 'warn'], ok(), ['Sharp in shadow, soft in sunlight', 'bad'], ok()] },
      { id: 'cooler', fix: 'cool', truth: 'The detector\'s cooler was wearing out.', values: [['Noisier, not blurrier', 'warn'], ['8 °C warmer than it should be', 'bad'], ok('The same all the way round'), ok()] },
    ],
    fixes: [
      { id: 'bake', label: 'Heat the optics for two days', explain: 'Boil off whatever has settled on them.' },
      { id: 'refocus', label: 'Step the focus mechanism', explain: 'A few steps at a time, checking a star after each.' },
      { id: 'cool', label: 'Switch to the spare cooler', explain: 'The detector needs to be cold to be quiet.' },
    ],
    scar: (r) => {
      const ids = (Object.keys(r.st.health) as InstrumentId[]).filter((id) => ['imager', 'spectrometer'].includes(INSTRUMENTS[id].kind));
      if (ids.length) r.st.health[ids[0]] = Math.max(0, (r.st.health[ids[0]] ?? 1) - 0.2);
      return ids.length ? `Weeks of poor data later the cause was found; the ${INSTRUMENTS[ids[0]].short} never fully recovered (20% of its quality lost).` : 'Weeks of data were lost.';
    },
    lesson: 'How a fault changes over time is evidence: slow and steady, tied to the Sun, or tied to temperature point at different causes.',
  }),
  anomaly({
    id: 'reset', title: 'The computer restarted itself', role: 'director', art: 'rehearsal',
    applies: (a) => a.design.computer !== 'none',
    text: () => 'The spacecraft missed a contact. At the next one it was in safe mode: the computer had restarted on its own.',
    channels: ['Where it happened', 'Memory in use before the restart', 'Last command sent', 'Restarts this month'],
    causes: [
      { id: 'radiation', fix: 'resume', truth: 'A single charged particle had flipped a bit in memory: bad luck, and no damage.', values: [['In the most radiation-heavy part of the orbit', 'warn'], ok('Steady at 41%'), ok('Six hours earlier'), ok('1')] },
      { id: 'leak', fix: 'patch', truth: 'The software was slowly filling its memory until it choked.', values: [ok('A different place each time'), ['Climbing 2% a day, 97% at the restart', 'bad'], ok('Hours earlier'), ['3, about ten days apart', 'bad']] },
      { id: 'command', fix: 'revert', truth: 'Yesterday\'s command schedule had a mistake that the computer could not survive.', values: [['Right after a ground station pass', 'warn'], ok('Steady at 41%'), ['A new schedule, 40 seconds before the restart', 'bad'], ok('1')] },
    ],
    fixes: [
      { id: 'resume', label: 'Check the memory and carry on', explain: 'If nothing is broken, nothing needs fixing.' },
      { id: 'patch', label: 'Upload a software patch', explain: 'Fix the software itself.' },
      { id: 'revert', label: 'Go back to the previous command schedule', explain: 'Undo the last thing that changed.' },
    ],
    scar: (r) => { r.st.safeDays += 6; return 'It restarted twice more before the team caught it: six more days lost.'; },
    lesson: 'Ask "what changed just before?" first. If nothing changed and it never repeats, it may simply be radiation.',
  }),
  anomaly({
    id: 'pressure', title: 'Tank pressure is falling', role: 'spacecraft', art: 'burn',
    applies: (a) => PROPULSION[a.design.propulsion].isp > 0,
    text: () => 'The propellant tank has lost 3% of its pressure in a week, with no burns.',
    channels: ['Tank pressure, sensor A', 'Tank pressure, sensor B', 'Tank temperature', 'Unexplained turning force'],
    causes: [
      { id: 'leak', fix: 'isolate', truth: 'A thruster valve was not closing fully and was leaking propellant to space.', values: [['Down 3% in a week', 'bad'], ['Down 3% in a week', 'bad'], ok('Steady'), ['A small steady push near thruster 3', 'bad']] },
      { id: 'sensor', fix: 'trust', truth: 'Sensor A was drifting; the tank was fine.', values: [['Down 3% in a week', 'warn'], ok('Steady'), ok('Steady'), ok('None')] },
      { id: 'cold', fix: 'heat', truth: 'The tank had cooled as the seasons changed, and cold gas presses less.', values: [['Down 3% in a week', 'warn'], ['Down 3% in a week', 'warn'], ['6 °C colder than last month', 'bad'], ok('None')] },
    ],
    fixes: [
      { id: 'isolate', label: 'Close off that thruster branch', explain: 'Lose a thruster, keep the propellant.' },
      { id: 'trust', label: 'Mark sensor A as failed', explain: 'Fly on sensor B.' },
      { id: 'heat', label: 'Turn the tank heater up', explain: 'Bring the tank back to its usual temperature.' },
    ],
    scar: (r) => { r.st.dvLeft *= 0.9; return 'A tenth of the remaining propellant was gone before the real cause was found.'; },
    lesson: 'Two sensors that agree are telling you about the tank; two that disagree are telling you about a sensor.',
  }),
];

// ====================================================================== crewed flights
export const CREW_ORBIT: Spec = {
  ...scripted, id: 'arrive', title: 'In orbit around Earth', kind: 'milestone',
  text: (a) => `${a.crew?.callSign ?? 'The capsule'} is in a high orbit around Earth with ${a.crew?.size ?? 0} people on board. Before leaving for the Moon the crew has a day to check that the ship can keep them alive.`,
  resolve: (r) => { r.operate(); return ''; },
  lesson: '',
};

export const CREW_STEPS = {
  checkout: {
    ...scripted, id: 'checkout', title: 'Check the ship before leaving', role: 'spacecraft', action: true, art: 'eclss',
    text: (a) => `One day in high Earth orbit, still close enough to come home in hours. The crew of ${a.crew?.callSign ?? 'the capsule'} runs the life support hard, tests the radios and flies the ship by hand.`,
    options: () => [{ id: 'go', label: 'Run the checkout', explain: 'Artemis II did the same before its engine burn for the Moon.', quality: 1 }],
    resolve: (r) => {
      const d = r.a.design;
      if (d.instruments.includes('pilotKit')) r.st.bonus[d.primary] = (r.st.bonus[d.primary] ?? 0) + 0.04;
      return `Cabin pressure steady, air clean, water system working${d.instruments.includes('pilotKit') ? ', and the pilot flew the ship by hand around its spent rocket stage' : ''}.`;
    },
    lesson: 'Test the ship where rescue is hours away before taking it where rescue is days away.',
  } as Spec,
  tli: {
    ...scripted, id: 'tli', title: 'Go or no-go for the Moon', role: 'director', noRule: true, art: 'burn',
    text: () => 'The upper stage is ready for the burn that sends the crew out of Earth orbit. After it there is no quick way home: the shortest return is days long.',
    telemetry: (a, st) => {
      const power = st.arrayFactor < 0.9;
      const link = st.linkFactor < 0.9;
      return [
        { label: 'Life support', value: 'All green', state: 'ok' },
        { label: 'Solar arrays', value: power ? `${Math.round(st.arrayFactor * 100)}% power` : 'Full power', state: power ? (a.power.marginPct / 100 + 1) * st.arrayFactor < 1 ? 'bad' : 'warn' : 'ok' },
        { label: 'Link to Houston', value: link ? 'Backup mode, half rate' : 'Strong', state: link ? 'warn' : 'ok' },
        { label: 'Air, water and food', value: `${(st.crew?.supplyDays ?? 0).toFixed(0)} days for a ${a.crew?.days ?? 0}-day trip`, state: (st.crew?.supplyDays ?? 0) >= (a.crew?.days ?? 0) + 2 ? 'ok' : 'warn' },
      ];
    },
    options: (a, st) => {
      const short = (a.power.marginPct / 100 + 1) * st.arrayFactor < 1;
      return [
        { id: 'go', label: 'Go for the Moon', explain: short ? 'With the power the ship has now, it cannot run everything the crew needs.' : 'Every system has earned it.', quality: short ? 0.2 : 0.9 },
        { id: 'nogo', label: 'No-go: come home from Earth orbit', explain: short ? 'A safe crew and a lesson, instead of a gamble three days from help.' : 'Safe, and the mission the world was watching does not happen.', quality: short ? 0.9 : 0.2 },
      ];
    },
    resolve: (r, o) => {
      if (o === 'nogo') { r.end('Returned from Earth orbit', false); return 'The crew splashes down the next morning. The Moon will wait for another flight.'; }
      return 'The engine burns for eighteen minutes. Earth starts to shrink in the windows.';
    },
    lesson: 'A go/no-go is a real question: the right answer depends on what the telemetry says that day.',
  } as Spec,
  flyby: {
    ...scripted, id: 'flyby', title: 'Behind the Moon', kind: 'milestone', art: 'moon',
    text: (a) => `${a.crew?.callSign ?? 'The capsule'} swings around the far side, farther from Earth than any crew before it. For about forty minutes the Moon blocks every radio signal. Then Earth rises over the horizon and Houston hears: "we are with you again".`,
    resolve: () => '',
    lesson: '',
  } as Spec,
  loi: {
    ...scripted, id: 'loi', title: 'Brake into lunar orbit', role: 'director', action: true, art: 'burn',
    text: (a) => `To stay at the Moon the service module engine must fire behind it, out of contact. If it does not fire, ${a.crew?.callSign ?? 'the capsule'} swings past and heads home; if it stops early, the orbit is wrong.`,
    telemetry: (a, st) => [
      { label: 'Δv to arrive, and to leave again', value: `${a.crew?.inMs ?? 0} + ${a.crew?.outMs ?? 0} m/s`, state: 'ok' },
      { label: 'Δv in the tanks', value: `${Math.max(0, st.dvLeft).toFixed(0)} m/s`, state: st.dvLeft >= (a.crew?.inMs ?? 0) + (a.crew?.outMs ?? 0) ? 'ok' : 'bad' },
    ],
    options: () => [{ id: 'go', label: 'Commit the burn', explain: 'The crew watches the clock; the ground waits for the signal to come back.', quality: 1 }],
    resolve: (r) => {
      const c = r.a.crew!;
      if (r.st.dvLeft + 1e-6 < c.inMs + c.outMs) { r.st.skipMoon = true; return 'Not enough propellant to stop and still come home: the burn is called off and the ship swings past the Moon on its way back.'; }
      r.st.dvLeft -= c.inMs;
      r.st.inLunarOrbit = true;
      return 'Signal back on time, right where it should be: the crew is in orbit around the Moon.';
    },
    lesson: 'Every kilogram of propellant to enter lunar orbit needs more to leave it: that is why a flyby is so much cheaper.',
  } as Spec,
  tei: {
    ...scripted, id: 'tei', title: 'The burn for home', role: 'director', action: true, art: 'burn',
    text: () => 'One engine, one burn. Until it works, the crew is staying at the Moon.',
    telemetry: (a, st) => [
      { label: 'Δv needed to leave', value: `${a.crew?.outMs ?? 0} m/s`, state: 'ok' },
      { label: 'Δv in the tanks', value: `${Math.max(0, st.dvLeft).toFixed(0)} m/s`, state: st.dvLeft >= (a.crew?.outMs ?? 0) ? 'ok' : 'bad' },
    ],
    options: () => [{ id: 'go', label: 'Commit the burn', explain: 'The most important few minutes of the flight.', quality: 1 }],
    resolve: (r) => {
      if (!r.st.inLunarOrbit) return 'Nothing to do: the ship never stopped at the Moon.';
      const need = r.a.crew!.outMs;
      if (r.st.dvLeft + 1e-6 < need) {
        if (r.st.crew) r.st.crew.alive = false;
        r.fail('stranded', 'Stranded', 'The tanks ran dry before the ship had the speed to leave. There is no second engine and no rescue ship.', 'Propellant margin on a crewed ship is not a number to trim: it is the way home.');
        r.end('Loss of crew');
        return 'The engine stopped early.';
      }
      r.st.dvLeft -= need;
      r.st.inLunarOrbit = false;
      return 'A good burn. The Moon falls behind; home is four days away.';
    },
    lesson: 'Propellant margin on a crewed ship is not a number to trim: it is the way home.',
  } as Spec,
  entry: {
    ...scripted, id: 'entry', title: 'Splashdown weather', role: 'director', noRule: true, art: 'splash',
    text: () => 'One day from home. At the landing site the waves are over the limit for the recovery divers.',
    telemetry: (_, st) => [
      { label: 'Waves at the main site', value: '2.6 m (limit 2.0 m)', state: 'bad' },
      { label: 'Waves at the backup site', value: '1.4 m', state: 'ok' },
      { label: 'Recovery ship', value: 'At the main site; 9 hours from the backup', state: 'warn' },
      { label: 'Air, water and food left', value: `${((st.crew?.supplyDays ?? 0)).toFixed(1)} days`, state: (st.crew?.supplyDays ?? 0) >= 2.5 ? 'ok' : 'warn' },
    ],
    options: (_, st) => {
      const spare = (st.crew?.supplyDays ?? 0) >= 2.5;
      return [
        { id: 'backup', label: 'Land at the backup site', explain: 'On time. The crew waits in a rolling capsule for hours until the ship arrives.', quality: spare ? 0.6 : 0.9 },
        { id: 'wait', label: 'Change the entry and land a day later', explain: spare ? 'There are supplies for it: this is what the margin days are for.' : 'There is barely air for it.', quality: spare ? 0.9 : 0.15 },
      ];
    },
    resolve: (r, o) => {
      if (o === 'wait') { r.addDays(1); return 'A small burn stretches the way home by a day. The sea calms.'; }
      if (r.st.crew) r.st.crew.morale -= 0.15;
      return 'The entry is re-targeted to the backup site.';
    },
    lesson: 'Margin days of air, water and food are what buy a crew the freedom to wait for better conditions.',
  } as Spec,
};

export const CREW_ANOMALIES: Spec[] = [
  anomaly({
    id: 'co2', title: 'Carbon dioxide is climbing', role: 'science', art: 'eclss',
    applies: (a) => !!a.crew,
    text: () => 'The cabin air is slowly getting worse. The crew breathes out a kilogram of carbon dioxide each a day, and something is not taking it away.',
    channels: ['CO₂, sensor 1', 'CO₂, sensor 2', 'Air flow through the scrubber', 'Crew report'],
    causes: [
      { id: 'filter', fix: 'clean', truth: 'Lint and a lost sock were blocking the scrubber\'s inlet filter.', values: [['5.4 mmHg, rising', 'bad'], ['5.3 mmHg, rising', 'bad'], ['40% of normal', 'bad'], ['Stuffy, mild headaches', 'warn']] },
      { id: 'bed', fix: 'swap', truth: 'One scrubber bed had stopped regenerating.', values: [['5.4 mmHg, rising', 'bad'], ['5.3 mmHg, rising', 'bad'], ok('Normal'), ['Stuffy, mild headaches', 'warn']] },
      { id: 'sensor', fix: 'trust', truth: 'Sensor 1 had drifted. The air was fine all along.', values: [['5.4 mmHg, rising', 'warn'], ok('2.1 mmHg, steady'), ok('Normal'), ok('Feeling fine')] },
    ],
    fixes: [
      { id: 'clean', label: 'Have the crew clean the inlet filter', explain: 'Ten minutes with a vacuum cleaner.' },
      { id: 'swap', label: 'Switch to the spare scrubber bed', explain: 'The backup takes over while the first is looked at.' },
      { id: 'trust', label: 'Mark sensor 1 as failed', explain: 'If the crew feels fine and sensor 2 is steady, the air is fine.' },
    ],
    scar: (r) => { if (r.st.crew) { r.st.crew.supplyDays -= 1.5; r.st.crew.morale -= 0.1; } return 'The crew used emergency canisters while the team worked it out: a day and a half of margin gone.'; },
    lesson: 'With people on board the crew is a sensor too: ask them how they feel before trusting a single reading.',
  }),
  anomaly({
    id: 'leak', title: 'Cabin pressure is dropping', role: 'spacecraft', art: 'eclss',
    applies: (a) => !!a.crew,
    text: () => 'The cabin is losing pressure, slowly. The oxygen tanks are making up the difference, and they are not endless.',
    channels: ['Cabin pressure', 'With the waste vent capped', 'With the hatch equalising valve closed', 'Cabin temperature'],
    causes: [
      { id: 'vent', fix: 'cap', truth: 'The waste vent valve was not sealing: air was whistling out to space.', values: [['Falling 0.4% an hour', 'bad'], ok('Holds steady'), ['Still falling', 'bad'], ok('Steady')] },
      { id: 'hatch', fix: 'hatch', truth: 'The pressure-equalising valve in the hatch was leaking.', values: [['Falling 0.4% an hour', 'bad'], ['Still falling', 'bad'], ok('Holds steady'), ok('Steady')] },
      { id: 'temp', fix: 'nothing', truth: 'Nothing was leaking: the cabin had cooled 4 °C overnight, and cooler air presses less.', values: [['Fell 1.3% overnight, steady since', 'warn'], ['No change', 'warn'], ['No change', 'warn'], ['4 °C cooler than yesterday', 'bad']] },
    ],
    fixes: [
      { id: 'cap', label: 'Cap the waste vent', explain: 'The crew fits the launch cap over it.' },
      { id: 'hatch', label: 'Close and seal the hatch valve', explain: 'It is only needed again before the hatch opens at home.' },
      { id: 'nothing', label: 'Do nothing: it is the temperature', explain: 'Gas pressure follows temperature. Check that it explains all of the drop.' },
    ],
    scar: (r) => { if (r.st.crew) r.st.crew.supplyDays -= 2; return 'Two days\' worth of oxygen went overboard before the team was sure.'; },
    lesson: 'Close one thing at a time and watch the needle: the leak is behind the valve that stops it.',
  }),
  {
    ...scripted, id: 'anomaly:storm', title: 'Solar storm: protons on the way', role: 'director', noRule: true, art: 'storm', applies: (a) => !!a.crew,
    text: () => 'A large flare has erupted on the Sun. A wave of fast protons will reach the ship in about forty minutes and last ten hours. Out here there is no magnetic field to turn it aside.',
    telemetry: (a) => [
      { label: 'Flare class', value: 'X9: among the strongest', state: 'bad' },
      { label: 'Time to arrival', value: '40 minutes', state: 'warn' },
      { label: 'Shelter on board', value: SHELTERS[a.design.crew?.shelter ?? 'none'].name, state: a.design.crew?.shelter === 'none' ? 'bad' : 'ok' },
      { label: 'Dose in the shelter / in the cabin', value: `${SHELTERS[a.design.crew?.shelter ?? 'none'].stormMsv} / ${SHELTERS.none.stormMsv} mSv`, state: 'warn' },
    ],
    options: (a) => [
      { id: 'shelter', label: a.design.crew?.shelter === 'none' ? 'Crowd into the middle of the cabin' : 'Build the shelter and climb in', explain: a.design.crew?.shelter === 'none' ? 'There is no shelter: the best the crew can do is put the most ship between them and the Sun.' : 'Ten hours shoulder to shoulder among the supply bags. No work gets done.', quality: 0.95 },
      { id: 'work', label: 'Carry on with the day\'s plan', explain: 'The crew takes the storm through the thin cabin wall.', quality: 0.05 },
    ],
    resolve: (r, o) => {
      const c = r.st.crew;
      if (!c) return '';
      const kind = r.a.design.crew?.shelter ?? 'none';
      if (o === 'shelter') {
        const dose = kind === 'none' ? SHELTERS.none.stormMsv * 0.7 : SHELTERS[kind].stormMsv;
        c.doseMsv += dose;
        r.st.safeDays += 0.5;
        return `Ten hours later the count rate falls. The crew took about ${dose.toFixed(0)} mSv${kind === 'none' ? ': with no shelter, that is a large share of a career limit in one night' : ''}.`;
      }
      c.doseMsv += SHELTERS.none.stormMsv;
      c.morale -= 0.2;
      return `The crew worked through it and took about ${SHELTERS.none.stormMsv} mSv: most of an astronaut's career limit, in ten hours.`;
    },
    lesson: 'Beyond Earth\'s magnetic field a solar storm is the main radiation risk for a crew, and mass between you and the Sun is the only protection.',
  },
  {
    ...scripted, id: 'anomaly:toilet', title: 'The toilet has stopped working', role: 'science', noRule: true, art: 'eclss', applies: (a) => !!a.crew,
    text: () => 'The fan in the toilet will not start. It is not dangerous. It is days from home with one small room and no window to open.',
    telemetry: () => [
      { label: 'Fan motor', value: 'Draws current, does not turn', state: 'bad' },
      { label: 'Backup collection bags', value: 'Enough for the trip', state: 'ok' },
      { label: 'Crew timeline', value: 'Full', state: 'warn' },
    ],
    options: () => [
      { id: 'fix', label: 'Give the crew four hours to take it apart', explain: 'Half a day of planned work is dropped. Probably something stuck in the fan.', quality: 0.85 },
      { id: 'bags', label: 'Use the backup bags for the rest of the trip', explain: 'No time lost. Ask an Apollo astronaut what they thought of the bags.', quality: 0.45 },
    ],
    resolve: (r, o) => {
      if (o === 'fix') { r.st.safeDays += 0.4; return 'A frozen plug of ice in the vent line. Cleared, and working again.'; }
      if (r.st.crew) r.st.crew.morale -= 0.2;
      return 'The crew is professional about it. The live broadcasts get shorter.';
    },
    lesson: 'On a crewed flight the small machines matter too: people have to live in the ship, not only survive in it.',
  },
];
