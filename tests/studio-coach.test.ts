/**
 * Step 5E: the coach. Doing exactly what each tutorial step says completes it and brings up the next one, all
 * the way to the report; the Cadet coach does the same for a real mission; the glossary is complete.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/studio/model/analyze';
import { currentStep } from '../src/studio/model/coach';
import { cloneDesign, type StudioDesign } from '../src/studio/model/design';
import { GLOSSARY } from '../src/studio/model/glossary';
import { SCENARIOS } from '../src/studio/model/scenarios';

/** What the "Size it for me" buttons do. */
function sizeArrays(d: StudioDesign) {
  const a = analyze(d, 'cadet');
  const perM2 = a.power.bolW / d.arrayM2;
  const ageing = a.power.eolW / a.power.bolW;
  d.arrayM2 = Math.min(a.power.maxArrayM2, Math.ceil(((a.power.requiredW * 1.15) / (perM2 * ageing)) * 20) / 20);
}
const sizeBattery = (d: StudioDesign) => { d.batteryWh = Math.ceil((analyze(d, 'cadet').power.batteryNeedWh * 1.1) / 10) * 10; };

describe('the coach', () => {
  it('walks the tutorial one step at a time, each step done by doing what it says', () => {
    const d = cloneDesign(SCENARIOS.tutorial.starter);
    let phase = 'brief';
    const step = () => currentStep(analyze(d, 'cadet'), phase).step.id;
    const seen: string[] = [];
    const doIt: Record<string, () => void> = {
      brief: () => { phase = 'design'; },
      camera: () => { d.instruments = ['cubecam']; },
      pointing: () => { d.adcs = 'wheels'; },
      power: () => { d.mount = 'deployed'; sizeArrays(d); },
      battery: () => sizeBattery(d),
      downlink: () => { d.band = 'S'; },
      green: () => { phase = 'review'; },
      launch: () => { phase = 'fly'; },
      fly: () => { phase = 'report'; },
    };
    for (let k = 0; k < 20; k++) {
      const id = step();
      seen.push(id);
      if (id === 'report') break;
      expect(doIt[id], `no action for step ${id}`).toBeDefined();
      doIt[id]();
      expect(step(), `step ${id} did not complete`).not.toBe(id);
    }
    expect(seen).toEqual(['brief', 'camera', 'pointing', 'power', 'battery', 'downlink', 'green', 'launch', 'fly', 'report']);
  });

  it('a Cadet player on a real mission is pointed at the right desks, and the example design clears them', () => {
    const s = SCENARIOS['angola-eo'];
    const start = currentStep(analyze(s.starter, 'cadet'), 'design');
    expect(start.step.id).toBe('payload');
    expect(start.step.desk).toBe('science');
    expect(currentStep(analyze(s.example, 'cadet'), 'design').step.id).toBe('review');
  });

  it('the glossary explains the words the game uses', () => {
    const words = GLOSSARY.map((t) => t.term.toLowerCase()).join(' | ');
    for (const w of ['eclipse', 'δv', 'swath', 'revisit', 'link budget', 'margin', 'trl', 'redundancy', 'launch window', 'rain fade']) expect(words).toContain(w);
    for (const t of GLOSSARY) expect(t.plain.length + t.why.length).toBeGreaterThan(40);
  });
});
