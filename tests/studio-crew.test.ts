/**
 * Flying people around the Moon. The capsule must pass the checks that make a spacecraft fit for a crew, the
 * flight has the steps of a lunar mission, and the first requirement is that everyone comes home.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/studio/model/analyze';
import { cloneDesign, type StudioDesign } from '../src/studio/model/design';
import { SCENARIOS } from '../src/studio/model/scenarios';
import { evaluate } from '../src/studio/model/score';
import { MissionRun, type SimEvent } from '../src/studio/model/simulate';

const palanca = SCENARIOS['crew-moon'].example;
const withCrew = (d: StudioDesign, crew: Partial<NonNullable<StudioDesign['crew']>>): StudioDesign => ({ ...cloneDesign(d), crew: { ...d.crew!, ...crew } });
const fails = (d: StudioDesign) => analyze(d).issues.filter((i) => i.level === 'fail').map((i) => i.text).join(' | ');

function play(run: MissionRun, pick: (e: SimEvent) => string = (e) => e.options![0].id): SimEvent[] {
  const asked: SimEvent[] = [];
  for (let k = 0; k < 100_000 && !run.ended; k++) {
    if (run.pending) { asked.push({ ...run.pending }); run.choose(pick(run.pending)); } else run.advance(1);
  }
  return asked;
}

describe('a spacecraft fit for a crew', () => {
  it('the reference capsule passes its review, within budget, mass and schedule', () => {
    const a = analyze(palanca);
    expect(a.issues.filter((i) => i.level === 'fail').map((i) => i.text)).toEqual([]);
    expect(a.crew).toMatchObject({ size: 4, days: 10, moonDays: 1, supplyDays: 14, shieldOk: true });
    for (const r of Object.values(a.resources)) expect(r.status, `${r.id}: ${r.headline}`).not.toBe('fail');
    for (const r of a.requirements) expect(r.met, `${r.req.label}: ${r.display}`).not.toBe('fail');
  });

  it('the review board names what makes a capsule unsafe for people', () => {
    expect(fails(withCrew(palanca, { abort: 'none' }))).toMatch(/escape system/i);
    expect(fails(withCrew(palanca, { shield: 'leo' }))).toMatch(/heat shield/i);
    expect(fails({ ...cloneDesign(palanca), redundant: false })).toMatch(/no spare/i);
    expect(fails({ ...cloneDesign(palanca), launcher: 'falconHeavy' })).toMatch(/not certified to carry people/i);
    expect(fails(withCrew({ ...cloneDesign(palanca), platform: 'capsule3' }, { size: 4 }))).toMatch(/3 seats/);
  });

  it('a longer stay at the Moon costs supplies, radiation and propellant', () => {
    const flyby = analyze(palanca);
    const gateway = analyze({ ...cloneDesign(palanca), orbit: { ...palanca.orbit, type: 'crewNrho' } });
    expect(gateway.crew!.moonDays).toBe(12);
    expect(gateway.mass.wetKg).toBeGreaterThan(flyby.mass.wetKg + 4_000);
    expect(gateway.crew!.doseMsv).toBeGreaterThan(flyby.crew!.doseMsv + 20);
    // the stowage shelter is no longer enough for a month: the dose requirement fails until the shelter is better
    expect(gateway.requirements.find((r) => r.req.metric === 'crewDose')!.met).toBe('fail');
    const shielded = analyze(withCrew({ ...cloneDesign(palanca), orbit: { ...palanca.orbit, type: 'crewNrho' } }, { shelter: 'shielded' }));
    expect(shielded.requirements.find((r) => r.req.metric === 'crewDose')!.met).not.toBe('fail');
  });
});

describe('the flight', () => {
  it('a Cadet flight goes out, around and home, step by step', () => {
    const run = new MissionRun(analyze(palanca, 'cadet'), 4);
    const asked = play(run);
    expect(asked.map((e) => e.id)).toEqual(['test:vibration', 'test:tvac', 'test:deploy', 'test:compat', 'test:rehearsal', 'test:abort', 'test:eclss', 'launch', 'deploy', 'signal', 'checkout', 'tli']);
    expect(run.events.some((e) => e.id === 'flyby')).toBe(true);
    expect(run.st.endReason).toBe('Mission complete');
    expect(run.st.crew).toMatchObject({ alive: true, moonDays: 1 });
    const r = evaluate(run);
    expect(r.outcome).toMatch(/success/i);
    expect(r.crew).toMatchObject({ alive: true, days: 10 });
    expect(r.score.total).toBeGreaterThan(650);
  });

  it('stopping at the Moon takes a burn to arrive and a burn to leave', () => {
    const d = { ...cloneDesign(palanca), orbit: { ...palanca.orbit, type: 'crewDro' as const }, primary: 'moonSci', secondary: [], instruments: ['lunarCam', 'radSensors', 'bioLab'] as StudioDesign['instruments'] };
    const run = new MissionRun(analyze(d, 'cadet'), 4);
    const asked = play(run).map((e) => e.id);
    expect(asked).toContain('loi');
    expect(asked.indexOf('tei')).toBeGreaterThan(asked.indexOf('loi'));
    expect(run.st.crew!.moonDays).toBe(6);
    expect(run.st.endReason).toBe('Mission complete');
  });

  it('a no-go before the Moon brings the crew home early, alive', () => {
    const run = new MissionRun(analyze(palanca, 'cadet'), 4);
    play(run, (e) => (e.id === 'tli' ? 'nogo' : e.options![0].id));
    expect(run.st.endReason).toBe('Returned from Earth orbit');
    expect(run.st.crew!.alive).toBe(true);
    expect(run.st.crew!.moonDays).toBe(0);
  });

  it('a heat shield built for low orbit does not survive the return, and nothing else counts', () => {
    const run = new MissionRun(analyze(withCrew(palanca, { shield: 'leo' }), 'cadet'), 4);
    play(run);
    expect(run.st.endReason).toBe('Loss of crew');
    const r = evaluate(run);
    expect(r.outcome).toBe('Crew lost');
    expect(r.score.success).toBe(0);
    expect(r.score.value).toBe(0);
    expect(r.limited.join(' ')).toMatch(/heat/i);
  });

  it('in a solar storm the shelter decides the dose', () => {
    for (let seed = 1; seed < 400; seed++) {
      const mk = () => new MissionRun(analyze(palanca, 'engineer'), seed);
      const probe = mk();
      const asked = play(probe);
      if (!asked.some((e) => e.id === 'anomaly:storm') || probe.st.endReason !== 'Mission complete') continue;
      const hid = mk(), worked = mk();
      play(hid, (e) => (e.id === 'anomaly:storm' ? 'shelter' : e.options![0].id));
      play(worked, (e) => (e.id === 'anomaly:storm' ? 'work' : e.options![0].id));
      expect(worked.st.crew!.doseMsv).toBeGreaterThan(hid.st.crew!.doseMsv + 300);
      return;
    }
    throw new Error('no storm found');
  });
});
