/**
 * What the resource box says when a resource is clicked: each problem in a few words and why it matters, or
 * nothing at all when it fits. A red resource always says why, even when its bar sits in the middle.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/studio/model/analyze';
import { cloneDesign } from '../src/studio/model/design';
import { SCENARIOS } from '../src/studio/model/scenarios';
import type { ScenarioId } from '../src/studio/model/types';

const IDS: ScenarioId[] = ['tutorial', 'angola-eo', 'geo-comms', 'lunar-relay', 'mars-orbiter', 'crew-moon'];

describe('the resource box', () => {
  it('says what is missing on an empty stand', () => {
    const a = analyze(SCENARIOS['angola-eo'].starter, 'engineer');
    expect(a.resources.mass.problems[0]).toMatchObject({ title: 'No structure added', tag: 'Not built' });
    expect(a.resources.power.problems[0]).toMatchObject({ title: 'No solar arrays added' });
  });

  it('a mass with room to spare but no rocket is red, and says it is the rocket', () => {
    const d = cloneDesign(SCENARIOS['angola-eo'].example);
    d.launcher = 'none';
    const a = analyze(d, 'engineer');
    expect(a.resources.mass.status).toBe('fail');
    expect(a.resources.mass.gauge?.zone).not.toBe('under');
    expect(a.resources.mass.problems[0]).toMatchObject({ title: 'No launcher chosen', tag: 'No launcher' });
  });

  it('too little and too much each say so, with why', () => {
    const tight = cloneDesign(SCENARIOS['angola-eo'].example);
    tight.arrayM2 = 0.3;
    const big = cloneDesign(SCENARIOS['angola-eo'].example);
    big.arrayM2 = 3;
    expect(analyze(tight, 'engineer').resources.power.problems.map((p) => p.title)).toContain('Too little power');
    const over = analyze(big, 'engineer').resources.power.problems;
    expect(over.map((p) => p.title)).toContain('Too much power');
    expect(over.every((p) => p.why.length > 10)).toBe(true);
  });

  it('a resource that fits has nothing to say', () => {
    for (const id of IDS) {
      const a = analyze(SCENARIOS[id].example, 'engineer');
      for (const r of Object.values(a.resources)) if (r.status === 'good' && r.gauge?.zone === 'right') expect(r.problems, `${id} ${r.id}`).toEqual([]);
    }
  });

  it('every red or yellow resource, in every mission, says what is wrong in a few words', () => {
    for (const id of IDS) {
      for (const d of [SCENARIOS[id].starter, SCENARIOS[id].example]) {
        const a = analyze(d, 'engineer');
        for (const r of Object.values(a.resources)) {
          if (r.status === 'fail' || r.status === 'warn') expect(r.problems.length, `${id} ${r.id}`).toBeGreaterThan(0);
          for (const p of r.problems) {
            expect(p.title.length, `${id} ${r.id}: ${p.title}`).toBeLessThan(45);
            expect(`${p.title} ${p.why}`).not.toMatch(/NaN|Infinity|undefined/);
            if (p.tag) expect(p.tag.length, p.tag).toBeLessThanOrEqual(12);
          }
        }
      }
    }
  });
});
