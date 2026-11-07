/**
 * The RIWA Mission Design Studio (docs/03): mission select → brief → design desks → review → fly → report.
 * A 2D application with a 3D spacecraft view.
 */
import { useEffect } from 'react';
import { DIFFICULTY } from '../model/design';
import { useStudio, type Phase } from '../state';
import { parseShareCode } from '../storage';
import { canEdit } from '../model/team';
import { Fly } from './Fly';
import { ReportScreen } from './Report';
import { Lobby, TeamChips } from './team';
import { Coach, Glossary, HelpButtons, useHelp } from './help';
import { Workspace } from './Workspace';
import { Brief, MissionSelect, Review } from './screens';
import '../studio.css';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'brief', label: 'Brief' },
  { phase: 'design', label: 'Design' },
  { phase: 'review', label: 'Review' },
  { phase: 'fly', label: 'Fly' },
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
  const idx = STEPS.findIndex((s) => s.phase === phase);
  const editable = phase === 'brief' || phase === 'design' || phase === 'review';
  const hasReport = useStudio((s) => !!s.report);
  const reachable = (p: Phase, k: number) => p === phase || (k <= 2 && phase !== 'fly') || (p === 'report' && hasReport && phase !== 'fly');
  return (
    <header className="st-top">
      <div className="st-brand">
        <b>RIWA</b>
        <span>Mission Design Studio</span>
      </div>
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
            onClick={() => setPhase(s.phase)}
          >
            <span>{k + 1}</span>
            {s.label}
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
        {phase === 'design' && <button type="button" className="st-primary" onClick={() => setPhase('review')}>Review →</button>}
        <HelpButtons />
        <button type="button" className="st-ghost" onClick={exit} title="Choose another mission">Missions</button>
      </div>
    </header>
  );
}

export function StudioApp() {
  const phase = useStudio((s) => s.phase);
  const ready = useStudio((s) => !!s.analysis);
  // a share link (#design=…) opens that design on its desks
  useEffect(() => {
    if (!location.hash.startsWith('#design=')) return;
    const d = parseShareCode(location.hash.slice('#design='.length));
    history.replaceState(null, '', location.pathname);
    if (d) useStudio.getState().begin(d.scenario, 'engineer', d);
  }, []);
  const scale = useHelp((s) => s.scale);
  const lost = useStudio((s) => s.roomStatus === 'lost');
  return (
    <div className="studio" style={{ zoom: scale }}>
      {lost && <div className="st-lost" role="alert">The server restarted, so this room is gone. Choose Missions to open a new one.</div>}
      <Glossary />
      {ready && phase !== 'select' && phase !== 'lobby' && <Coach />}
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
