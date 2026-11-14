/**
 * Angola's sky, measured: Landsat 8 and 9 cloud cover from the Microsoft Planetary Computer (model/angolaSky.ts,
 * written by scripts/landsat-sky.mjs) replaces the old guess of 55% clear. A camera's revisit and coverage use
 * it, the flood and first-light moments use its seasons, and radar does not care.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/studio/model/analyze';
import { cloneDesign } from '../src/studio/model/design';
import { SCENARIOS } from '../src/studio/model/scenarios';
import { ANGOLA_SKY, CLEAR_BY_MONTH, CLEAR_DRY, CLEAR_RAINY, CLEAR_YEAR, monthOf } from '../src/studio/model/sky';
import { MissionRun, type SimEvent } from '../src/studio/model/simulate';

describe("Angola's sky, measured by Landsat", () => {
  it('has twelve months of real pictures', () => {
    expect(ANGOLA_SKY.months).toHaveLength(12);
    expect(ANGOLA_SKY.scenes).toBeGreaterThan(10_000);
    for (const m of ANGOLA_SKY.months) {
      expect(m.scenes).toBeGreaterThan(500);
      expect(m.cloudPct).toBeGreaterThan(0);
      expect(m.cloudPct).toBeLessThan(100);
    }
  });

  it("shows Angola's seasons: the dry months (May to August) are far clearer than the rainy ones (November to March)", () => {
    expect(CLEAR_DRY - CLEAR_RAINY).toBeGreaterThan(0.25);
    expect(CLEAR_BY_MONTH[5]).toBeGreaterThan(CLEAR_BY_MONTH[0]);
    expect(CLEAR_YEAR).toBeGreaterThan(CLEAR_RAINY);
    expect(CLEAR_YEAR).toBeLessThan(CLEAR_DRY);
  });

  it('is what the Angola missions use, in place of the old guess', () => {
    for (const id of ['tutorial', 'angola-eo'] as const) {
      expect(SCENARIOS[id].clearSky).toBe(CLEAR_YEAR);
      expect(SCENARIOS[id].clearSkyByMonth).toBe(CLEAR_BY_MONTH);
    }
    expect(SCENARIOS['geo-comms'].clearSkyByMonth).toBeUndefined();
  });

  it("a camera's clear revisit is its raw revisit over the clear-sky chance, and says so with the seasons", () => {
    const a = analyze(SCENARIOS['angola-eo'].example, 'engineer');
    const r = a.requirements.find((x) => x.req.metric === 'revisit')!;
    expect(r.why).toMatch(/Landsat 8 and 9/);
    expect(r.why).toMatch(/rainy months/);
    const raw = Number(/every ([\d.]+) days on average/.exec(r.why)![1]);
    expect(r.value).toBeCloseTo(raw / CLEAR_YEAR, 0);
  });

  it('radar sees through the clouds: its revisit ignores them', () => {
    const d = cloneDesign(SCENARIOS['angola-eo'].example);
    d.primary = 'flood';
    d.secondary = [];
    d.instruments = ['sar'];
    const a = analyze(d, 'engineer');
    const r = a.requirements.find((x) => x.req.metric === 'revisit')!;
    expect(r.why).toMatch(/radar sees through clouds/);
  });

  it('counts calendar months from a January start', () => {
    expect(monthOf(0)).toBe(0);
    expect(monthOf(13.5)).toBe(1);
    expect(monthOf(23.9)).toBe(11);
    expect(monthOf(-1)).toBe(11);
  });

  it("a camera's first light meets the season it launches into", () => {
    const run = new MissionRun(analyze(SCENARIOS['angola-eo'].example, 'engineer'), 11);
    let first: SimEvent | undefined;
    for (let k = 0; k < 100_000 && !run.ended && !first; k++) {
      if (run.pending) run.choose(run.pending.options![0].id);
      else run.advance(30);
      first = run.events.find((e) => e.id === 'firstlight' && e.outcome);
    }
    expect(first?.outcome).toMatch(/Landsat 8 and 9 find \d+% of Angola clear in (January|February|March|April|May|June|July|August|September|October|November|December)/);
  });
});
