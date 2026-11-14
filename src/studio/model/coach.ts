/**
 * The coach (docs/03 §9): one small step at a time for beginners (the tutorial, and Cadet games). Every mission
 * starts with an empty assembly stand, so the coach walks the build in the order real teams do it: the body,
 * what it carries, what keeps it alive, how it talks, the ride, the tests. Each step names the desk to open,
 * says what to do and why, and checks the real design to know when it is done, so the coach follows the player
 * rather than a script. The first unfinished step is the one shown.
 */
import type { Analysis } from './analyze';
import type { RoleId } from './types';

export interface CoachStep {
  id: string;
  title: string;
  text: string;
  /** The desk that holds the controls for this step, and the section of it to open. */
  desk?: RoleId;
  section?: (a: Analysis) => string;
  done: (a: Analysis, phase: string) => boolean;
}

const fails = (a: Analysis, role: RoleId) => a.issues.some((i) => i.level === 'fail' && i.role === role);
const past = (phase: string, ...these: string[]) => !these.includes(phase);
const built = (a: Analysis, id: string) => a.build.find((b) => b.id === id)?.done ?? true;
/** The part of the Spacecraft desk that still needs work: what is missing first, then what fails. */
function busSection(a: Analysis): string {
  const order: [string, string][] = [['computer', 'computer'], ['pointing', 'adcs'], ['engine', 'propulsion'], ['power', 'arrays'], ['battery', 'battery'], ['escape', 'escape'], ['shield', 'shield']];
  const miss = order.find(([id]) => !built(a, id));
  if (miss) return miss[1];
  const f = a.issues.find((i) => i.level === 'fail' && i.role === 'spacecraft')?.text ?? '';
  if (/spare|computer/i.test(f)) return 'computer';
  if (/battery/i.test(f)) return 'battery';
  if (/engine|propulsion|thruster|Δv/i.test(f)) return 'propulsion';
  if (/point|magnet|wheel|beam/i.test(f)) return 'adcs';
  if (/escape/i.test(f)) return 'escape';
  if (/heat shield/i.test(f)) return 'shield';
  return 'arrays';
}
const usefulOnBoard = (a: Analysis) => {
  const o = a.scenario.objectives.find((x) => x.id === a.design.primary);
  return !!o && a.design.instruments.some((i) => (o.value[i] ?? 0) >= 0.5);
};

/** The tutorial (First Light): one idea per step, building a 12U CubeSat from nothing. */
const TUTORIAL: CoachStep[] = [
  {
    id: 'brief', title: 'Read the brief',
    text: 'A university club in Luanda wants pictures of Angola from space. The objective is already chosen. Press "Start designing".',
    done: (_, phase) => past(phase, 'brief'),
  },
  {
    id: 'structure', title: 'Start with the body', desk: 'spacecraft',
    text: 'The assembly stand is empty. Every spacecraft starts with a structure that everything else bolts to. On the Spacecraft desk, pick a CubeSat platform.',
    section: () => 'platform',
    done: (a) => built(a, 'structure'),
  },
  {
    id: 'brain', title: 'Give it a brain', desk: 'spacecraft',
    text: 'The onboard computer runs everything and keeps the satellite alive when nobody is watching. Pick one.',
    section: () => 'computer',
    done: (a) => built(a, 'computer'),
  },
  {
    id: 'camera', title: 'Give it eyes', desk: 'science',
    text: 'A satellite carries something useful: its payload. Open the Payload desk and add the CubeSat camera. Watch the mass, power and money on the right change.',
    section: () => 'instruments',
    done: (a) => a.design.instruments.includes('cubecam'),
  },
  {
    id: 'pointing', title: 'Hold the camera steady', desk: 'spacecraft',
    text: 'The camera needs to point within 1°. Magnetorquers only manage 5°, so the pictures would smear. On the Spacecraft desk, pick reaction wheels and a star tracker.',
    section: () => 'adcs',
    done: (a) => a.design.adcs === 'wheels' || a.design.adcs === 'agile',
  },
  {
    id: 'radio', title: 'Send the pictures home', desk: 'comms',
    text: 'On the Comms desk, pick an antenna and some onboard storage. Use S-band: UHF carries a trickle of kilobits and the pictures would pile up and be lost.',
    section: (a) => (a.design.band === 'UHF' ? 'band' : a.design.antenna === 'none' ? 'antenna' : 'storage'),
    done: (a) => built(a, 'radio') && a.design.band !== 'UHF',
  },
  {
    id: 'station', title: 'Someone must listen', desk: 'comms',
    text: 'A radio is no use if nobody hears it. Pick the ground station in Luanda: it talks to the satellite on every pass.',
    section: () => 'stations',
    done: (a) => built(a, 'station'),
  },
  {
    id: 'power', title: 'Catch the sunlight', desk: 'spacecraft',
    text: 'Now you know what the satellite uses, so you can size what feeds it. Under Solar arrays, press "Size it for me". Power turns green on the dashboard.',
    section: () => 'arrays',
    done: (a) => built(a, 'power') && a.power.marginPct >= 0,
  },
  {
    id: 'battery', title: 'Survive the shadow', desk: 'spacecraft',
    text: 'Every 95 minutes the satellite flies through Earth\'s shadow for over half an hour. The battery must carry it, and shallow drains make it last. Press "Size it for me" under Battery.',
    section: () => 'battery',
    done: (a) => built(a, 'battery') && a.power.dod <= a.power.dodAllowed + 1e-9,
  },
  {
    id: 'rocket', title: 'Book the ride', desk: 'director',
    text: 'On the Mission desk, pick the rideshare rocket. It is cheap because you share it, so you go where it goes.',
    section: () => 'launcher',
    done: (a) => built(a, 'launcher') && a.launch.ok,
  },
  {
    id: 'tests', title: 'Test before you fly', desk: 'director',
    text: 'Nobody can repair a satellite in orbit. On the Mission desk, tick the ground tests: each one costs a few weeks and finds a flaw that would otherwise fly.',
    section: () => 'tests',
    done: (a) => a.tests.planned.length > 0,
  },
  {
    id: 'green', title: 'Everything in the green',
    text: 'Look at the six resources on the right. Fix anything marked "Fails": tap a card to read why. When none fails, go to Review (top right).',
    done: (a, phase) => Object.values(a.resources).every((r) => r.status !== 'fail') && past(phase, 'brief', 'design'),
  },
  {
    id: 'launch', title: 'Launch',
    text: 'The review board lists every check. If it says GO, press "Build and fly".',
    done: (_, phase) => past(phase, 'brief', 'design', 'review'),
  },
  {
    id: 'fly', title: 'Fly the mission',
    text: 'Run the tests, launch, unfold the wings and listen for the first signal. Then years go by in seconds. When the mission ends, open the report.',
    done: (_, phase) => phase === 'report',
  },
  {
    id: 'report', title: 'Why did it go that way?',
    text: 'The report explains every requirement, what worked and what to try next. Improve the design and fly again, or pick a real mission!',
    done: () => false,
  },
];

/** Any mission, at Cadet: the same path in bigger steps. */
const GENERAL: CoachStep[] = [
  {
    id: 'brief', title: 'Read the brief',
    text: 'Who wants this mission, and why? A first objective is already picked: you can change it, and how ambitious to be, on the Mission desk. Press "Start designing".',
    done: (_, phase) => past(phase, 'brief'),
  },
  {
    id: 'structure', title: 'Start with the body', desk: 'spacecraft',
    text: 'The assembly stand is empty. On the Spacecraft desk, pick the platform: the structure every other part bolts to.',
    section: () => 'platform',
    done: (a) => built(a, 'structure'),
  },
  {
    id: 'payload', title: 'Choose instruments', desk: 'science',
    text: 'On the Payload desk, add at least one instrument marked ★ for your objective. Each one costs mass, power, money and data.',
    section: () => 'instruments',
    done: (a) => usefulOnBoard(a),
  },
  {
    id: 'bus', title: 'Make the spacecraft work', desk: 'spacecraft',
    text: 'Back on the Spacecraft desk: a computer, a way to point, solar arrays, a battery, and an engine if the mission needs one. The red number on the tab counts what is missing. "Size it for me" helps.',
    section: busSection,
    done: (a) => !fails(a, 'spacecraft') && (!!a.crew || !fails(a, 'science')),
  },
  {
    id: 'crew', title: 'Keep the crew alive', desk: 'science',
    text: 'On the Payload desk, open Crew and life support: how many people, how they breathe, how many spare days of supplies, and where they hide from a solar storm.',
    section: () => 'crew',
    done: (a) => !fails(a, 'science'),
  },
  {
    id: 'comms', title: 'Bring the data home', desk: 'comms',
    text: 'On the Comms desk, pick a band, an antenna, storage and a ground station that can send home what the instruments make.',
    section: (a) => (a.design.antenna === 'none' ? 'antenna' : a.design.storageGbit <= 0 ? 'storage' : 'stations'),
    done: (a) => !fails(a, 'comms') && a.resources.comms.status !== 'fail' && a.resources.data.status !== 'fail',
  },
  {
    id: 'rocket', title: 'Orbit and rocket', desk: 'director',
    text: 'On the Mission desk, check the orbit and pick a launcher marked ✓: it must lift your spacecraft to that orbit.',
    section: () => 'launcher',
    done: (a) => a.launch.ok,
  },
  {
    id: 'tests', title: 'Plan the tests', desk: 'director',
    text: 'Still on the Mission desk: choose the ground tests. Each costs weeks and money and finds one kind of hidden flaw before it flies.',
    section: () => 'tests',
    done: (a) => a.tests.planned.length > 0,
  },
  {
    id: 'money', title: 'Stay within budget', desk: 'resources',
    text: 'The Resources desk shows where the money goes. Cheaper parts or launcher, fewer years, or a smaller reserve bring the total down.',
    section: () => 'budget',
    done: (a) => a.resources.budget.status !== 'fail' && !fails(a, 'resources') && !fails(a, 'director'),
  },
  {
    id: 'review', title: 'Review and launch',
    text: 'Everything in the green? Go to Review, read the board\'s findings, and build it.',
    done: (_, phase) => past(phase, 'brief', 'design', 'review'),
  },
  {
    id: 'fly', title: 'Fly and learn',
    text: 'Run the tests, launch and take the decisions. The report explains why it went that way: improve and fly again.',
    done: (_, phase) => phase === 'report',
  },
];

export const coachSteps = (a: Analysis): CoachStep[] => (a.scenario.tutorial ? TUTORIAL : GENERAL.filter((s) => s.id !== 'crew' || !!a.crew));

/** The step to show: the first one not yet done (its index, for "step 3 of 10"). */
export function currentStep(a: Analysis, phase: string): { step: CoachStep; index: number; total: number } {
  const steps = coachSteps(a);
  const index = steps.findIndex((s) => !s.done(a, phase));
  const k = index < 0 ? steps.length - 1 : index;
  return { step: steps[k], index: k, total: steps.length };
}
