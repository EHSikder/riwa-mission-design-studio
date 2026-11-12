/**
 * Step 5A: the game's model. The physics against textbook values, the link budgets against
 * real missions, the ground-track coverage engine, and every scenario's reference design closing.
 */
import { describe, expect, it } from 'vitest';
import { computeAccess, earthMarsGeometry, lunarRelayGeometry, reachAngle } from '../src/studio/model/access';
import { analyze } from '../src/studio/model/analyze';
import { cloneDesign } from '../src/studio/model/design';
import { dishGainDbi, linkRate, availabilityPct } from '../src/studio/model/link';
import {
  circularPeriodS, decayYears, eclipseFraction, gtoToGeoDv, marsCaptureDv, orbitFacts, ssoInclinationDeg,
} from '../src/studio/model/orbit';
import { REGIONS, regionArea, regionGrid } from '../src/studio/model/regions';
import { SCENARIOS } from '../src/studio/model/scenarios';
import { BODIES, type ScenarioId } from '../src/studio/model/types';

const earth = BODIES.earth;

describe('orbits', () => {
  it('Kepler period and the sun-synchronous tilt', () => {
    expect(circularPeriodS(earth, earth.radius + 500e3) / 60).toBeCloseTo(94.6, 0);
    expect(ssoInclinationDeg(earth, 700)).toBeCloseTo(98.19, 0);
    expect(ssoInclinationDeg(earth, 500)).toBeCloseTo(97.4, 0);
    // Mars Reconnaissance Orbiter: ~93° at ~300 km
    expect(ssoInclinationDeg(BODIES.mars, 300)).toBeGreaterThan(92.3);
    expect(ssoInclinationDeg(BODIES.mars, 300)).toBeLessThan(93.2);
  });

  it('eclipses: 36 minutes in low orbit, 70 minutes at GEO, none for a dawn-dusk orbit', () => {
    expect(eclipseFraction(earth, 500, 0)).toBeCloseTo(0.378, 2);
    const geo = orbitFacts({ type: 'geo', altKm: 0, incDeg: 0, ltanH: 12, lonDeg: 23, transfer: 'direct', capture: 'aerobrake' });
    expect(geo.eclipseMin).toBeGreaterThan(68);
    expect(geo.eclipseMin).toBeLessThan(71);
    const dawnDusk = orbitFacts({ type: 'sso', altKm: 600, incDeg: 0, ltanH: 18, lonDeg: 0, transfer: 'direct', capture: 'aerobrake' });
    const lateMorning = orbitFacts({ type: 'sso', altKm: 600, incDeg: 0, ltanH: 10.5, lonDeg: 0, transfer: 'direct', capture: 'aerobrake' });
    expect(dawnDusk.eclipseMin).toBeLessThan(lateMorning.eclipseMin);
    expect(lateMorning.eclipseMin).toBeGreaterThan(25);
  });

  it('drag: low orbits fall in years, higher ones in decades', () => {
    const b = 0.02;
    const at400 = decayYears(400, b), at500 = decayYears(500, b), at700 = decayYears(700, b);
    expect(at400).toBeLessThan(at500);
    expect(at400).toBeLessThan(2);
    expect(at500).toBeGreaterThan(2);
    expect(at500).toBeLessThan(15);
    expect(at700).toBeGreaterThan(25);
  });

  it('the climb to GEO and the brake into Mars orbit', () => {
    expect(gtoToGeoDv(27)).toBeGreaterThan(1_780);
    expect(gtoToGeoDv(27)).toBeLessThan(1_820);
    expect(gtoToGeoDv(6)).toBeLessThan(1_510);
    expect(marsCaptureDv(300, null)).toBeGreaterThan(2_000);
    expect(marsCaptureDv(300, null)).toBeLessThan(2_150);
    expect(marsCaptureDv(300, 33_000)).toBeGreaterThan(850);
    expect(marsCaptureDv(300, 33_000)).toBeLessThan(960);
  });

  it('looking sideways: 30° off nadir from 600 km reaches ~350 km', () => {
    const km = (reachAngle(earth, 600, 30) * earth.radius) / 1000;
    expect(km).toBeGreaterThan(320);
    expect(km).toBeLessThan(380);
  });
});

describe('regions and links', () => {
  it('Angola\'s outline encloses about 1.25 million km²', () => {
    const km2 = regionArea(REGIONS.angola, earth.radius) / 1e6;
    expect(km2).toBeGreaterThan(1.1e6);
    expect(km2).toBeLessThan(1.4e6);
    expect(regionGrid(REGIONS.angola).length).toBeGreaterThan(300);
    expect(regionGrid(REGIONS.luanda).length).toBeGreaterThan(0);
  });

  it('X-band from low orbit carries hundreds of Mbps; Mars Reconnaissance Orbiter-class links a few Mbps at 1.5 AU', () => {
    const leo = linkRate({ txW: 5, txGainDbi: 12, freqHz: 8.4e9, rxGtDbK: 32, capMbps: 800, lossDb: 0.4 }, 1.5e6);
    expect(leo.mbps).toBe(800);
    const mars = linkRate({ txW: 100, txGainDbi: dishGainDbi(3, 8.4e9), freqHz: 8.4e9, rxGtDbK: 54.3, capMbps: 800, lossDb: 0.4 }, 1.5 * 1.496e11);
    expect(mars.mbps).toBeGreaterThan(1);
    expect(mars.mbps).toBeLessThan(4);
  });

  it('rain: C-band shrugs off a tropical storm, Ka-band does not', () => {
    expect(availabilityPct('C', 4)).toBeGreaterThan(99.98);
    expect(availabilityPct('Ka', 8)).toBeLessThan(99.9);
    expect(availabilityPct('Ku', 6)).toBeGreaterThan(availabilityPct('Ka', 6));
  });
});

describe('coverage and geometry', () => {
  it('a 290 km swath from a 700 km SSO looks at Angola every few days; a station in Luanda keeps latency short', () => {
    const facts = orbitFacts({ type: 'sso', altKm: 700, incDeg: 0, ltanH: 10.5, lonDeg: 0, transfer: 'direct', capture: 'aerobrake' });
    const half = 145e3 / earth.radius;
    const a = computeAccess({
      body: earth, altKm: 700, incDeg: facts.incDeg, raanDeg: facts.raanDeg, days: 30, stepS: 30,
      sensors: [{ id: 'cam', halfSwathRad: half, reachRad: half, daylight: true }],
      regions: ['angola'],
      stations: [{ id: 'luanda', lat: -8.92, lon: 13.42, minElDeg: 5 }],
    });
    const r = a.regions.angola!;
    expect(r.sensors.cam.revisitDays).toBeGreaterThan(5);
    expect(r.sensors.cam.revisitDays).toBeLessThan(15);
    expect(r.latencyH).toBeLessThan(6);
    expect(a.contactMinPerDay[0]).toBeGreaterThan(15);
    expect(a.contactMinPerDay[0]).toBeLessThan(80);
  });

  it('the Moon: an L2 halo sees the far side and Earth at once; a low orbit is hidden from Earth part of the time', () => {
    const halo = lunarRelayGeometry('halo');
    expect(halo.sites.vonKarman.relayed).toBeGreaterThan(0.9);
    expect(halo.quiet).toBeLessThan(0.05);
    const llo = lunarRelayGeometry('llo');
    expect(llo.quiet).toBeGreaterThan(0.25);
    expect(llo.quiet).toBeLessThan(0.5);
    expect(llo.sites.vonKarman.seen).toBeLessThan(0.2);
    const elfo = lunarRelayGeometry('elfo');
    expect(elfo.sites.southPole.seen).toBeGreaterThan(halo.sites.southPole.seen);
  });

  it('Mars: from 1.6 AU at arrival to conjunction behind the Sun and back', () => {
    expect(earthMarsGeometry(0).distM / 1.496e11).toBeCloseTo(1.6, 1);
    const conj = earthMarsGeometry(227);
    expect(conj.distM / 1.496e11).toBeGreaterThan(2.4);
    expect(conj.sepDeg).toBeLessThan(3);
  });
});

describe('scenarios', () => {
  const ids = Object.keys(SCENARIOS) as ScenarioId[];

  for (const id of ids) {
    it(`${id}: the reference design closes`, () => {
      const s = SCENARIOS[id];
      const a = analyze(s.example, s.tutorial ? 'cadet' : 'engineer');
      const fails = a.issues.filter((i) => i.level === 'fail');
      if (fails.length) console.log(id, fails.map((f) => f.text));
      expect(fails).toHaveLength(0);
      for (const r of Object.values(a.resources)) expect(r.status, `${id} ${r.id}: ${r.why}`).not.toBe('fail');
      const primary = a.requirements.filter((r) => r.objective?.id === s.example.primary || r.objective === null);
      for (const r of primary) expect(r.met, `${id} ${r.req.id}: ${r.display} — ${r.why}`).not.toBe('fail');
      expect(a.value[s.example.primary]).toBeGreaterThan(0.4);
    });

    it(`${id}: the starter design analyses and asks for a payload`, () => {
      const a = analyze(SCENARIOS[id].starter, 'engineer');
      expect(a.issues.some((i) => i.level === 'fail' && i.role === 'science')).toBe(true);
    });
  }

  it('every decision has a consequence: radar adds power, money and data; UHF cannot carry pictures', () => {
    const eo = SCENARIOS['angola-eo'].example;
    const a = analyze(eo);
    const b = analyze({ ...cloneDesign(eo), instruments: [...eo.instruments, 'sar'], platform: 'small', arrayM2: 3, batteryWh: 600 });
    expect(b.power.loadW).toBeGreaterThan(a.power.loadW);
    expect(b.cost.totalM).toBeGreaterThan(a.cost.totalM + 15);
    expect(b.data.generatedGbitDay).toBeGreaterThan(a.data.generatedGbitDay);
    const t = SCENARIOS.tutorial.example;
    const uhf = analyze({ ...cloneDesign(t), band: 'UHF' }, 'cadet');
    expect(uhf.data.lossPct).toBeGreaterThan(50);
  });

  it('wrong tools fail with a reason: magnetorquers at GEO, a heavy satellite on Electron, an electric Mars capture', () => {
    const g = analyze({ ...cloneDesign(SCENARIOS['geo-comms'].example), adcs: 'magnetorquer' });
    expect(g.issues.some((i) => i.level === 'fail' && /magnetic/i.test(i.text))).toBe(true);
    const e = analyze({ ...cloneDesign(SCENARIOS['angola-eo'].example), launcher: 'electron', platform: 'small', instruments: ['sar', 'ms10', 'hr3'], arrayM2: 4, batteryWh: 800 });
    expect(e.launch.ok).toBe(false);
    const m = analyze({ ...cloneDesign(SCENARIOS['mars-orbiter'].example), propulsion: 'electric' });
    expect(m.issues.some((i) => i.level === 'fail' && /brake into orbit/.test(i.text))).toBe(true);
  });

  it('is deterministic', () => {
    const d = SCENARIOS['mars-orbiter'].example;
    expect(analyze(d).cost.totalM).toBe(analyze(d).cost.totalM);
  });
});
