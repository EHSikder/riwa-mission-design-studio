/**
 * The test campaign: what the team verifies on the ground before launch (NASA's Phase D, "system assembly,
 * integration and test"). Real spacecraft are shaken, baked in vacuum, unfolded, plugged into their ground
 * station and rehearsed, because a flaw found on the ground costs weeks and a flaw found in orbit can cost the
 * mission. Every build hides a few flaws (drawn from the flight's seed); a test finds the flaw of its kind, if
 * there is one, and the team decides whether to fix it. Flaws nobody looked for fly with the spacecraft.
 */
import type { StudioDesign } from './design';
import { createRng } from './rng';
import type { RoleId } from './types';

export type TestId = 'vibration' | 'tvac' | 'deploy' | 'compat' | 'rehearsal' | 'abort' | 'eclss';
export type DefectId = 'structure' | 'thermal' | 'deploy' | 'rf' | 'software' | 'abort' | 'eclss';

export interface TestSpec {
  name: string;
  short: string;
  /** The role whose subsystem it protects: they run it in a team game. */
  role: RoleId;
  finds: DefectId;
  weeks: number;
  /** Cost as a share of the hardware. */
  costShare: number;
  /** What happens in the test, and what flies unnoticed without it. */
  explain: string;
  catches: string;
  applies: (d: StudioDesign) => boolean;
}

const deployables = (d: StudioDesign) => (d.mount !== 'body' && d.arrayM2 > 0) || d.antenna === 'dish';

export const TESTS: Record<TestId, TestSpec> = {
  vibration: {
    name: 'Vibration test', short: 'Shake', role: 'spacecraft', finds: 'structure', weeks: 2, costShare: 0.02,
    explain: 'The spacecraft is bolted to a shaker table and shaken as hard as the rocket will shake it.',
    catches: 'A cracked bracket or a loose connector that the launch would break.',
    applies: () => true,
  },
  tvac: {
    name: 'Thermal vacuum test', short: 'Bake', role: 'spacecraft', finds: 'thermal', weeks: 4, costShare: 0.04,
    explain: 'Days in a chamber with no air, cycled between the heat of full sunlight and the cold of shadow.',
    catches: 'A part that overheats or freezes once there is no air to carry the heat away.',
    applies: () => true,
  },
  deploy: {
    name: 'Deployment test', short: 'Unfold', role: 'spacecraft', finds: 'deploy', weeks: 1, costShare: 0.01,
    explain: 'The wings and the dish are unfolded on the ground, hanging from wires so that gravity does not help or hinder.',
    catches: 'A hinge or a latch that sticks in orbit, where nobody can push it.',
    applies: deployables,
  },
  compat: {
    name: 'Ground station compatibility test', short: 'Talk', role: 'comms', finds: 'rf', weeks: 1, costShare: 0.015,
    explain: 'The real radio talks to the real ground station through a cable: every command, every data format.',
    catches: 'A spacecraft in orbit that the ground cannot understand.',
    applies: (d) => d.antenna !== 'none',
  },
  rehearsal: {
    name: 'Mission rehearsal', short: 'Rehearse', role: 'director', finds: 'software', weeks: 2, costShare: 0.015,
    explain: 'The flight software runs for days against a simulator while the team practises its failures before they happen.',
    catches: 'A software fault that shows up in orbit, where a fix takes days.',
    applies: (d) => d.computer !== 'none',
  },
  abort: {
    name: 'Launch abort test', short: 'Abort', role: 'spacecraft', finds: 'abort', weeks: 8, costShare: 0.03,
    explain: 'A test capsule is fired off a booster to prove that the escape system pulls the crew clear of a failing rocket.',
    catches: 'An escape system that has never flown, on the one day the crew needs it.',
    applies: (d) => !!d.crew && d.crew.abort !== 'none',
  },
  eclss: {
    name: 'Life support endurance test', short: 'Breathe', role: 'science', finds: 'eclss', weeks: 6, costShare: 0.02,
    explain: 'The cabin air system runs for the whole length of the mission with a crew, or machines that breathe like one, inside.',
    catches: 'An air scrubber that loses capacity days into the flight.',
    applies: (d) => !!d.crew,
  },
};

export const TEST_IDS = Object.keys(TESTS) as TestId[];

export interface Defect {
  /** What the test report says when it finds the flaw. */
  found: string;
  /** Chance a build carries it. */
  chance: number;
  fixWeeks: number;
  fixShare: number;
  lesson: string;
}

export const DEFECTS: Record<DefectId, Defect> = {
  structure: {
    found: 'On the shaker a bracket cracked. Engineers can redesign it, or argue that it will hold.',
    chance: 0.4, fixWeeks: 6, fixShare: 0.03,
    lesson: 'Tests are cheaper than failures in orbit: the vibration test exists to find what launch would break.',
  },
  thermal: {
    found: 'In the vacuum chamber the battery ran 15 °C hotter than the thermal model predicted.',
    chance: 0.35, fixWeeks: 4, fixShare: 0.02,
    lesson: 'In vacuum nothing carries heat away but radiators: only a vacuum chamber shows where the heat really goes.',
  },
  deploy: {
    found: 'One hinge snagged halfway: the wing stopped at 60°.',
    chance: 0.25, fixWeeks: 2, fixShare: 0.01,
    lesson: 'Every mechanism that must move once, in orbit, is tested moving on the ground first.',
  },
  rf: {
    found: 'The ground station could not decode the telemetry: the two radios disagree about the data format.',
    chance: 0.25, fixWeeks: 2, fixShare: 0.01,
    lesson: 'A link has two ends, usually built by two teams: testing them together is the only proof they agree.',
  },
  software: {
    found: 'On the third day of the rehearsal the computer reset itself: the software slowly runs out of memory.',
    chance: 0.45, fixWeeks: 3, fixShare: 0.015,
    lesson: 'Some software faults only appear after days of running: a rehearsal as long as the real thing finds them.',
  },
  abort: {
    found: 'In the abort test the escape motor\'s steering answered late: the capsule tumbled before the parachutes opened.',
    chance: 0.2, fixWeeks: 8, fixShare: 0.02,
    lesson: 'A crew escape system is used at most once: the only time to find its faults is before anyone rides it.',
  },
  eclss: {
    found: 'After six days the carbon dioxide scrubber had lost a third of its capacity.',
    chance: 0.3, fixWeeks: 5, fixShare: 0.02,
    lesson: 'Life support must work for every hour of the mission: only a test that long proves it.',
  },
};

export const DEFECT_IDS = Object.keys(DEFECTS) as DefectId[];

/**
 * The flaws hidden in this build. They come from the flight's seed through their own sequence, so the rest of
 * the flight's luck is the same whether the team tests or not: "fly again (same luck)" with one more test is a
 * fair experiment.
 */
export function latentDefects(seed: number, d: StudioDesign): DefectId[] {
  const rng = createRng((seed ^ 0x5eed_7e57) >>> 0);
  const out: DefectId[] = [];
  for (const id of DEFECT_IDS) {
    const roll = rng.next();
    const test = TEST_IDS.find((t) => TESTS[t].finds === id)!;
    if (TESTS[test].applies(d) && roll < DEFECTS[id].chance) out.push(id);
  }
  return out;
}

/** The tests that make sense for a design, in the order a campaign runs them. */
export const applicableTests = (d: StudioDesign) => TEST_IDS.filter((t) => TESTS[t].applies(d));
