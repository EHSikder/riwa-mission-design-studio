/**
 * What the game takes from the challenge's Resources tab: GMAT's constants, the CubeSat Design Specification and
 * NASA's CubeSat 101 (masses, radios, licences, launch rules), JPL's Concept Maturity Levels and its point-design
 * margins, NASA's four mission segments and risk classes, and the "real missions like yours" ending of NASA's
 * telescope game.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/studio/model/analyze';
import { PLATFORMS } from '../src/studio/model/catalog';
import { cloneDesign, type StudioDesign } from '../src/studio/model/design';
import { EVENTS } from '../src/studio/model/events';
import { maturity, riskClass, segments } from '../src/studio/model/maturity';
import { circularPeriodS } from '../src/studio/model/orbit';
import { realMissionsLike } from '../src/studio/model/realMissions';
import { SCENARIOS } from '../src/studio/model/scenarios';
import { MissionRun } from '../src/studio/model/simulate';
import { BODIES, GEO_RADIUS } from '../src/studio/model/types';

const eo = SCENARIOS['angola-eo'].example;
const cube = SCENARIOS.tutorial.example;

/** Run until the team is asked `id`, answering everything else with its first option. */
function until(run: MissionRun, id: string) {
  for (let k = 0; k < 100_000 && !run.ended; k++) {
    if (run.pending?.id === id) return run.pending;
    if (run.pending) run.choose(run.pending.options![0].id); else run.advance(30);
  }
  return null;
}

describe('GMAT constants', () => {
  it('uses the defaults NASA GMAT starts with', () => {
    expect(BODIES.earth.mu).toBeCloseTo(398_600.4415e9, -3);
    expect(BODIES.earth.radius).toBe(6_378_136.3);
    expect(BODIES.moon.radius).toBe(1_738_200);
    expect(BODIES.mars.radius).toBe(3_397_000);
  });

  it('puts the geostationary orbit at GMAT\'s radius: one turn per sidereal day', () => {
    expect(GEO_RADIUS).toBe(42_164_169);
    expect(circularPeriodS(BODIES.earth, GEO_RADIUS) / 60).toBeCloseTo(1436.07, 1);
  });
});

describe('CubeSat rules', () => {
  it('limits a 6U to 12 kg and a 12U to 24 kg (CubeSat Design Specification 14.1)', () => {
    expect(PLATFORMS.cube6u.maxMassKg).toBe(12);
    expect(PLATFORMS.cube12u.maxMassKg).toBe(24);
  });

  it('flags a CubeSat radio louder than CubeSat radios really are', () => {
    const loud = { ...cloneDesign(cube), txW: 12 };
    const a = analyze(loud, 'engineer');
    expect(a.issues.some((i) => /0\.5–5 W/.test(i.text))).toBe(true);
    expect(analyze(cube, 'engineer').issues.some((i) => /0\.5–5 W/.test(i.text))).toBe(false);
  });
});

describe('the licences', () => {
  it('are filed by the communications desk before the ground tests', () => {
    const run = new MissionRun(analyze(eo, 'cadet'), 5);
    const p = until(run, 'licence');
    expect(p?.role).toBe('comms');
    expect(p?.text).toMatch(/Earth-imaging licence/);
    expect(run.events.some((e) => e.id.startsWith('test:'))).toBe(false);
  });

  it('are refused until a spacecraft that would stay up too long gets a drag sail', () => {
    const high = cloneDesign(cube);
    high.orbit = { ...high.orbit, altKm: 850 };
    const a = analyze(high, 'cadet');
    expect(a.debris.ruleOk).toBe(false);
    const run = new MissionRun(a, 5);
    until(run, 'licence');
    const month = run.st.launchMonth;
    run.choose('file');
    const filed = run.events.find((e) => e.id === 'licence');
    expect(filed?.outcome).toMatch(/drag sail/);
    expect(run.st.extraM).toBeGreaterThan(0);
    expect(run.st.launchMonth).toBeGreaterThanOrEqual(month);
  });
});

describe('parts arrive heavier', () => {
  const spec = EVENTS.find((e) => e.id === 'mass-growth')!;

  it('is absorbed when there is mass margin to spare', () => {
    const a = analyze(eo, 'engineer');
    const run = new MissionRun(a, 3);
    run.st.growthKg = 0.5 * (a.mass.limitKg - a.mass.wetKg);
    expect(spec.options!(a, run.st)).toEqual([]);
    expect(spec.resolve(run, undefined)).toMatch(/margin absorbed it/);
  });

  it('costs time and money when the margin was too thin', () => {
    const a = analyze(eo, 'engineer');
    const run = new MissionRun(a, 3);
    run.st.growthKg = a.mass.limitKg - a.mass.wetKg + 5;
    const opts = spec.options!(a, run.st);
    expect(opts.map((o) => o.id)).toContain('lighten');
    const before = run.st.readyMonth;
    spec.resolve(run, 'lighten');
    expect(run.st.readyMonth).toBeCloseTo(before + 2);
    expect(run.st.extraM).toBeGreaterThan(0);
  });
});

describe('concept maturity (JPL)', () => {
  it('an empty assembly stand is only an idea: CML 1', () => {
    const m = maturity(analyze(SCENARIOS['angola-eo'].starter, 'engineer'), 0);
    expect(m.level).toBe(1);
    expect(m.next).toMatch(/CML 2/);
  });

  it('a working design without compared options stops before the trade space', () => {
    const a = analyze(eo, 'engineer');
    expect(maturity(a, 0).level).toBe(2);
    expect(maturity(a, 0).next).toMatch(/options compared/);
    expect(maturity(a, 2).level).toBeGreaterThanOrEqual(3);
  });

  it('asks a point design for JPL\'s 35% mass and power margins', () => {
    const m = maturity(analyze(eo, 'engineer'), 2);
    const labels = m.items.filter((i) => i.level === 4).map((i) => i.label);
    expect(labels).toContain('Mass growth allowance and margin ≥ 35%');
    expect(labels).toContain('Power margin ≥ 35%');
    expect(labels).toContain('Link margin ≥ 3 dB');
  });
});

describe('NASA segments and risk classes', () => {
  it('starts the four segments from the user', () => {
    const s = segments(analyze(eo, 'engineer'));
    expect(s.map((x) => x.id)).toEqual(['user', 'space', 'ground', 'launch']);
    expect(s[0].value).toBe(SCENARIOS['angola-eo'].customer);
  });

  it('rates a crewed flight class A and a short CubeSat mission lower', () => {
    expect(riskClass(analyze(SCENARIOS['crew-moon'].example, 'engineer')).cls).toBe('A');
    const short: StudioDesign = { ...cloneDesign(cube), plannedYears: 0.5 };
    expect(riskClass(analyze(short, 'engineer')).cls).toBe('D');
  });
});

describe('real missions like yours', () => {
  it('matches each mission with real ones that flew to the same place', () => {
    expect(realMissionsLike(analyze(SCENARIOS['mars-orbiter'].example, 'engineer')).map((m) => m.mission.body)).toEqual(['mars', 'mars', 'mars']);
    expect(realMissionsLike(analyze(SCENARIOS['geo-comms'].example, 'engineer'))[0].mission.id).toBe('angosat2');
  });

  it('shows crewed flights only for crewed designs', () => {
    const crew = realMissionsLike(analyze(SCENARIOS['crew-moon'].example, 'engineer'));
    expect(crew.length).toBeGreaterThan(0);
    expect(crew.every((m) => m.mission.size === 'crew')).toBe(true);
    expect(realMissionsLike(analyze(cube, 'engineer')).every((m) => m.mission.size !== 'crew')).toBe(true);
  });

  it('finds a CubeSat for a CubeSat', () => {
    expect(realMissionsLike(analyze(cube, 'engineer')).some((m) => m.mission.size === 'cubesat')).toBe(true);
  });
});
