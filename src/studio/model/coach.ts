/**
 * The coach (docs/03 §9): one small step at a time for beginners (the tutorial, and Cadet games). Each step
 * names the desk to open, says what to do and why it matters, and checks the real design to know when it is
 * done, so the coach follows the player rather than a script. The first unfinished step is the one shown.
 */
import type { Analysis } from './analyze';
import type { RoleId } from './types';

export interface CoachStep {
  id: string;
  title: string;
  text: string;
  /** The desk that holds the controls for this step. */
  desk?: RoleId;
  done: (a: Analysis, phase: string) => boolean;
}

const fails = (a: Analysis, role: RoleId) => a.issues.some((i) => i.level === 'fail' && i.role === role);
const past = (phase: string, ...these: string[]) => !these.includes(phase);
const usefulOnBoard = (a: Analysis) => {
  const o = a.scenario.objectives.find((x) => x.id === a.design.primary);
  return !!o && a.design.instruments.some((i) => (o.value[i] ?? 0) >= 0.5);
};

/** The tutorial (First Light): one idea per step, on a 12U CubeSat. */
const TUTORIAL: CoachStep[] = [
  {
    id: 'brief', title: 'Read the brief',
    text: 'A university club in Luanda wants pictures of Angola from space. The objective is already chosen. Press "Start designing".',
    done: (_, phase) => past(phase, 'brief'),
  },
  {
    id: 'camera', title: 'Give it eyes', desk: 'science',
    text: 'A satellite is a box that carries something useful: its payload. Open the Payload desk and add the CubeSat camera. Watch the mass, power and money on the right change.',
    done: (a) => a.design.instruments.includes('cubecam'),
  },
  {
    id: 'pointing', title: 'Hold the camera steady', desk: 'spacecraft',
    text: 'The camera needs to point within 1°, but magnetorquers only manage 5°, so the pictures would smear. On the Spacecraft desk, pick reaction wheels and a star tracker.',
    done: (a) => a.design.adcs !== 'magnetorquer',
  },
  {
    id: 'power', title: 'Catch more sunlight', desk: 'spacecraft',
    text: 'Cells glued on the box only see the Sun part of the time. Switch the solar arrays to "Deployed fixed wings", then press "Size it for me". Power is now in the green on the dashboard.',
    done: (a) => a.design.mount !== 'body' && a.resources.power.status !== 'fail',
  },
  {
    id: 'battery', title: 'Survive the shadow', desk: 'spacecraft',
    text: 'Every 95 minutes the satellite flies through Earth\'s shadow for over half an hour. The battery must carry it, and shallow drains make it last. Press "Size it for me" under Battery.',
    done: (a) => a.power.dod <= a.power.dodAllowed + 1e-9 && a.design.batteryWh * 0.9 >= a.power.eclipseWh,
  },
  {
    id: 'downlink', title: 'Send the pictures home', desk: 'comms',
    text: 'UHF radio carries a trickle of kilobits: pictures would pile up and be lost. On the Comms desk, switch to S-band. Data turns green when the link can send everything the camera takes.',
    done: (a) => a.data.lossPct < 5 && a.design.band !== 'UHF',
  },
  {
    id: 'green', title: 'Everything in the green',
    text: 'Look at the six resources on the right. Fix anything marked "Fails": tap a card to read why. When none fails, go to Review (top right).',
    done: (a, phase) => Object.values(a.resources).every((r) => r.status !== 'fail') && past(phase, 'brief', 'design'),
  },
  {
    id: 'launch', title: 'Launch',
    text: 'The review board lists every check. If it says GO, press "Launch the mission".',
    done: (_, phase) => past(phase, 'brief', 'design', 'review'),
  },
  {
    id: 'fly', title: 'Fly the mission',
    text: 'Years go by in seconds. Watch the battery, the data and the money. When the mission ends, open the report.',
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
    id: 'brief', title: 'Choose the objective',
    text: 'Pick what the mission is for. Each objective brings its own requirements. Then press "Start designing".',
    done: (_, phase) => past(phase, 'brief'),
  },
  {
    id: 'payload', title: 'Choose instruments', desk: 'science',
    text: 'On the Payload desk, add at least one instrument marked ★ for your objective. Each one costs mass, power, money and data.',
    done: (a) => usefulOnBoard(a),
  },
  {
    id: 'rocket', title: 'Orbit and rocket', desk: 'director',
    text: 'On the Mission desk, check the orbit and pick a launcher marked ✓: it must lift your spacecraft to that orbit.',
    done: (a) => a.launch.ok,
  },
  {
    id: 'bus', title: 'Make the spacecraft work', desk: 'spacecraft',
    text: 'Fix the Spacecraft desk\'s problems (the red number on its tab): power, battery, pointing, propulsion. "Size it for me" helps.',
    done: (a) => !fails(a, 'spacecraft') && !fails(a, 'science'),
  },
  {
    id: 'comms', title: 'Bring the data home', desk: 'comms',
    text: 'On the Comms desk, pick a band, an antenna and a ground station that can send home what the instruments make.',
    done: (a) => !fails(a, 'comms') && a.resources.comms.status !== 'fail' && a.resources.data.status !== 'fail',
  },
  {
    id: 'money', title: 'Stay within budget', desk: 'resources',
    text: 'The Resources desk shows where the money goes. Cheaper parts or launcher, fewer years, or a smaller reserve bring the total down.',
    done: (a) => a.resources.budget.status !== 'fail' && !fails(a, 'resources') && !fails(a, 'director'),
  },
  {
    id: 'review', title: 'Review and launch',
    text: 'Everything in the green? Go to Review, read the board\'s findings, and launch.',
    done: (_, phase) => past(phase, 'brief', 'design', 'review'),
  },
  {
    id: 'fly', title: 'Fly and learn',
    text: 'Watch the mission and take the decisions. The report explains why it went that way: improve and fly again.',
    done: (_, phase) => phase === 'report',
  },
];

export const coachSteps = (a: Analysis): CoachStep[] => (a.scenario.tutorial ? TUTORIAL : GENERAL);

/** The step to show: the first one not yet done (its index, for "step 3 of 10"). */
export function currentStep(a: Analysis, phase: string): { step: CoachStep; index: number; total: number } {
  const steps = coachSteps(a);
  const index = steps.findIndex((s) => !s.done(a, phase));
  const k = index < 0 ? steps.length - 1 : index;
  return { step: steps[k], index: k, total: steps.length };
}
