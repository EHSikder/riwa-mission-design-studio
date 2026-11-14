/**
 * Help for every player (docs/03 §9).
 * - The coach: one small step at a time (tutorial, Guided and Cadet games), checked against the real design.
 * - The mission guide (tutorial and Guided): a light that sits on the very button to press next, and a
 *   "Suggested" mark on a choice that works, taken from the mission's reference design. No AI: the same rules
 *   the coach checks, pointed at the screen.
 * - The glossary, the text size, and the switches for the sound effects and the music. Preferences stay in this browser.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import type { Analysis } from '../model/analyze';
import { currentStep, type CoachStep } from '../model/coach';
import type { StudioDesign } from '../model/design';
import { GLOSSARY } from '../model/glossary';
import { ROLES } from '../model/types';
import { useStudio, type Phase } from '../state';
import { useMusic } from './music';
import { useSound } from './sound';

const KEY = 'underdogs.studio.help';
const SCALES = [1, 1.15, 1.3];

interface Help {
  coachHidden: boolean;
  glossary: boolean;
  scale: number;
  set: (p: Partial<Omit<Help, 'set'>>) => void;
}

const saved = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Help>; } catch { return {}; }
})();

export const useHelp = create<Help>((set, get) => ({
  coachHidden: saved.coachHidden ?? false,
  glossary: false,
  scale: SCALES.includes(saved.scale ?? 1) ? (saved.scale ?? 1) : 1,
  set: (p) => {
    set(p);
    try { localStorage.setItem(KEY, JSON.stringify({ coachHidden: get().coachHidden, scale: get().scale })); } catch { /* keep going */ }
  },
}));

/** The coach shows in the tutorial and in Guided and Cadet games; the pointer and the suggestions in the tutorial and Guided. */
export const coachOn = (a: Analysis) => !!a.scenario.tutorial || a.difficulty === 'cadet' || a.difficulty === 'guided';
export const guideOn = (a: Analysis) => !!a.scenario.tutorial || a.difficulty === 'guided';

/** The design the guide suggests from: the mission's reference design (Guided and the tutorial only). */
export function useSuggest(): StudioDesign | null {
  const a = useStudio((s) => s.analysis);
  const hidden = useHelp((s) => s.coachHidden);
  return a && guideOn(a) && !hidden ? a.scenario.example : null;
}

/**
 * Where on screen the current step is done, best first: the big button before the small one, the suggested
 * card before the section around it.
 */
interface Target { sels: string[]; tip: string }
function targetOf(step: CoachStep, a: Analysis, phase: Phase, desk: string | null, sections: Record<string, boolean>): Target {
  const go = (name: string) => [`[data-guide="${name}-main"]`, `[data-guide="${name}"]`];
  if (step.desk) {
    if (phase !== 'design') return { sels: go('go-design'), tip: 'Back to the design' };
    if (desk !== step.desk) return { sels: [`[data-guide="desk:${step.desk}"]`], tip: `Open the ${ROLES[step.desk].desk} desk` };
    const sec = step.section?.(a);
    if (!sec) return { sels: [], tip: '' };
    if (!sections[sec]) return { sels: [`[data-guide="section:${sec}"]`], tip: 'Open this part' };
    return { sels: [`[data-guide="body:${sec}"] [data-suggest]`, `[data-guide="body:${sec}"]`], tip: 'Pick the suggested one (or choose your own)' };
  }
  if (step.id === 'brief') return { sels: go('go-design'), tip: 'Start designing' };
  if (step.id === 'green' || step.id === 'review' || step.id === 'launch') return phase === 'review' ? { sels: go('go-fly'), tip: 'Build and fly' } : { sels: go('go-review'), tip: 'Go to the review board' };
  if (step.id === 'fly') return { sels: ['[data-guide="action"]', '[data-guide="to-report"]'], tip: 'Do this step' };
  return { sels: [], tip: '' };
}

/** The light on the button to press next, drawn above everything (outside the zoomed game, so its box is exact). */
function GuidePointer({ step, target }: { step: CoachStep; target: Target }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const targets = target.sels;
  const key = targets.join('|');
  useEffect(() => {
    if (!targets.length) { setBox(null); return; }
    let first = true;
    const find = () => {
      // the first target, in order of preference, that is on screen
      let el: HTMLElement | undefined;
      for (const sel of targets) {
        el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.offsetParent !== null);
        if (el) break;
      }
      if (!el) { setBox(null); return; }
      if (first) { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); first = false; }
      const r = el.getBoundingClientRect();
      setBox((b) => (b && Math.abs(b.x - r.x) < 0.5 && Math.abs(b.y - r.y) < 0.5 && Math.abs(b.width - r.width) < 0.5 && Math.abs(b.height - r.height) < 0.5 ? b : r));
    };
    find();
    const id = setInterval(find, 250);
    return () => clearInterval(id);
  }, [key]);
  if (!box) return null;
  const pad = 6;
  // a narrow button at the left edge (the desk rail): the tip goes beside it, not over its neighbours
  const beside = box.left < 140 && box.width < 200;
  const below = box.top < 140;
  const left = Math.min(Math.max(12, box.left), window.innerWidth - 300);
  return createPortal(
    <div className="st-guide-layer" aria-hidden>
      <div className="st-guide-ring" style={{ left: box.left - pad, top: box.top - pad, width: box.width + 2 * pad, height: box.height + 2 * pad }} />
      <div className="st-guide-tip" style={beside ? { left: box.right + 16, top: box.top + box.height / 2, transform: 'translateY(-50%)' } : below ? { left, top: box.bottom + 14 } : { left, top: box.top - 14, transform: 'translateY(-100%)' }}>
        <b>{target.tip || 'Click here'}</b>
        <span>{step.title}</span>
      </div>
    </div>,
    document.body,
  );
}

export function Coach({ docked = false }: { docked?: boolean }) {
  const a = useStudio((s) => s.analysis);
  const phase = useStudio((s) => s.phase);
  const desk = useStudio((s) => s.desk);
  const sections = useStudio((s) => s.sections);
  const run = useStudio((s) => s.run);
  const { setDesk, setPhase, openSection } = useStudio.getState();
  const hidden = useHelp((s) => s.coachHidden);
  const set = useHelp((s) => s.set);
  // the flight screen re-renders on its own clock: follow it so the pointer finds the next step's button
  const [, tick] = useState(0);
  useEffect(() => {
    if (phase !== 'fly') return;
    const id = setInterval(() => tick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, [phase]);
  if (!a || !coachOn(a)) return null;
  if (hidden) return <button type="button" className={`st-coach-open phase-${phase} ${docked ? 'docked' : ''}`} onClick={() => set({ coachHidden: false })}>Show the guide</button>;
  const { step, index, total } = currentStep(a, phase);
  const sec = step.section?.(a);
  const showMe = () => {
    if (step.desk) {
      if (phase !== 'design') setPhase('design');
      setDesk(step.desk);
      if (sec) openSection(sec, true);
    } else if (step.id === 'brief') setPhase('design');
    else if (step.id === 'green' || step.id === 'review') setPhase('review');
  };
  const flying = phase === 'fly' && run && !run.ended;
  const text = flying && run.pending
    ? (run.pending.kind === 'action' ? `${run.pending.title}: press the button in the middle of the screen. ${run.pending.text}` : `${run.pending.title}: read the options and choose. Each one says what it costs.`)
    : step.text;
  return (
    <>
      <aside className={`st-coach phase-${phase} ${docked ? 'docked' : ''}`} aria-live="polite" aria-label="Mission guide">
        <header>
          <span className="st-kicker">{guideOn(a) ? 'Mission guide' : 'Coach'} · step {index + 1} of {total}</span>
          <button type="button" className="st-ghost" onClick={() => set({ coachHidden: true })} aria-label="Hide the guide">✕</button>
        </header>
        <b>{flying && run.pending ? run.pending.title : step.title}</b>
        <p>{text}</p>
        <div className="st-coach-foot">
          <span className="st-coach-bar"><span style={{ width: `${(index / Math.max(1, total - 1)) * 100}%` }} /></span>
          {(step.desk || step.id === 'brief' || step.id === 'green' || step.id === 'review') && (
            <button type="button" className="st-primary" onClick={showMe}>{step.desk ? `Open ${ROLES[step.desk].desk}` : 'Show me'}</button>
          )}
        </div>
      </aside>
      {guideOn(a) && <GuidePointer step={step} target={targetOf(step, a, phase, desk, sections)} />}
    </>
  );
}

/** The desk the coach points at, for the glowing desk button. */
export function useCoachDesk(): string | null {
  const a = useStudio((s) => s.analysis);
  const phase = useStudio((s) => s.phase);
  const hidden = useHelp((s) => s.coachHidden);
  if (!a || hidden || !coachOn(a)) return null;
  return currentStep(a, phase).step.desk ?? null;
}

export function Glossary() {
  const open = useHelp((s) => s.glossary);
  const set = useHelp((s) => s.set);
  const [q, setQ] = useState('');
  if (!open) return null;
  const terms = GLOSSARY.filter((t) => `${t.term} ${t.plain} ${t.why}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="st-modal" role="dialog" aria-modal="true" aria-labelledby="st-gloss-title" onClick={() => set({ glossary: false })} onKeyDown={(e) => e.key === 'Escape' && set({ glossary: false })}>
      <div className="st-glossary" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="st-gloss-title">Mission design words</h2>
          <button type="button" className="st-ghost" onClick={() => set({ glossary: false })} aria-label="Close the glossary">✕</button>
        </header>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: battery, orbit, swath…" aria-label="Search the glossary" />
        <dl>
          {terms.map((t) => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.plain} <span className="st-dim">{t.why}</span></dd>
            </div>
          ))}
          {terms.length === 0 && <p className="st-sub">No word matches “{q}”.</p>}
        </dl>
      </div>
    </div>
  );
}

/** The music switch: a note, crossed out while the music is off. `labeled` adds the words (for the menu). */
export function MusicButton({ labeled = false }: { labeled?: boolean }) {
  const on = useMusic((s) => s.on);
  const toggle = useMusic((s) => s.toggle);
  return (
    <button type="button" className={`st-music ${on ? '' : 'off'}`} onClick={toggle} title={on ? 'Music is on' : 'Music is off'} aria-label={labeled ? undefined : on ? 'Turn the music off' : 'Turn the music on'} aria-pressed={on}>
      <svg className="st-ic" viewBox="0 0 20 20" width="18" height="18" aria-hidden>
        <path d="M7.5 15V4.6l9-2.1V13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="5.2" cy="15" r="2.4" fill="currentColor" />
        <circle cx="14.2" cy="13" r="2.4" fill="currentColor" />
        {!on && <path d="M2.5 2.5l15 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />}
      </svg>
      {labeled && <span>{on ? 'Music on' : 'Music off'}</span>}
    </button>
  );
}

/** Glossary, sound-effects and text-size buttons for the top bar; `labeled` adds the words (for the menu). */
export function HelpButtons({ labeled = false, onGlossary }: { labeled?: boolean; onGlossary?: () => void }) {
  const scale = useHelp((s) => s.scale);
  const set = useHelp((s) => s.set);
  const muted = useSound((s) => s.muted);
  const toggle = useSound((s) => s.toggle);
  const size = `${Math.round(scale * 100)}%`;
  return (
    <>
      <button type="button" onClick={() => { set({ glossary: true }); onGlossary?.(); }} title="Glossary: the words of mission design" aria-label={labeled ? undefined : 'Open the glossary'}><span className="st-ic">?</span>{labeled && <span>Glossary</span>}</button>
      <button type="button" onClick={toggle} title={muted ? 'Sound effects are off' : 'Sound effects are on'} aria-label={labeled ? undefined : muted ? 'Turn the sound effects on' : 'Turn the sound effects off'} aria-pressed={!muted}><span className="st-ic">{muted ? '🔇' : '🔊'}</span>{labeled && <span>{muted ? 'Sound effects off' : 'Sound effects on'}</span>}</button>
      <button type="button" onClick={() => set({ scale: SCALES[(SCALES.indexOf(scale) + 1) % SCALES.length] })} title="Text size" aria-label={labeled ? undefined : `Text size ${size}`}><span className="st-ic">A{scale > 1 ? '+' : ''}{scale > 1.2 ? '+' : ''}</span>{labeled && <span>Text size {size}</span>}</button>
    </>
  );
}
