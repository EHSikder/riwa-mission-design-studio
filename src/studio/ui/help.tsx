/**
 * Help for every player (docs/03 §9): the coach that walks beginners through one step at a time (tutorial and
 * Cadet), the glossary of mission-design words, and the text size. Preferences stay in this browser.
 */
import { useState } from 'react';
import { create } from 'zustand';
import { currentStep } from '../model/coach';
import { GLOSSARY } from '../model/glossary';
import { ROLES } from '../model/types';
import { useStudio } from '../state';

const KEY = 'riwa.studio.help';
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

/** The coach shows in the tutorial and in Cadet games. */
export const coachOn = (scenarioTutorial: boolean, difficulty: string) => scenarioTutorial || difficulty === 'cadet';

export function Coach() {
  const a = useStudio((s) => s.analysis);
  const phase = useStudio((s) => s.phase);
  const setDesk = useStudio((s) => s.setDesk);
  const setPhase = useStudio((s) => s.setPhase);
  const hidden = useHelp((s) => s.coachHidden);
  const set = useHelp((s) => s.set);
  if (!a || !coachOn(!!a.scenario.tutorial, a.difficulty)) return null;
  if (hidden) return <button type="button" className="st-coach-open" onClick={() => set({ coachHidden: false })}>Coach</button>;
  const { step, index, total } = currentStep(a, phase);
  const showMe = () => {
    if (step.desk) {
      if (phase !== 'design') setPhase('design');
      setDesk(step.desk);
    } else if (step.id === 'brief') setPhase('design');
    else if (step.id === 'green' || step.id === 'review') setPhase('review');
  };
  return (
    <aside className="st-coach" aria-live="polite" aria-label="Coach">
      <header>
        <span className="st-kicker">Step {index + 1} of {total}</span>
        <button type="button" className="st-ghost" onClick={() => set({ coachHidden: true })} aria-label="Hide the coach">✕</button>
      </header>
      <b>{step.title}</b>
      <p>{step.text}</p>
      <div className="st-coach-foot">
        <span className="st-coach-bar"><span style={{ width: `${(index / Math.max(1, total - 1)) * 100}%` }} /></span>
        {(step.desk || step.id === 'brief' || step.id === 'green' || step.id === 'review') && (
          <button type="button" className="st-primary" onClick={showMe}>{step.desk ? `Open the ${ROLES[step.desk].desk} desk` : 'Show me'}</button>
        )}
      </div>
    </aside>
  );
}

/** The desk the coach points at, for the pulsing tab. */
export function useCoachDesk(): string | null {
  const a = useStudio((s) => s.analysis);
  const phase = useStudio((s) => s.phase);
  const hidden = useHelp((s) => s.coachHidden);
  if (!a || hidden || !coachOn(!!a.scenario.tutorial, a.difficulty)) return null;
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

/** Glossary and text-size buttons for the top bar. */
export function HelpButtons() {
  const scale = useHelp((s) => s.scale);
  const set = useHelp((s) => s.set);
  return (
    <>
      <button type="button" onClick={() => set({ glossary: true })} title="Glossary: the words of mission design" aria-label="Open the glossary">?</button>
      <button type="button" onClick={() => set({ scale: SCALES[(SCALES.indexOf(scale) + 1) % SCALES.length] })} title="Text size" aria-label={`Text size ${Math.round(scale * 100)}%`}>A{scale > 1 ? '+' : ''}{scale > 1.2 ? '+' : ''}</button>
    </>
  );
}
