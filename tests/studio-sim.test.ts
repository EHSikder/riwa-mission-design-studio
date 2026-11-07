/**
 * Step 5C: flying studio missions and judging them. Every reference design flies to the end; Cadet runs have
 * no surprises; the same seed and choices replay identically; physics ends missions it should end.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/studio/model/analyze';
import { cloneDesign } from '../src/studio/model/design';
import { SCENARIOS } from '../src/studio/model/scenarios';
import { evaluate } from '../src/studio/model/score';
import { MissionRun } from '../src/studio/model/simulate';
import type { ScenarioId } from '../src/studio/model/types';

const ids = Object.keys(SCENARIOS) as ScenarioId[];

describe('flying the reference designs', () => {
  for (const id of ids) {
    it(`${id}: flies to an end and gets a score`, () => {
      const s = SCENARIOS[id];
      const a = analyze(s.example, s.tutorial ? 'cadet' : 'engineer');
      for (const seed of [1, 2, 3]) {
        const run = new MissionRun(a, seed).runToEnd();
        expect(run.ended).toBe(true);
        const r = evaluate(run);
        expect(r.score.total).toBeGreaterThanOrEqual(0);
        expect(r.score.total).toBeLessThanOrEqual(1000);
        expect(r.limited.length + r.worked.length).toBeGreaterThan(0);
      }
    });
  }

  it('a Cadet flight has no surprises and the reference design succeeds', () => {
    for (const id of ids) {
      const a = analyze(SCENARIOS[id].example, 'cadet');
      const run = new MissionRun(a, 7).runToEnd();
      expect(run.st.endReason, id).toBe('Mission complete');
      const r = evaluate(run);
      expect(r.outcome, `${id}: ${r.limited.join(' | ')}`).toMatch(/success/i);
      expect(r.score.total, id).toBeGreaterThan(650);
    }
  });

  it('the same seed and the same choices replay the same mission', () => {
    const a = analyze(SCENARIOS['angola-eo'].example, 'expert');
    const x = evaluate(new MissionRun(a, 42).runToEnd((e) => e.options![e.options!.length - 1].id));
    const y = evaluate(new MissionRun(a, 42).runToEnd((e) => e.options![e.options!.length - 1].id));
    expect(y.score.total).toBe(x.score.total);
    expect(y.decisions.length).toBe(x.decisions.length);
  });
});

describe('physics ends missions', () => {
  it('a low orbit without an engine decays before a long mission ends', () => {
    const d = { ...cloneDesign(SCENARIOS['angola-eo'].example), plannedYears: 8 };
    d.orbit = { ...d.orbit, altKm: 400 };
    d.launcher = 'electron';
    const run = new MissionRun(analyze(d, 'cadet'), 3).runToEnd();
    expect(run.st.endReason).toBe('Orbit decayed');
    const r = evaluate(run);
    expect(r.limited.some((l) => /decay/i.test(l))).toBe(true);
    expect(r.tryNext.some((l) => /higher|propulsion/i.test(l))).toBe(true);
  });

  it('a spacecraft too heavy for its rocket never leaves the ground', () => {
    // (Ariane 62 would do: from Kourou, near the equator, the climb to GEO is 300 m/s cheaper)
    const d = { ...cloneDesign(SCENARIOS['geo-comms'].example), launcher: 'pslv' as const };
    const a = analyze(d);
    expect(a.launch.ok).toBe(false);
    const run = new MissionRun(a, 1).runToEnd();
    expect(run.st.endReason).toBe('Could not be launched');
    expect(evaluate(run).score.success).toBe(0);
  });

  it('a battery too small for the eclipses wears out and the report says so', () => {
    const d = { ...cloneDesign(SCENARIOS['angola-eo'].example), batteryWh: 45 };
    const run = new MissionRun(analyze(d, 'cadet'), 5).runToEnd();
    expect(run.st.batteryWarned).toBe(true);
    expect(evaluate(run).tryNext.some((t) => /battery/i.test(t))).toBe(true);
  });
});
