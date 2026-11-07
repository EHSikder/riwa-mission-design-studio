/**
 * The design workspace: the desks on the left (one tab per role, with a count of that desk's problems), the
 * spacecraft in 3D and the feed of consequences in the middle, the resource dashboard on the right.
 */
import { SpacecraftView } from '../three/SpacecraftView';
import { canEdit, ownerOf } from '../model/team';
import { ROLES, type RoleId } from '../model/types';
import { useStudio } from '../state';
import { Dashboard } from './Dashboard';
import { DESKS } from './desks';
import { DeskBanner } from './team';
import { useCoachDesk } from './help';

function Feed() {
  const feed = useStudio((s) => s.feed);
  return (
    <div className="st-feed" aria-live="polite">
      <h4>What your last change did</h4>
      {feed.length === 0 ? (
        <p className="st-sub">Change anything on a desk and its consequences appear here: mass, power, money, data, time, and the requirements.</p>
      ) : (
        <ul>
          {feed.slice(0, 8).map((n) => (
            <li key={n.id} className={n.tone}>
              <span className="st-feed-icon" aria-hidden>{n.tone === 'good' ? '▲' : n.tone === 'bad' ? '▼' : '•'}</span>
              <span className={`st-role-chip ${n.role}`}>{ROLES[n.role].short}</span>
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Workspace() {
  const a = useStudio((s) => s.analysis)!;
  const desk = useStudio((s) => s.desk);
  const setDesk = useStudio((s) => s.setDesk);
  const edit = useStudio((s) => s.edit);
  const team = useStudio((s) => s.team);
  const coachDesk = useCoachDesk();
  const Desk = DESKS[desk];
  return (
    <div className="st-work">
      <aside className="st-left">
        <nav className="st-tabs" role="tablist" aria-label="Desks">
          {(Object.keys(ROLES) as RoleId[]).map((r) => {
            const fails = a.issues.filter((i) => i.role === r && i.level === 'fail').length;
            const warns = a.issues.filter((i) => i.role === r && i.level === 'warn').length;
            return (
              <button key={r} type="button" role="tab" aria-selected={desk === r} className={`${desk === r ? 'on' : ''} ${r} ${coachDesk === r && desk !== r ? 'coach' : ''}`} onClick={() => setDesk(r)}>
                {team.mode !== 'solo' && <span className="st-owner-dot" style={{ background: ownerOf(team, r)?.color }} title={ownerOf(team, r)?.name} />}
                {ROLES[r].desk}
                {fails > 0 ? <span className="st-tab-count fail" aria-label={`${fails} blocking problems`}>{fails}</span> : warns > 0 ? <span className="st-tab-count warn" aria-label={`${warns} warnings`}>{warns}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="st-desk" role="tabpanel">
          <DeskBanner role={desk} a={a} />
          {/* a desk that is not yours can be read, not changed */}
          <fieldset className="st-fieldset" disabled={!canEdit(team, desk)}>
            <Desk a={a} edit={(c) => edit(desk, c)} />
          </fieldset>
        </div>
      </aside>
      <main className="st-center">
        <SpacecraftView d={a.design} />
        <Feed />
      </main>
      <aside className="st-right">
        <Dashboard a={a} />
      </aside>
    </div>
  );
}
