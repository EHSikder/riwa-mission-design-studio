/**
 * The mission's six resources, always in view (docs/03 §3): each with its value, its limit, a bar, a status that
 * carries a word and an icon (never colour alone), and the reason behind it one click away. Under them: the
 * requirements as predicted right now, and the problems, each with the role that owns it and a fix.
 */
import { useState, type JSX } from 'react';
import type { Analysis, Issue, ResourceSummary } from '../model/analyze';
import { ROLES, type ResourceId } from '../model/types';
import { StatusBadge } from './controls';
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

function ResourceCard({ r }: { r: ResourceSummary }) {
  const [open, setOpen] = useState(false);
  const share = r.limit > 0 && Number.isFinite(r.limit) ? Math.min(1.25, Math.max(0, r.value / r.limit)) : 0;
  return (
    <button type="button" className={`st-res ${r.status} ${r.critical ? 'critical' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="st-res-top">
        <span className="st-res-icon"><ResourceIcon id={r.id} /></span>
        <b>{r.name}</b>
        {r.critical && <span className="st-crit" title="Critical for this mission">★</span>}
        <StatusBadge status={r.status} />
      </span>
      <span className="st-res-head">{r.headline}</span>
      <span className="st-bar" aria-hidden>
        <span style={{ width: `${(share / 1.25) * 100}%` }} />
        <i style={{ left: '80%' }} />
      </span>
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

export function Dashboard({ a }: { a: Analysis }) {
  const fails = a.issues.filter((i) => i.level === 'fail').length;
  const warns = a.issues.filter((i) => i.level === 'warn').length;
  return (
    <div className="st-dash">
      <h3>Resources <span className="st-sub">tap a card for the why</span></h3>
      <div className="st-res-grid">
        {(['mass', 'power', 'budget', 'data', 'comms', 'time'] as ResourceId[]).map((id) => <ResourceCard key={id} r={a.resources[id]} />)}
      </div>
      <h3>Requirements <span className="st-sub">predicted</span></h3>
      <ul className="st-reqmini-list">
        {a.requirements.map((r) => <ReqRow key={r.req.id} r={r} />)}
      </ul>
      <h3>
        Problems{' '}
        <span className="st-sub">{fails ? `${fails} blocking` : 'none blocking'}{warns ? ` · ${warns} warnings` : ''}</span>
      </h3>
      <IssueList issues={a.issues} />
    </div>
  );
}
