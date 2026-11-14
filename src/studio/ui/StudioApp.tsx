/**
 * RIWA Space Journey (by team Space Underdogs), the mission design game (docs/03):
 * mission select → brief → design desks → review → build and fly → report. A 2D application with a 3D
 * spacecraft view, on a sky of drifting stars, with sound effects and music.
 */
import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY, normalizeDesign } from '../model/design';
import { useStudio, type Phase } from '../state';
import { parseShareCode } from '../storage';
import { canEdit } from '../model/team';
import { Fly } from './Fly';
import { Hangar, useHangar } from './Hangar';
import { ReportScreen } from './Report';
import { Lobby, TeamChips } from './team';
import { Coach, Glossary, HelpButtons, MusicButton, useHelp } from './help';
import { installMusic } from './music';
import { installClickSounds } from './sound';
import { Starfield } from './Starfield';
import { Brand } from './Brand';
import { Workspace } from './Workspace';
import { Brief, MissionSelect, Review } from './screens';
import '../studio.css';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'brief', label: 'Brief' },
  { phase: 'design', label: 'Design' },
  { phase: 'review', label: 'Review' },
  { phase: 'fly', label: 'Build & fly' },
  { phase: 'report', label: 'Report' },
];

/** The five phases, as numbered steps in the top bar or as a list in the menu. */
function PhaseSteps({ list = false, onPick }: { list?: boolean; onPick?: () => void }) {
  const phase = useStudio((s) => s.phase);
  const setPhase = useStudio((s) => s.setPhase);
  const hasReport = useStudio((s) => !!s.report);
  const idx = STEPS.findIndex((s) => s.phase === phase);
  const reachable = (p: Phase, k: number) => p === phase || (k <= 2 && phase !== 'fly') || (p === 'report' && hasReport && phase !== 'fly');
  return (
    <nav className={list ? 'st-menu-steps' : 'st-steps'} aria-label="Mission phases">
      {STEPS.map((s, k) => (
        <button
          key={s.phase}
          type="button"
          className={`${s.phase === phase ? 'on' : ''} ${k < idx ? 'done' : ''}`}
          disabled={!reachable(s.phase, k)}
          // the guide points at the steps in the bar, not at the copy in the menu
          data-guide={list ? undefined : s.phase === 'design' ? 'go-design' : s.phase === 'review' ? 'go-review' : undefined}
          aria-current={s.phase === phase ? 'step' : undefined}
          onClick={() => { setPhase(s.phase); onPick?.(); }}
          title={s.label}
          aria-label={list ? undefined : s.label}
        >
          <span>{k + 1}</span>
          <i className="st-step-name">{s.label}</i>
        </button>
      ))}
    </nav>
  );
}

/**
 * The top bar. On a wide screen everything is in it. On a tablet the tools move into a ☰ menu, and on a phone
 * the bar keeps only the mark, the numbered phases and the menu button.
 */
function TopBar() {
  const phase = useStudio((s) => s.phase);
  const setPhase = useStudio((s) => s.setPhase);
  const a = useStudio((s) => s.analysis)!;
  const { undo, redo, loadExample, exit } = useStudio.getState();
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const team = useStudio((s) => s.team);
  const openHangar = useHangar((s) => s.show);
  const editable = phase === 'brief' || phase === 'design' || phase === 'review';
  const [menu, setMenu] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const close = () => setMenu(false);
  // the menu closes on a new phase, a press outside it, or Esc
  useEffect(close, [phase]);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => { if (!bar.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [menu]);
  const undoRedo = editable && team.mode !== 'lan';
  const example = editable && canEdit(team, 'director');
  const review = phase === 'design' && <button type="button" className="st-primary" data-guide="go-review-main" onClick={() => setPhase('review')}>Review →</button>;
  return (
    <header className={`st-top ${menu ? 'menu-open' : ''}`} ref={bar}>
      <Brand />
      <span className="st-name" title="This mission's design">{a.design.name}</span>
      <span className="st-chip">{a.scenario.name}</span>
      <span className="st-chip dim">{DIFFICULTY[a.difficulty].name}</span>
      <TeamChips />
      <PhaseSteps />
      <div className="st-actions">
        {undoRedo && (
          <>
            <button type="button" className="st-tool" onClick={undo} disabled={!canUndo} title="Undo">↶</button>
            <button type="button" className="st-tool" onClick={redo} disabled={!canRedo} title="Redo">↷</button>
          </>
        )}
        {example && <button type="button" className="st-tool" onClick={loadExample} title="Load a design that is known to work">Example</button>}
        {editable && <button type="button" className="st-tool" onClick={openHangar} title="Save this design, open a saved one, compare designs side by side">Designs</button>}
        {review}
        <span className="st-tools">
          <HelpButtons />
          <MusicButton />
          <button type="button" className="st-ghost" onClick={exit} title="Choose another mission">Missions</button>
        </span>
      </div>
      <button type="button" className="st-menu-btn" aria-label="Menu" aria-expanded={menu} aria-controls="st-top-menu" onClick={() => setMenu(!menu)}>
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
          {menu ? <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /> : <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />}
        </svg>
      </button>
      {menu && (
        <div className="st-top-menu st-reveal-fast" id="st-top-menu">
          <div className="st-menu-head">
            <b>{a.design.name}</b>
            <span>{a.scenario.name} · {DIFFICULTY[a.difficulty].name}</span>
          </div>
          <div className="st-menu-team"><TeamChips /></div>
          <PhaseSteps list onPick={close} />
          {phase === 'design' && <button type="button" className="st-primary st-menu-go" onClick={() => setPhase('review')}>Review →</button>}
          {(undoRedo || example || editable) && (
            <div className="st-menu-row">
              {undoRedo && <button type="button" onClick={undo} disabled={!canUndo}>↶ <span>Undo</span></button>}
              {undoRedo && <button type="button" onClick={redo} disabled={!canRedo}>↷ <span>Redo</span></button>}
              {example && <button type="button" onClick={() => { loadExample(); close(); }}>Example</button>}
              {editable && <button type="button" onClick={() => { openHangar(); close(); }}>Designs</button>}
            </div>
          )}
          <div className="st-menu-list">
            <HelpButtons labeled onGlossary={close} />
            <MusicButton labeled />
          </div>
          <button type="button" className="st-ghost" onClick={exit}>Missions</button>
        </div>
      )}
    </header>
  );
}

export function StudioApp() {
  const phase = useStudio((s) => s.phase);
  const ready = useStudio((s) => !!s.analysis);
  const root = useRef<HTMLDivElement>(null);
  // a share link (#design=…) opens that design on its desks
  useEffect(() => {
    if (!location.hash.startsWith('#design=')) return;
    const d = parseShareCode(location.hash.slice('#design='.length));
    history.replaceState(null, '', location.pathname);
    if (d) useStudio.getState().begin(d.scenario, 'engineer', normalizeDesign(d));
  }, []);
  // every button makes a small sound (or the one it names)
  useEffect(() => (root.current ? installClickSounds(root.current) : undefined), []);
  // the music starts with the first click or key press (browsers keep pages quiet until then)
  useEffect(installMusic, []);
  const scale = useHelp((s) => s.scale);
  const lost = useStudio((s) => s.roomStatus === 'lost');
  return (
    <div className="studio" ref={root} style={{ zoom: scale }}>
      <Starfield />
      {lost && <div className="st-lost" role="alert">The server restarted, so this room is gone. Choose Missions to open a new one.</div>}
      <Glossary />
      <Hangar />
      {/* while designing, the guide sits in the right column (Workspace) */}
      {ready && phase !== 'select' && phase !== 'lobby' && phase !== 'design' && <Coach />}
      {phase === 'lobby' ? (
        <Lobby />
      ) : phase === 'select' || !ready ? (
        <MissionSelect />
      ) : (
        <>
          <TopBar />
          <div className="st-body">
            {phase === 'brief' ? <Brief /> : phase === 'design' ? <Workspace /> : phase === 'review' ? <Review /> : phase === 'fly' ? <Fly /> : <ReportScreen />}
          </div>
        </>
      )}
    </div>
  );
}
