/**
 * The design workspace. On the left a rail of desk buttons (one per role, with a count of that desk's
 * problems): a click opens the desk beside it, a second click closes it. In the middle the spacecraft on its
 * assembly stand, the build checklist, and a card naming what the last change did while the camera flies to
 * that part. On the right the resources, requirements and problems, each a button that opens.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { SpacecraftView } from '../three/SpacecraftView';
import { canEdit, ownerOf } from '../model/team';
import { ROLES, type RoleId } from '../model/types';
import { useStudio } from '../state';
import { Dashboard } from './Dashboard';
import { BUILD_AT, DESKS } from './desks';
import { DeskBanner } from './team';
import { Coach, useCoachDesk } from './help';
import { sfx } from './sound';

const DESK_ICON: Record<RoleId, JSX.Element> = {
  director: <><circle cx="12" cy="12" r="8" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3" /><circle cx="12" cy="12" r="2" /></>,
  spacecraft: <><rect x="9" y="8" width="6" height="8" rx="1" /><path d="M3 10h6M3 14h6M15 10h6M15 14h6M12 8V5" /></>,
  science: <><circle cx="12" cy="12" r="3.2" /><path d="M5 12a7 7 0 0 1 14 0M12 15.2V20M9 20h6" /></>,
  comms: <><path d="M6 18 12 9l6 9M12 9V5" /><path d="M8.5 6.5a5 5 0 0 1 7 0M6.5 4.5a8 8 0 0 1 11 0" /></>,
  resources: <><circle cx="12" cy="12" r="8" /><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.5 5 4.2 0 1.1-1.1 2-2.5 2-1.1 0-2-.5-2.6-1.3M12 6.5v11" /></>,
};

function DeskRail() {
  const a = useStudio((s) => s.analysis)!;
  const desk = useStudio((s) => s.desk);
  const toggle = useStudio((s) => s.toggleDesk);
  const team = useStudio((s) => s.team);
  const coachDesk = useCoachDesk();
  return (
    <nav className="st-rail" aria-label="Desks">
      {(Object.keys(ROLES) as RoleId[]).map((r) => {
        const fails = a.issues.filter((i) => i.role === r && i.level === 'fail').length;
        const warns = a.issues.filter((i) => i.role === r && i.level === 'warn').length;
        const owner = ownerOf(team, r);
        return (
          <button
            key={r}
            type="button"
            aria-pressed={desk === r}
            data-guide={`desk:${r}`}
            data-sfx={desk === r ? 'close' : 'open'}
            className={`st-rail-btn ${r} ${desk === r ? 'on' : ''} ${coachDesk === r && desk !== r ? 'coach' : ''}`}
            onClick={() => toggle(r)}
            title={`${ROLES[r].name}${team.mode !== 'solo' && owner ? ` · ${owner.name}` : ''}`}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{DESK_ICON[r]}</svg>
            <span>{ROLES[r].desk}</span>
            {team.mode !== 'solo' && <i className="st-owner-bar" style={{ background: owner?.color }} />}
            {fails > 0 ? <em className="st-tab-count fail" aria-label={`${fails} blocking problems`}>{fails}</em> : warns > 0 ? <em className="st-tab-count warn" aria-label={`${warns} warnings`}>{warns}</em> : null}
          </button>
        );
      })}
    </nav>
  );
}

/** The build list over the 3D view: what is on the stand, what is missing; a click opens the right section. */
function BuildStrip() {
  const a = useStudio((s) => s.analysis)!;
  const { setDesk, openSection } = useStudio.getState();
  const done = a.build.filter((b) => b.done).length;
  return (
    <div className="st-build" aria-label="Build list">
      <span className="st-build-count">{done}/{a.build.length} built</span>
      {a.build.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`st-build-chip ${b.done ? 'done' : b.optional ? 'opt' : 'todo'}`}
          title={b.hint}
          onClick={() => {
            const at = BUILD_AT[b.id];
            if (!at) return;
            setDesk(at[0]);
            openSection(at[1], true);
          }}
        >
          <i aria-hidden>{b.done ? '✓' : '○'}</i>{b.label}
        </button>
      ))}
    </div>
  );
}

/** "Changed: …" over the spacecraft, for a few seconds after each change. */
function ChangeCard() {
  const focus = useStudio((s) => s.focus);
  const [shown, setShown] = useState<typeof focus>(null);
  useEffect(() => {
    if (!focus) return;
    setShown(focus);
    const id = setTimeout(() => setShown(null), 4200);
    return () => clearTimeout(id);
  }, [focus?.at]);
  if (!shown) return null;
  return (
    <div key={shown.at} className="st-change" role="status">
      <span className="st-kicker">Changed · {shown.label}</span>
      {shown.text && <b>{shown.text}</b>}
    </div>
  );
}

function Feed() {
  const feed = useStudio((s) => s.feed);
  const [open, setOpen] = useState(false);
  if (feed.length === 0) return <div className="st-feed empty"><span className="st-sub">Change anything on a desk: what it did to mass, power, money, data, time and the requirements appears here.</span></div>;
  return (
    <div className={`st-feed ${open ? 'open' : ''}`} aria-live="polite">
      <button type="button" className="st-feed-btn" aria-expanded={open} onClick={() => setOpen(!open)} data-sfx={open ? 'close' : 'open'}>
        <span className="st-kicker">What your changes did</span>
        <span className="st-chev" aria-hidden />
      </button>
      <ul>
        {feed.slice(0, open ? 12 : 2).map((n) => (
          <li key={n.id} className={n.tone}>
            <span className="st-feed-icon" aria-hidden>{n.tone === 'good' ? '▲' : n.tone === 'bad' ? '▼' : '•'}</span>
            <span className={`st-role-chip ${n.role}`}>{ROLES[n.role].short}</span>
            {n.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Workspace() {
  const a = useStudio((s) => s.analysis)!;
  const desk = useStudio((s) => s.desk);
  const edit = useStudio((s) => s.edit);
  const team = useStudio((s) => s.team);
  const focus = useStudio((s) => s.focus);
  const Desk = desk ? DESKS[desk] : null;
  // a chime when a change fixed something, a warning when it broke something
  const prev = useRef({ fails: -1, built: -1 });
  useEffect(() => {
    const fails = a.issues.filter((i) => i.level === 'fail').length;
    const built = a.build.filter((b) => b.done).length;
    const p = prev.current;
    if (p.fails >= 0 && (fails < p.fails || built > p.built)) setTimeout(() => sfx('good'), 160);
    else if (p.fails >= 0 && fails > p.fails) setTimeout(() => sfx('warn'), 160);
    prev.current = { fails, built };
  }, [a]);
  return (
    <div className={`st-work ${desk ? 'desk-open' : ''}`}>
      <DeskRail />
      {Desk && desk && (
        <aside className="st-left st-slide" aria-label={`${ROLES[desk].desk} desk`}>
          <div className="st-desk">
            <DeskBanner role={desk} a={a} />
            {/* a desk that is not yours can be read, not changed */}
            <fieldset className="st-fieldset" disabled={!canEdit(team, desk)}>
              <Desk a={a} edit={(c) => edit(desk, c)} />
            </fieldset>
          </div>
        </aside>
      )}
      <main className="st-center">
        <SpacecraftView d={a.design} body={a.scenario.body} stand focus={focus}>
          <BuildStrip />
          <ChangeCard />
        </SpacecraftView>
        <Feed />
      </main>
      <aside className="st-right">
        <Coach docked />
        <Dashboard a={a} />
      </aside>
    </div>
  );
}
