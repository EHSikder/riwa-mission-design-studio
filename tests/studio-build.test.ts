/**
 * Building from nothing and testing before launch. Every mission starts with an empty assembly stand; the
 * analysis says what is still missing; the test campaign costs weeks and money, and decides which hidden flaws
 * are found on the ground and which ones fly.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/studio/model/analyze';
import { cloneDesign } from '../src/studio/model/design';
import { SCENARIOS } from '../src/studio/model/scenarios';
import type { ScenarioId } from '../src/studio/model/types';

const ids = Object.keys(SCENARIOS) as ScenarioId[];

describe('starting with nothing built', () => {
  for (const id of ids) {
    it(`${id}: the stand is empty, the build list says what is missing, and no number is broken`, () => {
      const a = analyze(SCENARIOS[id].starter, 'engineer');
      const missing = a.build.filter((b) => !b.done).map((b) => b.id);
      for (const part of ['structure', 'power', 'battery', 'computer', 'pointing', 'payload', 'radio', 'station', 'launcher']) expect(missing).toContain(part);
      for (const r of Object.values(a.resources)) {
        expect(`${r.headline} ${r.why}`, r.id).not.toMatch(/NaN|Infinity|undefined/);
        expect(Number.isNaN(r.marginPct), `${r.id} margin`).toBe(false);
      }
      // each missing part is a blocking problem that says where to fix it
      const fails = a.issues.filter((i) => i.level === 'fail');
      expect(fails.length).toBeGreaterThanOrEqual(8);
      for (const f of fails) expect(f.fix, f.text).toBeTruthy();
    });

    it(`${id}: the reference design has everything on the list`, () => {
      const a = analyze(SCENARIOS[id].example, 'engineer');
      expect(a.build.filter((b) => !b.done).map((b) => b.id)).toEqual([]);
    });
  }

  it('adding the parts one at a time ticks them off', () => {
    const d = cloneDesign(SCENARIOS['angola-eo'].starter);
    const left = () => analyze(d).build.filter((b) => !b.done).map((b) => b.id);
    d.platform = 'micro';
    expect(left()).not.toContain('structure');
    d.arrayM2 = 0.6;
    d.batteryWh = 120;
    expect(left()).not.toContain('power');
    expect(left()).not.toContain('battery');
    d.antenna = 'helix';
    expect(left()).toContain('radio'); // a radio also needs somewhere to keep the data
    d.storageGbit = 128;
    expect(left()).not.toContain('radio');
  });
});

describe('the test campaign', () => {
  it('each planned test costs weeks and money', () => {
    const eo = SCENARIOS['angola-eo'].example;
    const none = analyze({ ...cloneDesign(eo), tests: [] });
    const shake = analyze({ ...cloneDesign(eo), tests: ['vibration'] });
    const all = analyze(eo);
    expect(shake.cost.developmentM).toBeGreaterThan(none.cost.developmentM);
    expect(shake.time.devMonths - none.time.devMonths).toBeCloseTo(2 / 4.345, 5);
    expect(all.tests.planned).toEqual(['vibration', 'tvac', 'deploy', 'compat', 'rehearsal']);
    expect(all.tests.weeks).toBe(10);
    expect(all.cost.developmentM).toBeGreaterThan(shake.cost.developmentM);
  });

  it('a test left out is a risk the board names; a test that does not apply is not asked for', () => {
    const eo = SCENARIOS['angola-eo'].example;
    const a = analyze({ ...cloneDesign(eo), tests: ['vibration'] });
    expect(a.tests.skipped).toEqual(['tvac', 'deploy', 'compat', 'rehearsal']);
    expect(a.issues.filter((i) => i.level === 'warn' && /thermal vacuum test/i.test(i.text))).toHaveLength(1);
    // cells on the body and a patch antenna: nothing unfolds, so no deployment test
    const fixed = analyze({ ...cloneDesign(eo), mount: 'body', arrayM2: 0.3, antenna: 'patch' });
    expect([...fixed.tests.planned, ...fixed.tests.skipped]).not.toContain('deploy');
    // nobody on board: no crew tests
    expect([...a.tests.planned, ...a.tests.skipped]).not.toContain('eclss');
  });
});
