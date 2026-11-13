/**
 * RIWA Space Journey (by team Space Underdogs), the mission design game (docs/03):
 * mission select → brief → design desks → review → build and fly → report. A 2D application with a 3D
 * spacecraft view, on a sky of drifting stars, with sound.
 */
import { useEffect, useRef } from 'react';
import { DIFFICULTY, normalizeDesign } from '../model/design';
import { useStudio, type Phase } from '../state';
import { parseShareCode } from '../storage';
import { canEdit } from '../model/team';
import { Fly } from './Fly';
import { Hangar, useHangar } from './Hangar';
import { ReportScreen } from './Report';
import { Lobby, TeamChips } from './team';
import { Coach, Glossary, HelpButtons, useHelp } from './help';
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

function TopBar() {
  const phase = useStudio((s) => s.phase);
  const setPhase = useStudio((s) => s.setPhase);
  const a = useStudio((s) => s.analysis)!;
  const edit = useStudio((s) => s.edit);
  const { undo, redo, loadExample, exit } = useStudio.getState();
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const team = useStudio((s) => s.team);
  const openHangar = useHangar((s) => s.show);
  const idx = STEPS.findIndex((s) => s.phase === phase);
  const editable = phase === 'brief' || phase === 'design' || phase === 'review';
  const hasReport = useStudio((s) => !!s.report);
  const reachable = (p: Phase, k: number) => p === phase || (k <= 2 && phase !== 'fly') || (p === 'report' && hasReport && phase !== 'fly');
  return (
    <header className="st-top">
      <Brand />
      <input
        className="st-name"
        aria-label="Mission name"
        value={a.design.name}
        disabled={!editable}
        onChange={(e) => edit('director', (d) => { d.name = e.target.value.slice(0, 40); })}
      />
      <span className="st-chip">{a.scenario.name}</span>
      <span className="st-chip dim">{DIFFICULTY[a.difficulty].name}</span>
      <TeamChips />
      <nav className="st-steps" aria-label="Mission phases">
        {STEPS.map((s, k) => (
          <button
            key={s.phase}
            type="button"
            className={`${s.phase === phase ? 'on' : ''} ${k < idx ? 'done' : ''}`}
            disabled={!reachable(s.phase, k)}
            data-guide={s.phase === 'design' ? 'go-design' : s.phase === 'review' ? 'go-review' : undefined}
            onClick={() => setPhase(s.phase)}
            title={s.label}
            aria-label={s.label}
          >
            <span>{k + 1}</span>
            <i className="st-step-name">{s.label}</i>
          </button>
        ))}
      </nav>
      <div className="st-actions">
        {editable && team.mode !== 'lan' && (
          <>
            <button type="button" onClick={undo} disabled={!canUndo} title="Undo">↶</button>
            <button type="button" onClick={redo} disabled={!canRedo} title="Redo">↷</button>
          </>
        )}
        {editable && canEdit(team, 'director') && <button type="button" onClick={loadExample} title="Load a design that is known to work">Example</button>}
        {editable && <button type="button" onClick={openHangar} title="Save this design, open a saved one, compare designs side by side">Designs</button>}
        {phase === 'design' && <button type="button" className="st-primary" data-guide="go-review-main" onClick={() => setPhase('review')}>Review →</button>}
        <HelpButtons />
        <button type="button" className="st-ghost" onClick={exit} title="Choose another mission">Missions</button>
      </div>
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
