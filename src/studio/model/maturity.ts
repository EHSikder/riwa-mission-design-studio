/**
 * How mature the concept is, on JPL's Concept Maturity Level scale (Wessen, Borden, Ziemer and Kwok, "Space
 * mission concept development using concept maturity levels", JPL 2013, released CC0 on JPL's Dataverse, and a
 * resource of the Space Apps challenge). CML 1 is the idea on a cocktail napkin, CML 2 initial feasibility, CML 3
 * the trade space, CML 4 a point design with acceptable margins and reserves. Goddard's Mission Design Lab starts
 * a point-design study only once a concept passes this kind of checklist.
 *
 * As in the paper, each item is green (done), yellow (in progress) or red (not started), and a level is reached
 * when 80% of its items are green, with every level below it reached too. The CML 4 margins are the paper's
 * (Fig. 8b): 35% mass growth allowance and margin, 35% power, 35% energy, 3 dB of link margin. The 10% reserve is
 * NASA's CubeSat 101 floor; the other thresholds are this game's.
 */
import type { Analysis } from './analyze';
import { LAUNCHERS, PLATFORMS, STATIONS } from './catalog';
import { applicableTests } from './tests';

export type Light = 'green' | 'yellow' | 'red';
export type CmlLevel = 1 | 2 | 3 | 4;

export interface MaturityItem {
  level: CmlLevel;
  label: string;
  light: Light;
  note: string;
}

export interface Maturity {
  items: MaturityItem[];
  /** The highest level reached (0: not even the idea is written down). */
  level: 0 | CmlLevel;
  /** What is missing for the next level, or null at CML 4. */
  next: string | null;
}

/** The paper's names for the first four levels. */
export const CML_NAMES: Record<CmlLevel, string> = {
  1: 'Cocktail napkin',
  2: 'Initial feasibility',
  3: 'Trade space',
  4: 'Point design',
};

export const CML_EXPLAIN: Record<CmlLevel, string> = {
  1: 'The science question, who the data is for, a rough cost and a launch date.',
  2: 'The key numbers estimated: could this work at all?',
  3: 'Options compared: spacecraft, ground and mission design traded against science, cost and risk.',
  4: 'One design with every subsystem chosen, costed, and carrying acceptable margins and reserves.',
};

/** Share of a level's items that must be green (the paper's rule of thumb). */
export const CML_PASS = 0.8;

const pct = (x: number) => `${x >= 0 ? '' : '−'}${Math.abs(x).toFixed(0)}%`;
const by = (x: number, green: number, yellow: number): Light => (x >= green ? 'green' : x >= yellow ? 'yellow' : 'red');

/**
 * The checklist for this analysis. `trades` is the number of designs the team has saved for this mission in the
 * hangar: comparing options is what CML 3 is about.
 */
export function maturity(a: Analysis, trades: number): Maturity {
  const items: MaturityItem[] = [];
  const add = (level: CmlLevel, label: string, light: Light, note: string) => items.push({ level, label, light, note });
  const d = a.design, s = a.scenario;
  const built = (id: string) => a.build.find((b) => b.id === id)?.done ?? true;

  // CML 1: the idea
  add(1, 'Science goals, and the people who will use the data', 'green', `${s.customer}: ${s.objectives.length} goal${s.objectives.length === 1 ? '' : 's'} to choose from.`);
  add(1, 'A cost target and a launch date', 'green', Number.isFinite(a.cost.budgetM) ? `$${a.cost.budgetM.toFixed(0)}M, launch by month ${a.time.deadlineMonth.toFixed(0)}.` : 'No limits in the sandbox.');

  // CML 2: initial feasibility
  const reqs = a.requirements;
  const estimated = reqs.filter((r) => Number.isFinite(r.value)).length;
  const meets = reqs.filter((r) => r.met !== 'fail').length;
  add(2, 'Instruments that answer the science goals', built('payload') ? 'green' : 'red', built('payload') ? `${d.instruments.length} on board.` : 'No payload chosen yet.');
  add(2, 'A first estimate for every requirement', estimated === reqs.length ? 'green' : estimated > 0 ? 'yellow' : 'red', `${estimated} of ${reqs.length} estimated.`);
  add(2, 'The estimates meet the requirements', by(reqs.length ? meets / reqs.length : 1, 1, 0.5), `${meets} of ${reqs.length} met at least at threshold.`);

  // CML 3: the trade space
  add(3, 'Options compared', trades >= 2 ? 'green' : trades === 1 ? 'yellow' : 'red', trades >= 2 ? `${trades} designs saved in the hangar.` : 'Save designs in the hangar and compare them: JPL found that teams who skip the trade space end up with less science.');
  add(3, 'Launcher traded against fairing and capacity', built('launcher') && a.launch.ok ? 'green' : 'red', built('launcher') ? (a.launch.ok ? `Fits, with ${a.resources.mass.marginPct.toFixed(0)}% of the lift to spare.` : a.launch.reasons[0] ?? 'It does not fit.') : 'No launcher yet.');
  add(3, 'Ground segment chosen', built('station') ? 'green' : 'red', built('station') ? `${d.stations.length} station${d.stations.length === 1 ? '' : 's'}.` : 'Nobody listening on the ground yet.');

  // CML 4: the point design
  const missing = a.build.filter((b) => !b.done && !b.optional);
  add(4, 'Every subsystem chosen (master equipment list)', missing.length === 0 ? 'green' : missing.length <= 2 ? 'yellow' : 'red', missing.length ? `Missing: ${missing.map((b) => b.label.toLowerCase()).join(', ')}.` : 'Nothing missing.');
  const growthKg = a.mass.lines.find((l) => /^Growth allowance/.test(l.name))?.value ?? 0;
  const massShare = a.mass.limitKg > 0 ? ((a.mass.limitKg - (a.mass.wetKg - growthKg)) / a.mass.limitKg) * 100 : -100;
  add(4, 'Mass growth allowance and margin ≥ 35%', by(massShare, 35, 10), a.mass.limitKg > 0 ? `${pct(massShare)} of the lift (growth allowance ${growthKg.toFixed(1)} kg included).` : 'No structure or launcher yet.');
  add(4, 'Power margin ≥ 35%', built('power') ? by(a.power.marginPct, 35, 10) : 'red', built('power') ? `${pct(a.power.marginPct)} at the end of the mission.` : 'No arrays yet.');
  const usableWh = d.batteryWh * a.power.dodAllowed;
  const energy = a.power.eclipseWh > 0 ? (usableWh / a.power.eclipseWh - 1) * 100 : Infinity;
  add(4, 'Energy margin ≥ 35%', built('battery') ? by(energy, 35, 0) : 'red', !built('battery') ? 'No battery yet.' : Number.isFinite(energy) ? `${pct(energy)} over the longest shadow.` : 'No shadow to ride through.');
  const link = a.comms.marginDb;
  add(4, 'Link margin ≥ 3 dB', built('radio') && built('station') ? by(link, 3, 0) : 'red', Number.isFinite(link) && link > -100 ? `${link >= 0 ? '+' : ''}${link.toFixed(1)} dB at the farthest point.` : 'No link yet.');
  const dvOk = a.dv.totalMs <= 0 ? 1 : a.dv.capabilityMs / a.dv.totalMs;
  add(4, 'Δv budget and propellant load', by(dvOk, 1, 0.9), a.dv.totalMs <= 0 ? 'No burns needed.' : `${a.dv.capabilityMs.toFixed(0)} of ${a.dv.totalMs.toFixed(0)} m/s.`);
  const within = a.cost.totalM <= a.cost.budgetM;
  add(4, 'Cost estimate with a reserve of at least 10%', !within ? 'red' : d.reservePct >= 10 ? 'green' : 'yellow', within ? `${d.reservePct.toFixed(0)}% reserve, $${a.cost.totalM.toFixed(1)}M in all.` : `$${a.cost.totalM.toFixed(1)}M is over the budget.`);
  const tests = applicableTests(d), planned = a.tests.planned.length;
  add(4, 'Verification planned (ground tests)', planned >= tests.length ? 'green' : planned > 0 ? 'yellow' : 'red', `${planned} of ${tests.length} tests planned.`);
  const slack = a.time.deadlineMonth - a.time.launchMonth;
  add(4, 'Schedule with margin', by(slack, 2, 0), Number.isFinite(slack) ? `${slack >= 0 ? '+' : ''}${slack.toFixed(0)} months before the deadline.` : 'No deadline.');

  let level: 0 | CmlLevel = 0;
  for (const L of [1, 2, 3, 4] as CmlLevel[]) {
    const at = items.filter((i) => i.level === L);
    if (at.filter((i) => i.light === 'green').length / at.length < CML_PASS) break;
    level = L;
  }
  const nextLevel = level < 4 ? ((level + 1) as CmlLevel) : null;
  const next = nextLevel
    ? `To reach CML ${nextLevel} (${CML_NAMES[nextLevel].toLowerCase()}): ${items.filter((i) => i.level === nextLevel && i.light !== 'green').map((i) => i.label.toLowerCase()).join('; ')}.`
    : null;
  return { items, level, next };
}

/**
 * NASA's four mission segments ("Design and Develop Science Missions", NASA Small Spacecraft Systems Virtual
 * Institute, 2025): what carries the mission to space, what flies, what talks to it, and who uses what it returns.
 * NASA's advice is to begin with the end in mind: start from the user.
 */
export interface Segment { id: 'launch' | 'space' | 'ground' | 'user'; name: string; value: string; explain: string }

export function segments(a: Analysis): Segment[] {
  const d = a.design;
  const p = PLATFORMS[d.platform];
  return [
    { id: 'user', name: 'User segment', value: a.scenario.customer, explain: 'The people who use the data: who the mission is for.' },
    { id: 'space', name: 'Space segment', value: d.platform === 'none' ? 'Nothing built yet' : `${p.short}${d.instruments.length ? ` · ${d.instruments.length} instrument${d.instruments.length === 1 ? '' : 's'}` : ''}`, explain: 'The spacecraft and its instruments.' },
    { id: 'ground', name: 'Ground segment', value: d.stations.length ? d.stations.map((id) => STATIONS[id].short).join(', ') : 'No station yet', explain: 'Ground stations and mission control: talk to it, receive the data, run it.' },
    { id: 'launch', name: 'Launch segment', value: d.launcher === 'none' ? 'No launcher yet' : LAUNCHERS[d.launcher].name, explain: 'The rocket and the launch services.' },
  ];
}

/**
 * The risk class NASA would give the mission by its planned lifetime alone (NPR 8705.4B, Table C-1: more than 5
 * years A, 3 to 5 B, 1 to 3 C, under 1 D). Crewed flights are always class A. The real rule also weighs priority.
 */
export function riskClass(a: Analysis): { cls: 'A' | 'B' | 'C' | 'D'; why: string } {
  if (a.crew) return { cls: 'A', why: 'People on board: the highest class, with fault tolerance for every critical part.' };
  const y = a.design.plannedYears;
  if (y > 5) return { cls: 'A', why: `${y} years planned: class A missions carry spares for every critical part.` };
  if (y >= 3) return { cls: 'B', why: `${y} years planned: class B, high priority, most critical parts backed up.` };
  if (y >= 1) return { cls: 'C', why: `${y} year${y === 1 ? '' : 's'} planned: class C, medium priority, some risk accepted.` };
  return { cls: 'D', why: 'Under a year planned: class D, low cost and higher risk accepted, as for many CubeSats.' };
}
