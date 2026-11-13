/**
 * Building, testing and flying as things the team does, not things that happen to it. Each planned test is a
 * step somebody runs; a test finds the flaw of its kind, and a flaw nobody looked for flies; after liftoff the
 * team unfolds the wings, listens for the signal and switches the payload on; in orbit, problems arrive as
 * telemetry to read, and the fix that matches the cause is the one that works.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/studio/model/analyze';
import { cloneDesign, type StudioDesign } from '../src/studio/model/design';
import { SCENARIOS } from '../src/studio/model/scenarios';
import { evaluate } from '../src/studio/model/score';
import { MissionRun, type SimEvent } from '../src/studio/model/simulate';
import { latentDefects, type DefectId } from '../src/studio/model/tests';
import type { Difficulty, ScenarioId } from '../src/studio/model/types';

const eo = SCENARIOS['angola-eo'].example;

/** A flight seed whose build hides this flaw. */
function seedWith(flaw: DefectId, d: StudioDesign = eo): number {
  for (let s = 1; s < 2000; s++) if (latentDefects(s, d).includes(flaw)) return s;
  throw new Error(`no seed with a ${flaw} flaw`);
}

/** Play to the end, answering with `pick`; returns everything the team was asked, in order. */
function play(run: MissionRun, pick: (e: SimEvent) => string = (e) => e.options![0].id): SimEvent[] {
  const asked: SimEvent[] = [];
  for (let k = 0; k < 100_000 && !run.ended; k++) {
    if (run.pending) { asked.push({ ...run.pending }); run.choose(pick(run.pending)); } else run.advance(30);
  }
  return asked;
}
const fly = (d: StudioDesign, seed: number, difficulty: Difficulty = 'engineer') => new MissionRun(analyze(d, difficulty), seed);
/** Advance until the team is asked something (or the mission ends). */
function until(run: MissionRun, id: string, pick: (e: SimEvent) => string = (e) => e.options![0].id) {
  for (let k = 0; k < 100_000 && !run.ended; k++) {
    if (run.pending?.id === id) return run.pending;
    if (run.pending) run.choose(pick(run.pending)); else run.advance(30);
  }
  return null;
}

describe('the test campaign is run by hand', () => {
  it('each planned test is a step somebody runs, in order, before the launch', () => {
    const asked = play(fly(eo, 11));
    const steps = asked.filter((e) => e.kind === 'action').map((e) => e.id);
    const launch = steps.indexOf('launch');
    expect(steps.slice(0, launch).filter((id) => id.startsWith('test:'))).toEqual(['test:vibration', 'test:tvac', 'test:deploy', 'test:compat', 'test:rehearsal']);
    for (const e of asked.filter((x) => x.kind === 'action')) expect(e.role, e.id).toBeTruthy();
  });

  it('a test finds the flaw of its kind, and fixing it costs weeks and money', () => {
    const seed = seedWith('structure');
    const run = fly(eo, seed);
    expect(until(run, 'test:vibration')).not.toBeNull();
    const ready = run.st.readyMonth, spent = run.st.extraM;
    run.choose('run');
    expect(run.pending?.id).toBe('found:structure');
    expect(run.pending!.options!.map((o) => o.id)).toEqual(['fix', 'fly']);
    run.choose('fix');
    expect(run.st.readyMonth - ready).toBeCloseTo(6 / 4.345, 5);
    expect(run.st.extraM).toBeGreaterThan(spent);
    expect(run.flaws.has('structure')).toBe(false);
  });

  it('a flaw nobody tested for flies, and shows up after liftoff', () => {
    const d = { ...cloneDesign(eo), tests: [] };
    const run = fly(d, seedWith('structure', d));
    const asked = play(run);
    expect(asked.some((e) => e.id.startsWith('test:'))).toBe(false);
    const hit = run.events.find((e) => e.id === 'flaw:structure');
    expect(hit?.kind).toBe('failure');
    expect(Object.values(run.st.health).some((h) => h! < 1)).toBe(true);
  });

  it('flying with a flaw the test found is a gamble the report names', () => {
    const run = fly(eo, seedWith('structure'));
    play(run, (e) => (e.id === 'found:structure' ? 'fly' : e.options![0].id));
    expect(run.events.some((e) => e.id === 'flaw:structure')).toBe(true);
    expect(evaluate(run).limited.some((l) => /gamble/i.test(l))).toBe(true);
  });

  it('a Cadet build hides no flaws: the tests are run and pass', () => {
    const run = fly(eo, seedWith('structure'), 'cadet');
    const asked = play(run);
    expect(asked.filter((e) => e.id.startsWith('test:'))).toHaveLength(5);
    expect(asked.some((e) => e.id.startsWith('found:'))).toBe(false);
    expect(run.flaws.size).toBe(0);
  });
});

describe('after liftoff the team commissions the spacecraft', () => {
  it('unfold, listen, switch on: each step belongs to a desk', () => {
    const asked = play(fly(eo, 3, 'cadet'));
    const steps = asked.filter((e) => e.kind === 'action' && !e.id.startsWith('test:')).map((e) => `${e.id}/${e.role}`);
    expect(steps).toEqual(['launch/director', 'deploy/spacecraft', 'signal/comms', 'firstlight/science']);
  });

  it('a wing that sticks can be worked loose, or flown as it is', () => {
    const d = { ...cloneDesign(eo), tests: [] };
    const run = fly(d, seedWith('deploy', d));
    const p = until(run, 'flaw:deploy');
    expect(p).not.toBeNull();
    expect(p!.options!.length).toBeGreaterThanOrEqual(3);
    expect(p!.telemetry!.length).toBeGreaterThanOrEqual(3);
    run.choose('accept');
    expect(run.st.arrayFactor).toBe(0.5);
  });

  it('far from Earth the braking burn is a step, and without the propellant the spacecraft flies past', () => {
    const mars = SCENARIOS['mars-orbiter'].example;
    const ok = play(fly(mars, 5, 'cadet'));
    expect(ok.some((e) => e.id === 'insertion' && e.role === 'director')).toBe(true);
    // tanks filled a third short of the Δv budget
    const run = fly({ ...cloneDesign(mars), propellantMarginPct: -35 }, 5, 'cadet');
    play(run);
    expect(run.st.endReason).toBe('Missed the orbit');
    // and with no engine at all the review never lets it leave the ground
    const none = fly({ ...cloneDesign(mars), propulsion: 'none' }, 5, 'cadet');
    play(none);
    expect(none.st.endReason).toBe('Could not be launched');
  });

  it('a spacecraft with parts missing is not launched', () => {
    const run = fly(SCENARIOS['angola-eo'].starter, 1, 'cadet');
    play(run);
    expect(run.st.endReason).toBe('Could not be launched');
  });
});

describe('problems in orbit are diagnosed from telemetry', () => {
  const firstAnomaly = (seed: number) => {
    const run = fly(eo, seed);
    for (let k = 0; k < 100_000 && !run.ended; k++) {
      if (run.pending?.id.startsWith('anomaly:')) return run;
      if (run.pending) run.choose(run.pending.options![0].id); else run.advance(30);
    }
    throw new Error('no anomaly in this flight');
  };

  it('the readings point at one cause; its fix works, a wrong guess costs more', () => {
    const right = firstAnomaly(21), wrong = firstAnomaly(21);
    const p = right.pending!;
    expect(p.telemetry!.length).toBeGreaterThanOrEqual(3);
    expect(p.options!.length).toBeGreaterThanOrEqual(4);
    expect(p.scored.filter((o) => o.quality >= 0.9)).toHaveLength(1);
    const good = p.scored.find((o) => o.quality >= 0.9)!.id;
    const bad = p.scored.find((o) => o.quality < 0.5)!.id;
    right.choose(good);
    wrong.choose(bad);
    expect(wrong.st.safeDays).toBeGreaterThan(right.st.safeDays);
    expect(wrong.events[wrong.events.length - 1].outcome).not.toBe(right.events[right.events.length - 1].outcome);
  });

  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) {
    if (SCENARIOS[id].tutorial) continue;
    it(`${id}: an Engineer flight meets at least two problems to diagnose`, () => {
      for (const seed of [1, 2, 3]) {
        const run = fly(SCENARIOS[id].example, seed);
        const asked = play(run, (e) => e.options![e.options!.length - 1].id);
        // a mission cut short may not live long enough to meet them all
        if (run.st.endReason === 'Mission complete') expect(asked.filter((e) => e.id.startsWith('anomaly:')).length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      }
    });
  }

  it('the same seed and the same answers replay the same flight', () => {
    const a = play(fly(eo, 77), (e) => e.options![e.options!.length - 1].id).map((e) => `${e.id}@${e.when}`);
    const b = play(fly(eo, 77), (e) => e.options![e.options!.length - 1].id).map((e) => `${e.id}@${e.when}`);
    expect(b).toEqual(a);
  });
});
