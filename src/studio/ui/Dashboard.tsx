/**
 * The mission's six resources, its requirements and its problems (docs/03 §3). Each group is a button that opens
 * with a click; closed, it still shows how things stand at a glance. A resource has a sweet spot, not a "more is
 * better": its gauge shows too little, just right and more than needed, and says why each end is a problem.
 */
import { useState, type JSX } from 'react';
import type { Analysis, Issue, ResourceSummary } from '../model/analyze';
import { ROLES, type ResourceId } from '../model/types';
import { useStudio } from '../state';
import { GaugeBar, StatusBadge } from './controls';
import { MetBadge } from './desks';

const ICONS: Record<ResourceId, JSX.Element> = {
  mass: <path d="M5 6.5h6l2 7H3zM8 2.5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 1 1 0-3.2" />,
  power: <path d="M9.2 1.5 3.5 9h4l-1 5.5L12.5 7h-4z" />,
  budget: <><circle cx="8" cy="8" r="6" /><path d="M10 5.6c-.5-.6-1.2-.9-2-.9-1.1 0-2 .6-2 1.5 0 2 4 1.2 4 3.3 0 .9-.9 1.6-2 1.6-.9 0-1.6-.4-2.1-1M8 3.4v9.2" /></>,
  data: <><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" /></>,
  comms: <><path d="M4 12l3.5-3.5M2.2 6.3a7 7 0 0 1 7.5 7.5M2.4 2.6a10.6 10.6 0 0 1 11 11" /><circle cx="3.6" cy="12.4" r="1.1" /></>,
  time: <><circle cx="8" cy="8" r="6" /><path d="M8 4.6V8l2.4 1.6" /></>,
};

export function ResourceIcon({ id }: { id: ResourceId }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[id]}
    </svg>
  );
}

export const RESOURCE_ORDER: ResourceId[] = ['mass', 'power', 'budget', 'data', 'comms', 'time'];

function ResourceCard({ r }: { r: ResourceSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={`st-res ${r.status} ${r.critical ? 'critical' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} data-sfx={open ? 'close' : 'open'}>
      <span className="st-res-top">
        <span className="st-res-icon"><ResourceIcon id={r.id} /></span>
        <b>{r.name}</b>
        {r.critical && <span className="st-crit" title="Critical for this mission">★</span>}
        <StatusBadge status={r.status} />
      </span>
      <span className="st-res-head">{r.headline}</span>
      {r.gauge ? <GaugeBar g={r.gauge} open={open} /> : null}
      {open && <span className="st-res-why">{r.why}</span>}
    </button>
  );
}

function IssueRow({ i }: { i: Issue }) {
  return (
    <li className={`st-issue ${i.level}`}>
      <span className="st-issue-icon" aria-label={i.level}>{i.level === 'fail' ? '✕' : i.level === 'warn' ? '!' : 'i'}</span>
      <span>
        <span className={`st-role-chip ${i.role}`}>{ROLES[i.role].short}</span>
        {i.text}
        {i.fix && <span className="st-issue-fix">→ {i.fix}</span>}
      </span>
    </li>
  );
}

export function IssueList({ issues, limit }: { issues: Issue[]; limit?: number }) {
  const order = { fail: 0, warn: 1, info: 2 } as const;
  const sorted = [...issues].sort((x, y) => order[x.level] - order[y.level]);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  if (!issues.length) return <p className="st-sub">No problems found. Every resource is within its limits.</p>;
  return (
    <ul className="st-issues">
      {shown.map((i, k) => <IssueRow key={k} i={i} />)}
      {limit && sorted.length > limit && <li className="st-sub">…and {sorted.length - limit} more</li>}
    </ul>
  );
}

function ReqRow({ r }: { r: Analysis['requirements'][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`st-reqmini ${r.met}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="st-reqmini-label">{r.req.label}</span>
        <span className="st-reqmini-val">{r.display}</span>
        <MetBadge met={r.met} level={r.level} />
      </button>
      {open && <span className="st-res-why">{r.why}</span>}
    </li>
  );
}

/** A panel on the right that opens and closes; its summary shows while closed. */
function Fold(props: { id: string; title: string; summary: JSX.Element | string; children: JSX.Element }) {
  const open = useStudio((s) => !!s.folds[props.id]);
  const toggle = useStudio((s) => s.toggleFold);
  return (
    <section className={`st-rfold ${open ? 'open' : ''}`}>
      <button type="button" className="st-rfold-btn" aria-expanded={open} data-sfx={open ? 'close' : 'open'} data-guide={`fold:${props.id}`} onClick={() => toggle(props.id)}>
        <span className="st-rfold-title">{props.title}</span>
        <span className="st-rfold-sum">{props.summary}</span>
        <span className="st-chev" aria-hidden />
      </button>
      {open && <div className="st-rfold-body st-reveal-fast">{props.children}</div>}
    </section>
  );
}

export function Dashboard({ a }: { a: Analysis }) {
  const fails = a.issues.filter((i) => i.level === 'fail').length;
  const warns = a.issues.filter((i) => i.level === 'warn').length;
  const met = a.requirements.filter((r) => r.met !== 'fail').length;
  const rs = RESOURCE_ORDER.map((id) => a.resources[id]);
  return (
    <div className="st-dash">
      <Fold
        id="resources"
        title="Resources"
        summary={
          <span className="st-res-dots">
            {rs.map((r) => <span key={r.id} className={`st-res-dot ${r.status}`} title={`${r.name}: ${r.headline}`}><ResourceIcon id={r.id} /></span>)}
          </span>
        }
      >
        <div className="st-res-grid">{rs.map((r) => <ResourceCard key={r.id} r={r} />)}</div>
      </Fold>
      <Fold id="requirements" title="Requirements" summary={<span className={met === a.requirements.length ? 'st-ok' : 'st-bad'}>{met} of {a.requirements.length} met</span>}>
        <ul className="st-reqmini-list">{a.requirements.map((r) => <ReqRow key={r.req.id} r={r} />)}</ul>
      </Fold>
      <Fold id="problems" title="Problems" summary={<span className={fails ? 'st-bad' : warns ? 'st-warnword' : 'st-ok'}>{fails ? `${fails} blocking` : 'none blocking'}{warns ? ` · ${warns} warnings` : ''}</span>}>
        <IssueList issues={a.issues} />
      </Fold>
    </div>
  );
}
